#!/usr/bin/env tsx
/**
 * Phase 37 — Unit tests for the autonomy run-tree storage layer + writer module.
 *
 * Wave 1 (37-01) implements: schema-shape, writer-roundtrip,
 *   parent-mismatch-rejected, mem-db-parity-storage-only.
 *
 * Wave 2 (37-02) APPENDS:
 *   - case_pipelineInstrumentation: simulates executeTask success + failure paths
 *     through the writer (startStep → completeStep with latency; startStep → failStep
 *     with metadata.error). Proves 3-hook contract is wired correctly.
 *   - case_handoffInstrumentation: simulates 3-generation tree
 *     (agent A task → handoff → agent B task) with parentStepId propagation.
 *     Pitfall 2 defense — ensures tree depth = 3, not flat.
 *   - case_scoreDeltaMath: 3 scenarios — pre-Phase-36 prior (null), both-finite (diff),
 *     NaN input (null, NOT NaN). Pitfall 4 defense.
 *
 * Run with: STORAGE_MODE=memory NODE_ENV=test npx tsx scripts/test-run-tree-writer.ts
 */
import 'dotenv/config';
import assert from 'node:assert/strict';
import {
  insertAutonomyRunSchema,
  insertAutonomyRunStepSchema,
  type InsertAutonomyRun,
  type InsertAutonomyRunStep,
} from '../shared/schema.js';
import { storage, __resetRunTreeForTests } from '../server/storage.js';
import {
  ensureRunForTrace,
  startStep,
  completeStep,
  failStep,
  __resetWriterForTests,
} from '../server/autonomy/runs/runTreeWriter.js';

async function case_schemaShape(): Promise<void> {
  // .strict() guards on insertAutonomyRunSchema
  const runUnknown = insertAutonomyRunSchema.safeParse({ traceId: 't', projectId: 'p', unknownField: 'x' });
  assert.equal(runUnknown.success, false, 'insertAutonomyRunSchema must reject unknown keys (.strict)');

  const runValid = insertAutonomyRunSchema.safeParse({ traceId: 't', projectId: 'p' });
  assert.equal(runValid.success, true, 'insertAutonomyRunSchema must accept valid minimal input');

  const runLongGoal = insertAutonomyRunSchema.safeParse({ traceId: 't', projectId: 'p', rootGoal: 'x'.repeat(501) });
  assert.equal(runLongGoal.success, false, 'insertAutonomyRunSchema must reject rootGoal > 500 chars');

  // .strict() guards on insertAutonomyRunStepSchema
  const stepUnknown = insertAutonomyRunStepSchema.safeParse({ runId: 'r', traceId: 't', stepType: 'task', unknownField: 'x' });
  assert.equal(stepUnknown.success, false, 'insertAutonomyRunStepSchema must reject unknown keys (.strict)');

  const stepValid = insertAutonomyRunStepSchema.safeParse({ runId: 'r', traceId: 't', stepType: 'task' });
  assert.equal(stepValid.success, true, 'insertAutonomyRunStepSchema must accept valid minimal input');

  const stepLongTitle = insertAutonomyRunStepSchema.safeParse({ runId: 'r', traceId: 't', stepType: 'task', title: 'x'.repeat(201) });
  assert.equal(stepLongTitle.success, false, 'insertAutonomyRunStepSchema must reject title > 200 chars');

  console.log('PASS schema-shape: insert schemas .strict() reject unknown keys + max() length limits enforced');
}

