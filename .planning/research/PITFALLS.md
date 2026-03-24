# Pitfalls Research

**Domain:** Autonomy visibility frontend added to existing multi-agent chat platform (React 18, Framer Motion, WebSocket CustomEvent bus, Drizzle JSONB, multer file upload)
**Researched:** 2026-03-24
**Confidence:** HIGH — based on direct codebase analysis, TOAST/JSONB benchmarks, and React real-time UI patterns

---

## Critical Pitfalls

### Pitfall 1: Activity Feed Floods UI During Active Autonomy Runs

**What goes wrong:**
The `autonomy_events` table emits events for every step of autonomous execution: `task_assigned`, `peer_review_started`, `peer_review_completed`, `handoff_initiated`, `handoff_completed`, `safety_triggered`, etc. During a single multi-agent handoff chain (PM → Engineer → Designer), this can produce 15–30 events in under 60 seconds. If the `useAutonomyFeed` hook subscribes to raw events via polling or WebSocket and renders each one as a new `FeedItem`, the sidebar becomes a scrolling wall of noise that buries the actual outcomes users care about.

**Why it happens:**
The backend already logs granular micro-events for auditability (`eventLogger.ts`). The temptation is to pipe these directly to the feed component as-is because the data is already there. But audit-level granularity is wrong for a user-facing feed — users want outcomes, not process steps.

**How to avoid:**
1. Implement event aggregation at the API layer (`GET /api/autonomy/events`): collapse step-level events into outcome-level summaries. "PM → Engineer handoff complete" is one feed item, not six.
2. In `useAutonomyFeed`, use a client-side throttle of 500ms minimum between re-renders (not 0ms). New events arriving within the throttle window should batch-update state, not trigger individual renders.
3. Distinguish between "feed events" (shown to users) and "trace events" (shown in deliberation detail view). Only a subset of `eventType` values should produce feed items.
4. Add an event priority enum: `critical` (approval required), `milestone` (task completed), `info` (handoff), `debug` (peer review step). Default feed shows only `critical` and `milestone`.

**Warning signs:**
- Feed scroll position resets on every new event (React key instability)
- CPU usage visible in DevTools during autonomy runs
- More than one feed item per second during a normal handoff chain

**Phase to address:**
Phase 11 (Sidebar Restructure & Activity Feed) — design the feed data model before implementing the component. The aggregation strategy must be decided before the first FeedItem is rendered.

---

### Pitfall 2: RightSidebar Refactor Breaks Existing CustomEvent Listeners

**What goes wrong:**
`RightSidebar.tsx` currently listens to `tasks_updated`, `task_created_from_chat`, `ai_streaming_active`, and `project_brain_updated` via `window.addEventListener`. When the component is decomposed into tab children (`ActivityFeed`, `BrainDocsTab`, `ApprovalsTab`), the natural refactor is to move each listener to the child component that needs it. If the parent `useEffect` cleanups are removed but the child `useEffect` setups are not yet added, there is a silent gap where events are dispatched but no listener catches them — the UI silently stops updating with no error.

**Why it happens:**
CustomEvent listeners are invisible contracts. There is no TypeScript type safety between `window.dispatchEvent(new CustomEvent('tasks_updated', ...))` in `CenterPanel.tsx` and `window.addEventListener('tasks_updated', ...)` in `RightSidebar.tsx`. When the listener moves, the event channel looks correct but is silently broken.

**How to avoid:**
1. Use the "wrap-then-restructure" strategy from the milestone plan: add the tab shell first with all existing listeners in the parent. Only move listeners to children after the tab shell is verified working.
2. Create a typed event registry in `client/src/lib/sidebarEvents.ts` that exports typed constants for all event names. Never write the event name as a string literal in more than one place.
3. Before removing any `window.removeEventListener` call from the parent, verify the child component has added the equivalent `window.addEventListener` with the same event name and cleanup.
4. Add a dev-mode event debugger: in `development` only, log every custom event dispatch and which listeners are currently registered. This catches silent gaps immediately.

