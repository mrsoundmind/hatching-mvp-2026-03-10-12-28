import { appendPeerReview, appendDeliberationRound } from '../traces/traceStore.js';
import { logAutonomyEvent } from '../events/eventLogger.js';
import { BUDGETS, DELIBERATION_GATES } from '../config/policies.js';
import { evaluatePeerReviewRubric, type PeerReviewRubric } from './peerReviewRubric.js';

export interface ReviewerAgent {
  id: string;
  name: string;
  role: string;
}

export interface PeerReviewDecision {
  triggered: boolean;
  reason: string[];
  reviews: PeerReviewRubric[];
  revisedContent: string;
  clarificationRequired: boolean;
  blockedByHallucination: boolean;
  overrideUsed: boolean;
}

export function shouldTriggerPeerReview(input: {
  confidence: number;
  riskScore: number;
  userMessage: string;
  draftResponse: string;
  isProposalTurn?: boolean;
  safetySensitive?: boolean;
  contradictsCanon?: boolean;
}): { triggered: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const user = (input.userMessage || '').toLowerCase();
  const draft = (input.draftResponse || '').toLowerCase();

  if (input.riskScore >= DELIBERATION_GATES.peerReviewTrigger) reasons.push('risk_threshold');
  if (input.confidence < 0.55) reasons.push('low_confidence');
  if (/are you sure/.test(user)) reasons.push('explicit_recheck');
  if (/forecast|predict|research|according to|evidence|data|study|citation/.test(user + ' ' + draft)) {
    reasons.push('factual_claims');
  }
  if (input.isProposalTurn) reasons.push('proposal_turn');
  if (input.safetySensitive) reasons.push('safety_sensitive');
  if (input.contradictsCanon) reasons.push('canon_contradiction');

  return {
    triggered: reasons.length > 0,
    reasons,
  };
}

function synthesizeRevisions(input: {
  draftResponse: string;
  reviews: PeerReviewRubric[];
  highRisk: boolean;
}): { revised: string; clarificationRequired: boolean } {
  const allFixes = input.reviews.flatMap((review) => review.fixSuggestions).filter(Boolean);
  const uniqueFixes = [...new Set(allFixes)].slice(0, 5);
  const allQuestions = input.reviews.flatMap((review) => review.missingQuestions).filter(Boolean);

  if (input.highRisk) {
    const question = allQuestions[0] || 'Can you clarify constraints, evidence source, and acceptable risk before execution?';
    const revised = [
      'I need to pause and de-risk this before giving final execution advice.',
      `Clarification needed: ${question}`,
      'I can proceed once this is clarified, with a safer and verifiable plan.',
    ].join('\n');
    return {
      revised,
      clarificationRequired: true,
    };
  }

  if (uniqueFixes.length === 0) {
    return {
      revised: input.draftResponse,
      clarificationRequired: false,
    };
  }

  const revised = [
    input.draftResponse.trim(),
    '',
    'Quality checks applied:',
    ...uniqueFixes.map((fix, idx) => `${idx + 1}. ${fix}`),
  ].join('\n');

  return {
    revised,
    clarificationRequired: false,
  };
}

