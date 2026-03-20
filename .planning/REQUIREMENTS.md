# Requirements: Hatchin

**Defined:** 2026-03-19
**Core Value:** No one should ever feel alone with their idea, have to start from scratch, or need to know how to prompt AI — just have a conversation and your team takes it from there.

## v1.1 Requirements

Requirements for Autonomous Execution Loop. Each maps to roadmap phases.

### Background Execution

- [x] **EXEC-01**: User can explicitly trigger autonomous execution by telling a Hatch to "go ahead and work on this"
- [x] **EXEC-02**: Hatches execute tasks in background via durable job queue (pg-boss), producing real output (plans, breakdowns, research)
- [x] **EXEC-03**: Per-project daily LLM spend cap prevents runaway cost from background execution
- [x] **EXEC-04**: System detects user inactivity (2+ hours) and auto-triggers queued autonomous work (first task only, blast radius limited)

### Agent Handoffs

- [ ] **HAND-01**: When a Hatch completes a task, the system routes the next task to the appropriate specialist based on task type
- [ ] **HAND-02**: Hatches announce handoffs in-character in chat ("I've finished the scope, tagging @Engineer to pick this up")
- [x] **HAND-03**: Task graph has cycle detection to prevent infinite handoff loops between agents (BFS in HandoffTracker)
- [ ] **HAND-04**: Each agent in the handoff chain receives the previous agent's output as context

### Safety & Autonomy

- [x] **SAFE-01**: Low-risk autonomous actions execute without approval; high-risk actions surface for user sign-off (frontend handler + toast)
- [x] **SAFE-02**: Safety scoring adapted for autonomous context (no user message) with appropriate baseline risk
- [x] **SAFE-03**: Autonomous outputs undergo peer review by another Hatch before delivery
- [ ] **SAFE-04**: Agents build trust score over time — successful completions unlock higher autonomy thresholds *(deferred)*

### User Experience

- [x] **UX-01**: Frontend renders interactive approval cards with Approve/Reject/Modify buttons for high-risk autonomous actions (toast with risk reasons)
- [x] **UX-02**: "Team is working..." presence indicator visible in chat during autonomous execution
- [x] **UX-03**: Maya delivers a chat summary briefing when user returns after autonomous work completed (returnBriefing.ts)
- [ ] **UX-04**: User can pause or cancel autonomous execution mid-run *(deferred)*
- [x] **UX-05**: Browser tab title flashes / shows badge when autonomous work completes while tab is inactive

## Future Requirements

### Notifications (v1.2)

- **NOTF-01**: User receives email digest of autonomous work completed while offline
- **NOTF-02**: Push notification when high-risk action awaits approval
- **NOTF-03**: User can configure notification preferences (frequency, channels)

### Advanced Autonomy (v1.2+)

- **AUTO-01**: Hatches initiate work proactively based on project health scoring
- **AUTO-02**: Execution trace narrative — detailed step-by-step log of what each Hatch did and why
- **AUTO-03**: Multi-project autonomous scheduling — prioritize across projects

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time video/audio between agents | Massive infra, not core to execution loop |
| External tool execution (GitHub, Linear) | Integrations deferred to v1.3+ |
| Custom autonomy policies per agent | Progressive trust covers this simply; per-agent config is premature |
| Multi-user approval workflows | Single-user product for now; collaboration is v1.4 |
| Redis/BullMQ job queue | pg-boss runs on existing PostgreSQL — no new infrastructure |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| EXEC-01 | Phase 6 | Complete |
| EXEC-02 | Phase 6 | Complete |
| EXEC-03 | Phase 6 | Complete |
| EXEC-04 | Phase 6 | Complete |
| HAND-01 | Phase 7 | Pending |
| HAND-02 | Phase 7 | Pending |
| HAND-03 | Phase 6 | Complete |
| HAND-04 | Phase 7 | Pending |
| SAFE-01 | Phase 6 | Complete |
| SAFE-02 | Phase 6 | Complete |
| SAFE-03 | Phase 6 | Complete |
| SAFE-04 | Phase 9 | Deferred |
| UX-01 | Phase 6 | Complete |
| UX-02 | Phase 6 | Complete |
| UX-03 | Phase 6 | Complete |
| UX-04 | Phase 7 | Deferred |
| UX-05 | Phase 6 | Complete |

**Coverage:**
- v1.1 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-19*
*Last updated: 2026-03-20 — 13/17 complete after gap fixes + intent classifier wiring*
