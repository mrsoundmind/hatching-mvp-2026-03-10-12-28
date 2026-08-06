// RAG step 1 proof — real Gemini embeddings that are SEMANTICALLY meaningful, not just "an array came back".
// A relevant doc must score higher against a query than an unrelated doc, and dims must match.
// Run: ./node_modules/.bin/tsx -r dotenv/config scripts/test-rag-embeddings.ts
import { embedDocument, embedQuery, cosineSim, EMBED_DIMS, RAG_EMBED_MODEL } from '../server/knowledge/rag/embeddings.js';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log(`  PASS  ${n}`); } else { fail++; console.log(`  FAIL  ${n}  ${d}`); } };

async function main() {
  console.log(`Embedding model: ${RAG_EMBED_MODEL} @ ${EMBED_DIMS} dims\n`);

  const relevantDoc = 'Value-based SaaS pricing: set tiers by the value delivered to each customer segment, not by cost. Anchor with a mid tier, expand with usage-based add-ons.';
  const unrelatedDoc = 'Arctic terns migrate from the Arctic to the Antarctic and back each year, the longest migration of any animal, roughly 70,000 km round trip.';
  const query = 'what pricing model should my software startup use?';

  const [relEmb, unrelEmb, qEmb] = await Promise.all([
    embedDocument(relevantDoc, 'SaaS pricing'),
    embedDocument(unrelatedDoc, 'Bird migration'),
    embedQuery(query),
  ]);

  check(`relevant embedding has ${EMBED_DIMS} dims`, relEmb.length === EMBED_DIMS, `got ${relEmb.length}`);
  check('query embedding dims match', qEmb.length === EMBED_DIMS, `got ${qEmb.length}`);
  check('embedding is L2-normalized (|v| ~ 1)', Math.abs(Math.sqrt(relEmb.reduce((s, v) => s + v * v, 0)) - 1) < 1e-3);

  const simRel = cosineSim(qEmb, relEmb);
  const simUnrel = cosineSim(qEmb, unrelEmb);
  console.log(`\n  cosine(query, SaaS-pricing doc)   = ${simRel.toFixed(4)}`);
  console.log(`  cosine(query, bird-migration doc) = ${simUnrel.toFixed(4)}\n`);

  check('relevant doc scores higher than unrelated (semantic retrieval works)', simRel > simUnrel, `${simRel.toFixed(3)} vs ${simUnrel.toFixed(3)}`);
  check('relevant similarity is meaningfully high (> 0.5)', simRel > 0.5, `got ${simRel.toFixed(3)}`);
  check('separation is clear (rel - unrel > 0.15)', simRel - simUnrel > 0.15, `gap ${(simRel - simUnrel).toFixed(3)}`);

  console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} — ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error('ERROR:', e?.message || e); process.exit(1); });
