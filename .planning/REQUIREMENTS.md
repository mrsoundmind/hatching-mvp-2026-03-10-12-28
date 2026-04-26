# Requirements: Hatchin v3.0 Hatchin That Works

**Defined:** 2026-04-13 (Pillar A) / Extended 2026-04-25 (Pillar B)
**Core Value:** No one should ever feel alone with their idea, have to start from scratch, or need to know how to prompt AI — just have a conversation and your team takes it from there.

**Milestone goal:** Make Hatchin trustworthy in two dimensions at once — autonomy backend reliability (no runaway spend, scheduled routines work) AND conversation experience reliability (Maya knows when to start, deliverables ship, agents act like a real team).

---

## Pillar A — Reliable Autonomy (32 requirements)

### Budget (BUDG)

- [x] **BUDG-01**: System enforces per-project daily autonomy budget atomically — concurrent background tasks cannot bypass the cap
- [x] **BUDG-02**: Failed or cancelled autonomous tasks release their reserved budget slot (no permanent leaks)
- [x] **BUDG-03**: Daily reconciliation job detects drift between reserved counter and `autonomy_events` count of truth
- [ ] **BUDG-04**: User sees autonomy budget consumption in UsageBar alongside existing message budget
- [ ] **BUDG-05**: User receives soft warning at 80% autonomy budget consumption
- [ ] **BUDG-06**: User sees in-character Maya message when autonomy budget is exhausted (hard stop at 100%)
- [ ] **BUDG-07**: `budget_blocked` events surface in the Activity feed with timestamp and blocked task context
- [ ] **BUDG-08**: Free-tier users hitting autonomy budget see UpgradeModal prompt

### Scheduling Backend (SCHED)

- [ ] **SCHED-01**: User can create a scheduled routine via API (`POST /api/routines`) with agent, cron, timezone, instruction
- [ ] **SCHED-02**: Scheduled routines fire on cron using pg-boss's distributed scheduler (single-fire across nodes)
- [ ] **SCHED-03**: Scheduled fire creates a task and enqueues it through existing autonomous execution pipeline (no parallel path)
- [ ] **SCHED-04**: Routine execution results (success/failure/blocked) are recorded in `last_run_status` + `last_run_task_id`
- [ ] **SCHED-05**: Routine auto-pauses after 3 consecutive failures with `paused_reason` set
- [ ] **SCHED-06**: Deleting an agent or project cascades to remove dangling scheduled routines
- [ ] **SCHED-07**: Routines are gated to Pro tier via existing `tierGate` middleware
- [ ] **SCHED-08**: Each project has a maximum of 10 active routines (abuse prevention)
- [ ] **SCHED-09**: System re-registers routines with pg-boss on server boot (survives restarts)

### Chat-Native Creation (CHAT)

- [ ] **CHAT-01**: User can create a routine by typing natural language to an agent ("Kai, draft the growth update every Monday at 9am")
- [ ] **CHAT-02**: `intentClassifier` detects SCHEDULE_REQUEST before EXPLICIT_TASK_REQUEST (schedule wins on ambiguity)
- [ ] **CHAT-03**: `schedulePhraseParser` converts natural language to cron expression + IANA timezone
- [ ] **CHAT-04**: Agent responds with in-character confirmation card showing parsed schedule and task template
- [ ] **CHAT-05**: User can cancel the confirmation card inline without creating the routine
- [ ] **CHAT-06**: Prompt-injection defense — NL instruction capped at 500 chars, delimited framing when injected into LLM prompts

### Routines Management (MGMT)

- [ ] **MGMT-01**: User sees a Routines tab in the right sidebar listing all project routines
- [ ] **MGMT-02**: Each routine card shows: agent avatar, schedule in human-readable form, next run time, last run status
- [ ] **MGMT-03**: User can pause/resume a routine inline
- [ ] **MGMT-04**: User can manually trigger a routine ("Run now") outside its schedule
- [ ] **MGMT-05**: User can delete a routine (unschedules pg-boss entry)
- [ ] **MGMT-06**: Routine card shows last 30 past runs with status and cost
- [ ] **MGMT-07**: Failed routine runs appear in Maya's return briefing when user re-opens the app
- [ ] **MGMT-08**: Tab badge indicates unread routine completions when user is away

### Verification (VER)

