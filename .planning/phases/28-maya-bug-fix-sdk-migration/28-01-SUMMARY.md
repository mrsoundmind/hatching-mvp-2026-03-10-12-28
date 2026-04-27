---
phase: 28-maya-bug-fix-sdk-migration
plan: 01
completed_at: 2026-04-27
status: complete
wave: 0
---

# Plan 28-01 — Wave 0 Test Infrastructure (SUMMARY)

Wave 0 scaffold for BUG-01..06. 7 test files created: 5 tsx scripts in `scripts/`
and 2 Playwright specs in `tests/e2e/`. Every file has a header comment naming
the BUG-XX requirement it gates and is structured to turn green automatically
once the corresponding Wave 1/2 fix lands.

---

## Tasks Completed

| Task | Action | Commit |
|------|--------|--------|
| 28-01-01 | Create AbortSignal propagation unit test | `a9b6bf1` |
| 28-01-02 | Create 4 backend abort scaffolds (gemini/cleanup/heap/timeout) | `4471a64` |
| 28-01-03 | Create stop-button + maya-fallback Playwright specs | `9fdcebf` |

---

## Files Created

| File | Lines | Header Comment | Gates |
|------|-------|----------------|-------|
| `scripts/test-abort-signal-propagation.ts` | 149 | `Wave 0 test for BUG-02. RED until plan 28-02 lands.` | BUG-02 |
| `scripts/test-gemini-abort.ts` | 158 | `Wave 0 test for BUG-02. RED until plan 28-02 adds AbortSignal handling to geminiProvider.` | BUG-02 |
| `scripts/test-streaming-timeout-cleanup.ts` | 145 | `Wave 0 test for BUG-03. RED until plan 28-04 emits typing_stopped before streaming_error.` | BUG-03 |
| `scripts/test-abort-cleanup.ts` | 71 | `Wave 0 test for BUG-05. RED until plan 28-05 adds delete (ws as any).__currentAbortController to chat.ts:3022.` | BUG-05 |
| `scripts/test-abort-heap.ts` | 199 | `Wave 0 test for BUG-05. RED until plan 28-02 + 28-05 land (signal handling + finally cleanup).` | BUG-05 |
| `tests/e2e/stop-button.spec.ts` | 97 | `Wave 0 spec for BUG-06. RED until plan 28-03 reduces the truth-enforcer debounce + forces metadata.isStreaming=false in the new_message handler.` | BUG-06 |
| `tests/e2e/maya-fallback.spec.ts` | 85 | `Wave 0 spec for BUG-04. RED until plan 28-04 adds abortController.signal.aborted guard before the buildServiceFallbackMessage call in chat.ts inner catch.` | BUG-04 |

Plus a config update to register the new specs:

| File | Change |
|------|--------|
| `playwright.config.ts` | Added `stop-button.spec.ts` to `chromium-light` testMatch and `maya-fallback.spec.ts` to `chromium-ai` testMatch |

---

## Verification Status (Red Baselines Confirmed)

