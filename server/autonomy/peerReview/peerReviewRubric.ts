import { evaluateSafetyScore } from '../../ai/safety.js';

export type HallucinationRiskLevel = 'low' | 'medium' | 'high';
export type PassFail = 'pass' | 'fail';

export interface PeerReviewRubric {
  reviewerHatchId: string;
  hallucinationRisk: HallucinationRiskLevel;
  roleFit: PassFail;
  usefulness: PassFail;
  contradictions: string[];
  missingQuestions: string[];
  fixSuggestions: string[];
}

const FACTUAL_CLAIM_PATTERN = /\b(according to|research shows|always|never|guaranteed|proven|statistically|exactly \d+%|forecast)\b/i;

export function evaluatePeerReviewRubric(input: {
  reviewerHatchId: string;
  reviewerRole: string;
  userMessage: string;
  draftResponse: string;
  projectName?: string;
  canonHints?: string[];
}): PeerReviewRubric {
  const safety = evaluateSafetyScore({
    userMessage: input.userMessage,
    draftResponse: input.draftResponse,
    conversationMode: 'project',
    projectName: input.projectName,
  });

  const contradictions: string[] = [];
  const missingQuestions: string[] = [];
  const fixSuggestions: string[] = [];

  const lowerDraft = input.draftResponse.toLowerCase();
  const lowerUser = input.userMessage.toLowerCase();

  if (input.canonHints && input.canonHints.length > 0) {
    for (const hint of input.canonHints) {
      const clue = hint.toLowerCase();
      if (!clue || clue.length < 6) continue;
      const keyword = clue.split(' ').slice(0, 3).join(' ');
      if (keyword && !lowerDraft.includes(keyword)) {
        contradictions.push(`Missing canon anchor: ${keyword}`);
      }
    }
  }

  if (FACTUAL_CLAIM_PATTERN.test(input.draftResponse) && !/source|evidence|assumption|depends/i.test(input.draftResponse)) {
    missingQuestions.push('Can we cite or verify the factual claim before presenting certainty?');
    fixSuggestions.push('Add evidence qualifiers and avoid absolute certainty without citations.');
  }

  if (/launch|deploy|send to all|production/i.test(lowerUser) && !/risk|rollback|guardrail|approval/i.test(lowerDraft)) {
    missingQuestions.push('What rollback and approval gate should be required before execution?');
    fixSuggestions.push('Add explicit approval gate and rollback plan for high-impact actions.');
  }

  if (safety.scopeRisk >= 0.35 && !/project|scope|isolation/i.test(lowerDraft)) {
    contradictions.push('Response does not explicitly guard project scope isolation.');
    fixSuggestions.push('State that cross-project memory/data access is blocked by design.');
  }

  if (!/next step|action|owner|timeline|task/i.test(lowerDraft)) {
    fixSuggestions.push('Add concrete next actions with owner and timeline.');
  }

  if (fixSuggestions.length > 5) {
    fixSuggestions.splice(5);
  }

  let hallucinationRisk: HallucinationRiskLevel = 'low';
  const aggregateRisk = Math.max(safety.hallucinationRisk, safety.executionRisk, safety.scopeRisk);
  if (aggregateRisk >= 0.7 || contradictions.length >= 2) {
    hallucinationRisk = 'high';
  } else if (aggregateRisk >= 0.35 || missingQuestions.length > 0) {
    hallucinationRisk = 'medium';
  }

  const roleFit: PassFail =
    input.reviewerRole.toLowerCase().includes('manager') ||
    /strategy|plan|task|execution|owner/i.test(input.draftResponse)
      ? 'pass'
      : 'fail';

  const usefulness: PassFail = fixSuggestions.length > 0 ? 'pass' : 'fail';

  return {
    reviewerHatchId: input.reviewerHatchId,
    hallucinationRisk,
    roleFit,
    usefulness,
    contradictions,
    missingQuestions,
    fixSuggestions,
  };
}
