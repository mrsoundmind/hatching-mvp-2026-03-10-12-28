/**
 * Wave 1B verification (deterministic, free): the bull/bear debate engine.
 * Covers the DEBATE_MODE_ENABLED gate, the strict shouldDebate trigger, and runDebate structure
 * via the capture provider. Quality/lift is measured separately in scripts/eval-debate-ab.ts.
 *
 * Run:
 *   LLM_MODE=test TEST_LLM_PROVIDER=capture STORAGE_MODE=memory \
 *     ./node_modules/.bin/tsx -r dotenv/config scripts/test-debate.ts
 */
import { debateEnabled, shouldDebate, runDebate } from '../server/ai/debate';

let pass = 0, fail = 0;
function check(label: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label} ${detail ? ': ' + detail : ''}`); }
}

(async () => {
  console.log('=== gate: debateEnabled (default OFF) ===');
  delete process.env.DEBATE_MODE_ENABLED;
  check('off by default', !debateEnabled());
  for (const on of ['true', '1', 'on', 'yes']) { process.env.DEBATE_MODE_ENABLED = on; check(`"${on}" enables`, debateEnabled()); }
  for (const off of ['false', '0', 'off', 'no', '']) { process.env.DEBATE_MODE_ENABLED = off; check(`"${off}" disables`, !debateEnabled()); }

  console.log('\n=== trigger: shouldDebate is strict ===');
  process.env.DEBATE_MODE_ENABLED = 'false';
  check('never fires when feature off', !shouldDebate({ userMessage: 'Should we launch now or wait?', complexity: 'high' }));
  process.env.DEBATE_MODE_ENABLED = 'true';
  check('fires on a high-stakes either/or decision', shouldDebate({ userMessage: 'Should we price at 999 or 1299?', deliberationHint: true }));
  check('fires on "should we X?" with high risk', shouldDebate({ userMessage: 'Should we rewrite the backend?', aggregateRisk: 0.6 }));
  check('fires on high complexity decision', shouldDebate({ userMessage: 'Which approach should we choose?', complexity: 'high' }));
  check('does NOT fire on a plain fact lookup', !shouldDebate({ userMessage: 'What is our current MRR?', complexity: 'high' }));
  check('does NOT fire on a decision with no stakes signal', !shouldDebate({ userMessage: 'Should we rename the button?' }));
  check('does NOT fire on a task request', !shouldDebate({ userMessage: 'Draft the launch email.', aggregateRisk: 0.9 }));

  console.log('\n=== runDebate: off returns null (clean proceed path) ===');
  process.env.DEBATE_MODE_ENABLED = 'false';
  check('runDebate returns null when off', (await runDebate({ question: 'Should we launch now?' })) === null);

  console.log('\n=== runDebate: structure via capture provider (ON) ===');
  process.env.DEBATE_MODE_ENABLED = 'true';
  const result = await runDebate({ question: 'Should we launch on Product Hunt now or wait a month?', context: 'Small SaaS, pre-revenue.' });
  check('returns a result (capture provider live)', !!result, 'is LLM_MODE=test TEST_LLM_PROVIDER=capture set?');
  check('three rounds (for, against, synth)', !!result && result.rounds === 3);
  check('has a non-empty case FOR', !!result && result.argumentFor.length > 0);
  check('has a non-empty case AGAINST', !!result && result.argumentAgainst.length > 0);
  check('has a non-empty recommendation', !!result && result.recommendation.length > 0);
  check('records latency', !!result && result.latencyMs >= 0);

  console.log(`\n──────────────────────────────\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((err) => { console.error('FATAL', err); process.exit(1); });
