// Phase 22: Atomic budget ledger primitives.
//
// Closes the check-then-act race in taskExecutionPipeline.ts:543-560 by performing
// the budget gate as a single atomic SQL statement. PostgreSQL's
// `INSERT...ON CONFLICT...WHERE reserved_count < limit_count RETURNING` is fully
// serializable — if N concurrent calls race for the last K slots, exactly K
// return true and N-K return false.
//
// Drizzle 0.39.1 does not support a WHERE predicate on the DO UPDATE clause,
// so we use raw pool.query — same precedent as upsertDailyUsage in storage.ts.

/**
 * Atomically reserve one budget slot for the given project and date.
 * Returns true if the slot was reserved (caller may proceed),
 * false if the daily budget is exhausted (caller must block).
 *
 * Concurrency guarantee: 10 concurrent calls at limit=5 → exactly 5 return true.
 */
export async function reserveBudgetSlot(
  projectId: string,
  date: string,         // 'YYYY-MM-DD'
  limit: number,
): Promise<boolean> {
  const { pool } = await import('../../db.js');
  const result = await pool.query<{ id: string }>(
    `INSERT INTO autonomy_daily_counters (project_id, date, reserved_count, limit_count)
     VALUES ($1, $2, 1, $3)
     ON CONFLICT (project_id, date) DO UPDATE
       SET reserved_count = autonomy_daily_counters.reserved_count + 1,
           updated_at = NOW()
     WHERE autonomy_daily_counters.reserved_count < autonomy_daily_counters.limit_count
     RETURNING id`,
    [projectId, date, limit],
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Release one budget slot. Called from a finally block in the pipeline so it
 * fires on success, failure, and thrown errors alike. Uses GREATEST(reserved-1, 0)
 * so double-release calls are no-ops (cannot drive count below 0).
 *
 * Note: This is not strictly idempotent — calling release twice for the same task
 * is a theoretical over-release. Phase 22 scope prioritizes preventing
 * over-consumption (BUDG-01) over preventing over-release; the daily reconciliation
 * job (plan 03) detects and corrects any persistent drift (BUDG-03).
 */
export async function releaseBudgetSlot(
  projectId: string,
  date: string,
): Promise<void> {
  const { pool } = await import('../../db.js');
  await pool.query(
    `UPDATE autonomy_daily_counters
     SET reserved_count = GREATEST(reserved_count - 1, 0),
         updated_at = NOW()
     WHERE project_id = $1 AND date = $2`,
    [projectId, date],
  );
}
