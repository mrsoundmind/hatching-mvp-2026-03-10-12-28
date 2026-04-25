# Research Summary — Pillar B: Maya Reliability + Teamness

**Project:** Hatchin v3.0 "Hatchin That Works"
**Pillar:** B — Maya Reliability + Teamness (Phases 28+)
**Domain:** AI-native multi-agent project collaboration — conversational onboarding, bounded discovery, agent coordination UX
**Researched:** 2026-04-25
**Confidence:** HIGH — all architecture decisions verified by direct code inspection

---

## URGENT: Ship Before Phases Begin

**The Maya infinite-thinking bug is blocking user testing RIGHT NOW.** This fix must not wait for the phase machine to be complete. It is a self-contained 2-3 day task:

1. Migrate `@google/generative-ai` to `@google/genai` (the deprecated SDK has an unresolved `AbortController` unhandled rejection bug that makes a clean timeout fix impossible without the migration — SDK upgrade is prerequisite, not optional)
2. Add `AbortSignal.timeout(30_000)` to `geminiProvider.ts`
3. Fix the `finally` block in `chat.ts` streaming path to always emit `typing_stopped` on abort/timeout
4. Fix the TTFT threshold: current fallback fires at 3s of silence; Gemini Pro legitimately takes 4-6s on complex prompts; correct threshold is 30s total silence or 15s post-first-token

These four changes are surgically isolated. Ship immediately. Do not bundle into a phase.

---

## Executive Summary

Pillar B repairs the product-level trust gap that user testing exposed: Maya loops indefinitely, projects never start, and when LLMs fail the UI shows raw errors or nonsense fallback messages. The research confirms this is a layered problem — part bug (the infinite thinking state), part UX design (unbounded discovery with no exit condition), and part missing product surface (no moment where a user confirms "yes, start the project"). Every feature in Pillar B connects to the same root cause: users cannot tell whether Hatchin is working or broken, and they have no way to steer it to action.

The recommended approach is a strict dependency chain: fix the bug first (prerequisite for any user-facing testing), build the MVB gate and Maya phase machine as the structural backbone, then layer differentiators on top (team formation, user preferences, disagreement surfacing, milestones) in order of dependency and diminishing risk. The SDK migration from `@google/generative-ai` to `@google/genai` is the one forced change that unblocks everything — it is not optional and it touches `geminiProvider.ts` in a breaking way, so it must happen early and be tested thoroughly before any other LLM work proceeds.

The key risk across Pillar B is scope creep. The research identifies a clean v3.0 must-have set (bug fix, brain gate, phase machine, discovery design, blueprint draft, skip-Maya escape hatch, deliverable feedback columns) and a v3.1 add-after-validation set (full LangGraph phase machine, dynamic team formation, per-run cost trail, user preferences). Agent disagreement surfacing and project milestones are v3.2 territory — they depend on features not yet stable and carry the highest implementation risk.

---

## Key Findings

### Recommended Stack

Pillar B requires **zero new npm packages** beyond the one mandatory SDK upgrade. The only new dependency is `@google/genai@^1.3.0`, replacing the archived `@google/generative-ai@0.24.1`. Every other Pillar B feature uses tooling already installed: LangGraph for the phase state machine, Zod for the MVB completeness scorer, Drizzle ORM for all schema additions, and Node 20's native `AbortSignal.timeout()` for request timeouts (no `p-timeout` needed). Embeddings for dynamic team formation use the Gemini Embedding API via the upgraded SDK — cost is approximately $0.00045 per team formation call, negligible.

**Core technology decisions:**

