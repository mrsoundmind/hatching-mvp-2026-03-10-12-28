---
phase: 12
slug: handoff-visualization
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 1.x (via `vitest.config.ts`) |
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
| 12-01-01 | 01 | 1 | HAND-01 | manual — React component visual | `npm run typecheck` | N/A | ⬜ pending |
| 12-01-02 | 01 | 1 | HAND-04 | manual — UI interaction | `npm run typecheck` | N/A | ⬜ pending |
| 12-02-01 | 02 | 2 | HAND-02 | unit | `npx vitest run scripts/test-handoff-timeline.test.ts` | ❌ W0 | ⬜ pending |
| 12-02-02 | 02 | 2 | HAND-03 | manual — UI interaction | `npm run typecheck` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/test-handoff-timeline.test.ts` — unit test for HandoffChainTimeline traceId grouping logic (pure function, no DOM needed)

*Visual component tests are manual-only — React component rendering tests would require `@testing-library/react` which is not currently installed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| HandoffCard renders with avatars and arrow | HAND-01 | React component visual rendering | Trigger a handoff in chat, verify card appears with from/to avatars |
| Manual handoff dropdown shows agents | HAND-03 | UI interaction flow | Click "Hand off to..." in chat input, verify agent dropdown appears |
| DeliberationCard collapses/expands | HAND-04 | UI interaction flow | Trigger multi-agent coordination, verify collapsible card appears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
