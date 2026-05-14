---
phase: 37-git-style-run-tree
plan: 01
subsystem: database
tags: [drizzle, postgresql, zod, autonomy, run-tree, schema, storage-layer]

# Dependency graph
requires:
  - phase: 36-frozen-rubric-deliverable-iteration
    provides: deliverables + deliverable_versions tables (FK targets for step.deliverableId / step.deliverableVersionId)
  - phase: 22-atomic-budget-enforcement
    provides: pg-boss expireInMinutes constant (30) — synchronized with autonomy_run_steps.timeoutAt write
provides:
  - autonomy_runs pgTable (12 cols + 2 indexes) modeling autonomous chain initiations
  - autonomy_run_steps pgTable (19 cols + 2 indexes) for tasks/handoffs/peer_review/safety_block/deliberation nodes with parent_step_id self-ref
  - insertAutonomyRunSchema + insertAutonomyRunStepSchema (both .strict()) — unknown-key rejection at API boundary
  - IStorage.createRun / createRunStep / updateRunStep / getRunsByProject (Mem + DB impls)
  - __resetRunTreeForTests() DEV-only helper (prod-guarded)
  - W-4 fix: deliverableVersionNumber denormalized for client-side version navigation
  - Q4 fix: timeoutAt column + opportunistic stuck-step sweep on getRunsByProject (no cron)
affects: [37-02 server writer + instrumentation, 37-03 client UI tree view, 37-04 backfill + verification, future autonomy chains]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Drizzle self-ref nullable without .references() — established convention (messages.parentMessageId, tasks.parentTaskId, deliverables.parentDeliverableId, now autonomy_run_steps.parentStepId)"
    - "Zod .strict() on insert schemas — unknown-key rejection (T-35-01/T-36-01 lesson extended to Phase 37)"
    - "Lazy timeout sweep via opportunistic UPDATE on read path (no separate cron) — synchronized with pg-boss expireInMinutes constant"
    - "Storage method dual-impl in same commit (MemStorage + DatabaseStorage) — Pitfall 7 drift defense"

key-files:
  created:
    - scripts/test-run-tree-writer.ts (Wave-1 unit test scaffold, 4 cases)
    - .planning/phases/37-git-style-run-tree/37-01-SUMMARY.md
  modified:
    - shared/schema.ts (+70 lines: 2 tables, 4 indexes, 2 insert schemas, 4 types)
    - server/storage.ts (+175 lines: 4 IStorage signatures, MemStorage + DatabaseStorage impls, __resetRunTreeForTests helper)

key-decisions:
  - "Forward-referenced deliverableId / deliverableVersionId via .references(() => deliverables.id) — Drizzle lazy arrow evaluation handles the forward declaration (autonomyRunSteps defined before deliverables in file)"
  - "Cast row literal to AutonomyRun/AutonomyRunStep at construction time — matches existing pattern (deliverables/packages) for Zod-inferred wide string vs $type<> literal-union narrowing"
  - "Direct SQL CREATE TABLE IF NOT EXISTS used in place of drizzle-kit push — push's interactive 'rename vs create' prompt blocked; matches Phase 36-01 ALTER TABLE deviation pattern. Schema in code IS the source of truth; SQL applies it."
  - "Test script imports type InsertAutonomyRun / InsertAutonomyRunStep explicitly + uses them as explicit annotations — proves Task 1's types flow through to consumers without test-only side effects"

patterns-established:
  - "Phase 37 self-ref column: varchar(\"parent_step_id\") without .references() — runtime integrity enforced at storage write time"
  - "Phase 37 timeout sweep: timeoutAt = startedAt + 30min on running/pending inserts; lazy UPDATE on getRunsByProject before SELECT"
  - "Phase 37 test helper: __resetRunTreeForTests() double-guarded (NODE_ENV !== 'production' + DatabaseStorage doesn't have the Maps anyway)"

requirements-completed: [TREE-01]

# Metrics
duration: 9min
completed: 2026-05-14
---

# Phase 37 Plan 01: Foundation Summary

