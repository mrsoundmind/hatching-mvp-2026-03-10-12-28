---
phase: 12-handoff-visualization
plan: 02
subsystem: sidebar-ui
tags: [handoff, timeline, sidebar, activity-feed, chat-input]
requirements: [HAND-02, HAND-03]

dependency_graph:
  requires: [12-01]
  provides: [HandoffChainTimeline, handoffableAgents dropdown]
  affects: [ActivityTab, CenterPanel]

tech_stack:
  added: []
  patterns:
    - Pure utility module extracted from JSX component for vitest node-env compatibility
    - Re-export pattern (HandoffChainTimeline re-exports groupHandoffsByTraceId from utils)
    - useMemo handoff eligibility filter excluding Maya and focused agent

key_files:
  created:
    - client/src/components/sidebar/HandoffChainTimeline.tsx
    - client/src/components/sidebar/handoffChainUtils.ts
    - scripts/test-handoff-timeline.test.ts
  modified:
    - client/src/components/sidebar/ActivityTab.tsx
    - client/src/components/CenterPanel.tsx

decisions:
  - Extracted pure grouping logic into handoffChainUtils.ts (no JSX) so vitest node environment can import it without JSX parsing errors
  - Re-exported groupHandoffsByTraceId from HandoffChainTimeline.tsx so the plan-spec import path works
  - currentChatContext.participantIds[0] used as focusedAgentId in agent mode (matches how ChatContext is structured)

metrics:
  duration: 257s
  completed: "2026-03-25"
  tasks_completed: 2
  files_created: 3
  files_modified: 2
---

# Phase 12 Plan 02: Handoff Chain Timeline + Manual Handoff Dropdown Summary

**One-liner:** Sidebar handoff timeline grouping events by traceId with animated connectors, and manual "Hand off to..." dropdown in chat input that prepopulates @AgentName.

---

## What Was Built

### HandoffChainTimeline component (`client/src/components/sidebar/HandoffChainTimeline.tsx`)

Renders grouped handoff events as a vertical timeline when the Activity tab's handoff filter is active:

- Each chain group is keyed by `traceId`
- Agent avatar + name + label + relative timestamp per node row
- `motion.div` animated connector lines (`height: 0 → 24`) between nodes using framer-motion
- Connector color: `bg-[var(--hatchin-blue)]/30`
- Empty state message when no handoff events exist

### Pure grouping utility (`client/src/components/sidebar/handoffChainUtils.ts`)

Extracted from the component to allow vitest node-env import without JSX parsing:

- `groupHandoffsByTraceId(events)` — filters to `category === 'handoff'`, groups by `traceId`, sorts ascending, truncates to 5
- Self-contained `FeedEventLike` interface (no `@/` path alias dependency)

### Unit tests (`scripts/test-handoff-timeline.test.ts`)

5 tests covering:
1. Groups events by traceId
2. Filters out non-handoff events
3. Sorts within a group by timestamp ascending
4. Truncates chains > 5 to 5 events
5. Returns empty map for empty input

All 5 pass (`npx vitest run scripts/test-handoff-timeline.test.ts` exits 0).

### ActivityTab wiring (`client/src/components/sidebar/ActivityTab.tsx`)

- Imports `HandoffChainTimeline`
- Conditional render: when `activeFilter === 'handoff'`, renders `<HandoffChainTimeline events={events} />` in scrollable container
- All other filter values continue showing the flat `ActivityFeedItem` list

### Manual handoff dropdown (`client/src/components/CenterPanel.tsx`)

- New `handoffableAgents` useMemo: filters `activeProjectAgents` to exclude Maya (`isSpecialAgent`/`is_special_agent`) and the currently focused agent in agent-mode chats
- New `handleHandoff(agent)`: sets `inputValue` to `@AgentName ` and focuses the textarea
- `DropdownMenu` with `ArrowRightLeft` trigger button labeled "Hand off to..." — only shown when `activeProject` exists and `handoffableAgents.length > 0`
- Each dropdown item shows `AgentAvatar` (size 20) + name + role

---

## Deviations from Plan

### Auto-fix: Extracted pure logic to avoid JSX parsing in vitest

**Found during:** Task 1 — first test run
**Issue:** vitest's node environment cannot parse JSX from imported `.tsx` files. The plan spec put `groupHandoffsByTraceId` inside `HandoffChainTimeline.tsx`, which would have caused the test import to fail with "invalid JS syntax" errors.
**Fix:** Created `handoffChainUtils.ts` (pure `.ts`, no JSX) with the grouping function and a self-contained `FeedEventLike` type. `HandoffChainTimeline.tsx` imports from the util and re-exports `groupHandoffsByTraceId` so the plan-spec import path still works.
**Files modified:** `client/src/components/sidebar/handoffChainUtils.ts` (new), `client/src/components/sidebar/HandoffChainTimeline.tsx` (updated), `scripts/test-handoff-timeline.test.ts` (import path)
**Commits:** 87b99f8

---

## Verification

- `npm run typecheck` exits 0 (only pre-existing sparkles.tsx errors remain)
- `npx vitest run scripts/test-handoff-timeline.test.ts` — 5/5 pass
- `HandoffChainTimeline.tsx` exports `groupHandoffsByTraceId` and `HandoffChainTimeline`
- `ActivityTab.tsx` conditionally renders `<HandoffChainTimeline>` on `activeFilter === 'handoff'`
- `CenterPanel.tsx` has `handoffableAgents`, `handleHandoff`, and "Hand off to..." dropdown

---

## Self-Check: PASSED

Files confirmed:
- `client/src/components/sidebar/HandoffChainTimeline.tsx` — created
- `client/src/components/sidebar/handoffChainUtils.ts` — created
- `scripts/test-handoff-timeline.test.ts` — created

Commits confirmed:
- `87b99f8` — Task 1: HandoffChainTimeline + tests
- `4ee4b5c` — Task 2: ActivityTab + CenterPanel wiring