async function case_writerRoundtrip(): Promise<void> {
  __resetRunTreeForTests();

  // Explicit type annotations exercise Task 1's exported types end-to-end.
  const runInput: InsertAutonomyRun = { traceId: 't1', projectId: 'p1', status: 'running' };
  const run = await storage.createRun(runInput);
  assert.ok(run.id, 'createRun must return a row with id');
  assert.equal(run.traceId, 't1');
  assert.equal(run.projectId, 'p1');
  assert.equal(run.status, 'running');

  const stepInput: InsertAutonomyRunStep = {
    runId: run.id,
    parentStepId: null,
    traceId: 't1',
    stepType: 'task',
    title: 'test task',
    status: 'running',
  };
  const step = await storage.createRunStep(stepInput);
  assert.ok(step.id, 'createRunStep must return a row with id');
  assert.equal(step.runId, run.id);
  assert.equal(step.status, 'running');
  assert.ok(step.timeoutAt, 'running step must have timeoutAt populated (Q4 defensive)');

  const updated = await storage.updateRunStep(step.id, {
    status: 'complete',
    completedAt: new Date(),
    scoreDelta: 1.2,
  });
  assert.ok(updated, 'updateRunStep must return the updated row');
  assert.equal(updated!.status, 'complete');
  assert.equal(updated!.scoreDelta, 1.2);

  const tree = await storage.getRunsByProject('p1');
  assert.equal(tree.runs.length, 1, 'one run expected');
  assert.equal(tree.steps.length, 1, 'one step expected');
  assert.equal(tree.steps[0].status, 'complete', 'updated status reflected in tree fetch');
  assert.equal(tree.steps[0].scoreDelta, 1.2);

  console.log('PASS writer-roundtrip: create → update → fetch round-trip preserves all writes');
}

async function case_parentMismatchRejected(): Promise<void> {
  __resetRunTreeForTests();

  const r1 = await storage.createRun({ traceId: 't-r1', projectId: 'p1' });
  const s1 = await storage.createRunStep({
    runId: r1.id, parentStepId: null, traceId: 't-r1', stepType: 'task', status: 'running',
  });

  const r2 = await storage.createRun({ traceId: 't-r2', projectId: 'p1' });

  // Cross-run parent claim — MUST throw
  let threw: Error | null = null;
  try {
    await storage.createRunStep({
      runId: r2.id, parentStepId: s1.id, traceId: 't-r2', stepType: 'task', status: 'running',
    });
  } catch (e) {
    threw = e as Error;
  }
  assert.ok(threw, 'cross-run parentStepId claim must throw');
  assert.match(threw!.message, /does not belong to runId/, 'error message must include "does not belong to runId"');

  // Same-run parent claim — must succeed
  const s2 = await storage.createRunStep({
    runId: r1.id, parentStepId: s1.id, traceId: 't-r1', stepType: 'handoff', status: 'complete',
  });
  assert.equal(s2.parentStepId, s1.id, 'same-run parent claim must succeed');

  console.log('PASS parent-mismatch-rejected: cross-run parentStepId rejected; same-run accepted');
}

async function case_memDbParity(): Promise<void> {
  // Type-flow assertion: storage exposes all 4 new methods.
  assert.equal(typeof storage.createRun, 'function', 'storage.createRun must be a function');
  assert.equal(typeof storage.createRunStep, 'function', 'storage.createRunStep must be a function');
  assert.equal(typeof storage.updateRunStep, 'function', 'storage.updateRunStep must be a function');
  assert.equal(typeof storage.getRunsByProject, 'function', 'storage.getRunsByProject must be a function');

  // Runtime contract: callable signatures with valid input return promises.
  __resetRunTreeForTests();
  const r = await storage.createRun({ traceId: 't-parity', projectId: 'p1' });
  assert.ok(r && r.id, 'createRun returns row with id');

  const s = await storage.createRunStep({
    runId: r.id, parentStepId: null, traceId: 't-parity', stepType: 'task', status: 'running',
  });
  assert.ok(s && s.id, 'createRunStep returns row with id');

  const u = await storage.updateRunStep(s.id, { status: 'complete' });
  assert.ok(u && u.status === 'complete', 'updateRunStep returns the updated row');

  const tree = await storage.getRunsByProject('p1');
  assert.ok(Array.isArray(tree.runs), 'getRunsByProject.runs is an array');
  assert.ok(Array.isArray(tree.steps), 'getRunsByProject.steps is an array');

  console.log('PASS mem-db-parity-storage-only: IStorage exposes all 4 methods; runtime contract satisfied');
}

