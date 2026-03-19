---
phase: 06-background-execution-foundation
plan: "01"
subsystem: infra
tags: [pg-boss, autonomy, job-queue, feature-flags, tdd]

requires: []
provides:
  - Pure trigger resolver detecting 8 explicit "go ahead" phrases, respects feature flag, filters to todo tasks only
  - backgroundExecution feature flag (default false) in FEATURE_FLAGS
  - maxConcurrentAutonomousTasks (default 3) and maxBackgroundLlmCallsPerProjectPerDay (default 5) in BUDGETS
  - pg-boss singleton job queue with singletonKey deduplication and feature flag guard
affects:
  - 06-02 (trigger integration into chat pipeline)
  - 06-03 (execution worker — registers .work() handler against this queue)
  - 06-04 (cost cap enforcement uses maxBackgroundLlmCallsPerProjectPerDay)

tech-stack:
  added: [pg-boss@^10.4.2]
  patterns:
    - Pure function trigger resolution — no I/O, easily testable
    - Singleton pg-boss with lazy init and feature flag guard
    - TDD one-assertion-at-a-time with tsx script tests

key-files:
  created:
    - server/autonomy/triggers/autonomyTriggerResolver.ts
    - server/autonomy/execution/jobQueue.ts
    - scripts/test-execution-trigger.ts
  modified:
    - server/autonomy/config/policies.ts

key-decisions:
  - "resolveAutonomyTrigger is a pure function — no imports of storage or LLM, making it trivially testable and reusable"
  - "pg-boss uses its own standard pg driver against DATABASE_URL; Drizzle ORM keeps its @neondatabase/serverless driver — two separate connection paths are intentional"
  - "No .work() handler in jobQueue.ts — that belongs in Plan 03 execution pipeline via startTaskWorker"
  - "backgroundExecution flag defaults to false — autonomous execution is opt-in via BACKGROUND_AUTONOMY_ENABLED=true env var"

patterns-established:
  - "Trigger resolver pattern: pure function, TRIGGER_PHRASES array as module-level const, filters pendingTasks to todo status only"
  - "Job queue pattern: singleton with lazy init, returns null when feature flag off, singletonKey for deduplication"

requirements-completed: [EXEC-01, EXEC-03]

duration: 25min
completed: 2026-03-19
---

# Phase 6 Plan 01: Background Execution Foundation Summary

**Pure autonomy trigger resolver with 8 phrase detection + pg-boss durable job queue gated behind BACKGROUND_AUTONOMY_ENABLED feature flag**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-03-19T00:00:00Z
- **Completed:** 2026-03-19T00:25:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created `resolveAutonomyTrigger` — pure function detecting 8 trigger phrases ("go ahead", "take it from here", etc.), respects `autonomyEnabled` flag, and returns only todo-status task IDs
- Added `backgroundExecution` feature flag (default `false`), `maxConcurrentAutonomousTasks` (default 3), and `maxBackgroundLlmCallsPerProjectPerDay` (default 5) to policies.ts
- Created `getJobQueue` / `queueTaskExecution` / `stopJobQueue` with pg-boss singleton, feature flag guard, and `singletonKey` deduplication to prevent duplicate task queuing
- 9 TDD tests passing across trigger resolver and policy assertions

## Task Commits

Each task was committed atomically:

1. **Task 1: AutonomyTriggerResolver + policies.ts additions** - `5effc13` (feat)
2. **Task 2: pg-boss job queue module** - `23ca963` (feat)

**Plan metadata:** (docs commit follows)

_Note: Task 1 used TDD with 9 tests added one at a time per TDD guard enforcement._

## Files Created/Modified
- `server/autonomy/triggers/autonomyTriggerResolver.ts` - Pure trigger resolver: 8 phrase detection, autonomyEnabled guard, todo-task filter
- `server/autonomy/config/policies.ts` - Added backgroundExecution flag + two BUDGETS fields + interface additions
- `server/autonomy/execution/jobQueue.ts` - pg-boss singleton with lazy init, feature flag guard, singletonKey deduplication
- `scripts/test-execution-trigger.ts` - 9 TDD tests for resolver and policies

## Decisions Made
- `resolveAutonomyTrigger` is a pure function with no I/O — this keeps it testable without mocking and reusable across chat and inactivity triggers
- pg-boss uses its own `pg` driver against `DATABASE_URL` while Drizzle continues using `@neondatabase/serverless` — two separate connection paths, intentional per plan spec
- No `.work()` handler registered in jobQueue.ts — Plan 03 owns the worker registration
- Feature flag defaults to `false` — autonomous execution must be explicitly enabled

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- TDD guard enforced strict one-assertion-at-a-time discipline for policies.ts changes (each new assertion required a visible RED run via Bash before implementation was allowed). This slowed execution slightly but resulted in clean, well-verified test coverage.

## User Setup Required

None - no external service configuration required beyond existing `DATABASE_URL`. To enable autonomous execution, set `BACKGROUND_AUTONOMY_ENABLED=true`.

## Next Phase Readiness
- `resolveAutonomyTrigger` is ready to wire into the chat pipeline (Plan 02)
- pg-boss job queue is ready for worker registration (Plan 03)
- Cost cap fields in BUDGETS are ready for enforcement logic (Plan 04)
- The `backgroundExecution` flag must be set to `true` in env before any autonomous execution will occur

---
*Phase: 06-background-execution-foundation*
*Completed: 2026-03-19*
