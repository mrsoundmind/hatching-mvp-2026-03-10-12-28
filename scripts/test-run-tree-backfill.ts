#!/usr/bin/env tsx
/**
 * Phase 37 — Unit tests for autonomy run-tree backfill (TREE-05).
 *
 * 4 cases per CONTEXT D-24:
 *   - seed-5-events-flat      : 5 mock events sharing one traceId → 1 run + 5 flat steps
 *                                + metadata.flatHistorical=true (D-18).
 *   - idempotency             : second invocation creates 0 runs / 0 steps; skipped >= 1.
 *   - 5-minute-window-respected : fresh events (within 5 min) skipped, old events processed.
 *   - score-delta-from-payload : payload deliverableVersionId → step.scoreDelta computed
 *                                via deps.versionAndPrior + Number.isFinite NaN-guard.
 *
 * Runs under STORAGE_MODE=memory NODE_ENV=test with mock BackfillDeps (no live DB).
 *
 * Run: STORAGE_MODE=memory NODE_ENV=test npx tsx scripts/test-run-tree-backfill.ts
 */
import 'dotenv/config';
import assert from 'node:assert/strict';
import {
  backfillRunTreeForProject,
  type BackfillDeps,
} from '../server/autonomy/runs/runTreeBackfill.js';
import { storage, __resetRunTreeForTests } from '../server/storage.js';

interface MockEvent {
  id: string;
  trace_id: string;
  project_id: string | null;
  user_id: string | null;
  hatch_id: string | null;
  event_type: string;
  timestamp: string;
  payload: Record<string, unknown> | null;
}

/**
 * Build BackfillDeps from an in-memory event list + an optional version lookup map.
 * The hasAnyStepForTrace mock reads back from `storage.getRunsByProject` so the
 * idempotency test (which calls backfill twice with the SAME deps) reflects state
 * accumulated in the storage layer — matching production semantics.
 */
function makeDeps(
  events: MockEvent[],
  versionLookup: Record<string, { current: number | null; prior: number | null; versionNumber?: number }> = {},
): BackfillDeps {
  return {
    async eventsForProject(projectId, since) {
      return events.filter(
        (e) => e.project_id === projectId && e.timestamp < since,
      );
    },
    async versionAndPrior(dvId) {
      const r = versionLookup[dvId];
      if (!r) return { current: null, prior: null };
      const versionNumber = r.versionNumber ?? 1;
      return {
        current:
          r.current != null && Number.isFinite(r.current)
            ? { total: r.current, versionNumber }
            : Number.isFinite(versionNumber)
              ? { total: NaN, versionNumber }
              : null,
        prior: r.prior != null && Number.isFinite(r.prior) ? { total: r.prior } : null,
      };
    },
    async hasAnyStepForTrace(traceId) {
      // Mirror production semantics: existence is global, not project-scoped.
      // We're under STORAGE_MODE=memory; storage.getRunsByProject lets us peek
      // at every project we've seeded in this test scope. The test cases each
      // call __resetRunTreeForTests() at the start so state never bleeds.
      // Reuse 'p1' since every case uses that single project id.
      const tree = await storage.getRunsByProject('p1', { limit: 1000 });
      return tree.steps.some((s) => s.traceId === traceId);
    },
  };
}

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

async function case_seed5EventsFlat(): Promise<void> {
  __resetRunTreeForTests();
  const baseOldTs = new Date(Date.now() - 1000 * 60 * 60).toISOString(); // 1hr ago
  const events: MockEvent[] = Array.from({ length: 5 }).map((_, i) => ({
    id: `e-${i}`,
    trace_id: 'trace-A',
    project_id: 'p1',
    user_id: null,
    hatch_id: 'a1',
    event_type: 'autonomous_task_execution',
    timestamp: new Date(new Date(baseOldTs).getTime() + i * 1000).toISOString(),
    payload: { taskTitle: `Step ${i + 1}`, agentName: 'Coda', agentRole: 'engineer' },
  }));
  const result = await backfillRunTreeForProject('p1', makeDeps(events));
  assert.equal(result.runsCreated, 1, 'one run row');
  assert.equal(result.stepsCreated, 5, 'five step rows');
  const tree = await storage.getRunsByProject('p1');
  assert.equal(tree.runs.length, 1, 'tree has exactly one run');
  assert.equal(
    (tree.runs[0].metadata as any)?.flatHistorical,
    true,
    'flatHistorical metadata flag set on backfilled run',
  );
  assert.equal(
    (tree.runs[0].metadata as any)?.backfilledFrom,
    'autonomy_events',
    'backfilledFrom marker set on backfilled run',
  );
  assert.equal(tree.steps.length, 5, 'tree has exactly five steps');
  for (const s of tree.steps) {
    assert.equal(s.parentStepId, null, 'all steps flat (parentStepId null) per D-18');
    assert.equal(s.status, 'complete', 'all backfilled steps marked complete');
    assert.equal(s.agentName, 'Coda', 'agentName copied from payload');
    assert.equal(s.agentRole, 'engineer', 'agentRole copied from payload');
  }
  console.log('PASS seed-5-events-flat: 1 run + 5 flat steps + flatHistorical=true');
}

