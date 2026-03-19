---
phase: 05
slug: route-architecture-cleanup
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | tsx (ts-node scripts) + tsc |
| **Config file** | tsconfig.json |
| **Quick run command** | `npm run typecheck` |
| **Full suite command** | `npm run typecheck && npm run test:integrity && npm run test:dto` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run typecheck`
- **After every plan wave:** Run `npm run typecheck && npm run test:integrity && npm run test:dto`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | ARCH-01 | typecheck | `npm run typecheck` | ✅ | ⬜ pending |
| 05-01-02 | 01 | 1 | ARCH-01 | typecheck | `npm run typecheck` | ✅ | ⬜ pending |
| 05-01-03 | 01 | 1 | ARCH-01 | typecheck | `npm run typecheck` | ✅ | ⬜ pending |
| 05-01-04 | 01 | 1 | ARCH-01 | typecheck + integrity | `npm run typecheck && npm run test:integrity && npm run test:dto` | ✅ | ⬜ pending |
| 05-02-01 | 02 | 2 | ARCH-01 | typecheck | `npm run typecheck` | ✅ | ⬜ pending |
| 05-02-02 | 02 | 2 | ARCH-02 | typecheck + full | `npm run typecheck && npm run test:integrity && npm run test:dto` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements — typecheck + existing test scripts are sufficient. No new test infrastructure needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| All routes respond identically post-split | ARCH-01 | Requires running server + HTTP requests | Start server, hit `/api/health`, `/api/projects`, `/api/conversations/:id/messages` — confirm 200s |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