- `@google/genai ^1.3.0` (mandatory upgrade): Replaces the EOL'd `@google/generative-ai` — GitHub repo archived December 16, 2025. The old SDK has an unresolved `AbortController`/`AbortError` unhandled rejection bug (Issue #303 in the deprecated repo) that makes a clean timeout fix impossible without the migration. API surface is significantly different — new unified `GoogleGenAI` client, `ai.models.generateContentStream()` replaces `chat.sendMessageStream()`, `requestOptions.signal` replaces the prior pattern.
- `AbortSignal.timeout()` (Node 20 built-in): Hard 30s LLM request timeout. Zero dependencies. Node 20.19.3 is already in use; this API has been stable since Node 18.0.
- Existing `@langchain/langgraph ^0.4.9`: Add `mayaPhase` field to graph state annotation and `addConditionalEdges` for phase transitions. No XState — it duplicates LangGraph for +85KB with no gain.
- Existing `zod ^3.24.2`: MVB completeness scorer via `safeParse()` on a `brainSchema`. The 3-field check is 10 lines of existing Zod.
- Existing `drizzle-orm ^0.39.1`: All schema additions (conversations.mayaPhase, users.preferences JSONB, deliverables feedback columns, autonomy_events.costCents, new milestones table) fit as standard Drizzle additions. Batch into one migration.
- Gemini Embedding API (via `@google/genai`): `gemini-embedding-001` for dynamic team formation. Pre-compute 30 role embeddings at server startup (~720KB in memory), cache with hash-based invalidation tied to `roleRegistry.ts` content.

### Expected Features

**Must have — v3.0 (table stakes + bug fixes):**
- LLM timeout + thinking state cleanup — infinite thinking state makes the product appear broken; 2-3 day fix that must ship before user testing
- Graceful LLM down UX — typed error codes (`RATE_LIMITED`, `TIMEOUT`, `ALL_PROVIDERS_EXHAUSTED`), inline in-character error messages, no raw 500s
- Skip-Maya escape hatch — single `skipMaya: boolean` flag in `users.preferences`; power users need "Skip to my team" from day one
- Minimum-viable-brain gate — 3-field check injected as `BRAIN_SATISFIED` / `BRAIN_INCOMPLETE` prompt section; nearly free, unlocks everything else
- Bounded discovery / bulk categorized questions — max 3 questions per message, grouped by category; primarily prompt engineering, with a `discoveryTurnCount` guard
- Blueprint draft before handoff — structured project brief shown as `BlueprintCard`; user confirms before handoff fires; Replit Agent's Plan Mode pattern
- Deliverable accept/edit/dismiss feedback columns — 4 new columns on existing `deliverables` table; closes the v2.0 loop

**Should have — v3.1 (add after v3.0 validation):**
- Maya phase machine (full LangGraph node) — `mayaPhase` column on `conversations`, `[[PHASE:]]` action block, conditional edges; prompt engineering gets 80% of value first
- Dynamic team recommendation — `teamRecommender.ts`; blueprint-dependent; `TeamRecommendationCard` with rationale per role; exploration role + jitter to avoid deterministic output
- Per-run cost trail — `costCents` on `autonomy_events`; `autonomy_run_cost` WS event; Pro users see quota framing not dollar amounts (loss aversion research)
- Cross-project user preferences — `preferences` JSONB on `users`; learned after first project, never asked at onboarding; injected as `USER PREFERENCES` prompt section

**Defer — v3.2+ (high complexity, dependency-heavy):**
- Project goal/milestone layer — depends on blueprint + deliverable feedback both stable
- Agent disagreement surfacing — large effort; three separate pitfalls (manufactured disagreement, decision fatigue, cost explosion); only viable after peerReviewRunner has production data

**Anti-features — deliberately omit:**
- Raw token count display (use cents in Activity feed, quota framing for Pro)
- Hard MVB gate blocking all agent responses (gate controls phase transition only, not agent access)
- Automatic phase transitions without user confirmation (blueprint card requires explicit confirmation)
- Per-message cost display in chat thread (ruins the "colleague" feel)
- Maya asking explicitly about communication preferences (infer from first 3-5 turns)

### Architecture Approach

