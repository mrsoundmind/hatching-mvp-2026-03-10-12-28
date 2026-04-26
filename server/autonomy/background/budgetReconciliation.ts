// Phase 22: Daily reconciliation — closes BUDG-03.
//
// Detects drift between autonomy_daily_counters.reserved_count and the
// authoritative count of autonomous_task_execution events. Warns + self-corrects
// when drift exceeds threshold. Runs at 00:05 UTC daily via backgroundRunner.

import type { IStorage } from '../../storage.js';

/**
 * Drift threshold (in slots) above which reconciliation logs a warning AND
 * corrects the ledger. Set to 2 to tolerate small in-flight discrepancies
 * (a task in mid-execution may have a reservation but no event yet).
 */
export const RECONCILIATION_DRIFT_THRESHOLD = 2;

export interface ReconciliationResult {
  rowsChecked: number;
  rowsWithDrift: number;
  rowsCorrected: number;
}

/**
 * Reconcile all autonomy_daily_counters rows for the current UTC date.
 * Storage is passed in (matches backgroundRunner injection pattern) so the
 * function is testable with a fixture storage if ever needed; the production
 * call passes the real DatabaseStorage.
 */
export async function runDailyReconciliation(
  storage: IStorage,
): Promise<ReconciliationResult> {
  const { pool } = await import('../../db.js');
  const today = new Date().toISOString().slice(0, 10);

  const ledgerRows = await pool.query<{ project_id: string; reserved_count: number }>(
    `SELECT project_id, reserved_count
     FROM autonomy_daily_counters
     WHERE date = $1`,
    [today],
  );

  let rowsWithDrift = 0;
  let rowsCorrected = 0;

  for (const row of ledgerRows.rows) {
    const actualCount = await storage.countAutonomyEventsForProjectToday(row.project_id, today);
    const drift = row.reserved_count - actualCount;

    if (Math.abs(drift) > RECONCILIATION_DRIFT_THRESHOLD) {
      rowsWithDrift++;
      console.warn(
        `[BudgetReconciliation] Drift detected for project ${row.project_id}: reserved=${row.reserved_count}, actual=${actualCount}, drift=${drift} (threshold=${RECONCILIATION_DRIFT_THRESHOLD})`,
      );
      // Self-correct: align ledger to authoritative event count
      await pool.query(
        `UPDATE autonomy_daily_counters
         SET reserved_count = $1, updated_at = NOW()
         WHERE project_id = $2 AND date = $3`,
        [actualCount, row.project_id, today],
      );
      rowsCorrected++;
    }
  }

  const result: ReconciliationResult = {
    rowsChecked: ledgerRows.rows.length,
    rowsWithDrift,
    rowsCorrected,
  };

  console.log(
    `[BudgetReconciliation] Complete: checked=${result.rowsChecked}, drift=${result.rowsWithDrift}, corrected=${result.rowsCorrected}`,
  );
  return result;
}