**Warning signs:**
- Task badge in sidebar no longer appears when tasks are created from chat
- Brain content in sidebar no longer updates after project brain WS events
- No JavaScript errors — silent failure is the signature of a missing CustomEvent listener

**Phase to address:**
Phase 11 — the wrap-then-restructure order from the architecture plan is correct. The listener audit is the first thing to do, before moving any state.

---

### Pitfall 3: Base64 PDF in `brain.documents` JSONB Triggers TOAST and Kills Query Performance

**What goes wrong:**
The planned file upload stores PDF/doc content as base64 in `projects.brain.documents[]`. A typical 500KB PDF becomes ~667KB as base64. PostgreSQL's TOAST threshold is 2KB — any value exceeding it is compressed and moved to a separate TOAST table. Queries that `SELECT projects` to load a project page will now read the TOAST table for every row, adding 2–10x latency per query. With 3+ documents uploaded, the `projects` row can easily exceed 2MB, causing queries that previously ran in 5ms to take 30–50ms. The `PATCH /api/projects/:id/brain` endpoint rewrites the entire JSONB column on every update, re-toasting the entire blob every time a user edits the shared memory field.

**Why it happens:**
The decision to use JSONB for brain documents avoids a new table and migration, which is the right call for a zero-document MVP. But the cost profile changes sharply once real files are stored. The 2KB TOAST threshold is an implementation detail of PostgreSQL that is not visible in Drizzle ORM query code.

**How to avoid:**
1. Store only document metadata in `brain.documents[]` JSONB: `{ id, title, type, createdAt, size, mimeType }`. Store the extracted text content in a separate `project_documents` table with a `text` column (not JSONB). This keeps the `projects` row small and lets document content scale independently.
2. If the separate table is blocked by the "no DB migrations" constraint for v1.3, enforce a hard per-file size limit: 50KB extracted text maximum (not 50KB raw file). Apply this in the multer middleware before the file reaches storage.
3. When querying projects for the sidebar/navigation, use `SELECT id, name, emoji, user_id, core_direction, execution_rules` — never `SELECT *`. This avoids reading the brain JSONB column for every project in the list.
4. When brain documents must be in JSONB, add `storage_mode: 'reference' | 'inline'` to each document entry. Files over 20KB get `storage_mode: 'reference'` with content stored in a separate column, loaded only on demand.

**Warning signs:**
- `GET /api/projects` response time increases after first file upload
- PostgreSQL `pg_toast` table growing faster than `projects` table
- `PATCH /api/projects/:id` taking >100ms on projects with uploaded documents

**Phase to address:**
Phase 14 (Brain Redesign & Autonomy Settings) — the file upload architecture must account for this before the first line of multer middleware is written.

---

### Pitfall 4: Multiple Components Subscribing to the Same WebSocket via CustomEvent Cause Memory Leaks

**What goes wrong:**
The current architecture has one WebSocket in `CenterPanel.tsx` that dispatches CustomEvents to sibling components. `RightSidebar.tsx` adds 3 `window.addEventListener` calls today. When the sidebar is decomposed into 15 new components (`ActivityFeed`, `ApprovalsTab`, `BrainDocsTab`, etc.), each with their own `useEffect` event subscriptions, the total listener count for a single WS event can reach 10+. React Strict Mode (dev) runs effects twice, temporarily doubling this. If any `useEffect` cleanup is missing, listeners accumulate every time a tab mounts — memory leak pattern confirmed by React memory leak research.

**Why it happens:**
CustomEvent listeners on `window` are not scoped to component lifecycle automatically. React cleans up `useEffect` cleanups but only if they are correctly written with the `return () => window.removeEventListener(...)` pattern. With 15 new components, one missed cleanup is almost guaranteed.

**How to avoid:**
1. Create a single `useSidebarEvent<T>(eventName: string, handler: (detail: T) => void)` hook that always includes the cleanup return. All sidebar components must use this hook, never raw `window.addEventListener` directly.
2. The hook should accept a dependency array and re-subscribe correctly when deps change. This prevents the common mistake where a stale closure captures old state.
3. In dev, track listener registration count per event name (simple Map counter). Assert that no event name has more than 5 listeners registered simultaneously. This catches accumulation early.
4. For events emitted at high frequency (streaming chunks, autonomy micro-events), add a debounce inside the hook: `useSidebarEvent('autonomy_event', handler, { debounceMs: 100 })`.

