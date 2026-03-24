# Feature Research

**Domain:** Autonomy visibility UI for AI multi-agent chat platform (Hatchin v1.3)
**Researched:** 2026-03-24
**Confidence:** HIGH — Verified against Smashing Magazine agentic UX (2026), Notion Custom Agents official docs, KaibanJS live product, GitHub Actions docs, UX Magazine agentic patterns, bprigent.com 7 UX patterns for ambient AI agents

---

## Context

This research answers: what do similar products (Linear, Notion Custom Agents, Slack, GitHub Actions, KaibanJS, AutoGen Studio) do for activity feeds, agent/workflow status visualization, approval flows, document management, and real-time event streams? What is table stakes vs differentiating for a platform surfacing autonomous AI agent work?

Hatchin already has the full autonomy backend (pg-boss, handoff orchestrator, safety gates, trust scoring, 50+ event types logged). v1.3 is entirely about making that backend visible and controllable from the frontend — zero new backend concepts, primarily UI work with lightweight API additions.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist in any product where AI agents do autonomous background work. Missing these makes the product feel untrustworthy or broken, not just incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Real-time activity feed | Every background-execution product (GitHub Actions, Notion Custom Agents, Linear) shows live updates. Silent background work creates anxiety. Notion shows trigger + actions + errors per run. GitHub Actions shows real-time step progress. | MEDIUM | Reverse-chronological event list. Human-readable descriptions ("Alex handed off to Dev"). Avatar attribution. Timestamps. Filter by agent or event type. |
| Agent "working" visual state | Presence indicators are universal (Slack online/away, Figma live cursors, GitHub Actions running indicator). When something executes in background, users need a visual signal beyond a text banner. | LOW | Pulsing avatar ring or animated dot on agents actively executing. Already partially built — v1.1 ships text indicator. This closes the visual gap. |
| Pending approvals surfaced prominently | GitHub Actions required-reviewers, Linear issue escalations — any system with gated actions must aggregate blocked items. Users who miss inline approval cards (buried in chat scroll) lose trust. | MEDIUM | Approvals tab with scannable list: agent name, action description, risk level, one-click approve/reject. Items must not be chat-scroll-only. |
| Audit trail per agent run | Notion Custom Agents, Linear, GitHub Actions all log every run with trigger + actions + errors. This is now a baseline expectation for any agentic system claiming transparency. Notion's activity log shows "what the agent thought and did at each step." | MEDIUM | Each event item shows: trigger (what started it), actions taken, outcome (success/error/pending). Filterable. Clickable for detail. |
| Task status differentiation (queued / in-progress / review / done) | Kanban-style task flow is universal (Trello, Linear, GitHub Projects, Jira). KaibanJS, VS Code Agent Kanban, and AgentsBoard all implement it for AI agents. Any multi-step pipeline must show status visually. | MEDIUM | Task pipeline view with status columns. Cards showing task title, assigned agent, status badge. Real-time column movement as status changes. |
| Empty states that explain the feature | Every product with sidebar sections that start empty needs explanatory empty states. Without them, users assume the feature is broken. Linear, Notion, and Slack all invest in empty state copy. | LOW | Each tab (Activity / Approvals / Brain & Docs) needs distinct empty state: illustration + one-line description + CTA (e.g., "Start a conversation and your Hatches will begin working"). |
| Document upload for project context | Every RAG/knowledge-base product (TypingMind, Orq.ai, OpenWebUI, Notion) supports file upload. Users adding context to AI systems expect drag-and-drop PDF/doc upload, not pasted-text-only input. | MEDIUM | Drag-and-drop + file picker. PDF minimum. Show upload progress and processed status. Display file list with upload date and delete option. |
| User-initiated routing / handoff | Directly @mentioning a specialist agent and expecting it to respond is standard in any multi-agent product (Slack channels, Notion custom agents). "Pass this to Engineer" must be possible from the UI, not just implicit routing. | MEDIUM | @mention already partially exists. Add explicit "Hand off to..." button for discoverability. Sends to handoffOrchestrator directly. |
| Pause / cancel active work | UX Magazine explicitly flags start/stop/pause as non-negotiable to avoid "Sorcerer's Apprentice situations." Cloudflare Agents, LangGraph, and Temporal all surface interrupt controls. Hatchin has this — it must be discoverable in the sidebar, not hidden. | LOW | Already exists. Ensure pause/cancel is prominent in the Activity tab header, not just a chat command. |
| Return briefing visible in feed | When users come back after background work completes, they need a summary entry in the feed, not just a chat message. The briefing is already generated (Maya return briefing, v1.1) — it must appear distinctly in the activity feed. | LOW | Already built. ActivityFeed surfaces briefing events as a distinct card type, not just another feed item. |