**Two new Drizzle tables (autonomy_runs + autonomy_run_steps), four IStorage methods with parent-mismatch guard + Q4 opportunistic timeout sweep, and a 4-case Wave-1 unit test scaffold — pre-wires Wave-2 writer instrumentation, Wave-3 UI fetch, and Wave-4 backfill against a working storage layer.**

## Performance

- **Duration:** 9 min (4:24:43 → 4:33:21 UTC)
- **Started:** 2026-05-14T04:24:43Z
- **Completed:** 2026-05-14T04:33:21Z
- **Tasks:** 3
- **Files modified:** 2 (shared/schema.ts, server/storage.ts) + 1 created (scripts/test-run-tree-writer.ts)

## Accomplishments

- **autonomyRuns table** (12 cols: id, traceId, projectId FK cascade, userId, rootAgentId, rootGoal, status enum, stepCount, aggregateScoreDelta, metadata JSONB, createdAt, updatedAt) + 2 indexes (autonomy_runs_trace_id_idx, autonomy_runs_project_created_idx). Models one row per autonomous chain initiation.
- **autonomyRunSteps table** (19 cols including W-4's deliverableVersionNumber + Q4's timeoutAt) with parentStepId self-ref (NO .references() per Drizzle DSL convention — runtime integrity via storage write-time check) + 2 indexes (autonomy_run_steps_run_parent_idx composite, autonomy_run_steps_trace_id_idx).
- **Both insert schemas use .strict()** rejecting unknown keys at the API boundary (T-35-01 lesson), with rootGoal max 500 / title max 200 enforced via .extend().
- **Four IStorage methods** (createRun / createRunStep / updateRunStep / getRunsByProject) implemented in BOTH MemStorage AND DatabaseStorage in the same commit (Pitfall 7 drift defense). Cross-run parentStepId claim throws `parentStepId X does not belong to runId Y` in both impls.
- **Q4 opportunistic sweep:** DatabaseStorage.getRunsByProject runs an UPDATE marking expired `running` steps as `failed` with `timeoutReason: 'inferred from pg-boss expiry'` metadata BEFORE the SELECT. MemStorage mirrors the same semantics for test parity. No separate cron — synchronized with pg-boss `expireInMinutes: 30` (jobQueue.ts).
- **Wave-1 unit tests** (scripts/test-run-tree-writer.ts): 4/4 cases PASS deterministic across 2 runs (schema-shape, writer-roundtrip, parent-mismatch-rejected, mem-db-parity-storage-only).

## Task Commits

Each task was committed atomically:

1. **Task 1: Add autonomyRuns + autonomyRunSteps tables + schemas + types to shared/schema.ts** — `2acd134` (feat)
2. **Task 2: Add createRun / createRunStep / updateRunStep / getRunsByProject to IStorage + MemStorage + DatabaseStorage** — `819be29` (feat)
3. **Task 3: Scaffold scripts/test-run-tree-writer.ts with Wave-1 cases** — `c92d8bb` (test)

## Files Created/Modified

- **shared/schema.ts** — Added autonomyRuns + autonomyRunSteps tables (12 + 19 columns + 4 named indexes) immediately after autonomyEvents block (around line 257). Added insertAutonomyRunSchema + insertAutonomyRunStepSchema with .strict() + .extend() max-length constraints. Exported types: AutonomyRun, InsertAutonomyRun, AutonomyRunStep, InsertAutonomyRunStep.
- **server/storage.ts** — Imported the 4 new types from @shared/schema. Added 4 method signatures to IStorage interface. Implemented all 4 methods in MemStorage (in-memory Maps + parent-mismatch guard + timeoutAt computation + opportunistic sweep). Implemented all 4 methods in DatabaseStorage (Drizzle .insert/.update/.select + SQL-template-literal timeoutAt + Q4 sweep UPDATE before SELECT). Added __resetRunTreeForTests() DEV-only helper at module bottom (throws FATAL in production).
- **scripts/test-run-tree-writer.ts** — NEW. 4-case Wave-1 test scaffold mirroring scripts/test-rubric-scorer.ts pattern (tsx shebang, plain assert from node:assert/strict, named case_* functions, top-level main()). 37-02 will append pipeline-instrumentation / handoff-instrumentation / score-delta-math cases.

