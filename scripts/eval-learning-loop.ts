// Does Hatchin's self-improving loop actually make agents better? This measures the ONE piece that is
// wired, default-on, and cleanly isolatable: the growth-loop lessons (LEARN-01). The claim is that a
// peer-review "must-fix" on one task is fed FORWARD into the agent's next task in the same project, so
// the next answer improves. We test that end-to-end through the REAL path, model held constant:
//
//   Round 0 (baseline): agent answers Q0 (growth loop OFF) -> the REAL peer-review judge (runLlmJudge,
//     free Groq) produces must-fix items -> we log them as a real `peer_review_feedback` event on a
//     THROWAWAY project id (cleaned up at the end, so no real project is touched).
//   Round 1 (test): agent answers a DIFFERENT same-domain question Q1 twice, everything identical except
//     GROWTH_LOOP: OFF (control, no lessons injected) vs ON (getQualityLessons reads the seeded must-fixes
//     and injects them). Both scored blind on the 6 competencies.
//
// If treatment > control, the loop genuinely transfers a lesson to a new task (it learns). If it is flat,
// the loop remembers but does not get smarter, which is the honest gap the audit flagged. RAG + scaffold
// are ON for both arms; multi-pass OFF. Note: LLM sampling adds variance at n=1/role; read the aggregate.
//
// Run: LLM_MODE=prod ./node_modules/.bin/tsx -r dotenv/config scripts/eval-learning-loop.ts
import { randomUUID } from 'crypto';
import { writeFileSync } from 'fs';
import { pool } from '../server/db.js';
import { logAutonomyEvent } from '../server/autonomy/events/eventLogger.js';
import { generateIntelligentResponse } from '../server/ai/openaiService.js';
import { generateWithPreferredProvider } from '../server/llm/providerResolver.js';

const SAMPLES = Number(process.env.LOOP_SAMPLES || 2); // samples per arm, averaged, to control LLM sampling variance

const OUT = '/private/tmp/claude-501/-Users-shashankrai-Documents-hatching-mvp-5th-march/e433eb83-3933-4614-80d6-c592aed4b0f7/scratchpad/learning-loop.json';
const EVAL_PROVIDER = (process.env.EVAL_PROVIDER || (process.env.GROQ_API_KEY ? 'groq' : 'gemini')) as any;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const DIMS = ['knowledge', 'diagnosis', 'application', 'judgment', 'creativity', 'rigor'] as const;

// Same-domain Q0 (gets peer-reviewed) + Q1 (the new task the lesson must transfer to).
const PAIRS = [
  { role: 'Product Manager', q0: 'How should we prioritize our product backlog for the next quarter?', q1: 'We have 3 weeks until an MVP demo. What do we cut and what stays?', rubric: 'RICE/ICE prioritization tied to a goal metric; the hard trade-off and what to cut; sequencing; realistic scope.' },
  { role: 'Growth Marketer', q0: 'What acquisition channels should a new B2B analytics tool test first?', q1: 'Our signups are fine but activation is low. How do we fix it?', rubric: 'channel-fit + CAC/payback; activation via the aha-moment/Key Action; a real test design; avoid vanity metrics; specifics.' },
  { role: 'Finance Analyst', q0: 'How should we structure pricing for a new SaaS product?', q1: 'We have 9 months of runway. How should we plan burn and hiring?', rubric: 'value-based pricing/tiers; unit economics; runway = cash/burn; scenario planning; hedge and verify assumptions; no invented numbers.' },
  { role: 'Content Writer', q0: 'Outline a blog post on why onboarding beats features in SaaS.', q1: 'Plan a 4-email welcome sequence for that product.', rubric: 'clear thesis/hook; audience-specific; concrete structure; evidence; no generic filler.' },
  { role: 'Backend Developer', q0: 'How would you design the API for a referral program?', q1: 'Traffic 10x-ed and the referral endpoint is slow. How do you scale it?', rubric: 'resource design + idempotency; identify the real bottleneck; caching/indexing/queue; trade-offs; correctness-first; no hand-waving.' },
  { role: 'UX Designer', q0: 'How would you redesign a cluttered analytics dashboard?', q1: 'Users cannot find the export feature. How do you fix discoverability?', rubric: 'heuristics/IA; diagnose the real problem; hierarchy/progressive disclosure; validate with users; specific to context.' },
];

