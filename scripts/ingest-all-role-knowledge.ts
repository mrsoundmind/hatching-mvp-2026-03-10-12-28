// RAG — ingest EVERY seed file under server/knowledge/rag/seed/ (spike + all batch files) in one pass.
// Idempotent (replaceRoles per role), validates each file, skips malformed ones with a clear warning.
// Run: ./node_modules/.bin/tsx -r dotenv/config scripts/ingest-all-role-knowledge.ts
import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { ingestSources, type SourceDoc } from '../server/knowledge/rag/ingest.js';
import { totalCount } from '../server/knowledge/rag/store.js';

function isValidDoc(d: any): d is SourceDoc {
  return d && typeof d.role === 'string' && typeof d.url === 'string' && typeof d.title === 'string'
    && typeof d.text === 'string' && d.text.trim().length > 50 && /^https?:\/\//.test(d.url);
}

async function main() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const seedDir = path.join(__dirname, '../server/knowledge/rag/seed');
  const files = readdirSync(seedDir).filter((f) => f.endsWith('.json')).sort();
  console.log(`Found ${files.length} seed files: ${files.join(', ')}\n`);

  const all: SourceDoc[] = [];
  for (const f of files) {
    try {
      const parsed = JSON.parse(readFileSync(path.join(seedDir, f), 'utf8'));
      if (!Array.isArray(parsed)) { console.log(`  WARN  ${f}: not a JSON array, skipped`); continue; }
      const valid = parsed.filter(isValidDoc);
      const dropped = parsed.length - valid.length;
      console.log(`  ${f}: ${valid.length} valid docs${dropped ? ` (${dropped} dropped as malformed)` : ''}`);
      all.push(...valid);
    } catch (e) {
      console.log(`  WARN  ${f}: JSON parse failed (${(e as Error).message}), skipped`);
    }
  }

  const roles = new Set(all.map((d) => d.role));
  console.log(`\nIngesting ${all.length} docs across ${roles.size} roles ...\n`);
  const reports = await ingestSources(all, { replaceRoles: true, onProgress: (m) => console.log('  ' + m) });

  console.log('\n=== Ingestion report (by role) ===');
  for (const r of reports.sort((a, b) => a.roleKey.localeCompare(b.roleKey))) {
    console.log(`  ${r.role} (${r.roleKey}): ${r.docs} docs -> ${r.chunks} chunks, ${r.inserted} stored`);
  }
  console.log(`\n  ${reports.length} roles ingested. role_knowledge total rows: ${await totalCount()}`);
  process.exit(0);
}
main().catch((e) => { console.error('ERROR:', e?.message || e); process.exit(1); });
