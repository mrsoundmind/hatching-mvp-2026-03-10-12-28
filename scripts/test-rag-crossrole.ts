// Phase 0A proof — the cross-role router (retrieveAcrossRoles) searches EVERY library and returns the
// best chunks system-wide with role attribution, deduped + per-role capped.
// Run: ./node_modules/.bin/tsx -r dotenv/config scripts/test-rag-crossrole.ts
import { embedQuery } from '../server/knowledge/rag/embeddings.js';
import { retrieveAcrossRoles } from '../server/knowledge/rag/store.js';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log(`  PASS  ${n}`); } else { fail++; console.log(`  FAIL  ${n}  ${d}`); } };
const CAP = Number(process.env.RAG_XROLE_PER_ROLE_CAP ?? 2);

async function probe(q: string) {
  const chunks = await retrieveAcrossRoles(await embedQuery(q), { k: 6 });
  console.log(`\n  "${q}"`);
  for (const c of chunks) console.log(`    [${c.role}] ${c.score.toFixed(3)}  ${c.sourceTitle}  ·  ${(c.sourceUrl ?? '').replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}`);
  return chunks;
}

async function main() {
  // 1. A genuinely cross-domain problem should draw on MORE THAN ONE role.
  const a = await probe('How do I design an onboarding flow that gets new users to activate and stick?');
  const rolesA = new Set(a.map((c) => c.role));
  check('cross-domain query returns a result', a.length > 0);
  check('draws on MORE THAN ONE role (cross-role works)', rolesA.size >= 2, `roles=${[...rolesA].join(', ')}`);

  // 2. Per-role cap respected (no single role dominates).
  const counts = new Map<string, number>();
  for (const c of a) counts.set(c.role ?? '_', (counts.get(c.role ?? '_') ?? 0) + 1);
  check(`no role exceeds the per-role cap (${CAP})`, [...counts.values()].every((n) => n <= CAP), [...counts].map(([r, n]) => `${r}:${n}`).join(', '));

  // 3. Dedup: no two returned chunks share a source+text key.
  const keys = a.map((c) => `${c.sourceUrl}::${c.chunk.slice(0, 80)}`);
  check('no duplicate sources in the result', new Set(keys).size === keys.length);

  // 4. Cross-role relevance: an SEO question surfaces an SEO/Google source even though no role is fixed.
  const b = await probe('does schema markup or backlinks help my google search rankings?');
  check('SEO question surfaces a search source system-wide', b.some((c) => /ahrefs|google|search/i.test((c.sourceUrl ?? '') + (c.sourceTitle ?? ''))), b.map((c) => c.role).join(', '));

  console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} — ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error('ERROR:', e?.message || e); process.exit(1); });
