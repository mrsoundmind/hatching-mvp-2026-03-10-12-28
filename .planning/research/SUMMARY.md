# Project Research Summary

**Project:** Hatchin v1.1 — Autonomous Agent Execution Loop
**Domain:** Background autonomous task execution with multi-agent handoffs, risk-tiered approvals, and conversational briefings on an existing LangGraph + Express + PostgreSQL platform
**Researched:** 2026-03-19
**Confidence:** HIGH

## Executive Summary

Hatchin v1.1 is a milestone that wires an already-built autonomy foundation into a real execution loop — not a greenfield build. The v1.0 platform ships with LangGraph multi-agent routing, a peer review pipeline, safety scoring with three risk tiers, a background runner with cron scheduling, a task graph engine, an escalation ladder, and a proactive outreach system. The gap is the missing entry point: there is no code path that takes a task from "approved" to "executed by an agent in the background, with output stored as a message, and next agent handed the baton." This milestone builds that loop and surfaces it to users as a "team working while you're away" experience.

The recommended approach is to build four new server modules (`AutonomyTriggerResolver`, `TaskExecutionPipeline`, `HandoffOrchestrator`, `SummaryBriefingBuilder`) that plug into the existing infrastructure without replacing it. The only new package required is `pg-boss` for durable job queuing over the existing Neon PostgreSQL connection — Redis, BullMQ, Temporal, and Kafka are all explicitly ruled out. The synchronous AI pipeline (LangGraph `runTurn`) must NOT be called from background execution; background tasks call `generateText` directly to avoid corrupting in-memory conversation state.

The primary risks are operational: runaway LLM costs from background execution across all projects, infinite agent handoff loops from missing cycle detection, and safety scoring that silently degrades when no user message is present. All three must be addressed in Phase 1 — before any autonomous code reaches a real LLM call in production. The UX risk is equally important: autonomous activity injected into the chat history destroys the user experience. Autonomous artifacts belong in `autonomy_events`; only a single Maya summary message should appear in the conversation when the user returns.

## Key Findings

### Recommended Stack

The stack for v1.1 is almost entirely existing — the codebase already has every dependency needed. `pg-boss` is the single new package, chosen because it provides durable job queuing with retries, dead-letter queues, and restart-safe execution over the existing Neon PostgreSQL database. No Redis instance is required. The two packages most relevant to concurrency (`p-queue`) and internal events (`eventemitter3`) are already transitive dependencies of `@langchain/` and can be used directly. See `.planning/research/STACK.md` for full version details and integration patterns.

**Core technologies:**
- `pg-boss` (new, ^10.x): Durable job queue over PostgreSQL — survives process restarts, supports retries and deduplication; fills the gap between node-cron (periodic triggers) and event-driven handoffs
- `p-queue` (existing, 6.6.2): In-process concurrency cap for LLM calls — prevents Gemini rate limit bursts when multiple background agents fire in the same cycle
- `eventemitter3` (existing, 4.0.7): Internal event bus for execution progress — bridges the pg-boss worker to the WebSocket broadcast layer without Redis pub/sub
- `node-cron` (existing, 4.2.1): Retained for health checks (2h) and world sensor (6h); not replaced by pg-boss for these periodic jobs

Two new Drizzle schema tables are recommended: `execution_runs` (tracks full autonomous sessions from trigger to briefing) and `agent_handoffs` (audit trail per agent-to-agent transition). These are additive — no existing tables change.

### Expected Features

The research identifies a clear P1 core (must ship for v1.1 to be meaningful) and a P2 polish layer (additive, safe to defer within the milestone). External system integrations (GitHub, Linear, Notion) are explicitly P3 — they introduce irreversible side effects and require separate trust-building with users. See `.planning/research/FEATURES.md` for the full prioritization matrix and dependency tree.

**Must have (table stakes):**
- Explicit "go ahead" trigger — users expect something to visibly happen when they greenlight autonomous work; this is the loop's only entry point
- Background task execution pipeline with artifact generation — the actual "work while away" deliverable; agents must produce stored messages as output, not just run silently
- Action proposal approval UI — the frontend never renders `action_proposal_created` WS events that the backend already emits; this is the only thing blocking the risk-tiered approval system from being usable
- Chat summary briefing (Maya) — single conversational summary of autonomous activity delivered when the user returns after 30+ minutes
- "Team is working" status indicator — a subtle frontend signal that background execution is active; prevents the blank-UI confusion of silent background work

