/**
 * ITL-2 / MEAS-07. Validates the QUALITY judge used by the benchmark: it must discriminate, an expert
 * answer scores high, a generic one mid, a vague/wrong one low, and it must ORDER them correctly. If
 * the judge cannot tell good from bad, its benchmark numbers are worthless. Free on Ollama.
 *
 * Run: set -a; source ./.env; set +a; EVAL_PROVIDER=ollama-test LLM_MODE=test TEST_OLLAMA_MODEL=llama3.2:3b \
 *   ./node_modules/.bin/tsx scripts/calibrate-quality-judge.ts
 */
import { generateWithPreferredProvider } from '../server/llm/providerResolver.js';

const EVAL_PROVIDER = (process.env.EVAL_PROVIDER || 'groq') as any;

async function judge(q: string, rubric: string, answer: string): Promise<number> {
  const system = 'You are a strict examiner grading an answer to an expert question. 5 = expert, names specific mechanisms/frameworks and applies them; 3 = competent but generic; 1 = vague or wrong. Return ONLY JSON: {"score": <1-5>}.';
  const user = `Question: ${q}\n\nRubric (what a top answer covers): ${rubric}\n\nAnswer:\n${answer}\n\nJSON:`;
  try {
    const c = await generateWithPreferredProvider(
      { messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature: 0, maxTokens: 60 } as any,
      EVAL_PROVIDER,
    );
    const m = (c.content || '').match(/\{[\s\S]*\}/);
    return m ? (Number(JSON.parse(m[0]).score) || 0) : 0;
  } catch { return 0; }
}

const Q = 'How should I choose a type scale for a UI and why does it matter for hierarchy?';
const RUBRIC = 'modular scale ratio; hierarchy via weight+contrast not size alone; vertical rhythm/line-height; limited steps; legibility/measure.';
const CASES = [
  { label: 'expert', band: [4, 5], answer: 'Use a modular scale (say a 1.25 major-third ratio) so sizes relate proportionally. Hierarchy comes mostly from weight and contrast, not size alone, per Refactoring UI. Set line-height for vertical rhythm, keep to a handful of steps, and protect legibility with a comfortable measure (around 60 to 75 characters).' },
  { label: 'generic', band: [2, 4], answer: 'Pick some font sizes that look good together and make headings a bit bigger than body text so people can tell them apart.' },
  { label: 'vague/wrong', band: [1, 2], answer: 'Type scale is mostly about picking nice colors. Just use whatever the design tool suggests by default and it will be fine.' },
];

async function main() {
  console.log('=== ITL-2 / MEAS-07: quality-judge calibration ===\n');
  const scores: number[] = [];
  let inBand = 0;
  for (const c of CASES) {
    const s = await judge(Q, RUBRIC, c.answer);
    scores.push(s);
    const ok = s >= c.band[0] && s <= c.band[1];
    if (ok) inBand++;
    console.log(`  ${ok ? '✓' : '·'} ${c.label.padEnd(12)} -> judge ${s}/5 (expected ${c.band[0]}-${c.band[1]})`);
  }
  const [expert, generic, vague] = scores;
  const ordered = expert >= generic && generic >= vague && expert > vague;
  console.log(`\nOrders correctly (expert >= generic >= vague, expert > vague): ${ordered}`);
  console.log(`In expected band: ${inBand}/${CASES.length}`);
  const pass = ordered && inBand >= 2;
  console.log(`\nRESULT: ${pass ? 'PASS' : 'REVIEW'}: the judge ${pass ? 'discriminates quality (its benchmark numbers are trustworthy)' : 'did not discriminate cleanly on this weak model, use a stronger judge before trusting fine-grained scores'}.`);
  process.exit(pass ? 0 : 1);
}
main().catch((e) => { console.error('calibration error:', e); process.exit(1); });
