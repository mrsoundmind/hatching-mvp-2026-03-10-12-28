import pkg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

const { Pool } = pkg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Migrated from @neondatabase/serverless → node-postgres on 2026-06-02
// per quick task 260601-supabase-migration.
// max:10 leaves headroom on Supabase free-tier connection caps for
// pg-boss + connect-pg-simple sharing this pool.
// ssl required by Supabase; rejectUnauthorized:false is the standard
// managed-PG-with-valid-CA pattern.
// keepAlive + short idle recycle: the Supavisor pooler drops idle server
// connections, which surfaced as "Connection terminated unexpectedly" and could
// fail an autonomous task's output write mid-execution. TCP keepalive holds
// connections open; idleTimeoutMillis recycles them before the pooler kills them;
// connectionTimeoutMillis fails fast instead of hanging on a dead connection.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  ssl: { rejectUnauthorized: false },
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});
pool.on('error', (err) => {
  console.error('[Hatchin][DB] Postgres pool error (non-fatal):', err.message);
});
export const db = drizzle(pool, { schema });