**Should have (competitive differentiators):**
- In-character handoff messages — Engineer says "Got it, picking this up" in their personality when PM hands off; re-uses `proactiveOutreach` pipeline
- Execution trace narrative — readable "here's what we did" summary from deliberation traces, for transparency without raw logs
- Inactivity-based trigger — idle detection that auto-starts execution after configurable threshold; gate behind `INACTIVITY_AUTONOMY_ENABLED` flag
- Peer review on autonomous outputs — quality gate using existing `peerReviewRunner` hooked into the execution path

**Defer (v2+):**
- External system integrations (GitHub, Linear, Notion) — irreversible side effects, requires deep trust and per-system auth/webhook setup
- Multi-user collaboration on autonomous tasks — requires real-time multi-user presence, separate milestone
- Scheduled recurring execution — "Every Monday, PM reviews backlog" — needs user-configurable schedule UI and persistent schedule storage
- User-tunable autonomy thresholds — per-project risk tolerance slider — defer until v1.1 fixed thresholds are validated

### Architecture Approach

The architecture adds one new layer between the existing synchronous AI pipeline and the background runner: an autonomous execution layer consisting of four new modules. The key design constraint is a clean separation of concerns: trigger resolution is pure logic (no LLM, no DB), task execution is the hot path (LLM + DB + broadcast), handoff orchestration is stateful coordination (DB + conductor), and summary generation is a pure output concern (LLM + storage). All new modules follow the established dependency injection pattern from `proactiveOutreach.ts` — accepting a typed `deps` object with `storage`, `broadcastToConversation`, and `generateText` rather than importing them directly. This enables unit testing without module mocks. See `.planning/research/ARCHITECTURE.md` for full data flow diagrams and the dependency-based build order.

**Major components:**
1. `AutonomyTriggerResolver` (`server/autonomy/triggers/`) — pure function; decides whether to start autonomous execution based on explicit trigger phrase or inactivity threshold; called from both WS handler and background cron
2. `TaskExecutionPipeline` (`server/autonomy/execution/`) — drives a single task: fetch task + agent, build prompt, call `generateText`, safety-gate output (stricter 0.60 threshold in autonomous mode), peer-review if 0.35–0.59, store as agent message or surface approval request
3. `HandoffOrchestrator` (`server/autonomy/handoff/`) — determines next ready task in the graph after completion, calls conductor in autonomous mode (synthetic task description as "message"), queues the next execution step
4. `SummaryBriefingBuilder` (`server/autonomy/summaries/`) — queries `autonomy_events` and updated tasks since `lastUserActivityAt`, prompts Maya to generate a single conversational briefing, stores as a message with `metadata.isBriefing=true`

**Modified existing components:**
- `backgroundRunner.ts` — add third cron job (every 15 min) calling `runAutonomousExecutionCycle()`
- `taskGraphEngine.ts` — add persistence wrappers (`taskGraphPersistence.ts`) while keeping pure functions unchanged
- `safety.ts` — add optional `executionContext: 'autonomous_task'` parameter with stricter 0.60 threshold
- `chat.ts` — add post-streaming trigger check + `join_conversation` briefing check
- `tasks.ts` — add `POST /api/tasks/:id/approve` and `/reject` endpoints

### Critical Pitfalls

1. **Runaway LLM costs from background execution** — The background runner iterates all projects with no activity filter or daily spend cap. At 50+ projects with autonomous handoffs, costs multiply by handoff steps invisibly. Prevention: add `lastActivityAt` filter (skip projects inactive >7 days), `MAX_BACKGROUND_LLM_CALLS_PER_PROJECT_PER_DAY=3` cap in `policies.ts`, and cost logging to `autonomy_events` before enabling in production. Address in Phase 1 before any autonomous code touches a real LLM.

2. **Infinite agent handoff loops** — PM hands to Engineer, Engineer's output contains PM-routing keywords, PM picks it back up. No cycle detection exists in `taskGraphEngine.ts`. Prevention: add `visitedAgentIds: string[]` to `TaskGraphNode`, enforce `maxHops=4` limit, require state transition (`todo → in_progress → completed`) before a new handoff can fire. Build cycle detection before writing any handoff logic — retrofitting it later is a rewrite.

3. **Safety scoring silently degrades for autonomous work** — `evaluateSafetyScore` requires `userMessage: string`; autonomous tasks have no user message, so empty string is passed, giving misleadingly low baseline risk. Prevention: add `autonomousTaskMessage` parameter distinct from `userMessage`, add `isAutonomous: true` flag with +0.1 `executionRisk` baseline, use stricter 0.60 clarification threshold in autonomous mode. Fix before any real LLM calls are made for autonomous work.

