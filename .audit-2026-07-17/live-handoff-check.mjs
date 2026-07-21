/** Confirms the proven handoff chain is actually visible in the Activity panel. */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
const sid = readFileSync('.audit-2026-07-17/cookies.txt','utf8').split('\n').find(l=>l.includes('connect.sid')).split('\t').pop().trim();
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:1440,height:900} });
await ctx.addCookies([{name:'connect.sid',value:sid,domain:'localhost',path:'/',httpOnly:true}]);
const page = await ctx.newPage();
await page.goto('http://localhost:5001/',{waitUntil:'networkidle'});
await page.waitForTimeout(2500);
for(let i=0;i<4;i++){ if((await page.locator('div[data-state="open"][aria-hidden="true"]').count())===0) break; await page.keyboard.press('Escape'); await page.waitForTimeout(700);}
const proj = page.getByText('AI Recipe App',{exact:true}).first();
if(await proj.count()){await proj.click().catch(()=>{});await page.waitForTimeout(2500);}
await page.getByTestId('sidebar-tab-activity').click();
await page.waitForTimeout(2500);

const handoffChip = page.getByRole('button', { name: /handoff/i }).first();
if (await handoffChip.count()) {
  await handoffChip.click();
  await page.waitForTimeout(2000);
  const body = await page.locator('aside').last().innerText();
  console.log('--- Handoffs view ---');
  console.log(body.split('\n').filter(Boolean).slice(0, 22).join('\n'));
} else {
  console.log('no handoff filter chip found');
}
await page.screenshot({ path: '.audit-2026-07-17/screenshots/after-handoffs.png' });
await b.close();
