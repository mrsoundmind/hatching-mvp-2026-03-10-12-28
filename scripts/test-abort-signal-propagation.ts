#!/usr/bin/env tsx
/**
 * Wave 0 test for BUG-02. RED until plan 28-02 lands.
 * Verifies LLMRequest.signal flows from caller → providerResolver → provider.streamChat.
 *
 * Today (before plan 28-02-01 lands): LLMRequest has NO `signal` field.
 * The script will fail because `capturedSignal === undefined` after invocation.
 * It turns green only after:
 *   - 28-02-01 adds `signal?: AbortSignal` to LLMRequest
 *   - 28-02-03 wires `signal: abortSignal` through openaiService.ts
 */

import 'dotenv/config';
import assert from 'node:assert/strict';

// Force test mode + mock provider BEFORE importing the resolver so it
// resolves the `mock` registry entry instead of attempting Gemini/OpenAI.
process.env.LLM_MODE = 'test';
process.env.TEST_LLM_PROVIDER = 'mock';

import type {
  LLMProvider,
  LLMRequest,
  LLMGenerationResult,
  LLMStreamResult,
  RuntimeMode,
} from '../server/llm/providerTypes.js';
import { streamChatWithRuntimeFallback } from '../server/llm/providerResolver.js';

// Module-level spy state — populated by SpyProvider.streamChat
let capturedSignal: AbortSignal | undefined = undefined;
let capturedRequest: LLMRequest | undefined = undefined;
let spyStreamCalled = false;

class SpyProvider implements LLMProvider {
  readonly id = 'mock' as const;

  async generateChat(request: LLMRequest, mode: RuntimeMode): Promise<LLMGenerationResult> {
    capturedRequest = request;
    capturedSignal = (request as any).signal;
    return {
      content: 'spy generated',
      metadata: {
        provider: this.id,
        mode,
        model: 'spy-v1',
        latencyMs: 0,
      },
    };
  }

  async streamChat(request: LLMRequest, mode: RuntimeMode): Promise<LLMStreamResult> {
    spyStreamCalled = true;
    capturedRequest = request;
    capturedSignal = (request as any).signal;
    const stream = (async function* () {
      yield 'spy';
      yield ' chunk';
    })();
    return {
      stream,
      metadata: {
        provider: this.id,
        mode,
        model: 'spy-v1',
        latencyMs: 0,
      },
    };
  }
}

async function main(): Promise<void> {
  // Inject spy into the provider registry. We import the resolver module then
  // mutate its providerRegistry export.
  const resolverModule: any = await import('../server/llm/providerResolver.js');
  const spyProvider = new SpyProvider();
  if (resolverModule.providerRegistry) {
    resolverModule.providerRegistry.mock = spyProvider;
  } else {
    throw new Error(
      'providerRegistry is not exported from providerResolver.ts — cannot inject spy provider',
    );
  }

  const controller = new AbortController();

  const llmRequest: LLMRequest = {
    messages: [{ role: 'user', content: 'test signal propagation' }],
    model: 'mock-v1',
    temperature: 0,
    // signal will be added by plan 28-02 — this cast bypasses TS today
    ...({ signal: controller.signal } as any),
  };

  // Invoke streamChatWithRuntimeFallback (the production caller path)
  let result: LLMStreamResult;
  try {
    result = await streamChatWithRuntimeFallback(llmRequest);
  } catch (err) {
    console.error('streamChatWithRuntimeFallback threw:', err);
    throw err;
  }

  // Drain stream so the provider returns
  for await (const _chunk of result.stream) {
    // no-op
  }

  // Sanity: spy was actually invoked through the resolver
  assert.ok(
    spyStreamCalled,
    'SpyProvider.streamChat was never called — provider injection failed',
  );

  // Red-state assertion: today, LLMRequest has no `signal` field, so this is undefined.
  assert.ok(
    capturedSignal !== undefined,
    'EXPECTED RED: capturedSignal is undefined — LLMRequest.signal is not yet propagated. Will turn green after plan 28-02.',
  );

  assert.ok(
    capturedSignal instanceof AbortSignal,
    `capturedSignal must be an AbortSignal instance, got ${typeof capturedSignal}`,
  );

  // Verify the signal aborts when the caller's controller fires.
  const beforeAbort = capturedSignal!.aborted;
  assert.strictEqual(
    beforeAbort,
    false,
    'Signal should not be aborted before controller.abort()',
  );

  setTimeout(() => controller.abort(), 100);
  await new Promise((resolve) => setTimeout(resolve, 200));

  assert.strictEqual(
    capturedSignal!.aborted,
    true,
    'capturedSignal.aborted should be true after controller.abort() — signal is not the same instance',
  );

  console.log('PASS: LLMRequest.signal flows through providerResolver to provider.streamChat');
}

main().catch((err) => {
  console.error('TEST FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
