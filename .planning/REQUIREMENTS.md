# Requirements: Hatchin v2.1 Hatches That Self-Improve

**Defined:** 2026-04-28
**Source:** ROADMAP-V3.md v2.1 pillars + corrected Phase 0 (audit Apr 28)
**Core Value:** No one should ever feel alone with their idea, have to start from scratch, or need to know how to prompt AI — just have a conversation and your team takes it from there.

**Milestone goal:** Make autonomous Hatch work *trustworthy*. Refinements stop making things worse silently. Maya knows when she has enough context. Power users can skip discovery.

**Effort:** 5-7 weeks (per V3) · **Hard dependency:** none (foundation milestone for the V3 critical path)

---

## Phase 35 — Production Hotfix Pass (corrected from V3 Phase 0)

> Audit (2026-04-28) reduced V3 Phase 0 from 3 items to 1.5 real items. AUTH-GATE-01 is already shipped (verified). LEGAL-01 needs more than the V3 5-min estimate (page content + routes). Graceful LLM degradation is mostly done — needs a runtime audit + small banner addition.

### Production Polish (LEGAL, LLMUX)

- [x] **LEGAL-01**: User can click "Privacy" and "Terms" links from the landing footer (and login page) and reach actual page content — `/legal/privacy` and `/legal/terms` are registered routes that render production-ready legal copy (not 404) (Phase 35 — Fly v19, 2026-05-11)
- [x] **LLMUX-01**: When all LLM providers fail simultaneously, server emits a typed `PROVIDER_DEGRADED` WS event (no raw HTTP 500 leaks to the client) — 429 rate limits do NOT trigger this state because they route to the next provider (Phase 35 — Fly v19, 2026-05-11)
- [x] **LLMUX-02**: Client shows a non-blocking banner ("Agents are slow right now, hang tight") when `PROVIDER_DEGRADED` is received — never a blocking modal (Phase 35 — Fly v19, 2026-05-11)
- [x] **LLMUX-03**: Banner auto-dismisses within 5 seconds of the next successful streamed response (recovery signal) (Phase 35 — Fly v19, 2026-05-11; 248ms latency 2026-06-03 re-verified on Supabase)
- [x] **AUDIT-01**: Runtime verification spec (Playwright) confirms Phase 1 work end-to-end — clicking landing footer Privacy/Terms loads non-404 content; simulated provider outage shows banner; recovery dismisses it (Phase 35 — 7/7 Playwright cases PASS 2026-05-11; re-PASS 2026-06-03 on Supabase)

---

## Phase 36 — Frozen-Rubric Deliverable Iteration (V3 Pillar 1)

**Theme:** Every refinement scored 0–10 on locked, type-specific rubrics. Auto-revert if a new version scores lower than the previous one. Rubric explains "what a 10 looks like."

- [x] **RUBR-01**: Each of the 15 deliverable types has a frozen rubric with explicit 0–10 scoring criteria (rubric content schema-validated; immutable per type version) (Phase 36-01 — registry-shape + Object.freeze invariant, 2026-05-11)
- [x] **RUBR-02**: Every iteration request scores both old and new versions against the rubric; if new < old, system auto-reverts and surfaces a "Refinement made it worse, kept previous version" message (Phase 36-02 + 36-03, 2026-05-13; re-verified 2026-06-03)
- [x] **RUBR-03**: Rubric scores persist on `deliverable_versions` rows with breakdown per criterion (Phase 36-01 schema + 36-02 persistence, 2026-05-13)
- [x] **RUBR-04**: User can see rubric scoring for any version in the artifact panel; "Why this scored X" explanation is visible per criterion (Phase 36-03 RubricBreakdown, visual-approved 2026-05-13)
- [x] **FBK-01**: Deliverables table gains `userAcceptedAt` timestamp, `editsCount` int, `dismissedAt` timestamp, `impressionCount` int columns (Phase 36-01 schema, 2026-05-11)
- [⚠] **FBK-02**: User can Accept or Dismiss a deliverable from the artifact panel — actions populate the corresponding columns — **DEFERRED** per user simplification 2026-05-13 (server endpoints persist; no UI surface in v2.1; may resurface via Phase 37 run-tree)
- [x] **FBK-03**: System auto-increments `impressionCount` when a deliverable is opened in the artifact panel (Phase 36-02 + 36-03 useEffect + Playwright case 4, 2026-05-13; re-PASS 2026-06-03)
- [x] **FBK-04**: Agent prompts include recent feedback signal for that role ("your last 3 PRDs were accepted, 1 dismissed") so quality compounds with use (Phase 36-04 aggregator + injection + prompt-snapshot test, 2026-05-11)

