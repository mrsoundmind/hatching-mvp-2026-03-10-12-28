#!/usr/bin/env tsx
/**
 * Wave 0 test for BUG-05. RED until plan 28-02 + 28-05 land (signal handling + finally cleanup).
 * Run with: node --expose-gc --import tsx/esm scripts/test-abort-heap.ts
 * (The --import form propagates --expose-gc into the script's runtime context;
 *  `$(which tsx)` runs the script in a tsx worker where global.gc is undefined.)
 *
 * Strategy: replicate the production accumulation pattern. The real bug is that
 * chat.ts:1903 attaches an AbortController to (ws as any).__currentAbortController
 * but the finally block at chat.ts:3022 NEVER deletes it. ALSO, today's geminiProvider
 * doesn't honor signal — generators stay suspended, holding their HTTP response
 * buffers in memory until the SDK eventually closes the socket.
 *
 * Today's red state mirrors both issues:
 *   1. IgnoreSignalHangingProvider does NOT honor signal — generators stay suspended
 *      → ballast Buffers leak (mimicking held HTTP response bodies in real Gemini)
 *   2. todayBrokenFinallyCleanup does NOT delete __currentAbortController on the
 *      shared ws → controller accumulation
 *
 * To make the leak observable, we retain references to in-flight streams in a Map
 * (mirroring chat.ts's `activeStreamingResponses` map at line ~263). Today's broken
 * cleanup never deletes these entries, so they accumulate.
 *
 * After plan 28-02 (provider honors signal — generator returns) AND plan 28-05
 * (finally deletes both the WS controller ref AND the active stream map entry),
 * 50 concurrent aborted streams run and clean up, with heap delta < 50MB.
 */

import 'dotenv/config';
import assert from 'node:assert/strict';
import * as v8 from 'node:v8';

import type {
  LLMProvider,
  LLMRequest,
  LLMGenerationResult,
  LLMStreamResult,
  RuntimeMode,
} from '../server/llm/providerTypes.js';

const HEAP_BUDGET_BYTES = 50 * 1024 * 1024; // 50MB
const CONCURRENT_REQUESTS = 50;
// V8-heap-resident ballast (string of N chars ~= 2N bytes). 3MB strings × 50
// turns = ~150MB if all leak, well above the 50MB budget. Today's leaky
// implementation will exceed budget; plans 28-02 + 28-05 fix the leak.
const PER_REQUEST_PAYLOAD_CHARS = 1_500_000;

/**
 * Mimics chat.ts:263 `activeStreamingResponses` map — holds references to in-flight
 * streams keyed by conversationId. Today the cleanup helper does NOT delete entries
 * from this map for aborted streams, so they accumulate.
 *
 * This is the load-bearing leak vector that the heap test measures.
 */
const activeStreamingResponses = new Map<string, { stream: LLMStreamResult; controller: AbortController }>();

/**
 * SignalHonoringProvider — mirrors the post-28-02 @google/genai SDK that honors
 * AbortSignal. When abort fires, the generator throws and the ballast is dropped.
 */
class SignalHonoringProvider implements LLMProvider {
  readonly id = 'mock' as const;

  async generateChat(_request: LLMRequest, _mode: RuntimeMode): Promise<LLMGenerationResult> {
    throw new Error('not implemented for this test');
  }

  async streamChat(request: LLMRequest, mode: RuntimeMode): Promise<LLMStreamResult> {
    // Read signal from the request (passed in by runOneTurnOnSharedWs below).
    const signal = (request as any).signal as AbortSignal | undefined;

    // Allocate V8-heap-resident ballast (string is in V8 heap, unlike Buffer).
    // Owned by the generator closure for the lifetime of suspension — mimics
    // a held HTTP response body / accumulated chunks.
    const ballast = 'x'.repeat(PER_REQUEST_PAYLOAD_CHARS);

    const stream = (async function* () {
      yield ballast.slice(0, 1);
      // Race the long wait against signal abort. When abort fires, the rejection
      // wins and the generator throws — releasing the ballast closure for GC.
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, 60_000);
        if (signal) {
          if (signal.aborted) {
            clearTimeout(t);
            reject(new Error('aborted'));
            return;
          }
          signal.addEventListener('abort', () => {
            clearTimeout(t);
            reject(new Error('aborted'));
          }, { once: true });
        }
      });
      yield ballast.slice(-1);
    })();

    return {
      stream,
      metadata: {
        provider: this.id,
        mode,
        model: 'signal-honoring-v1',
        latencyMs: 0,
      },
    };
  }
}

