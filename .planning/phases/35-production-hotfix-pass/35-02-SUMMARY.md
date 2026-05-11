---
phase: 35-production-hotfix-pass
plan: 02
subsystem: llm-resilience
tags: [websocket, provider-resolver, broadcast, late-join-replay, llmux-01]

# Dependency graph
requires:
  - phase: 35-01-ws-schema-and-health-state
    provides: providerHealthState API (recordFailure/recordSuccess/getDegradedState/forceRecoveryBroadcast/registerRecoveryHook) + PROVIDER_DEGRADED/PROVIDER_RECOVERED z.object().strict() schemas
provides:
  - "PROVIDER_DEGRADED emit on full-chain exhaustion (3-in-60s sliding window per D-10)"
  - "PROVIDER_RECOVERED emit on next success after degraded (D-11)"
  - "broadcastToAllSockets helper in chat.ts — all-sockets WS broadcast"
  - "Registered recovery hook in routes.ts so 35-05 force-recovery endpoint fires PROVIDER_RECOVERED deterministically"
  - "Late-join PROVIDER_DEGRADED replay in wss.on('connection') — closes LLMUX-02 page-refresh case"
  - "maybeReplayDegradedToSocket exported helper for unit-test injection"
affects: [35-03-client-toast, 35-05-playwright-spec]

# Tech tracking
tech-stack:
  added: []  # Pure wiring + instrumentation; no new dependencies
  patterns:
    - "Module-scope broadcaster registry + try/catch wrapped emit helpers (broadcast errors never break LLM calls)"
    - "Structural typing for testable WS helper: { readyState, OPEN, send } — enables fake-socket injection without constructing a real WebSocket"
    - "Cross-file wave coordination via callback registries (registerHealthBroadcaster + registerRecoveryHook) rather than module-level imports — keeps providerResolver pure of WS/network concerns"

key-files:
  created:
    - scripts/test-provider-degraded-emit.ts
    - scripts/test-provider-late-join-replay.ts
  modified:
    - server/routes/chat.ts             # +60 lines: broadcastToAllSockets helper, RegisterChatDeps surface, maybeReplayDegradedToSocket export, connection-handler late-join call
    - server/routes.ts                  # +22 lines: registerHealthBroadcaster + registerRecoveryHook wiring at startup
    - server/llm/providerResolver.ts    # +71 lines: registerHealthBroadcaster export, emitDegraded/emitRecovered helpers, 6 instrumented call sites

key-decisions:
  - "broadcastToAllSockets is additive — does NOT replace broadcastToConversation/broadcastToProject. PROVIDER_DEGRADED is a server-global event so it needs a server-global helper (per CONTEXT D-10: counter is per-server-instance)."
  - "registerRecoveryHook wiring lives in routes.ts onBroadcastReady alongside registerHealthBroadcaster — keeps 35-05 surface clean (35-05 only adds DEV-only HTTP endpoints, no edits to routes.ts)."
  - "Emit helpers wrapped in try/catch — a broken WS layer can never propagate an exception back into a live LLM call."
  - "D-13 contract preserved: per-provider failure in the catch block continues to next provider; only the terminal throws (post-loop OR OpenAI direct-throw) count as chain exhaustion. 429 → next-provider-success therefore does NOT trigger PROVIDER_DEGRADED."
  - "Late-join replay extracted into testable helper (maybeReplayDegradedToSocket) with structural fake-socket type so the test never needs a real WebSocket — avoids the cost/flakiness of spinning up a wss in tests."

patterns-established:
  - "When a server module needs to call a side-effect on WS state, expose it via a callback registry (Xxx-broadcaster pattern) — keeps the originating module pure and unit-testable"
  - "DEV-only hook wiring at startup is safe in prod because the underlying registry is itself a silent no-op in production (T-35-21 mitigation enforced at the providerHealthState boundary)"

requirements-completed: [LLMUX-01]  # PROVIDER_DEGRADED typed WS event + recovery emit + late-join replay. (LLMUX-02 needs 35-03 client toast; LLMUX-03 auto-dismiss spec lives in 35-05.)

# Metrics
duration: ~30min
completed: 2026-05-11
---

# Phase 35 Plan 02: Provider Resolver Wiring + Late-Join Replay Summary

**Wave 2 wiring shipped: PROVIDER_DEGRADED + PROVIDER_RECOVERED now emit through every connected socket on chain exhaustion / first success, and clients that connect mid-outage see the banner via WS late-join replay.**

