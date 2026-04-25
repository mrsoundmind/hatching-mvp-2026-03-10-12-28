# Feature Research — v3.0 Reliable Autonomy

**Domain:** AI agent scheduling + autonomous budget enforcement (B2B/prosumer AI team product)
**Researched:** 2026-04-13
**Confidence:** MEDIUM-HIGH (competitive landscape well-documented; specific UX patterns verified against 2+ products per feature; budget enforcement UX less standardized across competitors, so LOW confidence on "industry norms" there — HIGH confidence on first-principles UX)

---

## Scope

Two feature areas for v3.0:
1. **Scheduled routines** — recurring autonomous work ("Kai, draft the growth update every Monday")
2. **Atomic budget enforcement (UX surfaces)** — real-time consumption, approaching-limit warnings, hard stops

The backend correctness fix for atomic budget is non-negotiable infra; this doc focuses on the user-facing features that *ride on top* of it.

---

## Competitive Landscape (Scheduled AI Agents)

| Product | Schedule Creation | Past-Run History | Cancellation | Chat-Native? |
|---------|-------------------|------------------|--------------|--------------|
| **OpenAI ChatGPT Tasks** | Natural language in chat ("remind me daily at 9"); confirms with a card | Tasks panel shows past runs as new chat threads | Pause/delete from Tasks panel | YES — chat triggers, separate panel to manage |
| **Zapier AI Agents / Zaps** | Visual trigger-action builder (cron UI); NL Copilot builder available | Task History log with run status, inputs, outputs | Toggle off, delete from dashboard | NO — form/builder-first |
| **Lindy** | Natural-language agent instruction + schedule trigger picker; "every Monday at 9am" parsed | Run history per agent with outputs, errors, cost | Pause agent, edit trigger | HYBRID — chat to configure, dashboard to manage |
| **Relevance AI** | Visual workflow builder + schedule trigger node | Run logs with full input/output trace | Toggle schedule, disable agent | NO — builder-first |
| **CrewAI** | Code-defined (Python), no built-in UI scheduling — users wire up cron externally | Logs via observability (AgentOps) | Process-level | N/A — framework |
| **AutoGen** | Code-defined; no scheduling primitive | Via logging framework | Process-level | N/A |
| **Paperclip** (per milestone context) | Timeline-style audit + schedule creation inline with agent | Audit timeline with diff view | Inline pause/cancel | YES — timeline-native |
| **Claude Projects / Claude Code** | No native scheduling (as of research date) | N/A | N/A | N/A |

**Key pattern observations:**
- **Consumer/prosumer products** (OpenAI Tasks, Lindy, Paperclip) → natural-language chat creation + lightweight management panel
- **Power-user/B2B products** (Zapier, Relevance AI) → visual builders with cron precision
- **Every shipping product has a "past runs" view** — table stakes, not a differentiator
- **Confirmation card pattern** (user says "every Monday" → card renders "Every Monday at 9:00 AM IST, Kai will draft the growth update — Confirm?") is universal in chat-native products

---

## Feature Landscape — SCHEDULED ROUTINES

### Table Stakes (Must Have)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Natural-language schedule parsing | OpenAI Tasks + Lindy both support this; users won't accept cron syntax | M | chrono-node or similar NLP date library + LLM fallback for ambiguous cases ("every other Tuesday") |
| Confirmation card before schedule saves | All chat-native competitors confirm; prevents "did it understand me?" anxiety | S | Structured card in chat with cadence, next run time, agent, prompt — Confirm/Edit/Cancel |
| List of active routines | Zapier, Lindy, OpenAI Tasks all have a panel | S | New Routines tab in existing right sidebar OR merged into Tasks tab |
| Pause / resume | Universal — need to pause without losing config | S | Single toggle per routine; preserves definition |
| Delete routine | Universal | S | Confirmation modal; decide cascade behavior for past-run history |
| Past-run history (last 10–30 runs) | Every product has this; trust requires seeing what happened | M | Link to deliverable/message; status (success/failed/skipped/budget-blocked); cost per run |
| Timezone handling | Non-negotiable — "9am" is ambiguous globally | M | Default to browser TZ; persist IANA tz string; display TZ in confirmation card |
| Next-run-time display | Shown in all competitor UIs | S | Compute from cron + TZ; update live |
| Failed-run notification | Silent failure = trust death | M | Push to chat via Maya briefing OR sidebar notification; tab badge |
| Manual "run now" trigger | Lindy, Zapier both have this — test before waiting | S | Button on routine card; runs through same pipeline as scheduled trigger |

