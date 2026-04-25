# Research Summary — v3.0 Reliable Autonomy

**Project:** Hatchin v3.0 — Reliable Autonomy
**Domain:** Atomic budget enforcement + scheduled autonomous routines on existing Node/Express + Drizzle + Neon + pg-boss AI-agent platform
**Researched:** 2026-04-13
**Confidence:** HIGH

---

## Executive Summary

Hatchin v3.0 is a correctness + capability upgrade. Two interlocking goals:

1. **Close a check-then-act race** where concurrent pg-boss workers silently bypass the daily LLM budget cap (`taskExecutionPipeline.ts:543-560`).
2. **Add scheduled routines** ("every Monday 9am, Kai drafts the growth update") that reuse the existing execution pipeline.

Scheduling multiplies concurrency pressure, so **budget correctness must land first** — schedules on a racy budget = the runaway-spend scenario v3.0 exists to prevent.

No new runtime infrastructure needed. Atomic budget ships on Drizzle's `db.transaction()` + atomic `ON CONFLICT...WHERE...RETURNING` against a new `autonomy_daily_counters` (PK project+date). Scheduling ships on pg-boss v10.4.2's native `boss.schedule()` (IANA tz, distributed-safe). Add only `chrono-node` (NL time parsing) + `cronstrue` (reverse cron → human-readable for confirmation). Remove unused `node-cron`.

Dominant risks are distributed-systems failures: missing release-on-failure permanently locks projects; pg-boss retries double-spend without idempotency keys; schedule storms after deploy downtime; prompt injection via NL schedule text fires autonomously at 3am. Each has a prescribed mitigation (two-phase reserve-execute-release, TTL+reaper, task_id-keyed idempotency, skip-missed policy, delimited untrusted-data framing). Getting these right **is** the milestone.

---

## Key Findings

### Stack (HIGH)

- **Drizzle 0.39.1** — `db.transaction(cb, { isolationLevel: 'read committed' })` + atomic `ON CONFLICT...WHERE...RETURNING` (not serializable)
- **pg-boss 10.4.2** — already installed; native `boss.schedule(name, cron, data, { tz })`, IANA tz, distributed-lock single-fire
- **chrono-node ^2.9.0** — NEW — NL datetime parser + ~50 LOC recurrence regex adapter
- **cronstrue ^2.50.0** — NEW (optional) — reverse cron → human-readable for UI
- **Remove** `node-cron` (unused; unsafe for multi-node)

### Features

**Table stakes:** Atomic budget backend + reconciliation; UsageBar autonomy extension; 80% warn + 100% hard stop with in-character Maya; NL schedule parsing; confirmation card; routines list (next-run/status/pause/resume/delete); past-run history (30 runs, status+cost); timezone (browser default, IANA persisted); manual "Run now"; failed-run in Maya briefing + tab badge.

**Differentiators:** Chat-native creation via DM to assigned Hatch; personality-aware confirmation; assignment to specific agent; deliverable-linked routines (reuse v2.0 versioning); return-briefing integration.

**Anti-features:** Visual cron editor; sub-hourly cadence; cross-routine dependency chains; shared/team routines (defer v3.1+); user-editable per-agent budgets (out of scope).

### Architecture

**Budget race (HIGH, pinpointed):**
- `taskExecutionPipeline.ts:543-560` — 3 DB round-trips with no lock across LLM call (2-45s)
- Secondary at `chat.ts:98-99` (inactivity trigger)
- `usageTracker.recordUsage` fire-and-forget exacerbates

**Fix pattern:** Atomic conditional UPDATE on `autonomy_daily_counters` — 1 new table, 2 storage methods, ~12 LOC change.

**Scheduling:**
- New `scheduled_routines` table (project, agent, conversation, cron, tz, nextRunAt indexed, failureCount for auto-pause)
- pg-boss `boss.schedule()` for cron firing (distributed-safe)
- **Reuse existing autonomous_task_execution pipeline** — scheduled fire enqueues a `tasks` row + `boss.send('autonomous_task_execution', ...)`
- Extend existing `intentClassifier.ts` with `SCHEDULE_REQUEST` variant (fires before `EXPLICIT_TASK_REQUEST`)
- Parser split into `schedulePhraseParser.ts`

### Pitfalls (HIGH, 10 identified)

1. Check-then-act race → atomic `INSERT...ON CONFLICT...WHERE count < limit RETURNING`
2. FOR UPDATE across LLM call → two-phase reserve → execute (no tx) → release; all tx <100ms
3. Leaked reservations → try/finally + TTL + reaper + task_id idempotency
4. pg-boss retry double-count → idempotency key on usage insert; `retryLimit: 1` for reservation-holding jobs
5. Schedule storm after deploy → pg-boss distributed cron + skip-missed policy
6. Prompt injection via NL description → delimited untrusted-data framing + Groq pre-scan + 500-char cap
7. Overlap (routine still running when next fires) → `current_run_id` as mutex
8. Dangling schedules for deleted agents/projects → FK CASCADE
9. Unbounded failure retries → `retryLimit: 2` + auto-pause at 3 consecutive failures
10. DST transitions → pg-boss IANA tz + DST fixed-date test suite

---

## Implications for Roadmap

**Suggested phases: 6** | **Starting phase number: 22** (v2.0 ended at 21)

| # | Phase | Scope | Est |
|---|-------|-------|-----|
| 22 | Atomic Budget Enforcement | Ledger table + reserve/release + pipeline wire-up + reconciliation | 1-2d |
| 23 | Budget UX Surfaces | UsageBar extension + 80% warn + hard-stop + blocked events | 1d |
| 24 | Scheduler Foundation | Routines table + boss.schedule wrapper + pipeline hook + REST + auto-pause | 2-3d |
| 25 | Chat-Native Routine Creation | SCHEDULE_REQUEST intent + parser + confirmation card + WS | 2d |
| 26 | Routines Management Panel | Sidebar tab + cards + pause/resume/delete + past-run history | 2d |
| 27 | Polish + Integration Hardening | DST tests + multi-replica verify + red-team injection + empty states | 1-2d |

**Ordering rationale:**
- Budget before scheduling (non-negotiable — scheduling multiplies the race)
- Backend before UI within each capability
- Chat-native after scheduler infra stable
- Polish/verification last

---

## Research Flags

**Needs research during planning:**
- **Phase 22:** Smoke-test Drizzle `.for('update')` + ON CONFLICT behavior against Neon; raw SQL fallback documented
- **Phase 25:** chrono-node edge cases on real user phrasing ("every other Tuesday", "first Monday"); prototype Groq LLM fallback if needed
- **Phase 27:** pg-boss `tz` DST behavior verification (libfaketime or fixed dates)

**Standard patterns (skip research-phase):**
- **Phase 23:** Extension of shipped v1.2 UsageBar + v1.3 ActivityFeed + UpgradeModal
- **Phase 25 UI:** Mirrors shipped Smart Task Detection intent-classifier
- **Phase 26:** Mirrors shipped v1.3 sidebar tab + ActivityFeed

---

## Confidence

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | pg-boss cron, Drizzle tx, chrono-node verified |
| Features | MEDIUM-HIGH | Verified against 4+ shipping products |
| Architecture | HIGH | Direct codebase analysis; race pinpointed |
| Pitfalls | HIGH | Codebase + distributed-systems modes; 10 mitigations |

---

## Ready for Requirements

Hand off to `gsd-roadmapper` with:
- Starting phase number: 22
- 6 suggested phases (see table)
- Scope: atomic budget + scheduled routines only; defer 5 other Paperclip-inspired ideas
- Hard constraint: budget phase must precede scheduler phases
