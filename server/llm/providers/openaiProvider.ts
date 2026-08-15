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

// Reasoning models (o-series, gpt-5) reject the classic `max_tokens` + custom `temperature`
// params: they require `max_completion_tokens` and only accept the default temperature. They
// also spend part of the budget on hidden reasoning tokens BEFORE emitting visible content,
// so a small cap returns an empty string. This detector lets the escape hatch actually drive
// modern models (previously silently broken for gpt-5/o3). Additive + guarded — classic models
// keep their exact prior behavior.
const REASONING_MODEL_RE = /^(o1|o3|o4|gpt-5)/i;
function isReasoningModel(model: string): boolean {
  return REASONING_MODEL_RE.test(model);
}

// Returns the token/temperature params in the shape the given model accepts.
type TokenTempParams = { temperature?: number; max_tokens?: number; max_completion_tokens?: number };
function buildTokenTempParams(request: LLMRequest, model: string): TokenTempParams {
  if (isReasoningModel(model)) {
    // Generous floor so reasoning tokens don't starve the visible answer.
    return { max_completion_tokens: Math.max(request.maxTokens ?? 500, 4000) };
  }
  return { temperature: request.temperature ?? 0.7, max_tokens: request.maxTokens ?? 500 };
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
      ...buildTokenTempParams(request, model),
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
    const model = resolveOpenAIModel(request);

    const completion = await client.chat.completions.create({
      model,
      messages: request.messages,
      stream: true,
      stream_options: { include_usage: true },
      ...buildTokenTempParams(request, model),
    });

    const metadata: LLMStreamResult['metadata'] = {
      provider: this.id,
      mode,
      model,
      latencyMs: Date.now() - started,
      temperature: request.temperature ?? 0.7,
      maxTokens: request.maxTokens ?? 500,
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
      const resolvedModel = model || process.env.OPENAI_MODEL || 'gpt-4o-mini';
      await client.chat.completions.create({
        model: resolvedModel,
        messages: [{ role: 'user', content: 'ping' }],
        ...(isReasoningModel(resolvedModel) ? { max_completion_tokens: 16 } : { max_tokens: 1 }),
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
