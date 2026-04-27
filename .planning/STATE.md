---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: Hatchin That Works
status: "Phase 28 SHIPPED — all 6 BUG-XX closed (Maya infinite-thinking + SDK migration + stop button + AbortController hygiene). Phase 22 still in progress (22-03 reconciliation job pending)."
stopped_at: Phase 28 complete (5/5 plans). Phase 22 mid-flight (2/3 plans).
last_updated: "2026-04-27T11:30:00.000Z"
last_activity: 2026-04-27 — Phase 28 (Maya Bug Fix + SDK Migration) shipped — BUG-01..06 closed, 18 commits, 5 SUMMARY.md files
progress:
  total_phases: 24
  completed_phases: 6
  total_plans: 23
  completed_plans: 21
  percent: 91
---

# State: Hatchin

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-25)

**Core value:** No one should ever feel alone with their idea, have to start from scratch, or need to know how to prompt AI — just have a conversation and your team takes it from there.
**Current focus:** v3.0 — Hatchin That Works (Phase 28 SHIPPED 2026-04-27; Phase 22 in progress; rest of Pillar B awaiting)

---

## Current Position

Phase 28 (Pillar B / Maya Bug Fix + SDK Migration): COMPLETE — 5/5 plans, BUG-01..06 closed
Phase 22 (Pillar A / Atomic Budget Enforcement): IN PROGRESS — 2/3 plans (22-01 ✓ · 22-02 ✓ · 22-03 reconciliation job pending)

Status: Phase 28 shipped. Maya now has end-to-end AbortSignal handling (30s timeout), the deprecated SDK is removed, the stop button resets within 1s, and the heap leak is closed (70.58MB → 0.11MB delta).
Last activity: 2026-04-27 — Phase 28 final commit `01d93b1` (5/5 plans, 18 commits, 5 SUMMARY.md files); merged worktrees for 28-01..05 to main.

Progress: [█████████░] 91% (21/23 plans complete in v3.0; pending: Phase 22-03 + all of Phases 23-27 + 29-34)

---

## Accumulated Context

### Decisions (preserved)

- **Use-case-driven development**: Organize around user goals, not features
- **Text-first deliverables**: Focus on what LLMs produce well
- **Groq LLM verified**: All deliverable generation works with Groq llama-3.3-70b

### v3.0 Decisions (Pillar A — Reliable Autonomy)

- **Budget correctness precedes scheduling (hard constraint):** Phase 22 must ship before Phase 24
- **Pattern A atomic ledger:** new `autonomy_daily_counters` table with `INSERT...ON CONFLICT...WHERE reserved_count < limit RETURNING`
- **Phase 22-01 shipped:** autonomyDailyCounters schema, budgetLedger.ts (reserveBudgetSlot + releaseBudgetSlot), Wave 0 tests. BUDG-01 empirically proven: 5/10 concurrent reservations succeed at limit=5.
- **Phase 22-02 shipped:** handleTaskJob rewired to use reserveBudgetSlot atomically; releaseBudgetSlot in catch path only (failure releases slot; success keeps it consumed for the day); chat.ts pre-check removed (BUDG-01+BUDG-02 now enforced at pipeline level only).
- **budgetLedger.ts is standalone (not IStorage):** follows upsertDailyUsage precedent; raw pool.query used because Drizzle 0.39.1 cannot express WHERE on DO UPDATE clause
- **Reuse existing pipeline for scheduling:** scheduled fires enqueue a `tasks` row + `boss.send('autonomous_task_execution', ...)`
- **pg-boss native scheduler:** use `boss.schedule()` (distributed-safe, IANA tz, single-fire)
- **Extend intentClassifier:** add `SCHEDULE_REQUEST` variant
- **New deps:** `chrono-node` (NL datetime) + `cronstrue` (reverse cron → human-readable)

### v3.0 Decisions (Pillar B — Maya + Teamness, confirmed 2026-04-25)

