# AUTO-ROUTING.md — Intent-to-Skill Decision Matrix (Approval-First)

> **Purpose**: Eliminate manual slash-command typing. The user describes work in natural language; Claude detects intent and **proposes** the right skill via an `AskUserQuestion` popup; the skill fires **only after explicit approval**. No auto-fire, ever. This file is the canonical routing source of truth. **Loaded with CLAUDE.md at session start.**
>
> **Core principle** (saved as durable preference): The user wants the Hatchin/Maya UX for their own dev workflow with a brake pedal — text the idea, machine proposes the right action, user clicks approve, machine acts. Transparent and always in control.

---

## 1. APPROVAL PROTOCOL (every routing decision)

**No skill fires without approval.** Every freeform user message that implies an action triggers an `AskUserQuestion` popup BEFORE invoking any skill.

### Popup format

**Question**: `"Proposed: <skill> — approve?"`
**Header** (chip label, ≤12 chars): the skill name
**Body** must include:
- Skill name
- Detected intent
- Why (one-clause reason)
- Confidence (HIGH | MED | LOW + 0.xx score)
- What will happen if approved (one line)
- For chains: full chain (`A → B → C`) — one approval covers ALL stages
- For extra-warning skills: cost / scope / irreversibility note

**Options** (max 4):
1. **Approve** (Recommended for HIGH confidence) — proceed with proposed skill
2. **Different skill** — user describes alternative or picks runner-up
3. **Just answer, no skill** — chat-only response, skip routing
4. **Cancel** — drop the action

### After approval (narrate progress)

**During multi-step / async**:
```
[<skill-name>] <current step>
```

**After completion**:
```
✓ <skill-name> done: <one-line outcome>  ·  Next: <suggested next step or "awaiting input">
```

### Chain rules

One approval covers the entire chain. After approval, narrate transitions:
```
→ Continuing chain: <next-skill>
[<next-skill>] <step>
```

User can abort anytime by typing `stop` / `pause` / `wait` → route to `gsd-pause-work` (which itself triggers an approval popup unless we're already inside an approved chain).

### When user redirects via "Different skill"

The popup returns user's alternative. Fire a new approval popup with the new skill (don't act on the redirected skill silently — always confirm twice via popup).

---

## 2. CONFIDENCE MATH

Score each candidate skill per message. Confidence shapes the popup's content, not whether to fire it. **All routes ask via popup, always.**

### What bumps confidence (+points)
| Signal | Bump |
|---|---|
| Skill name appears verbatim ("/gsd-debug" or "use deep-research") | +0.5 → HIGH lock |
| Strong intent verb matches single skill ("fix bug" → debug, "ship it" → ship) | +0.3 |
| Domain noun matches Hatchin context ("the activity feed", "Maya's prompt", "the run tree") | +0.2 |
| Continuation of prior turn (user says "yes", "continue", "go on") | inherit prior |
| Project state implies it (PLAN.md exists → execute-phase ready) | +0.2 |
| File path/URL in message matches skill domain (.pptx → pptx skill) | +0.4 |
| User has done this skill before in this project | +0.1 |

### What lowers confidence (−points)
| Signal | Drop |
|---|---|
| Vague ("look at this", "do something") | −0.3 |
| Multiple intents in one message | −0.2 per extra |
| Words that match 2+ skills equally ("review" → code/UI/PR/security) | base 0.5 |
| Past-tense framing ("we already shipped X") | likely informational, no popup |

### Thresholds (control what the popup shows)
- **HIGH (≥0.8)** — popup proposes single skill, "Approve" pre-marked Recommended
- **MED (0.5–0.8)** — popup proposes single skill, runner-up named in body, user can pick via "Different skill"
- **LOW (<0.5)** — popup surfaces top 2 candidates side-by-side (Approve = top-1, Different skill = top-2 named)
- **No match** — popup proposes `gsd-do` (built-in router) as fallback

