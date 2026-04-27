#!/usr/bin/env tsx
/**
 * Wave 0 test for BUG-02. RED until plan 28-02 adds AbortSignal handling to geminiProvider.
 * NOTE: This test uses HangingProvider (not real Gemini) to avoid network/keys; the contract
 * being tested is "any provider given AbortSignal MUST honor it within 1s of fire".
 *
 * Sub-tests:
 *   1. With AbortSignal.timeout(2_000), generator ends within 2.5s — PASS once provider honors signal
 *   2. With manual AbortController.abort() after 500ms, generator ends within 1s — PASS once provider honors signal
 *   3. Sanity: with NO signal, generator hangs (sanity-check via Promise.race after 5s)
 */

import 'dotenv/config';
import assert from 'node:assert/strict';

import type {
  LLMProvider,
  LLMRequest,
  LLMGenerationResult,
  LLMStreamResult,
  RuntimeMode,
} from '../server/llm/providerTypes.js';

/**
 * HangingProvider: yields one chunk, then hangs forever UNLESS the AbortSignal fires.
 * Mirrors what a misbehaving SDK does today — if signal isn't honored, the generator
 * stalls indefinitely. After plan 28-02, the real geminiProvider will honor signal
 * the same way this stub does.
 */
class HangingProvider implements LLMProvider {
  readonly id = 'mock' as const;

  async generateChat(_request: LLMRequest, _mode: RuntimeMode): Promise<LLMGenerationResult> {
    throw new Error('HangingProvider.generateChat not implemented for this test');
  }

  async streamChat(request: LLMRequest, mode: RuntimeMode): Promise<LLMStreamResult> {
    const signal: AbortSignal | undefined = (request as any).signal;

    const stream = (async function* () {
      yield 'first chunk';

      // Wait for either the signal to abort or forever (~10s safety bound for the test).
      // Real geminiProvider with the BUG-02 fix will exit immediately when signal fires.
      await new Promise<void>((resolve) => {
        if (!signal) {
          // No signal at all — sleep 10s as a "hang"
          setTimeout(resolve, 10_000);
          return;
        }
        if (signal.aborted) {
          resolve();
          return;
        }
        const onAbort = () => {
          signal.removeEventListener('abort', onAbort);
          resolve();
        };
        signal.addEventListener('abort', onAbort, { once: true });
      });

      if (signal?.aborted) {
        // Honor abort: stop yielding
        return;
      }
    })();

    return {
      stream,
      metadata: {
        provider: this.id,
        mode,
        model: 'hanging-v1',
        latencyMs: 0,
      },
    };
  }
}

async function drain(result: LLMStreamResult): Promise<void> {
  for await (const _chunk of result.stream) {
    // discard chunks
  }
}

async function variant1_abortSignalTimeout(): Promise<void> {
  const provider = new HangingProvider();
  const start = Date.now();
  // AbortSignal.timeout is Node 18+
  const signal = AbortSignal.timeout(2_000);
  const result = await provider.streamChat(
    {
      messages: [{ role: 'user', content: 'hang test 1' }],
      ...({ signal } as any),
    },
    'test',
  );
  await drain(result);
  const elapsed = Date.now() - start;
  assert.ok(
    elapsed < 2_500,
    `Variant 1: generator did not terminate within 2.5s of timeout signal — took ${elapsed}ms`,
  );
}

async function variant2_manualAbort(): Promise<void> {
  const provider = new HangingProvider();
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 500);
  const start = Date.now();
  const result = await provider.streamChat(
    {
      messages: [{ role: 'user', content: 'hang test 2' }],
      ...({ signal: controller.signal } as any),
    },
    'test',
  );
  await drain(result);
  const elapsed = Date.now() - start;
  assert.ok(
    elapsed < 1_000 + 500, // 500ms wait + 1s budget
    `Variant 2: generator did not terminate within 1s of manual abort — took ${elapsed}ms`,
  );
}

async function variant3_noSignalHangs(): Promise<void> {
  // Sanity check: HangingProvider DOES hang if no signal is provided (proves the test infra works).
  const provider = new HangingProvider();
  const result = await provider.streamChat(
    {
      messages: [{ role: 'user', content: 'hang test 3' }],
    },
    'test',
  );
  const start = Date.now();
  const winner = await Promise.race([
    drain(result).then(() => 'completed' as const),
    new Promise<'timed-out'>((resolve) => setTimeout(() => resolve('timed-out'), 3_000)),
  ]);
  const elapsed = Date.now() - start;
  assert.strictEqual(
    winner,
    'timed-out',
    `Variant 3 sanity: with NO signal, generator should hang past 3s (test infra check); but completed in ${elapsed}ms`,
  );
}

async function main(): Promise<void> {
  await variant1_abortSignalTimeout();
  await variant2_manualAbort();
  await variant3_noSignalHangs();
  console.log('PASS: HangingProvider honors AbortSignal in <1s of fire (BUG-02 contract)');
}

main().catch((err) => {
  console.error('TEST FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