**Warning signs:**
- Chrome DevTools Memory tab shows steady growth in Event Listeners count while navigating between tabs
- Same event handler appears to fire multiple times for a single dispatch
- `window.removeEventListener` calls do not reduce the listener count (stale reference — always use `useCallback` or stable reference for the handler)

**Phase to address:**
Phase 11 — the `useSidebarEvent` hook must be created before any sidebar child component is written. It is the foundation all event subscriptions build on.

---

### Pitfall 5: Approval Race Condition — Approve/Reject After Autonomous Execution Already Completed

**What goes wrong:**
A high-risk autonomous task (risk >= 0.60) surfaces an approval card in the sidebar Approvals tab. The backend queues the execution and waits for approval. If the user is slow (30+ minutes), the backend may have timed out and re-queued the task, or retried it under a different traceId. When the user clicks Approve on the original card, the API call hits a stale approvalId that either no longer exists (404) or maps to a task that already ran (idempotency failure). The UI shows no error but the approval had no effect.

**Why it happens:**
The approval system was designed for the chat inline card flow where users are actively watching the conversation. The sidebar Approvals tab introduces a new context where approvals can be reviewed hours after they were created. The backend timeout and retry logic does not coordinate with the UI's stale card state.

**How to avoid:**
1. Add a `status` field to approval items: `pending | approved | rejected | expired | already_executed`. The Approvals tab must poll or receive WS events when status changes from `pending` to another state.
2. When the user clicks Approve, the API must first check current task status before executing. If status is not `pending`, return a specific error code (`APPROVAL_EXPIRED` or `ALREADY_EXECUTED`) that the UI handles gracefully with a clear message.
3. Add expiry timestamps to approval items (e.g. 1 hour TTL). Show a countdown or "expired" badge on cards nearing expiry. Auto-dismiss expired cards with a toast explaining what happened.
4. Optimistic UI for approvals must be resilient: after clicking Approve, show "processing..." and wait for the WS confirmation event before removing the card. Do not remove the card on click alone.

**Warning signs:**
- Approval button click produces no visible feedback (silent 404 or stale approval ID)
- Approval tab shows a task that is already visible as "completed" in the activity feed
- Users report "I approved something but the team didn't act on it"

**Phase to address:**
Phase 13 (Approvals Hub & Task Pipeline) — expiry and status synchronization must be part of the approval data model spec, not added as a patch after the component is built.

---

### Pitfall 6: Task Pipeline View (Kanban Columns) Does Not Fit Sidebar Width

**What goes wrong:**
A standard Kanban board with 5 columns (queued → assigned → in-progress → review → done) requires minimum 600–800px of horizontal space for readable column headers and cards. The right sidebar is typically 280–360px wide. Naively rendering Kanban columns in the sidebar results in either: (a) columns so narrow they only show truncated text, making the view unreadable, or (b) horizontal overflow that breaks the sidebar layout and bleeds into the center chat panel.

**Why it happens:**
Kanban is a horizontal-first layout pattern designed for full-width views (Trello, Linear, Jira). Copying the pattern into a sidebar without adapting the information architecture produces an unusable view. This is a classic "looks done but isn't" mistake — the component renders, the columns are there, but no one can actually read it.

**How to avoid:**
1. Use a vertical swimlane layout instead of horizontal columns: one column with status as a label/badge on each card, sortable by status. This works at any sidebar width.
2. Alternatively, use a horizontal scroll container for the status columns with `overflow-x: auto` and `min-width` per column. Add visible scroll indicators (gradient fade on left/right edges) so users know columns continue beyond the visible area.
3. Limit visible information per card to: agent avatar, task title (truncated at 40 chars), status badge. All other details are in an expand/modal.
4. Never use `display: grid` with fixed column widths for the pipeline view — use `flex-shrink: 0` with `min-content` width negotiation so cards are readable at any sidebar width.