### Differentiators (Reinforces Hatchin Brand)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Chat-native creation — zero UI for common case** | No competitor nails this. OpenAI is close but still centers a separate Tasks UI. Hatchin can do it purely through conversation with the executing Hatch. | M | User DMs Kai: "draft the growth update every Monday morning" → Kai confirms in-character → saved |
| **Personality-aware scheduling dialogue** | Kai confirms differently than Alex (PM). Reinforces "AI team" not "AI tool." | S | Reuse existing role voice prompts; confirmation is just another agent response with card attached |
| **Assignment to specific agent, not generic task** | Lindy binds to agent; OpenAI Tasks is tool-generic. Hatchin's moat is the team — schedules belong to a *person* (Hatch). | S | Routine row: assigneeAgentId required |
| **Deliverable-linked routines** | v2.0 shipped deliverables. Recurring routines that produce deliverables (weekly report) auto-version them. No competitor has this. | M | Reuse deliverable generator; each run = new version in existing version history |
| **"Return briefing" integration** | v1.1 shipped Maya return briefing. Past scheduled runs surface naturally: "While you were away, Kai ran your Monday routine — draft's ready." | S | Hook into existing returnBriefing.ts |
| **Conversational edit** | "Kai, move that to Tuesdays" — agent re-confirms with updated card. No competitor does this (all require dashboard edit). | M | Intent classifier recognizes schedule-modification language; fuzzy match to existing routine |
| **Skip-next-run command** | "Skip next week's growth update, I'm on vacation" — one-off skip without killing the schedule | S | skippedUntil timestamp on routine |
| **Budget-aware scheduling** | On routine creation, show projected cost — "this will use ~30% of your daily budget" before confirming | M | Leverages atomic budget system; cost estimation per routine type |

### Anti-Features (Avoid)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Visual cron editor (day-picker grid, time sliders) | "Power users want precision" | Breaks chat-native brand; Zapier/Relevance own this space | NL + confirmation card handles 95%; show parsed cron in card read-only for the 5% |
| Sub-minute or sub-hourly cadence | "Every 5 minutes" requests | Explodes LLM cost; pointless for creative work | Minimum cadence: hourly. Reject in-character ("I work in longer cycles") |
| Complex conditional triggers ("run only if X") | Zapier-envy | Turns Hatchin into a no-code automation builder — wrong product | Agents decide whether to deliver each run; condition lives in the prompt |
| Cross-routine dependency chains ("after Kai, run Alex") | Sounds like v2.0 chains | v2.0 chains are per-request. Cross-routine deps = distributed systems nightmare | Single routine can internally trigger handoff (existing handoff orchestrator) |
| Shared / team-wide routines | B2B future-state | Premature before multi-user collab ships | Defer to v3.x+ |
| Scheduled new-project creation | Over-generalization | Degenerates into workflow builder | Routines only operate within existing project + assigned Hatch |
| Separate top-level "Routines" nav | "Easier to find" | Fragments mental model; Hatchin is project-scoped | Keep routines in project right sidebar |

---

## Feature Landscape — BUDGET UX

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Live budget-consumed indicator | Users on a cap need to see it; existing UsageBar (v1.2) is the seed | S | Extend UsageBar to show autonomy budget separately from chat usage |
| Approaching-limit warning (~80%) | Stripe, AWS, every SaaS has this | S | Toast + sidebar banner; WS event `usage_warning` exists for chat — extend for autonomy |
| Hard-stop UX at 100% | User must know *why* Hatches went quiet | M | In-character Maya message: "Team's paused for today — daily budget's maxed. Resets at midnight IST." Plus sidebar banner. |
| Reset-time visibility | User needs to know when autonomy resumes | S | Display "Resets at 12:00 AM IST" next to budget bar |
| Per-run cost attribution | "What used it up?" — every cloud dashboard has this | M | Activity feed logs events; add cost field; optional sum chart |
| Failed/blocked run logged (not silent) | Silent budget blocks = trust death | S | Budget-blocked scheduled runs logged as autonomy_event type=budget_blocked, visible in past-runs |
| Upgrade prompt when Pro would unblock | Conversion path | S | Reuse existing UpgradeModal when Free user hits autonomy cap |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **In-character budget communication** | Maya (or assigned Hatch) explains the pause conversationally, not as a sterile error | S | Templated message through existing briefing channel |
| **Budget projection at create time** | Show "this routine will use ~$0.12/week, ~15% of weekly budget" when confirming schedule | M | Requires cost model per deliverable type; Groq-based estimate is cheap |
| **Deferred-run queue** | Instead of killing blocked runs, optionally queue for next reset | M | User opt-in per routine |
| **Per-routine spend breakdown** | Past-runs shows cost per run; routine card shows rolling 7-day spend | S | Already logging cost per event; aggregation query |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| User-editable per-agent budgets | "Power users want granular control" | Complexity explosion; milestone context explicitly defers this | Project-level budget for v3.0; per-agent = v3.x+ |
| Real-time token counter streaming during generation | "Transparency!" | Distracting; competitors don't do this | Per-completion cost logged after the fact |
| Dollar-denominated budgets for Free tier | "Match Pro UX" | Free isn't $-constrained — it's run-count constrained | Free shows "X of Y autonomous runs today"; Pro shows $ |
| Manual budget override button ("let it run anyway") | User frustration escape hatch | Defeats atomic enforcement; breaks billing invariants | Upgrade or wait for reset; be explicit and polite |

