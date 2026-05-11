---
phase: 35-production-hotfix-pass
plan: 01
subsystem: llm-resilience
tags: [websocket, zod, provider-health, sliding-window, dev-injection, security]

# Dependency graph
requires:
  - phase: 34-deepseek-migration
    provides: ProviderId union now includes 'deepseek' (server/llm/providerTypes.ts)
provides:
  - "Typed WS schemas (PROVIDER_DEGRADED + PROVIDER_RECOVERED) with .strict() security boundary"
  - "Sliding-window provider-health counter API (3-in-60s threshold per D-10)"
  - "DEV-only outage injection (forceOutageMode) with NODE_ENV=production fatal guard"
  - "DEV-only recovery-hook registry (registerRecoveryHook + forceRecoveryBroadcast)"
  - "Test-only state-reset and timestamp-injection helpers for unit-test determinism"
affects: [35-02-provider-resolver-wire, 35-03-client-toast, 35-05-playwright-spec]

# Tech tracking
tech-stack:
  added: []  # No new dependencies — uses existing zod + node primitives
  patterns:
    - "z.object({...}).strict() at security boundary for unknown-field rejection"
    - "Module-level mutable state + named-export API (mirrors productionGuard.ts)"
    - "DEV-only registry pattern: silent no-op in production, callable in dev"
    - "Test-only helpers (__resetForTests, __injectTimestampsForTests) gated on NODE_ENV"

key-files:
  created:
    - server/llm/providerHealthState.ts
    - scripts/test-provider-health-state.ts
  modified:
    - shared/dto/wsSchemas.ts

key-decisions:
  - "Both new WS schemas use .strict() — T-35-01 mitigation depends on this"
  - "Recovery hook lives in providerHealthState.ts (NOT in chat.ts) so 35-02 wires once + 35-05 calls without modifying 35-02 surface"
  - "forceRecoveryBroadcast clears state unconditionally (even if outage mode was on) — semantic intent is 'force recovery now'"
  - "Added __injectTimestampsForTests test-only helper to keep window-expiry test fast (<1s) without real-time sleeps"
  - "Plain number[] for timestamps (not a ring buffer) — N=3 is too small to benefit from optimization, simpler is correct"

patterns-established:
  - "DEV-only injection with NODE_ENV guard mirrored from productionGuard.ts — throws FATAL with explicit error message"
  - "Test-only helpers prefixed with double underscore (__resetForTests, __injectTimestampsForTests) for visual signaling"
  - "Recovery-hook registry: registerXxx + forceXxx pair so registration and invocation are separately prod-guarded"

requirements-completed: []  # Plan 35-01 is pure Wave 1 scaffolding; LLMUX-01..03 close in 35-02/35-03 once they consume these primitives.

# Metrics
duration: 12min
completed: 2026-05-11
---

# Phase 35 Plan 01: WS Schema + Provider Health State Foundation Summary

**Wave 1 foundation laid: typed WS events with strict allowlist + in-memory sliding-window counter API + DEV-only injection scaffolding that 35-02/35-03/35-05 will consume.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-11T08:32:00Z (approx)
- **Completed:** 2026-05-11T08:44:32Z
- **Tasks:** 3/3
- **Files modified:** 3 (1 modified, 2 created)
- **Lines added:** ~450 (12 to wsSchemas + 201 module + 236 test)

## Accomplishments

- **Security boundary established:** Both new WS schemas use `z.object({...}).strict()`. T-35-01 — leaking provider identity through PROVIDER_DEGRADED — is now structurally prevented. Negative tests verified both `{provider:'openai'}` on degraded AND `{extra:'x'}` on recovered are rejected.
- **Single source of truth for degraded state:** All callers (resolver writes, route emits, late-join replay, dev injection, dev recovery) go through the seven named exports of `providerHealthState.ts`. No drift possible because there is exactly one counter.
- **Deterministic Playwright path unlocked:** `forceOutageMode(true)` + `forceRecoveryBroadcast()` give 35-05 a way to drive the system into and out of degraded state without real provider outages. The mechanism is structurally unreachable in production via three prod guards (forceOutageMode throws, forceRecoveryBroadcast throws, registerRecoveryHook silent no-op).

## Task Commits

Each task committed atomically; Task 2+3 used the RED/GREEN gate sequence:

