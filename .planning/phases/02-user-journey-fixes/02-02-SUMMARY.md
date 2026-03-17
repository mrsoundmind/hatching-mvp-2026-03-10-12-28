---
phase: 02-user-journey-fixes
plan: 02
subsystem: ui
tags: [react, sidebar, accordion, websocket, typing-indicator, streaming]

# Dependency graph
requires: []
provides:
  - "Team accordion behavior in LeftSidebar: one team open at a time"
  - "Typing indicator mutual exclusion: streaming_started clears typingColleagues"
affects: [home.tsx, CenterPanel.tsx, LeftSidebar interactions, streaming UX]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Accordion pattern: new Set([id]) replaces additive Set.add — consistent with project accordion"
    - "Streaming gate: setTypingColleagues([]) clears bottom-bar indicator when streaming_started fires"

key-files:
  created: []
  modified:
    - client/src/pages/home.tsx
    - client/src/components/CenterPanel.tsx

key-decisions:
  - "toggleTeamExpanded uses new Set([teamId]) on expand — matches toggleProjectExpanded pattern already established in same file"
  - "typingColleagues cleared immediately on streaming_started, not on streaming_completed — prevents any overlap window"

patterns-established:
  - "Accordion state: always return new Set([id]) on open, new Set() on close — never use additive Set.add"
  - "Streaming state gate: clear all pre-streaming UI state in the streaming_started handler"

requirements-completed: [UX-05, UX-08]

# Metrics
duration: 1min
completed: 2026-03-17
---

# Phase 2 Plan 02: Team Accordion and Typing Indicator Fix Summary

**Accordion-style team expansion (one open at a time) and mutual exclusion of the two typing indicator locations via streaming_started gate**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-03-17T12:08:06Z
- **Completed:** 2026-03-17T12:08:10Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Fixed `toggleTeamExpanded` and `handleSelectTeam` in `home.tsx` to use accordion pattern — clicking a team now collapses all others
- Added `setTypingColleagues([])` in `streaming_started` WS handler in `CenterPanel.tsx` — prevents simultaneous display of bottom-bar typing indicator and streaming message placeholder
- Full verification suite passes: typecheck, test:integrity, test:dto all green

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix team accordion — collapse others when expanding a team** - `f1444e1` (fix)
2. **Task 2: Fix typing indicator — clear typingColleagues when streaming starts** - `c5fc9d3` (fix)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `client/src/pages/home.tsx` - Fixed `toggleTeamExpanded` and `handleSelectTeam` to use `new Set([id])` on expand
- `client/src/components/CenterPanel.tsx` - Added `setTypingColleagues([])` in `streaming_started` handler

## Decisions Made
- Matched existing `toggleProjectExpanded` pattern exactly — no new patterns introduced, just consistency applied
- Cleared `typingColleagues` on `streaming_started` (not `streaming_chunk`) to eliminate the race window as early as possible

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- UX-05 and UX-08 requirements fulfilled
- Team sidebar navigation now behaves predictably with accordion pattern
- Typing indicator no longer creates confusing dual-location display
- Ready for next plan in phase 02-user-journey-fixes

## Self-Check: PASSED

- FOUND: client/src/pages/home.tsx
- FOUND: client/src/components/CenterPanel.tsx
- FOUND: .planning/phases/02-user-journey-fixes/02-02-SUMMARY.md
- FOUND: f1444e1 (Task 1 commit)
- FOUND: c5fc9d3 (Task 2 commit)
- typecheck: PASS
- test:integrity: PASS
- test:dto: PASS

---
*Phase: 02-user-journey-fixes*
*Completed: 2026-03-17*
