// Phase 22 Wave 0: Unit tests for budget ledger primitives.
// Run: npx tsx scripts/test-budget-storage.ts
//
// Requires DATABASE_URL pointing to a real Postgres (Neon). Uses test project IDs
// prefixed 'test-budget-storage-' which are cleaned up at end of run.

import assert from 'node:assert/strict';
import { reserveBudgetSlot, releaseBudgetSlot } from '../server/autonomy/execution/budgetLedger.js';
import { pool } from '../server/db.js';

const TEST_PROJECT_PREFIX = 'test-budget-storage-';
const today = new Date().toISOString().slice(0, 10);

// The autonomy_daily_counters.project_id has a foreign key to projects.id with ON DELETE CASCADE.
// For tests we need a real project row; insert a minimal stub and reuse its id.
async function setupTestProject(suffix: string): Promise<string> {
  const timestamp = Date.now();
  const projectId = `${TEST_PROJECT_PREFIX}${suffix}-${timestamp}`;
  // Create a minimal user + project row to satisfy FK
  const userId = `${TEST_PROJECT_PREFIX}user-${suffix}-${timestamp}`;
  await pool.query(
    `INSERT INTO users (id, email, name, provider_sub) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING`,
    [userId, `${userId}@test.local`, 'Test User', userId],
  );
  await pool.query(
    `INSERT INTO projects (id, user_id, name) VALUES ($1, $2, $3)`,
    [projectId, userId, 'Test Budget Project'],
  );
  return projectId;
}

async function cleanup(): Promise<void> {
  await pool.query(`DELETE FROM autonomy_daily_counters WHERE project_id LIKE $1`, [`${TEST_PROJECT_PREFIX}%`]);
  await pool.query(`DELETE FROM projects WHERE id LIKE $1`, [`${TEST_PROJECT_PREFIX}%`]);
  await pool.query(`DELETE FROM users WHERE id LIKE $1`, [`${TEST_PROJECT_PREFIX}user-%`]);
}

async function getCount(projectId: string): Promise<number> {
  const r = await pool.query<{ reserved_count: number }>(
    `SELECT reserved_count FROM autonomy_daily_counters WHERE project_id = $1 AND date = $2`,
    [projectId, today],
  );
  return r.rows[0]?.reserved_count ?? 0;
}

async function main(): Promise<void> {
  try {
    await cleanup();

    // Test 1: First reservation inserts row with reserved_count=1
    const p1 = await setupTestProject('t1');
    const r1 = await reserveBudgetSlot(p1, today, 5);
    assert.equal(r1, true, 'Test 1 FAIL: first reservation should return true');
    assert.equal(await getCount(p1), 1, 'Test 1 FAIL: reserved_count should be 1 after first reserve');
    console.log('PASS: Test 1 — first reservation inserts row');

    // Test 2: Reservations succeed until limit, then fail
    const p2 = await setupTestProject('t2');
    for (let i = 1; i <= 5; i++) {
      const ok = await reserveBudgetSlot(p2, today, 5);
      assert.equal(ok, true, `Test 2 FAIL: reservation #${i} of 5 should succeed`);
    }
    const overLimit = await reserveBudgetSlot(p2, today, 5);
    assert.equal(overLimit, false, 'Test 2 FAIL: 6th reservation at limit=5 must return false');
    assert.equal(await getCount(p2), 5, 'Test 2 FAIL: reserved_count should cap at 5');
    console.log('PASS: Test 2 — reservations cap at limit_count');

    // Test 3: releaseBudgetSlot decrements
    const p3 = await setupTestProject('t3');
    await reserveBudgetSlot(p3, today, 5);
    await reserveBudgetSlot(p3, today, 5);  // count=2
    await releaseBudgetSlot(p3, today);
    assert.equal(await getCount(p3), 1, 'Test 3 FAIL: release should decrement count to 1');
    console.log('PASS: Test 3 — release decrements');

    // Test 4: Release when count=0 stays at 0 (GREATEST protection — no negative count)
    const p4 = await setupTestProject('t4');
    await reserveBudgetSlot(p4, today, 5);
    await releaseBudgetSlot(p4, today);   // count=0
    await releaseBudgetSlot(p4, today);   // would go below 0 without GREATEST
    await releaseBudgetSlot(p4, today);
    assert.equal(await getCount(p4), 0, 'Test 4 FAIL: count should never go below 0');
    console.log('PASS: Test 4 — GREATEST prevents negative count');

    console.log('\nALL UNIT TESTS PASSED');
  } finally {
    await cleanup();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
