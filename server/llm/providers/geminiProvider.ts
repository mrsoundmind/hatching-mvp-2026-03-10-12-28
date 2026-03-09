import { GoogleGenerativeAI } from '@google/generative-ai';
import type {
    LLMProvider,
    LLMRequest,
    LLMGenerationResult,
    LLMStreamResult,
    RuntimeMode,
    ProviderHealth,
} from '../providerTypes.js';

const DEFAULT_MODEL = 'gemini-1.5-flash';

function buildClient(): GoogleGenerativeAI {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
        const err = new Error('Gemini API key is missing');
        (err as any).code = 'GEMINI_API_KEY_MISSING';
        throw err;
    }
    return new GoogleGenerativeAI(apiKey);
}

function resolveGeminiModel(request: LLMRequest): string {
    return request.model || process.env.GEMINI_MODEL || DEFAULT_MODEL;
}

/** Convert OpenAI-style messages to Gemini format */
function toGeminiHistory(messages: LLMRequest['messages']): {
    system: string;
    history: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>;
    lastUserMessage: string;
} {
    const systemParts: string[] = [];
    const history: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    for (const msg of messages) {
        if (msg.role === 'system') {
            systemParts.push(msg.content);
        } else if (msg.role === 'user') {
            history.push({ role: 'user', parts: [{ text: msg.content }] });
        } else if (msg.role === 'assistant') {
            history.push({ role: 'model', parts: [{ text: msg.content }] });
        }
    }

    // The last user message is sent as the current prompt;
    // everything before it forms the history.
    const lastUserIdx = [...history].reverse().findIndex((h) => h.role === 'user');
    const lastUserMessage =
        lastUserIdx === -1 ? '' : history[history.length - 1 - lastUserIdx].parts[0].text;

    const priorHistory = lastUserIdx === -1 ? history : history.slice(0, history.length - 1 - lastUserIdx);

    return {
        system: systemParts.join('\n'),
        history: priorHistory,
        lastUserMessage,
    };
}

export class GeminiProvider implements LLMProvider {
    readonly id = 'gemini' as const;

    async generateChat(request: LLMRequest, mode: RuntimeMode): Promise<LLMGenerationResult> {
        const started = Date.now();
        const genAI = buildClient();
        const modelName = resolveGeminiModel(request);
        const { system, history, lastUserMessage } = toGeminiHistory(request.messages);

        const model = genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: system || undefined,
            generationConfig: {
                temperature: request.temperature ?? 0.7,
                maxOutputTokens: request.maxTokens ?? 500,
            },
        });

        const chat = model.startChat({ history });
        const result = await chat.sendMessage(lastUserMessage);
        const content = result.response.text();

        return {
            content,
            metadata: {
                provider: this.id,
                mode,
                model: modelName,
                latencyMs: Date.now() - started,
                temperature: request.temperature ?? 0.7,
                maxTokens: request.maxTokens ?? 500,
            },
        };
    }

    async streamChat(request: LLMRequest, mode: RuntimeMode): Promise<LLMStreamResult> {
        const started = Date.now();
        const genAI = buildClient();
        const modelName = resolveGeminiModel(request);
        const { system, history, lastUserMessage } = toGeminiHistory(request.messages);

        const model = genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: system || undefined,
            generationConfig: {
                temperature: request.temperature ?? 0.7,
                maxOutputTokens: request.maxTokens ?? 500,
            },
        });

        const chat = model.startChat({ history });
        const result = await chat.sendMessageStream(lastUserMessage);

        const stream = (async function* () {
            for await (const chunk of result.stream) {
                const token = chunk.text();
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
                model: modelName,
                latencyMs: Date.now() - started,
                temperature: request.temperature ?? 0.7,
                maxTokens: request.maxTokens ?? 500,
            },
        };
    }

    async healthCheck(_model?: string): Promise<ProviderHealth> {
        try {
            const genAI = buildClient();
            const modelName = resolveGeminiModel({ messages: [] });
            const model = genAI.getGenerativeModel({ model: modelName });
            await model.generateContent('ping');
            return { status: 'ok' };
        } catch (error: any) {
            if (error?.code === 'GEMINI_API_KEY_MISSING' || error?.message?.includes('API key')) {
                return { status: 'down', details: 'GEMINI_API_KEY is missing or invalid' };
            }
            return { status: 'down', details: error?.message || 'Gemini unavailable' };
        }
    }
}
