---
phase: 35-production-hotfix-pass
plan: 05
status: spec-passing-deploy-gate-pending
completed: 2026-05-11
verification: playwright-spec-green-2-consecutive-runs
requirements-closed:
  - AUDIT-01
key-files:
  created:
    - tests/e2e/phase-35-production-hotfix.spec.ts
  modified:
    - server/routes/health.ts
    - server/llm/providerHealthState.ts
    - server/routes.ts
    - playwright.config.ts
---

# 35-05 SUMMARY — AUDIT-01 Playwright runtime spec

## What shipped

4 commits, ~1.5-minute spec runtime, all 7 cases green on 2 consecutive runs.

| Commit | Task | Files |
|---|---|---|
| `b65be55` | DEV-only force-outage + force-recovery + reset endpoints | `server/routes/health.ts`, `server/llm/providerHealthState.ts`, `server/routes.ts` |
| `9b72ea3` | Playwright spec for Phase 35 production hotfix surface (7 cases) | `tests/e2e/phase-35-production-hotfix.spec.ts` (NEW, 244 lines) |
| `e06eed2` | Register Phase 35 spec in playwright.config.ts | `playwright.config.ts` (+14 lines) |
| `1874394` | Correct routing + dialog-close for stable run | `tests/e2e/phase-35-production-hotfix.spec.ts` |

## Spec runtime evidence

Run 1: **8 passed (1.5 min)** — `setup` + 7 phase-35 cases
Run 2: **8 passed (1.6 min)** — same

LLMUX-03 toast-dismiss latency (case 4): **386-440 ms** across runs (budget 5000ms per D-08, headroom 11-13×).

## Architecture

```
Playwright spec (phase-35 project)
  │
  ├─ Cases 1a, 2a — deep-link pages
  │    page.goto('/legal/privacy' | '/legal/terms')
  │    → assert <h1> + DRAFT banner + no 404
  │
  ├─ Cases 1b, 2b — landing modal
  │    page.goto('/landing') ← (NOT '/' which redirects authenticated users)
  │    → click a[href="/legal/..."]
  │    → assert role="dialog" + heading + URL unchanged + Escape dismiss
  │
  ├─ Case 2c — login modal (fresh unauthenticated context)
  │    browser.newContext({ storageState: undefined })
  │    → page.goto('/login') ← (would redirect if authenticated)
  │    → Privacy click → modal → Escape → Terms click → modal → close-button click
  │
  ├─ Case 3 — outage
  │    ensureAppLoaded(page) ← establishes WS
  │    → POST /api/dev/reset-provider-state
  │    → POST /api/dev/force-outage {enabled: true}
  │       └─ server: __resetCountersOnly() + forceOutageMode(true) + forceDegradedBroadcast()
  │           └─ broadcast {type:'provider_degraded', reason:'Agents are slow...'} to all sockets
  │       → toast [role="status"] with hasText 'Agents are slow' becomes visible (≤10s)
  │       → assert input still enabled (D-09)
  │
  └─ Case 4 — recovery
       Re-establish degraded state on this page's WS (each test = own page = own connection),
       then:
       → POST /api/dev/force-outage {enabled: false} ← release outage lock
       → T1 = Date.now()
       → POST /api/dev/force-recovery
          └─ server: forceRecoveryBroadcast() → recoveryHook → broadcast {type:'provider_recovered'}
       → assert toast not.toBeVisible (≤5000ms)
       → T2 = Date.now(); log T2-T1 latency
```

## DEV-only endpoints

| Route | Body | Behavior | Defense in depth |
|---|---|---|---|
| `POST /api/dev/force-outage` | `{enabled: boolean}` (Zod) | enabled=true: `__resetCountersOnly()` + `forceOutageMode(true)` + `forceDegradedBroadcast()`. enabled=false: `forceOutageMode(false)` only (degraded state persists). | (1) Existing routes.ts:88-92 blocks `/api/dev/*` in prod (403). (2) Handler returns 404 if NODE_ENV=production. (3) `forceOutageMode` + `forceDegradedBroadcast` throw FATAL in production. |
| `POST /api/dev/force-recovery` | none | Calls `forceRecoveryBroadcast()` → recoveryHook (wired by 35-02) → broadcast `{type:'provider_recovered'}` to all sockets. No LLM round-trip. | Same triple guard. |
| `POST /api/dev/reset-provider-state` | none | Calls `__resetCountersOnly()` — clears counter + degraded flag + outage mode, PRESERVES hooks. Idempotent. | Same triple guard. |