## Performance

- **Duration:** ~30 min
- **Tasks:** 4/4 atomic
- **Files modified:** 5 (2 created, 3 modified)
- **Lines added:** ~594 (60 chat.ts + 22 routes.ts + 71 providerResolver.ts + 316 emit test + 128 late-join test, minus 3 line replacements)
- **Test count:** 8 new cases (5 emit + 3 late-join) — both suites deterministic across re-runs

## Accomplishments

- **LLMUX-01 closed**: Server now emits typed `PROVIDER_DEGRADED` WS event when the full provider chain exhausts 3× in a 60-second sliding window. Counter sits behind the existing resolver fallback logic — no re-routing of healthy traffic. Per-payload shape is fixed by the `.strict()` Zod schemas added in 35-01, so the broadcast cannot accidentally leak provider identity or error text (T-35-01 / T-35-05 mitigations remain enforced structurally).
- **Late-join completeness**: A client that connects (or page-refreshes) during an active outage receives a one-shot `PROVIDER_DEGRADED` on connect via `maybeReplayDegradedToSocket(ws)` — closes the LLMUX-02 banner gap that would otherwise leave refreshed tabs silent.
- **Deterministic dev recovery path unlocked**: `registerRecoveryHook` is wired in routes.ts at startup, so 35-05's `/api/dev/force-recovery` can call `forceRecoveryBroadcast()` and the entire path (dev endpoint → registered hook → broadcastToAllSockets → every connected socket) fires without needing a real LLM round-trip.
- **D-13 contract preserved**: A 429 from one provider that successfully falls back to the next provider does NOT increment the failure counter. Only terminal throws (post-loop OR OpenAI direct-throw escape hatch) count as chain exhaustion — verified by emit test case 3.

## Task Commits

Each task committed atomically:

1. **Task 1: broadcastToAllSockets helper + health-broadcaster registry** — `01d45f4` (feat)
2. **Task 2: instrument providerResolver for chain-exhaustion + recovery emit** — `9663a0c` (feat)
3. **Task 3: integration test for PROVIDER_DEGRADED emit semantics** — `a9a25dd` (test)
4. **Task 4: late-join PROVIDER_DEGRADED replay on WS connect** — `d28022c` (feat)

## Files Created/Modified

### server/routes/chat.ts (+60 lines)
- New `broadcastToAllSockets(data)` closure near line 1167: dedupes sockets across `activeConnections` (sockets may appear in multiple conversations) and sends `JSON.stringify(data)` to every OPEN socket.
- `RegisterChatDeps.onBroadcastReady` callback type extended with `broadcastToAllSockets: (data: unknown) => void`.
- Exported `maybeReplayDegradedToSocket(ws)` helper near line 134: reads `getDegradedState()` and sends a one-shot `PROVIDER_DEGRADED` payload to the new socket if `isDegraded && readyState === OPEN`. Read-only on health state, try/catch wrapped (best-effort — never breaks WS handshake).
- `wss.on('connection')` handler near line 522 now calls `maybeReplayDegradedToSocket(ws)` immediately after auth.
- Added `import { getDegradedState } from "../llm/providerHealthState.js"`.

### server/routes.ts (+22 lines)
- Added imports: `registerHealthBroadcaster` from `./llm/providerResolver.js` and `registerRecoveryHook` from `./llm/providerHealthState.js`.
- New module-scope `let providerHealthBroadcast: ((data: unknown) => void) | null = null;` capturing the broadcaster from chat.ts.
- `onBroadcastReady` handler now:
  - Sets `providerHealthBroadcast = fns.broadcastToAllSockets`.
  - Calls `registerHealthBroadcaster((data) => providerHealthBroadcast?.(data))` so resolver emits route to all sockets.
  - Calls `registerRecoveryHook(() => providerHealthBroadcast?.({ type: 'provider_recovered' }))` so 35-05's force-recovery endpoint can deterministically broadcast.
- No changes to existing broadcastToConversation/broadcastToProject behavior.

