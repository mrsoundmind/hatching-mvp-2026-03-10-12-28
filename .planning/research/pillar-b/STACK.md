# Stack Research — Pillar B: Maya Reliability + Teamness

**Domain:** Additions to existing AI chat platform (Hatchin v3.0 Pillar B)
**Researched:** 2026-04-25
**Confidence:** HIGH for most decisions. MEDIUM for embedding strategy (two valid paths with genuine tradeoffs).

---

## TL;DR — New Dependencies Required

Pillar B needs **zero new npm packages** for most features. The one genuine dependency question is embeddings for dynamic team formation, and the right answer is to use the Gemini API you already pay for — no new package needed. The only new dep worth adding is a **Gemini SDK upgrade** from the deprecated `@google/generative-ai` to `@google/genai` (forced migration, not optional).

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@google/genai` | ^1.3.0 | Replace deprecated Gemini SDK | `@google/generative-ai` was EOL'd November 30, 2025 — critical bugfixes only, no new features. New SDK has unified client, better AbortController handling, and is required for features like Live API. Migration is mandatory before v3.0 ships. |
| Native `AbortSignal.timeout()` | Node.js 20 built-in | Hard LLM request timeout | Node 20.19.3 is already in use. `AbortSignal.timeout(ms)` is a standard global — zero dependencies, cleaner than `p-timeout`. Pass directly to `@google/genai` request options. |
| Existing LangGraph `@langchain/langgraph` | ^0.4.9 (already installed) | Maya phase machine (discovery → blueprint → handoff) | LangGraph's `StateGraph` + `addConditionalEdges` is exactly the abstraction needed for a 3-phase conversation machine. Adding XState would duplicate this capability. Hand-roll the phase transitions as a LangGraph node with state field `mayaPhase`. |
| Existing Zod `zod` | ^3.24.2 (already installed) | Minimum-viable-brain completeness scoring | Zod `.safeParse()` on a `brainSchema` returns a structured error list. Count required field failures to compute a completeness score (0–100). No new validation library needed. |
| Existing Drizzle ORM `drizzle-orm` | ^0.39.1 (already installed) | Cross-project user preferences, milestones, feedback tracking | All Pillar B schema additions (user_preferences table, milestones table, deliverable feedback columns) fit cleanly into Drizzle schema additions. No new ORM or storage layer needed. |
| Gemini Embedding API (via `@google/genai`) | part of upgraded SDK | Dynamic team formation semantic matching | `gemini-embedding-001` at $0.15/M tokens via the SDK you're already integrating. 30 role descriptions × ~100 tokens each = 3000 tokens per formation call. At normal usage this is pennies. No local model needed. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None — use `AbortSignal.timeout()` | Node 20 built-in | LLM request timeout + cleanup | For the Maya bug fix: wrap the `sendMessageStream` call in `AbortSignal.timeout(30_000)`. Node.js 20 ships this natively; no wrapper package needed. |
| None — hand-roll disagreement surfacing | N/A | Disagreement orchestration | No library exists for "agent disagreement detection". The pattern is: run agents in parallel with a structured-output prompt asking for `{position, confidence, reasoning}`, compare positions via simple string/semantic comparison, escalate to a `DecisionCard` WS event when positions diverge. This is 50 lines of orchestration code, not a library. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Existing Vitest | Unit test phase machine transitions | Test each `mayaPhase` transition with mock state — no new test tooling needed |
| Existing Playwright | E2E test skip-Maya escape hatch + graceful degradation UX | Already installed at `@playwright/test ^1.58.2` |

---

## Installation

```bash
# The only new package for Pillar B:
npm install @google/genai@^1.3.0

# Remove the deprecated package after migration:
# (do not remove until geminiProvider.ts + @langchain/google-genai are migrated)
```

No other packages required for Pillar B.

---

## Feature-by-Feature Stack Decisions

### 1. Maya Phase Machine (discovery → blueprint → handoff)

**Decision: Hand-roll phase state in LangGraph — no new FSM library.**

The existing `graph.ts` uses `@langchain/langgraph ^0.4.9`'s `StateGraph`. Adding a `mayaPhase` field to the graph's state channel is the right approach:

```typescript
// Extend existing graph state (in graph.ts):
type MayaPhase = 'discovery' | 'blueprint' | 'handoff' | 'bypass';