1. **Task 1: WS schemas with .strict()** — `4f3d664` (feat)
2. **Task 3 RED: failing test for counter module** — `dc0a5b8` (test) — tests fail because module doesn't exist
3. **Task 2 GREEN: providerHealthState implementation** — `ebb7ee3` (feat) — all 10 test cases pass

## Files Created/Modified

- `shared/dto/wsSchemas.ts` (+12 lines) — Two new schemas appended to `requiredServerSchemas` union:
  - `provider_degraded`: `{type, reason: z.string().min(1).max(200)}.strict()` — `reason` max 200 chars is T-35-03 DoS mitigation
  - `provider_recovered`: `{type}.strict()`
- `server/llm/providerHealthState.ts` (201 lines, new) — Module exporting `recordFailure`, `recordSuccess`, `getDegradedState`, `forceOutageMode`, `registerRecoveryHook`, `forceRecoveryBroadcast`, `__resetForTests`, `__injectTimestampsForTests`.
- `scripts/test-provider-health-state.ts` (236 lines, new) — 10 unit-test cases; runs in <1s; deterministic across repeat invocations (verified).

## WS Event Payload Shapes (for 35-02 + 35-03 consumers)

```typescript
// Server emits (35-02 owns the emit point); client receives (35-03 owns the toast):
type ProviderDegradedEvent = { type: 'provider_degraded'; reason: string };
type ProviderRecoveredEvent = { type: 'provider_recovered' };

// SECURITY: Both schemas use .strict(). Server-side code that constructs these
// payloads MUST NOT include any other fields — Zod's safeParse on the client
// (in useRealTimeUpdates handler) will reject unknown fields and surface as a
// validation error, NOT silently strip them.
```

## providerHealthState.ts API (for 35-02 + 35-05 consumers)

**Production-callable (always-on path):**
- `recordFailure(): boolean` — call after the full provider chain exhausts (every provider failed). Returns `true` iff this failure crossed the 3-in-60s threshold AND was not already degraded. Caller uses this signal to emit `PROVIDER_DEGRADED` exactly once per outage.
- `recordSuccess(): boolean` — call after any successful provider call (D-12: partial successes count). Returns `true` iff we were degraded and now recover. Caller uses this signal to emit `PROVIDER_RECOVERED`.
- `getDegradedState(): {isDegraded, reason}` — at WS connect time, 35-02 Task 4 calls this and sends `PROVIDER_DEGRADED` to late-joining clients if currently degraded.

**DEV-only (NODE_ENV !== 'production' required):**
- `forceOutageMode(enabled: boolean): void` — throws FATAL in production. When `enabled === true`, `recordSuccess()` becomes a no-op so the spec can hold the system degraded across mocked successes.
- `registerRecoveryHook(fn: () => void): void` — silent no-op in production. 35-02's `server/routes.ts` wiring should register a hook that broadcasts `{type:'provider_recovered'}` to all sockets.
- `forceRecoveryBroadcast(): void` — throws FATAL in production. Clears state and invokes the registered hook. 35-05's `/api/dev/force-recovery` endpoint calls this for deterministic recovery without an LLM round-trip.

**Test-only:**
- `__resetForTests()` — clears all module state including the recovery hook (test isolation contract).
- `__injectTimestampsForTests(timestamps: number[])` — replaces failure timestamps array (used by test case 3 for fast window-expiry verification).

## D-13 Contract — IMPORTANT for 35-02 implementer

> "429 rate-limit errors that route to the next provider successfully do NOT count as failures (only full-chain exhaustion counts)."

This module **does not enforce D-13**. It only counts what the caller tells it. When `35-02` wires `recordFailure()` into `providerResolver.ts`, it MUST call `recordFailure()` only AFTER the entire fallback chain has been exhausted — not on each individual provider's 429. The module is intentionally agnostic about why a call failed; the caller owns that classification.

A comment in `providerHealthState.ts` body documents this contract so the 35-02 implementer sees it.

## Threat Model Status (Plan 35-01 Mitigations)

