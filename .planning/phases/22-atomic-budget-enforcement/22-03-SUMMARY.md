---
phase: 22-atomic-budget-enforcement
plan: 03
subsystem: autonomy-background
tags: [postgres, neon, budget, reconciliation, cron, drift-detection, autonomy]

# Dependency graph
requires:
  - "22-01: autonomy_daily_counters table + budgetLedger.ts"
  - "22-02: pipeline rewire (consumes ledger; reconciliation corrects any drift the pipeline creates)"
provides:
  - "runDailyReconciliation() function in budgetReconciliation.ts"
  - "Cron registered in backgroundRunner.start() at 5 0 * * * UTC"
  - "runReconciliationNow() manual trigger on backgroundRunner"
  - "Wave 0 test proving drift detection and correction semantics"
affects:
  - "backgroundRunner.ts (new cron registration)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Daily reconciliation: SELECT all ledger rows for today, compare to authoritative event count, warn + self-correct when drift > threshold"
    - "Strict > threshold check (not >=): Math.abs(drift) > RECONCILIATION_DRIFT_THRESHOLD preserves tolerance for in-flight tasks"
    - "Type-only IStorage import in reconciliation module — prevents circular dep risk while maintaining test-injectability"
    - "DatabaseStorage instantiated directly in test script — avoids STORAGE_MODE env var dependency in CI"

key-files:
  created:
    - server/autonomy/background/budgetReconciliation.ts
    - scripts/test-budget-reconcile.ts
  modified:
    - server/autonomy/background/backgroundRunner.ts

key-decisions:
  - "Drift threshold = 2: tolerates small in-flight discrepancies (a task mid-execution has a reservation but no event yet). Strict > check means exactly-2 drift is NOT corrected."
  - "No feature flag on reconciliation cron: the function is a safe no-op when ledger has no rows; always running ensures BUDG-03 is satisfied without configuration drift"
  - "runDailyReconciliation takes storage: IStorage parameter (injected, not imported singleton) — matches backgroundRunner injection pattern and enables test isolation"
  - "Test uses DatabaseStorage directly (not storage singleton) — avoids STORAGE_MODE=db env dependency while using real authoritative count implementation"

requirements-completed: [BUDG-03]

# Metrics
duration: ~4min
completed: 2026-04-26
---

# Phase 22 Plan 03: Daily Budget Reconciliation Summary

**Daily cron at 00:05 UTC scans all autonomy_daily_counters ledger rows for today, detects drift > 2 vs authoritative event count, logs warnings and self-corrects — closes BUDG-03**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-26T06:04:42Z
- **Completed:** 2026-04-26T06:08:10Z
- **Tasks:** 3
- **Files modified:** 3 (1 new module, 1 new test script, 1 modified backgroundRunner)

## Accomplishments

- `budgetReconciliation.ts` exports `runDailyReconciliation(storage: IStorage): Promise<ReconciliationResult>` — queries all ledger rows for today, computes drift against authoritative `countAutonomyEventsForProjectToday`, warns and corrects when `Math.abs(drift) > 2`
- `backgroundRunner.ts` registers a daily cron at `'5 0 * * *'` UTC (00:05 daily) — no feature flag, always active, safe no-op when empty
- `runReconciliationNow()` method added to `backgroundRunner` for manual invocation in tests or debugging
- Wave 0 test passes all 3 drift scenarios: large drift corrected, no-drift row untouched, at-threshold row untouched (strict `>` verified)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create budgetReconciliation.ts** — `28af72f` (feat)
2. **Task 2: Wire into backgroundRunner cron at 5 0 * * * UTC** — `5a421c4` (feat)
3. **Task 3: Wave 0 test scripts/test-budget-reconcile.ts** — `44d0584` (test)

## Files Created/Modified

- `server/autonomy/background/budgetReconciliation.ts` — New module: `runDailyReconciliation(storage)`, `RECONCILIATION_DRIFT_THRESHOLD = 2`, `ReconciliationResult` interface
- `server/autonomy/background/backgroundRunner.ts` — Added import, cron registration at `'5 0 * * *'` UTC, `runReconciliationNow()` method, updated startup log
- `scripts/test-budget-reconcile.ts` — Wave 0 test: 3 drift scenarios, `DatabaseStorage` direct instantiation, asserts correction and non-correction semantics

