# Phase 12: Handoff Visualization - Research

**Researched:** 2026-03-25
**Domain:** React component patterns, Framer Motion animation, WebSocket event handling, Shadcn Dropdown, chat-inline UI cards
**Confidence:** HIGH — derived entirely from direct codebase inspection of live files; all findings verified against current code

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| HAND-01 | Handoff messages in chat render as visual cards with from-agent avatar, arrow, to-agent avatar, and task title | Messages with `metadata.isHandoffAnnouncement: true` already exist in DB; CenterPanel message loop must detect them and render `HandoffCard` instead of `MessageBubble` |
| HAND-02 | Activity tab shows a vertical handoff chain timeline with animated connectors between agents | `useAutonomyFeed` already receives `handoff_announced` events via `AUTONOMY_EVENTS.HANDOFF_ANNOUNCED`; `HandoffChainTimeline` component groups events by `traceId`, renders vertical timeline |
| HAND-03 | User can manually hand off a task to another agent via "Hand off to..." dropdown button in chat input | No server handoff-initiation endpoint exists yet; `POST /api/tasks/:taskId/handoff` is needed; dropdown reads `activeProjectAgents` already available in CenterPanel |
| HAND-04 | User sees a deliberation indicator card when multiple agents are coordinating, expandable to show details | `deliberation_round` and `synthesis_completed` WS events already exist; `DeliberationCard` must be rendered inline in chat when these arrive for the current conversation |
</phase_requirements>

---

## Summary

Phase 12 adds four distinct UI surfaces: a chat-level HandoffCard replacing announcement text, a sidebar HandoffChainTimeline in the Activity tab, a manual "Hand off to..." dropdown in the chat input, and a collapsible DeliberationCard for multi-agent coordination. All four are pure frontend additions except HAND-03, which requires one new REST endpoint.

The phase builds on a solid Phase 11 foundation: the three-tab RightSidebar, `useAutonomyFeed` hook, CustomEvent bridge (`autonomyEvents.ts`), `AUTONOMY_EVENTS` registry, and `ActivityFeedItem` color-category patterns are all in place. Phase 12 components consume and extend these primitives.

The key architectural insight is that handoff messages already exist in the database with `metadata.isHandoffAnnouncement: true`. The problem is purely visual: CenterPanel currently renders all agent messages through `MessageBubble` regardless of metadata. Phase 12 must add a branching condition in the message render loop so that handoff-flagged messages render as `HandoffCard` instead. No backend changes are needed for HAND-01 or HAND-02 or HAND-04 — only for HAND-03.

**Primary recommendation:** Implement in three independent streams: (1) HandoffCard in CenterPanel + HandoffChainTimeline in sidebar, (2) deliberation indicator card, (3) manual handoff dropdown + backend endpoint. Stream (1) and (2) can be planned as separate tasks, stream (3) requires the one backend addition.

---

## Standard Stack

### Core (all already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Framer Motion | 11.13.1 | Card entrance animation, timeline connector animation | Already used throughout app — `initial/animate/exit` patterns established |
| Tailwind CSS | 3.4.17 | All styling | Project standard — never inline styles |
| Radix UI DropdownMenu | via Shadcn | "Hand off to..." agent picker | Already used in Shadcn stack |
| Lucide React | 0.453.0 | Arrow icons (ArrowRight), expand/collapse (ChevronDown), deliberation (Users) | Project icon set |
| AgentAvatar | local | Render from-agent and to-agent avatars in HandoffCard | Already handles all 30 character names + FallbackAvatar |

### No New Dependencies
All Phase 12 work is achievable with existing packages. No `npm install` required.

---

## Architecture Patterns

### Recommended Component Structure
```
client/src/components/
├── chat/
│   ├── HandoffCard.tsx          # Inline chat card — from-agent avatar → arrow → to-agent avatar + task title
│   └── DeliberationCard.tsx     # Collapsible coordination indicator for multi-agent deliberations
└── sidebar/
    └── HandoffChainTimeline.tsx  # Vertical timeline in Activity tab showing handoff sequence
```

