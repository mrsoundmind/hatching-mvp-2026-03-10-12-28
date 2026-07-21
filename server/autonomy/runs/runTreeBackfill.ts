/**
 * Phase 37 — autonomy_events → autonomy_runs/autonomy_run_steps backfill.
 *
 * Mirrors server/autonomy/events/eventLogger.ts raw pool.query exception (CLAUDE.md § 14):
 * autonomy_events reads use raw pool.query, NOT Drizzle, because the historical event
 * payloads are typed as Record<string, unknown> and Drizzle's strict typing would force
 * runtime parse failures on legitimate historical variance.
 *
 * D-17 (idempotent), D-18 (flat per traceId — historical handoff edges unrecoverable),
 * D-19 (score deltas from payload deliverableVersionId when present),
 * D-20 (manual trigger only — NO auto-on-boot).
 *
 * Pitfall 3: 5-minute stable-event window to avoid racing the live writer.
 *
 * Design choice — dependency injection for testability:
 *   The two raw-pool reads (events + deliverable_versions) AND the idempotency
 *   count are exposed via the BackfillDeps interface. Production passes
 *   `defaultDeps` (raw pool); the unit test (scripts/test-run-tree-backfill.ts)
 *   passes mock deps with in-memory state. The writes still go through `storage.*`
 *   so the parent-mismatch guard + timeoutAt rules apply uniformly.
 */
import { pool } from '../../db.js';
import { storage } from '../../storage.js';

interface AutonomyEventRow {
  id: string;
  trace_id: string;
  project_id: string | null;
  user_id: string | null;
  hatch_id: string | null;
  event_type: string;
  timestamp: string;
  payload: Record<string, unknown> | null;
}

export interface BackfillResult {
  runsCreated: number;
  stepsCreated: number;
  skipped: number;
}

/**
 * Injectable dependencies — see header for rationale. Production code passes
 * `defaultDeps`; tests pass mock deps with predictable in-memory state.
 */
export interface BackfillDeps {
  /**
   * Returns events for a project with timestamp < `since` (the 5-minute stable
   * window cutoff). Ordered by trace_id ASC, then timestamp ASC, so the
   * caller's per-trace grouping is single-pass.
   */
  eventsForProject(projectId: string, since: string): Promise<AutonomyEventRow[]>;
  /**
   * Given a deliverableVersionId, returns the current version's rubricScore.total
   * AND the previous version's rubricScore.total for the SAME deliverable.
   * Either or both may be null when data is missing or non-finite.
   * Also returns the version_number so the step row can be denormalized (W-4).
   */
  versionAndPrior(deliverableVersionId: string): Promise<{
    current: { total: number; versionNumber: number } | null;
    prior: { total: number } | null;
  }>;
  /**
   * Idempotency check — returns true if any autonomy_run_steps row already
   * exists for this traceId. Backfill skips traces where this returns true.
   */
  hasAnyStepForTrace(traceId: string): Promise<boolean>;
}

export const defaultDeps: BackfillDeps = {
  async eventsForProject(projectId, since) {
    const res = await pool.query(
      `SELECT id, trace_id, project_id, user_id, hatch_id, event_type, timestamp, payload
         FROM autonomy_events
        WHERE project_id = $1 AND timestamp < $2
        ORDER BY trace_id, timestamp ASC`,
      [projectId, since],
    );
    return res.rows as AutonomyEventRow[];
  },
  async versionAndPrior(deliverableVersionId) {
    const curRes = await pool.query(
      `SELECT rubric_score, deliverable_id, version_number FROM deliverable_versions WHERE id = $1 LIMIT 1`,
      [deliverableVersionId],
    );
    const curRow = curRes.rows[0] as { rubric_score: any; deliverable_id: string; version_number: number } | undefined;
    if (!curRow) return { current: null, prior: null };
    const currentTotal = curRow.rubric_score?.total ?? null;
    const versionNumber = curRow.version_number;
    const priorRes = await pool.query(
      `SELECT rubric_score FROM deliverable_versions
         WHERE deliverable_id = $1 AND version_number < $2
         ORDER BY version_number DESC LIMIT 1`,
      [curRow.deliverable_id, curRow.version_number],
    );
    const priorTotal = (priorRes.rows[0] as { rubric_score: any } | undefined)?.rubric_score?.total ?? null;
    return {
      current:
        Number.isFinite(currentTotal as number) && Number.isFinite(versionNumber)
          ? { total: currentTotal as number, versionNumber }
          : Number.isFinite(versionNumber)
            ? { total: NaN, versionNumber }  // versionNumber populated but total not finite — flag downstream
            : null,
      prior: Number.isFinite(priorTotal as number) ? { total: priorTotal as number } : null,
    };
  },
  async hasAnyStepForTrace(traceId) {
    const res = await pool.query(
      `SELECT COUNT(*)::text as count FROM autonomy_run_steps WHERE trace_id = $1`,
      [traceId],
    );
    return parseInt((res.rows[0] as { count: string })?.count ?? '0', 10) > 0;
  },
};

/**
 * Map an autonomy_event.event_type to a run-step.step_type. Conservative mapping;
 * unknown event types default to 'task' (the most common case).
 */
export function inferStepTypeFromEvent(
  eventType: string,
): 'task' | 'handoff' | 'peer_review' | 'deliberation' | 'safety_block' | 'approval_request' {
  if (eventType.startsWith('peer_review')) return 'peer_review';
  if (eventType.startsWith('handoff')) return 'handoff';
  if (eventType.includes('safety') || eventType.includes('block')) return 'safety_block';
  if (eventType.includes('approval')) return 'approval_request';
  if (eventType.includes('deliberation')) return 'deliberation';
  return 'task';
}

