// v2.2 lineage fix — LIVE proof that a peer-review verdict can be joined back to the task it reviewed
// AND the autonomy run it belongs to, via payload.taskId + payload.runTraceId (the per-event trace_id
// stays unique, so the review keeps its own feed row). Also confirms the "9h timestamp skew" was an
// artifact of the broken linkage: once joined to the RIGHT run, the timestamps are seconds apart.
//
// Run: npx tsx -r dotenv/config scripts/verify-review-lineage-live.ts
import { randomUUID } from 'crypto';
import { storage } from '../server/storage.js';
import { executeTask } from '../server/autonomy/execution/taskExecutionPipeline.js';
import { ensureRunForTrace } from '../server/autonomy/runs/runTreeWriter.js';
import { generateWithPreferredProvider } from '../server/llm/providerResolver.js';
import pg from 'pg';

const DEMO_NAME = 'Phase D Review Demo';

async function main() {
  if (!process.env.GROQ_API_KEY) { console.log('SKIP: no GROQ_API_KEY'); process.exit(0); }
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

  const user = await storage.getUserByUsername('session:dev_tester');
  if (!user) throw new Error('run /api/auth/dev-login once first');
  const project = (await storage.getProjectsByUserId(user.id)).find((p) => p.name === DEMO_NAME);
  if (!project) throw new Error('run scripts/seed-peer-review-event.ts once first');
  const author = (await storage.getAgentsByProject(project.id)).find((a) => !a.isSpecialAgent)!;

  const generateText = async (prompt: string, system: string) =>
    (await generateWithPreferredProvider({ messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }], maxTokens: 400, temperature: 0.5 }, 'groq')).content || '';

  // A real run with a real trace, exactly like handleTaskJob sets up.
  const traceId = `trace-${randomUUID()}`;
  const task = await storage.createTask({ projectId: project.id, userId: user.id, title: 'Write brief release notes for the settings page', description: 'Write brief release notes for the settings page', status: 'todo', priority: 'medium' } as any);
  const runId = await ensureRunForTrace(traceId, { projectId: project.id, userId: user.id, rootAgentId: author.id, rootGoal: task.title });

  await executeTask({
    task: { id: task.id, title: task.title, description: task.description ?? null, assignee: null, projectId: project.id },
    agent: { id: author.id, name: author.name, role: author.role, personality: author.personality },
    project: { id: project.id, name: project.name, coreDirection: project.coreDirection, brain: project.brain },
    conversationId: `project:${project.id}`,
    storage, broadcastToConversation: () => {}, generateText,
    traceId, runId, parentStepId: null,
  });
  await new Promise((r) => setTimeout(r, 4000));

  let pass = 0, fail = 0;
  const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log(`  PASS  ${n}`); } else { fail++; console.log(`  FAIL  ${n}  ${d}`); } };

  // The review verdict for THIS task, and whether it joins to THIS run.
  const rev = await pool.query(
    `select e.trace_id ev_trace, (e.payload->>'taskId') task_id, (e.payload->>'runTraceId') run_trace,
            (e.payload->>'verdict') verdict, e.timestamp ev_ts
     from autonomy_events e where e.event_type='peer_review_feedback' and e.payload->>'taskId' = $1
     order by e.timestamp desc limit 1`, [task.id]);
  check('review verdict recorded for this task', rev.rows.length > 0);
  if (rev.rows.length) {
    const r = rev.rows[0];
    check('review carries taskId', r.task_id === task.id, `got ${r.task_id}`);
    check('review carries runTraceId = the run trace', r.run_trace === traceId, `got ${r.run_trace} vs ${traceId}`);
    check('review event trace_id is its OWN (not the run trace) → keeps its own feed row', r.ev_trace !== traceId, `ev_trace=${r.ev_trace}`);

    // The actual join: review → run via runTraceId = autonomy_runs.trace_id.
    const joined = await pool.query(
      `select r.trace_id, r.created_at, r.root_goal from autonomy_runs r
       where r.trace_id = (select (payload->>'runTraceId') from autonomy_events where event_type='peer_review_feedback' and payload->>'taskId' = $1 order by timestamp desc limit 1)`, [task.id]);
    check('review JOINS to its run via runTraceId', joined.rows.length === 1, `rows=${joined.rows.length}`);
    if (joined.rows.length) {
      const skewH = Math.abs(new Date(r.ev_ts).getTime() - new Date(joined.rows[0].created_at).getTime()) / 3.6e6;
      check('R2: review↔run timestamps are seconds apart, not ~9h (skew was a wrong-pair artifact)', skewH < 0.2, `skew=${skewH.toFixed(3)}h`);
      console.log(`    run goal="${joined.rows[0].root_goal}"  review=${new Date(r.ev_ts).toISOString()}  run=${new Date(joined.rows[0].created_at).toISOString()}`);
    }
  }

  console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} — ${pass} passed, ${fail} failed`);
  await pool.end();
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