### When NOT to show a popup at all
- Past-tense framing / informational messages ("we already shipped X", "remember when Y") → just answer in chat
- Direct questions about the system ("what does X mean?", "how does Y work?") → just answer
- Acknowledgments / continuation ("yes", "ok", "go on") inside an already-approved chain → continue chain without re-popup
- Always-manual skills (section 4) → tell user to invoke explicitly, don't show popup

---

## 3. THE MATRIX — INTENT → SKILL

Organized by intent category. **Left column = user phrasing patterns** (not exhaustive — match by meaning). **Right column = skill + confidence rule + chain (if any)**.

### A. New work scoping
| User says... | Route to | Notes |
|---|---|---|
| "let's add a phase for X" / "next phase should be Y" | `gsd-add-phase` → then `gsd-discuss-phase` | HIGH if "phase" said explicitly |
| "let's build X" / "we should add Y" (new scope) | `gsd-add-phase` → `gsd-discuss-phase` → `gsd-plan-phase` | MED — confirm if X feels mid-sized vs quick |
| "quick task: X" / "small fix: Y" / "while we're here, also..." | `gsd-quick` | HIGH on "quick", "small", "while we're here" |
| "trivial: X" / "one-liner fix" | `gsd-fast` | HIGH on "trivial", "one-liner" |
| "I have an idea — what if..." / "let's explore X" | `gsd-explore` | HIGH on "explore", "what if", "idea" |
| "let's spike X" / "try a quick experiment with Y" | `gsd-spike` | HIGH on "spike", "experiment" |
| "let's sketch X" / "mock up the layout for Y" | `gsd-sketch` | HIGH on "sketch", "mock up" |
| "future idea: X" / "down the road we should..." | `gsd-plant-seed` | HIGH on "future", "down the road", "someday" |
| "park this for later" / "add to backlog" | `gsd-add-backlog` | HIGH on "park", "backlog" |
| "todo: X" / "remind me to Y" | `gsd-add-todo` | HIGH on "todo:", "remind me" |
| "note: X" / random thought without action | `gsd-note` | HIGH on "note:" or stream-of-consciousness |

**⚠️ Project rule override** (from `feedback_no_decimal_hotfixes.md`):
- If user says "add Phase X.5" or "hotfix Y mid-milestone" → **DO NOT route to `gsd-insert-phase`**. Route to `gsd-add-backlog` instead with the "Accumulated Upgrades" tag. Narrate the redirect.

### B. Debugging & fixing
| User says... | Route to | Notes |
|---|---|---|
| "X is broken" / "fix bug Y" / "why isn't Z working?" | `gsd-debug` | HIGH on "broken", "bug", "isn't working", "failing" |
| "I already know what's wrong — quick fix" | `gsd-fast` (if trivial) or `gsd-quick` (if scoped) | MED — ask which only if size unclear |
| "diagnose what went wrong with phase X" | `gsd-forensics` | HIGH on "post-mortem", "what went wrong", phase number |
| "run a full bug sweep" / "find all the bugs" | `deep-audit` | HIGH on "bug sweep", "find bugs", "audit for bugs" |

### C. Status & navigation
| User says... | Route to | Notes |
|---|---|---|
| "where are we?" / "what's the project state?" | `gsd-progress` | HIGH on "where", "state", "status" |
| "what's next?" / "next step" | `gsd-next` | HIGH on "next" |
| "show stats" / "project numbers" | `gsd-stats` | HIGH on "stats", "numbers", "metrics" |
| "session report" / "what did we do today" | `gsd-session-report` | HIGH on "session report", "today's work" |
| "list my todos" / "open todos" | `gsd-check-todos` | HIGH on "todos", "list todos" |
| "what's in the backlog?" | `gsd-review-backlog` | HIGH on "backlog" |
| "list workspaces" / "what workspaces" | `gsd-list-workspaces` | HIGH on "workspace" + "list" |
| "show me my Github inbox" / "PRs and issues" | `gsd-inbox` | HIGH on "inbox", "PRs", "issues" |
| "what assumptions are we making about phase X?" | `gsd-list-phase-assumptions` | HIGH on "assumptions" |
| "how's the .planning dir?" / "is GSD healthy?" | `gsd-health` | HIGH on "health", ".planning state" |

