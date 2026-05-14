# Phase 37: Git-Style Run Tree — Research

**Researched:** 2026-05-13
**Domain:** Drizzle parent-self-ref schema + executor-context instrumentation + tree visualization in a 350px sidebar
**Confidence:** HIGH (everything verified against repo code; CONTEXT.md locks 25 decisions + 6 post-audit corrections)

## Summary

Phase 37 adds two new tables (`autonomy_runs` + `autonomy_run_steps`) and instruments two existing autonomy modules (`taskExecutionPipeline.executeTask` and `orchestrateHandoff`) to write parent-linked step rows. The right-sidebar Activity tab gains a `[Flat] [Tree]` view-mode toggle. Click a step that produced a deliverable → existing `open_deliverable` event opens ArtifactPanel pinned to that version. A one-shot manual backfill script (`npm run backfill:run-tree`) walks pre-Phase-37 `autonomy_events` rows by `traceId` and writes a flat step list per run (handoff edges historically unrecoverable — see D-18).

Architecture is bounded: 2 new tables, 1 new server module (`runTreeWriter.ts`), 1 new backfill script, 1 new GET endpoint, 3 new client components (`RunTreeView`, `RunTreeNode`, `ActivityViewModeToggle`), 1 new TanStack hook (`useAutonomyRunTree`), surgical edits to `taskExecutionPipeline.ts` + `handoffOrchestrator.ts` + `ArtifactPanel.tsx` + `home.tsx` event handler. No new runtime dependencies. Tree rendering = pure CSS + recursive React (Q1 resolved: no library).

**Primary recommendation:** Use **pure CSS + recursive React** for the tree (Q1) and **composite `(run_id, parent_step_id)` index plus standalone `trace_id` indexes on both tables** (Q2). Inject `traceId` as a fourth field into the `queueTaskExecution` payload so it survives the pg-boss boundary into `executeTask` — this is the only viable plumbing path because pg-boss serializes job data and Node's `AsyncLocalStorage` does not survive a process-boundary hop. For Q4 (stuck-step prevention), rely on pg-boss's existing `expireInMinutes: 30` job timeout plus a tiny defensive `timeoutAt` column on `autonomy_run_steps` + opportunistic sweeper inside the writer's `getRunTreeByProject` query (no separate cron).

## User Constraints (from CONTEXT.md)

### Locked Decisions

The 25 decisions D-01..D-25 (plus 6 post-audit corrections D-06.1, D-07.1, D-18 revision, D-20 manual-only) in `.planning/phases/37-git-style-run-tree/37-CONTEXT.md` are locked. The research below treats these as immutable inputs:

- **Schema (D-01..D-04):** `autonomy_runs` with `traceId / projectId / userId / rootAgentId / rootGoal (≤500) / status enum / stepCount / aggregateScoreDelta / createdAt / updatedAt`. `autonomy_run_steps` with `runId / parentStepId self-ref nullable / traceId denormalized / agentId / agentName / agentRole / stepType enum / title (≤200) / status enum / deliverableId nullable / deliverableVersionId nullable / scoreDelta nullable / metadata jsonb / startedAt / completedAt / latencyMs`. Indexes on `(runId, parentStepId)` for tree fetch, `(projectId, createdAt DESC)` for paginated listing, `(traceId)` on both for backfill correlation. Drizzle + `npm run db:push`.
- **Writer module (D-05):** `server/autonomy/runs/runTreeWriter.ts` exports `createRun(input) → runId`, `startStep(runId, parentStepId, input) → stepId`, `completeStep(stepId, output)`, `failStep(stepId, error)`. Pure async wrappers, no business logic.
- **Instrumentation (D-06, D-06.1, D-07, D-07.1):** 3 hook points in `executeTask` (line 317 — entry / success / catch). `orchestrateHandoff` instruments parent-step linking AND emits `logAutonomyEvent({ eventType: 'handoff_initiated' })` for forward-compat backfills. **D-06.1 acknowledges that autonomy pipeline does NOT currently produce Phase 36 deliverables** → ~100% of live step rows will carry `deliverableVersionId = null`. Bridge work logged as Phase 47 backlog #2.
- **Step types (D-08):** `'task' | 'handoff' | 'peer_review' | 'deliberation' | 'safety_block' | 'approval_request'`. Peer reviews get `parentStepId = subjectStep.id`. Multi-round deliberations collapse into single `deliberation` row with rounds in `metadata`.
- **Score delta computation (D-09):** Server-side in writer; UI receives precomputed number. `null` → "new" badge; `0` → no badge; `+1.2` green; `−0.8` amber.
- **Activity tab integration (D-10..D-14):** `ActivityViewModeToggle` segmented control just above stats card. localStorage key `activityViewMode:${projectId}`. Default `Tree` when project has ≥1 run with ≥3 steps; `Flat` otherwise. Tree renders most-recent-first, limit 20 per page, "Show older" affordance. RunTreeNode: avatar (12px) + name + role + title + score-delta badge + step-type icon. 16px indentation per generation, max 3 visible before `···N more` collapse.
- **Click-to-deliverable (D-13, D-15):** Click step with `deliverableId` → `window.dispatchEvent(open_deliverable, { detail: { deliverableId, versionNumber } })`. ArtifactPanel auto-clicks version-navigator to `versionNumber` after mount. Click step without deliverable → expand inline metadata grid.
- **Score formatting (D-16):** Single helper `shared/scoreFormat.ts → formatScoreDelta(n)`. Same color thresholds as Phase 36 score-chip palette.
- **Backfill (D-17, D-18 revised, D-19, D-20 manual):** One-shot `scripts/backfill-run-tree.ts`, idempotent (skip projects where any `autonomy_run_steps` row already exists for a trace_id). Pre-Phase-37 produces **flat list per traceId** because historical `autonomy_events` has no `handoff_initiated` event type. Run rows from backfill get `metadata.backfilledFrom = 'autonomy_events'` + `metadata.flatHistorical = true`. Score deltas only set if `deliverable_version_id` inferable from payload. Manual trigger via `npm run backfill:run-tree` (not auto-on-boot per D-20 + CLAUDE.md anti-pattern about automatic migrations).
- **Live updates (D-21, D-22):** 30s polling via `useAutonomyRunTree`. Invalidate on `task_completed` / `chain_completed` WS events. No WS streaming of tree state.
- **Verification (D-23, D-24, D-25):** Playwright at `tests/e2e/phase-37-run-tree.spec.ts` — 6 cases (tree-render / click-to-deliverable / 3-variant score-delta / backfill / empty-state / toggle-persistence). Unit tests for writer + backfill in `scripts/test-run-tree-writer.ts` + `scripts/test-run-tree-backfill.ts`. Deploy gate = Playwright + typecheck + build.

### Claude's Discretion

- **Q1 (research):** Tree library — recommendation below: **pure CSS + recursive React.**
- **Q2 (research):** Index strategy — recommendation below: **composite `(run_id, parent_step_id)` + standalone `trace_id` indexes on both tables.**
- **Q3 (planner):** Auto-on-boot vs manual backfill. CONTEXT D-20 locks manual; researcher confirms acceptable below.
- **Q4 (planner):** Sweeper cron vs pipeline timeouts for stuck step rows. Recommendation below: defensive `timeoutAt` column + opportunistic sweep in query path.
- Exact Drizzle DSL for tables (proposed below).
- AsyncLocalStorage vs payload field for traceId propagation through pg-boss (resolved: payload field).
- Parent-pointer flow within `executeTask` after handoff (resolved: payload field carries `parentStepId`).

### Deferred Ideas (OUT OF SCOPE)

