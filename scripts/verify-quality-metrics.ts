/**
 * ITL-2 MEAS-03/08 evidence. Unit-tests the review-mix tally + prints a LIVE read-only quality
 * snapshot from the real DB (corpus health + retrieval stats + peer-review verdict mix). No writes.
 * Run: set -a; source ./.env; set +a; STORAGE_MODE=memory ./node_modules/.bin/tsx scripts/verify-quality-metrics.ts
 */
import { getQualityMetrics, tallyReviewMix } from '../server/ai/qualityMetrics.js';

let pass = 0, fail = 0;
function check(n: string, c: boolean, d = '') { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n} ${d}`); } }

async function main() {
  console.log('=== ITL-2 MEAS-03/08: quality metrics surface ===\n');

  const mix = tallyReviewMix([
    { eventType: 'peer_review_feedback', payload: { verdict: 'approve' } },
    { eventType: 'peer_review_feedback', payload: { verdict: 'revise' } },
    { eventType: 'peer_review_feedback', payload: { verdict: 'reject' } },
    { eventType: 'peer_review_feedback', payload: { verdict: 'revise' } },
    { eventType: 'autonomous_task_execution', payload: {} },
  ]);
  check('tallies verdicts (approve/revise/reject)', mix.approve === 1 && mix.revise === 2 && mix.reject === 1 && mix.total === 4, JSON.stringify(mix));
  check('revisionRate = (revise+reject)/total', Math.abs(mix.revisionRate - 0.75) < 1e-9, String(mix.revisionRate));
  check('ignores non-review events', mix.total === 4);
  check('empty input is zero', tallyReviewMix([]).total === 0);

  const m = await getQualityMetrics();
  console.log('\n--- LIVE global quality snapshot (read-only from the real DB) ---');
  console.log(JSON.stringify({ knowledge: m.knowledge, retrieval: m.retrieval, reviews: m.reviews, scope: m.scope }, null, 2));
  check('live snapshot aggregates knowledge + retrieval + reviews', !!m.knowledge && !!m.retrieval && !!m.reviews && m.scope === 'global');

  console.log(`\nResults: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error('verify error:', e); process.exit(1); });
