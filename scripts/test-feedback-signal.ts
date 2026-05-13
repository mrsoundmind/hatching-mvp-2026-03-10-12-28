#!/usr/bin/env tsx
/**
 * Phase 36 (FBK-04) — Unit tests for the score-based feedback aggregator + section formatter.
 *
 * Cases (4):
 *   1. threshold-below   — 2 finalized deliverables → getRecentFeedbackSignal returns null
 *                          → formatFeedbackSection returns '' → prompt section absent
 *   2. threshold-met     — 3 finalized deliverables (with scored versions) → signal is non-null
 *                          → formatFeedbackSection produces the score-based phrasing
 *                          → contains "averaged X / 10" and "refinement cycles"
 *   3. cache-hit         — second call within 60s does NOT re-hit storage
 *                          (proved by wrapping storage method with a counter)
 *   4. most-improved     — when a deliverable has versions where latestScore > firstScore,
 *                          the "Most-improved" line appears
 *
 * Run with:
 *   STORAGE_MODE=memory npx tsx -r dotenv/config scripts/test-feedback-signal.ts
 */
import assert from 'node:assert/strict';

import { storage } from '../server/storage.js';
import {
  getRecentFeedbackSignal,
  formatFeedbackSection,
  __resetCacheForTests,
} from '../server/ai/deliverableFeedbackAggregator.js';

// -----------------------------------------------------------------------------
// Test helpers
// -----------------------------------------------------------------------------

interface SeedVersion {
  versionNumber: number;
  rubricScore: number | null;
}

interface SeedDeliverable {
  type: string;
  editsCount: number;
  versions: SeedVersion[];
  status?: string;
}

let projectCounter = 0;
function newProjectId(): string {
  projectCounter += 1;
  return `test-project-${projectCounter}-${Date.now()}`;
}
let agentCounter = 0;
function newAgentId(): string {
  agentCounter += 1;
  return `test-agent-${agentCounter}-${Date.now()}`;
}

async function seedDeliverable(
  projectId: string,
  agentId: string,
  spec: SeedDeliverable,
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const created = await storage.createDeliverable({
    projectId,
    agentId,
    title: `Test ${spec.type}`,
    type: spec.type,
    content: 'seeded content',
  } as any);
  // Mark complete + set editsCount.
  await storage.updateDeliverable(created.id, {
    status: spec.status ?? 'complete',
    editsCount: spec.editsCount,
  });
  // Replace the auto-created v1 with the spec's versions. createDeliverable auto-creates
  // a v1 with rubricScore=null; we keep that as version 1 and append further versions.
  // Simpler approach: directly insert each version via createDeliverableVersion.
  // First, delete the auto-v1 if the spec wants a different shape — but in MemStorage
  // we don't expose deletion of versions individually. Instead: we accept that v1 starts
  // with null score, then we patch its rubricScore via direct map mutation OR we
  // append the spec's versions and let it work as v2/v3/... The aggregator looks
  // at all versions and finds first/last with non-null score — so we can simply
  // ADD versions on top of the auto-v1.

  // Strategy: if the first spec version has a score, that's our v2 (since v1 exists already).
  // We bump versionNumber to start at 2.
  // For the most-improved case we want clean v1/v2/v3 shape — let's just append all spec.versions
  // starting from versionNumber = 2. Aggregator's first-score scan will skip the auto-v1
  // (null) and pick up the first scored version.
  for (let i = 0; i < spec.versions.length; i++) {
    const v = spec.versions[i];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await storage.createDeliverableVersion({
      deliverableId: created.id,
      versionNumber: i + 2, // v1 is auto; spec versions start at v2
      content: `content v${i + 2}`,
      changeDescription: `version ${i + 2}`,
      createdByAgentId: agentId,
      rubricVersion: v.rubricScore !== null ? '1.0.0' : null,
      rubricScore:
        v.rubricScore !== null
          ? { total: v.rubricScore, breakdown: [] }
          : null,
      revertedFromHigherScore: false,
    } as any);
  }
  return created.id;
}

// -----------------------------------------------------------------------------
// Cases
// -----------------------------------------------------------------------------

