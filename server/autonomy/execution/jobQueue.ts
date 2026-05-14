import PgBoss from 'pg-boss';
import { FEATURE_FLAGS } from '../config/policies.js';

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

  const jobId = await boss.send('autonomous_task_execution', data, {
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