All Pillar B changes integrate into the existing architecture without structural upheaval. The primary extension points are: `openaiService.ts` (prompt section injection), `chat.ts` action block parser (new `[[PHASE:]]` and `[[PREFERENCE:]]` cases), `providerResolver.ts` (race timeout + typed error), and `geminiProvider.ts` (AbortSignal propagation + new SDK API). Schema additions batch into one migration. Three new files are needed: `server/ai/teamRecommender.ts`, `server/ai/disagreementDetector.ts`, and `server/routes/milestones.ts`.

**Major components:**

1. `conversations.mayaPhase` column — server-side truth for phase state; never in client React state (resets on refresh otherwise)
2. `openaiService.ts` prompt injection — adds `brainGateSection`, `mayaPhaseSection`, and `userPrefsSection` as named sections following the existing `--- SECTION NAME ---` delimiter pattern
3. `chat.ts` action block parser — extends existing switch to handle `[[PHASE:]]` (writes to conversations) and `[[PREFERENCE:]]` (writes to users.preferences)
4. `providerResolver.ts` — race timeout wrapper per provider (30s, shorter than the outer 45s hard timeout); typed error classification (`RATE_LIMIT` vs `SERVER_ERROR` vs `TIMEOUT`)
5. `teamRecommender.ts` (new) — pure function `rankAgentsForProject(direction, templates, count)` using Gemini embedding cosine similarity; pre-cached role embeddings with hash invalidation
6. `milestones.ts` route module (new) — CRUD; completion % computed from linked tasks, never stored

**Key data flows:**

- Maya phase advancement: `[[PHASE: blueprint_draft]]` in Maya response → `chat.ts` parser → `storage.updateConversationPhase()` → WS `phase_advanced` → CenterPanel updates
- MVB gate: `ChatContext` with `projectDirection` → `openaiService.ts` checks 3 fields → injects `BRAIN_SATISFIED` or `BRAIN_INCOMPLETE` section
- Preference learning: `[[PREFERENCE: tone: direct]]` → parser → `storage.updateUserPreferences()` → picked up in next ChatContext for any project
- Background brain extraction (critical): After every Maya discovery turn, lightweight Groq extraction auto-populates `coreDirection` fields; do not rely solely on Maya action blocks

### Critical Pitfalls

1. **Phase state in client-side React state** — Most likely mistake. Phase must live in `conversations.mayaPhase` DB column with `DEFAULT 'discovery'`. Test: close and reopen browser mid-discovery; Maya must resume from the same question group, not restart.

2. **"Looks good but..." false handoff** — Keyword matching fires on qualifications. Use the existing `intentClassifier.ts` pattern — structured prompt with few-shot negative examples, returns `{intent, confidence}`. Fire handoff only on `approve` with confidence > 0.80. For `ambiguous`, ask "Should I go ahead and draft the blueprint now?"

3. **MVB false negative — Maya asks forever** — The MVB gate checks `projects.coreDirection` DB fields. Those fields only update via action blocks or background extraction. If neither runs, the gate never passes. Build background extraction alongside the MVB gate — not as an optimization.

4. **Dangling AbortController references** — `abort()` fires but the async generator keeps running. Add `if (signal.aborted) { generator.return(); break; }` at the top of each stream loop iteration, plus `finally` block cleanup. Wire AbortController to WS `close` event for unexpected disconnects.

5. **Prompt injection via stored user preferences** — Free-text preference fields injected verbatim into the system prompt are OWASP LLM01. Use structured allowlists for enum fields; limit free-text `additionalContext` to 200 chars; inject as user-context block, never system role.

6. **Rate limit shown as "all providers unavailable"** — A Gemini 429 should route to Groq immediately without the degradation banner. Classify errors: `RATE_LIMIT (429)` routes to fallback without marking provider degraded; only `SERVER_ERROR` or persistent `TIMEOUT` triggers circuit breaker.

7. **Skip-Maya bypasses brain initialization** — The escape hatch must show an inline quick-fill form for the 3 MVB fields before agents activate. Add null guard in `promptTemplate.ts` for empty `coreDirection`.

