# Phase 11: Sidebar Shell + Activity Feed - Research

**Researched:** 2026-03-24
**Domain:** React sidebar refactoring, real-time activity feeds, CSS-based tab management, Framer Motion avatar animation
**Confidence:** HIGH — derived entirely from direct codebase inspection of the live files; no guesswork required

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Activity Feed — Information Density & Layout**
- GitHub-style notification center — not Slack (too noisy) or commit log (too technical). Each feed item shows: agent avatar (32px), one-line event description, relative timestamp ("2m ago"), color-coded left border by event category
- Event categories with colors: task events (hatchin-green), handoff events (hatchin-blue), review events (hatchin-orange), approval events (amber), system events (gray)
- Show only outcome-level events — "Coda completed: API endpoint scaffolding" not "Coda started thinking... Coda called LLM... Coda finished generating..."
- Expandable detail on click — shows risk score, peer review outcome, handoff context if applicable
- Max 200 events in memory, oldest dropped. Initial load from `GET /api/autonomy/events` (last 50), then append via CustomEvent bridge from CenterPanel

**Tab Switching & State Preservation (SIDE-02)**
- CSS-hide pattern: All 3 tab panels render simultaneously. Active tab gets `display: block`, inactive get `display: none` + `aria-hidden="true"`. Never conditionally unmount tabs
- Existing brain editing state in `useRightSidebarState` stays intact — Brain & Docs tab wraps the current brain editing JSX as-is in Phase 11, then Phase 14 redesigns it
- Tab bar sits at top of RightSidebar, above all content. Uses Framer Motion `layoutId="sidebar-tab"` spring indicator (same pattern as existing overview/tasks toggle)
- `activeTab` state added to `useRightSidebarState` reducer, persisted to localStorage. Default: `'activity'`
- Tab order: Activity | Brain & Docs | Approvals

**Stats Card — What Numbers Matter (FEED-02)**
- "Today" scope — resets at midnight local time. Shows: tasks completed today, handoffs today, cost spent today (formatted as "$0.12")
- Cost visible to all users. Free tier users see "$0.00" (autonomy disabled).
- Compact horizontal layout: 3 stat pills in a row. Icon + number + label. No charts, no graphs — just clean numbers
- Data source: new `GET /api/autonomy/stats?projectId=X&period=today` endpoint that aggregates from `autonomy_events` table

**Mobile Sidebar Experience (SIDE-04)**
- Tabs inside Sheet, no swipe gesture — Sheet drawer opens, tabs render at top as normal tap targets, content scrolls below
- Sheet width stays at current Shadcn default. Tab bar is horizontally compact (icon + short label)

**Agent Working Avatar (AGNT-01)**
- Add `"working"` to `AvatarState` union type in BaseAvatar.tsx
- Animation: slow-rotating dashed ring around avatar (CSS `@keyframes agent-working-ring` — 3s rotation, 2px dashed border in hatchin-blue/60) + subtle pulsing glow matching `ai-thinking-ring` pattern
- Triggered by `background_execution_started` WS event, cleared by `background_execution_completed` or `task_execution_completed`
- `useAutonomyFeed` hook exposes `workingAgents: Set<string>` — LeftSidebar and ProjectTree read this to set avatar state

**Feed Aggregation (FEED-04)**
- Backend aggregates at API layer: `GET /api/autonomy/events` returns grouped summaries. If 5 tasks were assigned in a handoff chain, return 1 event: "5 tasks assigned across 3 agents" with expandable detail
- Aggregation key: `traceId` — events sharing a trace are grouped into one feed item
- Real-time WS events arrive ungrouped. Frontend groups by traceId in `useAutonomyFeed` hook with 3-second debounce window before rendering

**Filter Chips (FEED-03)**
- Horizontal scrollable chip bar below stats card: "All" (default), "Tasks", "Handoffs", "Reviews", "Approvals"
- Agent filter: dropdown that lists project agents with avatars. Single-select
- Time filter: "Today", "Last 7 days", "All time" — 3 options, not a date picker
- Filters apply client-side to the in-memory event list (200 items max). No re-fetch needed
- Active filters show as filled chips, inactive as outlined

**Empty States (FEED-05)**
- Activity tab empty state: Illustration area (64px icon), title "Your team is ready", description "When your Hatches start working autonomously, you'll see their progress here. Try asking one to work on something in the background."
- Approvals tab empty state: "All clear!" + "No pending approvals. When a Hatch needs your sign-off on something risky, it'll show up here."
- Reusable `EmptyState` component: `icon`, `title`, `description`, `action?` (optional CTA button) props

**Badge Counts (SIDE-03)**
- Activity tab badge: count of unread events since last time user viewed Activity tab. Stored in React state (not persisted). Clears when tab is selected
- Approvals tab badge: count of pending approvals (approval_status = 'pending'). Always visible, always accurate. Red dot, not number, when count > 0
- Badge renders as absolute-positioned circle on tab icon. Uses `hatchin-orange` for activity, `red-500` for approvals

### Claude's Discretion
- Exact animation timing and easing for tab transitions
- Feed item hover states and micro-interactions
- Loading skeleton design for initial feed fetch
- Error state when autonomy events API fails
- Exact empty state icon choices
- Stats card loading shimmer pattern

