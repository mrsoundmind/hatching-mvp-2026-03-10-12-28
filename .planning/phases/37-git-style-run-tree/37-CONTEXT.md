# Phase 37: Git-Style Run Tree — Context

**Gathered:** 2026-05-13
**Mode:** Auto (Claude picked recommended options for every decision)
**Status:** Ready for planning

<domain>
## Phase Boundary

**Goal:** Make autonomous Hatch execution browsable. Every task and handoff that happens in the background becomes a node in a parent-child tree visualized in the right sidebar Activity tab. Score deltas from Phase 36 attach to nodes so users can SEE where quality regressed or improved across a run.

**Concrete surface:**
- Two new tables: `autonomy_runs` (one row per autonomous chain initiation) and `autonomy_run_steps` (one row per task/handoff step within a chain, with parent_step_id self-ref for the tree structure).
- Every autonomous task in `taskExecutionPipeline` writes a step row when it starts and updates it on completion (or failure).
- Every handoff in `handoffOrchestrator` writes a step row with `parent_step_id` set to the originating step.
- Rubric score deltas from Phase 36 attach to step rows that produced a deliverable version (`deliverable_version_id` foreign key on step, `score_delta` numeric column).
- Activity tab in right sidebar gets a new view mode: collapsible tree with one root per `autonomy_runs` row, child nodes per `autonomy_run_steps`, score-delta badges (+1.2 / -0.8 / new) per step where applicable.
- Click a step node → opens the artifact panel (Phase 36 ArtifactPanel) with the specific `deliverable_version_id` if the step produced a deliverable.
- Migration backfills existing `autonomy_events` rows into the new tree structure for historical projects so the tab isn't empty for users with pre-Phase-37 history.

**Out of scope (deferred or future):**
- Editing / annotating tree nodes (read-only view in this phase)
- Cross-project tree views or aggregations
- Filtering / search on the tree
- Real-time streaming updates of the tree as a run progresses (poll-based or WS-on-mount is fine for v1; live streaming is a nice-to-have for later)
- Tree-based replay / rerun of past runs
- Pruning / archiving old runs (everything stays in the DB indefinitely for now)
- A separate "Runs" dashboard at `/runs` — the tree lives ONLY in the right sidebar Activity tab in this phase

</domain>

<canonical_refs>
## Canonical References

| Path | Why |
|---|---|
| `.planning/REQUIREMENTS.md` (lines 53-61) | Phase 37 TREE-01..05 requirements — authoritative source |
| `.planning/ROADMAP.md` (lines 187-198) | Phase 37 success criteria — verification gate |
| `shared/schema.ts:231-255` | Existing `autonomy_events` table — your migration source + reference for column patterns |
| `shared/schema.ts:338-349` | Existing `deliverable_versions` table — step rows FK to this for score delta lookups |
| `shared/schema.ts:295-336` | Existing `deliverables` table — joined for type / title display in tree |
| `server/autonomy/events/eventLogger.ts` | How autonomy events are currently logged (trace_id chain pattern) — your step writes coexist or replace |
| `server/autonomy/execution/taskExecutionPipeline.ts` | Core execution loop — where step-start / step-complete writes get instrumented |
| `server/autonomy/handoff/handoffOrchestrator.ts` | Handoff flow — where parent-child step linkage happens |
| `client/src/components/sidebar/ActivityTab.tsx` | Current flat feed — gains tree view mode |
| `client/src/components/sidebar/ActivityFeedItem.tsx` | Current single-event renderer — becomes one of two render modes (flat vs tree node) |
| `client/src/components/ArtifactPanel.tsx` | Phase 36 host — click-to-open target from tree nodes |
| `.planning/phases/36-frozen-rubric-deliverable-iteration/36-VERIFICATION.md` | Phase 36 verification doc — Phase 37 mirrors structure |
| `CLAUDE.md` §7 (AI System Architecture) | Background execution flow context |

**MEMORY rules (always-on):**
- `feedback_verify_in_runtime.md` — Playwright spec runs on a live restarted dev server before claiming complete
- `feedback_ui_change_protocol.md` — Activity-tab UI change requires Playwright screenshots + explicit approval before commit
- `feedback_no_decimal_hotfixes.md` — Any off-roadmap discovery during Phase 37 goes into Phase 47 backlog, NOT a new decimal phase

</canonical_refs>

<prior_decisions>
## Carrying Forward From Earlier Phases

