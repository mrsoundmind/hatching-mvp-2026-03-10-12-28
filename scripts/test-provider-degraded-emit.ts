#!/usr/bin/env tsx
/**
 * Phase 35-02 integration test for PROVIDER_DEGRADED / PROVIDER_RECOVERED
 * broadcast wiring across providerHealthState ↔ providerResolver ↔ broadcaster.
 *
 * Run: npx tsx scripts/test-provider-degraded-emit.ts
 *
 * Validates the 5 emit-semantics rules:
 *   1. 3 chain exhaustions emit PROVIDER_DEGRADED exactly once
 *   2. Next success after degraded emits PROVIDER_RECOVERED exactly once
 *   3. 429 → next-provider-success emits ZERO events (D-13 contract)
 *   4. Repeated chain failures while already degraded do NOT re-emit
 *   5. forceRecoveryBroadcast (via registerRecoveryHook) fires PROVIDER_RECOVERED
 *      end-to-end through the dev-injection path 35-05 will consume
 *
 * Determinism: re-running this script in succession produces identical output.
 * State isolation is enforced via __resetForTests() between cases — which also
 * clears the recoveryHook per the 35-01 test-isolation contract.
 */

import assert from 'node:assert/strict';

// NODE_ENV must be non-production for __resetForTests / forceRecoveryBroadcast
// / registerRecoveryHook to behave non-trivially.
process.env.NODE_ENV = 'development';
// Force test mode so providerResolver's buildProviderOrder lands on a deterministic
// chain we can drive with mocked providers.
process.env.LLM_MODE = 'test';
process.env.TEST_LLM_PROVIDER = 'deepseek';

import {
  recordFailure,
  registerRecoveryHook,
  forceRecoveryBroadcast,
  __resetForTests,
  getDegradedState,
} from '../server/llm/providerHealthState.js';
import {
  registerHealthBroadcaster,
  providerRegistry,
  streamChatWithRuntimeFallback,
} from '../server/llm/providerResolver.js';
import type {
  LLMProvider,
  LLMRequest,
  LLMStreamResult,
  LLMGenerationResult,
  ProviderId,
} from '../server/llm/providerTypes.js';

type EmitEvent = { type: string; reason?: string };

/**
 * Reset module state and install a fresh broadcaster spy. Returns the spy's
 * event-collection array so the test can assert what was broadcast.
 */
function freshSlate(): EmitEvent[] {
  process.env.NODE_ENV = 'development';
  __resetForTests();
  const events: EmitEvent[] = [];
  registerHealthBroadcaster((data) => {
    events.push(data as EmitEvent);
  });
  return events;
}

/**
 * Build a mock provider that conforms to LLMProvider. Behaviour is driven by the
 * `mode` argument: 'fail' always throws (with optional status code), 'succeed'
 * returns a valid generate/stream result.
 */
function makeProvider(
  id: ProviderId,
  mode: 'fail' | 'succeed',
  opts: { status?: number; message?: string } = {},
): LLMProvider {
  const throwErr = (): never => {
    const err: any = new Error(opts.message ?? `${id} mock failure`);
    if (opts.status !== undefined) err.status = opts.status;
    throw err;
  };

  return {
    id,
    async generateChat(_req: LLMRequest): Promise<LLMGenerationResult> {
      if (mode === 'fail') throwErr();
      return {
        content: 'ok',
        metadata: {
          provider: id,
          mode: 'test',
          model: 'mock',
          latencyMs: 1,
        },
      };
    },
    async streamChat(_req: LLMRequest): Promise<LLMStreamResult> {
      if (mode === 'fail') throwErr();
      async function* gen(): AsyncGenerator<string, void, unknown> {
        yield 'ok';
      }
      return {
        stream: gen(),
        metadata: {
          provider: id,
          mode: 'test',
          model: 'mock',
          latencyMs: 1,
        },
      };
    },
  };
}