## Reconciliation Logic

The reconciliation function:
1. Computes today's date as `'YYYY-MM-DD'` UTC
2. Queries all rows in `autonomy_daily_counters WHERE date = today` via `pool.query`
3. For each row: calls `storage.countAutonomyEventsForProjectToday(projectId, today)` (authoritative count)
4. Computes `drift = reserved_count - actualCount`
5. If `Math.abs(drift) > RECONCILIATION_DRIFT_THRESHOLD` (2): logs `console.warn` + `UPDATE autonomy_daily_counters SET reserved_count = actualCount`
6. Returns `{ rowsChecked, rowsWithDrift, rowsCorrected }`

**Cron schedule:** `'5 0 * * *'` UTC — 00:05 daily (5 minutes after midnight, after any in-flight jobs at day boundary finish)

## Wave 0 Test Results

```
Test threshold (drift must exceed 2 to trigger correction)
[BudgetReconciliation] Drift detected for project test-budget-reconcile-drift-large-*: reserved=10, actual=5, drift=5 (threshold=2)
[BudgetReconciliation] Complete: checked=3, drift=1, corrected=1
Result: { rowsChecked: 3, rowsWithDrift: 1, rowsCorrected: 1 }
PASS: Test 1 — drift=5 row corrected from 10 to 5
PASS: Test 2 — drift=0 row left untouched at 4
PASS: Test 3 — drift=threshold row left untouched at 6

ALL RECONCILIATION TESTS PASSED
```

**Strict `>` threshold semantics confirmed:**
- Test 1 (drift=5, threshold=2): `Math.abs(5) > 2` → TRUE → corrected from 10 to 5
- Test 2 (drift=0): `Math.abs(0) > 2` → FALSE → untouched
- Test 3 (drift=2, exactly threshold): `Math.abs(2) > 2` → FALSE → untouched

## Decisions Made

- **Drift threshold = 2**: Tolerates in-flight tasks (a task mid-execution has a reservation but no logged event). Strict `>` means exactly-at-threshold drift is not corrected — appropriate for normal execution overlap
- **No feature flag**: Reconciliation is a maintenance job, not a product feature. It's safe to always run — empty ledger = 0 rows scanned = no cost
- **IStorage injection pattern**: Matches backgroundRunner's existing storage injection pattern; enables test isolation without environment variables
- **DatabaseStorage direct instantiation in test**: Avoids requiring `STORAGE_MODE=db` env var; more explicit about test requirements

## BUDG-03 Closure

BUDG-03 is now satisfied:
- A daily reconciliation job runs at 00:05 UTC (registered in `backgroundRunner.start()`)
- It inspects every row in `autonomy_daily_counters` for the current date
- When drift exceeds threshold, a warning is logged AND the ledger is corrected to match the authoritative event count
- No project can become permanently locked out by ledger drift
- The test script can be invoked manually via `npx tsx scripts/test-budget-reconcile.ts`

## Deviations from Plan

**1. [Rule 1 - Bug] Used DatabaseStorage directly instead of storage singleton in test**

- **Found during:** Task 3 — test ran with MemStorage because `STORAGE_MODE` defaults to `memory`
- **Issue:** `storage` singleton uses MemStorage when `STORAGE_MODE` env is unset; `countAutonomyEventsForProjectToday` in MemStorage always returns 0, so all drift detection was against 0 not the seeded events
- **Fix:** Import `DatabaseStorage` class and instantiate directly in test script — avoids env var dependency and is more explicit about test requirements
- **Files modified:** `scripts/test-budget-reconcile.ts`

## Self-Check: PASSED

- budgetReconciliation.ts: FOUND
- test-budget-reconcile.ts: FOUND
- 22-03-SUMMARY.md: FOUND
- Commit 28af72f (Task 1): FOUND
- Commit 5a421c4 (Task 2): FOUND
- Commit 44d0584 (Task 3): FOUND
