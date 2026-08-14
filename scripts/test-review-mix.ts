/**
 * Re-audit fix (A2-#1 / A3-#2): tallyReviewMix must count BOTH peer-review payload shapes so the
 * operator quality surface never reports zero reviews while reviews are happening. No LLM, no DB.
 * Run: ./node_modules/.bin/tsx scripts/test-review-mix.ts
 */
import { tallyReviewMix } from '../server/ai/qualityMetrics.js';

let pass = 0, fail = 0;
function check(n: string, c: boolean, d = '') { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n} ${d}`); } }

console.log('=== tallyReviewMix: both payload shapes ===\n');

// Judge-shaped events (explicit verdict).
const judge = [
  { eventType: 'peer_review_feedback', payload: { verdict: 'approve' } },
  { eventType: 'peer_review_feedback', payload: { verdict: 'revise', mustFix: ['x'] } },
  { eventType: 'peer_review_feedback', payload: { verdict: 'reject' } },
];
let m = tallyReviewMix(judge);
check('judge-shaped: 3 counted (1/1/1)', m.total === 3 && m.approve === 1 && m.revise === 1 && m.reject === 1, JSON.stringify(m));

// Rubric-shaped events (NO verdict), the default judge-off config. Must be derived, not dropped.
const rubric = [
  { eventType: 'peer_review_feedback', payload: { hallucinationRisk: 'low', roleFit: 'pass', usefulness: 'pass', fixSuggestions: [], contradictions: [] } },     // clean -> approve
  { eventType: 'peer_review_feedback', payload: { hallucinationRisk: 'low', roleFit: 'pass', usefulness: 'fail', fixSuggestions: ['tighten the ask'], contradictions: [] } }, // flagged -> revise
  { eventType: 'peer_review_feedback', payload: { hallucinationRisk: 'high', roleFit: 'pass', usefulness: 'pass', fixSuggestions: [], contradictions: [] } },     // high risk -> reject
];
m = tallyReviewMix(rubric);
check('rubric-shaped: 3 counted, not dropped', m.total === 3, JSON.stringify(m));
check('rubric-shaped: clean -> approve', m.approve === 1, JSON.stringify(m));
check('rubric-shaped: flagged -> revise', m.revise === 1, JSON.stringify(m));
check('rubric-shaped: high risk -> reject', m.reject === 1, JSON.stringify(m));

// The exact regression: a project whose reviews are ALL rubric-path must not read as "0 reviews".
const allRubric = Array.from({ length: 5 }, () => ({ eventType: 'peer_review_feedback', payload: { hallucinationRisk: 'low', roleFit: 'pass', usefulness: 'pass', fixSuggestions: [] } }));
check('all-rubric project does NOT report 0 reviews', tallyReviewMix(allRubric).total === 5);

// Non-review events ignored.
check('non-review events ignored', tallyReviewMix([{ eventType: 'task_started', payload: {} }]).total === 0);

console.log(`\nResults: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