**Warning signs:**
- Column headers truncated to one or two letters at default sidebar width
- Horizontal scrollbar appearing on the entire sidebar (not just the pipeline component)
- Cards showing "..." after 5 characters of title text

**Phase to address:**
Phase 13 (Approvals Hub & Task Pipeline) — wireframe the pipeline view at 320px width before writing any component code. The layout constraint must drive the design.

---

### Pitfall 7: Empty States That Increase Anxiety Instead of Building Confidence

**What goes wrong:**
When a user first enables autonomy or opens the Activity tab before any background work has run, they see an empty state. A generic "No activity yet" or "No tasks" message creates confusion: is it broken? Did I set it up wrong? Is the feature disabled? For an AI platform where the core value proposition is "your team is working for you," an empty autonomy feed feels like evidence the team is not doing anything.

**Why it happens:**
Empty states are often added as an afterthought — a condition check with a simple message. The emotional context of the empty state (user just enabled a feature and is waiting to see it work) is not considered during implementation.

**How to avoid:**
1. Empty states must be contextual, not generic. An empty Activity feed when autonomy is disabled should say something different from when autonomy is enabled but no tasks exist yet vs. when tasks exist but haven't been executed.
2. Empty states should guide the next action: if autonomy is disabled, the empty state should include a direct link to enable it. If no tasks exist, show "Start a conversation and your team will pick up tasks automatically."
3. Use illustrated empty states that reinforce the "team" metaphor (consistent with the Hatchin brand voice: alive, human, like real teammates waiting). An agent avatar looking ready-to-work is more reassuring than a generic empty box icon.
4. Never phrase empty states in ways that could read as error messages. "No activity recorded" sounds like a system failure. "Your team is ready — start a conversation to kick things off" is reassuring.

**Warning signs:**
- User support questions like "is the autonomy feature working?" after enabling it
- Low click-through from Activity tab back to chat to start a conversation
- User disabling autonomy immediately after enabling it (no feedback loop)

**Phase to address:**
Phase 11 (Sidebar Restructure & Activity Feed) — all five empty state variants (Activity, Approvals, Brain/Docs, Handoffs, Settings) must be designed and implemented as first-class content, not fallback conditions.

---

### Pitfall 8: Tab State Loss When Switching Between Sidebar Tabs

**What goes wrong:**
React unmounts child components when their tab is not active (common tab implementation pattern). If a user types a note in the Brain & Docs tab, switches to Activity to check progress, and switches back, the draft is gone because `BrainDocsTab` was unmounted and the textarea's DOM state was lost. Similarly, scroll position in the Activity feed resets to the top every time the user switches away and back.

**Why it happens:**
Standard tab implementations conditionally render `{activeTab === 'activity' && <ActivityFeed />}`. This is simple but unmounts inactive tabs. The state loss is a known React behavior but easy to forget when tabs are added quickly.

**How to avoid:**
1. Use CSS-based tab switching for content that must preserve state: render all tab panels simultaneously, use `display: none` or `visibility: hidden` + `aria-hidden` to hide inactive ones. This keeps components mounted.
2. For the Activity feed specifically, preserve scroll position in a `useRef` and restore it on tab re-focus: `containerRef.current?.scrollTop = savedScrollPosition`.
3. For draft text in Brain & Docs inputs, lift state to the parent `RightSidebar` component (or a context). Do not rely on uncontrolled DOM state for any field that users might edit across tab switches.
4. Apply `React.memo` to tab content components to prevent re-renders when switching between tabs (even if CSS-hidden, they should not re-render unnecessarily).

**Warning signs:**
- Scroll position resets to top of Activity feed every time user switches tabs
- Text typed in brain editing fields disappears after switching tabs
- Approval count badge in tab header shows stale count (component re-mounted and re-fetched)

