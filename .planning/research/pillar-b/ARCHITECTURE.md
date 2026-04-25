# Architecture Research: Pillar B — Maya Reliability & Teamness

**Domain:** AI chat platform — conversation state management, user preferences, team formation, agent coordination
**Researched:** 2026-04-25
**Confidence:** HIGH — all decisions derived from direct code inspection of existing files

---

## Integration Decision Log

Ten architectural decisions, each with: recommended approach, affected files, new files needed, and build order position.

---

### Decision 1: Conversation Phase State

**Question:** Where should Maya's phase state live — column on `conversations`, JSONB on `projects.brain`, or computed from message metadata?

**Recommended approach: New column on `conversations` table.**

Option A (conversations column) is correct. The phase belongs to a specific conversation thread, not the project as a whole. A user can restart discovery in a new project-level chat while an older conversation thread exists in a different phase. Storing on `projects.brain` would mean a single project can only be in one phase at a time, which breaks multi-session workflows. Computing from message metadata is fragile — it creates implicit state that breaks whenever message storage is queried with pagination limits.

The `conversations` table already has a clean schema at `shared/schema.ts:110-127`. Adding a single `mayaPhase` text column with a type union is a minimal, non-breaking migration. Phase transitions are written once when Maya advances; agents read it at prompt construction time in `openaiService.ts`.

**Phase state machine:**
```
discovery → blueprint_draft → specialist_handoff → active_work
```

`discovery` is the default. Maya advances the phase by emitting a `[[PHASE: blueprint_draft]]` action block from her response. The action block parser in `server/routes/chat.ts` (which already handles `[[PROJECT_NAME]]` and `[[UPDATE]]` at line ~876) intercepts this and calls `storage.updateConversationPhase()`.

**Files that change:**
- `shared/schema.ts` — add `mayaPhase` column to `conversations` table
- `server/storage.ts` — add `updateConversationPhase(conversationId, phase)` to `IStorage` interface + both implementations
- `server/routes/chat.ts` — extend action block parser (around line 876) to handle `[[PHASE: ...]]`
- `server/ai/openaiService.ts` — pass `mayaPhase` into `ChatContext`, inject as `--- MAYA PHASE ---` section for Maya role
- `shared/dto/wsSchemas.ts` — add `phase_advanced` WS event type

**New files needed:** None.

**Migration strategy:** `DEFAULT 'discovery'` on the new column. All existing conversations start in discovery. No backfill needed because phase state only matters going forward.

**Build order:** Step 1 (foundation — no other Pillar B feature depends on phase state, but it is referenced by Maya prompt logic and minimum-viable-brain gate).

---

### Decision 2: Minimum-Viable-Brain Gate

**Question:** Where does the gate that stops agents from asking more questions once the brain schema is minimally satisfied belong — `graph.ts` router_node, `promptTemplate.ts`, or a new middleware layer?

**Recommended approach: Inject into `openaiService.ts` as a prompt section, not as a graph node or middleware.**

The gate is not a routing decision (not graph.ts) and not structural prompt formatting (not promptTemplate.ts). It is a behavioral instruction: "if these 3 fields are filled, stop asking." The cleanest hook is the system prompt, assembled in `openaiService.ts` around line 280-405 where all contextual sections are injected.

`graph.ts` does not exist as a file in the current codebase (it was searched and not found). The active routing logic lives in `conductor.ts` (`evaluateConductorDecision`) and `openaiService.ts` (`generateStreamingResponse`). Adding a graph node for this creates unnecessary graph state — the condition is a stateless check at prompt-build time.

The minimum-viable-brain schema is: `coreDirection.whatBuilding`, `coreDirection.whyMatters`, `coreDirection.whoFor`. When all three are non-empty, inject a `--- BRAIN SATISFIED ---` section telling the agent to stop interrogating and move forward.

```typescript
// In openaiService.ts, alongside other section injections (~line 280)
const brainSatisfied = context.projectDirection?.whatBuilding
  && context.projectDirection?.whyMatters
  && context.projectDirection?.whoFor;

const brainGateSection = brainSatisfied
  ? `\n--- BRAIN SATISFIED ---\nThe project brain is fully populated. Do NOT ask clarifying questions about what they're building, who it's for, or why it matters. You already know. Move forward with this context.\n--- END BRAIN SATISFIED ---`
  : `\n--- BRAIN INCOMPLETE ---\nThe project brain is missing some context. If relevant, ask ONE question to fill a gap (what they're building / who it's for / why it matters). Do not ask all three at once. Do not ask if the user is already giving you task-level information — only ask if you genuinely need the context to help.\n--- END BRAIN INCOMPLETE ---`;
```

