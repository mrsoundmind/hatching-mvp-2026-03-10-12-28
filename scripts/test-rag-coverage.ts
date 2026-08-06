// RAG — final coverage check: every registry role has a corpus, plus retrieval probes.
// Role list is derived from ROLE_DEFINITIONS so it never drifts when a role is added (e.g. Finance Analyst / Juhi).
// Run: ./node_modules/.bin/tsx -r dotenv/config scripts/test-rag-coverage.ts
import { pool } from '../server/db.js';
import { ragRoleKey, retrieveKnowledge } from '../server/knowledge/rag/retriever.js';
import { ROLE_DEFINITIONS } from '../shared/roleRegistry.js';

const ROLES = ROLE_DEFINITIONS.map((r) => r.role);
const ROLE_COUNT = ROLES.length;

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; } else { fail++; console.log(`  FAIL  ${n}  ${d}`); } };

async function main() {
  const rows = (await pool.query(`SELECT role, count(*)::int AS n FROM role_knowledge GROUP BY role`)).rows as Array<{ role: string; n: number }>;
  const byKey = new Map(rows.map((r) => [r.role, r.n]));

  console.log(`=== Per-role coverage (all ${ROLE_COUNT} registry roles) ===`);
  let covered = 0, totalChunks = 0;
  for (const label of ROLES) {
    const key = ragRoleKey(label);
    const n = byKey.get(key) ?? 0;
    if (n > 0) covered++;
    totalChunks += n;
    check(`${label} covered`, n > 0, `key=${key} rows=0`);
    console.log(`  ${n > 0 ? 'ok ' : 'MISS'} ${label.padEnd(22)} ${key.padEnd(22)} ${n} chunks`);
  }
  console.log(`\n  ${covered}/${ROLE_COUNT} roles covered, ${totalChunks} chunks total`);
  check(`all ${ROLE_COUNT} roles covered`, covered === ROLE_COUNT, `${covered}/${ROLE_COUNT}`);

  // Any stray role keys not in the registry (typo guard)?
  const registryKeys = new Set(ROLES.map(ragRoleKey));
  const strays = rows.map((r) => r.role).filter((k) => !registryKeys.has(k));
  check('no stray/misspelled role keys in the store', strays.length === 0, strays.join(', '));

  console.log('\n=== Retrieval probes (last batch) ===');
  const probes: Array<[string, string, RegExp]> = [
    ['Business Strategist', 'How do I analyze the competitive forces in my market?', /hbs\.edu|isc\.hbs|blueocean/],
    ['Data Analyst', 'How should I model a data warehouse for analytics?', /kimball|getdbt/],
    ['HR Specialist', 'What actually makes a team effective, according to the research?', /rework\.withgoogle|re-?work|withgoogle|shrm/],
  ];
  for (const [role, q, expect] of probes) {
    const { chunks } = await retrieveKnowledge(role, q);
    const top = chunks[0];
    console.log(`  [${role}] "${q}"\n    -> ${top ? top.score.toFixed(3) + '  ' + top.sourceTitle + '  ' + top.sourceUrl : '(none)'}`);
    check(`${role} retrieves expected source`, chunks.some((c) => expect.test((c.sourceUrl ?? '').toLowerCase())), top?.sourceUrl ?? 'none');
  }

  console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} — ${pass} passed, ${fail} failed`);
  await pool.end();
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error('ERROR:', e?.message || e); process.exit(1); });
