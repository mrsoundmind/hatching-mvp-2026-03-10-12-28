---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: Hatchin That Works
status: roadmap_complete
stopped_at: Roadmap approved — Phase 22 (Atomic Budget Enforcement) is next to plan
last_updated: "2026-04-26"
last_activity: 2026-04-26 — Playwright gap audit empirically confirmed 6/10 gaps; LEGAL-01 + AUTH-GATE-01 added to Phase 31 (76 requirements total)
progress:
  total_phases: 13
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# State: Hatchin

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-25)

**Core value:** No one should ever feel alone with their idea, have to start from scratch, or need to know how to prompt AI — just have a conversation and your team takes it from there.
**Current focus:** v3.0 — Hatchin That Works (roadmap complete, Phase 28 next)

---

## Current Position

Phase: 22 — Atomic Budget Enforcement (planned, ready to execute)
Plan: 3 plans in 2 waves (22-01 schema+helpers+tests · 22-02 pipeline rewire · 22-03 reconciliation job)
Status: Plans verified — all 8 Nyquist dimensions PASS on first iteration. Ready for `/gsd:execute-phase 22`.
Last activity: 2026-04-26 — Phase 22 research + plans + verification complete (8/8 PASS)

Progress: [░░░░░░░░░░] 0% (0/13 phases; Pillar A Phases 22-27 + Pillar B Phases 28-34)

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

Last session: 2026-04-26
Stopped at: v3.0 roadmap approved — 13 phases, 74 requirements, 100% coverage. User chose numerical order.
Next action: `/gsd:plan-phase 22` — Atomic Budget Enforcement (Pillar A foundation; closes the check-then-act budget race)

### Phase 28 Planning Notes (pre-loaded context)

- Migrate `@google/generative-ai` to `@google/genai ^1.3.0` — breaking API change: new unified `GoogleGenAI` client, `ai.models.generateContentStream()` replaces `chat.sendMessageStream()`, `requestOptions.signal` replaces prior pattern
- Add `AbortSignal.timeout(30_000)` in `geminiProvider.ts` via `requestOptions.signal`
- Fix `finally` block in `chat.ts` streaming path: always emit `typing_stopped` on abort/timeout
- Fix TTFT fallback threshold: current 3s fires on valid slow Gemini Pro responses (p95 4-6s); correct threshold is 30s total OR 15s post-first-token
- Wire AbortController to WS `close` event for unexpected disconnects
- Verify `@langchain/google-genai` compatibility with new SDK post-migration (potential version conflict)
- Key files: `server/llm/providers/geminiProvider.ts`, `server/routes/chat.ts`, `server/llm/providerResolver.ts`