### D. Execution
| User says... | Route to | Notes |
|---|---|---|
| "execute the plan" / "run phase X" | `gsd-execute-phase` | HIGH if PLAN.md exists for the phase |
| "verify it works" / "validate the build" | `gsd-verify-work` | HIGH on "verify", "validate", "did it work" |
| "ship it" / "open the PR" / "merge ready" | `gsd-ship` | HIGH on "ship", "PR", "merge" |
| "make a clean PR branch" (filter out .planning) | `gsd-pr-branch` | HIGH on "clean PR", "filter planning" |
| "keep going" / "do the rest autonomously" / "run all remaining" | `gsd-autonomous` | **CONFIRM-FIRST** — show plan, ask "proceed?" |
| "resume from where we left off" | `gsd-resume-work` | HIGH on "resume", "where we left off" |
| "pause this for now" / "context handoff" | `gsd-pause-work` | HIGH on "pause", "stop here", "handoff" |

### E. Review & audit
| User says... | Route to | Notes |
|---|---|---|
| "review my changes" / "review the diff" | `gsd-code-review` (project) or `code-review` (generic) | Prefer GSD if inside a phase |
| "fix the code review findings" | `gsd-code-review-fix` | HIGH if REVIEW.md exists |
| "review the UI" / "audit the design" | `gsd-ui-review` | HIGH on "UI", "design", "visual" |
| "audit the site/product" (consultancy / non-Hatchin) | `product-audit` | HIGH if external client mentioned, no phase context |
| "security check" / "is this secure?" | `gsd-secure-phase` (in phase) or `security-review` (generic) | Prefer GSD if phase active |
| "validate the phase" / "Nyquist check phase X" | `gsd-validate-phase` | HIGH on phase + "validate" |
| "audit the milestone before closing" | `gsd-audit-milestone` | HIGH on "milestone audit" |
| "audit all open UATs" | `gsd-audit-uat` | HIGH on "UAT", "outstanding tests" |
| "get a second opinion" / "cross-AI review" | `gsd-review` | HIGH on "second opinion", "cross-AI" |
| "are the AI evals covered?" | `gsd-eval-review` | HIGH on "evals", "AI quality" |
| "audit and fix the issues" (combined) | `gsd-audit-fix` | HIGH on "audit and fix" together |

### F. Planning & spec
| User says... | Route to | Notes |
|---|---|---|
| "let's spec phase X" / "clarify what phase Y delivers" | `gsd-spec-phase` | HIGH on "spec", "clarify what" |
| "discuss the approach" / "let's talk through phase X" | `gsd-discuss-phase` | HIGH on "discuss", "talk through" |
| "plan phase X" / "make the PLAN.md" | `gsd-plan-phase` | HIGH on "plan" + phase reference |
| "research before planning" / "do the research-phase" | `gsd-research-phase` | HIGH on "research-phase" specifically |
| "AI integration phase / AI-SPEC" | `gsd-ai-integration-phase` | HIGH on "AI-SPEC", "AI integration" |
| "UI phase / UI-SPEC for phase X" | `gsd-ui-phase` | HIGH on "UI-SPEC", "UI phase" |
| "fix concerns from review and replan" | `gsd-plan-review-convergence` | HIGH if review has HIGH concerns |
| "use ultraplan (cloud)" | `gsd-ultraplan-phase` | **CONFIRM-FIRST** (paid service) |
| "what depends on what?" / "analyze phase deps" | `gsd-analyze-dependencies` | HIGH on "dependencies", "deps" |
| "after audit, close all gaps" | `gsd-plan-milestone-gaps` | HIGH on "close gaps" |

### G. Milestone & project lifecycle
| User says... | Route to | Notes |
|---|---|---|
| "start a new milestone" | `gsd-new-milestone` | **CONFIRM-FIRST** (high-impact) |
| "milestone is done — archive it" | `gsd-complete-milestone` | **CONFIRM-FIRST** (irreversible) |
| "give me the milestone summary" | `gsd-milestone-summary` | HIGH on "milestone summary" |
| "import external plans / specs" | `gsd-ingest-docs` (multi-doc) or `gsd-import` (single) | HIGH on "import", "ingest" |
| "new project from scratch" | `gsd-new-project` | **CONFIRM-FIRST** (initializes everything) |
| "new workspace" (isolated) | `gsd-new-workspace` | **CONFIRM-FIRST** |
| "I want a parallel workstream" | `gsd-workstreams` | HIGH on "workstream", "parallel work" |

