# Phase 37: Git-Style Run Tree — Pattern Map

**Mapped:** 2026-05-13
**Files analyzed:** 23 (12 NEW, 11 MODIFIED)
**Analogs found:** 23 / 23 (every file has a strong in-repo analog)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `shared/schema.ts` (modify: +2 tables) | shared-schema | CRUD | `shared/schema.ts:231-255` (autonomy_events) + `shared/schema.ts:301-341` (deliverables.parentDeliverableId) | exact (same file, same DSL) |
| `shared/scoreFormat.ts` (NEW) | shared-types | transform | `shared/conversationId.ts` (tiny pure-fn helper) | role-match |
| `server/autonomy/runs/runTreeWriter.ts` (NEW) | server-domain | CRUD wrapper | `server/autonomy/events/eventLogger.ts:265` (`logAutonomyEvent`) + `server/llm/providerHealthState.ts` (module-state + `__resetForTests`) | exact (same domain) |
| `server/autonomy/runs/runTreeBackfill.ts` (NEW) | server-domain | batch | `server/autonomy/events/eventLogger.ts:282-310` (`readAutonomyEvents` / `readAutonomyEventsByProject` — raw pool.query reads) | exact (same module) |
| `scripts/backfill-run-tree.ts` (NEW) | test-unit (CLI) | one-shot | (no prior backfill script; use Phase 36's `scripts/test-rubric-scorer.ts` shebang + assert pattern) | role-match |
| `scripts/test-run-tree-writer.ts` (NEW) | test-unit | assertion | `scripts/test-rubric-scorer.ts:1-80` (tsx shebang + named cases) | exact |
| `scripts/test-run-tree-backfill.ts` (NEW) | test-unit | assertion | `scripts/test-rubric-scorer.ts:1-80` | exact |
| `server/storage.ts` (modify: +4 methods) | server-domain | CRUD | `server/storage.ts:96-194` (IStorage interface for tasks/messages) | exact (same file) |
| `server/autonomy/execution/taskExecutionPipeline.ts` (modify: 3+3 hooks) | server-domain | event-driven | `server/autonomy/execution/taskExecutionPipeline.ts:292-304` (existing `logAutonomyEvent` site) | exact (same file) |
| `server/autonomy/execution/jobQueue.ts` (modify: payload fields) | server-domain | event-driven | `server/autonomy/execution/jobQueue.ts:37-55` (existing `queueTaskExecution`) | exact (same file) |
| `server/autonomy/handoff/handoffOrchestrator.ts` (modify: parent-link + event) | server-domain | event-driven | `server/autonomy/handoff/handoffOrchestrator.ts:78-94` (existing `logAutonomyEvent` site) | exact (same file) |
| `server/routes/autonomy.ts` (modify: +GET endpoint) | server-route | request-response | `server/routes/deliverables.ts:47-56` (`GET /api/projects/:projectId/deliverables`) | exact |
| `client/src/hooks/useAutonomyRunTree.ts` (NEW) | client-component | request-response | `client/src/hooks/useAutonomyFeed.ts:241-251` (sibling polling hook) | exact (sibling) |
| `client/src/components/sidebar/RunTreeView.tsx` (NEW) | client-component | render | `client/src/components/sidebar/ActivityTab.tsx` (host wrapper layout) | role-match |
| `client/src/components/sidebar/RunTreeNode.tsx` (NEW) | client-component | render | `client/src/components/sidebar/ActivityFeedItem.tsx:91-170` (chrome: avatar + label + expand) | exact (extract pattern) |
| `client/src/components/sidebar/ActivityViewModeToggle.tsx` (NEW) | client-component | local state | `client/src/components/sidebar/FeedFilters.tsx` (segmented control, same dir) | role-match |
| `client/src/components/sidebar/ActivityTab.tsx` (modify) | client-component | render | self (existing structure) | exact |
| `client/src/components/sidebar/ActivityFeedItem.tsx` (modify: extract chrome) | client-component | render | self (refactor avatar block lines 114-121 into reusable shell) | exact |
| `client/src/components/ArtifactPanel.tsx` (modify: +prop) | client-component | request-response | `client/src/components/ArtifactPanel.tsx:67-120` (existing restoreMutation) | exact |
| `client/src/pages/home.tsx` (modify: event handler) | client-page | event-driven | `client/src/pages/home.tsx:856-866` (existing `open_deliverable` listener) | exact |
| `tests/e2e/phase-37-run-tree.spec.ts` (NEW) | test-e2e | playwright | `tests/e2e/phase-36-rubric-iteration.spec.ts:1-120` (DEV-endpoint seed + force-state) + `tests/e2e/agent-action-probe.spec.ts:60-100` (auth + WelcomeModal dismiss) | exact (two complementary references) |
| `playwright.config.ts` (modify: +project entry) | config | declarative | `playwright.config.ts:82-96` (existing `phase-36` project) | exact |

---

## Pattern Assignments

### `shared/schema.ts` (shared-schema, CRUD) — 2 new tables

**Analog:** `shared/schema.ts:231-255` (autonomy_events) + lines 137 / 202 / 306 (self-ref pattern across messages / tasks / deliverables)

**Existing autonomy_events shape to mirror** (lines 231-255):
```typescript
export const autonomyEvents = pgTable("autonomy_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  traceId: text("trace_id").notNull(),
  turnId: text("turn_id").notNull(),
  requestId: text("request_id").notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow().notNull(),
  userId: varchar("user_id").references(() => users.id),
  projectId: varchar("project_id").references(() => projects.id),
  // ...
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
}, (table) => ({
  traceIdIdx: index("autonomy_events_trace_id_idx").on(table.traceId),
  projectIdIdx: index("autonomy_events_project_id_idx").on(table.projectId),
  projectEventTimeIdx: index("autonomy_events_project_event_time_idx").on(table.projectId, table.eventType, table.timestamp),
}));
```

**Self-ref pattern to mirror** (3 in-repo examples):
```typescript
// shared/schema.ts:137 — messages.parentMessageId
parentMessageId: varchar("parent_message_id"), // for threading - self-reference

// shared/schema.ts:202 — tasks.parentTaskId
parentTaskId: varchar("parent_task_id"), // self-reference for hierarchical tasks

// shared/schema.ts:306 — deliverables.parentDeliverableId
parentDeliverableId: varchar("parent_deliverable_id"), // chain link to upstream deliverable
```

**Critical convention:** All three omit `.references()` for the self-ref — Drizzle DSL has a circular-import limitation. Integrity is enforced at write time in the writer module. Phase 37 MUST follow this exact pattern for `autonomyRunSteps.parentStepId`.

**Insert-schema + type pattern to mirror** (lines 273-278, `insertAutonomyDailyCounterSchema`):
```typescript
export const insertAutonomyDailyCounterSchema = createInsertSchema(autonomyDailyCounters).omit({
  id: true,
  updatedAt: true,
});
export type AutonomyDailyCounter = typeof autonomyDailyCounters.$inferSelect;
export type InsertAutonomyDailyCounter = z.infer<typeof insertAutonomyDailyCounterSchema>;
```

**Composite index pattern** (line 254, used directly for the `(run_id, parent_step_id)` index):
```typescript
projectEventTimeIdx: index("autonomy_events_project_event_time_idx").on(table.projectId, table.eventType, table.timestamp),
```

**Score-FK type pattern to mirror** (lines 343-363, deliverableVersions for rubricScore):
```typescript
rubricScore: jsonb("rubric_score").$type<{
  total: number;
  breakdown: Array<{ criterion: string; score: number; justification: string }>;
}>(),
```
Phase 37's `autonomyRunSteps.scoreDelta` is `doublePrecision` (nullable) — FK chain is `deliverableVersionId → deliverable_versions.id → rubricScore.total`. Writer module pulls both old + new versions and computes the diff.

---

### `shared/scoreFormat.ts` (shared-types, transform) — NEW pure helper

**Analog:** `shared/conversationId.ts` (similar single-purpose pure-fn helper imported by both server + client)

**Pattern:** Tiny module, one exported function, used by both server (debug logging) and client (badge rendering). Per RESEARCH § Architectural Responsibility Map.

**Behavioral contract (from CONTEXT D-09 + D-16):**
```typescript
// formatScoreDelta(null) → 'new'
// formatScoreDelta(0)    → ''        (no badge — visual silence on unchanged)
// formatScoreDelta(1.234) → '+1.2'   (1 decimal, '+' prefix on positive)
// formatScoreDelta(-0.83) → '−0.8'   (en-dash on negative, NOT ASCII '-')
// Color thresholds match Phase 36 score-chip palette (green >=, amber <)
```

---

### `server/autonomy/runs/runTreeWriter.ts` (server-domain, CRUD wrapper) — NEW

**Analog:** `server/autonomy/events/eventLogger.ts:265-280` (`logAutonomyEvent`)

**Imports pattern** (eventLogger.ts:1-10 — extend with storage import):
```typescript
import { randomUUID } from 'crypto';
import { storage } from '../../storage.js';
import type { InsertAutonomyRun, InsertAutonomyRunStep } from '@shared/schema';
```

**Non-fatal write pattern** (mirrors eventLogger.ts:273-279 — DB-or-file fallback):
```typescript
export async function logAutonomyEvent(event: ...): Promise<AutonomyEvent> {
  const fullEvent = normalizeAutonomyEvent(event);
  const wroteToDb = await writeEventToDb(fullEvent);
  if (!wroteToDb) {
    await writeEventToFile(fullEvent);
  }
  return fullEvent;
}
```
**Apply to Phase 37:** Writer methods MUST swallow throws and log-and-continue. Step writes are NOT in the LLM-blocking path. (RESEARCH Anti-Pattern: "Synchronous step write inside the LLM call path — writer failures non-fatal.")

**Module-state + dev-reset pattern** (`server/llm/providerHealthState.ts:218-232`):
```typescript
export function __resetForTests(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: __resetForTests() called in production. Test-only helper must not run in a production code path.');
  }
  failureTimestamps = [];
  isDegraded = false;
  // ...
}
```
**Apply to Phase 37:** runTreeWriter exposes `__resetForTests()` for the unit-test suite, and any in-process cache (e.g., an `ensureRunForTrace` memo) gets the same prod-guard.

**Module API contract** (CONTEXT D-05):
```typescript
export async function ensureRunForTrace(traceId: string, input: { projectId; userId?; rootAgentId?; rootGoal? }): Promise<string /* runId */>
export async function startStep(runId: string, parentStepId: string | null, input: InsertAutonomyRunStep): Promise<string /* stepId */>
export async function completeStep(stepId: string, output: { deliverableId?; deliverableVersionId?; scoreDelta?: number | null }): Promise<void>
export async function failStep(stepId: string, error: Error): Promise<void>
```

---

### `server/autonomy/runs/runTreeBackfill.ts` (server-domain, batch) — NEW

**Analog:** `server/autonomy/events/eventLogger.ts:282-310` (`readAutonomyEvents` raw `pool.query` reads)

**Raw-pool query pattern** (eventLogger.ts:24-43):
```typescript
async function getDbPool(): Promise<DbPool | null> {
  if (!process.env.DATABASE_URL) return null;
  if (!dbPoolPromise) {
    dbPoolPromise = (async () => {
      try {
        const mod = await import('../../db.js');
        const pool = mod.pool as DbPool;
        await pool.query('select 1');
        return pool;
      } catch { return null; }
    })();
  }
  return dbPoolPromise;
}
```
**Pre-existing TODO comment at eventLogger.ts:1-4** explicitly documents that this raw-pool pattern is the established exception to "Drizzle-only" in `CLAUDE.md § 14`. Phase 37 backfill follows the same exception.

**Critical RESEARCH constraint (Pitfall 3):** Backfill MUST apply a 5-minute stable-event window:
```sql
SELECT trace_id FROM autonomy_events WHERE timestamp < NOW() - interval '5 minutes'
```
Reason: prevents race against a live writer producing rows mid-flight on the same `traceId`.

**Idempotency check (CONTEXT D-17):** Skip any traceId where `autonomy_run_steps` already has at least one row.

---

### `scripts/backfill-run-tree.ts` (test-unit / CLI) — NEW

**Analog:** Phase 36's `scripts/test-rubric-scorer.ts` (tsx shebang + module-load pattern)

**Header pattern** (test-rubric-scorer.ts:1-10):
```typescript
#!/usr/bin/env tsx
/**
 * Phase 36 — Unit tests for the rubric registry + scorer.
 * Run with: npx tsx scripts/test-rubric-scorer.ts
 */
import assert from 'node:assert/strict';
```
**Apply to Phase 37:** Phase 37 script header MUST document:
- Expected runtime ("up to 5min for 100k events" — per RESEARCH Q3)
- Idempotency claim
- 5-minute stable-event window (RESEARCH Pitfall 3)

**Run command (CONTEXT D-20):** `npm run backfill:run-tree` — added to package.json scripts. NOT auto-on-boot.

---

### `scripts/test-run-tree-writer.ts` + `scripts/test-run-tree-backfill.ts` (test-unit) — NEW

**Analog:** `scripts/test-rubric-scorer.ts:1-80`

**Case-function pattern** (test-rubric-scorer.ts:49-75):
```typescript
async function case_registryShape(): Promise<void> {
  const types = listRubricTypes();
  assert.equal(types.length, 15, 'expected exactly 15 rubric types');
  // ...
  console.log('PASS registry-shape: all 15 types present, valid, and weight-balanced');
}
```

**Test-only-import pattern** (test-rubric-scorer.ts:22-29):
```typescript
import {
  scoreIteration,
  __setForcedScoreForTests,
  __clearForcedScoreForTests,
  // ...
} from '../server/ai/rubricScorer.js';
import { __resetImpressionDedupeForTests } from '../server/storage.js';
```
**Apply to Phase 37:** Tests import `__resetForTests` from `runTreeWriter.ts` to clear module state between cases.

**Cases required (per RESEARCH § Test Map):**
- `schema-shape` — info_schema check that tables exist with FK + indexes
- `writer-roundtrip` — createRun → startStep → completeStep → readback
- `pipeline-instrumentation` — mock storage, assert 3 hooks fire on success / fail
- `handoff-instrumentation` — assert handoff step row + `handoff_initiated` event both written
- `score-delta-math` — pre-Phase-36 null prior → null delta (NOT NaN); both-finite → diff

---

### `server/storage.ts` (server-domain, CRUD interface) — modify

**Analog:** `server/storage.ts:96-194` (IStorage interface — existing pattern for projects/teams/agents/tasks)

**Existing method-cluster pattern** (lines 104-110):
```typescript
// Projects
getProjects(): Promise<Project[]>;
getProjectsByUserId(userId: string): Promise<Project[]>;
getProject(id: string): Promise<Project | undefined>;
createProject(project: InsertProject): Promise<Project>;
updateProject(id: string, updates: Partial<Project>): Promise<Project | undefined>;
deleteProject(id: string): Promise<boolean>;
```
**Apply to Phase 37 (CONTEXT D-05):**
```typescript
// Autonomy runs (Phase 37)
createRun(run: InsertAutonomyRun): Promise<AutonomyRun>;
createRunStep(step: InsertAutonomyRunStep): Promise<AutonomyRunStep>;
updateRunStep(id: string, updates: Partial<AutonomyRunStep>): Promise<AutonomyRunStep | undefined>;
getRunsByProject(projectId: string, options?: { limit?: number; offset?: number }): Promise<{ runs: AutonomyRun[]; steps: AutonomyRunStep[] }>;
```

**RESEARCH Pitfall 7 (MemStorage drift):** New methods MUST land in BOTH MemStorage AND DatabaseStorage in the SAME commit. Phase 36 established this pattern via `case_persistenceShape` in `scripts/test-rubric-scorer.ts`.

---

### `server/autonomy/execution/taskExecutionPipeline.ts` (server-domain, event-driven) — modify

**Analog:** `server/autonomy/execution/taskExecutionPipeline.ts:292-304` (existing `logAutonomyEvent` site)

**Existing logAutonomyEvent invocation pattern** (lines 292-304):
```typescript
await logAutonomyEvent({
  eventType: 'autonomous_task_execution',
  projectId: input.task.projectId,
  hatchId: input.agent.id,
  conversationId: input.conversationId,
  confidence: 1.0,
  riskScore: maxRisk,
  latencyMs: null,
  mode: 'autonomous',
  provider: null,
  teamId: null,
  payload: { taskId: input.task.id, taskTitle: input.task.title, agentName: input.agent.name, batched: true, peerReviewed },
});
```

**3-hook contract (CONTEXT D-06):**
- **HOOK A — entry (line 317 `executeTask` + line 185 `executeTaskWithOutput`):**
  ```typescript
  // After resolving agent + project + traceId from job payload (see jobQueue pattern below)
  const stepId = await startStep(runId, input.parentStepId ?? null, {
    runId,
    traceId,
    agentId: input.agent.id,
    agentName: input.agent.name,
    agentRole: input.agent.role,
    stepType: 'task',
    title: input.task.title.slice(0, 200),
    status: 'running',
  });
  ```
- **HOOK B — success return** (one per existing success exit; see lines 314, 413-455, 290 — the `return { status: 'completed' }` sites):
  ```typescript
  await completeStep(stepId, {
    deliverableId: undefined,         // D-06.1: ~100% null in practice
    deliverableVersionId: undefined,  // D-06.1
    scoreDelta: null,                  // D-06.1 + Pitfall 4: null when prior version rubricScore is null
  });
  ```
- **HOOK C — catch / fail** (wrap existing try blocks; line 390-393 already has a try/catch for peer review — extend the pattern):
  ```typescript
  } catch (err) {
    await failStep(stepId, err as Error);
    throw err;
  }
  ```

**CRITICAL — RESEARCH Pitfall 1 + 2:** Both `executeTask` (line 317) AND `executeTaskWithOutput` (line 185 — the BATCHED path) need all 3 hooks. Easy to miss the batched path — RESEARCH calls this out explicitly. `executeBatchedTasks` at line ~172 falls back to `executeTask` per-input on parse failure (line 177), so it's transitively covered, but the in-batch happy path runs `executeTaskWithOutput`.

---

### `server/autonomy/execution/jobQueue.ts` (server-domain, event-driven) — modify

**Analog:** Self (existing `queueTaskExecution` at lines 37-55)

**Current signature** (lines 37-55):
```typescript
export async function queueTaskExecution(data: {
  taskId: string;
  projectId: string;
  agentId: string;
}): Promise<string | null> {
  const boss = await getJobQueue();
  if (!boss) return null;
  const jobId = await boss.send('autonomous_task_execution', data, {
    retryLimit: 3,
    retryDelay: 30,
    expireInMinutes: 30,
    singletonKey: data.taskId,
  });
  return jobId;
}
```

**Phase 37 modification (RESEARCH Pattern 2 + Pitfalls 1 & 2):**
```typescript
export async function queueTaskExecution(data: {
  taskId: string;
  projectId: string;
  agentId: string;
  traceId?: string;       // NEW — survives pg-boss process boundary
  parentStepId?: string;  // NEW — handoff step id; null for run roots
}): Promise<string | null> { /* ...unchanged body, pg-boss serializes the new fields automatically... */ }
```

**`expireInMinutes: 30` is load-bearing** for Q4 (RESEARCH § Q4): `autonomyRunSteps.timeoutAt = startedAt + 30min` matches this constant so the opportunistic sweep in `getRunsByProject` cleans up worker-crash-orphaned rows.

---

### `server/autonomy/handoff/handoffOrchestrator.ts` (server-domain, event-driven) — modify

**Analog:** Self (existing `logAutonomyEvent` site at lines 78-94)

**Existing event-emit pattern** (lines 78-94, fires only on cycle detection today):
```typescript
await logAutonomyEvent({
  eventType: 'task_failed',
  projectId: input.completedTask.projectId,
  hatchId: input.completedAgent.id,
  conversationId: 'project:' + input.completedTask.projectId,
  provider: null,
  mode: 'autonomous',
  teamId: null,
  latencyMs: null,
  confidence: null,
  riskScore: null,
  payload: { reason: 'handoff_cycle', chain: cycleCheck.chain, taskId: input.completedTask.id },
});
```

**Phase 37 additions:**

1. **Parent-link writer call** — insert directly before `queueTaskExecution` call at line 126:
   ```typescript
   const handoffStepId = await startStep(runId, sourceStepId, {
     runId,
     traceId,
     agentId: input.completedAgent.id,
     agentName: input.completedAgent.name,
     agentRole: input.completedAgent.role,
     stepType: 'handoff',
     title: `${input.completedAgent.name} → ${targetAgent.name}: ${input.completedTask.title.slice(0, 150)}`,
     status: 'complete',  // handoff is instant — no running state
   });
   ```

2. **D-07.1 forward-compat event** — sibling write so future backfills produce richer trees:
   ```typescript
   await logAutonomyEvent({
     eventType: 'handoff_initiated',
     projectId: input.completedTask.projectId,
     hatchId: input.completedAgent.id,
     // ...same shape as existing call above...
     payload: {
       fromAgent: { id: input.completedAgent.id, name: input.completedAgent.name },
       toAgent: { id: targetAgent.id, name: targetAgent.name },
       taskId: nextTask.id,
       sourceStepId,
       handoffStepId,
     },
   });
   ```

3. **Payload extension** — at line 126, propagate `traceId` + `parentStepId` into `queueTaskExecution`:
   ```typescript
   const queued = await queueTaskExecution({
     taskId: nextTask.id,
     projectId: input.completedTask.projectId,
     agentId: targetAgent.id,
     traceId,                      // <-- from current step lineage
     parentStepId: handoffStepId,  // <-- downstream task is a child of THIS handoff row
   });
   ```

---

### `server/routes/autonomy.ts` (server-route, request-response) — modify (+1 endpoint)

**Analog:** `server/routes/deliverables.ts:47-56` (`GET /api/projects/:projectId/deliverables`)

**Imports + helper-closure pattern** (autonomy.ts:55-69 — already in file):
```typescript
export function registerAutonomyRoutes(app: Express): void {
  const getSessionUserId = (req: Request): string | undefined => (req.session as any)?.userId as string | undefined;

  const getOwnedProjectIds = async (userId: string): Promise<Set<string>> => {
    const projects = await storage.getProjectsByUserId(userId);
    return new Set(projects.map((project) => project.id));
  };

  const requireOwnedProject = async (projectId: string, userId: string) => {
    const project = await storage.getProject(projectId);
    if (!project) return null;
    return (project as any).userId === userId ? project : null;
  };
  // ...
}
```
**Already in file — reuse, don't redefine.**

**GET-by-project endpoint pattern** (deliverables.ts:47-56):
```typescript
app.get('/api/projects/:projectId/deliverables', async (req, res) => {
  const userId = getSessionUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const project = await getOwnedProject(req.params.projectId, userId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const deliverables = await storage.getDeliverablesByProject(project.id);
  return res.json({ deliverables });
});
```

**Apply to Phase 37 — new GET `/api/projects/:id/runs`:**
```typescript
app.get('/api/projects/:projectId/runs', async (req, res) => {
  const userId = getSessionUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const project = await requireOwnedProject(req.params.projectId, userId);
  if (!project) return res.status(404).json({ error: 'Project not found' });   // 404 NOT 403 — T-36-14 lesson

  const tree = await storage.getRunsByProject(project.id, { limit: 20 });
  return res.json({ runs: tree.runs, steps: tree.steps });
});
```

**RESEARCH § Security Domain V4:** 404 on ownership mismatch, NOT 403. Inherited from T-36-14 lesson.

---

### `client/src/hooks/useAutonomyRunTree.ts` (client-component, request-response) — NEW

**Analog:** `client/src/hooks/useAutonomyFeed.ts:241-251` (sibling polling hook in same directory)

**TanStack Query + invalidation pattern** (useAutonomyFeed.ts:241-251 + ActivityTab.tsx:44-50):
```typescript
// useAutonomyFeed.ts:241-251
const { data: historicalData, isLoading: isLoadingEvents } = useQuery<{ events: RawApiEvent[] }>({
  queryKey: ['/api/autonomy/events', `?projectId=${projectId}&limit=50`],
  enabled: !!projectId,
  staleTime: 30_000,
});

// ActivityTab.tsx:44-50 — invalidation pattern (CONTEXT D-22)
useSidebarEvent(AUTONOMY_EVENTS.APPROVAL_REQUIRED, () => {
  queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
});
useSidebarEvent(AUTONOMY_EVENTS.TASK_COMPLETED, () => {
  queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
});
```

**Phase 37 hook structure (CONTEXT D-21 + D-22):**
```typescript
export function useAutonomyRunTree(projectId: string | undefined) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ runs: AutonomyRun[]; steps: AutonomyRunStep[] }>({
    queryKey: ['/api/projects', projectId, 'runs'],
    enabled: !!projectId,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  useSidebarEvent(AUTONOMY_EVENTS.TASK_COMPLETED, () => {
    queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'runs'] });
  });
  useSidebarEvent(AUTONOMY_EVENTS.CHAIN_COMPLETED, () => {
    queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'runs'] });
  });

  return { runs: data?.runs ?? [], steps: data?.steps ?? [], isLoading };
}
```

---

### `client/src/components/sidebar/RunTreeNode.tsx` (client-component, render) — NEW

**Analog:** `client/src/components/sidebar/ActivityFeedItem.tsx:91-170` (chrome: avatar + name + label + expand)

**Avatar palette pattern to share** (ActivityFeedItem.tsx:18-32):
```typescript
const AVATAR_PALETTES = [
  { bg: '#1d4ed8', text: '#bfdbfe' }, // blue
  { bg: '#0f766e', text: '#99f6e4' }, // teal
  // ...
];
function avatarPalette(name: string | null) {
  if (!name) return { bg: '#374151', text: '#9ca3af' };
  const index = name.charCodeAt(0) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[index];
}
```
**Apply:** Extract this into a shared module (or duplicate verbatim into RunTreeNode — short enough to not warrant abstraction overhead).

**Render-row pattern** (ActivityFeedItem.tsx:101-148, condensed):
```typescript
<motion.div
  className="premium-card mb-2"
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  whileHover={{ y: -1 }}
  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
>
  <button className="w-full flex items-start gap-3 px-3 py-3 rounded-xl ..." onClick={...}>
    <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 ..." style={{ backgroundColor: palette.bg, color: palette.text }}>
      {initial}
    </div>
    <div className="flex-1 min-w-0">
      <span className="text-[12px] font-semibold" style={{ color: palette.text }}>{displayName}</span>
      <p className="text-[12px] hatchin-text leading-snug">{event.label}</p>
      <p className="text-[10px] hatchin-text-muted mt-0.5">{formatRelativeTime(event.timestamp)}</p>
    </div>
  </button>
</motion.div>
```

**Phase 37-specific additions (CONTEXT D-12 + D-13 + RESEARCH Pattern 3):**
```typescript
<div style={{ paddingLeft: `${Math.min(depth, maxVisibleDepth) * 16}px` }}>
  <button onClick={() => hasDeliverable ? onClick(step) : setExpanded(!expanded)}>
    <StepIcon className="w-3 h-3 shrink-0" style={{ color: stepTypeColor[step.stepType] }} />
    <Avatar ... />
    <span>{step.title}</span>
    {step.scoreDelta !== null && step.scoreDelta !== 0 && <ScoreDeltaBadge value={step.scoreDelta} />}
    {step.scoreDelta === null && hasDeliverable && <NewBadge />}
  </button>
  {expanded && stepChildren.map(child => (
    <RunTreeNode key={child.id} step={child} depth={depth + 1} ... />
  ))}
</div>
```

**Step-type icons** (CONTEXT D-12 — lucide-react):
- `task` → `Clock`
- `handoff` → `ArrowRightLeft`
- `safety_block` → `ShieldAlert`
- `peer_review` → `Search`
- `deliberation` → `MessagesSquare`
- `approval_request` → existing `ShieldAlert` (or reuse approval-tab icon)

---

### `client/src/components/sidebar/ActivityTab.tsx` (client-component, render) — modify

**Analog:** Self (current structure at lines 66-138)

**Mount-state addition pattern** (mirrors ActivityTab.tsx:36-50 — Tasks-query + useSidebarEvent):
```typescript
// New: view mode state
const [viewMode, setViewMode] = useState<'flat' | 'tree'>(() => {
  if (typeof window === 'undefined') return 'flat';
  return (localStorage.getItem(`activityViewMode:${projectId}`) as 'flat' | 'tree') ?? 'flat';
});
useEffect(() => {
  if (projectId) localStorage.setItem(`activityViewMode:${projectId}`, viewMode);
}, [viewMode, projectId]);
```

**RESEARCH Pitfall 8 (default-mode flicker):** First-paint MUST read from localStorage. Only auto-default to `Tree` AFTER data arrives and only when no cached value exists.

**Conditional render replacement** (replaces the flat-list block at lines 107-136):
```typescript
{viewMode === 'tree' ? (
  <RunTreeView projectId={projectId} />
) : activeFilter === 'handoff' ? (
  <HandoffChainTimeline events={events} />
) : (
  events.map((event) => <ActivityFeedItem key={event.id} event={event} />)
)}
```

---

### `client/src/components/ArtifactPanel.tsx` (client-component, request-response) — modify

**Analog:** Self (existing restoreMutation at lines 106-120)

**Restore-version mutation already exists** (lines 106-120):
```typescript
const restoreMutation = useMutation({
  mutationFn: async (versionNumber: number) => {
    const res = await fetch(`/api/deliverables/${deliverableId}/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ versionNumber }),
      credentials: 'include',
    });
    // ...
    return res.json();
  },
});
```

**Phase 37 addition (CONTEXT D-15):** Add `pendingVersionNumber?: number` prop + post-mount effect:
```typescript
interface ArtifactPanelProps {
  deliverableId: string;
  pendingVersionNumber?: number;  // NEW
  onClose: () => void;
}

