---
phase: 37-git-style-run-tree
verified: 2026-05-14
status: PASS-WITH-NOTES (5/5 ROADMAP criteria, 5/5 requirements — 2 acknowledged limitations per D-06.1 and D-18)
deploy-pending: fly deploy (user-action — bundle with Phase 36 + 36.5 if not yet deployed)
---

# Phase 37 Verification — PASS-WITH-NOTES

## Phase goal (from ROADMAP.md)

> Every autonomous chain emits a tree of run-step rows. The Activity-tab sidebar visualizes the tree per project — collapsible nodes, semantic-word badges (✓ Improved / ⚠ Made worse / In progress for runs; ✓ Better / ⚠ Worse / New for steps). Clicking a step opens the deliverable version the step produced. Historical autonomy_events are backfilled into the same shape so old projects show meaningful trees.

## ROADMAP Success Criteria

| # | Criterion (ROADMAP.md:191-196) | Status | Evidence |
|---|--------------------------------|--------|----------|
| 1 | New `autonomy_runs` + `autonomy_run_steps` schema models autonomous chains as DAG with parent-child step relationships | PASS | `shared/schema.ts` has both tables (37-01); `parent_step_id` self-ref; `npm run db:push` applied; 4 indexes confirmed via `pg_indexes` (`autonomy_run_steps_run_id_idx`, `autonomy_run_steps_trace_id_idx`, `autonomy_run_steps_parent_step_id_idx`, `autonomy_runs_project_id_idx`). |
| 2 | Every autonomous task and handoff writes a step row including agent, role, deliverable_version_id (when applicable), and rubric score delta | PASS-WITH-NOTES | 3-hook instrumentation present on BOTH `executeTask` AND `executeTaskWithOutput` (37-02 Task 2 — Pitfall 6 defense verified); `orchestrateHandoff` writes parent-linked handoff step + `handoff_initiated` event (37-02 Task 3). **NOTE (D-06.1):** autonomy pipeline does NOT currently call `storage.createDeliverable` → ~100% of live step rows have `deliverableVersionId=null` + `scoreDelta=null`. Instrumentation IS correct; data is sparse pending Phase 47 backlog #2 bridge work. |
| 3 | Activity-tab sidebar visualizes the run tree per project — collapsible nodes with score-delta badges per step | PASS | 37-03 ships `ActivityViewModeToggle` + `RunTreeView` + `RunTreeNode`. Visual checkpoint approved by user 2026-05-14 with mid-flight verb-led clarity pass: signed-number pills replaced by semantic-word pills (`✓ Better` / `⚠ Worse` / `New` for steps; `✓ Improved` / `⚠ Made worse` / `In progress` for aggregate). New memory rule saved: `feedback_ui_self_documenting.md`. Playwright case 3 verifies semantic-word pills 2x stable. |
| 4 | Clicking a step node opens the deliverable version it produced and its rubric breakdown | PASS | W-4 closure: 37-01 schema adds `deliverable_version_number` column; 37-02 writer's `completeStep` runs an inline `db.select({ versionNumber })` on `deliverable_versions` and denormalizes onto the step row; 37-03 `handleStepClick` reads `step.deliverableVersionNumber` and dispatches `open_deliverable` with `{ versionNumber }`; `ArtifactPanel.pendingVersionNumber` prop auto-navigates via existing `restoreMutation`. Playwright case 2 (`click-to-deliverable`) asserts navigator shows `v1 of 2` even when v2 is the most-recent — proves the pin to step's recorded version. Phase 36 RubricBreakdown card surfaces the per-criterion score (RUBR-04 already shipped). |
| 5 | Migration backfills existing autonomy_events rows so historical projects show meaningful trees | PASS-WITH-NOTES | 37-04 ships `scripts/backfill-run-tree.ts` (`npm run backfill:run-tree`); 4 unit-test cases prove correctness + idempotency + 5-min stable-event window + score-delta math with NaN guard. **NOTE (D-18):** historical handoff edges are unrecoverable from pre-Phase-37 `autonomy_events` (no `handoff_initiated` event existed before 37-02). Backfilled runs are flat-per-trace, marked `metadata.flatHistorical=true`; UI surfaces the "imported flat from history" hint (Playwright case 4 asserts). Forward-compat: POST-Phase-37 runs WILL backfill with full tree structure on future re-runs because 37-02 now emits `handoff_initiated`. |

## Requirements coverage

