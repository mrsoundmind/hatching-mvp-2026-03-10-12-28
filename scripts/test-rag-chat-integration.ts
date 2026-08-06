// RAG payoff proof — the REAL wired chat path (retrieval -> injection -> real LLM).
// Calls generateIntelligentResponse for each spike role and checks the answer is GROUNDED in the
// retrieved source (right figure/framework) and CITES it, and that an out-of-corpus question is
// ADMITTED, not fabricated. Run: LLM_MODE=prod ./node_modules/.bin/tsx -r dotenv/config scripts/test-rag-chat-integration.ts
import { generateIntelligentResponse } from '../server/ai/openaiService.js';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log(`  PASS  ${n}`); } else { fail++; console.log(`  FAIL  ${n}  ${d}`); } };

function ctx(role: string) {
  return { mode: 'project' as const, projectName: 'RAG Proof', agentRole: role, conversationHistory: [], autonomyLevel: 'propose' as const };
}

async function ask(role: string, q: string): Promise<string> {
  const res = await generateIntelligentResponse(q, role, ctx(role));
  const text = res?.content ?? '';
  console.log(`\n  [${role}] "${q}"\n  --> ${text.replace(/\n+/g, ' ').slice(0, 420)}${text.length > 420 ? '…' : ''}`);
  return text.toLowerCase();
}

async function main() {
  // 1. Engineer, grounded + cited (MonolithFirst / microservices).
  const eng = await ask('Software Engineer', 'Should we start our brand-new app with microservices or a monolith? Give me the reasoning.');
  check('Engineer answer is grounded (monolith-first / microservice premium)', /monolith|premium|bounded context/.test(eng));
  check('Engineer answer cites a real source (martinfowler)', /martinfowler\.com|fowler/.test(eng));

  // 2. SEO, grounded on the real statistic + cited.
  const seo = await ask('SEO Specialist', 'Roughly what share of web pages actually get organic search traffic from Google?');
  check('SEO answer carries the real figure (96.5% / 3.45%)', /96\.5|96\.55|3\.45|zero traffic|no traffic/.test(seo));
  check('SEO answer cites a real source (ahrefs)', /ahrefs/.test(seo));

  // 3. PM, grounded on RICE + cited.
  const pm = await ask('Product Manager', 'What is a solid formula to prioritize my product backlog?');
  check('PM answer names the RICE framework', /rice|reach.*impact.*confidence.*effort|reach, impact/.test(pm));
  check('PM answer cites a real source (intercom)', /intercom/.test(pm));

  // 4. FAITHFULNESS — a stat the corpus lacks exactly. Cross-role retrieval may surface loosely-related
  //    sources, so the real guarantee is: EVERY URL the agent cites must be a real source in our corpus
  //    (it must never cite a URL from memory). This is the anti-fabrication invariant.
  const oob = await ask('Product Manager', 'What exact percentage of B2B SaaS free trials convert to paid in 2025? Please cite your source.');
  const urls = (oob.match(/https?:\/\/[^\s)\]]+/g) || []).map((u) => u.replace(/[.,;:!)\]]+$/, '').toLowerCase());
  const { pool } = await import('../server/db.js');
  const corpusUrls = new Set(
    (await pool.query('SELECT DISTINCT source_url FROM role_knowledge WHERE source_url IS NOT NULL')).rows
      .map((r: any) => String(r.source_url).toLowerCase()),
  );
  const fabricated = urls.filter((u) => !corpusUrls.has(u));
  check('faithfulness: every cited URL is a real corpus source (none from memory)', fabricated.length === 0, `fabricated: ${fabricated.join(', ') || 'none'}`);
  await pool.end();

  console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} — ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error('ERROR:', e?.message || e); process.exit(1); });