### Pattern 1: HandoffCard — Branching in CenterPanel Message Loop

**What:** Inside the `currentMessages.map(...)` loop in CenterPanel (lines ~2536–2575), check `message.metadata?.isHandoffAnnouncement`. If true, render `HandoffCard` instead of `MessageBubble`.

**When to use:** Every time an agent message has `metadata.isHandoffAnnouncement: true` in the current conversation.

**Example (the exact branching point):**
```typescript
// CenterPanel.tsx — in the currentMessages.map() loop (line ~2543)
{message.metadata?.isHandoffAnnouncement ? (
  <HandoffCard
    key={message.id}
    fromAgentId={message.senderId}
    fromAgentName={message.senderName}
    fromAgentRole={message.metadata?.agentRole}
    toAgentId={message.metadata?.nextAgentId}
    toAgentName={message.metadata?.nextAgentName}   // may need to resolve from activeProjectAgents
    taskTitle={message.metadata?.taskTitle ?? message.content}
    timestamp={message.timestamp}
  />
) : (
  <MessageBubble ... />
)}
```

**Key detail:** `handoffAnnouncement.ts` stores `nextAgentId` in metadata but NOT `nextAgentName`. CenterPanel must resolve the agent name from `activeProjectAgents` using `nextAgentId`.

**HandoffCard structure (visual spec):**
```
┌─────────────────────────────────────────────────────────┐
│  [Avatar:from]  [Name]  ──→──  [Avatar:to]  [Name]      │
│  "Handed off: [task title]"                  [2m ago]   │
└─────────────────────────────────────────────────────────┘
```
- Left border: `bg-[var(--hatchin-blue)]` (handoff category color, established in Phase 11)
- Arrow icon: `ArrowRight` from Lucide, `hatchin-text-muted`
- Avatars: `AgentAvatar` component, `size={28}`
- Container: `mx-4 my-1.5 p-3 rounded-xl border border-[var(--hatchin-blue)]/20 bg-[var(--hatchin-blue)]/5`
- Framer Motion `initial={{ opacity: 0, y: 6 }}` / `animate={{ opacity: 1, y: 0 }}`

### Pattern 2: HandoffChainTimeline — Activity Tab Extension

**What:** A new section inside `ActivityTab.tsx` that renders when there are `handoff` category events. Groups events by `traceId` and shows a vertical timeline with animated connectors.

**When to use:** When `activeFilter === 'all' || activeFilter === 'handoff'` and there are handoff events in the filtered list.

**Data shape already available:** `FeedEvent` has `traceId`, `agentId`, `agentName`, `category`. For timeline, filter `events.filter(e => e.category === 'handoff')` and group by `traceId`.

**Timeline structure:**
```
[Avatar:Agent1]  Agent1  completed: Task A
     |  (animated line connector)
[Avatar:Agent2]  Agent2  started: Task B
     |
[Avatar:Agent3]  Agent3  started: Task C
```

**Animation approach:** CSS `@keyframes` for the connector line (draw from top to bottom, 0.3s, ease-out). Use `motion.div` with `initial={{ height: 0 }}` → `animate={{ height: 'auto' }}` on the connector line between nodes.

**Where to insert:** Inside `ActivityTab.tsx`, after the stats card + filter chips, render `HandoffChainTimeline` only when handoff events exist. Keep the flat `ActivityFeedItem` list for all other events.

### Pattern 3: Manual Handoff Dropdown (HAND-03)

**What:** A "Hand off to..." button in the chat input area, left of the send button. Opens a Radix `DropdownMenu` listing available project agents (excluding Maya, excluding the currently speaking agent). Selecting an agent creates a new task and queues it for that agent via a new REST endpoint.

**Where to add:** In CenterPanel, inside the `<form onSubmit={handleChatSubmit}>` section (line ~2777). Add a small button left of the textarea (or below it in the composer row).

