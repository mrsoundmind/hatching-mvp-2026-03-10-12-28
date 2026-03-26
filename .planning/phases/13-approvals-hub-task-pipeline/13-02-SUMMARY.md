---
phase: 13-approvals-hub-task-pipeline
plan: "02"
subsystem: frontend/sidebar
tags: [approvals, task-pipeline, sidebar, framer-motion, tanstack-query, right-sidebar]
dependency_graph:
  requires:
    - "client/src/components/sidebar/approvalUtils.ts (Plan 01 — PIPELINE_STAGES, isApprovalExpired)"
    - "client/src/components/sidebar/ApprovalItem.tsx (Plan 01 — leaf approval card)"
    - "client/src/components/sidebar/ApprovalsEmptyState.tsx (Plan 01 — empty state)"
    - "client/src/components/sidebar/SidebarTabBar.tsx (Phase 11 — extended to 3 tabs)"
    - "client/src/hooks/useSidebarEvent.ts (Phase 11 — WS event listener)"
    - "client/src/lib/autonomyEvents.ts (Phase 11 — APPROVAL_REQUIRED event)"
  provides:
    - "client/src/components/sidebar/TaskPipelineView.tsx → read-only pipeline stage display"
    - "client/src/components/sidebar/ApprovalsTab.tsx → full approvals hub container"
    - "client/src/components/RightSidebar.tsx → updated with live approvals tab + badge"
  affects:
    - "Phase 13 requirements APPR-01 through APPR-04 (all fulfilled)"
    - "SidebarTabBar now 3 tabs — consumers that use SidebarTab type are updated"
tech_stack:
  added: []
  patterns:
    - "TanStack Query deduplication: identical queryKey ['/api/tasks', '?projectId=...'] in ApprovalsTab + RightSidebar"
    - "CSS-hide tab panels (display:none) — never unmount for state preservation"
    - "AnimatePresence mode=popLayout for approval item list exit animations"
    - "useSidebarEvent for real-time cache invalidation on APPROVAL_REQUIRED + TASK_COMPLETED"
    - "useMemo for derived approval filtering and hasPendingApprovals boolean"
key_files:
  created:
    - client/src/components/sidebar/TaskPipelineView.tsx
    - client/src/components/sidebar/ApprovalsTab.tsx
  modified:
    - client/src/components/RightSidebar.tsx
    - client/src/components/sidebar/SidebarTabBar.tsx
    - client/src/hooks/useRightSidebarState.ts
    - shared/schema.ts
decisions:
  - "Identical queryKey format in ApprovalsTab + RightSidebar ensures TanStack deduplication — one network request serves both consumers"
  - "SidebarTabBar extended from 2 to 3 tabs (grid-cols-2 → grid-cols-3) with ShieldCheck + amber dot badge for approvals"
  - "shared/schema.ts activeTab union extended to 'activity' | 'brain' | 'approvals' to satisfy TypeScript throughout"
  - "useRightSidebarState setActiveTab + reducer action updated to accept 'approvals' tab value"
  - "Approvals panel inserted between Activity and Brain panels in RightSidebar DOM order"
metrics:
  duration: "173 seconds"
  completed_date: "2026-03-26"
  tasks_completed: 2
  files_created: 2
  files_modified: 4
  tests_added: 0
  tests_passing: 25
---

# Phase 13 Plan 02: ApprovalsTab Container + RightSidebar Wiring Summary

**One-liner:** ApprovalsTab container composing Plan 01 leaf components into a live approval hub — TanStack-fetched tasks, AnimatePresence list, real-time WS cache invalidation, TaskPipelineView, and RightSidebar hasPendingApprovals badge wired from actual data.

---

## Objective

Compose the approval leaf components (Plan 01) into the full `ApprovalsTab` container, create `TaskPipelineView`, and wire everything into `RightSidebar` — replacing the hardcoded `hasPendingApprovals={false}` with live data and adding the Approvals tab to the sidebar.

---

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create TaskPipelineView component | `7ccb594` | TaskPipelineView.tsx |
| 2 | Create ApprovalsTab container and wire into RightSidebar | `a6e88af` | ApprovalsTab.tsx, RightSidebar.tsx, SidebarTabBar.tsx, useRightSidebarState.ts, shared/schema.ts |

---

## What Was Built

### TaskPipelineView.tsx

