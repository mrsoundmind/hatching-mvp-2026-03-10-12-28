export type RuntimeModeName = 'deterministic-test' | 'evaluation-test' | 'production';

export interface CognitiveBudgets {
  maxSearches: number;
  maxPages: number;
  maxReviewers: number;
  maxRevisionCycles: number;
  maxDeliberationRounds: number;
  hardResponseTimeoutMs: number;
  singleResponseBudgetMs: number;
  deliberationBudgetMs: number;
  safetyTriggerBudgetMs: number;
  maxConcurrentAutonomousTasks: number;
  maxBackgroundLlmCallsPerProjectPerDay: number;
}

export const ROUTING_GATE = {
  pass: 0.8,
  warn: 0.7,
  fail: 0.7,
} as const;

export const DELIBERATION_GATES = {
  peerReviewTrigger: Number(process.env.PEER_REVIEW_TRIGGER ?? 0.35),
  doubleReviewTrigger: Number(process.env.DOUBLE_REVIEW_TRIGGER ?? 0.65),
  clarificationRequiredRisk: Number(process.env.CLARIFICATION_REQUIRED_RISK ?? 0.7),
  clarificationRequiredConfidence: Number(process.env.CLARIFICATION_REQUIRED_CONFIDENCE ?? 0.45),
  maxReviewTokenBudget: Number(process.env.MAX_REVIEW_TOKENS ?? 900),
} as const;

export const BUDGETS: CognitiveBudgets = {
  maxSearches: Number(process.env.MAX_SEARCHES ?? 3),
  maxPages: Number(process.env.MAX_PAGES ?? 6),
  maxReviewers: Number(process.env.MAX_REVIEWERS ?? 2),
  maxRevisionCycles: Number(process.env.MAX_REVISION_CYCLES ?? 1),
  maxDeliberationRounds: Number(process.env.MAX_DELIBERATION_ROUNDS ?? 3),
  hardResponseTimeoutMs: Number(process.env.HARD_RESPONSE_TIMEOUT_MS ?? 45_000),
  singleResponseBudgetMs: Number(process.env.SINGLE_RESPONSE_BUDGET_MS ?? 4_000),
  deliberationBudgetMs: Number(process.env.DELIBERATION_BUDGET_MS ?? 12_000),
  safetyTriggerBudgetMs: Number(process.env.SAFETY_TRIGGER_BUDGET_MS ?? 1_000),
  maxConcurrentAutonomousTasks: Number(process.env.MAX_CONCURRENT_AUTONOMOUS_TASKS ?? 3),
  maxBackgroundLlmCallsPerProjectPerDay: Number(process.env.MAX_BACKGROUND_LLM_CALLS_PER_PROJECT_PER_DAY ?? 5),
};

export const FEATURE_FLAGS = {
  peerPolicing: (process.env.FEATURE_PEER_POLICING ?? 'true').toLowerCase() === 'true',
  akl: (process.env.FEATURE_AKL ?? 'true').toLowerCase() === 'true',
  taskGraph: (process.env.FEATURE_TASK_GRAPH ?? 'true').toLowerCase() === 'true',
  toolRouter: (process.env.FEATURE_TOOL_ROUTER ?? 'true').toLowerCase() === 'true',
  autonomyDashboard: (process.env.FEATURE_AUTONOMY_DASHBOARD ?? 'true').toLowerCase() === 'true',
  backgroundExecution: (process.env.BACKGROUND_AUTONOMY_ENABLED ?? 'false').toLowerCase() === 'true',
};

export const MAX_HANDOFF_HOPS = Number(process.env.MAX_HANDOFF_HOPS ?? 4);

export function resolveRuntimeModeFromEnv(env = process.env): RuntimeModeName {
  const llmMode = (env.LLM_MODE ?? 'prod').toLowerCase();
  const testProvider = (env.TEST_LLM_PROVIDER ?? '').toLowerCase();

  if (llmMode === 'test' && testProvider === 'mock') {
    return 'deterministic-test';
  }
  if (llmMode === 'test' && testProvider === 'ollama') {
    return 'evaluation-test';
  }
  if (llmMode === 'test' && testProvider === 'openai') {
    return 'evaluation-test';
  }
  return 'production';
}

export function shouldAllowWebCalls(env = process.env): boolean {
  const mode = resolveRuntimeModeFromEnv(env);
  if (mode === 'deterministic-test') return false;
  if (mode === 'evaluation-test') {
    return (env.ENABLE_WEB_IN_EVAL_MODE ?? 'false').toLowerCase() === 'true';
  }
  return (env.ENABLE_WEB_IN_PROD_MODE ?? 'false').toLowerCase() === 'true';
}
