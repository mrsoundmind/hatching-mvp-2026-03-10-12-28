---
phase: 09-progressive-trust-and-inactivity-trigger
plan: 01
subsystem: testing
tags: [trust-scoring, safety-gates, schema, typescript, behavioral-tests]

# Dependency graph
requires:
  - phase: 06-background-execution-foundation
    provides: taskExecutionPipeline with updateAgentTrustScore call sites
  - phase: 07-agent-handoffs-and-approval-ui
    provides: peer review + safety gate integration context
provides:
  - trustMeta field in agents.personality schema type (no as any casts needed)
  - 10 behavioral tests exercising calculateTrustScore, updateTrustMeta, getAdjustedThresholds
affects:
  - 09-02 (inactivity trigger uses trust scoring — type changes affect downstream)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "JSONB type annotation inlines shape rather than importing from server/ (shared/ must not import from server/)"
    - "Behavioral tests import functions directly and assert on return values (not file existence)"

key-files:
  created: []
  modified:
    - shared/schema.ts
    - scripts/test-trust-scoring.ts

key-decisions:
  - "trustMeta shape inlined in schema.ts rather than re-exporting TrustMeta from trustScorer.ts — prevents server/ import in shared/"
  - "Test file rewrites old 8 file-existence checks with 10 behavioral tests that call real functions"

patterns-established:
  - "Trust score formula: success_rate * maturity_factor, bounded [0,1], MATURITY_THRESHOLD=10"
  - "getAdjustedThresholds(0.0) returns exact baseline; getAdjustedThresholds(1.0) adds +0.15 to both thresholds"

requirements-completed: [SAFE-04]

# Metrics
duration: 8min
completed: 2026-03-23
---

# Phase 9 Plan 01: Trust Scoring Schema Type and Behavioral Tests Summary

**trustMeta added to agents.personality JSONB type annotation, plus 10 behavioral tests verifying trust score math, updateTrustMeta round-trip, and getAdjustedThresholds at baseline/max/midpoint trust**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-23T02:28:00Z
- **Completed:** 2026-03-23T02:36:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- agents.personality JSONB type now includes trustMeta as an optional typed field — no more `as any` needed for trust access in taskExecutionPipeline.ts and trustScorer.ts
- scripts/test-trust-scoring.ts fully rewritten: 9 file-existence checks replaced by 10 behavioral tests that actually call calculateTrustScore, updateTrustMeta, and getAdjustedThresholds
- All 10 tests pass with exit code 0; typecheck passes cleanly with no new errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Add trustMeta to agents.personality schema type annotation** - `0220221` (feat)
2. **Task 2: Replace file-existence tests with behavioral trust scoring tests** - `57b8e49` (test)

**Plan metadata:** see final commit below

## Files Created/Modified
- `shared/schema.ts` - Added `trustMeta?: { tasksCompleted: number; tasksFailed: number; trustScore: number; lastUpdated: string }` to agents.personality JSONB type
- `scripts/test-trust-scoring.ts` - Rewrote with 10 behavioral tests importing real trust functions; removed all fs.existsSync/fs.readFileSync calls

## Decisions Made
- trustMeta shape inlined in shared/schema.ts rather than importing TrustMeta type from server/autonomy/trustScoring/trustScorer.ts — the shared/ boundary must not import from server/ (plan explicitly states this constraint)
- No db:push required — JSONB columns are schema-less at DB level; this is a TypeScript-only correctness fix

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SAFE-04 trust scoring type is now complete and type-safe
- 10 behavioral tests serve as regression protection for trust math
- Phase 9 Plan 02 (inactivity trigger) can proceed — trustMeta type will be available in agent.personality without casts

---
*Phase: 09-progressive-trust-and-inactivity-trigger*
*Completed: 2026-03-23*