### Differentiators (Competitive Advantage)

Features that make Hatchin's autonomy visibility meaningfully better than generic agent tools. Aligned with core value: agents feel like real colleagues, not a dashboard of processes.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Handoff chain timeline (visual) | GitHub Actions shows job dependency graphs. KaibanJS shows task-to-agent assignment. Hatchin can show the exact PM → Engineer → Designer handoff chain as a visual timeline in the sidebar — the story of how work moved. No consumer-facing team chat tool does this. | HIGH | Sequential avatar bubbles connected by arrows. Each bubble shows agent name, task name, status, and output snippet. Sidebar timeline component separate from chat announcement cards — both surfaces together. |
| Deliberation visibility | AutoGen Studio surfaces "message flow visualization" mid-execution showing agent-to-agent communication. Hatchin has deliberation traces in the database. Showing "Hatches are currently coordinating on your scope" with a condensed preview is genuinely novel in a consumer product. | HIGH | DeliberationCard: collapsible, shows which agents are coordinating, plain-English summary of what they're discussing, resolves when deliberation completes. Rare in products aimed at non-technical users. |
| Autonomy dial — four levels | Smashing Magazine's research identifies the "Autonomy Dial" as the single most trust-building control in agentic systems. Four levels: Observe & Suggest → Plan & Propose → Act with Confirmation → Act Autonomously. No competitor (Notion, GitHub Actions, AutoGen Studio) offers this level of granularity to users. | MEDIUM | Settings control mapping directly to Hatchin's existing three-tier safety thresholds. Surfacing backend power as a user-friendly slider builds trust. A labeled toggle is sufficient — does not need to be a literal dial. |
| Trust score visible per agent | Progressive trust is a backend concept users never see. Surfacing "Alex (PM) — 92% trust, 24 tasks completed" in the stats card creates a narrative that agents earn autonomy through performance. No competitor shows agent trust levels to users. | MEDIUM | Small trust bar or percentage alongside agent avatar in stats card and activity feed. Pulls from existing agents.personality.trustMeta. Requires no new backend work. |
| Real-time cost transparency | Users executing background LLM tasks have no idea what they're spending. "Today: $0.12 / $2.00 cap" in the stats card is rare outside developer tools (AWS Cost Explorer). Creates immediate accountability and justifies Pro subscription value. | LOW | Use existing per-project daily cost cap data. Format as spent/cap with a progress bar. Already tracked — just needs surfacing. |
| Inline "why" rationale per autonomy event | Smashing Magazine calls this "Explainable Rationale" — linking agent decisions to stated user rules ("Because your project goal is X, I handed this to Engineer"). Notion logs actions but not reasoning. AutoGen shows message flow but not plain-English rationale. | HIGH | Expandable section on each ActivityFeed item. Requires backend to persist decision rationale in autonomy_events.metadata. Currently partially logged in some event types — needs consistent surfacing. |
| Work output viewer (deliverables browser) | The end product of background execution is an artifact — a plan, research doc, task breakdown. These are currently buried in chat scroll. A dedicated deliverables view lets users browse and copy outputs without reading full conversation history. | HIGH | List of completed task outputs grouped by agent and date. Preview on click. Markdown rendering with copy/export button. No equivalent in Notion Agents or AutoGen Studio for consumer products. |
| Handoff initiation button in chat | Explicit "Hand off to [Agent]" UI button on messages — not just @mention. Reduces friction for non-technical users who do not know @mention exists. Exposes routing capability that already exists. | LOW | Dropdown on message hover or chat toolbar. Sends a command that triggers handoffOrchestrator. Appears as a handoff announcement card in chat. |