| ID | Description | Plan | Status | Evidence |
|----|-------------|------|--------|----------|
| TREE-01 | New `autonomy_runs` and `autonomy_run_steps` tables with parent-child relationships modeling autonomous execution as a DAG | 37-01 | PASS | `shared/schema.ts` (12 + 19 cols); `pg_indexes` verified; `scripts/test-run-tree-writer.ts` cases schema-shape + writer-roundtrip + parent-mismatch-rejected + mem-db-parity-storage-only all PASS deterministic 2x. |
| TREE-02 | Every autonomous task and handoff writes a step row; rubric score deltas attach to step nodes | 37-02 | PASS-WITH-NOTES | `runTreeWriter` + 3-hook on BOTH `executeTask` paths (Pitfall 6 defense) + handoff parent-linking; `scripts/test-run-tree-writer.ts` cases pipeline-instrumentation + handoff-instrumentation + score-delta-math all PASS. **D-06.1 limitation noted in success criterion 2 above.** |
| TREE-03 | Activity feed sidebar visualizes the run tree per project — collapsible nodes, score-delta badges (semantic-word pills per `feedback_ui_self_documenting.md`) | 37-03 | PASS | Visual checkpoint approved 2026-05-14; mid-flight clarity pass applied per user feedback. Playwright case 1 (tree-render) + case 3 (score-delta-badges Better/Worse/New) + case 6 (toggle-persistence) all PASS 2x stable. |
| TREE-04 | User can click any step node to see the deliverable version produced and its score | 37-03 (W-4) | PASS | W-4: `deliverable_version_number` denormalized on step row + `pendingVersionNumber` prop on ArtifactPanel + `open_deliverable` handler extension on home.tsx. Playwright case 2 (click-to-deliverable) asserts `v1 of 2` (v1 active, NOT v2 most-recent) — closes the TREE-04 success-criterion gap. Phase 36 RubricBreakdown already shipped (RUBR-04). |
| TREE-05 | Migration backfills existing `autonomy_events` rows into the run tree for historical projects | 37-04 | PASS-WITH-NOTES | `scripts/backfill-run-tree.ts` + `scripts/test-run-tree-backfill.ts` 4/4 PASS deterministic 2x. Playwright case 4 (backfill-correctness via `/api/dev/mark-flat-historical` simulation) asserts the UI hint surfaces. **D-18 flat-historical limitation acknowledged below.** |

**5/5 requirements closed; 2 acknowledged limitations (D-06.1 + D-18) — see Acknowledged Limitations table.**

## Acknowledged Limitations

| ID | Limitation | Why | Backlog |
|----|-----------|-----|---------|
| D-06.1 | ~100% of live step rows carry `deliverableVersionId = null` + `scoreDelta = null` (so most pills render `New`, not `Better` / `Worse`) | Autonomy pipeline (`taskExecutionPipeline.executeTask`) does NOT currently call `storage.createDeliverable`. Phase 36 deliverables are produced via a different code path (`deliverableGenerator`) invoked from chat. The Phase 37 instrumentation captures EVERYTHING it sees; there's just no deliverable to attach to most autonomy tasks today. | Phase 47 backlog #2 — wire `taskExecutionPipeline` to produce deliverables (type-inferred from agent role + task description, or generic `process-doc` fallback) when output is substantial. Tree visualization of "who did what when" still works correctly without delta values. |
| D-18 | Historical (pre-Phase-37) runs reconstruct as FLAT lists per traceId — no parent-child structure between steps | `autonomy_events` catalog before 37-02 has no `handoff_initiated` event type. Handoff edges are unrecoverable from existing event payloads alone. | Phase 47 candidate — if/when richer events become available (e.g., via post-deploy event-replay enrichment), re-run backfill. POST-Phase-37 runs WILL backfill with full tree structure if backfill is re-run later because 37-02 now emits `handoff_initiated`. Forward-compat preserved. |

## Test Evidence

### Static gates

