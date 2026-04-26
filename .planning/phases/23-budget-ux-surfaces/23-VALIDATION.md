---
phase: 23
slug: budget-ux-surfaces
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-26
---

# Phase 23 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | tsx + node:test (server logic), @playwright/test (UI behavior) |
| **Config file** | tsconfig.json + playwright.config.ts |
| **Quick run command** | `npm run typecheck` |
| **Full suite command** | `npm run typecheck && npx playwright test --project=chromium-light --grep="budget\|usage"` |
| **Estimated runtime** | ~30s typecheck, ~2 min playwright subset |

---

## Sampling Rate

- **After every task commit:** `npm run typecheck`
- **After every plan wave:** typecheck + Playwright budget specs
- **Before `/gsd:verify-work`:** Full suite green, including manual verification of in-character Maya hard-stop tone
- **Max feedback latency:** 30s typecheck, 120s playwright subset

---

## Per-Task Verification Map

> Filled in by planner. Tasks must reference these rows.

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 23-01-* | 01 | 1 | BUDG-04 | unit + e2e | `npm run typecheck && npx playwright test tests/e2e/v3-budget-ux.spec.ts -g "UsageBar autonomy row"` | ❌ Wave 0 | ⬜ pending |
| 23-02-* | 02 | 2 | BUDG-05 | e2e | `npx playwright test tests/e2e/v3-budget-ux.spec.ts -g "soft warn"` | ❌ Wave 0 | ⬜ pending |
| 23-03-* | 03 | 2 | BUDG-06, BUDG-07 | server unit + e2e | `tsx scripts/test-budget-block-event.ts && npx playwright test tests/e2e/v3-budget-ux.spec.ts -g "in-character"` | ❌ Wave 0 | ⬜ pending |
| 23-04-* | 04 | 2 | BUDG-08 | e2e | `npx playwright test tests/e2e/v3-budget-ux.spec.ts -g "free tier upgrade"` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/e2e/v3-budget-ux.spec.ts` — Playwright spec covering: UsageBar autonomy row visible at chat-header, soft-warn toast at 80%, in-character Maya hard-stop at 100%, Free-tier UpgradeModal trigger
- [ ] `scripts/test-budget-block-event.ts` — server unit asserting `logAutonomyEvent('budget_blocked', ...)` fires when `reserveBudgetSlot` returns false
- [ ] No new framework needed — Playwright + tsx already in use

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| In-character Maya hard-stop tone | BUDG-06 | "In-character" is a tone/voice quality, not a regex | At 100% autonomy budget, trigger an autonomous task; verify Maya's message reads like a teammate ("Looks like we've used up today's autonomy runs — back fresh tomorrow") not a system error ("quota exceeded: 50/50") |
| Mobile UsageBar layout at narrow widths | BUDG-04 | Visual clipping/truncation hard to assert in code | Open chat in mobile viewport (375px), verify autonomy row stacks readably and doesn't push other UI off-screen |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (1 Playwright spec + 1 server test script)
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter (set by planner once test scripts confirmed)

**Approval:** pending
