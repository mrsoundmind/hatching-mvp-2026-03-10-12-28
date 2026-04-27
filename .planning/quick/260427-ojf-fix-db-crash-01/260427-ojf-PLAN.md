---
task_id: 260427-ojf
slug: fix-db-crash-01
mode: quick
description: Fix DB-CRASH-01 — eliminate Node process death from Neon Postgres idle-in-transaction errors during streaming chat sessions
files_modified:
  - server/autonomy/traces/traceStore.ts
  - server/index.ts
autonomous: true
---

<objective>
Stop the dev server from dying mid-session with `terminating connection due to idle-in-transaction timeout` (Postgres SQLSTATE 25P03). Two empirically verified bugs:

1. **Bug A — `traceStore.ts:upsertTraceDbMutation` deadlock-like pattern.** The function opens a transaction on connection X, locks a row with `SELECT ... FOR UPDATE`, then calls `readTraceFromDb` and `createTraceInDb` which acquire NEW connections (Y, Z) from the global pool and try to read/write the same row. Inner queries wait on the FOR UPDATE lock; outer transaction waits on the inner queries; nothing makes progress; Neon serverless idle-in-transaction timeout (~5min) fires FATAL.

2. **Bug B — `server/index.ts` has no `uncaughtException` / `unhandledRejection` handlers.** When the FATAL above is emitted on a WebSocket the pool can't catch (pool's `error` handler only fires for pool-emit errors, not per-connection socket errors during a tx), the error propagates to the process and Node v22 exits. Dev server gone. Clients see "Maya broken."

Output: traceStore upsert runs ALL transaction queries on the same `PoolClient`, and the process logs+recovers from Neon idle-tx errors instead of dying.
</objective>

<context>
@CLAUDE.md
@.planning/STATE.md
@server/autonomy/traces/traceStore.ts
@server/db.ts
@server/index.ts

**Verified scope:** `grep -rn "createTraceInDb\|readTraceFromDb" server/` shows zero callers outside `traceStore.ts` — both helpers are file-private, so adding an optional `client` parameter is a safe local refactor.

