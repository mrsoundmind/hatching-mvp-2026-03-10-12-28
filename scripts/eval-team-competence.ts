// Whole-team competence benchmark — proves the deep corpus lifts answers across the roster, not just UX.
// For each expert question, generate an answer with the matrix OFF (baseline) and ON, then a cross-model
// Groq judge (blind to mode) scores 1-5 against an independently-authored rubric. Questions are written
// from domain expertise, NOT copied from the ingested sources (no teaching-to-the-test).
// Run: LLM_MODE=prod RAG_EMBED_PROVIDER=openai ./node_modules/.bin/tsx -r dotenv/config scripts/eval-team-competence.ts
import { generateIntelligentResponse } from '../server/ai/openaiService.js';
import { generateWithPreferredProvider } from '../server/llm/providerResolver.js';

interface Q { role: string; q: string; rubric: string; }

const QUESTIONS: Q[] = [
  // ── Legal Counsel (new) ──
  {
    role: 'Legal Counsel',
    q: 'We want to launch a referral program where users post about us on social media for a reward. What legal issues do I need to handle?',
    rubric: 'FTC endorsement rules: material-connection disclosure required (clear and conspicuous); no fake or unsubstantiated testimonials; substantiate any performance claims; program terms and conditions; privacy of participant data (GDPR/CCPA); tax reporting if rewards are cash. A top answer names the FTC disclosure duty specifically.',
  },
  {
    role: 'Legal Counsel',
    q: 'A freelance contractor built part of our app. What do I need to make sure we actually own that code?',
    rubric: 'Work-for-hire does NOT automatically apply to an independent contractor for software; you need an explicit written IP assignment using present-tense "hereby assigns" (not "agrees to assign", Stanford v. Roche), ideally signed at or before engagement; watch open-source licenses the contractor pulled in (GPL copyleft risk); confirm no third-party or prior-employer IP. A top answer flags the assignment-language trap.',
  },
  // ── Sales Lead (new) ──
  {
    role: 'Sales Lead',
    q: 'A prospect says "this looks great, just send me a proposal and pricing." What should I do?',
    rubric: 'Do not just send pricing (premature, often a polite brush-off / happy ears); run discovery first: quantify the pain and its business cost, identify the economic buyer and the decision process, tie value to their numbers; secure a live next commitment (a meeting) rather than emailing a proposal into a void; multi-thread beyond one contact. A top answer resists the premature-pitch trap.',
  },
  {
    role: 'Sales Lead',
    q: 'A prospect says we are too expensive. How do I handle it?',
    rubric: 'A price objection is usually a value gap, not a number problem; do not reflexively discount (it teaches lower value and destroys margin); diagnose the real concern; re-anchor on value, ROI, and the cost of doing nothing; if you concede price, extract a concession (term, urgency, logo, case study); urgency beats discounting. A top answer refuses the reflexive discount.',
  },
  // ── Customer Success Manager (new) ──
  {
    role: 'Customer Success Manager',
    q: 'A big customer\'s product usage has dropped steadily over the last month. What do I do?',
    rubric: 'Treat a usage drop as a LEADING churn signal and act now, not at renewal; reach out proactively; diagnose whether they reached the outcome they bought and whether the champion is still there; run a save play and re-establish time-to-value; do not wait for a support ticket (reactive firefighting is the anti-pattern). A top answer treats it as a leading indicator and acts early.',
  },
  {
    role: 'Customer Success Manager',
    q: 'How should I actually measure whether my customers are succeeding?',
    rubric: 'Success is whether they got the outcome they bought, not CSAT or NPS (those are satisfaction, leading indicators); build a health score from usage, engagement, sentiment, and outcome progress (not logins alone); track net revenue retention (above 100%) and gross retention; activation and time-to-value; segment the book. A top answer separates satisfaction from delivered outcome.',
  },
  // ── Finance Analyst (existing, deep) ──
  {
    role: 'Finance Analyst',
    q: 'We think we can 3x revenue by spending heavily on paid acquisition. Should we do it?',
    rubric: 'Unit economics first: CAC, contribution margin, and CAC payback period; is the growth funded by improving economics or by burning cash; runway impact; blended vs per-channel CAC (a losing channel can hide behind a good one); LTV:CAC is meaningless without payback measured against cash on hand; model base/upside/downside; growth that outpaces unit-economics improvement is borrowing against the future. A top answer refuses to bless growth without payback math.',
  },
  // ── Growth Marketer (existing, deep) ──
  {
    role: 'Growth Marketer',
    q: 'Our sign-ups are healthy but people do not stick around. Where should I focus?',
    rubric: 'Activation and retention over top-of-funnel; find the aha / activation moment and the key action that predicts retention; fix onboarding to first value; look at cohort retention and whether the curve flattens (a foundational law of retention); do not pour spend into acquisition on a leaky bucket; AARRR with the focus on activation and retention. A top answer redirects from acquisition to activation/retention.',
  },
  // ── Software Engineer (existing, deep) ──
  {
    role: 'Software Engineer',
    q: 'Our codebase is getting hard to change and we keep breaking things when we ship. What do I do?',
    rubric: 'Add tests before changing (test pyramid) so refactoring is safe; refactor in small, verified steps (Fowler) rather than a big-bang rewrite (rewrites are high-risk, MonolithFirst / Chesterton); reduce coupling and clarify module boundaries; continuous integration and code review; treat tech debt as a deliberate, tracked tradeoff. A top answer warns against the rewrite and leads with tests.',
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
      process.env.GROQ_API_KEY ? 'groq' : 'gemini',
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
    mode: 'project', projectName: 'Team Competence Eval', agentRole: q.role, conversationHistory: [], autonomyLevel: 'propose',
  } as any);
  return res?.content ?? '';
}

