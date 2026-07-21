---
phase: 37-git-style-run-tree
plan: 02
subsystem: autonomy
tags: [run-tree, autonomy, instrumentation, pg-boss, handoff, drizzle, zod]

# Dependency graph
requires:
  - phase: 37-git-style-run-tree
    plan: 01
    provides: autonomyRuns + autonomyRunSteps tables, 4 IStorage methods (createRun / createRunStep / updateRunStep / getRunsByProject), __resetRunTreeForTests helper, Wave-1 test scaffold
  - phase: 22-atomic-budget-enforcement
    provides: pg-boss expireInMinutes constant (30) — synchronized with autonomyRunSteps.timeoutAt
  - phase: 36-frozen-rubric-deliverable-iteration
    provides: deliverableVersions.versionNumber column (W-4 inline SELECT target)
provides:
  - server/autonomy/runs/runTreeWriter.ts — pure async writer wrappers over storage.* (ensureRunForTrace / startStep / completeStep / failStep + __resetWriterForTests)
  - pg-boss job payload extension (traceId + parentStepId optional fields) — the ONLY viable propagation channel across worker process boundary (Pitfall 1)
  - 3-hook instrumentation at BOTH executeTask (line ~370) AND executeTaskWithOutput (line ~205) — Pitfall 6 defense
  - handleTaskJob lookup-or-create-run entry block (ensureRunForTrace at worker invocation start)
  - handoffOrchestrator parent-link step write + handoff_initiated event (D-07.1 forward-compat) + payload propagation
  - 'handoff_initiated' union member added to AutonomyEventType (additive — no removals)
  - GET /api/projects/:projectId/runs route with 401/404 ownership semantics
  - Wave-2 test cases appended to scripts/test-run-tree-writer.ts (now 7/7 PASS deterministic)
affects: [37-03 client UI tree view consumes GET endpoint, 37-04 backfill leverages storage methods directly]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "pg-boss payload extension as cross-worker-boundary propagation channel (the only viable mechanism since AsyncLocalStorage cannot survive the hop — RESEARCH Pattern 2)"
    - "Writer-as-storage-wrapper module with non-fatal try/catch on all writes (mirrors eventLogger.ts DB-or-file fallback pattern)"
    - "Server-side score delta computation with Number.isFinite guards (Pitfall 4 NaN-defense) — formatter renders the raw number client-side"
    - "Inline Drizzle SELECT for W-4 denormalization (single-purpose read, no new IStorage method needed)"
    - "Co-existing step writes + event emission (handoff step row + handoff_initiated event) — forward-compat for future backfill against richer post-37 history (D-07.1)"
    - "DEV-only __resetWriterForTests helper with NODE_ENV='production' throw (Phase 35 providerHealthState analog)"

key-files:
  created:
    - server/autonomy/runs/runTreeWriter.ts (174 lines — 4 exported async writers + 1 prod-guarded reset helper)
    - .planning/phases/37-git-style-run-tree/37-02-SUMMARY.md
  modified:
    - server/autonomy/execution/jobQueue.ts (+2 lines — traceId + parentStepId optional payload fields)
    - server/autonomy/execution/taskExecutionPipeline.ts (~420 line-insertions, ~276 line-deletions due to indentation when wrapping each path in try/catch — net additive)
    - server/autonomy/handoff/handoffOrchestrator.ts (+60 lines — parent-link write + forward-compat event + payload propagation)
    - server/autonomy/events/eventTypes.ts (+5 lines — handoff_initiated union member)
    - server/routes/autonomy.ts (+19 lines — GET /api/projects/:projectId/runs)
    - scripts/test-run-tree-writer.ts (+207 lines — 3 new cases + writer imports)

key-decisions:
  - "Pipeline 3 hooks called via writer's null-safe API — caller passes input.runId !== undefined ? await startStep(...) : null. Writer's stepId-null short-circuit means downstream completeStep/failStep are safe even if HOOK A failed."
  - "ExecuteTaskResult interface adds optional stepId so handleTaskJob can pass it as sourceStepId into orchestrateHandoff (chain: source-task step → handoff step → next-task step)."
  - "queueForBatch + executeBatchedTasks return types widened from { status } to ExecuteTaskResult (additive — stepId is optional)."
  - "Cycle-detection task_failed event (handoff_cycle) preserved unchanged — rejected handoffs intentionally don't write step rows because no real handoff occurred."
  - "orchestrateHandoff caller in handleTaskJob uses local-scope runId/traceId (not input.runId — orchestrateHandoff is called from handleTaskJob, not from executeTask)."

