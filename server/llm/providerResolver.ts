import type {
  LLMRequest,
  LLMGenerationResult,
  LLMProvider,
  LLMStreamResult,
  ProviderId,
  RuntimeConfig,
  RuntimeMode,
  ProviderHealth,
} from './providerTypes.js';
import { OpenAIProvider } from './providers/openaiProvider.js';
import { OllamaTestProvider } from './providers/ollamaProvider.js';
import { MockProvider } from './providers/mockProvider.js';

const openaiProvider = new OpenAIProvider();
const ollamaProvider = new OllamaTestProvider();
const mockProvider = new MockProvider();

const providerRegistry: Record<ProviderId, LLMProvider> = {
  openai: openaiProvider,
  'ollama-test': ollamaProvider,
  mock: mockProvider,
};

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

function parseTestProvider(raw: string | undefined): 'openai' | 'ollama' | 'mock' {
  const normalized = (raw || '').trim().toLowerCase();
  if (normalized === 'openai') return 'openai';
  if (normalized === 'ollama') return 'ollama';
  return 'mock';
}

export function resolveRuntimeConfig(env = process.env): RuntimeConfig {
  const mode = toMode(env.LLM_MODE);

  if (mode === 'prod') {
    const illegalProvider = (env.TEST_LLM_PROVIDER || env.LLM_PROVIDER || '').toLowerCase();
    if (illegalProvider.includes('ollama')) {
      throw new Error('Ollama test provider cannot run in production mode.');
    }
    return {
      mode,
      provider: 'openai',
      model: env.OPENAI_MODEL || 'gpt-4o-mini',
    };
  }

  const testProvider = parseTestProvider(env.TEST_LLM_PROVIDER);
  if (testProvider === 'openai') {
    return {
      mode,
      provider: 'openai',
      testProvider: 'openai',
      model: env.OPENAI_MODEL || 'gpt-4o-mini',
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
  if (config.mode === 'prod' && config.provider !== 'openai') {
    throw new Error('Production mode must use OpenAI provider only.');
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
    return ['openai'];
  }

  if (priorError && isOpenAIQuotaError(priorError)) {
    return ['ollama-test', 'mock'];
  }

  if (config.provider === 'openai') {
    return ['openai', 'ollama-test', 'mock'];
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

  if (provider === 'openai') {
    return { ...request, model: process.env.OPENAI_MODEL || config.model || 'gpt-4o-mini' };
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

      if (config.mode === 'prod') {
        throw error;
      }

      if (providerId === 'openai' && !isOpenAIQuotaError(error) && !isRecoverableOpenAITestError(error)) {
        throw error;
      }

      // Continue fallback chain in test mode.
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

      if (config.mode === 'prod') {
        throw error;
      }

      if (providerId === 'openai' && !isOpenAIQuotaError(error) && !isRecoverableOpenAITestError(error)) {
        throw error;
      }

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
    const status = process.env.OPENAI_API_KEY ? 'ok' : 'down';
    cachedDiagnostics = {
      status,
      mode: config.mode,
      provider: config.provider,
      model: config.model,
      ollamaReachable: false,
      modelAvailable: false,
      details: process.env.OPENAI_API_KEY
        ? ['Production mode active with OpenAI provider']
        : ['OPENAI_API_KEY is missing'],
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

export async function getProviderHealthSummary(): Promise<Record<ProviderId, ProviderHealth>> {
  const config = resolveRuntimeConfig();

  const [openai, ollama, mock] = await Promise.all([
    openaiProvider.healthCheck?.(process.env.OPENAI_MODEL || 'gpt-4o-mini') || Promise.resolve({ status: 'down', details: 'Unavailable' } as ProviderHealth),
    ollamaProvider.healthCheck?.(process.env.TEST_OLLAMA_MODEL || 'llama3.1:8b') || Promise.resolve({ status: 'down', details: 'Unavailable' } as ProviderHealth),
    mockProvider.healthCheck?.() || Promise.resolve({ status: 'ok', details: 'Deterministic mock available' } as ProviderHealth),
  ]);

  return {
    openai,
    'ollama-test': ollama,
    mock,
  };
}
