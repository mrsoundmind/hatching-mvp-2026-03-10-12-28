# Project Research Summary

**Project:** Hatchin v1.3 — Autonomy Visibility UI
**Domain:** Real-time activity feeds, tabbed sidebar revamp, file upload with PDF parsing, approval management, task pipeline view, and agent working-state visualization on an existing React 18 + Tailwind + Framer Motion + Shadcn platform
**Researched:** 2026-03-24
**Confidence:** HIGH

---

## Executive Summary

Hatchin v1.3 is not a new product — it is a visibility layer over a backend autonomy engine that already exists and works. The pg-boss job queue, handoff orchestrator, safety gates, trust scoring, and autonomy_events audit trail are all shipped in v1.1–v1.2. The milestone is almost entirely frontend work: decomposing the existing 850-line RightSidebar into a tabbed shell (Activity / Brain & Docs / Approvals), surfacing the autonomy backend through a real-time event feed, and adding file-upload-to-project-brain with PDF text extraction. Zero new backend concepts are required; the primary backend additions are two new API endpoints and one new middleware.

The recommended approach is incremental: wrap-then-decompose the RightSidebar, build the Activity Feed as the central data primitive (everything else derives from it), and use the existing WebSocket CustomEvent bridge rather than introducing a new state management system. Six new npm packages cover the new UI surface: `react-dropzone` and `multer` v2 for file upload, `pdf-parse` for server-side text extraction, `@dnd-kit/core` and `@dnd-kit/sortable` for future kanban drag-and-drop, and `@tanstack/react-virtual` for feed virtualization. All other UI needs are covered by already-installed packages (Radix tabs/scroll/switch/slider/progress, Framer Motion, Recharts, date-fns).

The most significant risks are architectural, not feature-level. Four patterns must be established in Phase 11 (the gating phase) before any other tab content is written: a typed CustomEvent registry to prevent silent listener gaps during the sidebar refactor; CSS-based tab hiding instead of conditional unmounting to preserve scroll and draft state; a `useSidebarEvent` hook that guarantees cleanup for all sidebar event subscriptions; and activity feed event aggregation at the API layer so the feed shows outcomes rather than micro-events. Getting these foundations wrong in Phase 11 creates cascading bugs in Phases 12–15 that are expensive to fix post-hoc.

---

## Key Findings

### Recommended Stack

The v1.3 milestone requires only six new packages on top of an already comprehensive stack. The existing installation covers every UI need: Radix primitives for the tab shell and autonomy controls, Framer Motion for all animations, Recharts for stats charts, date-fns for feed timestamps, and the existing WebSocket + TanStack Query architecture for real-time and REST data.

**New packages required:**
- `react-dropzone@^15.0.0` — drag-and-drop file upload zone for Brain & Docs tab; hook-based (8KB), handles MIME filtering, drag-active state, and accessibility without a custom UI system
- `multer@^2.0.2` — server-side multipart form parsing; v2 specifically required because v1.x has two high-severity CVEs (CVE-2025-47935 DoS via memory leak, CVE-2025-47944 malformed request crash); use `memoryStorage()` for in-process buffer handling
- `@types/multer@^2.1.0` — TypeScript types matching multer v2 API surface
- `pdf-parse@^1.1.1` — extract plain text from PDF buffers; single-function API, 2M weekly downloads, no native dependencies, runs on Node.js 20
- `@dnd-kit/core@^6.3.1` + `@dnd-kit/sortable@^10.0.0` — drag-and-drop for the task pipeline; community-standard successor to deprecated `react-beautiful-dnd`; for v1.3 MVP the pipeline can ship static-only (columns visible but not draggable) and add drag-and-drop in a follow-on commit — but install the packages now
- `@tanstack/react-virtual@^3.13.23` — virtualize the activity feed list; supports dynamic row heights (critical since feed items vary in size); same TanStack family as existing react-query

**Do not add:** S3/AWS SDK (JSONB storage is sufficient for v1.3 document scope), Zustand/Jotai (TanStack Query + CustomEvent covers state needs), Socket.io (incompatible with existing raw ws server), react-flow (handoff chain is linear, not a graph), multer v1.x (active CVE risk), react-beautiful-dnd (deprecated by Atlassian).

### Expected Features

Research confirms a clear split between what users will assume exists (table stakes) and what creates genuine competitive differentiation. The backend capabilities Hatchin already has exceed any direct competitor — the gap is entirely in making them visible and controllable.

