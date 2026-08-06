// RAG — ADD seed file(s) to role_knowledge WITHOUT wiping a role's existing chunks (replaceRoles:false).
// Idempotent via content_hash (exact-duplicate chunks are skipped). Use this to DEEPEN a role, not replace it.
// Run: ./node_modules/.bin/tsx -r dotenv/config scripts/ingest-add-seed.ts <file1.json> [file2.json ...]
import { readFileSync } from 'fs';
import { ingestSources, type SourceDoc } from '../server/knowledge/rag/ingest.js';
import { totalCount } from '../server/knowledge/rag/store.js';

function isValidDoc(d: any): d is SourceDoc {
  return d && typeof d.role === 'string' && typeof d.url === 'string' && typeof d.title === 'string'
    && typeof d.text === 'string' && d.text.trim().length > 50 && /^https?:\/\//.test(d.url);
}

async function main() {
  const files = process.argv.slice(2);
  if (!files.length) { console.error('usage: ingest-add-seed.ts <file.json> ...'); process.exit(1); }
  const all: SourceDoc[] = [];
  for (const f of files) {
    const parsed = JSON.parse(readFileSync(f, 'utf8'));
    if (!Array.isArray(parsed)) { console.log(`  WARN ${f}: not a JSON array, skipped`); continue; }
    const valid = parsed.filter(isValidDoc);
    const dropped = parsed.length - valid.length;
    console.log(`  ${f}: ${valid.length} valid docs${dropped ? ` (${dropped} dropped as malformed)` : ''}`);
    all.push(...valid);
  }
  const roles = new Set(all.map((d) => d.role));
  console.log(`\nAdding ${all.length} docs across ${roles.size} roles (replaceRoles=false, existing chunks kept)...\n`);
  const reports = await ingestSources(all, { replaceRoles: false, onProgress: (m) => console.log('  ' + m) });
  console.log('\n=== Ingestion report (by role) ===');
  for (const r of reports.sort((a, b) => a.roleKey.localeCompare(b.roleKey))) {
    console.log(`  ${r.role} (${r.roleKey}): ${r.docs} docs -> ${r.chunks} chunks, ${r.inserted} new`);
  }
  console.log(`\n  role_knowledge total rows: ${await totalCount()}`);
  process.exit(0);
}
main().catch((e) => { console.error('ERROR:', e?.message || e); process.exit(1); });