## I4 + I5 fixes embedded

- **I4 (deterministic state):** `/api/dev/force-outage {enabled:true}` ALWAYS calls `__resetCountersOnly()` first — prior counter pollution (real traffic, earlier test runs) cannot suppress the broadcast.
- **I5 (deterministic recovery):** `/api/dev/force-recovery` calls `forceRecoveryBroadcast()` which fires PROVIDER_RECOVERED through the registered recovery hook with NO LLM dependency. The plan's original text suggested deciding-during-implementation; this commit nails it as the explicit recovery mechanism.

## Deviations from plan

### Auto-fixed bug (Rule 1 + Rule 3)

**1. [Rule 1 — Bug + Rule 3 — Blocking] The plan's `recordFailure()` loop in force-outage cannot fire a broadcast.**

- **Found during:** Task 1 implementation review
- **Issue:** The plan's spec for `/api/dev/force-outage {enabled:true}` says "synthesize 3 fake failures via recordFailure() loop (so the next emitDegraded() fires)". But `recordFailure()` in providerHealthState.ts ONLY returns a boolean — it does not broadcast. The broadcast (`emitDegraded()`) is module-private in `providerResolver.ts` and only fires from `if (recordFailure()) emitDegraded()` inside the in-flight LLM call path. The spec's case 3 would therefore never see a toast.
- **Fix:** Added two symmetric helpers to `providerHealthState.ts`:
  - `registerDegradedHook(fn)` — symmetric to existing `registerRecoveryHook`
  - `forceDegradedBroadcast()` — symmetric to existing `forceRecoveryBroadcast`
  Wired the new hook in `server/routes.ts` `onBroadcastReady` (3 lines) pointing at `broadcastToAllSockets`.
- **Files modified:** `server/llm/providerHealthState.ts` (+50 lines), `server/routes.ts` (+9 lines)
- **Commit:** `b65be55`

**2. [Rule 1 — Bug] `__resetForTests()` destroys hooks needed across test cases.**

- **Found during:** Task 1 implementation review
- **Issue:** `__resetForTests()` is documented as clearing the `recoveryHook` (its unit-test isolation contract — `scripts/test-provider-health-state.ts:15`). If a live-server endpoint calls it, the hook wired ONCE at startup by `routes.ts.onBroadcastReady` is destroyed — subsequent `/api/dev/force-recovery` would silently fail (recoveryHook?.() is a no-op when null). The plan's spec relies on case 4's force-recovery firing successfully.
- **Fix:** Added `__resetCountersOnly()` to `providerHealthState.ts` — clears counter + degraded flag + outage mode but PRESERVES the recovery + degraded hooks. The DEV-only endpoints call this instead of `__resetForTests`. The original `__resetForTests` is unchanged for its existing unit-test consumer.
- **Files modified:** `server/llm/providerHealthState.ts` (within the +50 lines above)
- **Commit:** `b65be55`

### Auto-fixed runtime issues (Rule 1)

**3. [Rule 1 — Bug] Cases 1b + 2b would not find footer links when running with authenticated storageState.**

- **Found during:** First spec run (cases 1b, 2b timed out clicking `a[href="/legal/privacy"]`)
- **Issue:** The phase-35 Playwright project uses `storageState: 'tests/e2e/.auth/session.json'` (required for cases 3-4). Visiting `/` with an authenticated session routes to `Home` (App.tsx:69-94), not `LandingPage` — Home has no footer legal links.
- **Fix:** Changed `page.goto('/')` to `page.goto('/landing')` for cases 1b + 2b. The `/landing` route in App.tsx:67 always renders LandingPage regardless of auth state.
- **Files modified:** `tests/e2e/phase-35-production-hotfix.spec.ts`
- **Commit:** `1874394`

