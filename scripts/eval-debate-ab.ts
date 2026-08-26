/**
 * Wave 1B measurement: does the bull/bear debate improve DECISION QUALITY vs a single-pass answer?
 *
 * For each ambiguous, high-stakes founder decision we produce two recommendations:
 *   A) single-pass: ask the decision-lead directly (one call)
 *   B) debate: runDebate -> for / against / synthesized recommendation (three calls)
 * A blind judge scores each 1..5 on decision quality (weighs both sides, names real tradeoffs,
 * commits clearly, names the key risk). Order is alternated per question to cancel position bias.
 *
 * Limitation (honest): today the judge is the same model family as the writer (Groq's model 404s and
 * Gemini's free tier is quota-exhausted), so this is not a cross-model judge. Both candidates share the
 * writer, so the A-vs-B comparison is still fair for measuring the debate PROCESS, not model identity.
 *
 * Run:
 *   LLM_MODE=test TEST_LLM_PROVIDER=openai STORAGE_MODE=memory \
 *     ./node_modules/.bin/tsx -r dotenv/config scripts/eval-debate-ab.ts
 */
import { runDebate } from '../server/ai/debate';
import { generateChatWithRuntimeFallback } from '../server/llm/providerResolver';

const QUESTIONS = [
  { q: 'Should we launch on Product Hunt now or wait a month to polish?', ctx: 'Pre-revenue SaaS, small waitlist, the product works but onboarding is rough.' },
  { q: 'Should we price the Pro plan at 999 or 1299 rupees per month?', ctx: 'Indian freelancer market, competitors sit around 1500, we are new and unknown.' },
  { q: 'Should we build the mobile app now or double down on the web product?', ctx: 'Two-person team, most signups are on desktop, users keep asking for mobile.' },
  { q: 'Should we hire a salesperson or keep doing founder-led sales for another quarter?', ctx: 'Early B2B SaaS, founder closes most deals but is stretched thin.' },
];

async function singlePass(q: string, ctx: string): Promise<string> {
  const res = await generateChatWithRuntimeFallback({
    messages: [
      { role: 'system', content: 'You are the decision lead. Commit to a clear recommendation.' },
      { role: 'user', content: `Decision: ${q}\n\nBackground:\n${ctx}\n\nGive your recommendation in a few sentences: what to do, the key reason, and the main risk to watch.` },
    ],
    maxTokens: 700,
    temperature: 0.7,
  });
  return (res.content || '').trim();
}

function parseScores(raw: string): { a: number; b: number } | null {
  const m = raw.replace(/```json|```/g, '').match(/\{[^}]*\}/);
  if (!m) return null;
  try {
    const o = JSON.parse(m[0]);
    const a = Number(o.a), b = Number(o.b);
    if (Number.isFinite(a) && Number.isFinite(b)) return { a, b };
  } catch { /* fall through */ }
  return null;
}

async function judge(question: string, respA: string, respB: string): Promise<{ a: number; b: number } | null> {
  const res = await generateChatWithRuntimeFallback({
    messages: [
      { role: 'system', content: 'You are a strict evaluator of decision quality. A great decision recommendation weighs BOTH sides, names real tradeoffs, commits to a clear call, and names the key risk. A weak one is generic, one-sided, or wishy-washy. Score honestly.' },
      { role: 'user', content: `Decision: ${question}\n\nResponse A:\n${respA}\n\nResponse B:\n${respB}\n\nScore each response from 1 (poor) to 5 (excellent) on decision quality. Return ONLY JSON: {"a": <1-5>, "b": <1-5>}` },
    ],
    maxTokens: 200,
    temperature: 0,
  });
  return parseScores(res.content || '');
}

(async () => {
  process.env.DEBATE_MODE_ENABLED = 'true';
  let singleTotal = 0, debateTotal = 0, judged = 0, debateWins = 0, singleWins = 0, ties = 0;

  for (let i = 0; i < QUESTIONS.length; i++) {
    const { q, ctx } = QUESTIONS[i];
    console.log(`\n[${i + 1}/${QUESTIONS.length}] ${q}`);
    const single = await singlePass(q, ctx);
    const deb = await runDebate({ question: q, context: ctx });
    if (!deb) { console.log('  (debate returned null, skipping)'); continue; }

    // Alternate presentation order to cancel position bias.
    const singleFirst = i % 2 === 0;
    const respA = singleFirst ? single : deb.recommendation;
    const respB = singleFirst ? deb.recommendation : single;
    const scores = await judge(q, respA, respB);
    if (!scores) { console.log('  (judge did not return parseable scores, skipping)'); continue; }

    const singleScore = singleFirst ? scores.a : scores.b;
    const debateScore = singleFirst ? scores.b : scores.a;
    judged++; singleTotal += singleScore; debateTotal += debateScore;
    if (debateScore > singleScore) debateWins++; else if (singleScore > debateScore) singleWins++; else ties++;
    console.log(`  single-pass: ${singleScore}/5   debate: ${debateScore}/5   (debate latency ${deb.latencyMs}ms, 3 calls)`);
  }

  console.log('\n════════════════ RESULT ════════════════');
  if (judged === 0) { console.log('No questions judged (provider/parse issue). Cannot conclude.'); process.exit(1); }
  const sAvg = singleTotal / judged, dAvg = debateTotal / judged;
  console.log(`Questions judged: ${judged}`);
  console.log(`Single-pass avg: ${sAvg.toFixed(2)}/5`);
  console.log(`Debate avg:      ${dAvg.toFixed(2)}/5`);
  console.log(`Debate wins: ${debateWins}   Single wins: ${singleWins}   Ties: ${ties}`);
  const lift = dAvg - sAvg;
  console.log(`\nVERDICT: debate ${lift > 0.3 ? 'shows a clear lift' : lift > 0 ? 'shows a marginal lift' : 'shows NO lift'} (${lift >= 0 ? '+' : ''}${lift.toFixed(2)} vs single-pass).`);
  console.log('Cost reminder: debate is 3x the LLM calls of single-pass. Keep gated OFF unless the lift justifies it.');
  process.exit(0);
})().catch((err) => { console.error('FATAL', err); process.exit(1); });
