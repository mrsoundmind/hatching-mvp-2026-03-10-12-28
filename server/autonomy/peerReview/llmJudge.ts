import { generateWithPreferredProvider } from '../../llm/providerResolver.js';
import { getRoleIntelligence } from '@shared/roleIntelligence';

/**
 * v2.2 Phase D — Real LLM-as-judge peer review.
 *
 * Before this, `evaluatePeerReviewRubric` was fully deterministic regex + safety-score matching:
 * the "reviewing agent" never actually read the work. This module makes a second AI genuinely
 * evaluate the first AI's work through the reviewer's role-specific `peerReviewLens` and return a
 * real verdict that can send bad work back.
 *
 * Two deliberate design choices, both from the plan's calibration section:
 *   1. CROSS-MODEL judge. The writer runs on the premium chain (DeepSeek/Gemini). The judge runs on
 *      Groq (a different model family). A model grading its own family's output shows self-preference
 *      bias; judging on a different model is the primary mitigation. Groq is also free, so this adds
 *      no per-task cost, which is the plan's other constraint.
 *   2. BLIND authorship. The judge is never told which agent produced the draft — it sees only the
 *      task and the work. Removes any "trust the senior role" halo from the verdict.
 *
 * Fail-safe posture: any parse/LLM failure returns `null`. The caller treats null as "no judgment
 * available" and does NOT block — an infra hiccup must never gate delivery of otherwise-fine work.
 * This matches the existing pipeline behaviour ("peer review failed → proceed without review").
 */

export type JudgeVerdict = 'approve' | 'revise' | 'reject';
export type JudgeSeverity = 'none' | 'minor' | 'major' | 'critical';

export interface PeerJudgeResult {
  reviewerHatchId: string;
  reviewerName: string;
  reviewerRole: string;
  verdict: JudgeVerdict;
  severity: JudgeSeverity;
  specificProblems: string[];
  mustFix: string[];
  confidence: number; // 0..1
  reasoning: string;
  judgeModel: string;
}

export interface RunLlmJudgeInput {
  reviewerHatchId: string;
  reviewerName: string;
  reviewerRole: string;
  peerReviewLens?: string;
  task: string;
  draft: string;
  /**
   * Optional generate override. When omitted, the judge calls Groq via
   * generateWithPreferredProvider (cross-model, free). Tests inject a deterministic
   * function here so the harness does not depend on live keys.
   */
  generate?: (prompt: string, system: string) => Promise<string>;
}

const VALID_VERDICTS: JudgeVerdict[] = ['approve', 'revise', 'reject'];
const VALID_SEVERITIES: JudgeSeverity[] = ['none', 'minor', 'major', 'critical'];

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

function asStringArray(v: unknown, cap = 6): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .map((x) => x.trim())
    .slice(0, cap);
}

/**
 * Build the judge prompt. Blind to authorship on purpose (see module header).
 * The reviewer's own lens is the evaluation rubric — this is what makes a QA reviewer
 * check testability while a marketer checks audience fit.
 */
function buildJudgePrompt(input: RunLlmJudgeInput): { system: string; user: string } {
  const lens =
    input.peerReviewLens?.trim() ||
    getRoleIntelligence(input.reviewerRole)?.peerReviewLens?.trim() ||
    'Evaluate for correctness, completeness, and whether it actually does what the task asked.';

  const system = [
    `You are a senior ${input.reviewerRole} performing an internal peer review of a teammate's work before it ships.`,
    `Review STRICTLY through your professional lens: ${lens}`,
    `Hold a high bar for BLOCKING, not for approving. APPROVE work that correctly and completely does what the task asked, even if it could be marginally improved or you would have phrased it differently — good work ships, do not nitpick style or "could add more". Ask for REVISION only when there is a real, material gap that leaves the work incomplete, unverifiable, or unusable as-is. REJECT only when the work is wrong, unsafe, fabricated, claims to have performed an action it cannot, or does not address the task.`,
    `You do NOT know who wrote this and it does not matter — judge only the work itself.`,
    `Respond with ONLY a JSON object, no prose before or after, in exactly this shape:`,
    `{"verdict":"approve|revise|reject","severity":"none|minor|major|critical","specificProblems":["..."],"mustFix":["concrete fix 1"],"confidence":0.0,"reasoning":"one or two sentences"}`,
    `Rules: "approve" => empty mustFix, severity "none" or "minor". "revise" => at least one concrete mustFix. "reject" => severity "major" or "critical" and a clear reason. confidence is how sure you are of the verdict (0 to 1).`,
  ].join('\n');

  const user = [
    `TASK THE WORK WAS SUPPOSED TO ACCOMPLISH:`,
    input.task.trim() || '(no task text provided)',
    ``,
    `WORK TO REVIEW:`,
    input.draft.trim(),
    ``,
    `Return your JSON verdict now.`,
  ].join('\n');

  return { system, user };
}

