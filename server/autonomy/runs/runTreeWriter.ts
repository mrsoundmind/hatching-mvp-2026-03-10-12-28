/**
 * Phase 37 — runTreeWriter
 *
 * Pure async wrappers over storage.* methods for the autonomy run tree.
 * All writes are non-fatal: a failure to write a step row MUST NOT block
 * the autonomy pipeline (mirrors eventLogger.ts DB-or-file fallback pattern).
 *
 * Score delta math (Pitfall 4): null unless BOTH prior and current rubric totals
 * are finite numbers. Per D-06.1, the live autonomy pipeline does NOT currently
 * produce Phase 36 deliverables — ~100% of live calls leave scoreDelta = null.
 * Phase 47 backlog #2 tracks the bridge work.
 *
 * D-05 module API contract:
 *   ensureRunForTrace(traceId, input) → runId      (upsert-idempotent on traceId)
 *   startStep(runId, parentStepId, input) → stepId (forwards to storage.createRunStep)
 *   completeStep(stepId, output) → void            (server-side score delta + storage.updateRunStep)
 *   failStep(stepId, error) → void                 (storage.updateRunStep with status='failed')
 */
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { storage } from '../../storage.js';
import { db } from '../../db.js';
import { autonomyRunSteps, deliverableVersions, type InsertAutonomyRunStep } from '@shared/schema';

// In-process memo to avoid repeated lookups within a single worker invocation.
// T-37-15: bounded by total distinct traceIds the worker has seen (tens of thousands per long-lived process; ~2MB worst-case).
const _runIdByTrace = new Map<string, string>();

export async function ensureRunForTrace(
  traceId: string,
  input: { projectId: string; userId?: string; rootAgentId?: string; rootGoal?: string },
): Promise<string> {
  // Memo hit
  const cached = _runIdByTrace.get(traceId);
  if (cached) return cached;
  try {
    // Look up via storage — query path returns runs filtered by project; we filter by traceId in-memory.
    // Small N (at most 100 active runs per project per fetch). 37-04 backfill adds a direct traceId
    // read path if needed; for the live pipeline this is sufficient since each worker invocation
    // only does one lookup per traceId then caches.
    const tree = await storage.getRunsByProject(input.projectId, { limit: 100 });
    const existing = tree.runs.find((r) => r.traceId === traceId);
    if (existing) {
      _runIdByTrace.set(traceId, existing.id);
      return existing.id;
    }
    const created = await storage.createRun({
      traceId,
      projectId: input.projectId,
      userId: input.userId ?? null,
      rootAgentId: input.rootAgentId ?? null,
      rootGoal: input.rootGoal?.slice(0, 500) ?? null,
      status: 'running',
    });
    _runIdByTrace.set(traceId, created.id);
    return created.id;
  } catch (err) {
    console.warn('[runTreeWriter] ensureRunForTrace failed:', (err as Error).message);
    // Return a synthetic id so downstream calls don't crash. Step writes will fail-soft below.
    const synthetic = `synthetic-${randomUUID()}`;
    _runIdByTrace.set(traceId, synthetic);
    return synthetic;
  }
}

export async function startStep(
  runId: string,
  parentStepId: string | null,
  input: Omit<InsertAutonomyRunStep, 'runId' | 'parentStepId' | 'status'> & {
    status?: 'pending' | 'running' | 'complete' | 'failed' | 'skipped';
  },
): Promise<string | null> {
  if (runId.startsWith('synthetic-')) return null; // ensureRunForTrace failed earlier — skip
  try {
    const step = await storage.createRunStep({
      runId,
      parentStepId,
      status: input.status ?? 'running',
      ...input,
    } as InsertAutonomyRunStep);
    return step.id;
  } catch (err) {
    console.warn('[runTreeWriter] startStep failed:', (err as Error).message);
    return null;
  }
}