### server/llm/providerResolver.ts (+71 lines)
- Added imports: `recordFailure`, `recordSuccess`, `getDegradedState` from `./providerHealthState.js`.
- New module-scope `let healthBroadcaster: ((data: unknown) => void) | null = null;` and exported `registerHealthBroadcaster(fn)` setter (testable + wireable).
- Internal `emitDegraded()` / `emitRecovered()` helpers — each try/catch wrapped so broadcaster errors never propagate up.
- **6 instrumented call sites total** (4 `recordFailure` + 2 `recordSuccess`):
  - `generateChatWithRuntimeFallback`:
    - Success-return path (~line 371): `if (recordSuccess()) emitRecovered();` BEFORE return
    - OpenAI direct-throw (~line 389): `if (recordFailure()) emitDegraded();` BEFORE throw
    - Post-loop throw (~line 401): `if (recordFailure()) emitDegraded();` BEFORE throw
  - `streamChatWithRuntimeFallback`:
    - Success-return path (~line 422): `if (recordSuccess()) emitRecovered();` BEFORE return
    - OpenAI direct-throw (~line 438): `if (recordFailure()) emitDegraded();` BEFORE throw
    - Post-loop throw (~line 448): `if (recordFailure()) emitDegraded();` BEFORE throw
- Per-provider catch block's `continue` branch (429 → next provider) does NOT call recordFailure — preserves D-13.

### scripts/test-provider-degraded-emit.ts (316 lines, new)
- 5 integration test cases driving the actual `streamChatWithRuntimeFallback` with provider doubles in `providerRegistry`:
  - **case1**: 3 chain exhaustions → 1 PROVIDER_DEGRADED emit
  - **case2**: Next success after degraded → 1 PROVIDER_RECOVERED emit
  - **case3**: 429 → next-provider-success → 0 emits (D-13 contract)
  - **case4**: Repeated chain failures while degraded → no re-emit
  - **case5**: `forceRecoveryBroadcast` via `registerRecoveryHook` → 1 PROVIDER_RECOVERED (validates 35-05 wire-up)
- Pattern mirrors `scripts/test-budget-race.ts` and `scripts/test-provider-health-state.ts` (each case prints PASS, exits 1 on first FAIL).
- Deterministic across re-runs.

### scripts/test-provider-late-join-replay.ts (128 lines, new)
- 3 unit test cases for `maybeReplayDegradedToSocket(ws)`:
  - **case1**: degraded + readyState=OPEN → send invoked once with valid `{type:'provider_degraded',reason}` payload
  - **case2**: not degraded → send NOT invoked
  - **case3**: degraded but readyState=CLOSED → send NOT invoked (defensive check)
- Uses dynamic `await import()` after setting `DATABASE_URL=dummy` (chat.ts transitively imports db.ts which throws at module-load if unset; Neon Pool is lazy-initialized so we never actually connect).
- Fake socket is structurally typed `{ readyState, OPEN, send }` — no real WebSocket needed.

## WS Wire-Up Diagram

```
provider chain exhausts 3x in 60s     →  providerResolver
  ↓
recordFailure() returns true
  ↓
emitDegraded()
  ↓
healthBroadcaster?.(data)             ←  registered by routes.ts at startup
  ↓
providerHealthBroadcast?.(data)
  ↓
broadcastToAllSockets(data)           →  every OPEN socket in activeConnections
                                          (deduped — same socket in 2 convs sends once)

new WS connect during outage:
  ws upgrade complete
  ↓
maybeReplayDegradedToSocket(ws)
  ↓
getDegradedState().isDegraded === true
  ↓
ws.send(JSON.stringify({type:'provider_degraded', reason}))   →  one-shot to new socket only

35-05 force-recovery (DEV-only):
  /api/dev/force-recovery
  ↓
forceRecoveryBroadcast()
  ↓
registered recovery hook              ←  registered by routes.ts at startup
  ↓
providerHealthBroadcast?.({type:'provider_recovered'})
  ↓
broadcastToAllSockets                 →  every OPEN socket
```

## Verification Summary

All 7 verification gates from the plan pass:

1. `npx tsc --noEmit` — GREEN (no errors)
2. `npx tsx scripts/test-provider-degraded-emit.ts` — 5/5 PASS, exits 0
3. `npx tsx scripts/test-provider-late-join-replay.ts` — 3/3 PASS, exits 0
4. `grep -c "recordFailure\|recordSuccess" server/llm/providerResolver.ts` — 10 matches (6 real call sites + 2 import lines + 2 comments; ≥ 6 required)
5. `grep -v '^ *//' server/llm/providerResolver.ts | grep -c "broadcastToAllSockets"` — 0 (resolver does NOT import broadcaster directly — only via callback)
6. `grep -c "registerRecoveryHook" server/routes.ts` — 3 matches (import + call + doc comment; ≥ 2 required)
7. Re-running emit test gives identical output — deterministic, no state leakage between runs (verified)

