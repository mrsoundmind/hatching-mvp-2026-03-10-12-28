// Document round-trip editor — schema (additive, raw SQL, outside Drizzle so db:push can't touch it).
//  1. conversation_documents gets a nullable raw_bytes column so the ORIGINAL file can be edited later
//     (attachments today keep only RAG chunks + metadata, not the file itself).
//  2. conversation_edited_documents stores the edited output bytes so the in-chat "Download" button is
//     durable across reloads. Both are idempotent (IF NOT EXISTS).
//
// Run: ./node_modules/.bin/tsx -r dotenv/config scripts/setup-document-edit-tables.ts
import { pool } from '../server/db.js';

async function main() {
  const q = (sql: string) => pool.query(sql);
  let pass = 0, fail = 0;
  const check = (name: string, cond: boolean) => { cond ? (pass++, console.log(`  ✓ ${name}`)) : (fail++, console.log(`  ✗ ${name}`)); };

  console.log('Setting up document-edit schema...\n');

  await q(`ALTER TABLE conversation_documents ADD COLUMN IF NOT EXISTS raw_bytes bytea`);
  const col = await q(`SELECT 1 FROM information_schema.columns WHERE table_name='conversation_documents' AND column_name='raw_bytes'`);
  check('conversation_documents.raw_bytes column exists', col.rowCount === 1);

  await q(`
    CREATE TABLE IF NOT EXISTS conversation_edited_documents (
      id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id          text,
      conversation_id     text,
      source_document_id  uuid,
      filename            text NOT NULL,
      mime                text,
      bytes               bytea NOT NULL,
      size_bytes          integer,
      created_by_user_id  text,
      created_at          timestamptz NOT NULL DEFAULT now()
    )
  `);
  const t = await q(`SELECT to_regclass('public.conversation_edited_documents') AS t`);
  check('conversation_edited_documents table exists', t.rows[0].t === 'conversation_edited_documents');

  await q(`CREATE INDEX IF NOT EXISTS conv_edited_conv_idx ON conversation_edited_documents (conversation_id, created_at)`);
  check('index created', true);

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error('ERROR:', e?.message || e); process.exit(1); });
