# Phase 36 — Discussion Log

**Mode:** Auto (Claude picked recommended options without prompting; user requested auto-mode in session)
**Date:** 2026-05-11

This log captures the reasoning behind each decision in `36-CONTEXT.md`. Downstream agents (researcher, planner) read CONTEXT.md, not this file. This is for human audit / retrospective only.

---

## Areas covered

All 6 gray areas auto-selected (auto-mode behavior):

1. Rubric definition format & schema lock
2. Scoring mechanism (LLM-as-judge)
3. Auto-revert UX surface
4. Feedback columns + Accept/Dismiss semantics
5. Agent prompt feedback signal injection
6. Verification approach

---

## Area 1 — Rubric definition format

**Q:** Where do per-type rubrics live? Code (TS const) or DB (seed)?
**Options:** (a) TS const in `shared/deliverableRubrics.ts`, Zod-validated, semver-locked. (b) DB seed table `deliverable_rubrics`, mutable.
**Chosen:** (a) — RECOMMENDED.
**Why:** "Frozen" requirement is the entire point of Phase 36 (RUBR-01: "rubric content schema-validated; immutable per type version"). Code-versioning gives free immutability per deploy + git history. DB is mutable by definition. Adding admin-editor UI later is a separate phase.

**Q:** How many criteria per rubric, and how are they weighted?
**Chosen:** 4–6 criteria per type, each weighted (sum = 1.0), final score = weighted sum × 10.
**Why:** 4–6 is the sweet spot — fewer than 4 loses signal granularity, more than 6 makes the judge prompt unstable. Weighted sum keeps math interpretable.

**Q:** Anchors at 10 and 0 — surface to user or judge-only?
**Chosen:** Judge prompt only.
**Why:** Anchors stabilize the LLM's scoring scale; surfacing them to users adds clutter without value. Per-criterion justification (1 sentence) is what the user sees.

---

## Area 2 — Scoring mechanism

**Q:** One LLM call (judge OLD + NEW together) or two calls (judge each separately)?
**Chosen:** One call, both versions in same prompt — RECOMMENDED.
**Why:** Single prompt anchors the comparison (judge sees both side-by-side). Two independent calls introduce drift between scoring temperatures. Open question Q1 flags this for researcher to validate.