Read-only pipeline stage view. Imports `PIPELINE_STAGES` from `approvalUtils.ts` and renders each stage as a `motion.div` with staggered entrance animation (30ms delay per stage, 120ms ease-out). Left side: colored dot + stage label. Right side: task count integer. No interactivity — parent gates render when `tasks.length === 0` to avoid 5 zero-count rows.

Accessibility: `role="list"` on wrapper, `role="listitem"` on each stage row.

### ApprovalsTab.tsx

Container that fetches tasks via `useQuery` with `staleTime: 15_000, refetchInterval: 30_000`. Derives two data views from the same fetch:

1. `pendingApprovals` — tasks where `metadata.awaitingApproval === true` and no approvedAt/rejectedAt. Sorted active-first, expired-last using `isApprovalExpired` from Plan 01.
2. `TaskPipelineView` receives the full tasks array for stage counting.

Real-time: `useSidebarEvent(AUTONOMY_EVENTS.APPROVAL_REQUIRED)` and `TASK_COMPLETED` both call `queryClient.invalidateQueries({ queryKey: ['/api/tasks'] })` to flush cache immediately when WS events arrive — no 30s polling lag for badge appearance.

Renders `ApprovalsEmptyState` when not loading and no pending approvals. Wraps ApprovalItem list in `<AnimatePresence mode="popLayout">` for exit animations.

### RightSidebar.tsx Changes

Four changes:

1. **Imports**: Added `ApprovalsTab`, `isApprovalExpired` from sidebar; `Task` type from schema.
2. **allTasks query**: Identical queryKey `['/api/tasks', '?projectId=...']` to ApprovalsTab — TanStack deduplicates into one network request.
3. **hasPendingApprovals**: `useMemo` derives boolean from allTasks — any non-expired task with `awaitingApproval === true` and no approvedAt/rejectedAt.
4. **Approvals CSS panel**: `display: activeTab === 'approvals' ? 'flex' : 'none'` panel renders `<ApprovalsTab projectId={activeProject?.id} />`.
5. **handleTabChange**: Accepts `'activity' | 'brain' | 'approvals'`.

### SidebarTabBar.tsx Changes

Extended from 2 to 3 tabs (`grid-cols-3`). Added 'approvals' tab entry with `ShieldCheck` icon. New `hasPendingApprovals?: boolean` prop renders amber-400 pulsing dot badge on the Approvals tab icon when true.

### shared/schema.ts + useRightSidebarState.ts

`activeTab` type union extended from `'activity' | 'brain'` to include `'approvals'`. Both the shared schema interfaces and the hook's action/reducer were updated to match.

---

## Deviations from Plan

### Auto-fix: Missing 'approvals' tab type support (Rule 3 — blocking issue)

**Found during:** Task 2 implementation

**Issue:** The plan assumed an existing "approvals placeholder" in RightSidebar (referenced as lines 888-899). The actual codebase had no approvals panel, no 'approvals' tab in SidebarTabBar, and no 'approvals' value in `activeTab` type unions. These were missing prerequisites that would have caused TypeScript errors and runtime failures.

**Fix:** Extended `shared/schema.ts` (`RightSidebarUserPreferences.activeTab` and `RightSidebarState.activeTab`), `useRightSidebarState.ts` (reducer action type and `setActiveTab` signature), `SidebarTabBar.tsx` (2→3 tabs), and added the approvals CSS panel in RightSidebar.

**Files modified:** `shared/schema.ts`, `client/src/hooks/useRightSidebarState.ts`, `client/src/components/sidebar/SidebarTabBar.tsx`

**Commit:** `a6e88af`

### Pre-existing issue (out of scope, carried from Plan 01)

`client/src/components/ui/sparkles.tsx` has TypeScript errors (`@tsparticles/*` packages missing). Documented in Plan 01 deferred-items.md. Zero new TypeScript errors introduced by this plan.

---

## Self-Check

### Files exist
- `client/src/components/sidebar/TaskPipelineView.tsx`: FOUND
- `client/src/components/sidebar/ApprovalsTab.tsx`: FOUND
- `client/src/components/RightSidebar.tsx`: FOUND (modified)

### Commits exist
- `7ccb594` (Task 1 — TaskPipelineView): verified
- `a6e88af` (Task 2 — ApprovalsTab + RightSidebar): verified

### Verification checks
- All 3 files exist: PASS
- `grep -c "hasPendingApprovals={false}"` returns 0: PASS
- `grep "hasPendingApprovals={hasPendingApprovals}"` returns 1: PASS
- `npm run typecheck` — only pre-existing sparkles.tsx errors, zero new errors: PASS

## Self-Check: PASSED