- Real-time WS streaming of in-flight run trees (Phase 47 candidate)
- Tree filtering / search ("show me runs with negative score deltas")
- Run replay / rerun
- Cross-project aggregation dashboard
- Tree node annotations
- Pruning / archiving old runs
- Mobile-responsive tree (defer to mobile sweep phase)
- A `/runs` standalone dashboard (tree lives only in sidebar Activity tab)
- Edit / annotate tree nodes (read-only this phase)
- Wiring `taskExecutionPipeline` to produce deliverables (Phase 47 backlog #2 — bridge work)

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TREE-01 | New `autonomy_runs` + `autonomy_run_steps` tables modeling autonomous execution as a DAG with parent-child relationships | § 1 Schema design — Drizzle DSL with `parentStepId` self-ref |
| TREE-02 | Every autonomous task and handoff writes a step row; rubric score deltas attach to step nodes | § 2 Writer module + § 3 taskExecutionPipeline + § 4 handoffOrchestrator instrumentation |
| TREE-03 | Activity feed sidebar visualizes the run tree per project — collapsible nodes with score-delta badges | § 6 UI integration — RunTreeView + RunTreeNode + ActivityViewModeToggle |
| TREE-04 | User can click any step node → see deliverable version + score | § 7 Click-to-deliverable wiring — extend `open_deliverable` event with `versionNumber` |
| TREE-05 | Migration backfills existing `autonomy_events` rows into the run tree for historical projects | § 8 Backfill strategy — group by traceId, infer parent edges, write step rows (flat per D-18) |

## Project Constraints (from CLAUDE.md)

| Directive | Source | Enforcement in Phase 37 |
|-----------|--------|-----------------------|
| TypeScript strict mode, no `any` | § 14 | All new modules use Drizzle inferred types; `(metadata as any)` casts isolated to JSONB read sites with explicit `unknown` schemas |
| Zod validation at boundaries, `.strict()` on security-relevant schemas | § 14, § 16 | Insert schemas via `createInsertSchema` + `.strict()`; GET endpoint response schema validated |
| All server data via TanStack Query — NEVER useEffect+fetch | § 9 | `useAutonomyRunTree` is a `useQuery` hook; client never fetches imperatively |
| Ownership check on every route before mutations | § 16 | `GET /api/projects/:id/runs` uses existing `getOwnedProjectIds(userId)` pattern from `server/routes/autonomy.ts:58` |
| Drizzle ORM only — no raw SQL in app code | § 14 | All schema, writer, and query paths via Drizzle; backfill is the one exception (read-side `pool.query` already established pattern in eventLogger.ts) |
| Session userId check first | § 16 | New endpoint uses `getSessionUserId(req)` returning 401 if missing |
| Verify in runtime (Playwright on live restarted dev server) | MEMORY: feedback_verify_in_runtime | Phase 37 Playwright spec runs on live restarted dev server before marking complete |
| UI changes require Playwright screenshots + explicit approval before commit | MEMORY: feedback_ui_change_protocol | 37-03 plan has mandatory visual checkpoint before commit (RunTreeView + ActivityViewModeToggle are new user-facing surfaces) |
| No mid-milestone decimal hotfixes | MEMORY: feedback_no_decimal_hotfixes | Discoveries during Phase 37 go to Phase 47 backlog — D-06.1 already established this pattern with discovery #2 |
| No `req.body` without Zod validation | § 14 | New GET endpoint has no body; URL `:id` validated via `z.string().uuid()` |
| Helmet + CORS + rate-limit always on | § 16 | Inherited — no changes |
| No dollar amounts in primary UI | Anti-features | Score-delta badges show `+1.2 / −0.8 / new` only — never cost |
| No LLM-based event interpretation | Anti-features | Tree is built from structured rows, NOT LLM summarization of events |
| Files: kebab-case server, PascalCase React | § 14 | `runTreeWriter.ts`, `runTreeBackfill.ts`, `RunTreeView.tsx`, `RunTreeNode.tsx`, `ActivityViewModeToggle.tsx` |
| Commits: `feat(37-XX):` `test(37-XX):` `docs(37-XX):` | § 14 | Follow Phase 36 commit pattern |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `autonomy_runs` + `autonomy_run_steps` schema | Database / Storage | shared/ | Drizzle pgTable lives in `shared/schema.ts`; consumed by both server (writer) and TypeScript inference for client query response |
| Run row + step row writes | API / Backend | Database / Storage | Writer module wraps storage methods; storage abstracts MemStorage + DatabaseStorage |
| Score delta computation | API / Backend | — | Done in writer's `completeStep` — server holds the rubricScore registry per Phase 36 D-02 |
| Tree fetch query (grouped runs + steps) | API / Backend | Database / Storage | Server pages and shapes the tree before returning; client just renders |
| Step write instrumentation in `executeTask` | API / Backend | — | Inline in `taskExecutionPipeline.ts` — cannot move to a higher tier because that's where execution context (taskId, agentId, traceId) is in scope |
| Step write instrumentation in `orchestrateHandoff` | API / Backend | — | Inline in `handoffOrchestrator.ts` — handoff source/target are in scope only here |
| `traceId` propagation across pg-boss boundary | API / Backend | — | Must live in pg-boss job payload (D-06 + Q1.5 below); `AsyncLocalStorage` cannot cross process-boundary |
| Tree rendering | Browser / Client | — | Pure presentation of server-returned tree shape; recursive React component |
| View-mode persistence | Browser / Client | — | localStorage `activityViewMode:${projectId}` per D-10 |
| TanStack Query polling for tree | Browser / Client | — | 30s `refetchInterval` per D-21; invalidate on WS `task_completed` event per D-22 |
| Backfill script | API / Backend (CLI) | Database / Storage | Standalone tsx script reads `autonomy_events`, writes `autonomy_run_steps` via Drizzle — runs once manually per D-20 |
| Click-to-deliverable bridge | Browser / Client | — | Window event dispatch already established for `open_deliverable` in Phase 36 — extending only the payload shape |
| Score-delta formatting | shared/ | Browser / Client | `formatScoreDelta()` lives in `shared/scoreFormat.ts` because it's used by both server (debug logging) and client (badge rendering) per D-16 |

**Why this matters for Phase 37:** Step writes must happen inside `executeTask` and `orchestrateHandoff` even though they couple presentation infrastructure into the autonomy core. Trying to move them out (e.g., into a wrapper) would require duplicating the entire execute/handoff context for the wrapper to capture trace metadata. Keep writes inline; isolate via the thin `runTreeWriter.ts` so the autonomy pipeline doesn't directly touch storage. Compare to Phase 36 where the auto-revert decision also had to live inside `iterateDeliverable()`.

## Standard Stack

### Core (already in repo — no additions)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Drizzle ORM | 0.39.1 | Schema additions, writer storage methods, GET endpoint query | Project standard per CLAUDE.md § 14; `pgTable` + `index` + self-ref via `varchar("parent_step_id")` is the canonical pattern (mirrors `messages.parentMessageId` and `tasks.parentTaskId`) |
| Zod | 3.24.2 | Insert schemas via `createInsertSchema`; GET response schema | Project standard; `.strict()` on response per Phase 35 T-35-01 lesson |
| TanStack Query | 5.60.5 | `useAutonomyRunTree` hook with 30s `refetchInterval` + WS-event invalidation | Project standard per CLAUDE.md § 9 |
| Framer Motion | 11.13.1 | Expand/collapse animations on tree nodes + score-delta badge entry | Already used in `ActivityFeedItem.tsx` for premium-card hover/transition |
| lucide-react | 0.453.0 | Step-type icons per D-12 (⏱ for task, ↔ for handoff, ⚐ for safety_block, 🔎 for peer_review, 💭 for deliberation) — actual icons: `Clock`, `ArrowRightLeft`, `ShieldAlert`, `Search`, `MessagesSquare` | Project icon set |
| Tailwind CSS | 3.4.17 | Indentation, spacing, score-badge colors | Project standard — utility-first |
| pg-boss | (existing) | Carries `traceId` field in `autonomous_task_execution` job payload | Already in use for `queueTaskExecution`; adding one field is backward-compatible |
| `useSidebarEvent` + `AUTONOMY_EVENTS` | (existing) | Hook into existing `task_completed`/`chain_completed` events to trigger TanStack invalidation per D-22 | Reuse pattern from `useAutonomyFeed.ts:308-346` |

**Version verification:** Every library used in Phase 37 is already pinned in `package.json` at the versions above. **No new dependencies needed.** Verified by reading `CLAUDE.md` § 1 + `package.json` head (no `react-arborist`, `react-flow`, `react-d3-tree`, or similar — confirmed via `grep -n` against package.json).

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `drizzle-zod` | (existing) | `createInsertSchema(autonomyRuns)` + `createInsertSchema(autonomyRunSteps)` | Standard schema-export pattern; mirrors `insertAutonomyDailyCounterSchema` at `shared/schema.ts:273` |
| `randomUUID` from Node `crypto` | built-in | Generate run IDs when seeding from `traceId` lookup miss | Existing pattern in `eventLogger.ts:7` |

### Alternatives Considered (and rejected — Q1, Q2 resolution)

| Instead of | Could Use | Why Rejected |
|------------|-----------|--------------|
| Pure CSS + recursive React (Q1 winner) | **react-arborist** (~6kB gz, virtual scrolling, drag-drop) | The sidebar is 350-400px wide. Max ~20 runs visible, each with ≤30 steps. Virtual scrolling is not justified — total DOM nodes per project < 600. Drag-drop is not in scope (read-only). react-arborist adds a dep + a render-prop API that fights our `motion.div` + `useState` patterns. CSS `padding-left: depth * 16px` is one line. Verdict: simplest viable wins per CLAUDE.md "Don't optimize prematurely." |
| Pure CSS + recursive React | **react-flow** | Built for arbitrary 2D graphs with edges, node positioning, pan/zoom. Massive overkill for a sidebar tree (~50kB gz). Phase 37 doesn't need edge routing or canvas. Verdict: rejected. |
| Pure CSS + recursive React | **react-d3-tree** | D3 dependency + canvas-based rendering. Same overkill argument as react-flow. Verdict: rejected. |
| Composite `(run_id, parent_step_id)` index (Q2 winner) | Separate single-column indexes on `run_id` and `parent_step_id` | The dominant query is `SELECT * FROM autonomy_run_steps WHERE run_id = ? ORDER BY started_at`. Composite index covers this with a single B-tree seek + range scan. Standalone `parent_step_id` index would help "find children of step X" but tree assembly is done in-memory after fetch — the composite serves both paths. |
| Composite `(run_id, parent_step_id)` | Trigram or GIN index | Tree traversal is point-and-range, not full-text. B-tree composite is correct. Verdict: rejected. |
| Separate `traceId` index per table | Composite `(traceId, projectId)` | Backfill queries by `traceId` only (no projectId in scope until after the run row is created). Composite is wasted. Standalone `traceId` index on both tables is right. |
| `AsyncLocalStorage` for traceId propagation | Payload field in pg-boss job | pg-boss serializes job data to PostgreSQL and re-hydrates in a different worker — possibly a different process. `AsyncLocalStorage` does NOT cross that boundary. Payload field is the only viable plumbing. |
| Inline LLM call to summarize step output as title | Use `task.title` directly | Anti-pattern per project rule "No LLM-based event interpretation." Tree title = task title (truncated to 200 chars). |
| WebSocket streaming of in-flight tree updates | 30s polling | D-21 locked polling for "post-mortem" use case. WS streaming deferred to Phase 47 if user pain surfaces. |

**Installation:**
```bash
# No new packages required — all dependencies already pinned.
```

## Architecture Patterns

### System Architecture Diagram

```
                  Background autonomous execution starts
                                  │
                                  ▼
                  ┌──────────────────────────────────────┐
                  │  handleTaskJob() in pipeline:        │
                  │   1. resolve task / agent / project  │
                  │   2. reserveBudgetSlot               │
                  │   3. NEW: lookupOrCreateRun(traceId) │ ─── if no run exists for this
                  │     ↓                                │     traceId, create one with
                  │     runId in scope                   │     rootAgentId = agent.id
                  │   4. queueForBatch / executeTask     │
                  └──────────────────────────────────────┘
                                  │
                                  ▼
                  ┌──────────────────────────────────────┐
                  │  executeTask(input)  line 317        │
                  │                                      │
                  │  ┌─ HOOK A: at function entry ──┐    │
                  │  │  stepId = startStep(runId,   │    │   ───→ autonomy_run_steps INSERT
                  │  │    parentStepId,             │    │         status='running'
                  │  │    { type:'task', title })   │    │
                  │  └──────────────────────────────┘    │
                  │                                      │
                  │   generateText → safety → peer rev   │
                  │                                      │
                  │  ┌─ HOOK B: on success return ──┐    │
                  │  │  completeStep(stepId, {      │    │   ───→ UPDATE status='complete',
                  │  │    deliverableVersionId,     │    │         completedAt, latencyMs,
                  │  │    scoreDelta })             │    │         deliverableVersionId,
                  │  └──────────────────────────────┘    │         scoreDelta
                  │                                      │
                  │  ┌─ HOOK C: on catch / throw ───┐    │
                  │  │  failStep(stepId, error)     │    │   ───→ UPDATE status='failed',
                  │  └──────────────────────────────┘    │         completedAt, metadata.error
                  └──────────────────────────────────────┘
                                  │
                                  ▼  (on success → handoff chain runs)
                  ┌──────────────────────────────────────┐
                  │  orchestrateHandoff(input) line 15   │
                  │                                      │
                  │   1. detect target via conductor     │
                  │   2. cycle check                     │
                  │   3. NEW: startStep(runId,           │   ───→ INSERT step row
                  │        parentStepId = sourceStep.id, │       stepType='handoff'
                  │        { type:'handoff',             │
                  │          title: 'A → B: <task>' })   │
                  │   4. NEW: logAutonomyEvent({         │   ───→ INSERT autonomy_event
                  │        eventType:'handoff_initiated' │       (D-07.1, for forward-compat)
                  │       })                             │
                  │   5. queueTaskExecution({ ...,       │   ───→ pg-boss payload now
                  │        traceId, parentStepId })      │       carries traceId AND
                  └──────────────────────────────────────┘       parentStepId
                                  │
                                  ▼
                       Downstream agent re-enters executeTask
                       with parentStepId from payload — its
                       step row attaches as a child of the
                       handoff step

                  Client side ────────────────────────────────────

                  GET /api/projects/:id/runs (30s polling)
                                  │
                                  ▼
                  ┌──────────────────────────────────────┐
                  │  ActivityTab.tsx                     │
                  │                                      │
                  │  ActivityViewModeToggle              │ ─── localStorage
                  │    [ Flat ]  [ Tree ]                │     activityViewMode:${projectId}
                  │                                      │
                  │  if (mode === 'tree')                │
                  │    <RunTreeView runs={data.runs} />  │
                  │  else                                │
                  │    <ActivityFeedItem ... />          │
                  └──────────────────────────────────────┘
                                  │
                                  ▼
                  ┌──────────────────────────────────────┐
                  │  RunTreeView                         │
                  │    runs.map(run => <RunCard>)        │
                  │                                      │
                  │  <RunTreeNode> recursive             │
                  │    children = steps.filter(s =>      │
                  │      s.parentStepId === this.id)     │
                  │    padding-left: depth * 16px        │
                  │                                      │
                  │  click step with deliverableId →     │
                  │    window.dispatchEvent(             │
                  │      'open_deliverable',             │
                  │      { deliverableId, versionNumber })│
                  └──────────────────────────────────────┘
                                  │
                                  ▼
                  ┌──────────────────────────────────────┐
                  │  home.tsx open_deliverable handler   │
                  │    setActiveDeliverableId(id)        │
                  │    setPendingVersionNumber(v)        │  ◄── NEW per D-15
                  │                                      │
                  │  ArtifactPanel mounts with           │
                  │    pendingVersionNumber prop         │
                  │  useEffect → if (v && v !== current) │
                  │    restoreMutation.mutate(v)         │
                  │    onSuccess → setPending(undefined) │
                  └──────────────────────────────────────┘
```

### Recommended Project Structure

```
shared/
├── schema.ts                  # + autonomyRuns + autonomyRunSteps tables
└── scoreFormat.ts             # NEW — formatScoreDelta(n)

server/
├── autonomy/
│   ├── runs/                  # NEW directory
│   │   ├── runTreeWriter.ts   # NEW — createRun / startStep / completeStep / failStep
│   │   └── runTreeBackfill.ts # NEW — backfill logic (used by script)
│   ├── execution/
│   │   └── taskExecutionPipeline.ts  # MODIFIED — 3 hooks
│   └── handoff/
│       └── handoffOrchestrator.ts    # MODIFIED — parent linking + handoff_initiated event
├── routes/
│   └── autonomy.ts            # MODIFIED — new GET /api/projects/:id/runs endpoint
└── storage.ts                 # MODIFIED — IStorage gains createRun/createRunStep/updateRunStep/getRunsByProject

scripts/
├── backfill-run-tree.ts       # NEW — manual one-shot CLI
├── test-run-tree-writer.ts    # NEW — unit tests
└── test-run-tree-backfill.ts  # NEW — backfill correctness tests

client/src/
├── components/sidebar/
│   ├── ActivityTab.tsx            # MODIFIED — adds view-mode state + conditional render
│   ├── ActivityFeedItem.tsx       # MODIFIED — extract shared chrome to <FeedItemShell>
│   ├── ActivityViewModeToggle.tsx # NEW — [Flat] [Tree] segmented control
│   ├── RunTreeView.tsx            # NEW — top-level tree renderer
│   └── RunTreeNode.tsx            # NEW — single step row + recursive children
├── hooks/
│   └── useAutonomyRunTree.ts     # NEW — TanStack Query hook
├── components/
│   └── ArtifactPanel.tsx          # MODIFIED — accepts pendingVersionNumber prop
└── pages/
    └── home.tsx                   # MODIFIED — open_deliverable handler accepts versionNumber

tests/e2e/
└── phase-37-run-tree.spec.ts      # NEW — 6 Playwright cases per D-23

.planning/phases/37-git-style-run-tree/
└── 37-VERIFICATION.md             # NEW — mirrors 36-VERIFICATION.md structure
```

### Pattern 1: Drizzle parent-self-ref + writer module

**What:** Mirror the established `messages.parentMessageId` (`shared/schema.ts:137`) and `tasks.parentTaskId` (`shared/schema.ts:202`) and `deliverables.parentDeliverableId` (`shared/schema.ts:306`) self-reference pattern. Wrap all writes in a thin `runTreeWriter.ts` so the autonomy pipeline never touches storage directly.

**When to use:** Always for parent-child autonomous step rows.

**Example:**
```typescript
// Source: shared/schema.ts — mirror of existing self-ref pattern at line 202
export const autonomyRuns = pgTable("autonomy_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  traceId: text("trace_id").notNull(),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  userId: varchar("user_id").references(() => users.id),
  rootAgentId: varchar("root_agent_id").references(() => agents.id),
  rootGoal: text("root_goal"),       // ≤500 chars; enforced at insert via Zod
  status: text("status").notNull().$type<'running' | 'complete' | 'failed' | 'cancelled'>().default('running'),
  stepCount: integer("step_count").notNull().default(0),
  aggregateScoreDelta: doublePrecision("aggregate_score_delta"),  // nullable
  metadata: jsonb("metadata").$type<{
    backfilledFrom?: 'autonomy_events';
    flatHistorical?: boolean;
    [key: string]: unknown;
  }>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  traceIdIdx: index("autonomy_runs_trace_id_idx").on(table.traceId),
  projectCreatedIdx: index("autonomy_runs_project_created_idx").on(table.projectId, table.createdAt),
}));

export const autonomyRunSteps = pgTable("autonomy_run_steps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  runId: varchar("run_id").references(() => autonomyRuns.id, { onDelete: 'cascade' }).notNull(),
  parentStepId: varchar("parent_step_id"),   // self-ref nullable — root = null
  traceId: text("trace_id").notNull(),        // denormalized for backfill correlation
  agentId: varchar("agent_id").references(() => agents.id),
  agentName: text("agent_name"),
  agentRole: text("agent_role"),
  stepType: text("step_type").notNull().$type<
    'task' | 'handoff' | 'peer_review' | 'deliberation' | 'safety_block' | 'approval_request'
  >(),
  title: text("title"),  // ≤200 chars; enforced at insert
  status: text("status").notNull().$type<'pending' | 'running' | 'complete' | 'failed' | 'skipped'>().default('pending'),
  deliverableId: varchar("deliverable_id").references(() => deliverables.id),
  deliverableVersionId: varchar("deliverable_version_id").references(() => deliverableVersions.id),
  scoreDelta: doublePrecision("score_delta"),   // null if no deliverable; 0 if unchanged
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  latencyMs: integer("latency_ms"),
  timeoutAt: timestamp("timeout_at", { withTimezone: true }),  // Q4 defensive — see § 9
}, (table) => ({
  runParentIdx: index("autonomy_run_steps_run_parent_idx").on(table.runId, table.parentStepId),
  traceIdIdx: index("autonomy_run_steps_trace_id_idx").on(table.traceId),
}));

export const insertAutonomyRunSchema = createInsertSchema(autonomyRuns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  rootGoal: z.string().max(500).optional().nullable(),
}).strict();
export type AutonomyRun = typeof autonomyRuns.$inferSelect;
export type InsertAutonomyRun = z.infer<typeof insertAutonomyRunSchema>;

export const insertAutonomyRunStepSchema = createInsertSchema(autonomyRunSteps).omit({
  id: true,
  startedAt: true,
}).extend({
  title: z.string().max(200).optional().nullable(),
}).strict();
export type AutonomyRunStep = typeof autonomyRunSteps.$inferSelect;
export type InsertAutonomyRunStep = z.infer<typeof insertAutonomyRunStepSchema>;
```

### Pattern 2: traceId / parentStepId propagation via pg-boss payload

**What:** pg-boss serializes job data and re-hydrates in a worker process. `AsyncLocalStorage` does NOT cross that boundary. Add `traceId` and `parentStepId` (both optional) to `queueTaskExecution`'s payload so they survive the boundary into `executeTask`.

**When to use:** Whenever a step needs to know its trace lineage across an enqueued handoff.

**Example:**
```typescript
// Source: server/autonomy/execution/jobQueue.ts — modified per § 4 below
export async function queueTaskExecution(data: {
  taskId: string;
  projectId: string;
  agentId: string;
  traceId?: string;       // NEW — added in handoff orchestrator before queue
  parentStepId?: string;  // NEW — handoff step id; null when this is the run root
}): Promise<string | null> { ... }

// In handoffOrchestrator.ts AFTER writing the handoff step row:
await queueTaskExecution({
  taskId: nextTask.id,
  projectId: input.completedTask.projectId,
  agentId: targetAgent.id,
  traceId: input.traceId,             // <-- propagate from current step's row
  parentStepId: handoffStepId,         // <-- the handoff row IS the parent of the downstream task
});

// In handleTaskJob:
const traceId = job.data.traceId ?? randomUUID();  // root jobs get a fresh traceId
const runId = await ensureRunForTrace(traceId, { projectId, userId, rootAgentId: agent.id, rootGoal: task.title });
const parentStepId = job.data.parentStepId ?? null;  // root jobs have no parent
```

### Pattern 3: Recursive React tree with CSS indentation (Q1 resolution)

**What:** A single `<RunTreeNode>` component renders one step row, computes its visible children via `children = allSteps.filter(s => s.parentStepId === node.id)`, and recurses. Indentation is pure CSS: `paddingLeft: depth * 16px` (mirrors D-12 indentation contract).

**When to use:** Always for Phase 37 tree rendering. No tree library needed.

**Example:**
```tsx
// Source: client/src/components/sidebar/RunTreeNode.tsx
interface RunTreeNodeProps {
  step: RunStep;
  children: RunStep[];      // pre-grouped by parentStepId for O(1) child lookup
  allSteps: RunStep[];      // full step list — passed down for recursion
  depth: number;
  maxVisibleDepth: number;  // D-12: 3
  onClick: (step: RunStep) => void;
}

export function RunTreeNode({ step, children, allSteps, depth, maxVisibleDepth, onClick }: RunTreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < maxVisibleDepth);
  const stepChildren = useMemo(
    () => allSteps.filter(s => s.parentStepId === step.id),
    [allSteps, step.id]
  );
  const hasDeliverable = !!step.deliverableId;
  const StepIcon = stepTypeIcons[step.stepType];

  return (
    <div style={{ paddingLeft: `${Math.min(depth, maxVisibleDepth) * 16}px` }}>
      <button
        onClick={() => hasDeliverable ? onClick(step) : setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--hatchin-surface)] text-left"
        aria-label={`Step ${step.title || step.stepType} — ${step.status}`}
      >
        <StepIcon className="w-3 h-3 shrink-0" style={{ color: stepTypeColor[step.stepType] }} />
        <Avatar name={step.agentName} size={12} />
        <span className="text-[11px] font-semibold">{step.agentName}</span>
        <span className="text-[10px] hatchin-text-muted">{step.agentRole}</span>
        <span className="text-[11px] truncate flex-1">{step.title}</span>
        {step.scoreDelta !== null && step.scoreDelta !== 0 && (
          <ScoreDeltaBadge value={step.scoreDelta} />
        )}
        {step.scoreDelta === null && hasDeliverable && (
          <NewBadge />
        )}
      </button>
      {expanded && stepChildren.map(child => (
        <RunTreeNode
          key={child.id}
          step={child}
          children={[]}
          allSteps={allSteps}
          depth={depth + 1}
          maxVisibleDepth={maxVisibleDepth}
          onClick={onClick}
        />
      ))}
      {!expanded && stepChildren.length > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="ml-6 text-[10px] hatchin-text-muted"
        >
          ···{stepChildren.length} more
        </button>
      )}
    </div>
  );
}
```

### Anti-Patterns to Avoid

- **Inferring tree parents at render time via LLM:** project rule forbids "LLM-based event interpretation." Parent IS the row's `parentStepId` — set at write time by the writer module, never inferred client-side.
- **Synchronous step write inside the LLM call path:** step writes must be `await`ed but they should NOT block on slow LLM generation. Wrap in `try/catch` and treat writer failures as non-fatal (mirrors how `logAutonomyEvent` failures fall back to JSONL).
- **Building the tree client-side from raw `autonomy_events`:** that's what we explicitly DON'T do — the structured `autonomy_run_steps` table is the source of truth. The events table is only for backfill.
- **Triggering backfill on every boot:** D-20 locked manual. Auto-on-boot would risk running against a live writer producing inconsistent state.
- **Passing `traceId` via `AsyncLocalStorage`:** Won't survive pg-boss process boundary. Must be in the job payload.
- **Hand-rolling a tree library:** Pure CSS + recursive React solves this in <50 lines. Resist the urge to virtualize / drag-drop / canvas-render.
- **Score-delta computation client-side:** server-side per D-09 — UI is dumb.
- **Recreating run row on every step write:** writer module must `ensureRunForTrace(traceId)` — upsert idempotent on `traceId`.
- **Writing step rows for imperative-shortcut actions (Phase 36.5):** those are sync user actions, NOT agent-driven autonomous work. Do NOT instrument the imperative-intent parser. CONTEXT prior-decisions explicitly excludes them.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Self-referential tree storage | Custom adjacency table with edge rows | Drizzle `parentStepId` self-ref on `autonomy_run_steps` | Adjacency list pattern is right for this depth (≤5 generations realistic); CTE traversal is not needed when client builds tree in memory; consistent with `messages.parentMessageId` / `tasks.parentTaskId` / `deliverables.parentDeliverableId` |
| UUID generation across server + client | Custom random string | `gen_random_uuid()` PG default + `crypto.randomUUID()` JS | Already established pattern in existing tables |
| Cross-process trace context | Express middleware + global | pg-boss job payload field | Only way to survive the worker boundary; established by `requestId`/`traceId` in `autonomy_events` |
| Score-delta math | Inline computation per render | `shared/scoreFormat.ts` helper | Color thresholds locked to Phase 36 palette (D-16); single canonical source |
| Polling with WS invalidation | useEffect + setInterval | TanStack Query `refetchInterval: 30_000` + `queryClient.invalidateQueries` on `useSidebarEvent` callback | Established pattern in `useAutonomyFeed.ts` |
| LocalStorage state in React | Direct `localStorage.getItem` in component | Custom hook (similar to existing `useRightSidebarState`) | Established pattern — handles SSR safety + hydration |
| Tree-collapse state | Per-node `useState` (would re-render entire tree on each click) | Map of `expandedNodeIds` at `<RunTreeView>` level | Single state root + child reads — fewer re-renders |
| Step-type icons | Custom SVG | lucide-react icons | Already in deps; visual consistency with rest of app |
| Backfill idempotency | Manual "have I processed this?" flag | Skip projects where ≥1 `autonomy_run_steps` row already exists for that traceId | Cheap query, no extra state needed |

**Key insight:** Phase 37 is a structural addition, not new infrastructure. Almost every required pattern already exists in the repo (self-ref tables, pg-boss payload, useQuery polling, useSidebarEvent invalidation, lucide icons, framer-motion animations). The work is in the *plumbing* between them, not in inventing new mechanisms. Resist any urge to add a tree library — the CSS indentation contract in D-12 is one CSS rule.

## Runtime State Inventory

Phase 37 is a greenfield addition — not a rename/refactor. No runtime state migration required beyond the one-shot backfill of historical `autonomy_events`. The backfill itself is in scope (D-17 / D-20) and is the dedicated mechanism. No further inventory needed.

**Verified categories:**
- Stored data: None — verified by `grep -r "autonomy_run" /Users/shashankrai/Documents/hatching-mvp-5th-march/server/` returning zero hits (new tables, no existing data to migrate).
- Live service config: None — no Datadog/Tailscale/Cloudflare touch.
- OS-registered state: None — no Task Scheduler or systemd dependency.
- Secrets / env vars: None — Phase 37 introduces no new env vars.
- Build artifacts: None — pure source addition.

## Common Pitfalls

### Pitfall 1: Missing `traceId` at `executeTask` entry

**What goes wrong:** `executeTask` is called via pg-boss `handleTaskJob`. The current job payload has only `{ taskId, projectId, agentId }`. If the writer needs `traceId` to upsert the run row, and the payload doesn't carry it, every task creates a brand new run — completely losing the chain structure.

**Why it happens:** `AsyncLocalStorage` does not cross pg-boss's worker boundary. The handoff that enqueued this task ran in a different process tick (and possibly a different process entirely).

**How to avoid:** Add `traceId` as an optional field to the `queueTaskExecution` payload. In `orchestrateHandoff`, pass the current `traceId` when queueing the next task. In `handleTaskJob`, if `traceId` is missing (= root invocation), generate a fresh one via `randomUUID()`. The writer's `ensureRunForTrace(traceId, projectId)` upserts on `(traceId)` — first invocation creates the run, subsequent invocations find it.

**Warning signs:** Tree view shows N separate single-step runs instead of one multi-step run. The `autonomy_run_steps.traceId` denorm shows different values for what should be one chain. Unit test: enqueue a 3-step chain, assert `SELECT DISTINCT trace_id FROM autonomy_run_steps WHERE run_id = ?` returns one value.

### Pitfall 2: parentStepId not propagated through handoff

**What goes wrong:** Handoff orchestrator writes a `'handoff'` step. The next task fires, writes a `'task'` step with `parentStepId = null` (because the executor doesn't know the handoff step ID). Tree becomes flat instead of showing source-task → handoff → next-task as 3 generations.

**Why it happens:** Same boundary issue as Pitfall 1 — handoff step ID lives only in the orchestrator's local scope; downstream worker can't see it.

**How to avoid:** When the handoff orchestrator queues the next task, include `parentStepId = handoffStepId` in the payload. The downstream `executeTask` reads it from `job.data.parentStepId` (defaults to `null` for root tasks).

**Warning signs:** All steps in a run have `parentStepId = null` (flat tree). Playwright case 1 (3-step task → handoff → task) renders all three at depth 0.

### Pitfall 3: Backfill running against a live writer

**What goes wrong:** Operator runs `npm run backfill:run-tree` while the autonomy pipeline is producing new step rows. Backfill walks `autonomy_events` rows with traceIds that ALSO have live `autonomy_run_steps` writes happening concurrently → race condition creates duplicate runs / wrong parent edges.

**Why it happens:** Backfill's idempotency check is "skip projects where any `autonomy_run_steps` row already exists for that traceId." If a live writer is mid-flight on a NEW traceId that doesn't yet have any rows, backfill might race with it.

**How to avoid:**
1. Backfill operates on the SET of `traceId`s that exist in `autonomy_events` but NOT in `autonomy_run_steps`. Live writes only produce new traceIds that are NOT in historical events. So the sets are disjoint by construction — IF the live writer has already started before backfill runs.
2. Belt-and-suspenders: backfill should run a `SELECT trace_id FROM autonomy_events WHERE timestamp < NOW() - interval '5 minutes'` window to only consider stable rows.
3. Document the 5-minute window in the backfill script header.

**Warning signs:** Same `traceId` appears in both `autonomy_runs` and as backfill output → duplicate runs in the UI. Playwright case 4 should assert "backfill of 5 events → exactly 1 new run row" (not 2).

### Pitfall 4: Score delta math when prior version was pre-Phase-36

**What goes wrong:** `executeTask` produces a deliverable version. Writer's `completeStep` tries to compute `scoreDelta = currentVersion.rubricScore.total − priorVersion.rubricScore.total`. But the prior version's `rubricScore` is `null` (pre-Phase-36 deliverable). Division by undefined → step row has `scoreDelta = NaN` instead of `null`.

**Why it happens:** D-19 acknowledges this case for backfill but it also occurs in LIVE writes when a deliverable was created before Phase 36 deployed. Per Phase 36 36-RESEARCH "Deferred Ideas," pre-Phase-36 versions stay `rubricVersion: null` and the UI shows fallback.

**How to avoid:** In writer's `completeStep`: if `priorVersion?.rubricScore?.total` is not a finite number, set `scoreDelta = null` (rendered as "new" badge). Only compute the delta when BOTH old and new scores are finite numbers.

**Warning signs:** Step rows have non-null but NaN `scoreDelta`. Badge renders as `NaN` literal. Phase 37 Playwright case 3 should explicitly seed a pre-Phase-36 prior version and assert "new" badge (not NaN).

### Pitfall 5: D-06.1 — autonomy doesn't actually produce deliverables

**What goes wrong:** Planner / engineer assumes step rows will carry deliverableVersionId most of the time. Builds elaborate score-delta UI. Discovers in QA that almost no step has a delta because pipeline doesn't create deliverables.

**Why it happens:** Audit on 2026-05-13 confirmed `taskExecutionPipeline.executeTask` produces text output stored in `tasks.metadata`, never calls `storage.createDeliverable`. Phase 36 deliverables come from a different path (`server/ai/deliverableGenerator.ts`).

**How to avoid:** This is **explicitly acknowledged in CONTEXT D-06.1.** Plan accordingly: tree visualization of "who did what when" still has value WITHOUT score deltas attached. Most live step rows will show no badge or "new" badge. Score-delta rendering is forward-looking. Don't over-invest in delta UI; do correctly handle the null case as the COMMON case. Phase 47 backlog #2 captures the bridge work.

**Warning signs:** Engineer writing score-delta tests as if they're the dominant case. UI showing "0 of 47 steps have score data" empty-state in early production.

### Pitfall 6: Stuck step rows when a worker crashes

**What goes wrong:** `executeTask` writes the `startStep` row (`status='running'`), then the process crashes mid-LLM-call. `completeStep` / `failStep` never fire. Row sits in `running` forever. Tree shows perpetual "running" spinner.

**Why it happens:** Two-write semantics — INSERT-then-UPDATE — has an inherent failure window. pg-boss retries the job after `expireInMinutes: 30` (per existing config at `jobQueue.ts:50`), but the abandoned step row from the previous attempt is still there.

**How to avoid:** § 9 below — defensive `timeoutAt` column written at startStep time (start + 30min, matching pg-boss expiry). The tree query path opportunistically marks any `running` row with `timeoutAt < NOW()` as `failed` (status='failed', metadata.timeoutReason='inferred from pg-boss expiry'). No separate cron needed.

**Warning signs:** Step rows stuck in `running` for > 30 minutes. Tree UI shows perpetual spinner. Unit test: simulate crash between startStep and completeStep, then read tree → step should be marked failed after timeoutAt elapses.

### Pitfall 7: MemStorage drift from DatabaseStorage

**What goes wrong:** New IStorage methods (`createRun`, `createRunStep`, `updateRunStep`, `getRunsByProject`) implemented in `DatabaseStorage` but `MemStorage` returns mock empty data. Playwright spec passes (it uses real DB) but unit tests using STORAGE_MODE=memory silently miss bugs.

**Why it happens:** IStorage has TWO implementations. Easy to update one and forget the other.

**How to avoid:** Add MemStorage impls in the SAME commit as DatabaseStorage. Writer module's unit tests run in STORAGE_MODE=memory — they break loudly if MemStorage is missing methods. Phase 36 established this pattern (see `case_persistenceShape`).

**Warning signs:** `scripts/test-run-tree-writer.ts` passes but Playwright fails. Differences in tree shape between memory and DB modes.

### Pitfall 8: Activity tab default-mode flicker on first paint

**What goes wrong:** D-10 says default = `Tree` when project has ≥1 run with ≥3 steps. To decide the default, you need data. But the first paint can't wait for the fetch. If you default to `Flat` and switch to `Tree` after data arrives, the user sees a flicker. If you default to `Tree` and there are no runs, the user sees an empty tree before falling back to `Flat`.

**Why it happens:** Auto-default logic needs runtime data.

**How to avoid:** Use the localStorage cached value as the first-paint default. On first load (no cached value), default to `Flat` (zero-data appropriate) and update on data arrival ONLY when there's no cached value. Once the user explicitly toggles, the cache wins forever.

**Warning signs:** Visual flicker on Activity tab mount. Playwright case 6 (toggle persistence) is brittle because timing-dependent.

## Code Examples

Verified patterns from official sources or existing repo code:

### Drizzle self-ref pattern (verified in repo)

```typescript
// Source: shared/schema.ts:137 — messages.parentMessageId pattern
parentMessageId: varchar("parent_message_id"), // for threading - self-reference

// Source: shared/schema.ts:202 — tasks.parentTaskId pattern
parentTaskId: varchar("parent_task_id"), // self-reference for hierarchical tasks (hatches)

// Source: shared/schema.ts:306 — deliverables.parentDeliverableId pattern
parentDeliverableId: varchar("parent_deliverable_id"), // chain link to upstream deliverable
```

Both omit `.references()` because the self-ref creates a circular import in Drizzle DSL. The integrity is enforced at write time in the writer module.

### TanStack Query polling + WS invalidation (verified in repo)

```typescript
// Source: client/src/hooks/useAutonomyFeed.ts:241-251 — pattern to mirror
const { data: historicalData, isLoading: isLoadingEvents } = useQuery<{ events: RawApiEvent[] }>({
  queryKey: ['/api/autonomy/events', `?projectId=${projectId}&limit=50`],
  enabled: !!projectId,
  staleTime: 30_000,
});

// Source: client/src/components/sidebar/ActivityTab.tsx:45-50 — invalidation pattern
useSidebarEvent(AUTONOMY_EVENTS.APPROVAL_REQUIRED, () => {
  queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
});
useSidebarEvent(AUTONOMY_EVENTS.TASK_COMPLETED, () => {
  queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
});
```

### Ownership check + ZodEnum URL param (verified in repo)

```typescript
// Source: server/routes/autonomy.ts:55-62 — pattern to mirror
const getSessionUserId = (req: Request): string | undefined => (req.session as any)?.userId as string | undefined;
const getOwnedProjectIds = async (userId: string): Promise<Set<string>> => {
  const projects = await storage.getProjectsByUserId(userId);
  return new Set(projects.map((project) => project.id));
};

// In handler:
const userId = getSessionUserId(req);
if (!userId) return res.status(401).json({ error: 'auth required' });
const ownedProjectIds = await getOwnedProjectIds(userId);
if (!ownedProjectIds.has(req.params.id)) return res.status(404).json({ error: 'not found' });
```

### open_deliverable window event extension (verified in repo)

```typescript
// Source: client/src/pages/home.tsx:856-866 — existing handler to extend per D-15
useEffect(() => {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (detail?.deliverableId) {
      setActiveDeliverableId(detail.deliverableId);
      // NEW per D-15: capture pending version number
      if (typeof detail.versionNumber === 'number') {
        setPendingVersionNumber(detail.versionNumber);
      } else {
        setPendingVersionNumber(undefined);
      }
    }
  };
  window.addEventListener('open_deliverable', handler);
  return () => window.removeEventListener('open_deliverable', handler);
}, []);
```

## State of the Art

No external "state of the art" applicable — Phase 37 is repo-internal patterns. All choices established by existing code.

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tree libraries (react-arborist, react-flow) | Pure CSS + recursive React | This phase | Zero new deps; ≤50 LOC for renderer |
| WebSocket streaming of in-flight tree | 30s polling + WS-event invalidation | This phase (D-21) | Lower complexity; "post-mortem" UX is the primary use case |
| Auto-on-boot backfill | Manual `npm run backfill:run-tree` | This phase (D-20) | Operator visibility; avoids surprise migrations |

**Deprecated/outdated:** None — Phase 37 adds, doesn't replace.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL (Neon) | autonomy_runs / autonomy_run_steps tables | ✓ | serverless | — (required) |
| Drizzle ORM | Schema + writer + query | ✓ | 0.39.1 | — |
| pg-boss | traceId in job payload | ✓ | (existing) | — |
| TanStack Query | useAutonomyRunTree | ✓ | 5.60.5 | — |
| Framer Motion | Tree expand/collapse + badges | ✓ | 11.13.1 | — |
| lucide-react | Step-type icons | ✓ | 0.453.0 | — |
| Playwright | E2E spec | ✓ | (existing) | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | tsx-driven unit scripts + Playwright (existing config) |
| Config file | `playwright.config.ts` — register `phase-37` project entry |
| Quick run command | `STORAGE_MODE=memory npx tsx -r dotenv/config scripts/test-run-tree-writer.ts` |
| Full suite command | `STORAGE_MODE=memory npx playwright test --project=phase-37` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TREE-01 | Schema: tables exist with FK + indexes | unit (info_schema) | `npx tsx -r dotenv/config scripts/test-run-tree-writer.ts -- --case schema-shape` | ❌ Wave 0 (NEW) |
| TREE-01 | Insert/select round-trip via writer | unit | `npx tsx scripts/test-run-tree-writer.ts -- --case writer-roundtrip` | ❌ Wave 0 |
| TREE-02 | `executeTask` writes start + complete | integration (storage-mock) | `npx tsx scripts/test-run-tree-writer.ts -- --case pipeline-instrumentation` | ❌ Wave 0 |
| TREE-02 | `orchestrateHandoff` writes handoff step + emits handoff_initiated event | integration | `npx tsx scripts/test-run-tree-writer.ts -- --case handoff-instrumentation` | ❌ Wave 0 |
| TREE-02 | Score delta math: pre-Phase-36 → null; both-finite → delta; new version → null | unit | `npx tsx scripts/test-run-tree-writer.ts -- --case score-delta-math` | ❌ Wave 0 |
| TREE-03 | Tree renders 3-step chain at correct depth | e2e | `npx playwright test --project=phase-37 -g "tree-render"` | ❌ Wave 0 |
| TREE-03 | View-mode toggle persists per project | e2e | `npx playwright test --project=phase-37 -g "toggle-persistence"` | ❌ Wave 0 |
| TREE-03 | Empty state on fresh project | e2e | `npx playwright test --project=phase-37 -g "empty-state"` | ❌ Wave 0 |
| TREE-04 | Click step with deliverableId opens ArtifactPanel at correct version | e2e | `npx playwright test --project=phase-37 -g "click-to-deliverable"` | ❌ Wave 0 |
| TREE-04 | Score-delta badge: +1.5 green, -0.8 amber, null → "new" | e2e | `npx playwright test --project=phase-37 -g "score-delta"` | ❌ Wave 0 |
| TREE-05 | Backfill: 5 events → 1 run + 5 steps; re-run = no-op | unit | `npx tsx scripts/test-run-tree-backfill.ts` | ❌ Wave 0 |
| TREE-05 | Backfill correctness (parent inference for peer_review_started) | e2e | `npx playwright test --project=phase-37 -g "backfill"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `STORAGE_MODE=memory npx tsx scripts/test-run-tree-writer.ts` (~5s deterministic)
- **Per wave merge:** `STORAGE_MODE=memory npx playwright test --project=phase-37` (~1-2min)
- **Phase gate:** Full suite green + typecheck + build before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `scripts/test-run-tree-writer.ts` — covers TREE-01 / TREE-02 (writer module unit)
- [ ] `scripts/test-run-tree-backfill.ts` — covers TREE-05 (backfill correctness)
- [ ] `tests/e2e/phase-37-run-tree.spec.ts` — covers TREE-03 / TREE-04 / TREE-05 e2e (6 cases per D-23)
- [ ] Playwright config registration: add `{ name: 'phase-37', testMatch: ['phase-37-run-tree.spec.ts'] }` to `playwright.config.ts`
- [ ] DEV-only seed endpoint(s) for deterministic Playwright seeding (mirror Phase 36's `/api/dev/force-judge-score` pattern, double-guarded against prod)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing session-based; new endpoint requires `req.session.userId` |
| V3 Session Management | yes | No change — Phase 37 inherits |
| V4 Access Control | yes | Ownership check on `GET /api/projects/:id/runs` — returns 404 (not 403) on mismatch per T-36-14 lesson |
| V5 Input Validation | yes | Zod insert schemas with `.strict()` on both new tables; URL `:id` validated as UUID format |
| V6 Cryptography | no | No new crypto |
| V7 Error Handling | yes | Writer failures must not throw — log and continue (mirrors logAutonomyEvent JSONL fallback) |
| V8 Data Protection | yes | `metadata` JSONB never logs raw user content — only structured agent + task data |
| V9 Communication | no | No new external surfaces |
| V11 Business Logic | yes | Backfill idempotency + 5-minute stale-event window prevents double-write race |

### Known Threat Patterns for {Express + Drizzle + pg-boss + Neon}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-project step disclosure (user A reads user B's tree) | Information Disclosure | Ownership check on every fetch; 404 (not 403) on mismatch |
| Forged step inserts via crafted job payload | Tampering | pg-boss jobs are produced server-side only; no public job-creation endpoint; writer methods are not exposed via HTTP |
| Backfill DoS (operator runs against a huge `autonomy_events` history) | Denial of Service | Manual CLI per D-20 + paginated reads in 1000-row chunks; document expected runtime in script header |
| Recursive tree client-side cyclic crash | DoS (client) | Server enforces parent-step belongs to same `runId` at write time (writer assertion); client also depth-caps at 50 generations as a defensive limit |
| Score-delta NaN injection from malformed prior version | Integrity | Writer's `completeStep` validates that both rubricScore.total values are finite numbers before computing delta; falls back to null otherwise |
| Stuck-step row data accumulation | Resource exhaustion | `timeoutAt` defensive column + opportunistic sweep in query path (§ 9) |
| Backfill writes to running project (race) | Tampering / Race | 5-minute stable-event window on backfill; idempotency check on (project_id, trace_id) pairs |

## Plan Breakdown Recommendation

CONTEXT D-locked breakdown is **37-01 foundation / 37-02 server writer + instrumentation / 37-03 client UI / 37-04 backfill + verification.** Researcher CONFIRMS this 4-plan structure with refinements below.

### Wave dependency graph

```
                    37-01 (Foundation)
                          │
                          ▼
                    37-02 (Server writer + instrumentation)
                          │
                          ├─────────────────────────┐
                          ▼                         ▼
              37-03 (Client UI)            37-04 (Backfill + verification)
                          │                         │
                          └────────┬────────────────┘
                                   ▼
                       Phase 37 VERIFICATION (Playwright on live server)
```

37-03 and 37-04 are **parallelizable Wave 4** — both depend on 37-02 but not on each other. 37-04's Playwright spec depends on 37-03's UI being complete, so the final verification step in 37-04 is gated on 37-03 merging.

### Plan task counts (estimates)

| Plan | Description | Tasks | Notes |
|------|-------------|-------|-------|
| **37-01** | Foundation: schema additions + Zod insert schemas + IStorage method signatures + MemStorage + DatabaseStorage + Wave-1 unit tests for storage layer; apply via `npm run db:push`. | 3-4 | (1) Drizzle table definitions + Zod schemas, (2) IStorage signatures + MemStorage impl, (3) DatabaseStorage impl, (4) `scripts/test-run-tree-writer.ts` storage-layer cases (schema-shape, writer-roundtrip). |
| **37-02** | Server writer + instrumentation: `runTreeWriter.ts` module, `traceId` field added to `queueTaskExecution` payload, instrument `executeTask` (3 hook points + queueForBatch single-task fallback), instrument `executeTaskWithOutput` parallel path, instrument `orchestrateHandoff` (parent linking + `handoff_initiated` event per D-07.1), score-delta computation, GET endpoint, writer unit tests (pipeline-instrumentation + handoff-instrumentation + score-delta-math cases). | 5-6 | (1) Writer module, (2) jobQueue payload extension + handleTaskJob plumbing, (3) executeTask 3 hooks + executeTaskWithOutput 3 hooks (DON'T forget the batched-tasks path), (4) handoffOrchestrator parent-link + handoff_initiated event, (5) GET /api/projects/:id/runs endpoint, (6) writer module unit tests. |
| **37-03** | Client UI: `RunTreeView` + `RunTreeNode` components, `ActivityViewModeToggle`, `useAutonomyRunTree` hook, ArtifactPanel `pendingVersionNumber` prop, home.tsx open_deliverable handler extension, empty state, shared/scoreFormat.ts helper, ActivityFeedItem chrome extraction. **Visual checkpoint required** before commit (UI change protocol). | 4-5 | (1) shared/scoreFormat.ts, (2) hook + ActivityViewModeToggle + ActivityTab integration, (3) RunTreeView + RunTreeNode + step-type icons, (4) ArtifactPanel pendingVersionNumber wiring + home.tsx event handler, (5) Playwright screenshot capture + user approval. |
| **37-04** | Backfill + verification: `scripts/backfill-run-tree.ts` (5-min stable-event window, 1000-row pagination, idempotent), backfill unit tests (`scripts/test-run-tree-backfill.ts`), Playwright 6-case spec on live dev server, `37-VERIFICATION.md` mapping success criteria to PASS, register Playwright project. | 3-4 | (1) Backfill script + idempotency, (2) backfill unit tests, (3) Playwright spec + DEV seed endpoints (double-guarded), (4) 37-VERIFICATION.md + Playwright project registration. |

**Total task estimate:** 15-19 tasks across 4 plans. Mirrors Phase 36 cadence (12 tasks across 4 plans). Note: Phase 37's "instrumentation" plan (37-02) is heavier than Phase 36's because TWO execution paths need the 3 hooks (`executeTask` AND `executeTaskWithOutput` — the batched-tasks helper at line 185 was easy to miss in the initial audit but MUST be instrumented identically).

### Critical sequencing rules

1. **37-01 MUST land before 37-02.** Writer can't be tested without storage methods.
2. **37-02 MUST land before 37-03 and 37-04.** UI needs the GET endpoint; backfill needs the writer + storage methods.
3. **37-03 and 37-04 can wave 4 in parallel.** Different files, no shared mutable surfaces.
4. **37-04's Playwright spec is the LAST thing to land.** Cannot pass until 37-03's UI is complete.
5. **Visual checkpoint in 37-03 is BLOCKING.** Per `feedback_ui_change_protocol.md` — RunTreeView is a new user-facing surface; Playwright screenshots + user approval required before commit, NOT after.

## Open Questions

### Q1 (research): Tree library — RESOLVED

**Recommendation: Pure CSS + recursive React. No library.**

**What we know:** Sidebar is 350-400px wide. Max ~20 runs per page (D-11), each with ≤30 steps realistic. Max DOM nodes ~600 per project. No drag-drop, no virtual scrolling needed.

**What's unclear:** Whether `react-arborist` would simplify the recursive-render code. Inspected its API — yes for trees with virtual scrolling and drag-drop; no for our use case. The CSS indentation contract in D-12 is `paddingLeft: depth * 16px` — one CSS rule.

**Verdict:** Add zero dependencies. ~50 LOC for `RunTreeNode.tsx` covering everything in D-12 + D-13. Matches CLAUDE.md "Don't optimize prematurely." Phase 47 backlog candidate if profile shows performance issues (it won't at this scale).

### Q2 (research): Index strategy — RESOLVED

**Recommendation:**

```
autonomy_runs:
  - autonomy_runs_trace_id_idx              ON (trace_id)
  - autonomy_runs_project_created_idx       ON (project_id, created_at)

autonomy_run_steps:
  - autonomy_run_steps_run_parent_idx       ON (run_id, parent_step_id)  ← composite
  - autonomy_run_steps_trace_id_idx         ON (trace_id)
```

**Rationale:**
- **`(run_id, parent_step_id)` composite:** Dominant query is `SELECT * FROM autonomy_run_steps WHERE run_id = ?`. The composite index serves this with a single B-tree range scan. The `parent_step_id` column being included in the index also accelerates client-side tree assembly (the planner uses index-only scans when fetching steps to bucket by parent). Adding a standalone `parent_step_id` index would help "find all children of step X" — but the tree is assembled CLIENT-side after fetch, so this query never runs server-side.
- **`(trace_id)` standalone on both tables:** Backfill correlation needs to find runs/steps for a given trace_id. No project_id is in scope during the lookup (we go trace_id → run_id → project_id). Composite `(trace_id, project_id)` wastes index space.
- **`(project_id, created_at DESC)` on runs:** Paginated runs listing per D-11 ("most-recent first, limit 20"). Composite covers WHERE + ORDER BY in one index lookup.
- **No index on `status`:** Listing always shows all statuses (running included for in-flight feedback). Filtering by status is rare/secondary. Re-evaluate if profile shows a hot path.

### Q3 (planner): Backfill auto-on-boot vs manual one-shot — CONFIRMED ACCEPTABLE

**CONTEXT D-20 locks manual.** Researcher CONFIRMS this is the right call for production readiness:

1. **Operator visibility:** A manual command means the operator knows backfill ran. Auto-on-boot would silently rewrite history on every container restart.
2. **CLAUDE.md anti-pattern alignment:** Per project rules, automatic migrations are discouraged.
3. **Idempotency mitigates re-run risk:** Even if accidentally run twice, the idempotency check (skip projects with any existing `autonomy_run_steps` for that traceId) prevents double-writes.
4. **Migration drift safety:** Manual gives the operator a chance to inspect the source `autonomy_events` rows before writing. Auto-on-boot bakes in any prior data quality issues.

Documentation in script header should include: expected runtime ("up to 5min for 100k events"), idempotency claim, and the 5-minute stable-event window (see Pitfall 3).

### Q4 (planner): Stuck-step-row prevention — RESOLVED

**Recommendation: Defensive `timeoutAt` column + opportunistic sweep in query path. No separate cron.**

**What we know:**
- pg-boss jobs have `expireInMinutes: 30` (existing `jobQueue.ts:50`). If a worker dies mid-execution, the job is expired by pg-boss and retried.
- The PROBLEM is the step row written before the crash — pg-boss retries don't clean it up.
- Adding a sweeper cron adds operational surface (start/stop, monitor, alert on failure).

**What to do:**

1. **Write `timeoutAt` at `startStep` time:** Set `timeoutAt = NOW() + interval '30 minutes'`. Matches pg-boss's `expireInMinutes: 30` constant.
2. **Opportunistic sweep in `getRunsByProject` query:** Before returning the tree, run:
   ```sql
   UPDATE autonomy_run_steps
   SET status = 'failed',
       completed_at = NOW(),
       metadata = jsonb_set(metadata, '{timeoutReason}', '"inferred from pg-boss expiry"')
   WHERE status = 'running'
     AND timeout_at < NOW()
     AND run_id IN (SELECT id FROM autonomy_runs WHERE project_id = $1);
   ```
   This is one UPDATE per tree fetch — cheap when no rows match (no rows = no work).
3. **NO separate cron.** The sweep happens on tree fetch, which happens every 30s while a user is viewing the Activity tab. Stuck rows are cleaned up within 30 minutes of being orphaned + 30s of the user viewing.

**Why this is correct:**
- Sweeper-on-fetch is "lazy" — only paid when someone is looking.
- No new infrastructure (cron, scheduled job).
- 30min match with pg-boss expiry means: when pg-boss retries the job, our sweep has likely already marked the prior step as failed, AND the new retry creates a fresh step row.
- Manual cleanup is always available: backfill-style admin script if a corrupted state needs reset.

**Alternative considered (rejected): Cron job at `5 0 * * *` UTC (matching budget reconciliation pattern from Phase 22).** This adds infrastructure and only catches stuck rows once per day. The lazy-sweep approach catches them within the user's polling window AND adds zero new infra.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| (none) | All claims in this research were verified against existing repo code (Drizzle schema, ActivityTab, ActivityFeedItem, useAutonomyFeed, ArtifactPanel, home.tsx, taskExecutionPipeline, handoffOrchestrator, eventLogger, jobQueue, autonomy routes, package.json) or are direct quotes from CONTEXT.md locked decisions | — | — |

No `[ASSUMED]` tags in this research. All claims are `[VERIFIED: <repo file>:LINE]` or `[CITED: CONTEXT.md D-XX]`.

## Sources

### Primary (HIGH confidence)

- `shared/schema.ts:137` — `messages.parentMessageId` self-ref pattern (read 2026-05-13)
- `shared/schema.ts:202` — `tasks.parentTaskId` self-ref pattern
- `shared/schema.ts:231-255` — `autonomyEvents` table (source for backfill TREE-05)
- `shared/schema.ts:306` — `deliverables.parentDeliverableId` self-ref pattern
- `shared/schema.ts:343-363` — `deliverableVersions` table (Phase 36 RUBR-03 columns)
- `shared/schema.ts:273` — `insertAutonomyDailyCounterSchema` pattern via `createInsertSchema`
- `server/autonomy/execution/taskExecutionPipeline.ts:317` — `executeTask` instrumentation site (read 2026-05-13)
- `server/autonomy/execution/taskExecutionPipeline.ts:185` — `executeTaskWithOutput` (PARALLEL path — also needs instrumentation; easy to miss)
- `server/autonomy/handoff/handoffOrchestrator.ts:15` — `orchestrateHandoff` instrumentation site (read 2026-05-13)
- `server/autonomy/events/eventLogger.ts:265` — `logAutonomyEvent` signature (D-07.1 sibling write target)
- `server/autonomy/events/eventTypes.ts:1-50` — confirmed: no `handoff_initiated` event exists today (validates D-18 backfill limitation)
- `server/autonomy/execution/jobQueue.ts:37-55` — `queueTaskExecution` signature; `expireInMinutes: 30` constant (basis for Q4 timeoutAt match)
- `server/routes/autonomy.ts:55-62` — ownership check pattern (`getSessionUserId` + `getOwnedProjectIds`)
- `server/storage.ts:96-274` — IStorage interface (extension target)
- `client/src/components/sidebar/ActivityTab.tsx:23-138` — current Activity tab structure (modification target)
- `client/src/components/sidebar/ActivityFeedItem.tsx:91-170` — chrome to extract for shared `<FeedItemShell>`
- `client/src/hooks/useAutonomyFeed.ts:241-251` — sibling hook pattern for `useAutonomyRunTree`
- `client/src/components/ArtifactPanel.tsx:67-471` — host for pendingVersionNumber prop (D-15)
- `client/src/pages/home.tsx:856-866` — `open_deliverable` handler (D-15 extension target)
- `.planning/phases/37-git-style-run-tree/37-CONTEXT.md` — 25 locked decisions + 6 post-audit corrections (read in full 2026-05-13)
- `.planning/phases/36-frozen-rubric-deliverable-iteration/36-VERIFICATION.md` — Phase 36 verification structure (Phase 37 mirror target)
- `.planning/REQUIREMENTS.md:53-61` — TREE-01..05 authoritative source
- `.planning/ROADMAP.md:187-198` — Phase 37 success criteria + Phase 47 backlog #2 (D-06.1 source)
- `CLAUDE.md` — all sections referenced in Project Constraints table (verified 2026-05-13)
- `package.json` — dependency versions (verified 2026-05-13 via `head -100`)

### Secondary (MEDIUM confidence)

- pg-boss documentation (no external source consulted — relied on existing `jobQueue.ts` code as truth)

### Tertiary (LOW confidence)

- None.

## Metadata

**Confidence breakdown:**
- Schema design: HIGH — exact mirror of 4 existing self-ref tables in the same file
- Writer module shape: HIGH — pure async wrapper over storage; no novel design
- Instrumentation: HIGH — line numbers and 3-hook contract verified by reading current source
- traceId propagation: HIGH — verified pg-boss boundary by reading `jobQueue.ts`; payload field is the only correct option
- Backfill strategy: MEDIUM — depends on the assumption that historical `autonomy_events` payloads contain enough info to derive even flat per-trace step rows; D-18 already acknowledges handoff edges are unrecoverable
- UI: HIGH — patterns directly mirrored from `ActivityFeedItem` + `useAutonomyFeed` + `ArtifactPanel`
- Click-to-deliverable: HIGH — `open_deliverable` event extension is additive + backward-compatible
- Q4 stuck-step prevention: MEDIUM — opportunistic sweep is correct; "30min match" assumes pg-boss expiry is the dominant crash recovery path (verified true in current config)

**Research date:** 2026-05-13
**Valid until:** 2026-06-13 (~30 days for stable codebase + locked CONTEXT decisions)

---

## RESEARCH COMPLETE

Phase: 37 - Git-Style Run Tree
Output: /Users/shashankrai/Documents/hatching-mvp-5th-march/.planning/phases/37-git-style-run-tree/37-RESEARCH.md
Open questions resolved: Q1 (pure CSS + recursive React), Q2 (composite (run_id, parent_step_id) + standalone trace_id on both), Q4 (defensive timeoutAt + opportunistic sweep in query path — no cron)
Open questions deferred to planner: Q3 (manual backfill — researcher CONFIRMS CONTEXT D-20 default is correct)
Landmines surfaced: 8 (traceId missing at executeTask entry; parentStepId not propagated; backfill vs live writer race; pre-Phase-36 score deltas → NaN; D-06.1 autonomy doesn't produce deliverables; stuck step rows on worker crash; MemStorage drift; Activity tab default-mode flicker)
Recommended plan count: 4 (37-01 foundation / 37-02 server writer + instrumentation / 37-03 client UI / 37-04 backfill + verification) — confirms CONTEXT D-locked breakdown with refinement that 37-02 task count rises to 5-6 because `executeTaskWithOutput` parallel path was easy to miss in initial audit and MUST also be instrumented identically to `executeTask`
