import { FEATURE_FLAGS, BUDGETS } from '../config/policies.js';

export type EscalationLevel =
  | 'single_hatch'
  | 'web_research'
  | 'peer_review'
  | 'deliberation'
  | 'task_graph';

export interface EscalationDecision {
  level: EscalationLevel;
  reason: string;
  budgetExceeded: boolean;
}

export function resolveEscalationLevel(input: {
  complexity: 'low' | 'medium' | 'high';
  uncertainty: number;
  riskScore: number;
  askedVerification: boolean;
  multiDomain: boolean;
  roundsUsed: number;
}): EscalationDecision {
  if (input.roundsUsed >= BUDGETS.maxDeliberationRounds) {
    return {
      level: 'single_hatch',
      reason: 'forced_resolution_budget_exceeded',
      budgetExceeded: true,
    };
  }

  if (input.complexity === 'high' && input.multiDomain && FEATURE_FLAGS.taskGraph) {
    return {
      level: 'task_graph',
      reason: 'high_complexity_multi_domain',
      budgetExceeded: false,
    };
  }

  if (input.riskScore >= 0.65 || (input.uncertainty >= 0.45 && input.askedVerification)) {
    return {
      level: 'deliberation',
      reason: 'high_risk_or_uncertainty',
      budgetExceeded: false,
    };
  }

  if (input.riskScore >= 0.35 || input.uncertainty >= 0.35) {
    return {
      level: 'peer_review',
      reason: 'medium_risk_or_uncertainty',
      budgetExceeded: false,
    };
  }

  if (input.askedVerification && FEATURE_FLAGS.toolRouter) {
    return {
      level: 'web_research',
      reason: 'verification_requested',
      budgetExceeded: false,
    };
  }

  return {
    level: 'single_hatch',
    reason: 'default_fast_path',
    budgetExceeded: false,
  };
}
