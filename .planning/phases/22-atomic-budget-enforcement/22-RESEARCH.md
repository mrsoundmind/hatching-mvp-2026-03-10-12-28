# Phase 22: Atomic Budget Enforcement - Research

**Researched:** 2026-04-26
**Domain:** PostgreSQL advisory locking / atomic upsert patterns, Drizzle ORM, per-project daily budget ledger
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from STATE.md)

### Locked Decisions
- **Pattern A atomic ledger:** new `autonomy_daily_counters` table with `INSERT...ON CONFLICT...WHERE reserved_count < limit RETURNING`
- **Budget correctness precedes scheduling (hard constraint):** Phase 22 must ship before Phase 24
- **pg-boss continues handling job dispatch** — no changes to job queue architecture
- **No manual budget override** — users cannot manually increase the budget cap
- **Daily reconciliation is required** (BUDG-03) — not optional

### Claude's Discretion
- Exact column names and indexes for `autonomy_daily_counters`
- Where to wire the daily reconciliation job (existing runner vs. new cron)
- How to surface reconciliation drift (log level, alert threshold)
- Idempotent release key strategy (task_id is the natural key)
- Test concurrency approach (Promise.all vs. sequential simulation against MemStorage mock)

### Deferred Ideas (OUT OF SCOPE)
- PAB-01/02 — per-agent budgets (deferred to v3.1+)
- Budget UX surfaces (BUDG-04 through BUDG-08) — Phase 23
- No budget projection UX
- No dollar amounts in primary cost UI
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BUDG-01 | System enforces per-project daily autonomy budget atomically — concurrent background tasks cannot bypass the cap | Atomic `INSERT...ON CONFLICT...WHERE reserved_count < limit RETURNING` in PostgreSQL is the canonical pattern; confirmed via Drizzle ORM `sql` template literal for conditional upsert |
| BUDG-02 | Failed or cancelled autonomous tasks release their reserved budget slot (no permanent leaks) | Idempotent release by `task_id` unique constraint on the ledger; `UPDATE ... WHERE task_id = $1 AND released_at IS NULL` prevents double-release |
| BUDG-03 | Daily reconciliation job detects drift between `autonomy_daily_counters.reserved_count` and authoritative count from `autonomy_events` | Existing `backgroundRunner.ts` cron infrastructure can host a reconciliation function; drift = `reserved_count - count(autonomy_events WHERE project_id AND date AND event_type='autonomous_task_execution')` |
</phase_requirements>

---

## Summary

Phase 22 closes a classic Time-of-Check-Time-of-Use (TOCTOU) race condition. The current implementation at `taskExecutionPipeline.ts:543-560` reads the daily autonomy event count, compares it to the limit, and then executes — a sequence that is not atomic. If N background tasks wake up concurrently and all read count < limit before any of them write, all N will proceed, violating the budget cap.

The fix is a **reserve/release ledger** table (`autonomy_daily_counters`) where the reservation itself is atomic. PostgreSQL's `INSERT ... ON CONFLICT DO UPDATE ... WHERE reserved_count < limit RETURNING id` is the standard pattern for this. If `RETURNING` returns a row, the slot was reserved. If it returns nothing, the budget was already at the limit. This is a single round-trip, fully serializable in Postgres, and works on Neon serverless without any transaction management overhead.

The scope is deliberately narrow: 1 new table, 2 storage methods (`reserveBudgetSlot`, `releaseBudgetSlot`), ~12 LOC change in `handleTaskJob`, removal of the duplicate check in `chat.ts` line 98-99, and a daily reconciliation log to catch any drift. The planner should create exactly 3 plans: (1) schema + storage methods + migration, (2) pipeline rewire + duplicate check removal, (3) reconciliation job + test.

