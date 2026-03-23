# Roadmap: Hatchin

## Milestones

- ✅ **v1.0 Text-Perfect, Human-First** — Phases 1-5 (shipped 2026-03-19) — [archive](milestones/v1.0-ROADMAP.md)
- 🚧 **v1.1 Autonomous Execution Loop** — Phases 6-9 (in progress)

---

<details>
<summary>✅ v1.0 Text-Perfect, Human-First (Phases 1-5) — SHIPPED 2026-03-19</summary>

See archived roadmap: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

**Phases completed:**
- Phase 1: Hatch Conversation Quality
- Phase 2: User Journey Fixes
- Phase 3: Hatch Presence and Avatar System
- Phase 4: Data Reliability and Resilience
- Phase 5: Route Architecture Cleanup

</details>

---

### 🚧 v1.1 Autonomous Execution Loop (In Progress)

**Milestone Goal:** Hatches don't just talk — they execute. Users trigger work, Hatches hand off tasks between each other, self-review quality, and present real results. The user comes back to completed work and a chat summary of what happened.

## Phases

- [x] **Phase 6: Background Execution Foundation** — Safe single-agent execution pipeline with cost guardrails and explicit trigger
- [x] **Phase 7: Agent Handoffs and Approval UI** — Full multi-agent handoff chain with interactive approval cards and pause/cancel controls (completed 2026-03-20)
- [x] **Phase 8: Chat Summary and Tab Notifications** — Maya briefing on user return and browser tab badge when work completes offline (completed 2026-03-22)
- [ ] **Phase 9: Progressive Trust and Inactivity Trigger** — Trust score accumulation and inactivity-based auto-trigger gated by feature flag

## Phase Details

### Phase 6: Background Execution Foundation
**Goal**: Users can trigger autonomous execution and watch their Hatches produce real output safely
**Depends on**: v1.0 platform (LangGraph, safety gates, task graph — all existing)
**Requirements**: EXEC-01, EXEC-02, EXEC-03, SAFE-01, SAFE-02, SAFE-03, UX-02
**Success Criteria** (what must be TRUE):
  1. User can tell a Hatch to "go ahead and work on this" and the system acknowledges and begins execution
  2. A "Team is working..." indicator appears in chat and remains visible while background execution runs
  3. Low-risk tasks complete automatically and their output (plans, breakdowns, research) appears as Hatch messages
  4. High-risk tasks surface an approval request in chat rather than executing silently
  5. No single project exceeds its daily LLM spend cap regardless of how many tasks are queued
**Plans:** 4/4 plans complete

Plans:
- [x] 06-01-PLAN.md — AutonomyTriggerResolver, policies.ts cost cap, pg-boss job queue setup
- [x] 06-02-PLAN.md — safety.ts autonomous execution context extension
- [x] 06-03-PLAN.md — TaskExecutionPipeline with peer review gate and output storage
- [x] 06-04-PLAN.md — backgroundRunner cron, chat.ts trigger hook, CenterPanel working indicator

### Phase 7: Agent Handoffs and Approval UI
**Goal**: Hatches pass work to each other in character and users approve or reject high-risk actions with one click
**Depends on**: Phase 6
**Requirements**: HAND-01, HAND-02, HAND-03, HAND-04, UX-01, UX-04
**Success Criteria** (what must be TRUE):
  1. After a Hatch completes a task, the next appropriate specialist Hatch automatically picks up the relevant follow-on task
  2. The receiving Hatch announces the handoff in chat in its own voice ("Got it, picking this up from PM")
  3. The handoff chain cannot loop — if a cycle is detected, execution stops and the user is notified
  4. Each Hatch in the chain has access to the previous Hatch's output when composing its response
  5. User can approve or reject a high-risk action proposal with a single button click, no typing required
  6. User can pause or cancel all ongoing autonomous execution at any point
**Plans:** 4/4 plans complete

