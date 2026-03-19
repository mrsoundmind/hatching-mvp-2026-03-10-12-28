# Architecture Research

**Domain:** Autonomous agent execution loop — background task execution, agent-to-agent handoffs, risk-based autonomy, self-policing peer review, chat summary briefings
**Researched:** 2026-03-19
**Confidence:** HIGH (based on direct codebase inspection)

---

## Standard Architecture

### System Overview

The existing system has two distinct execution contexts: synchronous (user-triggered, WebSocket-driven) and asynchronous (background, cron-driven). The v1.1 autonomous execution loop bridges these by adding a third context: agent-triggered execution that runs either in-process or as a deferred pipeline.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                                       │
│  ┌───────────────┐  ┌────────────────────┐  ┌──────────────────────────┐   │
│  │  CenterPanel  │  │  TaskManager UI    │  │  Summary Briefing UI     │   │
│  │  (chat input) │  │  (task approvals)  │  │  (on user return)        │   │
│  └──────┬────────┘  └─────────┬──────────┘  └────────────┬─────────────┘   │
│         │  WebSocket          │  REST                      │  WebSocket      │
├─────────┴─────────────────────┴────────────────────────────┴─────────────────┤
│                          WEBSOCKET / HTTP LAYER                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │  server/routes/chat.ts  (WS handler + streaming)                       │  │
│  │  server/routes/tasks.ts  (REST task CRUD + approval endpoints)         │  │
│  └──────────────────────────┬─────────────────────────────────────────────┘  │
├──────────────────────────────┴──────────────────────────────────────────────┤
│                        SYNCHRONOUS AI PIPELINE                               │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  ┌──────────────┐  │
│  │  conductor   │  │  safety.ts   │  │  graph.ts      │  │  peerReview  │  │
│  │  (routing)   │  │  (risk score)│  │  (LangGraph SM)│  │  Runner      │  │
│  └──────┬───────┘  └──────┬───────┘  └───────┬────────┘  └──────┬───────┘  │
│         └─────────────────┴──────────────────┴───────────────────┘          │
├────────────────────────────────────────────────────────────────────────────┤
│                    AUTONOMOUS EXECUTION LAYER  [v1.1 NEW]                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌───────────────────────────┐  │
│  │  HandoffOrch-   │  │  TaskExecution  │  │  SummaryBriefingBuilder   │  │
│  │  estrator       │  │  Pipeline       │  │                           │  │
│  │  [NEW]          │  │  [NEW + extends │  │  [NEW]                    │  │
│  │                 │  │  taskGraphEngine│  │                           │  │
│  └────────┬────────┘  └────────┬────────┘  └──────────────┬────────────┘  │
│           └───────────────────┴──────────────────────────┘                 │
├────────────────────────────────────────────────────────────────────────────┤
│                        BACKGROUND RUNNER LAYER                               │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │  backgroundRunner.ts  (cron: health 2h, world sensor 6h)               │  │
│  │  ← already wired: storage, broadcastToConversation, generateText       │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
├────────────────────────────────────────────────────────────────────────────┤
│                         PERSISTENCE LAYER                                    │
│  ┌──────────────┐  ┌────────────────────┐  ┌─────────────────────────────┐  │
│  │  tasks table │  │  autonomy_events   │  │  deliberation_traces        │  │
│  │  (status,    │  │  (audit trail)     │  │  (UNIQUE trace_id)          │  │
│  │  assignee)   │  │                    │  │                             │  │
│  └──────────────┘  └────────────────────┘  └─────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities (Existing — Confirmed by Codebase)

| Component | File | Responsibility | v1.1 Changes |
|-----------|------|----------------|--------------|
| LangGraph State Machine | `server/ai/graph.ts` | `router_node → hatch_node → consent` sequence; in-memory MemorySaver per threadId | Extend with `handoff_node` for cross-agent transitions |
| Conductor | `server/ai/conductor.ts` | Resolves which agent responds; routes via intent_specialist or addressed_agent | Add autonomous mode: triggered without user message |
| Safety Gate | `server/ai/safety.ts` | Scores risk 0.0–1.0; thresholds: peer_review at 0.35, clarification at 0.70 | Extend `evaluateSafetyScore` to score autonomous task output |
| Peer Review Runner | `server/autonomy/peerReview/peerReviewRunner.ts` | Evaluates draft response via rubric; produces `PeerReviewDecision` | Reuse as-is for autonomous output gating |
| Decision Authority | `server/autonomy/conductor/decisionAuthority.ts` | Resolves conflicts between Hatch candidates by authority level (worker/reviewer/conductor/guardrail) | Reuse as-is for handoff arbitration |
| Escalation Ladder | `server/autonomy/conductor/escalationLadder.ts` | Routes to single_hatch / peer_review / deliberation / task_graph based on complexity and risk | Extend to add `autonomous_handoff` level |
| Task Graph Engine | `server/autonomy/taskGraph/taskGraphEngine.ts` | Creates dependency graphs with ownerRole per node; `markTaskStatus` for transitions | Extend: persist graph to DB, add `executeNode` method |
| Background Runner | `server/autonomy/background/backgroundRunner.ts` | Cron: health checks every 2h, world sensor every 6h; already has `storage`, `broadcastToConversation`, `generateText` injected | Add task execution cron job (every 15–30 min) |
| Project Health Scorer | `server/autonomy/background/projectHealthScorer.ts` | Friction signals: blocked_tasks, stale_tasks, conversation_gap, team_imbalance | Add signal: `tasks_ready_for_autonomous_pickup` |
| Friction Map | `server/autonomy/background/frictionMap.ts` | Selects one `FrictionAction` per cycle; quiet hours guardrail; 24h per-agent rate limit | Add `autonomous_execution` friction type |
| Proactive Outreach | `server/autonomy/background/proactiveOutreach.ts` | Generates and broadcasts in-character messages; writes to messages table | Parallel: `AutonomousTaskOutput` writer for completed work |
| Policies Config | `server/autonomy/config/policies.ts` | `BUDGETS`, `DELIBERATION_GATES`, `FEATURE_FLAGS` (env-driven) | Add `FEATURE_FLAGS.backgroundExecution`; `BUDGETS.maxConcurrentAutonomousTasks` |
| Event Logger | `server/autonomy/events/eventLogger.ts` | Writes to `autonomy_events` table (or file fallback); deduplicates by requestId | Already handles task event types: task_assigned, task_completed, task_failed, task_retried |

---

## Component Analysis: New vs. Modified

### NEW Components Required

#### 1. HandoffOrchestrator (`server/autonomy/handoff/handoffOrchestrator.ts`)

**Purpose:** Coordinates the PM → Engineer → Designer chain. Determines when a task is ready for handoff, identifies the next agent, and queues the transition.

**What it does:**
- Reads a task's current `status` and `assignee` from the tasks table
- Checks if the current agent has produced output (via its last message in the conversation)
- Uses `taskGraphEngine` to find the next node with satisfied dependencies
- Calls `conductor.evaluateConductorDecision` in autonomous mode (no user message — uses task context instead)
- Emits `task_handoff` autonomy event
- Broadcasts `agent_handoff` WS event to notify connected clients

**Integration point:** Called by the background runner's new execution cycle, NOT by the WS handler.

```typescript
// Signature (new file)
export async function executeHandoff(input: {
  taskId: string;
  fromAgentId: string;
  projectId: string;
  output: string;           // output produced by the from-agent
  storage: IStorage;
  broadcastToConversation: BroadcastFn;
  generateText: GenerateTextFn;
}): Promise<HandoffResult>
```

#### 2. TaskExecutionPipeline (`server/autonomy/execution/taskExecutionPipeline.ts`)

**Purpose:** Drives a single task through autonomous execution: pick it up, call the right Hatch, gate via safety + peer review, write output, hand off.

**What it does:**
- Fetches the task and assigned agent from storage
- Builds a task-specific system prompt (project Brain + task description + agent role/personality)
- Calls `generateText` to produce task output
- Runs `evaluateSafetyScore` on the output
- If risk >= 0.35: runs `runPeerReview` before storing
- If risk >= 0.70: surfaces task for human approval (sets status to `blocked`, emits `task_requires_approval` WS event)
- If approved (risk < 0.35): stores output as an agent message, updates task status to `completed`
- Logs every step to `autonomy_events`

**Integration point:** Called from HandoffOrchestrator and from the background execution cron job.

```typescript
export async function executeTask(input: {
  task: Task;
  agent: Agent;
  project: Project;
  storage: IStorage;
  broadcastToConversation: BroadcastFn;
  generateText: GenerateTextFn;
}): Promise<TaskExecutionResult>
```

#### 3. SummaryBriefingBuilder (`server/autonomy/summaries/summaryBriefingBuilder.ts`)

**Purpose:** Generates a conversational summary of autonomous work done since the user was last active. Delivered as a Maya message when the user opens the project.

**What it does:**
- Queries `autonomy_events` for events since `lastUserActivityAt`
- Queries tasks updated since `lastUserActivityAt`
- Prompts Maya (the special agent) to write a natural-language briefing in her voice
- Stores as a Maya message in the project conversation
- Sets a `isBriefing: true` flag in message metadata so the frontend can style it distinctly

**Integration point:** Triggered from the chat WebSocket handler on `join_conversation` when the user returns (checks if unread autonomous events exist).

```typescript
export async function buildSummaryBriefing(input: {
  projectId: string;
  lastUserActivityAt: Date;
  mayaAgentId: string;
  storage: IStorage;
  generateText: GenerateTextFn;
}): Promise<{ messageId: string; content: string } | null>
```

#### 4. AutonomyTriggerResolver (`server/autonomy/triggers/autonomyTriggerResolver.ts`)

**Purpose:** Decides whether autonomous execution should start for a given task/project. Two triggers: explicit user command ("go ahead and work on this") or inactivity threshold.

**What it does:**
- Explicit trigger: parses incoming user message for trigger phrases ("go ahead", "work on this", "take it from here")
- Inactivity trigger: checks minutes since last user activity vs `INACTIVITY_THRESHOLD_MINUTES` (default 60)
- Returns `{shouldExecute: boolean, reason: 'explicit' | 'inactivity' | 'none', tasksToExecute: string[]}`

**Integration point:** Called from the WS `send_message_streaming` handler (explicit trigger) and from the background runner cron (inactivity trigger).

```typescript
export function resolveAutonomyTrigger(input: {
  userMessage?: string;
  lastUserActivityAt: Date | null;
  pendingTasks: Task[];
  autonomyEnabled: boolean;
}): AutonomyTriggerDecision
```

### MODIFIED Existing Components

#### 1. `server/autonomy/background/backgroundRunner.ts`

**Current state:** Two cron jobs: health check (2h) and world sensor (6h). No task execution.

**Change:** Add a third cron job for autonomous task execution (every 15 minutes). The new cron calls a new `runAutonomousExecutionCycle()` function that:
1. Fetches projects with `BACKGROUND_AUTONOMY_ENABLED` or where inactivity trigger fires
2. For each: calls `AutonomyTriggerResolver` with inactivity check
3. For triggered projects: calls `HandoffOrchestrator` to find ready tasks
4. Executes up to `BUDGETS.maxConcurrentAutonomousTasks` tasks per cycle

**What stays the same:** The existing `start(deps)` signature is preserved. The new cron is registered alongside the existing two. The `_storage`, `_broadcastToConversation`, `_generateText` injection pattern is reused.

#### 2. `server/autonomy/taskGraph/taskGraphEngine.ts`

**Current state:** Pure in-memory; `createTaskGraph()` and `markTaskStatus()` return modified graph objects but nothing is persisted.

**Change:** Add `persistTaskGraph(graphId, graph, projectId, storage)` and `loadTaskGraph(projectId, storage)` to read/write the graph to the project's brain JSONB or a new task_graphs table. The existing pure functions are preserved — the persistence layer wraps them.

**What stays the same:** `createTaskGraph`, `markTaskStatus`, `TaskGraphNode`, `TaskGraph` types are unchanged.

#### 3. `server/ai/safety.ts`

**Current state:** `evaluateSafetyScore` takes `{userMessage, draftResponse, conversationMode, projectName}`. Only designed for synchronous chat.

**Change:** Add an optional `executionContext?: 'chat' | 'autonomous_task'` parameter. When `executionContext === 'autonomous_task'`, apply stricter thresholds (lower clarification threshold: 0.60 instead of 0.70) since there is no user present to catch mistakes in real-time.

**What stays the same:** All existing thresholds, patterns, and behavior for `executionContext === 'chat'` are identical.

#### 4. `server/routes/chat.ts` (WS handler)

**Current state:** On `send_message_streaming`, runs the synchronous AI pipeline. Does not check for trigger phrases.

**Change:** After the normal streaming response is sent, check if the message contains an explicit autonomy trigger. If yes, call `AutonomyTriggerResolver.resolveAutonomyTrigger` and queue appropriate tasks for background execution. Also: on `join_conversation`, check if a summary briefing should be delivered (calls `SummaryBriefingBuilder`).

**What stays the same:** The entire existing streaming path is untouched. The trigger check is a post-processing step that fires after `streaming_completed` is emitted.

#### 5. `server/routes/tasks.ts`

**Current state:** REST CRUD for tasks. No approval flow.

**Change:** Add `POST /api/tasks/:id/approve` and `POST /api/tasks/:id/reject` endpoints. These change task status from `blocked` (awaiting approval) to `in_progress` (approved) or `cancelled` (rejected), and broadcast a `task_approval_resolved` WS event.

**What stays the same:** All existing task CRUD endpoints are identical.

---

## Recommended Project Structure

New files in context of the existing tree:

```
server/autonomy/
├── background/
│   ├── backgroundRunner.ts      [MODIFIED — add execution cron]
│   ├── frictionMap.ts           [MODIFIED — add autonomous_execution friction type]
│   ├── projectHealthScorer.ts   [MODIFIED — add tasks_ready_for_autonomous_pickup signal]
│   ├── proactiveOutreach.ts     [UNCHANGED]
│   └── worldSensor.ts           [UNCHANGED]
├── conductor/
│   ├── decisionAuthority.ts     [UNCHANGED]
│   └── escalationLadder.ts      [MODIFIED — add autonomous_handoff level]
├── config/
│   └── policies.ts              [MODIFIED — add backgroundExecution flag, maxConcurrentAutonomousTasks]
├── events/
│   └── eventLogger.ts           [UNCHANGED — already has task event types]
├── execution/                   [NEW DIRECTORY]
│   └── taskExecutionPipeline.ts [NEW]
├── handoff/                     [NEW DIRECTORY]
│   └── handoffOrchestrator.ts   [NEW]
├── integrity/                   [UNCHANGED]
├── peerReview/                  [UNCHANGED]
├── summaries/                   [NEW DIRECTORY]
│   └── summaryBriefingBuilder.ts [NEW]
├── taskGraph/
│   ├── taskGraphEngine.ts       [MODIFIED — add persistence wrappers]
│   └── taskGraphPersistence.ts  [NEW — keep pure/persistence separated]
├── traces/                      [UNCHANGED]
└── triggers/                    [NEW DIRECTORY]
    └── autonomyTriggerResolver.ts [NEW]
```

### Structure Rationale

- **`execution/`:** Separated from `background/` because it contains the hot-path logic (called from cron AND from explicit triggers). Keeping it isolated means it can be unit tested without the cron wrapper.
- **`handoff/`:** Separated from `conductor/` because conductor is synchronous routing logic. Handoff is stateful, asynchronous, and involves DB reads/writes — a different concern.
- **`summaries/`:** Isolated because summary generation is a pure output concern with no dependencies on the execution pipeline. Can be added/changed without touching any execution logic.
- **`triggers/`:** Isolated because trigger logic must be callable from both the WS handler AND the background runner. It has no LLM calls — pure decision logic, easy to test.
- **`taskGraph/taskGraphPersistence.ts`:** Keeps the pure `taskGraphEngine.ts` functions pure and testable without DB mocking. The persistence wrapper is the only place storage is touched.

---

## Architectural Patterns

### Pattern 1: Dependency Injection via `deps` Parameter

**What:** All new modules accept a typed `deps` object containing `storage`, `broadcastToConversation`, and `generateText` rather than importing them directly.

**When to use:** All new autonomous execution modules. This is already established by `backgroundRunner.ts` and `proactiveOutreach.ts` — follow it consistently.

**Trade-offs:** Slight verbosity, but enables clean unit testing without mocking module imports. Critical for the execution pipeline which touches storage, LLM calls, and WS broadcast in one function.

```typescript
// Pattern established in proactiveOutreach.ts — extend consistently
interface ExecutionDeps {
  storage: IStorage;
  broadcastToConversation: (convId: string, payload: unknown) => void;
  generateText: (prompt: string, system: string, maxTokens?: number) => Promise<string>;
}

export async function executeTask(task: Task, deps: ExecutionDeps): Promise<void> { ... }
```

### Pattern 2: Risk-Gated Execution with Fallback to Human Approval

**What:** Every autonomous output passes through `evaluateSafetyScore`. Based on the score:
- `< 0.35`: auto-approve, store output directly
- `0.35–0.69`: run `runPeerReview`, then store revised output
- `>= 0.70`: set task status to `blocked`, emit `task_requires_approval` WS event, surface in TaskApprovalModal

**When to use:** Any time an autonomous agent produces an artifact that will be stored or broadcast to the user.

**Trade-offs:** The `>= 0.70` path introduces latency (task pauses until user approves). This is correct behavior — high-risk outputs should not auto-execute. The existing peer review infrastructure handles the 0.35–0.70 band without any new code.

```typescript
// In taskExecutionPipeline.ts
const safetyScore = evaluateSafetyScore({
  userMessage: task.description ?? '',
  draftResponse: output,
  conversationMode: 'project',
  projectName: project.name,
  executionContext: 'autonomous_task',  // [new param — stricter thresholds]
});

if (safetyScore.overall >= 0.70) {
  await storage.updateTask(task.id, { status: 'blocked', metadata: { awaitingApproval: true, draftOutput: output } });
  broadcastToConversation(convId, { type: 'task_requires_approval', taskId: task.id });
  return;
}

if (safetyScore.overall >= 0.35) {
  const review = await runPeerReview({ ... });
  output = review.revisedContent;
}

// Store and broadcast
```

### Pattern 3: Single-Action-Per-Cycle Guardrail

**What:** The background runner executes at most `BUDGETS.maxConcurrentAutonomousTasks` tasks per cycle, and `selectFrictionAction` already enforces one proactive message per cycle. Both use the same defensive pattern: cap the batch size, log what was skipped.

**When to use:** All background execution cycles. This prevents the system from flooding the user with autonomous activity during a single cron tick.

**Trade-offs:** Tasks can queue up if volume is high. This is correct for MVP — the priority is predictability over throughput.

### Pattern 4: Feature Flag All Autonomous Execution Paths

**What:** Every new autonomous code path checks `FEATURE_FLAGS.backgroundExecution` (new) before executing. Existing flags: `peerPolicing`, `taskGraph`, `toolRouter`, `autonomyDashboard` are all already env-driven.

**When to use:** Wrap the execution cron job registration, the trigger resolver, and the summary briefing check behind this flag.

**Trade-offs:** Adds one conditional per entry point. Worth it: lets the team deploy the code without enabling the feature, then turn it on via env var.

---

## Data Flow

### Autonomous Task Execution Flow

```
User says "go ahead and work on this"
    ↓
WS handler (chat.ts): send_message_streaming received
    ↓
Normal streaming response sent (UNCHANGED)
    ↓
Post-processing: AutonomyTriggerResolver.resolveAutonomyTrigger()
    ↓ trigger = explicit
TaskExecutionPipeline: fetch task + agent + project
    ↓
Build prompt (project Brain + task description + agent personality)
    ↓
generateText() → draft output
    ↓
evaluateSafetyScore(output, executionContext: 'autonomous_task')
    ↓ risk < 0.35          ↓ risk 0.35–0.69        ↓ risk >= 0.70
Store output           runPeerReview()            Block + emit
as agent message       → revised output           task_requires_approval
    ↓                  → store revised
updateTask(completed)
    ↓
broadcastToConversation(task_completed)
    ↓
logAutonomyEvent(task_completed)
    ↓
HandoffOrchestrator: find next ready task in graph
    ↓
Queue next task execution (recursive or next cron tick)
```

### User Return + Summary Briefing Flow

```
User opens project (join_conversation WS event)
    ↓
chat.ts: check lastUserActivityAt vs now
    ↓ > 30 minutes AND autonomous events exist
SummaryBriefingBuilder: query autonomy_events since lastUserActivityAt
    ↓
Query tasks updated since lastUserActivityAt
    ↓
Build Maya briefing prompt (what happened, what was completed, what needs approval)
    ↓
generateText() → conversational summary in Maya's voice
    ↓
createMessage() → stored as Maya agent message with metadata.isBriefing=true
    ↓
broadcastToConversation(new_message) → CenterPanel renders briefing
```

### Background Execution Cron Flow

```
backgroundRunner cron (every 15 min)
    ↓
getProjects() → slice to MAX_PROJECTS_PER_CYCLE
    ↓ for each project
AutonomyTriggerResolver: inactivity check
    ↓ trigger = inactivity (user inactive > INACTIVITY_THRESHOLD_MINUTES)
getTasksByProject() → filter: status=todo, assignee set, dependencies met
    ↓
For each ready task (up to maxConcurrentAutonomousTasks):
    TaskExecutionPipeline.executeTask()
    ↓
logAutonomyEvent(task_assigned)
    ↓
[same execution flow as explicit trigger above]
```

### Agent-to-Agent Handoff Flow

```
TaskExecutionPipeline: task_completed
    ↓
HandoffOrchestrator.executeHandoff()
    ↓
taskGraphEngine.loadTaskGraph(projectId) → find next node
    ↓
Check node.dependencies → all satisfied?
    ↓ yes
conductor.evaluateConductorDecision() in autonomous mode
    → finds best agent for next node's ownerRole
    ↓
updateTask(next_task, { status: 'in_progress', assignee: nextAgentId })
    ↓
broadcastToConversation({ type: 'agent_handoff', fromAgent, toAgent, taskId })
    ↓
logAutonomyEvent(task_assigned)
    ↓
Queue next task execution
```

---

## Integration Points

### LangGraph State Machine (`server/ai/graph.ts`)

**Current:** `START → router_node → hatch_node → consent → END`. Uses `MemorySaver` with `thread_id` for per-conversation memory.

**v1.1 Integration:** The LangGraph state machine is NOT called by the autonomous execution pipeline directly. The pipeline uses `generateText` (the lower-level LLM call) rather than `runTurn`. This is intentional:
- `runTurn` requires a WebSocket context (streaming chunks, conversation history)
- Autonomous task execution is a one-shot generation, not a conversational turn
- Using `generateText` directly avoids threading/session complexity

A new `handoff_node` is only needed IF future work requires the LangGraph's consent/deliberation flow for handoffs. For v1.1, handoffs are orchestrated outside the graph.

**Confidence:** HIGH (confirmed by reading graph.ts and backgroundRunner.ts — they use different code paths)

### Conductor (`server/ai/conductor.ts`)

**Current:** `evaluateConductorDecision` resolves which agent responds to a user message.

**v1.1 Integration:** HandoffOrchestrator calls `evaluateConductorDecision` with a synthetic "message" derived from the task description (not a real user message). The `addressedAgentId` is omitted, allowing the conductor's intent-matching to find the best agent for the next task's `ownerRole`.

**Confidence:** HIGH — the function signature accepts any string as `userMessage`, not a WebSocket-specific type.

### Safety Gate (`server/ai/safety.ts`)

**v1.1 Integration:** `evaluateSafetyScore` is called in `TaskExecutionPipeline` with the new optional `executionContext: 'autonomous_task'` parameter. The only behavior change: the clarification threshold drops from 0.70 to 0.60 for autonomous context. All existing thresholds for chat context are identical.

### Peer Review (`server/autonomy/peerReview/peerReviewRunner.ts`)

**v1.1 Integration:** `runPeerReview` is called from `TaskExecutionPipeline` when safety score is in the 0.35–0.69 band. The function signature already accepts `projectId`, `conversationId`, `draftResponse` — exactly what the execution pipeline has. No changes to `peerReviewRunner.ts`.

### WebSocket Broadcast

**Current:** `broadcastToConversation(convId, payload)` is injected into backgroundRunner, proactiveOutreach, and all route modules.

**v1.1 New WS Events Required:**

| Event Type | Emitter | Frontend Handler |
|------------|---------|-----------------|
| `task_requires_approval` | TaskExecutionPipeline | TaskApprovalModal (existing) |
| `task_execution_started` | TaskExecutionPipeline | TaskManager (new status indicator) |
| `task_execution_completed` | TaskExecutionPipeline | TaskManager (update status) |
| `agent_handoff` | HandoffOrchestrator | CenterPanel (new handoff message) |
| `summary_briefing_ready` | SummaryBriefingBuilder | CenterPanel (trigger briefing render) |

All existing WS infrastructure handles these without changes — they follow the same `{ type, conversationId, ... }` shape.

### Database Schema

**No new tables required for v1.1.** All persistence uses existing tables:

| Data | Table | Mechanism |
|------|-------|-----------|
| Task execution output | `messages` (agent message, metadata.isAutonomous=true) | Existing `createMessage` |
| Task graph state | `projects.brain` JSONB or `tasks.metadata` JSONB | Existing update methods |
| Approval state | `tasks.status = 'blocked'` + `tasks.metadata.awaitingApproval` | Existing `updateTask` |
| Autonomy events | `autonomy_events` | Existing `logAutonomyEvent` |
| Summary briefing | `messages` (Maya agent message, metadata.isBriefing=true) | Existing `createMessage` |

The `deliberation_traces` table is already used by peer review — no changes needed.

---

## Build Order (Dependency-Based)

Dependencies flow upward — each layer can only be built after the layer below it is working.

### Layer 0: Foundation (no dependencies on new code)
1. **`AutonomyTriggerResolver`** — pure functions, no DB, no LLM. Easiest to build and test first.
2. **`policies.ts` additions** — add `backgroundExecution` feature flag and `maxConcurrentAutonomousTasks` budget.
3. **`safety.ts` extension** — add `executionContext` parameter with backward-compatible default.
4. **`taskGraphPersistence.ts`** — add persistence wrappers around existing pure functions.

### Layer 1: Core Execution (depends on Layer 0)
5. **`TaskExecutionPipeline`** — depends on: safety, peer review (existing), storage, generateText, logAutonomyEvent (all existing). Uses AutonomyTriggerResolver result as input.
6. **`SummaryBriefingBuilder`** — depends on: storage, generateText, logAutonomyEvent. Pure generation concern, no handoff dependency.

### Layer 2: Orchestration (depends on Layer 1)
7. **`HandoffOrchestrator`** — depends on: TaskExecutionPipeline, taskGraphEngine, conductor (existing). Cannot be built until TaskExecutionPipeline works.
8. **`backgroundRunner.ts` execution cron** — depends on: HandoffOrchestrator, AutonomyTriggerResolver, FEATURE_FLAGS.backgroundExecution. Add the new cron job here.

### Layer 3: Surface (depends on Layer 1 + 2)
9. **`chat.ts` WS handler extensions** — trigger check after streaming, summary briefing on join_conversation.
10. **`tasks.ts` approval endpoints** — `POST /api/tasks/:id/approve` and `/reject`.
11. **Frontend: TaskApprovalModal + task_requires_approval handler** — depends on backend approval endpoints.
12. **Frontend: summary briefing render** — depends on `summary_briefing_ready` WS event.

---

## Anti-Patterns

### Anti-Pattern 1: Calling `runTurn` from Background Execution

**What people do:** Route background task execution through the LangGraph `runTurn` / `graph.invoke` function since that's how chat works.

**Why it's wrong:** `runTurn` uses `MemorySaver` keyed by `thread_id` (conversation ID). Background execution happens outside any active conversation thread. This would corrupt the in-memory conversation state, cause wrong message history to be injected into prompts, and mix synchronous streaming infrastructure with a fire-and-forget execution context.

**Do this instead:** Call `generateText` directly from TaskExecutionPipeline, constructing the prompt from `promptTemplate.ts` building blocks rather than piping through the graph.

### Anti-Pattern 2: Autonomous Agent Writing to User's Active Conversation Mid-Stream

**What people do:** Have background execution write task output messages to a conversation while the user is actively chatting in it, causing message interleaving.

**Why it's wrong:** Two writers to the same conversation simultaneously creates ordering violations and confuses the user. The `integrity/` module's idempotency system cannot prevent ordering issues from concurrent writers.

**Do this instead:** Background execution writes to the conversation only after acquiring a per-conversation execution lock (simple: check if `typing_indicators` table has active indicators for the conversation before writing). If the user is active, defer the write to the next cron cycle.

### Anti-Pattern 3: Rebuilding Task Graph from Scratch Each Cron Tick

**What people do:** Re-run `createTaskGraph` for a project on every execution cycle to find the next ready task.

**Why it's wrong:** `createTaskGraph` is designed for initial graph creation from an objective — it doesn't know about tasks already completed or in-progress. Re-running it discards all state transitions.

**Do this instead:** Persist the graph after creation (via `taskGraphPersistence.ts`). Load it on each cycle, call `markTaskStatus` to reflect DB state, then find ready nodes.

### Anti-Pattern 4: Silently Executing High-Risk Tasks Without Surfacing to User

**What people do:** Apply the chat safety threshold (0.70) to autonomous tasks because it's already there.

**Why it's wrong:** In chat, the user is present and can immediately correct a bad response. In autonomous mode, a bad output gets stored, acted upon, and possibly shown to the user hours later. The correction window is gone.

**Do this instead:** Use the stricter autonomous threshold (0.60) via the `executionContext: 'autonomous_task'` parameter in `evaluateSafetyScore`. Everything above 0.60 in autonomous mode routes to human approval.

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0–1k users | Single-node backgroundRunner with in-process cron is fine. MAX_PROJECTS_PER_CYCLE=50 prevents overload. |
| 1k–100k users | Extract background execution to a separate worker process or job queue (BullMQ + Redis). BackgroundRunner becomes a job dispatcher, not executor. |
| 100k+ users | Per-project execution queues with priority. Dedicated execution worker pool. This is not an MVP concern. |

### Scaling Priorities

1. **First bottleneck (autonomous execution):** LLM API rate limits (Gemini 60 RPM). At scale, multiple concurrent task executions will exhaust the rate limit. Fix: per-project execution queue with rate-limit-aware scheduling. For now: `maxConcurrentAutonomousTasks=3` in BUDGETS.
2. **Second bottleneck:** DB writes during peer review (multiple `logAutonomyEvent` calls per execution). Fix: batch event writes. For now: acceptable at MVP scale.

---

## Sources

- Direct inspection of `server/autonomy/background/backgroundRunner.ts` (confirmed cron pattern, injected deps)
- Direct inspection of `server/autonomy/peerReview/peerReviewRunner.ts` (confirmed reusability for autonomous context)
- Direct inspection of `server/ai/graph.ts` (confirmed MemorySaver, router_node → hatch_node topology)
- Direct inspection of `server/ai/conductor.ts` (confirmed evaluateConductorDecision signature)
- Direct inspection of `server/ai/safety.ts` (confirmed threshold values and extensibility)
- Direct inspection of `server/autonomy/taskGraph/taskGraphEngine.ts` (confirmed in-memory only, no persistence)
- Direct inspection of `server/autonomy/conductor/escalationLadder.ts` (confirmed escalation levels)
- Direct inspection of `server/autonomy/conductor/decisionAuthority.ts` (confirmed authority levels)
- Direct inspection of `server/autonomy/config/policies.ts` (confirmed BUDGETS, FEATURE_FLAGS, DELIBERATION_GATES)
- Direct inspection of `server/autonomy/events/eventLogger.ts` (confirmed task event types already defined)
- Confidence: HIGH — all claims derive from current codebase, not training data assumptions

---
*Architecture research for: Hatchin v1.1 Autonomous Execution Loop*
*Researched: 2026-03-19*