export function ArtifactPanel({ deliverableId, pendingVersionNumber, onClose }: ArtifactPanelProps) {
  // ... existing code ...

  // NEW — auto-navigate to pendingVersionNumber after versions fetched
  useEffect(() => {
    if (!pendingVersionNumber) return;
    if (!versionsData?.versions) return;
    const targetVersion = versionsData.versions.find(v => v.versionNumber === pendingVersionNumber);
    if (!targetVersion) return;
    // Match the existing version-navigator behavior — call restoreMutation if not already at this version
    if (currentVersion !== pendingVersionNumber) {
      restoreMutation.mutate(pendingVersionNumber);
    }
  }, [pendingVersionNumber, versionsData]);
}
```
**Backward compatible:** Existing dispatchers that don't send `versionNumber` get current behavior.

---

### `client/src/pages/home.tsx` (client-page, event-driven) — modify

**Analog:** Self (existing `open_deliverable` listener at lines 856-866)

**Current handler** (verified above at lines 857-866):
```typescript
useEffect(() => {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (detail?.deliverableId) {
      setActiveDeliverableId(detail.deliverableId);
    }
  };
  window.addEventListener('open_deliverable', handler);
  return () => window.removeEventListener('open_deliverable', handler);
}, []);
```

**Phase 37 extension (CONTEXT D-15):**
```typescript
useEffect(() => {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (detail?.deliverableId) {
      setActiveDeliverableId(detail.deliverableId);
      // NEW: capture pending version number
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

**Pass through to ArtifactPanel render call** (find existing `<ArtifactPanel deliverableId={activeDeliverableId} ... />` site and add `pendingVersionNumber={pendingVersionNumber}` prop).

---

### `tests/e2e/phase-37-run-tree.spec.ts` (test-e2e, Playwright) — NEW

**Analog A:** `tests/e2e/phase-36-rubric-iteration.spec.ts:1-120` (DEV-endpoint seed pattern)
**Analog B:** `tests/e2e/agent-action-probe.spec.ts:60-100` (auth + WelcomeModal dismiss)

**Header + helpers pattern** (phase-36-rubric-iteration.spec.ts:1-50):
```typescript
/**
 * Phase 36 — Frozen-Rubric Deliverable Iteration (FBK-04 verification ...)
 * Runtime smoke spec covering the Phase 36 surface end-to-end on a LIVE restarted dev server.
 * Per saved feedback rule `feedback_verify_in_runtime.md`: phase "complete" in git ≠ "works".
 */
import { test, expect, type Page } from '@playwright/test';
import { ensureAppLoaded } from './helpers';
```

**DEV-endpoint seed pattern** (phase-36-rubric-iteration.spec.ts:65-104):
```typescript
async function forceJudgeScore(page: Page, opts: { recommendation: 'keep_new' | 'revert'; ... }) {
  const res = await page.request.post('/api/dev/force-judge-score', {
    data: opts,
    headers: { 'content-type': 'application/json' },
  });
  if (!res.ok()) throw new Error(`force-judge-score POST failed: status=${res.status()} body=${await res.text()}`);
}
```
**Apply to Phase 37:** Add DEV-only seed endpoints (double-guarded against prod per RESEARCH § Wave 0 Gaps + Phase 35 `forceOutageMode` precedent):
- `POST /api/dev/seed-run-tree` — accepts a tree shape, writes run + steps directly
- `POST /api/dev/reset-run-tree` — clears all `autonomy_run_steps` and `autonomy_runs` for the test project

**WelcomeModal-dismiss pattern** (agent-action-probe.spec.ts:65-80):
```typescript
await page.addInitScript(() => {
  const orig = Storage.prototype.getItem;
  Storage.prototype.getItem = function (key) {
    if (typeof key === 'string' && key.startsWith('hasCompletedOnboarding:')) return 'true';
    return orig.call(this, key);
  };
});
// Belt-and-suspenders dismiss
await page.locator('button[aria-label*="Close" i]').first().click({ timeout: 1500 }).catch(() => {});
```

**Project-id fetcher** (phase-36-rubric-iteration.spec.ts:107-115):
```typescript
async function getProjectId(page: Page): Promise<string> {
  const res = await page.request.get('/api/projects');
  if (!res.ok()) throw new Error(`/api/projects GET failed: ${res.status()}`);
  const projects = (await res.json()) as Array<{ id: string }>;
  if (!projects || projects.length === 0) throw new Error('no projects available; auth.setup.ts should have created one');
  return projects[0].id;
}
```

**6 cases required (CONTEXT D-23):**
1. `tree-render` — seed 3-step chain (task → handoff → task), assert indentation
2. `click-to-deliverable` — click step with deliverableId, assert panel opens to right version
3. `score-delta` — 3 variants: +1.5 green, -0.8 amber, null → "new"
4. `backfill` — seed 5 events, run backfill, assert 1 run + 5 steps with parent links
5. `empty-state` — fresh project shows "No autonomous runs yet" card
6. `toggle-persistence` — set Tree mode, reload, assert still Tree

---

### `playwright.config.ts` (config, declarative) — modify

**Analog:** `playwright.config.ts:82-96` (existing `phase-36` project entry)

**Pattern to mirror verbatim:**
```typescript
{
  name: 'phase-37',
  use: {
    ...devices['Desktop Chrome'],
    storageState: 'tests/e2e/.auth/session.json',
  },
  dependencies: ['setup'],
  testMatch: /phase-37-run-tree\.spec\.ts/,
  timeout: 120000,
},
```
Insert directly after `phase-36` block.

---

## Shared Patterns

### 1. Ownership check + 404 (not 403) on mismatch

**Source:** `server/routes/autonomy.ts:55-69` + `server/routes/deliverables.ts:38-44`

**Apply to:** All new server routes touching project-scoped data (GET `/api/projects/:id/runs`).

```typescript
const getSessionUserId = (req: Request): string | undefined => (req.session as any)?.userId as string | undefined;
const requireOwnedProject = async (projectId: string, userId: string) => {
  const project = await storage.getProject(projectId);
  if (!project) return null;
  return (project as any).userId === userId ? project : null;
};

// Handler:
const userId = getSessionUserId(req);
if (!userId) return res.status(401).json({ error: 'Unauthorized' });
const project = await requireOwnedProject(req.params.projectId, userId);
if (!project) return res.status(404).json({ error: 'Project not found' });  // 404 NOT 403
```

**Why 404:** T-36-14 lesson — leaking existence via 403 is an information-disclosure side-channel.

---

### 2. Non-fatal writes for audit/observability paths

**Source:** `server/autonomy/events/eventLogger.ts:273-279` (DB-or-file fallback)

**Apply to:** `runTreeWriter.ts` — all four methods (`createRun`, `startStep`, `completeStep`, `failStep`). Writer failures MUST NOT propagate into the autonomy pipeline. Log-and-continue.

**Anti-pattern (RESEARCH § Anti-Patterns):** "Synchronous step write inside the LLM call path — wrap in try/catch and treat writer failures as non-fatal (mirrors how `logAutonomyEvent` failures fall back to JSONL)."

---

### 3. Prod-guard on DEV-only endpoints

**Source:** `server/llm/providerHealthState.ts:108-117, 160-175, 186-205, 220-232`

**Apply to:** Any new DEV-only seed endpoints used by `phase-37-run-tree.spec.ts` (`/api/dev/seed-run-tree`, `/api/dev/reset-run-tree`) AND any `__resetForTests` exported by runTreeWriter.

```typescript
if (process.env.NODE_ENV === 'production') {
  throw new Error(
    'FATAL: seedRunTree() called in production. This is a DEV-only injection mechanism and must not be reachable from a production code path.',
  );
}
```

**Pattern is established across Phases 35 + 36.** Phase 37 inherits.

---

### 4. TanStack Query + WS-event invalidation (no useEffect+fetch)

**Source:** `client/src/hooks/useAutonomyFeed.ts:241-251` + `client/src/components/sidebar/ActivityTab.tsx:44-50`

**Apply to:** `useAutonomyRunTree.ts` AND any new client query.

```typescript
const { data } = useQuery({
  queryKey: ['/api/projects', projectId, 'runs'],
  enabled: !!projectId,
  staleTime: 30_000,
  refetchInterval: 30_000,
});

useSidebarEvent(AUTONOMY_EVENTS.TASK_COMPLETED, () => {
  queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'runs'] });
});
```

**CLAUDE.md § 9 enforcement:** Per project rule "Use for ALL server data" — never `useEffect + fetch`.

---

### 5. Test-only state reset + injected fixtures

**Source:** `scripts/test-rubric-scorer.ts:22-29` (test-only imports)

**Apply to:** `scripts/test-run-tree-writer.ts` + `scripts/test-run-tree-backfill.ts`.

```typescript
import {
  createRun,
  startStep,
  completeStep,
  failStep,
  __resetForTests,
} from '../server/autonomy/runs/runTreeWriter.js';
```

**Pattern:** Each `case_*()` function calls `__resetForTests()` at the top for isolation. Mirrors Phase 36 cadence.

---

### 6. PARENT-self-ref WITHOUT `.references()`

**Source:** `shared/schema.ts:137, 202, 306` (three existing examples)

**Apply to:** `autonomyRunSteps.parentStepId`.

```typescript
parentStepId: varchar("parent_step_id"),  // self-ref nullable — Drizzle DSL forbids .references() on self-circular columns
```

**Integrity:** Enforced at write time inside `startStep()` — writer asserts that the parent step (if non-null) belongs to the same `runId`. Same convention as `messages.parentMessageId` integrity being enforced at message-creation time.

---

### 7. Visual checkpoint protocol (BLOCKING)

**Source:** MEMORY `feedback_ui_change_protocol.md`

**Apply to:** Plan 37-03 (`RunTreeView`, `RunTreeNode`, `ActivityViewModeToggle`).

These are new user-facing surfaces in the Activity tab. Plan 37-03 MUST capture Playwright screenshots and obtain explicit user approval BEFORE committing UI changes. Pattern was applied in Phase 36 for `RubricBreakdown` and `AutoRevertBanner` — same gate here.

---

## No Analog Found

**None.** Every file in Phase 37 has at least a role-match analog in the codebase. The strongest greenfield component is the recursive `RunTreeNode` rendering — but its chrome (avatar + name + label) is a direct extract from `ActivityFeedItem`, and the recursion pattern is plain React (no library needed per RESEARCH Q1).

---

## Metadata

**Analog search scope:**
- `shared/schema.ts` (full file scanned for self-ref + JSONB + insert-schema patterns)
- `server/autonomy/**` (events + execution + handoff modules)
- `server/routes/**` (autonomy + deliverables)
- `server/storage.ts` (IStorage interface lines 96-274)
- `server/llm/providerHealthState.ts` (DEV-only + module state pattern)
- `server/ai/deliverableFeedbackAggregator.ts` (Phase 36 in-process cache reference)
- `client/src/components/sidebar/**` (ActivityTab, ActivityFeedItem)
- `client/src/hooks/useAutonomyFeed.ts`
- `client/src/components/ArtifactPanel.tsx`
- `client/src/pages/home.tsx` (open_deliverable handler)
- `scripts/test-rubric-scorer.ts` (test script shape)
- `tests/e2e/phase-36-rubric-iteration.spec.ts` (DEV-endpoint seed pattern)
- `tests/e2e/agent-action-probe.spec.ts` (auth + WelcomeModal dismiss)
- `playwright.config.ts`

**Files scanned:** 14 (each read targeted ranges, no full-file re-reads).
**Pattern extraction date:** 2026-05-13
**Status:** Complete — every Phase 37 file has been mapped to a concrete analog with line citations and copy-ready excerpts.

## PATTERN MAPPING COMPLETE

**Phase:** 37 — Git-Style Run Tree
**Files classified:** 23
**Analogs found:** 23 / 23

### Coverage
- Files with exact analog: 21
- Files with role-match analog: 2 (`shared/scoreFormat.ts`, `client/src/components/sidebar/ActivityViewModeToggle.tsx`)
- Files with no analog: 0

### Key Patterns Identified
- Drizzle parent-self-ref without `.references()` (3 in-repo examples — messages, tasks, deliverables) — direct mirror for `autonomyRunSteps.parentStepId`
- pg-boss payload extension for cross-process trace propagation (single existing pattern at `jobQueue.ts:37-55`; `AsyncLocalStorage` does NOT survive the boundary)
- 3-hook instrumentation contract on `executeTask` line 317 AND `executeTaskWithOutput` line 185 (RESEARCH calls out that BATCHED path is easy to miss)
- Non-fatal audit-write pattern (`logAutonomyEvent` DB-or-file fallback at `eventLogger.ts:273-279`) — applies to all `runTreeWriter` methods
- Ownership check returning 404 (NOT 403) on mismatch — established T-36-14 lesson, consistent across `autonomy.ts` and `deliverables.ts`
- TanStack Query 30s polling + `useSidebarEvent` invalidation — direct mirror from `useAutonomyFeed.ts`
- DEV-only endpoint prod-guard pattern from `providerHealthState.ts` — applies to new seed/reset endpoints AND `__resetForTests`
- Playwright spec scaffold: DEV-endpoint seed + WelcomeModal `addInitScript` dismiss — two complementary analogs (phase-36 + agent-probe)

### File Created
`/Users/shashankrai/Documents/hatching-mvp-5th-march/.planning/phases/37-git-style-run-tree/37-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. Planner can now reference analog patterns in PLAN.md files. Every action in 37-01 / 37-02 / 37-03 / 37-04 has a concrete file:line citation and code excerpt to copy from.
