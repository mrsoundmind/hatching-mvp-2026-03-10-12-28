// Per-role RAG — vector store access (raw pg on the shared app pool).
// role_knowledge is deliberately NOT a Drizzle table: the deploy uses `db:push`, Drizzle can't model a
// `vector` column, so keeping it out of the schema prevents a future push from altering/dropping it.
// The table is created + owned by scripts/setup-role-knowledge-table.ts.
import { createHash } from 'crypto';
import { pool } from '../../db.js';
import { toPgVector } from './embeddings.js';

export interface KnowledgeChunk {
  role: string;
  chunk: string;
  embedding: number[];
  sourceUrl?: string | null;
  sourceTitle?: string | null;
  sourceDate?: string | null;
  trustTier?: 'A' | 'B' | 'C';
}

export interface RetrievedChunk {
  chunk: string;
  role: string | null;        // owning role — needed for cross-role attribution
  sourceUrl: string | null;
  sourceTitle: string | null;
  sourceDate: string | null;
  trustTier: string | null;
  score: number; // cosine similarity in [0,1], higher = more relevant
}

/** Stable content hash for idempotent re-ingest (dedup within a role). */
export function contentHash(role: string, chunk: string): string {
  return createHash('sha256').update(`${role}::${chunk.trim().toLowerCase()}`).digest('hex');
}

/** Idempotent batch insert. Re-running ingestion won't duplicate rows (ON CONFLICT role+hash). */
export async function upsertChunks(chunks: KnowledgeChunk[]): Promise<number> {
  if (!chunks.length) return 0;
  const values: string[] = [];
  const params: any[] = [];
  let i = 1;
  for (const c of chunks) {
    values.push(`($${i++},$${i++},$${i++}::vector,$${i++},$${i++},$${i++},$${i++},$${i++})`);
    params.push(
      c.role,
      c.chunk,
      toPgVector(c.embedding),
      c.sourceUrl ?? null,
      c.sourceTitle ?? null,
      c.sourceDate ?? null,
      c.trustTier ?? 'B',
      contentHash(c.role, c.chunk),
    );
  }
  const sql = `
    INSERT INTO role_knowledge (role, chunk, embedding, source_url, source_title, source_date, trust_tier, content_hash)
    VALUES ${values.join(',')}
    ON CONFLICT (role, content_hash) DO NOTHING
  `;
  const res = await pool.query(sql, params);
  return res.rowCount ?? 0;
}

/**
 * Semantic top-K retrieval for a role. Returns only chunks at/above minScore (cosine similarity).
 * When nothing clears the bar it returns [] — that is the signal that lets the agent say
 * "not in my sources" instead of fabricating.
 */
export async function retrieveForRole(
  role: string,
  queryEmbedding: number[],
  opts: { k?: number; minScore?: number } = {},
): Promise<RetrievedChunk[]> {
  const k = opts.k ?? Number(process.env.RAG_TOP_K ?? 5);
  const minScore = opts.minScore ?? Number(process.env.RAG_MIN_SCORE ?? 0.55);
  const res = await pool.query(
    `SELECT role, chunk, source_url, source_title, source_date, trust_tier,
            1 - (embedding <=> $1::vector) AS score
       FROM role_knowledge
      WHERE role = $2 AND embedding IS NOT NULL
      ORDER BY embedding <=> $1::vector ASC
      LIMIT $3`,
    [toPgVector(queryEmbedding), role, k],
  );
  return res.rows.map(rowToChunk).filter((r) => r.score >= minScore);
}

function rowToChunk(r: any): RetrievedChunk {
  return {
    chunk: r.chunk as string,
    role: r.role ?? null,
    sourceUrl: r.source_url ?? null,
    sourceTitle: r.source_title ?? null,
    sourceDate: r.source_date ?? null,
    trustTier: r.trust_tier ?? null,
    score: Number(r.score),
  };
}

/** Dedup key so the SAME source/passage appearing under multiple roles collapses to one candidate. */
function dedupKey(c: RetrievedChunk): string {
  const body = c.chunk.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 160);
  return c.sourceUrl ? `${c.sourceUrl}::${body}` : body;
}

/**
 * THE MATRIX (cross-role vector search): search EVERY role's library, return the best chunks system-wide
 * with role attribution. Dedupes shared sources and caps per-role so one book can't dominate top-K.
 * Pulls a larger candidate pool from pgvector, then applies minScore + dedup + per-role cap in JS.
 */
