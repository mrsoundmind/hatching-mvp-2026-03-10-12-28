# Feature Research

**Domain:** Autonomous AI agent execution loop (v1.1 milestone)
**Researched:** 2026-03-19
**Confidence:** HIGH — Based on direct codebase analysis of existing system + domain knowledge of autonomous agent patterns

---

## Context: What Already Exists

This research focuses only on what needs to be built for v1.1. Substantial infrastructure was shipped in v1.0 and the pre-v1.0 autonomy layer. Understanding the delta is essential.

**Already implemented (do not rebuild):**

| System | Location | Status |
|--------|----------|--------|
| Safety scoring (hallucinationRisk, scopeRisk, executionRisk, 0.35/0.65/0.7 thresholds) | `server/ai/safety.ts` | Production |
| Peer review runner with rubric evaluation | `server/autonomy/peerReview/peerReviewRunner.ts` | Production |
| Conductor for multi-agent routing | `server/ai/conductor.ts` | Production |
| Task detection from chat messages | `server/ai/taskDetection.ts` | Production |
| Background cron runner (health checks every 2h, world sensing every 6h) | `server/autonomy/background/backgroundRunner.ts` | Implemented, disabled by default (BACKGROUND_AUTONOMY_ENABLED=false) |
| Project health scoring with friction points | `server/autonomy/background/projectHealthScorer.ts` | Production |
| Proactive outreach (generates + sends in-character messages) | `server/autonomy/background/proactiveOutreach.ts` | Production |
| Task graph engine (dependency-aware, role-inferred) | `server/autonomy/taskGraph/taskGraphEngine.ts` | Production |
| Escalation ladder (single_hatch → web_research → peer_review → deliberation → task_graph) | `server/autonomy/conductor/escalationLadder.ts` | Production |
| Decision authority resolver (worker/reviewer/conductor/guardrail hierarchy) | `server/autonomy/conductor/decisionAuthority.ts` | Production |
| Agent handoff (initiateHandoff, processHandoffRequest, transferContext) | `server/routes/chat.ts` lines ~1008-1042 | Production — triggered only on agent failure |
| Action proposal system with risk tiers (low/medium/high) | `server/ai/autonomyStore.ts` + chat.ts | Proposals created, no frontend approval UI |
| Autonomy event logging | `server/autonomy/events/eventLogger.ts` | Production |
| Deliberation traces | `server/autonomy/traces/traceStore.ts` | Production |
| AKL (Autonomous Knowledge Loop) | `server/knowledge/akl/` | Implemented, research stub not wired |
| Quiet hour guardrails (10pm-8am UTC, 30-min recent-activity gate) | `server/autonomy/background/frictionMap.ts` | Production |

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that, once the milestone is positioned as "Hatches work while you're away," users will expect. Missing these makes the feature feel unfinished.

| Feature | Why Expected | Complexity | Existing Dependency | Notes |
|---------|--------------|------------|---------------------|-------|
| Explicit "go ahead" trigger in chat | If a user says "go ahead and work on this," something should visibly happen | LOW | Task detection + WS events exist; need chat input gesture + backend handler | Single-intent recognition, route to background execution |
| Action proposal approval UI | `action_proposal_created` WS events are already emitted but never rendered; proposals are created, accepted, and never surfaced | MEDIUM | `ActionProposal` type + `createActionProposal` exist in autonomyStore; risk tiers are computed | Frontend modal/card for approve/reject per proposal |
| Real-time "team is working" status indicator | When background execution is active, user needs visible signal (not a blank UI) | LOW | Autonomy event log exists; need WS event for execution_started / execution_completed | Simple status banner or agent avatar state change |
| Task execution result artifacts | Background execution must produce something — a plan, research doc, task breakdown — stored as a message | HIGH | Task graph engine exists; backgroundRunner runs health checks but doesn't execute tasks | Core gap: the execution loop produces no output artifacts yet |
| Chat summary briefing on return | User comes back after absence and gets a conversational summary of what happened | MEDIUM | No summary generation exists; autonomy events are logged | LLM call over recent events/messages → single summary message |
| Inactivity detection → autonomous trigger | The system should recognize when a user has been away long enough that background work can begin | LOW | Conversation gap signal exists in projectHealthScorer; RECENT_ACTIVITY_MINUTES=30 gate exists | Wire inactivity threshold to explicit execution trigger, not just proactive outreach |

