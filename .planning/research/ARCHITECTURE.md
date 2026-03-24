# Architecture Research

**Domain:** Autonomy Visibility UI — tabbed sidebar revamp, real-time activity feed, file upload, task pipeline (v1.3)
**Researched:** 2026-03-24
**Confidence:** HIGH (primary patterns derived from direct codebase inspection + verified against React ecosystem best practices)

> **Note:** This file supersedes the v1.1 backend architecture research. v1.3 is primarily a frontend milestone. The backend architecture from v1.1 remains valid and is documented in CLAUDE.md sections on the autonomy subsystem.

---

## Standard Architecture

### System Overview

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                            home.tsx (Layout Root)                               │
│  ┌──────────────┐   ┌──────────────────────────────┐   ┌─────────────────────┐ │
│  │  LeftSidebar │   │        CenterPanel            │   │    RightSidebar     │ │
│  │              │   │  ┌────────────────────────┐   │   │  ┌───────────────┐  │ │
│  │  ProjectTree │   │  │  WebSocket (SINGLE     │   │   │  │ SidebarShell  │  │ │
│  │  AgentList   │   │  │  connection owner)     │   │   │  │  (tab bar +   │  │ │
│  │  [working    │   │  │  handleIncomingMessage │   │   │  │   mount/unmnt)│  │ │
│  │   avatar     │   │  │  → dispatch Custom-    │   │   │  ├───────────────┤  │ │
│  │   state]     │   │  │    Event to window     │   │   │  │  ActivityTab  │  │ │
│  └──────────────┘   │  └────────────────────────┘   │   │  │  BrainDocsTab │  │ │
│                     │  ┌────────────────────────┐   │   │  │  ApprovalsTab │  │ │
│                     │  │  Message list           │   │   │  └───────────────┘  │ │
│                     │  │  HandoffCard (inline)   │   │   │                     │ │
│                     │  │  ApprovalCard (inline)  │   │   │  [window event      │ │
│                     │  └────────────────────────┘   │   │   subscribers]      │ │
│                     └──────────────────────────────────  └─────────────────────┘ │
├────────────────────────────────────────────────────────────────────────────────┤
│                       CustomEvent Bridge (window object)                        │
│  ai_streaming_active     autonomy_handoff_announced   autonomy_task_executing   │
│  project_brain_updated   autonomy_task_completed      autonomy_peer_review_*    │
│  tasks_updated           autonomy_approval_required   agent_working_state       │
│  task_created_from_chat  brain_updated_from_chat                                │
├────────────────────────────────────────────────────────────────────────────────┤
│                        TanStack Query (REST — on demand)                        │
│  /api/autonomy/events?projectId=   /api/autonomy/pending-approvals             │
│  /api/projects/:id (brain + docs)  /api/tasks?projectId=                       │
├────────────────────────────────────────────────────────────────────────────────┤
│                        Backend (read-only from frontend perspective)            │
│  autonomy_events table   projects.brain JSONB   tasks table                    │
│  deliberation_traces     agents.personality.trustMeta                          │
└────────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| `CenterPanel.tsx` | Single WebSocket owner, streaming, message rendering, CustomEvent dispatch for all autonomy WS events | All sidebar components via window events; home.tsx via props |
| `RightSidebar.tsx` (shell) | Tab bar render, active tab state persisted in localStorage, mount/unmount tab panels on demand | Child tab panels via props; useRightSidebarState hook |
| `SidebarTabBar.tsx` | Tab button strip (Activity / Brain & Docs / Approvals), badge counts | RightSidebar via props |
| `ActivityTab.tsx` | Feed container: composes FeedItem list, StatsCard, Filters, EmptyState | useAutonomyFeed hook |
| `ActivityFeedItem.tsx` | Single event row: icon, agent name, human-readable label, relative time | Pure display, no external deps |
| `AutonomyStatsCard.tsx` | Aggregate counts: completions, handoffs, total cost | Computed from useAutonomyFeed.events |
| `FeedFilters.tsx` | Filter chip row: event type, agent, time range | Controlled by ActivityTab state |
| `HandoffChainTimeline.tsx` | Visual node-chain for a multi-hop handoff trace | autonomy_events data grouped by traceId |
| `DeliberationCard.tsx` | Expandable peer review / deliberation summary | Single autonomy_event with type=peer_review_* |
| `EmptyFeedState.tsx` | Compelling empty state (no events yet) | Pure display |
| `ApprovalsTab.tsx` | Pending approvals list, badge count | TanStack Query /api/autonomy/pending-approvals |
| `ApprovalItem.tsx` | Single pending approval: description, risk reasons, Approve/Reject buttons | POST /api/action-proposals/:id/approve|reject |
| `TaskPipelineView.tsx` | Horizontal scroll lane view of tasks by status | TanStack Query /api/tasks |
| `BrainDocsTab.tsx` | Brain fields editor + documents list | TanStack Query, /api/projects/:id/documents |
| `DocumentUpload.tsx` | File input, upload progress, extracted text preview | POST /api/projects/:id/documents (multer) |
| `DocumentViewer.tsx` | Expandable document entry with extracted text | Pure display |
| `AutonomySettings.tsx` | Inactivity toggle, cost cap, autonomy level sliders | PATCH /api/projects/:id |
| `WorkOutputViewer.tsx` | Browse deliverables from background agent execution | TanStack Query /api/autonomy/events (filtered) |
| `HandoffCard.tsx` | Styled card for handoff announcement rendered inside chat | MessageBubble (receives via message.metadata.isHandoff) |
| `HandoffButton.tsx` | "Hand off to..." button near message input | CenterPanel, sends WS message |
| `useAutonomyFeed.ts` | Combines REST initial load + WS event appends, filter state, computed stats | TanStack Query + window CustomEvents |
| `useAgentWorkingState.ts` | Tracks Set of agentIds currently executing background tasks | window CustomEvents from CenterPanel |
| `AgentAvatar.tsx` (modified) | Add `isWorking` prop: pulsing ring animation around avatar | Receives agentWorkingIds from LeftSidebar / ProjectTree |

