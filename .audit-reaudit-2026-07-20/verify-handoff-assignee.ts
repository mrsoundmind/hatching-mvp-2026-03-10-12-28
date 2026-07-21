/**
 * Handoff must respect an explicit assignee.
 * Task A (design work) completes; dependent Task B is ENGINEERING work but explicitly assigned to
 * Arlo (a UI Designer). The conductor, left alone, would route B to an engineer. With the fix, the
 * explicit assignee wins → B hands off to Arlo.
 */
import 'dotenv/config';
import { randomUUID } from 'crypto';
import { storage } from '../server/storage.js';
import { orchestrateHandoff } from '../server/autonomy/handoff/handoffOrchestrator.js';

const PROJECT_ID = '554d6e3a-1c18-40e5-ad4b-d8499270b769';
let failures = 0;
const check = (l: string, c: boolean, d = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}${d ? ' : ' + d : ''}`); if (!c) failures++; };

(async () => {
  const project = await storage.getProject(PROJECT_ID);
  const agents = (await storage.getAgentsByProject(PROJECT_ID)).filter((a: any) => !a.isSpecialAgent);
  const arlo = agents.find((a: any) => a.name === 'Arlo');
  const coda = agents.find((a: any) => a.name === 'Coda') ?? agents[0];
  if (!arlo) throw new Error('Arlo not in project');
  console.log('agents:', agents.map((a:any)=>`${a.name}(${a.role})`).join(', '));

  const taskA = randomUUID(), taskB = randomUUID();
  await storage.createTask({ id: taskA, userId: (project as any).userId, projectId: PROJECT_ID,
    title: 'Assignee probe A: design the schema', description: 'Design the database schema.',
    status: 'completed', priority: 'medium', metadata: { isAutonomous: true, output: 'schema done' } } as any);
  // B is ENGINEERING work (conductor would pick an engineer) but explicitly assigned to Arlo.
  await storage.createTask({ id: taskB, userId: (project as any).userId, projectId: PROJECT_ID,
    title: 'Assignee probe B: implement the backend API and database migration',
    description: 'Implement the backend REST API endpoints and write the SQL database migration.',
    status: 'todo', priority: 'medium', assignee: 'Arlo', metadata: { dependsOn: taskA } } as any);

  const result = await orchestrateHandoff({
    completedTask: { id: taskA, title: 'Assignee probe A: design the schema', description: null, projectId: PROJECT_ID },
    completedAgent: { id: coda.id, name: coda.name, role: coda.role },
    completedOutput: 'schema done', handoffChain: [], storage,
    broadcastToConversation: () => {}, traceId: randomUUID(),
  });

  console.log('handoff result:', JSON.stringify(result));
  check('handoff queued', result.status === 'queued', result.status);
  check('routed to the ASSIGNEE (Arlo), not the conductor pick', (result as any).nextAgentId === arlo.id,
    `${(result as any).nextAgentId} vs Arlo ${arlo.id}`);

  await storage.deleteTask(taskA); await storage.deleteTask(taskB);
  // clean the enqueued job for B
  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query(`delete from pgboss.job where name='autonomous_task_execution' and data->>'taskId'=$1`, [taskB]);
  await pool.end();
  console.log(failures === 0 ? '\nASSIGNEE-RESPECTING HANDOFF VERIFIED' : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
