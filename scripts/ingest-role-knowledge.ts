// RAG step — ingest the curated seed corpus into role_knowledge (chunk -> embed -> store, idempotent).
// Run: ./node_modules/.bin/tsx -r dotenv/config scripts/ingest-role-knowledge.ts [path-to-corpus.json]
// Default corpus: server/knowledge/rag/seed/spike-corpus.json
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { ingestSources, type SourceDoc } from '../server/knowledge/rag/ingest.js';
import { totalCount } from '../server/knowledge/rag/store.js';

async function main() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const corpusPath = process.argv[2] || path.join(__dirname, '../server/knowledge/rag/seed/spike-corpus.json');
  const docs = JSON.parse(readFileSync(corpusPath, 'utf8')) as SourceDoc[];
  console.log(`Ingesting ${docs.length} source docs from ${path.basename(corpusPath)} ...\n`);

  const reports = await ingestSources(docs, { replaceRoles: true, onProgress: (m) => console.log('  ' + m) });

  console.log('\n=== Ingestion report ===');
  for (const r of reports) {
    console.log(`  ${r.role} (${r.roleKey}): ${r.docs} docs -> ${r.chunks} chunks, ${r.inserted} stored`);
  }
  console.log(`\n  role_knowledge total rows: ${await totalCount()}`);
  process.exit(0);
}
main().catch((e) => { console.error('ERROR:', e?.message || e); process.exit(1); });
