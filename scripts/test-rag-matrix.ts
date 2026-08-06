// Phase 0A proof — the full matrix pipeline: query-rewrite -> hybrid (vector+keyword) -> fuse -> rerank.
// Runs live (Groq for rewrite/rerank, Gemini embeddings, Supabase corpus).
// Run: ./node_modules/.bin/tsx -r dotenv/config scripts/test-rag-matrix.ts
import { retrieveKnowledgeAcrossRoles, rewriteQueryForRetrieval, renderCrossRoleKnowledgeBlock } from '../server/knowledge/rag/retriever.js';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log(`  PASS  ${n}`); } else { fail++; console.log(`  FAIL  ${n}  ${d}`); } };

async function main() {
  // 1. Full pipeline on a cross-domain problem.
  const r1 = await retrieveKnowledgeAcrossRoles('How do I design an onboarding flow that gets new users to activate and stick?');
  console.log(`\n  rewritten: "${r1.rewritten}"`);
  for (const c of r1.chunks) console.log(`    [${c.role}] ${c.score.toFixed(3)} ${c.sourceTitle}`);
  check('matrix returns chunks', r1.chunks.length > 0);
  check('matrix draws on >1 role', new Set(r1.chunks.map((c) => c.role)).size >= 2, [...new Set(r1.chunks.map((c) => c.role))].join(', '));

  // 2. Query rewriting resolves a follow-up using history.
  const rewritten = await rewriteQueryForRetrieval('what about on mobile?', [
    { role: 'user', content: 'How should I structure the onboarding flow for my SaaS product?' },
    { role: 'assistant', content: 'Start with a single activation moment and progressive disclosure.' },
  ]);
  console.log(`\n  follow-up rewritten to: "${rewritten}"`);
  check('follow-up is rewritten into a self-contained query', rewritten.toLowerCase() !== 'what about on mobile?' && /mobile|onboard/i.test(rewritten), rewritten);

  // 3. Hybrid keyword catch: an exact framework acronym surfaces its source even if embeddings fuzz it.
  const r3 = await retrieveKnowledgeAcrossRoles('what is the AARRR pirate metrics framework?');
  console.log(`\n  AARRR ->`);
  for (const c of r3.chunks) console.log(`    [${c.role}] ${c.score.toFixed(3)} ${c.sourceTitle}`);
  check('exact-term query (AARRR) surfaces the right source', r3.chunks.some((c) => /aarrr|pirate/i.test((c.sourceTitle ?? '') + (c.chunk ?? ''))), r3.chunks.map((c) => c.sourceTitle).join(' | '));

  // 4. Render block is well-formed + injection-safe framing present.
  const block = renderCrossRoleKnowledgeBlock(r1.chunks);
  check('render block includes role attribution', /knowledge\)/.test(block));
  check('render block has untrusted-data (injection-safe) framing', /UNTRUSTED reference DATA/.test(block));
  check('render block has judgment-not-regurgitation instruction', /Do not recite/.test(block));

  console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} — ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error('ERROR:', e?.message || e); process.exit(1); });