async function case_thresholdBelow(): Promise<void> {
  __resetCacheForTests();
  const projectId = newProjectId();
  const agentId = newAgentId();

  // Seed 2 finalized deliverables — below threshold.
  await seedDeliverable(projectId, agentId, {
    type: 'prd',
    editsCount: 1,
    versions: [{ versionNumber: 2, rubricScore: 7.5 }],
  });
  await seedDeliverable(projectId, agentId, {
    type: 'prd',
    editsCount: 0,
    versions: [{ versionNumber: 2, rubricScore: 8.0 }],
  });

  const signal = await getRecentFeedbackSignal(projectId, agentId);
  assert.equal(signal, null, 'threshold-below: signal must be null when count < 3');

  const section = formatFeedbackSection(signal);
  assert.equal(section, '', 'threshold-below: formatFeedbackSection must return empty string');

  console.log('PASS threshold-below: 2 finalized → signal null → section absent (D-23)');
}

async function case_thresholdMet(): Promise<void> {
  __resetCacheForTests();
  const projectId = newProjectId();
  const agentId = newAgentId();

  // Seed 4 finalized PRDs with scored latest versions.
  await seedDeliverable(projectId, agentId, {
    type: 'prd',
    editsCount: 2,
    versions: [{ versionNumber: 2, rubricScore: 7.5 }],
  });
  await seedDeliverable(projectId, agentId, {
    type: 'prd',
    editsCount: 1,
    versions: [{ versionNumber: 2, rubricScore: 8.0 }],
  });
  await seedDeliverable(projectId, agentId, {
    type: 'prd',
    editsCount: 2,
    versions: [{ versionNumber: 2, rubricScore: 7.8 }],
  });
  await seedDeliverable(projectId, agentId, {
    type: 'prd',
    editsCount: 1,
    versions: [{ versionNumber: 2, rubricScore: 7.9 }],
  });

  const signal = await getRecentFeedbackSignal(projectId, agentId);
  assert.ok(signal, 'threshold-met: signal must be non-null when count >= 3');
  assert.equal(signal!.totalDeliverables, 4, 'threshold-met: totalDeliverables must equal 4');
  assert.ok(
    signal!.averageScore !== null && signal!.averageScore > 7 && signal!.averageScore < 9,
    `threshold-met: averageScore must be ~7.8 (got ${signal!.averageScore})`,
  );
  assert.equal(
    signal!.byType.length,
    1,
    'threshold-met: byType must have 1 entry (all PRDs)',
  );
  assert.equal(signal!.byType[0].type, 'prd');
  assert.equal(signal!.byType[0].typeLabel, 'Product Requirements Document');
  assert.equal(signal!.byType[0].count, 4);

  const section = formatFeedbackSection(signal);
  assert.ok(section.length > 0, 'threshold-met: section body must be non-empty');
  assert.match(
    section,
    /Your last 4 Product Requirements Documents/,
    'threshold-met: section must mention the count + canonical type label (pluralized)',
  );
  assert.match(
    section,
    /averaged [0-9]+\.[0-9] \/ 10/,
    'threshold-met: section must contain "averaged X.Y / 10" phrasing',
  );
  assert.match(
    section,
    /refinement cycles/,
    'threshold-met: section must mention refinement cycles',
  );
  assert.match(
    section,
    /Let this inform what you produce next without quoting it/,
    'threshold-met: footer instruction must always appear (D-24)',
  );

  console.log('PASS threshold-met: 4 finalized PRDs → score-based phrasing present (D-24)');
  console.log('  Section preview:');
  for (const line of section.split('\n')) console.log('    ' + line);
}

