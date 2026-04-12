# Requirements: Hatchin v3.0 Reliable Autonomy

**Defined:** 2026-04-13
**Core Value:** No one should ever feel alone with their idea, have to start from scratch, or need to know how to prompt AI — just have a conversation and your team takes it from there.

**Milestone goal:** Harden the autonomous execution loop so users can trust it. Close the check-then-act budget race, and let Hatches do recurring work on a natural-language schedule.

---

## v3.0 Requirements

### Budget (BUDG)

- [ ] **BUDG-01**: System enforces per-project daily autonomy budget atomically — concurrent background tasks cannot bypass the cap
- [ ] **BUDG-02**: Failed or cancelled autonomous tasks release their reserved budget slot (no permanent leaks)
- [ ] **BUDG-03**: Daily reconciliation job detects drift between reserved counter and `autonomy_events` count of truth
- [ ] **BUDG-04**: User sees autonomy budget consumption in UsageBar alongside existing message budget
- [ ] **BUDG-05**: User receives soft warning at 80% autonomy budget consumption
- [ ] **BUDG-06**: User sees in-character Maya message when autonomy budget is exhausted (hard stop at 100%)
- [ ] **BUDG-07**: `budget_blocked` events surface in the Activity feed with timestamp and blocked task context
- [ ] **BUDG-08**: Free-tier users hitting autonomy budget see UpgradeModal prompt

### Scheduling Backend (SCHED)

- [ ] **SCHED-01**: User can create a scheduled routine via API (`POST /api/routines`) with agent, cron, timezone, instruction
- [ ] **SCHED-02**: Scheduled routines fire on cron using pg-boss's distributed scheduler (single-fire across nodes)
- [ ] **SCHED-03**: Scheduled fire creates a task and enqueues it through existing autonomous execution pipeline (no parallel path)
- [ ] **SCHED-04**: Routine execution results (success/failure/blocked) are recorded in `last_run_status` + `last_run_task_id`
- [ ] **SCHED-05**: Routine auto-pauses after 3 consecutive failures with `paused_reason` set
- [ ] **SCHED-06**: Deleting an agent or project cascades to remove dangling scheduled routines
- [ ] **SCHED-07**: Routines are gated to Pro tier via existing `tierGate` middleware
- [ ] **SCHED-08**: Each project has a maximum of 10 active routines (abuse prevention)
- [ ] **SCHED-09**: System re-registers routines with pg-boss on server boot (survives restarts)

### Chat-Native Creation (CHAT)

- [ ] **CHAT-01**: User can create a routine by typing natural language to an agent ("Kai, draft the growth update every Monday at 9am")
- [ ] **CHAT-02**: `intentClassifier` detects SCHEDULE_REQUEST before EXPLICIT_TASK_REQUEST (schedule wins on ambiguity)
- [ ] **CHAT-03**: `schedulePhraseParser` converts natural language to cron expression + IANA timezone
- [ ] **CHAT-04**: Agent responds with in-character confirmation card showing parsed schedule and task template
- [ ] **CHAT-05**: User can cancel the confirmation card inline without creating the routine
- [ ] **CHAT-06**: Prompt-injection defense — NL instruction capped at 500 chars, delimited framing when injected into LLM prompts

### Routines Management (MGMT)

- [ ] **MGMT-01**: User sees a Routines tab in the right sidebar listing all project routines
- [ ] **MGMT-02**: Each routine card shows: agent avatar, schedule in human-readable form, next run time, last run status
- [ ] **MGMT-03**: User can pause/resume a routine inline
- [ ] **MGMT-04**: User can manually trigger a routine ("Run now") outside its schedule
- [ ] **MGMT-05**: User can delete a routine (unschedules pg-boss entry)
- [ ] **MGMT-06**: Routine card shows last 30 past runs with status and cost
- [ ] **MGMT-07**: Failed routine runs appear in Maya's return briefing when user re-opens the app
- [ ] **MGMT-08**: Tab badge indicates unread routine completions when user is away

### Verification (VER)

