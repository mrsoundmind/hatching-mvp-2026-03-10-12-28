// Phase 1 — THE PROOF: does the knowledge make agents measurably smarter (top-1%)?
// For each expert question, generate an answer with the matrix OFF (baseline) and ON, then a cross-model
// Groq judge (blind to which mode) scores 1-5 against an independently-authored rubric. Questions are
// written from domain expertise, NOT copied from the ingested sources (no teaching-to-the-test).
// Run: LLM_MODE=prod ./node_modules/.bin/tsx -r dotenv/config scripts/eval-role-competence.ts
import { generateIntelligentResponse } from '../server/ai/openaiService.js';
import { generateWithPreferredProvider } from '../server/llm/providerResolver.js';

// Judge provider, env-configurable. Default preserves the original groq/gemini behavior. Set
// EVAL_PROVIDER=ollama-test to judge on free local Ollama (generator follows LLM_MODE=test + TEST_LLM_PROVIDER=ollama).
const EVAL_PROVIDER = (process.env.EVAL_PROVIDER || (process.env.GROQ_API_KEY ? 'groq' : 'gemini')) as any;

interface Q { role: string; q: string; rubric: string; crossRole?: boolean; }

const QUESTIONS: Q[] = [
  {
    role: 'UX Designer',
    q: "Our pricing page isn't converting. Diagnose the visual hierarchy and tell me exactly what to change, and name the perceptual mechanisms at play.",
    rubric: 'pre-attentive processing (~250ms, parallel); visual weight = size+color+density+isolation+position; color/weight are stronger levers than size; squint/grayscale/blur test; CTA target size (Fitts); contrast/WCAG or APCA; recommended-tier emphasis.',
  },
  {
    role: 'UX Designer',
    q: 'How should I choose a type scale, and why does it matter for hierarchy?',
    rubric: 'modular/type scale + ratio; hierarchy via weight and contrast not size alone (Refactoring UI); vertical rhythm/line-height; limited steps; legibility/measure.',
  },
  {
    role: 'UX Designer',
    q: 'What separates technically good color use in a UI from bad, especially for accessibility?',
    rubric: 'color as pre-attentive lever; never rely on hue alone to convey meaning; contrast ratios (WCAG 4.5:1 text / APCA); semantic color separate from brand/accent; 60-30-10 or restrained palette; color blindness.',
  },
  {
    role: 'UX Designer',
    q: 'Before shipping, how do you evaluate whether a screen\'s hierarchy actually works?',
    rubric: 'squint/blur/grayscale test; 5-second test; F-pattern vs layer-cake scanning; usability evaluation methods; check it survives accessibility (focus/DOM order) and responsive reflow.',
  },
  {
    role: 'UX Designer',
    q: "We're designing an onboarding flow to reduce early churn. What should I consider end to end?",
    rubric: 'activation moment / aha; progressive disclosure; reduce cognitive load (Hick/Miller); microcopy/UX writing; measure activation + retention (an activation metric); psychology of motivation; empty states. A top answer spans design + growth + copy.',
    crossRole: true,
  },
];

async function judge(q: Q, answer: string): Promise<{ score: number; note: string }> {
  const system =
    'You are a strict examiner grading an answer to an expert-level question. Score how close it is to what a ' +
    'TOP 1% practitioner would say, using the rubric. 5 = expert, names specific mechanisms/frameworks and applies ' +
    'them; 3 = competent but generic; 1 = vague/wrong. Return ONLY JSON: {"score": <1-5>, "note": "<=12 words on what was missing>"}.';
  const user = `Question: ${q.q}\n\nRubric (what a top answer covers): ${q.rubric}\n\nAnswer:\n${answer}\n\nJSON:`;
  try {
    const c = await generateWithPreferredProvider(
      { messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature: 0, maxTokens: 120 } as any,
      EVAL_PROVIDER,
    );
    const m = (c.content || '').match(/\{[\s\S]*\}/);
    if (!m) return { score: 0, note: 'unparseable' };
    const p = JSON.parse(m[0]);
    return { score: Number(p.score) || 0, note: String(p.note || '') };
  } catch (e) {
    return { score: 0, note: 'judge error' };
  }
}

async function answer(q: Q): Promise<string> {
  const res = await generateIntelligentResponse(q.q, q.role, {
    mode: 'project', projectName: 'Competence Eval', agentRole: q.role, conversationHistory: [], autonomyLevel: 'propose',
  } as any);
  return res?.content ?? '';
}

async function main() {
  console.log('Competence benchmark — matrix OFF (baseline) vs ON, cross-model judge, independent questions.\n');
  let offSum = 0, onSum = 0, n = 0;
  for (const q of QUESTIONS) {
    process.env.RAG_ENABLED = 'off';
    const aOff = await answer(q);
    const sOff = await judge(q, aOff);
    process.env.RAG_ENABLED = 'on';
    const aOn = await answer(q);
    const sOn = await judge(q, aOn);
    offSum += sOff.score; onSum += sOn.score; n++;
    const tag = q.crossRole ? ' [cross-role]' : '';
    console.log(`  [${q.role}]${tag} ${q.q.slice(0, 60)}...`);
    console.log(`     OFF ${sOff.score}/5 (${sOff.note})   ON ${sOn.score}/5 (${sOn.note})   ${sOn.score > sOff.score ? '↑ lift' : sOn.score === sOff.score ? '= same' : '↓ worse'}`);
  }
  process.env.RAG_ENABLED = 'on';
  const offAvg = offSum / n, onAvg = onSum / n;
  console.log(`\n=== Baseline (matrix OFF): ${offAvg.toFixed(2)}/5   ·   With matrix (ON): ${onAvg.toFixed(2)}/5   ·   lift ${(onAvg - offAvg >= 0 ? '+' : '')}${(onAvg - offAvg).toFixed(2)} (${offAvg > 0 ? Math.round(((onAvg - offAvg) / offAvg) * 100) : 0}%) ===`);
  process.exit(0);
}
main().catch((e) => { console.error('ERROR:', e?.message || e); process.exit(1); });
