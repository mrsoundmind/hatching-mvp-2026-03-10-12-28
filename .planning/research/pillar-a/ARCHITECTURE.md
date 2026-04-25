# Architecture Research — v3.0 Reliable Autonomy

**Project:** Hatchin v3.0 (atomic budget enforcement + scheduled routines)
**Researched:** 2026-04-13
**Confidence:** HIGH (direct source code inspection)

---

## 1. Budget Race Condition — Pinpointed

### Where it lives

`server/autonomy/execution/taskExecutionPipeline.ts` lines **543–560**, inside `handleTaskJob`:

```ts
const todayCount = await deps.storage.countAutonomyEventsForProjectToday(job.data.projectId, today);
if (todayCount >= BUDGETS.maxBackgroundLlmCallsPerProjectPerDay) { ... block ... }
// ... later, LLM runs, THEN logAutonomyEvent fires at line ~478 / ~291 / ~430
```

A second, independent check lives in `server/routes/chat.ts:98-99` (used by the inactivity auto-trigger). Same pattern.

### The race

Check-then-act decomposed across **three separate DB round-trips** with no lock:

1. `countAutonomyEventsForProjectToday` — read
2. `generateText` (LLM call; 2–45s wall time)
3. `logAutonomyEvent` — write (and `recordUsage` fire-and-forget at line 638)

`maxBackgroundLlmCallsPerProjectPerDay = 5` (Free-tier: 0, Pro: 50). `maxConcurrentAutonomousTasks = 3`. pg-boss `work()` runs N jobs concurrently per worker and can span workers. A Pro project with 49 events recorded can have **3 concurrent jobs** each read `todayCount=49`, each pass the gate, each consume tokens → 52 executions, 4% overrun. Worse at higher concurrency or multi-node.

`usageTracker.recordUsage` exhibits the same pattern — in-memory `dailyMessageCache` (line 25) is non-atomic increment-then-upsert. Fire-and-forget DB write. Not authoritative.

### Minimum-change fix — "reservation + reconcile"

**Pattern A (atomic conditional UPDATE) — RECOMMENDED.** Smaller blast radius, no reservation-row-per-task table.

Add `storage.reserveAutonomySlot(projectId, date, limit): Promise<{ok: boolean, count: number}>`:

```sql
-- Runs inside a single short transaction
INSERT INTO autonomy_daily_counters (project_id, date, reserved_count)
VALUES ($projectId, $date, 1)
ON CONFLICT (project_id, date)
DO UPDATE SET reserved_count = autonomy_daily_counters.reserved_count + 1
  WHERE autonomy_daily_counters.reserved_count < $limit
RETURNING reserved_count;
```

If `RETURNING` yields no row → reservation refused. If execution fails/cancels → `releaseAutonomySlot` decrements (idempotent by task ID). Reconciled once per day against `autonomy_events` count as truth.

**Schema addition:**

```ts
export const autonomyDailyCounters = pgTable("autonomy_daily_counters", {
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: 'cascade' }),
  date: varchar("date", { length: 10 }).notNull(),
  reservedCount: integer("reserved_count").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.projectId, t.date] }),
}));
```

**Change in `taskExecutionPipeline.handleTaskJob`** (replace lines 543–560):

```ts
const reservation = await deps.storage.reserveAutonomySlot(
  job.data.projectId, today, BUDGETS.maxBackgroundLlmCallsPerProjectPerDay
);
if (!reservation.ok) { /* block + notify (existing code) */ return; }
try {
  // existing execution body
} catch (err) {
  await deps.storage.releaseAutonomySlot(job.data.projectId, today, job.data.taskId);
  throw err;
}
```

Also consolidate the duplicate check in `chat.ts:98-99` to call the same helper. Pipeline is the authority.

**Pattern B** (per-task `budget_reservations` row) is heavier; use only if per-task reservation audit is required — not needed for v3.0.

**Decision:** Pattern A. 1 new tiny table, 2 storage methods, ~12 LOC change.

---

## 2. Scheduled Routines — Schema

### Drizzle schema (add to `shared/schema.ts`)

