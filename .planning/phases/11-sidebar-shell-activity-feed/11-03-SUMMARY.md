---
phase: 11-sidebar-shell-activity-feed
plan: 03
subsystem: ui
tags: [react, framer-motion, tailwind, activity-feed, avatar-animation, sidebar]

# Dependency graph
requires:
  - phase: 11-sidebar-shell-activity-feed (plan 01)
    provides: useAutonomyFeed hook, useAgentWorkingState hook, autonomyEvents registry
  - phase: 11-sidebar-shell-activity-feed (plan 02)
    provides: SidebarTabBar, EmptyState, CSS-hidden 3-tab RightSidebar shell
provides:
  - ActivityTab component with stats card, filter chips, feed list, and empty state
  - AutonomyStatsCard component with 3 stat pills (tasks, handoffs, cost)
  - FeedFilters component with event type, agent, and time range filters
  - ActivityFeedItem component with color-coded border, avatar, label, timestamp, expandable detail
  - AvatarState "working" variant with rotating dashed ring animation
  - ProjectTree avatar working state integration
affects: [phase-12-handoff-viz, phase-13-approvals-hub, phase-14-brain-redesign]

# Tech tracking
tech-stack:
  added: []
  patterns: [category-color-mapping, relative-time-formatting, filter-chip-bar, shimmer-loading-skeleton]

key-files:
  created:
    - client/src/components/sidebar/ActivityTab.tsx
    - client/src/components/sidebar/ActivityFeedItem.tsx
    - client/src/components/sidebar/AutonomyStatsCard.tsx
    - client/src/components/sidebar/FeedFilters.tsx
  modified:
    - client/src/components/avatars/BaseAvatar.tsx
    - client/src/index.css
    - client/src/components/ProjectTree.tsx
    - client/src/components/RightSidebar.tsx

key-decisions:
  - "Called useAgentWorkingState directly in ProjectTree instead of LeftSidebar since LeftSidebar delegates all avatar rendering to ProjectTree"
  - "Used type assertion casts for filter setters to bridge FeedFilters string props with hook's union types, avoiding need to export internal types"
  - "Added useQuery for project agents in RightSidebar to supply ActivityTab filter dropdown data"

patterns-established:
  - "Category color mapping: task=green, handoff=blue, review=orange, approval=amber, system=gray"
  - "Relative time formatting helper co-located in ActivityFeedItem (not a shared util)"
  - "Filter chip styling pattern: filled bg for active, bordered for inactive, consistent 11px text"

requirements-completed: [FEED-01, FEED-02, FEED-03, FEED-04, FEED-05, AGNT-01, SIDE-03]

# Metrics
duration: 4min
completed: 2026-03-25
---

# Phase 11 Plan 03: Activity Tab Content + Working Avatar Summary

**Activity feed with stats card, filter chips, feed item list, empty state, and rotating dashed ring avatar animation for background-executing agents**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-25T07:13:11Z
- **Completed:** 2026-03-25T07:17:39Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- Built 4 new sidebar components: ActivityTab, AutonomyStatsCard, FeedFilters, ActivityFeedItem
- Extended AvatarState with "working" variant showing rotating dashed ring with subtle glow
- Wired ActivityTab into RightSidebar replacing the Plan 02 EmptyState placeholder
- Feed items show color-coded borders by category, agent initials, relative timestamps, and expandable detail sections

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ActivityTab, AutonomyStatsCard, FeedFilters, and ActivityFeedItem components** - `8354f0c` (feat)
2. **Task 2: Add "working" avatar state + wire working agents to ProjectTree** - `8376e4c` (feat)
3. **Task 3: Wire ActivityTab into RightSidebar Activity panel** - `b4d4e0d` (feat)

## Files Created/Modified
- `client/src/components/sidebar/AutonomyStatsCard.tsx` - Stats card with 3 pills (tasks, handoffs, cost) and shimmer loading
- `client/src/components/sidebar/FeedFilters.tsx` - Filter chip bar for event type, agent, and time range
- `client/src/components/sidebar/ActivityFeedItem.tsx` - Feed item with color border, avatar, label, timestamp, expandable detail
- `client/src/components/sidebar/ActivityTab.tsx` - Container composing stats, filters, feed list, and empty state
- `client/src/components/avatars/BaseAvatar.tsx` - Extended AvatarState with "working" and added rotating ring overlay
- `client/src/index.css` - Added @keyframes agent-working-ring animation
- `client/src/components/ProjectTree.tsx` - Integrated useAgentWorkingState for avatar working state
- `client/src/components/RightSidebar.tsx` - Replaced EmptyState placeholder with ActivityTab, added agents query

## Decisions Made
- Called useAgentWorkingState in ProjectTree directly since LeftSidebar delegates all avatar rendering to ProjectTree (no avatars in LeftSidebar itself)
- Used type assertion casts in ActivityTab for filter setters to bridge string props with hook's internal union types
- Added useQuery for project agents in RightSidebar to supply the ActivityTab filter dropdown

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed type mismatch between FeedFilters and useAutonomyFeed setter types**
- **Found during:** Task 1 (ActivityTab typecheck)
- **Issue:** FeedFilters expected `(filter: string) => void` but useAutonomyFeed returns `Dispatch<SetStateAction<FilterCategory>>`
- **Fix:** Used inline arrow functions with type assertions in ActivityTab
- **Verification:** TypeScript compiles without errors
- **Committed in:** 8354f0c (Task 1 commit)

**2. [Rule 3 - Blocking] Skipped LeftSidebar modification since it has no avatar rendering**
- **Found during:** Task 2
- **Issue:** Plan specified modifying LeftSidebar for working state, but LeftSidebar contains zero avatar rendering — it delegates entirely to ProjectTree
- **Fix:** Applied working state only in ProjectTree where avatars actually render
- **Verification:** Both AgentAvatar instances in ProjectTree now use workingAgents.has(agent.id) check

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Activity tab is fully functional with stats card, filters, and feed items
- Phases 12 (Handoff Viz), 13 (Approvals Hub), and 14 (Brain Redesign) can proceed independently
- HandoffCard components (Phase 12) will appear as feed items in this Activity feed
- Approvals tab (Phase 13) will use similar patterns established here

---
*Phase: 11-sidebar-shell-activity-feed*
*Completed: 2026-03-25*
