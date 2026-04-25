---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: Hatchin That Works
status: research_in_progress
stopped_at: Researching new pillar (Maya + Teamness)
last_updated: "2026-04-25"
last_activity: 2026-04-25 — v3.0 expanded to "Hatchin That Works"; new pillar research dispatched
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# State: Hatchin

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-25)

**Core value:** No one should ever feel alone with their idea, have to start from scratch, or need to know how to prompt AI — just have a conversation and your team takes it from there.
**Current focus:** v3.0 — Hatchin That Works (research in progress for Pillar B)

---

## Current Position

Phase: — (defining requirements for expanded v3.0)
Plan: — (not yet planned)
Status: Research in progress for Pillar B (Maya + Teamness)
Last activity: 2026-04-25 — v3.0 renamed to "Hatchin That Works", existing Phases 22-27 preserved, new phases (28+) being scoped

Progress: [░░░░░░░░░░] 0% (0/6 existing phases; new phases TBD)

---

## Accumulated Context

### Decisions (preserved)

- **Use-case-driven development**: Organize around user goals, not features
- **Text-first deliverables**: Focus on what LLMs produce well
- **Groq LLM verified**: All deliverable generation works with Groq llama-3.3-70b

### v3.0 Decisions (Pillar A — Reliable Autonomy)

- **Budget correctness precedes scheduling (hard constraint):** Phase 22 must ship before Phase 24
- **Pattern A atomic ledger:** new `autonomy_daily_counters` table with `INSERT...ON CONFLICT...WHERE reserved_count < limit RETURNING`
- **Reuse existing pipeline for scheduling:** scheduled fires enqueue a `tasks` row + `boss.send('autonomous_task_execution', ...)`
- **pg-boss native scheduler:** use `boss.schedule()` (distributed-safe, IANA tz, single-fire)
- **Extend intentClassifier:** add `SCHEDULE_REQUEST` variant
- **New deps:** `chrono-node` (NL datetime) + `cronstrue` (reverse cron → human-readable)

### v3.0 Decisions (Pillar B — Maya + Teamness, NEW 2026-04-25)

- **Bundle Pillar A + Pillar B into v3.0**: User testing exposed both reliability gaps; same trust signal
- **Maya bug fix is urgent**: Infinite "thinking" state blocks user testing today — should ship as Phase 28 first
- **Codebase audit completed**: 9 gaps verified — see audit results in this conversation thread
- **Existing evolution mechanics confirmed working**: personalityEvolution.ts (per-agent traits), trustScoring (success_rate × maturity_factor), brain [[UPDATE]] action blocks
- **Phase 23 (Budget UX) overlaps with COST-* (per-run cost visibility)**: merge during requirements definition

### Anti-features (preserved)

- no visual cron editor, no sub-hourly cadence, no shared routines, no manual budget override, no budget projection UX

### Shipped Milestones

- v1.0 Text-Perfect, Human-First (2026-03-19) — Phases 1-5
- v1.1 Autonomous Execution Loop (2026-03-23) — Phases 6-9
- v1.2 Billing + LLM Intelligence (2026-03-23) — Phase 10
- v1.3 Autonomy Visibility & Right Sidebar Revamp (2026-03-29) — Phases 11-15
- v2.0 Hatches That Deliver (2026-03-30) — Phases 16-21

### Deferred to v3.1+

- AUDIT-01/02 — audit timeline UX
- TMPL-01/02 — exportable project templates
- ROLL-01/02 — config versioning + rollback
- MOB-01/02 — mobile digest + push
- PAB-01/02 — per-agent budgets
- CHAT-07/08, MGMT-09 — conversational schedule edit/cancel + skip-next-run

---

## Session Continuity

Last session: 2026-04-25
Stopped at: v3.0 expanded scope — research dispatched for Pillar B
Next action: Synthesize research → define new requirements (MAYA-*, USER-*, TEAM-*, CONFL-*, GOAL-*, FBK-*, COST-*, LLM-*, KILL-*) → spawn roadmapper for Phases 28+
