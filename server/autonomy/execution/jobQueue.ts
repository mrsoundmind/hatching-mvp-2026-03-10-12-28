import PgBoss from 'pg-boss';
import { FEATURE_FLAGS } from '../config/policies.js';

/**
 * Canonical pg-boss queue name for autonomous task execution. Single source of truth shared by
 * createQueue (here), send (queueTaskExecution below), and work (taskExecutionPipeline.startTaskWorker).
 * A mismatch between any two silently breaks execution: send/work no-op against a queue that does not
 * exist. Keeping one constant removes that failure mode.
 */
export const QUEUE_TASK_EXECUTION = 'autonomous_task_execution';

let _boss: PgBoss | null = null;

/**
 * Returns the singleton pg-boss instance, or null if the backgroundExecution
 * feature flag is disabled. Starts the boss on first call.
 *
 * NOTE: pg-boss uses the standard `pg` driver internally against DATABASE_URL.
 * This is intentional — the Neon serverless driver continues to power Drizzle ORM.
 * pg-boss manages its own `pgboss.*` schema on first `.start()`.
 */
export async function getJobQueue(): Promise<PgBoss | null> {
  if (!FEATURE_FLAGS.backgroundExecution) {
    return null;
  }

  if (_boss) {
    return _boss;
  }

  _boss = new PgBoss(process.env.DATABASE_URL!);
  _boss.on('error', (err) => {
    console.error('[Hatchin][JobQueue] pg-boss error (non-fatal):', err);
  });
  await _boss.start();

  // pg-boss v10 requires an explicit createQueue() before send()/work() — a breaking change from v9,
  // which auto-created queues on first use. Without this, boss.send() silently no-ops (its INSERT joins
  // the queue table, which yields zero rows for a non-existent queue) so the worker never receives jobs
  // and the "Team is working…" banner never clears. create_queue() is ON CONFLICT DO NOTHING, so this is
  // idempotent and safe on every boot. Created in the singleton factory so the queue exists for ALL
  // producers (chat trigger, backgroundRunner, handoff), not just the worker boot path.
  await _boss.createQueue(QUEUE_TASK_EXECUTION);

  return _boss;
}

/**
 * Enqueues a task execution job. Uses singletonKey to deduplicate — a task
 * already queued or in-flight will not be re-queued.
 *
 * Returns the job ID on success, or null if the queue is unavailable.
 */
export async function queueTaskExecution(data: {
  taskId: string;
  projectId: string;
  agentId: string;
  traceId?: string;       // NEW (Phase 37) — survives pg-boss process boundary; AsyncLocalStorage cannot
  parentStepId?: string;  // NEW (Phase 37) — handoff step id; null/undefined for run roots
}): Promise<string | null> {
  const boss = await getJobQueue();
  if (!boss) {
    return null;
  }

  const jobId = await boss.send(QUEUE_TASK_EXECUTION, data, {
    retryLimit: 3,
    retryDelay: 30,
    expireInMinutes: 30,
    singletonKey: data.taskId,
  });

  return jobId;
}

/**
 * Gracefully shuts down the pg-boss instance.
 * Should be called on server shutdown.
 */
export async function stopJobQueue(): Promise<void> {
  await _boss?.stop();
  _boss = null;
}