**Agent list source:** `activeProjectAgents` is already available in CenterPanel. Filter out `isSpecialAgent` and the currently-focused agent.

**New backend endpoint needed:**
```
POST /api/tasks/:taskId/handoff
Body: { targetAgentId: string, projectId: string }
Auth: session required
```
This endpoint calls `orchestrateHandoff()` directly. It creates a synthetic "next task" record in the tasks table with `metadata.dependsOn` pointing to the most recently completed task of the current agent, then calls `queueTaskExecution`.

**Alternative for MVP:** Instead of a new API endpoint, the "Hand off to..." action can work by sending a specially-formatted chat message: `"@[AgentName] [typed content]"`. This uses the existing `addressedAgentId` WS field in `send_message_streaming`. This is simpler and does not require backend changes. The planner should choose based on scope.

**Dropdown UI:**
```tsx
// Uses Shadcn DropdownMenu (already installed via Radix)
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";

<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <button className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-hatchin-text-muted hover:text-hatchin-text hover:bg-hatchin-surface-hover rounded-lg transition-colors">
      <ArrowRight className="w-3.5 h-3.5" />
      Hand off to...
    </button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    {handoffableAgents.map(agent => (
      <DropdownMenuItem key={agent.id} onClick={() => handleHandoff(agent)}>
        <AgentAvatar agentName={agent.name} role={agent.role} size={20} />
        {agent.name} · {agent.role}
      </DropdownMenuItem>
    ))}
  </DropdownMenuContent>
</DropdownMenu>
```

### Pattern 4: DeliberationCard — Inline Coordination Indicator (HAND-04)

**What:** A collapsible card rendered in the chat timeline when `deliberation_round` or `synthesis_completed` WS events arrive for the current conversation. Shows that multiple agents are working together.

**When to use:** CenterPanel receives `deliberation_round` WS event → show DeliberationCard. When `synthesis_completed` arrives → transition to "resolved" state.

**WS events to handle:** `deliberation_round` (passthrough in wsSchemas.ts line ~120) and `synthesis_completed` (not currently in wsSchemas, need to add). The `conductor_decision` event is the signal that deliberation is happening.

**State management:** Add a `deliberationState` React state in CenterPanel (or a custom hook):
```typescript
interface DeliberationState {
  sessionId: string;
  agentNames: string[];
  roundCount: number;
  status: 'ongoing' | 'resolved';
  summary?: string;
}
```

**DeliberationCard structure:**
```
┌─────────────────────────────────────────────────────────┐
│  [Users icon]  Agents coordinating...         [chevron] │
│  Alex + Dev + Cleo are working through this             │
│  ▼ (expanded)                                           │
│  Round 1: Alex proposed approach A                      │
│  Round 2: Dev flagged technical constraint              │
│  Round 3: Cleo suggested compromise                     │
│  Resolved: Final synthesis ready                        │
└─────────────────────────────────────────────────────────┘
```

- Left border: `bg-gray-400` (system category color, matches Phase 11 pattern)
- Expanded content: `AnimatePresence` + `motion.div` with height animation
- Position in chat: Same as AutonomousApprovalCard — inside the messages scroll area, below regular messages

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Agent avatar rendering | Custom initials/emoji component | `AgentAvatar` with `characterName` / `role` / `agentName` props | Already handles all 30 characters + FallbackAvatar + lazy loading |
| Dropdown for agent picker | Custom select/combobox | Shadcn `DropdownMenu` (Radix primitive) | Already used in the project; accessible, keyboard-navigable |
| Card entrance animation | CSS transitions | Framer Motion `initial/animate/exit` | Matches existing patterns in `AutonomousApprovalCard` and `ActivityFeedItem` |
| Timeline connector line | Canvas or SVG | CSS border-left `2px solid` + `@keyframes` height | Phase 11 already uses this pattern for the left color border on feed items |
| CustomEvent listening | Raw `window.addEventListener` | `useSidebarEvent` hook from `@/hooks/useSidebarEvent` | Established pattern — handles cleanup automatically |
| Dispatching autonomy events | Raw `window.dispatchEvent` | `dispatchAutonomyEvent` from `@/lib/autonomyEvents` | Typed, prevents string literal errors |