**Phase to address:**
Phase 11 — the tab mounting strategy (unmount vs. CSS-hide) is an architectural decision for the tab shell. The wrong choice here cannot be fixed per-component later without refactoring the entire tab system.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Polling `GET /api/autonomy/events` every 5 seconds instead of WS push | No new WS events to wire | 5s lag in activity feed; unnecessary server load; stale approvals; polling cost grows with user count | Only in a prototype phase, never in production |
| Storing full PDF text in `brain.documents` JSONB | No new table/migration needed | TOAST overhead on every `projects` query; 2–10x slower queries per uploaded file; each PATCH rewrites the entire blob | Never for files >50KB extracted text |
| Using `window.dispatchEvent` event name strings without a type registry | Fast to add new events | Silent failures when event names change or typo; TypeScript provides no safety across dispatch/listener boundary | Only if the project has fewer than 5 CustomEvent types total |
| Rendering raw `autonomy_events` rows directly in the Activity feed | Feed populated immediately with zero aggregation logic | Feed flooded by micro-events; users see process noise not outcomes; 30+ events per handoff chain | Never — aggregation must exist before feed is shown to users |
| Rebuilding `useRightSidebarState` hook to handle all new tab state | Single hook for all state | Hook grows to 400+ lines; every tab re-renders on unrelated state changes; prop drilling through hook gets complex | Acceptable for Phase 11 initial implementation, refactor to per-tab context in Phase 15 |
| Skipping expiry TTL on approval items | Simpler approval data model | Stale approvals accumulate in sidebar; race conditions when user approves expired items; UX confusion about approval state | Never for production approval flows |

---

## Integration Gotchas

Common mistakes when connecting the new sidebar features to existing systems.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `GET /api/autonomy/events` + Activity feed | Fetching all events for a project without pagination, loading 10k+ rows on first mount | Add `limit=50&before=<cursor>` pagination to the events endpoint; load more on scroll (virtualized list) |
| multer + brain document upload | Setting `multer.memoryStorage()` with no file size limit — a 10MB PDF upload blocks the Node.js event loop during base64 encoding | Set `limits: { fileSize: 5_000_000 }` in multer config; use streaming extraction (pdf-parse streams) rather than loading full file buffer |
| CustomEvent from CenterPanel → sidebar | Dispatching events before the sidebar component has mounted (race condition during initial load) | Events dispatched before sidebar mounts are silently lost. Add a `ready` flag: sidebar dispatches `sidebar_ready` event on mount; CenterPanel queues events until `sidebar_ready` is received |
| Handoff visualization + existing `handoffOrchestrator.ts` | Frontend assumes handoff chain is synchronous and complete before rendering | Handoffs are async — a chain may have 3 hops in progress simultaneously. Render the chain as it builds, not only when complete |
| Approval hub + existing `AutonomousApprovalCard` in chat | Showing the same pending approval in both the inline chat card and the sidebar Approvals tab | A single approval should have one canonical location. Sidebar is the hub; chat shows a reference card that links to sidebar. Prevent double-approval by disabling the chat card once sidebar processes the action |
| Task pipeline view + `autonomy_events` data | Deriving task status from raw events (expensive, error-prone) | Use the `tasks` table `status` field as source of truth; autonomy_events are for audit trail only |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Unvirtualized Activity feed rendering all events | Sidebar scroll becomes janky; frame drops below 60fps; CPU spike during autonomy runs | Use `react-window` or CSS `content-visibility: auto` for feed items; only render visible items | At ~100 feed items in a single project |
| Framer Motion `AnimatePresence` on every FeedItem | Each new event triggers GPU-animated entrance; during a burst of 20 events, 20 concurrent animations fire | Batch-animate: new events above the fold fade in as a group, not individually | Immediately visible when autonomy run generates 5+ events in quick succession |
| `useQuery` polling for approvals without stale-time | `GET /api/autonomy/pending-approvals` fires on every tab focus switch (TanStack Query default behavior) | Set `staleTime: 30_000` on approval queries; rely on WS push for real-time updates, polling only as fallback | Noticeable from first use — every tab switch triggers a network request |
| Reading `projects.brain` on every project load to populate document list | Projects with large document sets load slowly; sorting/filtering project list is sluggish | Separate document metadata from document content; `GET /api/projects` returns only document count + titles, not content | At first file upload — latency increase is immediately measurable |
| Framer Motion layout animations on sidebar resize | Sidebar width change causes all child elements to recalculate layout simultaneously | Use `layout` prop only on the top-level sidebar container, not child components. Children should use `transition: { type: 'spring', ... }` only on their own transforms | At 15+ child components in the sidebar — layout recalculation cascade causes 1-2 frame drops |