## DB Verification (information_schema)

```
autonomy_runs columns (12): id, trace_id, project_id, user_id, root_agent_id,
  root_goal, status, step_count, aggregate_score_delta, metadata, created_at, updated_at

autonomy_run_steps columns (19): id, run_id, parent_step_id, trace_id, agent_id,
  agent_name, agent_role, step_type, title, status, deliverable_id,
  deliverable_version_id, deliverable_version_number, score_delta, metadata,
  started_at, completed_at, latency_ms, timeout_at

indexes:
  autonomy_run_steps_pkey, autonomy_run_steps_run_parent_idx,
  autonomy_run_steps_trace_id_idx, autonomy_runs_pkey,
  autonomy_runs_project_created_idx, autonomy_runs_trace_id_idx
```

All 4 named indexes confirmed via pg_indexes. PK indexes auto-created by Postgres.

## Decisions Made

- **Forward references for deliverable FKs:** autonomyRunSteps is defined BEFORE deliverables/deliverableVersions in shared/schema.ts. Drizzle's lazy arrow-function references (`() => deliverables.id`) resolve at module-graph evaluation time, so the forward reference works without restructuring file order. Verified by typecheck + runtime.
- **Direct SQL apply (not db:push):** `drizzle-kit push` triggered an interactive "is autonomy_run_steps created or renamed from session?" prompt. Aborted (no rename intended) and applied via direct `CREATE TABLE IF NOT EXISTS` via `db.execute(sql\`...\`)` — same deviation pattern as Phase 36-01 ALTER TABLE bypass. Schema-in-code remains canonical; SQL just applies the additive change.
- **Type cast pattern for Zod-inferred wide strings:** Zod's createInsertSchema infers `status: string` (not the `$type<>` literal union). Used `... as AutonomyRun` / `... as AutonomyRunStep` cast at row construction (matches existing deliverables/packages pattern). MemStorage builds an object literal then casts; DatabaseStorage uses Drizzle's `.returning()` which preserves the table's narrowed type natively.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] db:push interactive prompt bypassed via direct SQL**
- **Found during:** Task 1 (schema apply step)
- **Issue:** `npm run db:push` prompted "Is autonomy_run_steps table created or renamed from another table?" interactively — tsx-piped `1\n1` did not feed the prompt. The plan's `<action>` Step 6 explicitly authorizes this fallback: "Apply via npm run db:push (or ALTER TABLE ADD COLUMN IF NOT EXISTS direct apply if push has interactive issues like in 36-01)."
- **Fix:** Applied `CREATE TABLE IF NOT EXISTS autonomy_runs (...)` + `CREATE INDEX IF NOT EXISTS ...` via `db.execute(sql\`...\`)` from a tsx async IIFE. Schema in shared/schema.ts remains source of truth.
- **Files modified:** None (one-shot apply, no migration file generated)
- **Verification:** `information_schema.columns` confirms 12 + 19 cols; `pg_indexes` shows all 4 named indexes.
- **Committed in:** N/A (DB-side change, no file diff)

**2. [Rule 1 - Bug] Zod-inferred status type vs Drizzle $type<> literal union mismatch**
- **Found during:** Task 2 (MemStorage typecheck after initial impl)
- **Issue:** `tsc --noEmit` failed with `Type 'string' is not assignable to type '"cancelled" | "complete" | "running" | "failed"'` — Zod `createInsertSchema` doesn't pick up the `$type<>` narrowing on text columns, so `input.status ?? 'running'` evaluates to `string` not the table's literal union.
- **Fix:** Changed `const row: AutonomyRun = { ... };` to `const row = { ... } as AutonomyRun;` for both createRun and createRunStep MemStorage impls. Matches existing pattern at storage.ts:1487 (`as Deliverable`) and storage.ts:1610 (`as DeliverablePackage`). DatabaseStorage avoids the issue via `.returning()` which preserves the narrowed type.
- **Files modified:** server/storage.ts (within Task 2 commit, no separate commit)
- **Verification:** `npm run typecheck` exits 0.
- **Committed in:** 819be29