**From Phase 36 + 36.5 (shipped 2026-05-13):**
- `deliverable_versions.rubricScore` (JSONB `{total, breakdown[]}`) + `rubricVersion` (semver) + `revertedFromHigherScore` (bool) columns exist. Step rows that produced a version FK to that version + compute delta from prior active version on same deliverable.
- ArtifactPanel is the canonical viewer for deliverables. Click-from-tree opens it with the version selected.
- Imperative shortcut endpoints (Phase 36.5) are NOT autonomy events — they're sync user actions. Do NOT create run-tree rows for imperative-shortcut creates (those don't represent agent-driven work).

**From v1.1 (Autonomous Execution Loop, shipped 2026-03-23):**
- `autonomy_events` table is the existing event log. Already indexed on `(project_id, event_type, timestamp)`. Backfill source for TREE-05.
- `traceId` is the canonical chain identifier — every autonomy event in a single chain shares one. This becomes our `autonomy_runs.trace_id` mapping.
- `taskExecutionPipeline` already emits events on task start / complete / fail. Step writes hook adjacent.
- `handoffOrchestrator` emits a handoff event when chaining from one agent to the next. Step parent_step_id = the source agent's step.
- BFS cycle detection exists in handoff orchestrator — no risk of infinite tree depth.

**From v1.3 (Autonomy Visibility, shipped 2026-03-29):**
- Right-sidebar tab layout (Activity / Tasks / Brain) is established. New tree view goes INSIDE the existing Activity tab — does NOT add a new tab.
- `useAutonomyFeed` hook + `ActivityFeedItem` component are the current render pattern. Reuse, don't rebuild.
- Stats summary card (tasks completed, handoffs, cost) at top of Activity tab stays — adds a small toggle next to it for `[Flat] [Tree]` view modes.

**Anti-features (still binding):**
- No dollar amounts in tree node UI (carried from v3.0). Score deltas show "+1.2", "−0.8", "new" — never cost.
- No LLM-based event interpretation. Tree is built from structured rows, not LLM summarization.
- No new tab in the right sidebar. Tree is a view mode inside Activity, not its own tab.

</prior_decisions>

<code_context>
## Reusable Assets / Patterns

| Asset | Where | Reuse pattern |
|---|---|---|
| `autonomy_events` table | `shared/schema.ts:231` | Source for TREE-05 backfill — group by `trace_id` to derive runs, order by `timestamp` to derive step sequence, parent inference via `payload.previousAgent` for handoffs |
| `logAutonomyEvent` | `server/autonomy/events/eventLogger.ts:75` | Augment OR sibling — when an autonomy event fires, also write a step row if it's a task / handoff event type. NOTE: exported function name is `logAutonomyEvent`, not `recordEvent`. |
| `taskExecutionPipeline.executeTask` | `server/autonomy/execution/taskExecutionPipeline.ts` | Step-start at function entry, step-complete (with score delta if deliverable produced) at success return, step-fail at error |
| `orchestrateHandoff` | `server/autonomy/handoff/handoffOrchestrator.ts:15` | Step-start with parent_step_id = caller's current step at handoff begin. NOTE: actual function name is `orchestrateHandoff`, not `routeHandoff`. |
| `useAutonomyFeed` hook | `client/src/hooks/useAutonomyFeed.ts` | Existing flat-feed query pattern — sibling hook `useAutonomyRunTree` for the grouped tree query |
| `ActivityFeedItem` | `client/src/components/sidebar/ActivityFeedItem.tsx` | Current event renderer — extract a `<StepNode>` component that shares the avatar + timestamp + agent-attribution chrome, adds tree indentation + score-delta badge + click-to-open-artifact |
| `ArtifactPanel` open-trigger pattern | `client/src/pages/home.tsx:857` | Tree click dispatches the same `open_deliverable` window event with the FK'd deliverable_id (and optionally a `versionNumber` so the panel opens to the right version) |
| Drizzle parent self-ref pattern | `shared/schema.ts:266` (deliberation_traces.trace_id UNIQUE) + `shared/schema.ts:306` (deliverables.parentDeliverableId self-ref) | Mirror for autonomy_run_steps.parentStepId |

## Files this phase will TOUCH

