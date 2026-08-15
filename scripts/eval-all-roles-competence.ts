// THE PROOF, all 34 roles: does the deepened knowledge base make each agent measurably smarter,
// and is it top-1%? For each role, one hard EXPERT question with an independently-authored rubric
// (written from domain expertise, NOT copied from the ingested sources, so no teaching-to-the-test).
// Each question is answered by the REAL app generation with RAG OFF (baseline) then ON, and a blind
// cross-model Groq judge scores 1-5 against "what a top-1% practitioner would say".
// Runs on the app's providers (generation + Groq judge), independent of the Claude Code quota.
//
// Run: LLM_MODE=prod ./node_modules/.bin/tsx -r dotenv/config scripts/eval-all-roles-competence.ts
// Resumable: results append to scratchpad/competence-results.json; already-done roles are skipped.
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { generateIntelligentResponse } from '../server/ai/openaiService.js';
import { generateWithPreferredProvider } from '../server/llm/providerResolver.js';

const OUT = (process.env.COMP_OUT || '/private/tmp/claude-501/-Users-shashankrai-Documents-hatching-mvp-5th-march/e433eb83-3933-4614-80d6-c592aed4b0f7/scratchpad/competence-results.json');
const EVAL_PROVIDER = (process.env.EVAL_PROVIDER || (process.env.GROQ_API_KEY ? 'groq' : 'gemini')) as any;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Q { role: string; q: string; rubric: string }

