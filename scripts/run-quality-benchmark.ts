/**
 * ITL-2 / MEAS-05 + MEAS-06. Runs a FROZEN golden set through the live system (RAG on), judge-scores
 * it, compares the overall to the frozen baseline, and gates it (a real regression FAILS). Writes a
 * dated trend entry; the first run saves the baseline. Free on Ollama.
 *
 * Run: set -a; source ./.env; set +a;
 *   STORAGE_MODE=memory LLM_MODE=test TEST_LLM_PROVIDER=ollama EVAL_PROVIDER=ollama-test \
 *   TEST_OLLAMA_MODEL=llama3.2:3b RAG_EMBED_PROVIDER=openai ./node_modules/.bin/tsx scripts/run-quality-benchmark.ts
 */
import { generateIntelligentResponse } from '../server/ai/openaiService.js';
import { generateWithPreferredProvider } from '../server/llm/providerResolver.js';
import { evaluateBenchmarkDelta, loadBaseline, saveBaseline, appendTrend } from '../server/eval/benchmarkGate.js';

const VERSION = 'v1';
const EVAL_PROVIDER = (process.env.EVAL_PROVIDER || 'groq') as any;

// FROZEN golden set v1: expert questions across roles with rubric key-points (do NOT edit without
// bumping VERSION, or scores stop being comparable).
const GOLDEN = [
  { role: 'UX Designer', q: "Our pricing page isn't converting. Diagnose the visual hierarchy and name the perceptual mechanisms.", rubric: 'pre-attentive processing; visual weight = size+color+density+isolation; squint/grayscale test; CTA size (Fitts); contrast/WCAG; recommended-tier emphasis.' },
  { role: 'UX Designer', q: 'How should I choose a type scale, and why does it matter for hierarchy?', rubric: 'modular/type scale ratio; hierarchy via weight+contrast not size alone; vertical rhythm/line-height; limited steps; legibility/measure.' },
  { role: 'Data Scientist', q: 'We want to know if a new onboarding flow reduces churn. How do you design the experiment?', rubric: 'randomized controlled experiment / A-B; define the metric + guardrails; sample size / power; control for confounders; significance + practical effect; avoid peeking.' },
  { role: 'Growth Marketer', q: "We're designing an onboarding flow to reduce early churn. What should I consider end to end?", rubric: 'activation moment / aha; time-to-value; progressive disclosure; reduce cognitive load; measure activation + retention; lifecycle nudges.' },
];

async function judge(q: (typeof GOLDEN)[number], answer: string): Promise<number> {
  const system = 'You are a strict examiner grading an answer to an expert question. 5 = expert, names specific mechanisms/frameworks and applies them; 3 = competent but generic; 1 = vague/wrong. Return ONLY JSON: {"score": <1-5>}.';
  const user = `Question: ${q.q}\n\nRubric (what a top answer covers): ${q.rubric}\n\nAnswer:\n${answer}\n\nJSON:`;
  try {
    const c = await generateWithPreferredProvider(
      { messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature: 0, maxTokens: 60 } as any,
      EVAL_PROVIDER,
    );
    const m = (c.content || '').match(/\{[\s\S]*\}/);
    return m ? (Number(JSON.parse(m[0]).score) || 0) : 0;
  } catch { return 0; }
}

async function answer(q: (typeof GOLDEN)[number]): Promise<string> {
  process.env.RAG_ENABLED = 'on';
  const res = await generateIntelligentResponse(q.q, q.role, {
    mode: 'project', projectName: 'Benchmark', agentRole: q.role, conversationHistory: [], autonomyLevel: 'propose',
  } as any);
  return (res as any)?.content ?? '';
}

async function main() {
  console.log(`=== ITL-2 MEAS-05/06: quality benchmark (frozen golden set ${VERSION}) ===\n`);
  let sum = 0;
  for (const q of GOLDEN) {
    const s = await judge(q, await answer(q));
    sum += s;
    console.log(`  [${q.role}] ${q.q.slice(0, 52)}... -> ${s}/5`);
  }
  const overall = Number((sum / GOLDEN.length).toFixed(3));
  const baseline = await loadBaseline(VERSION);
  const gate = evaluateBenchmarkDelta(baseline, overall);
  const date = new Date().toISOString();

  console.log(`\nOverall: ${overall}/5  |  baseline: ${baseline ?? 'none'}  |  verdict: ${gate.verdict}  |  gate: ${gate.pass ? 'PASS' : 'FAIL (regression below baseline)'}`);
  await appendTrend({ version: VERSION, date, overall });
  if (baseline === null) {
    await saveBaseline(VERSION, overall);
    console.log('(first run: saved as the frozen baseline for future comparison)');
  }
  process.exit(gate.pass ? 0 : 1);
}
main().catch((e) => { console.error('benchmark error:', e); process.exit(1); });
