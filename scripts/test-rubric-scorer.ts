#!/usr/bin/env tsx
/**
 * Phase 36 — Unit tests for the rubric registry + scorer.
 *
 * Wave 1 (this plan, 36-01) implements: registry-shape, immutability-invariant, persistence-shape.
 * Wave 2 (36-02) ADDS: revert-decision, parse-fail-fail-open, editsCount-not-incremented-on-revert,
 *   prod-guard-on-forced-score-setter, deterministic-criterion-ordering.
 *
 * Run with: npx tsx scripts/test-rubric-scorer.ts
 */

import assert from 'node:assert/strict';
import {
  DELIVERABLE_RUBRIC_REGISTRY,
  getRubricForType,
  listRubricTypes,
  rubricSchema,
  type Rubric,
} from '../shared/deliverableRubrics.js';
import type { InsertDeliverableVersion } from '../shared/schema.js';
import {
  scoreIteration,
  __setForcedScoreForTests,
  __clearForcedScoreForTests,
  __setGenerateOverrideForTests,
  rubricScoreResultSchema,
  type RubricScoreResult,
} from '../server/ai/rubricScorer.js';
import { __resetImpressionDedupeForTests } from '../server/storage.js';

const EXPECTED_TYPES = [
  'prd',
  'tech-spec',
  'design-brief',
  'gtm-plan',
  'user-stories',
  'blog-post',
  'landing-copy',
  'content-calendar',
  'email-sequence',
  'seo-brief',
  'project-plan',
  'competitive-analysis',
  'market-research',
  'process-doc',
  'data-report',
] as const;

async function case_registryShape(): Promise<void> {
  const types = listRubricTypes();
  assert.equal(types.length, 15, 'expected exactly 15 rubric types');
  assert.equal(DELIVERABLE_RUBRIC_REGISTRY.size, 15, 'expected registry size 15');
  for (const t of EXPECTED_TYPES) {
    assert.ok(types.includes(t), `expected rubric for type ${t}`);
  }
  for (const [type, r] of DELIVERABLE_RUBRIC_REGISTRY.entries()) {
    assert.match(r.rubricVersion, /^\d+\.\d+\.\d+$/, `${type}: rubricVersion not semver`);
    assert.ok(
      r.criteria.length >= 4 && r.criteria.length <= 6,
      `${type}: criteria length out of range (got ${r.criteria.length})`,
    );
    for (const c of r.criteria) {
      assert.match(c.key, /^[a-z][a-z0-9_]*$/, `${type}: bad criterion key ${c.key}`);
      assert.ok(c.weight > 0 && c.weight <= 1, `${type}/${c.key}: weight out of range (got ${c.weight})`);
      assert.ok(c.anchorAt10.length >= 1, `${type}/${c.key}: empty anchorAt10`);
      assert.ok(c.anchorAt0.length >= 1, `${type}/${c.key}: empty anchorAt0`);
    }
    const sum = r.criteria.reduce((s, c) => s + c.weight, 0);
    assert.ok(Math.abs(sum - 1.0) < 1e-6, `${type}: weights sum to ${sum}, not 1.0`);
    // Bonus: every rubric passes its own schema (already enforced at module load,
    // but explicit here so the assertion is visible in test output).
    assert.ok(rubricSchema.safeParse(r).success, `${type}: rubricSchema.safeParse failed`);
  }
  console.log('PASS registry-shape: all 15 types present, valid, and weight-balanced');
}

async function case_immutabilityInvariant(): Promise<void> {
  assert.ok(Object.isFrozen(DELIVERABLE_RUBRIC_REGISTRY), 'registry not frozen');
  for (const [type, r] of DELIVERABLE_RUBRIC_REGISTRY.entries()) {
    assert.ok(Object.isFrozen(r), `${type}: rubric not frozen`);
    assert.ok(Object.isFrozen(r.criteria), `${type}: criteria array not frozen`);
    for (const c of r.criteria) {
      assert.ok(Object.isFrozen(c), `${type}/${c.key}: criterion not frozen`);
    }
  }
  // Attempt mutation — must be a no-op (sloppy mode) or throw (strict mode);
  // either way the value MUST remain unchanged.
  const prd = getRubricForType('prd');
  assert.ok(prd !== null, 'prd rubric missing');
  const before = prd!.criteria[0].weight;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prd as any).criteria[0].weight = 999;
  } catch {
    /* Object.freeze throws in strict mode — acceptable */
  }
  const after = prd!.criteria[0].weight;
  assert.equal(after, before, 'frozen criterion weight was mutated');
  console.log('PASS immutability-invariant: registry, rubrics, criteria, weights all frozen');
}

