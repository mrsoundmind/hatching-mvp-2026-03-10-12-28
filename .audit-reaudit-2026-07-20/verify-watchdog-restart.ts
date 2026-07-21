/**
 * Exercises restartJobQueue() — the mechanism the watchdog calls on a detected stall.
 * A restart must (a) not throw, (b) leave the queue functional: a fresh boss can still enqueue.
 * This proves the safety net actually recovers rather than just logging.
 */
import 'dotenv/config';
import { randomUUID } from 'crypto';
import { getJobQueue, restartJobQueue, queueTaskExecution, stopJobQueue } from '../server/autonomy/execution/jobQueue.js';

let failures = 0;
const check = (l: string, c: boolean, d = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}${d ? ' : ' + d : ''}`); if (!c) failures++; };

(async () => {
  const bossBefore = await getJobQueue();
  check('boss starts', bossBefore !== null);

  const idBefore = await queueTaskExecution({ taskId: randomUUID(), projectId: randomUUID(), agentId: randomUUID(), traceId: randomUUID() });
  check('enqueue works before restart', typeof idBefore === 'string' && idBefore!.length > 0);

  await restartJobQueue();
  check('restartJobQueue() resolved without throwing', true);

  const bossAfter = await getJobQueue();
  check('a fresh boss is available after restart', bossAfter !== null);
  check('the instance was actually replaced', bossAfter !== bossBefore);

  const idAfter = await queueTaskExecution({ taskId: randomUUID(), projectId: randomUUID(), agentId: randomUUID(), traceId: randomUUID() });
  check('enqueue works AFTER restart (queue survived)', typeof idAfter === 'string' && idAfter!.length > 0);

  await stopJobQueue();
  console.log(failures === 0 ? '\nWATCHDOG RESTART MECHANISM VERIFIED' : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
