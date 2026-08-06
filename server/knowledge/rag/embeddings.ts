// Per-role RAG — embedding generation (Gemini).
// Uses @google/genai (already a dependency, wired for chat) so no new SDK.
// Documents and queries are embedded with DIFFERENT task types (Gemini's own recommendation):
// RETRIEVAL_DOCUMENT for stored knowledge chunks, RETRIEVAL_QUERY for the user's question.
// Vectors are L2-normalized so cosine distance in pgvector is stable across models/dims.
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';

// Pluggable embedder so a large corpus can be embedded off Gemini's free-tier 1000/day cap.
// RAG_EMBED_PROVIDER: 'gemini' (default) | 'openai' | 'ollama'. IMPORTANT: all stored chunks AND
// the query must use the SAME provider/model (one vector space) — switching providers means
// re-embedding the whole corpus. All providers emit EMBED_DIMS (768) to match the vector(768) column.
export const EMBED_PROVIDER = (process.env.RAG_EMBED_PROVIDER?.trim() || 'gemini').toLowerCase();
function defaultModelFor(p: string): string {
  if (p === 'openai') return 'text-embedding-3-small'; // supports the `dimensions` param
  if (p === 'ollama') return 'nomic-embed-text';        // natively 768-dim
  return 'gemini-embedding-001';
}
const EMBED_MODEL = process.env.RAG_EMBED_MODEL?.trim() || defaultModelFor(EMBED_PROVIDER);
export const EMBED_DIMS = Number(process.env.RAG_EMBED_DIMS ?? 768);
const HARD_TIMEOUT_MS = Number(process.env.RAG_EMBED_TIMEOUT_MS ?? 20_000);

export type EmbedTaskType = 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY';

let _genai: GoogleGenAI | null = null;
function geminiClient(): GoogleGenAI {
  if (_genai) return _genai;
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    const err = new Error('Gemini API key is missing (RAG embeddings)');
    (err as any).code = 'GEMINI_API_KEY_MISSING';
    throw err;
  }
  _genai = new GoogleGenAI({ apiKey });
  return _genai;
}

let _openai: OpenAI | null = null;
function openaiClient(): OpenAI {
  if (_openai) return _openai;
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error('OPENAI_API_KEY is missing (RAG_EMBED_PROVIDER=openai)');
  _openai = new OpenAI({ apiKey });
  return _openai;
}

/** Provider dispatch — returns a raw (un-normalized) embedding of EMBED_DIMS length. */
async function rawEmbed(text: string, taskType: EmbedTaskType, title?: string): Promise<number[]> {
  if (EMBED_PROVIDER === 'openai') {
    const res = await openaiClient().embeddings.create({ model: EMBED_MODEL, input: text, dimensions: EMBED_DIMS });
    return res.data[0].embedding as number[];
  }
  if (EMBED_PROVIDER === 'ollama') {
    const base = process.env.OLLAMA_BASE_URL || process.env.TEST_OLLAMA_BASE_URL || 'http://localhost:11434';
    const r = await fetch(`${base}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: EMBED_MODEL, prompt: text }),
      signal: AbortSignal.timeout(HARD_TIMEOUT_MS),
    });
    if (!r.ok) throw new Error(`ollama embed HTTP ${r.status}`);
    const j = (await r.json()) as { embedding?: number[] };
    if (!Array.isArray(j.embedding) || j.embedding.length === 0) throw new Error('ollama returned no embedding');
    return j.embedding;
  }
  // gemini (default): task-type-aware + optional title, reduced to EMBED_DIMS.
  const res = await geminiClient().models.embedContent({
    model: EMBED_MODEL,
    contents: text,
    config: {
      taskType,
      outputDimensionality: EMBED_DIMS,
      ...(title ? { title } : {}),
      abortSignal: AbortSignal.timeout(HARD_TIMEOUT_MS),
    },
  });
  const values = res.embeddings?.[0]?.values;
  if (!values || values.length === 0) throw new Error('gemini returned no embedding');
  return values;
}

/** L2-normalize so cosine distance (<=>) and inner product agree, and dims-reduced vectors stay comparable. */
function normalize(values: number[]): number[] {
  let sumSq = 0;
  for (const v of values) sumSq += v * v;
  const mag = Math.sqrt(sumSq);
  if (!mag || !isFinite(mag)) return values;
  return values.map((v) => v / mag);
}

const MAX_RETRIES = Number(process.env.RAG_EMBED_MAX_RETRIES ?? 5);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Optional pacing for free-tier bulk ingestion: set RAG_EMBED_MIN_INTERVAL_MS (e.g. 650 → ~92/min) to
// stay just under the 100/min cap and avoid the 429/backoff thrashing that concurrency causes. Default
// 0 (no pacing) so live chat retrieval stays fast; only ingestion scripts set the interval.
let lastEmbedAt = 0;
async function pace(): Promise<void> {
  const interval = Number(process.env.RAG_EMBED_MIN_INTERVAL_MS ?? 0);
  if (interval <= 0) return;
  const wait = lastEmbedAt + interval - Date.now();
  if (wait > 0) await sleep(wait);
  lastEmbedAt = Date.now();
}

function isRateLimit(err: unknown): boolean {
  const m = (err as Error)?.message ?? '';
  return /RESOURCE_EXHAUSTED|quota|rate.?limit|\b429\b/i.test(m);
}

// Parse the API's suggested retry delay ("retryDelay":"19s" or "retry in 19.4s"); default 21s.
function retryDelayMs(err: unknown): number {
  const m = (err as Error)?.message ?? '';
  const match = m.match(/retryDelay"?:?\s*"?(\d+(?:\.\d+)?)s|retry in (\d+(?:\.\d+)?)\s*s/i);
  const secs = match ? Number(match[1] ?? match[2]) : NaN;
  return Number.isFinite(secs) ? Math.ceil(secs * 1000) + 500 : 21_000;
}

async function embedOne(text: string, taskType: EmbedTaskType, title?: string): Promise<number[]> {
  const clean = (text ?? '').trim();
  if (!clean) throw new Error('embed: empty input text');
  let attempt = 0;
  // Retry on rate/quota limits (any provider): wait the suggested delay and resume.
  for (;;) {
    try {
      await pace(); // opt-in throttle for bulk ingestion (no-op in chat)
      const values = await rawEmbed(clean, taskType, title);
      if (!values || values.length === 0) throw new Error('embed: provider returned no embedding');
      return normalize(values);
    } catch (err) {
      if (isRateLimit(err) && attempt < MAX_RETRIES) {
        const wait = retryDelayMs(err);
        console.log(`[RAG] embed rate-limited, waiting ${Math.round(wait / 1000)}s then retrying (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await sleep(wait);
        attempt++;
        continue;
      }
      throw err;
    }
  }
}

/** Embed a knowledge chunk for storage. `title` sharpens the vector for retrieval-document task. */
export function embedDocument(text: string, title?: string): Promise<number[]> {
  return embedOne(text, 'RETRIEVAL_DOCUMENT', title);
}

/** Embed a user query for search. */
export function embedQuery(text: string): Promise<number[]> {
  return embedOne(text, 'RETRIEVAL_QUERY');
}

/** Format a JS number[] as a pgvector literal: [0.1,0.2,...]. */
export function toPgVector(values: number[]): string {
  return `[${values.join(',')}]`;
}

/** Cosine similarity for offline checks/tests (pgvector does this server-side in prod). */
export function cosineSim(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export const RAG_EMBED_MODEL = EMBED_MODEL;