**New (server):**
- `shared/schema.ts` — add `autonomyRuns` + `autonomyRunSteps` table definitions
- `server/autonomy/runs/runTreeWriter.ts` — encapsulates step-start / step-complete / step-fail / handoff-link writes
- `server/autonomy/runs/runTreeBackfill.ts` — migration logic: read `autonomy_events`, write `autonomy_run_steps`
- `server/routes/autonomy.ts` — add `GET /api/projects/:id/runs` endpoint returning the tree (runs + steps nested)
- `scripts/test-run-tree-writer.ts` — unit tests
- `scripts/test-run-tree-backfill.ts` — backfill correctness tests

**Modified (server):**
- `server/autonomy/execution/taskExecutionPipeline.ts` — instrument step-start / complete / fail
- `server/autonomy/handoff/handoffOrchestrator.ts` — instrument step parent linking
- `server/autonomy/events/eventLogger.ts` — coexist with the new writer (events still flow for the existing flat feed; steps are a parallel write)
- `server/storage.ts` — IStorage gains `createRun`, `createRunStep`, `updateRunStep`, `getRunsByProject` + MemStorage + DatabaseStorage implementations

**New (client):**
- `client/src/components/sidebar/RunTreeView.tsx` — the recursive tree renderer
- `client/src/components/sidebar/RunTreeNode.tsx` — single step row with avatar / role / score-delta badge / click handler
- `client/src/components/sidebar/ActivityViewModeToggle.tsx` — `[Flat] [Tree]` segmented control at top of Activity tab
- `client/src/hooks/useAutonomyRunTree.ts` — TanStack Query hook fetching the tree
- `tests/e2e/phase-37-run-tree.spec.ts` — Playwright runtime spec

**Modified (client):**
- `client/src/components/sidebar/ActivityTab.tsx` — adds view-mode state + conditional render of `<RunTreeView>` vs existing flat list
- `client/src/components/sidebar/ActivityFeedItem.tsx` — extracted shared chrome shared with RunTreeNode (refactor, not rewrite)
- `client/src/pages/home.tsx` — `open_deliverable` event handler extended to accept `versionNumber` field

**Migration:**
- Drizzle schema push adds 2 new tables. Backfill runs once on next deploy via a `npm run backfill:run-tree` script that reads `autonomy_events`, groups by `trace_id`, infers parent edges, writes step rows. Idempotent (skip projects where any `autonomy_run_steps` row already exists for that trace_id).

</code_context>

<decisions>
## Implementation Decisions

### Schema design (TREE-01, TREE-02)