---

## Implications for Roadmap

Pillar B becomes Phases 28+. Pillar A (Phases 22-27) is preserved and ships first. The Maya bug fix ships out-of-band before any phase work begins.

### Pre-Phase: Maya Bug Fix (ship immediately)

**Rationale:** User testing is blocked today. Infinite thinking state makes the product appear broken. This is a 2-3 day self-contained fix.

**Delivers:** Working LLM timeout (30s), clean streaming state cleanup on abort, correct TTFT threshold for fallback (30s not 3s), `@google/genai` SDK migration as prerequisite.

**Hard dependency:** SDK migration MUST complete before any other Pillar B LLM work.

**Pitfalls addressed inline:** Dangling AbortController references (Pitfall 16), fallback firing on valid slow responses (Pitfall 15).

---

### Phase 28: Schema Foundation + MVB Gate + Discovery Redesign

**Rationale:** Structural backbone for all Pillar B features. Batching all schema additions into one migration is cheaper than 5 separate `db:push` calls. Brain gate is nearly free and immediately improves every Maya interaction.

**Delivers:**
- One schema migration: `conversations.mayaPhase` DEFAULT 'discovery', `users.preferences` JSONB DEFAULT {}, 4 feedback columns on `deliverables`, `autonomy_events.costCents` nullable, `milestones` table
- Storage layer CRUD for all new schema
- Brain gate: `BRAIN_SATISFIED` / `BRAIN_INCOMPLETE` prompt injection in `openaiService.ts`
- Background extraction: Groq extraction after every Maya discovery turn auto-populates `coreDirection` fields
- Discovery redesign: Maya prompt updated to batch max 3 questions per message with category groups

**Features addressed:** Minimum-viable-brain gate (P1), bounded discovery (P1)

**Pitfalls addressed inline:** MVB false negative (Pitfall 6 — background extraction mandatory), bulk discovery abandonment (Pitfall 4), phase state server-truth setup (Pitfall 1)

**Research flag:** Standard patterns — no additional research needed.

---

### Phase 29: Maya Phase Machine + Blueprint Draft + Skip-Maya

**Rationale:** The phase machine gives Hatchin intentional conversation flow. Blueprint draft is its culminating output — the moment a user confirms "yes, go." Skip-Maya must be in the same phase because its bypass path needs to satisfy the same MVB schema.

**Delivers:**
- `[[PHASE:]]` and `[[PREFERENCE:]]` action block cases in `chat.ts` parser
- Phase-aware prompt templates in `openaiService.ts`
- `phase_advanced` WS event + CenterPanel phase indicator
- `BlueprintCard` component with explicit "Looks good, start the project" CTA
- Blueprint synthesis prompt that adds implications and risks — not an echo of user words (Pitfall 20)
- LLM-based handoff intent classifier (not regex) — handles "looks good but..." (Pitfall 2)
- Skip-Maya: `skipMaya` flag in `users.preferences`, "Skip to my team" link in WelcomeModal, inline quick-fill form for MVB fields on skip path
- Phase regression guard in `taskExecutionPipeline.ts`: cancel pg-boss jobs when phase regresses to discovery

**Features addressed:** Maya phase machine (P2), blueprint draft (P1), skip-Maya escape hatch (P1)

**Pitfalls addressed inline:** "Looks good but..." false handoff (Pitfall 2), phase regression race condition (Pitfall 3), skip-Maya bypasses brain init (Pitfall 21), blueprint echoing user words (Pitfall 20)

**Research flag:** The handoff intent classifier needs a 20-example test suite (paraphrases + qualifications) built during implementation. Standard LangGraph patterns — no research phase needed.

---

### Phase 30: Deliverable Feedback Loop + Graceful LLM Degradation

**Rationale:** Two independent features that can ship in parallel. Deliverable feedback closes the v2.0 loop (small schema addition already in Phase 28 migration). Graceful degradation is bug-class fix that should ship as soon as the SDK migration is stable.