---

## Recommended Project Structure

```
client/src/
├── components/
│   ├── sidebar/                      # New — all RightSidebar tab content
│   │   ├── SidebarTabBar.tsx          # Tab button strip
│   │   ├── ActivityTab.tsx            # Tab container
│   │   ├── ActivityFeedItem.tsx       # Single event row
│   │   ├── AutonomyStatsCard.tsx      # Completion/handoff/cost summary
│   │   ├── FeedFilters.tsx            # Filter chips
│   │   ├── HandoffChainTimeline.tsx   # Multi-hop node chain
│   │   ├── DeliberationCard.tsx       # Peer review trace card
│   │   ├── EmptyFeedState.tsx         # Empty state visual
│   │   ├── ApprovalsTab.tsx           # Tab container
│   │   ├── ApprovalItem.tsx           # Single approval action
│   │   ├── TaskPipelineView.tsx       # Horizontal status lanes
│   │   ├── TaskPipelineCard.tsx       # Single task card in pipeline
│   │   ├── BrainDocsTab.tsx           # Tab container (replaces brain section)
│   │   ├── DocumentUpload.tsx         # File input + progress + preview
│   │   ├── DocumentViewer.tsx         # Expandable doc entry
│   │   ├── AutonomySettings.tsx       # Inactivity toggle, cost cap, level
│   │   └── WorkOutputViewer.tsx       # Deliverable browser
│   ├── chat/                          # New — chat-embedded autonomy visuals
│   │   ├── HandoffCard.tsx            # Handoff announcement styled card
│   │   └── HandoffButton.tsx          # "Hand off to..." button in input area
│   ├── avatars/
│   │   └── BaseAvatar.tsx             # Modified: add AvatarState.working + pulse
│   ├── RightSidebar.tsx               # Decomposed to thin shell + SidebarTabBar
│   ├── CenterPanel.tsx                # Modified: dispatch autonomy CustomEvents
│   └── MessageBubble.tsx              # Modified: render HandoffCard for handoff msgs
│
├── hooks/
│   ├── useAutonomyFeed.ts             # New: REST bootstrap + WS-append feed state
│   ├── useAgentWorkingState.ts        # New: track executing agent IDs
│   └── useRightSidebarState.ts        # Modified: add activeTab to state
│
└── lib/
    └── autonomyEventLabels.ts         # New: event type → human label + icon map
```

### Structure Rationale

- **`components/sidebar/`:** All tab panel content lives here. When RightSidebar is a thin shell, each panel is self-contained and independently testable. Prevents the monolith from reassembling.
- **`components/chat/`:** HandoffCard and HandoffButton render inside CenterPanel, not the sidebar. Separating by render context (chat vs sidebar) clarifies ownership.
- **`hooks/useAutonomyFeed.ts`:** All feed logic (REST fetch, WS append, filter state, computed stats) lives in one hook. ActivityTab, AutonomyStatsCard, and ApprovalsTab badge all share the same hook instance without prop drilling.
- **`lib/autonomyEventLabels.ts`:** Centralizes event type → human string + icon mapping used by both ActivityFeedItem and AutonomyStatsCard. Avoids duplicating a 50-entry switch statement.

---

## Architectural Patterns

### Pattern 1: Wrap-Then-Decompose for RightSidebar

**What:** Add the tab shell to `RightSidebar.tsx` first — wrapping all existing content inside a "Brain & Docs" tab — then extract inner content panels into separate files in subsequent commits. Never refactor structure and add features in the same commit.

**When to use:** Any time you restructure a large component that must remain functional throughout. The existing 850-line RightSidebar must not break existing brain editing, task notifications, or streaming indicators during the refactor.

