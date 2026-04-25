# Technology Stack — v3.0 Reliable Autonomy

**Project:** Hatchin v3.0 (atomic budget enforcement + scheduled routines)
**Researched:** 2026-04-13
**Scope:** Incremental additions only. Existing stack (Express, Drizzle, Neon, pg-boss, Gemini/Groq, React/Wouter/TanStack) is validated and retained.

---

## Executive Recommendation

**No new heavy runtime dependencies required.** Both capabilities ship primarily on libraries already in `package.json`:

1. **Atomic budget enforcement** → `drizzle-orm@0.39.1`'s `db.transaction()` + `.for('update')` row lock on a new `autonomy_budget_ledger` row. No new library.
2. **Scheduled routines** → `pg-boss@10.4.2`'s native cron scheduler (`boss.schedule(name, cronExpr, data, { tz })`). No new scheduling library.
3. **Natural-language → cron parsing** → Add **`chrono-node@^2.9.0`** (NL date parser) + a small in-house recurrence adapter. Optionally add **`cronstrue@^2.50.0`** for human-readable display of the resulting cron in confirmation UI.

`node-cron@4.2.1` (currently in deps, unused) should be **removed**. pg-boss's cron is the durable, distributed-safe path; `node-cron` is in-process only and would double-fire on multi-node deploys.

---

## New / Changed Dependencies

### Add

| Package | Version | Purpose | Why |
|---|---|---|---|
| `chrono-node` | ^2.9.0 | Parse natural-language schedule phrases ("every Monday at 9am", "daily at 8", "weekdays 5pm") into structured date/time components | Battle-tested NL date parser (6M+ weekly downloads, MIT). `chrono.parse()` returns `ParsedResult[]` with `start.knownValues` (hour, minute, weekday) — exactly what's needed to emit cron fields. No real competitor in JS. |
| `cronstrue` | ^2.50.0 (optional, ~15KB) | Convert cron expression back to human-readable string for confirmation UI | After translating "every Monday 9am" → `0 9 * * 1`, show "Every Monday at 9:00 AM" so user can verify before Kai commits. Zero deps, 25+ locales. |

### Keep (already installed, becomes load-bearing)

| Package | Version | Role in v3.0 |
|---|---|---|
| `pg-boss` | ^10.4.2 | Native cron via `boss.schedule()` — Timekeeper enabled by default, supports `tz`, 5-field cron, distributed-lock safe across instances |
| `drizzle-orm` | ^0.39.1 | `db.transaction(cb, { isolationLevel })` + `.for('update')` for atomic check-and-debit |
| `@neondatabase/serverless` | ^0.10.4 | Pool in `server/db.ts`; transactions + row locks work over the WS-based driver |

### Remove

| Package | Version | Reason |
|---|---|---|
| `node-cron` | ^4.2.1 | In-process scheduler without persistence or multi-node coordination. Unused today; remove to prevent misuse. |
| `@types/node-cron` | ^3.0.11 | Remove with `node-cron`. |

### Do NOT add

| Package | Why not |
|---|---|
| `bullmq` / `bull` | Requires Redis. pg-boss already covers durable queues on Postgres — no benefit, new infra. |
| `agenda` | MongoDB-based. Wrong datastore. |
| `node-schedule` | In-process only; same durability gap as `node-cron`. |
| `croner` | pg-boss already evaluates cron internally. No gap. |
| `cron-parser` | Only needed if we validate/evaluate cron ourselves. pg-boss does it; a regex sanity check is enough. Add later if validation errors prove insufficient. |
| `pg_cron` (Postgres extension, supported by Neon) | Duplicates pg-boss; moves scheduling logic outside the app (harder to test, version, instrument). |
| Advisory-lock wrapper libs | Drizzle can execute `pg_advisory_xact_lock` via raw `sql\`...\``. No wrapper needed. |

---

## Integration Points

### (a) Atomic Budget Enforcement

**Current race in `server/autonomy/execution/taskExecutionPipeline.ts` (lines 544-560):**

```ts
const todayCount = await deps.storage.countAutonomyEventsForProjectToday(...);  // READ
if (todayCount >= BUDGETS.maxBackgroundLlmCallsPerProjectPerDay) { ... }        // CHECK
// LLM call happens here ...                                                    // ACT
// logAutonomyEvent() only AFTER success → concurrent workers bypass cap
```

N concurrent workers all see `count=4` with `limit=5` → all proceed → N× overspend.

**Fix — new module `server/autonomy/budget/atomicBudget.ts`:**