**Key insight:** The hardest part of this phase is not building new components — it's wiring existing data (isHandoffAnnouncement metadata, handoff_announced CustomEvents, deliberation WS events) into the correct render paths. The components themselves are straightforward.

---

## Common Pitfalls

### Pitfall 1: nextAgentName Missing from Handoff Metadata
**What goes wrong:** `handoffAnnouncement.ts` stores `nextAgentId` in message metadata but not `nextAgentName`. If `HandoffCard` tries to read `message.metadata.nextAgentName`, it gets `undefined`.
**Why it happens:** The server's `emitHandoffAnnouncement` function creates the message with only `{ isAutonomous: true, isHandoffAnnouncement: true, nextAgentId }`.
**How to avoid:** Resolve agent name from `activeProjectAgents.find(a => a.id === message.metadata?.nextAgentId)?.name` in CenterPanel before passing to `HandoffCard`.
**Warning signs:** HandoffCard renders with "Unknown" or blank to-agent name.

### Pitfall 2: HandoffCard Rendered Twice (Duplicate)
**What goes wrong:** CenterPanel has duplicate message prevention that checks content equality. Handoff announcement text might be very similar across handoffs and trigger duplicate suppression, or the same handoff event arrives via both REST historical load and real-time WS.
**Why it happens:** The `hasRecentEquivalent` check compares `content.trim()` — two handoffs with the same announcement text within 10 seconds would collide.
**How to avoid:** The existing `isHandoffAnnouncement` metadata flag is unique enough — do not add content-based deduplication for handoff cards. They are distinguished by `message.id`.

### Pitfall 3: Deliberation Card Stuck in "ongoing" State
**What goes wrong:** `synthesis_completed` WS event never arrives (rare server-side timeout), leaving the card in "coordinating..." state forever.
**Why it happens:** `deliberationBudgetMs` is 12,000ms by default. If deliberation times out, `deliberation_timeout` fires but `synthesis_completed` does not.
**How to avoid:** Auto-resolve `DeliberationCard` after 30 seconds if no resolution event arrives. Listen for both `synthesis_completed` and `deliberation_timeout` to transition to resolved state.

### Pitfall 4: HandoffChainTimeline Groups Wrong Events
**What goes wrong:** Multiple unrelated handoffs share a common `traceId` pattern, causing unrelated handoff nodes to appear in the same timeline chain.
**Why it happens:** `traceId` is not always unique to a handoff chain — it's the broader execution trace ID. Multiple tasks in one background execution run share a `traceId`.
**How to avoid:** Group by `traceId` but only include events with `category === 'handoff'`. Within a group, sort by timestamp. Max timeline depth: 5 nodes — truncate if a chain is longer.

### Pitfall 5: "Hand off to..." Dropdown Shows Maya
**What goes wrong:** The dropdown lists Maya (special agent) as a handoff target, which makes no sense because Maya is the project-level idea partner, not a task executor.
**Why it happens:** `activeProjectAgents` includes Maya (filtered from sidebar display, but available in the array).
**How to avoid:** Filter `agent.isSpecialAgent !== true` when building the handoff target list.

### Pitfall 6: Framer Motion layoutId Conflict
**What goes wrong:** If `HandoffCard` or `DeliberationCard` uses a `layoutId` that conflicts with the existing `sidebar-tab` or `brain-tab-indicator` layoutId from Phase 11.
**Why it happens:** Framer Motion layoutId must be globally unique in the component tree. The existing layoutIds from Phase 11 are `sidebar-tab` and `brain-tab-indicator`.
**How to avoid:** Use distinct layoutId namespaces: `handoff-card-{message.id}` for HandoffCard. Do not use a shared layoutId for DeliberationCard (it appears only once at a time).