**Trade-offs:** Creates a brief period where the inner component is still monolithic inside its tab wrapper, but all tests and UI remain green throughout. Acceptable trade-off.

**Example:**
```typescript
// Phase 1: RightSidebar becomes a shell. Existing content wraps into brain tab.
export function RightSidebar({ activeProject, activeTeam, activeAgent }: RightSidebarProps) {
  const [activeTab, setActiveTab] = usePersistedTab(activeProject?.id ?? 'none', 'activity');
  const { pendingApprovalCount } = useAutonomyFeed(activeProject?.id);

  return (
    <div className="flex flex-col h-full">
      <SidebarTabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        pendingApprovals={pendingApprovalCount}
      />
      {activeTab === 'activity' && (
        <ActivityTab projectId={activeProject?.id} />
      )}
      {activeTab === 'brain' && (
        // Existing brain content mounts here — unchanged in Phase 11
        <ExistingBrainContent activeProject={activeProject} ... />
      )}
      {activeTab === 'approvals' && (
        <ApprovalsTab projectId={activeProject?.id} />
      )}
    </div>
  );
}
```

### Pattern 2: CenterPanel as WS Publisher, Sidebar as Window-Event Subscriber

**What:** CenterPanel owns the single WebSocket connection and remains the only WS subscriber. When CenterPanel receives an autonomy-relevant WS event, it dispatches a typed CustomEvent on `window`. Sidebar components subscribe in `useEffect` via `addEventListener`. This pattern is already established in the codebase — extending it rather than replacing it.

**When to use:** Anytime a downstream component needs to react to WebSocket events but must not own the WS connection. The single WS connection handles auth, conversation scoping, and reconnect — duplicating these elsewhere is a maintenance liability.

**Existing dispatched events (already in CenterPanel):**
- `ai_streaming_active` — brain save lock in RightSidebar
- `project_brain_updated` — auto-sync in useRightSidebarState
- `task_created_from_chat` — task badge in RightSidebar
- `tasks_updated` — task badge in RightSidebar

**New events to add for v1.3:**

| CustomEvent Name | WS Trigger | Detail Payload |
|----------------|-----------|----------------|
| `autonomy_handoff_announced` | `handoff_announced` | `{ projectId, fromAgentId, fromAgentName, toAgentName, taskTitle, traceId }` |
| `autonomy_task_executing` | `task_execution_started` | `{ projectId, agentId, agentName, taskTitle, taskId }` |
| `autonomy_task_completed` | `task_execution_completed` | `{ projectId, agentId, taskTitle, taskId, output }` |
| `autonomy_peer_review_started` | `peer_review_started` | `{ projectId, reviewerName, subjectName }` |
| `autonomy_peer_review_completed` | `peer_review_completed` | `{ projectId, reviewerName, passed, summary }` |
| `autonomy_approval_required` | `approval_required` (already fires inline) | same shape, forwarded to ApprovalsTab too |
| `agent_working_state` | `task_execution_started` + `task_execution_completed` | `{ projectId, agentId, working: boolean }` |

**Trade-offs:** CustomEvents are not type-safe by default. Mitigation: create typed dispatch/subscribe helpers in `client/src/lib/autonomyEvents.ts`.

**Example — type-safe helpers:**
```typescript
// client/src/lib/autonomyEvents.ts
interface AutonomyEventMap {
  autonomy_handoff_announced: { projectId: string; fromAgentName: string; toAgentName: string; taskTitle: string; traceId: string };
  agent_working_state: { projectId: string; agentId: string; working: boolean };
  // ... all other events
}

export function dispatchAutonomyEvent<K extends keyof AutonomyEventMap>(
  name: K, detail: AutonomyEventMap[K]
): void {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

export function onAutonomyEvent<K extends keyof AutonomyEventMap>(
  name: K,
  handler: (detail: AutonomyEventMap[K]) => void
): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<AutonomyEventMap[K]>).detail);
  window.addEventListener(name, listener);
  return () => window.removeEventListener(name, listener);
}
```

**Critical scope guard:** Always filter by `projectId` in every subscriber. The WS connection is global; sidebar shows only active project events.

### Pattern 3: useAutonomyFeed — REST Bootstrap + WS Append (No Polling)

**What:** On mount (or projectId change), fetch the last 50 events from `GET /api/autonomy/events?projectId=X&limit=50` via TanStack Query. Store as initial feed. Subsequent live events arrive via CustomEvent and are prepended to local state without re-fetching. Never use `refetchInterval` for live updates.

**When to use:** Any real-time feed needing historical context on load that must stay current after. REST for history, WS-derived events for live — no polling.

**Trade-offs:** Feed state diverges from server state after tab switch or background updates that bypass the WS (e.g., server restart). Acceptable for v1.3: manually invalidate the TanStack Query cache when ActivityTab becomes visible (use `useEffect` on `activeTab === 'activity'`).