**Must have for v1.3 — product feels broken without these:**
- RightSidebar decomposed into three tabs: Activity, Brain & Docs, Approvals — the single gating dependency for all other features
- Live Activity Feed: reverse-chronological event stream, human-readable descriptions, avatar attribution, agent and type filtering
- Agent "working" visual state: pulsing avatar ring on agents actively executing in background
- Pending Approvals Hub: dedicated tab aggregating high-risk items awaiting user action (not scroll-through-chat)
- Empty states for all three tabs: contextual copy and illustration guiding the next action (not blank panels)
- Autonomy Stats Card: today's task completions, handoff count, and cost spent vs cap
- Task Pipeline View: status-column view of tasks (Queued / In-Progress / Review / Done) readable at sidebar width
- Project Brain redesign with file upload: replace static textareas with structured knowledge base UI supporting PDF drag-and-drop
- Autonomy Settings UI: inactivity toggle, cost cap display, and autonomy level control
- Handoff visualization: chat announcement cards in CenterPanel plus handoff chain timeline in the sidebar

**Differentiators — competitive advantage unique to Hatchin:**
- Handoff chain timeline: sequential avatar bubbles showing PM → Engineer → Designer chain; no consumer-facing team chat product does this
- Autonomy dial (four levels): Observe & Suggest / Plan & Propose / Act with Confirmation / Act Autonomously; Smashing Magazine research identifies this as the single most trust-building control in agentic systems
- Trust score visible per agent: surfaces backend trust scoring as human-readable narrative ("Alex — 92% trust, 24 tasks")
- Real-time cost transparency: "Today: $0.12 / $2.00 cap" in stats card — rare outside developer tools
- Inline rationale per autonomy event: plain-English explanation of why an agent made a decision, linked to the user's stated project rules
- Work Output Viewer: browse completed background task deliverables without reading full chat history

**Defer to v1.3.x — validate user behavior before building:**
- Work Output Viewer — build only after confirming users actively seek outputs beyond the chat view
- Trust score display — add after agents have 10+ completions so numbers are meaningful (empty bars mislead)
- Deliberation visibility card — complex to surface cleanly; add after handoff chain proves valuable
- Inline "why" rationale — requires backend audit of which event types already log rationale before the frontend is designed

**Anti-features — deliberately exclude:**
- Full LangGraph execution graph visualization — wrong mental model for non-technical users; breaks the "real colleagues" brand metaphor entirely
- Per-message live token counter — makes Hatches feel like API calls, contradicts brand voice and anti-prompting philosophy
- Raw JSON event log viewer in-product — developer debugging tool in a consumer product
- Approval required for every autonomous action — approval fatigue destroys the autonomy value proposition

### Architecture Approach

The architecture is a constrained extension of the existing pattern: CenterPanel owns the single WebSocket connection and dispatches typed CustomEvents to window; sidebar components subscribe via `useEffect`. This is already how the existing RightSidebar receives `tasks_updated` and `project_brain_updated` events. v1.3 extends this pattern with seven new event types for autonomy state rather than replacing it with a global store. A new `useAutonomyFeed` hook serves as the shared data primitive: it bootstraps from `GET /api/autonomy/events` on mount and appends live events from CustomEvents without polling. The Activity Tab, Stats Card, and Approvals Tab badge all consume the same hook instance.

**Major components:**
1. `RightSidebar.tsx` (shell) — thin tab bar with three panels; active tab persisted in localStorage per project; wrap-then-decompose is the safe refactor path for the existing 850-line component
2. `ActivityTab.tsx` — composes FeedItem list, StatsCard, FeedFilters, HandoffChainTimeline, and EmptyFeedState; all data comes from `useAutonomyFeed`
3. `ApprovalsTab.tsx` — pending approval list with Approve/Reject actions; shares `useAutonomyFeed` pending count for badge display
4. `BrainDocsTab.tsx` — brain fields editor (existing content migrated here) plus DocumentUpload, DocumentViewer, and AutonomySettings
5. `useAutonomyFeed.ts` — REST bootstrap + WS-append feed state; filter state; computed stats and pending approval count; the data foundation all other components share
6. `useAgentWorkingState.ts` — tracks Set of agentIds currently executing; drives `AgentAvatar.tsx` `isWorking` prop in LeftSidebar and ProjectTree
7. `client/src/lib/autonomyEvents.ts` — typed dispatch/subscribe helpers for all CustomEvent names; prevents silent failures across the dispatch/listener boundary