### H. Codebase intelligence
| User says... | Route to | Notes |
|---|---|---|
| "map the codebase" (deep, with multiple agents) | `gsd-map-codebase` | HIGH on "map", "explore everything" |
| "scan the codebase" (lightweight) | `gsd-scan` | HIGH on "scan", "quick look" |
| "show me .planning/intel" / "codebase intel" | `gsd-intel` | HIGH on "intel" |
| "build the knowledge graph" | `gsd-graphify` | HIGH on "graph", "knowledge graph" |
| "track threads across sessions" | `gsd-thread` | HIGH on "thread", "cross-session" |

### I. Documentation & artifacts (deliverables)
| User says... | Route to | Notes |
|---|---|---|
| "update the docs" / "regen documentation" | `gsd-docs-update` | HIGH on "docs", "documentation" |
| "let's co-author this doc" / "write a doc with me" | `doc-coauthoring` | HIGH on "co-author", "draft with me" |
| "build a pitch book for X" / "shareholder brief on Y" | `pitch-book` | HIGH on "pitch", "shareholder", "stakeholder brief" |
| "build a behavioural personalization MVP for X" | `behavioural-mvp-demo` | HIGH on "behavioural MVP", "personalization demo" |
| "clone this website: <url>" / "rebuild this page" | `clone-website` | HIGH if URL + "clone/rebuild/replicate" |
| "make an HTML artifact" / "complex web artifact" | `web-artifacts-builder` | HIGH on "HTML artifact", "claude.ai artifact" |
| "research X deeply with citations" | `deep-research` | HIGH on "deep research", "with citations" |
| `.pdf` file mentioned / "make a PDF" | `pdf` | HIGH on .pdf path or "PDF" |
| `.pptx` mentioned / "build a deck" / "presentation" | `pptx` | HIGH on .pptx, "deck", "slides" |
| `.xlsx`/`.csv` mentioned / "spreadsheet of X" | `xlsx` | HIGH on .xlsx/.csv |

### J. Testing
| User says... | Route to | Notes |
|---|---|---|
| "test the app in browser" / "verify the page works" | `playwright-tester` | HIGH on "browser test", "Playwright" |
| "quick QA check" / "navigate and check" | `gstack` | HIGH on "QA", "headless check" |
| "verify the fix works in runtime" | `verify` | HIGH on "verify in runtime", "manual test" |
| "run the app" / "start dev server and check" | `run` | HIGH on "run the app", "start it" |
| "generate tests for this phase" | `gsd-add-tests` | HIGH if phase code exists and tests don't |
| "run the test:* eval" | direct `Bash` (no skill) | HIGH if test command path is named |

**⚠️ Hatchin override** (from `feedback_verify_in_runtime.md`):
- Before claiming a fix is shipped, ALWAYS chain `verify` or `playwright-tester` against the live restarted server. Never trust "tests pass" alone.

### K. Extraction & learning
| User says... | Route to | Notes |
|---|---|---|
| "extract learnings from phase X" | `gsd-extract_learnings` | HIGH on "learnings", "lessons", "extract" |
| "wrap up the sketch as a skill" | `gsd-sketch-wrap-up` | HIGH after sketch session |
| "wrap up the spike as a skill" | `gsd-spike-wrap-up` | HIGH after spike session |

