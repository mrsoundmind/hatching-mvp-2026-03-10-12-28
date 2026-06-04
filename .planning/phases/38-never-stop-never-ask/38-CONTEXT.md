# Phase 38: "Never Stop, Never Ask" Autonomy Prompt — Context

**Gathered:** 2026-06-04
**Status:** Ready for planning

<domain>
## Phase Boundary

At `project.executionRules.autonomyLevel === 'autonomous'` (the rightmost dial position, shipped in v1.3's `AutonomySettingsPanel.tsx`), Hatches stop asking "should I keep going?" and commit to the chain. They make reasonable assumptions, state them explicitly, and continue without pausing for permission — mirroring how Claude (Anthropic) handles autonomous coding tasks.

**In scope:**
- Prompt-level instruction change for the `'autonomous'` level (server/ai/promptTemplate.ts + server/ai/openaiService.ts)
- Snapshot autonomyLevel at task-start boundaries so mid-run dial moves apply at next task
- Prompt-snapshot + conversation-flow test verifying level-4 Hatches don't emit clarification questions

**Out of scope:**
- Changes to the safety-gate clarification thresholds in `taskExecutionPipeline.ts` (see D-04 — explicit decision to keep safety layer independent)
- UI changes (4-level dial already shipped in v1.3)
- Schema changes (autonomyLevel already on `project.executionRules`)
- Role-specific autonomous behavior tuning (Phase 38 is the framework; per-role nuance is a Phase 47 backlog candidate if observed in production)

</domain>

<decisions>
## Implementation Decisions

### A — Prompt placement (hybrid)
- **D-01:** Generic helpfulness framing stays in `staticPrefix` (cacheable — preserves the Phase A DeepSeek 50× cache-hit input pricing on the 90% of prompt content that doesn't change between turns)
- **D-02:** Level-specific autonomy rule is appended to `dynamicSuffix` ONLY when `autonomyLevel === 'autonomous'`. A simple conditional in `buildSystemPrompt()`:
  ```
  if (autonomyLevel === 'autonomous') {
    dynamicSuffix += '\n\n<autonomous_directive>\n[Claude-style rule text]\n</autonomous_directive>';
  }
  ```
- **D-03:** Non-autonomous levels (`observe` / `propose` / `confirm`) get the existing prompt unchanged — no new rule, no new tokens. Zero regression risk for the 99% of usage at confirm-or-lower.

### B — Replacement language (Claude-style)
- **D-04:** The autonomous-mode prompt rule mirrors how Claude/Anthropic handles autonomous coding tasks. The planner drafts exact wording, but the rule MUST embody these 7 principles (lift verbatim from Claude's observed behavior):
  1. **Commit, don't hedge.** Use "I'll" not "Should I". Declarative, not interrogative.
  2. **State assumptions out loud at the start.** "I'm going with [X] based on [Y] — say so if that's wrong" — observable to the user without them having to ask.
  3. **Don't pause between subtasks.** Finish the entire chain; report back when done; don't ask for permission to continue.
  4. **No hedging filler.** Avoid "maybe", "perhaps", "I think". Be direct about choices.
  5. **Offer correction after, not permission before.** "I went with X. If you want a different angle, let me know." (post-hoc), not "Should I do X?" (pre-hoc).
  6. **When truly stuck, frame as a real binary with options.** Not "what do you want?" but "Going with X unless you prefer Y — here's why X for the moment."
  7. **Inline justification.** Brief because-clause attached to each non-obvious choice.
- **D-05:** Rule must be wrapped in clearly-delimited XML tags (`<autonomous_directive>...</autonomous_directive>`) so prompt-snapshot tests can assert presence/absence verbatim.
- **D-06:** Rule text MUST NOT contradict the staticPrefix's existing 14 response rules (e.g., "no markdown headers in chat", "no bullet point lists", "max 1 question per reply") — autonomous mode doesn't override prose quality rules, only the clarification permission.

### C — Mid-run downgrade granularity (task boundary)
- **D-07:** `autonomyLevel` snapshot is taken at the START of each task in a handoff chain or autonomous pipeline run. Snapshot persists for ALL LLM calls within that task's execution.
- **D-08:** Implementation: when `taskExecutionPipeline.ts` picks up a task (foreground chat OR pg-boss background job OR handoff continuation), it reads `project.executionRules.autonomyLevel` ONCE at task entry and passes that snapshot into every `buildSystemPrompt()` call for the duration of that task. No mid-task re-read.
- **D-09:** When a handoff fires (Hatch A → Hatch B), Hatch B's task begins fresh — it reads the current `autonomyLevel` at its start, not the snapshot Hatch A used. This is how a dial downgrade mid-chain takes effect: the in-flight Hatch A finishes under the old level, Hatch B picks up under the new level.
- **D-10:** Foreground chat (user typing a message) is treated as a NEW task per message — each user message triggers a fresh `autonomyLevel` snapshot. So a user moving the dial mid-conversation sees the new behavior on their NEXT message (not on the assistant's in-flight reply that's already streaming).

### D — Safety-gate scope (unchanged)
- **D-11:** Phase 38 changes the PROMPT only. The safety-gate thresholds in `server/autonomy/execution/taskExecutionPipeline.ts:243-245, 431-433, 484` stay exactly as they are. `clarificationRequiredRisk` (≥ 0.70), `peerReviewTrigger` (≥ 0.35), and high-risk approval gates still trigger regardless of autonomy level.
- **D-12:** Trade-off explicitly accepted: a level-4 user MAY still see occasional clarification-required pauses on legitimately high-risk operations (e.g., budget cap hit, scope-creep risk ≥ 0.70). "Never Stop, Never Ask" applies to NORMAL conversational work — the multi-tier safety system from Phase 28 (SAFE-01..04) remains the hard floor.
- **D-13:** This separation is reaffirmed in CONTEXT.md so the planner doesn't accidentally try to relax safety gates as "natural scope" — that would be a Phase 47 backlog item if observed-and-wanted, never an inline scope expansion (per saved `feedback_no_decimal_hotfixes.md`).

### Claude's Discretion
- Exact wording of the `<autonomous_directive>` block (planner drafts; constrained by the 7 principles in D-04)
- Whether to add a snapshot column on the `tasks` table to record what autonomyLevel a task ran under (useful for debugging "why did this task ask a clarification question" — but not strictly required by ALWY-01..03)
- Whether ALWY-02 test runs against a mock LLM provider (cheap, deterministic) OR a real provider in test mode (more realistic, costs tokens) — recommend mock + a separate manual smoke
- Whether to log the snapshot decision (e.g., `[Autonomy] task=<id> snapshot=autonomous`) for observability

</decisions>

<specifics>
## Specific Ideas

- "Do how Claude does it" — user direction 2026-06-04. The 7 principles in D-04 are lifted from observed Claude/Anthropic behavior patterns on autonomous coding tasks. Future readers: if you're tempted to soften these (e.g., add an escape hatch), check the user's intent first — the explicit choice was the strict version, not the soft one.
- The autonomy-rule placement decision (hybrid) chose maintenance-clarity over absolute cache economics. For an MVP at single-user scale, the few-cent cost increase per thousand messages is well below the value of having one easy-to-reason-about prompt-builder.
- The "no safety-gate relaxation" decision is load-bearing for Phase 28's SAFE-01..04 invariants. Don't touch the safety thresholds without re-opening that scope explicitly.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and requirements
- `.planning/REQUIREMENTS.md` § "Phase 38" — ALWY-01..03 verbatim
- `.planning/ROADMAP.md` § "Phase 38: 'Never Stop, Never Ask' Autonomy Prompt" — goal, depends_on, success criteria

### Existing code to modify
- `server/ai/promptTemplate.ts` — `buildSystemPrompt()` at line 37; staticPrefix at line 88; dynamicSuffix concat at line 171. Add `autonomyLevel` prop to PromptBuilderProps; append `<autonomous_directive>` block to dynamicSuffix when level === 'autonomous'.
- `server/ai/openaiService.ts` — line 208 (enhancedPrompt build) and line 619 (second basePrompt site); these call `buildSystemPrompt` and need to thread `autonomyLevel` snapshot from upstream. Line 726 has the existing "Ask at most one clarification question" — that rule stays for non-autonomous levels; autonomous level gets a NEW directive that supersedes it (the new block sits AFTER the existing rule in dynamicSuffix, so the model reads the autonomous override last).
- `server/autonomy/execution/taskExecutionPipeline.ts` — task entry point where the snapshot is taken. DO NOT modify lines 243-245, 431-433, 484 (clarification-required risk gates) per D-11.

### Existing schema (no changes)
- `shared/schema.ts:59` — `project.executionRules.autonomyLevel: 'observe' | 'propose' | 'confirm' | 'autonomous'`. String-valued; "level 4" in ALWY-01 phrasing maps to the literal string `'autonomous'`.

### Project conventions and rules
- `CLAUDE.md` § 7 "Prompt Rules" — the 14 response rules in staticPrefix. The autonomous directive does NOT override these (D-06).
- `CLAUDE.md` § 0 Phase A — staticPrefix/dynamicSuffix cache split for DeepSeek; autonomous directive placement honors this split.
- `~/.claude/projects/-Users-shashankrai-Documents-hatching-mvp-5th-march/memory/feedback_no_decimal_hotfixes.md` — relevant if planner is tempted to add safety-gate relaxation as "natural scope": that's a Phase 47 backlog item, not Phase 38 scope.
- `~/.claude/projects/-Users-shashankrai-Documents-hatching-mvp-5th-march/memory/feedback_verify_in_runtime.md` — ALWY-02 needs a real conversation-flow test, not just a prompt-snapshot.

### Phase 28 work this depends on staying intact
- `server/autonomy/execution/taskExecutionPipeline.ts` — SAFE-01..04 multi-tier safety system. Phase 38 explicitly does NOT touch this (D-11).
- `server/autonomy/peerReview/peerReviewRunner.ts` — peer review at mid-risk. Unchanged.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `buildSystemPrompt()` (`server/ai/promptTemplate.ts:37`) — single entry point for system prompt assembly. Adding `autonomyLevel?: AutonomyLevel` to its props is the cleanest API extension.
- `staticPrefix` (line 88) — Phase A's cacheable role identity + 14 response rules block. Don't touch.
- `dynamicSuffix` (line 171) — per-turn data (project name, conversation context, etc.). Natural home for the level-specific autonomous directive.
- `project.executionRules` JSONB column — already shipped; autonomyLevel field already typed. No schema migration.
- `AutonomySettingsPanel.tsx` 4-position dial — already shipped. Settings already persist via `schedulePatch({ autonomyLevel: level, ... })` (line 107).
- `taskExecutionPipeline.ts` task entry — clear hook point for the autonomyLevel snapshot read.

### Established Patterns
- **Prompt assembly:** `buildSystemPrompt(props)` returns a single string. Threading new props through is straightforward — add `autonomyLevel?` to `PromptBuilderProps`, plumb it through `openaiService.ts:208` and `:619` from upstream caller context.
- **XML-delimited prompt blocks:** the existing prompt uses delimiter patterns like `<character_voice>` and `<professional_depth>` (per CLAUDE.md § 7 + roleIntelligence). New `<autonomous_directive>` block fits this convention.
- **Snapshot-at-entry pattern:** Phase 22 budget ledger uses a similar pattern (`reserveBudgetSlot` reads budget state once at task entry, doesn't re-read mid-task). Phase 38 mirrors this for autonomy level.
- **Test scaffolding:** `scripts/test-*.ts` exists for unit-level prompt assertions; `tests/e2e/*-spec.ts` exists for conversation-flow integration. ALWY-02 likely uses both.

### Integration Points
- 1 new prop on `PromptBuilderProps`: `autonomyLevel?: 'observe' | 'propose' | 'confirm' | 'autonomous'`
- 1 new prop on `openaiService` request shapes — threaded from `taskExecutionPipeline` or chat handler
- 1 new conditional block in `dynamicSuffix` (when level === 'autonomous')
- 1 new snapshot read in `taskExecutionPipeline.ts` at task entry (and equivalent in chat handler)
- 1 prompt-snapshot test in `scripts/` (`test-autonomous-directive.ts`?)
- 1 conversation-flow integration test in `tests/e2e/` (likely `phase-38-never-stop-never-ask.spec.ts`)

</code_context>

<deferred>
## Deferred Ideas

- **Role-specific autonomous nuance** — different Hatches might benefit from different "Claude-style" directives (e.g., Engineer codifies decisions in code comments; Designer states design rationale; Strategist surfaces strategic bets). Phase 38 ships role-agnostic; per-role tuning is a Phase 47 backlog candidate IF production usage reveals one role is noticeably misbehaving under autonomous mode.
- **User-visible "autonomy mode" indicator in chat** — a subtle badge near the agent's name when responding under autonomous level. Out of Phase 38 scope; consider for v2.1 polish OR Phase 41/42 (phase machine surfaces).
- **Cross-session autonomous-mode preferences** — remembering a user's default per-project autonomy preference across projects. This belongs in v3.0 Hatch Mental Models (cross-project preferences, PREF-01..05).
- **Logging snapshot decisions** — full audit trail of which autonomy level each task ran under. Useful for debugging; not required by ALWY-01..03. Recommend the planner add a `console.log` for observability and revisit telemetry-grade logging in v3.0 if needed.
- **Adding an `autonomySnapshot` column to `tasks` table** — explicitly tracking what level each task ran under. Useful but not load-bearing. Defer.
- **Relaxing safety-gate clarification thresholds at level 4** — explicit non-decision (D-11). Phase 47 backlog if observed-and-wanted.
- **A separate prompt-cache-key strategy for autonomous-mode prompts** — beyond Phase 38's hybrid placement. Defer until DeepSeek cache hit rate data tells us it matters.

</deferred>

---

*Phase: 38-never-stop-never-ask*
*Context gathered: 2026-06-04*
