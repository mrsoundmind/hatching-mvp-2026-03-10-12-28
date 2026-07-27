import { appendPeerReview, appendDeliberationRound } from '../traces/traceStore.js';
import { logAutonomyEvent } from '../events/eventLogger.js';
import { BUDGETS, DELIBERATION_GATES } from '../config/policies.js';
import { evaluatePeerReviewRubric, type PeerReviewRubric } from './peerReviewRubric.js';
// v2.2 Phase D — real LLM-as-judge peer review layer (opt-in via enableLlmJudge)
import { runLlmJudge, aggregateVerdicts, type PeerJudgeResult, type AggregateJudgeResult } from './llmJudge.js';
import { getRoleIntelligence } from '@shared/roleIntelligence';

/** Kill switch for the LLM-as-judge layer. Default on; set FEATURE_PEER_REVIEW_JUDGE=false to fall back to deterministic-only. */
const FEATURE_PEER_REVIEW_JUDGE = (process.env.FEATURE_PEER_REVIEW_JUDGE ?? 'true').toLowerCase() === 'true';
const REJECT_CONFIDENCE = Number(process.env.PEER_REVIEW_REJECT_CONFIDENCE ?? 0.7);
const REVISE_CONFIDENCE = Number(process.env.PEER_REVIEW_REVISE_CONFIDENCE ?? 0.6);

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
  // v2.2 Phase D — populated only when the LLM-as-judge layer ran (autonomous path)
  judge?: {
    decision: 'approve' | 'revise' | 'reject';
    reasoning: string;
    mustFix: string[];
    revisionsApplied: number;
    results: PeerJudgeResult[];
  };
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
  // v2.2 lineage: pointers stamped into the review event payloads so a verdict can be joined back to
  // the task it reviewed (taskId) and the autonomy run it belongs to (runTraceId = autonomy_runs.trace_id).
  // These live in the payload only — the per-event grouping trace_id stays unique, so each review keeps
  // its own feed row (T3 behaviour preserved). Distinct from `traceId` above, which drives the trace store.
  taskId?: string | null;
  runTraceId?: string | null;
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
  // v2.2 Phase D — opt-in LLM-as-judge (autonomous path passes these; chat path leaves them unset)
  enableLlmJudge?: boolean;
  /** The writer/author model, used to regenerate on a "revise" verdict. Usually the pipeline's generateText. */
  authorGenerate?: (prompt: string, system: string) => Promise<string>;
  /** Optional judge generate override (tests inject this); when absent the judge calls Groq itself. */
  judgeGenerate?: (prompt: string, system: string) => Promise<string>;
  /** Task text the work was meant to accomplish — gives the judge the yardstick. Falls back to userMessage. */
  task?: string;
  /** Max real regeneration cycles on a "revise" verdict. Defaults to BUDGETS.maxRevisionCycles. */
  maxRevisionCycles?: number;
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

  const selectedReviewers = input.reviewers
    .filter((agent) => agent.id !== input.primaryHatchId)
    .slice(0, Math.max(1, BUDGETS.maxReviewers));

  // v2.2 coverage fix: when the autonomous pipeline opts into the judge it has ALREADY decided this task
  // warrants review (broadened coverage in shouldReviewAutonomousOutput). The legacy risk-only trigger
  // must not veto that — otherwise a low-risk-but-substantive task would be gated here after the pipeline
  // chose to review it. Force the review through with an explicit reason so the feed/logs still explain why.
  const forcedByJudge = Boolean(input.enableLlmJudge) && FEATURE_PEER_REVIEW_JUDGE;
  const effectiveReasons = trigger.triggered ? trigger.reasons : forcedByJudge ? ['coverage_review'] : trigger.reasons;

  if ((!trigger.triggered && !forcedByJudge) || selectedReviewers.length === 0) {
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
      reasons: effectiveReasons,
      taskId: input.taskId ?? null,
      runTraceId: input.runTraceId ?? null,
    },
  });

  // v2.2 Phase D — the LLM-as-judge layer runs only when the caller opts in (autonomous pipeline).
  // When it runs, the per-reviewer feed event carries the real verdict (logged after judging), so the
  // deterministic rubric event is suppressed here to avoid double-logging. The chat path leaves
  // enableLlmJudge unset and keeps the exact prior behaviour.
  const judgeEnabled = Boolean(input.enableLlmJudge) && FEATURE_PEER_REVIEW_JUDGE;

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

    if (!judgeEnabled) {
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
    }

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

  // ── v2.2 Phase D: real LLM-as-judge with teeth + a real regeneration loop ──────────────────
  // Each reviewer genuinely reads the work through its own peerReviewLens (cross-model Groq judge,
  // blind to authorship). Verdicts aggregate to a single decision; a confident "reject" blocks to
  // the user, a "revise" regenerates the work with the reviewer's mustFix list (bounded), "approve"
  // ships it. Any judge failure yields no verdict and the flow falls back to the deterministic path.
  let judgeDecision: AggregateJudgeResult | null = null;
  let judgeRevisedContent: string | null = null;
  let judgeRevisionsApplied = 0;
  const judgeResults: PeerJudgeResult[] = [];

  if (judgeEnabled && selectedReviewers.length > 0) {
    const maxCycles = Math.max(0, input.maxRevisionCycles ?? BUDGETS.maxRevisionCycles);
    const taskText = input.task ?? input.userMessage;
    let currentDraft = input.draftResponse;

    for (let cycle = 0; cycle <= maxCycles; cycle++) {
      const cycleVerdicts: PeerJudgeResult[] = [];
      for (const reviewer of selectedReviewers) {
        const lens = getRoleIntelligence(reviewer.role)?.peerReviewLens;
        const verdict = await runLlmJudge({
          reviewerHatchId: reviewer.id,
          reviewerName: reviewer.name,
          reviewerRole: reviewer.role,
          peerReviewLens: lens,
          task: taskText,
          draft: currentDraft,
          generate: input.judgeGenerate,
        });
        if (!verdict) continue;
        cycleVerdicts.push(verdict);
        judgeResults.push(verdict);

        // Rich per-reviewer feed event: this is what the Activity feed renders for autonomous reviews.
        await logAutonomyEvent({
          eventType: 'peer_review_feedback',
          projectId: input.projectId,
          teamId: input.teamId ?? null,
          conversationId: input.conversationId,
          hatchId: reviewer.id,
          provider: input.provider,
          mode: input.mode,
          latencyMs: null,
          confidence: verdict.confidence,
          riskScore: input.riskScore,
          payload: {
            verdict: verdict.verdict,
            severity: verdict.severity,
            confidence: verdict.confidence, // T2: also in the payload blob (already on the event's confidence column)
            reasoning: verdict.reasoning,
            mustFix: verdict.mustFix,
            specificProblems: verdict.specificProblems,
            reviewerName: verdict.reviewerName,
            reviewerRole: verdict.reviewerRole,
            judgeModel: verdict.judgeModel,
            revisionCycle: cycle,
            // v2.2 lineage: tie this verdict to the task it reviewed and the run it belongs to.
            taskId: input.taskId ?? null,
            runTraceId: input.runTraceId ?? null,
          },
        });
      }

      if (cycleVerdicts.length === 0) break; // no usable judgment this cycle → fail-safe to deterministic path

      judgeDecision = aggregateVerdicts({
        verdicts: cycleVerdicts,
        rejectConfidence: REJECT_CONFIDENCE,
        reviseConfidence: REVISE_CONFIDENCE,
      });

      if (judgeDecision.decision === 'approve') {
        judgeRevisedContent = currentDraft;
        break;
      }
      if (judgeDecision.decision === 'reject') {
        break; // teeth: fall through to the block path below
      }

      // decision === 'revise' — regenerate ONLY when the gap is material (major/critical severity).
      // T1 calibration finding: a "minor"-severity revise is usually the judge polishing already-good
      // work, and spending a full regeneration on it is wasted cost with no safety benefit. A minor
      // revise therefore ships as-is (still logged as a review, so it stays visible); only a major or
      // critical gap earns a rewrite. Reject (real block) is unaffected — this only tunes revise cost.
      const driverSeverity = judgeDecision.driver?.severity;
      const materialGap = driverSeverity === 'major' || driverSeverity === 'critical';
      if (cycle < maxCycles && input.authorGenerate && judgeDecision.mustFix.length > 0 && materialGap) {
        const revisePrompt = [
          'Your work was peer-reviewed and needs revision. Fix these specific issues, keeping everything that was already correct:',
          ...judgeDecision.mustFix.map((fix, idx) => `${idx + 1}. ${fix}`),
          '',
          `TASK: ${taskText}`,
          '',
          'CURRENT WORK:',
          currentDraft,
          '',
          'Return only the improved work, no preamble or meta-commentary.',
        ].join('\n');
        try {
          const regenerated = await input.authorGenerate(
            revisePrompt,
            `You are a ${input.primaryHatchRole}. Improve your own work based on the peer feedback.`,
          );
          if (regenerated?.trim()) {
            currentDraft = regenerated.trim();
            judgeRevisedContent = currentDraft;
            judgeRevisionsApplied += 1;
            continue; // re-judge the revised draft
          }
        } catch {
          // regeneration failed — ship the current best draft rather than block good-enough work
        }
        judgeRevisedContent = currentDraft;
        break;
      }

      // revise with no cycles left / no regenerator: keep the current draft (best effort), stop looping
      judgeRevisedContent = currentDraft;
      break;
    }
  }
  const judgeRejected = judgeEnabled && judgeDecision?.decision === 'reject';

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

  let revisedContent: string;
  let clarificationRequired: boolean;

  if (judgeEnabled && judgeDecision) {
    // The judge ran and produced a usable decision → it is authoritative for the shipped content.
    // A confident reject blocks (teeth). The deterministic hallucination gate is kept as an OR
    // safety net so a real hallucination still blocks even if the judge missed it.
    clarificationRequired = judgeRejected || (highRiskFlagged && !overrideUsed);
    revisedContent = judgeRejected
      ? input.draftResponse // don't ship rejected work; the user sees the draft to approve or deny
      : judgeRevisedContent ?? input.draftResponse; // approve → draft; revise → regenerated content
  } else {
    // No judge (chat path) or no usable verdict → deterministic synthesis, exactly as before.
    const revised = synthesizeRevisions({
      draftResponse: input.draftResponse,
      reviews,
      highRisk: highRiskFlagged && !overrideUsed,
    });
    revisedContent = revised.revised;
    clarificationRequired = revised.clarificationRequired;
  }

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

  const reason = judgeDecision
    ? [...effectiveReasons, `peer_review_${judgeDecision.decision}`, judgeDecision.reasoning]
    : effectiveReasons;

  return {
    triggered: true,
    reason,
    reviews,
    revisedContent,
    clarificationRequired,
    blockedByHallucination: highRiskFlagged && !overrideUsed,
    overrideUsed,
    judge: judgeDecision
      ? {
          decision: judgeDecision.decision,
          reasoning: judgeDecision.reasoning,
          mustFix: judgeDecision.mustFix,
          revisionsApplied: judgeRevisionsApplied,
          results: judgeResults,
        }
      : undefined,
  };
}
