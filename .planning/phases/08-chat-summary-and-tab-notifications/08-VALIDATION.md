---
phase: 08
slug: chat-summary-and-tab-notifications
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 08 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | tsx script tests (npx tsx scripts/test-*.ts) |
| **Config file** | none — scripts use direct imports |
| **Quick run command** | `npx tsx scripts/test-return-briefing.ts` |
| **Full suite command** | `npx tsx scripts/test-return-briefing.ts && npx tsx scripts/test-tab-notifications.ts` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsx scripts/test-return-briefing.ts`
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | UX-03 | unit | `npx tsx scripts/test-return-briefing.ts` | ❌ W0 | ⬜ pending |
| 08-02-01 | 02 | 1 | UX-05 | unit | `npx tsx scripts/test-tab-notifications.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/test-return-briefing.ts` — stubs for UX-03 (briefing content, idempotency, absence detection)
- [ ] `scripts/test-tab-notifications.ts` — stubs for UX-05 (flashing title, count badge, Notification API)

*Existing test infrastructure (tsx scripts pattern) covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Flashing tab title visible | UX-05 | Browser rendering | Open app, trigger background_execution_completed while tab hidden, verify title alternates |
| OS notification appears | UX-05 | Browser permission | Grant notification permission, trigger completion while tab hidden, verify OS popup |
| Briefing feels natural in Maya's voice | UX-03 | Subjective quality | Read generated briefing, confirm it sounds like Maya not a template |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
