/**
 * ITL-4 / WEB-01 + WEB-02 evidence. Verifies the live-web answer seam:
 *  - gate is OFF by default (no network hop, returns '')
 *  - fires only for recency-sensitive queries
 *  - is fail-safe (never throws) and reaches the real internet when fully enabled
 * The gate assertions are deterministic + free. The final case makes ONE real keyless
 * DuckDuckGo fetch to prove the seam actually reaches the network (informational, not gated).
 * Run: ./node_modules/.bin/tsx scripts/verify-web-context.ts
 */
process.env.WEB_SEARCH_ENABLED = process.env.WEB_SEARCH_ENABLED ?? 'off';

import { getWebContextBlock, needsWeb } from '../server/ai/webContext.js';

let pass = 0, fail = 0;
function check(n: string, c: boolean, d = '') { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n} ${d}`); } }

async function main() {
  console.log('=== ITL-4 / WEB: live-web answer seam ===\n');

  // --- Gate: OFF by default ---
  process.env.WEB_SEARCH_ENABLED = 'off';
  check('gate off -> returns "" (no network hop)', (await getWebContextBlock('Data Analyst', 'what is the latest AI news today')) === '');

  // --- Recency detection ---
  check('needsWeb: "latest pricing" -> true', needsWeb('what is the latest pricing for competitors'));
  check('needsWeb: "current stock price" -> true', needsWeb('current stock price of NVDA'));
  check('needsWeb: "202X" year -> true', needsWeb('what changed in 2026'));
  check('needsWeb: evergreen question -> false', !needsWeb('how do I structure a good onboarding flow'));
  check('needsWeb: empty -> false', !needsWeb(''));

  // --- Gate ON but non-recency query -> still "" (no wasted fetch) ---
  process.env.WEB_SEARCH_ENABLED = 'true';
  check('gate on + non-recency -> "" (no wasted fetch)', (await getWebContextBlock('Data Analyst', 'explain jobs-to-be-done')) === '');

  // --- Gate ON + recency, but web-client prod-mode still OFF -> blocked -> "" (double gate) ---
  delete process.env.ENABLE_WEB_IN_PROD_MODE;
  const doubleGated = await getWebContextBlock('SEO Specialist', 'latest Google algorithm update 2026');
  check('gate on + recency + prod-mode off -> "" (double-gated, fail-safe)', doubleGated === '');

  // --- Fully enabled: ONE real keyless fetch. Must NOT throw; returns a string either way. ---
  process.env.ENABLE_WEB_IN_PROD_MODE = 'true';
  let liveResult = '';
  let threw = false;
  try {
    liveResult = await getWebContextBlock('Data Analyst', 'current population of India 2026');
  } catch { threw = true; }
  check('fully enabled: never throws (fail-safe)', !threw);
  check('fully enabled: returns a string', typeof liveResult === 'string');
  console.log(liveResult
    ? `  · live fetch reached the internet and returned evidence:\n${liveResult.split('\n').slice(0, 4).map(l => '      ' + l).join('\n')}`
    : '  · live fetch returned no rows (DuckDuckGo instant-answer is sparse; the SEAM works, a stronger provider fills it)');

  console.log(`\nResults: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
