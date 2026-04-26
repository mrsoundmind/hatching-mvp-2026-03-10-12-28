# Roadmap: Hatchin

## Milestones

- ✅ **v1.0 Text-Perfect, Human-First** — Phases 1-5 (shipped 2026-03-19) — [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 Autonomous Execution Loop** — Phases 6-9 (shipped 2026-03-23) — [archive](milestones/v1.1-ROADMAP.md)
- ✅ **v1.2 Billing + LLM Intelligence** — Phase 10 (shipped 2026-03-23) — [archive](milestones/v1.2-ROADMAP.md)
- ✅ **v1.3 Autonomy Visibility & Right Sidebar Revamp** — Phases 11-15 (shipped 2026-03-29)
- ✅ **v2.0 Hatches That Deliver** — Phases 16-21 (shipped 2026-03-30)
- 🚧 **v3.0 Hatchin That Works** — Phases 22-34 (in progress)

---

<details>
<summary>✅ v1.0 Text-Perfect, Human-First (Phases 1-5) — SHIPPED 2026-03-19</summary>

See archived roadmap: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

**Phases completed:**
- Phase 1: Hatch Conversation Quality
- Phase 2: User Journey Fixes
- Phase 3: Hatch Presence and Avatar System
- Phase 4: Data Reliability and Resilience
- Phase 5: Route Architecture Cleanup

</details>

<details>
<summary>✅ v1.1 Autonomous Execution Loop (Phases 6-9) — SHIPPED 2026-03-23</summary>

See archived roadmap: [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)

**Phases completed:**
- Phase 6: Background Execution Foundation (4 plans)
- Phase 7: Agent Handoffs and Approval UI (4 plans)
- Phase 8: Chat Summary and Tab Notifications (2 plans)
- Phase 9: Progressive Trust and Inactivity Trigger (2 plans)

**Key deliverables:** pg-boss background execution, agent handoff chain with cycle detection, three-tier safety gates, progressive trust scoring, Maya return briefing, tab notifications, inactivity auto-trigger.

</details>

<details>
<summary>✅ v1.2 Billing + LLM Intelligence (Phase 10) — SHIPPED 2026-03-23</summary>

See archived roadmap: [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md)

**Key deliverables:** Stripe Free/Pro billing ($19/mo), smart LLM routing (Gemini Flash/Pro + Groq free tier), token tracking, usage capping, conversation compaction, reasoning cache, background task batching.

</details>

---

## ✅ v1.3 Autonomy Visibility & Right Sidebar Revamp (SHIPPED 2026-03-29)

**Milestone Goal:** Make the autonomy backend visible and controllable from the frontend — tabbed sidebar shell, real-time activity feed, handoff visualization, agent working-state avatar animation, pending approvals hub, task pipeline, project brain file upload, and autonomy settings dial.

### Phases

- [x] **Phase 11: Sidebar Shell + Activity Feed** - Tab structure, live autonomy event feed, stats card, agent working avatar state, empty states (completed 2026-03-25)
- [x] **Phase 12: Handoff Visualization** - Chat handoff cards, sidebar handoff timeline, user-initiated handoff, deliberation indicator (completed 2026-03-25)
- [x] **Phase 13: Approvals Hub + Task Pipeline** - Dedicated approvals tab, task pipeline view, expiry handling (completed 2026-03-26)
- [x] **Phase 14: Brain Redesign + Autonomy Settings** - File upload to project brain, knowledge base UI, autonomy dial, work output viewer (completed 2026-03-26)
- [x] **Phase 15: Polish** - Premium component designs, visual consistency pass (completed 2026-03-30)

---

## ✅ v2.0 Hatches That Deliver (SHIPPED 2026-03-30)

**Milestone Goal:** Transform Hatchin from "AI chatroom" to "AI team that ships coordinated work" — split-panel artifact viewer, schema-enforced deliverable generation, cross-agent document chains, project packages, organic detection, professional PDF export, and zero-friction onboarding.

### Phases

- [x] **Phase 16: Database Foundation + Artifact Panel Shell**
- [x] **Phase 17: Deliverable Generation + Schema Enforcement**
- [x] **Phase 18: Cross-Agent Deliverable Chains**
- [x] **Phase 19: Organic Detection + Iteration UX**
- [x] **Phase 20: Project Packages + Background Production**
- [x] **Phase 21: Zero-Friction Onboarding + PDF Export**

---

## 🚧 v3.0 Hatchin That Works (In Progress)

**Milestone Goal:** Make Hatchin trustworthy in two dimensions at once — the autonomy backend (no runaway spend, scheduled routines) AND the conversation experience (Maya knows when to start, agents act like a real team, deliverables ship).

**Pillar A — Reliable Autonomy (Phases 22-27):** Atomic budget enforcement, scheduled routines via chat, routines management panel, integration hardening.

**Pillar B — Reliable Maya & Teamness (Phases 28-34):** Maya infinite-thinking bug fix + SDK migration (URGENT), discovery redesign + MVB gate, phase machine + blueprint draft + skip-Maya, deliverable feedback loop + graceful LLM degradation, cross-project user preferences, dynamic team formation, per-run cost visibility.

**Ordering constraint (hard):** Phase 22 (atomic budget) must land before Phase 24 (scheduler). Phase 28 (Maya bug fix) can ship in parallel with Pillar A — it is independent. Phase 30 (phase machine) requires Phase 29 (MVB gate). Phase 34 (cost visibility) requires Phase 22 (autonomy_events) and Phase 23 (UsageBar).

### Phases

**Pillar A — Reliable Autonomy:**
- [x] **Phase 22: Atomic Budget Enforcement** — Ledger table + reserve/release + pipeline rewire + daily reconciliation (completed 2026-04-26)
- [ ] **Phase 23: Budget UX Surfaces** — UsageBar autonomy extension, 80% warn, in-character hard-stop, blocked events in feed, Free-tier upgrade path
- [ ] **Phase 24: Scheduler Foundation** — scheduled_routines table, pg-boss cron wrapper, pipeline hook, auto-pause, REST API, tier gating
- [ ] **Phase 25: Chat-Native Routine Creation** — SCHEDULE_REQUEST intent, NL → cron parser, in-character confirmation card, injection defense
- [ ] **Phase 26: Routines Management Panel** — Sidebar tab, routine cards, pause/resume/run-now/delete, past-run history, return-briefing + tab-badge integration
- [ ] **Phase 27: Polish + Integration Hardening** — Concurrency verify, DST tests, multi-replica single-fire, red-team injection suite

**Pillar B — Reliable Maya & Teamness:**
- [ ] **Phase 28: Maya Bug Fix + SDK Migration** — URGENT: @google/genai migration, AbortSignal.timeout(30s), thinking state cleanup, fallback threshold fix
- [ ] **Phase 29: Discovery Redesign + MVB Gate** — Bounded discovery (max 3 questions), background brain extraction, brain-satisfied prompt injection
- [ ] **Phase 30: Phase Machine + Blueprint + Skip-Maya** — conversations.mayaPhase column, [[PHASE:]] action block, BlueprintCard, skip-to-team escape hatch, phase regression guard
- [ ] **Phase 31: Deliverable Feedback + Graceful Degradation** — Accept/Dismiss deliverables, impression tracking, typed LLM error codes, non-blocking degradation banner
- [ ] **Phase 32: Cross-Project User Preferences** — users.preferences JSONB, inferred tone/verbosity, OWASP LLM01 sanitization, new-project inheritance
- [ ] **Phase 33: Dynamic Team Formation** — Gemini embedding cosine similarity, pre-cached role embeddings, TeamRecommendationCard, exploration role jitter
- [ ] **Phase 34: Per-Run Cost Visibility** — autonomy_events.cost_cents population, quota framing in UsageBar, per-run cost in Activity feed, in-character upgrade prompt

---

## Phase Details

### Phase 11: Sidebar Shell + Activity Feed
**Goal**: Users can see real-time autonomy activity in a tabbed right sidebar — the gating architectural foundation for the entire milestone
**Depends on**: Nothing (first phase of v1.3 milestone)
**Requirements**: SIDE-01, SIDE-02, SIDE-03, SIDE-04, FEED-01, FEED-02, FEED-03, FEED-04, FEED-05, AGNT-01
**Success Criteria** (what must be TRUE):
  1. User sees a right sidebar with three tabs (Activity, Brain & Docs, Approvals) and switching between them works without losing scroll position or draft state
  2. User sees a live activity feed that updates in real time as autonomous work happens, showing agent avatar, event description, and timestamp for each event
  3. User sees a stats card at the top of the Activity tab showing tasks completed, handoffs, and cost spent today
  4. User can filter the feed by event type, agent, or time range using filter chips without a page reload
  5. Agent avatars in the left sidebar and project tree show a pulsing ring when that agent is actively executing a background task
**Plans**: 3 plans
Plans:
- [ ] 11-01-PLAN.md — Data foundation: typed event registry, sidebar hooks, backend stats/events endpoints
- [ ] 11-02-PLAN.md — Tab shell: 3-tab RightSidebar restructure with CSS-hide, badges, empty states
- [ ] 11-03-PLAN.md — Activity feed UI: stats card, filter chips, feed items, agent working avatar

### Phase 12: Handoff Visualization
**Goal**: Users can see handoff chains between agents — both in the chat as styled cards and in the sidebar as a timeline
**Depends on**: Phase 11
**Requirements**: HAND-01, HAND-02, HAND-03, HAND-04
**Success Criteria** (what must be TRUE):
  1. When a handoff occurs, the chat panel shows a styled card with the from-agent avatar, an arrow, the to-agent avatar, and the task being handed off
  2. The Activity tab sidebar shows a vertical handoff chain timeline with animated connectors linking the sequence of agents involved in a multi-agent run
  3. User can initiate a manual handoff by clicking "Hand off to..." in the chat input and selecting a target agent from a dropdown
  4. When multiple agents are coordinating, user sees a collapsible deliberation indicator card in chat that can be expanded to show coordination details
**Plans**: 2 plans
Plans:
- [ ] 12-01-PLAN.md — HandoffCard + DeliberationCard in chat, CenterPanel wiring, handoff event dispatch
- [ ] 12-02-PLAN.md — HandoffChainTimeline in sidebar, manual handoff dropdown in chat input

### Phase 13: Approvals Hub + Task Pipeline
**Goal**: Users have a dedicated approvals surface and can see task progress across pipeline stages without digging through chat
**Depends on**: Phase 11
**Requirements**: APPR-01, APPR-02, APPR-03, APPR-04
**Success Criteria** (what must be TRUE):
  1. User can view all pending approval requests in the Approvals tab and approve or reject any item with a single click without leaving the sidebar
  2. User can see tasks organized by pipeline stage (Queued, Assigned, In Progress, Review, Done) in a view readable at the sidebar's narrow width
  3. When an approval expires, user sees a clear "expired" state on that item instead of a broken approve button or silent failure
  4. When no approvals are pending, the Approvals tab shows an engaging empty state explaining what the tab is for and how approvals are created
**Plans**: 2 plans

### Phase 14: Brain Redesign + Autonomy Settings
**Goal**: Users can build a real knowledge base by uploading documents to the project brain, and can configure how autonomously their Hatches operate
**Depends on**: Phase 11
**Requirements**: BRAIN-01, BRAIN-02, BRAIN-03, BRAIN-04
**Success Criteria** (what must be TRUE):
  1. User can drag-and-drop a PDF, DOCX, TXT, or MD file onto the Brain & Docs tab to upload it (up to 10MB), and the file's content becomes searchable context for Hatches
  2. Uploaded documents appear in a card-based list showing filename, type badge, upload date, and a delete button
  3. User can configure autonomy behavior via a settings panel: toggle autonomous execution on/off, set the inactivity trigger, and choose an autonomy level from a four-position dial (Observe / Propose / Confirm / Autonomous)
  4. User can browse completed work outputs from background agents in an expandable card view without scrolling through full chat history
**Plans**: 2 plans

### Phase 15: Polish
**Goal**: All new sidebar components feel premium and visually consistent with Hatchin's established design system
**Depends on**: Phases 11-14
**Requirements**: PLSH-01
**Success Criteria** (what must be TRUE):
  1. All new sidebar tab components use designs generated via Stitch/Magic MCPs and are visually indistinguishable from the quality level of existing Hatchin components
  2. New components are consistent in spacing, color usage, typography, and animation style with the established Tailwind design tokens and Framer Motion patterns across the app
**Plans**: 6 plans

### Phase 16: Database Foundation + Artifact Panel Shell
**Goal**: Users can open a split-panel artifact viewer beside chat that displays deliverables with attribution
**Depends on**: Phase 15
**Requirements**: ARTF-01, ARTF-02, ARTF-03, ARTF-04, COORD-01
**Plans**: Shipped

### Phase 17: Deliverable Generation + Schema Enforcement
**Goal**: Users can request a structured deliverable and watch it stream into the artifact panel
**Depends on**: Phase 16
**Requirements**: DLVR-01, DLVR-02, DLVR-03, DLVR-04, DLVR-05
**Plans**: Shipped

### Phase 18: Cross-Agent Deliverable Chains
**Goal**: Downstream Hatches produce linked documents that reference upstream content substantively
**Depends on**: Phase 17
**Requirements**: CHAIN-01, CHAIN-02, CHAIN-03, CHAIN-04, COORD-02
**Plans**: Shipped

### Phase 19: Organic Detection + Iteration UX
**Goal**: Hatches propose deliverables when conversation has sufficient context; iteration is surgical
**Depends on**: Phase 17
**Requirements**: DTCT-01, DTCT-02
**Plans**: Shipped

### Phase 20: Project Packages + Background Production
**Goal**: Users can trigger a coordinated multi-agent deliverable package and track progress
**Depends on**: Phase 18
**Requirements**: PKG-01, PKG-02, PKG-03
**Plans**: Shipped

### Phase 21: Zero-Friction Onboarding + PDF Export
**Goal**: First deliverable within 3 minutes of signup; any deliverable exportable as branded PDF
**Depends on**: Phases 19, 17
**Requirements**: ONBD-01, ONBD-02, XPRT-01, XPRT-02
**Plans**: Shipped

---

### Phase 22: Atomic Budget Enforcement
**Goal**: Concurrent background tasks can never bypass the per-project daily autonomy budget — the check-then-act race at `taskExecutionPipeline.ts:543-560` is closed by a transactional reserve/release ledger that is the single source of truth
**Depends on**: Nothing (first phase of v3.0; blocks Phase 24)
**Requirements**: BUDG-01, BUDG-02, BUDG-03
**Success Criteria** (what must be TRUE):
  1. When N concurrent autonomous tasks race for the last budget slot at a limit of K, exactly K succeed and N-K are blocked — verified by a concurrency integration test (e.g. 10 concurrent, K=5 → 5 pass, 5 blocked)
  2. When an autonomous task fails, is cancelled, or throws mid-execution, its reserved budget slot is released (idempotent by task_id) so no project can be permanently locked out by crashed jobs
  3. A daily reconciliation job runs and logs any drift between `autonomy_daily_counters.reserved_count` and the authoritative count from `autonomy_events` for that project+date
  4. The duplicate budget check in `chat.ts` inactivity trigger is removed — the pipeline helper is the only budget authority in the codebase
**Plans**: 3 plans
Plans:
- [ ] 22-01-PLAN.md — Schema + budgetLedger helpers (reserve/release) + Wave 0 unit & concurrency tests
- [ ] 22-02-PLAN.md — Pipeline rewire (atomic reserve, finally-block release) + remove duplicate chat.ts check
- [ ] 22-03-PLAN.md — Daily reconciliation job + cron wiring + Wave 0 drift-correction test

### Phase 23: Budget UX Surfaces
**Goal**: Users see their autonomy budget in real time, receive a soft warning before exhaustion, and get an in-character hard-stop (not a silent failure) when the cap hits — with the Free-tier upgrade path surfaced at the moment of friction
**Depends on**: Phase 22
**Requirements**: BUDG-04, BUDG-05, BUDG-06, BUDG-07, BUDG-08
**Success Criteria** (what must be TRUE):
  1. User sees autonomy budget consumption displayed alongside message budget in the existing UsageBar, updating in real time as autonomous tasks complete
  2. User receives a visible soft warning (toast or inline notice) at 80% autonomy budget consumption, distinct from the hard-stop at 100%
  3. When a user's autonomy budget is exhausted, Maya delivers an in-character message explaining the stop (no raw "quota exceeded" error) and the next unblock condition
  4. Every `budget_blocked` event appears in the Activity feed with timestamp, the task that was blocked, and the triggering agent
  5. A Free-tier user hitting the autonomy cap sees the existing UpgradeModal with autonomy-specific upgrade framing
**Plans**: TBD

### Phase 24: Scheduler Foundation
**Goal**: The system can reliably fire recurring autonomous tasks on a cron schedule across restarts and multi-node deploys — reusing the existing execution pipeline (budget, safety, peer review, handoffs, events) with zero duplicate code paths
**Depends on**: Phase 22 (budget must be atomic before scheduling multiplies concurrency)
**Requirements**: SCHED-01, SCHED-02, SCHED-03, SCHED-04, SCHED-05, SCHED-06, SCHED-07, SCHED-08, SCHED-09
**Success Criteria** (what must be TRUE):
  1. A developer/API consumer can create a scheduled routine via `POST /api/routines` with agent, cron expression, IANA timezone, and instruction — and see it fire at the next cron tick
  2. When a scheduled fire occurs, the routine enqueues a row into `tasks` and hands off to the existing `autonomous_task_execution` pg-boss queue — there is no parallel execution pipeline
  3. After each run, `last_run_status` and `last_run_task_id` on the routine are updated; after 3 consecutive failures the routine auto-pauses with `paused_reason` populated
  4. Deleting an agent or project cascades to remove the associated scheduled routines (no dangling pg-boss schedules)
  5. Only Pro-tier users can create routines (enforced by existing `tierGate` middleware); each project is capped at 10 active routines; on server boot all active routines re-register with pg-boss
**Plans**: TBD

### Phase 25: Chat-Native Routine Creation
**Goal**: Users create routines by talking to a Hatch in plain English ("Kai, draft the growth update every Monday at 9am") — no cron UI, no settings panel, just a conversation that returns an in-character confirmation card and resists prompt-injection attacks through the scheduled phrase
**Depends on**: Phase 24
**Requirements**: CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-05, CHAT-06
**Success Criteria** (what must be TRUE):
  1. When a user messages an agent with a natural-language schedule phrase, the agent responds with an in-character confirmation card showing the parsed cron, timezone, and task template — no routine is created until the user confirms
  2. The `intentClassifier` emits `SCHEDULE_REQUEST` before `EXPLICIT_TASK_REQUEST` on ambiguous phrases like "create a task to send the update every Monday" (schedule intent wins)
  3. `schedulePhraseParser` converts supported NL phrases ("every Monday", "daily at 9am", "every weekday morning") into valid cron expressions plus an IANA timezone string
  4. User can dismiss the confirmation card inline and no routine is persisted, no pg-boss schedule is registered
  5. NL instructions passed into downstream LLM prompts are capped at 500 characters and wrapped in delimited untrusted-data framing so adversarial schedule text cannot escape the data boundary
**Plans**: TBD

### Phase 26: Routines Management Panel
**Goal**: Users can see, manage, and trust their scheduled routines from a dedicated sidebar surface — visibility on next run, recent history, cost, and clear controls (pause/resume/run-now/delete) without digging through chat
**Depends on**: Phase 24
**Requirements**: MGMT-01, MGMT-02, MGMT-03, MGMT-04, MGMT-05, MGMT-06, MGMT-07, MGMT-08
**Success Criteria** (what must be TRUE):
  1. User opens the right sidebar and finds a Routines tab listing every active routine for the project, each card showing agent avatar, human-readable schedule, next run time, and last run status
  2. User can pause, resume, manually trigger ("Run now"), or delete any routine directly from its card — state changes reflect immediately in the UI and in pg-boss
  3. User can expand a routine card to see the last 30 runs with per-run status and cost
  4. Failed routine runs appear in Maya's return briefing when the user re-opens the app after being away; unread completions surface as a badge on the Routines tab
**Plans**: TBD

### Phase 27: Polish + Integration Hardening
**Goal**: The correctness guarantees v3.0 promises are backed by mechanical tests — concurrency under load, DST transitions, multi-replica single-fire, and a red-team prompt-injection suite — so we ship with proof, not hope
**Depends on**: Phases 22-26
**Requirements**: VER-01, VER-02, VER-03, VER-04
**Success Criteria** (what must be TRUE):
  1. A concurrent-execution test spins up 10 parallel jobs against a budget limit of 5 and the test asserts exactly 5 pass and 5 are blocked — test is part of CI
  2. A fixed-date DST transition test (spring-forward and fall-back) proves routines fire at the correct wall-clock time in the configured IANA timezone
  3. A multi-replica test proves pg-boss fires each scheduled routine exactly once across N replicas — no double execution
  4. A red-team prompt-injection suite of ≥15 adversarial NL schedule phrases runs in CI and none escape the delimited framing introduced in Phase 25
**Plans**: TBD

---

### Phase 28: Maya Bug Fix + SDK Migration
**Goal**: Maya responds reliably — infinite "thinking" state is eliminated, the @google/generative-ai SDK is migrated to @google/genai, every LLM request has a 30-second hard timeout, and the "out for lunch" fallback only fires on confirmed errors — unblocking user testing today
**Depends on**: Nothing (independent of Pillar A; ships in parallel)
**Requirements**: BUG-01, BUG-02, BUG-03, BUG-04, BUG-05, BUG-06
**Success Criteria** (what must be TRUE):
  1. When a Gemini request legitimately takes 4-8 seconds (normal for complex prompts), Maya's thinking indicator stays visible and no fallback "out for lunch" message appears
  2. When any LLM request exceeds 30 seconds with no response, the thinking indicator clears within 1 second and the user sees an inline error message — never a frozen UI
  3. The `@google/generative-ai` package is replaced by `@google/genai` in package.json and all import sites — the old package is fully removed from the dependency tree
  4. A load test confirming 50 concurrent aborted requests shows no dangling AbortController references in heap snapshots (no memory leak)
  5. The "out for lunch" / "resting circuits" fallback message is absent from all browser sessions that complete streaming within 30 seconds, verified by the E2E test suite
  6. After a Hatch finishes responding via either `streaming_completed` or plain `chat_message`, the chat input stop button reverts to "send" within 1 second — verified by Playwright spec asserting the button switches from `stop` to `send` within 1s of the last assistant message landing in the DOM
**Plans**: TBD

### Phase 29: Discovery Redesign + MVB Gate
**Goal**: Maya asks focused questions in batches and stops interrogating once the project brain has the minimum viable context — the discovery phase ends, it does not loop forever
**Depends on**: Phase 28 (SDK migration must be stable before new LLM prompt logic is layered on top)
**Requirements**: DISC-01, DISC-02, DISC-03, MVB-01, MVB-02, MVB-03
**Success Criteria** (what must be TRUE):
  1. Maya never sends more than 3 questions in a single message — verified by the discovery prompt test suite and a turn-counter safety net in the response post-processing step
  2. When Maya asks multiple questions, they appear grouped by category (Features / Visuals / Tech) so the user can read and answer them together without visual noise
  3. Maya does not re-ask a question the user already answered — deduplication runs a context check against the conversation history before generating each question batch
  4. After the user provides their project description and answers, background extraction silently populates `projects.coreDirection` fields (`whatBuilding`, `whoFor`, `whyMatters`) without requiring action blocks from Maya
  5. Once all three MVB fields are non-empty, Maya receives a `BRAIN_SATISFIED` prompt injection and stops asking discovery questions — the next Maya turn advances toward blueprint draft
**Plans**: TBD

### Phase 30: Phase Machine + Blueprint + Skip-Maya
**Goal**: Conversations have an intentional flow — discovery, blueprint, then specialists — Maya hands off at the right moment, users can confirm the blueprint before work starts, and power users can bypass discovery entirely with a simple form
**Depends on**: Phase 29 (MVB gate must be active so blueprint fires at the right threshold)
**Requirements**: PHASE-01, PHASE-02, PHASE-03, PHASE-04, BLPR-01, BLPR-02, BLPR-03, BLPR-04, BLPR-05, BLPR-06, SKIP-01, SKIP-02, SKIP-03, SKIP-04
**Success Criteria** (what must be TRUE):
  1. After closing and reopening the browser mid-discovery, the conversation resumes at the same phase (discovery/blueprint/executing) — the phase indicator in the chat header shows the correct state without a page refresh
  2. When the MVB threshold is satisfied, Maya presents an inline BlueprintCard showing project name, a one-paragraph summary, 3 suggested first tasks, and 3-4 recommended roles — no further discovery questions appear
  3. User can click "Looks good — start building" on the BlueprintCard and tasks are created exactly once (double-clicking the button does not produce duplicate tasks due to idempotency key)
  4. User can type inline revisions on the BlueprintCard ("change the target audience to enterprise") and Maya regenerates the blueprint incorporating the revision without restarting discovery
  5. The onboarding and project creation flow surfaces a visible "Skip to my team" path that shows 3 labeled fields — user fills them in, project jumps directly to executing phase, and that preference is remembered for future projects
**Plans**: TBD

### Phase 31: Deliverable Feedback + Graceful LLM Degradation + Production Polish
**Goal**: Users can signal whether deliverables are good or not (so quality compounds), LLM provider failures show inline banners (not raw 500s), and the production landing page closes two compliance/UX gaps surfaced by the Playwright audit
**Depends on**: Nothing new (deliverable columns are schema additions; degradation extends existing providerResolver.ts; legal/auth-gate are SPA additions)
**Requirements**: FBK-01, FBK-02, FBK-03, FBK-04, LLMUX-01, LLMUX-02, LLMUX-03, LLMUX-04, LEGAL-01, AUTH-GATE-01
**Success Criteria** (what must be TRUE):
  1. User can click Accept or Dismiss on any deliverable in the artifact panel — Accept sets `userAcceptedAt`, Dismiss sets `dismissedAt`, and both actions persist across page refreshes
  2. Every time a user opens a deliverable in the artifact panel, `impressionCount` increments — the funnel data is interpretable because opened-but-never-accepted deliverables are visible in the record
  3. An agent's system prompt includes a feedback signal for its role ("your last 3 PRDs were accepted, 1 was dismissed for being too long") after the feedback data accumulates — quality compounds with use
  4. When all LLM providers fail, the chat panel shows a non-blocking banner ("Agents are slow right now, hang tight") and the banner auto-dismisses after the next successful response — users never see a raw HTTP 500 error
  5. A Gemini 429 rate-limit error routes directly to the Groq fallback without triggering the degradation banner — only true provider outages surface the banner (rate limits do not count as degradation)
  6. Production landing page footer renders visible Privacy and Terms links pointing to `/legal/privacy` and `/legal/terms` — the public Playwright spec for landing legal links passes
  7. Unauthenticated visits to `/account` and `/maya/:id` redirect to `/login` instead of loading a blank SPA shell — verified by Playwright public-flow test
**Plans**: TBD

### Phase 32: Cross-Project User Preferences
**Goal**: Hatchin learns how each user works — tone, verbosity, technical depth — from the first project and applies that context to every subsequent project automatically, with no friction and no prompt injection surface
**Depends on**: Phase 30 (phase machine provides a stable project-completion signal for preference inference timing)
**Requirements**: PREF-01, PREF-02, PREF-03, PREF-04, PREF-05
**Success Criteria** (what must be TRUE):
  1. After a conversation reaches 10+ user turns, Groq extraction runs and populates `users.preferences` JSONB with inferred tone, verbosity, and technicalDepth — no explicit preference form appears and no user action is required
  2. A new project created after preferences are inferred receives them automatically — the first agent response in the new project reflects the user's established style without the user re-explaining it
  3. Preferences are injected as a user-context block (not system role) — a test adversarial preference value containing prompt-injection text does not alter system-level instructions in the LLM output
  4. Enum preference fields (tone: direct/friendly/formal) are validated against an allowlist on write — arbitrary instruction-format strings are rejected and do not reach the database
**Plans**: TBD

### Phase 33: Dynamic Team Formation
**Goal**: Users starting a freeform project get a focused 3-4 agent recommendation matched to their project description — not all 30 agents at once — with a rationale for each pick and one exploratory suggestion to encourage discovery
**Depends on**: Phase 28 (requires @google/genai SDK for Gemini Embedding API), Phase 30 (blueprint's whatBuilding text is the primary input to the recommender)
**Requirements**: FORM-01, FORM-02, FORM-03, FORM-04
**Success Criteria** (what must be TRUE):
  1. When a user creates a freeform project (not a starter pack), the system presents a TeamRecommendationCard showing 3-4 agents with a one-sentence rationale per role — no recommendation is shown for starter pack projects
  2. Sending the same project description twice does not always return identical teams — the exploration role (one role sampled from below the top-3 cosine similarity threshold) and small score jitter produce varied recommendations
  3. Role embeddings are pre-computed at server startup and served from memory — team recommendation adds less than 200ms to project creation latency (no per-request Gemini embedding API call)
  4. All 30 agents remain accessible via the "Add Hatch" modal regardless of the recommendation — the recommendation augments the default, it does not replace the full roster
**Plans**: TBD

### Phase 34: Per-Run Cost Visibility
**Goal**: Pro users see how many autonomy runs they have used today in quota terms, can trace each run's cost in the Activity feed, and hit an in-character upgrade prompt when the cap is reached — dollar amounts never appear in the primary UI
**Depends on**: Phase 22 (autonomy_events table is the source of truth), Phase 23 (UsageBar is the display surface)
**Requirements**: COST-01, COST-02, COST-03, COST-04
**Success Criteria** (what must be TRUE):
  1. After an autonomous task completes, its `autonomy_events` row has a non-null `cost_cents` value populated from `usageTracker.estimateCostCents()` — visible in the DB record and verified by integration test
  2. The UsageBar shows autonomy run quota in the form "47 of 50 runs remaining today" — raw dollar amounts do not appear anywhere in the primary UI (Activity feed, UsageBar, or chat messages)
  3. Each completed autonomy run in the Activity feed shows a quota delta label ("Kai drafted growth update · 1 run") — cost is framed as run consumption, not money spent
  4. A Free-tier user who reaches the autonomy cap sees Maya deliver an in-character message explaining the pause and offering an upgrade path — the raw "quota exceeded" string never appears in the UI
**Plans**: TBD

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Hatch Conversation Quality | v1.0 | — | Complete | 2026-03-19 |
| 2. User Journey Fixes | v1.0 | — | Complete | 2026-03-19 |
| 3. Hatch Presence and Avatar System | v1.0 | — | Complete | 2026-03-19 |
| 4. Data Reliability and Resilience | v1.0 | — | Complete | 2026-03-19 |
| 5. Route Architecture Cleanup | v1.0 | — | Complete | 2026-03-19 |
| 6. Background Execution Foundation | v1.1 | — | Complete | 2026-03-23 |
| 7. Agent Handoffs and Approval UI | v1.1 | — | Complete | 2026-03-23 |
| 8. Chat Summary and Tab Notifications | v1.1 | — | Complete | 2026-03-23 |
| 9. Progressive Trust and Inactivity Trigger | v1.1 | — | Complete | 2026-03-23 |
| 10. Billing + LLM Intelligence | v1.2 | — | Complete | 2026-03-23 |
| 11. Sidebar Shell + Activity Feed | v1.3 | 3/3 | Complete | 2026-03-25 |
| 12. Handoff Visualization | v1.3 | 2/2 | Complete | 2026-03-25 |
| 13. Approvals Hub + Task Pipeline | v1.3 | 2/2 | Complete | 2026-03-26 |
| 14. Brain Redesign + Autonomy Settings | v1.3 | 2/2 | Complete | 2026-03-26 |
| 15. Polish | v1.3 | 6/6 | Complete | 2026-03-30 |
| 16. Database Foundation + Artifact Panel Shell | v2.0 | — | Complete | 2026-03-30 |
| 17. Deliverable Generation + Schema Enforcement | v2.0 | — | Complete | 2026-03-30 |
| 18. Cross-Agent Deliverable Chains | v2.0 | — | Complete | 2026-03-30 |
| 19. Organic Detection + Iteration UX | v2.0 | — | Complete | 2026-03-30 |
| 20. Project Packages + Background Production | v2.0 | — | Complete | 2026-03-30 |
| 21. Zero-Friction Onboarding + PDF Export | v2.0 | — | Complete | 2026-03-30 |
| 22. Atomic Budget Enforcement | 3/3 | Complete    | 2026-04-26 | - |
| 23. Budget UX Surfaces | v3.0 | 0/? | Not started | - |
| 24. Scheduler Foundation | v3.0 | 0/? | Not started | - |
| 25. Chat-Native Routine Creation | v3.0 | 0/? | Not started | - |
| 26. Routines Management Panel | v3.0 | 0/? | Not started | - |
| 27. Polish + Integration Hardening | v3.0 | 0/? | Not started | - |
| 28. Maya Bug Fix + SDK Migration | v3.0 | 0/? | Not started | - |
| 29. Discovery Redesign + MVB Gate | v3.0 | 0/? | Not started | - |
| 30. Phase Machine + Blueprint + Skip-Maya | v3.0 | 0/? | Not started | - |
| 31. Deliverable Feedback + Graceful Degradation | v3.0 | 0/? | Not started | - |
| 32. Cross-Project User Preferences | v3.0 | 0/? | Not started | - |
| 33. Dynamic Team Formation | v3.0 | 0/? | Not started | - |
| 34. Per-Run Cost Visibility | v3.0 | 0/? | Not started | - |

---
*Roadmap created: 2026-03-17*
*v1.0 shipped: 2026-03-19*
*v1.1 shipped: 2026-03-23*
*v1.2 shipped: 2026-03-23*
*v1.3 shipped: 2026-03-29*
*v2.0 shipped: 2026-03-30*
*v3.0 roadmap (Pillar A) added: 2026-04-13*
*v3.0 roadmap (Pillar B) added: 2026-04-25*