- [ ] **VER-01**: Concurrent-execution test proves exactly N tasks pass budget gate when limit is N (10 concurrent, limit=5 → 5 pass, 5 blocked)
- [ ] **VER-02**: DST transition test (fixed-date) proves routines fire at correct wall-clock time across spring-forward / fall-back
- [ ] **VER-03**: Multi-replica test proves pg-boss fires each schedule exactly once (no double execution)
- [ ] **VER-04**: Red-team prompt-injection suite (≥15 adversarial NL schedule phrases) — none escape delimited framing

---

## Pillar B — Reliable Maya & Teamness (42 requirements)

### Maya Bug Fix + SDK Migration (BUG) — URGENT, ships first

- [ ] **BUG-01**: Migrate from archived `@google/generative-ai` SDK to current `@google/genai` SDK (LangChain `@langchain/google-genai` upgraded in lockstep)
- [ ] **BUG-02**: All LLM streaming requests propagate `AbortSignal.timeout(30_000)` end-to-end (chat → providerResolver → provider SDK)
- [ ] **BUG-03**: When LLM request aborts or times out, "thinking" UI state clears within 1 second and `streaming_cancelled` WS event fires
- [ ] **BUG-04**: "Out for lunch" / "resting circuits" fallback messages only display on confirmed error (never during valid latency under 30s) — wrong code path identified and removed
- [ ] **BUG-05**: AbortController cleanup verified — no dangling references after abort (no heap leak under load test)
- [ ] **BUG-06**: Stop button in chat input clears within 1 second of any terminal stream event (success completion, abort, timeout, error) — currently sticks in "stop" state after Hatch finishes responding via `chat_message` path because `streaming.isStreaming` and message `metadata.isStreaming` are not deterministically reset on the success-completion path (`CenterPanel.tsx` derived `isStreaming` prop at ~line 1937 stays truthy)

### Discovery Redesign (DISC)

- [ ] **DISC-01**: Maya asks at most 3 questions in any single message (hard cap, prompt-enforced + turn-counter safety net)
- [ ] **DISC-02**: Discovery questions are grouped by category (Features / Visuals / Tech) when more than one is asked
- [ ] **DISC-03**: Maya does not re-ask a question already answered in the conversation history (deduplication via context check)

### Minimum-Viable-Brain Gate (MVB)

- [ ] **MVB-01**: System defines minimum brain schema (`whatBuilding`, `whoFor`, `whyMatters` all non-empty in `projects.coreDirection`)
- [ ] **MVB-02**: Background extractor populates brain fields from every Maya discovery turn (mirrors `organicExtractor.ts` pattern, runs in parallel to gate check)
- [ ] **MVB-03**: When MVB threshold is satisfied, system emits a phase-advance signal — Maya is prompted to draft the blueprint instead of asking more questions

### Conversation Phase Machine (PHASE)

- [ ] **PHASE-01**: Each conversation persists a `phase` value (discovery / blueprint / executing) in DB — survives WebSocket reconnects
- [ ] **PHASE-02**: `[[PHASE: <new-phase>]]` action block in Maya's response transitions the conversation phase
- [ ] **PHASE-03**: Phase regression (user resets mid-execution) cancels in-flight pg-boss jobs for that project to prevent stale-blueprint execution
- [ ] **PHASE-04**: User sees a phase indicator in the chat header ("Discovery → Draft → Building") that updates live

### Blueprint Draft + Handoff (BLPR)

- [ ] **BLPR-01**: After MVB gate is met, Maya synthesizes answers into a structured `BlueprintCard` (project name, one-paragraph summary, 3 suggested first tasks, 3-4 recommended roles)
- [ ] **BLPR-02**: BlueprintCard renders inline in chat as a confirmable component
- [ ] **BLPR-03**: User clicks "Looks good — start building" button on the card to confirm and advance phase (button-only handoff signal, no LLM intent classifier on plain "go")
- [ ] **BLPR-04**: User can type freeform revisions inline ("change the color palette to pastels") and Maya regenerates the blueprint
- [ ] **BLPR-05**: On confirmation, Maya releases primary speaking authority; PM Alex becomes the default project speaker
- [ ] **BLPR-06**: Task generation on confirm is idempotent — double-click does not create duplicate tasks (idempotency key on confirm action)

### Skip-Maya Escape Hatch (SKIP)

