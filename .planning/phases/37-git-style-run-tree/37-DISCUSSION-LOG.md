# Phase 37 — Discussion Log

**Mode:** Auto (Claude picked recommended options without prompting; user requested auto-mode in session)
**Date:** 2026-05-13

This log captures the reasoning behind each decision in `37-CONTEXT.md`. Downstream agents (researcher, planner) read CONTEXT.md, not this file. This is for human audit / retrospective only.

---

## Areas covered

All 7 gray areas auto-selected:

1. Schema design (autonomy_runs + autonomy_run_steps)
2. Step writer integration in taskExecutionPipeline + handoffOrchestrator
3. Activity tab integration (view-mode toggle, tree renderer)
4. Click-to-deliverable wiring (ArtifactPanel version pinning)
5. Backfill strategy for historical autonomy_events
6. Live updates strategy (poll vs WS streaming)
7. Verification approach

---

## Area 1 — Schema design

**Q:** Two tables (runs + steps) or one wide table?
**Chosen:** Two tables.
**Why:** Runs are first-class entities with their own lifecycle (status, aggregate score delta, root goal). Mixing run-level metadata into step rows would duplicate it across every step row. Two tables also makes "list latest 20 runs" a simple query against `autonomy_runs` without aggregation.

**Q:** parent_step_id self-ref or adjacency-list table?
**Chosen:** Self-ref on `autonomy_run_steps.parentStepId`.
**Why:** Self-ref is simpler, fewer joins, sufficient for the tree depth we'll see (typically 3-6 levels max — a handoff chain). Adjacency-list table would be over-engineering for the read pattern (recursive CTE walks the self-ref fine at this scale).

**Q:** Index strategy?
**Chosen:** Composite `(runId, parentStepId)` for tree-build queries, `(projectId, createdAt DESC)` on runs for listing, `(traceId)` on both for backfill correlation.
**Why:** Three queries to optimize — tree fetch, run listing, backfill scan. Each gets one matched index.

## Area 2 — Step writer integration

**Q:** Replace eventLogger or coexist?
**Chosen:** Coexist.
**Why:** The existing flat feed (`useAutonomyFeed`) is built on `autonomy_events`. Tearing it out would break the v1.3 UI users already use. Step rows are a parallel write. Future cleanup phase can deprecate `autonomy_events` if we prove the tree replaces all its uses.

**Q:** Where to instrument inside taskExecutionPipeline?
**Chosen:** 3 hook points — entry (startStep), success-return (completeStep with delta), throw (failStep).
**Why:** Minimal surface, clear lifecycle. startStep returns the new ID; pipeline holds it in local var; completeStep/failStep update with the same ID. No global state, no async race.

**Q:** Score delta computation — client-side or server-side?
**Chosen:** Server-side in the writer module.
**Why:** Delta math is a single subtraction (current.rubricScore.total − priorVersion.rubricScore.total). Server has the prior version row already loaded (or one extra SELECT). Sending raw scores to the client and asking it to do delta math means the client also needs the prior version — extra payload, more chances to drift if rubricVersion changes.

## Area 3 — Activity tab integration

**Q:** New tab or view mode inside Activity?
**Chosen:** View mode inside Activity (toggle at top).
**Why:** v1.3 established the 3-tab structure (Activity / Tasks / Brain). Adding a 4th tab would expand the navigation footprint for what's structurally an Activity-tab concept. Toggle keeps the cognitive load constant.

**Q:** Tree view default for new users?
**Chosen:** Flat for users with <1 run-of-3-steps, Tree for users with rich autonomy history.
**Why:** New users with empty history would see a "no runs yet" card under Tree — discouraging. Flat list shows individual events including peer reviews, safety blocks, brain updates — more visual feedback at low volume. Auto-switch when there's something worth tree-viewing.

