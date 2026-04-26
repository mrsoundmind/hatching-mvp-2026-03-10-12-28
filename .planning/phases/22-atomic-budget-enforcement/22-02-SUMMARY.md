---
phase: 22-atomic-budget-enforcement
plan: 02
subsystem: autonomy-pipeline
tags: [budget, atomic, toctou, pipeline-rewire, ledger, tier-limits]

# Dependency graph
requires:
  - 22-01 (autonomyDailyCounters table + budgetLedger.ts helpers)
provides:
  - handleTaskJob using reserveBudgetSlot as the single atomic budget authority
  - releaseBudgetSlot called in catch path on task failure (BUDG-02)
  - chat.ts checkForAutonomyTrigger without racy pre-check
  - backgroundRunner.ts pre-filter documented as non-authoritative
affects:
  - 22-03-reconciliation (depends on authoritative ledger being populated by this plan)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Atomic budget gate consumed at execution site — reserveBudgetSlot called before queueForBatch"
    - "Failure-only release — releaseBudgetSlot in catch block only; success path keeps slot consumed"
    - "Tier limit resolution — getUser + getTierBudgets before reserveBudgetSlot call"
    - "Project fetch moved above budget check — need userId to resolve tier"

key-files:
  modified:
    - server/autonomy/execution/taskExecutionPipeline.ts
    - server/routes/chat.ts
    - server/autonomy/background/backgroundRunner.ts
    - scripts/test-execution-pipeline.ts

key-decisions:
  - "Release on failure only (not success) — BUDG-02 wording is precise; success keeps slot consumed for the day; reconciliation corrects any drift"
  - "Project fetch moved before budget check — required to resolve tier limit (free=0, pro=50) before calling reserveBudgetSlot"
  - "BUDGETS.maxBackgroundLlmCallsPerProjectPerDay retained as fallback when user lookup fails"
  - "backgroundRunner pre-filter kept (non-authoritative) — prevents wasting pg-boss overhead when clearly over-budget"
  - "test-execution-pipeline.ts updated to create real DB project — reserveBudgetSlot bypasses mock storage, so handleTaskJob tests need a real FK-satisfying project"

requirements-completed: [BUDG-01, BUDG-02]

# Metrics
duration: ~6 min
completed: 2026-04-26
---

# Phase 22 Plan 02: Pipeline Rewire + Duplicate Check Removal Summary

**handleTaskJob now uses atomic reserveBudgetSlot as the single budget authority; racy countAutonomyEventsForProjectToday check-then-act removed from pipeline and chat.ts**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-04-26T06:04:39Z
- **Completed:** 2026-04-26T06:11:00Z
- **Tasks:** 2 (+ 1 auto-fix deviation)
- **Files modified:** 4

## Accomplishments

- `handleTaskJob` in `taskExecutionPipeline.ts` now calls `reserveBudgetSlot` atomically before any execution — closes TOCTOU race (BUDG-01)
- `releaseBudgetSlot` fires in the catch block on task failure — no permanent budget leaks (BUDG-02)
- Tier limit resolved per-call via `getUser` + `getTierBudgets` (free=0, pro=50)
- `countAutonomyEventsForProjectToday` is no longer used as a budget gate in the pipeline
- `checkForAutonomyTrigger` in `chat.ts` no longer has its own pre-queue budget check (Phase 22 success criterion #4)
- `backgroundRunner.ts` pre-filter preserved with explicit "non-authoritative" comment (Pitfall 3 per RESEARCH.md)

## Task Commits

1. **Task 1: Rewire handleTaskJob to use atomic ledger reservation** - `caa0bf5` (feat)
2. **Task 2: Remove racy budget pre-check from chat.ts; document backgroundRunner** - `32e5c17` (feat)
3. **Deviation auto-fix: Update test-execution-pipeline.ts for real DB project** - `c0a3ed0` (fix)

## Files Modified

- `server/autonomy/execution/taskExecutionPipeline.ts`
  - Lines 3-4: Added `getTierBudgets` to policies import + new `budgetLedger.js` import
  - Lines 543-586 (old 543-573): Replaced `countAutonomyEventsForProjectToday` check-then-act with project-first fetch, tier resolution, and `reserveBudgetSlot` atomic call
  - Lines 616-623: Added `releaseBudgetSlot` in catch block (failure-only release, BUDG-02)

- `server/routes/chat.ts`
  - Lines 97-99 removed: `const today`, `const todayCount`, and `if (todayCount >= BUDGETS...)` deleted from `checkForAutonomyTrigger`
  - Replaced with Phase 22 explanatory comment documenting why the check was removed

- `server/autonomy/background/backgroundRunner.ts`
  - Lines 220-224: Pre-filter code preserved unchanged; 5-line "non-authoritative" comment added above block

- `scripts/test-execution-pipeline.ts`
  - Added `setupTestProject` / `teardownTestProject` functions using real DB pool
  - Tests 4, 5, 7 updated to use `TEST_PROJECT_ID` (real DB project) so FK constraint is satisfied

## Verification Results

```
1. npm run typecheck    → PASS (0 errors)
2. test-budget-storage.ts → ALL UNIT TESTS PASSED (4/4)
3. test-budget-race.ts → PASS: 5/10 reservations succeeded — atomic enforcement verified
4. test-execution-pipeline.ts → 18 passed, 0 failed
5. test-execution-trigger.ts → all 14 tests passed
```

## Grep Confirmations

- `grep -c "reserveBudgetSlot" taskExecutionPipeline.ts` → 2 (import + call site)
- `grep -c "releaseBudgetSlot" taskExecutionPipeline.ts` → 3 (import + catch + import line)
- `grep -c "countAutonomyEventsForProjectToday" taskExecutionPipeline.ts` → 0
- `grep -c "todayCount" taskExecutionPipeline.ts` → 0
- `countAutonomyEventsForProjectToday` outside storage.ts + backgroundRunner.ts → only in `budgetReconciliation.ts` (audit use, not budget-gating)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed test-execution-pipeline.ts FK violation after pipeline rewire**
- **Found during:** Post-Task-1 verification (test-execution-pipeline.ts tests 4, 5, 7 failing)
- **Issue:** `handleTaskJob` now calls `reserveBudgetSlot` which uses raw pool.query against the real DB. Tests using fake project IDs (`project-001`) triggered FK constraint violations on `autonomy_daily_counters.project_id_fkey`
- **Fix:** Added `setupTestProject`/`teardownTestProject` helpers that create/delete a real test user+project in the DB. Tests 4, 5, 7 updated to use `TEST_PROJECT_ID` referencing the real project
- **Files modified:** `scripts/test-execution-pipeline.ts`
- **Commit:** `c0a3ed0`

## Self-Check: PASSED

Files exist:
- FOUND: server/autonomy/execution/taskExecutionPipeline.ts
- FOUND: server/routes/chat.ts
- FOUND: server/autonomy/background/backgroundRunner.ts
- FOUND: scripts/test-execution-pipeline.ts

Commits exist:
- FOUND: caa0bf5 (feat(22-02): rewire handleTaskJob)
- FOUND: 32e5c17 (feat(22-02): remove racy budget pre-check)
- FOUND: c0a3ed0 (fix(22-02): update test-execution-pipeline)

---
*Phase: 22-atomic-budget-enforcement*
*Completed: 2026-04-26*