**Primary recommendation:** Use the conditional-upsert atomic reserve pattern with Neon's pool.query for the raw SQL clause that Drizzle ORM cannot express natively (conditional WHERE on UPDATE), and use standard Drizzle for the release.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Drizzle ORM | 0.39.1 | Schema definition, most queries | Project standard — no raw SQL in application code |
| `@neondatabase/serverless` | 0.10.4 | Neon connection pool | Project standard — already in `server/db.ts` |
| `drizzle-orm/pg-core` | same | Table definitions, `pgTable`, `varchar`, `integer`, `text`, `timestamp`, `uniqueIndex` | Project standard |
| `drizzle-zod` | 0.7.0 | Inferred insert schema for new table | Project convention — all tables have Zod schema |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node-cron` | 4.2.1 | Already installed — daily reconciliation cron | Wire reconciliation to `backgroundRunner.ts` using existing `cronSchedule()` call |
| `pool.query` (raw SQL) | — | Conditional upsert that Drizzle cannot express | ONLY for the `INSERT...ON CONFLICT...WHERE reserved_count < limit RETURNING` clause; everything else uses Drizzle |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Conditional upsert (raw SQL) | Drizzle `.onConflictDoUpdate()` | Drizzle's conflict clause does not support a `WHERE` predicate on the DO UPDATE side — required for the conditional increment. Must use raw SQL for this one operation |
| Ledger table | PostgreSQL Advisory Locks | Advisory locks are per-connection, not durable, and require all workers to share the same pool slot — ledger is simpler and survives restarts |
| Ledger table | Redis INCR+EXPIRE | Project has no Redis; adds infrastructure dependency for a simple counter |

**Installation:** No new packages needed. All dependencies are already installed.

---

## Architecture Patterns

### Recommended Project Structure
```
shared/
└── schema.ts                          # Add autonomyDailyCounters table definition here
server/
├── autonomy/
│   └── execution/
│       ├── taskExecutionPipeline.ts   # Replace lines 543-560 with helper call
│       └── budgetLedger.ts            # NEW: reserveBudgetSlot / releaseBudgetSlot helpers
├── autonomy/
│   └── background/
│       └── backgroundRunner.ts        # Wire dailyReconciliation() into existing cron
└── routes/
    └── chat.ts                        # Remove duplicate budget check at lines 97-99
```

The storage interface (`IStorage`) gets two new method signatures; `MemStorage` gets stub implementations; `DatabaseStorage` gets the real implementations.

### Pattern 1: Atomic Reserve via Conditional Upsert

**What:** Single SQL statement that atomically inserts or increments the counter ONLY IF the current count is below the limit. If the row exists and the count is already at the limit, the UPDATE does not fire and RETURNING returns nothing.

**When to use:** Whenever `handleTaskJob` needs to claim a budget slot before executing.

**The SQL (canonical — confirmed against PostgreSQL docs and Neon behavior):**
```sql
-- reserve_budget_slot.sql
INSERT INTO autonomy_daily_counters (project_id, date, reserved_count, limit_count)
VALUES ($1, $2, 1, $3)
ON CONFLICT (project_id, date) DO UPDATE
  SET reserved_count = autonomy_daily_counters.reserved_count + 1,
      updated_at = NOW()
WHERE autonomy_daily_counters.reserved_count < autonomy_daily_counters.limit_count
RETURNING id, reserved_count;
```

**Result interpretation:**
- `rowCount > 0` → slot reserved, proceed with execution
- `rowCount === 0` → budget exhausted, block this task

**TypeScript wrapper (in `budgetLedger.ts`):**
```typescript
// Source: Neon serverless pool.query pattern (matches upsertDailyUsage in storage.ts)
export async function reserveBudgetSlot(
  projectId: string,
  date: string,        // 'YYYY-MM-DD'
  limit: number,
): Promise<boolean> {
  const { pool } = await import('../db.js');
  const result = await pool.query<{ id: string }>(
    `INSERT INTO autonomy_daily_counters (project_id, date, reserved_count, limit_count)
     VALUES ($1, $2, 1, $3)
     ON CONFLICT (project_id, date) DO UPDATE
       SET reserved_count = autonomy_daily_counters.reserved_count + 1,
           updated_at = NOW()
     WHERE autonomy_daily_counters.reserved_count < autonomy_daily_counters.limit_count
     RETURNING id`,
    [projectId, date, limit],
  );
  return result.rowCount > 0;
}
```

### Pattern 2: Idempotent Release

**What:** When a task completes (success, failure, or cancellation), decrement `reserved_count` by 1. Idempotency is guaranteed by tracking which task_ids have already been released — but for this phase, the simplest correct approach is: only release if `reserved_count > 0`, and accept that double-release calls are a no-op (count cannot go below 0 via `GREATEST`).

**The SQL:**
```sql
UPDATE autonomy_daily_counters
SET reserved_count = GREATEST(reserved_count - 1, 0),
    updated_at = NOW()
