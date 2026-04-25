# Feature Research: Pillar B — Maya Reliability & Teamness

**Domain:** AI-native multi-agent project collaboration platform — conversational onboarding, structured discovery, agent coordination UX
**Researched:** 2026-04-25
**Confidence:** HIGH (real-world precedent verified for most features; patterns from Replit Agent, ChatGPT, Cursor, Linear confirmed via official docs)

---

## Feature Landscape

### Table Stakes (Users Expect These)

These are the features where the current product is broken or conspicuously missing relative to what any competent AI chat tool provides. Users notice their absence immediately — they create the "does this even work?" reaction.

| Feature | Why Expected | Complexity | Existing Module | Notes |
|---------|--------------|------------|-----------------|-------|
| **LLM timeout + clean error recovery** | Every production AI tool (Cursor, ChatGPT, Replit) shows a clean inline error, never hangs forever. A spinner that never resolves is worse than a red message. | S | `server/routes/chat.ts`, `server/llm/providerResolver.ts` | Add `AbortController` with configurable timeout (30s default); on timeout emit `streaming_error` WS event with user-readable message. Kill the "out for lunch" fallback path entirely. This is a 1–2 day fix not a phase. |
| **Single-turn cleanup ("thinking" state)** | Stateful spinners that don't resolve are a cardinal UX sin. Users re-send, double-post, and assume the product is broken. | S | `client/src/components/CenterPanel.tsx`, streaming WS event handling | On timeout or error, force-clear all active `isStreaming` flags and emit `streaming_cancelled`. Ensure cleanup runs even if stream never starts. |
| **Graceful "LLM down" UX** | ChatGPT shows "ChatGPT is at capacity" inline. Cursor shows a non-breaking notice. No product shows raw 500 HTML. Pattern: plain-language inline message, user work preserved, retry option. | S | `server/llm/providerResolver.ts`, `client/src/components/MessageBubble.tsx` | Map all provider errors to typed error codes (`llm_unavailable`, `llm_timeout`, `llm_rate_limited`). Frontend shows inline "Hatches are unavailable right now — your message is saved" card. |
| **Skip-Maya escape hatch** | Power users know what agents they need. Forcing onboarding on them feels condescending. Every mature SaaS (Notion, Linear, GitHub) has an "advanced" or "skip" path. | S | `client/src/pages/onboarding.tsx`, `client/src/components/WelcomeModal.tsx` | "Skip to my team" link that bypasses discovery, creates project with no brain pre-fill, drops user directly into team chat. One database flag: `user.skipMayaOnboarding`. |
| **Bounded discovery (≤3 questions per topic)** | "Maximum 1 question per reply" is already a prompt rule. The failure mode is Maya asking 1 question, getting an answer, then asking another question in the next turn — resulting in 10 sequential single questions. Users expect batch intake. Replit Agent shows a task list before building; ChatGPT custom instructions collects everything at signup. | M | `server/ai/promptTemplate.ts`, `server/routes/chat.ts`, Maya's system prompt | Enforce question budget in Maya's system prompt: "You may ask at most ONE grouped intake message. List all open questions across Features/Visuals/Tech as a single message. After that single intake, synthesize and continue." This is prompt engineering primarily, with a turn-counter guard in `openaiService.ts`. |
| **Blueprint draft before handoff** | Replit Agent shows an explicit plan ("here's the task list, Accept or Revise") before writing code. Users need a summary to confirm before Hatches start working. Without this, execution feels arbitrary. | M | `server/ai/promptTemplate.ts`, `server/routes/projects.ts`, new `server/ai/blueprintGenerator.ts` | After discovery, Maya produces a structured project brief: name, what's being built, who it's for, first 3 suggested tasks, recommended team. User sees `BlueprintCard` in chat. "Looks good" → triggers handoff. |
| **Minimum-viable-brain gate** | Without a stopping condition, Maya interrogates indefinitely. The gate is a required schema: `whatBuilding` + `whoFor` + `whyMatters` (3 fields). Only these 3 matter for routing. Once filled, Maya exits discovery. | S | `server/routes/projects.ts`, `shared/schema.ts` (`projects.coreDirection`), Maya's system prompt | These fields already exist in `projects.coreDirection` JSONB. Gate logic: after each Maya turn, check if all 3 non-empty → if yes, transition to blueprint phase. No new schema needed. |

**Complexity legend:** S = Small (1–3 days), M = Medium (3–7 days), L = Large (1–2+ weeks)

---