---

## Phase 36.5 — Imperative Action Shortcuts (HOTFIX)

**Theme:** Skip the LLM ask-first dance for clearly-imperative chat commands. Parse intent server-side before the LLM call, fire the action directly, return a brief confirmation. Falls back to existing LLM flow for ambiguous messages.

- [x] **IMP-01**: New `imperativeIntentParser.ts` module recognizes 4 imperative-command patterns from chat text: create-agent ("create an agent named X as Y"), create-task ("add a task to Z"), rename-project ("rename the project to W"), set-brain-field ("set the project goal to V"). Returns structured intent or `null` for ambiguous text.
- [x] **IMP-02**: WS chat handler in `server/routes/chat.ts` checks for imperative intent BEFORE spawning the LLM. On match: fires the corresponding storage write (createAgent/createTask/updateProject/updateBrain), emits the existing WS event (`teams_auto_hatched` / `task_created` / `brain_updated_from_chat`), and posts a brief confirmation message from the responding agent ("Done — added Pixel as Social Media Manager"). No LLM call needed. On no-match: existing flow runs unchanged.
- [x] **IMP-03**: Maya's team-suggestion grammar drops the `conversationTurnCount >= 2` requirement in `openaiService.ts` so Maya can propose a team on turn 1 when a no-team project is opened.
- [x] **IMP-04**: Playwright probe spec (`tests/e2e/agent-action-probe.spec.ts` — already written during audit) passes: Turn 1 "create an agent named Pixel" creates the agent; Turn 2 "add a task to update landing" creates the task; Turn 3 ambiguous question routes to LLM unchanged.

---

## Phase 37 — Git-Style Run Tree (V3 Pillar 2)

**Theme:** `autonomy_runs` + `autonomy_run_steps` tables. Activity feed visualizes the tree with score deltas.