async function scoreDims(q: string, rubric: string, answer: string): Promise<Record<string, number>> {
  const system =
    'You are a senior examiner rating one expert answer from a working professional in a chat (concise is fine, do NOT ' +
    'penalize brevity). Rate 1-5 on SIX independent competencies of a TOP 1% practitioner:\n' +
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

async function answer(q: string, role: string, projectId: string): Promise<string> {
  const res = await generateIntelligentResponse(q, role, {
    mode: 'project', projectName: 'Learning Eval', agentRole: role, conversationHistory: [], autonomyLevel: 'propose', projectId,
  } as any);
  return res?.content ?? '';
}

// The lesson a demanding reviewer feeds forward. Mirrors the deterministic peer-review path
// (payload.fixSuggestions), which is what the growth loop actually injects in production — GENERAL,
// transferable "how this role should answer" fixes, so they can help a DIFFERENT next task (real transfer).
async function improvementLesson(role: string, task: string, draft: string): Promise<string[]> {
  const system =
    `You are a demanding senior ${role} peer reviewer. The draft below is competent but not top-1%. ` +
    `Give 2-3 CONCRETE, GENERAL, TRANSFERABLE fix suggestions about HOW this role should answer ` +
    `(e.g. name the right framework, quantify, state the hard trade-off, tie to a metric, cut fluff, ` +
    `cite-or-admit) — not task-specific trivia. Each must be actionable on FUTURE tasks too. ` +
    `Return ONLY JSON: {"fixSuggestions":["...","..."]}.`;
  const user = `Task: ${task}\n\nDraft:\n${draft}\n\nJSON:`;
  try {
    const c = await generateWithPreferredProvider(
      { messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature: 0, maxTokens: 220 } as any,
      EVAL_PROVIDER,
    );
    const m = (c.content || '').match(/\{[\s\S]*\}/);
    if (!m) return [];
    const p = JSON.parse(m[0]);
    return (Array.isArray(p?.fixSuggestions) ? p.fixSuggestions : []).filter((s: unknown) => typeof s === 'string' && (s as string).trim());
  } catch { return []; }
}

// Generate SAMPLES answers for an arm and return the averaged dimension scores (variance control).
async function arm(q: string, role: string, projectId: string, rubric: string): Promise<Record<string, number>> {
  const runs: Record<string, number>[] = [];
  for (let i = 0; i < SAMPLES; i++) {
    const a = await answer(q, role, projectId); await sleep(300);
    runs.push(await scoreDims(q, rubric, a)); await sleep(300);
  }
  return Object.fromEntries(DIMS.map((d) => [d, runs.reduce((s, r) => s + (r[d] || 0), 0) / runs.length]));
}

async function main() {
  process.env.LLM_MODE = 'prod';
  process.env.RAG_ENABLED = 'on';
  process.env.TOP1_SCAFFOLD = 'on';
  process.env.MULTIPASS_ENABLED = 'off';
  delete process.env.LLM_PRIMARY;
  process.env.DEEPSEEK_MODEL = 'deepseek-v4-flash';
  const results: any[] = [];
  console.log(`Learning-loop A/B — growth-loop lessons OFF (control) vs ON (treatment). Judge: ${EVAL_PROVIDER}.\n`);
  for (const pair of PAIRS) {
    const testId = randomUUID();
    try {
      // Round 0 — clean baseline answer, then derive a realistic transferable lesson and seed it as a
      // real peer_review_feedback event (payload.fixSuggestions, the production deterministic-reviewer shape).
      process.env.GROWTH_LOOP = 'off';
      const a0 = await answer(pair.q0, pair.role, testId); await sleep(300);
      const fixSuggestions = await improvementLesson(pair.role, pair.q0, a0); await sleep(300);
      if (fixSuggestions.length) {
        await logAutonomyEvent({
          eventType: 'peer_review_feedback', projectId: testId, conversationId: `conv-${testId}`,
          hatchId: null, provider: 'groq', mode: 'prod', latencyMs: 0, confidence: 0.6,
          riskScore: 0, payload: { fixSuggestions },
        } as any);
      }
      await sleep(300);

      // Round 1 — same Q1, everything identical except the lessons flag. Each arm averaged over SAMPLES runs.
      process.env.GROWTH_LOOP = 'off';
      const ctrl = await arm(pair.q1, pair.role, testId, pair.rubric);
      process.env.GROWTH_LOOP = 'on';
      const treat = await arm(pair.q1, pair.role, testId, pair.rubric);

      results.push({ role: pair.role, lessonCount: fixSuggestions.length, ctrl, treat, fixSuggestions });
      writeFileSync(OUT, JSON.stringify(results, null, 2));
      const dc = DIMS.reduce((a, d) => a + treat[d], 0) - DIMS.reduce((a, d) => a + ctrl[d], 0);
      console.log(`  [${pair.role.padEnd(18)}] lessons:${fixSuggestions.length} ${DIMS.map((d) => `${d[0]}${ctrl[d].toFixed(1)}->${treat[d].toFixed(1)}`).join(' ')}  Δ${dc >= 0 ? '+' : ''}${dc.toFixed(1)}`);
    } catch (e: any) {
      console.log(`  [${pair.role}] ERROR ${e?.message || e}`);
    } finally {
      // Clean up the throwaway project's seeded events — no real project is ever touched.
      try { await pool.query('DELETE FROM autonomy_events WHERE project_id = $1', [testId]); } catch { /* best effort */ }
    }
  }
  const s = results; const n = s.length || 1;
  const avg = (m: 'ctrl' | 'treat', d: string) => s.reduce((a, r) => a + (r[m][d] || 0), 0) / n;
  console.log(`\n=== ${s.length} roles · growth-loop lessons OFF -> ON (model held constant) ===`);
  for (const d of DIMS) { const o = avg('ctrl', d), v = avg('treat', d); console.log(`  ${d.padEnd(12)} ${o.toFixed(2)} -> ${v.toFixed(2)}  (${(v - o >= 0 ? '+' : '')}${(v - o).toFixed(2)})`); }
  const ov = (m: 'ctrl' | 'treat') => DIMS.reduce((a, d) => a + avg(m, d), 0) / 6;
  console.log(`  OVERALL ${ov('ctrl').toFixed(2)} -> ${ov('treat').toFixed(2)}  (${(ov('treat') - ov('ctrl') >= 0 ? '+' : '')}${(ov('treat') - ov('ctrl')).toFixed(2)})`);
  const withLessons = s.filter((r) => r.lessonCount > 0).length;
  const improved = s.filter((r) => DIMS.reduce((a, d) => a + r.treat[d], 0) > DIMS.reduce((a, d) => a + r.ctrl[d], 0)).length;
  console.log(`  roles that produced a lesson: ${withLessons}/${s.length}  |  roles where treatment > control: ${improved}/${s.length}`);
  console.log(`Results saved: ${OUT}`);
  process.exit(0);
}
main().catch((e) => { console.error('ERROR:', e?.message || e); process.exit(1); });