### Deferred Ideas (OUT OF SCOPE)
- Swipe-between-tabs gesture on mobile — noted for Phase 15 polish if user feedback demands it
- Notification sound for high-priority events — out of scope, could be Phase 15 or v1.4
- Event search/full-text filter — tracked as ADVN-02 in v1.4+ requirements
- Keyboard shortcuts for tab switching — could be Phase 15 polish
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SIDE-01 | User sees a tabbed right sidebar with Activity, Brain & Docs, and Approvals tabs | RightSidebar.tsx tab shell extension — existing 2-tab pattern at lines 507-532 scales directly to 3 tabs with same `layoutId="tab-indicator"` Framer Motion spring |
| SIDE-02 | Tab selection persists across navigation (inactive tabs retain scroll position and draft state via CSS-hide) | `useRightSidebarState` reducer already has localStorage persistence; adding `activeTab` action follows existing `SET_ACTIVE_VIEW` pattern; CSS `display:none` + `aria-hidden` proven pattern |
| SIDE-03 | Activity tab shows unread event count badge; Approvals tab shows pending approval count badge | `hasNewTasks` badge at line 544 of RightSidebar.tsx is the exact pattern to replicate for unread events and pending approvals |
| SIDE-04 | Sidebar tabs work on mobile via Sheet drawer with swipe-between-tabs gesture | home.tsx already renders RightSidebar inside Sheet on mobile; no changes needed to Sheet wrapper; tab bar inherits automatically |
| FEED-01 | User sees a real-time feed of autonomy events with agent avatars and timestamps | `GET /api/autonomy/events` already exists (lines 594-613 of autonomy.ts); WS events `background_execution_started`, `task_execution_completed`, `handoff_chain_completed` already defined in wsSchemas.ts |
| FEED-02 | User sees a stats summary card at top of Activity tab showing tasks completed, handoffs, and cost spent | New `GET /api/autonomy/stats?projectId=X&period=today` endpoint needed; aggregation query against `autonomy_events` table by eventType + date filter |
| FEED-03 | User can filter feed by event type, by agent, or by time range via filter chips | Client-side filtering against in-memory 200-event array; no re-fetch; FeedFilters component with chip bar + agent dropdown |
| FEED-04 | Rapid events are aggregated ("5 tasks assigned" instead of 5 separate items) | `traceId` field exists on every AutonomyEvent; grouping by traceId in `useAutonomyFeed` with 3s debounce; API endpoint returns pre-aggregated summaries |
| FEED-05 | User sees a compelling empty state explaining what the Activity feed shows before any autonomous work happens | Reusable `EmptyState` component needed; 3 distinct variants: autonomy disabled / enabled-no-data / loading |
| AGNT-01 | Agent avatars show a pulsing/rotating "working" animation when executing tasks in background | `AvatarState` union in BaseAvatar.tsx currently has 4 states; adding `"working"` requires extending the union + adding CSS keyframes + updating `AvatarWrapper`; `useAgentWorkingState` hook tracks Set of executing agentIds |
</phase_requirements>

---

## Summary

Phase 11 is the gating foundation for the entire v1.3 milestone. Every subsequent phase (12–15) plugs its components into one of the three tabs built here. The scope is primarily a frontend restructuring exercise on top of existing working infrastructure — the autonomy events backend already logs and serves data, and the WebSocket events for execution states already exist in wsSchemas.ts.

The two most critical decisions are already locked in CONTEXT.md: (1) CSS tab hiding (never unmount), and (2) CustomEvent bridge from CenterPanel as the real-time transport. The planner must ensure these are implemented in the correct order: typed event registry first, then `useSidebarEvent` hook, then `useAutonomyFeed` hook, then the tab shell, then the child components. Building in any other order creates silent listener gaps and memory leaks.

The backend work is limited to two additions: a new `GET /api/autonomy/stats` endpoint (new route on existing autonomy.ts module) and an enhanced `GET /api/autonomy/events` endpoint that adds `projectId` scoping with aggregation output. The existing `readAutonomyEvents` function in eventLogger.ts is the foundation for both.

**Primary recommendation:** Build in this exact sequence: (1) `client/src/lib/autonomyEvents.ts` typed event registry, (2) `useSidebarEvent` hook, (3) `useAutonomyFeed` hook + `useAgentWorkingState` hook, (4) backend stats endpoint, (5) RightSidebar tab shell extension, (6) ActivityTab with StatsCard + FeedFilters + FeedItems + EmptyState, (7) BaseAvatar "working" state extension.

---

## Standard Stack

### Core (all already installed — no new npm packages needed for Phase 11)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.3.1 | Component framework | Already used everywhere |
| Framer Motion | 11.13.1 | Tab indicator spring animation, FeedItem entrance | Existing `layoutId="tab-indicator"` pattern at RightSidebar.tsx:517-522 |
| TanStack React Query | 5.60.5 | `GET /api/autonomy/events` and `GET /api/autonomy/stats` data fetching | Already used for all server data |
| Tailwind CSS | 3.4.17 | All layout and styling | No inline styles per CLAUDE.md |
| Lucide React | 0.453.0 | Tab icons, filter chip icons, stats card icons | Already used throughout app |
| Shadcn/Radix UI | 1.1-2.1 | Dropdown for agent filter, Badge for tab counts | Already used for all primitives |