4. **Duplicate cron jobs on hot reload** — Vite HMR re-evaluates modules in development; `backgroundRunner.start()` is called again without `stop()`, appending new cron instances. After 5 reloads, 5 concurrent health check cycles run. Prevention: `let _started = false` guard in `backgroundRunner.start()` with idempotent re-start. Fix before setting `BACKGROUND_AUTONOMY_ENABLED=true` in development.

5. **Chat history polluted with autonomous activity** — Injecting every handoff and status update into the conversation makes it unreadable and feels invasive. Prevention: autonomous work goes to `autonomy_events`, not `messages`; only one summary message appears in chat, triggered on the user's first message after an absence, leading with outcome not process. This UX constraint must be decided before implementation starts.

## Implications for Roadmap

### Phase 1: Background Execution Foundation
**Rationale:** All safety and loop guardrails must be in place before any autonomous code makes real LLM calls. The trigger resolver, safety extension, cycle detection, and cron singleton guard are all foundational — they cannot be retrofitted after handoff logic is wired. This phase also establishes the durable job layer (`pg-boss`) and schema additions that later phases depend on.
**Delivers:** A safe, guarded autonomous execution loop that can accept explicit "go ahead" triggers, execute low-risk tasks via `TaskExecutionPipeline`, and store output as agent messages. No handoffs yet — single-agent execution only.
**Addresses:** Explicit "go ahead" trigger (P1), background task execution artifacts (P1), "team is working" status indicator (P1)
**Avoids:** Runaway LLM costs (add activity filter + daily cap), infinite handoff loop (add `visitedAgentIds` + `maxHops`), safety scoring gap (add `isAutonomous` flag + stricter threshold), duplicate cron jobs (add `_started` guard), task recovery on restart (add startup stall detection)
**Build order:** AutonomyTriggerResolver → policies.ts additions → safety.ts extension → taskGraphPersistence.ts → TaskExecutionPipeline → backgroundRunner cron job → pg-boss setup

### Phase 2: Agent Handoffs and Approval UI
**Rationale:** Handoffs depend on a working single-agent execution loop from Phase 1. The approval UI depends on having tasks that actually reach a "blocked" state from real executions. Both must be shipped together because the approval endpoint (`/api/tasks/:id/approve`) is the only way to unblock high-risk tasks that `TaskExecutionPipeline` gates.
**Delivers:** Full PM → Engineer → Designer handoff chain with in-character transition messages, plus a frontend `ProposalCard` component that renders `action_proposal_created` WS events and allows approve/reject.
**Uses:** `HandoffOrchestrator` (new), conductor in autonomous mode (existing), `proactiveOutreach` pipeline for in-character messages (existing), `peerReviewRunner` for autonomous output quality gate (existing)
**Implements:** HandoffOrchestrator, chat.ts WS handler trigger check, tasks.ts approval endpoints, frontend TaskApprovalModal wiring
**Avoids:** Cross-project data leak (every storage call in autonomous pipeline must include `projectId` scope), prompt injection via task content (run injection scanner before task content enters prompts), personality drift in autonomous mode (same character system prompt as chat), user cannot pause (add `POST /api/projects/:id/autonomy/pause`)

### Phase 3: Chat Summary Briefings
**Rationale:** Summary briefings are only meaningful after Phase 2 produces execution artifacts to summarize. Building summary generation before there is autonomous output produces empty or hallucinated summaries. The UX constraints for this feature (one message, outcome-first, user-preference stored) must be decided before implementation begins — not added as polish.
**Delivers:** Single Maya briefing message on user return after 30+ minutes of autonomous activity; message leads with outcome ("Authentication module scoped — two items need your review"), not process. Message stored with `metadata.isBriefing=true` for distinct frontend rendering.
**Uses:** `SummaryBriefingBuilder` (new), Maya special agent (existing), `autonomy_events` query (existing), `join_conversation` WS event as trigger hook
**Avoids:** Summary spam (one message per return session, not per event; idempotency guard so rapid back-and-forth does not re-trigger; preference stored in `projects.executionRules.summaryPreference`)

### Phase 4: Polish and Inactivity Trigger
**Rationale:** Inactivity-based autonomous trigger is a P2 feature that requires the explicit trigger path from Phase 1 to be validated first. Execution trace narrative requires the artifact pipeline from Phase 2. Peer review on autonomous outputs requires a working execution loop. All of these are additive and safe to ship as a polish pass once the core loop is validated.
**Delivers:** Idle-detection autonomous trigger (gated behind `INACTIVITY_AUTONOMY_ENABLED` flag), execution trace narrative rendered from deliberation traces, peer review quality gate on all autonomous outputs.
**Addresses:** Inactivity-based trigger (P2), execution trace narrative (P2), peer review on autonomous outputs (P2)

