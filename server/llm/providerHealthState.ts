/**
 * Phase 35-01: Sliding-window provider-health counter.
 *
 * Single in-memory source of truth for "are we degraded right now?" used by:
 *   - 35-02: server/llm/providerResolver.ts (records failures + successes)
 *   - 35-02: server/routes.ts (registers the recovery hook + late-join replay)
 *   - 35-05: server/routes/health.ts /api/dev/force-recovery (calls forceRecoveryBroadcast)
 *
 * Design (per CONTEXT.md decisions):
 *   D-10: 3 consecutive full-chain failures within a 60-second sliding window -> degraded
 *   D-11: next successful request emits PROVIDER_RECOVERED
 *   D-12: success resets the counter; partial successes count as success at the caller
 *   D-13: 429 errors that route to the next provider successfully do NOT count as a failure
 *         (this is the CALLER's responsibility — this module just counts what it's told)
 *
 * Threat model (T-35-02, T-35-21):
 *   - forceOutageMode() throws FATAL when NODE_ENV === 'production'
 *   - forceRecoveryBroadcast() throws FATAL when NODE_ENV === 'production'
 *   - registerRecoveryHook() is a silent no-op when NODE_ENV === 'production'
 *
 * State scope: module-level mutable state. There is exactly one provider chain per
 * server process; per D-10 the counter is "in-memory, per-server-instance, sufficient
 * for MVP single-node deploy". Mirrors server/productionGuard.ts simplicity.
 */

const WINDOW_MS = 60_000;
const FAILURE_THRESHOLD = 3;
const DEFAULT_REASON = 'Agents are slow right now, hang tight';

// Module-scope mutable state — single source of truth for this process.
let failureTimestamps: number[] = [];
let isDegraded = false;
let degradedReason: string = DEFAULT_REASON;
let outageModeActive = false;
let recoveryHook: (() => void) | null = null;

/**
 * Prune timestamps older than the sliding window.
 */
function prune(now: number): void {
  const cutoff = now - WINDOW_MS;
  failureTimestamps = failureTimestamps.filter((ts) => ts >= cutoff);
}

/**
 * Record a full-chain failure (every provider in the chain exhausted).
 * D-13: the caller is responsible for NOT calling this for transient 429s that
 * route to a next-provider success — only call when the full chain has failed.
 *
 * @returns true iff this failure crossed the 3-in-60s threshold AND we were not
 *   already degraded. Callers use this signal to emit PROVIDER_DEGRADED exactly
 *   once per outage.
 */
export function recordFailure(): boolean {
  const now = Date.now();
  failureTimestamps.push(now);
  prune(now);

  if (failureTimestamps.length >= FAILURE_THRESHOLD && !isDegraded) {
    isDegraded = true;
    degradedReason = DEFAULT_REASON;
    return true;
  }
  return false;
}

/**
 * Record a successful provider call (partial successes count — D-12).
 * Resets the failure counter to empty.
 *
 * @returns true iff we were degraded and now recover. Callers use this signal to
 *   emit PROVIDER_RECOVERED. Returns false if outage mode is active (the DEV-only
 *   injection mechanism suppresses recovery so 35-05's Playwright spec can hold
 *   the system in a degraded state).
 */
export function recordSuccess(): boolean {
  if (outageModeActive) {
    // DEV-only injection: keep counter + state frozen so the spec can drive a
    // deterministic outage. recordSuccess is a no-op while injection is active.
    return false;
  }

  failureTimestamps = [];
  if (isDegraded) {
    isDegraded = false;
    degradedReason = DEFAULT_REASON;
    return true;
  }
  return false;
}

/**
 * Read current degraded state. Used at WS connect time so late-join clients
 * can replay the current banner state without waiting for the next failure.
 * (35-02 Task 4 wires this into wss.on('connection').)
 */
export function getDegradedState(): { isDegraded: boolean; reason: string } {
  return { isDegraded, reason: degradedReason };
}

/**
 * DEV-only: force the counter into "outage suppression" mode so recordSuccess()
 * is a no-op. Used by 35-05's Playwright spec to hold the system degraded across
 * mocked successful calls until the spec explicitly recovers.
 *
 * Throws a FATAL error if called in production (T-35-02 mitigation).
 */
export function forceOutageMode(enabled: boolean): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'FATAL: forceOutageMode() called in production. This is a DEV-only injection ' +
        'mechanism and must not be reachable from a production code path.',
    );
  }
  outageModeActive = enabled;
}

/**
 * Register a callback to fire when forceRecoveryBroadcast() is invoked.
 * Intended consumer: 35-02 wires this from server/routes.ts to broadcast
 * `{type: 'provider_recovered'}` to all sockets.
 *
 * Silent no-op in production (T-35-21 mitigation): even if a misbehaving import
 * tried to register an attacker-controlled callback, it would never be set.
 * forceRecoveryBroadcast() — the only consumer of recoveryHook — also throws in
 * production, providing belt-and-suspenders.
 */
export function registerRecoveryHook(fn: () => void): void {
  if (process.env.NODE_ENV === 'production') {
    return; // silent no-op — see T-35-21
  }
  recoveryHook = fn;
}

/**
 * DEV-only: deterministic recovery broadcast for 35-05's Playwright spec. Calls
 * recordSuccess() (which clears outage mode is NOT done here — caller should
 * forceOutageMode(false) first if injection was active), then invokes the
 * registered recovery hook so the broadcaster fires WITHOUT requiring a real LLM
 * round-trip.
 *
 * Throws a FATAL error if called in production (T-35-02 mitigation).
 */
export function forceRecoveryBroadcast(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'FATAL: forceRecoveryBroadcast() called in production. This is a DEV-only ' +
        'mechanism and must not be reachable from a production code path.',
    );
  }
  // Ensure recovery actually clears state even if outage mode was still set —
  // the spec's intent when calling forceRecoveryBroadcast is "force a recovery now".
  outageModeActive = false;
  failureTimestamps = [];
  if (isDegraded) {
    isDegraded = false;
    degradedReason = DEFAULT_REASON;
  }
  try {
    recoveryHook?.();
  } catch {
    // Never let a dev-only hook crash the response path.
  }
}

/**
 * Test-only: reset all module state between cases.
 * Clears the counter, degraded flag, outage mode, AND the recovery hook so test
 * isolation is complete. Throws in production for defence-in-depth.
 */
export function __resetForTests(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'FATAL: __resetForTests() called in production. Test-only helper must not run ' +
        'in a production code path.',
    );
  }
  failureTimestamps = [];
  isDegraded = false;
  degradedReason = DEFAULT_REASON;
  outageModeActive = false;
  recoveryHook = null;
}

/**
 * Test-only: inject a known list of failure timestamps (Date.now()-style numbers)
 * so unit tests can simulate "stale failures outside the window" without waiting
 * 60 real seconds. Replaces the current array entirely.
 *
 * Throws in production. Used exclusively by scripts/test-provider-health-state.ts
 * (Case 3: window-expiry behavior).
 */
export function __injectTimestampsForTests(timestamps: number[]): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'FATAL: __injectTimestampsForTests() called in production. Test-only helper ' +
        'must not run in a production code path.',
    );
  }
  failureTimestamps = [...timestamps];
}