**Example:**
```typescript
export function useAutonomyFeed(projectId: string | undefined) {
  const [liveEvents, setLiveEvents] = useState<FeedEvent[]>([]);
  const [filters, setFilters] = useState<FeedFilters>({ eventType: 'all', agentId: null });

  // REST: initial load
  const { data: initialData, isLoading } = useQuery({
    queryKey: ['/api/autonomy/events', projectId],
    queryFn: () => apiRequest(`/api/autonomy/events?projectId=${projectId}&limit=50`),
    enabled: !!projectId,
    staleTime: 30_000,
    refetchOnWindowFocus: false, // avoid refetch clobbering live events
  });

  // Reset live events when project changes
  useEffect(() => { setLiveEvents([]); }, [projectId]);

  // WS: append new events via CustomEvents
  const appendFeedEvent = useCallback((event: FeedEvent) => {
    setLiveEvents(prev => [event, ...prev].slice(0, 200)); // cap at 200 live events
  }, []);

  useEffect(() => {
    if (!projectId) return;
    const cleanup = [
      onAutonomyEvent('autonomy_handoff_announced', d => d.projectId === projectId && appendFeedEvent(toFeedEvent('handoff', d))),
      onAutonomyEvent('autonomy_task_executing', d => d.projectId === projectId && appendFeedEvent(toFeedEvent('executing', d))),
      onAutonomyEvent('autonomy_task_completed', d => d.projectId === projectId && appendFeedEvent(toFeedEvent('completed', d))),
      onAutonomyEvent('autonomy_peer_review_started', d => d.projectId === projectId && appendFeedEvent(toFeedEvent('peer_review_started', d))),
      onAutonomyEvent('autonomy_peer_review_completed', d => d.projectId === projectId && appendFeedEvent(toFeedEvent('peer_review_completed', d))),
      onAutonomyEvent('autonomy_approval_required', d => d.projectId === projectId && appendFeedEvent(toFeedEvent('approval_required', d))),
    ];
    return () => cleanup.forEach(fn => fn());
  }, [projectId, appendFeedEvent]);

  // Merge: live first, historical deduped
  const allEvents = useMemo(() => {
    const historical = initialData?.events ?? [];
    const liveIds = new Set(liveEvents.map(e => e.id));
    const merged = [...liveEvents, ...historical.filter(e => !liveIds.has(e.id))];
    return applyFilters(merged, filters);
  }, [liveEvents, initialData, filters]);

  const pendingApprovalCount = useMemo(
    () => allEvents.filter(e => e.type === 'approval_required' && !e.resolved).length,
    [allEvents]
  );

  return { events: allEvents, isLoading, filters, setFilters, pendingApprovalCount };
}
```

### Pattern 4: Constrained-Width Pipeline View (No Library)

**What:** For task pipeline inside the sidebar (~280px wide), use a horizontally scrollable flex container with compact columns per status. Full kanban libraries assume 600px+ and provide drag-and-drop that is not needed in v1.3. A right-edge gradient fade hints at scrollable content.

**When to use:** Showing pipeline state in a sidebar where the primary value is visibility, not interaction. Add drag-and-drop only if the pipeline moves to a full-page view in a future milestone.

**Trade-offs:** Horizontal scroll is somewhat hidden from users unfamiliar with the pattern. Mitigate with the gradient fade and an optional "scroll to done →" pill button.

**Example:**
```typescript
const PIPELINE_STAGES = ['queued', 'assigned', 'in-progress', 'review', 'done'] as const;

export function TaskPipelineView({ tasks }: { tasks: Task[] }) {
  const byStage = useMemo(() => groupTasksByStatus(tasks), [tasks]);
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative">
      {/* Fade hint for scrollable overflow */}
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none z-10" />
      <div ref={scrollRef} className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-border">
        {PIPELINE_STAGES.map(stage => (
          <div key={stage} className="flex-shrink-0 w-36">
            <p className="text-xs font-medium text-muted-foreground mb-1.5 capitalize">{stage}</p>
            <div className="flex flex-col gap-1">
              {(byStage[stage] ?? []).map(task => (
                <TaskPipelineCard key={task.id} task={task} />
              ))}
              {!(byStage[stage]?.length) && (
                <div className="h-10 border border-dashed border-border rounded-md flex items-center justify-center">
                  <span className="text-xs text-muted-foreground/50">—</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Pattern 5: File Upload — multer memoryStorage + pdf-parse + JSONB Append

**What:** Use `multer({ storage: multer.memoryStorage() })` (no disk writes). After upload, run `pdf-parse` on `req.file.buffer`. Append a new document entry (extracted text only, no raw bytes) to `projects.brain.documents` JSONB array via PATCH. No S3 or external storage at MVP scale.

**When to use:** Documents are modest in size (< 5MB), infrequent per project (< 20), and are uploaded to give Hatches context rather than for retrieval of the original file.

**Trade-offs:** Extracted text stored in JSONB means no re-download of original. Acceptable: users upload to improve Hatch context, not archive files. The extracted text (capped at 10K chars) adds modest overhead to the `brain` column which is already read per prompt.

**Backend implementation shape:**
```typescript
// server/routes/projects.ts
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