### Phase Ordering Rationale

- Phase 1 is gated by safety: no autonomous code should reach a real LLM call without cost caps, loop detection, and proper safety scoring in place. These are not features — they are prerequisites.
- Phase 2 cannot start until Phase 1 produces real execution artifacts, because the handoff orchestrator has nothing to hand off and the approval UI has no proposals to render.
- Phase 3 is explicitly blocked on Phase 2: a summary of nothing produces hallucinated or vacuous output. Do not build the summary before the artifacts.
- Phase 4 is purely additive and can be ordered or re-ordered without breaking dependencies.
- All phases use the existing `broadcastToConversation` WebSocket infrastructure — no new transport layer is needed at any phase.

### Research Flags

Phases needing deeper research during planning:
- **Phase 1:** `pg-boss` compatibility with `@neondatabase/serverless` driver needs verification before installation. pg-boss may require the standard `pg` driver for its own connection while Drizzle continues using the Neon serverless driver. Confirm exact version and driver requirements on npm before writing any pg-boss integration code.
- **Phase 2:** The conductor's `evaluateConductorDecision` function accepts any string as `userMessage` — but the exact behavior when called with a task description rather than a real user message has not been integration-tested. Verify the intent-matching produces correct `ownerRole` routing before relying on it in `HandoffOrchestrator`.

Phases with standard patterns (research-phase can be skipped):
- **Phase 3:** Summary briefing generation follows the established `proactiveOutreach` pattern exactly. Prompt engineering for Maya's briefing voice is the only non-standard element, and that can be iterated in implementation.
- **Phase 4:** All Phase 4 components are extensions of already-built systems. No new architectural patterns are introduced.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All package versions confirmed from `package.json` directly; pg-boss version needs npm verification before install (web tools unavailable during research) |
| Features | HIGH | Based on direct codebase analysis of what exists vs. what is missing; gap analysis is precise |
| Architecture | HIGH | All claims derive from inspection of actual source files, not training assumptions; build order is dependency-verified |
| Pitfalls | HIGH | Based on codebase analysis plus domain knowledge of known autonomous agent failure modes; warning signs and recovery strategies are concrete |

**Overall confidence:** HIGH

### Gaps to Address

- **pg-boss + Neon serverless driver compatibility:** The STACK research flags this explicitly. Verify whether pg-boss requires a standard `pg` connection alongside the Neon serverless driver before writing any integration code. If incompatible, the fallback is an in-process queue using `p-queue` with task state persisted to the `tasks` table — less durable but zero new packages.
- **Conductor autonomous mode behavior:** `HandoffOrchestrator` calls `evaluateConductorDecision` with a synthetic task description as `userMessage`. The conductor's keyword-to-role routing has only been tested with real user messages. Verify in Phase 2 planning that this call produces stable, correct routing for role-typed task descriptions.
- **Summary briefing UX preference:** The research recommends storing `summaryPreference` in `projects.executionRules` JSONB. Whether to surface a preference UI immediately (Phase 3) or default to "summary on return" and add preference later is a product decision not resolved by research.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `server/autonomy/background/backgroundRunner.ts`, `server/ai/safety.ts`, `server/ai/graph.ts`, `server/ai/conductor.ts`, `server/autonomy/taskGraph/taskGraphEngine.ts`, `server/autonomy/peerReview/peerReviewRunner.ts`, `server/autonomy/conductor/escalationLadder.ts`, `server/autonomy/conductor/decisionAuthority.ts`, `server/autonomy/config/policies.ts`, `server/autonomy/events/eventLogger.ts` — all architectural claims derived from source
- `package.json` — installed versions confirmed directly
- `shared/schema.ts` — existing Drizzle schema structure for new table design

### Secondary (MEDIUM confidence)
- Training knowledge on `pg-boss` v10.x API, BullMQ, LangGraph patterns — version numbers should be verified on npm before installation
- Domain knowledge of autonomous agent failure modes (OpenAI Swarm, AutoGPT, CrewAI post-mortems on runaway cost and loop detection) — informs pitfall catalog

### Tertiary (LOW confidence)
- LangGraph `recursion_limit` behavior for cycle detection — training knowledge; verify against `@langchain/langgraph` 0.4.9 documentation before relying on it as a primary loop guard

---
*Research completed: 2026-03-19*
*Ready for roadmap: yes*