async function case_persistenceShape(): Promise<void> {
  // Type-flow assertion: if shared/schema.ts has the new columns,
  // an InsertDeliverableVersion literal carrying rubricVersion / rubricScore /
  // revertedFromHigherScore must compile. tsx + tsc is the verifier; at runtime
  // we just confirm the object literal is well-formed.
  const insertRow: InsertDeliverableVersion = {
    deliverableId: 'test-uuid',
    versionNumber: 1,
    content: 'test body',
    changeDescription: 'test',
    createdByAgentId: null,
    rubricVersion: '1.0.0',
    rubricScore: {
      total: 7.5,
      breakdown: [{ criterion: 'problem_clarity', score: 7, justification: 'specific user named' }],
    },
    revertedFromHigherScore: false,
  };
  assert.equal(insertRow.rubricVersion, '1.0.0');
  assert.equal(insertRow.rubricScore?.total, 7.5);
  assert.equal(insertRow.revertedFromHigherScore, false);
  // Touch the Rubric type so the import survives tree-shaking analysis.
  const _typeProbe: Rubric | null = getRubricForType('prd');
  assert.ok(_typeProbe !== null, 'prd rubric should be present (Rubric type import live)');
  console.log('PASS persistence-shape: InsertDeliverableVersion accepts new rubric fields');
}

async function case_revertDecision(): Promise<void> {
  process.env.NODE_ENV = 'development';
  __clearForcedScoreForTests();
  const forced: RubricScoreResult = {
    rubricVersion: '0.0.0', // intentionally wrong — scorer must overwrite with registry version
    oldScore: { total: 8, breakdown: [] },
    newScore: { total: 5, breakdown: [] },
    recommendation: 'revert',
  };
  __setForcedScoreForTests(forced);
  const r = await scoreIteration('prd', 'old content', 'new content');
  assert.equal(r.recommendation, 'revert', 'forced revert must be returned as revert');
  assert.equal(r.rubricVersion, '1.0.0', 'forced result must carry the registry rubricVersion (not 0.0.0)');
  assert.equal(r.newScore.total, 5);
  __clearForcedScoreForTests();
  console.log('PASS revert-decision: forced result is returned with registry rubricVersion override');
}

async function case_parseFailFailOpen(): Promise<void> {
  const r1 = rubricScoreResultSchema.safeParse({ extra: 'leaked' });
  assert.equal(r1.success, false, 'schema must reject incomplete input');
  const r2 = rubricScoreResultSchema.safeParse({
    rubricVersion: '1.0.0',
    oldScore: { total: 5, breakdown: [] },
    newScore: { total: 6, breakdown: [] },
    recommendation: 'keep_new',
    leak: 'x',
  });
  assert.equal(r2.success, false, '.strict() must reject extra key');
  const r3 = rubricScoreResultSchema.safeParse({
    rubricVersion: '1.0.0',
    oldScore: { total: 99, breakdown: [] },
    newScore: { total: 6, breakdown: [] },
    recommendation: 'keep_new',
  });
  assert.equal(r3.success, false, 'schema must reject score > 10');
  console.log('PASS parse-fail-fail-open: schema rejects malformed/extra/out-of-range input');
}

async function case_editsCountNotIncrementedOnRevert(): Promise<void> {
  process.env.NODE_ENV = 'development';
  __clearForcedScoreForTests();
  __resetImpressionDedupeForTests();

  const { iterateDeliverable } = await import('../server/ai/deliverableGenerator.js');
  const { storage } = await import('../server/storage.js');

  // Seed: create a deliverable. Use storage.createDeliverable directly.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const created = await storage.createDeliverable({
    projectId: 'p1',
    title: 'Test PRD',
    type: 'prd',
    content: 'v1 content',
  } as any);

  // Force revert.
  __setForcedScoreForTests({
    rubricVersion: '1.0.0',
    oldScore: { total: 8, breakdown: [] },
    newScore: { total: 5, breakdown: [] },
    recommendation: 'revert',
  });
  const revertResult = await iterateDeliverable(created.id, 'make it worse', 'AgentName', 'Engineer');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assert.equal((revertResult as any)?.reverted, true, 'forced revert should produce reverted=true');
  const after1 = await storage.getDeliverable(created.id);
  assert.equal(after1?.editsCount ?? 0, 0, 'editsCount must NOT increment on revert (D-19)');
  assert.equal(after1?.currentVersion, 1, 'currentVersion must NOT advance on revert');

  // Force keep_new.
  __setForcedScoreForTests({
    rubricVersion: '1.0.0',
    oldScore: { total: 5, breakdown: [] },
    newScore: { total: 7, breakdown: [] },
    recommendation: 'keep_new',
  });
  const keepResult = await iterateDeliverable(created.id, 'make it better', 'AgentName', 'Engineer');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assert.equal((keepResult as any)?.reverted, false, 'forced keep_new should produce reverted=false');
  const after2 = await storage.getDeliverable(created.id);
  assert.equal(after2?.editsCount, 1, 'editsCount must increment by 1 on keep-new (D-19)');
  // v1 → revert creates v2 (stored as rejected, currentVersion stays at 1) → keep-new creates v3 (currentVersion advances to 3)
  assert.equal(after2?.currentVersion, 3, 'currentVersion advances on keep-new (v1 → v3 since revert created v2)');

  __clearForcedScoreForTests();
  console.log('PASS editsCount-not-incremented-on-revert: revert preserves counters; keep-new advances them (D-19)');
}

