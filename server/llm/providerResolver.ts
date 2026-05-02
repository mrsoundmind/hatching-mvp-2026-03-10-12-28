import type {
  LLMRequest,
  LLMGenerationResult,
  LLMProvider,
  LLMStreamResult,
  ProviderId,
  RuntimeConfig,
  RuntimeMode,
  ProviderHealth,
  ModelTier,
} from './providerTypes.js';
import { OpenAIProvider } from './providers/openaiProvider.js';
import { OllamaTestProvider } from './providers/ollamaProvider.js';
import { MockProvider } from './providers/mockProvider.js';
import { GeminiProvider } from './providers/geminiProvider.js';
import { GroqProvider } from './providers/groqProvider.js';
import { DeepSeekProvider } from './providers/deepseekProvider.js';

const openaiProvider = new OpenAIProvider();
const geminiProvider = new GeminiProvider();
const groqProvider = new GroqProvider();
const deepseekProvider = new DeepSeekProvider();
const ollamaProvider = new OllamaTestProvider();
const mockProvider = new MockProvider();

export const providerRegistry: Record<ProviderId, LLMProvider> = {
  openai: openaiProvider,
  gemini: geminiProvider,
  groq: groqProvider,
  deepseek: deepseekProvider,
  'ollama-test': ollamaProvider,
  mock: mockProvider,
};

// LLM_PRIMARY env var: explicit override of which provider sits at head of prod chain.
// Defaults: 'deepseek' if DEEPSEEK_API_KEY set, else 'gemini' if GEMINI_API_KEY set.
// OpenAI removed from default prod chain — only fires if explicitly set via LLM_PRIMARY=openai.
// Rollback: set LLM_PRIMARY=gemini to instantly demote DeepSeek without code change.
function resolvePrimaryProvider(env = process.env): ProviderId {
  const explicit = (env.LLM_PRIMARY || '').trim().toLowerCase();
  if (explicit === 'deepseek' && env.DEEPSEEK_API_KEY) return 'deepseek';
  if (explicit === 'gemini' && env.GEMINI_API_KEY) return 'gemini';
  if (explicit === 'openai' && env.OPENAI_API_KEY) return 'openai';
  if (env.DEEPSEEK_API_KEY) return 'deepseek';
  if (env.GEMINI_API_KEY) return 'gemini';
  // Last-resort: if user has only OPENAI_API_KEY set, allow it. No silent default.
  if (env.OPENAI_API_KEY) return 'openai';
  return 'gemini'; // will fail downstream with a clear "GEMINI_API_KEY missing" error
}

export interface RuntimeDiagnostics {
  status: 'ok' | 'degraded' | 'down';
  mode: RuntimeMode;
  provider: ProviderId;
  model: string;
  ollamaReachable: boolean;
  modelAvailable: boolean;
  details: string[];
}

let cachedDiagnostics: RuntimeDiagnostics | null = null;

function toMode(raw: string | undefined): RuntimeMode {
  return raw?.toLowerCase() === 'test' ? 'test' : 'prod';
}

function parseTestProvider(raw: string | undefined): 'openai' | 'groq' | 'ollama' | 'mock' | 'deepseek' {
  const normalized = (raw || '').trim().toLowerCase();
  if (normalized === 'openai') return 'openai';
  if (normalized === 'groq') return 'groq';
  if (normalized === 'ollama') return 'ollama';
  if (normalized === 'deepseek') return 'deepseek';
  return 'mock';
}