- [ ] **SKIP-01**: Onboarding and project creation surface a visible "Skip to my team" path
- [ ] **SKIP-02**: Skip path shows 3 labeled fields (`What you're building` / `Who it's for` / `Why it matters`) which map directly to MVB schema
- [ ] **SKIP-03**: On submit, project advances directly to `executing` phase — no Maya discovery turn, blueprint auto-generated from the 3 fields
- [ ] **SKIP-04**: User preference to skip Maya is remembered (`users.preferences.skipMayaOnboarding` flag) for future projects

### Deliverable Feedback Loop (FBK)

- [ ] **FBK-01**: Deliverables table gains `userAccepted` timestamp, `editsCount` int, `dismissedAt` timestamp, and `impressionCount` int columns
- [ ] **FBK-02**: User can Accept or Dismiss a deliverable from the artifact panel — actions populate the corresponding columns
- [ ] **FBK-03**: System auto-increments `impressionCount` when a deliverable is opened in the artifact panel
- [ ] **FBK-04**: Agent prompts include recent feedback signal for that role ("your last 3 PRDs were accepted, 1 dismissed for being too long") so quality compounds

### Graceful LLM Degradation (LLMUX)

- [ ] **LLMUX-01**: `providerResolver.ts` classifies failures into typed codes (`RATE_LIMIT_429`, `PROVIDER_DOWN_5XX`, `ALL_PROVIDERS_EXHAUSTED`)
- [ ] **LLMUX-02**: When all providers fail, server emits `PROVIDER_DEGRADED` WS event with a typed reason (no raw HTTP 500)
- [ ] **LLMUX-03**: Client shows a non-blocking banner ("Agents are slow right now, hang tight") on `PROVIDER_DEGRADED` — never a blocking modal
- [ ] **LLMUX-04**: Banner auto-dismisses after 60 seconds of recovery (next successful response clears state)

### Cross-Project User Preferences (PREF)

- [ ] **PREF-01**: `users` table gains a `preferences` JSONB column (project-type-scoped: `{ formal: {...}, casual: {...} }`)
- [ ] **PREF-02**: System infers user preferences (tone, verbosity, technicalDepth) from message patterns after a conversation reaches 10+ user turns
- [ ] **PREF-03**: Inferred preferences are sanitized on write — instruction-format text is stripped (OWASP LLM01 defense against stored prompt injection)
- [ ] **PREF-04**: Preferences inject into agent prompts as a user-context block (not system role) — adversarial preference text cannot escape the data boundary
- [ ] **PREF-05**: New project inherits the user's existing preferences automatically — no cold-start

### Dynamic Team Formation (FORM)

- [ ] **FORM-01**: When a user creates a freeform project (not a starter pack), system recommends 3-4 agents matched to the project description via Gemini text-embedding cosine similarity
- [ ] **FORM-02**: Role embeddings are pre-computed at server startup and cached in memory; embeddings invalidate via hash-check when role definitions change
- [ ] **FORM-03**: Recommendation includes one "exploration" role (random sample from below the top-3 threshold) so identical descriptions don't always produce identical teams
- [ ] **FORM-04**: Other 27 agents remain accessible via existing "Add Hatch" modal — recommendation augments, does not replace, the full roster

### Per-Run Cost Visibility (COST)

- [ ] **COST-01**: `autonomy_events` table gains a nullable `cost_cents` column populated at run completion
- [ ] **COST-02**: User sees quota framing ("47 of 50 autonomy runs remaining today") in UsageBar — never raw dollar amounts in primary UI
- [ ] **COST-03**: Activity feed shows per-run cost as a quota delta ("Kai drafted growth update · 1 run") — not "$0.03"
- [ ] **COST-04**: Free-tier user hitting the autonomy cap sees an in-character upgrade prompt (not "quota exceeded" raw error)

### Production Surface Polish (LEGAL, AUTH-GATE) — added 2026-04-26 from Playwright audit

- [ ] **LEGAL-01**: Landing page footer shows visible Privacy and Terms links pointing to `/legal/privacy` and `/legal/terms` — both pages exist on production but are unlinked (compliance regression flagged by Playwright audit)
- [ ] **AUTH-GATE-01**: Unauthenticated visits to `/account` and `/maya/:id` redirect to `/login` (or render an inline sign-in prompt) — currently the SPA shell loads to a blank/loading state, no redirect, no prompt

