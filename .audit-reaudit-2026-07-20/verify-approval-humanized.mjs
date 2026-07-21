/**
 * Live check that the approval surfaces show human phrases, not raw safety codes.
 * Seeds a task exactly as the high-risk gate does (awaitingApproval + raw riskReasons), opens the
 * Activity tab, and reads the pinned "Needs your approval" card's DOM.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import 'dotenv/config';

const RAW = ['missing_uncertainty_markers','high_impact_action:delete','destructive_verb_critical','bulk_scope_modifier','data_scope_modifier','autonomous_context_risk_boost'];
const PROJECT_ID = '554d6e3a-1c18-40e5-ad4b-d8499270b769';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const proj = (await pool.query('select user_id from projects where id=$1', [PROJECT_ID])).rows[0];
const taskId = randomUUID();
await pool.query(
  `insert into tasks (id, user_id, project_id, title, description, status, priority, metadata)
   values ($1,$2,$3,$4,$5,'blocked','high',$6)`,
  [taskId, proj.user_id, PROJECT_ID, 'Delete all production user accounts', 'high-risk probe',
   JSON.stringify({ awaitingApproval: true, riskScore: 0.936, riskReasons: RAW })]
);
console.log('seeded high-risk approval task', taskId);

const sid = readFileSync('.audit-reaudit-2026-07-20/../.audit-2026-07-17/cookies.txt','utf8').split('\n').find(l=>l.includes('connect.sid')).split('\t').pop().trim();
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:1440,height:900} });
await ctx.addCookies([{name:'connect.sid',value:sid,domain:'localhost',path:'/',httpOnly:true}]);
const page = await ctx.newPage();
await page.goto('http://localhost:5001/',{waitUntil:'networkidle'});
await page.waitForTimeout(2500);
for(let i=0;i<4;i++){ if((await page.locator('div[data-state="open"][aria-hidden="true"]').count())===0) break; await page.keyboard.press('Escape'); await page.waitForTimeout(700);}
const p = page.getByText('AI Recipe App',{exact:true}).filter({visible:true}).first();
if(await p.count()){ await p.click(); await page.waitForTimeout(2500); }
await page.getByTestId('sidebar-tab-activity').click();
await page.waitForTimeout(2500);

const approvalBlock = page.getByText(/Needs your approval/i).first();
let text = '';
if (await approvalBlock.count()) {
  const container = approvalBlock.locator('xpath=ancestor::div[3]');
  text = await container.innerText().catch(async () => await page.locator('aside').last().innerText());
} else {
  text = await page.locator('aside').last().innerText();
}
console.log('--- approval card region ---');
console.log(text.split('\n').filter(Boolean).slice(0,12).join('\n'));

const leaks = RAW.filter(code => text.includes(code));
const hasHuman = /deleting or destroying data|high-impact|held to a higher bar/i.test(text);
console.log('\nraw codes leaked on screen:', leaks.length, leaks);
console.log('human phrases present:', hasHuman);
console.log(leaks.length === 0 && hasHuman ? 'PASS: humanized, no raw codes' : 'FAIL');

await page.screenshot({ path: '.audit-reaudit-2026-07-20/approval-humanized.png' });
await pool.query('delete from tasks where id=$1', [taskId]);
console.log('cleaned up seeded task');
await b.close();
await pool.end();