- **D-01:** `autonomy_runs` table columns: `id` (UUID PK), `traceId` (text — matches existing `autonomy_events.trace_id`), `projectId` FK, `userId` FK, `rootAgentId` FK to agents (the agent that initiated the run), `rootGoal` (text, ≤ 500 chars — the user's original request or task description), `status` (enum: 'running' | 'complete' | 'failed' | 'cancelled'), `stepCount` (int, denormalized for fast UI count), `aggregateScoreDelta` (numeric, sum of step deltas — null if no deliverables produced), `createdAt`, `updatedAt`.
- **D-02:** `autonomy_run_steps` table columns: `id` (UUID PK), `runId` FK to autonomy_runs, `parentStepId` (UUID, self-ref nullable — null = root step of run), `traceId` (text, denormalized for fast filter), `agentId` FK, `agentName` (text), `agentRole` (text), `stepType` (enum: 'task' | 'handoff' | 'peer_review' | 'deliberation' | 'safety_block' | 'approval_request'), `title` (text, ≤ 200 chars — human-readable step name), `status` (enum: 'pending' | 'running' | 'complete' | 'failed' | 'skipped'), `deliverableId` FK to deliverables nullable, `deliverableVersionId` FK to deliverable_versions nullable, `scoreDelta` (numeric nullable — positive = improved, negative = regressed, null = no deliverable), `metadata` (JSONB, free-form per step type), `startedAt`, `completedAt` (nullable until done), `latencyMs` (int nullable).
- **D-03:** Indexes: `(runId, parentStepId)` for tree traversal, `(projectId, createdAt DESC)` on runs for "latest 20 runs" listing, `(traceId)` on both for backfill correlation.
- **D-04:** Both new tables use Drizzle ORM + Zod insert schemas. No raw SQL. `npm run db:push` to apply.

### Step writer integration (TREE-02)

- **D-05:** New `server/autonomy/runs/runTreeWriter.ts` module exports: `createRun(input)`, `startStep(runId, parentStepId, input) → stepId`, `completeStep(stepId, output)`, `failStep(stepId, error)`. Pure async wrappers over storage methods — no business logic inside.
- **D-06:** `taskExecutionPipeline.executeTask` (in `server/autonomy/execution/taskExecutionPipeline.ts:317`) is instrumented at 3 points: (a) on function entry, lookup-or-create the run (by `traceId` from the calling context), then `startStep` with stepType='task', returning a `stepId` held in local var; (b) on successful return, `completeStep(stepId, { deliverableId, deliverableVersionId, scoreDelta })` where the deliverable IDs are usually NULL (see D-06.1) and `scoreDelta` is computed when both are non-null as `currentVersion.rubricScore.total − priorVersion.rubricScore.total`; (c) on any throw, `failStep(stepId, error)` before rethrow.
- **D-06.1 (added 2026-05-13 post-audit):** **The autonomous task pipeline does NOT currently produce Phase 36 deliverables.** Audit confirmed: `server/autonomy/execution/taskExecutionPipeline.ts` produces text output (JSON array of `{taskIndex, output}` stored in task metadata), but never calls `storage.createDeliverable`. Phase 36 deliverables are created via a separate code path (`server/ai/deliverableGenerator.ts`, invoked from chat / organic detection / explicit user requests). **Consequence for Phase 37:** ~100% of live-generated step rows will have `deliverableVersionId = null` and `scoreDelta = null`. Tree shows steps with "new" badges or no badge — score-delta value is mostly theoretical until autonomy is wired to deliverables in a future phase. **Logged as Phase 47 backlog discovery #2** for triage. Phase 37 ships as-is; tree visualization of "who did what when" still has value without scores attached.
- **D-07:** `orchestrateHandoff` (in `server/autonomy/handoff/handoffOrchestrator.ts:15` — NOT `routeHandoff`, that was my misnaming in the original audit) instrumented at the point where a handoff target is decided: write a step row with `stepType='handoff'` and `parentStepId = sourceStep.id`. The downstream agent's `executeTask` then writes a `'task'` step with `parentStepId = handoffStep.id` — tree shows source-task → handoff-link → next-task as 3 generations.
- **D-07.1 (added 2026-05-13 post-audit):** Phase 37 ALSO instruments `orchestrateHandoff` to call `logAutonomyEvent({ eventType: 'handoff_initiated', payload: { fromAgent, toAgent, taskId } })` alongside the step write. **Why:** the existing `autonomy_events` catalog has no `handoff_initiated` event type today (only `task_failed` fires on cycle detection). Without this addition, future re-backfills against richer event history would still produce flat trees. Adding the discrete event makes the system forward-compatible: if anyone re-runs the backfill 6 months from now, post-Phase-37 handoffs WILL reconstruct properly. Pure additive — no impact on the existing flat feed.
- **D-08:** Safety blocks (when risk score ≥ 0.70) get their own `stepType='safety_block'` row. Peer reviews get `stepType='peer_review'` with `parentStepId = subjectStep.id`. Deliberation traces (multi-agent rounds) collapse into a single `stepType='deliberation'` row with metadata listing the rounds.
- **D-09:** Score delta computation lives server-side in the writer module — UI receives the precomputed number, doesn't need to do delta math. `null` delta renders as "new" badge; `0` renders nothing (no visual noise for unchanged scores); positive renders green `+1.2`; negative renders amber `−0.8`. Color thresholds match Phase 36 score-chip palette.

### Activity tab integration (TREE-03)

- **D-10:** New `ActivityViewModeToggle` segmented control at the top of `ActivityTab.tsx`, just above the stats summary card. Two options: `[Flat]` (existing list, default for new users) and `[Tree]` (new view). State persists in localStorage per-project (`activityViewMode:${projectId}`). Default = `Tree` when the project has ≥1 run with ≥3 steps (signal that tree is worth showing); else `Flat`.
- **D-11:** Tree view renders one collapsible card per run (most-recent first, limit 20 per page with "Show older" affordance). Each card: header row (root agent avatar, root goal text truncated to 1 line, total step count, aggregate score delta badge, expand/collapse chevron). Body when expanded: indented tree of step nodes.
- **D-12:** RunTreeNode visual contract: avatar (12px circle, agent color), agent name (semibold 11px), role (muted 10px), step title (text 11px), score-delta badge (right-aligned, only when scoreDelta is non-null and non-zero), step type icon (tiny lucide icon at left edge: ⏱ for task, ↔ for handoff, ⚐ for safety_block, 🔎 for peer_review, 💭 for deliberation). Indentation: 16px per generation (3 generations max visible before horizontal scroll — deeper steps clip with "···N more" expand affordance).
- **D-13:** Click any RunTreeNode that has a non-null `deliverableId` → dispatch `window.dispatchEvent('open_deliverable', { detail: { deliverableId, versionNumber } })` — opens ArtifactPanel pinned to that version. Click on steps with no deliverable (handoff / safety_block / etc.) → expands a collapsible inline detail block showing `metadata` JSONB as a tiny key-value grid.
- **D-14:** Empty state: when project has zero runs, tree view shows a card: "No autonomous runs yet. Once a Hatch starts working on a task in the background, you'll see the run tree here." Includes a small illustration / icon.

### Click-to-deliverable wiring (TREE-04)

- **D-15:** `home.tsx`'s existing `open_deliverable` event handler accepts an optional `versionNumber` field. If present, the ArtifactPanel auto-clicks the version-navigator to that version after mount. Backward compatible — existing dispatchers that don't send `versionNumber` get current behavior (most-recent version).
- **D-16:** The score-delta badge on a tree node and the rubric-breakdown card inside the artifact panel use the same color thresholds and number formatting (e.g. `+1.2` vs `+1.20`). Single helper `formatScoreDelta(n)` in `shared/scoreFormat.ts` (NEW).

### Backfill strategy (TREE-05)

- **D-17:** Backfill is a one-shot script (`scripts/backfill-run-tree.ts`), idempotent. Logic: for each project, find all distinct `trace_id` in `autonomy_events` that have NO corresponding `autonomy_runs` row. For each, create a run row, then walk events in timestamp order writing step rows. Parent inference is heuristic: for `peer_review_started` / `revision_requested`, parent = most-recent task step on same agent; for everything else, parent = run's root step.
- **D-18 (revised 2026-05-13 post-audit):** Backfill quality is **flat list per trace_id, not reconstructed tree.** Audit confirmed `autonomy_events` does NOT log handoffs as a discrete event type today — the existing catalog is `autonomous_task_execution`, `task_failed`, `peer_review_*`, `revision_*`, `contradiction_resolved`, `hallucination_detected`. No `handoff_initiated`. So historical handoff edges are **unrecoverable from events alone** — backfill produces flat step lists under each run root for pre-Phase-37 trace_ids. Run rows from backfill get `metadata.backfilledFrom = 'autonomy_events'` + `metadata.flatHistorical = true` so the UI can show a small "imported flat from history — newer runs will show full tree" hint on those nodes. Acceptable per "make autonomous Hatch work browsable" goal — flat per-run timeline is still better than the current nothing. The D-07.1 `handoff_initiated` event added by this phase ensures POST-Phase-37 runs WILL backfill properly in future re-runs.
- **D-19:** Score deltas on backfilled steps: if the step's `deliverable_version_id` can be inferred from `payload`, look up the rubricScore. If the version is pre-Phase-36 (rubricScore is null), `scoreDelta` stays null and the badge renders "new" — same handling as live steps with no prior version.
- **D-20:** Backfill runs ONCE on next deploy. Triggered manually via `npm run backfill:run-tree` (NOT a cron, NOT automatic on app boot — explicit one-shot per CLAUDE.md anti-pattern about automatic migrations). After it runs, future autonomy events auto-write step rows via the new instrumentation (D-06, D-07).

### Live updates strategy

- **D-21:** Tree is poll-based, not real-time WS-streamed. The existing `useAutonomyFeed` polls every 30s; `useAutonomyRunTree` uses the same cadence. WS updates of in-flight runs are deferred to a future phase (likely a Phase 47 backlog entry if surfaced). Justification: tree is a "post-mortem" visualization most of the time; live updates add complexity without proportional value at MVP.
- **D-22:** On WS events that indicate a run completed (existing `task_completed` / `chain_completed`), the client invalidates the `useAutonomyRunTree` query for that project — gives near-instant refresh without WS streaming the full tree state.

### Verification

- **D-23:** Playwright runtime spec at `tests/e2e/phase-37-run-tree.spec.ts`. Cases:
  1. **Seed 1 run with 3 steps** (task → handoff → task) via the storage layer, open the project, switch Activity tab to Tree mode, assert all 3 step nodes render with correct indentation
  2. **Click a step that has a deliverableId** → ArtifactPanel opens with the right deliverable + version
  3. **Score delta rendering** — seed a step with `scoreDelta: +1.5` → assert green badge with "+1.5"; seed with `scoreDelta: -0.8` → amber "−0.8"; seed with `scoreDelta: null` → "new" badge
  4. **Backfill correctness** — seed 5 `autonomy_events` rows under a single `traceId`, run the backfill script, assert 1 run row + 5 step rows exist with correct parent linkage where inferable
  5. **Empty state** — fresh project with zero runs shows the "No autonomous runs yet" card
  6. **Toggle persistence** — switch to Tree mode, reload page, assert tree mode is still selected (localStorage key intact)
- **D-24:** Unit tests at `scripts/test-run-tree-writer.ts` (createRun / startStep / completeStep / failStep semantics, score delta math, parent-step nullability) and `scripts/test-run-tree-backfill.ts` (idempotency, parent inference from payload, score-delta computation from rubricScore).
- **D-25:** Deploy gate: green Playwright (6 cases, 2x deterministic) + typecheck + build. Same two-step gate as Phase 35 / 36. `fly deploy` ships Phase 37 alongside the Phase 36 + 36.5 work if not yet deployed, OR as a follow-up release if the user shipped 36/36.5 first.

### Plan breakdown (planner can refine)

- **37-01** — Foundation: schema additions (`autonomy_runs` + `autonomy_run_steps`), Zod insert schemas, storage methods (createRun, createRunStep, updateRunStep, getRunsByProject) on IStorage + MemStorage + DatabaseStorage, Wave-1 unit tests for storage layer. Apply via `npm run db:push`.
- **37-02** — Server writer + instrumentation: `runTreeWriter.ts` module, instrument `taskExecutionPipeline` (3 hook points) + `handoffOrchestrator` (parent linking), score delta computation, `GET /api/projects/:id/runs` endpoint. Unit tests for writer module.
- **37-03** — Client UI: `RunTreeView` + `RunTreeNode` components, `ActivityViewModeToggle`, `useAutonomyRunTree` hook, ArtifactPanel `versionNumber` param wiring, empty state. **Visual checkpoint required** before commit (UI change protocol).
- **37-04** — Backfill + verification: `scripts/backfill-run-tree.ts` + idempotency tests + Playwright 6-case spec on live dev server + `37-VERIFICATION.md` mapping success criteria to PASS.

</decisions>

<deferred>
## Noted for Later

- **Real-time WS streaming of in-flight run trees** — D-21 punts on this; if user pain surfaces, add to Phase 47 backlog as a candidate. Current 30s polling is fine for post-mortem viewing.
- **Tree filtering / search** ("show me only runs with negative score deltas", "show me runs where Pixel was involved") — deferred to Phase 47 backlog.
- **Run replay / rerun** ("re-execute this run with a different starting prompt") — out of scope; future phase if requested.
- **Cross-project aggregation dashboard** ("which projects have the most regressions this week") — out of scope; future analytics work.
- **Tree node annotations** (user adds a note to a step) — deferred; would require a `step_annotations` table.
- **Pruning / archiving old runs** — deferred; current scope keeps everything indefinitely. If volume becomes a concern, add a Phase 47 backlog entry for archival.
- **Mobile responsive tree** — defer to mobile sweep phase; current scope assumes desktop sidebar width (350-400px).

</deferred>

<open_questions>
## Open Questions (for researcher / planner to resolve, not user)

- **Q1 (research):** Best library for the indented tree visualization. Options: pure CSS + nested divs (simplest, no dep), `react-arborist` (ratchets up complexity), `react-flow` (overkill for sidebar size). Recommend simplest first; the indentation contract in D-12 is doable with CSS alone.
- **Q2 (research):** Optimal index strategy for the `(runId, parentStepId)` lookup vs `(traceId)` lookup. The tree-view query is `SELECT * FROM autonomy_run_steps WHERE runId = ? ORDER BY startedAt`; the backfill is `WHERE traceId = ?`. Confirm composite vs separate indexes.
- **Q3 (planner):** Should the backfill script run automatically on first server boot after Phase 37 deploys, or strictly manual via npm run? D-20 says manual. Researcher to validate with prod-readiness checklist.
- **Q4 (planner):** Step rows are insert-then-update (start, then complete/fail). For a 100k+ steps/year project this is 200k+ writes/year. Confirm storage method shapes are atomic and we don't get stuck rows (where startStep wrote but completeStep never fired — should we run a sweeper cron, or rely on the orchestrator's existing timeout mechanisms)?

</open_questions>

---

**Next:** `/gsd-plan-phase 37`