```ts
export const scheduledRoutines = pgTable("scheduled_routines", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: 'cascade' }),
  conversationId: varchar("conversation_id").notNull(),

  userInstruction: text("user_instruction").notNull(),
  taskTemplate: text("task_template").notNull(),
  cronExpr: varchar("cron_expr", { length: 64 }).notNull(),
  timezone: varchar("timezone", { length: 64 }).notNull().default('UTC'),

  active: boolean("active").notNull().default(true),
  lastRunAt: timestamp("last_run_at"),
  lastRunStatus: varchar("last_run_status", { length: 20 }),
  lastRunTaskId: uuid("last_run_task_id").references(() => tasks.id, { onDelete: 'set null' }),
  nextRunAt: timestamp("next_run_at").notNull(),
  failureCount: integer("failure_count").notNull().default(0),
  pausedReason: text("paused_reason"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  projectIdx: index("scheduled_routines_project_idx").on(t.projectId),
  agentIdx: index("scheduled_routines_agent_idx").on(t.agentId),
  nextRunIdx: index("scheduled_routines_next_run_idx").on(t.active, t.nextRunAt),
}));
```

---

## 3. Reuse the Existing Pipeline — YES

Scheduled routines enqueue a `tasks` row and hand off to the existing pg-boss `autonomous_task_execution` queue. **No parallel execution path.**

```
pg-boss schedule(routineId, cronExpr, data, { tz })
  → fires at cron time, enqueues job
  → handler:
       1. storage.createTask({ title: template, assignee: agentId, projectId,
                               metadata: { scheduledRoutineId, triggerType: 'scheduled' } })
       2. boss.send('autonomous_task_execution', { taskId, projectId, agentId })
       3. UPDATE routine SET lastRunAt=now(), lastRunTaskId=<id>
```

Existing pipeline already handles budget reservation (after Phase 22 fix), safety gates, peer review, trust scoring, handoffs, event logging, WS broadcast, billing usage. **All unchanged.**

Only additions inside pipeline:

1. After task terminal state, if `task.metadata.scheduledRoutineId` present → `updateScheduledRoutine(id, { lastRunStatus, failureCount: status==='failed' ? +1 : 0 })`. ~5 LOC near line 289/475.
2. If `failureCount >= 3` → `active=false, pausedReason='3 consecutive failures'` + WS `routine_paused`.

**Why not parallel:** duplicates budget logic, safety gates, trust scoring, WS events, handoffs. 10× maintenance, zero capability gain.

**Use pg-boss's native `boss.schedule()`** (distributed-safe, single-fire, IANA tz). Poll the routines table on boot to re-register any schedules that drifted.

---

## 4. NL Schedule Detection — Extend `intentClassifier`

Add `SCHEDULE_REQUEST` variant to the existing `TaskIntent` union in `server/ai/tasks/intentClassifier.ts`. **Do not** create a new dedicated detector.

- `classifyTaskIntent` is the single zero-LLM gate in front of chat (called at `chat.ts` lines 873, 2663). 6th intent keeps the single source of truth.
- Must fire **before** `EXPLICIT_TASK_REQUEST` — "create a task to send the update every Monday" is ambiguous; schedule intent wins.

### Addition to union

```ts
| { type: 'SCHEDULE_REQUEST';
    taskTemplate: string;
    cronExpr: string;
    timezone: string;
    targetAgentId?: string;
    originalPhrase: string; }
```

### Parser module

Split parser into `server/ai/tasks/schedulePhraseParser.ts` — cadence → cron mapping (`every Monday` → `0 9 * * 1`, `daily at 9am` → `0 9 * * *`, `every weekday` → `0 9 * * 1-5`) + `chrono-node` for datetime fragments.

### Downstream in `chat.ts`

Mirror the `EXPLICIT_TASK_REQUEST` branch — when `SCHEDULE_REQUEST` fires, call `server/routes/routines.ts` handler that creates `scheduled_routines` row + registers `boss.schedule` + emits WS `routine_created`. Confirmation card in chat: "Got it — Kai will draft the growth update every Monday at 9am. Cancel anytime."

---

## 5. Integration Points Summary

