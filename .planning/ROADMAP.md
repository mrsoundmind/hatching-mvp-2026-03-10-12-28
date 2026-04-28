# Roadmap: Hatchin

## Milestones

- ✅ **v1.0 Text-Perfect, Human-First** — Phases 1-5 (shipped 2026-03-19) — [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 Autonomous Execution Loop** — Phases 6-9 (shipped 2026-03-23) — [archive](milestones/v1.1-ROADMAP.md)
- ✅ **v1.2 Billing + LLM Intelligence** — Phase 10 (shipped 2026-03-23) — [archive](milestones/v1.2-ROADMAP.md)
- ✅ **v1.3 Autonomy Visibility & Right Sidebar Revamp** — Phases 11-15 (shipped 2026-03-29)
- ✅ **v2.0 Hatches That Deliver** — Phases 16-21 (shipped 2026-03-30)
- ⚠️ **v3.0 Hatchin That Works** — Phases 22 + 28 shipped; Phases 23-27, 29-34 re-scoped into V3 (closed 2026-04-28) — [archive](milestones/v3.0-ROADMAP.md)
- 🚧 **v2.1 Hatches That Self-Improve** — Phases 35-46 (12 phases, 5-7w est. — in progress)
- 📋 **Future:** v2.1.5, v2.2, v2.3, v2.4, v2.5, v2.5.5, v2.6, v2.7, v3.0 (Mental Models), v4.0 — see [ROADMAP-V3.md](ROADMAP-V3.md) for full post-v2.0 plan

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

<details>
<summary>✅ v1.3 Autonomy Visibility & Right Sidebar Revamp (Phases 11-15) — SHIPPED 2026-03-29</summary>

**Key deliverables:** Tabbed right sidebar (Activity/Brain & Docs/Approvals), live autonomy event feed, handoff visualization, agent working-state avatar, approvals hub, task pipeline, project brain file upload, autonomy settings dial, work output viewer, premium polish across new components.

**Phases completed:**
- Phase 11: Sidebar Shell + Activity Feed
- Phase 12: Handoff Visualization
- Phase 13: Approvals Hub + Task Pipeline
- Phase 14: Brain Redesign + Autonomy Settings
- Phase 15: Polish

</details>

<details>
<summary>✅ v2.0 Hatches That Deliver (Phases 16-21) — SHIPPED 2026-03-30</summary>

**Key deliverables:** Split-panel artifact viewer, schema-enforced deliverable generation, cross-agent document chains (3 templates: launch / content-sprint / research), project packages, organic detection, professional PDF export, zero-friction onboarding (PackageSuggestionCard).

**Phases completed:**
- Phase 16: Database Foundation + Artifact Panel Shell
- Phase 17: Deliverable Generation + Schema Enforcement
- Phase 18: Cross-Agent Deliverable Chains
- Phase 19: Organic Detection + Iteration UX
- Phase 20: Project Packages + Background Production
- Phase 21: Zero-Friction Onboarding + PDF Export

</details>

<details>
<summary>⚠️ v3.0 Hatchin That Works (Phases 22, 28 shipped; rest re-scoped) — CLOSED PARTIAL 2026-04-28</summary>

See archived roadmap: [milestones/v3.0-ROADMAP.md](milestones/v3.0-ROADMAP.md)

**Shipped:**
- Phase 22: Atomic Budget Enforcement (BUDG-01..03 — ledger + reserve/release + daily reconciliation cron at `5 0 * * *` UTC)
- Phase 28: Maya Bug Fix + SDK Migration (BUG-01..06 — `@google/genai`, AbortSignal end-to-end, heap leak closed, stop button reset)
- Hotfix `quick-260427-ojf`: DB-CRASH-01 (Neon idle-in-transaction recovery + traceStore transaction-leak)

**Re-scoped to V3 milestones (68 of 77 requirements):**
- BUDG-04..08 + SCHED + CHAT + MGMT + VER (32 reqs) → v2.7 Pillar 5 + Pillar 3
- DISC + MVB + PHASE + BLPR + SKIP (20 reqs) → v2.1 Pillars 6, 7, 8, 10
- FBK + LLMUX (8 reqs) → v2.1 Pillar 1 + Phase 1 hotfix
- COST (4 reqs) → v2.1 Pillar 9
- FORM (4 reqs) → v2.3 Pillar 7
- PREF (5 reqs) → v3.0 (Mental Models in V3) Pillar 4
- LEGAL-01 partial (links shipped, pages 404) → v2.1 Phase 1
- AUTH-GATE-01: ✅ verified already shipped (audit confirmed `<AuthGuard>` redirects)

**Why partial close-out:** Apr 25–28 deep audit (18 repo evaluations + 15-item gap audit) produced ROADMAP-V3, which restructured the unfinished v3.0 work under a unified post-v2.0 plan. No work abandoned — re-scoped, not dropped.

</details>

---

## 🚧 v2.1 Hatches That Self-Improve (In Progress)

**Milestone Goal:** Make autonomous Hatch work *trustworthy*. Refinements stop making things worse silently. Maya knows when she has enough context. Power users can skip discovery.

**Effort:** 5-7 weeks · **Hard dependency:** none (foundation milestone for V3 critical path)

**Source:** ROADMAP-V3 v2.1 pillars (1-11) + audit-corrected Phase 0 hotfix consolidated as Phase 35.

### Phases

- [ ] **Phase 35: Production Hotfix Pass** — LEGAL-01 page content + routes; LLMUX-01..03 graceful degradation banner; AUDIT-01 runtime verification spec
- [ ] **Phase 36: Frozen-Rubric Deliverable Iteration** — Per-type rubric scoring, auto-revert on score regression, deliverable feedback columns
- [ ] **Phase 37: Git-Style Run Tree** — `autonomy_runs` + `autonomy_run_steps` tables, sidebar tree visualization with score-delta badges
- [ ] **Phase 38: "Never Stop, Never Ask" Autonomy Prompt** — Level-4 autonomy stops asking clarifying questions during chains
- [ ] **Phase 39: Reader Testing Peer Review Mode** — Context-naïve fresh reviewer for doc-type deliverables
- [ ] **Phase 40: Internal Eval Migration to promptfoo** — Replace bespoke `scripts/test-*` with promptfoo testcases; CI-gated regression detection
- [ ] **Phase 41: Conversation Phase Machine + Blueprint** — Discovery → Draft → Building states; BlueprintCard handoff with idempotent task gen
- [ ] **Phase 42: Minimum-Viable-Brain Gate** — Maya stops asking once `whatBuilding` + `whoFor` + `whyMatters` are populated; bounded discovery (≤3 questions)
- [ ] **Phase 43: Skip-Maya Escape Hatch** — Power-user 3-field form bypasses discovery entirely; preference remembered
- [ ] **Phase 44: Per-Run Cost Visibility** — `autonomy_events.cost_cents`, quota framing in UsageBar, per-run delta in Activity feed
- [ ] **Phase 45: Maya 3-Stage Interrogation** — gstack /office-hours pattern: idea spike → context build → blueprint draft, bounded per stage
- [ ] **Phase 46: AI Slop Detection** — Peer-review lens for copy-producing roles flags AI-tone patterns (advisory, not blocking)

---

## v2.1 Phase Details

### Phase 35: Production Hotfix Pass
**Goal**: Close two production gaps surfaced by Apr 28 audit (Privacy/Terms 404, missing graceful-degradation banner) — ship the smallest set of changes that takes the public surface from "almost-trustworthy" to "audit-clean."
**Depends on**: Nothing (first phase of v2.1)
**Requirements**: LEGAL-01, LLMUX-01, LLMUX-02, LLMUX-03, AUDIT-01
**Success Criteria** (what must be TRUE):
  1. Clicking "Privacy" or "Terms" from the landing footer or login page loads non-404 production-ready legal copy
  2. When all LLM providers fail simultaneously, the chat shows a non-blocking banner ("Agents are slow right now, hang tight") within 1 second; users never see a raw HTTP 500
  3. Banner auto-dismisses within 5 seconds of the next successful streamed response (recovery signal works)
  4. A Gemini 429 rate-limit error routes to the next provider and does NOT trigger the banner (rate limits ≠ degradation)
  5. Playwright runtime spec verifies all 4 above end-to-end against a live restarted dev server
**Plans**: 5 plans

  - [ ] 35-01-PLAN.md — Foundation: WS schema additions (PROVIDER_DEGRADED/RECOVERED) + provider-health sliding-window counter module + DEV-only outage injector unit tests
  - [ ] 35-02-PLAN.md — Server-side: wire counter into providerResolver fallback chain, broadcast PROVIDER_DEGRADED on 3-in-60s exhaustion, broadcastToAllSockets helper (LLMUX-01)
  - [ ] 35-03-PLAN.md — Client-side: PROVIDER_DEGRADED/RECOVERED handlers in CenterPanel.tsx → persistent shadcn toast with default copy + recovery dismiss (LLMUX-02, LLMUX-03)
  - [ ] 35-04-PLAN.md — Public legal pages: PrivacyPage + TermsPage + LegalPageLayout, registered routes in App.tsx, DRAFT marker per D-04 (LEGAL-01)
  - [ ] 35-05-PLAN.md — Playwright spec: 4-case smoke against live dev server, DEV-only force-outage admin endpoint with production guard (AUDIT-01)

### Phase 36: Frozen-Rubric Deliverable Iteration
**Goal**: Every deliverable refinement is scored against a locked, type-specific rubric. New version < old version → auto-revert. Quality compounds through the feedback columns.
**Depends on**: Phase 35
**Requirements**: RUBR-01, RUBR-02, RUBR-03, RUBR-04, FBK-01, FBK-02, FBK-03, FBK-04
**Success Criteria** (what must be TRUE):
  1. Each of the 15 deliverable types has a frozen 0–10 rubric stored as code-versioned schema; rubric content cannot drift between iterations of the same version
  2. When a refinement scores lower than the previous version, the system auto-reverts and surfaces "Refinement made it worse, kept previous version" inline in the artifact panel
  3. User can click Accept or Dismiss on any deliverable in the artifact panel; both actions persist across page refreshes via the new feedback columns
  4. Agent prompts include role-specific feedback signal ("your last 3 PRDs were accepted, 1 dismissed") after enough impressions accumulate — verified via prompt-snapshot test
  5. `impressionCount` increments every time a deliverable is opened in the artifact panel; opened-but-never-accepted deliverables are visible in the funnel record
**Plans**: TBD (likely 3-4 plans)

### Phase 37: Git-Style Run Tree
**Goal**: Autonomous execution becomes browsable history — every task and handoff is a step node in a parent-child tree. Score deltas (from Phase 36) attach to nodes so users can see where quality regressed or improved.
**Depends on**: Phase 36 (rubric scores feed step deltas)
**Requirements**: TREE-01, TREE-02, TREE-03, TREE-04, TREE-05
**Success Criteria** (what must be TRUE):
  1. New `autonomy_runs` and `autonomy_run_steps` schema models autonomous chains as a DAG with parent-child step relationships
  2. Every autonomous task and handoff writes a step row including agent, role, deliverable_version_id (when applicable), and rubric score delta
  3. Activity-tab sidebar visualizes the run tree per project — collapsible nodes with score-delta badges (+1.2 / -0.8 / new) per step
  4. Clicking a step node opens the deliverable version it produced and its rubric breakdown
  5. Migration backfills existing `autonomy_events` rows so historical projects show meaningful trees (not empty for pre-migration runs)
**Plans**: TBD (likely 3 plans)

### Phase 38: "Never Stop, Never Ask" Autonomy Prompt
**Goal**: At max autonomy (level 4), Hatches commit to the chain — they finish what they started instead of pausing for clarification.
**Depends on**: Nothing (independent of other v2.1 phases)
**Requirements**: ALWY-01, ALWY-02, ALWY-03
**Success Criteria** (what must be TRUE):
  1. When `autonomy_level === 4`, agent system prompts include "Never Stop, Never Ask" framing — verified via prompt-snapshot test
  2. Conversation flow integration test confirms level-4 Hatches do NOT emit clarifying questions during autonomous execution (golden-path scenario)
  3. User downgrading to level 3 mid-run applies on next step — the in-flight step completes under the level-4 prompt for consistency
**Plans**: TBD (likely 1-2 plans)

### Phase 39: Reader Testing Peer Review Mode
**Goal**: Doc-type deliverables get a fresh-eyes review before delivery — a reviewer that has never seen the conversation context. Catches "this only makes sense if you wrote it" failures.
**Depends on**: Phase 36 (rubric infrastructure)
**Requirements**: READ-01, READ-02, READ-03, READ-04
**Success Criteria** (what must be TRUE):
  1. New `peerReviewMode: 'reader-test'` lens activates for doc-type deliverables (PRD, blog post, email, copy, brief, social post)
  2. Reader-test reviewer receives ONLY the deliverable + project name + role context — never the conversation history that produced it (verified via prompt-snapshot test)
  3. Reader-test review produces line-level annotations flagging "this assumes context the reader doesn't have" — annotations attach to the deliverable version
  4. Author Hatch's iteration response addresses each reader-test annotation; revision impact tracked as rubric score delta
**Plans**: TBD (likely 2 plans)

### Phase 40: Internal Eval Migration to promptfoo
**Goal**: Replace bespoke `scripts/test-tone.ts`, `test-injection.ts`, `eval-routing.ts` with promptfoo. Standard infra, comparable across model upgrades, CI-gated.
**Depends on**: Nothing (independent infra cleanup)
**Requirements**: EVAL-01, EVAL-02, EVAL-03, EVAL-04
**Success Criteria** (what must be TRUE):
  1. promptfoo installed; `eval/` directory restructured around promptfoo config files (one config per existing eval target)
  2. Existing `scripts/test-tone.ts`, `test-injection.ts`, `eval-routing.ts` ported to promptfoo testcases — pass/fail parity with the original scripts
  3. CI runs promptfoo eval against mock provider on every PR; failure blocks merge with the same severity as current tests
  4. Eval results stored as artifacts comparable across runs; regression detection works across at least 2 consecutive CI runs
**Plans**: TBD (likely 2 plans)

### Phase 41: Conversation Phase Machine + Blueprint
**Goal**: Conversations have intentional flow — Discovery → Draft → Building. Maya hands off via a confirmable BlueprintCard. Phase persists across reconnects.
**Depends on**: Phase 35 (LLMUX banner gives degraded-state phase indicator a visible parent)
**Requirements**: PHASE-01, PHASE-02, PHASE-03, PHASE-04, BLPR-01, BLPR-02, BLPR-03, BLPR-04, BLPR-05, BLPR-06
**Success Criteria** (what must be TRUE):
  1. After closing and reopening the browser mid-discovery, the conversation resumes at the same phase — phase indicator in chat header shows correct state without page refresh
  2. BlueprintCard renders inline in chat after MVB threshold (Phase 42) is met, showing project name, summary, 3 first tasks, 3-4 recommended roles
  3. Clicking "Looks good — start building" creates tasks exactly once (idempotency key prevents duplicates on double-click)
  4. User can type freeform revisions inline ("change palette to pastels") and Maya regenerates the blueprint without restarting discovery
  5. Phase regression (user types "let's restart") cancels in-flight pg-boss jobs to prevent stale-blueprint execution
  6. After confirmation, Maya releases primary speaking authority; PM Alex becomes default project speaker
**Plans**: TBD (likely 4 plans)

### Phase 42: Minimum-Viable-Brain Gate
**Goal**: Maya stops asking discovery questions once the project brain has the minimum viable context. Bounded discovery (≤3 questions per turn) prevents Maya from spinning forever.
**Depends on**: Phase 41 (phase machine provides the destination once gate fires)
**Requirements**: MVB-01, MVB-02, MVB-03, DISC-01, DISC-02, DISC-03
**Success Criteria** (what must be TRUE):
  1. System defines minimum brain schema: `whatBuilding`, `whoFor`, `whyMatters` all non-empty in `projects.coreDirection`
  2. Background extractor populates brain fields from every Maya discovery turn (mirrors `organicExtractor.ts` pattern; runs in parallel to gate check)
  3. When MVB threshold is satisfied, Maya receives a `BRAIN_SATISFIED` prompt injection and the next turn drafts the BlueprintCard (no further discovery questions)
  4. Maya never asks more than 3 questions in a single message — verified by discovery prompt test suite + turn-counter safety net in response post-processing
  5. Maya does not re-ask a question already answered in conversation history — deduplication context check runs before each question batch
**Plans**: TBD (likely 3 plans)

### Phase 43: Skip-Maya Escape Hatch
**Goal**: Power users opt out of discovery entirely with a 3-field form mapped directly to MVB schema. Preference remembered for future projects.
**Depends on**: Phase 42 (MVB schema is the form's target)
**Requirements**: SKIP-01, SKIP-02, SKIP-03, SKIP-04
**Success Criteria** (what must be TRUE):
  1. Onboarding and project creation surface a visible "Skip to my team" path — visible without scrolling, accessible via keyboard
  2. Skip path shows 3 labeled fields (`What you're building` / `Who it's for` / `Why it matters`); submitted values populate `projects.coreDirection`
  3. On submit, project advances directly to `executing` phase — no Maya discovery turn, blueprint auto-generated from the 3 fields
  4. User preference to skip Maya is remembered (`users.preferences.skipMayaOnboarding` flag); future projects default to the skip path until preference is reset
**Plans**: TBD (likely 2 plans)

### Phase 44: Per-Run Cost Visibility
**Goal**: Pro users see autonomy quota in the UsageBar in run terms (not dollars). Activity feed shows per-run cost as quota delta. Free-tier users hitting cap see in-character upgrade prompt.
**Depends on**: Nothing (independent of conversation/blueprint flow)
**Requirements**: COST-01, COST-02, COST-03, COST-04
**Success Criteria** (what must be TRUE):
  1. After an autonomous task completes, its `autonomy_events` row has a non-null `cost_cents` value populated from `usageTracker.estimateCostCents()`
  2. UsageBar shows autonomy run quota in the form "47 of 50 runs remaining today" — raw dollar amounts do not appear anywhere in primary UI (UsageBar, Activity feed, chat)
  3. Each completed autonomy run in the Activity feed shows a quota delta label ("Kai drafted growth update · 1 run") — never "$0.03"
  4. A Free-tier user reaching the autonomy cap sees Maya deliver an in-character message offering an upgrade path — the raw "quota exceeded" string never appears in the UI
**Plans**: TBD (likely 2 plans)

### Phase 45: Maya 3-Stage Interrogation
**Goal**: Maya's project-kickoff is structured into 3 explicit stages (idea spike → context build → blueprint draft) with bounded question budget per stage. Reduces "infinite discovery" failure mode.
**Depends on**: Phase 41 (phase machine), Phase 42 (MVB threshold gates Stage 3)
**Requirements**: INTR-01, INTR-02, INTR-03, INTR-04, INTR-05
**Success Criteria** (what must be TRUE):
  1. Maya kickoff prompt explicitly distinguishes 3 stages with bounded question budget: idea spike (≤1 q), context build (≤3 q × max 2 turns), blueprint draft (0 q)
  2. Stage 1 asks at most 1 question that captures "what are you building" before any context probing
  3. Stage 2 covers `whoFor`, `whyMatters`, and top-of-mind constraint within the question budget; transitions to Stage 3 when MVB threshold is met
  4. Stage 3 produces the BlueprintCard with no further questions; integrates seamlessly with Phase 41's `[[PHASE: blueprint]]` action block
  5. Stage transitions are visible to user as subtle phase indicator (chat header text); user cannot manually advance — only the conversation does
**Plans**: TBD (likely 2 plans)

### Phase 46: AI Slop Detection
**Goal**: Copy-producing Hatches (Cleo, Wren, Mira, Kai, Drew, Pixel) self-flag generic AI-tone patterns before delivery. Advisory (not blocking) — author can revise.
**Depends on**: Phase 36 (peer-review-lens infrastructure)
**Requirements**: SLOP-01, SLOP-02, SLOP-03, SLOP-04
**Success Criteria** (what must be TRUE):
  1. New peer-review lens `slop-check` scans for AI-tone patterns ("In today's fast-paced world", excessive em-dashes, hedging filler, "It's important to note") versioned in `shared/slopPatterns.ts`
  2. Slop-check runs automatically on copy-producing roles for content-type deliverables (blog post, email, copy, brief, social post)
  3. Slop-check failures are advisory (not blocking) — author Hatch sees flag with specific phrases; can accept or revise
  4. Detection patterns evolve via PR — `shared/slopPatterns.ts` is the curated source-of-truth file; pattern additions pass code review

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
| 22. Atomic Budget Enforcement | v3.0 | 3/3 | Complete | 2026-04-26 |
| 23-27. Budget UX + Scheduling + Routines + Verification | v3.0 | — | Re-scoped to V3 v2.7 | 2026-04-28 |
| 28. Maya Bug Fix + SDK Migration | v3.0 | 5/5 | Complete | 2026-04-27 |
| 29-34. Discovery + Phase Machine + Blueprint + Skip + Feedback + Degradation + Prefs + Form + Cost | v3.0 | — | Re-scoped to V3 v2.1/v2.3/v3.0 | 2026-04-28 |
| 35. Production Hotfix Pass | v2.1 | 0/? | Not started | — |
| 36. Frozen-Rubric Deliverable Iteration | v2.1 | 0/? | Not started | — |
| 37. Git-Style Run Tree | v2.1 | 0/? | Not started | — |
| 38. "Never Stop, Never Ask" Autonomy Prompt | v2.1 | 0/? | Not started | — |
| 39. Reader Testing Peer Review Mode | v2.1 | 0/? | Not started | — |
| 40. Internal Eval Migration to promptfoo | v2.1 | 0/? | Not started | — |
| 41. Conversation Phase Machine + Blueprint | v2.1 | 0/? | Not started | — |
| 42. Minimum-Viable-Brain Gate | v2.1 | 0/? | Not started | — |
| 43. Skip-Maya Escape Hatch | v2.1 | 0/? | Not started | — |
| 44. Per-Run Cost Visibility | v2.1 | 0/? | Not started | — |
| 45. Maya 3-Stage Interrogation | v2.1 | 0/? | Not started | — |
| 46. AI Slop Detection | v2.1 | 0/? | Not started | — |

---

*Roadmap created: 2026-03-17*
*v1.0 shipped: 2026-03-19 · v1.1 shipped: 2026-03-23 · v1.2 shipped: 2026-03-23*
*v1.3 shipped: 2026-03-29 · v2.0 shipped: 2026-03-30*
*v3.0 closed partial: 2026-04-28 — re-scoped to ROADMAP-V3*
