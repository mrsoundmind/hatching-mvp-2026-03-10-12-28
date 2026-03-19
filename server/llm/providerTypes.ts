export type RuntimeMode = 'prod' | 'test';

export type ProviderId = 'openai' | 'gemini' | 'groq' | 'ollama-test' | 'mock';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMRequest {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  seed?: number;
}

export interface LLMResponseMetadata {
  provider: ProviderId;
  mode: RuntimeMode;
  model: string;
  latencyMs: number;
  temperature?: number;
  maxTokens?: number;
  fallbackChain?: ProviderId[];
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
  testProvider?: 'openai' | 'groq' | 'ollama' | 'mock';
  ollamaBaseUrl?: string;
}