requirements-completed: [TREE-02]

# Metrics
duration: 12min
completed: 2026-05-14
---

# Phase 37 Plan 02: Server Writer + Pipeline Instrumentation Summary

**Created server/autonomy/runs/runTreeWriter.ts (4 non-fatal async writer wrappers); extended pg-boss payload with traceId + parentStepId (the only cross-worker-boundary channel); instrumented BOTH executeTask paths (Pitfall 6) with HOOK A/B/C — 12 hook calls total; wired handoffOrchestrator parent-link write + handoff_initiated event (D-07.1 forward-compat); added GET /api/projects/:projectId/runs (401/404 ownership) and 3 new writer-test cases (7/7 deterministic PASS).**

## Performance

- **Duration:** 12 min (4:38:57 → 4:51:19 UTC)
- **Started:** 2026-05-14T04:38:57Z
- **Completed:** 2026-05-14T04:51:19Z
- **Tasks:** 4 (split into 5 atomic commits per CLAUDE.md commit pattern)
- **Files created:** 1 (runTreeWriter.ts)
- **Files modified:** 6 (jobQueue.ts, taskExecutionPipeline.ts, handoffOrchestrator.ts, eventTypes.ts, autonomy.ts, test-run-tree-writer.ts)

## Accomplishments

### 1. runTreeWriter.ts module (Task 1)

`server/autonomy/runs/runTreeWriter.ts` — 174 lines, 4 exported async functions + 1 DEV-only test helper:

| Function | Purpose | Failure mode |
|---|---|---|
| `ensureRunForTrace(traceId, input) → runId` | Upsert-idempotent on traceId via in-process Map memo; lookup via storage.getRunsByProject + filter, create via storage.createRun on miss | Returns synthetic `synthetic-<uuid>` id on storage failure — downstream startStep short-circuits cleanly |
| `startStep(runId, parentStepId, input) → stepId \| null` | Forwards to storage.createRunStep with default status='running'; storage's parent-mismatch guard propagates as throw → caught → returns null | Returns null on synthetic runId OR storage throw |
| `completeStep(stepId, output, startedAtMs?) → void` | Computes scoreDelta server-side (Number.isFinite guards — Pitfall 4); inline Drizzle SELECT on deliverableVersions.versionNumber (W-4 denormalization); forwards to storage.updateRunStep | No-op on null stepId; non-fatal log on update/lookup failure |
| `failStep(stepId, error) → void` | Forwards to storage.updateRunStep with status='failed' + metadata.error (T-37-11 clipped to 500 chars) | No-op on null stepId; non-fatal log on failure |
| `__resetWriterForTests()` | Clears in-process traceId → runId memo | Throws FATAL in production (NODE_ENV check) — double-guarded |

In-process memo size bound (T-37-15): tens of thousands of distinct traceIds per long-lived worker, ~2MB worst case. LRU eviction deferred to Phase 47 if profile shows leak.

Synthetic-id fallback (ensureRunForTrace catch path): returns `synthetic-<uuid>` so downstream code gets a non-null runId. `startStep` short-circuits via the `synthetic-` prefix check — no caller-side null guards needed. Keeps the pipeline alive on transient DB hiccups (RESEARCH Anti-Pattern: "Synchronous step write inside the LLM call path").

### 2. pg-boss payload extension (Task 2)

`server/autonomy/execution/jobQueue.ts` — `queueTaskExecution` signature gains two optional fields:

```typescript
traceId?: string;       // NEW (Phase 37) — survives pg-boss process boundary; AsyncLocalStorage cannot
parentStepId?: string;  // NEW (Phase 37) — handoff step id; null/undefined for run roots
```

pg-boss serializes these into the job payload via standard JSON serialization — no SDK changes. Existing callers without the new fields get current behavior. `expireInMinutes: 30` constant unchanged (load-bearing for Q4 timeoutAt match — see 37-01).

### 3. 3-hook instrumentation BOTH paths (Task 2 — Pitfall 6)

`server/autonomy/execution/taskExecutionPipeline.ts`:

