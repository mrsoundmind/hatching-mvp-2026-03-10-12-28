import { chromium } from 'playwright';
import { readFileSync } from 'fs';
const sid = readFileSync('.audit-2026-07-17/cookies.txt','utf8').split('\n').find(l=>l.includes('connect.sid')).split('\t').pop().trim();
const out = process.argv[2] || 'feed';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:1440,height:1000} });
await ctx.addCookies([{name:'connect.sid',value:sid,domain:'localhost',path:'/',httpOnly:true}]);
const page = await ctx.newPage();
await page.goto('http://localhost:5001/',{waitUntil:'networkidle'});
await page.waitForTimeout(2500);
for(let i=0;i<4;i++){ if((await page.locator('div[data-state="open"][aria-hidden="true"]').count())===0) break; await page.keyboard.press('Escape'); await page.waitForTimeout(700);}
const p = page.getByText('AI Recipe App',{exact:true}).filter({visible:true}).first();
if(await p.count()){ await p.click(); await page.waitForTimeout(2500); }
await page.getByTestId('sidebar-tab-activity').click();
await page.waitForTimeout(2500);
const aside = page.locator('aside').last();
await aside.screenshot({ path: `.audit-reaudit-2026-07-20/${out}.png` });
console.log('shot ->', out);
await b.close();