**Delivers:**
- Deliverable feedback: `userAcceptedAt`, `userDismissedAt`, `editsCount`, `lastIteratedAt` on `deliverables`; Accept/Dismiss endpoints; buttons in `ArtifactPanel.tsx`; `editsCount` incremented on iterate
- Impression tracking: `IntersectionObserver` `deliverable_impression` event so funnel data is interpretable
- Graceful degradation: error classification (`RATE_LIMIT`, `AUTH_FAILURE`, `SERVER_ERROR`, `TIMEOUT`) in `providerResolver.ts`; typed `ALL_PROVIDERS_EXHAUSTED`; two new `streaming_error` codes; `providersOffline` state; non-blocking banner in `CenterPanel.tsx`; "Using backup AI" vs "temporarily unavailable" message distinction

**Features addressed:** Deliverable feedback signal (P2), graceful LLM degradation UX (P1)

**Pitfalls addressed inline:** Rate limit shown as unavailable (Pitfall 17), deliverable survivorship bias (Pitfall 19)

**Research flag:** Standard patterns — extensions of existing code. No research needed.

---

### Phase 31: Cross-Project User Preferences

**Rationale:** Additive — nothing blocks on it, but improves every subsequent interaction. Building after phase machine is stable means the `[[PREFERENCE:]]` extraction has a working context.

**Delivers:**
- `[[PREFERENCE:]]` action block parser and storage write
- `USER PREFERENCES` prompt section injection in `openaiService.ts`
- Preference inference after first project completion via Groq extraction
- Project-type scoping: `projectType` tag on preferences to prevent casual context bleeding into formal work
- Preference sanitization: structured allowlists for enum fields; free-text `additionalContext` max 200 chars; injected as user-context block, never system role

**Features addressed:** Cross-project user preferences (P3)

**Pitfalls addressed inline:** Prompt injection via stored preferences (Pitfall 7 — sanitization mandatory on initial implementation), casual context bleeding (Pitfall 8)

**Research flag:** OWASP LLM01 test coverage required before ship. Consider a brief security review pass.

---

### Phase 32: Dynamic Team Formation

**Rationale:** Depends on blueprint (Phase 29) for `whatBuilding` keywords and benefits from user preferences (Phase 31) for role bias.

**Delivers:**
- `teamRecommender.ts`: `rankAgentsForProject()` using Gemini embedding cosine similarity; pre-computed role embeddings on server startup; hash-based invalidation when `roleRegistry.ts` changes
- `storage.recommendDynamicTeam()` replaces "add all 30 agents" for freeform projects
- `TeamRecommendationCard` with 1-sentence rationale per role
- Exploration role: top-3 similarity + 1 "you might also consider" to avoid deterministic output
- Small jitter (±0.05) on similarity scores

**Features addressed:** Dynamic team recommendation (P2)

**Pitfalls addressed inline:** Deterministic team selection (Pitfall 9 — jitter + exploration role from day one), stale role embeddings (Pitfall 10 — hash invalidation from day one)

**Research flag:** Verify `@langchain/google-genai` compatibility with `@google/genai` SDK post-migration before planning begins.

---

### Phase 33: Per-Run Cost Visibility

**Rationale:** `autonomy_events.costCents` column is already in schema from Phase 28. This phase wires population logic and UI display.

**Delivers:**
- `eventLogger.ts` populates `costCents` from `usageTracker.estimateCostCents()`
- `taskExecutionPipeline.ts` emits `autonomy_run_cost` WS event with `SUM(cost_cents) WHERE trace_id = X`
- `ActivityTab.tsx` renders per-run cost inline
- Pro users see quota framing ("47 of 50 runs remaining"), not dollar amounts

**Features addressed:** Per-run cost trail (P2)

**Pitfalls addressed inline:** Cost display causing loss aversion (Pitfall 18 — quota framing mandatory from day one)