app.post('/api/projects/:id/documents', requireAuth, upload.single('file'), async (req, res) => {
  const project = await storage.getProject(req.params.id);
  if (!project || (project as any).userId !== req.session.userId) return res.status(404).json({ error: 'Not found' });
  if (!req.file) return res.status(400).json({ error: 'No file provided' });

  let extractedText = '';
  if (req.file.mimetype === 'application/pdf') {
    const pdfData = await pdfParse(req.file.buffer);
    extractedText = pdfData.text.slice(0, 10_000);
  } else if (req.file.mimetype.startsWith('text/')) {
    extractedText = req.file.buffer.toString('utf-8').slice(0, 10_000);
  }

  const newDoc = {
    id: crypto.randomUUID(),
    name: req.file.originalname,
    uploadedAt: new Date().toISOString(),
    mimeType: req.file.mimetype,
    charCount: extractedText.length,
    extractedText,
  };

  const currentBrain = (project.brain as any) ?? {};
  await storage.updateProject(project.id, {
    brain: { ...currentBrain, documents: [...(currentBrain.documents ?? []), newDoc] }
  });

  res.status(201).json(newDoc);
});
```

---

## Data Flow

### Real-Time Activity Feed Flow

```
Background agent execution (server)
    ↓ logAutonomyEvent() → autonomy_events table
    ↓ broadcastToConversation() → WS event (handoff_announced / task_completed / etc.)
    ↓
CenterPanel.handleIncomingMessage()
    ↓ dispatchAutonomyEvent('autonomy_handoff_announced', { projectId, ... })
    ↓
useAutonomyFeed (mounted in ActivityTab)
    ↓ CustomEvent listener → appendFeedEvent(normalizedEvent)
    ↓ setLiveEvents([newEvent, ...prev])
    ↓
ActivityTab re-renders
    ↓ ActivityFeedItem[] (most-recent first)
    ↓ AutonomyStatsCard.tsx recomputes aggregates from allEvents
```

### Pending Approvals Flow

```
High-risk autonomous task (server: risk >= 0.60)
    ↓ broadcasts WS: approval_required { taskId, agentName, riskReasons }
    ↓
CenterPanel → renders AutonomousApprovalCard inline in chat (existing behavior, unchanged)
    ↓ also dispatches CustomEvent('autonomy_approval_required', detail)
    ↓
ApprovalsTab — TanStack Query /api/autonomy/pending-approvals
    ↓ renders ApprovalItem with Approve / Reject buttons
    ↓
User clicks Approve → POST /api/action-proposals/:id/approve
    ↓ server updates status, logs event
    ↓ broadcasts approval_resolved WS event
    ↓ CenterPanel dispatches CustomEvent → useAutonomyFeed marks item resolved
    ↓ ApprovalsTab badge count decrements
```

### File Upload Flow

```
User selects file in DocumentUpload
    ↓ FormData POST /api/projects/:id/documents
    ↓
multer (memoryStorage) → req.file.buffer
    ↓ pdf-parse(buffer) → extractedText (capped 10K chars)
    ↓ storage.updateProject() — appends to brain.documents JSONB
    ↓ 201 { id, name, extractedText, charCount }
    ↓
TanStack Query invalidate(['/api/projects', projectId])
    ↓ BrainDocsTab re-renders DocumentViewer list
    ↓ Next agent prompt: promptTemplate.ts reads brain.documents → injects extractedText
```

### Agent Working State Flow

```
Task begins executing (server: task_execution_started WS event)
    ↓
CenterPanel dispatches CustomEvent('agent_working_state', { agentId, working: true, projectId })
    ↓
useAgentWorkingState hook (consumed in LeftSidebar / ProjectTree)
    ↓ adds agentId to workingAgentIds Set
    ↓
AgentAvatar receives isWorking={workingAgentIds.has(agent.id)}
    ↓ renders pulsing ring animation (new AvatarState.working)

Task completes → CenterPanel dispatches agent_working_state { working: false }
    ↓ agentId removed from workingAgentIds Set
    ↓ avatar returns to idle state
```

### Tab State Persistence Flow

```
User selects tab (e.g., "Activity")
    ↓
SidebarTabBar.onTabChange('activity')
    ↓
RightSidebar sets activeTab in useRightSidebarState
    ↓ localStorage.setItem('hatchin_sidebar_tab_${projectId}', 'activity')
    ↓
ActivityTab mounts → useAutonomyFeed fetches initial events
    ↓ TanStack Query ['/api/autonomy/events', projectId] fires

User changes project
    ↓ localStorage key changes (projectId-scoped)
    ↓ activeTab resets to project's last-known tab or default 'activity'
    ↓ ActivityTab unmounts → re-mounts for new project → fresh fetch
