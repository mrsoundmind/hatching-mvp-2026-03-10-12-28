---
phase: 06-background-execution-foundation
plan: "04"
subsystem: infra
tags: [autonomy, background-execution, cron, websocket, react, cost-cap, idempotency]

requires:
  - phase: 06-01
    provides: resolveAutonomyTrigger pure function, queueTaskExecution job queue, BUDGETS.maxBackgroundLlmCallsPerProjectPerDay
  - phase: 06-03
    provides: TaskExecutionPipeline with safety gating, startTaskWorker, countAutonomyEventsForProjectToday
provides:
  - backgroundRunner with _started idempotency guard preventing duplicate cron jobs on HMR
  - Autonomous execution cron running every 15 minutes, feature-flagged behind FEATURE_FLAGS.backgroundExecution
  - checkForAutonomyTrigger in chat.ts enforcing EXEC-03 cost cap before queuing any tasks
  - background_execution_started WebSocket event broadcast when trigger fires
  - CenterPanel "Team is working on N tasks..." animated indicator (amber bouncing dots)
  - background_execution_completed / task_execution_completed dismisses the indicator
  - 9 vitest tests in scripts/chat-trigger.test.ts covering trigger logic and cost cap assertions
affects:
  - 07-01 (HandoffOrchestrator — execution foundation is now wired end-to-end)
  - 08-01 (SummaryBriefingBuilder — background_execution_completed event is the signal to brief)

tech-stack:
  added: []
  patterns:
    - "Idempotency guard pattern: module-level _started boolean prevents duplicate cron registration on HMR restart"
    - "Cost cap first: checkForAutonomyTrigger checks countAutonomyEventsForProjectToday BEFORE resolveAutonomyTrigger — minimizes DB queries when cap is reached"
    - "Feature-flag-gated cron: execution cron only registers when FEATURE_FLAGS.backgroundExecution is true"
    - "Indicator driven by WS events: CenterPanel UI state derived purely from background_execution_started / completed events, no polling"

key-files:
  created:
    - scripts/chat-trigger.test.ts
  modified:
    - server/autonomy/background/backgroundRunner.ts
    - server/routes/chat.ts
    - client/src/components/CenterPanel.tsx

key-decisions:
  - "checkForAutonomyTrigger is an async function private to chat.ts — not exported — because it is tightly coupled to the broadcastToConversation closure in the WS handler scope"
  - "Working indicator dismissed by background_execution_completed OR task_execution_completed — two events cover the pg-boss completion path and any direct execution path"
  - "Execution cron registered only when FEATURE_FLAGS.backgroundExecution=true — avoids registering an empty cron in environments where the flag is off"
  - "7-day inactivity filter in backgroundRunner prevents cron from touching dormant projects unnecessarily"

patterns-established:
  - "WS indicator pattern: broadcast background_execution_started from server to drive client UI — no client-side polling or timers needed"
  - "Trigger hook placement: checkForAutonomyTrigger runs AFTER streaming_completed is broadcast — never blocking the primary chat response"

requirements-completed: [UX-02, EXEC-03]

duration: 45min
completed: 2026-03-20
---

# Phase 6 Plan 04: Wire Integration — backgroundRunner cron, chat.ts trigger hook, CenterPanel indicator Summary

**Idempotent execution cron (15min), post-streaming trigger hook with EXEC-03 cost cap guard, and amber "Team is working..." indicator driven by WebSocket events**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-03-20T00:00:00Z
- **Completed:** 2026-03-20T00:45:00Z
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files modified:** 4

## Accomplishments
- Added `_started` idempotency guard to backgroundRunner — calling `start()` twice now stops and re-registers cleanly, preventing duplicate cron jobs on HMR hot reload
- Added `runAutonomousExecutionCycle` function to backgroundRunner — scans all projects, checks daily cost cap and 7-day inactivity before queuing tasks via pg-boss
- Added `checkForAutonomyTrigger` to chat.ts — fires post-streaming, checks cost cap first (EXEC-03), broadcasts `background_execution_started` WS event, then queues execution via queueTaskExecution
- Added `isTeamWorking` state to CenterPanel with amber animated bouncing dot indicator — appears on `background_execution_started`, dismisses on `background_execution_completed` or `task_execution_completed`
- Human verification confirmed: indicator absent by default, no duplicate BackgroundRunner logs, TypeScript passes, safety gate passes

## Task Commits

Each task was committed atomically:

1. **Task 1: backgroundRunner idempotency guard and execution cron** - `1bfb16b` (feat)
2. **Task 2: chat.ts trigger hook, CenterPanel indicator, and cost cap tests** - `2e1cd89` (feat)
3. **Task 3: Human verification checkpoint** - APPROVED (no commit — human gate)

**Plan metadata:** (docs commit follows this summary creation)

## Files Created/Modified
- `server/autonomy/background/backgroundRunner.ts` - Added `_started` guard, `stop()` resets flag, `runAutonomousExecutionCycle` with cost cap + inactivity filter, execution cron registered every 15min when FEATURE_FLAGS.backgroundExecution=true
- `server/routes/chat.ts` - Added `checkForAutonomyTrigger` async function with EXEC-03 daily cost cap check first, resolveAutonomyTrigger call, broadcastToConversation for working indicator, queueTaskExecution for each task
- `client/src/components/CenterPanel.tsx` - Added `isTeamWorking` and `teamWorkingTaskCount` state, WS handlers for `background_execution_started` and `background_execution_completed`, amber bouncing dot indicator JSX
- `scripts/chat-trigger.test.ts` - 9 vitest tests covering trigger resolution, cost cap blocking logic (EXEC-03), and cost cap allow path

## Decisions Made
- `checkForAutonomyTrigger` is scoped to chat.ts (not exported) — it captures the `broadcastToConversation` closure directly rather than threading the function through the module boundary
- Working indicator dismisses on either `background_execution_completed` or `task_execution_completed` to cover both the pg-boss completion path and any direct execution path
- Tests live in `scripts/chat-trigger.test.ts` using vitest rather than the existing tsx script pattern — the trigger logic involves more async branching and vitest assertions are cleaner

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- None.

## User Setup Required
None — no external service configuration required. Background execution remains opt-in via `BACKGROUND_AUTONOMY_ENABLED=true` in `.env`. Cost cap and 7-day inactivity filter are active regardless.

## Next Phase Readiness
- Phase 6 is complete — all 4 plans done. The background execution loop is fully wired: trigger resolver → cost cap → job queue → execution pipeline → safety gate → output storage → working indicator
- Phase 7 (Agent Handoffs and Approval UI) can begin immediately. HandoffOrchestrator will build on top of the existing queueTaskExecution and TaskExecutionPipeline foundation
- The `background_execution_completed` event (Phase 7/8 boundary) is the signal for the SummaryBriefingBuilder in Phase 8

---
*Phase: 06-background-execution-foundation*
*Completed: 2026-03-20*
