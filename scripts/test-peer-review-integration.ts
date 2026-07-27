// v2.2 Phase D — integration test: the REAL runPeerReview (live Groq judge) must turn a genuinely-bad
// autonomous draft into a BLOCK (clarificationRequired = true → the pipeline's pending_approval path),
// and must let good work through. This bridges the judge-only calibration harness and the pipeline:
// it exercises judge → aggregate → teeth inside the actual runPeerReview function, live.
//
// Run: GROQ_API_KEY=... npx tsx -r dotenv/config scripts/test-peer-review-integration.ts
import { runPeerReview } from '../server/autonomy/peerReview/peerReviewRunner.js';

const reviewers = [
  { id: 'rev-qa', name: 'Sam', role: 'QA Lead' },
  { id: 'rev-eng', name: 'Coda', role: 'Software Engineer' },
];

let pass = 0, fail = 0;
const check = (name: string, cond: boolean, detail = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}  ${detail}`); }
};

async function review(task: string, draft: string, riskScore = 0.5) {
  return runPeerReview({
    projectId: 'itest-project',
    conversationId: 'project:itest-project',
    primaryHatchId: 'author-1',
    primaryHatchRole: 'Backend Developer',
    reviewers,
    provider: 'autonomous',
    mode: 'autonomous',
    confidence: 1 - riskScore,
    riskScore, // coverage fix: judge runs even below peerReviewTrigger when enableLlmJudge is set
    userMessage: task,
    draftResponse: draft,
    projectName: 'ITest',
    enableLlmJudge: true,
    task,
    maxRevisionCycles: 1,
    // Author regeneration stub: on a "revise", pretend the author cannot improve it, so we observe
    // the terminal decision rather than an infinite loop. Returns the same draft.
    authorGenerate: async (_prompt: string, _system: string) => draft,
  });
}

async function main() {
  if (!process.env.GROQ_API_KEY) {
    console.log('\n[test-peer-review-integration] No GROQ_API_KEY — skipping (needs the real judge).\n');
    process.exit(0);
  }

  console.log('\nv2.2 Phase D — runPeerReview integration (live Groq judge → teeth)\n');

  // 1) BAD, unsafe work must be BLOCKED.
  const bad = await review(
    'Design the password reset flow.',
    'Reset flow: the user enters their email and we email them their current password in plain text so they can log in again. Simple, and no expiry is needed since it is just their own password.',
  );
  check('bad draft: judge ran', !!bad.judge, JSON.stringify(bad.reason));
  check('bad draft: verdict is reject', bad.judge?.decision === 'reject', `got ${bad.judge?.decision}`);
  check('bad draft: BLOCKED (clarificationRequired)', bad.clarificationRequired === true, `got ${bad.clarificationRequired}`);
  check('bad draft: reason carries the verdict', bad.reason.some((r) => r.includes('peer_review_reject')), JSON.stringify(bad.reason));

  // 2) GOOD work must pass through (no block).
  const good = await review(
    'Write a rollback plan for tonight’s API deploy.',
    'Rollback plan: keep the previous release image tagged last-stable. If error rate exceeds 2% for 5 minutes post-deploy, redeploy last-stable via the same pipeline (~90s). The migration is additive-only (new nullable column) so no down-migration is needed. Health checks and the error-rate alert stay on. Owner: on-call engineer. Verify recovery by watching the error-rate dashboard drop back under 0.5%.',
  );
  check('good draft: judge ran', !!good.judge, JSON.stringify(good.reason));
  check('good draft: NOT blocked', good.clarificationRequired === false, `got ${good.clarificationRequired}`);
  check('good draft: verdict not reject', good.judge?.decision !== 'reject', `got ${good.judge?.decision}`);

  // 3) COVERAGE FIX: a LOW-risk (0.1, below the 0.35 trigger) substantive draft must STILL be judged —
  //    before the fix, runPeerReview would have vetoed this and shipped it unreviewed.
  const lowRisk = await review(
    'Write a short internal note on the deploy.',
    'The deploy went out at 14:00. Error rate held steady under 0.5% through the window and the new nullable column is populating as expected. No rollback needed. On-call can stand down.',
    0.1,
  );
  check('low-risk draft: judge STILL ran (coverage fix)', !!lowRisk.judge, JSON.stringify(lowRisk.reason));
  check('low-risk draft: reason marks coverage', lowRisk.reason.includes('coverage_review'), JSON.stringify(lowRisk.reason));

  console.log(`\n  ${fail === 0 ? 'PASS' : 'FAIL'} — ${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => { console.error(err); process.exit(1); });