**Q:** Indentation handling at deep nesting?
**Chosen:** 16px per generation, max 3 visible before "···N more" affordance.
**Why:** Sidebar is ~350-400px wide. 4+ generations of 16px indentation eats half the width. Cap at 3 visible; deeper steps still exist in data, just collapsed under a "show deeper" expand.

## Area 4 — Click-to-deliverable wiring

**Q:** Extend existing event or new event?
**Chosen:** Extend existing `open_deliverable` event with optional `versionNumber`.
**Why:** Backward compatible — existing dispatchers from Phase 36 / chat / package progress keep working. New tree dispatcher adds versionNumber when relevant. One event, one handler, simpler mental model.

**Q:** What does the artifact panel do with versionNumber?
**Chosen:** Auto-click the version navigator after mount.
**Why:** Phase 36's panel already has version navigator UI. Pinning to a specific version is one programmatic click. No new UI surface needed.

## Area 5 — Backfill strategy

**Q:** Best-effort or strict?
**Chosen:** Best-effort.
**Why:** Historical `autonomy_events` was designed for a flat feed, not tree reconstruction. Some events lack explicit parent linkage. Strict backfill would require either heuristic guesses or dropping events that can't be placed — both lossy. Best-effort with a `metadata.backfilledFrom` marker lets us identify these for future cleanup if needed, while still showing SOMETHING in the tree view.

**Q:** When does the backfill run?
**Chosen:** Manual one-shot via `npm run backfill:run-tree`.
**Why:** Per CLAUDE.md anti-pattern about automatic migrations on app boot. Manual gives the operator control over timing (off-hours, after a fresh deploy with monitoring up). Idempotent so it's safe to re-run.

## Area 6 — Live updates strategy

**Q:** WS streaming or polling?
**Chosen:** 30s polling.
**Why:** Most tree viewing is post-mortem ("what happened during the chain that ran at 3am?"). Real-time tree updates of in-flight chains is a nice-to-have for users actively watching agents work, but it's a relatively small fraction of tree usage. Polling is simpler, hooks into the existing `useAutonomyFeed` rhythm. If user pain surfaces, add WS streaming as a Phase 47 backlog entry.

**Q:** What invalidates the cache?
**Chosen:** Existing `task_completed` / `chain_completed` WS events trigger TanStack Query invalidation for the tree.
**Why:** Cheapest signal — server already broadcasts these. Client refetches on receipt. Near-instant freshness when something interesting happens; otherwise the 30s poll covers gradual drift.

## Area 7 — Verification

**Q:** Playwright spec scope?
**Chosen:** 6 cases — seed-tree-and-render, click-to-deliverable, score-delta rendering (3 variants in one case), backfill correctness, empty state, toggle persistence.
**Why:** Matches the success criteria 1-to-1 plus the backfill criteria 5. Same rigor as Phase 36 spec (4 cases) scaled to Phase 37's larger surface.

**Q:** Manual or automated backfill verification?
**Chosen:** Automated — seed events, run backfill, assert step rows.
**Why:** Backfill is the highest-risk part of Phase 37 (data migration on production data). Manual verification doesn't catch regressions. Automated unit-level test of `runTreeBackfill.ts` + Playwright case 4 cover both layers.

---

## Scope creep redirected

- **Real-time WS streaming** — surfaced as a natural extension; redirected to Phase 47 backlog candidate (D-21 + Deferred Ideas list).
- **Tree filtering / search** — surfaced as a future need; redirected to Phase 47 backlog candidate.
- **Cross-project aggregation** — out of scope; flagged as "future analytics work" without a phase target.

Per the 2026-05-13 no-decimal-hotfixes rule, none of these become Phase 37.5 / 37.6 / etc. If they get worth shipping during Phase 47 triage, they go there.

---

## Open questions deferred to research/planning

See `37-CONTEXT.md <open_questions>` section (Q1–Q4). Researcher resolves Q1 (tree lib choice) + Q2 (index strategy). Planner resolves Q3 (backfill boot vs manual) + Q4 (stuck step rows + sweeper need).