---

## v3.1+ Deferred

### From original v3.0 plan (Pillar A deferrals)

- **AUDIT-01**: Per-task replayable timeline UX surfacing `autonomy_events`
- **AUDIT-02**: Decision explanations (why this agent, why this risk score)
- **TMPL-01**: Export project org + agents + brain docs as JSON with secret scrubbing
- **TMPL-02**: Import JSON to create a new project from template
- **ROLL-01**: Version agent personality / brain config edits
- **ROLL-02**: Undo changes from UI
- **MOB-01**: Mobile-first "what did my team do today" summary page
- **MOB-02**: Push notification for completed background work
- **PAB-01**: User can set monthly budget per individual agent
- **PAB-02**: System enforces per-agent cap atomically (extends v3.0 ledger)
- **CHAT-07**: `SCHEDULE_UPDATE` intent — change existing routine via chat
- **CHAT-08**: `SCHEDULE_CANCEL` intent — delete routine via chat
- **MGMT-09**: Skip-next-run option on routine card

### Pillar B deferrals — moved to v3.2

#### Disagreement Orchestration (DISG)
- **DISG-01**: Conductor detects when two agents hold opposing positions on a question
- **DISG-02**: System surfaces qualified disagreement to user as a decision card (gated on confidence delta ≥ 0.30 AND risk score ≥ 0.45)
- **DISG-03**: User decision is recorded and feeds into agent trust calibration

> **Why deferred:** Highest-risk feature in Pillar B. Manufactured disagreement destroys trust faster than no disagreement detection. Needs its own research phase before building. Threshold gating must be calibrated on real conversation data.

#### Project Milestones / Definition of Done (GOAL)
- **GOAL-01**: User can define project milestones (above the task layer)
- **GOAL-02**: System tracks milestone completion as percentage of contained tasks
- **GOAL-03**: Maya's return briefing summarizes milestone progress