| Function | Pre-edit line | Post-edit hooks |
|---|---|---|
| `executeTask` | 317 (legacy) / ~370 (post-edit) | HOOK A at function entry (after stepId resolution); HOOK B before each of 3 success-return sites (pending_approval-direct, pending_approval-after-peer-review, completed-after-peer-review, completed-non-reviewed; AND a no-output-failed failStep call); HOOK C in catch wrapping the whole body |
| `executeTaskWithOutput` | 185 (legacy) / ~205 (post-edit) | HOOK A at function entry; HOOK B before each of 3 success-return sites (pending_approval-direct, pending_approval-after-peer-review, completed); HOOK C in catch wrapping the body |

Hook-call counts: `startStep=2` (one per path entry), `completeStep=7` (multiple success-return sites per path), `failStep=3` (catch in executeTask + catch in executeTaskWithOutput + empty-output guard). Pitfall 6 defense verified: `grep -c "startStep(" returns 2`, one per path.

`handleTaskJob` entry block added before queueForBatch call:
- `traceId = job.data.traceId ?? randomUUID()` (fresh for root invocations; propagated downstream from handoff)
- `runId = await ensureRunForTrace(...)` (lookup-or-create)
- `parentStepIdForThisInvocation = job.data.parentStepId ?? null`
- All 3 passed into queueForBatch input → flows through to executeTask's input

`ExecuteTaskResult` interface added (extends `{ status }` with optional `stepId`) so handleTaskJob can pass it as `sourceStepId` into orchestrateHandoff.

### 4. handoffOrchestrator instrumentation (Task 3)

`server/autonomy/handoff/handoffOrchestrator.ts`:
- Input signature gains `runId? / traceId? / sourceStepId?` (optional for legacy/test callers — writer no-ops when omitted)
- At the handoff-target-decided site (immediately before existing queueTaskExecution call), three additions in order:
  1. `startStep(runId, sourceStepId, { stepType: 'handoff', status: 'complete', title: 'A → B: ...' })` writes the handoff step row (status='complete' immediately because handoff is instant)
  2. `logAutonomyEvent({ eventType: 'handoff_initiated', payload: { fromAgent, toAgent, taskId, sourceStepId, handoffStepId } })` emits the forward-compat event (D-07.1)
  3. `queueTaskExecution({ ..., traceId, parentStepId: handoffStepId })` propagates lineage to downstream worker so its HOOK A parents under this handoff step (Pitfall 2 defense — without this, tree would be flat)

Cycle-detection branch (lines 78-94 — `handoff_cycle` + `task_failed`) **preserved unchanged**: rejected handoffs intentionally don't write step rows or emit handoff_initiated because no real handoff occurred. `grep -c "handoff_cycle"` returns 2 (preserved).

### 5. eventTypes union extension (Task 3)

`server/autonomy/events/eventTypes.ts`:
- `'handoff_initiated'` added to `AutonomyEventType` discriminated union as new member
- Additive only — no existing members removed; existing downstream consumers (eventLogger.ts normalization, autonomy.ts feed mapping) continue to compile and type-narrow correctly

### 6. GET /api/projects/:projectId/runs endpoint (Task 4)

`server/routes/autonomy.ts`:
- Inserted before the existing `/api/autonomy/evidence-pack` route
- Reuses existing `getSessionUserId` + `requireOwnedProject` helper closures
- 401 on no session; **404 on ownership mismatch (NOT 403 — T-37-12)**
- Calls `storage.getRunsByProject(project.id, { limit: 20 })` — Q4 sweep runs inside the storage method
- Returns `{ runs: AutonomyRun[]; steps: AutonomyRunStep[] }`

### 7. 7-case test manifest (Task 4)

`scripts/test-run-tree-writer.ts` — 7 cases total (4 from 37-01 + 3 appended):

| # | Case | Proves |
|---|---|---|
| 1 | schema-shape | insertAutonomyRunSchema / insertAutonomyRunStepSchema .strict() reject unknown keys + max() length limits (37-01) |
| 2 | writer-roundtrip | storage createRun → createRunStep → updateRunStep → getRunsByProject preserves all writes (37-01) |
| 3 | parent-mismatch-rejected | cross-run parentStepId claim throws; same-run accepted (37-01) |
| 4 | mem-db-parity-storage-only | IStorage exposes all 4 methods; runtime contract satisfied (37-01) |
| 5 | **pipeline-instrumentation** | startStep → completeStep produces status='complete' + non-null latencyMs; startStep → failStep produces status='failed' + metadata.error |
| 6 | **handoff-instrumentation** | 3-generation tree (A-task → handoff → B-task); parentStepId chain intact (Pitfall 2 defense) |
| 7 | **score-delta-math** | scenario 1 (priorRubricTotal=null) → scoreDelta=null; scenario 2 (both-finite) → exact diff; scenario 3 (NaN) → scoreDelta=null NOT NaN (Pitfall 4) |

