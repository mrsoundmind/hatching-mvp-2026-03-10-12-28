import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import type { AutonomyEvent } from './eventTypes.js';

const EVENTS_FILE = path.join(process.cwd(), 'baseline', 'autonomy-events.jsonl');

type RequestClass = "single" | "deliberation" | "safety" | "task";

type DbPool = {
  query: (text: string, values?: unknown[]) => Promise<{ rows: any[] }>;
};

let dbPoolPromise: Promise<DbPool | null> | null = null;

async function ensureDir(): Promise<void> {
  await fs.mkdir(path.dirname(EVENTS_FILE), { recursive: true });
}

async function getDbPool(): Promise<DbPool | null> {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  if (!dbPoolPromise) {
    dbPoolPromise = (async () => {
      try {
        const mod = await import('../../db.js');
        const pool = mod.pool as DbPool;
        await pool.query('select 1');
        return pool;
      } catch {
        return null;
      }
    })();
  }

  return dbPoolPromise;
}

function resolveRequestClass(event: Omit<AutonomyEvent, 'timestamp'> & { timestamp?: string }): RequestClass | undefined {
  const fromPayload = event.payload?.requestClass;
  if (fromPayload === 'single' || fromPayload === 'deliberation' || fromPayload === 'safety' || fromPayload === 'task') {
    return fromPayload;
  }

  if (event.eventType === 'safety_triggered') {
    return 'safety';
  }

  if (
    event.eventType === 'task_graph_created' ||
    event.eventType === 'proposal_created' ||
    event.eventType === 'proposal_approved' ||
    event.eventType === 'task_assigned' ||
    event.eventType === 'task_completed' ||
    event.eventType === 'task_failed' ||
    event.eventType === 'task_retried'
  ) {
    return 'task';
  }

  if (event.eventType === 'synthesis_completed') {
    return (event.riskScore ?? 0) >= 0.35 ? 'deliberation' : 'single';
  }

  return undefined;
}

function normalizeAutonomyEvent(
  event: Omit<AutonomyEvent, 'timestamp' | 'traceId' | 'turnId' | 'requestId' | 'userId'> & {
    timestamp?: string;
    traceId?: string;
    turnId?: string;
    requestId?: string;
    userId?: string | null;
  }
): AutonomyEvent {
  const traceId =
    event.traceId ||
    (typeof event.payload?.traceId === 'string' ? event.payload.traceId : null) ||
    `trace-${randomUUID()}`;
  const turnId =
    event.turnId ||
    (typeof event.payload?.turnId === 'string' ? event.payload.turnId : null) ||
    `turn-${randomUUID()}`;
  const requestId =
    event.requestId ||
    (typeof event.payload?.requestId === 'string' ? event.payload.requestId : null) ||
    `req-${randomUUID()}`;
  const requestClass = resolveRequestClass(event as any);
  const payload = {
    ...(event.payload || {}),
    ...(requestClass ? { requestClass } : {}),
  };

  return {
    timestamp: event.timestamp || new Date().toISOString(),
    traceId,
    turnId,
    requestId,
    eventType: event.eventType,
    userId: event.userId ?? null,
    projectId: event.projectId ?? null,
    teamId: event.teamId ?? null,
    conversationId: event.conversationId ?? null,
    hatchId: event.hatchId ?? null,
    provider: event.provider ?? null,
    mode: event.mode ?? null,
    latencyMs: typeof event.latencyMs === 'number' ? event.latencyMs : null,
    confidence: typeof event.confidence === 'number' ? event.confidence : null,
    riskScore: typeof event.riskScore === 'number' ? event.riskScore : null,
    payload,
  };
}

async function writeEventToFile(event: AutonomyEvent): Promise<void> {
  await ensureDir();
  await fs.appendFile(EVENTS_FILE, `${JSON.stringify(event)}\n`, 'utf8');
}

async function writeEventToDb(event: AutonomyEvent): Promise<boolean> {
  const pool = await getDbPool();
  if (!pool) {
    return false;
  }

  try {
    await pool.query(
      `
      insert into autonomy_events (
        trace_id,
        turn_id,
        request_id,
        "timestamp",
        user_id,
        project_id,
        team_id,
        conversation_id,
        hatch_id,
        provider,
        mode,
        latency_ms,
        confidence,
        risk_score,
        event_type,
        payload
      ) values (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb
      )
      `,
      [
        event.traceId,
        event.turnId,
        event.requestId,
        event.timestamp,
        event.userId,
        event.projectId,
        event.teamId,
        event.conversationId,
        event.hatchId,
        event.provider,
        event.mode,
        event.latencyMs,
        event.confidence,
        event.riskScore,
        event.eventType,
        JSON.stringify(event.payload || {}),
      ],
    );
    return true;
  } catch {
    return false;
  }
}