/** Pull the first JSON object out of a possibly-chatty completion. */
function extractJson(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function coerceVerdict(v: unknown): JudgeVerdict | null {
  if (typeof v !== 'string') return null;
  const lower = v.toLowerCase().trim();
  return VALID_VERDICTS.includes(lower as JudgeVerdict) ? (lower as JudgeVerdict) : null;
}

function coerceSeverity(v: unknown, verdict: JudgeVerdict): JudgeSeverity {
  if (typeof v === 'string' && VALID_SEVERITIES.includes(v.toLowerCase().trim() as JudgeSeverity)) {
    return v.toLowerCase().trim() as JudgeSeverity;
  }
  // Sensible default keyed to the verdict when the model omits severity.
  if (verdict === 'reject') return 'major';
  if (verdict === 'revise') return 'minor';
  return 'none';
}

/**
 * Run one reviewer's LLM judgment over a draft. Returns a normalized verdict, or null on any
 * failure (never throws — the caller must be able to proceed without a verdict).
 */
export async function runLlmJudge(input: RunLlmJudgeInput): Promise<PeerJudgeResult | null> {
  const { system, user } = buildJudgePrompt(input);

  let raw = '';
  let judgeModel = 'groq';
  try {
    if (input.generate) {
      raw = await input.generate(user, system);
      judgeModel = 'injected';
    } else {
      const completion = await generateWithPreferredProvider(
        {
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          temperature: 0.1,
          maxTokens: 500,
          timeoutMs: Number(process.env.HARD_RESPONSE_TIMEOUT_MS || 45000),
          seed: process.env.LLM_MODE === 'test' ? 42 : undefined,
        },
        process.env.GROQ_API_KEY ? 'groq' : 'gemini',
      );
      raw = completion.content || '';
      judgeModel = process.env.GROQ_API_KEY ? 'groq' : 'gemini';
    }
  } catch {
    return null; // infra failure — do not block
  }

  const parsed = extractJson(raw);
  if (!parsed) return null;

  const verdict = coerceVerdict(parsed.verdict);
  if (!verdict) return null; // unusable output — do not block

  const severity = coerceSeverity(parsed.severity, verdict);
  const mustFix = asStringArray(parsed.mustFix);
  const specificProblems = asStringArray(parsed.specificProblems);
  const confidence = clamp01(typeof parsed.confidence === 'number' ? parsed.confidence : Number(parsed.confidence));
  const reasoning =
    typeof parsed.reasoning === 'string' && parsed.reasoning.trim()
      ? parsed.reasoning.trim().slice(0, 600)
      : `Verdict: ${verdict}`;

  // Guard the contract the caller relies on: a "revise" with no concrete fix is unactionable,
  // so downgrade it to approve rather than send the author on a blind revision loop.
  if (verdict === 'revise' && mustFix.length === 0) {
    return {
      reviewerHatchId: input.reviewerHatchId,
      reviewerName: input.reviewerName,
      reviewerRole: input.reviewerRole,
      verdict: 'approve',
      severity: 'minor',
      specificProblems,
      mustFix: [],
      confidence,
      reasoning: reasoning + ' (no concrete fix supplied; treated as approve)',
      judgeModel,
    };
  }

  return {
    reviewerHatchId: input.reviewerHatchId,
    reviewerName: input.reviewerName,
    reviewerRole: input.reviewerRole,
    verdict,
    severity,
    specificProblems,
    mustFix,
    confidence,
    reasoning,
    judgeModel,
  };
}

export interface AggregateJudgeInput {
  verdicts: PeerJudgeResult[];
  rejectConfidence: number;
  reviseConfidence: number;
}

export interface AggregateJudgeResult {
  decision: JudgeVerdict;
  driver: PeerJudgeResult | null; // the verdict that drove the decision
  mustFix: string[];
  reasoning: string;
}

/**
 * Combine multiple reviewers' verdicts into one decision. Worst actionable verdict wins
 * (reject > revise > approve), but only when the reviewer was confident enough — a low-confidence
 * reject does not block, which is the conservative false-block guard from the plan.
 */
export function aggregateVerdicts(input: AggregateJudgeInput): AggregateJudgeResult {
  const confidentRejects = input.verdicts.filter((v) => v.verdict === 'reject' && v.confidence >= input.rejectConfidence);
  if (confidentRejects.length > 0) {
    const driver = confidentRejects.sort((a, b) => b.confidence - a.confidence)[0];
    return {
      decision: 'reject',
      driver,
      mustFix: driver.mustFix,
      reasoning: `${driver.reviewerName} (${driver.reviewerRole}) rejected: ${driver.reasoning}`,
    };
  }

  const confidentRevises = input.verdicts.filter((v) => v.verdict === 'revise' && v.confidence >= input.reviseConfidence);
  if (confidentRevises.length > 0) {
    const driver = confidentRevises.sort((a, b) => b.confidence - a.confidence)[0];
    const mustFix = [...new Set(confidentRevises.flatMap((v) => v.mustFix))].slice(0, 6);
    return {
      decision: 'revise',
      driver,
      mustFix,
      reasoning: `${driver.reviewerName} (${driver.reviewerRole}) asked for changes: ${driver.reasoning}`,
    };
  }

  return { decision: 'approve', driver: input.verdicts[0] ?? null, mustFix: [], reasoning: 'Peer review passed.' };
}