### Differentiators (Competitive Advantage)

Features that make Hatchin's autonomous execution loop distinctly better than generic AI agent frameworks.

| Feature | Value Proposition | Complexity | Existing Dependency | Notes |
|---------|-------------------|------------|---------------------|-------|
| In-character handoff messages | When PM hands off to Engineer, Engineer sends a natural "I'll take this from here" message in their personality — not a system notification | MEDIUM | Character profiles + proactiveOutreach pattern exists; handoff currently only triggers on agent failure | Extend handoff trigger to task completion events, generate handoff message using same proactiveOutreach pipeline |
| Risk-tiered auto-approval | Low-risk tasks (planning, research, breakdown) auto-execute without user approval; high-risk tasks (publish, send, delete) surface a proposal card | MEDIUM | Risk scoring exists (executionRisk 0.35/0.65); ActionProposal has riskLevel; no auto-execution path for low-risk | Define "safe autonomy zone": tasks where executionRisk < 0.35 execute silently, others gate |
| Execution trace visible to user | User can see what each Hatch did, in what order, why — presented as a readable narrative not raw logs | MEDIUM | Deliberation traces + autonomy event log exist; need a readable trace UI component | Summarize trace → conversational "here's what we did" format |
| Peer review on autonomous outputs | When a Hatch produces an execution artifact, another Hatch reviews it before surfacing to the user — same pattern as chat peer review | MEDIUM | peerReviewRunner exists and is used for chat; needs to be hooked into background execution path | Re-use existing peer review infrastructure; add `autonomous_output` context |
| Proactive clarification before blocking | When execution stalls on ambiguity, Hatch asks one precise question rather than failing silently | LOW | clarificationRequired flag exists in peerReviewDecision; currently returns the question in the response | Surface clarification as WS event → user gets notified even if not in app |
| Progressive trigger (explicit now, inactivity later) | Phase 1: "go ahead" keyword; Phase 2: idle detection auto-starts; users build trust gradually | LOW | Foundation for both exists; gap is the explicit trigger handler and idle timer | Implement explicit trigger first, gate inactivity trigger behind feature flag |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Fully autonomous execution without any human approval | "The Hatches should just handle everything" | Destroys user trust when wrong; no recovery path; escalates quietly | Risk-tiered auto-approval: low-risk auto-executes, high-risk surfaces a compact proposal card with one-click approve |
| Real-time progress stream while user is watching | Showing every agent deliberation step, every token | Overwhelming, anxiety-inducing, feels like watching AI struggle rather than work confidently | Surface a single "your team is working" indicator while in progress; deliver a clean result artifact when done |
| Autonomous execution touching external systems (GitHub, Linear, email) | "Engineer should push code, PM should update Linear" | Irreversible side effects without integration setup; dramatically increases blast radius of errors | Scope autonomy to in-app artifacts (plans, research docs, task trees) for v1.1; integrations are v2+ |
| Polling-based status updates from frontend | Client polls /api/execution/status every N seconds | Redundant with WebSocket; adds load; creates race conditions | Extend existing WS events: emit execution_started, execution_progress, execution_completed |
| Separate "autonomy mode" toggle | Explicit on/off switch for autonomous behavior | Creates a binary mental model; confusing for new users; hard to re-enable once turned off | Autonomy is always on but graduated — explicit "go ahead" → inactivity trigger → always-on; feel natural, not a mode switch |
| Agent memory wipes between background sessions | "Reset context for each execution run" | Breaks continuity; agents forget what they decided two cycles ago; users notice inconsistency | Use existing conversation_memory + project Brain as persistent context; explicitly load prior execution artifacts into each run |

---

## Feature Dependencies

```
[Background task execution artifacts]
    └──requires──> [Explicit "go ahead" trigger]
                       └──requires──> [Inactivity detection OR keyword recognition]

[Chat summary briefing]
    └──requires──> [Background task execution artifacts]
                       └──enhances──> [Execution trace visible to user]

[In-character handoff messages]
    └──requires──> [Task completion event from task graph engine]
    └──uses──> [Proactive outreach pipeline (already exists)]

[Risk-tiered auto-approval]
    └──requires──> [Action proposal approval UI]
    └──uses──> [Safety scoring thresholds (already exist)]
    └──uses──> [ActionProposal system (already exists, no UI)]

[Peer review on autonomous outputs]
    └──uses──> [peerReviewRunner (already exists)]
    └──requires──> [Background task execution artifacts]

[Proactive clarification before blocking]
    └──uses──> [clarificationRequired flag (already exists)]
    └──requires──> [WS notification even when user is offline/away]
```

