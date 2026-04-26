// Phase 22 Wave 0: Concurrency proof for atomic budget enforcement.
// Run: npx tsx scripts/test-budget-race.ts
//
// This test is the empirical proof that the conditional upsert closes the
// check-then-act race. If it fails, BUDG-01 is not satisfied.

import assert from 'node:assert/strict';
import { reserveBudgetSlot } from '../server/autonomy/execution/budgetLedger.js';
import { pool } from '../server/db.js';

const TEST_PROJECT_PREFIX = 'test-budget-race-';
const today = new Date().toISOString().slice(0, 10);

async function setupTestProject(): Promise<string> {
  const suffix = Date.now();
  const userId = `${TEST_PROJECT_PREFIX}user-${suffix}`;
  const projectId = `${TEST_PROJECT_PREFIX}${suffix}`;
  await pool.query(
    `INSERT INTO users (id, email, name, provider_sub) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING`,
    [userId, `${userId}@test.local`, 'Test', userId],
  );
  await pool.query(
    `INSERT INTO projects (id, user_id, name) VALUES ($1, $2, $3)`,
    [projectId, userId, 'Race Test'],
  );
  return projectId;
}

async function cleanup(): Promise<void> {
  await pool.query(`DELETE FROM autonomy_daily_counters WHERE project_id LIKE $1`, [`${TEST_PROJECT_PREFIX}%`]);
  await pool.query(`DELETE FROM projects WHERE id LIKE $1`, [`${TEST_PROJECT_PREFIX}%`]);
  await pool.query(`DELETE FROM users WHERE id LIKE $1`, [`${TEST_PROJECT_PREFIX}user-%`]);
}

async function main(): Promise<void> {
  try {
    await cleanup();
    const projectId = await setupTestProject();
    const LIMIT = 5;
    const CONCURRENT = 10;

    // Fire all 10 reservations in parallel.
    const results = await Promise.all(
      Array.from({ length: CONCURRENT }, () => reserveBudgetSlot(projectId, today, LIMIT)),
    );
    const succeeded = results.filter((x) => x === true).length;
    const failed = results.filter((x) => x === false).length;

    console.log(`Concurrent reservations: ${CONCURRENT}, limit=${LIMIT}`);
    console.log(`Succeeded: ${succeeded}, Failed: ${failed}`);

    assert.equal(succeeded, LIMIT, `RACE FAIL: expected exactly ${LIMIT} succeed, got ${succeeded}`);
    assert.equal(failed, CONCURRENT - LIMIT, `RACE FAIL: expected exactly ${CONCURRENT - LIMIT} fail, got ${failed}`);

    // Verify ledger row reflects exactly K reservations
    const r = await pool.query<{ reserved_count: number }>(
      `SELECT reserved_count FROM autonomy_daily_counters WHERE project_id = $1 AND date = $2`,
      [projectId, today],
    );
    assert.equal(r.rows[0]?.reserved_count, LIMIT, `LEDGER FAIL: reserved_count should be ${LIMIT}, got ${r.rows[0]?.reserved_count}`);

    console.log(`PASS: ${succeeded}/${CONCURRENT} reservations succeeded — atomic enforcement verified`);
  } finally {
    await cleanup();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
