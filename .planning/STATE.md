---
gsd_state_version: 1.0
milestone: v2.1
milestone_name: Hatches That Self-Improve
status: phase_38_partial_shipped_scope_expanded_awaiting_38-02_38-03_38-04
stopped_at: Phase 38 expanded 2026-07-09 from 1 plan to 5 plans after live vibe-check surfaced three shipping blockers. Plan 38-01 SHIPPED (directive + Site 1/2 + snapshot + Playwright + Site 3 hotfix for applyAdaptiveClosing). Plans 38-02 (safety scorer destructive-intent detection — CRITICAL), 38-03 (Maya voice snap at level-4), 38-04 (fake-action guard) are NEW and NOT started. Plan 38-05 (human vibe-check) depends on all three. Original single-plan Phase 38 partially achieves ALWY-01 ✓ / ALWY-02 ⚠ / ALWY-03 code-shipped-not-verified; new plans close ALWY-04/05/06. Prior phases in v2.1 all shipped: Phase 35 (Fly v19 2026-05-11), Phase 36 (2026-05-13, FBK-02 deferred), Phase 36.5 hotfix (2026-05-13), Phase 37 (2026-05-15). Infra: Supabase migration shipped 2026-06-02 (quick-260601-ojf), DeepSeek V4-Flash inserted 2026-05-04 (Phase A).
last_updated: "2026-07-09T00:00:00.000Z"
last_activity: 2026-07-09 — live vibe-check on server with autonomy dial set to Autonomous surfaced three shipping blockers requiring in-milestone fixes (safety scorer under-scored destructive intent to 0.1 instead of ≥0.70, Maya Idea Partner voice dominated the autonomous directive, Maya confabulated action-completion for capabilities she doesn't have). ALSO discovered pre-existing multi-agent empty-save bug (handleMultiAgentResponse doesn't accumulate into outer scope) → logged as Phase 47 #9. ALSO discovered Activity tab foreground streaming visibility gap → Phase 47 #10. Site 3 leak (applyAdaptiveClosing soft-closing questions bypassed the autonomous directive) fixed inline as Plan 38-01 addendum. v2.1 restructured: Phase 38 scope expanded, REQUIREMENTS.md gains ALWY-04/05/06, ROADMAP.md gains Phase 38 plans 38-02..05 + Phase 47 items #9/#10.
progress:
  total_phases: 13
  completed_phases: 4
  total_plans: 24
  completed_plans: 20
  percent: 30
---

# State: Hatchin

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-28)

**Core value:** No one should ever feel alone with their idea, have to start from scratch, or need to know how to prompt AI — just have a conversation and your team takes it from there.
**Current focus:** v2.1 milestone — Phase 38 code shipped 2026-06-21, Task 5 human-verify checkpoint OPEN. Phase 35 SHIPPED to Fly v19 2026-05-11. Phase 36 + Phase 36.5 shipped 2026-05-13 (bundled for next `fly deploy`). Phase 37 (Git-Style Run Tree) VERIFIED 2026-05-15 (PASS-WITH-NOTES). Infra: Neon exceeded compute quota → migrated to Supabase Singapore 2026-06-02 (quick-260601-ojf); DeepSeek V4-Flash inserted as LLM primary 2026-05-04 (Phase A).

---

## Current Position