export async function runPeerReview(input: {
  traceId?: string | null;
  roundNoBase?: number;
  projectId: string;
  teamId?: string | null;
  conversationId: string;
  primaryHatchId: string;
  primaryHatchRole: string;
  reviewers: ReviewerAgent[];
  provider: string;
  mode: string;
  confidence: number;
  riskScore: number;
  userMessage: string;
  draftResponse: string;
  projectName?: string;
  canonHints?: string[];
  isProposalTurn?: boolean;
  safetySensitive?: boolean;
  contradictsCanon?: boolean;
  allowOverrideHighRisk?: boolean;
}): Promise<PeerReviewDecision> {
  const trigger = shouldTriggerPeerReview({
    confidence: input.confidence,
    riskScore: input.riskScore,
    userMessage: input.userMessage,
    draftResponse: input.draftResponse,
    isProposalTurn: input.isProposalTurn,
    safetySensitive: input.safetySensitive,
    contradictsCanon: input.contradictsCanon,
  });

  if (!trigger.triggered || input.reviewers.length === 0) {
    return {
      triggered: false,
      reason: trigger.reasons,
      reviews: [],
      revisedContent: input.draftResponse,
      clarificationRequired: false,
      blockedByHallucination: false,
      overrideUsed: false,
    };
  }

  const selectedReviewers = input.reviewers
    .filter((agent) => agent.id !== input.primaryHatchId)
    .slice(0, Math.max(1, Math.min(BUDGETS.maxReviewers, 2)));

  await logAutonomyEvent({
    eventType: 'peer_review_started',
    projectId: input.projectId,
    teamId: input.teamId ?? null,
    conversationId: input.conversationId,
    hatchId: input.primaryHatchId,
    provider: input.provider,
    mode: input.mode,
    latencyMs: null,
    confidence: input.confidence,
    riskScore: input.riskScore,
    payload: {
      reviewerIds: selectedReviewers.map((reviewer) => reviewer.id),
      reasons: trigger.reasons,
    },
  });

  const reviews: PeerReviewRubric[] = [];
  for (const reviewer of selectedReviewers) {
    const rubric = evaluatePeerReviewRubric({
      reviewerHatchId: reviewer.id,
      reviewerRole: reviewer.role,
      userMessage: input.userMessage,
      draftResponse: input.draftResponse,
      projectName: input.projectName,
      canonHints: input.canonHints,
    });
    reviews.push(rubric);

    await logAutonomyEvent({
      eventType: 'peer_review_feedback',
      projectId: input.projectId,
      teamId: input.teamId ?? null,
      conversationId: input.conversationId,
      hatchId: reviewer.id,
      provider: input.provider,
      mode: input.mode,
      latencyMs: null,
      confidence: input.confidence,
      riskScore: input.riskScore,
      payload: rubric as unknown as Record<string, unknown>,
    });

    if (input.traceId) {
      await appendPeerReview(input.traceId, {
        reviewerHatchId: reviewer.id,
        rubricOutput: rubric as unknown as Record<string, unknown>,
        revisionApplied: false,
        timestamp: new Date().toISOString(),
      });

      await appendDeliberationRound(input.traceId, {
        roundNo: (input.roundNoBase ?? 1) + reviews.length,
        hatchId: reviewer.id,
        prompt: input.userMessage,
        output: JSON.stringify(rubric),
        confidence: input.confidence,
        riskScore: input.riskScore,
        latencyMs: 0,
        timestamp: new Date().toISOString(),
      });
    }
  }

  const highRiskFlagged = reviews.some((review) => review.hallucinationRisk === 'high');
  const contradictionCount = reviews.reduce((sum, review) => sum + review.contradictions.length, 0);
  const overrideUsed = highRiskFlagged && Boolean(input.allowOverrideHighRisk);

  if (highRiskFlagged) {
    await logAutonomyEvent({
      eventType: 'hallucination_detected',
      projectId: input.projectId,
      teamId: input.teamId ?? null,
      conversationId: input.conversationId,
      hatchId: input.primaryHatchId,
      provider: input.provider,
      mode: input.mode,
      latencyMs: null,
      confidence: input.confidence,
      riskScore: input.riskScore,
      payload: {
        highRiskReviewers: reviews.filter((review) => review.hallucinationRisk === 'high').map((review) => review.reviewerHatchId),
      },
    });
  }

  if (overrideUsed) {
    await logAutonomyEvent({
      eventType: 'peer_review_overridden',
      projectId: input.projectId,
      teamId: input.teamId ?? null,
      conversationId: input.conversationId,
      hatchId: input.primaryHatchId,
      provider: input.provider,
      mode: input.mode,
      latencyMs: null,
      confidence: input.confidence,
      riskScore: input.riskScore,
      payload: {
        reason: 'explicit_override_of_high_hallucination_risk',
      },
    });
  }

  await logAutonomyEvent({
    eventType: 'revision_requested',
    projectId: input.projectId,
    teamId: input.teamId ?? null,
    conversationId: input.conversationId,
    hatchId: input.primaryHatchId,
    provider: input.provider,
    mode: input.mode,
    latencyMs: null,
    confidence: input.confidence,
    riskScore: input.riskScore,
    payload: {
      maxRevisionCycles: BUDGETS.maxRevisionCycles,
    },
  });

  const revised = synthesizeRevisions({
    draftResponse: input.draftResponse,
    reviews,
    highRisk: highRiskFlagged && !overrideUsed,
  });

  let revisedContent = revised.revised;
  let clarificationRequired = revised.clarificationRequired;
  if (overrideUsed) {
    revisedContent = [
      input.draftResponse.trim(),
      '',
      'Confidence reduced after peer review: high uncertainty remains.',
      'Before execution, validate assumptions and request confirmation on risky steps.',
    ].join('\n');
    clarificationRequired = false;
  }

  await logAutonomyEvent({
    eventType: 'revision_completed',
    projectId: input.projectId,
    teamId: input.teamId ?? null,
    conversationId: input.conversationId,
    hatchId: input.primaryHatchId,
    provider: input.provider,
    mode: input.mode,
    latencyMs: null,
    confidence: input.confidence,
    riskScore: input.riskScore,
    payload: {
      clarificationRequired,
      reviewCount: reviews.length,
    },
  });

  if (contradictionCount > 0) {
    await logAutonomyEvent({
      eventType: 'contradiction_resolved',
      projectId: input.projectId,
      teamId: input.teamId ?? null,
      conversationId: input.conversationId,
      hatchId: input.primaryHatchId,
      provider: input.provider,
      mode: input.mode,
      latencyMs: null,
      confidence: input.confidence,
      riskScore: input.riskScore,
      payload: {
        contradictionCount,
        reviewers: selectedReviewers.map((reviewer) => reviewer.id),
      },
    });
  }

  if (input.traceId) {
    for (const reviewer of selectedReviewers) {
      await appendPeerReview(input.traceId, {
        reviewerHatchId: reviewer.id,
        rubricOutput: {
          revisionApplied: true,
        },
        revisionApplied: true,
        timestamp: new Date().toISOString(),
      });
    }

    await appendDeliberationRound(input.traceId, {
      roundNo: (input.roundNoBase ?? 1) + selectedReviewers.length + 1,
      hatchId: input.primaryHatchId,
      prompt: input.userMessage,
      output: revisedContent,
      confidence: Math.max(0.3, input.confidence - (highRiskFlagged && !overrideUsed ? 0.25 : 0.05)),
      riskScore: input.riskScore,
      latencyMs: 0,
      timestamp: new Date().toISOString(),
    });
  }

  return {
    triggered: true,
    reason: trigger.reasons,
    reviews,
    revisedContent,
    clarificationRequired,
    blockedByHallucination: highRiskFlagged && !overrideUsed,
    overrideUsed,
  };
}
