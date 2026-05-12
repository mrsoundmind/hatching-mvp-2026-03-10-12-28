/**
 * Phase 36 — LLM-as-judge rubric scorer (RUBR-02, RUBR-03).
 *
 * Scores OLD and NEW versions of a deliverable against the same frozen rubric
 * in a single Groq llama-3.3-70b call (temperature=0) and recommends keep_new or
 * revert. Server-side post-parse defenses:
 *
 *   1. recommendation is RECOMPUTED from `newScore.total < oldScore.total` after
 *      Zod parse — the LLM's emitted `recommendation` field is DISCARDED. This
 *      defends against prompt-injection attempts that try to flip the verdict
 *      (T-36-11). Pinned deterministically by case_recommendationRecompute in
 *      scripts/test-rubric-scorer.ts.
 *   2. rubricVersion is OVERWRITTEN with the actual registry value — defends
 *      against LLM hallucinating a future semver (T-36-12), preserving D-04
 *      rubric-version immutability semantics in persistence.
 *
 * Fail-open policy: every error path (LLM throw, JSON.parse throw, Zod parse
 * fail, unknown type) returns recommendation='keep_new' with an empty
 * breakdown. A flaky judge MUST NOT block user iteration — alternative is a
 * silent revert during Groq outage, which would be much worse UX.
 *
 * DEV-only test injection: __setForcedScoreForTests / __clearForcedScoreForTests
 * allow Playwright + unit tests to deterministically force a revert without
 * relying on real LLM behavior. Both helpers throw FATAL when NODE_ENV ===
 * 'production' (defence in depth — the routes/health.ts handler also short-
 * circuits to 404 in prod; mirrors the Phase 35 T-35-02 pattern).
 */

import { z } from 'zod';
import { generateWithPreferredProvider } from '../llm/providerResolver.js';
import { getRubricForType, type Rubric } from '../../shared/deliverableRubrics.js';

// -----------------------------------------------------------------------------
// Zod schemas — all `.strict()` so extra keys from a buggy LLM fail validation
// immediately rather than silently strip (T-35-01 / T-36-21 discipline carried
// forward from Phase 35).
// -----------------------------------------------------------------------------

export const rubricCriterionScoreSchema = z
  .object({
    criterion: z.string(),
    score: z.number().min(0).max(10),
    justification: z.string().min(1).max(300),
  })
  .strict();

export const versionScoreSchema = z
  .object({
    total: z.number().min(0).max(10),
    breakdown: z.array(rubricCriterionScoreSchema),
  })
  .strict();

export const rubricScoreResultSchema = z
  .object({
    rubricVersion: z.string(),
    oldScore: versionScoreSchema,
    newScore: versionScoreSchema,
    recommendation: z.enum(['keep_new', 'revert']),
  })
  .strict();

export type RubricScoreResult = z.infer<typeof rubricScoreResultSchema>;

// -----------------------------------------------------------------------------
// Module-level DEV-only forced-result injection point. Production guards on the
// setters below mean this can never be mutated from a prod code path.
// -----------------------------------------------------------------------------

let forcedJudgeResult: RubricScoreResult | null = null;

// -----------------------------------------------------------------------------
// Internal helpers
// -----------------------------------------------------------------------------

function nullResult(rubricVersion: string): RubricScoreResult {
  // fail-open: when scoring is skipped (unknown type) or fails (LLM throw, JSON
  // parse fail, Zod parse fail), we return recommendation='keep_new' so the
  // iteration flow never gets blocked by a flaky judge.
  return {
    rubricVersion,
    oldScore: { total: 0, breakdown: [] },
    newScore: { total: 0, breakdown: [] },
    recommendation: 'keep_new',
  };
}

function buildJudgePrompt(rubric: Rubric, oldContent: string, newContent: string): string {
  const criteriaBlock = rubric.criteria
    .map(
      (c, i) =>
        `${i + 1}. ${c.label} (weight: ${c.weight})\n    Anchor 10: ${c.anchorAt10}\n    Anchor 0:  ${c.anchorAt0}`,
    )
    .join('\n\n');

  return `You are scoring two versions of a ${rubric.type} document against the same rubric.

RUBRIC CRITERIA (version ${rubric.rubricVersion}):

${criteriaBlock}

For EACH criterion, score BOTH versions 0-10 (using the anchors above as guidance) and give a one-sentence justification. Then compute each version's weighted total = sum(score * weight) for all criteria. Finally, recommend "keep_new" if the new version's total is greater than or equal to the old version's total, "revert" otherwise.

OLD VERSION:
"""
${oldContent}
"""

NEW VERSION:
"""
${newContent}
"""

Output ONLY valid JSON in this exact shape (no prose, no markdown, no commentary):

{
  "rubricVersion": "${rubric.rubricVersion}",
  "oldScore": {
    "total": <number 0-10>,
    "breakdown": [
      { "criterion": "<criterion key>", "score": <0-10>, "justification": "<one sentence>" }
    ]
  },
  "newScore": {
    "total": <number 0-10>,
    "breakdown": [
      { "criterion": "<criterion key>", "score": <0-10>, "justification": "<one sentence>" }
    ]
  },
  "recommendation": "keep_new" | "revert"
}`;
}

