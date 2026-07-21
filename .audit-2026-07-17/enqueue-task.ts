/**
 * Wave 1 E2E driver: enqueue a real task-execution job via the production producer.
 * The running dev server's worker (same DB queue) should pick it up and process it.
 * Run: node --env-file=.env --import tsx .audit-2026-07-17/enqueue-task.ts <taskId> <projectId> <agentId>
 */
import { queueTaskExecution } from '../server/autonomy/execution/jobQueue.js';

async function main() {
  const [taskId, projectId, agentId] = process.argv.slice(2);
  if (!taskId || !projectId || !agentId) {
    console.error('usage: enqueue-task.ts <taskId> <projectId> <agentId>');
    process.exit(1);
  }
  const jobId = await queueTaskExecution({ taskId, projectId, agentId });
  console.log('enqueued jobId:', jobId);
  // Hard-exit rather than stopJobQueue() — the graceful boss.stop() can hang on a pooler reset,
  // and this is a one-shot producer; exiting drops the connection cleanly.
  console.log(jobId ? 'OK: job enqueued, worker should process it' : 'FAIL: queueTaskExecution returned null');
  process.exit(jobId ? 0 : 1);
}

main().catch((e) => { console.error('ERR', e); process.exit(1); });
