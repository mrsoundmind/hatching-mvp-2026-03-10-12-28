---
phase: 22
slug: atomic-budget-enforcement
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-26
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | tsx + node:test (existing pattern in scripts/) and @playwright/test for e2e |
| **Config file** | tsconfig.json (no separate test config; tsx executes .ts directly) |
| **Quick run command** | `npm run typecheck && npm run gate:safety` |
| **Full suite command** | `npm run qa:full` (typecheck + lint + build + key gates) |
| **Estimated runtime** | ~30–60 seconds for quick, ~3 minutes for full |

---

## Sampling Rate

- **After every task commit:** Run quick: `npm run typecheck`
- **After every plan wave:** Run gates: `npm run gate:safety && npm run test:integrity`
- **Before `/gsd:verify-work`:** Full suite must be green + concurrency test passes (10 concurrent → exactly K succeed)
- **Max feedback latency:** 60 seconds for typecheck; 90 seconds for safety gate

---

## Per-Task Verification Map

> Filled in by planner based on RESEARCH.md Validation Architecture section. Each plan's tasks must reference one row here.

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 22-01-01 | 01 | 1 | BUDG-01 | schema migration | `npm run typecheck` | ✅ existing | ⬜ pending |
| 22-01-02 | 01 | 1 | BUDG-01 | unit (storage) | `tsx scripts/test-budget-storage.ts` | ❌ Wave 0 | ⬜ pending |
| 22-01-03 | 01 | 2 | BUDG-01 | concurrency e2e | `tsx scripts/test-budget-race.ts` | ❌ Wave 0 | ⬜ pending |
| 22-02-01 | 02 | 2 | BUDG-02 | unit (release) | `tsx scripts/test-budget-storage.ts` | ❌ Wave 0 | ⬜ pending |
| 22-03-01 | 03 | 3 | BUDG-03 | reconciliation | `tsx scripts/test-budget-reconcile.ts` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/test-budget-storage.ts` — unit tests for `reserveBudgetSlot()` and `releaseBudgetSlot()` storage methods
- [ ] `scripts/test-budget-race.ts` — concurrency integration test: spawn 10 concurrent reserve calls against limit=5, assert exactly 5 succeed
- [ ] `scripts/test-budget-reconcile.ts` — reconciliation drift test: simulate counter drift vs autonomy_events, assert reconciliation logs and self-corrects
- [ ] Existing `scripts/test-integrity.ts` continues to pass with new ledger in place

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Daily reconciliation runs at scheduled time on real Neon DB | BUDG-03 | Cron timing on real infra not mockable in unit test | After deploy, observe scheduled job logs at next reconciliation tick; verify drift_logged metric appears in autonomy_events |
| `chat.ts` inactivity-trigger budget check removed without breaking inactivity flow | BUDG-01 (success criterion #4) | Inactivity trigger fires on real timing; confirm pipeline-side check still gates correctly | Set short inactivity threshold in dev, verify task is gated by pipeline budget (not chat.ts), verify single budget check in audit log |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (3 new test scripts)
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter (set by planner once test scripts confirmed)

**Approval:** pending
