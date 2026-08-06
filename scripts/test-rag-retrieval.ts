// RAG step — prove retrieval end-to-end on the live corpus.
// Relevant queries must return the right cited chunk; an out-of-corpus query must return NOTHING
// (that empty result is what makes the agent admit "not in my sources" instead of fabricating).
// Run: ./node_modules/.bin/tsx -r dotenv/config scripts/test-rag-retrieval.ts
import { retrieveKnowledge } from '../server/knowledge/rag/retriever.js';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log(`  PASS  ${n}`); } else { fail++; console.log(`  FAIL  ${n}  ${d}`); } };

async function probe(role: string, query: string) {
  const { chunks } = await retrieveKnowledge(role, query);
  const top = chunks[0];
  console.log(`\n  [${role}] "${query}"`);
  if (top) console.log(`    -> ${(top.score).toFixed(3)}  ${top.sourceTitle}\n       ${top.sourceUrl}\n       "${top.chunk.slice(0, 110)}..."`);
  else console.log('    -> (no chunk cleared the relevance bar)');
  return chunks;
}

async function main() {
  // Relevant queries: expect a cited chunk from the expected source.
  const pm = await probe('Product Manager', 'What scoring formula can I use to rank competing product ideas by reach and impact?');
  check('PM prioritization retrieves a cited chunk', pm.length > 0);
  check('RICE article is among the retrieved PM citations', pm.some((c) => /intercom\.com/.test(c.sourceUrl ?? '')), pm.map((c) => c.sourceUrl).join(', '));

  const eng = await probe('Software Engineer', 'Should we start a new project with microservices or a monolith?');
  check('Engineer retrieves a cited chunk', eng.length > 0);
  check('Engineer top source is martinfowler', /martinfowler\.com/.test(eng[0]?.sourceUrl ?? ''), eng[0]?.sourceUrl);

  const seo = await probe('SEO Specialist', 'What percentage of web pages actually get organic search traffic?');
  check('SEO retrieves a cited chunk', seo.length > 0);
  check('SEO top source is the Ahrefs study', /ahrefs\.com/.test(seo[0]?.sourceUrl ?? ''), seo[0]?.sourceUrl);
  check('SEO chunk carries the real 96.55% figure', /96\.55/.test(seo.map((c) => c.chunk).join(' ')));

  // Out-of-corpus query: must return nothing (drives the "admit" path).
  const oob = await probe('Product Manager', 'What is the best GPU for training large language models at home?');
  check('out-of-corpus query returns NOTHING (enables admit-not-fabricate)', oob.length === 0, `got ${oob.length}`);

  // Role isolation: an SEO question against the PM corpus should not surface SEO chunks strongly.
  const cross = await retrieveKnowledge('Product Manager', 'how do I build topical authority with content clusters?');
  check('role isolation: PM corpus does not serve SEO topical-authority chunks', !cross.chunks.some((c) => /ahrefs\.com\/blog\/topical/.test(c.sourceUrl ?? '')));

  console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} — ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error('ERROR:', e?.message || e); process.exit(1); });