### L. Meta & config (mostly ALWAYS-MANUAL)
| User says... | Route to | Notes |
|---|---|---|
| "what skills can I use?" / "help" | `gsd-help` | HIGH on "help", "what can I do" |
| "set my model profile" | `gsd-set-profile` | **MANUAL** (config) |
| "change settings" / "configure GSD" | `gsd-settings` | **MANUAL** (config) |
| "advanced settings" | `gsd-settings-advanced` | **MANUAL** |
| "configure API keys / integrations" | `gsd-settings-integrations` | **MANUAL** |
| "update GSD" | `gsd-update` | **MANUAL** (modifies install) |
| "sync skills across machines" | `gsd-sync-skills` | **MANUAL** |
| "reapply my custom patches" | `gsd-reapply-patches` | **MANUAL** |
| "init CLAUDE.md" | `init` | **MANUAL** (overwrites docs) |
| "update Claude harness config" | `update-config` | **MANUAL** (settings.json) |
| "show keybindings help" | `keybindings-help` | **MANUAL** |
| "reduce permission prompts" | `fewer-permission-prompts` | **MANUAL** (modifies allowlist) |
| "join Discord" | `gsd-join-discord` | **MANUAL** |

### M. Concept / framework discussions (informational skills)
These skills give me knowledge for designing/explaining things. Auto-load into context when user asks about the topic — don't "invoke" them as actions.

| User says... | Load context from |
|---|---|
| "design multi-agent system" / "supervisor pattern" | `multi-agent-patterns` |
| "BDI / belief-desire-intention / mental states" | `bdi-mental-states` |
| "implement agent memory / persistence" | `memory-systems` |
| "LLM-as-judge / evaluation rubrics" | `advanced-evaluation` |
| "evaluate agent performance / test framework" | `evaluation` |
| "context window / context budgeting" | `context-fundamentals` |
| "context degradation / lost-in-middle" | `context-degradation` |
| "context compression / compaction" | `context-compression` |
| "optimize context / reduce tokens" | `context-optimization` |
| "filesystem-based context offload" | `filesystem-context` |
| "share memory between agents / KV cache" | `latent-briefing` |
| "design agent tools / MCP tools" | `tool-design` |
| "background agents / hosted sandboxes" | `hosted-agents` |
| "structure an LLM project" | `project-development` |
| "build with Anthropic SDK / prompt caching" | `claude-api` |

### N. Scheduling & loops (CONFIRM-FIRST)
| User says... | Route to | Notes |
|---|---|---|
| "run X every Y minutes" / "poll status" | `loop` | **CONFIRM-FIRST** (background work) |
| "schedule this for tomorrow / cron" | `schedule` | **CONFIRM-FIRST** |

### O. Profile / developer insights
| User says... | Route to | Notes |
|---|---|---|
| "profile my dev style" / "how do I work?" | `gsd-profile-user` | HIGH on "profile me", "my style" |

---

## 4. ALWAYS-MANUAL LIST (never auto-route)

**Destructive / irreversible:**
- `gsd-undo` — git revert with dependency checks
- `gsd-remove-phase` — removes phase, renumbers
- `gsd-remove-workspace` — destroys workspace
- `gsd-cleanup` — archives completed milestones
- `gsd-from-gsd2` — re-imports from GSD-2 (data overwrite risk)
- `gsd-reapply-patches` — replays local patches over fresh install

**Settings / install:**
- `gsd-set-profile`, `gsd-settings*`, `gsd-update`, `gsd-sync-skills`, `gsd-join-discord`
- `init`, `update-config`, `keybindings-help`, `fewer-permission-prompts`

**External / paid:**
- `gsd-ultraplan-phase` (paid cloud service — needs explicit confirmation)

**Logic:** These all change harness state or destroy work. The user must type the command (or explicitly say "do X using <skill>"). Auto-detection is too risky.

---

## 5. CONFIRM-FIRST LIST (auto-detect intent, but ask once before invoking)

| Skill | Why ask | Question to ask |
|---|---|---|
| `gsd-autonomous` | Runs all remaining phases without checkpoints | "About to run all remaining phases autonomously. Show plan first?" |
| `gsd-new-milestone` | Sets project trajectory; updates PROJECT.md | "Start new milestone? Current: \<X\>" |
| `gsd-complete-milestone` | Archives + locks current milestone | "Close milestone \<X\>? This archives all phases." |
| `gsd-new-project` | Initializes everything (one-time per project) | "Initialize new project? Working dir: \<path\>" |
| `gsd-new-workspace` | Creates worktree + isolated .planning | "Create isolated workspace? Repo will be copied." |
| `loop`, `schedule` | Spawn background recurring work | "Schedule \<task\> on \<cadence\>?" |