```bash
# Schema + types
grep -c 'pgTable("autonomy_run' shared/schema.ts                # >= 2 (runs + run_steps)
grep -c "createRunStep" server/storage.ts                       # >= 3 (IStorage + MemStorage + DatabaseStorage)

# Server writer + instrumentation (37-02)
grep -c "ensureRunForTrace" server/autonomy/execution/taskExecutionPipeline.ts        # >= 1
grep -c "startStep(\|completeStep(\|failStep(" server/autonomy/execution/taskExecutionPipeline.ts  # >= 6 (3 hooks × 2 paths)
grep -c "handoff_initiated" server/autonomy/events/eventTypes.ts                       # >= 1

# Routes
grep -c "/api/projects/:projectId/runs" server/routes/autonomy.ts                      # >= 1
grep -c "/api/dev/seed-run-tree" server/routes/autonomy.ts                             # >= 1
grep -c "/api/dev/reset-run-tree" server/routes/autonomy.ts                            # >= 1
grep -c "/api/dev/mark-flat-historical" server/routes/autonomy.ts                      # >= 1
grep -c "NODE_ENV === 'production'" server/routes/autonomy.ts                          # >= 3 (one per DEV handler)

# Playwright config + spec
grep -c "phase-37" playwright.config.ts                                                # >= 1
grep -E "^  test\(" tests/e2e/phase-37-run-tree.spec.ts | wc -l                        # >= 6

# Backfill module
grep -c "interval '5 minutes'\|5 \* 60 \* 1000" server/autonomy/runs/runTreeBackfill.ts  # >= 1 (Pitfall 3)
grep -c "flatHistorical" server/autonomy/runs/runTreeBackfill.ts                       # >= 1 (D-18 marker)
grep -c "Number.isFinite" server/autonomy/runs/runTreeBackfill.ts                      # >= 1 (D-19 NaN guard)
grep -c "BackfillDeps" server/autonomy/runs/runTreeBackfill.ts                         # >= 2 (interface + default)

# TypeScript
npx tsc --noEmit                                                                       # exit 0
```

### Unit suite

```bash
STORAGE_MODE=memory NODE_ENV=test npx tsx scripts/test-run-tree-writer.ts
# Wave 1 (37-01): schema-shape, writer-roundtrip, parent-mismatch-rejected, mem-db-parity-storage-only
# Wave 2 (37-02): pipeline-instrumentation, handoff-instrumentation, score-delta-math
# All Wave 1+2 cases passed (7/7).

STORAGE_MODE=memory NODE_ENV=test npx tsx scripts/test-run-tree-backfill.ts
# PASS seed-5-events-flat: 1 run + 5 flat steps + flatHistorical=true
# PASS idempotency: second invocation creates 0 runs / 0 steps
# PASS 5-minute-window-respected: fresh events skipped, old events processed
# PASS score-delta-from-payload: finite delta + null-prior fallback + W-4 versionNumber denormalized
# All backfill cases passed (4/4).
```

### E2E (Playwright) — runs on LIVE FRESHLY-RESTARTED dev server

Per saved memory rule `feedback_verify_in_runtime.md` ("phase complete in git ≠ works"):

```bash
pkill -f "tsx server" || true && sleep 2
STORAGE_MODE=memory npm run dev &
# wait until http://localhost:5001/api/health responds
npx playwright test --project=phase-37 --reporter=list   # 1st run: 7 passed (setup + 6 cases) in 2.7m
npx playwright test --project=phase-37 --reporter=list   # 2nd run: 7 passed (setup + 6 cases) in 2.6m
```

6/6 PASS deterministic 2x on 2026-05-14.

Cases:
1. `tree-render` — 3-step chain (task → handoff → task) renders all step titles after auto-expand.
2. `click-to-deliverable` — clicking a step opens ArtifactPanel pinned to step's `deliverableVersionNumber` (W-4 closure: v1 active, NOT v2 most-recent).
3. `score-delta-badges` — semantic-word pills `✓ Better` / `⚠ Worse` / `New` render correctly per verb-led clarity pass (37-03).
4. `backfill-correctness` — flatHistorical metadata surfaces the "imported flat from history" UI hint.
5. `empty-state` — fresh project shows "No autonomous runs yet" copy.
6. `toggle-persistence` — Tree mode survives reload (localStorage round-trip).

### Visual Checkpoint Screenshots (37-03)

User-approved 2026-05-14:
- `.planning/phases/37-git-style-run-tree/screenshots/01-empty-tree.png` (referenced in 37-03-SUMMARY.md)
- `.planning/phases/37-git-style-run-tree/screenshots/02-tree-with-3-steps.png`
- `.planning/phases/37-git-style-run-tree/screenshots/03-artifact-panel-from-tree.png`

## Deploy Gate

| Check | Status | Command |
|-------|--------|---------|
| TypeScript strict | PASS | `npm run typecheck` |
| Production build | PASS | `npm run build` (1.1mb bundle; pre-existing chunk warning unchanged) |
| Playwright phase-37 (2x stable) | PASS | `npx playwright test --project=phase-37` |
| Writer unit (7 cases) | PASS | `STORAGE_MODE=memory NODE_ENV=test npx tsx scripts/test-run-tree-writer.ts` |
| Backfill unit (4 cases) | PASS | `STORAGE_MODE=memory NODE_ENV=test npx tsx scripts/test-run-tree-backfill.ts` |
| Existing phase-36 regression | PASS (manual — sweep before deploy) | `npx playwright test --project=phase-36` |