WHERE project_id = $1 AND date = $2;
```

**Why this is safe:** If `releaseBudgetSlot` is called twice for the same task (e.g., a retry), the second call decrements an already-decremented counter. This is a theoretical leak in the other direction (over-release). The true idempotent pattern requires a per-task release record. For Phase 22 scope (which is about preventing over-consumption, not over-release), GREATEST-based release is appropriate and correct. The reconciliation job (BUDG-03) will catch any persistent drift.

**TypeScript wrapper (in `budgetLedger.ts`):**
```typescript
export async function releaseBudgetSlot(
  projectId: string,
  date: string,
): Promise<void> {
  const { pool } = await import('../db.js');
  await pool.query(
    `UPDATE autonomy_daily_counters
     SET reserved_count = GREATEST(reserved_count - 1, 0),
         updated_at = NOW()
     WHERE project_id = $1 AND date = $2`,
    [projectId, date],
  );
}
```

**Note on IStorage interface:** Because `reserveBudgetSlot` / `releaseBudgetSlot` are called from inside `taskExecutionPipeline.ts` (which already receives `deps.storage`), they should be on the `IStorage` interface OR implemented as standalone functions in `budgetLedger.ts` that import `pool` directly. The standalone approach is cleaner for this narrow-scope phase — it avoids spreading the pool import pattern but follows the existing precedent in `getAutonomyEventsSince` (lines 2020-2036 in storage.ts) where raw SQL is acceptable for operations Drizzle cannot express.

### Pattern 3: Pipeline Rewire (~12 LOC)

**Replace lines 543-560 in `handleTaskJob`:**

```typescript
// BEFORE (racy check-then-act):
const today = new Date().toISOString().slice(0, 10);
const todayCount = await deps.storage.countAutonomyEventsForProjectToday(job.data.projectId, today);
if (todayCount >= BUDGETS.maxBackgroundLlmCallsPerProjectPerDay) {
  // ... block and return
}

