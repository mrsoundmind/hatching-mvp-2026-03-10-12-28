/**
 * Plan 38-05 vibe-check driver.
 *
 * Sends the protocol's prompts through the real chat UI as a user would (typed keystrokes into the
 * real composer, real Enter), on the real DeepSeek chain, and captures each reply plus the
 * mechanical signals. The VOICE judgment is deliberately left to a human; this only removes the
 * typing and the pass/fail bookkeeping around it.
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';

const sid = readFileSync('.audit-2026-07-17/cookies.txt','utf8').split('\n').find(l=>l.includes('connect.sid')).split('\t').pop().trim();
const PROMPTS = [
  { id: 'downgrade-confirm', text: 'which Postgres vector extension should we use?', expect: 'at Confirm level the agent MAY ask a clarifying question (ALWY-03 downgrade)' },
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:1440,height:900} });
await ctx.addCookies([{name:'connect.sid',value:sid,domain:'localhost',path:'/',httpOnly:true}]);
const page = await ctx.newPage();

const wsEvents = [];
page.on('websocket', ws => ws.on('framereceived', f => {
  try { const d = JSON.parse(f.payload.toString()); if (d.type) wsEvents.push(d.type); } catch {}
}));

await page.goto('http://localhost:5001/', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
for (let i=0;i<4;i++){ if((await page.locator('div[data-state="open"][aria-hidden="true"]').count())===0) break; await page.keyboard.press('Escape'); await page.waitForTimeout(700); }

// The protocol names "trial", which belongs to the human's own account. The browser session here
// is the Audit Bot fixture, so the equivalent level-4 project with Maya present is used instead.
// Two copies exist in the DOM (desktop rail + mobile sheet); only one is visible.
const proj = page.getByText('AI Recipe App', { exact: true }).filter({ visible: true }).first();
if (!(await proj.count())) { console.error('project not found'); process.exit(1); }
await proj.click();
await page.waitForTimeout(3000);

const composer = page.getByPlaceholder(/message your team/i).first();
const results = [];

for (const p of PROMPTS) {
  const before = await page.locator('.prose, [class*="MessageBubble"], main p').count();
  wsEvents.length = 0;
  await composer.click();
  await composer.fill('');
  await composer.type(p.text, { delay: 25 });   // real keystrokes
  await page.keyboard.press('Enter');
  console.log(`\n>>> sent: "${p.text}"`);

  // wait for streaming to finish
  let done = false;
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(1500);
    if (wsEvents.includes('streaming_completed') || wsEvents.includes('safety_intervention')) { done = true; break; }
  }
  await page.waitForTimeout(1500);

  const bubbles = await page.locator('main').innerText();
  const tail = bubbles.split('\n').filter(Boolean).slice(-14).join('\n');
  results.push({ ...p, done, wsTypes: [...new Set(wsEvents)], tail });
  console.log(`    ws: ${[...new Set(wsEvents)].join(', ')}`);
  console.log(`    reply tail:\n${tail.split('\n').map(l=>'      '+l).join('\n')}`);
  await page.screenshot({ path: `.audit-2026-07-17/screenshots/vibe-${p.id}.png` });
}

writeFileSync('.audit-2026-07-17/vibe-check-38-05-results.json', JSON.stringify(results, null, 2));
await browser.close();
console.log('\nresults -> .audit-2026-07-17/vibe-check-38-05-results.json');
