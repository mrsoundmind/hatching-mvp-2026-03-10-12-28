---
gsd_state_version: 1.0
milestone: v2.1
milestone_name: Hatches That Self-Improve
status: phase_37_plan_01_shipped
stopped_at: Phase 37-01 (Foundation) SHIPPED 2026-05-14. autonomy_runs + autonomy_run_steps tables applied to dev DB (12 + 19 cols + 4 named indexes); IStorage gained createRun / createRunStep / updateRunStep / getRunsByProject (Mem + DB impls with parent-mismatch guard + Q4 timeout sweep); scripts/test-run-tree-writer.ts 4/4 PASS deterministic. Next plan 37-02 (server writer + instrumentation).
last_updated: "2026-05-14T04:33:21.000Z"
last_activity: 2026-05-14 — Phase 37-01 shipped (autonomous execute). 3 atomic commits (2acd134 schema, 819be29 storage, c92d8bb tests). 9 min duration. 3 deviations auto-fixed (db:push interactive bypass via direct SQL, Zod-inferred string vs $type literal cast, explicit type-imports in test file). Phase 36 + 36.5 still bundled awaiting fly deploy.
progress:
  total_phases: 13
  completed_phases: 3
  total_plans: 16
  completed_plans: 13
  percent: 23
---

# State: Hatchin

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-28)

**Core value:** No one should ever feel alone with their idea, have to start from scratch, or need to know how to prompt AI — just have a conversation and your team takes it from there.
**Current focus:** v2.1 milestone in progress — Phase 35 SHIPPED to production 2026-05-11. Phase 36 + Phase 36.5 CODE-COMPLETE awaiting next `fly deploy`. Phase 37-01 (Foundation) SHIPPED 2026-05-14. Next plan: 37-02 (server writer + instrumentation).

---

## Current Position

Phase: 37 (Git-Style Run Tree) — Plan 01 SHIPPED 2026-05-14
Plans complete: 1/4 (37-01 SHIPPED 2026-05-14; 37-02 server writer pending; 37-03 client UI pending; 37-04 backfill + verification pending)
Status: 37-01 Foundation complete — autonomy_runs + autonomy_run_steps tables in dev DB; IStorage + Mem + DB impls wired; Wave-1 tests 4/4 PASS deterministic. Next: 37-02 server writer + instrumentation (taskExecutionPipeline + handoffOrchestrator hooks + GET /api/projects/:id/runs endpoint).
Last activity: 2026-05-14 — Phase 37-01 shipped (3 commits 2acd134..c92d8bb, 9 min). All 4 named indexes confirmed via pg_indexes. typecheck + build green.

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

Last session: 2026-05-13 — Phase 36.5-01 execution complete. Imperative shortcut hotfix shipped in 6 atomic commits. Closes the 2026-05-13 audit gap; bundled with Phase 36 for next deploy.
Stopped at: Phase 36 + Phase 36.5 CODE-COMPLETE. Awaiting `fly deploy` (user-action — auto-mode safety carve-out for production deploys).

Next action options (pick one):
- `fly deploy` — ship Phase 35 + Phase 36 + Phase 36.5 to production (user-driven; auto-mode does not deploy)
- Begin Phase 37 (Git-Style Run Tree) — autonomy_runs + autonomy_run_steps schema + sidebar tree visualization with rubric score-delta badges
- Address uncommitted `wip/pre-reset-2026-04-28` work (`ProjectTree.tsx` 5-line deletion + planning docs) if relevant to next phase