| Threat ID | Component | Status |
|-----------|-----------|--------|
| T-35-01 (Info disclosure: leak provider identity in WS payload) | wsSchemas.ts | MITIGATED — both schemas use `.strict()`; negative tests verify rejection of extra fields |
| T-35-02 (Elevation: DEV injection reachable in production) | providerHealthState.ts | MITIGATED — `forceOutageMode` + `forceRecoveryBroadcast` both throw FATAL when `NODE_ENV === 'production'`; unit-tested |
| T-35-03 (DoS: unbounded `reason` field amplification) | wsSchemas.ts | MITIGATED — `z.string().min(1).max(200)` |
| T-35-04 (Repudiation: counter is in-memory only) | providerHealthState.ts | ACCEPTED per D-10; forensics covered by existing `provider_fallback` autonomy_event audit row in `chat.ts:2297-2317` |
| T-35-21 (Tampering: registerRecoveryHook callable in production) | providerHealthState.ts | MITIGATED — silent no-op in production (unit-tested); belt-and-suspenders: `forceRecoveryBroadcast` (only consumer) also throws in prod |

## Verification Summary

All five verification gates from the plan pass:

1. `npx tsc --noEmit` — green (no errors)
2. `npx tsx scripts/test-provider-health-state.ts` — exits 0 with all 10 PASS lines (verified deterministic across two runs)
3. Manual safeParse of `{type:'provider_degraded',reason:'slow',provider:'openai'}` — rejected by `.strict()`
4. `grep -c "process.env.NODE_ENV"` (non-comment) on providerHealthState.ts — returns **5** (≥ 3 required)
5. `grep -c "\.strict()"` on wsSchemas.ts — returns **4** (2 functional + 2 doc references; ≥ 2 functional required)

## Handoff Notes for Downstream Plans

### For 35-02 (provider resolver wiring + emit)
- Import `recordFailure`, `recordSuccess`, `getDegradedState`, `registerRecoveryHook` from `server/llm/providerHealthState.ts`.
- Call `recordFailure()` ONLY after the full chain exhausts (D-13 — NOT on 429 that routes to next provider).
- In `server/routes.ts` (or wherever the WS broadcast helper lives), call `registerRecoveryHook(() => broadcastToAllSockets({type:'provider_recovered'}))` once at startup. After this is wired, 35-05's force-recovery endpoint will broadcast correctly.
- In `wss.on('connection')`, call `getDegradedState()` and emit a `PROVIDER_DEGRADED` to the new socket if `isDegraded === true` (late-join replay).
- The WS payload shape is fixed by `.strict()`. Construct **exactly** `{type:'provider_degraded', reason: '...'}` — adding any other field will fail client-side validation.
- Default reason copy: `"Agents are slow right now, hang tight"` (D-07). The server can override via the `reason` argument when emitting.

### For 35-03 (client toast)
- In `client/src/hooks/useRealTimeUpdates.ts`, add a handler for `type === 'provider_degraded'` that calls `toast({ title, description: msg.reason, duration: Infinity })` and remembers the toast id.
- On any `streaming_completed`, `chat_message`, or explicit `provider_recovered` event, call `toast.dismiss(id)`.
- Client-side `wsServerMessageSchema.safeParse` will REJECT payloads with extra fields — this is the security boundary. Don't try to extract `provider` or `model` from the payload; they aren't there.

### For 35-05 (Playwright spec)
- Add a DEV-only `/api/dev/force-outage` endpoint that calls `forceOutageMode(true)` (and a paired endpoint to call `forceOutageMode(false)`).
- Add a DEV-only `/api/dev/force-recovery` endpoint that calls `forceRecoveryBroadcast()`. This will fire the recovery hook registered by 35-02 and broadcast `PROVIDER_RECOVERED` to all sockets.
- Both endpoints MUST be guarded by `process.env.NODE_ENV !== 'production'` at the route level (belt-and-suspenders — the module already throws, but route-level guard avoids stack traces being emitted to anyone probing for these endpoints).
- The spec can: trigger outage mode, make 3 failing chat requests (or directly call `recordFailure` via the dev endpoint), assert toast appears, then call force-recovery, assert toast dismisses.

## Known Stubs / Deferred Items

None. This plan is pure scaffolding — every export is consumed by a downstream plan and the test suite proves each export's contract.

## Self-Check: PASSED

- `shared/dto/wsSchemas.ts` exists at HEAD with 2 new `.strict()` schemas — FOUND
- `server/llm/providerHealthState.ts` exists at HEAD with 8 named exports — FOUND
- `scripts/test-provider-health-state.ts` exists at HEAD; 10 cases pass deterministically — FOUND
- Commit `4f3d664` (feat: schemas) in `git log --all` — FOUND
- Commit `dc0a5b8` (test: RED) in `git log --all` — FOUND
- Commit `ebb7ee3` (feat: GREEN) in `git log --all` — FOUND