> **Why deferred:** Lower priority than the trust + reliability fixes. Standard PM tooling pattern, can ship anytime once the blueprint phase is stable.

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Visual cron editor | Off-brand — Zapier lane; Hatchin is chat-native |
| Sub-hourly cadence | Cost abuse vector; minimum cadence is hourly |
| Cross-routine dependency chains | Complexity trap; solvable via agent handoff in a single routine |
| Shared / team routines | Deferred to multi-user collaboration milestone |
| User-editable per-agent budgets | Defer to v3.1 PAB requirements |
| Manual budget override | Erodes the safety net v3.0 creates |
| Budget projection at creation time | Speculative; model unproven |
| Deferred-run queue (catch up missed runs) | Opt-in only, defer to v3.1 |
| Replace agents entirely on freeform projects | Power users may need full roster — recommend, don't replace |
| Dollar amounts in primary cost UI | Loss-aversion research backed; quota framing only |
| LLM-based "looks good" intent classifier on plain affirmations | Substring matching fires on sarcasm; button-only handoff is reliable |
| Auto-advance to execution after inactivity | Surprising behavior — may execute unwanted plans |
| Agent disagreement orchestration in v3.0 | Highest-risk feature; needs separate research phase; deferred to v3.2 |
| Project milestones layer in v3.0 | Lower priority than trust fixes; deferred to v3.2 |
| Explicit user preference UI | Inferred preferences only — friction-free, on-brand |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BUDG-01 | Phase 22 | Complete |
| BUDG-02 | Phase 22 | Complete |
| BUDG-03 | Phase 22 | Complete |
| BUDG-04 | Phase 23 | Pending |
| BUDG-05 | Phase 23 | Pending |
| BUDG-06 | Phase 23 | Pending |
| BUDG-07 | Phase 23 | Pending |
| BUDG-08 | Phase 23 | Pending |
| SCHED-01 | Phase 24 | Pending |
| SCHED-02 | Phase 24 | Pending |
| SCHED-03 | Phase 24 | Pending |
| SCHED-04 | Phase 24 | Pending |
| SCHED-05 | Phase 24 | Pending |
| SCHED-06 | Phase 24 | Pending |
| SCHED-07 | Phase 24 | Pending |
| SCHED-08 | Phase 24 | Pending |
| SCHED-09 | Phase 24 | Pending |
| CHAT-01 | Phase 25 | Pending |
| CHAT-02 | Phase 25 | Pending |
| CHAT-03 | Phase 25 | Pending |
| CHAT-04 | Phase 25 | Pending |
| CHAT-05 | Phase 25 | Pending |
| CHAT-06 | Phase 25 | Pending |
| MGMT-01 | Phase 26 | Pending |
| MGMT-02 | Phase 26 | Pending |
| MGMT-03 | Phase 26 | Pending |
| MGMT-04 | Phase 26 | Pending |
| MGMT-05 | Phase 26 | Pending |
| MGMT-06 | Phase 26 | Pending |
| MGMT-07 | Phase 26 | Pending |
| MGMT-08 | Phase 26 | Pending |
| VER-01 | Phase 27 | Pending |
| VER-02 | Phase 27 | Pending |
| VER-03 | Phase 27 | Pending |
| VER-04 | Phase 27 | Pending |
| BUG-01 | Phase 28 | Pending |
| BUG-02 | Phase 28 | Pending |
| BUG-03 | Phase 28 | Pending |
| BUG-04 | Phase 28 | Pending |
| BUG-05 | Phase 28 | Pending |
| BUG-06 | Phase 28 | Pending |
| DISC-01 | Phase 29 | Pending |
| DISC-02 | Phase 29 | Pending |
| DISC-03 | Phase 29 | Pending |
| MVB-01 | Phase 29 | Pending |
| MVB-02 | Phase 29 | Pending |
| MVB-03 | Phase 29 | Pending |
| PHASE-01 | Phase 30 | Pending |
| PHASE-02 | Phase 30 | Pending |
| PHASE-03 | Phase 30 | Pending |
| PHASE-04 | Phase 30 | Pending |
| BLPR-01 | Phase 30 | Pending |
| BLPR-02 | Phase 30 | Pending |
| BLPR-03 | Phase 30 | Pending |
| BLPR-04 | Phase 30 | Pending |
| BLPR-05 | Phase 30 | Pending |
| BLPR-06 | Phase 30 | Pending |
| SKIP-01 | Phase 30 | Pending |
| SKIP-02 | Phase 30 | Pending |
| SKIP-03 | Phase 30 | Pending |
| SKIP-04 | Phase 30 | Pending |
| FBK-01 | Phase 31 | Pending |
| FBK-02 | Phase 31 | Pending |
| FBK-03 | Phase 31 | Pending |
| FBK-04 | Phase 31 | Pending |
| LLMUX-01 | Phase 31 | Pending |
| LLMUX-02 | Phase 31 | Pending |
| LLMUX-03 | Phase 31 | Pending |
| LLMUX-04 | Phase 31 | Pending |
| PREF-01 | Phase 32 | Pending |
| PREF-02 | Phase 32 | Pending |
| PREF-03 | Phase 32 | Pending |
| PREF-04 | Phase 32 | Pending |
| PREF-05 | Phase 32 | Pending |
| FORM-01 | Phase 33 | Pending |
| FORM-02 | Phase 33 | Pending |
| FORM-03 | Phase 33 | Pending |
| FORM-04 | Phase 33 | Pending |
| COST-01 | Phase 34 | Pending |
| COST-02 | Phase 34 | Pending |
| COST-03 | Phase 34 | Pending |
| COST-04 | Phase 34 | Pending |
| LEGAL-01 | Phase 31 | Pending |
| AUTH-GATE-01 | Phase 31 | Pending |

**Coverage:**
- Pillar A requirements: 32 total (BUDG, SCHED, CHAT, MGMT, VER) — mapped to Phases 22-27 ✓
- Pillar B requirements: 45 total (BUG, DISC, MVB, PHASE, BLPR, SKIP, FBK, LLMUX, PREF, FORM, COST, LEGAL, AUTH-GATE) — mapped to Phases 28-34 ✓
- v3.0 total: 77 requirements (+2 from Playwright audit 2026-04-26, +1 BUG-06 stop-button stuck 2026-04-26)
- Mapped to phases: 77
- Unmapped: 0 ✓

---

*Pillar A defined: 2026-04-13*
*Pillar B added: 2026-04-25 — bundled into v3.0 after user testing exposed Maya reliability gaps + 9 verified gaps from codebase audit*
*Traceability expanded: 2026-04-25 — all 74 requirements mapped to explicit phases*