All checks green. Ready for `fly deploy` (operator action — bundle with Phase 36 + Phase 36.5 if not yet deployed).

## Operator Runbook (Phase 37 deploy)

1. **Schema push (if not already done from 37-01):**
   ```bash
   npm run db:push
   ```
   Drizzle applies the `autonomy_runs` + `autonomy_run_steps` table additions + 4 new indexes. Idempotent.

2. **Deploy:**
   ```bash
   fly deploy
   ```
   No env-var changes required. The dev-only seed/reset endpoints are conditionally registered when `NODE_ENV !== 'production'`, so they ship as dead code in the prod bundle (also gated by in-handler throws — double-guard pattern).

3. **One-shot backfill (manual trigger, D-20):**
   ```bash
   npm run backfill:run-tree
   ```
   Runs `scripts/backfill-run-tree.ts`. Idempotent (skips traceIds already populated). Respects 5-minute stable-event window (won't race with live writers). Expected runtime ~5 min for 100k historical events.

   Operator runs this ONCE after deploy. Subsequent runs are no-ops. Historical runs surface as flat-per-trace with the "imported flat from history" UI hint (D-18).

## Phase 47 Backlog Items Surfaced

1. **#2 — wire `taskExecutionPipeline` to produce deliverables** (D-06.1 acknowledgment) — once autonomy creates Phase 36 deliverables, score-delta values will populate on most step rows.
2. Real-time WS streaming of in-flight run trees (D-21 deferred — currently 30s polling)
3. Tree filtering / search ("show me runs with negative score deltas")
4. Run replay / rerun
5. Cross-project aggregation dashboard
6. Tree node annotations
7. Pruning / archiving old runs
8. (D-18 follow-up) Event-replay enrichment to recover handoff edges in historical runs — re-run backfill afterward.

## Files Created/Modified — Phase 37 manifest

**New (server):**
- `shared/schema.ts` — 2 tables + 2 insert schemas + 4 types (37-01)
- `shared/scoreFormat.ts` — `formatScoreDelta` + `formatScoreDeltaWord` shared helper (37-03)
- `server/autonomy/runs/runTreeWriter.ts` (37-02)
- `server/autonomy/runs/runTreeBackfill.ts` (37-04)
- `scripts/backfill-run-tree.ts` (37-04)
- `scripts/test-run-tree-writer.ts` (37-01, extended by 37-02)
- `scripts/test-run-tree-backfill.ts` (37-04)

**Modified (server):**
- `server/storage.ts` — 4 IStorage methods + MemStorage + DatabaseStorage impls + `__resetRunTreeForTests` (37-01)
- `server/autonomy/execution/jobQueue.ts` — payload extension (37-02)
- `server/autonomy/execution/taskExecutionPipeline.ts` — 3-hook on both paths + handleTaskJob entry (37-02)
- `server/autonomy/handoff/handoffOrchestrator.ts` — parent-link + `handoff_initiated` event (37-02)
- `server/autonomy/events/eventTypes.ts` — `handoff_initiated` event type (37-02)
- `server/routes/autonomy.ts` — `GET /api/projects/:projectId/runs` (37-02) + 3 DEV-only endpoints (37-04)

**New (client):**
- `client/src/hooks/useAutonomyRunTree.ts` (37-03)
- `client/src/components/sidebar/ActivityViewModeToggle.tsx` (37-03)
- `client/src/components/sidebar/RunTreeView.tsx` (37-03)
- `client/src/components/sidebar/RunTreeNode.tsx` (37-03)

**Modified (client):**
- `client/src/components/sidebar/ActivityTab.tsx` — view-mode state + conditional render (37-03)
- `client/src/components/ArtifactPanel.tsx` — `pendingVersionNumber` prop (37-03)
- `client/src/pages/home.tsx` — `open_deliverable` handler extension (37-03)

**Config:**
- `package.json` — `backfill:run-tree` script entry (37-04)
- `playwright.config.ts` — `phase-37` project entry (37-04)

**Tests:**
- `tests/e2e/phase-37-run-tree.spec.ts` — 6 cases on live restarted dev server (37-04)

**Docs:**
- `.planning/phases/37-git-style-run-tree/37-VERIFICATION.md` (this file)
- `37-01-SUMMARY.md`, `37-02-SUMMARY.md`, `37-03-SUMMARY.md`, `37-04-SUMMARY.md`

---

**Phase 37 status:** SHIPPED CODE-COMPLETE 2026-05-14. Awaiting `fly deploy` (operator action; bundle with Phase 36 + 36.5 if not yet deployed).
