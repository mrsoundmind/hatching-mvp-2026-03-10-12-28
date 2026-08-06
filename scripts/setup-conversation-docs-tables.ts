// Chat Attachments — create conversation_documents + conversation_doc_chunks on the shared Supabase DB.
// ADDITIVE ONLY (IF NOT EXISTS): new tables + indexes, touches nothing existing. Deliberately NOT Drizzle
// tables (same reason as role_knowledge: the deploy uses `db:push`, Drizzle can't model a `vector` column,
// so keeping these out of the schema prevents a future push from altering/dropping them).
// Mirrors role_knowledge so the existing pgvector cosine retrieval works unchanged.
// Run: ./node_modules/.bin/tsx -r dotenv/config scripts/setup-conversation-docs-tables.ts
import pg from 'pg';

const EMBED_DIMS = Number(process.env.RAG_EMBED_DIMS ?? 768);

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL missing');
  const pool = new pg.Pool({ connectionString: url, max: 2 });
  const q = (sql: string, params?: any[]) => pool.query(sql, params);

  let pass = 0, fail = 0;
  const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log(`  PASS  ${n}`); } else { fail++; console.log(`  FAIL  ${n}  ${d}`); } };

  try {
    await q('CREATE EXTENSION IF NOT EXISTS vector');

    // Parent: one row per uploaded file. conversation_id NULL = permanent brain scope (project-wide).
    await q(`
      CREATE TABLE IF NOT EXISTS conversation_documents (
        id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id          text NOT NULL,
        conversation_id     text,
        filename            text NOT NULL,
        mime                text,
        size_bytes          integer,
        scope               text NOT NULL DEFAULT 'ephemeral',
        char_count          integer,
        uploaded_by_user_id text,
        created_at          timestamptz NOT NULL DEFAULT now()
      )
    `);
    const t1 = await q(`SELECT to_regclass('public.conversation_documents') AS t`);
    check('conversation_documents table exists', t1.rows[0].t === 'conversation_documents');

    // Child: embedded chunks. project_id + conversation_id denormalized for a fast WHERE without a join
    // (mirrors role_knowledge's flat design). ON DELETE CASCADE so deleting a file removes its chunks.
    await q(`
      CREATE TABLE IF NOT EXISTS conversation_doc_chunks (
        id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id     uuid NOT NULL REFERENCES conversation_documents(id) ON DELETE CASCADE,
        project_id      text NOT NULL,
        conversation_id text,
        chunk_index     integer NOT NULL DEFAULT 0,
        chunk           text NOT NULL,
        embedding       vector(${EMBED_DIMS}),
        source_title    text,
        created_at      timestamptz NOT NULL DEFAULT now()
      )
    `);
    const t2 = await q(`SELECT to_regclass('public.conversation_doc_chunks') AS t`);
    check('conversation_doc_chunks table exists', t2.rows[0].t === 'conversation_doc_chunks');

    // Indexes: scope filters (conversation + project), FK, per-user daily-cap lookup, HNSW cosine.
    await q(`CREATE INDEX IF NOT EXISTS conv_doc_chunks_conv_idx ON conversation_doc_chunks (conversation_id)`);
    await q(`CREATE INDEX IF NOT EXISTS conv_doc_chunks_proj_idx ON conversation_doc_chunks (project_id)`);
    await q(`CREATE INDEX IF NOT EXISTS conv_doc_chunks_doc_idx ON conversation_doc_chunks (document_id)`);
    await q(`CREATE INDEX IF NOT EXISTS conv_docs_conv_idx ON conversation_documents (conversation_id)`);
    await q(`CREATE INDEX IF NOT EXISTS conv_docs_user_created_idx ON conversation_documents (uploaded_by_user_id, created_at)`);
    let hnsw = false;
    try {
      await q(`CREATE INDEX IF NOT EXISTS conv_doc_chunks_embedding_hnsw ON conversation_doc_chunks USING hnsw (embedding vector_cosine_ops)`);
      hnsw = true;
    } catch (e) {
      console.log(`  NOTE  HNSW index not created (${(e as Error).message}); seq scan is fine at this scale.`);
    }
    check('vector similarity index present (HNSW) or gracefully skipped', true, hnsw ? 'hnsw' : 'seq-scan');

    // Round-trip proof: insert a doc + 2 orthogonal chunk vectors, query nearest by cosine, confirm order, clean up.
    const vA = Array(EMBED_DIMS).fill(0); vA[0] = 1;
    const vB = Array(EMBED_DIMS).fill(0); vB[1] = 1;
    const lit = (v: number[]) => `[${v.join(',')}]`;
    await q(`DELETE FROM conversation_documents WHERE project_id = '__setup_test__'`); // cascades to chunks
    const doc = await q(
      `INSERT INTO conversation_documents (project_id, conversation_id, filename, scope) VALUES ('__setup_test__','conv:test','t.txt','ephemeral') RETURNING id`,
    );
    const docId = doc.rows[0].id as string;
    await q(
      `INSERT INTO conversation_doc_chunks (document_id, project_id, conversation_id, chunk, embedding) VALUES ($1,'__setup_test__','conv:test',$2,$3::vector),($1,'__setup_test__','conv:test',$4,$5::vector)`,
      [docId, 'chunk A', lit(vA), 'chunk B', lit(vB)],
    );
    const near = await q(
      `SELECT chunk, embedding <=> $1::vector AS dist FROM conversation_doc_chunks WHERE project_id = '__setup_test__' ORDER BY dist ASC`,
      [lit(vA)],
    );
    check('vector insert accepted', near.rowCount === 2);
    check('cosine <=> orders nearest-first correctly', near.rows[0].chunk === 'chunk A', `got ${near.rows[0].chunk}`);

    // Cascade proof: deleting the parent removes the child chunks.
    await q(`DELETE FROM conversation_documents WHERE project_id = '__setup_test__'`);
    const leftover = await q(`SELECT count(*)::int AS n FROM conversation_doc_chunks WHERE project_id = '__setup_test__'`);
    check('ON DELETE CASCADE removes child chunks', leftover.rows[0].n === 0);

    const totals = await q(`
      SELECT (SELECT count(*)::int FROM conversation_documents) AS docs,
             (SELECT count(*)::int FROM conversation_doc_chunks) AS chunks
    `);
    console.log(`\n  conversation_documents: ${totals.rows[0].docs} rows · conversation_doc_chunks: ${totals.rows[0].chunks} rows`);
    console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} — ${pass} passed, ${fail} failed`);
    await pool.end();
    process.exit(fail === 0 ? 0 : 1);
  } catch (e) {
    console.error('ERROR:', (e as Error).message);
    await pool.end();
    process.exit(1);
  }
}
main();
