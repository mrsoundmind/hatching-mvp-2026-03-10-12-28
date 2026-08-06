// RAG corpus health — per-role depth, source diversity, and trust-tier mix, so deepening is data-driven.
// Read-only. Run: ./node_modules/.bin/tsx -r dotenv/config scripts/rag-corpus-health.ts
import { pool } from '../server/db.js';
import { ROLE_DEFINITIONS } from '../shared/roleRegistry.js';
import { ragRoleKey } from '../server/knowledge/rag/retriever.js';

const THIN_CHUNKS = Number(process.env.RAG_THIN_CHUNKS ?? 35);   // below this = candidate to deepen
const THIN_SOURCES = Number(process.env.RAG_THIN_SOURCES ?? 12); // below this = narrow source base

async function main() {
  const rows = (await pool.query(`
    SELECT role,
           count(*)::int AS chunks,
           count(DISTINCT source_url)::int AS sources,
           count(*) FILTER (WHERE trust_tier = 'A')::int AS a,
           count(*) FILTER (WHERE trust_tier = 'B')::int AS b,
           count(*) FILTER (WHERE trust_tier = 'C')::int AS c
    FROM role_knowledge GROUP BY role
  `)).rows as Array<{ role: string; chunks: number; sources: number; a: number; b: number; c: number }>;

  const byKey = new Map(rows.map((r) => [r.role, r]));
  const registry = ROLE_DEFINITIONS.map((d) => ({ label: d.role, key: ragRoleKey(d.role) }));

  const report = registry.map(({ label, key }) => {
    const r = byKey.get(key);
    return {
      label, key,
      chunks: r?.chunks ?? 0,
      sources: r?.sources ?? 0,
      aPct: r && r.chunks ? Math.round((r.a / r.chunks) * 100) : 0,
    };
  }).sort((x, y) => x.chunks - y.chunks);

  const total = report.reduce((s, r) => s + r.chunks, 0);
  console.log(`\n=== RAG corpus health: ${report.length} roles, ${total} chunks ===`);
  console.log(`(thin thresholds: <${THIN_CHUNKS} chunks or <${THIN_SOURCES} sources)\n`);
  console.log(`  ${'role'.padEnd(28)} ${'chunks'.padStart(6)} ${'sources'.padStart(7)} ${'A-tier%'.padStart(7)}  flag`);
  for (const r of report) {
    const thin = r.chunks < THIN_CHUNKS || r.sources < THIN_SOURCES;
    console.log(`  ${r.label.padEnd(28)} ${String(r.chunks).padStart(6)} ${String(r.sources).padStart(7)} ${String(r.aPct + '%').padStart(7)}  ${r.chunks === 0 ? 'EMPTY' : thin ? 'deepen' : 'ok'}`);
  }

  const deepen = report.filter((r) => r.chunks > 0 && (r.chunks < THIN_CHUNKS || r.sources < THIN_SOURCES));
  const empty = report.filter((r) => r.chunks === 0);
  console.log(`\n=== Recommendation ===`);
  if (empty.length) console.log(`  EMPTY (no corpus): ${empty.map((r) => r.label).join(', ')}`);
  console.log(`  Deepen next (thin): ${deepen.length ? deepen.map((r) => `${r.label} (${r.chunks})`).join(', ') : 'none, all roles above threshold'}`);
  console.log(`  Deepest: ${report[report.length - 1].label} (${report[report.length - 1].chunks})`);
  await pool.end();
  process.exit(0);
}
main().catch((e) => { console.error('ERROR:', e?.message || e); process.exit(1); });
