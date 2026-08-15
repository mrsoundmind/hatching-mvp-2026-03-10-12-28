// Measures the cheap multi-pass loop (MULTIPASS_ENABLED) on top of RAG + method scaffold, DeepSeek only.
// Both arms: DeepSeek V4-Flash + RAG on + TOP1_SCAFFOLD on. We toggle ONLY the multi-pass:
//   OFF = single draft (the current 3.38 floor).
//   ON  = draft -> free Groq critic against the owned-method rubric -> DeepSeek revise.
// Each of the 34 role questions is answered both ways and scored blind on the 6 competencies, then
// compared to the captured gpt-5 target so we see how much of the frontier gap we recover for ~free.
//
// Run: LLM_MODE=prod ./node_modules/.bin/tsx -r dotenv/config scripts/eval-multipass-ab.ts
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { QUESTIONS } from './eval-all-roles-competence.js';
import { generateIntelligentResponse } from '../server/ai/openaiService.js';
import { generateWithPreferredProvider } from '../server/llm/providerResolver.js';

const OUT = '/private/tmp/claude-501/-Users-shashankrai-Documents-hatching-mvp-5th-march/e433eb83-3933-4614-80d6-c592aed4b0f7/scratchpad/multipass-ab.json';
const EVAL_PROVIDER = (process.env.EVAL_PROVIDER || (process.env.GROQ_API_KEY ? 'groq' : 'gemini')) as any;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const DIMS = ['knowledge', 'diagnosis', 'application', 'judgment', 'creativity', 'rigor'] as const;
const KNOWLEDGE_DEP = ['knowledge', 'application', 'rigor'];
// Anchors captured earlier this session (DeepSeek Flash floor, gpt-5 frontier target), reasoning-group:
const FLOOR_REASONING = 3.38;
const TARGET_REASONING = 3.86;

async function scoreDims(q: any, answer: string): Promise<Record<string, number>> {
  const system =
    'You are a senior examiner rating one expert answer from a working professional in a chat (concise is fine, do NOT ' +
    'penalize brevity). Rate 1-5 on SIX independent competencies of a TOP 1% practitioner:\n' +
    'knowledge: commands the field canon (correct frameworks/methods/benchmarks) AND its failure modes.\n' +
    'diagnosis: correctly reads and frames the REAL problem before solutioning.\n' +
    'application: applies the RIGHT method to THIS specific situation with concrete, correct, actionable specifics.\n' +
    'judgment: makes the hard trade-off, sequences, cuts what does not matter, realistic about constraints.\n' +
    'creativity: brings a non-obvious insight, reframe, or second-order point beyond a competent-average answer.\n' +
    'rigor: backs claims, cites or admits uncertainty, avoids overclaiming.\n' +
    '5 = top-1% on that competency; 3 = competent/generic; 1 = absent/wrong. Score each independently. ' +
    'Return ONLY JSON: {"knowledge":n,"diagnosis":n,"application":n,"judgment":n,"creativity":n,"rigor":n}.';
  const user = `Question: ${q.q}\n\nReference (expert canon): ${q.rubric}\n\nAnswer:\n${answer}\n\nJSON:`;
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

async function answer(q: any): Promise<string> {
  const res = await generateIntelligentResponse(q.q, q.role, {
    mode: 'project', projectName: 'MultiPass Eval', agentRole: q.role, conversationHistory: [], autonomyLevel: 'propose',
  } as any);
  return res?.content ?? '';
}

async function main() {
  process.env.LLM_MODE = 'prod';
  process.env.RAG_ENABLED = 'on';       // held constant
  process.env.TOP1_SCAFFOLD = 'on';     // held constant
  delete process.env.LLM_PRIMARY;       // DeepSeek for both arms
  process.env.DEEPSEEK_MODEL = 'deepseek-v4-flash';
  process.env.MULTIPASS_CRITIC_PROVIDER = 'groq';
  const results: any[] = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : [];
  const done = new Set(results.map((r) => r.role));
  console.log(`Multi-pass A/B (DeepSeek only, RAG+scaffold on both). Critic: groq. Judge: ${EVAL_PROVIDER}. Done: ${done.size}.\n`);
  for (const q of QUESTIONS) {
    if (done.has(q.role)) { console.log(`  [skip] ${q.role}`); continue; }
    try {
      process.env.MULTIPASS_ENABLED = 'off';
      const aOff = await answer(q); await sleep(300);
      const off = await scoreDims(q, aOff); await sleep(300);
      process.env.MULTIPASS_ENABLED = 'on';
      const aOn = await answer(q); await sleep(300);
      const on = await scoreDims(q, aOn); await sleep(300);
      results.push({ role: q.role, off, on, aOff, aOn });
      writeFileSync(OUT, JSON.stringify(results, null, 2));
      console.log(`  [${q.role.padEnd(24)}] ${DIMS.map((d) => `${d[0]}${off[d]}→${on[d]}`).join(' ')}  (${aOff.length}->${aOn.length}c)`);
    } catch (e: any) { console.log(`  [${q.role}] ERROR ${e?.message || e}`); }
  }
  const s = results;
  const avg = (m: 'off' | 'on', d: string) => s.reduce((a, r) => a + (r[m][d] || 0), 0) / (s.length || 1);
  console.log(`\n=== ${s.length} roles · multi-pass OFF → ON (DeepSeek, RAG+scaffold on both) ===`);
  let kO = 0, kN = 0, rO = 0, rN = 0;
  for (const d of DIMS) {
    const o = avg('off', d), n = avg('on', d);
    console.log(`  ${d.padEnd(12)} ${o.toFixed(2)} → ${n.toFixed(2)}  (${(n - o >= 0 ? '+' : '')}${(n - o).toFixed(2)})`);
    if (KNOWLEDGE_DEP.includes(d)) { kO += o; kN += n; } else { rO += o; rN += n; }
  }
  const rOff = rO / 3, rOn = rN / 3;
  console.log(`\n  reasoning-group: ${rOff.toFixed(2)} → ${rOn.toFixed(2)}  (${(rOn - rOff >= 0 ? '+' : '')}${(rOn - rOff).toFixed(2)})`);
  console.log(`  knowledge-group: ${(kO / 3).toFixed(2)} → ${(kN / 3).toFixed(2)}  (${(kN / 3 - kO / 3 >= 0 ? '+' : '')}${(kN / 3 - kO / 3).toFixed(2)})`);
  const gap = TARGET_REASONING - FLOOR_REASONING;
  const recovered = rOn - FLOOR_REASONING;
  const pct = gap > 0 ? Math.round((recovered / gap) * 100) : 0;
  console.log(`\n  Frontier gap recovery (reasoning): floor ${FLOOR_REASONING} → target ${TARGET_REASONING} (gap ${gap.toFixed(2)}).`);
  console.log(`  Multi-pass reached ${rOn.toFixed(2)} = recovered ${recovered >= 0 ? '+' : ''}${recovered.toFixed(2)} of the gap  (~${pct}% of the way to gpt-5, for free).`);
  const t1Off = s.filter((r) => DIMS.every((d) => r.off[d] >= 4)).length;
  const t1On = s.filter((r) => DIMS.every((d) => r.on[d] >= 4)).length;
  console.log(`  top-1% across ALL 6 dims: ${t1Off}/${s.length} (off) → ${t1On}/${s.length} (on)`);
  console.log(`Results saved: ${OUT}`);
  process.exit(0);
}
main().catch((e) => { console.error('ERROR:', e?.message || e); process.exit(1); });