Deterministic across 2 runs: `STORAGE_MODE=memory NODE_ENV=test npx tsx scripts/test-run-tree-writer.ts` exits 0 with 7 PASS lines.

## Task Commits

1. **Task 1: runTreeWriter module** — `6aa50bb` (feat)
2. **Task 2: jobQueue payload extension + 3-hook instrumentation BOTH executeTask paths + handleTaskJob entry** — `ef4ca1b` (feat)
3. **Task 3: handoffOrchestrator parent-link + handoff_initiated event + eventTypes union + caller propagation** — `eda62db` (feat)
4. **Task 4a: GET /api/projects/:projectId/runs endpoint** — `30eef4a` (feat)
5. **Task 4b: 3 new writer-test cases** — `255a42c` (test)

## Verification Gates (all PASSED)

| Gate | Expected | Actual |
|---|---|---|
| `npx tsc --noEmit` | exit 0 | PASS |
| `npm run build` | exit 0 | PASS |
| Test suite (7 cases) | 7/7 PASS deterministic ×2 | PASS |
| Writer exports | ≥5 | 5 (ensureRunForTrace, startStep, completeStep, failStep, __resetWriterForTests) |
| Non-fatal log pattern | ≥4 | 5 (4 methods + W-4 lookup-fallback) |
| Number.isFinite guards | ≥2 | 4 (2 conditions + 2 implicit) |
| jobQueue payload extension | ≥2 | 2 (traceId + parentStepId) |
| expireInMinutes:30 preserved | ≥1 | 1 |
| pipeline 3-hook BOTH paths | ≥6 total | 12 (startStep=2, completeStep=7, failStep=3) — Pitfall 6 defense |
| ensureRunForTrace in pipeline | ≥1 | 2 (1 import + 1 call) |
| handoff stepType:'handoff' | ≥1 | 1 |
| handoff_initiated eventType | ≥1 | 1 |
| traceId propagation in queueTaskExecution | ≥1 | 1 |
| eventTypes union extended | ≥1 | 1 |
| GET endpoint present | ≥1 | 1 |
| 404 + 401 endpoint guards | both present | 404✓ 401✓ |
| logAutonomyEvent preserved in pipeline | =5 (no change) | 5 |
| handoff_cycle preserved | ≥1 | 2 |

## Decisions Made

- **Removed redundant `runId:` field from startStep input objects** — the writer's `Omit<InsertAutonomyRunStep, 'runId' | 'parentStepId' | 'status'>` type excludes runId from the input (writer adds it from the first arg). Initial spec called for `runId: input.runId` inside the input object; TypeScript correctly rejected as unknown property. Aligned with the type contract by removing the duplicate.
- **orchestrateHandoff caller uses local-scope `runId` / `traceId`** — the caller is inside `handleTaskJob`, not inside `executeTask`. Plan acceptance criterion expected `runId: input.runId` but in handleTaskJob's scope these are local vars (`runId, traceId`). Used shorthand `runId, traceId` to satisfy the spirit (caller propagates lineage from outer scope).
- **ExecuteTaskResult extends `{ status }` with optional stepId** — least-disruptive way to carry stepId from executeTask back to handleTaskJob so it can pass it as sourceStepId into orchestrateHandoff. queueForBatch/executeBatchedTasks return types widened additively.
- **executeTask empty-output guard now calls failStep** — Phase 37 explicitly fails the step row (status='failed' with metadata.error='LLM returned empty output') instead of leaving the step row in 'running' state. Pre-existing return `{ status: 'failed' }` had no observable side-effect; now leaves a correct audit-trail row.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Writer input object included a `runId` property that the Omit type excludes**
- **Found during:** Task 2 — initial typecheck after wiring 3-hook instrumentation
- **Issue:** Plan's HOOK A spec included `runId: input.runId,` inside the startStep input object. The writer's signature uses `Omit<InsertAutonomyRunStep, 'runId' | 'parentStepId' | 'status'>` — runId is excluded because the writer adds it from the first positional arg. TS error: `Object literal may only specify known properties, and 'runId' does not exist`.
- **Fix:** Removed the redundant `runId: input.runId,` line from both HOOK A blocks (executeTask + executeTaskWithOutput). The writer's first positional arg is the runId; the second is parentStepId; the third is the rest of the step input.
- **Files modified:** server/autonomy/execution/taskExecutionPipeline.ts (within Task 2 commit, no separate commit)
- **Verification:** `npx tsc --noEmit` exits 0.
- **Committed in:** ef4ca1b