/**
 * Backfill a single project's autonomy_events into autonomy_runs + autonomy_run_steps.
 *
 * - Idempotent: skips traceIds where any step already exists (D-17).
 * - 5-minute stable-event window: events with `timestamp >= NOW() - interval '5 minutes'`
 *   are NOT processed (Pitfall 3 — avoids race with live writer).
 * - Flat per traceId: all backfilled steps have parentStepId=null (D-18 — handoff
 *   edges unrecoverable from pre-Phase-37 event catalog).
 * - Score delta computed from payload-derived deliverableVersionId via deps.versionAndPrior;
 *   null when either current or prior is non-finite (D-19, Pitfall 4 NaN-guard).
 * - All backfilled steps have status='complete' — historical events are settled by
 *   definition; running rows would never get swept (timeoutAt is in the past).
 */
export async function backfillRunTreeForProject(
  projectId: string,
  deps: BackfillDeps = defaultDeps,
): Promise<BackfillResult> {
  let runsCreated = 0;
  let stepsCreated = 0;
  let skipped = 0;

  // 5-min stable window cutoff — computed at the START of the backfill to make
  // grouping consistent across one invocation even if it takes a few seconds.
  const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const eventRows = await deps.eventsForProject(projectId, since);

  // Group by trace_id
  const byTrace = new Map<string, AutonomyEventRow[]>();
  for (const ev of eventRows) {
    const list = byTrace.get(ev.trace_id) ?? [];
    list.push(ev);
    byTrace.set(ev.trace_id, list);
  }

  for (const [traceId, events] of byTrace) {
    // Idempotency check
    const already = await deps.hasAnyStepForTrace(traceId);
    if (already) {
      skipped += events.length;
      continue;
    }

    const firstEvent = events[0];
    const lastEvent = events[events.length - 1];
    const rootGoalRaw =
      (firstEvent.payload as any)?.taskTitle ??
      (firstEvent.payload as any)?.taskId ??
      'Backfilled run';
    const rootGoal = String(rootGoalRaw).slice(0, 500);

    const run = await storage.createRun({
      traceId,
      projectId,
      userId: firstEvent.user_id,
      rootAgentId: firstEvent.hatch_id,
      rootGoal,
      status: 'complete',
      stepCount: events.length,
      aggregateScoreDelta: null,
      metadata: {
        backfilledFrom: 'autonomy_events',
        flatHistorical: true,
        eventCount: events.length,
        firstTimestamp: firstEvent.timestamp,
        lastTimestamp: lastEvent.timestamp,
      },
    });
    runsCreated += 1;

    for (const ev of events) {
      let scoreDelta: number | null = null;
      let deliverableVersionId: string | null = null;
      let deliverableVersionNumber: number | null = null;
      const dvId = (ev.payload as any)?.deliverableVersionId;
      if (typeof dvId === 'string') {
        deliverableVersionId = dvId;
        const { current, prior } = await deps.versionAndPrior(dvId);
        if (current && Number.isFinite(current.versionNumber)) {
          deliverableVersionNumber = current.versionNumber;
        }
        if (
          current &&
          Number.isFinite(current.total) &&
          prior &&
          Number.isFinite(prior.total)
        ) {
          scoreDelta = current.total - prior.total;
        }
      }
      const stepType = inferStepTypeFromEvent(ev.event_type);
      const title = String((ev.payload as any)?.taskTitle ?? ev.event_type).slice(0, 200);
      const deliverableId =
        typeof (ev.payload as any)?.deliverableId === 'string'
          ? ((ev.payload as any).deliverableId as string)
          : null;
      await storage.createRunStep({
        runId: run.id,
        parentStepId: null,
        traceId,
        agentId: ev.hatch_id,
        agentName: (() => {
          const n = (ev.payload as any)?.agentName;
          return typeof n === 'string' && n.length > 0 ? n : null;
        })(),
        agentRole: (() => {
          const r = (ev.payload as any)?.agentRole;
          return typeof r === 'string' && r.length > 0 ? r : null;
        })(),
        stepType,
        title,
        status: 'complete',
        deliverableId,
        deliverableVersionId,
        deliverableVersionNumber,
        scoreDelta,
        metadata: { backfilledFromEventId: ev.id, eventType: ev.event_type } as Record<string, unknown>,
        completedAt: new Date(ev.timestamp),
        latencyMs: null,
      });
      stepsCreated += 1;
    }
  }

  return { runsCreated, stepsCreated, skipped };
}

/**
 * Backfill every project visible in the projects table. Operator-facing entry
 * used by the `npm run backfill:run-tree` script.
 */
export async function backfillAllProjects(): Promise<{ totalRuns: number; totalSteps: number; totalSkipped: number }> {
  let totalRuns = 0;
  let totalSteps = 0;
  let totalSkipped = 0;
  const res = await pool.query(`SELECT id FROM projects`);
  for (const row of res.rows as Array<{ id: string }>) {
    const r = await backfillRunTreeForProject(row.id);
    totalRuns += r.runsCreated;
    totalSteps += r.stepsCreated;
    totalSkipped += r.skipped;
  }
  return { totalRuns, totalSteps, totalSkipped };
}

/**
 * DEV-only test helper — mirrors providerHealthState.ts:__resetForTests guard.
 * Currently a no-op (no in-process state to reset); reserved for future state.
 */
export function __resetBackfillForTests(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: __resetBackfillForTests() called in production. Test-only helper must not run in a production code path.');
  }
  // No in-process state to reset; placeholder for future memos.
}