**Postgres error code reference:** SQLSTATE `25P03` = `idle_in_transaction_session_timeout`. Always recoverable at the application layer — it only kills the offending connection, not the database.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Keep all transaction queries on the same PoolClient in upsertTraceDbMutation</name>
  <files>server/autonomy/traces/traceStore.ts</files>
  <read_first>
    Re-read `server/autonomy/traces/traceStore.ts` lines 72-233 in full. Confirm:
    - `createTraceInDb` (line 72) and `readTraceFromDb` (line 124) currently call `getDbPool()` and use `pool.query`.
    - `upsertTraceDbMutation` (line 190) is the only caller that opens a transaction.
    - No other file imports `createTraceInDb` or `readTraceFromDb` (already verified via grep — they're not exported).
  </read_first>
  <action>
    Refactor `createTraceInDb` and `readTraceFromDb` to accept an optional executor that, when provided, is used INSTEAD of acquiring a fresh pool connection. Then make `upsertTraceDbMutation` pass its transaction `client` through.

    Concrete edits:

    1. At the top of the file (near the existing `DbPool` type, ~line 12-14), add a minimal Queryable type that both `Pool` and `PoolClient` satisfy:
    ```typescript
    type Queryable = {
      query: (text: string, values?: unknown[]) => Promise<{ rows: any[] }>;
    };
    ```
    (Replace or augment the existing `DbPool` alias — they have the same shape.)

    2. Change `createTraceInDb(trace)` signature to `createTraceInDb(trace, executor?: Queryable)`:
       - If `executor` is provided, run the INSERT...ON CONFLICT against `executor` directly (skip `getDbPool()`).
       - If not provided, behave exactly as today (call `getDbPool()`, use `pool.query`).
       - Preserve the existing try/catch and `console.error('[TraceStore] createTraceInDb failed:', err)` logging.

    3. Change `readTraceFromDb(traceId)` signature to `readTraceFromDb(traceId, executor?: Queryable)` with the same pattern: when `executor` is given, run the SELECT against it; otherwise use `getDbPool()` as today.

    4. In `upsertTraceDbMutation` (lines 190-233), pass the transaction `client` to both inner calls:
    ```typescript
    const current = await readTraceFromDb(traceId, client);   // ← was: readTraceFromDb(traceId)
    if (!current) {
      await client.query('ROLLBACK');
      return null;
    }
    const next = mutator(current);
    const wrote = await createTraceInDb(next, client);        // ← was: createTraceInDb(next)
    ```

    5. Tighten the `catch` in `upsertTraceDbMutation`. Currently the rollback inside the catch can itself throw (if the connection is already dead from an idle-tx timeout) and the `client.release()` in `finally` can also throw. Guard both:
    ```typescript
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch { /* connection may be dead */ }
      console.error('[TraceStore] upsert transaction failed:', err);
      return null;
    } finally {
      try { client.release(); } catch { /* already released or dead */ }
    }
    ```

    6. Leave the outer fallback (lines 225-232 — "Fallback to non-transactional if pool unavailable") unchanged.

    Do NOT change call sites of `createTraceInDb` / `readTraceFromDb` outside `upsertTraceDbMutation` — they should continue to work without the second argument.
  </action>
  <verify>
    <automated>
      # 1. Both inner calls inside upsertTraceDbMutation now pass `client`:
      grep -n "readTraceFromDb(traceId, client)\|createTraceInDb(next, client)" server/autonomy/traces/traceStore.ts | wc -l | grep -q '^[[:space:]]*2$'

      # 2. The Queryable type or equivalent optional executor parameter exists:
      grep -nE "executor\?:\s*(Queryable|DbPool)" server/autonomy/traces/traceStore.ts | wc -l | grep -q '^[[:space:]]*[2-9]$'

      # 3. Rollback and release are wrapped in try/catch:
      grep -nE "try\s*\{\s*await client\.query\('ROLLBACK'\)" server/autonomy/traces/traceStore.ts
      grep -nE "try\s*\{\s*client\.release\(\)" server/autonomy/traces/traceStore.ts

      # 4. TypeScript compiles:
      npm run typecheck
    </automated>
  </verify>
  <acceptance_criteria>
    - `upsertTraceDbMutation` runs SELECT FOR UPDATE, the read, and the upsert on the SAME `PoolClient` — no fresh `pool.query` happens between BEGIN and COMMIT.
    - `createTraceInDb` and `readTraceFromDb` remain backward-compatible when called without the second argument.
    - Rollback and release no longer throw uncatchable errors when the connection has already been killed by Neon's idle-tx timeout.
    - `npm run typecheck` exits 0.
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: Add uncaughtException + unhandledRejection handlers that recover from Neon idle-tx errors</name>
  <files>server/index.ts</files>
  <read_first>
    Re-read `server/index.ts` lines 360-410. Confirm only `SIGTERM` and `SIGINT` listeners are registered (around lines 401-402) and there's no existing `uncaughtException` or `unhandledRejection` handler anywhere in the file. (Run `grep -n "uncaughtException\|unhandledRejection" server/index.ts` — should return nothing before this task; should return 2 hits after.)
  </read_first>
  <action>
    Insert process-level error handlers IMMEDIATELY BEFORE the existing `process.on('SIGTERM', ...)` line (currently around line 401). They must run inside the same IIFE/async block where `shutdown` is defined, but they don't reference `shutdown` — they're independent listeners.

    Add exactly these two handlers:

    ```typescript
    process.on('uncaughtException', (err: any) => {
      const isNeonIdleTx =
        err?.code === '25P03' ||
        /idle-in-transaction/i.test(err?.message || '');
      console.error('[Hatchin] uncaughtException:', {
        message: err?.message,
        code: err?.code,
        stack: err?.stack?.split('\n').slice(0, 10).join('\n'),
        isNeonIdleTx,
      });
      if (isNeonIdleTx) {
        console.error('[Hatchin] Neon idle-in-transaction error — recovering, NOT exiting');
        return;
      }
      console.error('[Hatchin] Unrecoverable uncaughtException — exiting');
      process.exit(1);
    });

    process.on('unhandledRejection', (reason: any) => {
      const isNeonIdleTx =
        reason?.code === '25P03' ||
        /idle-in-transaction/i.test(reason?.message || '');
      console.error('[Hatchin] unhandledRejection:', {
        reason: reason?.message || String(reason),
        code: reason?.code,
        stack: reason?.stack?.split('\n').slice(0, 10).join('\n'),
        isNeonIdleTx,
      });
      if (isNeonIdleTx) {
        console.error('[Hatchin] Neon idle-in-transaction promise rejection — recovering, NOT crashing');
        return;
      }
      // Non-Neon unhandled rejection: log loudly but do NOT exit.
      // Node v22 default behavior is exit-on-unhandled-rejection; we override
      // for production stability since dev/streaming flows occasionally produce
      // benign promise leaks (e.g., abandoned LLM aborts).
    });
    ```

    Place them in source order so the file reads:
    1. `shutdown` function definition (already present, lines ~370-399)
    2. NEW: `process.on('uncaughtException', ...)`
    3. NEW: `process.on('unhandledRejection', ...)`
    4. Existing: `process.on('SIGTERM', () => shutdown('SIGTERM'));`
    5. Existing: `process.on('SIGINT', () => shutdown('SIGINT'));`

    Do not modify the existing SIGTERM/SIGINT lines or the shutdown function.
  </action>
  <verify>
    <automated>
      # 1. Both handlers present (filter out comments to avoid self-invalidating grep):
      grep -v '^[[:space:]]*//' server/index.ts | grep -cE "process\.on\('uncaughtException'" | grep -q '^[1-9]'
      grep -v '^[[:space:]]*//' server/index.ts | grep -cE "process\.on\('unhandledRejection'" | grep -q '^[1-9]'

      # 2. The Neon idle-tx detection logic is wired (looks for SQLSTATE code or message regex):
      grep -n "25P03" server/index.ts
      grep -n "idle-in-transaction" server/index.ts

      # 3. Handlers appear BEFORE the SIGTERM line (so they're registered during the same IIFE):
      UNCAUGHT_LINE=$(grep -n "process.on('uncaughtException'" server/index.ts | head -1 | cut -d: -f1)
      SIGTERM_LINE=$(grep -n "process.on('SIGTERM'" server/index.ts | head -1 | cut -d: -f1)
      [ "$UNCAUGHT_LINE" -lt "$SIGTERM_LINE" ]

      # 4. TypeScript compiles:
      npm run typecheck
    </automated>
  </verify>
  <acceptance_criteria>
    - `process.on('uncaughtException', ...)` and `process.on('unhandledRejection', ...)` both registered in `server/index.ts`.
    - Both handlers detect Neon idle-tx errors (by SQLSTATE `25P03` OR message regex) and return without exiting the process.
    - Non-Neon uncaught exceptions still call `process.exit(1)` (we don't want to mask unrelated bugs).
    - Non-Neon unhandled rejections log loudly but do not exit (override Node v22 default).
    - `npm run typecheck` exits 0.
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 3: End-to-end smoke verification — server stays up under load</name>
  <files>(no files modified — verification only)</files>
  <read_first>
    Confirm Tasks 1 and 2 landed: re-grep both verification commands above. Confirm `npm run typecheck` is clean. Note the path to the previously-failing E2E spec referenced in the planning context.
  </read_first>
  <action>
    Run a manual smoke test to prove the crash is gone. Execute in order:

    1. Start the dev server in the background:
       ```bash
       npm run dev > /tmp/hatchin-dev.log 2>&1 &
       echo $! > /tmp/hatchin-dev.pid
       sleep 8   # wait for boot
       ```

    2. Confirm the server is up:
       ```bash
       curl -sf http://localhost:5001/api/health | head -c 200
       ```
       Expected: 200 response with health JSON.

    3. Drive several autonomy/trace mutations. The cleanest trigger is the existing Playwright spec that was previously failing because the server died:
       ```bash
       npx playwright test tests/e2e/maya-fallback.spec.ts --project=chromium-light --reporter=line 2>&1 | tail -40
       ```
       (If that spec doesn't exist or has been renamed, run `npm run gate:safety` instead — it exercises the deliberation trace path.)

    4. After the test run, check:
       a. Server is STILL UP (this is the primary goal):
          ```bash
          curl -sf http://localhost:5001/api/health > /dev/null && echo "SERVER ALIVE" || echo "SERVER DOWN"
          ```
       b. Logs do NOT show `Node.js v22.22.2` followed by EOF (sign of process death):
          ```bash
          tail -100 /tmp/hatchin-dev.log | grep -E "terminating connection|25P03|Node\.js v" || echo "no fatal exit markers"
          ```
       c. If a Neon idle-tx error DID occur, our handler caught it — look for the recovery log line:
          ```bash
          grep -E "Neon idle-in-transaction.*recovering" /tmp/hatchin-dev.log || echo "(no idle-tx errors fired during smoke — handlers passive)"
          ```

    5. Tear down:
       ```bash
       kill $(cat /tmp/hatchin-dev.pid) 2>/dev/null
       rm -f /tmp/hatchin-dev.pid
       ```

    Record findings in the SUMMARY.md.

    If the server dies during this smoke (i.e. `SERVER DOWN`), do NOT mark the task complete. Re-read Task 1 and Task 2 changes, find the gap, fix, retry. The whole point of this plan is "server doesn't crash."
  </action>
  <verify>
    <automated>
      # Step 4a above is the actual gate. Encoded as a single check:
      curl -sf http://localhost:5001/api/health > /dev/null 2>&1 && echo OK || echo FAIL
      # Acceptable output: OK   (after the smoke run completes)
      # If FAIL: server crashed and the fix is incomplete.
    </automated>
  </verify>
  <acceptance_criteria>
    - Dev server starts, accepts the smoke load (Playwright spec or `gate:safety`), and `/api/health` still returns 200 afterward.
    - No `terminating connection due to idle-in-transaction timeout` followed by Node EOF in `/tmp/hatchin-dev.log`. (If 25P03 IS observed, the recovery log line MUST also be present, proving Bug B's handler caught it.)
    - The previously-failing chat/maya E2E flow no longer surfaces "ConnectionRefused" symptoms — implicit confirmation that Bug A's deadlock is gone.
  </acceptance_criteria>
</task>

</tasks>

<success_criteria>
- `traceStore.upsertTraceDbMutation` performs the full BEGIN → SELECT FOR UPDATE → read → mutate → upsert → COMMIT cycle on a single `PoolClient`.
- `server/index.ts` registers `uncaughtException` and `unhandledRejection` handlers that distinguish Neon idle-tx errors (SQLSTATE 25P03) from unrelated faults and recover from the former.
- `npm run typecheck` exits 0.
- A live smoke run keeps the dev server alive through autonomy-trace traffic; `/api/health` returns 200 at the end.
</success_criteria>

<output>
After completion, create `.planning/quick/260427-ojf-fix-db-crash-01/260427-ojf-SUMMARY.md` recording:
- Diff summary of `traceStore.ts` (which functions gained the `executor` parameter)
- Diff summary of `server/index.ts` (the two new handlers)
- Smoke run result: server stayed up / health endpoint OK
- Whether any 25P03 errors fired during the smoke and whether the handler caught them
</output>
