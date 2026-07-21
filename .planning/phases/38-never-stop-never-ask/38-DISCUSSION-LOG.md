# Phase 38: "Never Stop, Never Ask" Autonomy Prompt — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-04
**Phase:** 38-never-stop-never-ask
**Areas discussed:** Prompt placement, Replacement language, Mid-run downgrade granularity, Safety-gate scope

---

## Prompt placement

| Option | Description | Selected |
|--------|-------------|----------|
| Plain — with other moment-specific stuff | Simple, slightly more expensive per message but pennies. Best for MVP scale. | |
| Cached per level | Best cost per message at scale. Cache fragmentation cost only matters at 1000+ projects. | |
| Hybrid — generic stuff cached, level-specific live | Middle ground. More moving parts to maintain. | ✓ |

**User's choice:** Hybrid (re-asked in plain language after user requested clarification on jargon).
**Notes:** Generic helpfulness stays in cacheable staticPrefix (Phase A DeepSeek 50× cache-hit pricing preserved); autonomous directive appended to dynamicSuffix only when level === 'autonomous'. Conditional branch in `buildSystemPrompt()`. Captured in D-01..D-03.

---

## Replacement language for the 'autonomous' prompt rule

| Option | Description | Selected |
|--------|-------------|----------|
| Strict: 'Never ask. Make a reasonable assumption + state it out loud.' | Clear contract, observable in output. Risk: silent if user doesn't read assumption note. | |
| Soft: 'Prefer not to ask; only ask if truly blocking. Note why.' | Escape hatch for genuinely stuck cases. Risk: defeats 'Never Ask' framing. | |
| Total removal | Relies entirely on role training. Risk: behavior drifts back to asking. | |
| **OTHER: "do how Claude does it"** | User-supplied direction: mimic Anthropic's autonomous-coding behavior patterns. Translated by Claude into 7 explicit principles. | ✓ |

**User's choice:** "Do how Claude does it" (free-text after re-ask in plain language).
**Notes:** Translated into 7 principles in D-04 (commit don't hedge; state assumptions; don't pause between subtasks; no hedging filler; offer correction after not permission before; frame stuck cases as binary with options; inline justification). Planner drafts exact wording constrained by these 7. XML-delimited (`<autonomous_directive>`) for snapshot-test assertability (D-05). Does NOT override existing 14 response rules in staticPrefix (D-06).

---

## Mid-run downgrade granularity (ALWY-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Next handoff/task boundary | Current task finishes under old rules, next Hatch picks up under new rules. | ✓ |
| Next message instantly — even mid-task | Most responsive. Risk: task feels jarring as personality switches mid-flight. | |
| Only between background runs | Conservative. Slow to respond to dial moves. | |

**User's choice:** Next handoff/task boundary (Recommended; re-confirmed after plain-language explanation).
**Notes:** Snapshot autonomyLevel at task entry (D-07..D-08). Foreground chat: per-message snapshot (D-10). Handoffs: each task in chain takes its own snapshot (D-09). Mirrors Phase 22 budget-ledger snapshot-at-entry pattern.

---

## Safety-gate scope (clarificationRequiredRisk relaxation)

| Option | Description | Selected |
|--------|-------------|----------|
| No — safety gates unchanged | Phase 38 changes only the prompt rule; safety gates from Phase 28 stay intact. | ✓ |
| Partial relax — disable mid-risk peer-review at level 4, keep high-risk approval | Faster autonomous; loses peer-review on medium-risk ops. | |
| Full relax — all clarification thresholds skipped at level 4 | True autonomous; catastrophic actions could ship without approval. | |

**User's choice:** No — safety gates unchanged (Recommended; re-confirmed after plain-language explanation).
**Notes:** Phase 28 SAFE-01..04 multi-tier safety system remains the hard floor. Level-4 user accepts that legitimately risky operations (risk ≥ 0.70) still pause for approval — "Never Stop" applies to normal conversational work, not to safety-critical operations. Captured in D-11..D-13.

---

## Claude's Discretion

- Exact wording of the `<autonomous_directive>` block (constrained by the 7 principles in D-04)
- Whether to add `autonomySnapshot` column on `tasks` table (recommended deferred to Phase 47 backlog)
- ALWY-02 test method — recommend prompt-snapshot + integration-flow test (both)
- Whether to log snapshot decisions for observability (recommend yes, console.log only — telemetry-grade logging deferred to v3.0)

## Deferred Ideas

- Role-specific autonomous nuance (per-role directive tuning) — Phase 47 backlog if observed-and-wanted
- User-visible "autonomy mode" indicator in chat — v2.1 polish OR Phase 41/42
- Cross-session autonomous-mode preferences — v3.0 Hatch Mental Models (PREF-01..05)
- Logging snapshot decisions as full audit trail — defer telemetry-grade to v3.0
- `autonomySnapshot` column on tasks table — defer
- Safety-gate threshold relaxation at level 4 — explicit non-decision (D-11); Phase 47 backlog if needed
- Prompt-cache-key strategy beyond hybrid placement — defer until DeepSeek cache data tells us it matters
