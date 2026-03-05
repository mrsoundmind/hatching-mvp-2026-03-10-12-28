import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import type { DeliberationTrace, DeliberationRoundTrace, PeerReviewTrace } from './deliberationTraceTypes.js';

const TRACE_FILE = path.join(process.cwd(), 'baseline', 'deliberation-traces.json');

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
    // fall through
  }
  return [];
}

async function writeAll(traces: DeliberationTrace[]): Promise<void> {
  await ensureStorage();
  await fs.writeFile(TRACE_FILE, JSON.stringify(traces, null, 2), 'utf8');
}

export async function createDeliberationTrace(input: {
  projectId: string;
  conversationId: string;
  objective: string;
  traceId?: string;
  rounds?: DeliberationRoundTrace[];
  review?: PeerReviewTrace[];
  finalSynthesis?: string;
}): Promise<DeliberationTrace> {
  const traces = await readAll();
  const now = new Date().toISOString();
  const trace: DeliberationTrace = {
    traceId: input.traceId || `trace-${randomUUID()}`,
    projectId: input.projectId,
    conversationId: input.conversationId,
    objective: input.objective,
    rounds: input.rounds || [],
    review: input.review || [],
    finalSynthesis: input.finalSynthesis,
    createdAt: now,
    updatedAt: now,
  };

  traces.push(trace);
  await writeAll(traces);
  return trace;
}

export async function appendDeliberationRound(traceId: string, round: DeliberationRoundTrace): Promise<DeliberationTrace | null> {
  const traces = await readAll();
  const idx = traces.findIndex((trace) => trace.traceId === traceId);
  if (idx === -1) return null;

  traces[idx].rounds.push(round);
  traces[idx].updatedAt = new Date().toISOString();
  await writeAll(traces);
  return traces[idx];
}

export async function appendPeerReview(traceId: string, review: PeerReviewTrace): Promise<DeliberationTrace | null> {
  const traces = await readAll();
  const idx = traces.findIndex((trace) => trace.traceId === traceId);
  if (idx === -1) return null;

  traces[idx].review.push(review);
  traces[idx].updatedAt = new Date().toISOString();
  await writeAll(traces);
  return traces[idx];
}

export async function finalizeDeliberationTrace(traceId: string, finalSynthesis: string): Promise<DeliberationTrace | null> {
  const traces = await readAll();
  const idx = traces.findIndex((trace) => trace.traceId === traceId);
  if (idx === -1) return null;

  traces[idx].finalSynthesis = finalSynthesis;
  traces[idx].updatedAt = new Date().toISOString();
  await writeAll(traces);
  return traces[idx];
}

export async function getDeliberationTrace(traceId: string): Promise<DeliberationTrace | null> {
  const traces = await readAll();
  return traces.find((trace) => trace.traceId === traceId) || null;
}

export async function listDeliberationTraces(limit = 100): Promise<DeliberationTrace[]> {
  const traces = await readAll();
  return traces.slice(-Math.max(1, limit));
}
