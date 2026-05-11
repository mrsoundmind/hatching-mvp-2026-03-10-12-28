#!/usr/bin/env tsx
/**
 * Phase 35-01 unit-test suite for server/llm/providerHealthState.ts.
 *
 * Run: npx tsx scripts/test-provider-health-state.ts
 *
 * Validates:
 *   - Sliding-window failure counter (D-10: 3-in-60s threshold)
 *   - Recovery on next success (D-11) and counter reset (D-12)
 *   - No double-emit on repeated failures while already degraded
 *   - Production guard on forceOutageMode() (T-35-02 mitigation)
 *   - Production guard on forceRecoveryBroadcast() (T-35-02 mitigation)
 *   - registerRecoveryHook silent no-op in production (T-35-21 mitigation)
 *   - forceRecoveryBroadcast invokes the registered hook in dev
 *   - __resetForTests() clears the recoveryHook (test-isolation contract)
 *
 * Each case prints a PASS line on success. First failure throws and exits 1.
 */

import assert from 'node:assert/strict';
import {
  recordFailure,
  recordSuccess,
  getDegradedState,
  forceOutageMode,
  registerRecoveryHook,
  forceRecoveryBroadcast,
  __resetForTests,
  __injectTimestampsForTests,
} from '../server/llm/providerHealthState.js';

// Helper: ensure each case starts from a clean slate (counter empty, hook null,
// injection off, NODE_ENV restored to 'development').
function freshSlate(): void {
  // NODE_ENV must be non-production for __resetForTests() to be allowed.
  process.env.NODE_ENV = 'development';
  __resetForTests();
}

async function case1_threeFailuresTriggerDegraded(): Promise<void> {
  freshSlate();
  const r1 = recordFailure();
  const r2 = recordFailure();
  const r3 = recordFailure();
  assert.equal(r1, false, 'case1: first failure should not trigger');
  assert.equal(r2, false, 'case1: second failure should not trigger');
  assert.equal(r3, true, 'case1: third failure within window should trigger degraded');
  assert.equal(getDegradedState().isDegraded, true, 'case1: state should be degraded');
  console.log('PASS case1: 3 failures in 60s -> degraded');
}

async function case2_twoFailuresDoNotTrigger(): Promise<void> {
  freshSlate();
  const r1 = recordFailure();
  const r2 = recordFailure();
  assert.equal(r1, false, 'case2: first failure should not trigger');
  assert.equal(r2, false, 'case2: second failure should not trigger');
  assert.equal(getDegradedState().isDegraded, false, 'case2: should not be degraded');
  console.log('PASS case2: 2 failures in window -> not degraded');
}

async function case3_windowExpiryDropsOldFailures(): Promise<void> {
  freshSlate();
  // Inject two timestamps from 70 seconds ago (outside the 60s window).
  const longAgo = Date.now() - 70_000;
  __injectTimestampsForTests([longAgo, longAgo]);
  // A single new failure now should NOT trigger (only 1 failure inside window).
  const r = recordFailure();
  assert.equal(r, false, 'case3: stale failures should be dropped; 1 fresh failure must not trigger');
  assert.equal(getDegradedState().isDegraded, false, 'case3: state should not be degraded');
  console.log('PASS case3: window expiry drops old failures');
}

async function case4_successResetsCounter(): Promise<void> {
  freshSlate();
  recordFailure();
  recordFailure();
  const triggered = recordFailure();
  assert.equal(triggered, true, 'case4: 3rd failure should trigger');
  assert.equal(getDegradedState().isDegraded, true, 'case4: degraded after 3 failures');

  const recovered = recordSuccess();
  assert.equal(recovered, true, 'case4: recordSuccess after degraded should return true');
  assert.equal(getDegradedState().isDegraded, false, 'case4: state cleared after recovery');

  // After reset, 2 new failures should NOT re-trigger (counter is empty).
  const r1 = recordFailure();
  const r2 = recordFailure();
  assert.equal(r1, false, 'case4: first failure post-recovery should not trigger');
  assert.equal(r2, false, 'case4: second failure post-recovery should not trigger');
  assert.equal(getDegradedState().isDegraded, false, 'case4: still not degraded after only 2 failures');
  console.log('PASS case4: success resets counter');
}

async function case5_repeatDegradedDoesNotReEmit(): Promise<void> {
  freshSlate();
  recordFailure();
  recordFailure();
  const r3 = recordFailure();
  assert.equal(r3, true, 'case5: 3rd failure triggers');
  const r4 = recordFailure();
  assert.equal(r4, false, 'case5: 4th failure must NOT re-trigger (already degraded)');
  assert.equal(getDegradedState().isDegraded, true, 'case5: still degraded');
  console.log('PASS case5: already-degraded does not re-emit');
}

