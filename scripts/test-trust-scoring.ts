// Test: SAFE-04 — Progressive trust scoring for agents
// Verifies: trust score calculation, updateTrustMeta round-trip, and threshold adjustment math

import { calculateTrustScore, updateTrustMeta } from '../server/autonomy/trustScoring/trustScorer.js';
import { getAdjustedThresholds } from '../server/autonomy/trustScoring/trustAdapter.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) {
    console.log(`  PASS: ${name}`);
    passed++;
  } else {
    console.log(`  FAIL: ${name}`);
    failed++;
  }
}

console.log('=== SAFE-04 Progressive Trust Scoring Tests ===\n');

// Test 1: Zero history → trust score is 0.0
assert(
  calculateTrustScore({ tasksCompleted: 0, tasksFailed: 0 }) === 0.0,
  'calculateTrustScore: zero history returns 0.0'
);

// Test 2: 10 completions, 0 failures → trust score is 1.0 (full success * full maturity)
assert(
  calculateTrustScore({ tasksCompleted: 10, tasksFailed: 0 }) === 1.0,
  'calculateTrustScore: 10/10 completions returns 1.0'
);

// Test 3: 3 completions, 0 failures → ~0.3 (1.0 success rate * 0.3 maturity factor)
const score3 = calculateTrustScore({ tasksCompleted: 3, tasksFailed: 0 });
assert(
  score3 > 0.29 && score3 < 0.31,
  `calculateTrustScore: 3/3 completions returns ~0.3 (got ${score3.toFixed(4)})`
);

// Test 4: 9 completions, 1 failure → 0.9 (0.9 success rate * 1.0 maturity factor)
const score4 = calculateTrustScore({ tasksCompleted: 9, tasksFailed: 1 });
assert(
  score4 === 0.9,
  `calculateTrustScore: 9 completions, 1 failure returns 0.9 (got ${score4.toFixed(4)})`
);

// Test 5: updateTrustMeta(undefined, success=true) → {tasksCompleted: 1, tasksFailed: 0, trustScore > 0}
const meta5 = updateTrustMeta(undefined, true);
assert(
  meta5.tasksCompleted === 1 && meta5.tasksFailed === 0 && meta5.trustScore > 0,
  `updateTrustMeta: first success gives completed=1, failed=0, trustScore>0 (got ${JSON.stringify(meta5)})`
);

// Test 6: updateTrustMeta with prior state, success=false → tasksFailed increments, tasksCompleted unchanged
const meta6 = updateTrustMeta(
  { tasksCompleted: 5, tasksFailed: 0, trustScore: 0.5, lastUpdated: '' },
  false
);
assert(
  meta6.tasksFailed === 1 && meta6.tasksCompleted === 5,
  `updateTrustMeta: failure increments tasksFailed, not tasksCompleted (got failed=${meta6.tasksFailed}, completed=${meta6.tasksCompleted})`
);

// Test 7: getAdjustedThresholds(0.0) → baseline thresholds (no boost)
const t7 = getAdjustedThresholds(0.0);
assert(
  t7.peerReviewTrigger === 0.35 && t7.clarificationRequiredRisk === 0.60,
  `getAdjustedThresholds(0.0): returns baseline {peerReview: 0.35, clarification: 0.60} (got ${JSON.stringify(t7)})`
);

// Test 8: getAdjustedThresholds(1.0) → max boost applied {peerReview: 0.50, clarification: 0.75}
const t8 = getAdjustedThresholds(1.0);
assert(
  t8.peerReviewTrigger === 0.50 && t8.clarificationRequiredRisk === 0.75,
  `getAdjustedThresholds(1.0): returns max boost {peerReview: 0.50, clarification: 0.75} (got ${JSON.stringify(t8)})`
);

// Test 9: getAdjustedThresholds(0.5) → values between baseline and max boost
const t9 = getAdjustedThresholds(0.5);
assert(
  t9.peerReviewTrigger > 0.35 && t9.peerReviewTrigger < 0.50,
  `getAdjustedThresholds(0.5): peerReviewTrigger between baseline and max (got ${t9.peerReviewTrigger.toFixed(4)})`
);

// Test 10: Trust score is always bounded [0.0, 1.0] even with extreme inputs
const extreme = calculateTrustScore({ tasksCompleted: 100000, tasksFailed: 0 });
assert(
  extreme <= 1.0 && extreme >= 0.0,
  `calculateTrustScore: extreme inputs bounded [0,1] (got ${extreme})`
);

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