### Supporting (already installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns or relative time | Built-in | "2m ago" timestamp rendering | Feed item timestamps; use `formatDistanceToNow` from date-fns if already present, else `Intl.RelativeTimeFormat` |
| Zod | 3.24.2 | Validate new API endpoint query params | `projectId`, `period` query params on stats endpoint |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS display:none tab hiding | React conditional rendering | Conditional rendering is simpler but causes scroll/draft state loss — locked decision says CSS-hide |
| CustomEvent bridge | Direct prop threading / context API | Context would require home.tsx restructuring; CustomEvent bridge is already the established pattern in CenterPanel |
| Client-side filtering of 200 events | Re-fetching with query params on filter change | Re-fetching adds network latency and server load; 200 events is small enough for in-memory filter |

**Installation:** No new packages required for Phase 11.

---

## Architecture Patterns

### Recommended Project Structure (Phase 11 additions only)

```
client/src/
├── components/
│   ├── sidebar/                          # New directory
│   │   ├── SidebarTabBar.tsx             # Tab button strip with badges
│   │   ├── ActivityTab.tsx               # Tab container (FEED-01–05)
│   │   ├── ActivityFeedItem.tsx          # Single event row
│   │   ├── AutonomyStatsCard.tsx         # Stats summary (FEED-02)
│   │   ├── FeedFilters.tsx               # Filter chips (FEED-03)
│   │   └── EmptyFeedState.tsx            # Empty state (FEED-05)
│   ├── ui/
│   │   └── EmptyState.tsx                # Reusable empty state primitive
│   ├── avatars/
│   │   └── BaseAvatar.tsx                # Modified: "working" AvatarState + CSS ring
│   └── RightSidebar.tsx                  # Modified: thin 3-tab shell
│
├── hooks/
│   ├── useAutonomyFeed.ts                # New: REST init + WS append + filter state
│   ├── useAgentWorkingState.ts           # New: Set<agentId> of executing agents
│   └── useRightSidebarState.ts           # Modified: add activeTab + SET_ACTIVE_TAB action
│
└── lib/
    └── autonomyEvents.ts                 # New: typed CustomEvent name constants + dispatcher helpers
```

### Pattern 1: CSS Tab Hiding (Critical — SIDE-02)

**What:** All three tab panels render in the DOM simultaneously. Only CSS changes based on active tab. No conditional unmounting.

**When to use:** Any tab that contains scrollable content or user-editable form state.

**Example:**
```typescript
// Source: decision from CONTEXT.md + existing pattern at home.tsx mobile sheet
// In RightSidebar.tsx after adding 3-tab structure:
<div
  style={{ display: activeTab === 'activity' ? 'block' : 'none' }}
  aria-hidden={activeTab !== 'activity'}
  className="flex-1 overflow-y-auto"
>
  <ActivityTab projectId={activeProject?.id} />
</div>
<div
  style={{ display: activeTab === 'brain' ? 'block' : 'none' }}
  aria-hidden={activeTab !== 'brain'}
  className="flex-1 overflow-y-auto"
>
  {/* Existing brain editing JSX moved here unchanged — Phase 14 redesigns this */}
  {currentView === 'tasks' ? <TaskManager ... /> : <>{/* brain editing content */}</>}
</div>
<div
  style={{ display: activeTab === 'approvals' ? 'block' : 'none' }}
  aria-hidden={activeTab !== 'approvals'}
  className="flex-1 overflow-y-auto"
>
  <ApprovalsEmptyState /> {/* Phase 13 fills this; Phase 11 just adds empty state */}
</div>
```

### Pattern 2: Tab Bar with Spring Indicator (SIDE-01)

**What:** Reuse the exact `layoutId="tab-indicator"` Framer Motion pattern already in RightSidebar.tsx at lines 507-551. Extend from 2 tabs to 3.

**When to use:** Any tab navigation in the right sidebar.

**Example:**
```typescript
// Source: RightSidebar.tsx lines 516-521 (existing, proven pattern)
// Tab indicator: renders INSIDE the active tab button only
{activeTab === 'activity' && (
  <motion.div
    layoutId="sidebar-tab"  // Note: use "sidebar-tab" not "tab-indicator" to avoid conflicts
    className="absolute inset-0 rounded-lg bg-[var(--glass-frosted-strong)] elevation-1"
    style={{ borderRadius: 8 }}
    transition={{ type: "spring", stiffness: 400, damping: 30 }}
  />
)}
```

### Pattern 3: useRightSidebarState Extension (SIDE-02)

**What:** Add `activeTab` to the existing reducer without breaking any existing state.

**When to use:** Any new persistent state for the right sidebar.

**Example:**
```typescript
// Source: useRightSidebarState.ts (existing reducer pattern)
// Step 1: Add to action union
type RightSidebarAction =
  | { type: 'SET_ACTIVE_TAB'; payload: 'activity' | 'brain' | 'approvals' }
  // ... existing actions unchanged

// Step 2: Add to state
interface RightSidebarState {
  activeTab: 'activity' | 'brain' | 'approvals';  // new field, default 'activity'
  // ... all existing fields unchanged
}

// Step 3: Handle in reducer
case 'SET_ACTIVE_TAB':
  return { ...state, activeTab: action.payload };

// Step 4: Persist in localStorage (existing savePreferences function handles this)
// Add activeTab to RightSidebarUserPreferences interface
```

