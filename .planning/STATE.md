---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Autonomous Execution Loop
status: completed
last_updated: "2026-03-23T02:39:36.934Z"
last_activity: 2026-03-23 — Completed 09-02 (inactivityAutonomyEnabled flag + 14 behavioral tests)
progress:
  total_phases: 4
  completed_phases: 4
  total_plans: 12
  completed_plans: 12
  percent: 100
---

# State: Hatchin

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-19)

**Core value:** No one should ever feel alone with their idea, have to start from scratch, or need to know how to prompt AI — just have a conversation and your team takes it from there.
**Current focus:** Phase 7 — Agent Handoffs and Approval UI

---

## Current Position

Phase: 9 of 9 (Progressive Trust and Inactivity Trigger)
Plan: 2 of 2 complete (09-02 done) — Phase 9 complete
Status: ALL PLANS COMPLETE — v1.1 milestone done
Last activity: 2026-03-23 — Completed 09-02 (inactivityAutonomyEnabled flag + 14 behavioral tests)

Progress: [██████████] 100% (12/12 plans done)

---

## Phase History

| Phase | Name | Status | Notes |
|-------|------|--------|-------|
| 1 | Hatch Conversation Quality | Complete | All 8 gaps: graph.ts removed, emotional signature, LLM memory, opener, opinions, open questions |
| 2 | User Journey Fixes | Complete | 7 plans: landing, onboarding, project creation, accordion, typing, bubble colors, backfill |
| 3 | Hatch Presence and Avatar System | Complete | 26 SVG avatars, idle animations, thinking bubble, personality persistence to DB |
| 4 | Data Reliability and Resilience | Complete | Production guard, idempotencyKey, cursor pagination |
| 5 | Route Architecture Cleanup | Complete | 5 route modules extracted; routes.ts reduced to 430-line orchestrator |
| 6 | Background Execution Foundation | Complete | All 4 plans done: trigger resolver, safety extension, execution pipeline, cron wiring + CenterPanel indicator |
| 7 | Agent Handoffs and Approval UI | Complete | Handoff orchestrator, announcement, approval cards, pause/resume |
| 8 | Chat Summary and Tab Notifications | Complete | Return briefing as new_message, flashing tab title + OS notification |
| 9 | Progressive Trust and Inactivity Trigger | Complete | 09-01: trustMeta schema + 10 tests; 09-02: inactivityAutonomyEnabled flag + 14 tests |

---

## Decisions

| Date | Phase | Decision |
|------|-------|----------|
| 2026-03-19 | Roadmap | pg-boss for durable job queue over existing Neon PostgreSQL — no Redis |
| 2026-03-19 | Roadmap | Autonomous artifacts go to autonomy_events only; one Maya summary message in chat on return |
| 2026-03-19 | Roadmap | Safety threshold stricter in autonomous mode (0.60 vs 0.80) — no user message present |
| 2026-03-19 | Roadmap | Inactivity trigger gated behind INACTIVITY_AUTONOMY_ENABLED flag — Phase 9 only |
| 2026-03-19 | Roadmap | Do NOT call runTurn from background execution — call generateText directly |

---
- [Phase 06-background-execution-foundation]: resolveAutonomyTrigger is a pure function with no I/O — testable without mocking, reusable across chat and inactivity triggers
- [Phase 06-background-execution-foundation]: pg-boss uses its own pg driver against DATABASE_URL while Drizzle keeps @neondatabase/serverless — two separate connection paths intentional
- [Phase 06-background-execution-foundation]: backgroundExecution feature flag defaults to false — autonomous execution is opt-in via BACKGROUND_AUTONOMY_ENABLED=true
- [Phase 06-background-execution-foundation]: AUTONOMOUS_SAFETY_THRESHOLDS exported separately from SAFETY_THRESHOLDS — autonomous pipeline uses it directly, needsClarification remains chat-only
- [Phase 06-background-execution-foundation]: generateText injected as dependency into executeTask — never imports runTurn or graph.invoke (plan invariant enforced by Test 3)
- [Phase 06-background-execution-foundation]: handleTaskJob checks cost cap FIRST before resolving task/agent/project — minimizes DB queries on cap-reached path
- [Phase 06-background-execution-foundation]: startTaskWorker returns no-op when getJobQueue() returns null (BACKGROUND_AUTONOMY_ENABLED=false) — feature is cleanly opt-in
- [Phase 06-background-execution-foundation]: checkForAutonomyTrigger scoped to chat.ts (not exported) — captures broadcastToConversation closure directly rather than threading the function through the module boundary
- [Phase 06-background-execution-foundation]: Working indicator dismisses on background_execution_completed OR task_execution_completed — covers both pg-boss completion path and any direct execution path
- [Phase 06-background-execution-foundation]: _started idempotency guard in backgroundRunner prevents duplicate cron jobs on HMR — calling start() twice stops and re-registers cleanly

- [Phase 07-agent-handoffs-and-approval-ui]: handoffOrchestrator.ts created as stub in 07-02 so TypeScript compiles during wave 1 parallel execution — 07-01 replaces function body with full routing + cycle detection
- [Phase 07-agent-handoffs-and-approval-ui]: emitHandoffAnnouncement placed AFTER executeTask output is stored — output message appears in chat before announcement per research anti-patterns
- [Phase 07-agent-handoffs-and-approval-ui]: Approval card renders above message input as persistent state instead of toast — UX-01 one-click requirement
- [Phase 07-agent-handoffs-and-approval-ui]: Reject sets task status to todo (not blocked) so tasks remain retryable without manual unblocking
- [Phase 07-agent-handoffs-and-approval-ui]: Pause state synced from project.executionRules on project change — persists across page refresh without extra API calls
- [Phase 07-agent-handoffs-and-approval-ui]: background_execution_started WS event resets isAutonomyPaused to false — if server started execution, project was not paused
- [Phase 08-chat-summary-and-tab-notifications]: Flash interval set to 1500ms — midpoint of 1-2s discretion range; return_briefing toast removed as dead code after 08-01; notification permission requested contextually on background_execution_started
- [Phase 08]: DB-backed lastSeenAt/lastBriefedAt on projects table tracks absence across server restarts
- [Phase 08]: 15-minute absence threshold for return briefing (down from hardcoded 2-hour window)
- [Phase 08]: Return briefing stored as real agent message and broadcast as new_message — not a separate return_briefing WS event
- [Phase 09-progressive-trust-and-inactivity-trigger]: trustMeta shape inlined in schema.ts rather than importing TrustMeta from server/ — shared/ must not import from server/
- [Phase 09]: inactivityAutonomyEnabled defaults to false — opt-in per project; explicit triggers bypass flag
- [Phase 09]: lastSeenAt used for inactivity detection (not last message) — tracks user presence, not agent activity

## Blockers / Concerns

- ~~Phase 6 planning: verify pg-boss compatibility with @neondatabase/serverless driver~~ RESOLVED — pg-boss uses its own standard pg driver; no conflict with Neon serverless driver
- Phase 7 planning: verify conductor evaluateConductorDecision produces stable routing when called with synthetic task description as userMessage