- [ ] **VER-01**: Concurrent-execution test proves exactly N tasks pass budget gate when limit is N (10 concurrent, limit=5 → 5 pass, 5 blocked)
- [ ] **VER-02**: DST transition test (fixed-date) proves routines fire at correct wall-clock time across spring-forward / fall-back
- [ ] **VER-03**: Multi-replica test proves pg-boss fires each schedule exactly once (no double execution)
- [ ] **VER-04**: Red-team prompt-injection suite (≥15 adversarial NL schedule phrases) — none escape delimited framing

---

## v3.1+ Deferred

### Audit Timeline (AUDIT)
- **AUDIT-01**: Per-task replayable timeline UX surfacing `autonomy_events`
- **AUDIT-02**: Decision explanations (why this agent, why this risk score)

### Templates (TMPL)
- **TMPL-01**: Export project org + agents + brain docs as JSON with secret scrubbing
- **TMPL-02**: Import JSON to create a new project from template

### Config Rollback (ROLL)
- **ROLL-01**: Version agent personality / brain config edits
- **ROLL-02**: Undo changes from UI

### Mobile Digest (MOB)
- **MOB-01**: Mobile-first "what did my team do today" summary page
- **MOB-02**: Push notification for completed background work

### Per-Agent Budget (PAB)
- **PAB-01**: User can set monthly budget per individual agent
- **PAB-02**: System enforces per-agent cap atomically (extends v3.0 ledger)

### Conversational Schedule Edit
- **CHAT-07**: `SCHEDULE_UPDATE` intent — change existing routine via chat
- **CHAT-08**: `SCHEDULE_CANCEL` intent — delete routine via chat
- **MGMT-09**: Skip-next-run option on routine card

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Visual cron editor | Off-brand — Zapier lane; Hatchin is chat-native |
| Sub-hourly cadence | Cost abuse vector; minimum cadence is hourly |
| Cross-routine dependency chains | Complexity trap; solvable via agent handoff in a single routine |
| Shared / team routines | Deferred to multi-user collaboration milestone |
| User-editable per-agent budgets | Defer to v3.1 PAB requirements |
| Manual budget override | Erodes the safety net v3.0 creates |
| Budget projection at creation time | Speculative; model unproven |
| Deferred-run queue (catch up missed runs) | Opt-in only, defer to v3.1 |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BUDG-01 | Phase 22 | Pending |
| BUDG-02 | Phase 22 | Pending |
| BUDG-03 | Phase 22 | Pending |
| BUDG-04 | Phase 23 | Pending |
| BUDG-05 | Phase 23 | Pending |
| BUDG-06 | Phase 23 | Pending |
| BUDG-07 | Phase 23 | Pending |
| BUDG-08 | Phase 23 | Pending |
| SCHED-01 | Phase 24 | Pending |
| SCHED-02 | Phase 24 | Pending |
| SCHED-03 | Phase 24 | Pending |
| SCHED-04 | Phase 24 | Pending |
| SCHED-05 | Phase 24 | Pending |
| SCHED-06 | Phase 24 | Pending |
| SCHED-07 | Phase 24 | Pending |
| SCHED-08 | Phase 24 | Pending |
| SCHED-09 | Phase 24 | Pending |
| CHAT-01 | Phase 25 | Pending |
| CHAT-02 | Phase 25 | Pending |
| CHAT-03 | Phase 25 | Pending |
| CHAT-04 | Phase 25 | Pending |
| CHAT-05 | Phase 25 | Pending |
| CHAT-06 | Phase 25 | Pending |
| MGMT-01 | Phase 26 | Pending |
| MGMT-02 | Phase 26 | Pending |
| MGMT-03 | Phase 26 | Pending |
| MGMT-04 | Phase 26 | Pending |
| MGMT-05 | Phase 26 | Pending |
| MGMT-06 | Phase 26 | Pending |
| MGMT-07 | Phase 26 | Pending |
| MGMT-08 | Phase 26 | Pending |
| VER-01 | Phase 27 | Pending |
| VER-02 | Phase 27 | Pending |
| VER-03 | Phase 27 | Pending |
| VER-04 | Phase 27 | Pending |

**Coverage:**
- v3.0 requirements: 32 total
- Mapped to phases: 32
- Unmapped: 0 ✓

---

*Requirements defined: 2026-04-13*
*Last updated: 2026-04-13 after v3.0 milestone requirements definition*