### Pattern 4: Typed CustomEvent Registry (Critical — prevents silent listener gaps)

**What:** A single file that exports typed constants for every CustomEvent name. All dispatchers and listeners import from this file — never write event names as string literals in more than one place.

**When to use:** Before writing any sidebar child component that listens to window events.

**Example:**
```typescript
// Source: Recommended pattern from .planning/research/PITFALLS.md §Pitfall 2
// client/src/lib/autonomyEvents.ts (NEW FILE — create first)

export const AUTONOMY_EVENTS = {
  TASK_EXECUTING: 'autonomy_task_executing',
  TASK_COMPLETED: 'autonomy_task_completed',
  HANDOFF_ANNOUNCED: 'autonomy_handoff_announced',
  APPROVAL_REQUIRED: 'autonomy_approval_required',
  PEER_REVIEW_RESULT: 'autonomy_peer_review_result',
  AGENT_WORKING_STATE: 'agent_working_state',
} as const;

export type AutonomyEventName = typeof AUTONOMY_EVENTS[keyof typeof AUTONOMY_EVENTS];

// Typed dispatcher — always use this instead of raw window.dispatchEvent
export function dispatchAutonomyEvent<T>(name: AutonomyEventName, detail: T): void {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}
```

### Pattern 5: useSidebarEvent Hook (Critical — prevents memory leaks)

**What:** A typed wrapper around `window.addEventListener` that always includes cleanup. Every sidebar component uses this hook, never raw addEventListener.

**When to use:** Any component in `client/src/components/sidebar/` or modified RightSidebar that needs to listen to CustomEvents.

**Example:**
```typescript
// Source: Recommended pattern from .planning/research/PITFALLS.md §Pitfall 4
// client/src/hooks/useSidebarEvent.ts (NEW FILE — create before any sidebar child)
import { useEffect, useCallback } from 'react';
import type { AutonomyEventName } from '@/lib/autonomyEvents';

export function useSidebarEvent<T>(
  eventName: AutonomyEventName | string,
  handler: (detail: T) => void,
  deps: React.DependencyList = []
): void {
  const stableHandler = useCallback((e: Event) => {
    handler((e as CustomEvent<T>).detail);
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    window.addEventListener(eventName, stableHandler);
    return () => window.removeEventListener(eventName, stableHandler);
  }, [eventName, stableHandler]);
}
```

### Pattern 6: useAutonomyFeed Hook

**What:** Combines TanStack Query initial load of historical events with real-time WS event appends via CustomEvent bridge. Exposes filtered event list, stats, and workingAgents set.

**When to use:** ActivityTab and any component needing autonomy event data.

**Example:**
```typescript
// Source: Architecture from .planning/research/ARCHITECTURE.md
// client/src/hooks/useAutonomyFeed.ts (NEW FILE)
import { useState, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSidebarEvent } from './useSidebarEvent';
import { AUTONOMY_EVENTS } from '@/lib/autonomyEvents';

const MAX_EVENTS = 200;
const DEBOUNCE_MS = 3000; // 3-second window to group traceId events

export interface FeedEvent {
  id: string;
  traceId: string;
  eventType: string;
  agentId: string | null;
  agentName: string | null;
  label: string;           // human-readable: "Coda completed: API endpoint scaffolding"
  category: 'task' | 'handoff' | 'review' | 'approval' | 'system';
  timestamp: string;
  expandableData?: Record<string, unknown>;
}

export function useAutonomyFeed(projectId: string | undefined) {
  const [realtimeEvents, setRealtimeEvents] = useState<FeedEvent[]>([]);
  const [workingAgents, setWorkingAgents] = useState<Set<string>>(new Set());
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const pendingBatch = useRef<FeedEvent[]>([]);

  // Initial load from REST
  const { data, isLoading } = useQuery({
    queryKey: ['/api/autonomy/events', projectId],
    queryFn: () => fetch(`/api/autonomy/events?projectId=${projectId}&limit=50`)
                     .then(r => r.json()),
    enabled: !!projectId,
    staleTime: 30_000,
  });

  // Stats query
  const { data: statsData } = useQuery({
    queryKey: ['/api/autonomy/stats', projectId],
    queryFn: () => fetch(`/api/autonomy/stats?projectId=${projectId}&period=today`)
                     .then(r => r.json()),
    enabled: !!projectId,
    staleTime: 60_000,
  });

  // Real-time append with 3s debounce for traceId grouping
  useSidebarEvent(AUTONOMY_EVENTS.TASK_COMPLETED, (detail: FeedEvent) => {
    pendingBatch.current.push(detail);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setRealtimeEvents(prev => [...prev, ...pendingBatch.current].slice(-MAX_EVENTS));
      setUnreadCount(c => c + pendingBatch.current.length);
      pendingBatch.current = [];
    }, DEBOUNCE_MS);
  }, []);

  // Working agent state management
  useSidebarEvent(AUTONOMY_EVENTS.AGENT_WORKING_STATE, (detail: { agentId: string; isWorking: boolean }) => {
    setWorkingAgents(prev => {
      const next = new Set(prev);
      detail.isWorking ? next.add(detail.agentId) : next.delete(detail.agentId);
      return next;
    });
  }, []);

  const allEvents = useMemo(() => {
    const historical = (data?.events || []) as FeedEvent[];
    return [...historical, ...realtimeEvents].slice(-MAX_EVENTS);
  }, [data?.events, realtimeEvents]);

  const filteredEvents = useMemo(() => {
    if (activeFilter === 'all') return allEvents;
    return allEvents.filter(e => e.category === activeFilter);
  }, [allEvents, activeFilter]);

  return { events: filteredEvents, allEvents, stats: statsData, isLoading,
           workingAgents, unreadCount, setUnreadCount, activeFilter, setActiveFilter };
}
```