### Anti-Features (Deliberately NOT Build)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Full LangGraph execution graph visualization | Developers want to see the raw state machine — nodes, edges, state transitions, like LangGraph Studio | Wrong audience. Non-technical Hatchin users (founders, designers, marketers) have no mental model for a directed acyclic graph. Produces an intimidating visualization that breaks the "team of real colleagues" metaphor entirely. | Show the handoff chain as a human-readable timeline: "Alex scoped it, handed to Dev, Dev handed to Cleo." Same data, right framing, right audience. |
| Per-message live token counter | Visible in developer LLM tools (OpenAI Playground, etc.). Feels technical and precise. | Destroys the "real colleagues" brand. Colleagues do not show you their word count. Makes Hatches feel like API calls, not people. Contradicts anti-prompting philosophy. | Show aggregated cost at project level in the stats card. Token counts per message are never surfaced to users. |
| Raw JSON event log viewer | Power users want full event payloads for debugging agent behavior | Creates a developer debugging tool inside a consumer product. Inconsistent with anti-prompting philosophy. Signals to users that they need to understand technical internals. | Human-readable activity feed covers 95% of oversight needs. Offer data export for Pro users who want raw logs for compliance — do not surface JSON in-product. |
| Approval required for every autonomous action | Seems maximally safe — user controls everything | Approval fatigue destroys the value proposition of autonomy. If users must approve every step, the product is slower than doing it manually. Smashing Magazine research targets >85% accept-without-edit rate as a health metric — over-gating drives churn. | Maintain the existing three-tier system: auto-complete for low-risk, peer review for medium, user approval for high. Trust score raises thresholds over time. This is already built correctly. |
| Second chat surface in sidebar | Seems to provide "full agent context" in one place | Duplicates CenterPanel. Creates navigation confusion about which chat is canonical. Users do not know where to read. Conflicts with the single-chat-as-primary-record architecture. | Work Output Viewer shows deliverables. Activity Feed shows events. Deliberation card shows coordination. CenterPanel remains the canonical conversation record. |
| Configurable trigger rules and event stream builder | Pattern #5 from bprigent.com — powerful for autonomous developer agents | Hatchin's current audience (non-technical founders, solo makers) gains nothing from conditional logic builders. Hatchin's trigger model is intentionally simple: explicit intent in chat or 2-hour inactivity. Adding configuration complexity before validating simplicity creates churn. | Inactivity toggle (already designed) covers 100% of use cases at current scale. Revisit configurable triggers when B2B segment arrives. |
| Document version history and rollback | RAG products like Notion support document versioning | Adds infrastructure complexity at MVP scale. Base64 JSONB storage was chosen deliberately to avoid S3/versioning overhead. Full versioning requires diffing, storage, rollback UI. | Show upload timestamp. Allow re-upload to replace. Version history deferred to v2 when B2B customers request it for compliance. |

---

## Feature Dependencies

