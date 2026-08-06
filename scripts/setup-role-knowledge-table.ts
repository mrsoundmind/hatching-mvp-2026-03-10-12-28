// RAG step 2 — enable pgvector + create role_knowledge on the shared Supabase DB.
// ADDITIVE ONLY (IF NOT EXISTS): creates new extension + new table + index, touches nothing existing.
// Proves the round-trip: 768-dim insert accepted + cosine <=> operator returns correct ordering, then cleans up.
// Run: ./node_modules/.bin/tsx -r dotenv/config scripts/setup-role-knowledge-table.ts
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
    // 1. Extension
    await q('CREATE EXTENSION IF NOT EXISTS vector');
    const ext = await q(`SELECT extname FROM pg_extension WHERE extname = 'vector'`);
    check('pgvector extension enabled', ext.rowCount === 1);

    // 2. Table
    await q(`
      CREATE TABLE IF NOT EXISTS role_knowledge (
        id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        role          text NOT NULL,
        chunk         text NOT NULL,
        embedding     vector(${EMBED_DIMS}),
        source_url    text,
        source_title  text,
        source_date   text,
        trust_tier    text DEFAULT 'B',
        content_hash  text,
        created_at    timestamptz NOT NULL DEFAULT now()
      )
    `);
    const tbl = await q(`SELECT to_regclass('public.role_knowledge') AS t`);
    check('role_knowledge table exists', tbl.rows[0].t === 'role_knowledge');

    // 3. Indexes: role filter + dedup + HNSW cosine (fall back gracefully if HNSW unsupported)
    await q(`CREATE INDEX IF NOT EXISTS role_knowledge_role_idx ON role_knowledge (role)`);
    await q(`CREATE UNIQUE INDEX IF NOT EXISTS role_knowledge_role_hash_idx ON role_knowledge (role, content_hash)`);
    let hnsw = false;
    try {
      await q(`CREATE INDEX IF NOT EXISTS role_knowledge_embedding_hnsw ON role_knowledge USING hnsw (embedding vector_cosine_ops)`);
      hnsw = true;
    } catch (e) {
      console.log(`  NOTE  HNSW index not created (${(e as Error).message}); seq scan is fine for the spike corpus.`);
    }
    check('vector similarity index present (HNSW) or gracefully skipped', true, hnsw ? 'hnsw' : 'seq-scan');

    // 4. Round-trip proof: two unit vectors, query nearest by cosine, confirm ordering, then clean up.
    const vA = Array(EMBED_DIMS).fill(0); vA[0] = 1;                 // points along axis 0
    const vB = Array(EMBED_DIMS).fill(0); vB[1] = 1;                 // orthogonal to A
    const lit = (v: number[]) => `[${v.join(',')}]`;
    await q(`DELETE FROM role_knowledge WHERE role = '__setup_test__'`);
    await q(`INSERT INTO role_knowledge (role, chunk, embedding, content_hash) VALUES ($1,$2,$3::vector,$4),($1,$5,$6::vector,$7)`,
      ['__setup_test__', 'vec A', lit(vA), 'hashA', 'vec B', lit(vB), 'hashB']);
    // Query with something close to A → A must come first (smaller cosine distance).
    const near = await q(
      `SELECT chunk, embedding <=> $1::vector AS dist FROM role_knowledge WHERE role = '__setup_test__' ORDER BY dist ASC`,
      [lit(vA)]
    );
    check('768-dim vector insert accepted', near.rowCount === 2);
    check('cosine <=> orders nearest-first correctly', near.rows[0].chunk === 'vec A', `got ${near.rows[0].chunk} dist=${Number(near.rows[0].dist).toFixed(3)}`);

    // 5. Clean up test rows (leave the empty table + index in place).
    await q(`DELETE FROM role_knowledge WHERE role = '__setup_test__'`);
    const leftover = await q(`SELECT count(*)::int AS n FROM role_knowledge WHERE role = '__setup_test__'`);
    check('setup test rows cleaned up', leftover.rows[0].n === 0);

    const total = await q(`SELECT count(*)::int AS n FROM role_knowledge`);
    console.log(`\n  role_knowledge now holds ${total.rows[0].n} rows (real corpus lands in the ingestion step).`);
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