Phase: 38 ("Never Stop, Never Ask" Autonomy + Autonomy Safety — expanded 2026-07-09) — Plan 38-01 SHIPPED, Plans 38-02/03/04/05 NOT STARTED
Plans complete: 1 / 5
Status: Live vibe-check on 2026-07-09 confirmed Plan 38-01's prompt directive works for decisive-role agents (Alex Product Manager produced textbook D-04 "I'll assume X because Y — flag if wrong" shape) and Site 3 fix suppresses the `applyAdaptiveClosing` soft-closing question leak. Three shipping blockers surfaced requiring 3 new plans before Phase 38 can close:
  - **38-02 CRITICAL**: safety scorer scored destructive intent ("delete all my data and start over") at `executionRisk: 0.1` — well below the 0.70 `clarificationRequiredRisk` gate. Approval card never fired. D-11..D-13 grep=7 invariant is behaviorally hollow — code path exists but never triggers. Autonomous mode + broken safety = actively dangerous.
  - **38-03**: Maya (Idea Partner, `isSpecialAgent`) at level-4 kept her exploratory "I keep coming back to..." opener. Voice snap needs a Maya-specific clause in `AUTONOMOUS_DIRECTIVE_BLOCK`.
  - **38-04**: Maya confabulated "I'll wipe the slate clean" on destructive request — hallucinated an action she has no tool to perform. Foundational precursor to Phase 46 Slop Detection. Fix: role capability envelope in every system prompt.
  - Plus: 2 Phase 47 items logged (#9 multi-agent empty-save bug is pre-existing but HIGH priority; #10 Activity foreground streaming visibility).

Last activity: 2026-07-09 — v2.1 restructure landed (REQUIREMENTS.md ALWY-04/05/06 added; ROADMAP.md Phase 38 expanded to 5 plans; this STATE.md rolled forward; HANDOFF.md pivot entry appended). Prior in-session: Site 3 fix code-shipped and re-verified via live retest. Prior work: 2026-07-06 session-continuity docs; 2026-06-23 Supabase resumed; 2026-06-21 Plan 38-01 Tasks 1-4 shipped (3 commits e676e37, b218021, d904768).

### Phase 36.5 — also CODE-COMPLETE (shipped 2026-05-13, bundled with Phase 36 for same deploy)
Hotfix from 2026-05-13 audit. Imperative shortcut parser fires create-agent / create-task / rename-project / set-brain-field on turn 1 (no LLM dance). Maya turn-count gate dropped. Probe spec is regression gate (2/2 PASS).

### Phase 36 — also CODE-COMPLETE (shipped 2026-05-11, awaiting same deploy)

Plans complete: 4/4 (36-01 shipped 2026-05-11; 36-02 shipped 2026-05-13; 36-03 shipped 2026-05-13; 36-04 shipped 2026-05-11). 36-VERIFICATION.md: 5/5 ROADMAP success criteria + 7/8 requirements PASS, 1 DEFER (FBK-02 UI — deliberate scope drop in 36-03 per user simplification; server endpoints persist).

### Plan breakdown (locked)
- **36-01** (Wave 1, autonomous) — **SHIPPED 2026-05-11.** Foundation: `shared/deliverableRubrics.ts` (15 rubrics, Zod-validated, Object.freeze invariant) + DB schema additions (4 cols on `deliverables`, 3 on `deliverable_versions`) + Wave-1 test scaffold (3/3 PASS). Requirements covered: RUBR-01, RUBR-03 schema, FBK-01. See `.planning/phases/36-frozen-rubric-deliverable-iteration/36-01-SUMMARY.md`.
- **36-02** (Wave 2, autonomous, deps 01) — **SHIPPED 2026-05-13.** Server scoring: `rubricScorer.ts` (Groq judge, temp=0, server-side recommendation override per T-36-11), wrap `iterateDeliverable()`, atomic `incrementEditsCount()`, 3 endpoints (accept/dismiss/impression), DEV-only `/api/dev/force-judge-score`. 9/9 unit tests deterministic PASS. Requirements covered: RUBR-02 server, RUBR-03 persistence, FBK-02 server, FBK-03 server. See `.planning/phases/36-frozen-rubric-deliverable-iteration/36-02-SUMMARY.md`.
- **36-03** (Wave 3, NON-AUTONOMOUS — visual checkpoint, deps 01+02) — **SHIPPED 2026-05-13** with simplifications. Client UI surface: score chip (replaces FileSpreadsheet rubric-toggle) + RubricBreakdown card (header "Why this scored X / 10") + AutoRevertBanner (amber non-blocking, no "rubric" word). Accept/Dismiss UI DROPPED — server endpoints persist (Wave 2) but no UI surface; FBK-04 agent signal switches to score-based phrasing in 36-04. Requirements covered: RUBR-04, FBK-03 UI. FBK-02 UI deferred. See `36-03-SUMMARY.md`.
- **36-04** (Wave 4, autonomous, deps 01+02+03) — **SHIPPED 2026-05-11.** Agent prompt feedback (`deliverableFeedbackAggregator.ts` with 60s cache + 15-entry inline TYPE_LABEL_MAP + score-based phrasing per REVISION 1; injection in `openaiService.ts` between domainIntelligenceSection and emotionalSignatureSection) + 4-case Playwright spec on live dev server (4/4 PASS deterministic; REVISION 2 from 6→4 cases) + 36-VERIFICATION.md (5/5 ROADMAP success criteria; 7 PASS + 1 DEFER for FBK-02 UI per REVISION 3) + extended `/api/dev/force-judge-score` endpoint with optional oldBreakdown/newBreakdown (Rule-3 auto-fix). Requirements closed: FBK-04 + cross-cutting verification of RUBR-02/04 + FBK-03. See `36-04-SUMMARY.md`.
- **36.5-01** (Wave 1, autonomous, no deps) — **SHIPPED 2026-05-13** — HOTFIX. Imperative shortcut parser (`server/ai/imperativeIntentParser.ts` — 4 intent shapes, conservative regex, 21 unit cases) + WS chat handler short-circuits LLM on imperative match (early check + `handleImperativeIntent` helper covering create-agent / create-task / rename-project / set-brain-field) + Maya turn-count gate removed in `openaiService.ts` so Maya can propose teams on turn 1 + Playwright probe regression gate converted from diagnostic to 3 expect-asserted cases. Three Rule-1 parser fixes discovered by tests (comma-form, task-colon, rename-change-form). Requirements closed: IMP-01, IMP-02, IMP-03, IMP-04. See `.planning/phases/36.5-imperative-action-shortcuts/36.5-01-SUMMARY.md`.

### Open questions resolved
- Q1 (judge prompt structure): single call comparing OLD+NEW — anchoring stability, comparative justifications
- Q2 (feedback cache strategy): keep 60s in-process, NO write-invalidation — avoids wrong-direction read/write coupling
- Q3 (backfill pre-Phase-36 versions): NO — pre-Phase-36 versions stay `rubricVersion: null`, UI shows fallback
- Q4 (impressionCount storage): DB column per FBK-01 wording; migrate later if volume justifies

### Rollback recipe (if Phase 35 misbehaves in prod)

**Git revert (preserves history):**
```bash
git revert --no-commit 4f3d664..906cba1
git commit -m "revert: roll back Phase 35"
git push origin wip/pre-reset-2026-04-28
fly deploy
```

**Fly-only rollback (no git changes):**
```bash
fly releases list                 # confirm previous version 18
fly releases rollback             # or specify version target
```

**Hard reset to pre-Phase-35 (destructive, prefer revert above):**
```bash
git checkout pre-phase-35         # detached HEAD at 31c0dc5
# OR: git reset --hard pre-phase-35 (rewrites branch — only if no later work)
fly deploy
```

---

## Accumulated Context

### Decisions (preserved across milestone switch)

- **Use-case-driven development**: Organize around user goals, not features
- **Text-first deliverables**: Focus on what LLMs produce well
- **Groq LLM verified**: All deliverable generation works with Groq llama-3.3-70b
- **ROADMAP-V3 is canonical post-v2.0 plan** (created 2026-04-28 from 18 repo evaluations + 15-item gap audit). Supersedes ROADMAP-V2 (archived).
- **v3.0 close-out is partial, not full ship**: Phase 22 + 28 shipped; remaining 11 phases re-scoped (no work abandoned).
- **No mid-milestone decimal hotfixes (established 2026-05-13)**: Off-roadmap discoveries during a phase don't become Phase X.5 splits. They get logged into the dedicated `Phase 47: Accumulated Upgrades & Course Corrections` backlog with date + source phase + context. At Phase 47 we triage as a group and decide SHIP / DEFER / DROP. Exceptions only for production-breaking bugs or direct audit-driven blockers (Phase 35 Production Hotfix, Phase 36.5 Imperative Shortcuts are the grandfathered examples). See ROADMAP.md § Phase 47 for the active backlog.

### v3.0 shipped decisions (preserved)

- **Pattern A atomic ledger** for budget enforcement: `autonomy_daily_counters` table with `INSERT...ON CONFLICT...WHERE reserved_count < limit RETURNING`
- **`@google/generative-ai` → `@google/genai`** SDK migration was prerequisite for AbortSignal hygiene (deprecated SDK had unresolved Issue #303)
- **Phase state lives in DB** (`conversations.mayaPhase`), not React state — survives WS reconnects (carried into v2.1 Pillar 6)
- **Background brain extraction is mandatory alongside MVB gate** — gate checks DB fields that only populate via extraction (carried into v2.1 Pillar 7)
- **Button-only handoff trigger** for blueprint confirmation (no LLM intent classifier on plain affirmations) — carried into v2.1 Pillar 6
- **Dollar amounts never in primary UI** — quota framing only — carried into v2.1 Pillar 9
- **Gemini embedding cosine similarity** for team formation (pre-computed at startup, hash-invalidated) — carried into v2.3 Pillar 7
- **OWASP LLM01 sanitization mandatory** on preference write — carried into v3.0-V3 (Mental Models) Pillar 4

### Audit findings (2026-04-28)

- **AUTH-GATE-01 was a phantom bug** in V3 Phase 0 — `<AuthGuard>` already redirects unauthed `/account` to `/login?next={path}` in `App.tsx:19-58`; login.tsx reads `?next=` post-signin. Marked complete on close-out.
- **LEGAL-01 is real but bigger than V3 estimate** (5 min → 1-2 hr): links shipped (commit `3bbab4c`) but `/legal/privacy` and `/legal/terms` routes/pages do NOT exist. Links 404. Folded into v2.1 Phase 1.
- **Graceful LLM degradation is ~70-80% done** — typed error map exists in `CenterPanel.tsx:651-662` (6 codes); banner UX missing. Folded into v2.1 Phase 1.
- **22-03 reconciliation cron is shipped** — registered at `5 0 * * *` UTC in `backgroundRunner.ts:316-324` (always-on, no feature flag). STATE.md previously said "pending" — was stale.

### Anti-features (preserved)

- no visual cron editor, no sub-hourly cadence, no shared routines, no manual budget override, no budget projection UX
- no dollar amounts in primary cost UI, no auto-advance to execution after inactivity, no LLM-based "looks good" intent classifier for plain affirmations, no hard MVB gate blocking all agent responses (gate controls phase transition only)

### Deferred (status preserved across V3 re-scope)

- AUDIT-01/02 — audit timeline UX (v3.1+)
- TMPL-01/02 — exportable project templates (v3.1+)
- ROLL-01/02 — config versioning + rollback (v3.1+)
- MOB-01/02 — mobile digest + push (v3.1+)
- PAB-01/02 — per-agent budgets (v3.1+)
- CHAT-07/08, MGMT-09 — conversational schedule edit/cancel + skip-next-run (v3.1+ within V3 v2.7)
- DISG-01/02/03 — Agent disagreement orchestration (V3 backlog; needs production data for confidence calibration)
- GOAL-01/02/03 — Project milestones / definition-of-done (V3 backlog)

### Shipped Milestones

- v1.0 Text-Perfect, Human-First (2026-03-19) — Phases 1-5
- v1.1 Autonomous Execution Loop (2026-03-23) — Phases 6-9
- v1.2 Billing + LLM Intelligence (2026-03-23) — Phase 10
- v1.3 Autonomy Visibility & Right Sidebar Revamp (2026-03-29) — Phases 11-15
- v2.0 Hatches That Deliver (2026-03-30) — Phases 16-21
- v3.0 Hatchin That Works (PARTIAL, 2026-04-28) — Phase 22 (atomic budget) + Phase 28 (Maya bug fix + SDK migration); rest re-scoped to V3

---

## Session Continuity

Last session: 2026-07-09 — live vibe-check triggered a v2.1 restructure. Session resumed on new machine/IDE; Supabase auto-paused, restored by user via dashboard; boot server; ran Phase 38 vibe-check; surfaced Site 3 leak (fixed inline), safety-scorer under-scoring destructive intent (0.1 vs required ≥0.70), Maya voice not snapping to decisive at level-4, Maya confabulating action-completion; ALSO pre-existing multi-agent empty-save bug + Activity foreground visibility gap. User decision (verbatim): "no we need to fix these, add this is gsd milestone and reallign with everything" — expanded Phase 38 from 1 plan to 5 plans (38-01 shipped; 38-02/03/04/05 NEW), added ALWY-04/05/06, logged Phase 47 items #9/#10. Site 3 hotfix committed as part of Plan 38-01 addendum (server/ai/responsePostProcessing.ts + server/routes/chat.ts:2654).
Stopped at: v2.1 restructure documentation write-up complete (this STATE.md, REQUIREMENTS.md, ROADMAP.md, HANDOFF.md, 38-CONTEXT.md all updated). Awaiting Plan 38-02 kickoff (safety scorer destructive-intent detection — CRITICAL, blocks any autonomous ship). Server is UP on port 5001 with Site 3 fix loaded.

Next action options (pick one):
- **Kick off Plan 38-02 (recommended, CRITICAL)** — /gsd-discuss-phase then /gsd-plan-phase then /gsd-execute-phase for the safety scorer destructive-intent detection. Estimated 2-3 hr. Unblocks the whole "autonomous mode is safe to ship" story.
- **Kick off Plan 38-03 first (surgical, ~30 min)** — Maya voice snap. Smallest cognitive load; nice quick win before tackling 38-02.
- **Batch all three plans (38-02/03/04) in one execution session** — write plans back-to-back, execute back-to-back, then run 38-05 vibe-check once. Highest throughput; largest single session.
- **Pause v2.1, deploy Phase 35+36+36.5+37+Plan 38-01 to Fly** — ship what's actually verified now; return for 38-02/03/04 next session. Pro: gets Site 3 fix + Phase 37 tree into prod. Con: leaves Phase 38 open longer.

## Performance Metrics

| Plan | Duration | Tasks | Files | Commits |
|---|---|---|---|---|
| 37-01 Foundation | 9 min | 3 | 2 (+1 new) | 3 (2acd134, 819be29, c92d8bb) |
| 37-02 Server writer + instrumentation | 12 min | 4 | 6 (+1 new) | 5 (6aa50bb, ef4ca1b, eda62db, 30eef4a, 255a42c) |

## Decisions (Phase 37-02)

- **Pipeline 3 hooks called via writer's null-safe API** — caller passes `input.runId !== undefined ? await startStep(...) : null`. Writer's stepId-null short-circuit means downstream completeStep/failStep are safe even if HOOK A failed.
- **ExecuteTaskResult interface adds optional stepId** — least-disruptive way to carry stepId from executeTask back to handleTaskJob so it can pass it as sourceStepId into orchestrateHandoff.
- **queueForBatch + executeBatchedTasks return types widened additively** — `{ status }` → `ExecuteTaskResult` (stepId optional).
- **Cycle-detection task_failed event ('handoff_cycle' branch) preserved unchanged** — rejected handoffs intentionally don't write step rows because no real handoff occurred.
- **orchestrateHandoff caller in handleTaskJob uses local-scope runId/traceId** — the caller is inside handleTaskJob (not inside executeTask), so the local variables are runId, traceId; used shorthand `runId, traceId` to satisfy the spirit of the plan's grep criterion.
- **Empty-output path in executeTask now calls failStep** — without it, the early-return at the empty-output guard would leave the step row in 'running' state until the Q4 sweep at 30 min. Rule 2 auto-fix.