export async function retrieveAcrossRoles(
  queryEmbedding: number[],
  opts: { k?: number; minScore?: number; perRoleCap?: number; pool?: number } = {},
): Promise<RetrievedChunk[]> {
  const k = opts.k ?? Number(process.env.RAG_XROLE_TOP_K ?? 6);
  const minScore = opts.minScore ?? Number(process.env.RAG_MIN_SCORE ?? 0.55);
  const perRoleCap = opts.perRoleCap ?? Number(process.env.RAG_XROLE_PER_ROLE_CAP ?? 2);
  const poolSize = opts.pool ?? Number(process.env.RAG_XROLE_POOL ?? 40);

  const res = await pool.query(
    `SELECT role, chunk, source_url, source_title, source_date, trust_tier,
            1 - (embedding <=> $1::vector) AS score
       FROM role_knowledge
      WHERE embedding IS NOT NULL
      ORDER BY embedding <=> $1::vector ASC
      LIMIT $2`,
    [toPgVector(queryEmbedding), poolSize],
  );

  const seen = new Set<string>();
  const perRole = new Map<string, number>();
  const out: RetrievedChunk[] = [];
  for (const c of res.rows.map(rowToChunk)) {
    if (c.score < minScore) continue;
    const key = dedupKey(c);
    if (seen.has(key)) continue;
    const roleKey = c.role ?? '_';
    if ((perRole.get(roleKey) ?? 0) >= perRoleCap) continue;
    seen.add(key);
    perRole.set(roleKey, (perRole.get(roleKey) ?? 0) + 1);
    out.push(c);
    if (out.length >= k) break;
  }
  return out;
}

export interface RankedRow extends RetrievedChunk { id: string; }

/** Raw vector candidates across all roles (no dedup/cap) — for hybrid fusion. */
export async function vectorCandidates(queryEmbedding: number[], limit: number): Promise<RankedRow[]> {
  const res = await pool.query(
    `SELECT id, role, chunk, source_url, source_title, source_date, trust_tier,
            1 - (embedding <=> $1::vector) AS score
       FROM role_knowledge WHERE embedding IS NOT NULL
      ORDER BY embedding <=> $1::vector ASC LIMIT $2`,
    [toPgVector(queryEmbedding), limit],
  );
  return res.rows.map((r) => ({ ...rowToChunk(r), id: r.id as string }));
}

/**
 * Raw keyword (full-text) candidates across all roles — for hybrid fusion. Catches exact terms
 * (framework names, acronyms like RICE/AARRR/LUFS/hreflang) that embeddings can fuzz. Returns [] on
 * no lexical match or if full-text isn't available.
 */
export async function keywordCandidates(queryText: string, limit: number): Promise<RankedRow[]> {
  const q = (queryText || '').trim();
  if (!q) return [];
  try {
    const res = await pool.query(
      `SELECT id, role, chunk, source_url, source_title, source_date, trust_tier,
              ts_rank(to_tsvector('english', chunk), plainto_tsquery('english', $1)) AS score
         FROM role_knowledge
        WHERE to_tsvector('english', chunk) @@ plainto_tsquery('english', $1)
        ORDER BY score DESC LIMIT $2`,
      [q, limit],
    );
    return res.rows.map((r) => ({ ...rowToChunk(r), id: r.id as string }));
  } catch {
    return [];
  }
}

export async function countForRole(role: string): Promise<number> {
  const res = await pool.query(`SELECT count(*)::int AS n FROM role_knowledge WHERE role = $1`, [role]);
  return res.rows[0].n as number;
}

/** Wipe one role's corpus (used for clean re-ingest of a role). */
export async function deleteRole(role: string): Promise<number> {
  const res = await pool.query(`DELETE FROM role_knowledge WHERE role = $1`, [role]);
  return res.rowCount ?? 0;
}

export async function totalCount(): Promise<number> {
  const res = await pool.query(`SELECT count(*)::int AS n FROM role_knowledge`);
  return res.rows[0].n as number;
}

// Which roles actually have a corpus — cached so uncovered roles skip the embedding call entirely
// (zero added chat latency for the roles we haven't ingested yet).
let corpusRolesCache: { at: number; roles: Set<string> } | null = null;
const CORPUS_ROLES_TTL_MS = Number(process.env.RAG_CORPUS_ROLES_TTL_MS ?? 5 * 60 * 1000);

export async function rolesWithCorpus(): Promise<Set<string>> {
  const now = Date.now();
  if (corpusRolesCache && now - corpusRolesCache.at < CORPUS_ROLES_TTL_MS) return corpusRolesCache.roles;
  try {
    const res = await pool.query(`SELECT DISTINCT role FROM role_knowledge`);
    const roles = new Set<string>(res.rows.map((r) => r.role as string));
    corpusRolesCache = { at: now, roles };
    return roles;
  } catch {
    return corpusRolesCache?.roles ?? new Set<string>();
  }
}
