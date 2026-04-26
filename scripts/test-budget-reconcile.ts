// Phase 22 Wave 0: Reconciliation drift test for BUDG-03.
// Run: npx tsx scripts/test-budget-reconcile.ts
//
// Seeds artificial drift between autonomy_daily_counters and autonomy_events,
// runs runDailyReconciliation, asserts drift is detected and corrected.

import assert from 'node:assert/strict';
import { runDailyReconciliation, RECONCILIATION_DRIFT_THRESHOLD } from '../server/autonomy/background/budgetReconciliation.js';
import { DatabaseStorage } from '../server/storage.js';
import { pool } from '../server/db.js';

// Use DatabaseStorage directly — requires DATABASE_URL and a real Neon DB connection.
// The reconciliation function must use the authoritative countAutonomyEventsForProjectToday
// which only returns real data from DatabaseStorage (MemStorage always returns 0).
const storage = new DatabaseStorage();

const TEST_PROJECT_PREFIX = 'test-budget-reconcile-';
const today = new Date().toISOString().slice(0, 10);

async function setupProject(suffix: string): Promise<string> {
  const userId = `${TEST_PROJECT_PREFIX}user-${suffix}-${Date.now()}`;
  const projectId = `${TEST_PROJECT_PREFIX}${suffix}-${Date.now()}`;
  await pool.query(
    `INSERT INTO users (id, email, name, provider_sub) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING`,
    [userId, `${userId}@test.local`, 'Test', userId],
  );
  await pool.query(
    `INSERT INTO projects (id, user_id, name) VALUES ($1, $2, $3)`,
    [projectId, userId, 'Reconcile Test'],
  );
  return projectId;
}

async function seedLedger(projectId: string, reservedCount: number): Promise<void> {
  await pool.query(
    `INSERT INTO autonomy_daily_counters (project_id, date, reserved_count, limit_count)
     VALUES ($1, $2, $3, 50)
     ON CONFLICT (project_id, date) DO UPDATE SET reserved_count = $3`,
    [projectId, today, reservedCount],
  );
}

async function seedEvents(projectId: string, eventCount: number): Promise<void> {
  // Insert N rows of type 'autonomous_task_execution' for today
  // Use a representative payload shape; only project_id, event_type, timestamp matter for the count
  for (let i = 0; i < eventCount; i++) {
    const traceId = `reconcile-test-${projectId}-${i}-${Date.now()}`;
    await pool.query(
      `INSERT INTO autonomy_events (id, trace_id, turn_id, request_id, project_id, conversation_id, event_type, payload, timestamp)
       VALUES (gen_random_uuid(), $1, $1, $1, $2, $3, 'autonomous_task_execution', '{}'::jsonb, NOW())`,
      [traceId, projectId, `project:${projectId}`],
    );
  }
}

async function getLedgerCount(projectId: string): Promise<number> {
  const r = await pool.query<{ reserved_count: number }>(
    `SELECT reserved_count FROM autonomy_daily_counters WHERE project_id = $1 AND date = $2`,
    [projectId, today],
  );
  return r.rows[0]?.reserved_count ?? -1;
}

async function cleanup(): Promise<void> {
  await pool.query(`DELETE FROM autonomy_daily_counters WHERE project_id LIKE $1`, [`${TEST_PROJECT_PREFIX}%`]);
  await pool.query(`DELETE FROM autonomy_events WHERE project_id LIKE $1`, [`${TEST_PROJECT_PREFIX}%`]);
  await pool.query(`DELETE FROM projects WHERE id LIKE $1`, [`${TEST_PROJECT_PREFIX}%`]);
  await pool.query(`DELETE FROM users WHERE id LIKE $1`, [`${TEST_PROJECT_PREFIX}user-%`]);
}

async function main(): Promise<void> {
  try {
    await cleanup();
    console.log(`Test threshold (drift must exceed ${RECONCILIATION_DRIFT_THRESHOLD} to trigger correction)`);

    // Test 1: Drift > threshold → correction fires
    const p1 = await setupProject('drift-large');
    await seedLedger(p1, 10);     // ledger says 10
    await seedEvents(p1, 5);       // reality is 5
    // drift = 10 - 5 = 5, > threshold 2

    // Test 2: No drift → no correction
    const p2 = await setupProject('no-drift');
    await seedLedger(p2, 4);
    await seedEvents(p2, 4);
    // drift = 0

    // Test 3: Drift exactly equal to threshold → NOT corrected (rule is `>`, not `>=`)
    const p3 = await setupProject('drift-at-threshold');
    await seedLedger(p3, 6);
    await seedEvents(p3, 4);
    // drift = 2 = threshold; Math.abs(2) > 2 is false

    const result = await runDailyReconciliation(storage);
    console.log('Result:', result);

    // Verify
    assert.ok(result.rowsChecked >= 3, `Expected to check at least 3 rows, got ${result.rowsChecked}`);
    assert.ok(result.rowsWithDrift >= 1, `Expected at least 1 row with drift, got ${result.rowsWithDrift}`);
    assert.ok(result.rowsCorrected >= 1, `Expected at least 1 row corrected, got ${result.rowsCorrected}`);

    const p1Final = await getLedgerCount(p1);
    assert.equal(p1Final, 5, `Test 1 FAIL: p1 ledger should be corrected to 5, got ${p1Final}`);
    console.log(`PASS: Test 1 — drift=5 row corrected from 10 to ${p1Final}`);

    const p2Final = await getLedgerCount(p2);
    assert.equal(p2Final, 4, `Test 2 FAIL: p2 ledger should remain 4 (no drift), got ${p2Final}`);
    console.log(`PASS: Test 2 — drift=0 row left untouched at ${p2Final}`);

    const p3Final = await getLedgerCount(p3);
    assert.equal(p3Final, 6, `Test 3 FAIL: p3 ledger drift=2 (=threshold) must NOT be corrected, got ${p3Final}`);
    console.log(`PASS: Test 3 — drift=threshold row left untouched at ${p3Final}`);

    console.log('\nALL RECONCILIATION TESTS PASSED');
  } finally {
    await cleanup();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