### Pattern 7: BaseAvatar "working" State Extension (AGNT-01)

**What:** Extend `AvatarState` union from 4 to 5 states. Add CSS keyframe for the rotating dashed ring. Update AvatarWrapper to render the ring overlay when state is "working".

**When to use:** LeftSidebar and ProjectTree agent list items that check `workingAgents.has(agent.id)`.

**Example:**
```typescript
// Source: BaseAvatar.tsx (existing file — extension only)
// Step 1: In BaseAvatar.tsx
export type AvatarState = "idle" | "thinking" | "speaking" | "celebrating" | "working";

// Step 2: In index.css — add new keyframe
// @keyframes agent-working-ring {
//   from { transform: rotate(0deg); }
//   to   { transform: rotate(360deg); }
// }

// Step 3: In AvatarWrapper JSX — add ring overlay
{state === "working" && (
  <div
    className="absolute inset-0 rounded-full pointer-events-none"
    style={{
      border: '2px dashed rgba(108,130,255,0.6)',
      animation: 'agent-working-ring 3s linear infinite',
      boxShadow: '0 0 8px rgba(108,130,255,0.3)',
    }}
  />
)}
```

### Pattern 8: ActivityFeedItem Entry Animation

**What:** New events slide in from the top with opacity + translateY entrance. Matches existing message animation pattern.

**Example:**
```typescript
// Source: .planning/phases/11-sidebar-shell-activity-feed/11-CONTEXT.md §Specifics
// Standard entrance used throughout CenterPanel:
<motion.div
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.18, ease: 'easeOut' }}
>
  {/* feed item content */}
</motion.div>
```

### Anti-Patterns to Avoid

- **Conditional tab unmounting:** Never `{activeTab === 'activity' && <ActivityTab />}` — causes scroll and draft state loss. Use CSS display:none.
- **Raw string event names:** Never `window.addEventListener('autonomy_task_completed', ...)` directly. Always use `AUTONOMY_EVENTS` constants from `autonomyEvents.ts`.
- **Raw addEventListener in components:** Never call `window.addEventListener` directly in component useEffect. Always use `useSidebarEvent` hook.
- **Unthrottled feed updates:** Never update feed state on every single WS event individually. Batch with the 3-second debounce window to prevent flooding.
- **Reading all 1000 events on initial load:** The existing `GET /api/autonomy/events` loads 1000 events. The new projectId-scoped endpoint must use `limit=50` by default.
- **Using the same `layoutId="tab-indicator"` string as the existing 2-tab toggle:** Must use a distinct layoutId like `"sidebar-tab"` to avoid Framer Motion conflicts.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Relative timestamps ("2m ago") | Custom date formatter | `formatDistanceToNow` from date-fns (already a transitive dep) or `Intl.RelativeTimeFormat` | Edge cases: pluralization, "just now", locale; already solved |
| Dropdown for agent filter | Custom select | Shadcn `<Select>` or `<DropdownMenu>` | Already used throughout app; accessible by default |
| Tab badge count | Custom badge element | Shadcn `<Badge>` variant="destructive" for approvals | Already in ui/ directory |
| Loading skeleton | Custom shimmer div | Existing `shimmer` CSS keyframe in index.css + Shadcn `<Skeleton>` | Already established pattern |
| Scroll-to-top behavior on new events | Custom scroll management | `containerRef.current.scrollTop = 0` with a "new events" banner | Simple enough to hand-roll, but don't auto-scroll — show banner |

**Key insight:** This phase is almost entirely a composition exercise. Every animation primitive, every UI component, and every data fetching pattern already exists in the codebase. The planner should create tasks that wire existing pieces together, not build new infrastructure.

---

## Common Pitfalls

### Pitfall 1: Silent CustomEvent Listener Gap During Refactor

**What goes wrong:** RightSidebar currently listens to `tasks_updated`, `task_created_from_chat`, `ai_streaming_active`, `project_brain_updated` via window.addEventListener. When decomposing into tab children, there is a silent gap if listeners are removed from parent before child components add them.

**Why it happens:** CustomEvent listeners are invisible contracts — TypeScript provides no type safety across the dispatch/listener boundary.