For these: **detect intent → narrate "→ CONFIRM-FIRST: \<skill\> ready, proceed?" → wait for user** → invoke on yes.

---

## 6. CHAINED INTENTS (multi-skill flows)

When the user says "plan and execute X" or "discuss, plan, ship X" — auto-chain.

| User says... | Chain |
|---|---|
| "spec, plan, and execute phase X" | `gsd-spec-phase` → `gsd-discuss-phase` → `gsd-plan-phase` → `gsd-execute-phase` |
| "let's just do phase X end-to-end" | `gsd-discuss-phase` → `gsd-plan-phase` → `gsd-execute-phase` → `gsd-verify-work` → `gsd-ship` |
| "new phase for Y, plan it" | `gsd-add-phase` → `gsd-discuss-phase` → `gsd-plan-phase` |
| "audit milestone, close gaps, ship" | `gsd-audit-milestone` → `gsd-plan-milestone-gaps` → execute → `gsd-complete-milestone` (CONFIRM-FIRST) |
| "review, fix, verify, ship" | `gsd-code-review` → `gsd-code-review-fix` → `gsd-verify-work` → `gsd-ship` |
| "research, then plan" | `gsd-research-phase` → `gsd-plan-phase` |

**Chain narration:**
```
→ Chain: gsd-discuss-phase → gsd-plan-phase → gsd-execute-phase. Starting with gsd-discuss-phase.
[gsd-discuss-phase] ... done.
→ Continuing chain: gsd-plan-phase.
[gsd-plan-phase] ... done.
→ Continuing chain: gsd-execute-phase.
...
```

**User can break the chain anytime by saying "stop" / "pause" / "wait" — route to `gsd-pause-work`.**

---

## 7. SKILL COLLISIONS — resolution rules

When two skills could match equally, use these tiebreakers:

| Collision | Pick |
|---|---|
| `gsd-code-review` vs `code-review` | **GSD if phase active**, generic otherwise |
| `gsd-secure-phase` vs `security-review` | **GSD if phase active**, generic otherwise |
| `verify` vs `playwright-tester` vs `gstack` | `verify` for "does the change work", `playwright-tester` for "write a persistent test", `gstack` for "quick QA poke" |
| `gsd-quick` vs `gsd-fast` | `gsd-fast` for trivial (no plan needed); `gsd-quick` for small but scoped |
| `gsd-debug` vs `gsd-forensics` | `gsd-debug` for current bug; `gsd-forensics` for "why did phase X fail" post-mortem |
| `gsd-explore` vs `gsd-spike` vs `gsd-sketch` | `gsd-explore` for ideation talk; `gsd-spike` for code-experiment; `gsd-sketch` for visual mockup |
| `gsd-map-codebase` vs `gsd-scan` | `gsd-scan` first (light); `gsd-map-codebase` if user wants deep, multi-agent |
| `product-audit` vs `gsd-code-review` | `product-audit` for UX/strategy/consultancy; `gsd-code-review` for diff bugs |
| `gsd-ingest-docs` vs `gsd-import` | `gsd-ingest-docs` for mixed corpus (ADRs+PRDs+SPECs); `gsd-import` for a single plan file |
| `gsd-add-todo` vs `gsd-add-backlog` vs `gsd-plant-seed` vs `gsd-note` | `gsd-add-todo` = actionable soon · `gsd-add-backlog` = parking lot 999.x · `gsd-plant-seed` = future trigger condition · `gsd-note` = stream-of-consciousness, no action |

---

## 8. PROJECT-SPECIFIC OVERRIDES (Hatchin only)

These layer on top of the matrix — durable preferences from `~/.claude/projects/.../memory/`:

1. **No decimal hotfixes** (`feedback_no_decimal_hotfixes.md`):
   - Block auto-routing to `gsd-insert-phase` for mid-milestone discoveries.
   - Redirect to `gsd-add-backlog` with "Accumulated Upgrades" tag.

