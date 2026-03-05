import { promises as fs } from 'fs';
import path from 'path';
import type { AutonomyEvent } from './eventTypes.js';

const EVENTS_FILE = path.join(process.cwd(), 'baseline', 'autonomy-events.jsonl');

async function ensureDir(): Promise<void> {
  await fs.mkdir(path.dirname(EVENTS_FILE), { recursive: true });
}

export async function logAutonomyEvent(event: Omit<AutonomyEvent, 'timestamp'> & { timestamp?: string }): Promise<AutonomyEvent> {
  await ensureDir();

  const fullEvent: AutonomyEvent = {
    timestamp: event.timestamp || new Date().toISOString(),
    eventType: event.eventType,
    projectId: event.projectId ?? null,
    teamId: event.teamId ?? null,
    conversationId: event.conversationId ?? null,
    hatchId: event.hatchId ?? null,
    provider: event.provider ?? null,
    mode: event.mode ?? null,
    latencyMs: typeof event.latencyMs === 'number' ? event.latencyMs : null,
    confidence: typeof event.confidence === 'number' ? event.confidence : null,
    riskScore: typeof event.riskScore === 'number' ? event.riskScore : null,
    payload: event.payload,
  };

  await fs.appendFile(EVENTS_FILE, `${JSON.stringify(fullEvent)}\n`, 'utf8');
  return fullEvent;
}

export async function readAutonomyEvents(limit = 500): Promise<AutonomyEvent[]> {
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
          return JSON.parse(line) as AutonomyEvent;
        } catch {
          return null;
        }
      })
      .filter((entry): entry is AutonomyEvent => Boolean(entry));
  } catch {
    return [];
  }
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
