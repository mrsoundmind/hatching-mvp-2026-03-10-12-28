---
gsd_state_version: 1.0
milestone: v2.1
milestone_name: Hatches That Self-Improve
status: phase_36_context_gathered
stopped_at: Phase 36 CONTEXT.md written via auto-mode discuss. 30 decisions captured across 6 gray areas (rubric registry, LLM judge, auto-revert UX, feedback columns, prompt injection, verification). 4 plans proposed. Ready for /gsd-plan-phase 36.
last_updated: "2026-05-11T17:00:00.000Z"
last_activity: 2026-05-11 — Phase 36 discuss complete (auto-mode). CONTEXT.md + DISCUSSION-LOG.md written. Phase 35 still SHIPPED at Fly version 19; Phase 36 is the next advance.
progress:
  total_phases: 12
  completed_phases: 1
  total_plans: 5
  completed_plans: 5
  percent: 8
---

# State: Hatchin

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-28)

**Core value:** No one should ever feel alone with their idea, have to start from scratch, or need to know how to prompt AI — just have a conversation and your team takes it from there.
**Current focus:** v2.1 milestone in progress — Phase 35 SHIPPED to production 2026-05-11. Next: Phase 36 (Frozen-Rubric Deliverable Iteration).

---

## Current Position

Phase: 36 (Frozen-Rubric Deliverable Iteration) — CONTEXT GATHERED 2026-05-11
Plans complete: 0/4 proposed (36-01..04 to be confirmed by planner)
Status: Discuss complete via auto-mode. CONTEXT.md captures 30 decisions; researcher/planner have open questions Q1–Q4 to resolve. Phase 35 remains shipped at Fly version 19. Next: `/gsd-plan-phase 36`.
Last activity: 2026-05-11 — Phase 36 discuss (auto-mode). Created `.planning/phases/36-frozen-rubric-deliverable-iteration/36-CONTEXT.md` + `36-DISCUSSION-LOG.md`. No code changes yet.

### Proposed plan breakdown (subject to planner refinement)
- 36-01 — Foundation: rubric registry (`shared/deliverableRubrics.ts`, 15 rubrics, Zod-validated) + DB schema additions
- 36-02 — Server scoring: `rubricScorer.ts` (Groq judge, temp=0), auto-revert in `iterateDeliverable()`, accept/dismiss/impression endpoints
- 36-03 — Client UI: ArtifactPanel Accept/Dismiss buttons, RubricBreakdown toggle, AutoRevertBanner (visual checkpoint required)
- 36-04 — Agent prompt feedback signal in `openaiService.ts` + Playwright runtime spec + 36-VERIFICATION.md

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