/** Save + restore providerRegistry entries around a test body. */
async function withProviderOverrides(
  overrides: Partial<Record<ProviderId, LLMProvider>>,
  body: () => Promise<void>,
): Promise<void> {
  const originals: Partial<Record<ProviderId, LLMProvider>> = {};
  for (const id of Object.keys(overrides) as ProviderId[]) {
    originals[id] = providerRegistry[id];
    providerRegistry[id] = overrides[id]!;
  }
  try {
    await body();
  } finally {
    for (const id of Object.keys(originals) as ProviderId[]) {
      providerRegistry[id] = originals[id]!;
    }
  }
}

/**
 * Drive a single full-chain exhaustion through streamChatWithRuntimeFallback.
 * In test mode with TEST_LLM_PROVIDER=deepseek, buildProviderOrder returns
 * ['deepseek', 'ollama-test', 'mock'] — all three must fail for the resolver
 * to throw and trigger recordFailure() at the post-loop throw site.
 */
async function forceChainExhaustionViaResolver(): Promise<void> {
  await withProviderOverrides(
    {
      deepseek: makeProvider('deepseek', 'fail'),
      'ollama-test': makeProvider('ollama-test', 'fail'),
      mock: makeProvider('mock', 'fail'),
    },
    async () => {
      try {
        await streamChatWithRuntimeFallback({
          messages: [{ role: 'user', content: 'hi' }],
        });
        throw new Error('expected chain exhaustion to throw');
      } catch (err) {
        // Expected — every provider failed. The resolver's post-loop call to
        // recordFailure() + emitDegraded() fired during this throw.
        if ((err as Error).message === 'expected chain exhaustion to throw') throw err;
      }
    },
  );
}

/**
 * Drive one successful resolver call (deepseek-mock returns a stream).
 */
async function forceChainSuccessViaResolver(): Promise<void> {
  await withProviderOverrides(
    {
      deepseek: makeProvider('deepseek', 'succeed'),
    },
    async () => {
      const result = await streamChatWithRuntimeFallback({
        messages: [{ role: 'user', content: 'hi' }],
      });
      // Consume stream — resolver already returned. recordSuccess fired during
      // the success-return path before consumption.
      for await (const _ of result.stream) {
        // drain
      }
    },
  );
}

// ─── Case 1: 3 chain failures → one PROVIDER_DEGRADED via resolver ─────────────
async function case1_threeFailuresEmitDegraded(): Promise<void> {
  const events = freshSlate();

  for (let i = 0; i < 3; i++) {
    await forceChainExhaustionViaResolver();
  }

  const degradedEmits = events.filter((e) => e.type === 'provider_degraded');
  assert.equal(events.length, 1, `case1: expected 1 emit total, got ${events.length}`);
  assert.equal(degradedEmits.length, 1, `case1: expected 1 PROVIDER_DEGRADED, got ${degradedEmits.length}`);
  assert.equal(typeof degradedEmits[0].reason, 'string', 'case1: reason must be a string');
  assert.ok(degradedEmits[0].reason!.length > 0, 'case1: reason non-empty');
  console.log('PASS case1: 3 chain failures emit one PROVIDER_DEGRADED');
}

// ─── Case 2: next success after degraded → PROVIDER_RECOVERED via resolver ────
async function case2_nextSuccessEmitsRecovered(): Promise<void> {
  const events = freshSlate();
  // Bring to degraded.
  for (let i = 0; i < 3; i++) {
    await forceChainExhaustionViaResolver();
  }
  assert.equal(events.length, 1, 'case2 setup: 1 degraded emit');
  assert.equal(getDegradedState().isDegraded, true, 'case2 setup: degraded');

  // Next resolver success should fire PROVIDER_RECOVERED.
  await forceChainSuccessViaResolver();

  assert.equal(events.length, 2, `case2: expected 2 total emits, got ${events.length}`);
  assert.equal(events[1].type, 'provider_recovered', 'case2: second emit is provider_recovered');
  // Recovered payload must NOT carry a reason (per .strict() schema).
  assert.equal(events[1].reason, undefined, 'case2: recovered payload has no reason field');
  console.log('PASS case2: next success after degraded emits one PROVIDER_RECOVERED');
}