function mapDbRowToEvent(row: any): AutonomyEvent {
  return {
    timestamp: new Date(row.timestamp).toISOString(),
    traceId: row.trace_id,
    turnId: row.turn_id,
    requestId: row.request_id,
    eventType: row.event_type,
    userId: row.user_id ?? null,
    projectId: row.project_id ?? null,
    teamId: row.team_id ?? null,
    conversationId: row.conversation_id ?? null,
    hatchId: row.hatch_id ?? null,
    provider: row.provider ?? null,
    mode: row.mode ?? null,
    latencyMs: typeof row.latency_ms === 'number' ? row.latency_ms : null,
    confidence: typeof row.confidence === 'number' ? row.confidence : null,
    riskScore: typeof row.risk_score === 'number' ? row.risk_score : null,
    payload: row.payload || {},
  };
}

async function readEventsFromDb(limit: number): Promise<AutonomyEvent[] | null> {
  const pool = await getDbPool();
  if (!pool) {
    return null;
  }

  try {
    const result = await pool.query(
      `
      select
        trace_id,
        turn_id,
        request_id,
        "timestamp",
        user_id,
        project_id,
        team_id,
        conversation_id,
        hatch_id,
        provider,
        mode,
        latency_ms,
        confidence,
        risk_score,
        event_type,
        payload
      from autonomy_events
      order by "timestamp" desc
      limit $1
      `,
      [Math.max(1, limit)],
    );

    return result.rows.map(mapDbRowToEvent).reverse();
  } catch {
    return null;
  }
}

async function readEventsFromFile(limit: number): Promise<AutonomyEvent[]> {
  try {
    const raw = await fs.readFile(EVENTS_FILE, 'utf8');
    const lines = raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(-Math.max(1, limit));

    return lines
      .map((line) => {
        try {
          const parsed = JSON.parse(line) as AutonomyEvent;
          return normalizeAutonomyEvent(parsed as any);
        } catch {
          return null;
        }
      })
      .filter((entry): entry is AutonomyEvent => Boolean(entry));
  } catch {
    return [];
  }
}

export async function logAutonomyEvent(
  event: Omit<AutonomyEvent, 'timestamp' | 'traceId' | 'turnId' | 'requestId' | 'userId'> & {
    timestamp?: string;
    traceId?: string;
    turnId?: string;
    requestId?: string;
    userId?: string | null;
  }
): Promise<AutonomyEvent> {
  const fullEvent = normalizeAutonomyEvent(event);
  const wroteToDb = await writeEventToDb(fullEvent);
  if (!wroteToDb) {
    await writeEventToFile(fullEvent);
  }
  return fullEvent;
}

export async function readAutonomyEvents(limit = 500): Promise<AutonomyEvent[]> {
  const dbEvents = await readEventsFromDb(limit);
  const fileEvents = await readEventsFromFile(limit);

  if (!dbEvents) {
    return fileEvents;
  }

  const deduped = new Map<string, AutonomyEvent>();
  for (const event of [...dbEvents, ...fileEvents]) {
    const key = `${event.requestId}:${event.eventType}:${event.timestamp}`;
    deduped.set(key, event);
  }

  return [...deduped.values()]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .slice(-Math.max(1, limit));
}

export async function summarizeLatency(events: AutonomyEvent[]): Promise<{
  count: number;
  p50: number;
  p95: number;
}> {
  const latencies = events
    .map((event) => event.latencyMs)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    .sort((a, b) => a - b);

  if (latencies.length === 0) {
    return { count: 0, p50: 0, p95: 0 };
  }

  const quantile = (q: number): number => {
    const idx = Math.min(latencies.length - 1, Math.max(0, Math.floor(q * (latencies.length - 1))));
    return latencies[idx];
  };

  return {
    count: latencies.length,
    p50: quantile(0.5),
    p95: quantile(0.95),
  };
}
