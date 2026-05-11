---
gsd_state_version: 1.0
milestone: v2.1
milestone_name: Hatches That Self-Improve
status: phase_35_shipped_pending_fly_deploy
stopped_at: Phase 35 code-complete and runtime-verified (Playwright 7/7 pass, typecheck + build green). User-action pending — run `fly deploy` to push to production.
last_updated: "2026-05-11T15:30:00.000Z"
last_activity: 2026-05-11 — Phase 35 executed across 3 waves; 24 commits; LEGAL-01 + LLMUX-01..03 + AUDIT-01 closed; modal contrast fix applied live during 35-04 visual checkpoint; 35-03 visual gate satisfied by 35-05 spec cases 3+4
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
**Current focus:** v2.1 milestone in progress — Phase 35 (Production Hotfix Pass) code-complete + runtime-verified, awaiting user `fly deploy`. Next: Phase 36 (Frozen-Rubric Deliverable Iteration).

---

## Current Position

Phase: 35 (Production Hotfix Pass) — CODE-COMPLETE + RUNTIME-VERIFIED · awaiting `fly deploy`
Plans complete: 5/5 (35-01, 35-02, 35-03, 35-04, 35-05)
Status: Deploy approved by user 2026-05-11. Next user-action: run `fly deploy` to push to production. After that, advance to Phase 36.
Last activity: 2026-05-11 — Phase 35 execution complete: 24 commits, Playwright 7/7 pass (2x deterministic, 1.5min runtime, 386ms recovery latency vs 5s budget), typecheck + build green, 5/5 requirements closed (LEGAL-01 + LLMUX-01..03 + AUDIT-01), modal contrast fix applied live during 35-04 visual checkpoint review

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