// ─────────────────────────────────────────────────────────────────────────────
// Wave 2 (37-02) cases — pipeline-instrumentation, handoff-instrumentation,
// score-delta-math. Exercise the runTreeWriter module directly with mocked
// storage state (the 37-04 Playwright spec covers the full pipeline end-to-end).
// ─────────────────────────────────────────────────────────────────────────────

async function case_pipelineInstrumentation(): Promise<void> {
  __resetRunTreeForTests();
  __resetWriterForTests();

  // Success scenario — startStep + completeStep with latency
  const runId = await ensureRunForTrace('trace-pi-success', {
    projectId: 'p1',
    rootAgentId: 'a1',
  });
  const successStepId = await startStep(runId, null, {
    traceId: 'trace-pi-success',
    agentId: 'a1',
    agentName: 'A',
    agentRole: 'engineer',
    stepType: 'task',
    title: 'success task',
    status: 'running',
  });
  assert.ok(successStepId, 'success path: startStep returns a stepId');
  await completeStep(successStepId, { priorRubricTotal: null, currentRubricTotal: null }, Date.now() - 250);

  // Failure scenario — startStep + failStep with metadata.error
  const failStepId = await startStep(runId, null, {
    traceId: 'trace-pi-success',
    agentId: 'a1',
    agentName: 'A',
    agentRole: 'engineer',
    stepType: 'task',
    title: 'failing task',
    status: 'running',
  });
  assert.ok(failStepId, 'failure path: startStep returns a stepId');
  await failStep(failStepId, new Error('simulated LLM provider failure'));

  // Verify
  const tree = await storage.getRunsByProject('p1');
  const success = tree.steps.find((s) => s.id === successStepId);
  const failed = tree.steps.find((s) => s.id === failStepId);
  assert.equal(success?.status, 'complete', 'success step status reflects completeStep');
  assert.ok(
    success?.latencyMs !== null && success?.latencyMs !== undefined,
    'latencyMs computed from startedAtMs',
  );
  assert.equal(failed?.status, 'failed', 'failure step status reflects failStep');
  assert.match(
    JSON.stringify(failed?.metadata),
    /simulated LLM provider failure/,
    'failure metadata.error captured',
  );

  console.log('PASS pipeline-instrumentation: 3-hook contract writes correct status + latency + error');
}

async function case_handoffInstrumentation(): Promise<void> {
  __resetRunTreeForTests();
  __resetWriterForTests();

  const runId = await ensureRunForTrace('trace-ho', {
    projectId: 'p1',
    rootAgentId: 'agent-A',
  });

  // Agent A's task step (root)
  const stepAId = await startStep(runId, null, {
    traceId: 'trace-ho',
    agentId: 'agent-A',
    agentName: 'A',
    agentRole: 'engineer',
    stepType: 'task',
    title: 'agent A initial task',
    status: 'running',
  });
  await completeStep(stepAId, { priorRubricTotal: null, currentRubricTotal: null }, Date.now() - 100);

  // Handoff step (parent = stepA)
  const handoffStepId = await startStep(runId, stepAId, {
    traceId: 'trace-ho',
    agentId: 'agent-A',
    agentName: 'A',
    agentRole: 'engineer',
    stepType: 'handoff',
    title: 'A → B: continue work',
    status: 'complete',
  });

  // Agent B's task step (parent = handoff)
  const stepBId = await startStep(runId, handoffStepId, {
    traceId: 'trace-ho',
    agentId: 'agent-B',
    agentName: 'B',
    agentRole: 'designer',
    stepType: 'task',
    title: 'agent B follow-up task',
    status: 'running',
  });
  await completeStep(stepBId, { priorRubricTotal: null, currentRubricTotal: null }, Date.now() - 50);

  // Verify tree shape — 3 generations: source-task → handoff → next-task
  const tree = await storage.getRunsByProject('p1');
  const a = tree.steps.find((s) => s.id === stepAId);
  const h = tree.steps.find((s) => s.id === handoffStepId);
  const b = tree.steps.find((s) => s.id === stepBId);
  assert.equal(a?.parentStepId, null, 'stepA is root');
  assert.equal(h?.parentStepId, stepAId, 'handoff parent = stepA');
  assert.equal(b?.parentStepId, handoffStepId, 'stepB parent = handoff (3-gen tree)');
  assert.equal(h?.stepType, 'handoff');
  assert.equal(h?.status, 'complete', 'handoff is instant-complete');

  console.log('PASS handoff-instrumentation: 3-generation tree source-task → handoff → next-task');
}

