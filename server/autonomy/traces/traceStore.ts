// TODO(P1-5): Migrate raw pool.query() calls to Drizzle ORM for type safety.
// All queries here are parameterized (no SQL injection risk) but bypass Drizzle's
// type system and cannot be tested via MemStorage. Low priority since traces are
// an internal debugging tool, not user-facing.
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import type { DeliberationTrace, DeliberationRoundTrace, PeerReviewTrace } from './deliberationTraceTypes.js';

const TRACE_FILE = path.join(process.cwd(), 'baseline', 'deliberation-traces.json');

type DbPool = {
  query: (text: string, values?: unknown[]) => Promise<{ rows: any[] }>;
};

// Queryable is satisfied by both Pool and PoolClient — used to route queries
// to a specific client inside a transaction without acquiring a new connection.
type Queryable = {
  query: (text: string, values?: unknown[]) => Promise<{ rows: any[] }>;
};

let cachedPool: DbPool | null = null;

async function getDbPool(): Promise<DbPool | null> {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  if (cachedPool) return cachedPool;

  try {
    const mod = await import('../../db.js');
    const pool = mod.pool as DbPool;
    await pool.query('select 1');
    cachedPool = pool;
    return pool;
  } catch {
    // Don't cache failed connections — allow retry on next call
    return null;
  }
}

function normalizeFinalSynthesis(value: unknown): Record<string, unknown> {
  if (!value) {
    return {};
  }
  if (typeof value === 'string') {
    return { content: value };
  }
  if (typeof value === 'object') {
    return value as Record<string, unknown>;
  }
  return { content: String(value) };
}

function mapDbRowToTrace(row: any): DeliberationTrace {
  const finalSynthesis = row.final_synthesis;
  const normalizedFinal =
    finalSynthesis && typeof finalSynthesis === 'object' && typeof finalSynthesis.content === 'string'
      ? finalSynthesis.content
      : finalSynthesis ?? null;

  return {
    traceId: row.trace_id,
    userId: row.user_id,
    projectId: row.project_id,
    teamId: row.team_id ?? null,
    conversationId: row.conversation_id,
    objective: row.objective,
    rounds: Array.isArray(row.rounds) ? row.rounds : [],
    review: Array.isArray(row.review) ? row.review : [],
    finalSynthesis: normalizedFinal,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

async function createTraceInDb(trace: DeliberationTrace, executor?: Queryable): Promise<boolean> {
  const pool = executor ?? (await getDbPool());
  if (!pool) return false;

  try {
    await pool.query(
      `
      insert into deliberation_traces (
        trace_id,
        user_id,
        project_id,
        team_id,
        conversation_id,
        objective,
        rounds,
        review,
        final_synthesis,
        created_at,
        updated_at
      ) values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11)
      on conflict (trace_id) do update set
        user_id = excluded.user_id,
        project_id = excluded.project_id,
        team_id = excluded.team_id,
        conversation_id = excluded.conversation_id,
        objective = excluded.objective,
        rounds = excluded.rounds,
        review = excluded.review,
        final_synthesis = excluded.final_synthesis,
        updated_at = excluded.updated_at
      `,
      [
        trace.traceId,
        trace.userId,
        trace.projectId,
        trace.teamId ?? null,
        trace.conversationId,
        trace.objective,
        JSON.stringify(trace.rounds),
        JSON.stringify(trace.review),
        JSON.stringify(normalizeFinalSynthesis(trace.finalSynthesis)),
        trace.createdAt,
        trace.updatedAt,
      ],
    );
    return true;
  } catch (err) {
    console.error('[TraceStore] createTraceInDb failed:', err);
    return false;
  }
}

async function readTraceFromDb(traceId: string, executor?: Queryable): Promise<DeliberationTrace | null> {
  const pool = executor ?? (await getDbPool());
  if (!pool) return null;

  try {
    const result = await pool.query(
      `
      select
        trace_id,
        user_id,
        project_id,
        team_id,
        conversation_id,
        objective,
        rounds,
        review,
        final_synthesis,
        created_at,
        updated_at
      from deliberation_traces
      where trace_id = $1
      limit 1
      `,
      [traceId],
    );
    if (!result.rows[0]) {
      return null;
    }
    return mapDbRowToTrace(result.rows[0]);
  } catch (err) {
    console.error('[TraceStore] readTraceFromDb failed:', err);
    return null;
  }
}

async function listTracesFromDb(limit: number): Promise<DeliberationTrace[] | null> {
  const pool = await getDbPool();
  if (!pool) return null;

  try {
    const result = await pool.query(
      `
      select
        trace_id,
        user_id,
        project_id,
        team_id,
        conversation_id,
        objective,
        rounds,
        review,
        final_synthesis,
        created_at,
        updated_at
      from deliberation_traces
      order by created_at desc
      limit $1
      `,
      [Math.max(1, limit)],
    );
    return result.rows.map(mapDbRowToTrace).reverse();
  } catch {
    return null;
  }
}

async function upsertTraceDbMutation(
  traceId: string,
  mutator: (trace: DeliberationTrace) => DeliberationTrace
): Promise<DeliberationTrace | null> {
  try {
    // Use a transaction to prevent read-modify-write race conditions
    const { pool } = await import('../../db.js');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Lock the row for update to prevent concurrent modifications
      const lockResult = await client.query(
        'SELECT * FROM deliberation_traces WHERE trace_id = $1 FOR UPDATE',
        [traceId]
      );
      if (lockResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }
      const current = await readTraceFromDb(traceId, client);
      if (!current) {
        await client.query('ROLLBACK');
        return null;
      }
      const next = mutator(current);
      const wrote = await createTraceInDb(next, client);
      await client.query('COMMIT');
      return wrote ? next : null;
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch { /* connection may be dead */ }
      console.error('[TraceStore] upsert transaction failed:', err);
      return null;
    } finally {
      try { client.release(); } catch { /* already released or dead */ }
    }
  } catch {
    // Fallback to non-transactional if pool unavailable
    const current = await readTraceFromDb(traceId);
    if (!current) return null;
    const next = mutator(current);
    const wrote = await createTraceInDb(next);
    return wrote ? next : null;
  }
}

async function ensureStorage(): Promise<void> {
  await fs.mkdir(path.dirname(TRACE_FILE), { recursive: true });
  try {
    await fs.access(TRACE_FILE);
  } catch {
    await fs.writeFile(TRACE_FILE, '[]', 'utf8');
  }
}

async function readAll(): Promise<DeliberationTrace[]> {
  await ensureStorage();
  const raw = await fs.readFile(TRACE_FILE, 'utf8');
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed as DeliberationTrace[];
    }
  } catch {
    // ignored
  }
  return [];
}

