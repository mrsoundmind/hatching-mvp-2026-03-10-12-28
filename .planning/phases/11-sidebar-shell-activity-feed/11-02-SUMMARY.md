---
phase: 11-sidebar-shell-activity-feed
plan: 02
subsystem: ui
tags: [react, framer-motion, sidebar, tabs, css-hide, empty-state]

# Dependency graph
requires:
  - phase: 11-01
    provides: useAutonomyFeed hook with unreadCount, useSidebarEvent hook, autonomyEvents registry
provides:
  - 3-tab sidebar shell (Activity, Brain & Docs, Approvals)
  - SidebarTabBar component with spring-animated indicator and badge counts
  - EmptyState reusable component
  - activeTab state persisted to localStorage
  - CSS-hidden tab panels (preserves scroll/draft state)
affects: [11-03 (ActivityTab), 12 (handoff viz), 13 (approvals hub), 14 (brain redesign), 15 (polish)]

# Tech tracking
tech-stack:
  added: []
  patterns: [CSS-hide tab panels with display:none, Framer Motion layoutId for tab indicators, separate layoutId namespaces to avoid conflicts]

key-files:
  created:
    - client/src/components/sidebar/SidebarTabBar.tsx
    - client/src/components/ui/EmptyState.tsx
  modified:
    - client/src/components/RightSidebar.tsx
    - client/src/hooks/useRightSidebarState.ts
    - shared/schema.ts

key-decisions:
  - "CSS-hide pattern (display:none) instead of conditional unmount to preserve scroll position and form draft state across tab switches"
  - "Renamed inner overview/tasks layoutId from tab-indicator to brain-tab-indicator to avoid Framer Motion animation conflicts with parent sidebar-tab"
  - "Agent and team views also wrapped inside Brain & Docs tab panel for consistent 3-tab experience"

patterns-established:
  - "CSS-hide tabs: use style={{ display: condition ? 'flex' : 'none' }} with aria-hidden for accessibility"
  - "Separate layoutId namespaces: sidebar-tab for top-level tabs, brain-tab-indicator for nested sub-tabs"
  - "EmptyState component pattern: icon + title + description + optional CTA button"

requirements-completed: [SIDE-01, SIDE-02, SIDE-03, SIDE-04, FEED-05]

# Metrics
duration: 6min
completed: 2026-03-25
---

# Phase 11 Plan 02: Sidebar Tab Shell Summary

**3-tab right sidebar shell with CSS-hidden panels, spring-animated SidebarTabBar, badge counts, and EmptyState primitives**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-25T07:04:12Z
- **Completed:** 2026-03-25T07:10:07Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Right sidebar restructured from single-view to 3-tab layout (Activity, Brain & Docs, Approvals)
- All existing brain editing, agent profile, and team dashboard content preserved unchanged inside Brain & Docs tab
- Tab selection persists via localStorage and survives page reload
- Unread activity count badge wired from useAutonomyFeed hook
- CSS-hidden panels preserve scroll position and form draft state across tab switches

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend useRightSidebarState + create SidebarTabBar + EmptyState** - `9383df1` (feat)
2. **Task 2: Restructure RightSidebar into 3-tab CSS-hidden shell** - `211399e` (feat)

## Files Created/Modified
- `client/src/components/sidebar/SidebarTabBar.tsx` - 3-tab bar with Framer Motion spring indicator, badge counts
- `client/src/components/ui/EmptyState.tsx` - Reusable empty state with icon, title, description, optional CTA
- `client/src/components/RightSidebar.tsx` - Restructured to tabbed layout with CSS-hidden panels
- `client/src/hooks/useRightSidebarState.ts` - Extended with activeTab state and localStorage persistence
- `shared/schema.ts` - Added activeTab field to RightSidebarState and RightSidebarUserPreferences

## Decisions Made
- Used CSS display:none/flex for tab hiding instead of conditional rendering to preserve scroll/draft state
- Renamed inner tab layoutId from "tab-indicator" to "brain-tab-indicator" to prevent Framer Motion animation conflicts
- Wrapped agent and team views inside the Brain & Docs panel for a consistent experience across all sidebar modes

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Tab shell is ready for Plan 03 (ActivityTab component replaces the Activity empty state)
- Approvals tab placeholder ready for Phase 13
- Brain & Docs tab ready for Phase 14 brain redesign
- All subsequent phases plug their components into these tab panels

---
*Phase: 11-sidebar-shell-activity-feed*
*Completed: 2026-03-25*
