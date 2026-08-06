// Per-role RAG — ingestion (chunk -> embed -> store).
// Kept separate from source-gathering on purpose: gathering real pages is done by a human/agent using
// vetted sources and written into a seed corpus (auditable), then this ingests it idempotently.
import { embedDocument } from './embeddings.js';
import { upsertChunks, deleteRole, type KnowledgeChunk } from './store.js';
import { ragRoleKey } from './retriever.js';
import { isInjectionLike } from '../../tools/web/webPolicy.js';

export interface SourceDoc {
  role: string;            // human role label or key; normalized on ingest
  url: string;
  title: string;
  date?: string;           // ISO-ish "2024-03" or "2024-03-15"
  trustTier?: 'A' | 'B' | 'C';
  text: string;            // faithful extract of the real page
}

const MAX_CHARS = Number(process.env.RAG_CHUNK_MAX_CHARS ?? 900);
const MIN_CHARS = Number(process.env.RAG_CHUNK_MIN_CHARS ?? 200);

/** Paragraph-first chunking with a char budget; merges short paras, splits long ones on sentence bounds. */
export function chunkText(text: string, maxChars = MAX_CHARS, minChars = MIN_CHARS): string[] {
  const paras = (text || '')
    .replace(/\r/g, '')
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let buf = '';
  const flush = () => { if (buf.trim().length) { chunks.push(buf.trim()); buf = ''; } };

  for (const para of paras) {
    if (para.length > maxChars) {
      flush();
      const sentences = para.split(/(?<=[.!?])\s+/);
      let s = '';
      for (const sent of sentences) {
        if ((s + ' ' + sent).trim().length > maxChars) { if (s.trim()) chunks.push(s.trim()); s = sent; }
        else { s = (s ? s + ' ' : '') + sent; }
      }
      if (s.trim()) chunks.push(s.trim());
    } else if ((buf + '\n\n' + para).trim().length > maxChars) {
      flush();
      buf = para;
    } else {
      buf = buf ? `${buf}\n\n${para}` : para;
    }
  }
  flush();
  // Drop fragments that are too short to be useful knowledge.
  return chunks.filter((c) => c.length >= minChars);
}

export interface StructuredChunk { chunk: string; section: string | null; }

// Books/courses have structure; naive paragraph chunking scatters a framework across chunks. This
// splits on markdown headings, keeps each section's content together, and prepends the heading so each
// chunk stands alone (better retrieval + a precise "— <section>" citation). Falls back to chunkText
// when the text has no headings (e.g. the web extracts), so it's safe for every source.
const STRUCT_MIN_CHARS = Number(process.env.RAG_STRUCT_MIN_CHARS ?? 120);
export function chunkStructured(text: string, maxChars = MAX_CHARS): StructuredChunk[] {
  const clean = (text || '').replace(/\r/g, '');
  const lines = clean.split('\n');
  const sections: Array<{ heading: string | null; body: string }> = [];
  let cur: { heading: string | null; body: string } = { heading: null, body: '' };
  for (const line of lines) {
    const h = line.match(/^#{1,6}\s+(.*\S)\s*$/);
    if (h) { if (cur.body.trim() || cur.heading) sections.push(cur); cur = { heading: h[1].trim(), body: '' }; }
    else cur.body += line + '\n';
  }
  if (cur.body.trim() || cur.heading) sections.push(cur);

  const out: StructuredChunk[] = [];
  for (const s of sections) {
    for (const piece of chunkText(s.body, maxChars, STRUCT_MIN_CHARS)) {
      out.push({ chunk: s.heading ? `${s.heading}\n${piece}` : piece, section: s.heading });
    }
  }
  if (!out.length) return chunkText(clean, maxChars).map((c) => ({ chunk: c, section: null }));
  return out;
}

/** Bounded-concurrency map — parallelizes embedding within the provider's rate budget (429 retry backstops overshoot). */
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => { while (next < items.length) { const i = next++; results[i] = await fn(items[i], i); } };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return results;
}

export interface IngestReport {
  role: string;
  roleKey: string;
  docs: number;
  chunks: number;
  inserted: number;
}

/**
 * Ingest a set of source docs for the roles they name. `replaceRoles` wipes those roles first for a
 * clean re-ingest. Embeds sequentially (small corpora; keeps us under provider rate limits).
 */
export async function ingestSources(
  docs: SourceDoc[],
  opts: { replaceRoles?: boolean; onProgress?: (msg: string) => void } = {},
): Promise<IngestReport[]> {
  const log = opts.onProgress ?? (() => {});
  const byRole = new Map<string, SourceDoc[]>();
  for (const d of docs) {
    const key = ragRoleKey(d.role);
    if (!byRole.has(key)) byRole.set(key, []);
    byRole.get(key)!.push(d);
  }

  const reports: IngestReport[] = [];
  for (const [roleKey, roleDocs] of byRole) {
    if (opts.replaceRoles) {
      const removed = await deleteRole(roleKey);
      log(`[${roleKey}] cleared ${removed} existing rows`);
    }
    const concurrency = Number(process.env.RAG_INGEST_CONCURRENCY ?? 4);
    let chunkCount = 0;
    let inserted = 0;
    let dropped = 0;
    for (const doc of roleDocs) {
      const structured = chunkStructured(doc.text).filter((s) => {
        if (isInjectionLike(s.chunk)) { dropped++; return false; } // OWASP LLM01: never ingest injection payloads
        return true;
      });
      const rows = await mapWithConcurrency(structured, concurrency, async (s) => {
        const sourceTitle = s.section ? `${doc.title} — ${s.section}` : doc.title;
        const embedding = await embedDocument(s.chunk, sourceTitle);
        return {
          role: roleKey,
          chunk: s.chunk,
          embedding,
          sourceUrl: doc.url,
          sourceTitle,
          sourceDate: doc.date ?? null,
          trustTier: doc.trustTier ?? 'B',
        } as KnowledgeChunk;
      });
      const n = await upsertChunks(rows);
      chunkCount += rows.length;
      inserted += n;
      log(`[${roleKey}] ${doc.title}: ${rows.length} chunks, ${n} new`);
    }
    if (dropped) log(`[${roleKey}] dropped ${dropped} chunk(s) flagged as injection-like`);
    reports.push({ role: roleDocs[0].role, roleKey, docs: roleDocs.length, chunks: chunkCount, inserted });
  }
  return reports;
}
