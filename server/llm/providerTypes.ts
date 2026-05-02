export type RuntimeMode = 'prod' | 'test';

export type ProviderId = 'openai' | 'gemini' | 'groq' | 'ollama-test' | 'mock' | 'deepseek';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export type ModelTier = 'standard' | 'premium';

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LLMRequest {
  messages: ChatMessage[];
  model?: string;
  modelTier?: ModelTier;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  seed?: number;
  signal?: AbortSignal;
}

export interface LLMResponseMetadata {
  provider: ProviderId;
  mode: RuntimeMode;
  model: string;
  latencyMs: number;
  temperature?: number;
  maxTokens?: number;
  fallbackChain?: ProviderId[];
  tokenUsage?: TokenUsage;
  modelTier?: ModelTier;
}

export interface LLMGenerationResult {
  content: string;
  metadata: LLMResponseMetadata;
}

export interface LLMStreamResult {
  stream: AsyncGenerator<string, void, unknown>;
  metadata: LLMResponseMetadata;
}

export interface ProviderHealth {
  status: 'ok' | 'degraded' | 'down';
  details?: string;
}

export interface LLMProvider {
  readonly id: ProviderId;
  generateChat(request: LLMRequest, mode: RuntimeMode): Promise<LLMGenerationResult>;
  streamChat(request: LLMRequest, mode: RuntimeMode): Promise<LLMStreamResult>;
  healthCheck?(model?: string): Promise<ProviderHealth>;
}

export interface RuntimeConfig {
  mode: RuntimeMode;
  provider: ProviderId;
  model: string;
  testProvider?: 'openai' | 'groq' | 'ollama' | 'mock' | 'deepseek';
  ollamaBaseUrl?: string;
}
