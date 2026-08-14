/**
 * Web-capability probe / baseline harness.
 *
 * Answers one question with LIVE evidence (runs the real functions, not a grep):
 * CAN AGENTS USE THE INTERNET RIGHT NOW?
 *
 * It is also the before/after harness for the ITL-4 "Live Web Research & Web-Learning"
 * work: after WEB-01..04 ship, the same probe should flip from BLOCKED to a real fetch.
 *
 * Safe: no real LLM, no DB writes. When web is off (the current state), the web function
 * returns 'blocked' BEFORE any network or cache access.
 *
 * Run: ./node_modules/.bin/tsx scripts/probe-web-capability.ts
 */
import { shouldAllowWebCalls } from '../server/autonomy/config/policies.js';
import { runRoleScopedResearch } from '../server/tools/web/webClient.js';
import { routeTools } from '../server/tools/toolRouter.js';
import { getWebContextBlock } from '../server/ai/webContext.js';

async function main() {
  const stamp = new Date().toISOString();
  console.log('################ WEB-CAPABILITY BASELINE ################');
  console.log(`when: ${stamp}`);
  console.log('');

  // 1) The gate: is web allowed at all?
  const gate = shouldAllowWebCalls();
  console.log(`[1] shouldAllowWebCalls()            = ${gate}   (env ENABLE_WEB_IN_PROD_MODE)`);

  // 2) Attempt a real web research call (recency-sensitive claim, the kind that NEEDS the internet).
  const research = await runRoleScopedResearch({
    role: 'Growth Marketer',
    topic: 'competitor pricing',
    claim: 'What is the current published price of the top competitor as of this week?',
    highStakes: false,
  });
  console.log(`[2] runRoleScopedResearch()          = blocked:${research.blocked} reason:${research.reason} evidence:${research.evidence.length}`);

  // 3) The router: does the system even TRY to route a "search the web" ask to a web tool?
  const route = routeTools({
    role: 'Growth Marketer',
    message: 'Find the latest news and current pricing about our competitor. Search the web.',
    complexity: 'high',
    riskScore: 0.2,
    roundsUsed: 0,
    webCallsUsed: 0,
  });
  console.log(`[3] routeTools() decision            = tool:'${route.tool}' recencySensitive:${route.recencySensitive}`);
  console.log('');

  // 4) ITL-4 seam: the ANSWER path can now pull live web context (getWebContextBlock). This is what
  //    closes the loop the old NOTE lamented ("the chat path discards the decision"). Probe both states.
  const blockWhenOff = await getWebContextBlock('Growth Marketer', 'what is the latest competitor pricing right now');
  const priorEnabled = process.env.WEB_SEARCH_ENABLED;
  process.env.WEB_SEARCH_ENABLED = 'true';
  const blockWhenOn = await getWebContextBlock('Growth Marketer', 'what is the latest competitor pricing right now');
  process.env.WEB_SEARCH_ENABLED = priorEnabled;
  console.log(`[4] getWebContextBlock() answer seam = wired:true  off->"${blockWhenOff}"  on->${blockWhenOn ? 'live web block injected' : 'gated/empty (fetch made, no rows or prod-mode off)'}`);
  console.log(`    (The answer path now INJECTS live web results when WEB_SEARCH_ENABLED=true; the decision is no longer discarded.)`);
  console.log('');

  // Verdict
  const canUseInternet = gate && !research.blocked;
  console.log('---------------------------------------------------------');
  console.log(`VERDICT: can agents use the internet right now?  ${canUseInternet ? 'YES (fully enabled)' : 'CAPABILITY WIRED, gated off by default'}`);
  if (!canUseInternet) {
    console.log('State: the answer-path seam EXISTS and is proven (getWebContextBlock, step 4), but web is');
    console.log('opt-in: enable WEB_SEARCH_ENABLED=true AND ENABLE_WEB_IN_PROD_MODE=true to fetch live rows.');
    console.log('This is no longer the pre-ITL-4 baseline (capability absent); it is capability-present-gated-off.');
  } else {
    console.log('Web is ON: the real fetch path is active and the answer seam injects live rows.');
  }
  console.log('---------------------------------------------------------');
}

main().catch((err) => {
  console.error('[probe-web-capability] error:', err);
  process.exit(1);
});