---

## Security Mistakes

Domain-specific security issues for file upload and approval flows.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing raw uploaded file bytes in JSONB without content validation | Malicious PDF with embedded JavaScript or polyglot file attacks server-side parser | Always validate MIME type server-side (not just client-side), not by file extension. Use `file-type` npm package to verify actual file signature. Run `pdf-parse` in a try/catch with timeout |
| Serving uploaded document content directly to the client without sanitization | XSS via extracted text — PDF text extraction can contain `<script>` tags or malicious URLs | Always render extracted document text via a sanitized markdown/text renderer (already used: `react-markdown` with `rehype-sanitize`). Never use `dangerouslySetInnerHTML` on extracted text |
| Approval endpoint does not verify project ownership before processing approval | User A can approve/reject User B's autonomous tasks by guessing approvalId | Every `POST /api/autonomy/approvals/:id/approve` must verify `project.userId === req.session.userId`. Current `getOwnedProjectIds` pattern in `autonomy.ts` should be applied |
| File size limit enforced only on client | A crafted multipart request bypasses the React file size check and sends a 50MB PDF | `multer` limit is the only enforcement that matters. Client-side size checks are UX only, not security |
| Approval IDs are UUIDs but are returned in paginated lists | Enumeration of another user's approval items via sequential API calls | `GET /api/autonomy/pending-approvals` must be scoped to `req.session.userId`'s projects only — verify this at the route level, not relying on storage-level filtering |

---

## UX Pitfalls

Common user experience mistakes specific to autonomy visibility UIs.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing every internal handoff as a separate sidebar event | Users see "PM handed to Engineer" and "Engineer handed to Designer" as noise, not progress | Show "3 handoffs completed — authentication module scoped and assigned" as one milestone event |
| Activity feed timestamp showing relative time ("2 minutes ago") that goes stale | After 30 minutes, "2 minutes ago" is still showing because component is not re-rendering | Use absolute timestamps with tooltip for relative, or use a timer that re-renders the relative time display every 60 seconds |
| Approval cards in sidebar look identical to completed items | Users click on completed approvals thinking they're pending, creating confusion | Status must be visually primary — not a small badge, but a full card state change. Approved items should be visually muted/dimmed, pending items prominent |
| Work output viewer shows raw LLM output without context | Users see a wall of text without knowing which agent produced it, when, or in response to what | Every work output item must show: agent avatar + name, task it was created for, timestamp, and a link back to the relevant chat context |
| Deliberation visibility shows all rounds of peer review | Users are exposed to internal critique and failed attempts, undermining confidence in their team | Show only the final synthesized output by default. Deliberation detail is an advanced expand for users who want to understand the process |

---

## "Looks Done But Isn't" Checklist

Things that appear complete in demos but are missing critical pieces.

