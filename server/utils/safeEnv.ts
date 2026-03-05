const SENSITIVE_PATTERNS = [
  /key/i,
  /secret/i,
  /token/i,
  /password/i,
  /cookie/i,
  /credential/i,
  /private/i,
];

function shouldRedact(key: string): boolean {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(key));
}

function redactValue(value: string | undefined): string | null {
  if (!value) return null;
  if (value.length <= 4) return '***';
  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}

export function getSanitizedEnvSnapshot(env = process.env): Record<string, string | null> {
  const keysToCapture = [
    'NODE_ENV',
    'PORT',
    'LLM_MODE',
    'LLM_PROVIDER',
    'TEST_LLM_PROVIDER',
    'OPENAI_MODEL',
    'TEST_OLLAMA_MODEL',
    'TEST_OLLAMA_BASE_URL',
    'ROUTING_PASS_THRESHOLD',
    'ROUTING_WARN_THRESHOLD',
    'DRIFT_THRESHOLD_PERCENT',
    'SINGLE_RESPONSE_BUDGET_MS',
    'DELIBERATION_BUDGET_MS',
    'SAFETY_TRIGGER_BUDGET_MS',
    'MAX_SEARCHES',
    'MAX_PAGES',
    'MAX_REVIEWERS',
    'MAX_REVISION_CYCLES',
    'MAX_DELIBERATION_ROUNDS',
    'HARD_RESPONSE_TIMEOUT_MS',
    'WEB_ALLOWED_DOMAINS',
    'WEB_MAX_SEARCHES',
    'WEB_MAX_PAGES',
    'DOMAIN_TRUST_MAP_VERSION',
    'CACHE_ENABLED',
    'CACHE_TTL_STABLE_MS',
    'CACHE_TTL_DYNAMIC_MS',
    'SAFETY_NON_REGRESSION_REQUIRED',
    'REFUSAL_REGRESSION_BLOCKS_RELEASE',
    'ENABLE_WEB_IN_EVAL_MODE',
    'ENABLE_WEB_IN_PROD_MODE',
    'FEATURE_PEER_POLICING',
    'FEATURE_AKL',
    'FEATURE_TASK_GRAPH',
    'FEATURE_TOOL_ROUTER',
    'FEATURE_AUTONOMY_DASHBOARD',
  ];

  const snapshot: Record<string, string | null> = {};

  for (const key of keysToCapture) {
    const value = env[key];
    snapshot[key] = shouldRedact(key) ? redactValue(value) : (value ?? null);
  }

  return snapshot;
}