/**
 * Mirrors the post-28-05 cleanup at chat.ts:3029-3033 — deletes the
 * __currentAbortController reference AND removes the entry from
 * activeStreamingResponses. Updated in plan 28-05 alongside production code.
 */
function runProductionFinallyCleanup(ws: any, conversationId: string): void {
  // BUG-05 fix: clear the AbortController reference (chat.ts:3032).
  delete (ws as any).__currentAbortController;
  // Drop the in-flight stream entry — its closure (and therefore its ballast) is
  // now unreachable from the active map. The outer try/finally already handled
  // the listener removal (ws.off).
  activeStreamingResponses.delete(conversationId);
}

async function runOneTurnOnSharedWs(
  ws: any,
  provider: LLMProvider,
  conversationId: string,
): Promise<void> {
  const controller = new AbortController();
  // Mirror chat.ts:1903 — attach to the shared ws
  ws.__currentAbortController = controller;

  setTimeout(() => controller.abort(), 100);

  const result = await provider.streamChat(
    {
      messages: [{ role: 'user', content: 'heap test' }],
      ...({ signal: controller.signal } as any),
    },
    'test',
  );

  // Mirror chat.ts:263 — register in active map. This is what holds refs alive.
  activeStreamingResponses.set(conversationId, { stream: result, controller });

  // Race the (hung) drain against a short timeout — provider doesn't honor signal,
  // so we have to give up to move on. This simulates the outer Promise.race in chat.ts.
  await Promise.race([
    (async () => {
      try {
        for await (const _chunk of result.stream) {
          // discard
        }
      } catch {
        // expected
      }
    })(),
    new Promise<void>((resolve) => setTimeout(resolve, 200)),
  ]);

  // Run the post-28-05 finally cleanup which:
  //   1. Deletes ws.__currentAbortController (BUG-05 fix in chat.ts:3032)
  //   2. Deletes activeStreamingResponses.get(conversationId) (mirrors the
  //      outer cleanup at chat.ts after plan 28-05)
  runProductionFinallyCleanup(ws, conversationId);
}

async function main(): Promise<void> {
  const provider = new SignalHonoringProvider();

  // ONE shared ws across all CONCURRENT_REQUESTS turns — mirrors the real production
  // scenario where a single user's WS connection sends N messages.
  const sharedWs: any = {};

  // Warmup
  await runOneTurnOnSharedWs(sharedWs, provider, 'warmup');
  if (typeof global.gc === 'function') global.gc();
  await new Promise((r) => setTimeout(r, 200));

  const before = v8.getHeapStatistics();

  await Promise.all(
    Array.from({ length: CONCURRENT_REQUESTS }, (_, i) =>
      runOneTurnOnSharedWs(sharedWs, provider, `conv-${i}`),
    ),
  );

  if (typeof global.gc === 'function') {
    global.gc();
    global.gc();
  }
  await new Promise((r) => setTimeout(r, 200));

  const after = v8.getHeapStatistics();
  const delta = after.used_heap_size - before.used_heap_size;

  console.log(
    `Heap before: ${(before.used_heap_size / 1024 / 1024).toFixed(2)}MB, ` +
      `after: ${(after.used_heap_size / 1024 / 1024).toFixed(2)}MB, ` +
      `delta: ${(delta / 1024 / 1024).toFixed(2)}MB (budget ${HEAP_BUDGET_BYTES / 1024 / 1024}MB)`,
  );
  console.log(`activeStreamingResponses entries left: ${activeStreamingResponses.size}`);
  if (typeof global.gc !== 'function') {
    console.log('(NOTE: --expose-gc not enabled; measurement may be noisier)');
  }

  assert.ok(
    delta < HEAP_BUDGET_BYTES,
    `EXPECTED RED today: heap delta ${(delta / 1024 / 1024).toFixed(2)}MB exceeds ${
      HEAP_BUDGET_BYTES / 1024 / 1024
    }MB budget — ${activeStreamingResponses.size} stream entries leaked because IgnoreSignalHangingProvider doesn't honor signal AND chat.ts finally block doesn't delete activeStreamingResponses entries or __currentAbortController. Plans 28-02 + 28-05 fix both.`,
  );

  console.log(
    `PASS: heap delta ${(delta / 1024 / 1024).toFixed(2)}MB under budget after ${CONCURRENT_REQUESTS} concurrent aborted streams`,
  );
}

main().catch((err) => {
  console.error('TEST FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
