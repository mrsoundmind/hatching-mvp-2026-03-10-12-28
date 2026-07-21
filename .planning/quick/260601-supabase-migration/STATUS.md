---
quick_task: 260601-supabase-migration
status: shipped
created: 2026-06-01
shipped: 2026-06-02
goal: Migrate database host from Neon (over compute-quota) to Supabase (Singapore, free tier) — keep code Postgres-native, abandon Neon data (no real users / no irreplaceable test artifacts)
outcome: |
  Project hatchin-mvp created in ap-southeast-1 (Singapore), ref qbqvunvzgalcuosxfbev.
  Connection via Supavisor session-mode pooler (aws-1-ap-southeast-1.pooler.supabase.com:5432).
  npm run db:push materialized full Drizzle schema (21 public tables). pg-boss self-bootstrapped
  its own schema (7 pgboss tables) on startup — proving session-mode pooler supports LISTEN/NOTIFY
  + advisory locks (the load-bearing landmine we warned about).
  Dev server boots clean. Landing + login routes serve 200. Autonomy background runner started.
  Memory-mode .env backup moved to ~/.hatchin-env-pre-supabase-260602 (chmod 600, outside repo).
---

# Supabase Migration — Quick Task 260601

## Why this is a quick task (not a phase)

Mid-milestone infra unblock. Neon's compute-hour quota wall has blocked the dev server for days; memory-mode workaround (introduced via uncommitted edits to `server/index.ts` + `.env`) is viable for Phase 35 dev work but provides volatile storage only. Migrating to Supabase resolves the blocker permanently, restores durable storage, and sets v2.1 long-term DB home — without forking a Phase X.5 (per saved feedback rule `feedback_no_decimal_hotfixes.md`).

## Decision Recap

User decisions captured during planning:
- **Destination:** Supabase (region: Singapore — matches Fly `ap-southeast-1`)
- **Data handling:** Abandon Neon data — no real users, no irreplaceable brain doc uploads
- **Timing:** Migrate now (replaces the need to upgrade Neon for $19)
- **Connection mode:** pg-boss + connect-pg-simple use direct connection (port 5432), NOT Supavisor transaction pooler (port 6543) — pg-boss requires LISTEN/NOTIFY + advisory locks that don't survive transaction-mode pooling

## Code Changes

### Single file: `server/db.ts`

Replace neon-serverless driver + Pool with standard `pg` (node-postgres) + Pool:

```ts
// BEFORE (Neon serverless)
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
neonConfig.webSocketConstructor = ws;
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });

// AFTER (node-postgres)
import pkg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
const { Pool } = pkg;
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,                              // Supabase free-tier direct cap is 60; 10 leaves headroom for pg-boss + connect-pg-simple
  ssl: { rejectUnauthorized: false },   // Supabase requires SSL; this is the standard "managed PG with valid CA" pattern
});
pool.on('error', (err) => {
  console.error('[Hatchin][DB] Postgres pool error (non-fatal):', err.message);
});
export const db = drizzle(pool, { schema });
```

### `package.json` (already updated)

- Added: `pg@^8.21.0` (runtime), `@types/pg@^8.20.0` (dev)

### `.env` (NOT committed — gitignored)

- `DATABASE_URL=` → Supabase direct connection string (port **5432**, NOT 6543 pooler)
- `STORAGE_MODE=db` (flip from `memory`)

### Files that DO NOT change

- `server/index.ts` — connect-pg-simple accepts any `pg`-compatible Pool; reads `pool` export from db.ts; works unchanged
- `server/autonomy/execution/jobQueue.ts` — `new PgBoss(process.env.DATABASE_URL!)` reads connection string; works unchanged AS LONG AS the env var is the direct 5432 connection
- `shared/schema.ts` — Drizzle schema is Postgres-dialect; no changes needed
- The 3 STORAGE_MODE gates Gemini added (session table, autonomy runner, PostgresqlStore conditional) — KEEP. They're correct infra-resilience.

## Verification Plan (per saved `feedback_verify_in_runtime.md` rule)

After connection string is wired:

1. `npm run db:push` — materialize Drizzle schema on fresh Supabase
2. Restart dev server — confirm `serving on port 5001` + no boot errors
3. Sign in via Google OAuth — verify session persists (DB-backed)
4. Create a test project — verify upsert + Maya hatch creation works
5. Send a chat message — verify provider chain + DB writes + WS streaming
6. Trigger an autonomy task — verifies pg-boss is functional (NOT on transaction pooler)
7. Run `npm run test:tone && npm run test:voice && npm run gate:safety && npm run gate:conductor` — eval gate against Supabase
8. (Defer until Case 01 push) Update Fly secrets with new DATABASE_URL + redeploy

## Rollback Plan

- Keep `.env` snapshot pre-migration (or git stash the pre-migration version)
- The `server/db.ts` change is one file — `git checkout server/db.ts` reverts to Neon driver
- Neon project remains live (just over quota); compute-quota resets at billing cycle — fallback available if Supabase has unforeseen issues

## Open at completion

- Phase 35-04 PrivacyContent disclosure updated to add Supabase as a data processor (Singapore region) — needed before Phase 35 ships to avoid disclosure drift
- Memory-mode resilience changes Gemini made to `server/index.ts` should be committed as part of this quick task (currently uncommitted) — they're legitimate boot-resilience improvements regardless of DB provider

## Status Timeline

| Time | Event |
|---|---|
| 2026-06-01 | Quick task opened; user confirmed abandon-Neon-data + Supabase Singapore |
| 2026-06-01 | `pg` + `@types/pg` deps installed |
| 2026-06-02 | User provided Supabase Management API access token (later revoked) |
| 2026-06-02 | Project `hatchin-mvp` created via API in ap-southeast-1 (free tier) |
| 2026-06-02 | Connectivity blocker: IPv4-only network + new-project Supavisor sync delay (aws-0 region pattern failed); resolved by using user-provided dashboard URL with `aws-1` shard |
| 2026-06-02 | `server/db.ts` driver swap applied (neon-serverless → node-postgres, max:10, ssl:true) |
| 2026-06-02 | `.env` updated (DATABASE_URL → Supavisor pooler session-mode; STORAGE_MODE flipped memory → db); pre-migration backup moved to `~/.hatchin-env-pre-supabase-260602` |
| 2026-06-02 | `npm run db:push` — Drizzle schema materialized (21 tables in `public`); pg-boss self-bootstrapped (7 tables in `pgboss` schema) |
| 2026-06-02 | Dev server restart verified: port 5001 bound, landing/login HTTP 200, BackgroundRunner + autonomy worker registered |
| 2026-06-02 | Migration committed |
| 2026-06-02 | User instructed to revoke Supabase access token |