---

## Code Examples

Verified patterns from existing codebase:

### How to Branch in the Message Render Loop
```typescript
// CenterPanel.tsx — in the currentMessages.map() loop
// Source: lines 2536–2575 of CenterPanel.tsx
{currentMessages.map((message, index) => {
  const isHandoff = (message.metadata as any)?.isHandoffAnnouncement === true;
  if (isHandoff) {
    const toAgent = activeProjectAgents.find(
      a => a.id === (message.metadata as any)?.nextAgentId
    );
    return (
      <HandoffCard
        key={message.id}
        fromAgentName={message.senderName}
        fromAgentRole={(message.metadata as any)?.agentRole}
        toAgentName={toAgent?.name ?? 'Team'}
        toAgentRole={toAgent?.role}
        taskTitle={(message.metadata as any)?.taskTitle ?? message.content}
        timestamp={message.timestamp}
      />
    );
  }
  return (
    <div key={message.id}>
      <MessageBubble ... />
    </div>
  );
})}
```

### AutonomousApprovalCard Pattern (existing — copy structure for HandoffCard)
```typescript
// Source: client/src/components/AutonomousApprovalCard.tsx
<motion.div
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -4 }}
  transition={{ duration: 0.18, ease: 'easeOut' }}
  className="mx-4 my-2 p-4 rounded-xl border border-[color]/30 bg-[color]/10"
>
```

### useSidebarEvent Hook Pattern (already established)
```typescript
// Source: client/src/hooks/useSidebarEvent.ts
useSidebarEvent<HandoffAnnouncedPayload>(
  AUTONOMY_EVENTS.HANDOFF_ANNOUNCED,
  (detail) => {
    if (projectId && detail.projectId === projectId) {
      // handle handoff event
    }
  },
  [projectId]
);
```

### ActivityFeedItem Color-Category Pattern (Phase 11 established)
```typescript
// Source: client/src/components/sidebar/ActivityFeedItem.tsx
// handoff category → bg-[var(--hatchin-blue)]
// Use this same mapping in HandoffChainTimeline connector lines
```

### Dispatching a CustomEvent from CenterPanel
```typescript
// Source: client/src/lib/autonomyEvents.ts + existing CenterPanel patterns
import { dispatchAutonomyEvent, AUTONOMY_EVENTS } from '@/lib/autonomyEvents';
import type { HandoffAnnouncedPayload } from '@/lib/autonomyEvents';

// When a new_message arrives with isHandoffAnnouncement: true
dispatchAutonomyEvent<HandoffAnnouncedPayload>(AUTONOMY_EVENTS.HANDOFF_ANNOUNCED, {
  fromAgentId: message.senderId,
  fromAgentName: message.senderName,
  toAgentId: (message.metadata as any).nextAgentId,
  toAgentName: toAgent?.name ?? 'Team',
  taskTitle: (message.metadata as any).taskTitle ?? message.content,
  traceId: (message.metadata as any).traceId ?? message.id,
  projectId: activeProject!.id,
});
```

**Critical:** CenterPanel currently does NOT dispatch `AUTONOMY_EVENTS.HANDOFF_ANNOUNCED` when it receives a `new_message` with `isHandoffAnnouncement: true`. Phase 12 must add this dispatch so `useAutonomyFeed` can update the sidebar timeline in real time. Without this, the sidebar only shows historical handoffs from the REST API, not live ones.

### AgentAvatar Usage Pattern
```typescript
// Source: client/src/components/avatars/AgentAvatar.tsx
<AgentAvatar
  agentName="Alex"     // character name → triggers Alex's SVG avatar
  role="Product Manager"  // fallback if no character name
  size={28}
  state="idle"
/>
```

---

## Backend Analysis: What Exists vs. What Needs Building