### Differentiators (Competitive Advantage)

These are features no competitor does well for a multi-agent, personality-driven collaboration platform. They require Hatchin's specific architecture to be meaningful.

| Feature | Value Proposition | Complexity | Existing Module | Notes |
|---------|-------------------|------------|-----------------|-------|
| **Maya conversation phase machine (discovery → blueprint → handoff)** | ChatGPT has no project phases — it just chats. Replit Agent uses Plan mode but it's manual. Hatchin can be the first AI product that runs a bounded, automatic discovery protocol then *stops and transfers control* without user prompting. This directly addresses the "never gets started" complaint. | M | `server/ai/graph.ts` (LangGraph state machine), `server/routes/chat.ts`, `shared/schema.ts` | Add `mayaPhase` field to `projects` (`discovery` / `blueprint` / `active`). LangGraph adds a `phase_gate_node` that reads current phase, routes Maya's responses through phase-appropriate prompt templates. Phase transitions emit WS event `maya_phase_changed`. |
| **Structured bulk discovery: categorized questions once** | No AI product today collects all discovery questions in a single categorized intake. ChatGPT custom instructions is closest — two fields, one shot. Maya's equivalent: one message with 3–5 questions grouped as Features / Visuals / Tech. Never sends a follow-up intake question. This resolves the top user complaint. | M | `server/ai/promptTemplate.ts`, Maya system prompt, `mayaPhase === 'discovery'` branch | Discovery prompt instructs Maya: "Ask all open questions as one grouped message with category headers. Maximum 5 questions total. Do not ask follow-ups. The user's answers are enough to continue." Pair with `discoveryTurnCount` guard: if turn > 2, force-advance to blueprint regardless. |
| **Cross-project user preference profile** | ChatGPT Custom Instructions is global across all chats. Cursor uses `.cursorrules` per repo. Neither transfers user personality across projects automatically. Hatchin can learn "technical founder who wants terse, no-fluff responses" once and apply it everywhere. | M | `shared/schema.ts` (new `userPreferences` table or `users.preferences` JSONB), `server/ai/promptTemplate.ts` | New JSONB column `users.preferences`: `{tone, verbosity, role, technicalDepth, workingStyle}`. After first project, a short preference-capture step (5 quick questions or inferred from chat style). Injected into every agent prompt as a `USER CONTEXT` block. Inference via post-chat analysis after 10+ messages. |
| **Dynamic team recommendation (freeform projects)** | Linear suggests project templates based on team type. Notion suggests page templates contextually. No AI product recommends the *right 3–4 agents* based on what you described. Currently Hatchin either uses starter packs (opinionated) or adds all 30 (overwhelming). | M | `server/ai/expertiseMatching.ts`, `server/routes/projects.ts`, `client/src/components/QuickStartModal.tsx` | After blueprint phase, Maya recommends 3–4 roles with a 1-sentence rationale per role ("You mentioned design — Cleo handles UI/UX. You mentioned growth — Kai handles marketing strategy."). User sees `TeamRecommendationCard`, can add/remove before confirming. Uses `expertiseMatching.ts` scoring against `whatBuilding` + `whoFor` keywords. |
| **Agent disagreement surfacing as user decision** | Multi-agent systems typically hide disagreement (voting/mediation silently resolves it). Research confirms that persistent agent disagreement signals a "contested semantic region" where humans should decide. Hatchin uniquely has agents with defined domains and opinions — surfacing real disagreements is authentic to the brand. | L | `server/autonomy/peerReview/peerReviewRunner.ts`, `server/autonomy/conductor/`, `shared/dto/wsSchemas.ts` | Only surface when stakes are high (risk ≥ 0.45) AND agents reach genuinely different conclusions (not minor phrasing diff). Threshold: confidence delta ≥ 0.30 between agents. Emit `agent_disagreement` WS event → `DisagreementCard` in chat with both positions and "Which direction?" CTA. Low-stakes disagreements are resolved internally via existing peer review. |
| **Project goal/milestone layer (definition of done)** | Linear milestones are issue-based. Asana goals are strategic. Neither is conversation-native. Hatchin can generate milestones *from the blueprint* automatically, tracking them via task completion. Gives users the "are we there yet?" signal they need to know when a project phase is done. | M | `shared/schema.ts` (new `milestones` table), `server/routes/tasks.ts`, `client/src/components/sidebar/TasksTab` (BrainDocsTab) | New `milestones` table: `id, project_id, title, description, target_date, completion_pct (derived from linked tasks)`. Maya proposes 2–3 milestones in the blueprint draft. Completion % auto-calculated from linked task statuses. Milestone progress visible in the Tasks tab right sidebar. |
| **Deliverable accept/edit/dismiss feedback signal** | Notion AI tracks if you kept or deleted AI-generated content implicitly. Cursor tracks file acceptance. Neither is explicit for multi-agent deliverable chains. Hatchin can close the loop: if Alex's PRD was dismissed, don't chain the tech spec. If it was accepted, inject it upstream. | S | `server/routes/deliverables.ts`, `shared/schema.ts` (`deliverables` table), `server/ai/deliverableChainOrchestrator.ts` | Add `userAction` enum column to `deliverables`: `accepted | edited | dismissed | pending`. `ArtifactPanel` "Accept" button sets `accepted`, close without action = `dismissed` after 24h. Chain orchestrator reads `userAction` before injecting upstream context: only inject `accepted` or `edited` deliverables. |
| **Per-autonomy-run cost trail** | Replit Agent shows cost per checkpoint as a first-class UI element ("< $0.25 per checkpoint"). OpenAI Playground shows token count in Logs. Both show cost as a trust signal, not a warning. 65% of IT leaders report surprise charges from AI platforms — visibility prevents churn. | M | `server/billing/usageTracker.ts`, `server/autonomy/events/eventLogger.ts`, `client/src/components/sidebar/ActivityTab` | Add `llmCost` (cents, integer) to `autonomy_events`. After each background execution, emit `autonomy_run_completed` WS event with `{taskTitle, agentName, costCents, tokensUsed}`. ActivityFeed renders cost inline: "Kai drafted the growth update · 3¢". Monthly total in UsageBar tooltip. |