export const QUESTIONS: Q[] = [
  { role: 'Product Manager', q: 'We have 40 feature requests and a small team. How do you decide what to build next, and keep the roadmap from becoming a feature factory?', rubric: 'RICE/Kano/WSJF or cost-of-delay prioritization; outcomes over outputs; continuous discovery / opportunity solution tree (Torres); JTBD; roadmap as now-next-later not a promised feature list; the Build Trap (Perri); tie to a North Star / input metric.' },
  { role: 'Business Analyst', q: 'How do you turn a vague stakeholder request into requirements the team can build with no ambiguity?', rubric: 'elicitation techniques + BABOK; functional vs non-functional; testable acceptance criteria / Gherkin given-when-then; INVEST; unambiguous verifiable requirements (Wiegers); traceability; MoSCoW; do not solution before the problem.' },
  { role: 'Backend Developer', q: 'Design a public REST API for a payments-adjacent service. What must you get right for correctness and safety?', rubric: 'idempotency keys; safe/idempotent methods + correct status codes + Problem Details (RFC 9110/9457); keyset vs offset pagination; versioning; rate limiting/backpressure; OAuth2 authz + input validation / mass-assignment; transactions/isolation; avoid N+1.' },
  { role: 'Software Engineer', q: 'A 600-line function has grown that everyone is afraid to touch. How do you make it safe to change?', rubric: 'refactor in small steps behind tests (Fowler); characterization / self-testing code; name the code smells; two hats; extract function + naming; four rules of simple design (Beck); avoid big-bang rewrite; YAGNI.' },
  { role: 'Technical Lead', q: 'Should we split our monolith into microservices? Walk me through the decision.', rubric: 'MonolithFirst (Fowler); microservices prerequisites (deploy automation, observability, team autonomy); Conway/inverse maneuver; distributed-monolith anti-pattern; fallacies of distributed computing; reversible vs irreversible; Strangler Fig; fit to team topology.' },
  { role: 'AI Developer', q: 'Our RAG feature gives wrong answers sometimes. How do you diagnose, fix it, and prove it improved?', rubric: 'eval-driven development (LLM-as-judge + a real eval set); the seven failure points of RAG; chunking/retrieval quality, hybrid search, re-ranking; grounding / cite-or-admit; lost-in-the-middle; when long-context or fine-tuning beats RAG; prompt-injection guardrails (OWASP LLM); measure retrieval AND end-to-end.' },
  { role: 'DevOps Engineer', q: 'How do you set reliability targets and know your delivery pipeline is healthy?', rubric: 'SLI/SLO/SLA + error budgets (Google SRE); the DORA four keys + elite thresholds; eliminate toil; blameless postmortems; burn-rate (not naive-threshold) alerting; 100% uptime is the wrong target.' },
  { role: 'Product Designer', q: 'Take me through your process from a fuzzy problem to a shipped feature.', rubric: 'double diamond / design thinking diverge-converge; frame the problem before solutioning; JTBD; prototyping fidelity low-to-high (right design vs design right, Buxton); design critique; design systems/tokens; measure impact (HEART/GSM); avoid hi-fi too early.' },
  { role: 'UX Designer', q: "Our pricing page isn't converting. Diagnose the visual hierarchy and tell me exactly what to change, and name the mechanisms.", rubric: 'pre-attentive processing; visual weight = size+color+density+isolation+position; squint/grayscale test; CTA target size (Fitts); WCAG/APCA contrast; recommended-tier emphasis; F-pattern scanning.' },
  { role: 'UI Engineer', q: 'What makes a custom dropdown/select component genuinely production-grade?', rubric: 'semantic HTML / native where possible; WAI-ARIA authoring practices + full keyboard/focus management; first rule of ARIA (no ARIA beats bad ARIA); focus-visible; WCAG contrast + target size 2.5.5; avoid div-soup fake buttons; INP/main-thread cost.' },
  { role: 'UI Designer', q: 'How do you design the states and patterns for a data-heavy dashboard interface?', rubric: 'all component states (default/hover/focus/active/disabled/loading/error/empty); Laws of UX (Hick/Fitts/Miller); form + data-table best practices; empty + skeleton states; design tokens; touch targets; avoid modal overuse and mystery-meat icons.' },
  { role: 'Designer', q: 'This layout is cramped and hard to read. Make it feel clean and premium, and tell me exactly what you change.', rubric: 'CRAP (contrast/repetition/alignment/proximity); whitespace + 8pt spacing; type scale + measure + pairing; visual hierarchy; restrained palette (60-30-10) + WCAG contrast; Gestalt; Refactoring UI tactics; avoid too many fonts / low contrast.' },
  { role: 'Creative Director', q: "The brief says 'make it go viral.' How do you turn that into a great, effective campaign?", rubric: 'a tight single-minded proposition; the Big Idea vs mere execution (Bernbach); creativity AND effectiveness (Binet & Field / IPA, emotional beats rational, fame-feeling-fluency); art-copy partnership; avoid design-by-committee and awards-over-effectiveness; how it will be measured.' },
  { role: 'Brand Strategist', q: "A startup says 'we need a brand.' Where do you start and what do you deliver?", rubric: 'brand strategy before identity; positioning + onliness (Neumeier Zag); Aaker brand identity/equity; Keller CBBE; distinctive assets + mental/physical availability (Byron Sharp); archetypes; brand voice; differentiation buyers actually perceive; brand is not a logo.' },
  { role: 'QA Lead', q: 'Design a test strategy for a growing product with a slow, flaky suite.', rubric: 'test pyramid (Fowler) / testing trophy; push tests down the pyramid; risk-based testing; exploratory + session-based (Bach); flaky-test management (quarantine, determinism); shift-left; coverage as a signal not a target; avoid the ice-cream-cone / everything-through-the-UI.' },
  { role: 'Content Writer', q: 'How do you write a web article people actually read and act on?', rubric: 'inverted pyramid; scanning / F-pattern; information scent; front-load value; plain language + readability (Flesch); one idea per paragraph; helpful-content over search-engine-first; cut clutter (Zinsser); avoid keyword stuffing / fluff.' },
  { role: 'Copywriter', q: 'Write me a high-converting landing page. What is your approach and structure?', rubric: 'message-to-market match / stages of awareness (Schwartz); AIDA or PAS; benefits over features + the "so what" test; Cialdini persuasion; social proof + risk reversal/guarantee; one specific strong CTA; voice of customer; clarity over cleverness.' },
  { role: 'Growth Marketer', q: 'We have users but growth is flat. How do you find and fix the real lever?', rubric: 'growth loops vs funnels; AARRR; activation / aha before more acquisition; retention curve / leaky bucket; North Star + input metrics; ICE experiment prioritization; the growth equation; PMF first (Sean Ellis 40%); avoid one-off hacks over durable loops.' },
  { role: 'Marketing Specialist', q: 'How do you take a new product to market on a small budget?', rubric: 'STP (segmentation/targeting/positioning); the marketing mix (4Ps/7Ps); sharp positioning (Dunford); brand vs performance balance (Binet & Field 60/40); distinctive assets / category entry points; funnel and journey; measure CAC/LTV/ROAS; do not target everyone.' },
  { role: 'Social Media Manager', q: 'Build a social strategy for a brand starting from zero.', rubric: 'platform-specific best practices; content pillars / rule of thirds; the social funnel; hook-retain-reward short video; community management + social listening; engagement rate vs reach/impressions; sustainable cadence; avoid vanity metrics, bought followers, trendjacking.' },
  { role: 'SEO Specialist', q: 'Our site gets almost no organic traffic. Give me a prioritized SEO plan.', rubric: 'crawlability/indexability (robots/sitemaps/canonical); Core Web Vitals / page experience; search intent + keyword research; on-page (titles/headings/internal links); E-E-A-T + helpful content; structured data; links; measure in Search Console; avoid keyword-density and duplicate-content-penalty myths.' },
  { role: 'Email Specialist', q: 'Set up email so it reliably lands in the inbox and drives revenue.', rubric: 'authentication SPF/DKIM/DMARC + BIMI + 2024 bulk-sender rules; sender reputation + IP warmup; double opt-in + list hygiene + sunset; lifecycle flows (welcome/cart/win-back); segmentation; metrics (deliverability, CTOR, post-Apple-MPP opens); avoid bought lists and batch-and-blast.' },
  { role: 'Data Analyst', q: 'Turn our messy product events into a dashboard leadership actually trusts.', rubric: 'dimensional modeling (Kimball star schema / grain); single source of truth / metrics layer (dbt); crisp metric definitions; cohort/funnel/retention; viz principles (Tufte data-ink, right chart type, Knaflic); dashboard design (Few); avoid pie charts, chartjunk, dual/truncated axes.' },
  { role: 'Data Scientist', q: "We ran an A/B test and it 'won.' Should we ship it?", rubric: 'peeking / p-hacking, fixed horizon or sequential testing; sample ratio mismatch; power / MDE; novelty and primacy effects; practical vs statistical significance; multiple comparisons; segment checks / Simpsons paradox; guard against data leakage; trustworthy experiments (Kohavi).' },
  { role: 'Operations Manager', q: 'Our fulfillment is slow and error-prone. How do you fix the operation?', rubric: 'value stream mapping; the wastes (muda/mura/muri); Theory of Constraints (find and exploit the bottleneck); standard work + kaizen + PDCA; pull / kanban; DMAIC; OEE; avoid local optimization and watermelon metrics.' },
  { role: 'Business Strategist', q: 'How do we actually win in a crowded market?', rubric: 'Porter Five Forces + generic strategies + activity-system fit; strategy is choices and trade-offs not a wish list (Rumelt kernel); Blue Ocean value innovation / ERRC; Playing to Win (where to play / how to win); moats (7 Powers); avoid stuck-in-the-middle and goals-as-strategy.' },
  { role: 'HR Specialist', q: 'How do you hire well and build a team that performs?', rubric: 'structured interviews + work-sample tests (validity evidence, Schmidt); psychological safety / Project Aristotle (Edmondson); Project Oxygen manager behaviors; skills-based hiring + unbiasing; onboarding (the Four Cs); continuous performance + clear goals; avoid unstructured interviews, culture-fit bias, stack ranking.' },
  { role: 'Instructional Designer', q: 'Design an effective training course, not just a slide deck.', rubric: 'backward design / objectives first (Mager ABCD, Bloom); action mapping (Cathy Moore); Gagne nine events; cognitive load + multimedia principles (Mayer/Sweller); retrieval + spaced practice; Kirkpatrick evaluation; job aid vs a course; debunk learning styles.' },
  { role: 'Audio Editor', q: 'Master a podcast so it sounds professional on every platform.', rubric: 'loudness targets (-16 LUFS podcast, -14 streaming, EBU R128 -23; true peak -1 dBTP); LUFS vs peak; gain staging; subtractive EQ + high-pass; compression; de-essing; noise reduction (RX); avoid the loudness war / over-compression / peak-normalization.' },
  { role: 'Idea Partner', q: "I'm stuck on a hard decision. Help me think about it well.", rubric: 'first-principles + inversion; second-order thinking; base rates / probabilistic thinking; reversible vs irreversible (two-way door); premortem (Klein); reframe / solve the right problem (5 Whys); a latticework of mental models; guard biases (confirmation/sunk-cost/anchoring); sharp questions.' },
  { role: 'Finance Analyst', q: 'Are our SaaS unit economics healthy? What exactly do you look at?', rubric: 'LTV:CAC with the correct formula + CAC payback; NRR/GRR; Rule of 40; burn multiple (Sacks); magic number; gross/contribution margin; cohort economics; runway/burn; avoid vanity ARR and LTV built on a wrong churn assumption.' },
  { role: 'Legal Counsel', q: 'First-time founders: what legal foundations should we set up? (general information)', rubric: 'entity choice (C-corp / Delaware); founder IP assignment + vesting; SAFE/convertible vs priced round + cap table; 83(b) as a consideration; IP (trademark/patent/copyright/trade secret); core contracts (ToS/privacy/NDA/MSA); contractor vs employee; privacy (GDPR/CCPA); and the "not legal advice, verify with a licensed attorney" framing.' },
  { role: 'Sales Lead', q: 'Our reps chase every deal and lose late in the cycle. Fix the sales motion.', rubric: 'qualification (MEDDIC/MEDDPICC); discovery before pitching (SPIN / Gap Selling); the economic buyer + a champion + multithreading; mutual action plans; JOLT for customer indecision; forecasting / pipeline hygiene; avoid happy ears, discounting to close, single-threaded deals.' },
  { role: 'Customer Success Manager', q: 'Churn is creeping up. Build a CS motion that keeps and grows accounts.', rubric: 'outcome-based success / desired outcome (Lincoln Murphy); onboarding + time-to-value; health scores + leading indicators of churn; proactive not reactive at renewal; NRR/GRR; QBRs / success plans; expansion / land-and-expand; segmentation (tech-touch vs high-touch); do not save churn only at renewal.' },
];