- [x] **TREE-01**: New `autonomy_runs` and `autonomy_run_steps` tables with parent-child relationships modeling autonomous execution as a DAG _(shipped 2026-05-14 via Phase 37-01; commits 2acd134, 819be29, c92d8bb)_
- [x] **TREE-02**: Every autonomous task and handoff writes a step row; rubric score deltas (from Phase 2) attach to step nodes _(shipped 2026-05-14 via Phase 37-02; commits 6aa50bb writer module, ef4ca1b 3-hook BOTH executeTask paths, eda62db handoffOrchestrator parent-link + handoff_initiated event, 30eef4a GET endpoint, 255a42c writer tests; D-06.1 acknowledged: scoreDelta resolves to null in ~100% of live calls because autonomy pipeline doesn't currently produce Phase 36 deliverables — bridge work tracked as Phase 47 backlog #2)_
- [x] **TREE-03**: Activity feed sidebar visualizes the run tree per project — collapsible nodes, **semantic-word badges** (✓ Improved / ⚠ Made worse / In progress for runs; ✓ Better / ⚠ Worse / New for steps) _(shipped 2026-05-14 via Phase 37-03; commits dbe7fb6 helpers + hook, a568851 RunTreeView+RunTreeNode, 14951be integration+verb-led clarity pass. User feedback during visual checkpoint upgraded from bare numbers/icons to verbs/words per `feedback_ui_self_documenting.md` rule — Activity tab now reads as a sentence.)_
- [x] **TREE-04**: User can click any step node to see the deliverable version produced and its score _(shipped 2026-05-14 via Phase 37-03; W-4 wiring — pendingVersionNumber prop on ArtifactPanel + open_deliverable event extension on home.tsx; click step → panel opens to EXACT version via existing restoreMutation, not most-recent)_
- [x] **TREE-05**: Migration backfills existing `autonomy_events` rows into the run tree for historical projects _(vacuously satisfied 2026-06-03: Neon data abandoned during quick-260601-ojf Supabase migration; no historical autonomy_events rows exist to backfill — fresh Supabase DB will accumulate run-tree data going forward via Phase 37-02 writer hooks)_

---

## Phase 38 — "Never Stop, Never Ask" Autonomy + Autonomy Safety (V3 Pillar 3, expanded 2026-07-09)

**Theme:** At level-4 autonomy, Hatches stop asking "should I keep going?" — they continue chains until natural completion. **BUT** the safety floor must actually fire on destructive intent, Maya's role voice must snap to decisive (not exploratory), and no Hatch may describe having performed actions it cannot execute. Scope expanded 2026-07-09 after live vibe-check surfaced three shipping blockers.

- [x] **ALWY-01**: When `autonomy_level === 4`, agent system prompts include "Never Stop, Never Ask" framing — no clarifying questions, no "should I continue" patterns _(shipped 2026-06-21 via Plan 38-01; commit `e676e37` — AUTONOMOUS_DIRECTIVE_BLOCK injected at 3 sites in openaiService.ts; verified by scripts/test-autonomous-directive.ts 16/16 PASS)_
- [⚠] **ALWY-02**: Conversation flow tests verify that level-4 Hatches do not emit clarifying questions during autonomous execution — **PARTIAL 2026-07-09** — Site 3 soft-closing leak fixed (Plan 38-01 hotfix: `applyAdaptiveClosing` autonomy-aware); Maya voice snap pending Plan 38-03
- [ ] **ALWY-03**: User can downgrade to level 3 mid-run if they want clarification gating back; downgrade applies to next step, not in-flight one _(code shipped 2026-06-21 via Plan 38-01 commit `b218021` snapshot-at-task-entry; runtime vibe-check pending Plan 38-05)_
- [ ] **ALWY-04**: Safety scorer detects destructive-intent verbs (`delete`, `wipe`, `reset`, `remove all`, `start over`, `nuke`, `erase`, `destroy`) and returns `executionRisk ≥ 0.70` — approval card fires at level-4 for destructive commands (D-11..D-13 safety floor invariant verified behaviorally, not just by grep count) _(pending Plan 38-02 — CRITICAL, blocks any autonomous ship)_
- [ ] **ALWY-05**: Maya (Idea Partner, `isSpecialAgent`) at level-4 opens with a commit-shape ("Here's what I'd do: X. Because Y. Flag if wrong.") not with her default exploratory shape ("I keep coming back to the idea..."); Maya-specific override clause added to `AUTONOMOUS_DIRECTIVE_BLOCK` _(pending Plan 38-03)_
- [ ] **ALWY-06**: Agent responses never describe having completed actions the agent has no tool to perform. Role capability envelope injected into every system prompt lists what each role CAN and CANNOT do. Idea Partner Maya says "I can only chat — I can't delete data, run tasks, or modify the DB from here" instead of "I'll wipe the slate clean." _(pending Plan 38-04 — foundational precursor to Phase 46 Slop Detection)_

---

## Phase 39 — Reader Testing Peer Review Mode (V3 Pillar 4)

**Theme:** Context-naïve fresh reviewer for doc-type deliverables — catches "this only makes sense if you wrote it" failures.

- [ ] **READ-01**: New `peerReviewMode: 'reader-test'` lens for doc-type deliverables (PRD, blog post, email, copy, brief)
- [ ] **READ-02**: Reader-test reviewer receives ONLY the deliverable + project name + role context — never the conversation history that produced it
- [ ] **READ-03**: Reader-test review flags "this assumes context the reader doesn't have" with line-level annotations
- [ ] **READ-04**: Author Hatch sees reader-test feedback and can accept/reject revisions; tracked as iteration delta on rubric

---

## Phase 40 — Internal Eval Migration to promptfoo (V3 Pillar 5)

**Theme:** Replace bespoke `scripts/test-*` files with promptfoo-driven evaluation. Standard infrastructure, comparable across model upgrades.

- [ ] **EVAL-01**: promptfoo installed; `eval/` directory restructured around promptfoo config files
- [ ] **EVAL-02**: Existing `scripts/test-tone.ts`, `test-injection.ts`, `eval-routing.ts` ported to promptfoo testcases
- [ ] **EVAL-03**: CI runs promptfoo eval against mock provider on every PR — pass/fail gate matches existing scripts
- [ ] **EVAL-04**: Eval results stored as artifacts; comparable across runs (regression detection)

---

## Phase 41 — Conversation Phase Machine + Blueprint (V3 Pillar 6)

**Theme:** Discovery → Draft → Building states; Maya knows what mode she's in. Blueprint card surfaces handoff moment.

- [ ] **PHASE-01**: Each conversation persists a `phase` value (`discovery` / `blueprint` / `executing`) in DB — survives WebSocket reconnects
- [ ] **PHASE-02**: `[[PHASE: <new-phase>]]` action block in agent's response transitions the conversation phase
- [ ] **PHASE-03**: Phase regression (user resets mid-execution) cancels in-flight pg-boss jobs to prevent stale-blueprint execution
- [ ] **PHASE-04**: User sees a phase indicator in the chat header ("Discovery → Draft → Building") that updates live
- [ ] **BLPR-01**: After MVB gate is met (Phase 8), Maya synthesizes answers into a structured `BlueprintCard` (project name, summary, 3 first tasks, 3-4 recommended roles)
- [ ] **BLPR-02**: BlueprintCard renders inline in chat as a confirmable component
- [ ] **BLPR-03**: User clicks "Looks good — start building" button to advance phase (button-only handoff signal — no LLM intent classifier on plain affirmations)
- [ ] **BLPR-04**: User can type freeform revisions inline ("change palette to pastels") and Maya regenerates the blueprint
- [ ] **BLPR-05**: On confirmation, Maya releases primary speaking authority; PM Alex becomes default project speaker
- [ ] **BLPR-06**: Task generation on confirm is idempotent — double-click does not create duplicate tasks (idempotency key)

---

## Phase 42 — Minimum-Viable-Brain Gate (V3 Pillar 7)

**Theme:** Maya stops asking once enough context is gathered. Bounded discovery (≤3 questions per turn).

- [ ] **MVB-01**: System defines minimum brain schema (`whatBuilding`, `whoFor`, `whyMatters` all non-empty in `projects.coreDirection`)
- [ ] **MVB-02**: Background extractor populates brain fields from every Maya discovery turn (mirrors `organicExtractor.ts` pattern, runs in parallel to gate check)
- [ ] **MVB-03**: When MVB threshold is satisfied, system emits a phase-advance signal — Maya is prompted to draft the blueprint instead of asking more questions
- [ ] **DISC-01**: Maya asks at most 3 questions in any single message (hard cap, prompt-enforced + turn-counter safety net)
- [ ] **DISC-02**: Discovery questions are grouped by category (Features / Visuals / Tech) when more than one is asked
- [ ] **DISC-03**: Maya does not re-ask a question already answered in conversation history (deduplication via context check)

---

## Phase 43 — Skip-Maya Escape Hatch (V3 Pillar 8)

**Theme:** Power users opt-in to a 3-field form that bypasses discovery entirely.

- [ ] **SKIP-01**: Onboarding and project creation surface a visible "Skip to my team" path
- [ ] **SKIP-02**: Skip path shows 3 labeled fields (`What you're building` / `Who it's for` / `Why it matters`) which map directly to MVB schema
- [ ] **SKIP-03**: On submit, project advances directly to `executing` phase — no Maya discovery turn, blueprint auto-generated from the 3 fields
- [ ] **SKIP-04**: User preference to skip Maya is remembered (`users.preferences.skipMayaOnboarding` flag) for future projects

---

## Phase 44 — Per-Run Cost Visibility (V3 Pillar 9)

**Theme:** Quota framing in UsageBar. Activity feed shows per-run cost as quota delta. Free-tier users see in-character upgrade prompt at cap.

- [ ] **COST-01**: `autonomy_events` table gains a nullable `cost_cents` column populated at run completion
- [ ] **COST-02**: User sees quota framing ("47 of 50 autonomy runs remaining today") in UsageBar — never raw dollar amounts in primary UI
- [ ] **COST-03**: Activity feed shows per-run cost as a quota delta ("Kai drafted growth update · 1 run") — not "$0.03"
- [ ] **COST-04**: Free-tier user hitting the autonomy cap sees Maya deliver an in-character upgrade message (not "quota exceeded" raw error)

---

## Phase 45 — Maya 3-Stage Interrogation (V3 Pillar 10)

**Theme:** gstack /office-hours + doc-coauthoring patterns folded into Maya's project-kickoff. Three structured stages: idea spike → context build → blueprint draft.

- [ ] **INTR-01**: Maya kickoff prompt explicitly distinguishes 3 stages (idea spike / context build / blueprint draft) — each stage has bounded question budget
- [ ] **INTR-02**: Stage 1 (idea spike) ≤ 1 question — captures "what are you building" before any context probing
- [ ] **INTR-03**: Stage 2 (context build) ≤ 3 questions per turn (max 2 turns) — covers `whoFor`, `whyMatters`, top-of-mind constraint
- [ ] **INTR-04**: Stage 3 (blueprint draft) — Maya synthesizes with no further questions; integrates with Phase 7 BlueprintCard
- [ ] **INTR-05**: Stage transitions visible to user as subtle phase indicator (chat header text); user can NOT manually advance — only the conversation does

---

## Phase 46 — AI Slop Detection (V3 Pillar 11)

**Theme:** Peer-review-lens addition for Cleo / Wren / Mira / copy-producing Hatches — flag generic AI-tone output before delivery.

- [ ] **SLOP-01**: New peer-review lens `slop-check` scans for AI-tone patterns ("In today's fast-paced world", excessive em-dashes, hedging filler, "It's important to note")
- [ ] **SLOP-02**: Slop-check runs on copy-producing roles (Cleo, Wren, Mira, Kai, Drew, Pixel) for content-type deliverables (blog post, email, copy, brief, social post)
- [ ] **SLOP-03**: Slop-check failures are advisory (not blocking) — author Hatch sees flag with specific phrases and can revise
- [ ] **SLOP-04**: Detection patterns versioned in `shared/slopPatterns.ts` so curation can evolve

---

## Future Requirements (deferred from V3, after v2.1)

- **v2.1.5** — Hatches Research Live (Tavily/Exa/Firecrawl provider abstraction for 9 research-heavy roles)
- **v2.2** — Hatches Read Real Files (PDF OCR, structured table extraction, XLSX parsing, fillable PDFs, bound package export)
- **v2.3** — Hatchin Project Methodology Engine (PRD → task tree, task DAG, workstreams, methodology templates, dynamic team formation)
- **v2.4** — Hatch Intelligence: Marketing Depth (~32 marketing skills + Security Officer 31st Hatch)
- **v2.5** — Hatches Ship Real Files (XLSX, PPTX, interactive HTML prototypes — with brand layer)
- **v2.5.5** — Hatches Produce Deep Research Reports (multi-Hatch 8-phase pipeline)
- **v2.6** — Hatch Trust & Safety (deferred — enterprise trigger)
- **v2.7** — Hatchin as Infrastructure (project-as-API, MCP server, webhooks, scheduled routines, atomic budget UX) — absorbs v3.0 Pillar A re-scope
- **v3.0 (re-defined)** — Hatch Mental Models (graph memory, BDI mental states, cross-session continuity, cross-project preferences) — absorbs v3.0 PREF re-scope
- **v4.0** — Hatches That Act ("Hatchin Desktop") — Electron + Ghost OS MCP

---

## Out of Scope (v2.1)

| Feature | Reason |
|---------|--------|
| Visual cron editor | Off-brand — chat-native; deferred to v2.7 |
| Sub-hourly cadence | Cost abuse vector; v2.7 only |
| Dollar amounts in primary cost UI | Loss-aversion research backed; quota framing only |
| LLM-based "looks good" intent classifier on plain affirmations | Substring matching fires on sarcasm; button-only handoff is reliable |
| Auto-advance to execution after inactivity | Surprising behavior |
| Agent disagreement orchestration | V3 backlog; needs production data for confidence calibration |
| Project milestones layer | V3 backlog |
| Explicit user preference UI | Inferred preferences only — friction-free, on-brand |
| User-editable per-agent budgets | Defer to v3.1+ |
| Manual budget override | Erodes the safety net v3.0 created |

---

## Traceability

(filled by roadmap once phases are committed; each REQ-ID maps to exactly one phase number)

| Requirement | Phase | Status |
|-------------|-------|--------|
| LEGAL-01 | 35 | Shipped 2026-05-11 |
| LLMUX-01..03 | 35 | Shipped 2026-05-11 |
| AUDIT-01 | 35 | Shipped 2026-05-11 |
| RUBR-01..04 | 36 | Code-complete (awaiting deploy) |
| FBK-01..04 | 36 | Code-complete (awaiting deploy; FBK-02 UI deferred) |
| IMP-01..04 | 36.5 | Shipped 2026-05-13 (code-complete, bundled with 36 for deploy) |
| TREE-01..05 | 37 | TREE-01..04 shipped 2026-05-14; TREE-05 pending (37-04 backfill) |
| ALWY-01 | 38 | Shipped 2026-06-21 (Plan 38-01) |
| ALWY-02 | 38 | ⚠ Partial 2026-07-09 (Site 3 fixed; Maya voice snap pending 38-03) |
| ALWY-03 | 38 | Code-shipped 2026-06-21; runtime verify pending 38-05 |
| ALWY-04 | 38 | Pending 38-02 — CRITICAL (safety scorer destructive intent) |
| ALWY-05 | 38 | Pending 38-03 (Maya voice snap at level-4) |
| ALWY-06 | 38 | Pending 38-04 (fake-action guard) |
| READ-01..04 | 39 | Pending |
| EVAL-01..04 | 40 | Pending |
| PHASE-01..04 | 41 | Pending |
| BLPR-01..06 | 41 | Pending |
| MVB-01..03 | 42 | Pending |
| DISC-01..03 | 42 | Pending |
| SKIP-01..04 | 43 | Pending |
| COST-01..04 | 44 | Pending |
| INTR-01..05 | 45 | Pending |
| SLOP-01..04 | 46 | Pending |

**Coverage:**
- v2.1 total: 67 requirements (60 original + 4 IMP added 2026-05-13 hotfix + 3 ALWY-04/05/06 added 2026-07-09 vibe-check pivot)
- Mapped to phases: 67 (13 phases including 36.5 hotfix)
- Unmapped: 0 ✓

---

*Defined: 2026-04-28*
*Source: ROADMAP-V3.md v2.1 pillars + audit-corrected Phase 0*