### Exists (no changes needed)
| Capability | Location |
|------------|----------|
| `metadata.isHandoffAnnouncement: true` flag on messages | `server/autonomy/handoff/handoffAnnouncement.ts` line 43 |
| `metadata.nextAgentId` on handoff announcement messages | `handoffAnnouncement.ts` line 46 |
| `handoff_announced` autonomy event type | `server/autonomy/events/eventTypes.ts` |
| `HandoffAnnouncedPayload` type with `fromAgentId/Name`, `toAgentId/Name`, `taskTitle`, `traceId` | `client/src/lib/autonomyEvents.ts` lines 42–50 |
| `AUTONOMY_EVENTS.HANDOFF_ANNOUNCED` constant | `client/src/lib/autonomyEvents.ts` |
| `useSidebarEvent` for listening to custom events | `client/src/hooks/useSidebarEvent.ts` |
| `useAutonomyFeed` already listens for `HANDOFF_ANNOUNCED` events | `client/src/hooks/useAutonomyFeed.ts` lines 270–278 |
| `deliberation_round` event type | `server/autonomy/events/eventTypes.ts` |
| `WS passthrough` for `conductor_decision` | `shared/dto/wsSchemas.ts` line 121 |
| `GET /api/autonomy/events` — includes handoff events | `server/routes/autonomy.ts` |

### Missing (must be built in Phase 12)
| Gap | Where to Add |
|-----|-------------|
| CenterPanel does NOT dispatch `AUTONOMY_EVENTS.HANDOFF_ANNOUNCED` when receiving handoff announcement messages via WS `new_message` | `client/src/components/CenterPanel.tsx` — inside `message.type === 'new_message'` handler |
| `HandoffCard` component does not exist | Create `client/src/components/chat/HandoffCard.tsx` |
| `HandoffChainTimeline` component does not exist | Create `client/src/components/sidebar/HandoffChainTimeline.tsx` |
| `DeliberationCard` component does not exist | Create `client/src/components/chat/DeliberationCard.tsx` |
| CenterPanel does not track deliberation state | Add `deliberationState` state + WS handler for `conductor_decision` in CenterPanel |
| `POST /api/tasks/:taskId/handoff` endpoint does not exist | Add to `server/routes/tasks.ts` (only needed for full HAND-03; see alternative approach) |
| `metadata.nextAgentName` not stored by server | Either resolve from `activeProjectAgents` client-side (preferred) or add to server payload |
| `synthesis_completed` not in wsSchemas.ts passthrough list | Add passthrough entry to `shared/dto/wsSchemas.ts` |

---

## State of the Art

| Old Approach | Current Approach | Changed | Impact |
|--------------|------------------|---------|--------|
| Handoff announced as plain text in chat | Handoff metadata set (`isHandoffAnnouncement: true`) but still rendered as MessageBubble | Since v1.1 | Phase 12 must visually differentiate |
| No handoff timeline | Phase 11 ActivityFeed shows flat events including `handoff_announced` type | Since Phase 11 | Phase 12 groups them into a timeline sub-view |
| No user-initiated handoff | Users can only type `@AgentName message` to direct conversation | Since v1.0 | Phase 12 adds explicit "Hand off to..." UX |

---

## Open Questions

1. **HAND-03 scope: new API endpoint vs. @-mention shortcut**
   - What we know: The existing `send_message_streaming` WS message accepts `addressedAgentId`, which already routes to a specific agent
   - What's unclear: Does the planner want a formal task handoff (creates a task object, uses `orchestrateHandoff` pipeline) or just a conversation direction change (simpler, no task object created)?
   - Recommendation: For MVP, use `addressedAgentId` approach in the WS message — no backend changes needed. The dropdown prepopulates the input with `@[AgentName]` and sets `addressedAgentId`. Defer the formal task handoff API to a future iteration.