---

### Anti-Features (Deliberately Omit)

Features that seem related but would damage the product if built.

| Feature | Why Requested | Why Problematic | What to Do Instead |
|---------|---------------|-----------------|-------------------|
| **Showing raw token counts to users** | Developers want it for debugging; power users want it for cost control. | Token counts mean nothing to non-technical users ("1,247 tokens" is not legible). It commoditizes the product — users start comparing token efficiency instead of project value. | Show cost in cents/dollars only. Show this in the Activity feed (per-run) and UsageBar (monthly total). Token counts available in admin/debug view only. |
| **Requiring all 3 brain fields before ANY agent responds** | Feels thorough — agents should have full context. | Creates a hard wall: users can't interact with any agent until the gate is satisfied. If Maya fails to elicit `whyMatters`, the entire product is blocked. Users will abandon. | Gate is soft: agents can respond with partial brain, but Maya stays in discovery phase. The gate only controls phase *transition*, not agent *access*. |
| **Agent disagreement on every topic** | Feels authentic — "my team has opinions!" | Users don't want a debate at every turn. If Alex and Cleo disagree about button color, surfacing it is noise. Over-surfacing disagreement trains users to ignore it. | Gate on risk threshold (≥ 0.45) AND confidence delta (≥ 0.30). Let peer review silently resolve low-stakes differences. Only escalate when both agents are confident AND divergent AND stakes matter. |
| **Fully automatic Maya phase transitions (no user confirmation)** | Seems efficient — if all brain fields are filled, just proceed. | Users need to feel in control of when the project "starts." A surprise transition to "active" mode when they're still exploring feels jarring. | Blueprint card requires explicit confirmation ("Looks good, let's go" button or equivalent). Phase machine uses user confirmation as the gate signal, not automatic timer. |
| **User preference profile as a mandatory onboarding step** | Captures preferences early. | Adding another form to onboarding reduces activation. The preference step should feel earned, not mandatory. First project should just work. | Infer preferences from conversation (after 10+ messages, extract tone/style patterns via LLM). Only show explicit preference form for users who've completed one full project. |
| **Per-message cost display in the main chat thread** | Transparency. | Would make every message feel transactional. Damages the "talking to a colleague" feel that is Hatchin's core brand promise. | Cost belongs in the Activity feed (autonomy runs only) and UsageBar (aggregate). Regular chat turns are "free feeling" — the cost is bundled in the subscription, not per-turn. |
| **Maya asking clarifying questions about preferences (tone, verbosity)** | Personalization. | Maya asking "How would you like me to communicate?" is an AI-speak question that breaks the teammate illusion. Real colleagues don't ask this. | Infer from first 3–5 turns. After inference, apply. Never ask explicitly. The exception: if tone changes significantly across sessions, quietly adapt — never announce it. |