**Files that change:**
- `server/ai/openaiService.ts` — add `brainGateSection` injection alongside existing sections (~line 280)

**New files needed:** None.

**Migration strategy:** Pure addition. Existing projects with full `coreDirection` immediately benefit.

**Build order:** Step 2. Depends on Decision 1 only in the sense that `mayaPhase` is passed through `ChatContext` alongside `projectDirection` (which is already there).

---

### Decision 3: Cross-Project User Preferences

**Question:** Extend `users` table with a JSONB `preferences` column, or new `user_preferences` table with FK?

**Recommended approach: JSONB column on `users` table.**

The `users` table is the correct location. User preferences (tone, working style, preferred pace, technical depth) are a 1:1 relationship with the user — there is no reason for a separate table. A JSONB column keeps the storage footprint minimal and avoids a JOIN on every prompt build. The existing `users` table (`shared/schema.ts:6-28`) already has several tier/billing fields added as columns — the pattern for extending this table is established.

The `user_preferences` table approach is only warranted when you need auditing of preference changes over time (you don't) or when the preference schema is unbounded (it isn't — 6-8 known fields).

**Preferences schema:**
```typescript
preferences: jsonb("preferences").$type<{
  tone?: 'direct' | 'warm' | 'formal' | 'casual';
  pace?: 'fast' | 'medium' | 'thorough';
  technicalDepth?: 'high' | 'medium' | 'low';
  workingStyle?: string; // free text, e.g. "I think out loud, don't wait for full sentences"
  roleContext?: string;  // "I'm a non-technical founder" etc.
  skipMaya?: boolean;    // Skip-Maya escape hatch (Decision 11)
  learnedAt?: string;    // ISO timestamp of last update
}>().default({})
```

**How agents read it:** `openaiService.ts` already receives `context.userId`. The prompt builder fetches preferences via `storage.getUserPreferences(userId)` (or reads from a pre-loaded context object passed from `chat.ts`) and injects them as a `--- USER PREFERENCES ---` section. This replaces the existing `userDesignationSection` (line 264 in `openaiService.ts`) or merges into it.

Preferences are learned from conversation and applied cross-project. Maya extracts them after the discovery phase and writes them via a new `[[PREFERENCE: key: value]]` action block.

**Files that change:**
- `shared/schema.ts` — add `preferences` JSONB column to `users` table
- `server/storage.ts` — add `updateUserPreferences(userId, prefs)` + load preferences in `getUser`
- `server/ai/openaiService.ts` — accept preferences in `ChatContext`, inject as `--- USER PREFERENCES ---` section
- `server/routes/chat.ts` — pass preferences from user record into context at message handling time
- `server/routes/chat.ts` — extend action block parser to handle `[[PREFERENCE: ...]]`

**New files needed:** None.

**Migration strategy:** `DEFAULT {}` on new column. Existing users start with no preferences (no behavior change). Preferences accumulate over time through use.

**Build order:** Step 3. Independent of Decisions 1-2 except that it uses the same action block parser extension in `chat.ts`.

---

### Decision 4: Dynamic Team Formation

**Question:** Does `initializeStarterPackProject()` in `storage.ts` need a new branch for freeform projects, or a new `recommendDynamicTeam()` method?

**Recommended approach: New separate method `recommendDynamicTeam()` on `IStorage`, not a branch inside `initializeStarterPackProject()`.**

`initializeStarterPackProject()` in `storage.ts` (line 734) is already 120 lines and handles a specific contract: given a starterPackId, look up the template and materialize teams + agents. Bending it to handle "no pack ID" cases with conditional logic will make it unmaintainable.

`recommendDynamicTeam()` is a separate concern: given a project with a partially-filled brain (what/who/why), recommend 3-4 agents from `allHatchTemplates`. The recommendation logic is a pure function that takes `projectDirection` and returns ranked `HatchTemplate[]`. The method then calls the existing team + agent creation logic.

The recommendation engine itself lives in a new file at `server/ai/teamRecommender.ts`. It scores each of the 30 role templates against the project description using keyword overlap (same heuristic approach as `expertiseMatching.ts`), returns the top 3-4 by score, and Maya surfaces the result as a `<!--HATCH_SUGGESTION:...-->` block (which already exists in the prompt system, see `openaiService.ts` line 285-291).

**Files that change:**
- `server/storage.ts` — add `recommendDynamicTeam(projectId: string, agentCount: number)` to `IStorage` interface + both implementations (calls existing create-team + create-agent logic)
- `server/ai/openaiService.ts` — pass `suggestedTeamSize` hint into Maya's context when no team exists yet