**Key patterns to follow:**
- Wrap-then-decompose: add tab shell with all existing listeners preserved in parent; extract inner panels only after shell is verified working; never refactor structure and add features in the same commit
- CSS-based tab hiding (`display: none` / `visibility: hidden` + `aria-hidden`) for tabs containing forms or scrollable feeds; conditional unmounting loses scroll position and draft text
- Feed event aggregation at the API layer: `GET /api/autonomy/events` returns outcome-level summaries, not raw micro-events; a single handoff chain must produce 1–3 feed items, not 15–30
- Constrained-width pipeline: horizontal scroll flex container with gradient-fade edge indicator at 280px+ sidebar width rather than a full kanban library assuming 600px+

### Critical Pitfalls

1. **Activity Feed Flooding With Micro-Events** — A single multi-agent handoff chain emits 15–30 step-level events in under 60 seconds. Piping raw `autonomy_events` rows directly to the feed produces a scrolling wall of process noise that buries actual outcomes. Prevention: implement event aggregation at the API layer before writing the first FeedItem; add an event priority enum (`critical`, `milestone`, `info`, `debug`); default feed shows only `critical` and `milestone`.

2. **CustomEvent Listener Gaps During Sidebar Refactor** — CustomEvent subscriptions are invisible contracts with no TypeScript safety across the dispatch/listener boundary. When 850 lines of RightSidebar decompose into 15+ child components, events are silently dispatched to no listeners if cleanups are removed before new setups are added. Prevention: create `client/src/lib/autonomyEvents.ts` typed registry and `useSidebarEvent` hook before any child component is written; use wrap-then-decompose order strictly.

3. **TOAST Performance Degradation from Base64 PDFs in JSONB** — A 500KB PDF becomes ~667KB as base64. PostgreSQL TOAST threshold is 2KB. After the first upload, every `SELECT projects` query hits the TOAST table, adding 2–10x latency. `PATCH /api/projects/:id/brain` rewrites the entire blob on every shared memory edit. Prevention: store only document metadata in `brain.documents[]` JSONB (id, title, size, mimeType, createdAt); store extracted text separately; OR enforce a hard 50KB extracted-text limit in multer middleware; always `SELECT` specific columns on project list queries (never `SELECT *`).

4. **WebSocket CustomEvent Memory Leaks From Missing Cleanups** — With 15+ new sidebar components each subscribing to window events, one missed `useEffect` cleanup return is near-certain. React Strict Mode doubles listener counts in development. Prevention: all sidebar components must use the `useSidebarEvent` hook (never raw `addEventListener` directly); the hook guarantees `removeEventListener` in its cleanup return; no raw `window.addEventListener` calls in sidebar components.

5. **Approval Race Condition — Stale ApprovalId After Backend Timeout** — The backend may time out and re-queue a task while an approval card sits in the sidebar for 30+ minutes. When the user clicks Approve, the API hits a stale approvalId that either 404s or triggers double-execution. Prevention: add `status` field (`pending | approved | rejected | expired | already_executed`) to approval items; API returns `APPROVAL_EXPIRED` for stale IDs with a readable message; approval cards show expiry timestamps and auto-dismiss when expired.

6. **Kanban Pipeline Too Wide for Sidebar** — A standard five-column kanban requires 600–800px minimum. The right sidebar is 280–360px. Naively rendering columns results in either truncated text or horizontal overflow that bleeds into the chat panel. Prevention: use a horizontal scroll flex container with gradient-fade edge indicator; limit visible card information to agent avatar, task title truncated at 40 characters, and status badge; wireframe at 320px width before writing any component code.

---

## Implications for Roadmap

The research defines a clear dependency graph. The sidebar tab shell gates everything else. The Activity Feed is the highest-leverage primitive — Stats Card, Avatar State, Work Output Viewer, and Handoff Timeline all derive their data from it. The Approvals Hub reuses existing inline approval logic. File upload is a standalone backend addition independent of the feed infrastructure. Phase 11 is therefore not just one phase among equals — it is where the architectural foundations for the entire milestone are established.

### Phase 1: Sidebar Shell + Activity Feed Foundation