function tierOf(score: number): string {
  if (score >= 4.5) return 'top ~1%';
  if (score >= 3.5) return 'top ~10%';
  if (score >= 2.5) return 'competent (median)';
  if (score >= 1.5) return 'below par';
  return 'weak';
}

async function judge(q: Q, answer: string): Promise<{ quality: number; frameworks: number; note: string }> {
  const system =
    'You are a senior examiner grading an expert answer from a working professional in a chat (NOT an essay). Grade on QUALITY ' +
    'and SPECIFICITY, not exhaustiveness. The answer may be intentionally concise and conversational; do NOT penalize brevity or ' +
    'for omitting some rubric items. A short answer that brings 2 to 3 CORRECT, specific expert frameworks and applies them beats ' +
    'a long generic one. Use the rubric only as the reference for what expert-level looks like. ' +
    'quality: 5 = what a top-1% practitioner would say (correct, specific, expert, well-applied); 4 = strong and specific; ' +
    '3 = competent but generic; 2 = shallow; 1 = vague or wrong. ' +
    'frameworks: the count of DISTINCT correct expert frameworks, mechanisms, metrics, or named methods the answer actually names ' +
    'AND uses appropriately (0 if it is only generic advice with no real named concepts). ' +
    'Return ONLY JSON: {"quality":<1-5>,"frameworks":<int>,"note":"<=12 words>"}.';
  const user = `Question: ${q.q}\n\nRubric (reference for the expert canon): ${q.rubric}\n\nAnswer:\n${answer}\n\nJSON:`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const c = await generateWithPreferredProvider(
        { messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature: 0, maxTokens: 120 } as any,
        EVAL_PROVIDER,
      );
      const m = (c.content || '').match(/\{[\s\S]*\}/);
      if (!m) { await sleep(1500); continue; }
      const p = JSON.parse(m[0]);
      return { quality: Number(p.quality) || 0, frameworks: Number(p.frameworks) || 0, note: String(p.note || '') };
    } catch { await sleep(2000); }
  }
  return { quality: 0, frameworks: 0, note: 'judge error' };
}