export function resolveRuntimeConfig(env = process.env): RuntimeConfig {
  const mode = toMode(env.LLM_MODE);

  if (mode === 'prod') {
    const illegalProvider = (env.TEST_LLM_PROVIDER || env.LLM_PROVIDER || '').toLowerCase();
    if (illegalProvider.includes('ollama')) {
      throw new Error('Ollama test provider cannot run in production mode.');
    }
    // Primary provider precedence: DeepSeek (if key) → Gemini (if key) → OpenAI
    // Override via LLM_PRIMARY env var (rollback path).
    const primary = resolvePrimaryProvider(env);
    if (primary === 'deepseek') {
      return {
        mode,
        provider: 'deepseek',
        model: env.DEEPSEEK_MODEL || 'deepseek-v4-flash',
      };
    }
    if (primary === 'gemini') {
      return {
        mode,
        provider: 'gemini',
        model: env.GEMINI_MODEL || 'gemini-2.5-flash',
      };
    }
    return {
      mode,
      provider: 'openai',
      model: env.OPENAI_MODEL || 'gpt-4o-mini',
    };
  }

  const testProvider = parseTestProvider(env.TEST_LLM_PROVIDER);
  if (testProvider === 'openai') {
    // Also prefer gemini in test mode when key is set
    if (env.GEMINI_API_KEY) {
      return {
        mode,
        provider: 'gemini',
        testProvider: 'openai',
        model: env.GEMINI_MODEL || 'gemini-2.5-flash',
      };
    }
    return {
      mode,
      provider: 'openai',
      testProvider: 'openai',
      model: env.OPENAI_MODEL || 'gpt-4o-mini',
    };
  }

  if (testProvider === 'groq') {
    return {
      mode,
      provider: 'groq',
      testProvider: 'groq',
      model: env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    };
  }

  if (testProvider === 'deepseek') {
    return {
      mode,
      provider: 'deepseek',
      testProvider: 'deepseek',
      model: env.DEEPSEEK_MODEL || 'deepseek-v4-flash',
    };
  }

  if (testProvider === 'ollama') {
    return {
      mode,
      provider: 'ollama-test',
      testProvider: 'ollama',
      model: env.TEST_OLLAMA_MODEL || 'llama3.1:8b',
      ollamaBaseUrl: env.TEST_OLLAMA_BASE_URL || 'http://localhost:11434',
    };
  }

  return {
    mode,
    provider: 'mock',
    testProvider: 'mock',
    model: env.TEST_MOCK_MODEL || 'mock-v1',
  };
}

export function getCurrentRuntimeConfig(): RuntimeConfig {
  return resolveRuntimeConfig(process.env);
}

export function assertRuntimeGuardrails(config = resolveRuntimeConfig()): void {
  const allowedProdProviders: ProviderId[] = ['openai', 'gemini', 'groq', 'deepseek'];
  if (config.mode === 'prod' && !allowedProdProviders.includes(config.provider)) {
    throw new Error('Production mode must use OpenAI, Gemini, Groq, or DeepSeek provider only.');
  }

  if (config.mode === 'prod' && process.env.TEST_LLM_PROVIDER?.toLowerCase() === 'ollama') {
    throw new Error('Ollama test provider cannot run in production mode.');
  }
}

function isOpenAIQuotaError(error: any): boolean {
  const status = Number(error?.status || error?.statusCode || error?.response?.status || 0);
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();

  return (
    status === 429 && (code.includes('insufficient_quota') || message.includes('insufficient_quota') || message.includes('quota'))
  ) || (
      status === 429 && (code.includes('rate_limit') || message.includes('rate limit'))
    );
}

function isRecoverableOpenAITestError(error: any): boolean {
  const status = Number(error?.status || error?.statusCode || error?.response?.status || 0);
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();

  if (code.includes('openai_api_key_missing')) return true;
  if (code.includes('invalid_api_key')) return true;
  if (message.includes('api key')) return true;
  if (status === 401) return true;
  return false;
}

function buildProviderOrder(config: RuntimeConfig, priorError?: any): ProviderId[] {
  if (config.mode === 'prod') {
    // Prod chain: <primary> → <other-proprietary-as-fallback> → Groq (if set)
    // DeepSeek is the cost-optimized default; Gemini is the hot fallback so DeepSeek
    // outages don't take chat down. Groq is the FREE safety net (Llama 3.3-70B).
    // OpenAI removed from default chain — only invoked if LLM_PRIMARY=openai is set.
    if (config.provider === 'deepseek') {
      const chain: ProviderId[] = ['deepseek'];
      if (process.env.GEMINI_API_KEY) chain.push('gemini');
      if (process.env.GROQ_API_KEY) chain.push('groq');
      return chain;
    }
    if (config.provider === 'gemini') {
      const chain: ProviderId[] = ['gemini'];
      if (process.env.DEEPSEEK_API_KEY) chain.push('deepseek');
      if (process.env.GROQ_API_KEY) chain.push('groq');
      return chain;
    }
    if (config.provider === 'openai') {
      // Explicit LLM_PRIMARY=openai escape hatch. Still falls back to Gemini/Groq if set.
      const chain: ProviderId[] = ['openai'];
      if (process.env.GEMINI_API_KEY) chain.push('gemini');
      if (process.env.GROQ_API_KEY) chain.push('groq');
      return chain;
    }
    return ['openai'];
  }

  if (priorError && isOpenAIQuotaError(priorError)) {
    return ['ollama-test', 'mock'];
  }

  if (config.provider === 'deepseek') {
    return ['deepseek', 'ollama-test', 'mock'];
  }

  if (config.provider === 'gemini') {
    return process.env.OPENAI_API_KEY
      ? ['gemini', 'openai', 'ollama-test', 'mock']
      : ['gemini', 'ollama-test', 'mock'];
  }

  if (config.provider === 'openai') {
    return ['openai', 'ollama-test', 'mock'];
  }

  if (config.provider === 'groq') {
    return ['groq', 'mock'];
  }

  if (config.provider === 'ollama-test') {
    return ['ollama-test', 'mock'];
  }

  return ['mock'];
}

