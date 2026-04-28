# Milestones

## v3.0 Hatchin That Works (Partial close-out: 2026-04-28)

**Phases completed:** 2 phases shipped (22, 28) of 13 planned. Remaining 11 phases re-scoped into ROADMAP-V3 (v2.1 + v2.7 + v2.3 + future v3.0).
**Timeline:** 2026-04-13 → 2026-04-28 (15 days)
**Requirements:** 9/77 shipped — Phase 22 (BUDG-01..03), Phase 28 (BUG-01..06), AUTH-GATE-01 (audit-confirmed shipped). Remaining 68 requirements re-scoped to V3.

**Key accomplishments:**
- Closed atomic budget race condition at `taskExecutionPipeline.ts` via transactional reserve/release ledger; daily reconciliation cron live at `5 0 * * *` UTC (Phase 22)
- Migrated `@google/generative-ai` → `@google/genai` SDK with end-to-end AbortSignal.timeout(30s) propagation, fixing infinite Maya "thinking" state (Phase 28)
- Closed AbortController heap leak (delta 70.58MB → 0.11MB under 50 concurrent aborted requests)
- Stop button reset latency fixed from 300ms → 0ms via truth-enforcer + force `metadata.isStreaming=false`
- Hotfix `quick-260427-ojf` shipped DB-CRASH-01 (Neon idle-in-transaction recovery + `traceStore.ts` transaction-leak)
- Apr 25–28 deep audit (18 repo evaluations + 15-item gap audit) produced ROADMAP-V3, re-scoping the unfinished 11 phases into a unified post-v2.0 plan

**Why partial close-out:** After Phase 22 + 28 shipped, an exhaustive audit revealed the remaining v3.0 work was better grouped under V3's milestone structure (v2.1 Maya/teamness, v2.7 autonomy infrastructure). No work was abandoned — re-scoped, not dropped.

**Archive:** [v3.0-ROADMAP.md](milestones/v3.0-ROADMAP.md) | [v3.0-REQUIREMENTS.md](milestones/v3.0-REQUIREMENTS.md)

---

## v1.1 Autonomous Execution Loop (Shipped: 2026-03-23)

**Phases completed:** 4 phases, 12 plans
**Timeline:** 2026-03-19 → 2026-03-23 (4 days)
**Requirements:** 17/17 satisfied (EXEC-01–04, HAND-01–04, SAFE-01–04, UX-01–05)

**Key accomplishments:**
- Built background task execution pipeline with pg-boss durable job queue — Hatches produce real output autonomously
- Implemented agent-to-agent handoff chain with BFS cycle detection and max-hops guard
- Created three-tier safety system: auto-complete (low risk), peer review (mid risk), user approval (high risk)
- Added progressive trust scoring — agents earn higher autonomy through successful task completions
- Built Maya return briefing — LLM-generated conversational summary when user returns after absence
- Wired tab notifications (flashing title + OS Notification API) and inactivity auto-trigger with per-project opt-in

**Archive:** [v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md) | [v1.1-REQUIREMENTS.md](milestones/v1.1-REQUIREMENTS.md) | [v1.1-MILESTONE-AUDIT.md](milestones/v1.1-MILESTONE-AUDIT.md)

---

## v1.0 Text-Perfect, Human-First (Shipped: 2026-03-19)

**Phases completed:** 5 phases, 13 plans
**Timeline:** 2026-03-05 → 2026-03-19 (14 days)
**Codebase:** ~47,000 LOC TypeScript, 162 files changed

**Key accomplishments:**
- Implemented all 8 conversation quality gaps — domain expertise, emotional signatures, LLM memory, opinion injection, open questions
- Fixed complete user journey — landing page, onboarding, project creation, team accordion, typing indicators, bubble colors
- Built 26 animated SVG character avatars with per-character idle micro-animations and thinking states
- Wired personality evolution to persist adaptedTraits to database — behavior learning survives server restart
- Added production storage guard, message idempotency keys, and cursor-based pagination
- Split 4,347-line routes.ts god file into 6 focused modules (430-line orchestrator remains)

**Archive:** [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) | [v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md) | [v1.0-MILESTONE-AUDIT.md](milestones/v1.0-MILESTONE-AUDIT.md)

---