### Dependency Notes

- **Background task execution artifacts require an explicit trigger:** The execution loop has no entry point yet. The explicit "go ahead" keyword handler or inactivity timer is the gate that starts execution. Build this first.
- **Chat summary briefing requires artifacts:** A summary of nothing is useless. Execution must produce stored messages/artifacts before a summary can be meaningful. Do not build the summary UI before execution produces output.
- **In-character handoffs enhance the user experience but are not blockers:** The functional handoff logic exists. The in-character message is additive polish. Safe to defer to a second pass within the milestone.
- **Risk-tiered auto-approval requires a frontend surface:** The backend proposal system exists (`ActionProposal`, `createActionProposal`, `action_proposal_created` WS event). The frontend never renders it. Building the approval UI is a prerequisite to any risk-based auto-approval logic being meaningful to users.
- **Peer review on autonomous outputs is a quality gate, not a blocker:** Execution can ship without it; peer review can be added in the second pass without schema changes.

---

## MVP Definition

### Launch With (v1.1 core)

Minimum viable autonomous execution — what's needed to validate the concept that "Hatches work while you're away."

- [ ] **Explicit "go ahead" trigger** — Keyword/phrase detection in user message (e.g., "go ahead", "work on this", "you handle it") routes to background execution handler instead of chat response. This is the entry point for everything else.
- [ ] **Background task execution pipeline** — When triggered, the task graph engine decomposes the request into role-assigned tasks, each Hatch "executes" by generating a text artifact (plan, research brief, task breakdown) and stores it as a message in the conversation. Low-risk tasks auto-execute; medium/high surface proposal cards.
- [ ] **Action proposal approval UI** — Frontend card/modal renders `action_proposal_created` WS events. User can approve or reject. Approved proposals execute; rejected proposals get logged and Hatch acknowledges. Unblocks the entire risk-tiered approval flow.
- [ ] **Chat summary briefing** — When user returns after 30+ minutes of background activity, Maya generates a single conversational summary: "While you were away, [Engineer] built the API structure and [Designer] drafted the component layout. Two things need your input: [X] and [Y]." Stored as a special `summary` messageType.
- [ ] **"Team is working" status indicator** — Frontend shows a subtle status when background execution is active (agent avatar glow, status banner, or similar). Dismisses when execution completes.

### Add After Validation (v1.1 polish)

Features to add once the core loop is working and user response is clear.

- [ ] **In-character handoff messages** — When PM finishes scoping and passes to Engineer, Engineer sends one natural "Got it, picking this up" message. Re-uses proactiveOutreach pipeline. Add once core execution works.
- [ ] **Execution trace narrative** — Readable "here's what we did" summary rendered from deliberation traces + autonomy events. Gives power users transparency without raw logs. Add once artifacts are being generated.
- [ ] **Inactivity-based trigger** — After configurable idle time (default: 4 hours with pending tasks), background execution starts automatically. Gate behind `INACTIVITY_AUTONOMY_ENABLED` feature flag. Only activate after explicit trigger is validated.
- [ ] **Peer review on autonomous outputs** — Before surfacing an execution artifact, another Hatch reviews it using existing peerReviewRunner. Adds quality gate without new infrastructure.

### Future Consideration (v2+)

Features to defer until product-market fit is established and user feedback shapes direction.