```
[Sidebar Tab Restructure: Activity / Brain & Docs / Approvals]
    └──required-by──> [ALL sidebar features below]
    └──requires──> [RightSidebar.tsx decomposed into tab shell first]

[Activity Feed]
    └──requires──> [Autonomy Events API with projectId filter]
    └──required-by──> [Autonomy Stats Card]
    └──required-by──> [Agent Working Avatar State] (events drive avatar state changes)
    └──required-by──> [Work Output Viewer] (completion events link to outputs)

[Handoff Chain Timeline]
    └──requires──> [Activity Feed] (data source for handoff events)
    └──requires──> [HandoffCard in CenterPanel] (chat announcement)
    └──enhances──> [Activity Feed] (timeline is a specialized view of handoff events)

[Pending Approvals Hub]
    └──requires──> [Autonomy Events API — status=pending filter]
    └──requires──> [Existing inline approval card logic] (reused, not rebuilt)
    └──enhances──> [Activity Feed] (pending items also appear in feed)

[Deliberation Visibility]
    └──requires──> [GET /api/autonomy/traces]
    └──enhances──> [Activity Feed] (deliberation start/end appear as events)

[Work Output Viewer]
    └──requires──> [Completed task outputs in autonomy_events or tasks table]
    └──enhances──> [Activity Feed] (completion events link to output viewer)

[Trust Score Display]
    └──requires──> [agents.personality.trustMeta] (already exists, no backend work)
    └──enhances──> [Autonomy Stats Card]

[Autonomy Dial / Settings]
    └──requires──> [Autonomy Settings UI tab or section]
    └──enhances──> [Safety gate thresholds] (maps to existing backend config)

[Document Upload]
    └──requires──> [multer + pdf-parse backend route on server/routes/projects.ts]
    └──requires──> [shared/schema.ts brain document type extension]
    └──enhances──> [Project Brain redesign]

[User-Initiated Handoff Button]
    └──requires──> [server/routes/chat.ts handoff handler] (add handoffTo metadata support)
    └──enhances──> [Handoff Chain Timeline] (user-initiated handoffs appear in chain)

[Agent Working Avatar State]
    └──requires──> [Activity Feed] (execution start/stop events drive state)
    └──requires──> [BaseAvatar.tsx working state prop]
```

### Dependency Notes

- **Sidebar tab restructure is the single gating dependency.** RightSidebar.tsx must be decomposed into a tab shell before any child component can be built without conflict. This is Phase 11's first commit.
- **Activity Feed is the highest-leverage primitive.** It feeds data to Stats Card, Avatar State, Work Output Viewer, and Handoff Timeline. Build it first inside the Activity tab — everything else is specialized views on top of it.
- **Pending Approvals Hub reuses existing logic.** The inline approval card already handles approve/reject. The hub is a collection view polling for pending events — new UI shape, not new logic.
- **Deliberation visibility conflicts with simple feed item ordering.** Deliberation traces are ongoing processes (not point-in-time events). They need a distinct card type with live update behavior rather than a static feed entry.
- **Work Output Viewer requires backend validation first.** Confirm that completed task execution persists artifact content in a queryable form before building the viewer UI. If artifacts only live in chat messages, the viewer becomes a chat filter — acceptable but different implementation.

---

## MVP Definition

### Launch With (v1.3 — this milestone)

The minimum that makes the autonomy backend meaningfully visible and controllable. Each item maps to Phase 11–15 in the milestone plan.

- [ ] RightSidebar decomposed into tab shell (Activity / Brain & Docs / Approvals) — gating dependency for everything else
- [ ] Live Activity Feed — real-time event stream, human-readable, reverse-chronological, filterable by agent
- [ ] Autonomy Stats Card — tasks completed today, handoffs, cost spent vs cap
- [ ] Agent "working" avatar state — pulsing ring on agents actively executing in background
- [ ] Empty states for all three tabs — explanatory copy and illustration, not blank panels
- [ ] Handoff visualization — chat announcement cards in CenterPanel + handoff chain timeline in sidebar
- [ ] Pending Approvals Hub — tab with list of high-risk items awaiting user action (not scroll-through-chat)
- [ ] Task Pipeline View — status columns (Queued / In-Progress / Review / Done) with task cards
- [ ] Project Brain redesign with PDF/doc upload — replace static textareas with structured knowledge base UI
- [ ] Autonomy Settings UI — inactivity toggle, cost cap display, autonomy level control

### Add After Validation (v1.3.x)

Features where the core pattern is built but user behavior must be validated before investing more.

- [ ] Work Output Viewer (deliverables browser) — add once Activity Feed is live and users demonstrate desire to browse outputs rather than reading chat. Trigger: >30% of users open activity tab more than once per session.
- [ ] Trust score display per agent — add once users have enough completions to see meaningful numbers (10+ per agent). Before that, empty trust bars mislead more than inform.
- [ ] Inline "why" rationale per event — requires backend change to persist decision rationale consistently. Add after auditing which event types already log rationale vs which need it added.
- [ ] Deliberation visibility card — complex to surface cleanly without overwhelming non-technical users. Add after basic handoff chain proves valuable and users ask "how did they decide that?"
- [ ] Explicit "Hand off to" UI button — @mention exists. Add the button after observing whether users discover @mention organically or complain about routing.

