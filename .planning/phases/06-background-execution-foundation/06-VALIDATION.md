---
phase: 6
slug: background-execution-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript scripts (scripts/test-*.ts) + npm run typecheck |
| **Config file** | tsconfig.json |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npm run typecheck && npm run test:dto && npm run test:integrity` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npm run typecheck && npm run test:dto && npm run test:integrity`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | EXEC-03 | unit | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 1 | EXEC-01, SAFE-02 | unit | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 06-03-01 | 03 | 2 | EXEC-02, SAFE-01, SAFE-03 | integration | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 06-04-01 | 04 | 2 | UX-02 | manual | browser test | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/test-autonomy-trigger.ts` — stubs for EXEC-01 trigger detection
- [ ] `scripts/test-cost-cap.ts` — stubs for EXEC-03 daily spend cap enforcement
- [ ] `scripts/test-execution-pipeline.ts` — stubs for EXEC-02 task execution + output storage

*Existing test infrastructure (typecheck, dto, integrity) covers type safety.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| "Team is working..." indicator in chat | UX-02 | Visual WebSocket-driven UI | Send trigger message, verify indicator appears in chat panel |
| Approval request surfaces in chat | SAFE-01 | Visual WS event rendering | Create high-risk task, verify approval request shown to user |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