---

## Feature Dependencies

```
[LLM Timeout Fix] (S)
    └──unblocks──> [Clean error recovery] (S)
                       └──unblocks──> [Graceful LLM down UX] (S)

[Minimum-viable-brain gate] (S)
    └──enables──> [Maya phase machine] (M)
                      └──enables──> [Structured bulk discovery] (M)
                                        └──enables──> [Blueprint draft] (M)
                                                           └──enables──> [Dynamic team recommendation] (M)

[Blueprint draft] (M)
    └──enables──> [Project milestones layer] (M)
                      └──enhances──> [Deliverable feedback signal] (S)

[Cross-project user preference profile] (M)
    └──enhances──> [Maya phase machine] (M)  (preferences injected into discovery prompt)
    └──enhances──> [Dynamic team recommendation] (M) (preferred working style affects role ordering)

[Per-autonomy-run cost trail] (M)
    └──requires──> [autonomy_events.llmCost column] (already in eventLogger, needs llmCost field)
    └──enhances──> [ActivityTab] (v1.3, already exists)

[Agent disagreement surfacing] (L)
    └──requires──> [peerReviewRunner.ts confidence scoring] (already partially exists)
    └──requires──> [DisagreementCard component] (new)
    └──conflicts──> [Auto-silent peer review for low-risk decisions] (must not break existing flow)

[Skip-Maya escape hatch] (S)
    └──conflicts──> [Maya phase machine] (S → must bypass the phase machine entirely, not enter it)
```

### Dependency Notes

- **LLM timeout + clean error is a prerequisite for everything**: Until the infinite-thinking bug is fixed, every other improvement is undermined. Ship this first, in parallel with phase machine work.
- **Brain gate must exist before phase machine**: The phase machine needs an exit condition. Without the gate, it has no way to know when to transition. The gate is 2 existing JSONB fields — it's nearly free.
- **Blueprint draft before team recommendation**: Can't recommend agents until Maya knows what the project is. Blueprint is the artifact that carries `whatBuilding` + domain keywords to `expertiseMatching.ts`.
- **Deliverable feedback signal before milestone completion**: Milestones that count "accepted deliverables" need the `userAction` column. Reverse dependency means milestones must be built after deliverable feedback, or with a placeholder until feedback lands.
- **User preference profile is additive, not blocking**: Nothing else depends on it. It enhances the quality of Maya's discovery prompt and agent responses, but every feature above works without it.
- **Disagreement surfacing must not touch the existing peer review path**: The existing three-tier safety system uses peer review internally and already resolves disagreements silently for low-risk tasks. The new feature only adds a surfacing layer *above* that system for high-stakes divergence.

---

## MVP Definition for v3.0

### Land in v3.0 (Pillar B Must-Haves)

These directly address the critical user complaint ("Maya never stops asking questions, project never starts") and the reported bugs.

- [ ] **LLM timeout + "thinking" state cleanup** — Bug fix. Ship in first week. The product appears broken without this.
- [ ] **Graceful LLM down UX** — Bug fix. Users see "out for lunch" message currently. Inline error card instead.
- [ ] **Minimum-viable-brain gate** — Near-zero implementation cost. Fields exist. Logic is 10 lines. Unlocks everything else.
- [ ] **Bounded discovery: bulk categorized questions once** — Prompt engineering primarily. Makes Maya usable. Resolves top complaint.
- [ ] **Blueprint draft before handoff** — Replit Agent's Plan Mode pattern. Users see a project summary and confirm before Hatches start.
- [ ] **Skip-Maya escape hatch** — Single flag + link. Power users need it immediately.
- [ ] **Deliverable accept/edit/dismiss feedback signal** — Small schema addition. Closes the loop on v2.0 deliverables.

### Add After Validation (v3.1)

- [ ] **Maya phase machine (full LangGraph node)** — Required for robustness at scale, but discovery prompt engineering gets 80% of the value first
- [ ] **Dynamic team recommendation** — Needs blueprint draft working first. High value but dependent.
- [ ] **Per-autonomy-run cost trail** — Needs `llmCost` column in `autonomy_events`. Medium effort, high trust signal.
- [ ] **Cross-project user preference profile** — Medium effort, adds polish. Not blocking.

### Defer to v3.2+