- [ ] **Activity feed:** Feed renders and shows events — verify events are aggregated outcomes, not micro-events. Check: a single handoff chain should produce 1–3 feed items, not 15+.
- [ ] **File upload:** Upload succeeds and document appears in brain — verify the `projects` row size before and after upload. Check: `SELECT pg_column_size(brain) FROM projects WHERE id = ?` should not exceed 500KB.
- [ ] **Approvals hub:** Approval card renders with Approve/Reject buttons — verify: clicking Approve on a task that already executed returns `APPROVAL_EXPIRED` error with a readable message, not a silent 404.
- [ ] **Tab state:** Tab switching works visually — verify: scroll position in Activity feed is preserved when user switches to Approvals and back. Verify: draft text in Brain & Docs fields survives a tab switch.
- [ ] **Empty states:** All tabs have empty state UI — verify: each tab has at least 3 distinct empty state variants (autonomy disabled / enabled but no data / data loading).
- [ ] **Memory cleanup:** All sidebar child components added — verify: Chrome DevTools shows no growth in "Event Listeners" count after mounting and unmounting each tab component 5 times.
- [ ] **Kanban pipeline:** Task pipeline renders — verify: columns are readable at 320px sidebar width. Check at minimum 280px (collapsed sidebar).
- [ ] **Avatar working state:** "Working" avatar animation is visible — verify: animation stops when background execution pauses/cancels, not only when it completes.
- [ ] **CustomEvent bridge:** Sidebar tab registered and receiving events from CenterPanel — verify: opening browser DevTools, dispatching a test `CustomEvent('tasks_updated')` manually, and confirming the correct tab updates.
- [ ] **PDF text extraction:** multer + pdf-parse wired up — verify: a 5MB PDF does not exceed 30 seconds processing time (add a timeout); a malformed/corrupted PDF returns a user-friendly error, not a 500.

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Activity feed flooded with micro-events in production | MEDIUM | 1. Add `event_category` filter to `GET /api/autonomy/events?category=milestone` immediately. 2. Frontend applies category filter as default. 3. Full aggregation refactor in next sprint. |
| TOAST performance degradation from large brain documents | HIGH | 1. Add column-level `SELECT` to all `getProject` queries (exclude `brain` from list queries immediately). 2. Set hard 50KB limit on new uploads. 3. Migrate document content to separate table in next migration. |
| CustomEvent listener missing after sidebar refactor | LOW | 1. Add `console.warn` to every event dispatch: "dispatching X, listening components: [count]". 2. The missing listener will show count = 0. 3. Re-add cleanup in child component. |
| Stale approval cards causing user confusion | MEDIUM | 1. Add `?includeExpired=false` filter to approvals API immediately. 2. Auto-expire approvals older than 1 hour via a cleanup cron. 3. Add WS push for approval status changes so cards update in real-time. |
| Tab state loss (scroll, drafts) after sidebar refactor | LOW | 1. Lift scroll position to `useRef` in parent immediately. 2. Lift draft text to controlled state in parent. 3. Apply CSS-based tab hiding (display: none) to prevent unmounting. |
| Memory leak from uncleanup CustomEvent listeners | MEDIUM | 1. React DevTools Profiler → Component → "Why did this render?" to identify perpetual re-renders. 2. Chrome DevTools Memory → Heap Snapshot → filter "EventListenerInfo". 3. Audit every `useEffect` in sidebar components for missing cleanup return. |

---

## Pitfall-to-Phase Mapping

How v1.3 roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Activity feed flooding UI with micro-events | Phase 11 (Sidebar & Activity Feed) | `useAutonomyFeed` returns aggregated items; a single handoff chain produces ≤3 feed items |
| CustomEvent listener gap during sidebar refactor | Phase 11 (Sidebar & Activity Feed) | Typed event registry exists in `sidebarEvents.ts`; `useSidebarEvent` hook created before any child component |
| TOAST degradation from base64 PDFs in JSONB | Phase 14 (Brain Redesign & Autonomy Settings) | `pg_column_size(brain)` measured before/after upload; 50KB text limit enforced in multer middleware |
| WebSocket CustomEvent memory leaks | Phase 11 (Sidebar & Activity Feed) | No "Event Listeners" count growth in Chrome DevTools after 10 tab mount/unmount cycles |
| Approval race condition (stale approvalId) | Phase 13 (Approvals Hub & Task Pipeline) | API returns `APPROVAL_EXPIRED` for stale IDs; expiry timestamps on all approval items |
| Kanban pipeline too wide for sidebar | Phase 13 (Approvals Hub & Task Pipeline) | Pipeline view readable at 280px width; no horizontal overflow from sidebar into chat panel |
| Empty states increase user anxiety | Phase 11 (Sidebar & Activity Feed) | All 5 tabs have 3 contextual empty state variants; tested with a new project that has never run autonomy |
| Tab state loss on switch | Phase 11 (Sidebar & Activity Feed) | CSS-hide strategy used for tabs that contain forms or scrollable feeds; `BrainDocsTab` draft survives tab switch |