### Future Consideration (v2+)

- [ ] Configurable event trigger rules / logic builder — power-user feature; build when B2B segment arrives and admins need to customize trigger conditions
- [ ] Document versioning / history — infrastructure-heavy; defer until file upload is validated and B2B customers request compliance features
- [ ] Raw event log export (CSV/JSON) — enterprise/developer feature; add when Pro tier users ask for it explicitly
- [ ] Cross-project agent activity view — requires multi-project architecture changes; defer until multi-user collaboration milestone
- [ ] Agent confidence scores per message — requires LLM pipeline changes to track and surface confidence; separate research needed

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Sidebar tab restructure | HIGH | MEDIUM | P1 |
| Activity Feed (live events) | HIGH | MEDIUM | P1 |
| Agent working avatar state | HIGH | LOW | P1 |
| Pending Approvals Hub | HIGH | MEDIUM | P1 |
| Empty states (all tabs) | MEDIUM | LOW | P1 |
| Autonomy Stats Card | MEDIUM | LOW | P1 |
| Task Pipeline View | HIGH | MEDIUM | P1 |
| Project Brain with file upload | HIGH | MEDIUM | P1 |
| Autonomy Settings UI | MEDIUM | MEDIUM | P1 |
| Handoff visualization (cards + timeline) | HIGH | HIGH | P1 |
| Work Output Viewer | HIGH | HIGH | P2 |
| Trust score display | MEDIUM | LOW | P2 |
| User-initiated handoff button | MEDIUM | LOW | P2 |
| Deliberation visibility card | MEDIUM | HIGH | P2 |
| Inline "why" rationale | HIGH | HIGH | P2 |
| Cost cap progress bar | LOW | LOW | P2 |
| Autonomy Dial (four-level) | HIGH | MEDIUM | P2 |
| Document versioning | LOW | HIGH | P3 |
| Raw event log export | LOW | MEDIUM | P3 |
| Full execution graph visualization | LOW | HIGH | P3 |

**Priority key:**
- P1: Must ship in v1.3 — the milestone is not done without these
- P2: Target for v1.3.x after user validation
- P3: v2+ or explicitly deferred

---

## Competitor Feature Analysis

| Feature | GitHub Actions | Notion Custom Agents | KaibanJS / AutoGen Studio | Hatchin v1.3 Approach |
|---------|---------------|---------------------|--------------------------|----------------------|
| Activity log | Per-run log with steps, status icons, color-coded success/failure/in-progress. Real-time step graph during execution. | Per-run log showing trigger + agent reasoning + actions + errors. Clock icon opens detailed trace. Visible only to Full Access users. | AutoGen Studio: message flow visualization mid-execution. KaibanJS: live task state transitions on board. | ActivityFeed in sidebar: human-readable items, avatar attribution, timestamps, filter by agent or event type. More accessible than raw logs. |
| Agent status visualization | Job status icons (queued / running / success / failed) on a dependency graph. Color-coded. | Implicit — agent page shows "running." No persistent status across UI. | KaibanJS: task cards move across columns in real-time showing agent assignment and current state. | Pulsing avatar ring in sidebar and LeftSidebar agent list. Human presence metaphor rather than status icons. More consistent with "team of colleagues" brand. |
| Approval workflow | Required reviewers block job execution at named environment gates. Reviewer gets email + UI banner. Can also set time-based delays. | No blocking approvals — all post-hoc review only. Feedback via thumbs-down rating. | Not implemented in either product. | Approvals tab surfaces all pending high-risk items. Each item: agent name, action description, risk level indicator, approve/reject buttons. Consolidates what v1.1 scattered across chat scroll. |
| Handoff / routing visualization | Job dependency graph (DAG view). Shows which jobs triggered which, in what order, with status. | Not applicable — single agent model. | KaibanJS: task assignment to agent visible on board card. Agent name shown on card. No chain visualization. | Handoff chain timeline in sidebar: sequential avatar bubbles with arrows showing PM → Engineer → Designer progression. Chat card announces handoff in natural language simultaneously. Both surfaces together. |
| Task status pipeline | Matrix view of job statuses per commit. Not a kanban. | Agent runs list — no per-task kanban breakdown. | KaibanJS: full kanban with Todo / Doing / Done / Blocked / Revise. Real-time card movement. Industry's best implementation for AI tasks. | Task Pipeline View with four columns (Queued / In-Progress / Review / Done). Less opinionated than Kaiban to start — add Blocked state after user validation. |
| Knowledge base / document upload | No | Notion docs are separate from agent context — no direct upload to agent context. | Not applicable. | Brain & Docs tab: PDF/doc upload → base64 in brain.documents JSONB → automatically injected into Hatch prompts. Visual document list with filename, upload date, delete option. |
| Deliberation / coordination visibility | Not applicable. | Not applicable. | AutoGen Studio: mid-run message flow showing agent-to-agent messages during execution. | DeliberationCard: collapsible card surfacing which agents are coordinating, plain-English summary of discussion topic, resolves when deliberation completes. Novel for a consumer-facing product. |
| Autonomy controls | Environment protection rules. Required reviewers. Time-based delays. Deployment branch restrictions. | Toggle agent on/off. No granular control. | Not applicable. | Autonomy Settings: inactivity toggle, cost cap input, four-level autonomy dial, per-agent trust score. More granular and more human-readable than any competitor. |