## Threat Model Status (Plan 35-02 Mitigations)

| Threat ID | Component | Status |
|-----------|-----------|--------|
| T-35-05 (Info disclosure: reason field leaks provider error text) | emitDegraded() | MITIGATED — reason comes from getDegradedState().reason which is the hardcoded constant from 35-01 ("Agents are slow right now, hang tight"). Never derived from provider error. Server-overridable values still capped at 200 chars by .strict() schema. |
| T-35-06 (DoS: emitDegraded flooding) | emitDegraded() | MITIGATED — recordFailure() returns true ONLY on the threshold-cross transition; repeated failures while already degraded return false. Verified by emit test case 4. |
| T-35-07 (Tampering: broadcaster reachable from any module) | broadcastToAllSockets | MITIGATED — captured into module-scope let in routes.ts; only resolver's registerHealthBroadcaster + providerHealthState's registerRecoveryHook can route through it. No public export of the broadcaster itself. |
| T-35-08 (Spoofing: malicious client sending PROVIDER_DEGRADED upward) | wsClientMessageSchema | ACCEPTED — client schema is a strict union not including PROVIDER_DEGRADED; a malicious upward send would be rejected by the existing client-message validation. |
| T-35-09 (Repudiation: no persistent log) | health state | ACCEPTED per CONTEXT — provider_fallback rows in autonomy_events table cover forensics. |
| T-35-22 (Tampering: registerRecoveryHook reachable in production via routes.ts) | routes.ts startup wiring | MITIGATED — registerRecoveryHook is a silent no-op in production (T-35-21 enforced at providerHealthState boundary). forceRecoveryBroadcast — the only consumer of the hook — also throws in production. Belt-and-suspenders. |

## Handoff Notes for Downstream Plans

### For 35-03 (client toast)

The server emits exactly the payloads 35-01's `.strict()` schemas allow:
- `PROVIDER_DEGRADED`: `{ type: 'provider_degraded', reason: string }` — display reason as toast description; `duration: Infinity` so it persists until recovery
- `PROVIDER_RECOVERED`: `{ type: 'provider_recovered' }` — call `toast.dismiss(id)` on the persistent degradation toast id

Per D-08, the next `streaming_completed` / `chat_message` event also implies recovery — the explicit `PROVIDER_RECOVERED` event is the deterministic signal, but the next message arrival is the user-facing 5-second-dismiss target.

The late-join replay means a fresh WS connection can receive a `PROVIDER_DEGRADED` immediately on connect (not just from a threshold-cross). 35-03's `useRealTimeUpdates` handler should treat both the same way — call `toast({duration: Infinity})` either way.

### For 35-05 (Playwright spec)

The dev-only `/api/dev/force-recovery` endpoint should just call `forceRecoveryBroadcast()` (from `providerHealthState.ts`) — that's all the wiring done in 35-02 produces a deterministic, no-LLM-round-trip path:
- forceRecoveryBroadcast → registered hook (registered in routes.ts onBroadcastReady) → providerHealthBroadcast → broadcastToAllSockets → every connected socket

The spec can also exercise the late-join case directly: trigger outage mode, connect a new WS client, assert it receives PROVIDER_DEGRADED on connect without waiting for a chain exhaustion.

## Known Stubs / Deferred Items

None. This plan completes its scope. The frontend toast (35-03) and Playwright spec (35-05) are tracked in their own plans.

## Self-Check: PASSED

- `server/routes/chat.ts` — broadcastToAllSockets, maybeReplayDegradedToSocket, late-join call all present — FOUND
- `server/routes.ts` — registerHealthBroadcaster + registerRecoveryHook wired in onBroadcastReady — FOUND
- `server/llm/providerResolver.ts` — registerHealthBroadcaster export, 4 recordFailure + 2 recordSuccess call sites — FOUND
- `scripts/test-provider-degraded-emit.ts` — 5/5 PASS — FOUND
- `scripts/test-provider-late-join-replay.ts` — 3/3 PASS — FOUND
- Commit `01d45f4` (Task 1) in `git log` — FOUND
- Commit `9663a0c` (Task 2) in `git log` — FOUND
- Commit `a9a25dd` (Task 3) in `git log` — FOUND
- Commit `d28022c` (Task 4) in `git log` — FOUND
