// v2.2 coverage fix: shouldReviewAutonomousOutput must broaden peer-review coverage beyond risk-only.
// Deterministic (no LLM). Proves: mid/high-risk still reviewed; low-risk-but-factual/outward reviewed;
// low-risk-but-substantive reviewed; only trivial short acks skip. This is the gate that was too narrow
// (default peerReviewTrigger 0.35 meant most work shipped unreviewed).
import { shouldReviewAutonomousOutput } from '../server/autonomy/execution/taskExecutionPipeline.js';

const TRIGGER = 0.35;
let pass = 0, fail = 0;
const check = (name: string, got: { review: boolean; reason: string }, wantReview: boolean, wantReason?: string) => {
  const ok = got.review === wantReview && (!wantReason || got.reason === wantReason);
  if (ok) { pass++; console.log(`  PASS  ${name}  → review=${got.review} (${got.reason})`); }
  else { fail++; console.log(`  FAIL  ${name}  → got review=${got.review} (${got.reason}), wanted review=${wantReview}${wantReason ? ` (${wantReason})` : ''}`); }
};

// Substantive prose with NO factual/outward signal (no percentages, no big numbers, no publish verbs),
// so it exercises the substantive_output path rather than outward_or_factual.
const longGood =
  'Rollback approach: keep the previous release image tagged as the last stable build. If the error stays elevated past the watch window, redeploy that image through the same pipeline. The migration only adds a nullable column, so the older code simply ignores it and there is nothing to reverse. The on call engineer owns this and watches the dashboard until things settle back to normal.';

console.log('\nv2.2 review-coverage gate\n');

// 1. Mid/high-risk → reviewed (unchanged behaviour).
check('high risk is reviewed', shouldReviewAutonomousOutput({ maxRisk: 0.6, peerReviewTrigger: TRIGGER, taskText: 'x', output: 'short' }), true, 'risk_threshold');

// 2. Low risk BUT factual/outward (a stat) → reviewed regardless of risk (the important case).
check('low-risk factual stat is reviewed', shouldReviewAutonomousOutput({ maxRisk: 0.1, peerReviewTrigger: TRIGGER, taskText: 'investor one-liner', output: 'We grew 43% month over month.' }), true, 'outward_or_factual');
check('low-risk outward verb is reviewed', shouldReviewAutonomousOutput({ maxRisk: 0.1, peerReviewTrigger: TRIGGER, taskText: 'draft', output: 'Ready to launch the campaign next week.' }), true, 'outward_or_factual');

// 3. Low risk BUT substantive deliverable → reviewed.
check('low-risk substantive output is reviewed', shouldReviewAutonomousOutput({ maxRisk: 0.05, peerReviewTrigger: TRIGGER, taskText: 'write a rollback plan', output: longGood }), true, 'substantive_output');

// 4. Low risk AND trivial short ack → skip (don't spend a review on nothing).
check('trivial short ack skips review', shouldReviewAutonomousOutput({ maxRisk: 0.05, peerReviewTrigger: TRIGGER, taskText: 'ack', output: 'Done, all set.' }), false, 'trivial_output');

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} — ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