export async function completeStep(
  stepId: string | null,
  output: {
    deliverableId?: string;
    deliverableVersionId?: string;
    priorRubricTotal?: number | null;
    currentRubricTotal?: number | null;
  },
  startedAtMs?: number,
): Promise<void> {
  if (!stepId) return;
  try {
    // Score delta computation (Pitfall 4 + D-09).
    // Null unless BOTH prior and current rubric totals are finite numbers.
    // NaN inputs are rejected by Number.isFinite (NaN-guard from Pitfall 4).
    let scoreDelta: number | null = null;
    if (
      output.deliverableVersionId &&
      Number.isFinite(output.priorRubricTotal as number) &&
      Number.isFinite(output.currentRubricTotal as number)
    ) {
      scoreDelta = (output.currentRubricTotal as number) - (output.priorRubricTotal as number);
    }
    const completedAt = new Date();
    const latencyMs = startedAtMs ? completedAt.getTime() - startedAtMs : null;

    // W-4: when deliverableVersionId is present, denormalize the version's versionNumber
    // onto the step row so the client can dispatch open_deliverable with the right version
    // without a second fetch. One SELECT; cheap; only when a deliverable was produced (rare per D-06.1).
    let deliverableVersionNumber: number | null = null;
    if (output.deliverableVersionId) {
      try {
        const rows = await db
          .select({ versionNumber: deliverableVersions.versionNumber })
          .from(deliverableVersions)
          .where(eq(deliverableVersions.id, output.deliverableVersionId))
          .limit(1);
        if (rows[0] && Number.isFinite(rows[0].versionNumber)) {
          deliverableVersionNumber = rows[0].versionNumber;
        }
      } catch (lookupErr) {
        console.warn('[runTreeWriter] versionNumber lookup failed:', (lookupErr as Error).message);
        // Fall through with deliverableVersionNumber=null — graceful degradation. The W-4
        // success criterion (open to correct version) WILL miss for this row, but no crash.
      }
    }

    await storage.updateRunStep(stepId, {
      status: 'complete',
      completedAt,
      latencyMs,
      deliverableId: output.deliverableId ?? null,
      deliverableVersionId: output.deliverableVersionId ?? null,
      deliverableVersionNumber,
      scoreDelta,
    });
  } catch (err) {
    console.warn('[runTreeWriter] completeStep failed:', (err as Error).message);
  }
}

/**
 * Finalize a run when the task (or handoff chain) has ended. Sets the terminal
 * status, the denormalized step_count, and the aggregate score delta, and bumps
 * updated_at. Without this the run row stays 'running' forever with step_count 0,
 * so the Tree renders every run frozen at "In progress" and never resolves.
 * Non-fatal, like every other writer in this module.
 */
export async function completeRun(
  runId: string,
  opts: { status: 'complete' | 'failed' },
): Promise<void> {
  if (runId.startsWith('synthetic-')) return; // ensureRunForTrace failed earlier — nothing to close
  try {
    const steps = await db
      .select({ scoreDelta: autonomyRunSteps.scoreDelta })
      .from(autonomyRunSteps)
      .where(eq(autonomyRunSteps.runId, runId));
    const stepCount = steps.length;
    const deltas = steps
      .map((s) => s.scoreDelta)
      .filter((d): d is number => typeof d === 'number' && Number.isFinite(d));
    // Null (not 0) when no step produced a scored deliverable — preserves the
    // formatScoreDelta 'new' contract. A run whose steps DID score shows the sum.
    // (Phase 47 #2: the live pipeline rarely produces Phase 36 deliverables, so
    // this is usually null — the run still correctly reads as completed via status.)
    const aggregateScoreDelta = deltas.length > 0 ? deltas.reduce((a, b) => a + b, 0) : null;
    await storage.updateRun(runId, {
      status: opts.status,
      stepCount,
      aggregateScoreDelta,
      updatedAt: new Date(),
    });
  } catch (err) {
    console.warn('[runTreeWriter] completeRun failed:', (err as Error).message);
  }
}

export async function failStep(stepId: string | null, error: Error): Promise<void> {
  if (!stepId) return;
  try {
    await storage.updateRunStep(stepId, {
      status: 'failed',
      completedAt: new Date(),
      // T-37-11: clip error.message to 500 chars before storing (defense-in-depth limit on JSONB blob size + accidental disclosure of long stack traces).
      metadata: { error: error.message?.slice(0, 500) ?? 'unknown error' } as Record<string, unknown>,
    });
  } catch (err) {
    console.warn('[runTreeWriter] failStep failed:', (err as Error).message);
  }
}

/**
 * DEV-only test helper — clears the in-process traceId → runId memo.
 * Same double-guard pattern as server/llm/providerHealthState.ts:__resetForTests.
 */
export function __resetWriterForTests(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'FATAL: __resetWriterForTests() called in production. Test-only helper must not run in a production code path.',
    );
  }
  _runIdByTrace.clear();
}
