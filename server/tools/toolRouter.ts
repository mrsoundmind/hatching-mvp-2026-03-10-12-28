import { resolveEscalationLevel } from '../autonomy/conductor/escalationLadder.js';
import { BUDGETS, FEATURE_FLAGS } from '../autonomy/config/policies.js';

export type ToolKind = 'none' | 'web' | 'code-analysis' | 'file-retrieval';

export interface ToolRouteDecision {
  tool: ToolKind;
  reason: string;
  uncertainty: number;
  recencySensitive: boolean;
  verificationRequested: boolean;
  numericNeed: boolean;
  allowed: boolean;
}

function estimateUncertainty(input: string): number {
  const lower = (input || '').toLowerCase();
  let score = 0.15;
  if (/latest|current|today|recent|trend|forecast/.test(lower)) score += 0.25;
  if (/not sure|unclear|unknown|verify|double-check/.test(lower)) score += 0.25;
  if (/estimate|probability|confidence|predict/.test(lower)) score += 0.2;
  return Math.min(1, score);
}

export function routeTools(input: {
  role: string;
  message: string;
  complexity: 'low' | 'medium' | 'high';
  riskScore: number;
  roundsUsed: number;
  webCallsUsed: number;
}): ToolRouteDecision {
  const lower = (input.message || '').toLowerCase();
  const uncertainty = estimateUncertainty(input.message);
  const recencySensitive = /latest|current|today|recent|new/.test(lower);
  const verificationRequested = /verify|citation|source|prove|check/.test(lower);
  const numericNeed = /%|kpi|metric|number|latency|budget|forecast/.test(lower);

  const escalation = resolveEscalationLevel({
    complexity: input.complexity,
    uncertainty,
    riskScore: input.riskScore,
    askedVerification: verificationRequested,
    multiDomain: /and|across|multiple|product.*engineering|engineering.*marketing/.test(lower),
    roundsUsed: input.roundsUsed,
  });

  if (!FEATURE_FLAGS.toolRouter) {
    return {
      tool: 'none',
      reason: 'feature_flag_disabled',
      uncertainty,
      recencySensitive,
      verificationRequested,
      numericNeed,
      allowed: false,
    };
  }

  if (input.webCallsUsed >= BUDGETS.maxSearches) {
    return {
      tool: 'none',
      reason: 'web_budget_exceeded',
      uncertainty,
      recencySensitive,
      verificationRequested,
      numericNeed,
      allowed: false,
    };
  }

  if (escalation.level === 'web_research' || recencySensitive || verificationRequested) {
    return {
      tool: 'web',
      reason: escalation.reason,
      uncertainty,
      recencySensitive,
      verificationRequested,
      numericNeed,
      allowed: true,
    };
  }

  if (numericNeed && input.complexity !== 'low') {
    return {
      tool: 'code-analysis',
      reason: 'numeric_verification',
      uncertainty,
      recencySensitive,
      verificationRequested,
      numericNeed,
      allowed: true,
    };
  }

  if (input.complexity === 'high') {
    return {
      tool: 'file-retrieval',
      reason: 'complex_context_needs_artifacts',
      uncertainty,
      recencySensitive,
      verificationRequested,
      numericNeed,
      allowed: true,
    };
  }

  return {
    tool: 'none',
    reason: 'single_hatch_fast_path',
    uncertainty,
    recencySensitive,
    verificationRequested,
    numericNeed,
    allowed: false,
  };
}
