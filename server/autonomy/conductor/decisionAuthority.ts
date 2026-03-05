import { BUDGETS } from '../config/policies.js';

export type AuthorityLevel = 'worker' | 'reviewer' | 'conductor' | 'guardrail';

export interface ConflictCandidate {
  hatchId: string;
  authority: AuthorityLevel;
  confidence: number;
  content: string;
  riskScore: number;
}

export interface ConflictResolutionResult {
  winnerHatchId: string | null;
  finalContent: string;
  reason: string;
  roundsUsed: number;
  timeoutTriggered: boolean;
  overriddenByGuardrail: boolean;
}

const authorityScore: Record<AuthorityLevel, number> = {
  worker: 1,
  reviewer: 2,
  conductor: 3,
  guardrail: 4,
};

export function resolveDecisionConflict(input: {
  candidates: ConflictCandidate[];
  guardrailOverride?: string;
  roundCount: number;
}): ConflictResolutionResult {
  if (input.guardrailOverride) {
    return {
      winnerHatchId: null,
      finalContent: input.guardrailOverride,
      reason: 'policy_override',
      roundsUsed: input.roundCount,
      timeoutTriggered: false,
      overriddenByGuardrail: true,
    };
  }

  if (input.roundCount >= BUDGETS.maxDeliberationRounds) {
    const best = [...input.candidates].sort((a, b) => b.confidence - a.confidence)[0];
    return {
      winnerHatchId: best?.hatchId ?? null,
      finalContent: best?.content ?? 'Unable to finalize a safe consensus in time.',
      reason: 'deliberation_timeout_forced_resolution',
      roundsUsed: input.roundCount,
      timeoutTriggered: true,
      overriddenByGuardrail: false,
    };
  }

  const ranked = [...input.candidates].sort((a, b) => {
    const authorityDelta = authorityScore[b.authority] - authorityScore[a.authority];
    if (authorityDelta !== 0) return authorityDelta;
    const confidenceDelta = b.confidence - a.confidence;
    if (confidenceDelta !== 0) return confidenceDelta;
    return a.riskScore - b.riskScore;
  });

  const winner = ranked[0];
  return {
    winnerHatchId: winner?.hatchId ?? null,
    finalContent: winner?.content ?? 'No valid deliberation candidate available.',
    reason: winner ? `winner:${winner.authority}` : 'empty_candidates',
    roundsUsed: input.roundCount,
    timeoutTriggered: false,
    overriddenByGuardrail: false,
  };
}