- [ ] **Project goal/milestone layer** — Depends on blueprint + deliverable feedback both working. Meaningful but not urgent.
- [ ] **Agent disagreement surfacing** — Large effort. Requires confidence scoring tuning to avoid false positives. Defer until peerReviewRunner has more production data.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Category |
|---------|------------|---------------------|----------|----------|
| LLM timeout + thinking cleanup | HIGH (bug = product broken) | LOW | P1 | Bug fix / table stakes |
| Graceful LLM down UX | HIGH (raw errors destroy trust) | LOW | P1 | Bug fix / table stakes |
| Skip-Maya escape hatch | HIGH (power users blocked) | LOW | P1 | Table stakes |
| Minimum-viable-brain gate | HIGH (enables phase machine) | LOW | P1 | Table stakes |
| Bounded discovery / bulk questions | HIGH (top complaint) | LOW-MEDIUM | P1 | Table stakes |
| Blueprint draft before handoff | HIGH (users need confirmation) | MEDIUM | P1 | Table stakes + differentiator |
| Deliverable feedback signal | MEDIUM (closes v2.0 loop) | LOW | P2 | Differentiator |
| Maya phase machine (LangGraph node) | HIGH (robustness) | MEDIUM | P2 | Differentiator |
| Dynamic team recommendation | HIGH (reduces overwhelm) | MEDIUM | P2 | Differentiator |
| Per-run cost trail | MEDIUM (trust signal) | MEDIUM | P2 | Differentiator |
| Cross-project user preferences | MEDIUM (polish) | MEDIUM | P3 | Differentiator |
| Project milestones layer | MEDIUM (project management) | MEDIUM | P3 | Differentiator |
| Agent disagreement surfacing | MEDIUM (brand-authentic) | HIGH | P3 | Differentiator |

---

## Competitor Pattern Analysis

### Replit Agent — Discovery-to-Execution Pattern

**Pattern:** Freeform description → optional Plan Mode → explicit task list with "Accept tasks" / "Revise plan" buttons → execution with per-checkpoint rollback.

**What to take:** The explicit approval gate. Users see a structured plan *before* work starts, confirm it, and can revise. This maps directly to Hatchin's blueprint draft.

**What not to take:** Replit's plan is a technical task list. Hatchin's blueprint should be a *project narrative* (what, why, who) + 3 initial tasks + team recommendation. More contextual, less mechanical.

**Cost visibility:** Replit shows cost per checkpoint ("< $0.25"). Hatchin should show cost per autonomy run in the Activity feed — same trust signal, different placement.

Source: https://docs.replit.com/replitai/agent

### ChatGPT Custom Instructions — User Preference Pattern

**Pattern:** Two-field form ("What should ChatGPT know about you?" + "How should it respond?") set once, persists globally across all conversations. As of 2025: tone, warmth, emoji usage, formatting preferences are adjustable via settings UI and applied session-wide.

**What to take:** Persistent preferences that apply globally without re-entry. Hatchin's equivalent: `users.preferences` JSONB, set after first project, injected into every agent prompt.

**What not to take:** Explicit form at onboarding. ChatGPT can ask because users arrive with setup intent. Hatchin users arrive with project intent — an extra form creates friction. Infer instead.

Source: https://help.openai.com/en/articles/8096356-chatgpt-custom-instructions

### Cursor — Context Engineering Pattern

**Pattern:** Layered context (`.cursorrules` always-present → Notepads → @Docs → @Files → current conversation). Users control context precisely via @-symbols rather than global state.

**What to take:** The idea that different context has different persistence layers. In Hatchin: `users.preferences` (global) → `projects.brain` (project-level) → `messages` history (conversation-level). Already partially implemented. Make the layering explicit in prompt injection.

**What not to take:** Per-project rules file. Users shouldn't have to write `.cursorrules` equivalents — Maya should extract this automatically into the brain.

Source: https://docs.cursor.com/guides/working-with-context

### Linear Milestones — Definition-of-Done Pattern

**Pattern:** Milestones are containers of issues. Completion % = issues-in-completed-status / total-issues. Visual: diamond icon changes state; yellow icon = currently focused milestone; % visible in project sidebar.

**What to take:** Milestone completion derived automatically from linked tasks (no manual "mark done" required). Hatchin can mirror this: milestone completion % = completed tasks linked to milestone / total tasks linked. Auto-calculates; never requires user input.

**What not to take:** Issue-based structure (Linear issues ≠ Hatchin tasks conceptually). Keep Hatchin's task model; just add `milestone_id` FK to `tasks` table.

Source: https://linear.app/docs/project-milestones

### Graceful Degradation — Production AI Pattern