**2. [Rule 3 - Blocking] Task 2 had to defer the orchestrateHandoff caller update to Task 3**
- **Found during:** Task 2 final typecheck
- **Issue:** Task 2's instrumentation added `runId`/`traceId`/`sourceStepId` arguments to the orchestrateHandoff() call site, but orchestrateHandoff's input type doesn't yet have those fields (Task 3 adds them). TS error: `Object literal may only specify known properties, and 'runId' does not exist in type` (orchestrateHandoff input type).
- **Fix:** Reverted the orchestrateHandoff caller change in Task 2 commit so Task 2 typechecks clean in isolation. Re-applied in Task 3 alongside the orchestrateHandoff signature extension (additive only — backward compatible).
- **Files modified:** server/autonomy/execution/taskExecutionPipeline.ts (Task 2 had it removed; Task 3 added it back)
- **Verification:** Both Task 2 and Task 3 typecheck independently.
- **Committed in:** Task 2 commit (ef4ca1b) had no caller update; Task 3 commit (eda62db) re-applied it.

**3. [Rule 2 - Missing Critical] Empty-output path in executeTask had no step write**
- **Found during:** Task 2 — reviewing executeTask early-return at line 391 (`if (!output || !output.trim()) return { status: 'failed' }`)
- **Issue:** Without instrumentation, the empty-output early return would leave the step row in 'running' state forever (until Q4 sweep at 30min). With HOOK A writing the step at function entry, this early return needs a corresponding failStep call to mark the row 'failed' immediately. Plan's spec didn't explicitly call this out, but the contract is clear: every started step must be terminated.
- **Fix:** Added `await failStep(stepId, new Error('LLM returned empty output'))` immediately before the empty-output return.
- **Files modified:** server/autonomy/execution/taskExecutionPipeline.ts
- **Verification:** Returns `{ status: 'failed', stepId }` instead of `{ status: 'failed' }`; failStep marks the step row 'failed' with metadata.error='LLM returned empty output'.
- **Committed in:** ef4ca1b (Task 2)

---

**Total deviations:** 3 auto-fixed (2 Rule 1/3, 1 Rule 2)
**Impact on plan:** None — all three were anticipated as edge cases in the plan's design narrative; the writer's null-safe API made the deferral in deviation #2 trivial. No scope creep.

## Issues Encountered

- **tsx top-level await:** `npx tsx -e "..."` does not support top-level await in CJS mode. Used inline `.mts` test file with `async function main()` wrapper for Task 1 verification. Final test script (scripts/test-run-tree-writer.ts) already uses `main().catch()` so no impact.

## Self-Check: PASSED

Verified after writing this SUMMARY:

| Check | Result |
|---|---|
| server/autonomy/runs/runTreeWriter.ts exists | FOUND |
| server/autonomy/execution/jobQueue.ts has traceId + parentStepId payload fields | FOUND |
| server/autonomy/execution/taskExecutionPipeline.ts has 3-hook BOTH paths + handleTaskJob entry | FOUND |
| server/autonomy/handoff/handoffOrchestrator.ts has handoff step write + handoff_initiated event + payload propagation | FOUND |
| server/autonomy/events/eventTypes.ts has 'handoff_initiated' union member | FOUND |
| server/routes/autonomy.ts has GET /api/projects/:projectId/runs | FOUND |
| scripts/test-run-tree-writer.ts has 7 cases | FOUND |
| Commit `6aa50bb` (Task 1) exists | FOUND |
| Commit `ef4ca1b` (Task 2) exists | FOUND |
| Commit `eda62db` (Task 3) exists | FOUND |
| Commit `30eef4a` (Task 4a) exists | FOUND |
| Commit `255a42c` (Task 4b) exists | FOUND |
| `npm run typecheck` exits 0 | PASS |
| `npm run build` exits 0 | PASS |
| Test script exits 0 with 7 PASS lines (deterministic ×2) | PASS |
| User-WIP files (ProjectTree.tsx, package-lock.json, eval/trendline.json) untouched | CONFIRMED |

