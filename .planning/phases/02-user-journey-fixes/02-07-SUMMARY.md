---
phase: 02-user-journey-fixes
plan: 07
subsystem: ui
tags: [framer-motion, animation, react, accordion, sidebar]

# Dependency graph
requires:
  - phase: 02-user-journey-fixes
    provides: ProjectTree.tsx with team accordion expand/collapse
provides:
  - Team agent list collapse animation with AnimatePresence and motion.div height transition
affects: [ProjectTree, LeftSidebar, team accordion UX]

# Tech tracking
tech-stack:
  added: []
  patterns: [AnimatePresence initial=false with motion.div height/opacity animation for accordion collapse]

key-files:
  created: []
  modified:
    - client/src/components/ProjectTree.tsx

key-decisions:
  - "Used initial={false} on AnimatePresence so teams already expanded on page load do not animate in"
  - "Used key={agents-team.id} to ensure AnimatePresence tracks per-team enter/exit independently"
  - "Applied overflow-hidden on motion.div to prevent content overflow during height transition"
  - "Set duration 0.18s easeInOut matching existing transition-all duration-200 used in ProjectTree"

patterns-established:
  - "Accordion pattern: AnimatePresence initial={false} > motion.div key={id} height 0/auto opacity 0/1 overflow-hidden"

requirements-completed:
  - UX-05

# Metrics
duration: 5min
completed: 2026-03-18
---

# Phase 2 Plan 07: Team Accordion Collapse Animation Summary

**Framer Motion AnimatePresence height animation added to ProjectTree team accordion so collapse exits smoothly instead of snapping to zero**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-18T00:00:00Z
- **Completed:** 2026-03-18T00:05:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added `AnimatePresence` + `motion` import from framer-motion to ProjectTree.tsx
- Wrapped every `{isTeamExpanded && ...}` team agent list in `<AnimatePresence initial={false}>` with a `motion.div` that animates height 0 → auto on enter and auto → 0 on exit
- `overflow-hidden` on motion.div prevents content bleed during transition
- Unique `key={agents-${team.id}}` ensures AnimatePresence correctly tracks independent enter/exit per team
- TypeScript check passes with zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Wrap team agent list in AnimatePresence for smooth collapse animation** - `868b001` (feat)

**Plan metadata:** _(see final commit below)_

## Files Created/Modified
- `client/src/components/ProjectTree.tsx` - Added AnimatePresence import and motion.div wrapper around team agent list conditional render

## Decisions Made
- Used `initial={false}` so teams already open when the sidebar first renders don't play an expand animation on load — only user-triggered toggles animate.
- Kept the inner `<div className="ml-7 space-y-0.5">` and all agent row children unchanged; only the outer conditional wrapper changed.
- Duration 0.18s chosen to match existing `transition-all duration-200` already in use across ProjectTree rows.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- UX-05 gap item closed; team accordion now animates smoothly on both expand and collapse for first, middle, and last team positions.
- Remaining Phase 2 gap items still open: UX-07 (first reply color flash), UX-08 (multiple typing indicators), DATA-04 (initial avatar load flash), UX-01/UX-02 (project creation name prompt).

---
*Phase: 02-user-journey-fixes*
*Completed: 2026-03-18*

## Self-Check: PASSED
- ProjectTree.tsx: FOUND
- 02-07-SUMMARY.md: FOUND
- Commit 868b001: FOUND
