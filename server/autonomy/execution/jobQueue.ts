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
 * pg-boss connection config. pg-boss forwards this object verbatim to `new pg.Pool()` internally
 * (see node_modules/pg-boss/src/db.js: `this.pool = new pg.Pool(this.config)`), so every standard
 * node-postgres pool option applies to pg-boss's own pool.
 *
 * Why this exists at all: pg-boss used to be constructed from the bare connection string, giving its
 * internal pool NONE of the resilience the app pool has in db.ts. The worker loop
 * (node_modules/pg-boss/src/worker.js) is `while (!stopping) { await fetch(); ... }` and catches
 * errors to retry, so a transient blip should self-heal. It does NOT self-heal from a *hang*:
 * `fetch()` runs `pool.query()`, and with no `query_timeout` a query against a half-open Supavisor
 * socket never resolves and never rejects, so `await fetch()` blocks forever and the loop wedges.
 * The observed failure was exactly this: after a Supabase DNS/timeout blip, jobs enqueued but stayed
 * in `created` state (never fetched) on a long-running instance, and only a restart cleared it. That
 * is the intermittent "sometimes autonomy works, sometimes it vanishes" bug.
 *
 * `query_timeout` is the load-bearing line: it caps how long the client waits for any single query,
 * so a wedged fetch aborts after the timeout, the loop's existing catch handles it, and the next
 * iteration reconnects. The rest mirror db.ts so idle Supavisor drops are handled the same way.
 */
export function buildBossConfig(): Record<string, unknown> {
  return {
    connectionString: process.env.DATABASE_URL!,
    application_name: 'hatchin-pgboss', // distinguishes pg-boss connections from the app pool in Supabase
    ssl: { rejectUnauthorized: false }, // Supabase managed PG with a valid CA (same pattern as db.ts)
    max: 4, // small dedicated pool; the app pool (db.ts) is separate at max:10, so total stays well under caps
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000, // TCP keepalive detects a dead socket instead of trusting it
    idleTimeoutMillis: 30_000, // recycle before the Supavisor pooler kills an idle server connection
    connectionTimeoutMillis: 10_000, // fail fast on connect rather than hanging on a dead route
    query_timeout: 60_000, // THE fix: a fetch/maintenance query can never hang forever (see doc above)
  };
}

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

  _boss = new PgBoss(buildBossConfig() as any);
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
 * Force-recreates the pg-boss instance. Used by the worker watchdog when it detects a wedged worker
 * (jobs enqueued but not consumed) that the query_timeout self-heal did not clear.
 *
 * Nulls the singleton FIRST so the next getJobQueue() rebuilds a fresh, hardened boss even if the old
 * one's stop() hangs on a dead socket. The old instance is stopped forcefully (no graceful wait) and
 * with a hard cap, because during a wedge there are no active jobs to drain and the connection may be
 * dead. The caller re-registers the worker via startTaskWorker() after this resolves.
 */
export async function restartJobQueue(): Promise<void> {
  const old = _boss;
  _boss = null;
  if (!old) return;
  await Promise.race([
    old.stop({ graceful: false, close: true }).catch((err) => {
      console.error('[Hatchin][JobQueue] force-stop during restart failed (continuing):', (err as Error).message);
    }),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
}

/**
 * Gracefully shuts down the pg-boss instance.
 * Should be called on server shutdown.
 */
export async function stopJobQueue(): Promise<void> {
  await _boss?.stop();
  _boss = null;
}
