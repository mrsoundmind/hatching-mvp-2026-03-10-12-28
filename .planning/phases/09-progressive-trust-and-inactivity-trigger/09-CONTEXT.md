# Phase 9: Progressive Trust and Inactivity Trigger - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Agents earn higher autonomy through track record (progressive trust scoring wired into safety gates) and the system auto-starts queued work when users go idle (inactivity cron gated by per-project feature flag). This is the final phase of v1.1 — Autonomous Execution Loop.

</domain>

<decisions>
## Implementation Decisions

### Trust progression behavior
- Keep existing MATURITY_THRESHOLD=10 — agent needs 10 tasks before reaching full trust potential
- Proportional failure drop — trust recalculates from full history (no amplified penalty). 9 successes + 1 failure = natural consequence
- No trust decay over time — trust persists until execution outcomes change it
- Trust score is invisible to users — works behind the scenes, users just notice fewer approval prompts over time
- The key gap to close: trust score must actually be PERSISTED to DB after each task execution and WIRED into safety gate threshold adjustments

### Inactivity trigger rules
- Threshold: Claude's discretion (2-4 hours range — current code uses 2h, success criteria says 4h)
- First task only per inactivity trigger — handoff chain (Phase 7) can pick up subsequent work
- Cron job in existing backgroundRunner.ts — check every 30 min, reuses node-cron infra already installed
- Notification via Phase 8 return briefing — no extra notification needed during execution; tab badge + OS notification already handle it
- The `resolveAutonomyTrigger` function already has the inactivity detection logic — needs to be CALLED by the cron job

### Per-project controls
- `inactivityAutonomyEnabled` field in project.executionRules JSONB — same pattern as `autonomyPaused` from Phase 7
- Toggle via existing `PATCH /api/projects/:id` endpoint — no new API needed
- Disabled by default for new projects — users opt-in explicitly
- Disabling stops everything — any in-progress handoff chains from inactivity triggers also halt (leverage existing autonomyPaused check in handleTaskJob)

### Claude's Discretion
- Exact inactivity threshold within the 2-4 hour range
- Cron polling interval (30 min suggested, can adjust)
- How to wire `lastSeenAt` from Phase 8 into the inactivity check (reuse existing column vs separate tracking)
- Whether to add a `triggerSource: 'inactivity' | 'explicit'` field to autonomy events for observability

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Trust scoring (existing implementation to wire)
- `server/autonomy/trustScoring/trustScorer.ts` — calculateTrustScore + updateTrustMeta (79 lines, fully implemented)
- `server/autonomy/trustScoring/trustAdapter.ts` — getAdjustedThresholds (39 lines, converts trust to threshold boosts)
- `server/autonomy/execution/taskExecutionPipeline.ts` — Already imports both modules; trust must be persisted after executeTask completes

### Inactivity trigger (existing logic to wire into cron)
- `server/autonomy/triggers/autonomyTriggerResolver.ts` — resolveAutonomyTrigger with inactivity detection (67 lines, fully implemented)
- `server/autonomy/background/backgroundRunner.ts` — node-cron scheduler with health check cycle; add inactivity cron here
- `server/autonomy/config/policies.ts` — Budget constants and policy config

### Safety gates (where trust adjustments apply)
- `server/ai/safety.ts` — AUTONOMOUS_SAFETY_THRESHOLDS used by executeTask
- `server/autonomy/peerReview/peerReviewRunner.ts` — Peer review gate triggered at mid-risk

### Per-project controls (existing pattern)
- `shared/schema.ts` — projects.executionRules JSONB (already has autonomyPaused)
- `server/routes/chat.ts` — join_conversation handler with lastSeenAt tracking (from Phase 8)

### Requirements
- `.planning/REQUIREMENTS.md` — EXEC-04 (inactivity auto-trigger) and SAFE-04 (progressive trust)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `trustScorer.ts` — fully implemented, just needs DB persistence wiring
- `trustAdapter.ts` — fully implemented, `getAdjustedThresholds(trustScore)` returns adjusted thresholds
- `autonomyTriggerResolver.ts` — fully implemented, pure function with no I/O, needs cron caller
- `backgroundRunner.ts` — node-cron infrastructure with start/stop, HMR guard, health check cycle
- `lastSeenAt` column on projects (from Phase 8) — can be reused for inactivity detection
- `handleTaskJob` pause check pattern — existing `autonomyPaused` guard to extend with `inactivityAutonomyEnabled`

### Established Patterns
- `executionRules` JSONB pattern: `autonomyPaused` boolean toggled via PATCH, checked in handleTaskJob
- Trust meta stored in `agent.personality` JSONB (`adaptedTraits` pattern from Phase 3)
- `logAutonomyEvent` for audit trail — add `triggerSource` to event payload
- `broadcastToConversation` for real-time UI updates

### Integration Points
- `taskExecutionPipeline.ts` `executeTask()` completion path — persist trust update after success/failure
- `handleTaskJob()` — apply trust-adjusted thresholds before safety gate check
- `backgroundRunner.ts` cron schedule — add inactivity check cron alongside existing health check
- `projects.executionRules` — add `inactivityAutonomyEnabled` field

</code_context>

<specifics>
## Specific Ideas

- Much of this phase is wiring existing implementations together rather than building from scratch
- The trust system should feel invisible — users just notice that over time, fewer tasks need their approval
- Inactivity trigger should leverage the Phase 8 `lastSeenAt` column rather than creating separate tracking

</specifics>

<deferred>
## Deferred Ideas

- Trust score visibility in UI (user explicitly chose invisible — could add in v1.2 if users ask)
- Configurable inactivity threshold per project (v1.2 — keep simple for now)
- Trust history visualization / audit log (v1.2)

</deferred>

---

*Phase: 09-progressive-trust-and-inactivity-trigger*
*Context gathered: 2026-03-22*