async function case_scoreDeltaMath(): Promise<void> {
  __resetRunTreeForTests();
  __resetWriterForTests();

  const runId = await ensureRunForTrace('trace-sdm', { projectId: 'p1' });

  // Scenario 1: prior is null (pre-Phase-36 deliverable version) → scoreDelta = null
  const s1 = await startStep(runId, null, {
    traceId: 'trace-sdm',
    stepType: 'task',
    title: 'pre-36',
    agentId: 'a1',
    agentName: 'A',
    agentRole: 'r',
    status: 'running',
  });
  await completeStep(
    s1,
    { deliverableVersionId: 'dv1', priorRubricTotal: null, currentRubricTotal: 7.5 },
    Date.now() - 100,
  );

  // Scenario 2: both finite → scoreDelta = diff
  const s2 = await startStep(runId, null, {
    traceId: 'trace-sdm',
    stepType: 'task',
    title: 'both-finite',
    agentId: 'a1',
    agentName: 'A',
    agentRole: 'r',
    status: 'running',
  });
  await completeStep(
    s2,
    { deliverableVersionId: 'dv2', priorRubricTotal: 6.0, currentRubricTotal: 7.5 },
    Date.now() - 100,
  );

  // Scenario 3: NaN input → scoreDelta = null (NOT NaN!) — Pitfall 4 NaN-guard
  const s3 = await startStep(runId, null, {
    traceId: 'trace-sdm',
    stepType: 'task',
    title: 'nan-guard',
    agentId: 'a1',
    agentName: 'A',
    agentRole: 'r',
    status: 'running',
  });
  await completeStep(
    s3,
    { deliverableVersionId: 'dv3', priorRubricTotal: NaN, currentRubricTotal: 7.5 },
    Date.now() - 100,
  );

  const tree = await storage.getRunsByProject('p1');
  const r1 = tree.steps.find((s) => s.id === s1);
  const r2 = tree.steps.find((s) => s.id === s2);
  const r3 = tree.steps.find((s) => s.id === s3);

  // Note: case_scoreDeltaMath is the case_scoreDeltaMath marker grep expects.
  assert.equal(r1?.scoreDelta, null, 'pre-Phase-36 prior → null');
  assert.equal(r2?.scoreDelta, 1.5, 'both-finite → exact diff');
  assert.equal(r3?.scoreDelta, null, 'NaN input → null (Pitfall 4)');
  // Critical: r3 must NOT be the literal NaN — JSON-serialized NaN would break the GET endpoint
  assert.ok(!Number.isNaN(r3?.scoreDelta as number), 'scoreDelta must not be NaN');

  console.log('PASS score-delta-math: null prior, finite-diff, and NaN-guard all behave correctly');
}

async function main(): Promise<void> {
  await case_schemaShape();
  await case_writerRoundtrip();
  await case_parentMismatchRejected();
  await case_memDbParity();
  await case_pipelineInstrumentation();
  await case_handoffInstrumentation();
  await case_scoreDeltaMath();
  console.log('\nAll Wave 1+2 cases passed (7/7).');
}

main().catch((err) => {
  console.error('FAIL:', err.message ?? err);
  process.exit(1);
});
