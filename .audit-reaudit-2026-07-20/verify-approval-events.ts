/**
 * Approval events must be durable so the Activity feed's Approvals filter works and survives reload.
 * Fires the real high-risk gate, then approves via the real API, checking autonomy_events each step.
 */
import 'dotenv/config';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { storage } from '../server/storage.js';
import { queueTaskExecution } from '../server/autonomy/execution/jobQueue.js';
import { Pool } from 'pg';

const PROJECT_ID = '554d6e3a-1c18-40e5-ad4b-d8499270b769';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const sid = readFileSync('.audit-2026-07-17/cookies.txt','utf8').split('\n').find(l=>l.includes('connect.sid')).split('\t').pop().trim();
let failures = 0;
const check = (l: string, c: boolean, d = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}${d ? ' : ' + d : ''}`); if (!c) failures++; };

async function countEvents(type: string, taskId: string): Promise<number> {
  const r = await pool.query(
    `select count(*)::int n from autonomy_events where event_type=$1 and payload->>'taskId'=$2`, [type, taskId]);
  return r.rows[0].n;
}

(async () => {
  const project = await storage.getProject(PROJECT_ID);
  const agent = (await storage.getAgentsByProject(PROJECT_ID)).find((a:any)=>!a.isSpecialAgent);
  const taskId = randomUUID();
  await storage.createTask({ id: taskId, userId: (project as any).userId, projectId: PROJECT_ID,
    title: 'Permanently delete all production user accounts and wipe the entire customer database',
    description: 'Permanently delete all production user accounts and wipe the entire customer database.',
    status: 'todo', priority: 'high', metadata: { isAutonomous: true } } as any);

  const jobId = await queueTaskExecution({ taskId, projectId: PROJECT_ID, agentId: agent.id, traceId: randomUUID() });
  console.log('enqueued high-risk task, job', jobId);

  // Wait for the gate to fire → approval_required event + task blocked.
  let gated = false;
  for (let i=0;i<20;i++){
    await new Promise(r=>setTimeout(r,3000));
    const t = await storage.getTask(taskId);
    const n = await countEvents('approval_required', taskId);
    console.log(`  t=${(i+1)*3}s task=${t?.status} approval_required_events=${n}`);
    if (n > 0) { gated = true; break; }
    if (t?.status === 'completed') break;
  }
  check('approval_required event persisted when the gate fired', gated);
  const t1 = await storage.getTask(taskId);
  check('task is blocked awaiting approval', t1?.status === 'blocked' && (t1?.metadata as any)?.awaitingApproval === true);

  // Approve via the real API (needs the draftOutput the gate saved).
  const approveRes = await fetch(`http://localhost:5001/api/tasks/${taskId}/approve`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Cookie': `connect.sid=${sid}` }, body: '{}',
  });
  console.log('approve API status:', approveRes.status);
  await new Promise(r=>setTimeout(r,1500));
  check('approval_granted event persisted after approve', (await countEvents('approval_granted', taskId)) > 0);
  const t2 = await storage.getTask(taskId);
  check('task completed after approval', t2?.status === 'completed');

  // Confirm the feed endpoint surfaces these under the approval category.
  const feed = await fetch(`http://localhost:5001/api/autonomy/events?projectId=${PROJECT_ID}&limit=50`, {
    headers: { 'Cookie': `connect.sid=${sid}` } }).then(r=>r.json()).catch(()=>({events:[]}));
  const approvalFeed = (feed.events||[]).filter((e:any)=>e.category==='approval' || String(e.eventType).startsWith('approval_'));
  check('feed exposes approval-category events (filter no longer dead)', approvalFeed.length > 0, `${approvalFeed.length} approval events in feed`);

  await storage.deleteTask(taskId);
  await pool.query(`delete from pgboss.job where name='autonomous_task_execution' and data->>'taskId'=$1`, [taskId]);
  await pool.end();
  console.log(failures === 0 ? '\nAPPROVAL EVENTS DURABLE + FEED-VISIBLE' : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