```ts
import { db } from '../../db.js';
import { sql } from 'drizzle-orm';

// Dedicated ledger row per (projectId, date, kind) — UNIQUE constraint enforces 1 row.
export async function reserveBudget(
  projectId: string,
  date: string,       // 'YYYY-MM-DD'
  kind: 'background_llm' | 'routine_exec',
  limit: number,
): Promise<{ granted: boolean; remaining: number }> {
  return db.transaction(async (tx) => {
    // Ensure row exists (idempotent)
    await tx.execute(sql`
      INSERT INTO autonomy_budget_ledger (project_id, date, kind, used_count)
      VALUES (${projectId}, ${date}, ${kind}, 0)
      ON CONFLICT (project_id, date, kind) DO NOTHING
    `);
    // Lock THIS row for the remainder of tx
    const res = await tx.execute(sql`
      SELECT used_count FROM autonomy_budget_ledger
      WHERE project_id = ${projectId} AND date = ${date} AND kind = ${kind}
      FOR UPDATE
    `);
    const used = Number((res.rows?.[0] as any)?.used_count ?? 0);
    if (used >= limit) return { granted: false, remaining: 0 };
    await tx.execute(sql`
      UPDATE autonomy_budget_ledger
      SET used_count = used_count + 1, updated_at = now()
      WHERE project_id = ${projectId} AND date = ${date} AND kind = ${kind}
    `);
    return { granted: true, remaining: limit - used - 1 };
  }, { isolationLevel: 'read committed' });
}
```

**Why `read committed` + `FOR UPDATE` (not `serializable`):**
- `serializable` on Neon triggers serialization-failure retries — extra complexity, retry loop required, surprising failure mode for engineers.
- `FOR UPDATE` on a single ledger row serializes writers for exactly that `(project, date, kind)` — this is the canonical textbook pattern for single-row counters. No retries needed; blocked workers simply wait.
- We intentionally pin all contention to one row, so `serializable` has no marginal benefit.

**Alternative (simpler, no new table) — advisory lock:**
```ts
const key = hash64(`${projectId}:${date}`);
await tx.execute(sql`SELECT pg_advisory_xact_lock(${key})`);
// then read count from existing autonomy_events table
```
This works, but loses the observable counter row we want for UI ("3 of 5 used today"). **Recommend the ledger row.**

**Integration site:** Replace lines 544-560 of `taskExecutionPipeline.ts` with a call to `reserveBudget()`. On `granted: false`, run the existing "blocked + `task_requires_approval`" path. On success, the remaining pipeline runs unchanged. Cross-validate the ledger against `autonomy_events` counts in a daily consistency check.