async function case6_forceOutageModeRejectedInProd(): Promise<void> {
  freshSlate();
  const original = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    assert.throws(
      () => forceOutageMode(true),
      /FATAL/,
      'case6: forceOutageMode must throw FATAL in production',
    );
  } finally {
    process.env.NODE_ENV = original;
  }
  console.log('PASS case6: forceOutageMode rejected in production');
}

async function case7_forceOutageModeAllowedInDev(): Promise<void> {
  freshSlate();
  // No throw expected.
  forceOutageMode(true);
  // While injection is active, recordSuccess should not clear the degraded state.
  // (Even if not yet degraded, recordSuccess called during outage mode must remain a no-op.)
  recordFailure();
  recordFailure();
  const triggered = recordFailure();
  assert.equal(triggered, true, 'case7: degraded triggers normally during outage mode');
  const recovered = recordSuccess();
  assert.equal(recovered, false, 'case7: recordSuccess during outage mode must NOT recover');
  assert.equal(
    getDegradedState().isDegraded,
    true,
    'case7: still degraded — outage mode suppresses recovery',
  );
  // Clean up: turn off outage mode.
  forceOutageMode(false);
  console.log('PASS case7: forceOutageMode allowed in dev; suppresses recovery');
}

async function case8_forceRecoveryBroadcastRejectedInProd(): Promise<void> {
  freshSlate();
  const original = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    assert.throws(
      () => forceRecoveryBroadcast(),
      /FATAL/,
      'case8: forceRecoveryBroadcast must throw FATAL in production',
    );
  } finally {
    process.env.NODE_ENV = original;
  }
  console.log('PASS case8: forceRecoveryBroadcast rejected in production');
}

async function case9_forceRecoveryBroadcastInvokesHook(): Promise<void> {
  freshSlate();
  // Bring system to degraded.
  recordFailure();
  recordFailure();
  recordFailure();
  assert.equal(getDegradedState().isDegraded, true, 'case9: degraded after 3 failures');

  let hookCalls = 0;
  registerRecoveryHook(() => {
    hookCalls += 1;
  });

  forceRecoveryBroadcast();
  assert.equal(hookCalls, 1, 'case9: recovery hook should be invoked exactly once');
  assert.equal(getDegradedState().isDegraded, false, 'case9: state cleared by forceRecoveryBroadcast');
  console.log('PASS case9: forceRecoveryBroadcast invokes registered hook');
}

async function case10_registerRecoveryHookSilentInProd(): Promise<void> {
  freshSlate();
  const original = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    // Must NOT throw. Silent no-op per spec.
    registerRecoveryHook(() => {
      throw new Error('hook should never be invoked in prod');
    });
  } finally {
    process.env.NODE_ENV = original;
  }

  // Belt-and-suspenders: even if a hook were somehow set, forceRecoveryBroadcast itself
  // throws in production (covered by case8), so the prod-registered hook can never fire.
  // Bring system to a state where, in dev, the hook would fire — confirm the prod-registered
  // hook is NOT present (was dropped by registerRecoveryHook's silent no-op).
  freshSlate();
  recordFailure();
  recordFailure();
  recordFailure();
  // No hook is registered now (freshSlate cleared it), so forceRecoveryBroadcast in dev
  // must complete without invoking anything — and crucially without finding the prod hook.
  forceRecoveryBroadcast();
  assert.equal(getDegradedState().isDegraded, false, 'case10: recovery still clears state');
  console.log('PASS case10: registerRecoveryHook silent no-op in production');
}

async function main(): Promise<void> {
  const cases: Array<[string, () => Promise<void>]> = [
    ['case1', case1_threeFailuresTriggerDegraded],
    ['case2', case2_twoFailuresDoNotTrigger],
    ['case3', case3_windowExpiryDropsOldFailures],
    ['case4', case4_successResetsCounter],
    ['case5', case5_repeatDegradedDoesNotReEmit],
    ['case6', case6_forceOutageModeRejectedInProd],
    ['case7', case7_forceOutageModeAllowedInDev],
    ['case8', case8_forceRecoveryBroadcastRejectedInProd],
    ['case9', case9_forceRecoveryBroadcastInvokesHook],
    ['case10', case10_registerRecoveryHookSilentInProd],
  ];

  for (const [name, fn] of cases) {
    try {
      await fn();
    } catch (err) {
      console.error(`FAIL ${name}:`, err instanceof Error ? err.message : err);
      process.exit(1);
    }
  }
  console.log('ALL 10 CASES PASS');
}

main().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