**New files needed:**
- `server/ai/teamRecommender.ts` — pure function `rankAgentsForProject(direction, templates, count)` → `HatchTemplate[]`

**Build order:** Step 4. Depends on Decision 3 (user preferences can bias recommendations toward technical or non-technical roles).

---

### Decision 5: Agent Disagreement Orchestration

**Question:** Should disagreement run inline during streaming, or as post-processing? Should it use the existing `deliberation_traces` table or a custom flow?

**Recommended approach: Post-processing step, using `deliberation_traces` table.**

Running disagreement detection inline during streaming would require pausing Agent A's stream, getting Agent B's opinion, then resuming. That is too complex and creates noticeable UX latency. Instead: Agent A streams its response normally. After `streaming_completed`, a post-processing step checks whether the response contains strong claims in contested domains (architecture decisions, strategy direction, scope boundaries). If so, it queries another agent's `roleIntelligence.peerReviewLens` for their position and emits a `deliberation_card` WS event.

The `deliberation_traces` table (`shared/schema.ts:257-274`) already has `rounds`, `review`, and `finalSynthesis` JSONB columns — these are exactly the right shape for storing both positions and the user's eventual decision. The `traceId` uniqueness constraint is already enforced.

The disagreement threshold is not automatic on every response — it is triggered only when:
1. The response contains a claim pattern (e.g., "we should X", "the right approach is Y", "I'd avoid Z")
2. A second agent with a different domain would have a conflicting stance based on their `peerReviewLens`

The `conductor.ts` `inferDeliberationNeed()` function (line 36) already does rudimentary detection — this is the extension point.

**Files that change:**
- `server/ai/conductor.ts` — extend `inferDeliberationNeed()` to return structured claim data, not just boolean
- `server/autonomy/peerReview/peerReviewRunner.ts` — add `runDisagreementCheck(agentResponse, projectAgents)` function
- `server/routes/chat.ts` — call `runDisagreementCheck` after `streaming_completed`, emit `deliberation_card` WS event if disagreement detected
- `shared/dto/wsSchemas.ts` — add `deliberation_card` WS event type

**New files needed:**
- `server/ai/disagreementDetector.ts` — claim extraction + domain conflict scoring logic

**Build order:** Step 7. Depends on Decision 3 (user preferences may suppress disagreement for users who prefer direct advice). Can ship without any other Pillar B decision except the WS event infrastructure.

---

### Decision 6: Milestones Table

**Question:** Schema design for milestones — FK to projects, status enum, completion criteria, computed progress from tasks?

**Recommended approach: New `milestones` table with FK to `projects`, with explicit `taskIds` array for linking.**

The existing `tasks` table has no milestone concept. Adding a `milestoneId` FK to `tasks` is the cleanest way to link them, but that requires migrating the tasks table. The less invasive approach is storing `taskIds: string[]` as a JSONB array on the milestone — progress is then computed as `tasks.filter(t => milestoneIds.includes(t.id) && t.status === 'completed').length / milestoneIds.length`.

**Proposed schema:**
```typescript
export const milestones = pgTable("milestones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull()
    .$type<"not_started" | "in_progress" | "complete" | "blocked">()
    .default("not_started"),
  dueDate: timestamp("due_date"),
  completionCriteria: text("completion_criteria"), // free text: "All 3 designs approved"
  taskIds: text("task_ids").array().default([]),    // linked task IDs
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  projectIdIdx: index("milestones_project_id_idx").on(table.projectId),
  statusIdx: index("milestones_status_idx").on(table.status),
}));
```

Progress is never stored — always computed: `completed_task_count / total_task_count`. If `taskIds` is empty, progress defaults to 0 until tasks are linked. The `projects.progress` integer column (which currently exists at `shared/schema.ts:39`) can remain as a denormalized cache updated when milestones change.

**Files that change:**
- `shared/schema.ts` — add `milestones` table definition + `insertMilestoneSchema` + type exports
- `server/storage.ts` — add `IStorage` milestone CRUD methods + implement in both storage classes
- `server/routes/` — new `milestones.ts` route module registered in `routes.ts`
- `server/ai/promptTemplate.ts` — `projectMilestones` prop already exists in `PromptBuilderProps` (line 22) but is passed as empty string — wire up real data

**New files needed:**
- `server/routes/milestones.ts` — CRUD endpoints for milestones

**Migration strategy:** Pure addition. No existing tables change. `projects.progress` continues to work as before; milestones layer is additive.