---

## Budget-Exhausted UX States

Concrete user-facing states downstream consumer needs for roadmap:

| State | Threshold | UI Surface | User Actions Available |
|-------|-----------|------------|------------------------|
| Normal | 0–79% | UsageBar shows autonomy budget, green | All (create routine, run now, etc.) |
| Approaching | 80–99% | UsageBar amber + toast on crossing 80% + sidebar banner | All, but Hatches may remind ("getting close to budget") |
| Exhausted (soft) | 100% for Free user | Red UsageBar + Maya in-chat message + UpgradeModal on next autonomy action | Upgrade, wait for reset, run chat (unaffected) |
| Exhausted (hard) | 100% for Pro user | Red UsageBar + Maya in-chat message + reset-time display | Wait for reset, adjust routines, run chat (unaffected) |
| Reset | midnight user-TZ | UsageBar back to green; "Team's back online" WS event | All |
| Scheduled run blocked | Any time budget=100% when routine fires | Logged as budget_blocked event, visible in routine past-runs, tab badge | Review in Routines panel; optionally enable deferred-run (P2) |

**Critical invariant:** Chat with Hatches is never blocked by autonomy budget exhaustion — only background/scheduled autonomy. User can always talk to their team.

---

## Feature Dependencies

```
Natural-language schedule parsing
    └──requires──> Intent classifier extension (existing tasks/intentClassifier.ts pattern)
                       └──requires──> Schedule persistence (new scheduled_routines table)
                                          └──requires──> Atomic budget enforcement backend

Confirmation card in chat
    └──requires──> Structured card rendering (existing AutonomousApprovalCard pattern)

Past-run history
    └──requires──> Scheduled-run event type in autonomy_events (existing eventLogger.ts)
                       └──enhances──> Activity feed (v1.3 shipped)

Manual "run now" trigger
    └──requires──> Same execution pipeline as scheduled trigger (reuse taskExecutionPipeline.ts)

Budget projection on routine create
    └──requires──> Atomic budget enforcement + cost estimation model

Deliverable-linked routines
    └──enhances──> v2.0 deliverables (version history, types)

Conversational edit ("move to Tuesdays")
    └──requires──> Fuzzy routine matching (similar to task lifecycle commands)

Deferred-run queue
    └──conflicts──> Strict hard-stop (must be explicit opt-in, not default)
```

### Dependency Notes

- **Scheduler requires atomic budget first:** A scheduled routine firing into a racy budget check = the exact runaway-spend scenario v3.0 exists to fix. Budget enforcement must land first in the milestone.
- **Chat-native scheduling reuses existing intent classifier:** Smart Task Detection (shipped 2026-03-31) gives the pattern — add SCHEDULE_CREATE, SCHEDULE_MODIFY, SCHEDULE_CANCEL, SKIP_NEXT intents.
- **Past-run history reuses existing autonomy events:** Extend event types, don't create a new table for logs.
- **Conflict — deferred-run queue vs strict hard stop:** Opposing philosophies. Default must be hard stop (safer, predictable). Deferred queue = explicit per-routine opt-in, v3.1+.

---

## MVP Definition

### Launch With (v3.0)

**Budget (correctness + minimum UX):**
- [ ] Atomic budget check + deduct in single DB transaction (backend)
- [ ] UsageBar extended to show autonomy budget separately from chat
- [ ] Soft warning at 80% (toast + banner)
- [ ] Hard stop at 100% with in-character Maya message + reset-time display
- [ ] Budget-blocked runs logged as autonomy events, visible in Activity feed
- [ ] Upgrade prompt for Free users hitting autonomy cap

**Scheduled routines:**
- [ ] Natural-language schedule parsing (chrono-node + LLM fallback)
- [ ] Confirmation card in chat before save
- [ ] Routines panel in right sidebar (new tab or merged into Tasks)
- [ ] Pause / resume / delete per routine
- [ ] Past-run history per routine (last 30 runs: status + cost)
- [ ] Timezone handling (browser default, IANA persistence, display in card)
- [ ] Next-run-time display
- [ ] Manual "run now" button
- [ ] Failed-run surfaced in Maya return briefing + tab notification

### Add After Validation (v3.1)

- [ ] Conversational edit ("move that to Tuesdays") — validate users actually phrase it this way
- [ ] Skip-next-run command
- [ ] Budget projection at routine-create time
- [ ] Deferred-run queue (opt-in per routine)
- [ ] Per-routine rolling spend breakdown

