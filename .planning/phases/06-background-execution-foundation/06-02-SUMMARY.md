---
phase: 06-background-execution-foundation
plan: 02
subsystem: safety
tags: [safety, autonomous-execution, tdd, risk-scoring]
dependency_graph:
  requires: []
  provides: [AUTONOMOUS_SAFETY_THRESHOLDS, evaluateSafetyScore.executionContext]
  affects: [server/ai/safety.ts]
tech_stack:
  added: []
  patterns: [TDD red-green-refactor, backward-compatible parameter extension]
key_files:
  created:
    - scripts/test-autonomous-safety.ts
  modified:
    - server/ai/safety.ts
decisions:
  - "AUTONOMOUS_SAFETY_THRESHOLDS placed before SAFETY_THRESHOLDS in file to be visually distinct — autonomous pipeline uses it directly, not via needsClarification"
  - "executionContext boost applied before clamping so stacked risks (risky keyword + autonomous) still clamp correctly at 1.0"
metrics:
  duration: "~8 minutes"
  completed: "2026-03-19"
  tasks_completed: 1
  files_changed: 2
---

# Phase 6 Plan 2: Autonomous Safety Context Extension Summary

**One-liner:** Extended `evaluateSafetyScore` with backward-compatible `executionContext` parameter that adds +0.10 executionRisk baseline for autonomous tasks, plus exported `AUTONOMOUS_SAFETY_THRESHOLDS` with stricter 0.60 clarification threshold.

---

## What Was Built

`server/ai/safety.ts` now accepts an optional `executionContext?: 'chat' | 'autonomous_task'` parameter. When `'autonomous_task'` is passed, `executionRisk` is boosted by +0.10 before clamping, and `'autonomous_context_risk_boost'` is pushed to the `reasons` array.

A new `AUTONOMOUS_SAFETY_THRESHOLDS` constant is exported with:
- `clarificationRequiredRisk: 0.60` (stricter than chat's 0.70)
- `peerReviewTrigger: 0.35` (same trigger point, explicit for autonomous pipeline use)

The autonomous pipeline can import and use `AUTONOMOUS_SAFETY_THRESHOLDS` directly for its own threshold checks. The existing `needsClarification` function and `SAFETY_THRESHOLDS` remain chat-only and unchanged.

---

## TDD Cycle

**RED:** `scripts/test-autonomous-safety.ts` created with Test 1 — asserts `executionRisk >= 0.20` for `autonomous_task` context on a benign message. Test failed: `executionRisk = 0.1`.
Commit: `3b35166 test(06-02): add failing test for autonomous safety executionContext boost`

**GREEN:** Added `executionContext` parameter to `evaluateSafetyScore`, +0.10 boost logic before clamping, and `AUTONOMOUS_SAFETY_THRESHOLDS` export. Tests 2-5 added incrementally (backward compat, risk stacking, threshold values) — all passed immediately upon adding.
Commit: `4074880 feat(06-02): extend evaluateSafetyScore with autonomous execution context`

**REFACTOR:** No refactoring needed — implementation was clean.

---

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 3b35166 | test | Add failing test for autonomous safety executionContext boost |
| 4074880 | feat | Extend evaluateSafetyScore with autonomous execution context |

---

## Verification

- `npm run gate:safety` — PASS (no regression on existing 3 safety cases)
- `npx tsc --noEmit` — PASS
- All 5 autonomous safety tests pass

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Self-Check

- [x] `server/ai/safety.ts` contains `executionContext?: 'chat' | 'autonomous_task'`
- [x] `server/ai/safety.ts` contains `autonomous_context_risk_boost`
- [x] `server/ai/safety.ts` exports `AUTONOMOUS_SAFETY_THRESHOLDS` with `clarificationRequiredRisk: 0.60`
- [x] `npm run gate:safety` exits 0
- [x] `npx tsc --noEmit` passes
- [x] Commits 3b35166 and 4074880 exist
