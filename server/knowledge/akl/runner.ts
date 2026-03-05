import { detectKnowledgeGap } from './gapDetector.js';
import { createUpdateCard, appendUpdateCard, readRoleUpdateCards, rewriteRoleUpdateCards, type UpdateCard } from './updateCard.js';
import { validateUpdateCardGovernance, pruneExpiredUpdates, enforceRoleUpdateCap } from './governance.js';
import { attemptCanonPromotion, rollbackCanon } from './promotion.js';
import { runRoleScopedResearch } from '../../tools/web/webClient.js';
import { logAutonomyEvent } from '../../autonomy/events/eventLogger.js';

export interface AKLRunResult {
  gapDetected: boolean;
  updateCard?: UpdateCard;
  promoted: boolean;
  reason: string;
}

export async function runAutonomousKnowledgeLoop(input: {
  projectId: string;
  conversationId: string;
  role: string;
  userMessage: string;
  draftResponse: string;
  confidence: number;
  provider: string;
  mode: string;
  highStakes?: boolean;
}): Promise<AKLRunResult> {
  const gap = detectKnowledgeGap({
    userMessage: input.userMessage,
    confidence: input.confidence,
  });

  if (!gap.detected) {
    return {
      gapDetected: false,
      promoted: false,
      reason: gap.reason,
    };
  }

  await logAutonomyEvent({
    eventType: 'knowledge_gap_detected' as any,
    projectId: input.projectId,
    teamId: null,
    conversationId: input.conversationId,
    hatchId: null,
    provider: input.provider,
    mode: input.mode,
    latencyMs: null,
    confidence: input.confidence,
    riskScore: null,
    payload: {
      reason: gap.reason,
      topic: gap.topic,
    },
  });

  await logAutonomyEvent({
    eventType: 'research_started' as any,
    projectId: input.projectId,
    teamId: null,
    conversationId: input.conversationId,
    hatchId: null,
    provider: input.provider,
    mode: input.mode,
    latencyMs: null,
    confidence: input.confidence,
    riskScore: null,
    payload: {
      topic: gap.topic,
      role: input.role,
    },
  });

  const research = await runRoleScopedResearch({
    role: input.role,
    topic: gap.topic,
    claim: input.draftResponse,
    highStakes: input.highStakes,
  });

  await logAutonomyEvent({
    eventType: 'sources_collected' as any,
    projectId: input.projectId,
    teamId: null,
    conversationId: input.conversationId,
    hatchId: null,
    provider: input.provider,
    mode: input.mode,
    latencyMs: null,
    confidence: input.confidence,
    riskScore: null,
    payload: {
      sourceCount: research.evidence.length,
      blocked: research.blocked,
      reason: research.reason,
    },
  });

  if (research.blocked) {
    return {
      gapDetected: true,
      promoted: false,
      reason: research.reason || 'research_blocked',
    };
  }

  const card = await createUpdateCard({
    role: input.role,
    topic: gap.topic,
    claim: input.draftResponse,
    evidence: research.evidence,
    confidence: Math.max(0.45, input.confidence),
    tags: ['akl', 'autonomous-update', gap.recencySensitive ? 'recency-sensitive' : 'general'],
    expiryDate: gap.recencySensitive
      ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
      : undefined,
  });

  await logAutonomyEvent({
    eventType: 'updatecard_created' as any,
    projectId: input.projectId,
    teamId: null,
    conversationId: input.conversationId,
    hatchId: null,
    provider: input.provider,
    mode: input.mode,
    latencyMs: null,
    confidence: card.confidence,
    riskScore: null,
    payload: {
      updateCardId: card.id,
      role: card.role,
      topic: card.topic,
    },
  });

  const governance = validateUpdateCardGovernance(card);
  if (!governance.pass) {
    await logAutonomyEvent({
      eventType: 'updatecard_review_failed' as any,
      projectId: input.projectId,
      teamId: null,
      conversationId: input.conversationId,
      hatchId: null,
      provider: input.provider,
      mode: input.mode,
      latencyMs: null,
      confidence: card.confidence,
      riskScore: null,
      payload: {
        updateCardId: card.id,
        reason: governance.reason,
      },
    });

    return {
      gapDetected: true,
      promoted: false,
      reason: governance.reason,
      updateCard: {
        ...card,
        rejectedReason: governance.reason,
      },
    };
  }

  await appendUpdateCard(governance.normalizedCard);

  const allCards = await readRoleUpdateCards(card.role);
  const pruned = enforceRoleUpdateCap(pruneExpiredUpdates(allCards));
  await rewriteRoleUpdateCards(card.role, pruned);

  await logAutonomyEvent({
    eventType: 'updatecard_review_passed' as any,
    projectId: input.projectId,
    teamId: null,
    conversationId: input.conversationId,
    hatchId: null,
    provider: input.provider,
    mode: input.mode,
    latencyMs: null,
    confidence: card.confidence,
    riskScore: null,
    payload: {
      updateCardId: card.id,
    },
  });

  await logAutonomyEvent({
    eventType: 'canon_promotion_attempted' as any,
    projectId: input.projectId,
    teamId: null,
    conversationId: input.conversationId,
    hatchId: null,
    provider: input.provider,
    mode: input.mode,
    latencyMs: null,
    confidence: card.confidence,
    riskScore: null,
    payload: {
      role: card.role,
      updateCardId: card.id,
    },
  });

  const promotion = await attemptCanonPromotion(governance.normalizedCard);

  if (!promotion.promoted && promotion.reason.includes('regression')) {
    const rollback = await rollbackCanon(governance.normalizedCard.role);
    await logAutonomyEvent({
      eventType: 'canon_rollback' as any,
      projectId: input.projectId,
      teamId: null,
      conversationId: input.conversationId,
      hatchId: null,
      provider: input.provider,
      mode: input.mode,
      latencyMs: null,
      confidence: card.confidence,
      riskScore: null,
      payload: rollback as unknown as Record<string, unknown>,
    });
  }

  if (promotion.promoted) {
    await logAutonomyEvent({
      eventType: 'canon_promoted' as any,
      projectId: input.projectId,
      teamId: null,
      conversationId: input.conversationId,
      hatchId: null,
      provider: input.provider,
      mode: input.mode,
      latencyMs: null,
      confidence: card.confidence,
      riskScore: null,
      payload: {
        updateCardId: card.id,
        reason: promotion.reason,
      },
    });
  }

  return {
    gapDetected: true,
    updateCard: governance.normalizedCard,
    promoted: promotion.promoted,
    reason: promotion.reason,
  };
}