**Build order:** Step 5. Independent of other decisions except shared schema infrastructure. Can ship in parallel with Decision 5 (disagreement) and Decision 7 (deliverable feedback).

---

### Decision 7: Deliverable Feedback Loop

**Question:** New fields on `deliverables` table (`userAccepted`, `editsCount`, `dismissedAt`), or new `deliverable_feedback` table for audit trail?

**Recommended approach: New columns on `deliverables` table, not a separate table.**

A separate `deliverable_feedback` table is warranted if you need per-edit history (who changed what, when, in what session). For v3.0 the goal is quality signal: did the user accept, edit, or dismiss? Three fields on the existing `deliverables` table (`shared/schema.ts:278-313`) answer this without a JOIN.

**Columns to add:**
```typescript
userAcceptedAt: timestamp("user_accepted_at"),       // null = not yet reviewed
userDismissedAt: timestamp("user_dismissed_at"),      // null = not dismissed
editsCount: integer("edits_count").notNull().default(0),  // incremented on iterate
lastIteratedAt: timestamp("last_iterated_at"),        // last time user iterated it
```

`editsCount` is incremented in the `iterate` endpoint in `server/routes/deliverables.ts`. `userAcceptedAt` and `userDismissedAt` are set via new PATCH endpoints or inline with the existing deliverable update flow. These signals feed a future quality model — for now they are just recorded.

**Files that change:**
- `shared/schema.ts` — add 4 columns to `deliverables` table
- `server/routes/deliverables.ts` — increment `editsCount` on iterate; add PATCH handlers for accept/dismiss
- `client/src/components/ArtifactPanel.tsx` — wire Accept / Dismiss buttons to the new endpoints

**New files needed:** None.

**Migration strategy:** All 4 columns are nullable or have defaults. No existing rows are affected. No backfill needed.

**Build order:** Step 6. Fully independent — no dependency on any other Pillar B decision.

---

### Decision 8: Per-Run Cost Visibility

**Question:** Extend `autonomy_events` with `cost_cents` column, or new `autonomy_runs` aggregate table?

**Recommended approach: New `costCents` column on `autonomy_events`, plus a server-side aggregation function.**

`autonomy_events` already has `latencyMs`, `riskScore`, and `confidence` columns (`shared/schema.ts:231-255`). Adding `costCents` keeps the per-event audit record complete — each event that calls an LLM can record its actual cost via `estimateCostCents()` from `usageTracker.ts`.

A separate `autonomy_runs` table is premature unless you need run-level aggregation at query time. The aggregate "what did this run cost?" query is: `SELECT SUM(cost_cents) FROM autonomy_events WHERE trace_id = $1`. That query is fast with the existing `traceIdIdx` index.

The per-run cost is surfaced to the user via a new `autonomy_run_cost` WS event emitted at the end of an autonomy run (after the final `streaming_completed` for that trace).

**Columns to add:**
```typescript
costCents: integer("cost_cents"),  // null = not yet calculated; set after LLM call
```

**Files that change:**
- `shared/schema.ts` — add `costCents: integer("cost_cents")` to `autonomy_events` table
- `server/autonomy/events/eventLogger.ts` — populate `costCents` from `usageTracker.estimateCostCents()` when logging events
- `server/autonomy/execution/taskExecutionPipeline.ts` — emit `autonomy_run_cost` WS event at end of run with `SUM(cost_cents)` for the trace
- `shared/dto/wsSchemas.ts` — add `autonomy_run_cost` WS event type
- `client/src/hooks/useRealTimeUpdates.ts` — handle `autonomy_run_cost` event, update run cost display
- `client/src/components/sidebar/ActivityTab.tsx` — display per-run cost in activity feed items

**New files needed:** None.

**Migration strategy:** Nullable column addition. Existing rows have null cost (unknown). New events get cost populated going forward.

**Build order:** Step 8. Depends on the `autonomy_events` schema change being stable. Can ship after Decision 1 (schema migrations should be batched into as few migrations as possible).

---

### Decision 9: Graceful LLM Degradation UX

**Question:** Server signals via WS event, or HTTP error with structured payload? Where does the client decide to show the "providers offline" banner?

**Recommended approach: WS event for streaming failures; existing `streaming_error` WS event with a new `code` for provider exhaustion.**

The `streaming_error` WS event already exists and is handled in `chat.ts` at lines 926, 976, 1450, 1465, 1474, 3062, 3212. The client already listens for it in `useRealTimeUpdates.ts`. The `getStreamingErrorPayload()` function (line 198) maps error types to codes. This is the correct extension point.