function applyModelDefaults(request: LLMRequest, config: RuntimeConfig, provider: ProviderId): LLMRequest {
  if (request.model) {
    return request;
  }

  if (provider === 'deepseek') {
    const tieredDefault = request.modelTier === 'premium'
      ? (process.env.DEEPSEEK_PRO_MODEL || 'deepseek-v4-pro')
      : (process.env.DEEPSEEK_MODEL || config.model || 'deepseek-v4-flash');
    return { ...request, model: tieredDefault };
  }

  if (provider === 'gemini') {
    return { ...request, model: process.env.GEMINI_MODEL || config.model || 'gemini-2.5-flash' };
  }

  if (provider === 'openai') {
    return { ...request, model: process.env.OPENAI_MODEL || config.model || 'gpt-4o-mini' };
  }

  if (provider === 'groq') {
    return { ...request, model: process.env.GROQ_MODEL || config.model || 'llama-3.3-70b-versatile' };
  }

  if (provider === 'ollama-test') {
    return { ...request, model: process.env.TEST_OLLAMA_MODEL || config.model || 'llama3.1:8b', seed: request.seed ?? 42 };
  }

  return { ...request, model: config.model || 'mock-v1', seed: request.seed ?? 42 };
}

export async function generateChatWithRuntimeFallback(request: LLMRequest): Promise<LLMGenerationResult> {
  const config = resolveRuntimeConfig();
  const attempted: ProviderId[] = [];
  let lastError: any = null;

  for (const providerId of buildProviderOrder(config, lastError)) {
    const provider = providerRegistry[providerId];
    if (!provider) continue;

    try {
      const result = await provider.generateChat(applyModelDefaults(request, config, providerId), config.mode);
      const normalizedContent = typeof result.content === 'string' ? result.content.trim() : '';
      if (config.mode === 'test' && providerId === 'ollama-test' && normalizedContent.length === 0) {
        attempted.push(providerId);
        lastError = new Error('OLLAMA_EMPTY_RESPONSE');
        continue;
      }
      const fallbackChain = attempted.length > 0 ? [...attempted] : undefined;
      return {
        ...result,
        metadata: {
          ...result.metadata,
          fallbackChain,
        },
      };
    } catch (error: any) {
      attempted.push(providerId);
      lastError = error;
      console.error(`[LLM] Provider ${providerId} failed (generate), trying next:`, error.message || error);

      if (providerId === 'openai' && !isOpenAIQuotaError(error) && !isRecoverableOpenAITestError(error)) {
        throw error;
      }

      // Continue fallback chain in all modes (prod + test)
      continue;
    }
  }

  throw lastError || new Error('No LLM provider available');
}

export async function streamChatWithRuntimeFallback(request: LLMRequest): Promise<LLMStreamResult> {
  const config = resolveRuntimeConfig();
  const attempted: ProviderId[] = [];
  let lastError: any = null;

  for (const providerId of buildProviderOrder(config, lastError)) {
    const provider = providerRegistry[providerId];
    if (!provider) continue;

    try {
      const result = await provider.streamChat(applyModelDefaults(request, config, providerId), config.mode);
      const fallbackChain = attempted.length > 0 ? [...attempted] : undefined;
      return {
        ...result,
        metadata: {
          ...result.metadata,
          fallbackChain,
        },
      };
    } catch (error: any) {
      attempted.push(providerId);
      lastError = error;
      console.error(`[LLM] Provider ${providerId} failed (stream), trying next:`, error.message || error);

      if (providerId === 'openai' && !isOpenAIQuotaError(error) && !isRecoverableOpenAITestError(error)) {
        throw error;
      }

      // Continue fallback chain in all modes (prod + test)
      continue;
    }
  }

  throw lastError || new Error('No LLM provider available for streaming');
}