**How to avoid:** Create `autonomyEvents.ts` typed registry FIRST. Use `useSidebarEvent` hook in ALL new components — never raw addEventListener. Use wrap-then-restructure: add tab shell with all existing listeners remaining in parent, verify it works, THEN move listeners to children one at a time.

**Warning signs:** Task badge in sidebar stops appearing. Brain content stops updating. Zero JavaScript errors — silence is the signal.

### Pitfall 2: Memory Leak from Missing useEffect Cleanups

**What goes wrong:** Each sidebar child component adds `window.addEventListener`. React Strict Mode (dev) runs effects twice, doubling listeners temporarily. If any cleanup return is missing, listeners accumulate on every mount.

**Why it happens:** 15+ new components, one missed cleanup is almost guaranteed without a systematic approach.

**How to avoid:** The `useSidebarEvent` hook must always include the cleanup return. All sidebar components MUST use this hook. Never raw addEventListener.

**Warning signs:** Chrome DevTools Memory tab shows growing "Event Listeners" count while navigating. Same handler fires multiple times for one dispatch.

### Pitfall 3: Activity Feed Flooded by Micro-Events

**What goes wrong:** `autonomy_events` table has granular micro-events (15-30 per handoff chain). Rendering each one creates a scrolling wall of noise. The existing `GET /api/autonomy/events` returns raw micro-events.

**Why it happens:** Audit-level granularity is the right choice for the DB; it is the wrong choice for a user-facing feed.

**How to avoid:** The new `GET /api/autonomy/events?projectId=X&limit=50` endpoint MUST aggregate by traceId before responding. In `useAutonomyFeed`, apply the 3-second debounce batch before updating state. Only a subset of eventTypes produce feed items: `task_completed`, `handoff_chain_completed`, `peer_review_completed`, `proposal_created`.

**Warning signs:** More than 1 feed item per second during a normal handoff chain. CPU spike in DevTools during autonomy runs.

### Pitfall 4: Framer Motion layoutId Conflict

**What goes wrong:** The existing 2-tab toggle in RightSidebar uses `layoutId="tab-indicator"`. If the new 3-tab bar uses the same layoutId, Framer Motion will animate between the old and new indicators incorrectly, causing visual glitches.

**Why it happens:** Easy copy-paste from existing code without noticing the shared layoutId scope.

**How to avoid:** Use `layoutId="sidebar-tab"` (different string) for the new 3-tab bar.

**Warning signs:** Tab indicator snaps to wrong position or flies across the screen during initial render.

### Pitfall 5: Stats Endpoint Query Performance

**What goes wrong:** `GET /api/autonomy/stats?projectId=X&period=today` requires aggregating autonomy_events by eventType for a specific project and date range. Without a projectId index, this table scan gets slow as events accumulate.

**Why it happens:** `autonomy_events` has no documented index on `(project_id, timestamp)` in the schema.

**How to avoid:** Check whether `autonomy_events` has a composite index on `(project_id, timestamp)`. If not, the stats query should limit scope: `WHERE project_id = $1 AND timestamp >= now() - interval '1 day'`. Keep the endpoint payload small — 3 numbers, not full event records.

**Warning signs:** Stats endpoint takes >200ms on projects with many events.

---

## Code Examples

Verified patterns from existing codebase:

### Tab indicator animation (from RightSidebar.tsx lines 516-522)
```typescript
// Existing pattern — reuse with different layoutId
{activeTab === 'activity' && (
  <motion.div
    layoutId="sidebar-tab"
    className="absolute inset-0 rounded-lg bg-[var(--glass-frosted-strong)] elevation-1"
    style={{ borderRadius: 8 }}
    transition={{ type: "spring", stiffness: 400, damping: 30 }}
  />
)}
```

### Badge dot on tab icon (from RightSidebar.tsx lines 543-546)
```typescript
// Existing hasNewTasks badge — exact same pattern for unread activity
{unreadCount > 0 && activeTab !== 'activity' && (
  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[var(--hatchin-orange)] rounded-full animate-pulse" />
)}
// For approvals (red dot, not count):
{pendingApprovalsCount > 0 && activeTab !== 'approvals' && (
  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full" />
)}
```

### CustomEvent dispatch (from CenterPanel.tsx line 612 — existing pattern)
```typescript
// Existing pattern — extend with new autonomy events in CenterPanel
window.dispatchEvent(new CustomEvent('project_brain_updated', { detail: message }));

// New dispatches to add in CenterPanel WS handler:
// For background_execution_started:
window.dispatchEvent(new CustomEvent(AUTONOMY_EVENTS.AGENT_WORKING_STATE, {
  detail: { agentId: message.agentId, isWorking: true }
}));
// For background_execution_completed / task_execution_completed:
window.dispatchEvent(new CustomEvent(AUTONOMY_EVENTS.AGENT_WORKING_STATE, {
  detail: { agentId: message.agentId, isWorking: false }
}));
```

### Existing CSS keyframes in index.css to reference for "working" ring
```css
/* Existing ai-thinking-ring at ~line 421 — model the working-ring after this */
@keyframes ai-task-ring {
  0%, 100% { box-shadow: 0 0 0 1px rgba(108, 130, 255, 0.3); }
  50%       { box-shadow: 0 0 0 3px rgba(108, 130, 255, 0.6); }
}
/* New keyframe to add: */
@keyframes agent-working-ring {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
```