**4. [Rule 1 — Bug] Case 2c would not load /login when running authenticated.**

- **Found during:** First spec run
- **Issue:** `login.tsx:45-48` redirects authenticated users to `/` — so the Playwright spec's authenticated context could never see the login page footer.
- **Fix:** Case 2c spawns a fresh unauthenticated browser context via `browser.newContext({ storageState: undefined })`. Cleaned up in `finally` block. Spec signature changed to `async ({ browser })` for case 2c only.
- **Commit:** `1874394`

**5. [Rule 1 — Flake] Sequential Escape presses across Radix dialogs are flaky.**

- **Found during:** First successful 8-pass run had case 2c retry once
- **Issue:** After dismissing the Privacy dialog with Escape, immediately clicking the Terms anchor opens a new dialog — but the second Escape sometimes fails to dismiss it (Radix focus management + animation timing).
- **Fix:** (a) Replace second Escape with direct click on the dialog's close (X) button. (b) Assert `toHaveCount(0)` instead of `not.toBeVisible` to wait for the Radix close-animation unmount, not the fade transition.
- **Result:** 8/8 pass on 2 consecutive runs, no retries.
- **Commit:** `1874394`

### Wave-3 boundary discipline

The plan stated 35-05 should modify ONLY `tests/e2e/phase-35-production-hotfix.spec.ts`, `server/routes/health.ts`, and `playwright.config.ts`. This SUMMARY documents that we ALSO touched `server/llm/providerHealthState.ts` (+50 lines) and `server/routes.ts` (+9 lines) — both as Rule 1 fixes to make the plan's spec actually fire its broadcasts. The deviation is documented above with full context. All 10 existing provider-health unit tests (`scripts/test-provider-health-state.ts`) still pass after the changes, confirming no regression.

## Self-Check: PASSED

- `tests/e2e/phase-35-production-hotfix.spec.ts` — FOUND
- Commit `b65be55` — FOUND
- Commit `9b72ea3` — FOUND
- Commit `e06eed2` — FOUND
- Commit `1874394` — FOUND
- `npm run typecheck` — PASS (no errors)
- `npm run build` — PASS (5.57s, expected chunk-size warning is pre-existing)
- `npx playwright test tests/e2e/phase-35-production-hotfix.spec.ts` — 8/8 PASS on 2 consecutive runs
- `npx tsx scripts/test-provider-health-state.ts` — 10/10 PASS (no regression from the helper additions)

## Deploy gate status

| Step | Status | Evidence |
|---|---|---|
| D-18(a) — Playwright smoke pass | ✅ PASS | 8/8 green twice, 1.5-min runtime, 386-440ms toast-dismiss |
| D-18(b) — typecheck + build pass | ✅ PASS | both ran clean above |
| D-15 — runtime budget ≤ 5 min | ✅ PASS | 1.5 min actual (3.3× under budget) |
| D-16 — live restarted dev server | ✅ PASS | Playwright's webServer block spawned a fresh dev server on port 5001 |
| T-35-17 — DEV endpoints not exploitable in prod | ✅ PASS | Triple defense: (1) routes.ts:88-92 returns 403, (2) health.ts handlers return 404, (3) providerHealthState helpers throw FATAL |

**Ready for deploy.** User must explicitly approve `fly deploy` per the checkpoint protocol — production deploys never auto-trigger from auto-mode (per orchestrator spawn instructions).

## Files modified (final)

```
server/routes/health.ts                          | +71 (three DEV-only endpoints)
server/llm/providerHealthState.ts                | +50 (forceDegradedBroadcast, registerDegradedHook, __resetCountersOnly)
server/routes.ts                                 |  +9 (registerDegradedHook wiring + import)
tests/e2e/phase-35-production-hotfix.spec.ts     | +244 (NEW, 7 test cases)
playwright.config.ts                             | +14 (phase-35 project entry)
```

## Handoff

- AUDIT-01 closed.
- LEGAL-01 (35-04) + LLMUX-01/02/03 (35-01..03) all exercised by this spec — Phase 35 is feature-complete and verified in runtime.
- Awaiting user "deploy approved" signal to run `fly deploy`.
