---
phase: 28
slug: maya-bug-fix-sdk-migration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-26
---

# Phase 28 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (`@playwright/test ^1.58.2`) + custom scripts in `scripts/` (Node + tsx) |
| **Config file** | `playwright.config.ts` at project root |
| **Quick run command** | `npm run typecheck` |
| **Full suite command** | `npm run qa:full && npx playwright test tests/e2e/stop-button.spec.ts tests/e2e/maya-fallback.spec.ts` |
| **Estimated runtime** | ~90 seconds (typecheck + 2 Playwright specs) |

---

## Sampling Rate

- **After every task commit:** Run `npm run typecheck` (must pass before any commit lands)
- **After every plan wave:** Run `npm run typecheck && npx playwright test tests/e2e/stop-button.spec.ts tests/e2e/maya-fallback.spec.ts`
- **Before `/gsd:verify-work`:** Full suite green — all 6 BUG-XX requirements have a green automated test
- **Max feedback latency:** 90 seconds (typecheck ~30s, 2 Playwright specs ~60s combined)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 28-01-01 | 01 | 0 | infra | Wave 0 | `npm install` (no new deps for Playwright/scripts) | ✅ existing | ⬜ pending |
| 28-01-02 | 01 | 1 | infra/W0 | unit (import check, gates BUG-01) | `node -e "require('@google/genai'); try { require('@google/generative-ai'); process.exit(1); } catch {}; console.log('ok')"` | ❌ W0 (script) | ⬜ pending |
| 28-01-03 | 01 | 1 | infra/W0 | typecheck (gates BUG-01) | `npm run typecheck` | ✅ existing | ⬜ pending |
| 28-02-01 | 02 | 1 | BUG-02 | unit (signal propagation) | `tsx scripts/test-abort-signal-propagation.ts` | ❌ W0 | ⬜ pending |
| 28-02-02 | 02 | 1 | BUG-02 | integration (mock hang) | `tsx scripts/test-gemini-abort.ts` | ❌ W0 | ⬜ pending |
| 28-03-01 | 03 | 2 | BUG-03 | integration (WS) | `tsx scripts/test-streaming-timeout-cleanup.ts` | ❌ W0 | ⬜ pending |
| 28-03-02 | 03 | 2 | BUG-03 | integration (typing_stopped) | Same script — assert event sequence | ❌ W0 | ⬜ pending |
| 28-04-01 | 04 | 2 | BUG-04 | E2E (Playwright) | `npx playwright test tests/e2e/maya-fallback.spec.ts` | ❌ W0 | ⬜ pending |
| 28-04-02 | 04 | 2 | BUG-04 | E2E (negative case) | Same spec, timeout scenario | ❌ W0 | ⬜ pending |
| 28-05-01 | 05 | 2 | BUG-05 | unit (cleanup) | `tsx scripts/test-abort-cleanup.ts` | ❌ W0 | ⬜ pending |
| 28-05-02 | 05 | 2 | BUG-05 | load test (heap) | `tsx scripts/test-abort-heap.ts` | ❌ W0 | ⬜ pending |
| 28-03-01 | 03 | 1 | BUG-06 | E2E (Playwright) — success path | `npx playwright test tests/e2e/stop-button.spec.ts -g "success"` | ❌ W0 | ⬜ pending |
| 28-03-02 | 03 | 1 | BUG-06 | E2E (Playwright) — cancel path | `npx playwright test tests/e2e/stop-button.spec.ts -g "cancel"` | ❌ W0 | ⬜ pending |
| 28-03-03 | 03 | 1 | BUG-06 | E2E (Playwright) — error path | `npx playwright test tests/e2e/stop-button.spec.ts -g "error"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Wave 0 must create these test scaffolds before downstream tasks can verify themselves:

- [ ] `scripts/test-abort-signal-propagation.ts` — unit test asserting `LLMRequest.signal` flows from `openaiService.ts` to a mock provider
- [ ] `scripts/test-gemini-abort.ts` — integration test with mock-hung provider; asserts generator terminates within 31s when `AbortSignal.timeout(30_000)` fires
- [ ] `scripts/test-streaming-timeout-cleanup.ts` — WS integration test asserting `typing_stopped` event fires before `streaming_error` on timeout path
- [ ] `scripts/test-abort-cleanup.ts` — unit test asserting `ws.__currentAbortController` is `undefined` after stream `finally` block
- [ ] `scripts/test-abort-heap.ts` — load test using `v8.getHeapStatistics()`; asserts heap delta < 50MB after 50 concurrent aborted streams
- [ ] `tests/e2e/stop-button.spec.ts` — Playwright E2E covering 3 scenarios: success completion, user-initiated cancel, streaming_error
- [ ] `tests/e2e/maya-fallback.spec.ts` — Playwright E2E covering: no spurious fallback on 4-8s slow response (BUG-04); proper error message on actual timeout

**Framework setup:** Playwright `^1.58.2` already installed. `tsx` already available via `npx`. No new dev deps required.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real Gemini SDK abort behavior | BUG-02 | The mock provider may behave differently than the real `@google/genai` 1.50.x SDK on AbortSignal | After Wave 1 lands: send a message, click stop within 2s; verify in browser devtools network tab that the underlying Gemini fetch shows aborted state, not just client-side ignored |
| Production heap behavior under sustained chat load | BUG-05 | Load test simulates 50 aborts sequentially; real users may produce different patterns (long-lived sessions, slow aborts) | After Wave 2 lands: run on Fly machine for 1 hour with 5 concurrent test conversations alternating send/abort; check `process.memoryUsage()` from `/api/health` endpoint; should not grow > 100MB over baseline |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (verified — every task above has an automated command or is W0 scaffold)
- [ ] Wave 0 covers all MISSING references (verified — 7 W0 scripts/specs listed)
- [ ] No watch-mode flags (verified — all commands use single-run mode)
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter (set after planner produces PLAN.md files and Wave 0 tasks are confirmed)

**Approval:** pending