**Research flag:** Standard extension of existing modules. No research needed.

---

### Phase 34: Agent Disagreement Surfacing (defer to v3.2 if scope is tight)

**Rationale:** Highest-risk Pillar B feature. Three separate pitfalls, requires confidence scoring tuning that needs production data, must not touch the existing peer review path. Defer to v3.2 if v3.0 milestone is running long.

**Delivers (if in scope):**
- `disagreementDetector.ts`: claim extraction from actual agent outputs; grounded in source quotes — never fabricated
- Post-processing step after `streaming_completed` — never inline during streaming
- `deliberation_card` WS event; `DisagreementCard` with source quotes
- Threshold gates: risk >= 0.45 AND confidence delta >= 0.30; max 2 disagreement cards per session
- Complexity gate: task complexity score > 0.7 AND >= 2 relevant agents before parallel calls

**Features addressed:** Agent disagreement surfacing (P3)

**Pitfalls addressed inline:** Manufactured disagreement (Pitfall 11 — grounded extraction non-negotiable), decision fatigue (Pitfall 12), cost explosion from parallel calls (Pitfall 13)

**Research flag:** This phase NEEDS `/gsd:research-phase` before planning. Confidence scoring calibration and claim-extraction prompt design have no established patterns in the codebase.

---

### Phase 35: Project Milestones / Definition-of-Done (defer to v3.2 if scope is tight)

**Rationale:** `milestones` table already in schema from Phase 28. Main work is CRUD routes, right-sidebar display, and Maya proposing milestones in blueprint draft (Phase 29 dependent).

**Delivers:**
- `milestones.ts` route module with full CRUD
- `promptTemplate.ts` milestone wiring (the `projectMilestones` prop already exists as empty string, just needs real data)
- Maya proposes 2-3 milestones in blueprint draft
- Milestone completion: computed from linked tasks, never stored

**Features addressed:** Project milestones (P3)

**Research flag:** Standard patterns. No research needed.

---

### Phase Ordering Rationale

The sequence is driven by three organizing principles. Dependencies come first: SDK migration unlocks timeout fix; timeout fix unblocks user testing; MVB gate unblocks phase machine; blueprint unblocks team formation and milestones. Schema is batched: all 5 additions in one migration at Phase 28 to minimize operational risk. High-risk features last: disagreement surfacing and milestones have the most unknowns and least urgency.

Bug fixes ship out-of-band. The Maya infinite-thinking fix is the prerequisite for any user-facing testing and must not wait for the phase structure.

---

### Research Flags

**Needs `/gsd:research-phase` during planning:**
- Phase 34 (Disagreement Orchestration) — no established pattern for claim extraction + cross-agent semantic comparison; confidence scoring calibration requires production data; three separate pitfalls with no existing mitigation

**Can proceed with standard planning (no research phase needed):**
- Phase 28 — Drizzle additions + prompt injection: well-established codebase patterns
- Phase 29 — LangGraph conditional edges: documented; validation needed is a 20-example classifier test suite, not research
- Phase 30 — Extensions of existing `deliverables.ts` and `providerResolver.ts`
- Phase 31 — Needs OWASP LLM01 test coverage, not architecture research
- Phase 32 — Gemini Embedding API is well-documented; verify `@langchain/google-genai` compatibility post-SDK-migration
- Phase 33 — Pure extension of `usageTracker.ts` + `activityTab`
- Phase 35 — Standard Drizzle + route module pattern

---

## Hard Dependencies vs. Nice-to-Haves

### Hard dependencies (block shipping or break downstream features if skipped)

| Dependency | What It Blocks |
|------------|----------------|
| `@google/genai` SDK migration | Timeout fix, team formation embeddings, all new Gemini features |
| Maya infinite-thinking bug fix | User testing, any realistic feedback loop |
| `conversations.mayaPhase` DB column | Phase machine, phase regression guard, multi-session continuity |
| Background `coreDirection` extraction | MVB gate (gate reads DB fields; fields only update via extraction or action blocks) |
| Blueprint draft + confirmation UX | Dynamic team recommendation, phase handoff trigger |
| Deliverable feedback columns in schema (Phase 28) | Milestone completion tracking if milestones count accepted deliverables |