**Rationale:** The tab shell is the gating dependency for all other phases — without it, every subsequent component has no mount surface. The Activity Feed must be built first within the Activity tab because it provides `useAutonomyFeed`, the shared data hook that Stats Card, Approvals badge, and Avatar State all depend on. All critical architectural foundations (typed event registry, `useSidebarEvent` hook, CSS-based tab hiding, feed aggregation strategy) must be established here — they cannot be retrofitted after 15 child components are written.

**Delivers:** Three-tab RightSidebar shell; live Activity Feed with real-time events from WS and historical load from REST; AutonomyStatsCard; agent "working" avatar pulsing ring in LeftSidebar/ProjectTree; empty states for all three tabs; typed CustomEvent infrastructure in `client/src/lib/autonomyEvents.ts`.

**Addresses (from FEATURES.md):** Sidebar tab restructure (P1 table stakes), Activity Feed (P1 table stakes), Agent working state (P1 table stakes), Empty states (P1 table stakes), Autonomy Stats Card (P1 table stakes).

**Avoids (from PITFALLS.md):** CustomEvent listener gaps (Pitfall 2), WebSocket memory leaks (Pitfall 4), Tab state loss (Pitfall 8), Activity feed micro-event flooding (Pitfall 1 — aggregation strategy designed here).

### Phase 2: Handoff Visualization (Chat Cards + Sidebar Timeline)

**Rationale:** Handoff visualization depends on the Activity Feed being live — it consumes the same feed events grouped by traceId. The chat-side HandoffCard and sidebar HandoffChainTimeline surface the same handoff data in two contexts; building them together in one phase prevents divergent data models and ensures the two surfaces stay in sync.

**Delivers:** Styled `HandoffCard` rendered in CenterPanel message list for handoff announcements in natural language; `HandoffChainTimeline` in sidebar showing sequential avatar bubble chain for multi-hop runs with Framer Motion stagger animations; `DeliberationCard` for peer review traces (collapsible, shows only final synthesis by default).

**Uses (from STACK.md):** Framer Motion stagger animations (existing), `@tanstack/react-virtual` for timeline scroll if chains grow long, Radix ScrollArea (existing).

**Implements:** `HandoffChainTimeline` component, `HandoffCard` in `components/chat/`, CenterPanel dispatch of `autonomy_handoff_announced` CustomEvent.

### Phase 3: Approvals Hub + Task Pipeline View

**Rationale:** The Approvals Hub is independent of handoff visualization but requires the Activity Feed infrastructure (`useAutonomyFeed` provides pending count). The Task Pipeline View is also independent but benefits from being co-developed with Approvals since both are new tab-level components introducing similar query patterns. The approval race condition (Pitfall 5) must be designed into the data model here — not patched afterward.

**Delivers:** Approvals tab with pending items list, Approve/Reject actions, expiry timestamps, and `APPROVAL_EXPIRED` error handling; Task Pipeline View with horizontal scroll lanes for Queued / In-Progress / Review / Done; pipeline readable and functional at 280px minimum sidebar width.

**Uses (from STACK.md):** `@dnd-kit/core` + `@dnd-kit/sortable` (install now; drag-and-drop optional for launch, static view acceptable as MVP).

**Avoids (from PITFALLS.md):** Approval race condition (Pitfall 5), Kanban too wide for sidebar (Pitfall 6).

### Phase 4: Brain Redesign + File Upload + Autonomy Settings

**Rationale:** Brain redesign is the most backend-involved phase in v1.3. The multer + pdf-parse backend route, TOAST mitigation strategy, and per-file size limits must be locked before any upload UI is built. This phase is fully independent of the Activity Feed infrastructure and can begin as soon as the Phase 1 tab shell provides the mount surface. Autonomy Settings (inactivity toggle, cost cap, autonomy level) is co-located with Brain & Docs in the sidebar, making them natural companions in the same phase.

**Delivers:** Brain & Docs tab with structured knowledge base UI replacing static textareas; drag-and-drop PDF upload via `react-dropzone`; document list with filename, upload date, and delete; server-side text extraction via `pdf-parse`; Autonomy Settings section with inactivity toggle, cost cap progress bar (Radix Progress, existing), and three-position autonomy level control (Radix Slider, existing).

**Uses (from STACK.md):** `react-dropzone@^15.0.0`, `multer@^2.0.2`, `pdf-parse@^1.1.1`, Radix Switch/Slider/Progress (all existing).