---

## Sources

- Smashing Magazine: [Designing For Agentic AI: Practical UX Patterns For Control, Consent, And Accountability](https://www.smashingmagazine.com/2026/02/designing-agentic-ai-practical-ux-patterns/) — HIGH confidence. Detailed component checklist including Intent Preview, Action Audit, and Autonomy Dial patterns. Published 2026-02.
- UX Magazine: [Secrets of Agentic UX: Emerging Design Patterns for Human Interaction with AI Agents](https://uxmag.com/articles/secrets-of-agentic-ux-emerging-design-patterns-for-human-interaction-with-ai-agents) — HIGH confidence. Must-have patterns vs differentiators for agentic interfaces.
- bprigent.com: [7 UX Patterns for Human Oversight in Ambient AI Agents](https://www.bprigent.com/article/7-ux-patterns-for-human-oversight-in-ambient-ai-agents) — HIGH confidence. Pattern 1 (Overview Panel), Pattern 3 (Activity Log), Pattern 2 (Oversight Flows) directly inform this research.
- Notion: [Custom Agents Help Documentation](https://www.notion.com/help/custom-agents) — HIGH confidence. Official documentation on activity log structure, per-run visibility, and feedback mechanism.
- GitHub: [Workflow Visualization Docs](https://github.blog/changelog/2020-12-08-github-actions-workflow-visualization/) and [Using the Visualization Graph](https://docs.github.com/actions/managing-workflow-runs/using-the-visualization-graph) — HIGH confidence. Official docs on real-time status graph and approval gates.
- KaibanJS: [Kanban for AI](https://www.kaibanjs.com/kanban-for-ai) — MEDIUM confidence. Live product review showing task states: Todo / Doing / Done / Blocked / Revise.
- Linear: [Notifications Documentation](https://linear.app/docs/notifications) and [Inbox](https://linear.app/docs/inbox) — HIGH confidence. Official docs on sidebar notification patterns.
- Cloudflare Agents: [Human-in-the-Loop Patterns](https://developers.cloudflare.com/agents/guides/human-in-the-loop/) — HIGH confidence. Official docs on pause/resume/interrupt controls for agent workflows.
- Permit.io: [Human-in-the-Loop for AI Agents](https://www.permit.io/blog/human-in-the-loop-for-ai-agents-best-practices-frameworks-use-cases-and-demo) — MEDIUM confidence. Best practices for approval workflow design.

---

*Feature research for: Autonomy visibility UI — AI multi-agent chat platform (Hatchin v1.3)*
*Researched: 2026-03-24*