function stripCodeFences(content: string): string {
  return content.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
}

// -----------------------------------------------------------------------------
// Public API — scoreIteration
// -----------------------------------------------------------------------------

/**
 * Score an iteration of a deliverable. Returns a RubricScoreResult where the
 * `recommendation` field is ALWAYS server-recomputed from the score totals
 * (LLM's emitted recommendation is discarded — see module header).
 *
 * Failure semantics: fail-open. Any error returns a null-result with
 * recommendation='keep_new' so user iteration is never blocked by a judge flake.
 */
export async function scoreIteration(
  type: string,
  oldContent: string,
  newContent: string,
): Promise<RubricScoreResult> {
  // 1. DEV-only forced-result short-circuit. Mirrors Phase 35's outageModeActive
  //    pattern. The forced object is returned verbatim EXCEPT we overwrite
  //    rubricVersion with the actual registry value (so Playwright cases can
  //    pass placeholder versions without breaking persistence).
  if (forcedJudgeResult !== null) {
    const rubric = getRubricForType(type);
    return {
      ...forcedJudgeResult,
      rubricVersion: rubric?.rubricVersion ?? forcedJudgeResult.rubricVersion,
    };
  }

  // 2. Registry lookup — unknown type → fail-open path with sentinel version.
  const rubric = getRubricForType(type);
  if (!rubric) {
    return nullResult('0.0.0');
  }

  // 3. Build judge prompt.
  const prompt = buildJudgePrompt(rubric, oldContent, newContent);

  // 4. Call Groq (free tier) with temperature=0 for determinism. No retry loop
  //    — fail-open on any throw.
  let raw: string;
  try {
    const result = await generateWithPreferredProvider(
      {
        messages: [
          {
            role: 'system',
            content: 'Output only valid JSON. No prose, no markdown, no commentary.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0,
        maxTokens: 1500,
      },
      'groq',
    );
    raw = result.content ?? '';
  } catch {
    // fail-open: LLM call threw (timeout, network, auth) → keep_new.
    return nullResult(rubric.rubricVersion);
  }

  // 5. Strip optional code fences and parse JSON.
  const cleaned = stripCodeFences(raw);
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(cleaned);
  } catch {
    // fail-open: judge returned non-JSON → keep_new.
    return nullResult(rubric.rubricVersion);
  }

  // 6. Zod safeParse against strict schema. On failure → fail-open.
  const parsed = rubricScoreResultSchema.safeParse(parsedJson);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.warn(
      `[rubricScorer] judge output failed strict Zod parse (type=${type}); falling back to keep_new`,
    );
    return nullResult(rubric.rubricVersion);
  }

  // 7. SERVER-SIDE OVERRIDES (CRITICAL — T-36-11 / T-36-12).
  //    a. Overwrite rubricVersion with the actual registry value so persistence
  //       records the true version (LLM may hallucinate '2.0.0').
  //    b. Recompute recommendation from totals. The LLM's emitted
  //       `recommendation` field is DISCARDED. This is non-negotiable: prompt
  //       injection in deliverable content could otherwise flip the verdict.
  //       Strict less-than (D-09): ties keep_new — user gets the refinement
  //       they asked for when quality is equivalent.
  const correctedRecommendation: 'keep_new' | 'revert' =
    parsed.data.newScore.total < parsed.data.oldScore.total ? 'revert' : 'keep_new';

  return {
    rubricVersion: rubric.rubricVersion,
    oldScore: parsed.data.oldScore,
    newScore: parsed.data.newScore,
    recommendation: correctedRecommendation,
  };
}

// -----------------------------------------------------------------------------
// DEV-only test injection — must NOT be reachable from any prod code path.
// -----------------------------------------------------------------------------

/**
 * DEV-only: force scoreIteration to return a predetermined result without
 * calling the LLM. Used by Wave-2 unit tests + 36-04 Playwright case 3
 * (adversarial iterate). Throws FATAL in production (T-36-13 defence in depth
 * — the routes/health.ts handler also returns 404 in prod).
 *
 * Pass `null` to clear the forced result (equivalent to __clearForcedScoreForTests).
 */
export function __setForcedScoreForTests(result: RubricScoreResult | null): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'FATAL: __setForcedScoreForTests called in production. This is a DEV-only ' +
        'injection mechanism and must not be reachable from a production code path.',
    );
  }
  forcedJudgeResult = result;
}

/**
 * DEV-only: clear any previously set forced score. Throws FATAL in production
 * (routes through __setForcedScoreForTests(null), inheriting its prod guard).
 */
export function __clearForcedScoreForTests(): void {
  __setForcedScoreForTests(null);
}