// ─── Case 3: 429 → next-provider-success emits ZERO events (D-13) ─────────────
async function case3_429ThenSuccessEmitsZeroEvents(): Promise<void> {
  const events = freshSlate();

  // 2-provider chain: deepseek throws 429, mock succeeds. The 429-in-catch
  // continues to mock, mock returns ok. Per D-13, this is NOT a chain failure.
  await withProviderOverrides(
    {
      deepseek: makeProvider('deepseek', 'fail', { status: 429, message: '429 rate limit' }),
      'ollama-test': makeProvider('ollama-test', 'fail', { message: 'ollama down' }),
      mock: makeProvider('mock', 'succeed'),
    },
    async () => {
      const result = await streamChatWithRuntimeFallback({
        messages: [{ role: 'user', content: 'hi' }],
      });
      for await (const _ of result.stream) {
        // drain
      }
      assert.ok(
        result.metadata.fallbackChain && result.metadata.fallbackChain.includes('deepseek'),
        'case3: fallbackChain should include the failing deepseek',
      );
    },
  );

  // No events: recordFailure was never called (only continue/retry in catch).
  // recordSuccess was called but we weren't degraded → returned false → no emit.
  assert.equal(events.length, 0, `case3: expected 0 emits, got ${events.length} — ${JSON.stringify(events)}`);
  assert.equal(getDegradedState().isDegraded, false, 'case3: still not degraded');
  console.log('PASS case3: 429 → next-provider-success emits ZERO events (D-13)');
}

// ─── Case 4: repeated chain failures while degraded do NOT re-emit ─────────────
async function case4_repeatedFailuresNoReEmit(): Promise<void> {
  const events = freshSlate();
  // Cross threshold via 3 chain exhaustions.
  for (let i = 0; i < 3; i++) {
    await forceChainExhaustionViaResolver();
  }
  assert.equal(events.length, 1, 'case4 setup: 1 emit after threshold');

  // Two more chain exhaustions while still degraded — must NOT re-emit.
  for (let i = 0; i < 2; i++) {
    await forceChainExhaustionViaResolver();
  }
  assert.equal(events.length, 1, `case4: still 1 emit after 5 total exhaustions, got ${events.length}`);
  console.log('PASS case4: repeated failures while degraded do NOT re-emit');
}

// ─── Case 5: forceRecoveryBroadcast via recovery hook → PROVIDER_RECOVERED ────
async function case5_forceRecoveryBroadcastFiresHook(): Promise<void> {
  __resetForTests();
  // Bring to degraded via direct recordFailure (faster than full resolver path).
  // The recovery-hook path is independent of the resolver — it's the dev-only
  // escape hatch 35-05 will consume.
  for (let i = 0; i < 3; i++) recordFailure();
  assert.equal(getDegradedState().isDegraded, true, 'case5 setup: degraded after 3 failures');

  // Register the hook AFTER __resetForTests (which clears any previous hook).
  // This mirrors the routes.ts wiring exactly.
  const hookEvents: EmitEvent[] = [];
  registerRecoveryHook(() => {
    hookEvents.push({ type: 'provider_recovered' });
  });

  forceRecoveryBroadcast();

  assert.equal(hookEvents.length, 1, `case5: expected 1 hook invocation, got ${hookEvents.length}`);
  assert.equal(hookEvents[0].type, 'provider_recovered', 'case5: payload type');
  assert.equal(getDegradedState().isDegraded, false, 'case5: state cleared by forceRecoveryBroadcast');
  console.log('PASS case5: forceRecoveryBroadcast fires registered recovery hook');
}

async function main(): Promise<void> {
  const cases: Array<[string, () => Promise<void>]> = [
    ['case1', case1_threeFailuresEmitDegraded],
    ['case2', case2_nextSuccessEmitsRecovered],
    ['case3', case3_429ThenSuccessEmitsZeroEvents],
    ['case4', case4_repeatedFailuresNoReEmit],
    ['case5', case5_forceRecoveryBroadcastFiresHook],
  ];

  for (const [name, fn] of cases) {
    try {
      await fn();
    } catch (err) {
      console.error(`FAIL ${name}:`, err instanceof Error ? err.stack || err.message : err);
      process.exit(1);
    }
  }
  console.log('ALL 5 CASES PASS');
}

main().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