**Drizzle API specifics (verified):**
- `db.transaction(cb, options?)` — SUPPORTED. `options.isolationLevel: 'read committed' | 'repeatable read' | 'serializable' | 'read uncommitted'`; `accessMode: 'read only' | 'read write'`; `deferrable: boolean`.
- `.for('update')` / `.for('share')` / `.for('update', { noWait: true })` / `.for('update', { skipLocked: true })` — SUPPORTED on the standard query builder (`db.select()...`), **NOT** on `db.query.tableName` relational API. Confidence: MEDIUM (feature confirmed via Drizzle GitHub issue #2875 + community answers, but undocumented on the docs site). Mitigation: write a smoke test against Neon in Phase 1 to confirm; if it fails, fall back to raw `sql` template (`SELECT ... FOR UPDATE`) which we already use above.
- Advisory locks via `sql\`SELECT pg_advisory_xact_lock(${n})\`` — fully supported through the `sql` template tag.

### (b) Scheduled Routines

**pg-boss native API (verified from pg-boss v10.1 Cron Scheduling docs):**

```ts
// server/autonomy/scheduling/routineScheduler.ts
const boss = await getJobQueue();

await boss.schedule(
  `routine:${routineId}`,                           // unique name
  '0 9 * * 1',                                       // 5-field cron
  { routineId, projectId, agentId, prompt },         // payload
  { tz: 'America/New_York' },                        // IANA timezone
);

// Routines fire into the SAME queue as ad-hoc autonomy tasks
await boss.work('autonomous_task_execution', handleTaskJob);

// Management
await boss.unschedule(`routine:${routineId}`);
const all = await boss.getSchedules();
```

**Verified pg-boss scheduling properties:**
- Default-on (Timekeeper: `schedule: true`) — no opt-in needed.
- 5-field cron format (`m h dom mon dow`).
- `tz` option accepts IANA zones (`'America/Los_Angeles'`, `'UTC'`, `'Europe/London'`).
- Clock-skew detection + distributed lock — safe across multiple Node instances sharing one Postgres.
- Scheduled jobs enqueue into a normal queue when due → flow through existing `handleTaskJob` → **budget check + safety gates + peer review all apply automatically** (this is critical — routines inherit all v1.1/v3.0 safety rails).

**Natural-language → cron pipeline (`server/autonomy/scheduling/scheduleParser.ts`):**

```ts
import * as chrono from 'chrono-node';
import cronstrue from 'cronstrue';

export function parseSchedulePhrase(
  phrase: string,
  userTz: string,
): { cron: string; tz: string; description: string } | null {
  const results = chrono.parse(phrase, new Date(), { forwardDate: true });
  if (!results.length) return null;
  const known = results[0].start.knownValues;
  const hour   = known.hour   ?? 9;
  const minute = known.minute ?? 0;

  const lc = phrase.toLowerCase();
  let dom = '*', mon = '*', dow = '*';

  if (known.weekday !== undefined) {
    dow = String(known.weekday);                         // 0-6
  } else if (/every weekday|weekdays/.test(lc)) {
    dow = '1-5';
  } else if (/every day|daily/.test(lc)) {
    // dow stays '*'
  } else if (/monthly|every month|first of (the )?month/.test(lc)) {
    dom = '1';
  } else {
    return null;  // unrecognized → ask user to confirm
  }

  const cron = `${minute} ${hour} ${dom} ${mon} ${dow}`;
  return { cron, tz: userTz, description: cronstrue.toString(cron) };
}
```

**Why this split (chrono + ~50-LOC adapter) instead of a monolithic NL→cron lib:**
- No mature, actively maintained "NL → cron" JavaScript library exists (verified web search 2026-04). Projects like `friendly-cron` are dead or extremely narrow.
- `chrono-node` handles the hard part (parsing human time references) robustly; adapter is just recurrence-word regex over ~10 phrase patterns.
- Keeping recurrence logic in-tree means we can test, extend, and debug it — no black-box parser surprises.

**Integration site:**
1. New route `POST /api/routines` in `server/routes/routines.ts`: `{ projectId, agentId, phrase, prompt }` → parse → persist to new `autonomy_routines` table → `boss.schedule()`.
2. Chat-native trigger: extend `server/ai/tasks/intentClassifier.ts` with a new `SCHEDULE_ROUTINE` intent pattern (`/every (day|week|monday|...)|daily|weekly|on \w+days?/i`) routed to routine creator instead of task creator.
3. Clarification path: if `parseSchedulePhrase` returns null, emit an in-character clarification from the addressed agent ("I didn't catch when — did you mean every Monday at 9?") rather than fail silently.
4. Broadcast `routine_created` WS event with `cronstrue` description so UI can show "Runs every Monday at 9:00 AM" in a confirmation chip.

---

## Database Schema Additions (informational — Architecture research finalizes)

```ts
// shared/schema.ts — sketch
export const autonomyBudgetLedger = pgTable('autonomy_budget_ledger', {
  projectId: uuid('project_id').notNull(),
  date: date('date').notNull(),                       // YYYY-MM-DD
  kind: text('kind').notNull(),                       // 'background_llm' | 'routine_exec' | ...
  usedCount: integer('used_count').notNull().default(0),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (t) => ({ pk: primaryKey({ columns: [t.projectId, t.date, t.kind] }) }));

export const autonomyRoutines = pgTable('autonomy_routines', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull(),
  agentId: uuid('agent_id').notNull(),
  createdByUserId: uuid('created_by_user_id').notNull(),
  phrase: text('phrase').notNull(),                   // original NL phrase
  cronExpr: text('cron_expr').notNull(),
  tz: text('tz').notNull(),
  prompt: text('prompt').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  lastRunAt: timestamp('last_run_at'),
  createdAt: timestamp('created_at').defaultNow(),
});
```

---

## Installation

```bash
npm install chrono-node@^2.9.0 cronstrue@^2.50.0
npm uninstall node-cron @types/node-cron
npm run db:push   # apply autonomy_budget_ledger + autonomy_routines schema
```

No dev-dep changes. No Drizzle-kit config changes.

---

## Alternatives Considered

| Capability | Recommended | Alternative | Why Not |
|---|---|---|---|
| Atomic budget | Drizzle tx + `FOR UPDATE` on ledger row | `SERIALIZABLE` isolation + retry loop | Retry logic adds complexity + surprising failure modes; `FOR UPDATE` is the textbook pattern for single-row counters |
| Atomic budget | Ledger row + `FOR UPDATE` | `pg_advisory_xact_lock` only | Works but no observable counter row for "% budget used" UI |
| Scheduling | pg-boss `schedule()` | `pg_cron` (Neon extension) | Scheduling logic outside app — harder to test/instrument/version |
| Scheduling | pg-boss `schedule()` | `node-cron` / `node-schedule` | In-process, non-durable, double-fires on multi-node |
| Scheduling | pg-boss `schedule()` | BullMQ + Redis | New infra for zero incremental benefit |
| NL parsing | `chrono-node` + thin adapter | Single "NL→cron" lib | None mature/maintained in JS ecosystem (2026-04) |
| Cron display | `cronstrue` | Hand-rolled | ~15KB for battle-tested phrasing in 25+ locales |

---

## Confidence Assessment

| Claim | Confidence | Source |
|---|---|---|
| pg-boss v10 has native `schedule()` with `tz` option | HIGH | pg-boss DeepWiki 10.1 Cron Scheduling (API signatures, `tz` param, Timekeeper default-on) |
| Drizzle supports `db.transaction(cb, { isolationLevel })` | HIGH | Drizzle official `/docs/transactions` |
| Drizzle query builder supports `.for('update')` | MEDIUM | GitHub issue #2875 + community answers confirm; undocumented on docs site. Mitigation: smoke-test in Phase 1; fallback to raw `sql\`SELECT ... FOR UPDATE\`` always works |
| Advisory locks via Drizzle `sql` template | HIGH | Standard Drizzle template-tag usage |
| `chrono-node` parses recurring phrases with weekday/hour | HIGH | 2.9.0 docs; 6M+ weekly downloads; stable API |
| `cronstrue` reliably verbalizes 5-field cron | HIGH | 1M+ weekly downloads; 25+ locales |
| No mature JS "NL → cron" monolithic library | MEDIUM | Web search 2026-04 surfaced none; niche candidate may have been missed |

---

## Definitive Answers to Downstream Questions

1. **Is pg-boss's built-in cron sufficient, or do we need a separate scheduler?**
   **Sufficient.** pg-boss v10.4.2 ships `schedule()`, `unschedule()`, `getSchedules()`, Timekeeper with clock-skew detection, IANA timezone support via `tz` option, distributed-lock safe. **Do not add a second scheduler.** Remove `node-cron`.

2. **Does Drizzle expose `SELECT FOR UPDATE`, serializable isolation, and advisory locks?**
   - **Serializable isolation: YES**, native via `db.transaction(cb, { isolationLevel: 'serializable' })`. All four PG levels supported.
   - **`SELECT FOR UPDATE`: YES** via `.for('update')` on standard query builder (confirmed but undocumented — fallback to raw `sql\`... FOR UPDATE\`` always works). Recommendation: **use raw `sql` template** for the budget ledger tx to avoid depending on undocumented API.
   - **Advisory locks: YES** via raw `sql\`SELECT pg_advisory_xact_lock(${key})\``.
   - **Recommended pattern for v3.0:** `read committed` isolation + `FOR UPDATE` on the ledger row (raw `sql`). Not `serializable`, because pinning contention to one row already serializes writers and avoids retry-loop complexity.

3. **Best library for natural-language → cron?**
   **`chrono-node` + 50-LOC in-house adapter.** Optionally `cronstrue` for reverse-display. No single maintained NL→cron library exists in JS. `chrono-node` parses the time component; recurrence keywords map to cron fields with simple regex.

---

## Sources

- [pg-boss Cron Scheduling (DeepWiki v10.1)](https://deepwiki.com/timgit/pg-boss/10.1-cron-based-scheduling)
- [Drizzle Transactions docs](https://orm.drizzle.team/docs/transactions)
- [Drizzle SELECT FOR UPDATE issue #2875](https://github.com/drizzle-team/drizzle-orm/issues/2875)
- [Drizzle locks — community answer](https://www.answeroverflow.com/m/1202652683492925544)
- [chrono-node on npm](https://www.npmjs.com/package/chrono-node)
- [cronstrue on npm](https://www.npmjs.com/package/cronstrue)
- [Neon pg_cron docs](https://neon.com/docs/extensions/pg_cron) (considered, not recommended)
- [Scheduled Jobs with pg-boss in TypeScript](https://logsnag.com/blog/deep-dive-into-background-jobs-with-pg-boss-and-typescript)
