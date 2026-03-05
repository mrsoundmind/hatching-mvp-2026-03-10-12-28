import type {
  LLMProvider,
  LLMRequest,
  LLMGenerationResult,
  LLMStreamResult,
  RuntimeMode,
  ProviderHealth,
} from '../providerTypes.js';
import fetch, { type Response } from 'node-fetch';

interface OllamaChatChunk {
  message?: { role?: string; content?: string };
  done?: boolean;
  error?: string;
}

function getBaseUrl(): string {
  return process.env.TEST_OLLAMA_BASE_URL?.trim() || 'http://localhost:11434';
}

function resolveModel(request: LLMRequest): string {
  return request.model || process.env.TEST_OLLAMA_MODEL || 'llama3.1:8b';
}

async function postOllama(path: string, body: Record<string, unknown>, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${getBaseUrl()}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function parseBodyTextError(text: string): string {
  const normalized = text.trim();
  if (!normalized) return 'Unknown Ollama error';
  try {
    const parsed = JSON.parse(normalized) as { error?: string };
    return parsed.error || normalized;
  } catch {
    return normalized;
  }
}

async function* parseOllamaNdjsonStream(stream: AsyncIterable<unknown>): AsyncGenerator<string, void, unknown> {
  const decoder = new TextDecoder();
  let buffer = '';

  for await (const rawChunk of stream) {
    const chunk = rawChunk instanceof Uint8Array
      ? rawChunk
      : Buffer.isBuffer(rawChunk)
        ? rawChunk
        : Buffer.from(String(rawChunk));

    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parsed = JSON.parse(trimmed) as OllamaChatChunk;
      if (parsed.error) {
        throw new Error(parsed.error);
      }
      if (parsed.message?.content) {
        yield parsed.message.content;
      }
    }
  }

  if (buffer.trim()) {
    const parsed = JSON.parse(buffer.trim()) as OllamaChatChunk;
    if (parsed.error) {
      throw new Error(parsed.error);
    }
    if (parsed.message?.content) {
      yield parsed.message.content;
    }
  }
}

async function collectStreamingResponse(stream: AsyncIterable<unknown>): Promise<string> {
  let response = '';
  for await (const token of parseOllamaNdjsonStream(stream)) {
    response += token;
  }
  return response;
}

export class OllamaTestProvider implements LLMProvider {
  readonly id = 'ollama-test' as const;

  async generateChat(request: LLMRequest, mode: RuntimeMode): Promise<LLMGenerationResult> {
    const started = Date.now();
    const model = resolveModel(request);
    const timeoutMs = request.timeoutMs ?? 45_000;

    console.log(
      `[TEST_MODE][OLLAMA] generateChat model=${model} temperature=${request.temperature ?? 0.7} maxTokens=${request.maxTokens ?? 500}`
    );

    const response = await postOllama('/api/chat', {
      model,
      messages: request.messages,
      stream: false,
      options: {
        temperature: request.temperature ?? 0.7,
        num_predict: request.maxTokens ?? 500,
        seed: request.seed ?? 42,
      },
    }, timeoutMs);

    if (!response.ok) {
      const text = await response.text();
      const err = new Error(parseBodyTextError(text));
      (err as any).code = 'OLLAMA_HTTP_ERROR';
      (err as any).status = response.status;
      throw err;
    }

    const data = await response.json() as OllamaChatChunk;
    if (data.error) {
      throw new Error(data.error);
    }

    return {
      content: data.message?.content || '',
      metadata: {
        provider: this.id,
        mode,
        model,
        latencyMs: Date.now() - started,
        temperature: request.temperature ?? 0.7,
        maxTokens: request.maxTokens ?? 500,
      },
    };
  }

  async streamChat(request: LLMRequest, mode: RuntimeMode): Promise<LLMStreamResult> {
    const started = Date.now();
    const model = resolveModel(request);
    const timeoutMs = request.timeoutMs ?? 60_000;

    console.log(
      `[TEST_MODE][OLLAMA] streamChat model=${model} temperature=${request.temperature ?? 0.7} maxTokens=${request.maxTokens ?? 500}`
    );

    const response = await postOllama('/api/chat', {
      model,
      messages: request.messages,
      stream: true,
      options: {
        temperature: request.temperature ?? 0.7,
        num_predict: request.maxTokens ?? 500,
        seed: request.seed ?? 42,
      },
    }, timeoutMs);

    if (!response.ok) {
      const text = await response.text();
      const err = new Error(parseBodyTextError(text));
      (err as any).code = 'OLLAMA_HTTP_ERROR';
      (err as any).status = response.status;
      throw err;
    }

    if (!response.body) {
      throw new Error('Ollama response stream is empty');
    }

    const stream = parseOllamaNdjsonStream(response.body as unknown as AsyncIterable<unknown>);

    return {
      stream,
      metadata: {
        provider: this.id,
        mode,
        model,
        latencyMs: Date.now() - started,
        temperature: request.temperature ?? 0.7,
        maxTokens: request.maxTokens ?? 500,
      },
    };
  }

  async healthCheck(model?: string): Promise<ProviderHealth> {
    const resolvedModel = model || process.env.TEST_OLLAMA_MODEL || 'llama3.1:8b';

    try {
      const tagsResponse = await fetch(`${getBaseUrl()}/api/tags`, { method: 'GET' });
      if (!tagsResponse.ok) {
        return { status: 'down', details: `Ollama /api/tags failed with ${tagsResponse.status}` };
      }
      const tags = await tagsResponse.json() as { models?: Array<{ name?: string }> };
      const hasModel = Array.isArray(tags.models) && tags.models.some((m) => m.name === resolvedModel);
      if (!hasModel) {
        return {
          status: 'degraded',
          details: `Model ${resolvedModel} is missing. Run: ollama pull ${resolvedModel}`,
        };
      }

      const pingResponse = await postOllama('/api/chat', {
        model: resolvedModel,
        messages: [{ role: 'user', content: 'ping' }],
        stream: false,
        options: {
          temperature: 0,
          num_predict: 8,
          seed: 42,
        },
      }, 10_000);

      if (!pingResponse.ok) {
        const errText = await pingResponse.text();
        return {
          status: 'degraded',
          details: parseBodyTextError(errText),
        };
      }

      return { status: 'ok' };
    } catch (error: any) {
      const message = error?.name === 'AbortError'
        ? 'Ollama request timed out'
        : (error?.message || 'Ollama not running');
      return { status: 'down', details: message };
    }
  }

  async checkModelExists(model?: string): Promise<boolean> {
    const resolvedModel = model || process.env.TEST_OLLAMA_MODEL || 'llama3.1:8b';
    try {
      const response = await fetch(`${getBaseUrl()}/api/tags`, { method: 'GET' });
      if (!response.ok) {
        return false;
      }
      const tags = await response.json() as { models?: Array<{ name?: string }> };
      return Array.isArray(tags.models) && tags.models.some((entry) => entry.name === resolvedModel);
    } catch {
      return false;
    }
  }

  async collectOnce(request: LLMRequest): Promise<string> {
    const response = await postOllama('/api/chat', {
      model: resolveModel(request),
      messages: request.messages,
      stream: true,
      options: {
        temperature: request.temperature ?? 0.7,
        num_predict: request.maxTokens ?? 500,
        seed: request.seed ?? 42,
      },
    }, request.timeoutMs ?? 60_000);

    if (!response.ok || !response.body) {
      throw new Error('Failed to collect streaming response from Ollama');
    }

    return collectStreamingResponse(response.body as unknown as AsyncIterable<unknown>);
  }
}
