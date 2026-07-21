import 'dotenv/config';
import { randomUUID } from 'crypto';
import { storage } from '../server/storage.js';
import { queueTaskExecution } from '../server/autonomy/execution/jobQueue.js';
import { Pool } from 'pg';

const PROJECT_ID = '554d6e3a-1c18-40e5-ad4b-d8499270b769';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  const project = await storage.getProject(PROJECT_ID);
  const agents = (await storage.getAgentsByProject(PROJECT_ID)).filter((a: any) => !a.isSpecialAgent);
  const agent = agents[0];
  const taskId = randomUUID();
  await storage.createTask({
    id: taskId, userId: (project as any).userId, projectId: PROJECT_ID,
    title: 'Resilience re-test: draft a one-line launch tagline',
    description: 'Write a single punchy launch tagline for the recipe app.',
    status: 'todo', priority: 'medium', metadata: { isAutonomous: true },
  } as any);

  const jobId = await queueTaskExecution({ taskId, projectId: PROJECT_ID, agentId: agent.id, traceId: randomUUID() });
  console.log(`enqueued fresh task via the real producer: job=${jobId}`);

  let done = false;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const t = await storage.getTask(taskId);
    const j = await pool.query(`select state from pgboss.job where id::text = $1`, [jobId]);
    console.log(`  t=${(i + 1) * 3}s task=${t?.status} job=${j.rows[0]?.state ?? 'archived'}`);
    if (t?.status === 'completed') { done = true; break; }
  }
  const t = await storage.getTask(taskId);
  const meta = (t?.metadata ?? {}) as any;
  console.log(`\nfresh run: ${done ? 'PASS' : 'FAIL'} — status=${t?.status}, completedBy=${meta.completedByAgentName}, output=${meta.output ? meta.output.length + ' chars' : 'none'}`);
  await storage.deleteTask(taskId);
  console.log('cleaned up the probe task');
  await pool.end();
  process.exit(done ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
