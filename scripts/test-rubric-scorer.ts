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

async function main(): Promise<void> {
  await case_registryShape();
  await case_immutabilityInvariant();
  await case_persistenceShape();
  console.log('\nAll Wave 1 cases passed (3/3).');
}

main().catch((err) => {
  console.error('FAIL:', err instanceof Error ? err.message : err);
  process.exit(1);
});