- **Bundle Pillar A + Pillar B into v3.0**: User testing exposed both reliability gaps; same trust signal
- **Maya bug fix (Phase 28) is urgent and independent**: Ships in parallel with Pillar A; does not block or depend on any Pillar A phase
- **@google/generative-ai → @google/genai migration is mandatory prerequisite**: The deprecated SDK has an unresolved AbortController bug (Issue #303); migration is not optional and must complete before any other Pillar B LLM work
- **Phase state lives in DB (conversations.mayaPhase), not React state**: Survives WS reconnects; DEFAULT 'discovery' on new column
- **Background brain extraction is mandatory alongside MVB gate**: Gate checks DB fields that only populate via extraction or action blocks — if extraction is skipped, the gate never passes (MVB false negative pitfall)
- **Button-only handoff trigger for blueprint confirmation**: LLM intent classifier for "looks good but..." risks false positives; per user decision Q2, button is primary handoff signal
- **All Pillar B schema changes batch into one Drizzle migration**: conversations.mayaPhase, users.preferences JSONB, deliverables feedback columns (userAcceptedAt/dismissedAt/editsCount/impressionCount), autonomy_events.cost_cents — deployed as one migration for safety
- **Dollar amounts never in primary UI**: Quota framing only ("47 of 50 runs remaining") — loss aversion research backed
- **Gemini embedding cosine similarity for team formation**: Pre-computed at server startup, hash-invalidated when roleRegistry.ts changes; ~720KB in memory
- **OWASP LLM01 sanitization mandatory on preference write**: Enum allowlists + 200-char cap on free-text fields; injected as user-context block, never system role

### Anti-features (preserved)

- no visual cron editor, no sub-hourly cadence, no shared routines, no manual budget override, no budget projection UX
- no dollar amounts in primary cost UI, no auto-advance to execution after inactivity, no LLM-based "looks good" intent classifier for plain affirmations, no hard MVB gate blocking all agent responses (gate controls phase transition only)

### Deferred to v3.1+

- AUDIT-01/02 — audit timeline UX
- TMPL-01/02 — exportable project templates
- ROLL-01/02 — config versioning + rollback
- MOB-01/02 — mobile digest + push
- PAB-01/02 — per-agent budgets
- CHAT-07/08, MGMT-09 — conversational schedule edit/cancel + skip-next-run

### Deferred to v3.2

- DISG-01/02/03 — Agent disagreement orchestration (highest-risk; needs production data for confidence calibration)
- GOAL-01/02/03 — Project milestones / definition-of-done (lower priority; depends on blueprint + feedback both stable)

### Shipped Milestones

- v1.0 Text-Perfect, Human-First (2026-03-19) — Phases 1-5
- v1.1 Autonomous Execution Loop (2026-03-23) — Phases 6-9
- v1.2 Billing + LLM Intelligence (2026-03-23) — Phase 10
- v1.3 Autonomy Visibility & Right Sidebar Revamp (2026-03-29) — Phases 11-15
- v2.0 Hatches That Deliver (2026-03-30) — Phases 16-21

---

## Session Continuity

Last session: 2026-04-27 — Phase 28 (Maya Bug Fix + SDK Migration) executed end-to-end via wave-based parallel orchestration.
Stopped at: Phase 28 SHIPPED — all 5 plans landed, 6 BUG-XX requirements closed, regression scaffold green.

Next action options (pick one):
- `/gsd-plan-phase 22 --wave 2` or `/gsd-execute-phase 22 --wave 2` — close out Phase 22-03 reconciliation job (last Pillar A plan before scheduling work begins)
- `/gsd-discuss-phase 29` — start Pillar B Phase 29 (Discovery Redesign + MVB Gate)
- `/gsd-discuss-phase 23` — start Pillar A Phase 23 (Budget UX Surfaces)

### Phase 28 — Outcomes (ARCHIVED)

**All 6 BUG-XX requirements closed:**
- BUG-01 (SDK migration `@google/generative-ai` → `@google/genai`) — 28-02
- BUG-02 (AbortSignal end-to-end propagation) — 28-02
- BUG-03 (`typing_stopped` before `streaming_error`) — 28-04
- BUG-04 (zombie fallback message guarded by abort check) — 28-04
- BUG-05 (AbortController reference cleanup; heap delta 70.58MB → 0.11MB) — 28-05
- BUG-06 (stop button resets within 1s on terminal stream events) — 28-03

**Notable execution decisions / deviations:**
- Plan 28-01 used `general-purpose` agent (gsd-executor sandbox initially blocked `git merge --ff-only`)
- 28-02 exported `providerRegistry` from `providerResolver.ts` (1-char change) so the propagation test can spy on it
- 28-04 hoisted `abortController` from block-scope `const` to function-scope `let` because the catch handler couldn't see it otherwise — also flipped `const` → assignment at the original site, added `?.` in cancelHandler closure
- `@google/genai` 1.50.x API differs from plan: `generateContentStream` is single-arg (signal lives in `params.config.abortSignal`), `chunk.text` is a getter not a method
- Worktree-based execution worked but worktrees started from old commit `4533283c` (not main HEAD) — required explicit `git merge main --ff-only` in each worktree

**Wave 0 regression scaffold (always-on):** `npx playwright test tests/e2e/v3-local-gap-audit.spec.ts` + `npx tsx scripts/test-abort-{cleanup,heap}.ts` should all be green now.
- Key files: `server/llm/providers/geminiProvider.ts`, `server/routes/chat.ts`, `server/llm/providerResolver.ts`