**Q:** Which LLM provider for the judge?
**Chosen:** Groq llama-3.3-70b primary, Gemini fallback. NOT DeepSeek.
**Why:** Groq is FREE-tier per CLAUDE.md and deterministic at temp=0. Avoiding DeepSeek keeps scoring chain stable + US-hosted (so a China-side outage doesn't poison scoring as well as user-facing generation).

**Q:** Auto-revert threshold — strict less-than or threshold-based (e.g., ≥0.5 score drop)?
**Chosen:** Strict less-than (`newScore < oldScore`).
**Why:** Simplest contract, easiest to explain in banner copy. Ties keep new version (gives user the refinement they explicitly requested). Threshold gating adds tunable knobs we'd have to defend; defer.

---

## Area 3 — Auto-revert UX surface

**Q:** Where does the "made it worse" UX appear?
**Options:** (a) Toast (reuse Phase 35 infra). (b) Inline banner above content. (c) Blocking modal.
**Chosen:** (b) Inline banner — RECOMMENDED.
**Why:** Toast is for transient confirmations; this is contextual (the user just iterated and needs to know what happened — they're looking AT the artifact). Modal blocks input violation of Phase 35 D-09 spirit. Inline non-blocking banner above content is the right pattern.

**Q:** Does the user need to see the rejected version?
**Chosen:** Yes, but lazily — click banner to expand.
**Why:** Trust hinges on inspectability ("don't tell me my iteration sucked without showing me"), but defaulting to side-by-side diff is noisy for the 95% case where the user just continues iterating.

**Q:** Is dismissal of the banner persisted?
**Chosen:** Client-side only (per-mount), not server-side.
**Why:** Auto-revert is rare; reappearing on next event is fine, server roundtrip not worth it.

---

## Area 4 — Feedback columns + Accept/Dismiss

**Q:** Are Accept and Dismiss mutually exclusive?
**Chosen:** Yes, mutually exclusive and reversible. Click Accept clears Dismiss, vice versa.
**Why:** A deliverable is either accepted, dismissed, or undecided. Allowing both creates ambiguous state. Reversibility (no "Are you sure?" friction) trusts the user.

**Q:** Does Accept lock further editing?
**Chosen:** No.
**Why:** Accept is feedback, not a workflow gate. User can still iterate post-accept (and the `editsCount` will reflect that). FBK-04 wants feedback to inform future prompts — not freeze present ones.

**Q:** Impression counter — when does it fire?
**Chosen:** Once per ArtifactPanel mount, deduped 5s server-side to drop dev-mode double-fires.
**Why:** "Opened in the artifact panel" is the natural granularity. Per-render fire would massively inflate counts (React re-renders aren't user events). 5s window catches React strict-mode double-effect-fire in development without affecting real user behavior.

**Q:** `editsCount` — does revert count?
**Chosen:** No.
**Why:** "Edit" implies a successful version change. Reverts don't change `currentVersion`. Treating revert as an edit would muddy the feedback signal ("3 edits, 0 accepted" reads worse than reality).

---

## Area 5 — Agent prompt feedback signal

**Q:** Where in the prompt does the signal land?
**Chosen:** After `PROFESSIONAL DEPTH` + `DOMAIN INTELLIGENCE` sections, before user-task context.
**Why:** Identity / expertise sections set who the agent is; feedback section qualifies their recent track record on this project; then comes the actual task. Order matters for LLM attention.

**Q:** Minimum impression threshold?
**Chosen:** ≥3 finalized deliverables.
**Why:** N=1 or N=2 is noise; N=3 gives the smallest sample where "accepted" vs "dismissed" rate has any signal. Below threshold, section is omitted entirely (not rendered with "no data" text — that wastes tokens).

**Q:** What does the signal contain?
**Chosen:** Aggregate counts only, no specific deliverable refs or user identifiers.
**Why:** Privacy + token efficiency. Specific IDs are useless to the LLM and bloat prompts.

**Q:** Cache strategy for the aggregation query?
**Chosen:** In-process LRU per (agentId, projectId), 60s TTL.
**Why:** Feedback rates don't change second-to-second. 60s is short enough to feel responsive after an Accept click. Open question Q2 flags whether to invalidate on write.

---

## Area 6 — Verification

**Q:** Playwright or unit-only?
**Chosen:** Both. Playwright for end-to-end (must run on live restarted dev server per saved feedback rule); unit tests for scorer math + Zod parsing; prompt-snapshot test for feedback-signal injection.
**Why:** Phase 35 established the multi-layer verification pattern. Rubric scoring + auto-revert is conceptually similar (correctness gate on a multi-step flow), same verification rigor applies.

**Q:** Should the Playwright spec include an LLM call?
**Chosen:** Yes, but with cheap deterministic prompts (Groq, temp=0). Spec uses real `iterate` calls — the only way to verify auto-revert end-to-end.
**Why:** Mocked judge output validates plumbing but not "does it actually catch worse iterations." User-facing claim is "refinements that made it worse get reverted" — that needs a real judge call to verify, at least in the spec.

---

## Scope creep redirected

None this turn — auto-mode picked recommended defaults across the board without expanding scope. Any future scope additions would go in `<deferred>` per the discuss-phase workflow's scope_guardrail rule.

---

## Open questions deferred to research/planning

See `36-CONTEXT.md <open_questions>` section (Q1–Q4). Researcher resolves Q1 + Q2 (prompt-structure validation + cache invalidation strategy). Planner resolves Q3 + Q4 (backfill scope + DB-vs-separate-table impression storage).