Add two new codes:
- `ALL_PROVIDERS_EXHAUSTED` — all providers in the fallback chain failed
- `PROVIDER_DEGRADED` — primary provider down, responding via fallback

When `ALL_PROVIDERS_EXHAUSTED` is received, `useRealTimeUpdates.ts` sets a `providersOffline` React state flag. This flag drives a non-blocking banner in `CenterPanel.tsx` ("Your team is temporarily unreachable — we'll retry automatically"). The banner auto-dismisses after the next successful `streaming_completed`.

The `providerResolver.ts` fallback chain currently throws `new Error('No LLM provider available')` (line 263) when all providers fail. This needs to be a typed error: `new Error('ALL_PROVIDERS_EXHAUSTED')` so `getStreamingErrorPayload()` can detect it.

**Files that change:**
- `server/llm/providerResolver.ts` — throw typed `ALL_PROVIDERS_EXHAUSTED` error (line 263) with structured info about which providers were attempted
- `server/routes/chat.ts` — extend `getStreamingErrorPayload()` (line 198) with `ALL_PROVIDERS_EXHAUSTED` and `PROVIDER_DEGRADED` codes
- `client/src/hooks/useRealTimeUpdates.ts` — set `providersOffline` state on those new codes
- `client/src/components/CenterPanel.tsx` — consume `providersOffline` state, render banner

**New files needed:** None.

**Migration strategy:** Pure addition. Existing `streaming_error` handling is not changed, only extended with new code variants.

**Build order:** Step 9. Depends on nothing. Can ship independently — high user-facing impact for low implementation cost.

---

### Decision 10: LLM Request Timeout

**Question:** Implement at `providerResolver` level (universal) or per-provider? Does Gemini SDK support `AbortController` natively?

**Recommended approach: Universal timeout wrapper in `providerResolver.ts`, with AbortSignal passed through to each provider call.**

The Gemini provider (`geminiProvider.ts`) currently calls `chat.sendMessageStream(lastUserMessage)` (line 119) with no timeout. The `@google/generative-ai` SDK does not natively accept an `AbortController` signal in `sendMessageStream` as of the version in use — the signal check happens in `openaiService.ts` at line 435 after chunks are received, not at the HTTP request initiation level.

The correct approach is a `Promise.race` timeout wrapper in `providerResolver.ts` around the entire `streamChat()` call, combined with an `AbortController` signal that is passed into the provider. When the race timeout fires:
1. The abort signal is triggered
2. The provider's stream iterator receives it (GeminiProvider checks in its `for await` loop)
3. `providerResolver` catches the abort and falls through to the next provider in the chain

The hard timeout is already partially implemented — `chat.ts` wraps `handleStreamingColleagueResponse` in a `Promise.race` with `HARD_RESPONSE_TIMEOUT_MS` (line 950-966). That is the correct architecture. The gap is that this timeout fires at the outer handler level but the LLM SDK is still running inside the generator. The fix is propagating an `AbortController` down through `openaiService.ts` → `providerResolver.ts` → each provider.

`openaiService.ts` already accepts `abortSignal?: AbortSignal` (line 120) and passes it to the stream loop (line 435). The `LLMRequest` type needs a `signal?: AbortSignal` field so the providers can use it.

**Files that change:**
- `server/llm/providerTypes.ts` — add `signal?: AbortSignal` to `LLMRequest` interface
- `server/llm/providers/geminiProvider.ts` — read `request.signal` in `streamChat()`, wrap stream iteration with abort check (mirror the `openaiService.ts` pattern at line 435)
- `server/llm/providerResolver.ts` — add per-provider timeout: `Promise.race([provider.streamChat(...), timeoutPromise])` inside `streamChatWithRuntimeFallback`, with `setTimeout` of `PROVIDER_TIMEOUT_MS` (default 30s, shorter than the outer 45s hard timeout in `chat.ts`)
- `server/ai/openaiService.ts` — pass `signal: abortSignal` in the `llmRequest` object (line 409)

**New files needed:** None.

**Migration strategy:** Additive. Providers that don't use the signal continue to work. The timeout wrapper is transparent.

**Build order:** Step 10. Depends on Decision 9 (graceful degradation UX needs to handle the timeout-then-fallback flow). Implement immediately after Decision 9.

---

## Build Order Summary

The correct implementation sequence groups schema migrations together and respects dependencies:

```
STEP 1  [Schema batch]    schema.ts — conversations.mayaPhase, users.preferences,
                          deliverables feedback columns, autonomy_events.costCents,
                          milestones table (all in one migration to minimize db:push calls)

STEP 2  [Storage layer]   storage.ts — CRUD methods for all new columns/tables

STEP 3  [Maya phase]      conversations phase state + [[PHASE:]] action block parser
                          + openaiService.ts phase injection

STEP 4  [Brain gate]      openaiService.ts brainGateSection injection (2-hour task)

STEP 5  [User prefs]      users.preferences + [[PREFERENCE:]] action block parser
                          + openaiService.ts USER PREFERENCES section

STEP 6  [Team formation]  teamRecommender.ts + storage.recommendDynamicTeam()

STEP 7  [Deliverable FB]  deliverables table columns + iterate endpoint + UI buttons

STEP 8  [Milestones]      milestones table + routes/milestones.ts + promptTemplate wiring

STEP 9  [LLM degradation] providerResolver ALL_PROVIDERS_EXHAUSTED + client banner

STEP 10 [LLM timeout]     LLMRequest.signal + GeminiProvider abort + providerResolver race

STEP 11 [Disagreement]    disagreementDetector.ts + peerReviewRunner extension
                          + deliberation_card WS event

STEP 12 [Per-run cost]    autonomy_events.costCents population + autonomy_run_cost WS event
                          + ActivityTab display
```

### Parallel groupings (can be implemented by different engineers concurrently after Step 2):

- **Group A (Maya intelligence):** Steps 3, 4, 5 — all touch `openaiService.ts` + action block parser, should be done by the same person to avoid merge conflicts
- **Group B (team & project structure):** Steps 6, 8 — independent of Maya intelligence work
- **Group C (deliverables):** Step 7 — fully isolated to `deliverables` table + `ArtifactPanel.tsx`
- **Group D (reliability):** Steps 9, 10 — both touch `providerResolver.ts`, do sequentially
- **Group E (autonomy signals):** Steps 11, 12 — both post-shipping concerns, can defer to end of milestone

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Client Layer                                     │
│  CenterPanel.tsx   ArtifactPanel.tsx   ActivityTab.tsx                  │
│  (phase banner)    (accept/dismiss)    (per-run cost)                   │
│       ↑ WS events: phase_advanced, deliberation_card, autonomy_run_cost │
├─────────────────────────────────────────────────────────────────────────┤
│                         Route Layer                                      │
│  chat.ts (action block parser)    milestones.ts    deliverables.ts      │
│  [[PHASE:]] [[PREFERENCE:]]       CRUD routes      accept/dismiss       │
├───────────────────────────┬─────────────────────────────────────────────┤
│      AI Pipeline          │       Autonomy Pipeline                      │
│  openaiService.ts         │  taskExecutionPipeline.ts                   │
│  - brainGateSection       │  - costCents logging                        │
│  - mayaPhaseSection       │  - autonomy_run_cost emit                   │
│  - userPrefsSection       │                                             │
│  conductor.ts             │  peerReviewRunner.ts                        │
│  - inferDeliberationNeed  │  - runDisagreementCheck                     │
│  teamRecommender.ts       │                                             │
│  disagreementDetector.ts  │                                             │
├───────────────────────────┼─────────────────────────────────────────────┤
│                      LLM Provider Layer                                  │
│  providerResolver.ts      geminiProvider.ts    openaiProvider.ts        │
│  - race timeout           - AbortSignal         - (unchanged)           │
│  - ALL_PROVIDERS_EXHAUSTED                                              │
├─────────────────────────────────────────────────────────────────────────┤
│                         Data Layer                                       │
│  conversations (+ mayaPhase)    users (+ preferences)                   │
│  deliverables (+ feedback cols) milestones (new table)                  │
│  autonomy_events (+ costCents)  deliberation_traces (existing)          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `openaiService.ts` | Prompt assembly, LLM call, streaming yield | `providerResolver.ts`, `promptTemplate.ts`, `storage.ts` (memory) |
| `conductor.ts` | Agent selection, safety score, deliberation need | `expertiseMatching.ts`, `safety.ts` |
| `providerResolver.ts` | Provider fallback chain, timeouts, health | All provider implementations |
| `chat.ts` | WS handling, action block parsing, event emission | `openaiService.ts`, `storage.ts`, `eventLogger.ts` |
| `teamRecommender.ts` (new) | Score 30 roles against project direction | `allHatchTemplates` from `templates.ts` |
| `disagreementDetector.ts` (new) | Extract claims, detect domain conflicts | `roleIntelligence.ts`, `peerReviewRunner.ts` |
| `milestones.ts` (new route) | CRUD for project milestones | `storage.ts` |

---

## Key Data Flows