**3. [Rule 2 - Missing Critical] Test file lacked explicit InsertAutonomyRun/InsertAutonomyRunStep type imports for traceability**
- **Found during:** Task 3 (final acceptance grep)
- **Issue:** Plan acceptance criterion: `grep "InsertAutonomyRunStep\|InsertAutonomyRun\b"` should return ≥ 1 — "proves Task 1's types flowed through". Initial test file used inferred parameter types only; grep returned 0.
- **Fix:** Added `type InsertAutonomyRun, type InsertAutonomyRunStep` imports and used them as explicit annotations in `case_writerRoundtrip` (`const runInput: InsertAutonomyRun = ...; const stepInput: InsertAutonomyRunStep = ...`). Exercises the types end-to-end through typecheck.
- **Files modified:** scripts/test-run-tree-writer.ts (within Task 3 commit)
- **Verification:** grep returns 4 matches; all 4 PASS cases still PASS deterministic; typecheck green.
- **Committed in:** c92d8bb

---

**Total deviations:** 3 auto-fixed (1 Rule 1, 1 Rule 2, 1 Rule 3)
**Impact on plan:** All three were anticipated by the plan (the db:push bypass is explicitly authorized; the type cast follows the existing repo pattern; the type-import addition is the plan's literal acceptance criterion). No scope creep. Plan executed essentially as written.

## Issues Encountered

- **dotenv loading in tsx eval scripts:** `npx tsx -e "..."` does not auto-load .env, so direct DB access required `await import('dotenv/config')` at the top of the IIFE. Test script added `import 'dotenv/config'` as its first import for clean test invocation.

## Self-Check: PASSED

Verified after writing this SUMMARY:

| Check | Result |
|---|---|
| `shared/schema.ts` exists with autonomyRuns + autonomyRunSteps | FOUND |
| `server/storage.ts` exists with 4 new methods + __resetRunTreeForTests | FOUND |
| `scripts/test-run-tree-writer.ts` exists with 4 PASS cases | FOUND |
| Commit `2acd134` exists | FOUND |
| Commit `819be29` exists | FOUND |
| Commit `c92d8bb` exists | FOUND |
| `npm run typecheck` exits 0 | PASS |
| `npm run build` succeeds | PASS |
| Test script exits 0 with 4 PASS lines (deterministic ×2) | PASS |
| autonomy_runs table in dev DB with 12 cols | CONFIRMED (information_schema) |
| autonomy_run_steps table in dev DB with 19 cols | CONFIRMED (information_schema) |
| 4 named indexes in pg_indexes | CONFIRMED |
| User-WIP files (ProjectTree.tsx, package-lock.json, eval/trendline.json) untouched | CONFIRMED |

## Next Phase Readiness

**Ready for 37-02 (Wave 2 — server writer + instrumentation):**
- `storage.createRun / createRunStep / updateRunStep / getRunsByProject` are callable from any module via `import { storage } from './storage'`.
- Types `AutonomyRun, InsertAutonomyRun, AutonomyRunStep, InsertAutonomyRunStep` are exported from `@shared/schema`.
- `__resetRunTreeForTests` is exported for the appended Wave-2 cases (pipeline-instrumentation / handoff-instrumentation / score-delta-math).
- Parent-mismatch guard active in both storage impls — Wave-2 writer module can trust storage to enforce tree integrity.
- timeoutAt sweep in place — Wave-2 instrumentation does not need to handle worker-crash stuck rows.

**Ready for 37-03 (Wave 3 — client UI):**
- `getRunsByProject` returns the denormalized `{ runs, steps }` shape the client will group in-memory.
- Server pagination defaults (limit 20, offset 0) match D-11.

**Ready for 37-04 (Wave 4 — backfill):**
- `storage.createRun / createRunStep` directly usable by `scripts/backfill-run-tree.ts` — no writer indirection needed.
- `autonomyRuns.metadata.backfilledFrom` field exists for the D-18 "flat historical" marker.

**No blockers identified.**

---
*Phase: 37-git-style-run-tree*
*Plan: 01-foundation*
*Completed: 2026-05-14*