Plans:
- [ ] 07-01-PLAN.md — HandoffOrchestrator with routing via evaluateConductorDecision, cycle detection, max-hops guard
- [ ] 07-02-PLAN.md — In-character handoff announcements with tone-safe LLM generation
- [ ] 07-03-PLAN.md — Approve/reject REST endpoints + AutonomousApprovalCard inline component
- [ ] 07-04-PLAN.md — Pause/resume button in working indicator via autonomyPaused flag

### Phase 8: Chat Summary and Tab Notifications
**Goal**: Users return to a conversational briefing from Maya and never miss completed work due to an inactive tab
**Depends on**: Phase 7
**Requirements**: UX-03, UX-05
**Success Criteria** (what must be TRUE):
  1. When a user returns after autonomous work completed, Maya delivers exactly one briefing message leading with outcomes ("Authentication module scoped — two items need your review"), not process details
  2. The briefing does not repeat if the user sends another message shortly after; it appears once per absence session
  3. The browser tab title shows a badge or flashing indicator when autonomous work completes while the tab is in the background
**Plans:** 2/2 plans complete

Plans:
- [ ] 08-01-PLAN.md — Maya return briefing with LLM voice, DB-backed idempotency, 15-min absence threshold
- [ ] 08-02-PLAN.md — Flashing tab title (Slack pattern) and OS Notification API on completion

### Phase 9: Progressive Trust and Inactivity Trigger
**Goal**: Agents earn higher autonomy through track record and the system can start working when users go idle
**Depends on**: Phase 8
**Requirements**: EXEC-04, SAFE-04
**Success Criteria** (what must be TRUE):
  1. An agent that has completed tasks successfully is offered higher-risk work without manual approval over time
  2. After 4+ hours of user inactivity, queued autonomous work begins automatically (when feature flag enabled)
  3. The inactivity trigger can be disabled per-project without affecting any other autonomy behavior
**Plans:** 2 plans

Plans:
- [ ] 09-01-PLAN.md — Trust schema type fix + behavioral verification tests for SAFE-04
- [ ] 09-02-PLAN.md — inactivityAutonomyEnabled flag + backgroundRunner gating + inactivity tests for EXEC-04

## Progress

**Execution Order:** Phases execute in numeric order: 6 → 7 → 8 → 9

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Hatch Conversation Quality | v1.0 | 8/8 | Complete | 2026-03-19 |
| 2. User Journey Fixes | v1.0 | 7/7 | Complete | 2026-03-19 |
| 3. Hatch Presence and Avatar System | v1.0 | 5/5 | Complete | 2026-03-19 |
| 4. Data Reliability and Resilience | v1.0 | 3/3 | Complete | 2026-03-19 |
| 5. Route Architecture Cleanup | v1.0 | 2/2 | Complete | 2026-03-19 |
| 6. Background Execution Foundation | 4/4 | Complete   | 2026-03-20 | 2026-03-20 |
| 7. Agent Handoffs and Approval UI | 4/4 | Complete   | 2026-03-20 | - |
| 8. Chat Summary and Tab Notifications | 2/2 | Complete   | 2026-03-22 | - |
| 9. Progressive Trust and Inactivity Trigger | v1.1 | 0/2 | Planning complete | - |

---

## Future Milestones (captured for context)

### v1.2 — Notifications and Advanced Autonomy
- Email digest of autonomous work completed while offline (NOTF-01)
- Push notification for high-risk approval requests (NOTF-02)
- User-configurable notification preferences (NOTF-03)
- Proactive execution based on project health scoring (AUTO-01)
- Execution trace narrative — detailed Hatch activity log (AUTO-02)

### v1.3 — B2B Company Brain
- Company-level knowledge layer: brand guidelines, tone of voice, design system, product docs uploaded once
- All projects within a company inherit company brain automatically
- Admin panel for company brain management

### v1.4 — Collaboration
- Multiple real users working in the same project alongside their Hatch team
- Real teammates and AI teammates in the same conversation
- Role-based access: who can add Hatches, edit Brain, see which conversations

---
*Roadmap created: 2026-03-17*
*v1.0 shipped: 2026-03-19*
*v1.1 roadmap added: 2026-03-19*