```

### State Management Summary

```
Server (authoritative)
    ↓ autonomy_events (all historical)
    ↓ projects.brain JSONB (documents, sharedMemory, coreDirection)
    ↓ tasks table (pipeline status)
    ↓ action_proposals (pending approvals)
    ↓
TanStack Query cache (on-demand REST)
    ├── ['/api/autonomy/events', projectId]         — initial feed (staleTime: 30s)
    ├── ['/api/autonomy/pending-approvals', projectId] — approvals tab
    ├── ['/api/projects', id]                        — brain + docs
    └── ['/api/tasks', { projectId }]                — pipeline view
    ↓
Local React state
    ├── liveEvents[] (useAutonomyFeed — WS-appended, max 200)
    ├── activeFilters (useAutonomyFeed — event type / agent / time)
    └── workingAgentIds Set (useAgentWorkingState)
    ↓
localStorage (persistent client preferences)
    ├── hatchin_sidebar_tab_${projectId}             — active tab per project
    └── hatchin_right_sidebar_preferences            — existing expanded sections
```

---

## Suggested Build Order (Phase Dependencies)

Dependencies flow strictly downward — building out of order creates broken states during development.

```
Phase 11 — Sidebar Restructure & Activity Feed
──────────────────────────────────────────────
  1. lib/autonomyEventLabels.ts          (no deps — pure data)
  2. lib/autonomyEvents.ts               (no deps — type-safe dispatch/subscribe helpers)
  3. hooks/useAgentWorkingState.ts       (depends on autonomyEvents.ts)
  4. hooks/useAutonomyFeed.ts            (depends on autonomyEvents.ts + TanStack Query)
  5. sidebar/ActivityFeedItem.tsx        (pure display, no deps)
  6. sidebar/EmptyFeedState.tsx          (pure display, no deps)
  7. sidebar/AutonomyStatsCard.tsx       (depends on FeedEvent shape from useAutonomyFeed)
  8. sidebar/FeedFilters.tsx             (pure controlled UI, no deps)
  9. sidebar/ActivityTab.tsx             (composes 5–8, depends on useAutonomyFeed)
 10. sidebar/SidebarTabBar.tsx           (pure UI, no deps)
 11. RightSidebar.tsx refactor           (wrap-then-decompose, mount ActivityTab, keep brain content)
 12. CenterPanel.tsx new dispatches      (add 7 new CustomEvent dispatches for autonomy events)
 13. BaseAvatar.tsx + AgentAvatar.tsx    (add working state prop + pulsing animation)

Phase 12 — Handoff Visualization
─────────────────────────────────
  1. chat/HandoffCard.tsx                (pure display, no deps)
  2. sidebar/HandoffChainTimeline.tsx    (depends on HandoffCard shape + autonomy_events grouping)
  3. sidebar/DeliberationCard.tsx        (pure display, no deps)
  4. MessageBubble.tsx modification      (depends on HandoffCard being finalized)
  5. chat/HandoffButton.tsx              (pure UI, depends on WS send shape)
  6. CenterPanel.tsx handoff dispatches  (depends on HandoffCard shape — validates payload shape first)

Phase 13 — Approvals Hub & Task Pipeline
─────────────────────────────────────────
  1. sidebar/ApprovalItem.tsx            (depends on /api/action-proposals API shape)
  2. sidebar/ApprovalsTab.tsx            (composes ApprovalItem, depends on TanStack Query)
  3. sidebar/TaskPipelineCard.tsx        (pure display, no deps)
  4. sidebar/TaskPipelineView.tsx        (depends on TaskPipelineCard + /api/tasks shape)
  5. RightSidebar.tsx — mount ApprovalsTab (final tab addition, depends on ApprovalsTab)
  NOTE: Backend /api/autonomy/pending-approvals endpoint must exist before ApprovalsTab builds

Phase 14 — Brain Redesign & Autonomy Settings
──────────────────────────────────────────────
  1. server/routes/projects.ts — document endpoints (multer + pdf-parse — backend first)
  2. sidebar/DocumentUpload.tsx          (depends on upload endpoint existing)
  3. sidebar/DocumentViewer.tsx          (pure display, no deps)
  4. sidebar/BrainDocsTab.tsx            (composes Upload + Viewer + existing brain fields)
  5. sidebar/AutonomySettings.tsx        (depends on PATCH /api/projects/:id)
  6. sidebar/WorkOutputViewer.tsx        (depends on autonomy_events having output in payload)
  7. RightSidebar.tsx — replace brain content with BrainDocsTab (final content migration)