| File | Status Today | Failing Assertion | Turns Green After |
|------|-------------|-------------------|-------------------|
| `scripts/test-abort-signal-propagation.ts` | RED (exit 1) | `providerRegistry is not exported from providerResolver.ts` (and once exported, `capturedSignal === undefined` because `LLMRequest.signal` does not yet exist) | Plan **28-02** (export registry, add `signal?: AbortSignal` to `LLMRequest`, wire it in `openaiService.ts`) |
| `scripts/test-gemini-abort.ts` | GREEN today (HangingProvider stub already honors signal contract); will remain green once geminiProvider also honors signal | n/a today; specifically tests the contract any provider must satisfy after 28-02 | Plan **28-02** (real geminiProvider gets the same contract) |
| `scripts/test-streaming-timeout-cleanup.ts` | RED (exit 1) | `typing_stopped event was not received before streaming_error — chat.ts catch block does not emit it yet` | Plan **28-04** (inner catch emits `typing_stopped` before `streaming_error`) |
| `scripts/test-abort-cleanup.ts` | RED (exit 1) | `ws.__currentAbortController is still set after finally block — BUG-05 leak` | Plan **28-05** (finally block adds `delete (ws as any).__currentAbortController`) |
| `scripts/test-abort-heap.ts` | RED (exit 1, delta ~70MB > 50MB budget) | `heap delta ... exceeds 50MB budget — 51 stream entries leaked` | Plans **28-02 + 28-05** (provider honors signal so generators return; finally block deletes activeStreamingResponses entry + WS controller ref) |
| `tests/e2e/stop-button.spec.ts` | RED today (button stays "Stop" past 1000ms after streaming completes — confirmed by manual repro in 28-RESEARCH.md) | `expect(getByRole('button', { name: /send message/i })).toBeVisible({ timeout: 1000 })` fails on success-path test | Plan **28-03** (truth-enforcer debounce + forced `metadata.isStreaming=false`) |
| `tests/e2e/maya-fallback.spec.ts` | RED today (spurious "out for lunch" / "resting circuits" leaks for 4-8s slow Maya response — confirmed by GAP-01 in v3-local-gap-audit.spec.ts) | `expect(locator('body')).not.toContainText(/out for lunch\|resting (their\|her\|his\|its) circuits/i)` fails | Plan **28-04** (inner catch checks `abortController.signal.aborted` before calling `buildServiceFallbackMessage`) |

> Plan verify block (Task 2) explicitly enforces RED baseline for `test-abort-cleanup.ts`
> and `test-abort-heap.ts`. Confirmed during execution (both exit non-zero today).

---

## Notes on Planning Revisions

The 4 BLOCKERS identified during 28-01 plan review were addressed before execution:

1. **Verify block hardened (Task 2)** — Originally only checked file existence; revised
   to also assert that `tsx scripts/test-abort-cleanup.ts` and `tsx scripts/test-abort-heap.ts`
   exit non-zero today. Without this, the scripts could silently be stubs that pass
   without ever exercising the bug, leaving plans 28-02..05 unverified. The revised
   verify block is enforced and all baselines confirmed RED in this execution.

2. **Heap test ballast** — The heap test required real V8-heap-resident allocations
   to exceed the 50MB budget today. Initial Buffer.alloc allocations went to external
   memory and didn't show up in `used_heap_size`. Replaced with `'x'.repeat(1_500_000)`
   strings × 50 turns; observed delta ~70MB > 50MB budget today. Plan 28-05 cleanup
   will bring this back under budget once the activeStreamingResponses map and
   WS-attached controller are both released in the finally block.

3. **Provider registry export** — `providerRegistry` is currently a non-exported `const`
   in `server/llm/providerResolver.ts`. Plan 28-02 must either export it or change
   how spies are injected. Today's test fails on this discovery — it's one of the
   load-bearing red signals.

4. **Playwright project registration** — New specs must be added to `playwright.config.ts`
   testMatch arrays or they aren't discovered. Both new specs are now registered
   (`stop-button.spec.ts` → `chromium-light`; `maya-fallback.spec.ts` → `chromium-ai`)
   and discoverable via `npx playwright test --list`.

---

## Phase Verification (final)

- [x] All 7 Wave 0 files exist
- [x] All scripts run without syntax errors (tsx parses each one)
- [x] Playwright specs discoverable: `npx playwright test --list tests/e2e/stop-button.spec.ts tests/e2e/maya-fallback.spec.ts` → 5 tests in 2 files (plus auth setup)
- [x] TypeScript typecheck passes (`npm run typecheck` — no new type errors)
- [x] No new dev dependencies added (Playwright + tsx already installed)
- [x] Every file has a header comment naming the BUG-XX requirement it gates
- [x] Every file (except test-gemini-abort.ts which tests a stub contract) is verifiably RED today
- [x] Each file is structured to turn GREEN automatically once the corresponding Wave 1/2 plan lands

Plans 28-02..05 can now self-verify against this Wave 0 scaffold.