export async function runRuntimeStartupChecks(): Promise<RuntimeDiagnostics> {
  const config = resolveRuntimeConfig();
  assertRuntimeGuardrails(config);

  const details: string[] = [];

  if (config.mode === 'prod') {
    const hasDeepSeek = Boolean(process.env.DEEPSEEK_API_KEY);
    const hasGemini = Boolean(process.env.GEMINI_API_KEY);
    const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);
    const activeKey =
      config.provider === 'deepseek' ? hasDeepSeek :
      config.provider === 'gemini' ? hasGemini :
      hasOpenAI;
    const providerLabel =
      config.provider === 'deepseek' ? 'DeepSeek' :
      config.provider === 'gemini' ? 'Gemini' :
      'OpenAI';
    const missingKeyName =
      config.provider === 'deepseek' ? 'DEEPSEEK_API_KEY' :
      config.provider === 'gemini' ? 'GEMINI_API_KEY' :
      'OPENAI_API_KEY';
    cachedDiagnostics = {
      status: activeKey ? 'ok' : 'down',
      mode: config.mode,
      provider: config.provider,
      model: config.model,
      ollamaReachable: false,
      modelAvailable: false,
      details: activeKey
        ? [`Production mode active with ${providerLabel} provider`]
        : [`${missingKeyName} is missing`],
    };
    return cachedDiagnostics;
  }

  if (config.provider === 'mock') {
    cachedDiagnostics = {
      status: 'ok',
      mode: config.mode,
      provider: config.provider,
      model: config.model,
      ollamaReachable: false,
      modelAvailable: false,
      details: ['Deterministic test mode active (Mock provider)'],
    };
    return cachedDiagnostics;
  }

  if (config.provider === 'deepseek') {
    const status = process.env.DEEPSEEK_API_KEY ? 'ok' : 'down';
    cachedDiagnostics = {
      status,
      mode: config.mode,
      provider: config.provider,
      model: config.model,
      ollamaReachable: false,
      modelAvailable: false,
      details: process.env.DEEPSEEK_API_KEY
        ? [`Using DeepSeek (${config.model}) with fallback chain to Ollama/Mock on errors`]
        : ['DEEPSEEK_API_KEY missing — get one at platform.deepseek.com'],
    };
    return cachedDiagnostics;
  }

  if (config.provider === 'gemini') {
    const status = process.env.GEMINI_API_KEY ? 'ok' : 'down';
    cachedDiagnostics = {
      status,
      mode: config.mode,
      provider: config.provider,
      model: config.model,
      ollamaReachable: false,
      modelAvailable: false,
      details: process.env.GEMINI_API_KEY
        ? ['Using Gemini with fallback chain to Ollama/Mock on errors']
        : ['GEMINI_API_KEY missing'],
    };
    return cachedDiagnostics;
  }

  if (config.provider === 'openai') {
    const status = process.env.OPENAI_API_KEY ? 'ok' : 'down';
    cachedDiagnostics = {
      status,
      mode: config.mode,
      provider: config.provider,
      model: config.model,
      ollamaReachable: false,
      modelAvailable: false,
      details: process.env.OPENAI_API_KEY
        ? ['Test mode using OpenAI with fallback chain to Ollama/Mock on quota errors']
        : ['OPENAI_API_KEY missing for test-mode OpenAI'],
    };
    return cachedDiagnostics;
  }

  if (config.provider === 'groq') {
    const status = process.env.GROQ_API_KEY ? 'ok' : 'down';
    cachedDiagnostics = {
      status,
      mode: config.mode,
      provider: config.provider,
      model: config.model,
      ollamaReachable: false,
      modelAvailable: false,
      details: process.env.GROQ_API_KEY
        ? [`Using Groq (${config.model}) with fallback to Mock on errors`]
        : ['GROQ_API_KEY missing — get one free at console.groq.com/keys'],
    };
    return cachedDiagnostics;
  }

  const health = await ollamaProvider.healthCheck?.(config.model);
  const reachability = health?.status !== 'down';
  const modelAvailable = health?.status === 'ok';

  if (!reachability) {
    details.push('Ollama not running. Start Ollama and pull the model.');
  }

  if (!modelAvailable) {
    details.push(`ollama pull ${config.model}`);
  }

  if (health?.details) {
    details.push(health.details);
  }

  cachedDiagnostics = {
    status: health?.status || 'degraded',
    mode: config.mode,
    provider: config.provider,
    model: config.model,
    ollamaReachable: reachability,
    modelAvailable,
    details,
  };

  return cachedDiagnostics;
}