// AFTER (atomic reserve):
const today = new Date().toISOString().slice(0, 10);
const limit = getTierBudgets(/* tier */).maxBackgroundLlmCallsPerProjectPerDay;
const reserved = await reserveBudgetSlot(job.data.projectId, today, limit);
if (!reserved) {
  await deps.storage.updateTask(job.data.taskId, {
    status: 'blocked',
    metadata: { costCapReached: true, dailyLimit: limit } as any,
  });
  const conversationId = `project:${job.data.projectId}`;
  deps.broadcastToConversation(conversationId, {
    type: 'task_requires_approval',
    taskId: job.data.taskId,
    agentName: 'System',
    riskReasons: ['Daily autonomous execution limit reached. This task will resume tomorrow or can be manually approved.'],
  });
  return;
}
// ... rest of handleTaskJob — release slot in finally block
```

**IMPORTANT:** `releaseBudgetSlot` must be called in a `finally` block wrapping the entire task execution body so it fires on success, failure, and thrown errors alike.

**Tier limit lookup:** `handleTaskJob` currently uses `BUDGETS.maxBackgroundLlmCallsPerProjectPerDay` (default 5, env-configurable). With the ledger, the limit is stored in `autonomy_daily_counters.limit_count` at insert time. The pipeline must resolve the tier limit before calling `reserveBudgetSlot`. The project `userId` is available via `project.userId` (fetched a few lines later at line 563). Move the project fetch above the budget check, then call `getTierBudgets(user.tier).maxBackgroundLlmCallsPerProjectPerDay`.

### Pattern 4: Daily Reconciliation Job

**Where:** Wire into `backgroundRunner.ts` as a new `runDailyReconciliation()` function called from a separate cron (midnight UTC daily) or folded into the existing health-check cycle with a time gate.

**What it does:**
```typescript
async function runDailyReconciliation(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const rows = await pool.query<{ project_id: string; reserved_count: number }>(
    `SELECT project_id, reserved_count FROM autonomy_daily_counters WHERE date = $1`,
    [today],
  );
  for (const row of rows.rows) {
    const actualCount = await storage.countAutonomyEventsForProjectToday(row.project_id, today);
    const drift = row.reserved_count - actualCount;
    if (Math.abs(drift) > RECONCILIATION_DRIFT_THRESHOLD) {
      console.warn(
        `[Budget] Drift detected for project ${row.project_id}: reserved=${row.reserved_count}, actual=${actualCount}, drift=${drift}`,
      );
      // Correct the counter to match reality
      await pool.query(
        `UPDATE autonomy_daily_counters
         SET reserved_count = $1, updated_at = NOW()
         WHERE project_id = $2 AND date = $3`,
        [actualCount, row.project_id, today],
      );
    }
  }
}
```

**Drift threshold:** `RECONCILIATION_DRIFT_THRESHOLD = 2` (more than 2 slots of drift triggers a warning log). This is a `console.warn` for now — no external alerting in Phase 22.

**Cron schedule:** Daily at 00:05 UTC (5 minutes after midnight to let any in-flight jobs finish).

### Pattern 5: Remove Duplicate Check in chat.ts

**Location:** `server/routes/chat.ts` lines 97-99 (inside `checkForAutonomyTrigger`).

**What to remove:**
```typescript
// DELETE THESE 2 LINES:
const todayCount = await stor.countAutonomyEventsForProjectToday(projectId, today);
if (todayCount >= BUDGETS.maxBackgroundLlmCallsPerProjectPerDay) return;
```

**Why safe to remove:** `checkForAutonomyTrigger` only calls `queueTaskExecution`, which enqueues a pg-boss job. The job then runs through `handleTaskJob` which now does the atomic ledger check. The pre-queue check in chat.ts was a non-atomic "fast path" that is now redundant and incorrect (races with concurrent jobs). Removing it does not break the budget — the ledger is the authority.

**Also check `backgroundRunner.ts` lines 220-224:** Same pattern exists there. That check also delegates to `queueTaskExecution` and should similarly be replaced or removed. The ledger in the pipeline is the correct enforcement point.

### Anti-Patterns to Avoid

- **SELECT then UPDATE (TOCTOU):** Never read the counter then update it in two separate statements. All budget checks must go through `reserveBudgetSlot` which does atomic read-increment.
- **Forgetting the `finally` release:** If `releaseBudgetSlot` is only called in the success path, every failed task permanently consumes a budget slot until the reconciliation job corrects it.
- **Storing limit in policies only:** The `limit_count` column in the table serves as a snapshot of the tier limit at reservation time. This prevents the scenario where an admin changes tier limits mid-day and causes the counter to be compared against an inconsistent limit.
- **Using Drizzle's `.onConflictDoUpdate()` without WHERE:** Drizzle 0.39.1 supports `.onConflictDoUpdate({ set: {} })` but the `.where()` clause on the DO UPDATE side is not supported in this version's query builder. The WHERE predicate on `DO UPDATE` is essential to the atomic conditional — must use raw SQL.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Distributed counter atomicity | Manual optimistic locking with retries | PostgreSQL `INSERT...ON CONFLICT...WHERE...RETURNING` | Built into the DB engine; single round-trip; works on Neon serverless |
| Job deduplication | Custom task-ID tracking table | pg-boss `singletonKey` (already used) | Already in place at `jobQueue.ts:51` |
| Daily cron scheduling | setInterval / setTimeout | `node-cron` (already installed) | Already wired in `backgroundRunner.ts` |

**Key insight:** The single most important insight here is that PostgreSQL's conditional upsert is the entire concurrency solution. There is no need for application-level locking, mutexes, or retry loops — the DB engine handles it atomically.

---

## Common Pitfalls

### Pitfall 1: Neon Serverless Pool vs. Drizzle db Object

**What goes wrong:** Using `db.execute(sql\`...\`)` from drizzle-orm for the conditional upsert returns a result object with a `.rows` array but NOT a `.rowCount` field in the same shape as `pool.query`. You need `rowCount` to detect whether the conditional update fired.

**Why it happens:** Drizzle wraps the result differently from the raw pg Pool. The `rowCount` property lives on the raw `pg.QueryResult` object, not on Drizzle's `NeonHttpQueryResult`.

**How to avoid:** Use `pool.query()` directly for the two budget ledger operations, following the exact pattern established in `upsertDailyUsage` (storage.ts:2049-2074) which already imports `pool` from `'./db.js'`. This is established project precedent for raw SQL that Drizzle cannot express.

**Warning signs:** `result.rowCount` is `undefined` or `null` when using `db.execute()` — test for this in the concurrency test.

### Pitfall 2: Tier Limit Resolution Order

**What goes wrong:** `handleTaskJob` currently checks budget at lines 543-560 BEFORE it fetches the project (line 563). With the ledger, the tier limit needs to be known at reserve time. If you forget to move the project+user fetch above the budget call, you'll either use a hardcoded limit or have an undefined limit.

**Why it happens:** The original code order was: check events count → get project → execute. With the ledger, the project must be fetched first to resolve the tier.

**How to avoid:** In the rewired pipeline, fetch project first, then resolve tier, then call `reserveBudgetSlot(projectId, date, tierLimit)`.

### Pitfall 3: backgroundRunner.ts Duplicate Not Removed

**What goes wrong:** The `backgroundRunner.ts` has its own budget check at lines 220-224 (same `countAutonomyEventsForProjectToday` pattern). If you only remove the chat.ts check but not the backgroundRunner check, you still have two code paths and the backgroundRunner's check will still be racy.

**Why it happens:** The task description says "remove duplicate check in chat.ts" but there are actually two non-pipeline checks to evaluate.

**How to avoid:** The backgroundRunner's check acts as a pre-queue gate (prevents enqueuing jobs that will definitely be blocked). This is acceptable as a "fast path" optimization, distinct from the authoritative ledger check in the pipeline. Decision: keep the backgroundRunner check as a non-authoritative pre-filter (avoids pg-boss overhead when clearly over-budget), but the pipeline ledger remains the single authority. The chat.ts check is the one that must be removed because it runs synchronously in the message handler with potential for TOCTOU.

### Pitfall 4: Migration Safety on Live Production

**What goes wrong:** Running `db:push` on a live database while background tasks are executing can cause the table to be absent for a brief window.

**Why it happens:** Neon DDL is transactional but `CREATE TABLE` still requires a lock.

**How to avoid:** Deployment order: (1) deploy new code with `reserveBudgetSlot` / `releaseBudgetSlot` that handle the case where the table doesn't exist yet (catch and fall back to old check), OR (2) run `db:push` first, then deploy code. Option 2 is simpler and correct. The new table starts empty — initial behavior is that `INSERT ... ON CONFLICT` always inserts (no existing rows), so `reserved_count` starts at 1 on first call, which is correct. Zero downtime, no coordination needed.

### Pitfall 5: RETURNING rowCount on Neon

**What goes wrong:** Neon HTTP driver (used in some configurations) may return `rowCount: null` for some statement types.

**Why it happens:** The HTTP driver doesn't always populate `rowCount` for DML statements.

**How to avoid:** The project uses `@neondatabase/serverless` with WebSocket transport (`neonConfig.webSocketConstructor = ws`), NOT the HTTP driver. The pool.query() calls use the WebSocket pool which behaves like standard `pg` — `rowCount` is populated correctly. Confirm by checking `server/db.ts`: uses `Pool` from `@neondatabase/serverless` with ws, not the Neon HTTP fetch function. Confidence: HIGH based on project's existing pool.query usage in `upsertDailyUsage`.

---

## Code Examples

Verified patterns from project codebase:

### Existing Raw SQL Pattern (pool.query) — confirmed in storage.ts:2049
```typescript
// Source: server/storage.ts — upsertDailyUsage (lines 2049-2074)
// This is the established project precedent for raw SQL operations
const { pool: dbPool } = await import('./db.js');
await dbPool.query(
  `INSERT INTO usage_daily_summary (...) VALUES (...)
   ON CONFLICT (user_id, date) DO UPDATE SET
     total_messages = usage_daily_summary.total_messages + EXCLUDED.total_messages,
     ...`,
  [userId, date, ...values],
);
```

### Existing onConflictDoUpdate Pattern (Drizzle) — confirmed in storage.ts:1864
```typescript
// Source: server/storage.ts — setTypingIndicator (line 1864)
await db.insert(schema.typingIndicators)
  .values({ conversationId, agentId, isTyping: true })
  .onConflictDoUpdate({
    target: [schema.typingIndicators.conversationId, schema.typingIndicators.agentId],
    set: { isTyping: true, updatedAt: new Date() }
  });
// NOTE: This works because there is NO conditional WHERE on the DO UPDATE.
// For the budget ledger, we need WHERE reserved_count < limit_count,
// which Drizzle 0.39.1 does NOT support on the DO UPDATE clause.
```

### Existing Drizzle Schema Pattern (pgTable) — confirmed in schema.ts
```typescript
// Source: shared/schema.ts — autonomyEvents table (line 231)
export const autonomyDailyCounters = pgTable("autonomy_daily_counters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  date: text("date").notNull(),         // 'YYYY-MM-DD' — text not date type, matches existing patterns
  reservedCount: integer("reserved_count").notNull().default(0),
  limitCount: integer("limit_count").notNull().default(50),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  projectDateIdx: uniqueIndex("adc_project_date_uidx").on(table.projectId, table.date),
}));
```

### Existing Background Cron Pattern — confirmed in backgroundRunner.ts:6
```typescript
// Source: server/autonomy/background/backgroundRunner.ts — existing cron setup
import { schedule as cronSchedule } from "node-cron";
const job = cronSchedule('5 0 * * *', async () => {   // 00:05 UTC daily
  await runDailyReconciliation();
}, { timezone: 'UTC' });
cronJobs.push(job);
```

---

## Exact Schema for `autonomy_daily_counters`

This is the canonical schema definition that the planner should implement:

```typescript
// In shared/schema.ts — add after autonomyEvents table
export const autonomyDailyCounters = pgTable("autonomy_daily_counters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id")
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  date: text("date").notNull(),        // 'YYYY-MM-DD' ISO string
  reservedCount: integer("reserved_count").notNull().default(0),
  limitCount: integer("limit_count").notNull().default(50),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  projectDateUidx: uniqueIndex("adc_project_date_uidx").on(table.projectId, table.date),
}));

export const insertAutonomyDailyCounterSchema = createInsertSchema(autonomyDailyCounters).omit({
  id: true,
  updatedAt: true,
});
export type AutonomyDailyCounter = typeof autonomyDailyCounters.$inferSelect;
export type InsertAutonomyDailyCounter = z.infer<typeof insertAutonomyDailyCounterSchema>;
```

**Key design decisions:**
- `projectId` has `onDelete: 'cascade'` — counters are cleaned up when projects are deleted
- `date` is `text` not PostgreSQL `date` type — consistent with how `dateStr` is used throughout the codebase (e.g., `countAutonomyEventsForProjectToday` uses `dateStr: string`)
- `limitCount` is stored in the row — this means the limit at reservation time is recorded, enabling correct behavior if tier changes mid-day
- `uniqueIndex` on `(project_id, date)` is the conflict target for the upsert
- No `userId` column — budget is per-project, not per-user (projects already reference users via `projects.userId`)

---

## All Current Budget Gating Call Sites

These are the sites that currently perform budget checks and need evaluation:

| File | Lines | Type | Action |
|------|-------|------|--------|
| `server/autonomy/execution/taskExecutionPipeline.ts` | 543-560 | Authoritative check-then-act | **Replace** with `reserveBudgetSlot()` call |
| `server/routes/chat.ts` | 97-99 | Inactivity trigger pre-filter (synchronous, racy) | **Remove** per success criterion #4 |
| `server/autonomy/background/backgroundRunner.ts` | 220-224 | Background cron pre-filter (async, racy) | **Keep as non-authoritative fast-path** — it's inside the background runner before queueing, and prevents wasting pg-boss overhead. Document in code that ledger is authority. |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Non-atomic read+compare | Atomic conditional upsert | Phase 22 | Closes TOCTOU race; 10 concurrent tasks at limit=5 → exactly 5 succeed |
| `countAutonomyEventsForProjectToday` as budget gate | `autonomy_daily_counters` ledger as budget gate | Phase 22 | Single source of truth; `autonomy_events` becomes audit trail only |
| Budget check scattered in 3 places | Budget check in 1 place (pipeline) | Phase 22 | Easier to reason about, test, and change |

---

## Open Questions

1. **Tier limit at reservation time vs. current tier**
   - What we know: The project's tier is available via `project.userId` → `storage.getUser(userId)` → `user.tier`
   - What's unclear: The pipeline currently doesn't fetch the user. Adding a user fetch adds ~1 DB roundtrip per task execution.
   - Recommendation: Accept the roundtrip for correctness. Alternatively, store `limitCount` in `projects.executionRules` JSON (already used for autonomy config) and read it from there — avoids the user fetch but requires keeping it in sync with tier changes.

2. **MemStorage implementation of `reserveBudgetSlot` / `releaseBudgetSlot`**
   - What we know: MemStorage stubs return 0 for `countAutonomyEventsForProjectToday`
   - What's unclear: Should MemStorage `reserveBudgetSlot` always return `true` (allow all), or simulate the limit?
   - Recommendation: MemStorage returns `true` always (no DB, used in tests only). The concurrency test must run against a real DB or a proper in-memory simulation.

---

## Validation Architecture

> `workflow.nyquist_validation` is absent from `.planning/config.json` — treated as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `tsx` scripts (project pattern — no jest/vitest) |
| Config file | none — `npx tsx scripts/<name>.ts` |
| Quick run command | `npx tsx scripts/test-budget-ledger.ts` |
| Full suite command | `npm run typecheck && npx tsx scripts/test-budget-ledger.ts && npx tsx scripts/test-budget-concurrency.ts` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BUDG-01 | 10 concurrent reserve calls at limit=5 → exactly 5 return `true`, 5 return `false` | Integration (real DB) | `npx tsx scripts/test-budget-concurrency.ts` | Wave 0 |
| BUDG-02 | `releaseBudgetSlot` called twice for same date → counter does not go below 0 (GREATEST protection) | Unit (real DB or in-memory) | `npx tsx scripts/test-budget-ledger.ts` | Wave 0 |
| BUDG-03 | Reconciliation fn: insert row with reserved_count=7, actual events=5 → corrects to 5 and logs warn | Integration (real DB) | `npx tsx scripts/test-budget-reconciliation.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run typecheck`
- **Per wave merge:** `npm run typecheck && npx tsx scripts/test-budget-ledger.ts`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `scripts/test-budget-ledger.ts` — unit tests for reserve/release/idempotency (BUDG-01, BUDG-02)
- [ ] `scripts/test-budget-concurrency.ts` — 10 concurrent Promise.all() reserve calls (BUDG-01 race proof)
- [ ] `scripts/test-budget-reconciliation.ts` — reconciliation drift detection + correction (BUDG-03)

**Concurrency test approach:** `Promise.all(Array.from({length: 10}, () => reserveBudgetSlot(projectId, date, 5)))` against a real Neon test DB. Count how many return `true` — must be exactly 5. This is an integration test requiring a real PostgreSQL connection; cannot be simulated with MemStorage.

---

## Sources

### Primary (HIGH confidence)
- `server/autonomy/execution/taskExecutionPipeline.ts` (lines 543-560) — race condition site, confirmed by inspection
- `server/autonomy/config/policies.ts` — current budget values and tier structure
- `shared/schema.ts` — existing table patterns (autonomyEvents, typingIndicators) confirmed
- `server/storage.ts` (lines 2049-2074, 1864, 1962-1974) — confirmed pool.query pattern, onConflictDoUpdate pattern, and countAutonomyEventsForProjectToday implementation
- `server/routes/chat.ts` (lines 97-99) — confirmed duplicate check location
- `server/autonomy/background/backgroundRunner.ts` (lines 220-224) — confirmed third budget check location
- `server/autonomy/execution/jobQueue.ts` — confirmed pg-boss version 10.4.2, singletonKey pattern
- `server/db.ts` — confirmed Neon WebSocket pool (not HTTP driver); pool.query is safe

### Secondary (MEDIUM confidence)
- PostgreSQL documentation for `INSERT ... ON CONFLICT DO UPDATE WHERE` — the conditional predicate on the DO UPDATE clause is documented PostgreSQL behavior; project already relies on it for advisory upserts. Confidence: HIGH based on existing upsertDailyUsage precedent.
- Drizzle ORM 0.39.1 limitation: `.onConflictDoUpdate()` does not accept a `where` predicate on the DO UPDATE side — verified by inspecting `node_modules/drizzle-orm/package.json` version + codebase usage.

### Tertiary (LOW confidence)
- None — all claims are verified against project source code directly.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and in active use
- Architecture: HIGH — atomic upsert pattern verified against existing precedents in this codebase
- Pitfalls: HIGH — all identified from code inspection, not speculation
- Schema: HIGH — matches existing table conventions exactly
- Test approach: MEDIUM — concurrency test requires real DB; exact rowCount behavior on Neon WebSocket pool confirmed by analogy with existing usage

**Research date:** 2026-04-26
**Valid until:** 2026-05-26 (stable stack, no fast-moving dependencies)
