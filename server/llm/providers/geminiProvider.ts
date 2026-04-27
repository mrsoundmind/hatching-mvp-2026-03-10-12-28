import { GoogleGenAI } from '@google/genai';
import type {
    LLMProvider,
    LLMRequest,
    LLMGenerationResult,
    LLMStreamResult,
    RuntimeMode,
    ProviderHealth,
} from '../providerTypes.js';

const DEFAULT_MODEL = 'gemini-2.5-flash';
// Hard ceiling timeout for Gemini SDK calls — composed with the caller signal via AbortSignal.timeout(30_000).
const HARD_TIMEOUT_MS = 30_000;

function buildClient(): GoogleGenAI {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
        const err = new Error('Gemini API key is missing');
        (err as any).code = 'GEMINI_API_KEY_MISSING';
        throw err;
    }
    return new GoogleGenAI({ apiKey });
}

function resolveGeminiModel(request: LLMRequest): string {
    return request.model || process.env.GEMINI_MODEL || DEFAULT_MODEL;
}

/**
 * Compose caller signal + a hard timeout into a single AbortSignal.
 * Prefers Node 20.3+ `AbortSignal.any`; falls back to manual listener composition.
 */
function composeAbortSignal(userSignal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    if (!userSignal) return timeoutSignal;
    if (typeof (AbortSignal as any).any === 'function') {
        return (AbortSignal as any).any([userSignal, timeoutSignal]);
    }
    // Fallback for Node 20.0–20.2: manual listener composition
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    if (userSignal.aborted) controller.abort();
    else userSignal.addEventListener('abort', onAbort, { once: true });
    if (timeoutSignal.aborted) controller.abort();
    else timeoutSignal.addEventListener('abort', onAbort, { once: true });
    return controller.signal;
}

/** Convert OpenAI-style messages to @google/genai contents format */
function toGeminiContents(messages: LLMRequest['messages']): {
    system: string;
    contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>;
} {
    const systemParts: string[] = [];
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    for (const msg of messages) {
        if (msg.role === 'system') {
            systemParts.push(msg.content);
        } else if (msg.role === 'user') {
            contents.push({ role: 'user', parts: [{ text: msg.content }] });
        } else if (msg.role === 'assistant') {
            contents.push({ role: 'model', parts: [{ text: msg.content }] });
        }
    }

    return {
        system: systemParts.join('\n'),
        contents,
    };
}

export class GeminiProvider implements LLMProvider {
    readonly id = 'gemini' as const;

    async generateChat(request: LLMRequest, mode: RuntimeMode): Promise<LLMGenerationResult> {
        const started = Date.now();
        const ai = buildClient();
        const modelName = resolveGeminiModel(request);
        const { system, contents } = toGeminiContents(request.messages);

        // Compose abort signals: caller signal + 30s hard timeout
        const signal = composeAbortSignal(request.signal, HARD_TIMEOUT_MS);

        const result = await ai.models.generateContent({
            model: modelName,
            contents,
            config: {
                abortSignal: signal,
                systemInstruction: system || undefined,
                temperature: request.temperature ?? 0.7,
                maxOutputTokens: request.maxTokens ?? 500,
            },
        });

        const content = result.text ?? '';
        const usage = result.usageMetadata;

        return {
            content,
            metadata: {
                provider: this.id,
                mode,
                model: modelName,
                latencyMs: Date.now() - started,
                temperature: request.temperature ?? 0.7,
                maxTokens: request.maxTokens ?? 500,
                modelTier: request.modelTier,
                tokenUsage: usage ? {
                    promptTokens: usage.promptTokenCount ?? 0,
                    completionTokens: usage.candidatesTokenCount ?? 0,
                    totalTokens: usage.totalTokenCount ?? 0,
                } : undefined,
            },
        };
    }

    async streamChat(request: LLMRequest, mode: RuntimeMode): Promise<LLMStreamResult> {
        const started = Date.now();
        const ai = buildClient();
        const modelName = resolveGeminiModel(request);
        const { system, contents } = toGeminiContents(request.messages);

        // Compose abort signals: caller signal + 30s hard timeout
        const signal = composeAbortSignal(request.signal, HARD_TIMEOUT_MS);

        const response = await ai.models.generateContentStream({
            model: modelName,
            contents,
            config: {
                abortSignal: signal,
                systemInstruction: system || undefined,
                temperature: request.temperature ?? 0.7,
                maxOutputTokens: request.maxTokens ?? 500,
            },
        });

        const metadata: LLMStreamResult['metadata'] = {
            provider: this.id,
            mode,
            model: modelName,
            latencyMs: Date.now() - started,
            temperature: request.temperature ?? 0.7,
            maxTokens: request.maxTokens ?? 500,
            modelTier: request.modelTier,
        };

        const stream = (async function* () {
            try {
                for await (const chunk of response) {
                    if (signal.aborted) {
                        // Cooperative early termination — exit before yielding next token
                        return;
                    }
                    const token = chunk.text;
                    if (token) {
                        yield token;
                    }
                    // Capture usage from each chunk (last one has final counts)
                    const usage = chunk.usageMetadata;
                    if (usage) {
                        metadata.tokenUsage = {
                            promptTokens: usage.promptTokenCount ?? 0,
                            completionTokens: usage.candidatesTokenCount ?? 0,
                            totalTokens: usage.totalTokenCount ?? 0,
                        };
                    }
                }
            } catch (err) {
                const name = (err as Error).name;
                // RE-THROW AbortError and TimeoutError so callers (openaiService → chat.ts) can branch on them.
                // Previously this catch swallowed all errors silently — that was the BUG-05 root cause.
                if (name === 'AbortError' || name === 'TimeoutError') {
                    throw err;
                }
                console.error('[GeminiProvider] Stream iteration error:', (err as Error).message);
                throw err;
            }
        })();

        return { stream, metadata };
    }

    async healthCheck(_model?: string): Promise<ProviderHealth> {
        try {
            const ai = buildClient();
            const modelName = resolveGeminiModel({ messages: [] });
            await ai.models.generateContent({
                model: modelName,
                contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
            });
            return { status: 'ok' };
        } catch (error: any) {
            if (error?.code === 'GEMINI_API_KEY_MISSING' || error?.message?.includes('API key')) {
                return { status: 'down', details: 'GEMINI_API_KEY is missing or invalid' };
            }
            return { status: 'down', details: error?.message || 'Gemini unavailable' };
        }
    }
}