### Nice-to-haves (deferrable to v3.1/v3.2 without breaking the core)

| Feature | Deferral Cost |
|---------|---------------|
| Full LangGraph phase machine node | Prompt engineering gets 80% of value; LangGraph adds robustness at scale |
| Dynamic team recommendation | Starter packs continue to work; freeform projects get no recommendation |
| Cross-project user preferences | Every feature works without it; adds polish not function |
| Per-run cost visibility | ActivityTab still shows event data; UsageBar still works |
| Agent disagreement surfacing | Existing peer review silently resolves disagreements; surfacing is additive |
| Project milestones | Tasks continue to work; milestone is a goal layer, not blocking task creation |

---

## Open Questions for User to Answer Before Requirements Definition

1. **Discovery question budget:** PROJECT.md says "≤3 questions per topic." Does this mean 3 questions max per message (hard cap), or 3 questions per topic category (Features / Visuals / Tech = up to 9 total across 3 turns)? This affects the discovery prompt design directly.

2. **Blueprint confirmation mechanism:** Should the explicit button be the ONLY handoff trigger, or should intent-detected affirmations ("ship it", "yes", thumbs-up) also work? Research recommends button as primary with keyword detection as secondary.

3. **User preference inference timing:** Research recommends inferring preferences after first project completion, not at onboarding. Is there a specific moment you want an explicit preference setup UI, or should it be entirely inferred?

4. **Disagreement surfacing in v3.0 or deferred:** Research puts this in v3.2 territory due to complexity, but PROJECT.md includes it in Pillar B scope. Is this a v3.0 hard requirement or can it be deferred without affecting the milestone's user-facing goals?

5. **Skip-Maya form design:** The quick-fill form for MVB fields on the skip-Maya path — 3 labeled text fields (reliable), or a single freeform box the system extracts into 3 fields (more on-brand)? Direct form is more reliable; freeform box feels more natural to the anti-prompting philosophy.

6. **Team formation as replacement vs. suggestion:** Should dynamic team recommendation replace the "show all 30 agents" default for freeform projects, or sit alongside it as a suggestion the user can override?

7. **Cost display for Free-tier users:** Should Free-tier users see raw cost figures (to create upgrade motivation) or quota framing? Research recommends dollar framing only for Free-tier upsell, quota framing for Pro.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | SDK migration is a verified EOL event with documented API differences. All other decisions use already-installed packages. One MEDIUM sub-item: `@langchain/google-genai` compatibility with new SDK needs a post-migration verification step. |
| Features | HIGH | All patterns verified against live competitor docs (Replit Agent, ChatGPT Custom Instructions, Cursor, Linear). Feature prioritization grounded in direct user testing feedback. |
| Architecture | HIGH | All integration points verified by direct code inspection of `openaiService.ts`, `chat.ts`, `providerResolver.ts`, `geminiProvider.ts`, `schema.ts`, `storage.ts`. One uncertainty: `graph.ts` referenced in CLAUDE.md may not exist as a standalone file — routing logic confirmed in `conductor.ts` and `openaiService.ts` instead. |
| Pitfalls | HIGH | Architecture-specific pitfalls derived from codebase inspection and production failure patterns. MVB false negative (Pitfall 6) is the highest-risk gap specific to this codebase — not obvious from the feature description, requires background extraction built alongside the gate. |

**Overall confidence: HIGH**

### Gaps to Address

- `@langchain/google-genai` SDK compatibility: After migrating to `@google/genai`, verify whether the LangChain Google integration package references the new or old SDK. If it pins the old SDK internally, there may be a version conflict. Check immediately post-migration.