const citeCount = (s: string) => (s.match(/https?:\/\//g) || []).length;

async function answer(q: Q): Promise<string> {
  const res = await generateIntelligentResponse(q.q, q.role, {
    mode: 'project', projectName: 'Competence Eval', agentRole: q.role, conversationHistory: [], autonomyLevel: 'propose',
  } as any);
  return res?.content ?? '';
}

async function main() {
  const results: any[] = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : [];
  const done = new Set(results.map((r) => r.role));
  console.log(`Competence benchmark, all 34 roles. Already done: ${done.size}. Judge: ${EVAL_PROVIDER}.\n`);
  for (const q of QUESTIONS) {
    if (done.has(q.role)) { console.log(`  [skip] ${q.role}`); continue; }
    try {
      process.env.RAG_ENABLED = 'off';
      const aOff = await answer(q); await sleep(400);
      const jOff = await judge(q, aOff); await sleep(400);
      process.env.RAG_ENABLED = 'on';
      const aOn = await answer(q); await sleep(400);
      const jOn = await judge(q, aOn); await sleep(400);
      const row = {
        role: q.role,
        offQ: jOff.quality, onQ: jOn.quality, qLift: jOn.quality - jOff.quality,
        offF: jOff.frameworks, onF: jOn.frameworks,
        offCit: citeCount(aOff), onCit: citeCount(aOn),
        tier: tierOf(jOn.quality), offNote: jOff.note, onNote: jOn.note, aOff, aOn,
      };
      results.push(row);
      writeFileSync(OUT, JSON.stringify(results, null, 2));
      console.log(`  [${q.role}] quality OFF ${jOff.quality} -> ON ${jOn.quality} (${tierOf(jOn.quality)})  ·  frameworks ${jOff.frameworks}->${jOn.frameworks}  ·  cites ${citeCount(aOff)}->${citeCount(aOn)}`);
    } catch (e: any) {
      console.log(`  [${q.role}] ERROR ${e?.message || e}`);
    }
  }
  const s = results.filter((r) => r.onQ > 0 && r.offQ > 0);
  const avg = (f: (r: any) => number) => s.reduce((a, r) => a + f(r), 0) / (s.length || 1);
  const offQ = avg((r) => r.offQ), onQ = avg((r) => r.onQ);
  const offF = avg((r) => r.offF), onF = avg((r) => r.onF);
  const offCit = avg((r) => r.offCit), onCit = avg((r) => r.onCit);
  const top1 = s.filter((r) => r.onQ >= 4.5).length, top10 = s.filter((r) => r.onQ >= 3.5).length;
  const improved = s.filter((r) => r.onQ > r.offQ).length, worse = s.filter((r) => r.onQ < r.offQ).length;
  console.log(`\n=== ${s.length} roles scored ===`);
  console.log(`Quality (1-5):    OFF ${offQ.toFixed(2)}  ->  ON ${onQ.toFixed(2)}   lift ${(onQ - offQ >= 0 ? '+' : '')}${(onQ - offQ).toFixed(2)} (${offQ > 0 ? Math.round(((onQ - offQ) / offQ) * 100) : 0}%)`);
  console.log(`Frameworks named: OFF ${offF.toFixed(1)}  ->  ON ${onF.toFixed(1)}   (+${(onF - offF).toFixed(1)})`);
  console.log(`Citations/reply:  OFF ${offCit.toFixed(1)}  ->  ON ${onCit.toFixed(1)}`);
  console.log(`ON at top ~1% (>=4.5): ${top1}/${s.length}  ·  top ~10%+ (>=3.5): ${top10}/${s.length}  ·  improved ${improved}, worse ${worse}, same ${s.length - improved - worse}`);
  console.log(`Results saved: ${OUT}`);
  process.exit(0);
}
// Only run when executed directly, NOT when another script imports QUESTIONS from this file
// (importing must not trigger the whole benchmark + process.exit).
const isEntry = !!process.argv[1] && process.argv[1].includes('eval-all-roles-competence');
if (isEntry) main().catch((e) => { console.error('ERROR:', e?.message || e); process.exit(1); });
