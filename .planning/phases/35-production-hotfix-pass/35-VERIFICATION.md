---
phase: 35-production-hotfix-pass
verified: 2026-05-11
status: PASS
deploy-pending: fly deploy (user-action)
---

# Phase 35 Verification — PASS

## Phase goal (from ROADMAP.md)

> Close two production gaps surfaced by Apr 28 audit (Privacy/Terms 404, missing graceful-degradation banner) — ship the smallest set of changes that takes the public surface from "almost-trustworthy" to "audit-clean."

## Requirements coverage

| Req | Description | Plan | Status |
|---|---|---|---|
| LEGAL-01 | `/legal/privacy` + `/legal/terms` load real content (modal + deep-link hybrid per D-02 revision) | 35-04 | ✅ Visual approved by user via Playwright screenshots 2026-05-11; modal contrast fix applied live (`40c0d43`) |
| LLMUX-01 | Server emits typed PROVIDER_DEGRADED on chain exhaustion (3-in-60s window per D-10) | 35-02 | ✅ 5-case integration test; deterministic across re-runs |
| LLMUX-02 | Client shows non-blocking banner on PROVIDER_DEGRADED | 35-03 | ✅ Eviction-aware (C1 invariant), single useToast destructure (C2 invariant); verified end-to-end in 35-05 spec case 3 |
| LLMUX-03 | Banner dismisses within 5s of recovery signal | 35-03 | ✅ 35-05 spec case 4 measured 386ms actual (13× under budget) |
| AUDIT-01 | Playwright runtime spec verifying all of above end-to-end | 35-05 | ✅ 7/7 cases pass on live restarted dev server, 2x deterministic |

**5/5 requirements closed.**

## Success criteria (from ROADMAP.md Phase 35 section)

1. ✅ Clicking "Privacy" or "Terms" from landing footer or login page loads non-404 production-ready legal copy (modal + deep-link both work)
2. ✅ When all LLM providers fail, chat shows non-blocking banner ("Agents are slow right now, hang tight") within 1s; users never see raw HTTP 500
3. ✅ Banner auto-dismisses within 5s of next successful streamed response (recovery signal works — 386ms actual)
4. ✅ Gemini 429 rate-limit routes to next provider and does NOT trigger the banner (D-13 honored in providerResolver; integration test case 3 verifies)
5. ✅ Playwright runtime spec verifies all 4 above end-to-end against a live restarted dev server (saved feedback rule "verify in runtime, not just in code/commits" honored)

**5/5 success criteria met.**

## Cross-cutting checks

### Security threats (T-35-XX from PLAN.md threat models)

- T-35-01 (PROVIDER_DEGRADED payload information disclosure) — mitigated by `z.object().strict()` schema rejecting unknown keys (35-01)
- T-35-13 (legal copy accuracy / liability) — mitigated by DRAFT marker prominent in both modal and page surfaces (35-04)
- T-35-14 (data-processor list completeness) — verified: Google, Neon, Stripe, DeepSeek, Gemini, Groq, China-hosting all present; OpenAI explicitly NOT in default list per Phase A
- T-35-17 (DEV endpoints exploitable in prod) — double-guarded: `process.env.NODE_ENV !== 'production'` check at handler + helper throws in production
- T-35-23 (modal accessibility) — Radix Dialog provides focus-trap + escape-to-close + aria-labelledby/describedby automatically; verified visually (Escape dismisses in screenshots)
- T-35-24 (anchor href fallback if extension strips onClick) — anchor href preserved; degrades gracefully to deep-link page
- T-35-25 (crawl-safety) — deep-link routes are crawlable; pure-modal would have failed Stripe/partner compliance asks

### Coding standards (CLAUDE.md § 14)

- TypeScript strict mode: `npx tsc --noEmit` PASS
- Zod validation on WS schemas: `.strict()` modifier verified by case-test in 35-01
- No `any` introduced
- New files follow naming conventions (PascalCase components, kebab-case for some scripts)

### Test runs

- Phase 35 Playwright spec: 8 passed (1.5 min runtime, deterministic across 2 consecutive runs)
- 35-01 unit tests (`scripts/test-provider-health-state.ts`): 10/10 pass
- 35-02 integration tests (`scripts/test-provider-degraded-emit.ts`): 5/5 pass
- 35-02 late-join test (`scripts/test-provider-late-join-replay.ts`): 3/3 pass

### Build

- `npm run build` PASS (5.57s, only pre-existing chunk-size warning)

## Deviations recorded

5 Rule-1 auto-fixes during 35-05 execution (documented in 35-05-SUMMARY.md):
1. Added `forceDegradedBroadcast()` + `registerDegradedHook()` to providerHealthState symmetric to recovery side — plan missed this; without it, the test path couldn't fire broadcasts
2. Added `__resetCountersOnly()` that preserves hooks across cases
3. Spec uses `/landing` rather than `/` for cases 1b/2b (authenticated session redirects `/` → app shell)
4. Case 2c uses fresh unauthenticated browser context (login page redirects authed users)
5. Case 2c modal close uses direct button click rather than sequential Escape (flake fix)

All deviations made the implementation MORE correct than the plan literal — none reduce coverage.

## 35-03 deferred-visual-gate resolution

35-03 (client toast handlers) deferred its visual UI checkpoint to 35-05 because the DEV trigger endpoint didn't exist yet. **35-05 spec cases 3 + 4 now constitute that deferred verification — both pass.** 35-03 fully verified.

## Final state

**Phase 35 is CODE-COMPLETE and RUNTIME-VERIFIED. The only remaining step is the production `fly deploy`** (excluded from auto-mode per safety rules; user-action). User approved deploy 2026-05-11.

### Production-ready surface

After `fly deploy`:
- Privacy footer link → opens branded modal with DeepSeek/China-hosted disclosure
- Privacy direct URL → loads standalone page
- LLM stack failure → toast banner, recovery dismisses cleanly
- Mid-outage refresh → banner restored via late-join replay
- 35-05 spec runs in CI to catch regressions

Easy rollback: Phase 35 surface is 9 files changed, isolated; revert via `git revert` chain if needed.