**Avoids (from PITFALLS.md):** TOAST performance degradation (Pitfall 3), malicious PDF and file security risks (MIME validation, file-type verification, try/catch + timeout on pdf-parse), multer v1.x CVEs.

### Phase 5: Post-Validation Differentiators (v1.3.x)

**Rationale:** These features have high user value per the FEATURES.md prioritization matrix but require validating user behavior from Phase 1–4 launch before committing engineering time. Trust score display is misleading without 10+ agent completions per agent. Work Output Viewer is valuable only if users demonstrate intent to browse outputs rather than reading chat. Inline rationale requires a backend audit of which event types already log rationale — building the frontend before that audit is confirmed wastes the implementation.

**Delivers:** Work Output Viewer (deliverables browser grouped by agent and date); per-agent trust score display in stats card; explicit "Hand off to..." UI button in chat input area; inline "why" rationale per activity event (after backend audit confirms consistent rationale logging).

**Addresses (from FEATURES.md):** Work Output Viewer (P2 differentiator), Trust score display (P2 differentiator), User-initiated handoff button (P2 differentiator), Inline rationale (P2 differentiator).

### Phase Ordering Rationale

- Phase 1 gates everything: the tab shell is the mount surface for all subsequent components; the typed event infrastructure prevents cascading bugs in every later phase.
- Phases 2 and 3 can be built in parallel after Phase 1 ships — they share `useAutonomyFeed` but do not depend on each other.
- Phase 4 (file upload) is fully independent of Phases 2–3 and can start as soon as Phase 1's tab shell exists.
- Phase 5 gates on real usage data from Phases 1–4 — shipping before validation would waste engineering time on features users may not want.
- All phases use the existing WS + CustomEvent + TanStack Query infrastructure; no new transport or state management layer is introduced at any phase.

### Research Flags

Phases likely needing `/gsd:research-phase` during planning:

- **Phase 4 (Brain Redesign + File Upload):** TOAST mitigation requires a decision between adding a `project_documents` table (requires DB migration) or enforcing strict 50KB extracted-text limits with metadata-only JSONB. This is a schema decision with lasting implications. Before Phase 4 planning, run `SELECT id, pg_column_size(brain) FROM projects ORDER BY pg_column_size(brain) DESC LIMIT 10` on the production database to measure baseline sizes. That measurement determines whether limits suffice or a migration is needed.
- **Phase 5 (Post-Validation Differentiators):** Inline rationale requires auditing which `autonomy_events` rows currently contain decision rationale in their `payload` metadata versus which need new logging added. This audit should happen before Phase 5 planning begins.

Phases with standard, well-documented patterns where research-phase can be skipped:

- **Phase 1 (Sidebar Shell + Activity Feed):** Wrap-then-decompose for large component refactors is a well-established React pattern. CustomEvent bridges are already in the codebase. TanStack Virtual has clear official documentation.
- **Phase 2 (Handoff Visualization):** Framer Motion stagger animations are thoroughly documented. The handoff event data model is already defined in `autonomy_events`.
- **Phase 3 (Approvals Hub + Task Pipeline):** Approval data model is defined. Task status is source-of-truth in the `tasks` table. Constrained-width pipeline layout is a solved problem with documented approaches.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All existing versions confirmed directly against package.json. New package recommendations confirmed via npm (multer v2 CVE fix verified via Express security release notes). pdf-parse version is MEDIUM — original package is most battle-tested but a `pdf-parse-new` fork exists; verify on npm before installing. |
| Features | HIGH | Verified against Smashing Magazine (2026), Notion Custom Agents official docs, KaibanJS live product, GitHub Actions docs, UX Magazine, Cloudflare Agents docs, Permit.io best practices. Feature prioritization matrix derived from competitor gap analysis and agentic UX research. |
| Architecture | HIGH | Primary patterns derived from direct codebase inspection (RightSidebar.tsx, CenterPanel.tsx, autonomy_events, existing CustomEvent bridge in useRealTimeUpdates). All new patterns extend established codebase conventions. |
| Pitfalls | HIGH | TOAST benchmarks from pganalyze and multiple PostgreSQL JSONB performance sources. React memory leak patterns from React DevTools documentation. Approval race conditions confirmed via TanStack Query concurrency documentation. Activity feed flooding pattern confirmed by direct analysis of autonomy eventLogger output granularity. |