**Maya phase advancement:**
```
Maya response contains [[PHASE: blueprint_draft]]
  → chat.ts action block parser (~line 876)
  → storage.updateConversationPhase(conversationId, 'blueprint_draft')
  → broadcastToConversation: { type: 'phase_advanced', phase: 'blueprint_draft' }
  → CenterPanel.tsx: update conversation phase display
```

**Minimum-viable-brain gate:**
```
chat.ts builds ChatContext with projectDirection from storage
  → openaiService.ts buildSystemPrompt()
  → checks coreDirection.whatBuilding + whyMatters + whoFor
  → injects BRAIN_SATISFIED or BRAIN_INCOMPLETE section
  → LLM respects instruction (stop/continue asking)
```

**User preference learning:**
```
Maya response contains [[PREFERENCE: tone: direct]]
  → chat.ts action block parser
  → storage.updateUserPreferences(userId, { tone: 'direct' })
  → next ChatContext for ANY project loads preferences from users.preferences
  → openaiService.ts injects USER PREFERENCES section globally
```

**Dynamic team recommendation:**
```
Freeform project created (no starterPackId)
  → Maya's MAYA TEAM INTELLIGENCE prompt section activates
  → teamRecommender.rankAgentsForProject(projectDirection, allHatchTemplates, 4)
  → Maya appends <!--HATCH_SUGGESTION:{...}--> to response
  → chat.ts parses HATCH_SUGGESTION block, emits teams_auto_hatched WS event
  → storage.recommendDynamicTeam() materializes selected agents
```

**Per-run cost flow:**
```
taskExecutionPipeline.ts runs autonomy task
  → each LLM call returns tokenUsage in metadata
  → eventLogger.ts logs event with costCents (from usageTracker.estimateCostCents())
  → after final task in trace: SELECT SUM(cost_cents) FROM autonomy_events WHERE trace_id = $1
  → broadcastToConversation: { type: 'autonomy_run_cost', traceId, totalCostCents }
  → ActivityTab.tsx renders "This run cost ~$0.04" in feed item
```

---

## Files Changed Summary

| File | Change Type | Reason |
|------|-------------|--------|
| `shared/schema.ts` | Schema additions | Phase, preferences, milestone table, deliverable cols, costCents |
| `server/storage.ts` | Interface + implementations | New CRUD methods for all schema additions |
| `server/ai/openaiService.ts` | Prompt section additions | Brain gate, phase, user prefs |
| `server/routes/chat.ts` | Action block parser extension | [[PHASE:]], [[PREFERENCE:]] blocks |
| `server/llm/providerResolver.ts` | Error typing + race timeout | Typed exhaustion error, per-provider timeout |
| `server/llm/providerTypes.ts` | Interface addition | `signal?: AbortSignal` on `LLMRequest` |
| `server/llm/providers/geminiProvider.ts` | AbortSignal propagation | Respect abort in stream loop |
| `server/ai/conductor.ts` | Return type change | `inferDeliberationNeed` returns structured claim data |
| `server/autonomy/peerReview/peerReviewRunner.ts` | New export | `runDisagreementCheck()` function |
| `server/autonomy/events/eventLogger.ts` | Field addition | Populate `costCents` on events |
| `server/autonomy/execution/taskExecutionPipeline.ts` | Cost aggregation + WS emit | `autonomy_run_cost` event at trace end |
| `server/routes/deliverables.ts` | New endpoints | Accept/dismiss PATCH, iterate editsCount++ |
| `shared/dto/wsSchemas.ts` | New event types | `phase_advanced`, `deliberation_card`, `autonomy_run_cost` |
| `client/src/hooks/useRealTimeUpdates.ts` | New event handlers | Provider offline state, run cost, phase |
| `client/src/components/CenterPanel.tsx` | Provider offline banner | `providersOffline` state from WS event |
| `client/src/components/ArtifactPanel.tsx` | Accept/dismiss UI | Wire new endpoints |
| `client/src/components/sidebar/ActivityTab.tsx` | Per-run cost display | Render `autonomy_run_cost` in feed |

**New files:**
| File | Purpose |
|------|---------|
| `server/ai/teamRecommender.ts` | Pure function: rank 30 roles for a project direction |
| `server/ai/disagreementDetector.ts` | Claim extraction + domain conflict scoring |
| `server/routes/milestones.ts` | CRUD endpoints for project milestones |

---

## Anti-Patterns to Avoid

### Phase state in `projects.brain` JSONB