---

## Sources

- Direct codebase analysis: `client/src/components/RightSidebar.tsx`, `client/src/components/CenterPanel.tsx`, `shared/schema.ts` (`brain.documents` JSONB type), `server/routes/autonomy.ts`, `server/autonomy/events/eventLogger.ts`
- PostgreSQL TOAST performance: [5mins of Postgres E3: Postgres performance cliffs with large JSONB values and TOAST](https://pganalyze.com/blog/5mins-postgres-jsonb-toast), [JSONB in PostgreSQL: Power, Performance, and Pitfalls](https://medium.com/@rizqimulkisrc/jsonb-in-postgresql-power-performance-and-pitfalls-2534de43eb9c), [The Hidden Cost of Using JSONB in Postgres](https://medium.com/@thequeryabhishk/the-hidden-cost-of-using-jsonb-in-postgres-bad78a2bf249)
- React memory leaks and CustomEvent patterns: [5 React Memory Leaks That Kill Performance](https://www.codewalnut.com/insights/5-react-memory-leaks-that-kill-performance), [How I Solved WebSocket "Event Drift" in React](https://dev.to/kumarpankaj3404/how-i-solved-websocket-event-drift-in-react-with-a-custom-npm-package-1eeh)
- Approval race conditions: [Concurrent Optimistic Updates in React Query](https://tkdodo.eu/blog/concurrent-optimistic-updates-in-react-query)
- Empty state UX: [Empty State UI design: From zero to app engagement](https://www.setproduct.com/blog/empty-state-ui-design), [Empty state UX examples and design rules that actually work](https://www.eleken.co/blog-posts/empty-state-ux)
- Tab state loss: [React Almost Broke Me: 5 Mistakes I Made](https://dev.to/paulthedev/react-almost-broke-me-5-mistakes-i-made-so-you-dont-have-to-25lo)

---

## Appendix: Original v1.0–v1.2 Backend Pitfalls

The pitfalls below were documented during the v1.1 Autonomous Execution Loop milestone. They remain valid for the backend implementation that underpins v1.3.

---

### Pitfall 9 (Legacy): Runaway Background LLM Cost — No Per-Project Spend Cap

**What goes wrong:** Background runner fires every 2 hours across ALL projects. At 50+ projects with real LLM calls, costs accumulate invisibly. Autonomous handoffs multiply per hop.

**How to avoid:** Per-project daily LLM call cap in `policies.ts`, `lastActivityAt` filter on background runner, cost logging to `autonomy_events`. **Status: shipped in v1.2 billing.**

**Phase to address:** Phase 1 — RESOLVED.

---

### Pitfall 10 (Legacy): Autonomous Handoff Loop — Agent A Hands to B, B Hands Back to A

**What goes wrong:** Without a visited-agent registry per task, handoff routing loops indefinitely. **Status: BFS cycle detection shipped in v1.1.**

**Phase to address:** Phase 1 — RESOLVED.

---

### Pitfall 11 (Legacy): Chat Safety Scoring Bypassed for Autonomous Work

**What goes wrong:** `evaluateSafetyScore()` requires `userMessage` — passing empty string for autonomous work gives misleadingly low risk scores.

**How to avoid:** `isAutonomous` flag + flat +0.1 bonus on execution risk; peer review mandatory for any `RISKY_EXECUTION` pattern regardless of confidence. **Status: shipped in v1.1.**

**Phase to address:** Phase 1 — RESOLVED.

---

*Pitfalls research for: Autonomy visibility frontend + right sidebar revamp (v1.3)*
*Researched: 2026-03-24*
*Covers: Real-time activity feeds, sidebar refactoring, JSONB file storage, CustomEvent WebSocket architecture, approval race conditions, empty states, task pipeline layout*
