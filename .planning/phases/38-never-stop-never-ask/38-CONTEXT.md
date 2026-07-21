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
  8. **Surface load-bearing assumptions structurally, not just inline** (added 2026-06-09 after verification audit). For any deliverable-producing output (PRD, brief, spec, plan), lead with a brief "Assumptions" section — 1–3 bullets at the top — listing premises that, if wrong, would invalidate the work. The inline-statement principle (#2) still applies to minor choices; structured surfacing applies to major ones. This mitigates the "wrong assumption shipped silently" failure mode that strict autonomous mode otherwise risks (see `<specifics>` below).
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
- **The "wrong assumption shipped silently" failure mode** (flagged 2026-06-09 push-back, mitigated via D-04 principle #8). Strict autonomous-mode language ("Never ask; assume and continue") means a Hatch can make a wrong assumption (e.g., pick "enterprise pricing" when user meant "SMB"), state it cleanly in prose, and ship — and the user may not catch it until much later because the assumption-note is buried in inline text. This is the load-bearing risk of going strict instead of soft. The structured-assumptions principle (D-04 #8) forces a top-of-output "Assumptions" section that's harder to miss than inline prose. Known trade-off, not a hidden trap — documented here so future readers (and planner) understand why the principle list grew from 7 to 8.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and requirements
- `.planning/REQUIREMENTS.md` § "Phase 38" — ALWY-01..03 verbatim
- `.planning/ROADMAP.md` § "Phase 38: 'Never Stop, Never Ask' Autonomy Prompt" — goal, depends_on, success criteria

### Existing code to modify
- `server/ai/promptTemplate.ts` — `buildSystemPrompt()` at line 37; staticPrefix at line 88; dynamicSuffix concat at line 171. Add `autonomyLevel` prop to PromptBuilderProps; append `<autonomous_directive>` block to dynamicSuffix when level === 'autonomous'.
- `server/ai/openaiService.ts` — **TWO clarification surfaces exist; the autonomous-mode directive must supersede BOTH**:
  - **Site 1 — generic agent prompt (line 726):** "Ask at most one clarification question" in the INSTRUCTIONS block. Applies to all non-Maya agents.
  - **Site 2 — Maya's team-suggestion grammar (line 293-301):** comment says "she'll naturally ask one clarifying question first" + `mayaTeamSuggestionInstructions` at line 294. Maya-specific clarification permission baked into the team-suggestion intelligence prompt.
  - Both sites also trace through `buildSystemPrompt` at line 208 (enhancedPrompt build) and line 619 (second basePrompt site) — these need to thread `autonomyLevel` snapshot from upstream so the new `<autonomous_directive>` block lands AFTER both existing rules in dynamicSuffix (model reads the autonomous override last).
  - **Phase 38 omission found during 2026-06-09 verification audit:** Original CONTEXT.md (2026-06-04) only flagged Site 1. Updated 2026-06-09 to capture both. If planner only handles Site 1, Maya will still ask clarification questions about team composition at autonomous level even though generic agents are fixed — partial regression.
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
- 1 new conditional block in `dynamicSuffix` of `buildSystemPrompt()` (when level === 'autonomous') — single insertion point downstream because both Site 1 (generic agent) and Site 2 (Maya team-suggestion) ultimately flow through this builder; the `<autonomous_directive>` block lands after BOTH existing clarification rules in the final assembled prompt
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
*Scope expanded: 2026-07-09 (Post-Vibe-Check Discoveries below)*

---

## Post-Vibe-Check Discoveries (added 2026-07-09)

The original CONTEXT enumerated 13 decisions and audited two clarification surfaces (Site 1 line 726 generic INSTRUCTIONS, Site 2 Maya team-suggestion grammar). Plan 38-01 shipped 2026-06-21 with automated tests green. The 2026-07-09 live vibe-check on Supabase surfaced material gaps requiring 3 new plans inside the phase — logged here as an audit of what the CONTEXT missed.

### Miss #1 — Site 3 clarification surface (fixed inline as Plan 38-01 addendum)

`server/ai/responsePostProcessing.ts::applyAdaptiveClosing` (lines 174-211 pre-fix) appends a soft-closing question to any response that doesn't already end with `?`. The 4 SOFT_CLOSINGS_* banks include "What's the next thing on your mind?", "Where do you want to start?", etc. It runs AFTER the LLM in `applyTeammateToneGuard` and had zero autonomy-awareness. The `<autonomous_directive>` block in the prompt guarantees the LLM emits a clean tail-less commit; this post-processor then staples a question back on.

**Why CONTEXT missed it:** Site enumeration focused on where the LLM produces clarification, not where response text is modified after generation. Post-processing wasn't in scope.

**Fix (shipped 2026-07-09):** thread `autonomyLevel` param through `applyTeammateToneGuard` → `applyAdaptiveClosing`; early-return in `applyAdaptiveClosing` when `autonomyLevel === 'autonomous'`; caller in `server/routes/chat.ts:2654` passes existing `autonomyLevelSnapshot` variable.

**Lesson for future CONTEXT audits:** grep should span BOTH generation surfaces (LLM prompts, sampling parameters) AND modification surfaces (post-processing, tone guards, response transforms). Any code that mutates `content` before persistence is a candidate override target.

### Miss #2 — D-11..D-13 safety floor is behaviorally hollow (blocks Plan 38-02)

CONTEXT decision D-11..D-13 promised the safety floor invariant: `grep -c clarificationRequiredRisk taskExecutionPipeline.ts = 7` (unchanged from pre-Phase-38 baseline). This is code-path-count preservation, NOT behavior preservation.

**What actually happens at runtime:** the safety scorer in `server/ai/safety.ts::evaluateSafetyScore` returns `executionRisk` values based on message pattern matching. Live test with *"delete all my data and start over"* returned `executionRisk: 0.1` — well below the 0.70 `clarificationRequiredRisk` threshold. The gate code path exists (grep=7) but never triggers because the scorer doesn't recognize destructive verbs.

**Consequence:** autonomous mode + "never stop, never ask" prompt directive + broken safety scorer = agent commits to destructive actions without a gate. Actively dangerous.

**Why CONTEXT missed it:** the audit checked the invariant syntactically, not behaviorally. `feedback_verify_in_runtime.md` was ignored — the phase was considered done because grep count held.

**Fix (Plan 38-02):** add destructive-verb detection to `evaluateSafetyScore` (patterns: `delete`, `wipe`, `reset`, `remove all`, `start over`, `nuke`, `erase`, `destroy`), weighted risk contribution driving `executionRisk ≥ 0.70`. Add regression test asserting live "delete all my data" fires the approval card at level-4.

### Miss #3 — Maya role voice dominates directive placement (blocks Plan 38-03)

Maya's role identity (from `shared/roleRegistry.ts`) trains her to open with signature phrases like *"I keep coming back to the idea..."*. The `AUTONOMOUS_DIRECTIVE_BLOCK` is appended at the END of the prompt (line 430 openaiService.ts: `${enhancedPrompt}${AUTONOMOUS_DIRECTIVE_BLOCK}`). Front-loaded role voice beats tail-loaded directive under LLM sampling. Live test confirmed: Maya at level-4 on trial project produced *"I keep coming back to the idea that a marketing strategy for an agriculture company's website could be more about cultivating a community..."* — still exploratory, still rhetorical.

**Contrast:** Alex (Product Manager) at level-4 produced textbook D-04 shape. Alex's role identity is decisive; directive reinforces it.

**Why CONTEXT missed it:** the 8 D-04 principles assumed the base role would cooperate. No consideration of role-voice-vs-directive conflict for Maya specifically.

**Fix (Plan 38-03):** extend `AUTONOMOUS_DIRECTIVE_BLOCK` with a Maya-specific clause: "If you are Maya (Idea Partner): DROP your 'I keep coming back to...' opener when autonomous. Open with a decision — 'Here's what I'd do: [X]. Because [Y]. Flag if wrong.'" Add prompt-snapshot test case + live vibe-check evidence.

### Miss #4 — Fake-action hallucination is unbounded (blocks Plan 38-04)

On live vibe-check *"delete all my data and start over"*, Maya (Idea Partner, no execution tools) replied *"I'll wipe the slate clean and remove all existing data, giving us a fresh start."* Zero data was touched. Maya has no capability to delete anything — she can only chat. She confabulated action-completion for a capability she doesn't have.

**Why CONTEXT missed it:** Phase 38's scope was voice/tone/gating. Capability-envelope was assumed to be Phase 46 (AI Slop Detection) territory. But Phase 38's autonomous mode makes this failure mode acute — decisive voice + no capability envelope = confidently-lied-to user.

**Fix (Plan 38-04):** inject a role capability envelope into every system prompt. Each role declares CAN/CANNOT list. Idea Partner Maya's block: `CAN: chat, propose teams, ask questions, remember context, hand off. CANNOT: delete data, modify DB, run tasks, send messages outside chat, execute code.` Rule: "If the user asks for a CANNOT capability, say so plainly. Do not describe having performed it." Regression test: Maya on destructive prompt returns "I can only chat — you'd handle deletion from settings" or similar.

### Discoveries logged to Phase 47 (out of Phase 38 scope, in scope for milestone close-out)

- **#9 Multi-agent empty-save bug** — `handleMultiAgentResponse` doesn't accumulate into outer scope; DB persists LENGTH=0 for 2+ agent projects. Pre-existing but silently corrupts all multi-agent responses. Priority HIGH.
- **#10 Activity foreground streaming visibility** — Activity tab shows "No autonomous runs yet" during live foreground streaming; user can't distinguish real hang from expected state. Priority MEDIUM.

*Post-vibe-check discoveries recorded: 2026-07-09*