**Overall confidence:** HIGH

### Gaps to Address

- **TOAST vs. migration decision for Phase 4:** Research identifies the risk clearly but the correct mitigation depends on current production `brain` column sizes. Measure with `SELECT id, pg_column_size(brain) FROM projects ORDER BY pg_column_size(brain) DESC LIMIT 10` before Phase 4 planning to determine whether strict size limits suffice or a `project_documents` table migration is warranted.
- **pdf-parse version verification:** `pdf-parse@1.1.1` is the standard recommendation but the package has not had a new release in years. The `pdf-parse-new` fork may be more actively maintained. Confirm Node.js 20 compatibility and last release date for both packages before installing.
- **Approval item schema for Phase 3:** The current `autonomy_events` table does not have an explicit `approval_status` column or expiry TTL. Whether to add these via a migration or manage them in the event `payload` JSONB affects Phase 3 complexity. Validate against the existing route shape in `server/routes/autonomy.ts` before Phase 3 planning.
- **Work Output Viewer backend prerequisite for Phase 5:** Confirm that completed task execution persists artifact content in a queryable form (beyond chat messages) before designing the viewer UI. If artifacts only live in chat message content, the viewer becomes a chat message filter — a different implementation than a dedicated artifact store.

---

## Sources

### Primary (HIGH confidence)
- `/Users/shashankrai/Documents/hatching-mvp-5th-march/package.json` — installed versions confirmed directly
- Direct codebase inspection: `client/src/components/RightSidebar.tsx`, `client/src/components/CenterPanel.tsx`, `shared/schema.ts`, `server/routes/autonomy.ts`, `server/autonomy/events/eventLogger.ts` — all architectural claims derived from source
- Smashing Magazine: [Designing For Agentic AI: Practical UX Patterns](https://www.smashingmagazine.com/2026/02/designing-agentic-ai-practical-ux-patterns/) — Autonomy Dial, Intent Preview, Action Audit patterns (2026)
- GitHub Actions Docs: [Using the Visualization Graph](https://docs.github.com/actions/managing-workflow-runs/using-the-visualization-graph) — approval gate and activity log patterns
- Notion: [Custom Agents Help Documentation](https://www.notion.com/help/custom-agents) — per-run activity log structure and feedback mechanism
- Express Security Releases: [May 2025](https://expressjs.com/2025/05/19/security-releases.html) — multer v1.x CVE-2025-47935, CVE-2025-47944 confirmed
- Cloudflare Agents: [Human-in-the-Loop Patterns](https://developers.cloudflare.com/agents/guides/human-in-the-loop/) — pause/resume/interrupt control patterns

### Secondary (MEDIUM confidence)
- pganalyze: [5mins of Postgres E3: JSONB values and TOAST](https://pganalyze.com/blog/5mins-postgres-jsonb-toast) — TOAST threshold behavior and query latency impact
- KaibanJS: [Kanban for AI](https://www.kaibanjs.com/kanban-for-ai) — live product review of task states; Todo / Doing / Done / Blocked / Revise
- marmelab: [Building a Kanban board with Shadcn + dnd-kit (Jan 2026)](https://marmelab.com/blog/2026/01/15/building-a-kanban-board-with-shadcn.html) — confirms @dnd-kit as current community standard for React 18
- bprigent.com: [7 UX Patterns for Human Oversight in Ambient AI Agents](https://www.bprigent.com/article/7-ux-patterns-for-human-oversight-in-ambient-ai-agents) — Overview Panel, Activity Log, Oversight Flows patterns
- UX Magazine: [Secrets of Agentic UX](https://uxmag.com/articles/secrets-of-agentic-ux-emerging-design-patterns-for-human-interaction-with-ai-agents) — must-have vs differentiator framework for agentic interfaces
- pkgpulse.com: [unpdf vs pdf-parse vs pdfjs-dist 2026](https://www.pkgpulse.com/blog/unpdf-vs-pdf-parse-vs-pdfjs-dist-pdf-parsing-extraction-nodejs-2026) — pdf-parse recommended for simple Node.js server-side text extraction

### Tertiary (LOW confidence — validate before relying on)
- `pdf-parse@1.1.1` version stability — original package has not been updated in years; verify Node.js 20 compatibility and consider `pdf-parse-new` fork before pinning

---

*Research completed: 2026-03-24*
*Ready for roadmap: yes*