### Future (v3.x+ / v4)

- [ ] Per-agent budgets (Paperclip-inspired, deferred per milestone context)
- [ ] Mobile digest of past runs
- [ ] Shared/team routines (requires multi-user collab first)
- [ ] Exportable routine templates
- [ ] Audit-timeline UX for routines

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Atomic budget enforcement (backend) | HIGH (correctness) | MEDIUM | P1 |
| UsageBar autonomy extension | HIGH | LOW | P1 |
| Hard-stop in-character message | HIGH | LOW | P1 |
| NL schedule parsing | HIGH | MEDIUM | P1 |
| Confirmation card | HIGH | LOW | P1 |
| Routines panel | HIGH | MEDIUM | P1 |
| Pause/resume/delete | HIGH | LOW | P1 |
| Past-run history | HIGH | MEDIUM | P1 |
| Timezone handling | HIGH | MEDIUM | P1 |
| Manual "run now" | MEDIUM | LOW | P1 |
| Failed-run notification | HIGH | LOW | P1 |
| Conversational edit | MEDIUM | MEDIUM | P2 |
| Skip-next-run | MEDIUM | LOW | P2 |
| Budget projection on create | MEDIUM | MEDIUM | P2 |
| Deferred-run queue | LOW | MEDIUM | P3 |
| Per-agent budgets | LOW (for now) | HIGH | P3 |

---

## Recommendation: Chat-Native vs UI-Based Schedule Creation

**Primary: chat-native.** Aligns with Hatchin's anti-prompting philosophy and brand. No competitor owns this combination — OpenAI Tasks is closest but still surfaces a Tasks UI as the primary mental model. Hatchin can own "just ask your teammate to do it every Monday."

**Secondary: minimal management panel.** Users still need a place to see all active routines, pause them, and review history. Table stakes per competitive research. Keep in existing right sidebar (new Routines tab or merged into Tasks), not top-level nav.

**Explicitly reject: visual cron editor / drag-and-drop builder.** That's Zapier's lane. Fighting there is off-brand and duplicative. Confirmation card shows parsed schedule in human-readable form; power users who want precision specify in natural language ("every weekday at 9am except holidays") — parser + LLM handles it.

**Concrete flow:**
1. User (in chat with Kai): "draft the growth update every Monday morning"
2. Intent classifier detects SCHEDULE_CREATE
3. NL parser extracts: cadence=weekly, dow=Mon, time=09:00, tz=user-browser
4. Kai responds in-character + confirmation card renders: "Every Monday at 9:00 AM IST — draft the growth update. First run: Mon Apr 20. [Confirm] [Edit] [Cancel]"
5. Confirm → routine saved → tab-badge + appears in Routines panel

---

## Competitor Feature Analysis

| Feature | OpenAI ChatGPT Tasks | Lindy | Hatchin Approach |
|---------|---------------------|-------|------------------|
| Creation | Chat + inline confirm | NL chat + visual trigger picker | Pure chat with assigned Hatch + confirmation card |
| Storage/nav | Tasks sidebar (separate) | Per-agent dashboard list | Right-sidebar Routines tab (project-scoped) |
| Past runs | Each run = new chat thread | Per-agent run log with outputs | Per-routine history card + deliverable version link |
| Editing | Delete + recreate | Dashboard edit | Conversational edit — differentiator |
| Timezone | Account TZ | Per-agent TZ setting | Browser default, overridable in confirmation card |
| Budget integration | N/A (bundled) | Per-agent usage visible | Projected cost at create + live deduction |
| Personality | Single assistant | Per-agent, utilitarian | Role-voiced confirmation (Kai sounds like Kai) |

---

## Sources

- OpenAI ChatGPT scheduled tasks (announced Jan 2025) — product docs + user reports
- Lindy AI agents (lindy.ai) — public docs, pricing, demo videos
- Zapier AI Agents + Zap scheduling (zapier.com/ai-agents) — help docs
- Relevance AI (relevance.ai) — agent scheduling primitives
- CrewAI + AutoGen framework repos — absence of scheduling confirms they defer to external orchestration
- Paperclip product (per milestone context — not independently verified)
- Hatchin internal: CLAUDE.md, PROJECT.md, MILESTONES.md, shipped v1.1/v1.2/v1.3/v2.0 infrastructure

**Confidence caveats:**
- OpenAI Tasks exact UX: MEDIUM (feature is recent, UX has iterated)
- Lindy past-run UX: MEDIUM (verified via public demos, not hands-on)
- Paperclip: LOW (referenced without independent verification) — recommendations don't depend on Paperclip specifics
- First-principles UX (chat-native, confirmation card, personality-aware): HIGH — follows from Hatchin's brand + shipped patterns

---
*Feature research for: v3.0 Reliable Autonomy (scheduled routines + budget UX)*
*Researched: 2026-04-13*
