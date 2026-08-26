// LIVE before/after demo of the role-selective multi-pass, on the exact code path the /api/hatch/chat
// endpoint runs (generateIntelligentResponse). Real providers (DeepSeek draft + free Groq critic). For a
// few short chat-style questions we generate the answer with MULTIPASS_ENABLED off (the plain draft) and
// on (draft -> owned-method critique -> revise), then a blind Groq judge scores BOTH on the 6 competencies.
// Captures the full answers + scores so the result can be shown visually.
//
// Run: LLM_MODE=prod ./node_modules/.bin/tsx -r dotenv/config scripts/demo-multipass-live.ts
import { writeFileSync } from 'fs';
import { generateIntelligentResponse } from '../server/ai/openaiService.js';
import { generateWithPreferredProvider } from '../server/llm/providerResolver.js';

const OUT = '/private/tmp/claude-501/-Users-shashankrai-Documents-hatching-mvp-5th-march/e433eb83-3933-4614-80d6-c592aed4b0f7/scratchpad/multipass-live-demo.json';
const EVAL_PROVIDER = (process.env.EVAL_PROVIDER || (process.env.GROQ_API_KEY ? 'groq' : 'gemini')) as any;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const DIMS = ['knowledge', 'diagnosis', 'application', 'judgment', 'creativity', 'rigor'] as const;

// Short chat-style questions on creative/generalist roles (where multi-pass fires and helps).
const CASES = [
  { role: 'Product Manager', q: 'How should we price our new SaaS product for launch?', rubric: 'value-based pricing over cost-plus; a pricing metric that scales with value; tiers; the hard trade-off; specifics.' },
  { role: 'UX Designer', q: 'Our signup form has 8 fields and low completion. Quick take?', rubric: 'diagnose the real friction; progressive disclosure / cut fields to essentials; defer the rest; validate with data; specific.' },
  { role: 'Growth Marketer', q: 'Signups are fine but activation is low. Where do I start?', rubric: 'aha-moment / activation via the Key Action; instrument the funnel; one focused experiment; avoid vanity metrics.' },
];

async function scoreDims(q: string, rubric: string, answer: string): Promise<Record<string, number>> {
  const system =
    'You are a senior examiner rating one expert answer from a working professional in a chat (concise is fine, do NOT ' +
    'penalize brevity). Rate 1-5 on SIX competencies of a TOP 1% practitioner:\n' +
    'knowledge: commands the field canon AND its failure modes.\n' +
    'diagnosis: frames the REAL problem before solutioning.\n' +
    'application: applies the RIGHT method to THIS situation with concrete, correct specifics.\n' +
    'judgment: makes the hard trade-off, sequences, cuts what does not matter.\n' +
    'creativity: a non-obvious insight or reframe beyond a competent-average answer.\n' +
    'rigor: claims backed or hedged; no overclaiming or invented specifics.\n' +
    '5 = top-1%; 3 = competent/generic; 1 = absent/wrong. Return ONLY JSON: ' +
    '{"knowledge":n,"diagnosis":n,"application":n,"judgment":n,"creativity":n,"rigor":n}.';
  const user = `Question: ${q}\n\nReference (expert canon): ${rubric}\n\nAnswer:\n${answer}\n\nJSON:`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const c = await generateWithPreferredProvider(
        { messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature: 0, maxTokens: 160 } as any,
        EVAL_PROVIDER,
      );
      const m = (c.content || '').match(/\{[\s\S]*\}/);
      if (!m) { await sleep(1500); continue; }
      const p = JSON.parse(m[0]);
      return Object.fromEntries(DIMS.map((d) => [d, Number(p[d]) || 0]));
    } catch { await sleep(2000); }
  }
  return Object.fromEntries(DIMS.map((d) => [d, 0]));
}

async function answer(q: string, role: string): Promise<string> {
  const res = await generateIntelligentResponse(q, role, {
    mode: 'project', projectName: 'Multi-pass Live Demo', agentRole: role, conversationHistory: [], autonomyLevel: 'propose',
  } as any);
  return res?.content ?? '';
}

async function main() {
  process.env.LLM_MODE = 'prod';
  process.env.RAG_ENABLED = 'on';
  process.env.TOP1_SCAFFOLD = 'on';
  delete process.env.LLM_PRIMARY;
  process.env.DEEPSEEK_MODEL = 'deepseek-v4-flash';
  process.env.MULTIPASS_CRITIC_PROVIDER = 'groq';
  const results: any[] = [];
  console.log(`LIVE multi-pass before/after (real DeepSeek + free Groq critic). Judge: ${EVAL_PROVIDER}.\n`);
  for (const c of CASES) {
    process.env.MULTIPASS_ENABLED = 'off';
    const aOff = await answer(c.q, c.role); await sleep(400);
    const off = await scoreDims(c.q, c.rubric, aOff); await sleep(400);
    process.env.MULTIPASS_ENABLED = 'on';
    const aOn = await answer(c.q, c.role); await sleep(400);
    const on = await scoreDims(c.q, c.rubric, aOn); await sleep(400);
    const fired = aOff !== aOn;
    results.push({ role: c.role, q: c.q, aOff, aOn, off, on, fired });
    writeFileSync(OUT, JSON.stringify(results, null, 2));
    const dOff = DIMS.reduce((a, d) => a + off[d], 0) / 6, dOn = DIMS.reduce((a, d) => a + on[d], 0) / 6;
    console.log(`[${c.role}] fired:${fired}  overall ${dOff.toFixed(2)} -> ${dOn.toFixed(2)}  (${(dOn - dOff >= 0 ? '+' : '')}${(dOn - dOff).toFixed(2)})`);
    console.log(`   ${DIMS.map((d) => `${d}:${off[d]}->${on[d]}`).join('  ')}`);
    console.log(`   OFF (${aOff.length}c): ${JSON.stringify(aOff.slice(0, 160))}`);
    console.log(`   ON  (${aOn.length}c): ${JSON.stringify(aOn.slice(0, 160))}\n`);
  }
  const n = results.length || 1;
  const avg = (m: 'off' | 'on', d: string) => results.reduce((a, r) => a + r[m][d], 0) / n;
  console.log('=== LIVE improvement matrix (avg over ' + results.length + ' questions) ===');
  for (const d of DIMS) { const o = avg('off', d), v = avg('on', d); console.log(`  ${d.padEnd(12)} ${o.toFixed(2)} -> ${v.toFixed(2)}  (${(v - o >= 0 ? '+' : '')}${(v - o).toFixed(2)})`); }
  const ov = (m: 'off' | 'on') => DIMS.reduce((a, d) => a + avg(m, d), 0) / 6;
  console.log(`  OVERALL ${ov('off').toFixed(2)} -> ${ov('on').toFixed(2)}  (${(ov('on') - ov('off') >= 0 ? '+' : '')}${(ov('on') - ov('off')).toFixed(2)})`);
  console.log(`Saved: ${OUT}`);
  process.exit(0);
}
main().catch((e) => { console.error('ERROR:', e?.message || e); process.exit(1); });
