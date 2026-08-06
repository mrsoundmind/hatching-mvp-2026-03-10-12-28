// RAG — verify retrieval across a spread of the NEWLY scaled roles (real corpus, real embeddings).
// Run: ./node_modules/.bin/tsx -r dotenv/config scripts/test-rag-retrieval-scaled.ts
import { retrieveKnowledge } from '../server/knowledge/rag/retriever.js';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log(`  PASS  ${n}`); } else { fail++; console.log(`  FAIL  ${n}  ${d}`); } };

const cases: Array<{ role: string; q: string; expect: RegExp; label: string }> = [
  { role: 'AI Developer', q: 'How should I structure prompts to make an LLM reliable in production?', expect: /anthropic|claude|huyenchip|openai/, label: 'AI Dev -> Anthropic/Huyen/OpenAI' },
  { role: 'QA Lead', q: 'How much should I rely on end-to-end tests versus unit tests?', expect: /martinfowler|testing\.googleblog/, label: 'QA -> Test Pyramid' },
  { role: 'DevOps Engineer', q: 'What are the four key DORA metrics for delivery performance?', expect: /dora\.dev|sre\.google/, label: 'DevOps -> DORA/SRE' },
  { role: 'Idea Partner', q: 'How do I break this problem down from first principles?', expect: /fs\.blog|ideou/, label: 'Idea Partner -> first principles' },
  { role: 'Copywriter', q: 'How do I write a headline that actually gets clicks?', expect: /copyblogger|wikipedia\.org\/wiki\/AIDA/, label: 'Copywriter -> Copyblogger/AIDA' },
  { role: 'Audio Editor', q: 'What loudness (LUFS) should I target for a podcast?', expect: /izotope|transom/, label: 'Audio -> LUFS' },
  { role: 'Technical Lead', q: 'How does team structure affect our software architecture?', expect: /martinfowler/, label: 'Tech Lead -> Conway/Fowler' },
];

async function main() {
  for (const c of cases) {
    const { chunks } = await retrieveKnowledge(c.role, c.q);
    const top = chunks[0];
    console.log(`\n  [${c.role}] "${c.q}"`);
    if (top) console.log(`    -> ${top.score.toFixed(3)}  ${top.sourceTitle}\n       ${top.sourceUrl}`);
    else console.log('    -> (nothing retrieved)');
    check(c.label, chunks.some((k) => c.expect.test((k.sourceUrl ?? '').toLowerCase())), top?.sourceUrl ?? 'none');
  }
  console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} — ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error('ERROR:', e?.message || e); process.exit(1); });
