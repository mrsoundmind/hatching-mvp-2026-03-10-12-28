import { OpenAI } from 'openai';
import type {
  LLMProvider,
  LLMRequest,
  LLMGenerationResult,
  LLMStreamResult,
  RuntimeMode,
  ProviderHealth,
} from '../providerTypes.js';

function buildClient(): OpenAI {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    const err = new Error('Groq API key is missing');
    (err as any).code = 'GROQ_API_KEY_MISSING';
    throw err;
  }
  return new OpenAI({
    apiKey,
    baseURL: 'https://api.groq.com/openai/v1',
  });
}

function resolveGroqModel(request: LLMRequest): string {
  return request.model || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
}

export class GroqProvider implements LLMProvider {
  readonly id = 'groq' as const;

  async generateChat(request: LLMRequest, mode: RuntimeMode): Promise<LLMGenerationResult> {
    const started = Date.now();
    const client = buildClient();
    const model = resolveGroqModel(request);
    const completion = await client.chat.completions.create({
      model,
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 500,
    });

    const content = completion.choices[0]?.message?.content || '';
    return {
      content,
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
    const client = buildClient();
    const model = resolveGroqModel(request);

    const completion = await client.chat.completions.create({
      model,
      messages: request.messages,
      stream: true,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 500,
    });

    const stream = (async function* () {
      for await (const chunk of completion) {
        const token = chunk.choices[0]?.delta?.content;
        if (token) {
          yield token;
        }
      }
    })();

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
    try {
      const client = buildClient();
      const resolvedModel = model || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
      await client.chat.completions.create({
        model: resolvedModel,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
      });
      return { status: 'ok' };
    } catch (error: any) {
      const status = Number(error?.status || error?.statusCode || error?.response?.status || 0);
      if (status === 429) {
        return { status: 'degraded', details: 'Rate limit reached' };
      }
      return { status: 'down', details: error?.message || 'Groq unavailable' };
    }
  }
}