async function case_prodGuardOnForcedScoreSetter(): Promise<void> {
  const original = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    let threwSet = false;
    try {
      __setForcedScoreForTests({
        rubricVersion: '1.0.0',
        oldScore: { total: 1, breakdown: [] },
        newScore: { total: 1, breakdown: [] },
        recommendation: 'keep_new',
      });
    } catch {
      threwSet = true;
    }
    assert.ok(threwSet, '__setForcedScoreForTests must throw FATAL in production');

    let threwClear = false;
    try {
      __clearForcedScoreForTests();
    } catch {
      threwClear = true;
    }
    assert.ok(threwClear, '__clearForcedScoreForTests must throw FATAL in production');
  } finally {
    process.env.NODE_ENV = original;
  }
  console.log('PASS prod-guard-on-forced-score-setter: both setter and clearer throw in production (T-36-13)');
}

async function case_deterministicCriterionOrdering(): Promise<void> {
  const r1 = getRubricForType('prd');
  const r2 = getRubricForType('prd');
  assert.ok(r1 && r2, 'prd rubric must exist twice');
  assert.deepEqual(
    r1!.criteria.map((c) => c.key),
    r2!.criteria.map((c) => c.key),
    'criterion order must be stable across calls',
  );
  assert.equal(r1, r2, 'getRubricForType must return the same frozen reference (identity, not just deep-eq)');
  console.log('PASS deterministic-criterion-ordering: registry returns identical, identity-equal rubric on repeat calls');
}

async function case_recommendationRecompute(): Promise<void> {
  // T-36-11 deterministic unit pin: even when the LLM emits recommendation='keep_new'
  // alongside newScore.total < oldScore.total, scoreIteration's post-parse override
  // must return recommendation='revert' (server-side recompute wins).
  process.env.NODE_ENV = 'development';
  __clearForcedScoreForTests(); // forced path short-circuits BEFORE the override — clear it.

  // Inject an adversarial provider via the DEV-only override hook. ESM namespace
  // exports are read-only at runtime, so we cannot monkey-patch the provider
  // module directly; rubricScorer exposes __setGenerateOverrideForTests for this.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  __setGenerateOverrideForTests(async () => ({
    content: JSON.stringify({
      rubricVersion: '1.0.0',
      oldScore: {
        total: 8,
        breakdown: [{ criterion: 'clarity', score: 8, justification: 'good' }],
      },
      newScore: {
        total: 5,
        breakdown: [{ criterion: 'clarity', score: 5, justification: 'worse' }],
      },
      recommendation: 'keep_new', // adversarial — disagrees with totals
    }),
    provider: 'mock',
    model: 'mock-llama',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any);
  try {
    const r = await scoreIteration('prd', 'old content', 'new content');
    assert.equal(
      r.recommendation,
      'revert',
      'server-side recompute MUST override LLM-supplied recommendation when newScore.total < oldScore.total (T-36-11)',
    );
    assert.equal(r.oldScore.total, 8, 'oldScore preserved from LLM');
    assert.equal(r.newScore.total, 5, 'newScore preserved from LLM');
    assert.equal(r.rubricVersion, '1.0.0', 'rubricVersion overwritten with registry value');
  } finally {
    __setGenerateOverrideForTests(null);
  }
  console.log('PASS recommendation-recompute: server-side override defeats prompt-injection recommendation flip (T-36-11)');
}

async function main(): Promise<void> {
  await case_registryShape();
  await case_immutabilityInvariant();
  await case_persistenceShape();
  await case_revertDecision();
  await case_parseFailFailOpen();
  await case_editsCountNotIncrementedOnRevert();
  await case_prodGuardOnForcedScoreSetter();
  await case_deterministicCriterionOrdering();
  await case_recommendationRecompute();
  console.log('\nAll Wave 2 cases passed (9/9).');
}

main().catch((err) => {
  console.error('FAIL:', err instanceof Error ? err.message : err);
  process.exit(1);
});
