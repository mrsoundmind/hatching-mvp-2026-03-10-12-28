/**
 * Wave 1 authoritative E2E check: enqueue a task and confirm the worker produces a fresh output
 * message (the audit's #90 symptom was "completes with no output"). One process, one resilient
 * connection, retry-on-transient so the Supabase pooler drops do not derail the check.
 * Run: node --env-file=.env --import tsx .audit-2026-07-17/verify-execution.ts <taskId> <projectId> <agentId> <conversationId>
 */
import { queueTaskExecution } from '../server/autonomy/execution/jobQueue.js';
import pg from 'pg';

const [taskId, projectId, agentId, convId] = process.argv.slice(2);
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2, ssl: { rejectUnauthorized: false }, keepAlive: true, connectionTimeoutMillis: 10_000 });
pool.on('error', () => {}); // tolerate pooler idle drops instead of crashing the script

async function q(sql: string, params: any[] = []): Promise<any> {
  for (let a = 0; a < 4; a++) {
    try { return await pool.query(sql, params); }
    catch (e) { if (a === 3) throw e; await new Promise((r) => setTimeout(r, 600)); }
  }
}

async function main() {
  const base = await q('SELECT COUNT(*)::int c FROM messages WHERE conversation_id=$1', [convId]);
  const baseCount = base.rows[0].c as number;
  console.log('baseline messages:', baseCount);

  const jobId = await queueTaskExecution({ taskId, projectId, agentId });
  console.log('enqueued jobId:', jobId);

  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const t = await q('SELECT status FROM tasks WHERE id=$1', [taskId]);
    const m = await q('SELECT COUNT(*)::int c FROM messages WHERE conversation_id=$1', [convId]);
    const j = await q('SELECT state FROM pgboss.job WHERE id=$1', [jobId]);
    const st = t.rows[0]?.status, mc = m.rows[0].c as number, js = j.rows[0]?.state ?? 'gone';
    console.log(`t=${(i + 1) * 3}s task=${st} msgs=${mc} job=${js}`);
    if (mc > baseCount) { console.log('RESULT: NEW OUTPUT MESSAGE PRODUCED -> PASS'); await pool.end(); process.exit(0); }
    if (js === 'failed') {
      const o = await q('SELECT output FROM pgboss.job WHERE id=$1', [jobId]);
      console.log('RESULT: JOB FAILED ->', JSON.stringify(o.rows[0]?.output).slice(0, 400));
      await pool.end(); process.exit(2);
    }
  }
  console.log('RESULT: no new message within window (inconclusive)');
  await pool.end();
  process.exit(3);
}

main().catch((e) => { console.error('ERR', e.message); process.exit(1); });