2. **Verify in runtime** (`feedback_verify_in_runtime.md`):
   - After any `gsd-execute-phase` or "fix shipped" claim, **auto-chain `playwright-tester` or `verify`** against live server before reporting done.
   - Never report "fix complete" based on typecheck/test pass alone.

3. **UI change approval** (`feedback_ui_change_protocol.md`):
   - Before invoking any skill that edits `client/src/` UI files, narrate: "→ UI change detected. Showing current state via Playwright before edit."
   - Wait for explicit approval. Server-side changes skip this gate.

4. **Self-documenting UI** (`feedback_ui_self_documenting.md`):
   - When invoking `gsd-ui-phase` or `gsd-ui-review`, inject the self-documenting rules into the spec / audit criteria.

5. **Auto-routing on freeform** (`feedback_auto_route_freeform.md`):
   - The principle behind this whole file. Reaffirmed.

---

## 9. FALLBACK & NEW-SKILL HANDLING

- **No clear match, no top-2 close call**: invoke `gsd-do` (built-in router) as fallback.
- **User invokes a skill not in this matrix**: add a row to section 3 at session-end (`gsd-session-report` flow) so the matrix evolves.
- **New skill installed since last update**: classify it on first use, append to matrix.

---

## 10. REFERENCE — full installed skill inventory

For audit purposes. Source: `~/.claude/skills/`. Last counted: 2026-06-04 (~125 skills total).

### GSD pipeline (workflow nodes)
spec-phase, discuss-phase, plan-phase, research-phase, ai-integration-phase, ui-phase, plan-checker, plan-review-convergence, ultraplan-phase, execute-phase, verify-work, code-review, code-review-fix, secure-phase, validate-phase, ui-review, eval-review, ship, audit-milestone, audit-uat, audit-fix, plan-milestone-gaps, complete-milestone, milestone-summary

### GSD scope/task management
add-phase, insert-phase, remove-phase, quick, fast, add-todo, add-backlog, plant-seed, note, check-todos, review-backlog, autonomous, analyze-dependencies, workstreams

### GSD project lifecycle
new-project, new-milestone, new-workspace, remove-workspace, ingest-docs, import, from-gsd2

### GSD intelligence/state
explore, sketch, spike, sketch-wrap-up, spike-wrap-up, map-codebase, scan, intel, graphify, thread, list-phase-assumptions, list-workspaces, inbox, progress, next, stats, session-report, profile-user, health, extract_learnings, manager

### GSD operations
debug, forensics, pause-work, resume-work, ship, pr-branch, ultraplan-phase, undo, cleanup, docs-update, review, set-profile, settings, settings-advanced, settings-integrations, update, sync-skills, reapply-patches, help, join-discord, do

### Specialty / consultancy
pitch-book, behavioural-mvp-demo, product-audit, deep-research, clone-website, web-artifacts-builder

### Engineering helpers
playwright-tester, gstack, verify, run, code-review (generic), security-review, review (generic), deep-audit, init

### Document/file handling
pdf, pptx, xlsx, doc-coauthoring

### Concept / framework knowledge (load on topic mention)
multi-agent-patterns, bdi-mental-states, memory-systems, advanced-evaluation, evaluation, context-fundamentals, context-degradation, context-compression, context-optimization, context-engineering, filesystem-context, latent-briefing, tool-design, hosted-agents, project-development, claude-api

### Harness / config (always-manual)
update-config, fewer-permission-prompts, keybindings-help, init

### Automation
loop, schedule

---

## 11. HOW THIS FILE GETS UPDATED

When a new skill is installed or the routing for an existing skill changes:
1. Add/update the row in section 3
2. Update section 10 inventory
3. If it's destructive → add to section 4
4. If it's high-impact → add to section 5
5. Commit with `chore(auto-routing): <change>` so the history is auditable

The matrix is the contract. If routing feels wrong in practice, fix the file, not the heuristic in Claude's head.

---

*Last updated: 2026-06-04 · Owner: Shashank · Authoritative reference for auto-routing*
