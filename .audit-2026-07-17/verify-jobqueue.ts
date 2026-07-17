/**
 * Wave 1 GREEN check for #95: prove getJobQueue() now creates the pg-boss queue.
 * Run: node --env-file=.env --import tsx .audit-2026-07-17/verify-jobqueue.ts
 * RED (pre-fix): queue absent, boss.send returns null. GREEN (post-fix): queue present.
 */
import { getJobQueue, stopJobQueue, QUEUE_TASK_EXECUTION } from '../server/autonomy/execution/jobQueue.js';
import pg from 'pg';

async function main() {
  const boss = await getJobQueue();
  if (!boss) {
    console.error('FAIL: getJobQueue() returned null (BACKGROUND_AUTONOMY_ENABLED not true?)');
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const { rows } = await pool.query('SELECT name FROM pgboss.queue ORDER BY name');
  const names = rows.map((r: { name: string }) => r.name);
  console.log('QUEUES:', JSON.stringify(names));

  // Also prove send() now enqueues (returns a non-null jobId) instead of the silent no-op.
  const jobId = await boss.send(QUEUE_TASK_EXECUTION, { probe: true }, { singletonKey: 'wave1-verify-probe' });
  console.log('send() jobId:', jobId);

  await pool.end();
  await stopJobQueue();

  const queueExists = names.includes(QUEUE_TASK_EXECUTION);
  if (!queueExists) {
    console.error(`FAIL: queue "${QUEUE_TASK_EXECUTION}" was not created`);
    process.exit(1);
  }
  if (!jobId) {
    console.error('FAIL: send() returned null — enqueue still no-ops');
    process.exit(1);
  }
  console.log(`PASS: queue "${QUEUE_TASK_EXECUTION}" exists and send() enqueued job ${jobId}`);
}

main().catch((e) => {
  console.error('ERR', e);
  process.exit(1);
});
