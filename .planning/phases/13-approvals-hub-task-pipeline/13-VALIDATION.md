---
phase: 13
slug: approvals-hub-task-pipeline
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-25
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (via `vitest.config.ts`) |
| **Config file** | `vitest.config.ts` — includes `scripts/**/*.test.ts` |
| **Quick run command** | `npm run typecheck` |
| **Full suite command** | `npm run typecheck && npx vitest run scripts/` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run typecheck`
- **After every plan wave:** Run `npm run typecheck && npx vitest run scripts/`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | APPR-01 | manual — React component | `npm run typecheck` | N/A | ⬜ pending |
| 13-01-02 | 01 | 1 | APPR-03 | unit | `npx vitest run scripts/test-approval-expiry.test.ts` | ✅ Plan 01 Task 1 | ⬜ pending |
| 13-01-03 | 01 | 1 | APPR-02 | unit | `npx vitest run scripts/test-task-pipeline-view.test.ts` | ✅ Plan 01 Task 1 | ⬜ pending |
| 13-02-01 | 02 | 2 | APPR-02 | manual — React component | `npm run typecheck` | N/A | ⬜ pending |
| 13-02-02 | 02 | 2 | APPR-04 | manual — React component | `npm run typecheck` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `scripts/test-approval-expiry.test.ts` — unit test for `isApprovalExpired` pure function (Plan 01 Task 1)
- [x] `scripts/test-task-pipeline-view.test.ts` — unit test for task status → pipeline stage mapping (Plan 01 Task 1)

*Visual component tests are manual-only — React component rendering tests would require `@testing-library/react` which is not currently installed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| ApprovalItem renders with approve/reject buttons | APPR-01 | React component visual rendering | Trigger a high-risk task, verify approval item appears in sidebar |
| Approve/Reject buttons call correct API | APPR-01 | Requires running server + WS | Click approve, verify task status changes |
| Empty state renders when no approvals | APPR-04 | React component rendering | View approvals tab with no pending items |
| Expired items show badge instead of buttons | APPR-03 | Requires time passage or mock | Wait 30min or mock updatedAt to verify expired state |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