2. **DeliberationCard trigger: when exactly should it appear?**
   - What we know: `conductor_decision` WS event fires when routing resolves. `deliberation_round` fires during multi-agent deliberation. Not all conversations trigger deliberation.
   - What's unclear: Should the card appear on every `conductor_decision` (too noisy) or only when `reviewRequired: true` in the conductor result?
   - Recommendation: Trigger only when `conductor_decision` payload includes `reviewRequired: true` or `reviewerCount >= 1`. This matches mid/high-risk scenarios only.

3. **HandoffChainTimeline placement in ActivityTab**
   - What we know: ActivityTab currently shows a flat list of `ActivityFeedItem` components
   - What's unclear: Should handoff timeline be a separate section above the flat list, or should it replace the flat `ActivityFeedItem` display for handoff events?
   - Recommendation: Show timeline only when `activeFilter === 'handoff'`. When filter is 'all', show flat list as-is. This avoids layout disruption for users who aren't focused on handoffs.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 1.x (via `vitest.config.ts`) |
| Config file | `vitest.config.ts` — includes `scripts/**/*.test.ts` |
| Quick run command | `npx vitest run scripts/` |
| Full suite command | `npm run typecheck && npx vitest run scripts/` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HAND-01 | HandoffCard renders when `isHandoffAnnouncement: true` | manual — React component visual | `npm run typecheck` | ❌ Wave 0 |
| HAND-02 | HandoffChainTimeline groups handoff events by traceId | unit | `npx vitest run scripts/test-handoff-timeline.test.ts` | ❌ Wave 0 |
| HAND-03 | Manual handoff dropdown filters out Maya + renders agents | manual — UI interaction | `npm run typecheck` | ❌ Wave 0 |
| HAND-04 | DeliberationCard shows on conductor_decision + collapses | manual — UI interaction | `npm run typecheck` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run typecheck`
- **Per wave merge:** `npm run typecheck && npx vitest run scripts/`
- **Phase gate:** Full typecheck + build green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `scripts/test-handoff-timeline.test.ts` — unit test for `HandoffChainTimeline` traceId grouping logic (pure function, no DOM needed)
- [ ] TypeScript strict mode will catch most integration issues at compile time — no additional fixtures needed

*(All visual component tests are manual-only — React component rendering tests would require `@testing-library/react` which is not currently installed)*

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — `server/autonomy/handoff/handoffAnnouncement.ts` — confirms `isHandoffAnnouncement` metadata
- Direct codebase inspection — `server/autonomy/handoff/handoffOrchestrator.ts` — confirms handoff chain flow
- Direct codebase inspection — `client/src/lib/autonomyEvents.ts` — confirms `HandoffAnnouncedPayload` type + `AUTONOMY_EVENTS.HANDOFF_ANNOUNCED`
- Direct codebase inspection — `client/src/hooks/useAutonomyFeed.ts` — confirms existing `HANDOFF_ANNOUNCED` listener
- Direct codebase inspection — `client/src/components/CenterPanel.tsx` — confirms message loop structure + absence of handoff dispatch
- Direct codebase inspection — `shared/dto/wsSchemas.ts` — confirms `conductor_decision` passthrough
- Direct codebase inspection — `client/src/components/avatars/AgentAvatar.tsx` — confirms all 30 character avatars + FallbackAvatar
- Direct codebase inspection — `client/src/components/AutonomousApprovalCard.tsx` — confirms Framer Motion card pattern to copy
- Direct codebase inspection — `client/src/components/sidebar/ActivityFeedItem.tsx` — confirms category color mapping

### Secondary (MEDIUM confidence)
- Phase 11 SUMMARY and RESEARCH files — confirm patterns established, component locations, decisions made

---

## Metadata

**Confidence breakdown:**
- Backend data availability: HIGH — `isHandoffAnnouncement` metadata confirmed in source
- Component architecture: HIGH — all building blocks are live in the codebase
- Animation approach: HIGH — Framer Motion patterns directly inspected
- HAND-03 implementation path: MEDIUM — two viable approaches exist; planner should choose

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (stable stack — valid for 30 days)
