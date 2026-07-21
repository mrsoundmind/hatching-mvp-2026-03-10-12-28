// Phase 38 (ALWY-02) — DEV-only "capture" LLM provider for Playwright tests.
//
// This provider intercepts the LLM call at the wire boundary, records the FULL
// assembled prompt (system + user) onto a module-level in-memory buffer, and
// returns a canned successful streaming result. Tests then read the buffer via
// the DEV-only GET /api/dev/captured-prompts endpoint and assert on the
// captured PROMPT — not on LLM output — which is:
//   1. Deterministic: same canned response every time
//   2. Non-vacuous: the FULL prompt-assembly pipeline (chat.ts → openaiService.ts
//      → promptTemplate.ts) runs end-to-end and the captured prompt reflects
//      every conditional branch (autonomyLevel, isMaya, isFirstMsg, etc.)
//
// Activation: LLM_MODE=test TEST_LLM_PROVIDER=capture in the env.
// In any other environment this provider is unreachable.
//
// Security: the buffer is module-scope in-memory only — does NOT persist to DB
// or filesystem, evaporates on server restart. The DEV endpoint that exposes
// it is double-guarded (NODE_ENV !== 'production') so production calls 404.

import type {
  LLMProvider,
  LLMRequest,
  LLMGenerationResult,
  LLMStreamResult,
  RuntimeMode,
  ProviderHealth,
} from '../providerTypes.js';

export interface CapturedPrompt {
  systemPrompt: string;
  userMessage: string;
  fullMessages: Array<{ role: string; content: string }>;
  timestamp: number;
  model?: string;
}

// Module-scope buffer. Bounded at 100 entries to avoid unbounded memory growth
// during long test runs; oldest entries shift out when capacity is reached.
const MAX_BUFFER = 100;
const capturedBuffer: CapturedPrompt[] = [];

export function getCapturedPrompts(): CapturedPrompt[] {
  return [...capturedBuffer];
}

export function clearCapturedPrompts(): void {
  capturedBuffer.length = 0;
}

function recordPrompt(request: LLMRequest): void {
  // Extract the first system message and the first user message — the
  // assertions in tests/e2e/phase-38-never-stop-never-ask.spec.ts target
  // the assembled systemPrompt (which the directive + clarification lines
  // live inside).
  const systemMsg = request.messages.find((m) => m.role === 'system');
  const userMsg = request.messages.find((m) => m.role === 'user');
  const entry: CapturedPrompt = {
    systemPrompt: systemMsg?.content ?? '',
    userMessage: userMsg?.content ?? '',
    fullMessages: request.messages.map((m) => ({ role: m.role, content: m.content })),
    timestamp: Date.now(),
    model: request.model,
  };
  capturedBuffer.push(entry);
  while (capturedBuffer.length > MAX_BUFFER) capturedBuffer.shift();
}

// Canned response — short, prose-quality, no markdown headers, no bullet lists
// (honors the staticPrefix rules even though no LLM ran). Tests assert on the
// PROMPT, not this output, so the content is irrelevant beyond being non-empty.
const CANNED_RESPONSE =
  "Capture provider acknowledging the request — going ahead with the work and will report when done.";

export class CaptureProvider implements LLMProvider {
  readonly id = 'capture' as const;

  async generateChat(request: LLMRequest, mode: RuntimeMode): Promise<LLMGenerationResult> {
    const started = Date.now();
    recordPrompt(request);
    return {
      content: CANNED_RESPONSE,
      metadata: {
        provider: this.id,
        mode,
        model: request.model || 'capture-v1',
        latencyMs: Date.now() - started,
        temperature: request.temperature ?? 0,
        maxTokens: request.maxTokens ?? 500,
      },
    };
  }

  async streamChat(request: LLMRequest, mode: RuntimeMode): Promise<LLMStreamResult> {
    const started = Date.now();
    recordPrompt(request);
    const chunks = CANNED_RESPONSE.split(/(\s+)/).filter(Boolean);
    const stream = (async function* () {
      for (const chunk of chunks) {
        yield chunk;
      }
    })();
    return {
      stream,
      metadata: {
        provider: this.id,
        mode,
        model: request.model || 'capture-v1',
        latencyMs: Date.now() - started,
        temperature: request.temperature ?? 0,
        maxTokens: request.maxTokens ?? 500,
      },
    };
  }

  async healthCheck(): Promise<ProviderHealth> {
    return { status: 'ok', details: 'Capture provider is module-scope deterministic stub' };
  }
}