```

**Critical build constraint:** Backend endpoint additions (Phase 11: `projectId` filter on events; Phase 13: `pending-approvals`; Phase 14: document endpoints) must be built at the start of their respective phases, before any frontend component that depends on them.

---

## Integration with Existing CenterPanel WS Pattern

### What Must Not Change

CenterPanel owns the single WebSocket connection — this is non-negotiable. Do not create a second `useWebSocket` call in any sidebar component. Do not lift WS state into React Context. The CustomEvent bridge pattern is already proven in the codebase (8 existing CustomEvent dispatches in CenterPanel.tsx — lines 612, 658, 837, 1104, 1128, 1145, 1199, 1227).

### Existing CustomEvent Inventory (Must Remain Compatible)

| Event Name | Dispatched When | Subscribed In |
|-----------|----------------|--------------|
| `ai_streaming_active` | streaming starts/ends | RightSidebar (brain save lock) |
| `project_brain_updated` | `brain_updated_from_chat` WS | useRightSidebarState |
| `tasks_updated` | task list changes | RightSidebar badge |
| `task_created_from_chat` | task created via chat | RightSidebar badge |
| `task_requires_approval` | approval WS event | CenterPanel inline card |
| `brain_updated_from_chat` | brain WS event | RightSidebar auto-sync |
| `teams_auto_hatched` | teams WS event | (project refresh) |

All new CustomEvent names must use the `autonomy_` prefix to avoid naming collisions with existing events.

### Backend WS Events Not Yet Dispatched

The following WS event types are logged to `autonomy_events` on the server but are not yet broadcast to the client via `broadcastToConversation`. These need to be wired in `server/autonomy/execution/taskExecutionPipeline.ts` and `server/autonomy/handoff/handoffOrchestrator.ts` before the frontend can receive them:

| WS Event | Server Module | Frontend Need |
|---------|--------------|--------------|
| `task_execution_started` | taskExecutionPipeline | agent working state, feed |
| `task_execution_completed` | taskExecutionPipeline | agent working state, feed, output |
| `peer_review_started` | peerReviewRunner | feed event |
| `peer_review_completed` | peerReviewRunner | feed event |
| `handoff_announced` | handoffOrchestrator | HandoffCard in chat, feed event |

---

## Backend Gaps to Address Before Frontend Can Build

| Gap | What's Needed | Blocks |
|-----|--------------|--------|
| `GET /api/autonomy/events` missing `projectId` query filter | Add `?projectId=` param; currently returns all events scoped only by ownership | Phase 11 useAutonomyFeed initial load |
| No `/api/autonomy/pending-approvals` endpoint | ApprovalsTab needs a query for `action_proposals` where `status = 'pending'` scoped to projectId | Phase 13 ApprovalsTab |
| No document CRUD on projects | Brain docs tab needs `GET /api/projects/:id/documents`, `POST` (upload), `DELETE /:docId` | Phase 14 BrainDocsTab |
| `task_execution_started` / `task_execution_completed` WS events not broadcast | These exist in `logAutonomyEvent` calls but are not sent via `broadcastToConversation` | Phase 11 agent working state + feed |
| `handoff_announced` not yet broadcast via WS | HandoffOrchestrator logs to autonomy_events but does not call `broadcastToConversation` for the handoff_announced event type | Phase 12 HandoffCard |

---

## Anti-Patterns

### Anti-Pattern 1: Second WebSocket in Sidebar

**What people do:** Call `useWebSocket(conversationId)` inside ActivityTab or useAutonomyFeed to receive real-time events directly.

**Why it's wrong:** Creates a second WS connection. The server's `broadcastToConversation` sends events only to the existing conversation connection. A second connection using a different conversation ID receives nothing. Also doubles connection overhead and duplicates the auth/reconnect logic already handled in CenterPanel.

**Do this instead:** Subscribe to CustomEvents dispatched by CenterPanel. CenterPanel handles WS auth, reconnect, and conversation scoping correctly for the entire app.

### Anti-Pattern 2: Polling for Live Feed Updates

**What people do:** Add `refetchInterval: 5000` to the TanStack Query for `/api/autonomy/events` to keep the feed current.

**Why it's wrong:** 5-second polling creates unnecessary database load — the server is already pushing events via WebSocket. Polling introduces 0–5 second lag on event display and creates redundant network traffic.

**Do this instead:** Use the TanStack Query fetch only for initial load (`staleTime: 30_000, refetchOnWindowFocus: false`). Live updates come exclusively from WS-derived CustomEvents appended in useAutonomyFeed.

### Anti-Pattern 3: Storing Raw PDF Bytes in brain.documents JSONB

**What people do:** Base64-encode the uploaded file buffer and store `rawBytes` in the document entry.

**Why it's wrong:** A 1MB PDF becomes ~1.4MB of base64. The `brain` JSONB column is read into the LLM prompt on every single message. Storing raw bytes burns tokens on every chat turn and adds 100–300ms to prompt construction. At 20 documents, this becomes catastrophic.

**Do this instead:** Run pdf-parse server-side, store only `extractedText` (capped at 10K characters per document). The LLM needs the text, not the binary. The original file is not preserved — this is acceptable since the use case is context injection, not file archival.

### Anti-Pattern 4: Monolithic ActivityTab With All Logic Inlined

**What people do:** Put event fetching, WS subscription, filter state, stats computation, and all rendering inside ActivityTab.tsx.

**Why it's wrong:** ActivityTab becomes a 600-line monolith, reproducing the exact problem being solved by the RightSidebar decomposition. Feed state is needed in multiple places (stats card, approvals badge count) — without a shared hook, this requires prop drilling or data duplication.

**Do this instead:** Extract all feed logic into `useAutonomyFeed`. ActivityTab becomes a compositor that calls the hook and passes data down. Stats and badge counts come from the same hook instance, avoiding any duplication.

### Anti-Pattern 5: Full Kanban Library for Pipeline View

**What people do:** Install `@dnd-kit/core` or `react-kanban` to build the task pipeline view.

**Why it's wrong:** Drag-and-drop is not required in v1.3 — the pipeline is read-only. These libraries add 40–80KB bundle weight and assume column widths of 200–300px each. In a 280px sidebar with 5 columns, only one column fits without horizontal scroll, making the column-based kanban metaphor physically break.

**Do this instead:** Horizontal scroll flex container with compact columns (Pattern 4 above). Add drag-and-drop in a future milestone only when the pipeline view moves out of the sidebar into a full-screen layout where column widths work.

### Anti-Pattern 6: Resetting the Entire RightSidebar to Build Tabs

**What people do:** Delete the existing RightSidebar.tsx and rebuild it from scratch with tabs.

**Why it's wrong:** The existing component has carefully built CustomEvent listeners for `ai_streaming_active` (brain save lock), auto-sync from `project_brain_updated`, task notification badges, and coachmark logic. A rewrite from scratch risks losing these behaviors or reintroducing bugs.

**Do this instead:** Wrap-then-decompose (Pattern 1). Add the tab shell first so existing content lives inside the brain tab. Extract content panels only after the tab structure is verified working. Existing event listeners stay active throughout.

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0–1k users (current MVP) | Current pattern is correct. In-memory feed capped at 200 events. No virtualization needed — feeds are short. REST initial load of 50 events is fast. |
| 1k–10k users | Add a DB index on `autonomy_events.project_id` column. Feed queries without this index will full-scan. Also: consider capping the REST query to 20 events to keep load times snappy. |
| 10k+ users | If many agents fire many events per minute per project, 10+ sidebar components subscribing to the same window CustomEvents causes unnecessary re-renders. Move the CustomEvent bridge to a React Context with a single subscriber per event type, then fan out via context updates. |

### Scaling Priorities

1. **First bottleneck:** `GET /api/autonomy/events` without a `project_id` index scans the full table as event volume grows. Add the index in the next migration after Phase 11 lands.
2. **Second bottleneck:** `brain.documents` JSONB growing large (20+ documents x 10K chars each = 200K chars) slows prompt construction. Add a `charCount` cap at the project level: if total document chars > 50K, truncate older documents during prompt injection rather than at upload time.

---

## Sources

- Direct codebase inspection: `client/src/components/CenterPanel.tsx` — CustomEvent dispatch pattern (lines 612, 658, 837, 1104, 1128, 1145, 1199, 1227) — HIGH confidence
- Direct codebase inspection: `client/src/hooks/useRightSidebarState.ts` — useReducer + localStorage pattern — HIGH confidence
- Direct codebase inspection: `client/src/components/RightSidebar.tsx` — existing structure, 850-line monolith, tab-like view switching already present — HIGH confidence
- Direct codebase inspection: `server/routes/autonomy.ts` — existing endpoints, event shapes, project ownership pattern — HIGH confidence
- Direct codebase inspection: `server/autonomy/execution/taskExecutionPipeline.ts` — execution pipeline, broadcastToConversation usage pattern — HIGH confidence
- [React Component Decomposition best practices — developerway.com](https://www.developerway.com/posts/components-composition-how-to-get-it-right) — MEDIUM confidence (general pattern)
- [Event-Driven Architecture for React Component Communication — DEV Community](https://dev.to/nicolalc/event-driven-architecture-for-clean-react-component-communication-fph) — MEDIUM confidence (validates CustomEvent approach)
- [React Virtuoso — virtuoso.dev](https://virtuoso.dev/) — HIGH confidence (for future virtualization if feed grows past 200 items)
- [multer — expressjs/multer GitHub](https://github.com/expressjs/multer) — HIGH confidence (standard, well-maintained)
- [Common Sense Refactoring of a Messy React Component — Alex Kondov](https://alexkondov.com/refactoring-a-messy-react-component/) — MEDIUM confidence (validates wrap-then-decompose approach)

---

*Architecture research for: Hatchin v1.3 Autonomy Visibility UI — Right Sidebar Revamp*
*Researched: 2026-03-24*