async function main() {
  console.log('Whole-team competence benchmark — matrix OFF (baseline) vs ON, cross-model judge, independent questions.\n');
  let offSum = 0, onSum = 0, n = 0;
  const byRole = new Map<string, { off: number; on: number; n: number }>();
  for (const q of QUESTIONS) {
    process.env.RAG_ENABLED = 'off';
    const sOff = await judge(q, await answer(q));
    process.env.RAG_ENABLED = 'on';
    const sOn = await judge(q, await answer(q));
    offSum += sOff.score; onSum += sOn.score; n++;
    const r = byRole.get(q.role) ?? { off: 0, on: 0, n: 0 };
    r.off += sOff.score; r.on += sOn.score; r.n++; byRole.set(q.role, r);
    console.log(`  [${q.role}] ${q.q.slice(0, 56)}...`);
    console.log(`     OFF ${sOff.score}/5 (${sOff.note})   ON ${sOn.score}/5 (${sOn.note})   ${sOn.score > sOff.score ? '↑ lift' : sOn.score === sOff.score ? '= same' : '↓ worse'}`);
  }
  process.env.RAG_ENABLED = 'on';
  console.log('\n=== By role (OFF -> ON) ===');
  for (const [role, r] of byRole) console.log(`  ${role.padEnd(26)} ${(r.off / r.n).toFixed(2)} -> ${(r.on / r.n).toFixed(2)}`);
  const offAvg = offSum / n, onAvg = onSum / n;
  console.log(`\n=== Baseline (OFF): ${offAvg.toFixed(2)}/5   ·   With matrix (ON): ${onAvg.toFixed(2)}/5   ·   lift ${(onAvg - offAvg >= 0 ? '+' : '')}${(onAvg - offAvg).toFixed(2)} (${offAvg > 0 ? Math.round(((onAvg - offAvg) / offAvg) * 100) : 0}%) ===`);
  process.exit(0);
}
main().catch((e) => { console.error('ERROR:', e?.message || e); process.exit(1); });