async function case_idempotency(): Promise<void> {
  __resetRunTreeForTests();
  const oldTs = new Date(Date.now() - 1000 * 60 * 60).toISOString();
  const events: MockEvent[] = [
    {
      id: 'e-1',
      trace_id: 'trace-B',
      project_id: 'p1',
      user_id: null,
      hatch_id: null,
      event_type: 'autonomous_task_execution',
      timestamp: oldTs,
      payload: { taskTitle: 'Solo' },
    },
  ];
  const deps = makeDeps(events);
  const first = await backfillRunTreeForProject('p1', deps);
  assert.equal(first.runsCreated, 1, 'first invocation creates 1 run');
  assert.equal(first.stepsCreated, 1, 'first invocation creates 1 step');
  assert.equal(first.skipped, 0, 'first invocation skips 0');

  const second = await backfillRunTreeForProject('p1', deps);
  assert.equal(second.runsCreated, 0, 'second invocation is no-op (0 runs)');
  assert.equal(second.stepsCreated, 0, 'second invocation is no-op (0 steps)');
  assert.ok(second.skipped >= 1, 'second invocation skipped count >= 1');
  console.log('PASS idempotency: second invocation creates 0 runs / 0 steps');
}

async function case_5MinuteWindow(): Promise<void> {
  __resetRunTreeForTests();
  // 3 events within last 5 min — must be SKIPPED by the window filter.
  const freshTs = new Date(Date.now() - 1000 * 60).toISOString(); // 1min ago
  // 2 events older than 5 min — must be PROCESSED.
  const oldTs = new Date(Date.now() - 1000 * 60 * 10).toISOString(); // 10min ago
  const events: MockEvent[] = [
    {
      id: 'fresh-1',
      trace_id: 't-fresh',
      project_id: 'p1',
      user_id: null,
      hatch_id: null,
      event_type: 'autonomous_task_execution',
      timestamp: freshTs,
      payload: {},
    },
    {
      id: 'fresh-2',
      trace_id: 't-fresh',
      project_id: 'p1',
      user_id: null,
      hatch_id: null,
      event_type: 'autonomous_task_execution',
      timestamp: freshTs,
      payload: {},
    },
    {
      id: 'fresh-3',
      trace_id: 't-fresh',
      project_id: 'p1',
      user_id: null,
      hatch_id: null,
      event_type: 'autonomous_task_execution',
      timestamp: freshTs,
      payload: {},
    },
    {
      id: 'old-1',
      trace_id: 't-old',
      project_id: 'p1',
      user_id: null,
      hatch_id: null,
      event_type: 'autonomous_task_execution',
      timestamp: oldTs,
      payload: { taskTitle: 'O1' },
    },
    {
      id: 'old-2',
      trace_id: 't-old',
      project_id: 'p1',
      user_id: null,
      hatch_id: null,
      event_type: 'autonomous_task_execution',
      timestamp: oldTs,
      payload: { taskTitle: 'O2' },
    },
  ];
  const result = await backfillRunTreeForProject('p1', makeDeps(events));
  assert.equal(result.runsCreated, 1, '1 run from the 2 old events');
  assert.equal(result.stepsCreated, 2, '2 steps from the 2 old events');
  const tree = await storage.getRunsByProject('p1');
  const traceIds = new Set(tree.steps.map((s) => s.traceId));
  assert.ok(
    traceIds.has('t-old') && !traceIds.has('t-fresh'),
    'only t-old processed; t-fresh inside 5-min window skipped',
  );
  console.log('PASS 5-minute-window-respected: fresh events skipped, old events processed');
}

async function case_scoreDeltaFromPayload(): Promise<void> {
  __resetRunTreeForTests();
  const oldTs = new Date(Date.now() - 1000 * 60 * 60).toISOString();
  const events: MockEvent[] = [
    {
      id: 'e-finite',
      trace_id: 't-sdfp',
      project_id: 'p1',
      user_id: null,
      hatch_id: null,
      event_type: 'peer_review_completed',
      timestamp: oldTs,
      payload: { taskTitle: 'with delta', deliverableVersionId: 'dv-X' },
    },
    {
      id: 'e-pre36',
      trace_id: 't-sdfp2',
      project_id: 'p1',
      user_id: null,
      hatch_id: null,
      event_type: 'peer_review_completed',
      timestamp: oldTs,
      payload: { taskTitle: 'pre-36 prior', deliverableVersionId: 'dv-Y' },
    },
  ];
  const deps = makeDeps(events, {
    'dv-X': { current: 7.5, prior: 6.0, versionNumber: 2 }, // both finite → delta = 1.5
    'dv-Y': { current: 7.5, prior: null, versionNumber: 3 }, // pre-Phase-36 prior → null delta, versionNumber still captured
  });
  await backfillRunTreeForProject('p1', deps);
  const tree = await storage.getRunsByProject('p1');
  const finiteStep = tree.steps.find((s) => s.title === 'with delta');
  const preStep = tree.steps.find((s) => s.title === 'pre-36 prior');
  assert.ok(finiteStep, 'finite-delta step exists');
  assert.ok(preStep, 'pre-36 prior step exists');
  assert.equal(finiteStep!.scoreDelta, 1.5, 'finite prior → exact delta = 1.5');
  assert.equal(
    finiteStep!.deliverableVersionNumber,
    2,
    'W-4 — deliverableVersionNumber denormalized from current version (2)',
  );
  assert.equal(preStep!.scoreDelta, null, 'null prior → null delta (NOT NaN)');
  assert.ok(
    !Number.isNaN(preStep!.scoreDelta as number),
    'pre-Phase-36 prior must not produce NaN scoreDelta',
  );
  assert.equal(
    preStep!.deliverableVersionNumber,
    3,
    'W-4 — deliverableVersionNumber denormalized even when scoreDelta is null',
  );
  console.log('PASS score-delta-from-payload: finite delta + null-prior fallback + W-4 versionNumber denormalized');
}

async function main(): Promise<void> {
  await case_seed5EventsFlat();
  await case_idempotency();
  await case_5MinuteWindow();
  await case_scoreDeltaFromPayload();
  console.log('\nAll backfill cases passed (4/4).');
}

main().catch((err) => {
  console.error('FAIL:', (err as Error).message ?? err);
  process.exit(1);
});