- [ ] **External system integrations** (GitHub, Linear, Notion) — Irreversible side effects require deep trust and integration setup. After v1.1 validates in-app autonomous execution.
- [ ] **Multi-user collaboration on autonomous tasks** — Multiple humans approving/rejecting proposals from the same execution run. Requires real-time multi-user presence (separate milestone).
- [ ] **Scheduled recurring execution** — "Every Monday morning, [PM] reviews the task backlog and surfaces blockers." Requires user-configurable schedule UI + persistent schedule storage.
- [ ] **User-tunable autonomy thresholds** — Slider for "how much should Hatches do without asking me?" Per-project risk tolerance settings. After v1.1 demonstrates fixed thresholds work well enough.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Explicit "go ahead" trigger | HIGH — entry point for all autonomy | LOW — keyword detection + WS routing | P1 |
| Background task execution pipeline (artifact generation) | HIGH — the actual "work while away" | HIGH — new execution loop, LLM calls per task | P1 |
| Action proposal approval UI | HIGH — unblocks all risk-tiered flows | MEDIUM — WS event already emitted, need React component | P1 |
| Chat summary briefing | HIGH — the "wake up to progress" moment | MEDIUM — LLM call + special message type + return-detection logic | P1 |
| "Team is working" status indicator | MEDIUM — UX polish, sets expectations | LOW — WS event listener + frontend state | P1 |
| In-character handoff messages | MEDIUM — differentiating polish | LOW — re-use proactiveOutreach, extend trigger condition | P2 |
| Execution trace narrative | MEDIUM — trust and transparency | MEDIUM — trace aggregation + LLM summarization | P2 |
| Inactivity-based trigger | MEDIUM — removes need for explicit "go ahead" | LOW — idle timer + existing execution entry point | P2 |
| Peer review on autonomous outputs | MEDIUM — quality gate | LOW — hook existing peerReviewRunner into execution path | P2 |
| External system integrations | HIGH eventual value, LOW current user demand | VERY HIGH — auth, webhooks, error handling per system | P3 |

**Priority key:**
- P1: Must have for v1.1 launch — core loop isn't functional without these
- P2: Should have — adds quality and polish, safe to add during milestone
- P3: Future consideration — meaningful but requires separate planning

---

## Implementation Gaps vs. Existing Infrastructure

This table maps each v1.1 feature to what exists vs. what needs to be built. Use this to avoid reinventing infrastructure.

| Feature | What EXISTS | What's MISSING |
|---------|-------------|----------------|
| Explicit "go ahead" trigger | Keyword/mention parsing (`mentionParser.ts`), WS message handler | Handler branch in chat.ts for "execution intent" vs "conversation intent"; route to execution pipeline instead of LLM response |
| Background task execution artifacts | `taskGraphEngine.ts` creates a graph; `backgroundRunner.ts` runs on cron | Execution step: for each graph task, call LLM to generate the artifact, store as message; backgroundRunner currently only does health checks + outreach |
| Action proposal approval UI | `ActionProposal` type, `createActionProposal()`, `action_proposal_created` WS event already emitted | React component: ProposalCard renders the proposal, approve/reject buttons, POST to new `/api/proposals/:id/approve` or `/reject` route |
| Chat summary briefing | Autonomy event log + message history storage; Maya agent exists | SummaryGenerator: reads recent messages + events since last user activity, calls LLM, stores as `messageType: "summary"`; trigger on `join_conversation` or first message after gap |
| "Team is working" status indicator | `execution_started` / `streaming_started` WS events exist | New `background_execution_started` and `background_execution_completed` WS events; frontend subscribes and shows status badge |
| In-character handoff messages | `proactiveOutreach.sendProactiveMessage()`, character profiles; handoff logic in chat.ts (failure path) | Extend handoff trigger: fire on task completion event from task graph, not only agent failure; generate one handoff message per role transition |
| Inactivity-based trigger | `RECENT_ACTIVITY_MINUTES=30` gate in frictionMap.ts; conversation gap signal in projectHealthScorer | Dedicated idle timer per project (not just a gate); configurable threshold (`INACTIVITY_TRIGGER_HOURS`); starts execution loop instead of just proactive outreach |
| Risk-tiered auto-approval | `riskLevel` on ActionProposal; execution risk thresholds defined | Auto-execute path for `riskLevel: "low"` (executionRisk < 0.35) without creating a proposal; proposal card only for medium/high |
| Peer review on autonomous outputs | `runPeerReview()` in peerReviewRunner; used in chat streaming path | Call `runPeerReview()` after artifact generation in execution loop; treat output as `draftResponse` parameter |

---

## Sources

- Direct codebase analysis: `server/autonomy/`, `server/ai/`, `server/routes/chat.ts` (2026-03-19)
- Existing autonomous agent patterns observed in: LangGraph state machine (`server/ai/graph.ts`), deliberation traces, escalation ladder
- Project vision: `.planning/PROJECT.md` — v1.1 milestone definition
- CLAUDE.md — system architecture, existing API contracts, WebSocket event catalog

---
*Feature research for: Autonomous agent execution loop (Hatchin v1.1)*
*Researched: 2026-03-19*