### Activity feed item color-coded left border
```typescript
// CONTEXT.md: task=hatchin-green, handoff=hatchin-blue, review=hatchin-orange, approval=amber, system=gray
const CATEGORY_BORDER: Record<FeedEvent['category'], string> = {
  task:     'border-l-[var(--hatchin-green)]',
  handoff:  'border-l-[var(--hatchin-blue)]',
  review:   'border-l-[var(--hatchin-orange)]',
  approval: 'border-l-amber-500',
  system:   'border-l-gray-400',
};
// Usage:
<div className={`border-l-2 pl-3 ${CATEGORY_BORDER[event.category]}`}>
```

### Stats card layout (3 pills, horizontal)
```typescript
// CONTEXT.md: compact horizontal, 3 stat pills, icon + number + label
<div className="flex gap-3 p-3 rounded-xl border border-[var(--hatchin-border-subtle)] bg-[var(--hatchin-surface)]">
  {[
    { icon: <CheckCircle size={14} />, value: stats?.tasksCompleted ?? 0, label: 'done' },
    { icon: <ArrowRight size={14} />, value: stats?.handoffs ?? 0, label: 'handoffs' },
    { icon: <DollarSign size={14} />, value: `$${(stats?.costToday ?? 0).toFixed(2)}`, label: 'today' },
  ].map(({ icon, value, label }) => (
    <div key={label} className="flex-1 flex flex-col items-center gap-0.5">
      <span className="text-[var(--hatchin-text-muted)]">{icon}</span>
      <span className="font-semibold hatchin-text text-sm">{value}</span>
      <span className="text-[10px] hatchin-text-muted">{label}</span>
    </div>
  ))}
</div>
```

---

## Backend Gaps to Fill

The existing `GET /api/autonomy/events` (lines 594-613 of autonomy.ts) has two problems for Phase 11:

1. **No projectId filtering on the query params.** It reads 1000 events then filters in JS. Must add `?projectId=X&limit=50` query param handling.

2. **Returns raw micro-events, not aggregated summaries.** Must add aggregation logic by `traceId` before returning. Group events with the same `traceId` into a single summary object.

**New endpoint needed:** `GET /api/autonomy/stats?projectId=X&period=today`

Aggregation query (raw SQL for reference — wrap in storage method):
```sql
SELECT
  COUNT(*) FILTER (WHERE event_type = 'task_completed') AS tasks_completed,
  COUNT(*) FILTER (WHERE event_type = 'handoff_chain_completed') AS handoffs,
  SUM((payload->>'costUsd')::numeric) FILTER (WHERE payload->>'costUsd' IS NOT NULL) AS cost_today
FROM autonomy_events
WHERE project_id = $1
  AND timestamp >= date_trunc('day', now() AT TIME ZONE 'UTC')
```

Note: `costUsd` in payload is speculative — verify whether `taskExecutionPipeline.ts` logs cost in autonomy_events payload. If not, the cost figure may need to come from `server/billing/usageTracker.ts` instead.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| RightSidebar with 2-tab toggle (Overview / Tasks) | 3-tab shell (Activity / Brain & Docs / Approvals) | Phase 11 | All v1.3 components plug into tabs |
| AutonomousApprovalCard only in chat inline | Approvals available in dedicated Approvals tab | Phase 11 (shell) + Phase 13 (content) | Users can review approvals without scrolling chat |
| Agent avatars have 4 states: idle/thinking/speaking/celebrating | 5 states: + working (rotating dashed ring) | Phase 11 | Users can see which agents are currently executing |
| No autonomy event visibility in sidebar | Live activity feed with stats + filters | Phase 11 | Core visibility for the v1.3 milestone |

---

## Open Questions

1. **Does `taskExecutionPipeline.ts` log LLM cost per task to `autonomy_events.payload`?**
   - What we know: `usageTracker.ts` records token usage in `server/billing/`. `autonomy_events` payload is a JSONB `Record<string, unknown>`.
   - What's unclear: Whether cost data flows into autonomy_events or stays only in billing tables.
   - Recommendation: Before writing the stats endpoint, grep `autonomy_events` payload writes in `taskExecutionPipeline.ts` for a `costUsd` field. If absent, pull today's cost from `server/billing/usageTracker.ts` `getDailyUsageSummary` instead.

2. **Does `background_execution_started` WS event carry `agentId`?**
   - What we know: `wsSchemas.ts` line 188-189 shows `background_execution_started` uses `.passthrough()` — its shape is not typed.
   - What's unclear: Whether the WS event includes `agentId` when dispatched.
   - Recommendation: Read `taskExecutionPipeline.ts` broadcast call before writing `useAgentWorkingState` to confirm the payload shape. If `agentId` is absent, the "working" avatar state cannot be per-agent — it would have to be per-project (all agents show working).

3. **Is there an index on `autonomy_events(project_id, timestamp)`?**
   - What we know: The schema migration `0001_opposite_killmonger.sql` created the `autonomy_events` table.
   - What's unclear: Whether a composite index exists.
   - Recommendation: Read the migration file before writing the stats endpoint. If no index, add a `CREATE INDEX CONCURRENTLY` as part of Phase 11's backend plan, or scope the query to a narrow time window to avoid full table scan.

