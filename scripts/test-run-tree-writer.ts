#!/usr/bin/env tsx
/**
 * Phase 37 — Unit tests for the autonomy run-tree storage layer + writer module.
 *
 * Wave 1 (this plan, 37-01) implements: schema-shape, writer-roundtrip,
 *   parent-mismatch-rejected, mem-db-parity-storage-only.
 *
 * Wave 2 (37-02) APPENDS: pipeline-instrumentation, handoff-instrumentation,
 *   score-delta-math (require the runTreeWriter module that 37-02 creates).
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

async function main(): Promise<void> {
  await case_schemaShape();
  await case_writerRoundtrip();
  await case_parentMismatchRejected();
  await case_memDbParity();
  console.log('\nAll Wave 1 cases passed (4/4).');
}

main().catch((err) => {
  console.error('FAIL:', err.message ?? err);
  process.exit(1);
});