async function case_cacheHit(): Promise<void> {
  __resetCacheForTests();
  const projectId = newProjectId();
  const agentId = newAgentId();

  // Seed 3 finalized — must be at or above threshold so first call caches a non-null result.
  for (let i = 0; i < 3; i++) {
    await seedDeliverable(projectId, agentId, {
      type: 'tech-spec',
      editsCount: 1,
      versions: [{ versionNumber: 2, rubricScore: 8.0 }],
    });
  }

  // Wrap storage.getRecentFinalizedDeliverablesByAgent with a counter to prove
  // the second call does NOT re-hit storage.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const original = (storage as any).getRecentFinalizedDeliverablesByAgent.bind(storage);
  let hits = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (storage as any).getRecentFinalizedDeliverablesByAgent = async (...args: unknown[]) => {
    hits += 1;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return original(...(args as [string, string, number]));
  };

  try {
    // First call MUST hit storage exactly once (the cache was reset above).
    const s1 = await getRecentFeedbackSignal(projectId, agentId);
    assert.ok(s1, 'cache-hit: first call must produce a signal');
    assert.equal(hits, 1, `cache-hit: first call must hit storage exactly once (got ${hits})`);

    // Second call (within 60s TTL) MUST NOT hit storage again.
    const s2 = await getRecentFeedbackSignal(projectId, agentId);
    assert.ok(s2, 'cache-hit: second call must produce a signal');
    assert.equal(hits, 1, `cache-hit: second call must NOT re-hit storage (still ${hits})`);

    // Sanity: cached value is the same reference (no recomputation).
    assert.equal(s1, s2, 'cache-hit: cached signal must be identity-equal across calls');
  } finally {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (storage as any).getRecentFinalizedDeliverablesByAgent = original;
  }

  console.log('PASS cache-hit: 60s in-process cache prevents second storage call (Q2)');
}

async function case_mostImproved(): Promise<void> {
  __resetCacheForTests();
  const projectId = newProjectId();
  const agentId = newAgentId();

  // Seed 3 PRDs; one of them has a clear improvement (v2 score 6.1 → v3 score 8.4 across 3 iterations).
  await seedDeliverable(projectId, agentId, {
    type: 'prd',
    editsCount: 2,
    versions: [
      // The auto-v1 has null score; spec versions start at v2.
      // We want the aggregator to see first-scored = 6.1 (v2) and last-scored = 8.4 (v4).
      { versionNumber: 2, rubricScore: 6.1 },
      { versionNumber: 3, rubricScore: 7.2 },
      { versionNumber: 4, rubricScore: 8.4 },
    ],
  });
  await seedDeliverable(projectId, agentId, {
    type: 'prd',
    editsCount: 0,
    versions: [{ versionNumber: 2, rubricScore: 7.8 }],
  });
  await seedDeliverable(projectId, agentId, {
    type: 'prd',
    editsCount: 1,
    versions: [{ versionNumber: 2, rubricScore: 8.0 }],
  });

  const signal = await getRecentFeedbackSignal(projectId, agentId);
  assert.ok(signal, 'most-improved: signal must be non-null');
  assert.ok(signal!.mostImproved, 'most-improved: mostImproved must be populated');
  assert.equal(signal!.mostImproved!.type, 'prd');
  assert.equal(signal!.mostImproved!.firstScore, 6.1);
  assert.equal(signal!.mostImproved!.latestScore, 8.4);
  // Note: 4 versions total (auto-v1 + 3 spec versions); aggregator counts all.
  assert.ok(
    signal!.mostImproved!.iterations >= 3,
    `most-improved: iterations must be at least 3 (got ${signal!.mostImproved!.iterations})`,
  );

  const section = formatFeedbackSection(signal);
  assert.match(
    section,
    /Most-improved:/,
    'most-improved: section must contain the "Most-improved:" line',
  );
  assert.match(
    section,
    /6\.1 → 8\.4/,
    'most-improved: section must contain "6.1 → 8.4" trajectory',
  );

  console.log('PASS most-improved: trajectory detected and surfaced in section');
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------

async function main(): Promise<void> {
  // Guard: this test mutates MemStorage extensively; refuse to run against a real DB.
  if ((process.env.STORAGE_MODE ?? 'memory') !== 'memory') {
    console.error(
      'FAIL: this script mutates storage; refusing to run with STORAGE_MODE != memory',
    );
    process.exit(1);
  }
  await case_thresholdBelow();
  await case_thresholdMet();
  await case_cacheHit();
  await case_mostImproved();
  console.log('\nAll FBK-04 cases passed (4/4).');
}

main().catch((err) => {
  console.error('FAIL:', err instanceof Error ? err.stack || err.message : err);
  process.exit(1);
});