---

## Validation Architecture

`workflow.nyquist_validation` is absent from `.planning/config.json` — treat as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (vitest.config.ts present at project root) |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run --reporter=verbose 2>/dev/null` |
| Full suite command | `npm run typecheck && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SIDE-01 | 3 tabs render, tab bar visible | unit (component) | `npx vitest run tests/sidebar/SidebarTabBar.test.tsx` | Wave 0 |
| SIDE-02 | Tab switch does not unmount inactive panels | unit | `npx vitest run tests/sidebar/tabHiding.test.tsx` | Wave 0 |
| SIDE-03 | Unread badge increments on new event | unit | `npx vitest run tests/sidebar/badgeCount.test.tsx` | Wave 0 |
| SIDE-04 | Tab bar renders inside Sheet on mobile | smoke (manual) | Verify at <768px viewport | manual-only |
| FEED-01 | Feed shows events with avatar + description + timestamp | unit | `npx vitest run tests/sidebar/ActivityFeedItem.test.tsx` | Wave 0 |
| FEED-02 | StatsCard shows 3 numbers from /api/autonomy/stats | unit | `npx vitest run tests/sidebar/AutonomyStatsCard.test.tsx` | Wave 0 |
| FEED-03 | Filter chips filter in-memory event list | unit | `npx vitest run tests/sidebar/FeedFilters.test.tsx` | Wave 0 |
| FEED-04 | Events grouped by traceId produce ≤3 feed items per chain | unit | `npx vitest run tests/hooks/useAutonomyFeed.test.ts` | Wave 0 |
| FEED-05 | EmptyState renders when no events exist | unit | `npx vitest run tests/sidebar/EmptyFeedState.test.tsx` | Wave 0 |
| AGNT-01 | Avatar renders working state ring when agentId in workingAgents | unit | `npx vitest run tests/avatars/BaseAvatar.test.tsx` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run typecheck`
- **Per wave merge:** `npm run typecheck && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/sidebar/SidebarTabBar.test.tsx` — covers SIDE-01, SIDE-03
- [ ] `tests/sidebar/tabHiding.test.tsx` — covers SIDE-02
- [ ] `tests/sidebar/ActivityFeedItem.test.tsx` — covers FEED-01
- [ ] `tests/sidebar/AutonomyStatsCard.test.tsx` — covers FEED-02
- [ ] `tests/sidebar/FeedFilters.test.tsx` — covers FEED-03
- [ ] `tests/sidebar/EmptyFeedState.test.tsx` — covers FEED-05
- [ ] `tests/hooks/useAutonomyFeed.test.ts` — covers FEED-04
- [ ] `tests/avatars/BaseAvatar.test.tsx` — covers AGNT-01

---

## Sources

### Primary (HIGH confidence — direct codebase inspection)
- `client/src/components/RightSidebar.tsx` — Existing 2-tab pattern, `currentView` state, badge pattern, `layoutId="tab-indicator"` at lines 507-551
- `client/src/hooks/useRightSidebarState.ts` — Full reducer with localStorage; extension points identified
- `client/src/components/avatars/BaseAvatar.tsx` — `AvatarState` union (4 states), `AvatarWrapper` render, `avatarVariants`
- `client/src/components/avatars/AgentAvatar.tsx` — 30-character avatar router, state prop passthrough
- `server/routes/autonomy.ts` — Existing `GET /api/autonomy/events` (lines 594-613), `logAutonomyEvent` patterns
- `server/autonomy/events/eventLogger.ts` — `AutonomyEvent` schema, `readAutonomyEvents`, DB column names for stats query
- `shared/dto/wsSchemas.ts` — All WS event types for `background_execution_started`, `task_execution_completed`, `handoff_chain_completed`
- `client/src/index.css` — Existing `@keyframes` (ai-task-ring, shimmer, brain-glow-pulse, wave-bounce, gradient-shift); CSS custom properties for all hatchin colors
- `.planning/research/PITFALLS.md` — 8 critical pitfalls with prevention strategies; all verified against live code
- `.planning/research/ARCHITECTURE.md` — System overview, component map, recommended structure

### Secondary (MEDIUM confidence — planning documents cross-referenced against code)
- `.planning/phases/11-sidebar-shell-activity-feed/11-CONTEXT.md` — All locked decisions; verified feasible against codebase
- `.planning/STATE.md` — Accumulated decisions: CSS tab hiding rationale, typed CustomEvent registry requirement

### Tertiary (LOW confidence — not independently verified)
- Cost data in autonomy_events payload — unverified; see Open Questions #1
- `background_execution_started` payload shape includes agentId — unverified; see Open Questions #2
- `autonomy_events` composite index existence — unverified; see Open Questions #3

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and in use
- Architecture: HIGH — all patterns derived from existing live code; no speculation
- Pitfalls: HIGH — sourced from comprehensive prior research in PITFALLS.md + direct code verification
- Backend gaps: MEDIUM — stats endpoint design is clear; cost payload field unverified

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable codebase; recheck if significant refactors happen to RightSidebar or CenterPanel before planning begins)
