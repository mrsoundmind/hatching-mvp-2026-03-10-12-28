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
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    const err = new Error('OpenAI API key is missing');
    (err as any).code = 'OPENAI_API_KEY_MISSING';
    throw err;
  }
  return new OpenAI({ apiKey });
}

function resolveOpenAIModel(request: LLMRequest): string {
  return request.model || process.env.OPENAI_MODEL || 'gpt-4o-mini';
}

export class OpenAIProvider implements LLMProvider {
  readonly id = 'openai' as const;

  async generateChat(request: LLMRequest, mode: RuntimeMode): Promise<LLMGenerationResult> {
    const started = Date.now();
    const client = buildClient();
    const model = resolveOpenAIModel(request);
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
    const model = resolveOpenAIModel(request);

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
      const resolvedModel = model || process.env.OPENAI_MODEL || 'gpt-4o-mini';
      await client.chat.completions.create({
        model: resolvedModel,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
      });
      return { status: 'ok' };
    } catch (error: any) {
      const status = Number(error?.status || error?.statusCode || error?.response?.status || 0);
      if (status === 429) {
        return { status: 'degraded', details: 'Rate limit or quota reached' };
      }
      return { status: 'down', details: error?.message || 'OpenAI unavailable' };
    }
  }
}