**Pattern (community consensus):** 5 provider failures trip circuit breaker → 60s cooldown → alert at >5% error rate. Never show raw HTTP errors. Show: plain-language inline message + confirmation that work is saved + retry option. Hierarchy: Full AI → Simplified AI → Rule-based response → Human escalation.

**What to take:** Typed error codes emitted via WS, frontend renders a non-scary inline card, user message is preserved (already true in Hatchin). Add the retry button.

**What not to take:** Multi-tier degradation to rule-based responses. Hatchin has no rule-based fallback and doesn't need one — if LLM is down, honest "we're unavailable" is better than fake rule-based output.

Source: https://www.aiuxdesign.guide/patterns/error-recovery, https://www.buildmvpfast.com/blog/building-with-unreliable-ai-error-handling-fallback-strategies-2026

### Multi-Agent Disagreement — Academic + WEF Pattern

**Pattern:** Persistent agent disagreement = a signal that content is in a "contested semantic region where humans would also disagree." Best resolution: show both positions to user when stakes are high; let majority/mediator resolve silently when stakes are low.

**What to take:** Gate disagreement surfacing on: (a) confidence delta ≥ 0.30 between agents AND (b) risk score ≥ 0.45. Below threshold = silent resolution via existing peer review. Above = `DisagreementCard` with both positions.

**Hatchin differentiator:** Other platforms hide all disagreement. Hatchin's agents have distinct personalities — surfacing genuine technical vs. creative disagreements is *authentic to the product*, not a bug. It makes agents feel like real teammates.

Source: https://www.weforum.org/stories/2025/08/rethinking-the-user-experience-in-the-age-of-multi-agent-ai/

---

## Exit Signal for Maya Phase 2 → Phase 3

The question: what's the right signal to advance from blueprint to active?

**Research finding:** Replit uses explicit "Accept tasks" / "Revise plan" buttons — binary, unambiguous. ChatGPT Custom Instructions uses a Save button. Linear uses task status changes.

**Recommendation for Hatchin:** Three acceptable signals, in order of preference:

1. **Explicit button on BlueprintCard** — "Looks good, start the project" button. Unambiguous. No NLP required. This is the primary path.
2. **Intent-detected affirmations** — "looks good", "go", "let's do it", "ship it", "yes", thumbs-up reaction on the BlueprintCard message. Detected via simple keyword list, not LLM (zero cost, zero latency).
3. **Timeout auto-advance** — If user hasn't interacted for 2 hours after blueprint was shown, advance to active. This reuses the inactivity trigger pattern already in `inactivityAutonomyEnabled`. Optional: disable by default, configurable.

**What NOT to use:** Free-text confirmation ("type 'yes' to continue") — fragile. Automatic transition when brain fields are full — users need to see the blueprint first. LLM-parsed confirmation — adds latency and cost to what should be a simple state transition.

---

## Sources

- Replit Agent docs (plan mode, checkpoints, discovery flow): https://docs.replit.com/replitai/agent
- Replit effort-based pricing (per-checkpoint cost visibility): https://blog.replit.com/effort-based-pricing
- ChatGPT Custom Instructions (persistent cross-session preferences): https://help.openai.com/en/articles/8096356-chatgpt-custom-instructions
- OpenAI personalization controls 2025 (tone, warmth, formatting): https://www.datastudios.org/post/openai-launches-chatgpt-personalization-controls-new-tone-warmth-and-formatting-settings-for-user
- Cursor context engineering (layered context model): https://docs.cursor.com/guides/working-with-context
- Linear milestones (definition-of-done UX pattern): https://linear.app/docs/project-milestones
- AI UX graceful degradation patterns: https://www.aiuxdesign.guide/patterns/error-recovery
- LLM production error handling / fallback hierarchy: https://www.buildmvpfast.com/blog/building-with-unreliable-ai-error-handling-fallback-strategies-2026
- Multi-agent disagreement surfacing (WEF, 2025): https://www.weforum.org/stories/2025/08/rethinking-the-user-experience-in-the-age-of-multi-agent-ai/
- Agent disagreement as "contested semantic region" (arXiv, 2025): https://arxiv.org/pdf/2604.03796
- Dynamic team formation research (human-multi-agent teams): https://arxiv.org/html/2601.13865
- AI "slow" UX: batch questions before generation: https://www.uxtigers.com/post/intent-ux
- Context engineering for AI agents (Anthropic): https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents

---

*Feature research for: Hatchin v3.0 Pillar B — Maya Reliability & Teamness*
*Researched: 2026-04-25*