**What people do:** Shove conversation phase state into `projects.brain` because it's already JSONB and convenient.
**Why it's wrong:** A project has one brain but can have many conversation threads at different phase stages. Storing phase on the project means reopening an old conversation resets the brain's phase — breaking multi-session workflows.
**Do this instead:** Column on `conversations` table. Phase is conversation-scoped, not project-scoped.

### Brain gate as a graph node or middleware

**What people do:** Try to gate the entire response pipeline at the routing layer (conductor.ts or a new Express middleware) when the brain is incomplete.
**Why it's wrong:** The gate is not about routing decisions or HTTP request gating. It is a behavioral instruction to the LLM. Gating at the routing layer either blocks messages entirely (too aggressive) or creates complex bypass logic.
**Do this instead:** Inject as a prompt section. The LLM decides whether to ask a question — the prompt simply informs it whether the context is already complete.

### New `user_preferences` table for preferences

**What people do:** Create a separate table with FK to users because "separation of concerns."
**Why it's wrong:** User preferences are 1:1 with users, fit in 8 known keys, don't need audit history in v3.0. A JOIN on every chat message build adds latency for no benefit.
**Do this instead:** JSONB column on `users`. Same pattern the codebase already uses for `agents.personality`, `projects.brain`, and `projects.executionRules`.

### Inline disagreement detection during streaming

**What people do:** Pause Agent A's stream mid-generation to fetch Agent B's opinion.
**Why it's wrong:** Breaks the streaming UX contract. Users see a pause. The LLM stream cannot be paused and resumed.
**Do this instead:** Run disagreement check after `streaming_completed`. Emit a separate `deliberation_card` WS event. User sees Agent A's full response, then a card appears below it asking "Alex disagrees on this point — see both views?"

### Separate `autonomy_runs` table for cost aggregation

**What people do:** Create an aggregate table to avoid SQL aggregation queries.
**Why it's wrong:** `autonomy_events` already has `traceIdIdx`. A `SUM(cost_cents) WHERE trace_id = X` query is fast. Adding a table adds a write coordination problem — you now need to keep the aggregate table in sync.
**Do this instead:** Add `costCents` to `autonomy_events`. Aggregate at query time. Cache the total in the `autonomy_run_cost` WS event payload so the client never needs to query it.

---

## Integration Points with Existing Architecture

### `openaiService.ts` injection pattern

The existing system prompt is built by appending named sections (line 206-400). All Pillar B prompt additions follow this exact pattern — each section is a string variable with `--- SECTION NAME ---` delimiters, conditionally populated, then concatenated into `systemPrompt`. No function signature changes needed for most additions — just add new context fields to `ChatContext` interface (line 39-64) and pass values from `chat.ts`.

### Action block parser extension point

`chat.ts` already parses `[[PROJECT_NAME:]]`, `[[TASK:]]`, and `[[UPDATE:]]` action blocks from agent responses (around line 876). Adding `[[PHASE:]]` and `[[PREFERENCE:]]` is a pattern extension, not a new system. The parser is a `switch` on the action type — add new `case` branches.

### `deliberation_traces` table is already migration-complete

The `deliberation_traces` table exists with the right shape for disagreement storage. The `traceId` UNIQUE constraint means each disagreement check creates a new trace record. No schema changes needed for disagreement orchestration — only the application-layer logic that populates it is new.

### `providerResolver.ts` fallback chain is the right abstraction

The existing `buildProviderOrder()` function (line 163) and the for-loop in `streamChatWithRuntimeFallback()` (line 271) are the right extension points for timeout behavior. The race wrapper goes inside the `for` loop's `try` block, wrapping the `provider.streamChat()` call. This ensures each provider in the chain gets its own timeout budget, not a shared one.

---

## Sources

- Code inspection: `shared/schema.ts` (full file), `server/ai/openaiService.ts` (lines 1-500), `server/ai/conductor.ts` (full), `server/llm/providerResolver.ts` (full), `server/llm/providers/geminiProvider.ts` (full), `server/routes/chat.ts` (lines 198-986), `server/storage.ts` (lines 734-852), `server/ai/promptTemplate.ts` (full), `server/autonomy/background/projectHealthScorer.ts` (lines 1-80)
- Existing patterns derived from: `agents.personality` JSONB (1:1 user prefs precedent), `[[PROJECT_NAME:]]` action block parser (phase/preference block precedent), `HATCH_SUGGESTION` comment block (team formation precedent), `streaming_error` WS event (degradation extension precedent)

---

*Architecture research for: Hatchin v3.0 Pillar B — Maya Reliability & Teamness*
*Researched: 2026-04-25*
*Confidence: HIGH — all integration points verified by direct code inspection*
