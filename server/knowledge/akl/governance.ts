import { getSourceTrust } from '../../tools/web/sourceTrust.js';
import type { UpdateCard } from './updateCard.js';

export interface GovernanceResult {
  pass: boolean;
  reason: string;
  normalizedCard: UpdateCard;
}

const MAX_UPDATES_PER_ROLE = Number(process.env.MAX_UPDATES_PER_ROLE ?? 120);

export function validateUpdateCardGovernance(card: UpdateCard): GovernanceResult {
  const normalized: UpdateCard = {
    ...card,
    confidence: Math.max(0, Math.min(1, card.confidence)),
    tags: Array.from(new Set((card.tags || []).map((tag) => tag.trim()).filter(Boolean))).slice(0, 12),
  };

  if (!normalized.evidence || normalized.evidence.length === 0) {
    return {
      pass: false,
      reason: 'missing_citations',
      normalizedCard: normalized,
    };
  }

  for (const source of normalized.evidence) {
    if (!source.url || !source.sourceDate || !source.summary) {
      return {
        pass: false,
        reason: 'incomplete_evidence_fields',
        normalizedCard: normalized,
      };
    }

    const trust = getSourceTrust(source.url);
    if (trust.tier === 'C' && source.confidence > 0.55) {
      return {
        pass: false,
        reason: `low_trust_source_requires_lower_confidence:${trust.domain}`,
        normalizedCard: normalized,
      };
    }
  }

  return {
    pass: true,
    reason: 'governance_pass',
    normalizedCard: normalized,
  };
}

export function pruneExpiredUpdates(cards: UpdateCard[]): UpdateCard[] {
  const now = Date.now();
  return cards.filter((card) => {
    if (!card.expiryDate) return true;
    const expiry = new Date(card.expiryDate).getTime();
    if (!Number.isFinite(expiry)) return true;
    return expiry > now;
  });
}

export function enforceRoleUpdateCap(cards: UpdateCard[]): UpdateCard[] {
  if (cards.length <= MAX_UPDATES_PER_ROLE) {
    return cards;
  }

  return [...cards]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(cards.length - MAX_UPDATES_PER_ROLE);
}
