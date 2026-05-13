---
gsd_state_version: 1.0
milestone: v2.1
milestone_name: Hatches That Self-Improve
status: phase_36_code_complete
stopped_at: Phase 36 CODE-COMPLETE — 4/4 plans shipped (36-01 schema/registry, 36-02 server scoring + endpoints, 36-03 UI score-chip + breakdown + auto-revert banner, 36-04 agent feedback signal + Playwright runtime spec + 36-VERIFICATION.md). Awaiting `fly deploy` (user-action — auto-mode safety carve-out). 36-VERIFICATION.md status 7 PASS + 1 DEFER (FBK-02 UI surface deferred per 36-03 user simplification; server endpoints persist).
last_updated: "2026-05-11T00:00:00.000Z"
last_activity: 2026-05-11 — Phase 36-04 execution complete. 5 atomic commits (05e41bb, 1b27011, 5d2b888, 96e0bb2, plus this final docs commit). Three documented mid-phase revisions all flowed from 36-03's user-driven simplification: (1) aggregator switched to score-based phrasing, (2) Playwright spec 6→4 cases, (3) FBK-02 marked DEFER in 36-VERIFICATION.md. One Rule-3 auto-fix: extended /api/dev/force-judge-score endpoint with optional oldBreakdown/newBreakdown arrays so phase-36 spec case 1 can verify criterion rows render. Runtime gate green: 4/4 Playwright PASS deterministic across 2 consecutive runs (1.5m each) on live restarted dev server.
progress:
  total_phases: 12
  completed_phases: 2
  total_plans: 11
  completed_plans: 11
  percent: 17
---

# State: Hatchin

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-28)

**Core value:** No one should ever feel alone with their idea, have to start from scratch, or need to know how to prompt AI — just have a conversation and your team takes it from there.
**Current focus:** v2.1 milestone in progress — Phase 35 SHIPPED to production 2026-05-11. Next: Phase 36 (Frozen-Rubric Deliverable Iteration).

---

## Current Position

Phase: 36 (Frozen-Rubric Deliverable Iteration) — CODE-COMPLETE, awaiting `fly deploy`
Plans complete: 4/4 (36-01 shipped 2026-05-11; 36-02 shipped 2026-05-13; 36-03 shipped 2026-05-13; 36-04 shipped 2026-05-11)
Status: Phase 36 surface is RUNTIME-VERIFIED. 4/4 phase-36 Playwright cases PASS deterministic on live restarted dev server (2 consecutive runs). 36-VERIFICATION.md: 5/5 ROADMAP success criteria + 7/8 requirements PASS, 1 DEFER (FBK-02 UI — deliberate scope drop in 36-03 per user simplification; server endpoints persist). Next: `fly deploy` (user-action — auto-mode safety carve-out).
Last activity: 2026-05-11 — Phase 36-04 SHIPPED. 5 atomic commits (05e41bb, 1b27011, 5d2b888, 96e0bb2, final docs commit). Score-based aggregator + RECENT FEEDBACK section injection in agent prompts + 4-case Playwright spec + 36-VERIFICATION.md. Three documented mid-phase revisions all flowing from 36-03's UI simplification.

### Plan breakdown (locked)
- **36-01** (Wave 1, autonomous) — **SHIPPED 2026-05-11.** Foundation: `shared/deliverableRubrics.ts` (15 rubrics, Zod-validated, Object.freeze invariant) + DB schema additions (4 cols on `deliverables`, 3 on `deliverable_versions`) + Wave-1 test scaffold (3/3 PASS). Requirements covered: RUBR-01, RUBR-03 schema, FBK-01. See `.planning/phases/36-frozen-rubric-deliverable-iteration/36-01-SUMMARY.md`.
- **36-02** (Wave 2, autonomous, deps 01) — **SHIPPED 2026-05-13.** Server scoring: `rubricScorer.ts` (Groq judge, temp=0, server-side recommendation override per T-36-11), wrap `iterateDeliverable()`, atomic `incrementEditsCount()`, 3 endpoints (accept/dismiss/impression), DEV-only `/api/dev/force-judge-score`. 9/9 unit tests deterministic PASS. Requirements covered: RUBR-02 server, RUBR-03 persistence, FBK-02 server, FBK-03 server. See `.planning/phases/36-frozen-rubric-deliverable-iteration/36-02-SUMMARY.md`.
- **36-03** (Wave 3, NON-AUTONOMOUS — visual checkpoint, deps 01+02) — **SHIPPED 2026-05-13** with simplifications. Client UI surface: score chip (replaces FileSpreadsheet rubric-toggle) + RubricBreakdown card (header "Why this scored X / 10") + AutoRevertBanner (amber non-blocking, no "rubric" word). Accept/Dismiss UI DROPPED — server endpoints persist (Wave 2) but no UI surface; FBK-04 agent signal switches to score-based phrasing in 36-04. Requirements covered: RUBR-04, FBK-03 UI. FBK-02 UI deferred. See `36-03-SUMMARY.md`.
- **36-04** (Wave 4, autonomous, deps 01+02+03) — **SHIPPED 2026-05-11.** Agent prompt feedback (`deliverableFeedbackAggregator.ts` with 60s cache + 15-entry inline TYPE_LABEL_MAP + score-based phrasing per REVISION 1; injection in `openaiService.ts` between domainIntelligenceSection and emotionalSignatureSection) + 4-case Playwright spec on live dev server (4/4 PASS deterministic; REVISION 2 from 6→4 cases) + 36-VERIFICATION.md (5/5 ROADMAP success criteria; 7 PASS + 1 DEFER for FBK-02 UI per REVISION 3) + extended `/api/dev/force-judge-score` endpoint with optional oldBreakdown/newBreakdown (Rule-3 auto-fix). Requirements closed: FBK-04 + cross-cutting verification of RUBR-02/04 + FBK-03. See `36-04-SUMMARY.md`.

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

Last session: 2026-04-28 — v3.0 close-out + v2.1 milestone setup. Audit verified all "v3.0 unfinished" requirements are re-homed in V3, not abandoned.
Stopped at: v3.0 archived to milestones/. Next step is to resume `/gsd-new-milestone` for v2.1 (gather requirements + roadmap from ROADMAP-V3 v2.1 scope).

Next action options (pick one):
- `/gsd-new-milestone` — resume v2.1 milestone setup (recommended; in progress)
- Address uncommitted `wip/pre-reset-2026-04-28` work (`ProjectTree.tsx` 5-line deletion + planning docs) before v2.1 starts
- `fly deploy` — ship the shipped v3.0 work + DB-CRASH-01 hotfix to production (was blocked by the crash; now safe)