| Area | New / Modified | File |
|---|---|---|
| `autonomy_daily_counters` table | NEW | `shared/schema.ts` |
| `scheduled_routines` table | NEW | `shared/schema.ts` |
| `reserveAutonomySlot` / `releaseAutonomySlot` | NEW | `server/storage.ts` |
| Scheduled-routine CRUD | NEW | `server/storage.ts` |
| Budget check in pipeline | MODIFIED (replace lines 543–560) | `server/autonomy/execution/taskExecutionPipeline.ts` |
| Budget check in inactivity trigger | MODIFIED (lines 98–99) | `server/routes/chat.ts` |
| Routine completion callback | MODIFIED (~5 LOC) | `server/autonomy/execution/taskExecutionPipeline.ts` |
| `SCHEDULE_REQUEST` intent | MODIFIED | `server/ai/tasks/intentClassifier.ts` |
| `schedulePhraseParser.ts` | NEW | `server/ai/tasks/schedulePhraseParser.ts` |
| Routine scheduler wrapper | NEW | `server/autonomy/scheduling/routineScheduler.ts` |
| Routines REST API | NEW | `server/routes/routines.ts` |
| Chat intent dispatch | MODIFIED (new branch at 873, 2663) | `server/routes/chat.ts` |
| UI: confirmation card, list, pause/delete | NEW | `client/src/components/routines/*` |
| WS events (`routine_created`, `routine_paused`, `routine_run_started`, `budget_blocked`) | NEW | `shared/dto/wsSchemas.ts` |

---

## 6. Build Order (feeds roadmapper)

**Phase 22 — Atomic Budget Enforcement** (~1–2 days)
- Migration: `autonomy_daily_counters`
- `reserveAutonomySlot` + `releaseAutonomySlot`
- Wire into pipeline; remove duplicate in `chat.ts`
- Daily reconciliation job against `autonomy_events`
- Test: 10 concurrent jobs at limit-1 → exactly one passes

**Phase 23 — Budget UX Surfaces** (~1 day)
- Extend UsageBar to show autonomy budget
- 80% soft warn, 100% hard-stop (in-character Maya)
- `budget_blocked` events in ActivityFeed
- Free-tier UpgradeModal wiring for autonomy

**Phase 24 — Scheduler Foundation** (~2–3 days)
- Migration: `scheduled_routines`
- `IStorage` CRUD
- `routineScheduler.ts` — `boss.schedule` / `boss.unschedule` wrappers; re-register on boot
- Pipeline hook: update status / failureCount
- Auto-pause on 3 failures; WS `routine_paused`
- REST: `POST /api/routines`, `GET /api/projects/:id/routines`, `PATCH` (pause/resume), `DELETE`

**Phase 25 — Chat-Native Intent + Confirmation** (~2 days)
- `schedulePhraseParser.ts`
- `SCHEDULE_REQUEST` variant + 30-phrasing test set
- `chat.ts` dispatch → createScheduledRoutine → confirmation card
- RoutineConfirmCard (reuses AutonomousApprovalCard pattern)
- WS `routine_run_started` in feed

**Phase 26 — Routines Management Panel + Past-Run History** (~2 days)
- Routines tab in right sidebar
- Routine cards: next-run / status / cost / "Run now" / pause / delete
- Past-run list (last 30, status + cost)
- Failed-run in Maya return briefing + tab badge

**Phase 27 — Polish + Integration Hardening** (~1–2 days)
- DST simulation tests
- Multi-replica schedule-once verification
- Red-team prompt-injection suite for NL descriptions
- Empty states, loading states
- CLAUDE.md v3.0 update

---

## 7. Confidence

| Area | Level | Reason |
|---|---|---|
| Budget race diagnosis | HIGH | Direct read of specific lines |
| Pattern A fix | HIGH | Neon/Postgres supports ON CONFLICT...WHERE RETURNING natively |
| `scheduled_routines` schema | HIGH | Modeled on existing conventions |
| "Reuse pipeline" decision | HIGH | Inactivity trigger already does this |
| Extend `intentClassifier` | HIGH | Existing dispatch sites confirm |
| Cron parsing complexity | MEDIUM | chrono-node edge cases (holidays, DST) nontrivial |

---

## 8. Open Questions

- **Timezone:** per-routine with project default fallback (recommended)
- **Schedule mutation UX:** chat-native via `SCHEDULE_UPDATE` variant — defer to v3.1
- **Tier gating:** scheduled routines Pro-only via existing `tierGate` middleware
- **Max routines per project:** recommend 10 (abuse prevention)