async function writeAll(traces: DeliberationTrace[]): Promise<void> {
  await ensureStorage();
  await fs.writeFile(TRACE_FILE, JSON.stringify(traces, null, 2), 'utf8');
}

export async function createDeliberationTrace(input: {
  userId: string;
  projectId: string;
  conversationId: string;
  teamId?: string | null;
  objective: string;
  traceId?: string;
  rounds?: DeliberationRoundTrace[];
  review?: PeerReviewTrace[];
  finalSynthesis?: string | Record<string, unknown>;
}): Promise<DeliberationTrace> {
  const now = new Date().toISOString();
  const trace: DeliberationTrace = {
    traceId: input.traceId || `trace-${randomUUID()}`,
    userId: input.userId,
    projectId: input.projectId,
    teamId: input.teamId ?? null,
    conversationId: input.conversationId,
    objective: input.objective,
    rounds: input.rounds || [],
    review: input.review || [],
    finalSynthesis: input.finalSynthesis ?? null,
    createdAt: now,
    updatedAt: now,
  };

  const wroteToDb = await createTraceInDb(trace);
  if (!wroteToDb) {
    const traces = await readAll();
    traces.push(trace);
    await writeAll(traces);
  }

  return trace;
}

export async function appendDeliberationRound(traceId: string, round: DeliberationRoundTrace): Promise<DeliberationTrace | null> {
  const updatedInDb = await upsertTraceDbMutation(traceId, (trace) => ({
    ...trace,
    rounds: [...trace.rounds, round],
    updatedAt: new Date().toISOString(),
  }));
  if (updatedInDb) {
    return updatedInDb;
  }

  const traces = await readAll();
  const idx = traces.findIndex((trace) => trace.traceId === traceId);
  if (idx === -1) return null;

  traces[idx].rounds.push(round);
  traces[idx].updatedAt = new Date().toISOString();
  await writeAll(traces);
  return traces[idx];
}

export async function appendPeerReview(traceId: string, review: PeerReviewTrace): Promise<DeliberationTrace | null> {
  const updatedInDb = await upsertTraceDbMutation(traceId, (trace) => ({
    ...trace,
    review: [...trace.review, review],
    updatedAt: new Date().toISOString(),
  }));
  if (updatedInDb) {
    return updatedInDb;
  }

  const traces = await readAll();
  const idx = traces.findIndex((trace) => trace.traceId === traceId);
  if (idx === -1) return null;

  traces[idx].review.push(review);
  traces[idx].updatedAt = new Date().toISOString();
  await writeAll(traces);
  return traces[idx];
}

export async function finalizeDeliberationTrace(traceId: string, finalSynthesis: string): Promise<DeliberationTrace | null> {
  const updatedInDb = await upsertTraceDbMutation(traceId, (trace) => ({
    ...trace,
    finalSynthesis,
    updatedAt: new Date().toISOString(),
  }));
  if (updatedInDb) {
    return updatedInDb;
  }

  const traces = await readAll();
  const idx = traces.findIndex((trace) => trace.traceId === traceId);
  if (idx === -1) return null;

  traces[idx].finalSynthesis = finalSynthesis;
  traces[idx].updatedAt = new Date().toISOString();
  await writeAll(traces);
  return traces[idx];
}

export async function getDeliberationTrace(traceId: string): Promise<DeliberationTrace | null> {
  const dbTrace = await readTraceFromDb(traceId);
  if (dbTrace) {
    return dbTrace;
  }
  const traces = await readAll();
  return traces.find((trace) => trace.traceId === traceId) || null;
}

export async function listDeliberationTraces(limit = 100): Promise<DeliberationTrace[]> {
  const dbTraces = await listTracesFromDb(limit);
  if (dbTraces) {
    return dbTraces;
  }
  const traces = await readAll();
  return traces.slice(-Math.max(1, limit));
}