export function getCachedRuntimeDiagnostics(): RuntimeDiagnostics | null {
  return cachedDiagnostics;
}

/**
 * Resolve which model to use based on tier.
 * - standard → default runtime model (DeepSeek V4-Flash > Gemini 2.5-Flash > OpenAI)
 * - premium  → DeepSeek V4-Pro (preferred), Gemini 2.5-Pro (fallback) — Pro users only
 *
 * Premium routing follows the same primary-precedence as resolveRuntimeConfig:
 * DEEPSEEK_API_KEY wins, then GEMINI_API_KEY, then standard default.
 */
export function resolveModelForTier(tier: ModelTier): { provider: ProviderId; model: string } {
  if (tier === 'premium') {
    if (process.env.DEEPSEEK_API_KEY) {
      return {
        provider: 'deepseek',
        model: process.env.DEEPSEEK_PRO_MODEL || 'deepseek-v4-pro',
      };
    }
    if (process.env.GEMINI_API_KEY) {
      return {
        provider: 'gemini',
        model: process.env.GEMINI_PRO_MODEL || 'gemini-2.5-pro',
      };
    }
  }
  // Standard tier — use default config
  const config = resolveRuntimeConfig();
  return { provider: config.provider, model: config.model };
}

/**
 * Generate with a preferred provider (e.g. Groq for task extraction).
 * Falls back to default chain silently on failure.
 */
export async function generateWithPreferredProvider(
  request: LLMRequest,
  preferredProviderId: ProviderId,
): Promise<LLMGenerationResult> {
  const provider = providerRegistry[preferredProviderId];
  if (provider) {
    try {
      const config = resolveRuntimeConfig();
      const result = await provider.generateChat(
        applyModelDefaults(request, config, preferredProviderId),
        config.mode,
      );
      if (result.content?.trim()) {
        return result;
      }
    } catch {
      // Silent fallback to default chain
    }
  }
  return generateChatWithRuntimeFallback(request);
}

/**
 * Stream with a preferred provider (e.g. Groq for simple messages).
 * Falls back to default streaming chain silently on failure.
 */
export async function streamWithPreferredProvider(
  request: LLMRequest,
  preferredProviderId: ProviderId,
): Promise<LLMStreamResult> {
  const provider = providerRegistry[preferredProviderId];
  if (provider) {
    try {
      const config = resolveRuntimeConfig();
      return await provider.streamChat(
        applyModelDefaults(request, config, preferredProviderId),
        config.mode,
      );
    } catch {
      // Silent fallback to default chain
    }
  }
  return streamChatWithRuntimeFallback(request);
}

export async function getProviderHealthSummary(): Promise<Record<ProviderId, ProviderHealth>> {
  const config = resolveRuntimeConfig();

  const [openai, gemini, groq, deepseek, ollama, mock] = await Promise.all([
    openaiProvider.healthCheck?.(process.env.OPENAI_MODEL || 'gpt-4o-mini') || Promise.resolve({ status: 'down', details: 'Unavailable' } as ProviderHealth),
    geminiProvider.healthCheck?.(process.env.GEMINI_MODEL || 'gemini-2.5-flash') || Promise.resolve({ status: 'down', details: 'Unavailable' } as ProviderHealth),
    groqProvider.healthCheck?.(process.env.GROQ_MODEL || 'llama-3.3-70b-versatile') || Promise.resolve({ status: 'down', details: 'Unavailable' } as ProviderHealth),
    process.env.DEEPSEEK_API_KEY
      ? (deepseekProvider.healthCheck?.(process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash') || Promise.resolve({ status: 'down', details: 'Unavailable' } as ProviderHealth))
      : Promise.resolve({ status: 'down', details: 'DEEPSEEK_API_KEY not set' } as ProviderHealth),
    ollamaProvider.healthCheck?.(process.env.TEST_OLLAMA_MODEL || 'llama3.1:8b') || Promise.resolve({ status: 'down', details: 'Unavailable' } as ProviderHealth),
    mockProvider.healthCheck?.() || Promise.resolve({ status: 'ok', details: 'Deterministic mock available' } as ProviderHealth),
  ]);

  return {
    openai,
    gemini,
    groq,
    deepseek,
    'ollama-test': ollama,
    mock,
  };
}
