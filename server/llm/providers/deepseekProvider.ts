import { OpenAI } from 'openai';
import type {
  LLMProvider,
  LLMRequest,
  LLMGenerationResult,
  LLMStreamResult,
  RuntimeMode,
  ProviderHealth,
  ModelTier,
} from '../providerTypes.js';

function buildClient(): OpenAI {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    const err = new Error('DeepSeek API key is missing');
    (err as any).code = 'DEEPSEEK_API_KEY_MISSING';
    throw err;
  }
  return new OpenAI({
    apiKey,
    baseURL: process.env.DEEPSEEK_BASE_URL?.trim() || 'https://api.deepseek.com/v1',
  });
}

function resolveDeepSeekModel(request: LLMRequest): string {
  if (request.model) return request.model;
  if (request.modelTier === 'premium') {
    return process.env.DEEPSEEK_PRO_MODEL || 'deepseek-v4-pro';
  }
  return process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';
}

export class DeepSeekProvider implements LLMProvider {
  readonly id = 'deepseek' as const;

  async generateChat(request: LLMRequest, mode: RuntimeMode): Promise<LLMGenerationResult> {
    const started = Date.now();
    const client = buildClient();
    const model = resolveDeepSeekModel(request);
    const completion = await client.chat.completions.create({
      model,
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 1200,
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
        maxTokens: request.maxTokens ?? 1200,
        modelTier: request.modelTier,
        tokenUsage: completion.usage ? {
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens,
        } : undefined,
      },
    };
  }

  async streamChat(request: LLMRequest, mode: RuntimeMode): Promise<LLMStreamResult> {
    const started = Date.now();
    const client = buildClient();
    const model = resolveDeepSeekModel(request);

    const completion = await client.chat.completions.create({
      model,
      messages: request.messages,
      stream: true,
      stream_options: { include_usage: true },
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 1200,
    });

    const metadata: LLMStreamResult['metadata'] = {
      provider: this.id,
      mode,
      model,
      latencyMs: Date.now() - started,
      temperature: request.temperature ?? 0.7,
      maxTokens: request.maxTokens ?? 1200,
      modelTier: request.modelTier,
    };

    const stream = (async function* () {
      for await (const chunk of completion) {
        const token = chunk.choices[0]?.delta?.content;
        if (token) {
          yield token;
        }
        if (chunk.usage) {
          metadata.tokenUsage = {
            promptTokens: chunk.usage.prompt_tokens,
            completionTokens: chunk.usage.completion_tokens,
            totalTokens: chunk.usage.total_tokens,
          };
        }
      }
    })();

    return { stream, metadata };
  }

  async healthCheck(model?: string): Promise<ProviderHealth> {
    try {
      const client = buildClient();
      const resolvedModel = model || process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';
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
      return { status: 'down', details: error?.message || 'DeepSeek unavailable' };
    }
  }
}