## Post-Phase-37 Implication

**Live autonomy runs from this point forward WILL write step rows correctly:**
- Every `handleTaskJob` invocation either resolves an upstream `traceId` (handoff propagation) or generates a fresh one (root invocation)
- `ensureRunForTrace` is idempotent on traceId — the same chain produces ONE run row with multiple step rows parented correctly
- Every successful task path writes status='complete' with latencyMs
- Every failure path writes status='failed' with metadata.error (clipped to 500 chars)
- Every handoff writes a status='complete' 'handoff' step row parented under the source task's step; the downstream task's step parents under the handoff step (3-generation tree: source-task → handoff → next-task)

**Pre-Phase-37 history needs 37-04 backfill:**
- Pre-37 autonomy events have no `handoff_initiated` event type → backfill must approximate handoff lineage from the existing `task_completed` + `task_assigned` + `task_failed` events
- D-18 acknowledged: backfilled runs WILL be "flat-historical" lists (no parent linkage) rather than full trees. The D-07.1 `handoff_initiated` event makes post-37 history forward-compatible — future re-runs of the backfill against richer history WILL reconstruct full trees.

## D-06.1 Acknowledged Limitation

The autonomy pipeline (`executeTask` / `executeTaskWithOutput`) does NOT currently produce Phase 36 deliverables. Specifically:
- `completeStep` is always called with `deliverableVersionId: undefined`, `priorRubricTotal: null`, `currentRubricTotal: null`
- Score delta therefore resolves to `null` in ~100% of live invocations
- The 'new' badge (no score delta) is what users will see for autonomy-pipeline-produced step rows
- The W-4 inline `versionNumber` lookup only fires when `deliverableVersionId` is set — currently never; future-ready when the autonomy → deliverable bridge is wired

**Phase 47 backlog #2 tracks this bridge work.** When autonomy is wired to deliverables, the hook contract is already in place (just needs `deliverableId` + `deliverableVersionId` + `priorRubricTotal` + `currentRubricTotal` to be populated at the success-return sites).

## Threat Flags

No new attack surface beyond what's already in the plan's threat_model (T-37-10 through T-37-17). All mitigations grep-verifiable:
- T-37-10 (parent-mismatch tampering): storage's parent-mismatch guard from 37-01 propagates → writer catches and returns null → step skipped. Verified: `grep parentStepId.*does not belong server/storage.ts` returns ≥ 1.
- T-37-11 (error.message info disclosure): error.message clipped to 500 chars in failStep. Verified: `grep slice.0, 500. server/autonomy/runs/runTreeWriter.ts` returns ≥ 1.
- T-37-12 (existence-leak via 403): endpoint returns 404 on ownership mismatch. Verified: `grep -B 1 "Project not found" server/routes/autonomy.ts | grep -c "404"` returns ≥ 11.
- T-37-15 (memo unbounded growth): bounded by distinct traceIds per worker (acceptable for v1, Phase 47 LRU eviction candidate). Documented in writer module header comment.

## Next Phase Readiness

**Ready for 37-03 (Wave 3 — client UI tree view):**
- `GET /api/projects/:projectId/runs` returns `{ runs, steps }` for tree assembly. Hook poll cadence (30s) can use TanStack Query's standard refetchInterval.
- D-11 default `limit: 20` matches the planner-intended UI default (most-recent 20 runs per page).
- W-4 `deliverableVersionNumber` is on the wire so the UI can dispatch `open_deliverable` with `{ versionNumber }` without a second fetch.

**Ready for 37-04 (Wave 4 — backfill + verification):**
- `storage.createRun` / `storage.createRunStep` are directly callable by the backfill script — no writer indirection needed.
- The D-07.1 `handoff_initiated` event is now emitted in live runs — future re-runs of the backfill against post-37 history will reconstruct full trees from events alone.
- Pre-37 backfill against the existing event catalog will produce flat-historical lists per D-18 (acknowledged limitation).

**No blockers identified.**

---
*Phase: 37-git-style-run-tree*
*Plan: 02 — Server writer + instrumentation*
*Completed: 2026-05-14*