// Add to graph state annotation:
mayaPhase: Annotation<MayaPhase>({ reducer: (_, b) => b, default: () => 'discovery' }),
questionCount: Annotation<Record<string, number>>({ reducer: (a, b) => ({...a, ...b}), default: () => ({}) }),
```

The phase transitions become conditional edges: `discovery` → (≥ min brain satisfied OR ≤ 3 questions asked) → `blueprint` → (blueprint approved) → `handoff`. LangGraph's `addConditionalEdges` handles this exactly. No XState needed — it would add ~85KB gzipped for a problem LangGraph already solves.

**Why not XState v5:** XState is designed for frontend UI state machines and adds significant bundle size. LangGraph is already doing the exact same job for the AI graph. Two FSM libraries for one machine is unnecessary complexity.

**Phase machine integration point:** `server/ai/graph.ts` — add `maya_phase_router` node + conditional edges before `hatch_node`.

---

### 2. Maya Bug Fix: Hard LLM Request Timeout + Thinking State Cleanup

**Decision: Use native `AbortSignal.timeout()` — no p-timeout or other wrapper.**

The bug is already partially diagnosed in `chat.ts` (lines 950–975): a `STREAMING_HARD_TIMEOUT` error path exists but the `typing_started` state isn't always cleaned up on abort. The fix is:

**In `geminiProvider.ts`:** Pass `AbortSignal.timeout(30_000)` to the Gemini SDK request. With `@google/genai` (new SDK), the `requestOptions.signal` field accepts an `AbortSignal`.

**In `chat.ts`:** The `finally` block in the streaming path must always emit `typing_stopped` — currently it only emits on success. Add `typing_stopped` emission to the existing `catch` and timeout branches.

**Critical finding on `@google/generative-ai` + AbortController:** The deprecated SDK (currently installed at `^0.24.1`) has an unresolved issue where `AbortError` from a timeout throws as an unhandled rejection rather than a catchable error (GitHub Issue #303 in the deprecated repo). The new `@google/genai` SDK addresses this. **This is a second reason the SDK upgrade is mandatory for Pillar B.**

The "out for lunch" spurious fallback (chat.ts line 258–265) is triggered when the authority resolution fails. Fix is in `resolveSpeakingAuthority` — ensure valid stream state doesn't fall through to the random fallback array.

**Node.js version check:** The project runs Node 20.19.3. `AbortSignal.timeout()` is stable since Node 18.0. Safe to use without polyfill.

---

### 3. Minimum-Viable-Brain Gate

**Decision: Zod schema + custom completeness scorer — no new validation library.**

The brain schema already uses JSONB in PostgreSQL. Define a Zod schema for the required brain fields:

```typescript
const requiredBrainSchema = z.object({
  whatBuilding: z.string().min(10),
  whyMatters: z.string().min(10),
  whoFor: z.string().min(5),
});

