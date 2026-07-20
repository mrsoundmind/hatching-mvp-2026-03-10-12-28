/**
 * Proves the agent handoff chain end to end.
 *
 * The Handoffs view has always been empty. That is only honest if the mechanism works and simply
 * has nothing to show, so this builds the missing precondition: a completed task plus a second task
 * whose metadata.dependsOn points at it, which is the only thing that triggers a handoff.
 *
 * Observes the full chain: handoff_initiated event logged, context passed to the receiving agent,
 * job enqueued, and the running background worker actually executing the downstream task.
 */
import 'dotenv/config';
import { randomUUID } from 'crypto';
import { storage } from '../server/storage.js';
import { orchestrateHandoff } from '../server/autonomy/handoff/handoffOrchestrator.js';
import { Pool } from 'pg';

const PROJECT_ID = '554d6e3a-1c18-40e5-ad4b-d8499270b769';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

let failures = 0;
function check(label: string, cond: boolean, detail = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${detail ? ' : ' + detail : ''}`);
  if (!cond) failures++;
}

async function main() {
  const project = await storage.getProject(PROJECT_ID);
  if (!project) throw new Error('probe project not found');
  const agents = (await storage.getAgentsByProject(PROJECT_ID)).filter((a: any) => !a.isSpecialAgent);
  if (agents.length < 1) throw new Error('need at least one non-special agent');
  const fromAgent = agents[0];
  console.log(`project ${project.name} | agents: ${agents.map((a: any) => `${a.name} (${a.role})`).join(', ')}\n`);

  const taskA = randomUUID();
  const taskB = randomUUID();
  const OUTPUT_A =
    'Scope for the launch: three channels, a two week runway, and a single conversion goal on the '
    + 'pricing page. Constraints are no paid spend and no new brand assets.';

  await storage.createTask({
    id: taskA, userId: (project as any).userId, projectId: PROJECT_ID,
    title: 'Handoff probe: define the launch scope',
    description: 'Define the scope, channels and constraints for the launch.',
    status: 'completed', priority: 'medium',
    metadata: { isAutonomous: true, output: OUTPUT_A },
  } as any);

  await storage.createTask({
    id: taskB, userId: (project as any).userId, projectId: PROJECT_ID,
    title: 'Handoff probe: implement the pricing page conversion tracking',
    description: 'Implement the backend API endpoint and database schema needed to track conversion events on the pricing page, including the migration.',
    status: 'todo', priority: 'medium',
    metadata: { dependsOn: taskA },
  } as any);

  console.log('seeded A (completed) and B (todo, dependsOn A)\n');

  const before = await pool.query(
    `SELECT count(*)::int AS n FROM autonomy_events WHERE event_type = 'handoff_initiated' AND project_id = $1`,
    [PROJECT_ID]
  );

  const result = await orchestrateHandoff({
    completedTask: { id: taskA, title: 'Handoff probe: define the launch scope', description: null, projectId: PROJECT_ID },
    completedAgent: { id: fromAgent.id, name: fromAgent.name, role: fromAgent.role },
    completedOutput: OUTPUT_A,
    handoffChain: [],
    storage,
    broadcastToConversation: (_c, p: any) => console.log(`   [broadcast] ${p.type}`),
    traceId: randomUUID(),
  });

  console.log(`\nhandoff result: ${JSON.stringify(result)}\n`);
  check('handoff was queued (not no_next_task)', result.status === 'queued', result.status);
  check('a receiving agent was chosen', !!(result as any).nextAgentId);
  check('the dependent task was the target', (result as any).nextTaskId === taskB);

  const after = await pool.query(
    `SELECT payload FROM autonomy_events WHERE event_type = 'handoff_initiated' AND project_id = $1
      ORDER BY timestamp DESC LIMIT 1`,
    [PROJECT_ID]
  );
  const afterCount = await pool.query(
    `SELECT count(*)::int AS n FROM autonomy_events WHERE event_type = 'handoff_initiated' AND project_id = $1`,
    [PROJECT_ID]
  );
  check('handoff_initiated event logged', afterCount.rows[0].n === before.rows[0].n + 1,
    `${before.rows[0].n} -> ${afterCount.rows[0].n}`);
  const p = after.rows[0]?.payload ?? {};
  check('event names both sides', !!p.fromAgent?.name && !!p.toAgent?.name,
    `${p.fromAgent?.name} -> ${p.toAgent?.name}`);

  const bAfter = await storage.getTask(taskB);
  const bMeta = (bAfter?.metadata ?? {}) as any;
  check('upstream output passed to receiver', bMeta.previousAgentOutput === OUTPUT_A);
  check('upstream agent named for receiver', bMeta.previousAgentName === fromAgent.name, bMeta.previousAgentName);
  check('structured handoff context attached',
    !!bMeta.structuredHandoff?.from?.role && !!bMeta.structuredHandoff?.to?.role,
    `${bMeta.structuredHandoff?.from?.role} -> ${bMeta.structuredHandoff?.to?.role}`);

  // The running worker should now pick the job up and execute it for real.
  console.log('\nwaiting for the background worker to execute the handed-off task...');
  let executed = false;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const t = await storage.getTask(taskB);
    const j = await pool.query(
      `SELECT state FROM pgboss.job WHERE name = 'autonomous_task_execution'
        AND data->>'taskId' = $1 ORDER BY created_on DESC LIMIT 1`, [taskB]
    );
    console.log(`   t=${(i + 1) * 3}s task=${t?.status} job=${j.rows[0]?.state ?? 'none'}`);
    if (t?.status === 'completed' || t?.status === 'in_progress') { executed = true; }
    if (t?.status === 'completed') break;
  }
  const bFinal = await storage.getTask(taskB);
  check('handed-off task was picked up and run', executed, String(bFinal?.status));

  const msgs = await pool.query(
    `SELECT content, agent_id FROM messages WHERE metadata->>'taskId' = $1 ORDER BY created_at DESC LIMIT 1`, [taskB]
  );
  if (msgs.rows.length) {
    const agent = agents.find((a: any) => a.id === msgs.rows[0].agent_id);
    console.log(`\nreceiving agent produced ${msgs.rows[0].content.length} chars:`);
    console.log(`   "${msgs.rows[0].content.slice(0, 200).replace(/\n/g, ' ')}..."`);
    check('receiving agent produced real output', msgs.rows[0].content.length > 100,
      `${msgs.rows[0].content.length} chars by ${agent?.name ?? 'unknown'}`);
    check('output reflects the upstream scope',
      /channel|pricing|two week|constraint|launch|conversion/i.test(msgs.rows[0].content));
  } else {
    check('receiving agent produced real output', false, 'no output message found');
  }

  if (process.argv.includes('--keep')) {
    console.log(`\nkeeping probe tasks for UI inspection: A=${taskA} B=${taskB}`);
  } else {
    await storage.deleteTask(taskA);
    await storage.deleteTask(taskB);
    console.log('\ncleaned up probe tasks');
  }

  await pool.end();
  console.log(failures === 0 ? '\nHANDOFF CHAIN PROVEN END TO END' : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