- `graph.ts` existence: Architecture research notes that `graph.ts` referenced in CLAUDE.md may not exist as a standalone file — routing confirmed in `conductor.ts` and `openaiService.ts`. Confirm actual entrypoint for LangGraph state machine changes before Phase 29 planning.

- Gemini TTFT p95 baseline: The current fallback threshold (3s) is wrong, but the correct threshold depends on actual p95 TTFT for Gemini 2.5-Flash on this workload. Add TTFT logging in the bug fix phase to establish a real baseline before the threshold is locked.

- Discovery completion rate measurement: There is currently no telemetry for how many discovery conversations reach the blueprint phase. Before Phase 28 ships, add a `discoveryCompleted` event to `autonomy_events` so there is a baseline to measure improvement against.

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection: `shared/schema.ts`, `server/ai/openaiService.ts` (lines 1-500), `server/ai/conductor.ts`, `server/llm/providerResolver.ts`, `server/llm/providers/geminiProvider.ts`, `server/routes/chat.ts` (lines 198-986), `server/storage.ts` (lines 734-852), `server/ai/promptTemplate.ts`
- [Google deprecated-generative-ai-js repo](https://github.com/google-gemini/deprecated-generative-ai-js) — EOL November 30, 2025; archived December 16, 2025
- [Gemini API migration guide](https://ai.google.dev/gemini-api/docs/migrate) — new SDK API differences
- [AbortSignal.timeout() — MDN](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static) — Node 18+ built-in
- [AbortController unhandled rejection bug #303](https://github.com/google-gemini/deprecated-generative-ai-js/issues/303) — deprecated SDK bug, unresolved
- [OWASP LLM01 stored prompt injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/) — preference injection attack vector
- [Replit Agent docs](https://docs.replit.com/replitai/agent) — discovery-to-execution pattern, blueprint confirmation UX
- [ChatGPT Custom Instructions](https://help.openai.com/en/articles/8096356-chatgpt-custom-instructions) — cross-session user preference pattern

### Secondary (MEDIUM confidence)
- [WEF — Rethinking UX in the age of multi-agent AI](https://www.weforum.org/stories/2025/08/rethinking-the-user-experience-in-the-age-of-multi-agent-ai/) — disagreement surfacing as "contested semantic region" signal
- [Gemini Embedding API pricing](https://ai.google.dev/gemini-api/docs/pricing) — $0.15/M tokens for gemini-embedding-001
- [LangGraph JS conditional edges](https://medium.com/the-guy-wire/learning-langgraph-js-part-2-conditional-edges-4672c35ff42f) — addConditionalEdges pattern
- [AI UX graceful degradation patterns](https://www.aiuxdesign.guide/patterns/error-recovery) — typed error codes, inline messages
- [Portkey — LLM circuit breakers](https://portkey.ai/blog/retries-fallbacks-and-circuit-breakers-in-llm-apps/) — rate limit classification
- [MDPI — User psychological perception of LLM pricing](https://www.mdpi.com/0718-1876/20/3/241) — loss aversion from per-use cost display
- [Baymard Institute via SaasFactor](https://www.saasfactor.co/blogs/why-users-drop-off-during-onboarding-and-how-to-fix-it) — form abandonment rates

### Tertiary (LOW confidence)
- [arXiv 2604.03796](https://arxiv.org/pdf/2604.03796) — multi-agent disagreement as contested semantic region (academic, not production-validated)
- [Transformers.js v4 release notes](https://github.com/huggingface/transformers.js/releases/tag/4.0.0) — local ONNX model cold-start timing (release notes, not independently benchmarked)
- [GitHub Node.js Issue #52203](https://github.com/nodejs/node/issues/52203) — AbortController memory leak pattern

---

*Research completed: 2026-04-25*
*Ready for roadmap: yes — Phases 28-35 can proceed to requirements definition after the 7 open questions above are answered*
*Pillar A (Phases 22-27) is preserved and unaffected by this research*
