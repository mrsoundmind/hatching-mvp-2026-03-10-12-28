// THE definitive ceiling test: is the reasoning/creativity ceiling model-bound?
// Baseline = DeepSeek V4-Flash (production primary). Frontier = OpenAI gpt-5 (true frontier,
// via the funded key + the provider fix that lets reasoning models emit visible content).
// RAG on + TOP1_SCAFFOLD on for BOTH arms, so the ONLY variable is the base model. Each of the
// 34 role questions is answered by both models through the FULL prompt path (identical RAG +
// scaffold + role expertise) and scored blind on the 6 competencies by a cross-model Groq judge.
// If the reasoning-side dims (diagnosis/judgment/creativity) jump on gpt-5, the ceiling is
// model-bound (route hard turns to frontier). If they don't, top-1%-everywhere is not a
// today-achievable goal with any available model, and prompting/multi-pass won't rescue it.
//
// Run: LLM_MODE=prod ./node_modules/.bin/tsx -r dotenv/config scripts/eval-frontier-ab.ts
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { QUESTIONS } from './eval-all-roles-competence.js';
import { generateIntelligentResponse } from '../server/ai/openaiService.js';
import { generateWithPreferredProvider } from '../server/llm/providerResolver.js';

const OUT = '/private/tmp/claude-501/-Users-shashankrai-Documents-hatching-mvp-5th-march/e433eb83-3933-4614-80d6-c592aed4b0f7/scratchpad/frontier-ab.json';
const EVAL_PROVIDER = (process.env.EVAL_PROVIDER || (process.env.GROQ_API_KEY ? 'groq' : 'gemini')) as any;
const BASE_MODEL = process.env.AB_BASE_MODEL || 'deepseek-v4-flash';
const FRONTIER_MODEL = process.env.AB_FRONTIER_MODEL || 'gpt-5';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const DIMS = ['knowledge', 'diagnosis', 'application', 'judgment', 'creativity', 'rigor'] as const;
const KNOWLEDGE_DEP = ['knowledge', 'application', 'rigor'];
const REASONING_DEP = ['diagnosis', 'judgment', 'creativity']; // the dims prompting/RAG/tier-up could NOT move

function useBase() { delete process.env.LLM_PRIMARY; process.env.DEEPSEEK_MODEL = BASE_MODEL; }
function useFrontier() { process.env.LLM_PRIMARY = 'openai'; process.env.OPENAI_MODEL = FRONTIER_MODEL; }

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
  // one retry — reasoning models occasionally return empty on a bad draw
  for (let i = 0; i < 2; i++) {
    const res = await generateIntelligentResponse(q.q, q.role, {
      mode: 'project', projectName: 'Frontier Eval', agentRole: q.role, conversationHistory: [], autonomyLevel: 'propose',
    } as any);
    const c = res?.content ?? '';
    if (c.trim().length > 0) return c;
    await sleep(1500);
  }
  return '';
}

async function main() {
  process.env.LLM_MODE = 'prod';
  process.env.RAG_ENABLED = 'on';    // held constant
  process.env.TOP1_SCAFFOLD = 'on';  // held constant — we isolate the MODEL
  const results: any[] = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : [];
  const done = new Set(results.map((r) => r.role));
  console.log(`Frontier A/B — ${BASE_MODEL} (baseline) vs ${FRONTIER_MODEL} (frontier). RAG+scaffold on both. Judge: ${EVAL_PROVIDER}. Done: ${done.size}.\n`);
  for (const q of QUESTIONS) {
    if (done.has(q.role)) { console.log(`  [skip] ${q.role}`); continue; }
    try {
      useBase();
      const aBase = await answer(q); await sleep(300);
      const base = await scoreDims(q, aBase); await sleep(300);
      useFrontier();
      const aFront = await answer(q); await sleep(300);
      const front = await scoreDims(q, aFront); await sleep(300);
      results.push({ role: q.role, base, front, aBase, aFront });
      writeFileSync(OUT, JSON.stringify(results, null, 2));
      console.log(`  [${q.role.padEnd(24)}] ${DIMS.map((d) => `${d[0]}${base[d]}→${front[d]}`).join(' ')}  (${aBase.length}->${aFront.length}c)`);
    } catch (e: any) { console.log(`  [${q.role}] ERROR ${e?.message || e}`); }
  }
  const s = results;
  const avg = (m: 'base' | 'front', d: string) => s.reduce((a, r) => a + (r[m][d] || 0), 0) / (s.length || 1);
  console.log(`\n=== ${s.length} roles · ${BASE_MODEL} → ${FRONTIER_MODEL} (RAG+scaffold on both) ===`);
  let kO = 0, kN = 0, rO = 0, rN = 0;
  for (const d of DIMS) {
    const o = avg('base', d), n = avg('front', d);
    const grp = KNOWLEDGE_DEP.includes(d) ? 'knowledge-dep' : 'reasoning-dep';
    console.log(`  ${d.padEnd(12)} ${o.toFixed(2)} → ${n.toFixed(2)}  (${(n - o >= 0 ? '+' : '')}${(n - o).toFixed(2)})  [${grp}]`);
    if (KNOWLEDGE_DEP.includes(d)) { kO += o; kN += n; } else { rO += o; rN += n; }
  }
  console.log(`\n  reasoning-dep group: ${(rO / 3).toFixed(2)} → ${(rN / 3).toFixed(2)}  (${(rN / 3 - rO / 3 >= 0 ? '+' : '')}${(rN / 3 - rO / 3).toFixed(2)})  <- THE ceiling test: does a frontier model move this?`);
  console.log(`  knowledge-dep group: ${(kO / 3).toFixed(2)} → ${(kN / 3).toFixed(2)}  (${(kN / 3 - kO / 3 >= 0 ? '+' : '')}${(kN / 3 - kO / 3).toFixed(2)})`);
  const t1B = s.filter((r) => DIMS.every((d) => r.base[d] >= 4)).length;
  const t1F = s.filter((r) => DIMS.every((d) => r.front[d] >= 4)).length;
  console.log(`  top-1% across ALL 6 dims: ${t1B}/${s.length} (${BASE_MODEL}) → ${t1F}/${s.length} (${FRONTIER_MODEL})`);
  const emptyFront = s.filter((r) => (r.aFront || '').trim().length === 0).length;
  if (emptyFront) console.log(`  WARNING: ${emptyFront} frontier answers were EMPTY (excluded value is 0s — investigate).`);
  console.log(`Results saved: ${OUT}`);
  process.exit(0);
}
main().catch((e) => { console.error('ERROR:', e?.message || e); process.exit(1); });