function brainCompleteness(brain: unknown): number {
  const result = requiredBrainSchema.safeParse(brain);
  if (result.success) return 100;
  const filledFields = 3 - result.error.issues.length;
  return Math.round((filledFields / 3) * 100);
}
```

This integrates with existing `project.coreDirection` JSONB. No new library. The completeness score gates agent interrogation: if `brainCompleteness >= 70`, agents stop asking clarifying questions (inject into prompt context).

**Integration point:** `server/ai/promptTemplate.ts` — inject completeness score + gate message.

---

### 4. Cross-Project User Preferences

**Decision: New `user_preferences` table in Drizzle — no new library.**

The existing `users` table has no preferences JSONB column (verified from schema). Add a new table rather than a column to keep preferences queryable and evolvable:

```typescript
// In shared/schema.ts — new table:
export const userPreferences = pgTable("user_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  workingStyle: text("working_style").$type<"async" | "real-time" | "batch">().default("async"),
  tonePreference: text("tone_preference").$type<"casual" | "professional" | "technical">().default("casual"),
  primaryRole: text("primary_role"), // "founder", "engineer", "designer", etc.
  onboardingComplete: boolean("onboarding_complete").default(false),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

The `.unique()` on `userId` enforces one row per user. Query with `storage.getUserPreferences(userId)` — standard Drizzle pattern. Preferences are injected into Maya's system prompt at the project level.

**No localStorage involved** — preferences are server-side so they apply cross-device.

---

### 5. Dynamic Team Formation (semantic match: project description → 3-4 agents from 30)

**Decision: Gemini Embedding API via upgraded `@google/genai` SDK — no `@huggingface/transformers` or local model.**

This is the most nuanced stack decision. Two approaches exist:

**Option A (recommended): Gemini Embedding API**
- Use `ai.models.embedContent({ model: 'gemini-embedding-001', ... })` to embed both the project description and all 30 role descriptions
- Compute cosine similarity in pure JavaScript (no library needed — it's 5 lines)
- Return top 3-4 roles by similarity score
- Cost: ~3,000 tokens per formation request at $0.15/M = $0.00045 per call
- Zero bundle impact (uses existing API key + upgraded SDK)
- Confidence: MEDIUM-HIGH — embedding quality is excellent (MTEB top 5), cost is negligible

**Option B (not recommended): `@huggingface/transformers` v4 local ONNX**
- `all-MiniLM-L6-v2` ONNX model = ~23MB download on first use
- Cold start: 8–12 seconds for model download + 1–3 seconds for deserialization
- Adds 23MB+ to production artifact / Neon serverless cold starts
- Suitable for high-volume or offline-first scenarios — neither applies here

**Why not a pure keyword approach:** With only 30 roles, you could also use keyword matching (does "marketing" appear in description → add Kai). This is simpler but misses semantic cases ("I need to grow users" → should match Growth Marketer). Embedding is better quality and the cost is immaterial. However, a hybrid approach — keyword match first, embed only for ambiguous cases — is worth considering as a cost optimization if formation calls become frequent.

**Implementation:** Role descriptions for embedding are already in `shared/roleRegistry.ts`. Pre-compute role embeddings once on server startup and cache in memory (30 vectors × 3072 dimensions = ~720KB in memory — acceptable). Re-embed the project description per formation request.

**Integration point:** New `server/ai/teamFormation.ts` module.

---

### 6. Disagreement Orchestration

**Decision: Hand-roll via LangGraph parallel branches + structured prompt output — no library.**

No library exists for this problem. The pattern:

1. Run N relevant agents in parallel (existing LangGraph parallel node support)
2. Each agent responds with structured output: `{ position: string, confidence: number, reasoning: string }`
3. Compare positions: if cosine similarity of position embeddings < 0.7 (or if confidence variance > 0.3), surface as `DecisionCard` WS event
4. `DecisionCard` shows the disagreement, each agent's position, and asks user to pick

The disagreement detection comparison can use the same embedding setup from feature 5 (team formation) — a simple dot product similarity between two position strings.

**New WS event needed:** `agent_disagreement` with `{ agentA, agentB, topicSummary, positions[] }`.

**Integration point:** `server/autonomy/` — new `disagreementDetector.ts` module.

---

### 7. Project Milestones / Definition-of-Done

**Decision: New `milestones` table in Drizzle — extend existing tasks pattern.**

The existing `tasks` table has `parent_task_id` for hierarchy but no concept of a goal layer above tasks. Add:

```typescript
export const milestones = pgTable("milestones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  successCriteria: text("success_criteria").array().default([]),
  status: text("status").$type<"not_started" | "in_progress" | "complete">().default("not_started"),
  dueDate: timestamp("due_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

Tasks get an optional `milestoneId` FK. No new library — standard Drizzle addition.

---

### 8. Deliverable Feedback Loop

**Decision: Add columns to existing `deliverables` table + extend `autonomy_events` pattern.**

The `deliverables` table currently has no feedback fields. Add:

```typescript
// Additions to existing deliverables table in shared/schema.ts:
userFeedback: text("user_feedback").$type<"accepted" | "edited" | "dismissed" | null>().default(null),
feedbackNotes: text("feedback_notes"),
feedbackAt: timestamp("feedback_at"),
editCount: integer("edit_count").default(0),
```

The `autonomy_events` table (already logging execution events) can accept a new event type `deliverable_feedback` with the payload. This follows the existing pattern in `server/autonomy/events/eventLogger.ts` — no new table or new event infrastructure needed.

**Analytics consumption:** The feedback is read back by agents via `getDeliverableFeedbackSummary(agentId)` — a simple Drizzle query. The result gets injected into the agent's system prompt: "Users have accepted 8/10 of your PRDs; 2 were edited to add more technical detail."

---

### 9. Per-Autonomy-Run Cost Attribution

**Decision: Extend existing `usageTracker.ts` + `autonomy_events` — no new dep.**

`server/billing/usageTracker.ts` already records token usage at the message level. The fix is tagging each autonomy execution with a `runId` (pg-boss job ID already provides this) and aggregating usage by `runId` at query time. The `autonomy_events` table can store `estimatedCostUsd` in its existing `payload` JSONB.

**No new library.** This is a schema + query change.

---

### 10. Graceful LLM Degradation UX

**Decision: Extend existing error type system in `chat.ts` — no new dep.**

The existing `getStreamingErrorPayload()` function in `chat.ts` (line 237) returns a hardcoded "My thinking engine is temporarily offline" message. The fix is:

1. Classify errors: `PROVIDER_UNAVAILABLE`, `RATE_LIMITED`, `TIMEOUT`, `CONTEXT_TOO_LONG`
2. Map each to a user-facing message that feels in-character (Maya delivers these, not a system banner)
3. For `RATE_LIMITED`: add exponential backoff + automatic retry (native `setTimeout` + recursion, no retry library needed for this use case)
4. A `llm_degraded` WS event lets the client show a non-blocking status pill

The existing `providerResolver.ts` fallback chain (`Gemini → OpenAI → Groq`) already handles provider-level failures. This feature is about better UX when all providers are struggling, not a new fallback mechanism.

---

### 11. Skip-Maya Escape Hatch

**Decision: Feature flag in user preferences — no new dep.**

Add `skipMayaDiscovery: boolean` to the `user_preferences` table. When `true`, the Maya phase machine enters `bypass` state immediately, routing to the conventional multi-agent chat. Surface as a "Skip discovery" button during Maya's first question. No library — one row read + one conditional branch in graph.ts.

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| LangGraph `addConditionalEdges` for phase machine | XState v5 | XState adds ~85KB gzipped for a problem LangGraph already solves. Hatchin already has a LangGraph state machine — a second FSM library creates conceptual overhead with no gain. |
| `AbortSignal.timeout()` (Node 20 built-in) | `p-timeout` v7 | p-timeout is ESM-only and adds a 3KB dependency for functionality that's been a Node.js built-in since v18. Node 20 is already in use. |
| Gemini Embedding API (via upgraded SDK) | `@huggingface/transformers` v4 local ONNX | Local model downloads 23MB on cold start with 8–12 second latency on first load. On Neon serverless this is unacceptable. API cost is $0.00045/formation call — negligible. |
| Gemini Embedding API | Pure keyword matching | Keyword matching misses semantic intent ("grow users" → should match Growth Marketer, not just exact keyword "marketing"). Embedding costs nothing meaningful. |
| Extend `autonomy_events` for deliverable feedback | New `deliverable_feedback` table | Existing `autonomy_events` pattern already handles typed events with payload JSONB. A second table with the same structure is unnecessary. |
| `@google/genai` SDK upgrade | Keep `@google/generative-ai` | The deprecated SDK's GitHub repo was archived December 16, 2025. EOL was November 30, 2025. The AbortController unhandled rejection bug (Issue #303) is in the deprecated repo and will never be fixed. Migration is mandatory. |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| XState / @xstate/fsm | Duplicates LangGraph for no benefit; adds bundle weight | `StateGraph` + `addConditionalEdges` in existing `graph.ts` |
| `p-timeout` | 3KB ESM-only package that wraps functionality native to Node 20 | `AbortSignal.timeout(ms)` |
| `@huggingface/transformers` / `@xenova/transformers` | 23MB+ ONNX model, cold-start latency incompatible with serverless, startup time | Gemini Embedding API via upgraded `@google/genai` |
| Any "analytics" dep (Posthog, Amplitude, etc.) for deliverable feedback | Overkill for internal signal tracking; PII risk | Extend `autonomy_events` table — already structured for this |
| `retry` / `p-retry` for LLM degradation | Simple backoff doesn't need a library | Native `setTimeout` + recursive promise for exponential backoff |
| Sentence-transformers via a REST microservice | Operational complexity (another process to deploy) | Gemini Embedding API |
| Any new assertion/validation lib (Joi, Yup, Vest) | Zod is already installed and sufficient | Existing `zod ^3.24.2` |

---

## Critical SDK Migration: `@google/generative-ai` → `@google/genai`

This is the only forced change in Pillar B and it touches existing code.

**End-of-life timeline (HIGH confidence — verified from Google's deprecated-generative-ai-js repo):**
- Critical bugfixes only since November 30, 2025
- GitHub repository archived December 16, 2025
- No new features, no new model support

**Migration scope in this codebase:**
- `server/llm/providers/geminiProvider.ts` — primary change location
- `@langchain/google-genai` package (already in `@langchain/openai ^0.6.11`) — check if it uses the new SDK internally

**Key API differences affecting geminiProvider.ts:**

```typescript
// OLD (@google/generative-ai 0.24):
import { GoogleGenerativeAI } from '@google/generative-ai';
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', ... });
const chat = model.startChat({ history });
const result = await chat.sendMessageStream(lastUserMessage);

// NEW (@google/genai 1.x):
import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey });
const response = await ai.models.generateContentStream({
  model: 'gemini-2.5-flash',
  contents: [...history, { role: 'user', parts: [{ text: lastUserMessage }] }],
  config: { systemInstruction: system, temperature: 0.7, maxOutputTokens: 500 },
});
```

**AbortController in new SDK:** Pass `signal` via `requestOptions`:

```typescript
const signal = AbortSignal.timeout(30_000);
const response = await ai.models.generateContentStream({
  model: 'gemini-2.5-flash',
  contents: [...],
}, { signal });
```

**Migration risk:** MEDIUM. The new SDK has a significantly different client architecture. Test thoroughly — especially streaming, usage metadata extraction, and error handling. The `@langchain/google-genai` LangChain integration may lag the SDK by a few weeks.

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `@google/genai ^1.3.0` | Node 20.x | GA since May 2025; latest is 1.48.0 as of April 2026 |
| `@google/genai ^1.3.0` | `@langchain/langgraph ^0.4.9` | LangGraph doesn't depend on the Gemini SDK directly — no conflict |
| `@google/genai ^1.3.0` | `@langchain/google-genai` (part of `@langchain/openai`) | May need separate `@langchain/google-genai` package upgrade — verify after migration |
| `AbortSignal.timeout()` | Node 20.19.3 | Stable since Node 18.0; no polyfill needed |
| New Drizzle tables | Drizzle ORM 0.39.1 | Backward compatible — add tables, run `db:push` |

---

## Phase-by-Phase Dependencies

| Pillar B Phase | New Dependencies | Notes |
|----------------|-----------------|-------|
| Maya bug fix (highest priority) | `@google/genai` (SDK upgrade) | Blocks timeout fix on deprecated SDK; do this first |
| Phase machine | None | Pure LangGraph + TypeScript addition |
| Brain gate | None | Zod already installed |
| User preferences | None | Drizzle schema addition + `db:push` |
| Team formation | `@google/genai` (embedding endpoint) | Uses same upgraded SDK |
| Disagreement orchestration | None | LangGraph parallel + hand-rolled |
| Milestones | None | Drizzle schema addition |
| Feedback loop | None | Drizzle column addition |
| Cost attribution | None | Extends existing usageTracker |
| Degradation UX | None | Extends existing error handling |
| Skip-Maya | None | Feature flag in user_preferences |

---

## Sources

- [Google deprecated-generative-ai-js repo](https://github.com/google-gemini/deprecated-generative-ai-js) — EOL date November 30, 2025 confirmed; archived December 16, 2025. HIGH confidence.
- [Gemini API migration guide](https://ai.google.dev/gemini-api/docs/migrate) — SDK architecture breaking changes. HIGH confidence.
- [AbortSignal: timeout() static method — MDN](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static) — native Node 18+ API. HIGH confidence.
- [Gemini Embedding API pricing](https://ai.google.dev/gemini-api/docs/pricing) — $0.15/M tokens for gemini-embedding-001. HIGH confidence.
- [Gemini Embedding now GA — Google Developers Blog](https://developers.googleblog.com/gemini-embedding-available-gemini-api/) — model quality and availability. HIGH confidence.
- [Transformers.js v4 release notes](https://github.com/huggingface/transformers.js/releases/tag/4.0.0) — bundle size and cold-start timing data. MEDIUM confidence (from release notes, not benchmarked independently).
- [LangGraph JS conditional edges guide](https://medium.com/the-guy-wire/learning-langgraph-js-part-2-conditional-edges-4672c35ff42f) — addConditionalEdges pattern for TypeScript. MEDIUM confidence.
- [Unhandled AbortError issue in deprecated SDK](https://github.com/google-gemini/deprecated-generative-ai-js/issues/303) — documents the AbortController bug in `@google/generative-ai`. HIGH confidence (tracked GitHub issue, unresolved in deprecated repo).
- [LangGraph interrupt docs](https://docs.langchain.com/oss/javascript/langgraph/interrupts) — human-in-loop pattern for disagreement escalation. HIGH confidence.
- [p-timeout npm](https://www.npmjs.com/package/p-timeout) — v7.0.1, ESM-only, verified against Node 20 compatibility. MEDIUM confidence (npm page 403'd, info from search results).

---

*Stack research for: Hatchin v3.0 Pillar B — Maya Reliability + Teamness*
*Researched: 2026-04-25*
