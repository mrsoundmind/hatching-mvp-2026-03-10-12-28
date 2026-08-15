// Definitive "is a stronger base model the unlock for top-1%?" test.
// Holds EVERYTHING constant except the base model: RAG on + TOP1_SCAFFOLD on for BOTH arms.
// Baseline = DeepSeek V4-Flash (the production primary). Premium = DeepSeek V4-Pro (same family,
// pure model-size lever, no cross-family confound). Each of the 34 role questions is answered by
// both models and scored blind on the 6 competencies by a cross-model Groq judge, so we see whether
// the reasoning-side dimensions (diagnosis/judgment/creativity) — the ones RAG and prompting could
// NOT move — finally jump when the base model gets stronger.
//
// Run: LLM_MODE=prod ./node_modules/.bin/tsx -r dotenv/config scripts/eval-model-ab.ts
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { QUESTIONS } from './eval-all-roles-competence.js';
import { generateIntelligentResponse } from '../server/ai/openaiService.js';
import { generateWithPreferredProvider } from '../server/llm/providerResolver.js';

const OUT = '/private/tmp/claude-501/-Users-shashankrai-Documents-hatching-mvp-5th-march/e433eb83-3933-4614-80d6-c592aed4b0f7/scratchpad/model-ab.json';
const EVAL_PROVIDER = (process.env.EVAL_PROVIDER || (process.env.GROQ_API_KEY ? 'groq' : 'gemini')) as any;
const FLASH = process.env.AB_FLASH_MODEL || 'deepseek-v4-flash';
const PRO = process.env.AB_PRO_MODEL || 'deepseek-v4-pro';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const DIMS = ['knowledge', 'diagnosis', 'application', 'judgment', 'creativity', 'rigor'] as const;
const KNOWLEDGE_DEP = ['knowledge', 'application', 'rigor'];
const REASONING_DEP = ['diagnosis', 'judgment', 'creativity']; // the dims prompting/RAG could not move

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
    mode: 'project', projectName: 'Model Eval', agentRole: q.role, conversationHistory: [], autonomyLevel: 'propose',
  } as any);
  return res?.content ?? '';
}

async function main() {
  process.env.LLM_MODE = 'prod';
  process.env.RAG_ENABLED = 'on';       // held constant
  process.env.TOP1_SCAFFOLD = 'on';     // held constant — we isolate the MODEL
  delete process.env.LLM_PRIMARY;       // stay on DeepSeek for both arms
  const results: any[] = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : [];
  const done = new Set(results.map((r) => r.role));
  console.log(`Model A/B — ${FLASH} (baseline) vs ${PRO} (premium). RAG+scaffold on both. Judge: ${EVAL_PROVIDER}. Done: ${done.size}.\n`);
  for (const q of QUESTIONS) {
    if (done.has(q.role)) { console.log(`  [skip] ${q.role}`); continue; }
    try {
      process.env.DEEPSEEK_MODEL = FLASH;
      const aFlash = await answer(q); await sleep(400);
      const flash = await scoreDims(q, aFlash); await sleep(400);
      process.env.DEEPSEEK_MODEL = PRO;
      const aPro = await answer(q); await sleep(400);
      const pro = await scoreDims(q, aPro); await sleep(400);
      results.push({ role: q.role, flash, pro, aFlash, aPro });
      writeFileSync(OUT, JSON.stringify(results, null, 2));
      console.log(`  [${q.role.padEnd(24)}] ${DIMS.map((d) => `${d[0]}${flash[d]}→${pro[d]}`).join(' ')}`);
    } catch (e: any) { console.log(`  [${q.role}] ERROR ${e?.message || e}`); }
  }
  const s = results;
  const avg = (m: 'flash' | 'pro', d: string) => s.reduce((a, r) => a + (r[m][d] || 0), 0) / (s.length || 1);
  console.log(`\n=== ${s.length} roles · ${FLASH} → ${PRO} (RAG+scaffold on both) ===`);
  let kO = 0, kN = 0, rO = 0, rN = 0;
  for (const d of DIMS) {
    const o = avg('flash', d), n = avg('pro', d);
    const grp = KNOWLEDGE_DEP.includes(d) ? 'knowledge-dep' : 'reasoning-dep';
    console.log(`  ${d.padEnd(12)} ${o.toFixed(2)} → ${n.toFixed(2)}  (${(n - o >= 0 ? '+' : '')}${(n - o).toFixed(2)})  [${grp}]`);
    if (KNOWLEDGE_DEP.includes(d)) { kO += o; kN += n; } else { rO += o; rN += n; }
  }
  console.log(`\n  reasoning-dep group: ${(rO / 3).toFixed(2)} → ${(rN / 3).toFixed(2)}  (${(rN / 3 - rO / 3 >= 0 ? '+' : '')}${(rN / 3 - rO / 3).toFixed(2)})  <- the model's job (prompting/RAG could not move this)`);
  console.log(`  knowledge-dep group: ${(kO / 3).toFixed(2)} → ${(kN / 3).toFixed(2)}  (${(kN / 3 - kO / 3 >= 0 ? '+' : '')}${(kN / 3 - kO / 3).toFixed(2)})`);
  const t1F = s.filter((r) => DIMS.every((d) => r.flash[d] >= 4)).length;
  const t1P = s.filter((r) => DIMS.every((d) => r.pro[d] >= 4)).length;
  console.log(`  top-1% across ALL 6 dims: ${t1F}/${s.length} (${FLASH}) → ${t1P}/${s.length} (${PRO})`);
  const identical = s.filter((r) => DIMS.every((d) => r.flash[d] === r.pro[d])).length;
  console.log(`  roles scored IDENTICALLY on all 6 (sanity — high = models may be same/indistinguishable): ${identical}/${s.length}`);
  console.log(`Results saved: ${OUT}`);
  process.exit(0);
}
main().catch((e) => { console.error('ERROR:', e?.message || e); process.exit(1); });
