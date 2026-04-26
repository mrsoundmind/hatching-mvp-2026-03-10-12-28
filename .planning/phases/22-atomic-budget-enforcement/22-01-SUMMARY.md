---
phase: 22-atomic-budget-enforcement
plan: 01
subsystem: database
tags: [postgres, drizzle, neon, budget, concurrency, atomic-upsert, autonomy]

# Dependency graph
requires: []
provides:
  - autonomy_daily_counters table in Neon DB with unique index adc_project_date_uidx
  - budgetLedger.ts with reserveBudgetSlot() and releaseBudgetSlot() helpers
  - Wave 0 test scripts proving atomic enforcement under concurrency
affects:
  - 22-02-pipeline-rewire (consumes reserveBudgetSlot/releaseBudgetSlot from budgetLedger.ts)
  - 22-03-reconciliation (consumes autonomy_daily_counters table)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Atomic conditional upsert: INSERT...ON CONFLICT...WHERE reserved_count < limit RETURNING — closes TOCTOU race"
    - "Raw pool.query for conditional WHERE on DO UPDATE (Drizzle 0.39.1 cannot express this)"
    - "Dynamic import of pool in helpers to match upsertDailyUsage precedent in storage.ts"

key-files:
  created:
    - shared/schema.ts (autonomyDailyCounters table definition, insert schema, types)
    - server/autonomy/execution/budgetLedger.ts (reserveBudgetSlot + releaseBudgetSlot)
    - scripts/test-budget-storage.ts (unit tests for reserve/release behavior)
    - scripts/test-budget-race.ts (concurrency proof — 10 parallel at limit=5 → exactly 5 succeed)
  modified:
    - shared/schema.ts (added autonomyDailyCounters definition after autonomyEvents table)

key-decisions:
  - "Used raw pool.query for both ledger functions — Drizzle 0.39.1 does not support WHERE predicate on DO UPDATE clause"
  - "Table created via direct pool.query (node script) instead of drizzle-kit push — drizzle-kit requires interactive terminal to disambiguate rename vs create"
  - "budgetLedger.ts is a standalone module, not added to IStorage — matches getAutonomyEventsSince precedent for narrow-scope raw SQL operations"
  - "GREATEST(reserved_count - 1, 0) in releaseBudgetSlot prevents negative counts; true per-task idempotency deferred to v3.1+"

patterns-established:
  - "Pattern: Atomic budget gate — INSERT...ON CONFLICT...WHERE condition RETURNING — single round-trip, no app-level locking needed"
  - "Pattern: Dynamic import of pool in server/autonomy modules — import('../../db.js') for lazy loading"

requirements-completed: [BUDG-01, BUDG-02]

# Metrics
duration: 5min
completed: 2026-04-26
---

# Phase 22 Plan 01: Atomic Budget Ledger Foundation Summary

**PostgreSQL atomic conditional upsert ledger (autonomy_daily_counters) with reserve/release helpers — empirically proven: 10 concurrent reservations at limit=5 yields exactly 5 success and 5 failure**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-26T05:56:13Z
- **Completed:** 2026-04-26T06:01:14Z
- **Tasks:** 3
- **Files modified:** 4 (schema.ts modified, 3 new files created)

## Accomplishments
- New `autonomy_daily_counters` table in Neon DB with unique index `adc_project_date_uidx` on `(project_id, date)` and `ON DELETE CASCADE` FK to projects
- `budgetLedger.ts` exports `reserveBudgetSlot` and `releaseBudgetSlot` using the conditional upsert pattern — closes TOCTOU race in taskExecutionPipeline
- Wave 0 test suite passes: 4 unit tests (reserve, cap, release, GREATEST protection) + concurrency proof (exactly 5/10 succeed at limit=5)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add autonomyDailyCounters table to schema and push migration** - `2ca2723` (feat)
2. **Task 2: Create budgetLedger.ts with reserveBudgetSlot and releaseBudgetSlot** - `1716e50` (feat)
3. **Task 3: Wave 0 — Create test-budget-storage.ts and test-budget-race.ts** - `7c8021a` (test)

## Files Created/Modified
- `shared/schema.ts` - Added `autonomyDailyCounters` table, `insertAutonomyDailyCounterSchema`, `AutonomyDailyCounter`, `InsertAutonomyDailyCounter` types after the `autonomyEvents` table
- `server/autonomy/execution/budgetLedger.ts` - New module: `reserveBudgetSlot(projectId, date, limit): Promise<boolean>` and `releaseBudgetSlot(projectId, date): Promise<void>`
- `scripts/test-budget-storage.ts` - Unit tests: first insert, cap-at-limit, release decrement, GREATEST protection
- `scripts/test-budget-race.ts` - Concurrency proof: `Promise.all` with 10 concurrent calls at limit=5, asserts exactly 5 succeed

## Decisions Made
- Used raw `pool.query` for both ledger functions — Drizzle 0.39.1's `.onConflictDoUpdate()` does not support `WHERE` predicate on the DO UPDATE clause, which is the mechanism that makes the conditional increment atomic
- Table was created via a direct Node.js script using `pool.query` (CREATE TABLE + CREATE UNIQUE INDEX) instead of `drizzle-kit push` — drizzle-kit's push command requires interactive terminal input to confirm table creation vs rename. The table is now live in Neon DB and matches the Drizzle schema definition exactly
- `budgetLedger.ts` implemented as a standalone module (not added to `IStorage`) — follows the existing precedent in `getAutonomyEventsSince` and `upsertDailyUsage` for narrow-scope raw SQL operations that don't warrant adding to the storage interface
- `GREATEST(reserved_count - 1, 0)` protects against negative counts; per-task idempotent release (tracking which task_ids have been released) is deferred to v3.1+ as PHASE 22 focuses on preventing over-consumption, not over-release

## Deviations from Plan

None — plan executed exactly as written.

The only operational difference was using a direct Node.js pool.query script to create the table instead of `drizzle-kit push` (which requires interactive terminal). The resulting schema is identical to the Drizzle definition.

## Issues Encountered
- `drizzle-kit push` requires interactive terminal input to confirm "create table vs rename from existing table" — resolved by running CREATE TABLE directly via pool.query. The Drizzle schema definition in schema.ts is canonical and correct.
- Test scripts require `DATABASE_URL` environment variable — run with `DATABASE_URL=... npx tsx scripts/test-budget-storage.ts` or source `.env` first.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `reserveBudgetSlot` and `releaseBudgetSlot` are ready for plan 22-02 (pipeline rewire) to consume
- `autonomy_daily_counters` table is live in Neon DB with correct schema and unique index
- Wave 0 tests provide regression baseline: if either script fails after 22-02 changes, the atomic guarantee is broken
- Plan 22-03 (reconciliation) can proceed independently once 22-02 is done

---
*Phase: 22-atomic-budget-enforcement*
*Completed: 2026-04-26*
