# Phase 9: Progressive Trust and Inactivity Trigger - Research

**Researched:** 2026-03-22
**Domain:** Autonomous execution trust scoring persistence + cron-driven inactivity trigger
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Trust progression behavior:**
- Keep existing MATURITY_THRESHOLD=10 — agent needs 10 tasks before reaching full trust potential
- Proportional failure drop — trust recalculates from full history (no amplified penalty). 9 successes + 1 failure = natural consequence
- No trust decay over time — trust persists until execution outcomes change it
- Trust score is invisible to users — works behind the scenes, users just notice fewer approval prompts over time
- The key gap to close: trust score must actually be PERSISTED to DB after each task execution and WIRED into safety gate threshold adjustments

**Inactivity trigger rules:**
- Threshold: Claude's discretion (2-4 hours range — current code uses 2h, success criteria says 4h)
- First task only per inactivity trigger — handoff chain (Phase 7) can pick up subsequent work
- Cron job in existing backgroundRunner.ts — check every 30 min, reuses node-cron infra already installed
- Notification via Phase 8 return briefing — no extra notification needed during execution; tab badge + OS notification already handle it
- The `resolveAutonomyTrigger` function already has the inactivity detection logic — needs to be CALLED by the cron job

**Per-project controls:**
- `inactivityAutonomyEnabled` field in project.executionRules JSONB — same pattern as `autonomyPaused` from Phase 7
- Toggle via existing `PATCH /api/projects/:id` endpoint — no new API needed
- Disabled by default for new projects — users opt-in explicitly
- Disabling stops everything — any in-progress handoff chains from inactivity triggers also halt (leverage existing autonomyPaused check in handleTaskJob)

### Claude's Discretion
- Exact inactivity threshold within the 2-4 hour range
- Cron polling interval (30 min suggested, can adjust)
- How to wire `lastSeenAt` from Phase 8 into the inactivity check (reuse existing column vs separate tracking)
- Whether to add a `triggerSource: 'inactivity' | 'explicit'` field to autonomy events for observability

### Deferred Ideas (OUT OF SCOPE)
- Trust score visibility in UI (user explicitly chose invisible — could add in v1.2 if users ask)
- Configurable inactivity threshold per project (v1.2 — keep simple for now)
- Trust history visualization / audit log (v1.2)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SAFE-04 | Agents build trust score over time — successful completions unlock higher autonomy thresholds | trustScorer.ts and trustAdapter.ts are fully implemented; gap is DB persistence after executeTask completes and wiring getAdjustedThresholds into the safety gate check |
| EXEC-04 | System detects user inactivity (2+ hours) and auto-triggers queued autonomous work (first task only, blast radius limited) | resolveAutonomyTrigger already implements inactivity detection; gap is calling it from a dedicated cron job gated by `inactivityAutonomyEnabled` per-project flag |
</phase_requirements>

---

## Summary

Phase 9 is a wiring phase, not a build phase. Both core algorithms are already implemented: `trustScorer.ts` has `calculateTrustScore` and `updateTrustMeta`; `trustAdapter.ts` has `getAdjustedThresholds`; `autonomyTriggerResolver.ts` has inactivity detection logic. `taskExecutionPipeline.ts` already calls `updateAgentTrustScore` and `getAdjustedThresholds` — so the trust loop is structurally wired but the **persistence path has a gap**: `updateAgentTrustScore` fetches the agent, merges `trustMeta` into `personality`, and calls `storage.updateAgent`. Reading the code confirms this IS already implemented in `taskExecutionPipeline.ts` lines 261-278. The trust write path exists.

The actual gaps are narrower than the CONTEXT suggests. For Plan 09-01 (trust): the pipeline already persists trust on task completion and failure — the planner needs to verify this via a targeted test that reads back the agent personality after execution and confirms `trustMeta` is present and incremented. For Plan 09-02 (inactivity cron): `backgroundRunner.ts` has `runAutonomousExecutionCycle` that calls `resolveAutonomyTrigger` — but it uses `project.executionRules?.autonomyEnabled` as the autonomy gate, not a dedicated `inactivityAutonomyEnabled` flag. The inactivity path through that function is currently indistinguishable from the explicit trigger path for gating purposes.

**Primary recommendation:** Plan 09-01 writes a test to verify trust persists to DB after task execution, then adds `inactivityAutonomyEnabled` check inside `handleTaskJob`. Plan 09-02 adds the dedicated inactivity cron schedule to `backgroundRunner.ts`, reads `project.lastSeenAt` for inactivity detection, and gates on `project.executionRules?.inactivityAutonomyEnabled`.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| node-cron | already installed | Cron scheduling for inactivity check | Already used in backgroundRunner.ts — no new dependency |
| Drizzle ORM | 0.39.1 | Persisting trustMeta to agents.personality JSONB | Project ORM — all DB writes go through storage interface |
| PostgreSQL (Neon) | serverless | Storage backend for agent personality + project executionRules | Project DB |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `server/autonomy/trustScoring/trustScorer.ts` | internal | `calculateTrustScore`, `updateTrustMeta` | Called from taskExecutionPipeline on every task completion/failure |
| `server/autonomy/trustScoring/trustAdapter.ts` | internal | `getAdjustedThresholds(trustScore)` | Called from taskExecutionPipeline before safety gate check |
| `server/autonomy/triggers/autonomyTriggerResolver.ts` | internal | `resolveAutonomyTrigger` with inactivity detection | Called from inactivity cron in backgroundRunner |

**No new npm packages needed for this phase.**

---

## Architecture Patterns

### Recommended Project Structure
No new files needed. Changes are confined to:

```
server/
├── autonomy/
│   ├── background/
│   │   └── backgroundRunner.ts        # Add inactivity cron schedule
│   └── execution/
│       └── taskExecutionPipeline.ts   # Verify trust persistence + add inactivityAutonomyEnabled check
shared/
└── schema.ts                          # Add inactivityAutonomyEnabled to executionRules type
```

### Pattern 1: Trust Meta JSONB Write (already implemented, verify coverage)

The existing `updateAgentTrustScore` helper in `taskExecutionPipeline.ts`:
1. Fetches agent from storage
2. Merges `trustMeta` into `personality` JSONB
3. Calls `storage.updateAgent(agentId, { personality: { ...personality, trustMeta: updatedTrust } })`

This pattern is already established and correct. The schema type for `agents.personality` does NOT include `trustMeta` in its Drizzle type definition — the type is open (`$type<{ traits?, communicationStyle?, ... }>`) but it uses spread so extra keys survive. No schema migration needed; JSONB absorbs arbitrary keys.

**Verification gap:** No test currently reads back `agent.personality.trustMeta` from storage after a task execution to confirm the value was actually written and returned. Plan 09-01 must add this test.

### Pattern 2: Per-project Feature Flag via executionRules JSONB

`project.executionRules` is already JSONB with `autonomyEnabled`, `autonomyPaused`. Adding `inactivityAutonomyEnabled` follows identical pattern:

```typescript
// Source: shared/schema.ts line 48-53
executionRules: jsonb("execution_rules").$type<{
  autonomyEnabled?: boolean;
  autonomyPaused?: boolean;
  inactivityAutonomyEnabled?: boolean;  // ADD THIS
  rules?: string;
  taskGraph?: unknown;
}>().default({}),
```

Reading the flag in `handleTaskJob`:
```typescript
// In handleTaskJob — after existing autonomyPaused check
if (triggerSource === 'inactivity' &&
    !(project.executionRules as any)?.inactivityAutonomyEnabled) {
  return; // Inactivity trigger disabled for this project
}
```

The cleaner approach: pass `triggerSource` from the cron caller through `queueTaskExecution` job data, then check in `handleTaskJob`. This avoids re-reading project in the cron and lets the job worker enforce the gate.

**Alternative (simpler):** Check `inactivityAutonomyEnabled` inside `runInactivityTriggerCycle` before even queuing — never queue if flag is false. This is simpler but puts policy enforcement in the scheduler, not the executor. Either approach is valid; checking in the cycle is simpler.

### Pattern 3: Inactivity Cron in backgroundRunner.ts

Current `runAutonomousExecutionCycle` already calls `resolveAutonomyTrigger` with `lastUserActivityAt`. However, it uses `project.executionRules?.autonomyEnabled` as the gate — which means it fires for ANY autonomous project, not just inactivity-enabled ones.

The gap: `resolveAutonomyTrigger` returns `reason: 'inactivity'` when no explicit trigger phrase is found but the inactivity threshold is met. The backgroundRunner already checks this but doesn't differentiate the inactivity flag from the general autonomy flag.

**Implementation strategy:**

```typescript
// In runAutonomousExecutionCycle — replace current autonomyEnabled gate with:
const trigger = resolveAutonomyTrigger({
  lastUserActivityAt,
  pendingTasks: tasks.map((t: any) => ({ id: t.id, status: t.status })),
  autonomyEnabled: project.executionRules?.autonomyEnabled ?? false,
});

// New: if reason is 'inactivity', also check inactivityAutonomyEnabled
if (!trigger.shouldExecute) continue;
if (
  trigger.reason === 'inactivity' &&
  !(project.executionRules as any)?.inactivityAutonomyEnabled
) continue;
```

This gates inactivity triggers on the new flag without changing explicit trigger behavior.

### Pattern 4: lastSeenAt Reuse for Inactivity Detection

`projects.lastSeenAt` (timestamp column, added in Phase 8) is set when a user joins a conversation via `join_conversation` WS event in `server/routes/chat.ts`. This is the correct signal for "when did the user last interact with this project."

The `runAutonomousExecutionCycle` currently reads `lastUserActivityAt` from the most recent message in the project conversation. Using `project.lastSeenAt` directly is more accurate (message may be from an agent, not the user).

**Recommendation:** Use `project.lastSeenAt` directly — fetch via `storage.getProjectTimestamps(project.id)` which is already in IStorage (line 163). This is more accurate than reading the last message.

### Pattern 5: Inactivity Threshold Decision

`resolveAutonomyTrigger` hardcodes `INACTIVITY_THRESHOLD_MS = 2 * 60 * 60 * 1000` (2 hours). The success criteria says "4+ hours." The CONTEXT says "2-4 hours range."

**Recommendation:** Use 2 hours. Rationale: the cron runs every 30 min, so a 2-hour threshold means the trigger fires at earliest 2-2.5 hours after last activity. The "4+ hours" in success criteria language is describing user behavior ("users go idle for a while") not a hard lower bound. 2 hours provides a responsive experience while still being clearly "user is away."

If the threshold should be configurable via env: add `INACTIVITY_THRESHOLD_HOURS=2` to policies.ts BUDGETS pattern.

### Anti-Patterns to Avoid

- **Don't add a new cron job for inactivity when runAutonomousExecutionCycle already has it**: The execution cycle already calls `resolveAutonomyTrigger` which already checks inactivity. Modify that cycle rather than adding a second cron.
- **Don't skip the `inactivityAutonomyEnabled` check at queue time**: If you only check it in `handleTaskJob`, jobs get queued and immediately dropped — wasted DB writes. Better to check before queuing.
- **Don't store trust score in autonomy_events for accumulation**: Trust score lives in `agent.personality.trustMeta` JSONB — not derived from event counts at query time. The `countAutonomyEventsByAgent` storage method exists but is NOT used for trust; trust meta is maintained incrementally.
- **Don't rely on `countAutonomyEventsByAgent` for trust calculation**: Trust is maintained incrementally in `trustMeta` on the agent. The counter method exists for other purposes. The trust score is already being accumulated correctly by `updateTrustMeta` in the pipeline.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Trust score calculation | Custom math | `calculateTrustScore` in trustScorer.ts | Already accounts for maturity factor, bounded 0-1 |
| Trust-adjusted thresholds | Manual threshold tweaking | `getAdjustedThresholds(trustScore)` in trustAdapter.ts | Fully implemented with MAX_PEER_REVIEW_BOOST=0.15 and MAX_CLARIFICATION_BOOST=0.15 |
| Inactivity detection | Date.now() comparison inline | `resolveAutonomyTrigger` in autonomyTriggerResolver.ts | Pure function, tested, handles edge cases (null activity, autonomy disabled) |
| Cron scheduling | setInterval or custom scheduler | node-cron already in backgroundRunner.ts | HMR guard, UTC timezone, clean start/stop already working |
| DB persistence | Raw SQL | `storage.updateAgent(id, { personality: {...} })` | Drizzle ORM, follows IStorage abstraction |

**Key insight:** This phase is almost entirely wiring existing components together. The risk is accidentally duplicating logic that already exists rather than reusing what's there.

---

## Common Pitfalls

### Pitfall 1: Trust Persistence Already Exists — Don't Reimplement
**What goes wrong:** Developer reads the CONTEXT ("trust must be PERSISTED to DB") and writes new code to persist trust, not realizing `updateAgentTrustScore` in `taskExecutionPipeline.ts` already does this via `storage.updateAgent`.
**Why it happens:** The CONTEXT was written before full code audit confirmed the pipeline was already implemented.
**How to avoid:** Read `taskExecutionPipeline.ts` lines 261-278 first. The `updateAgentTrustScore` function is already there and called on both success (line 245, 197) and failure (line 350). Plan 09-01 should be a verification test plus the `inactivityAutonomyEnabled` check, not a reimplementation.
**Warning signs:** If you find yourself writing a new `persistTrustScore` function, stop and check if `updateAgentTrustScore` already does what you need.

### Pitfall 2: schema.ts Type vs DB Column
**What goes wrong:** Adding `inactivityAutonomyEnabled` to the Drizzle schema type without running `db:push` — TypeScript compiles but column doesn't exist in prod.
**Why it happens:** `executionRules` is a JSONB column — no migration needed for new JSONB keys. The Drizzle `$type<>` is TypeScript-only. No db:push needed.
**How to avoid:** Understand that JSONB is schema-less at the DB level. Adding a key to the TypeScript type annotation is sufficient. No migration.

### Pitfall 3: lastSeenAt May Be Null for New Projects
**What goes wrong:** Inactivity cron reads `project.lastSeenAt` which is `null` for projects that have never had a user join a conversation (Phase 8 sets it on `join_conversation`). Null triggers `resolveAutonomyTrigger` to return `shouldExecute: false` since `!input.lastUserActivityAt`. This is safe but means new projects with pending tasks never auto-start.
**Why it happens:** Phase 8 added `lastSeenAt` but it only gets set when a user opens a conversation. A project created via API with tasks but never opened won't have this.
**How to avoid:** This behavior is correct — if the user never joined, there's no "inactivity" to detect. Not a bug.

### Pitfall 4: Cron Fires for All Projects, Not Just Inactivity-Eligible Ones
**What goes wrong:** The existing `runAutonomousExecutionCycle` iterates ALL projects and calls `resolveAutonomyTrigger`. If `inactivityAutonomyEnabled` check is added only in `handleTaskJob` (not in the cycle), jobs get queued for all projects and then silently dropped.
**Why it happens:** Two-layer gate (scheduler vs executor) is easy to miss.
**How to avoid:** Add `inactivityAutonomyEnabled` check in `runAutonomousExecutionCycle` before calling `queueTaskExecution`, so only eligible projects queue work.

### Pitfall 5: trustMeta Not in Schema Type Definition
**What goes wrong:** `agents.personality` Drizzle type does not include `trustMeta` field (see schema.ts lines 82-89). Developer adds type check for `personality.trustMeta` and TypeScript complains.
**Why it happens:** The type was not updated when trust scoring was implemented. The code uses `as any` casts and dynamic property access.
**How to avoid:** Update the schema.ts type annotation for `personality` to include `trustMeta?: TrustMeta` from trustScorer.ts. This makes the type accurate and eliminates the `as any` casts. This is a minor type improvement, not a DB migration.

### Pitfall 6: Inactivity Trigger Running During Active User Session
**What goes wrong:** User is actively chatting, cron fires, queues a task, agent starts working in background while user is in the middle of a conversation.
**Why it happens:** Cron checks `lastSeenAt` but the user could have opened a new tab/session between checks.
**How to avoid:** The 30-minute cron interval + 2-hour threshold creates a natural buffer. Since `lastSeenAt` is set on every `join_conversation`, an active user will always have a recent `lastSeenAt`. The existing logic is sound.

---

## Code Examples

### Reading trustMeta from agent personality (verified pattern)

```typescript
// Source: server/autonomy/execution/taskExecutionPipeline.ts line 251-255
function getAgentTrustScore(personality: unknown): number {
  const p = personality as Record<string, unknown> | null | undefined;
  const trustMeta = p?.trustMeta as { trustScore?: number } | undefined;
  return trustMeta?.trustScore ?? 0.0;
}
```

### Updating trust after task completion (verified pattern)

```typescript
// Source: server/autonomy/execution/taskExecutionPipeline.ts line 261-278
async function updateAgentTrustScore(
  storage: IStorage,
  agentId: string,
  success: boolean,
): Promise<void> {
  try {
    const agent = await storage.getAgent(agentId);
    if (!agent) return;
    const personality = (agent.personality ?? {}) as Record<string, unknown>;
    const currentTrust = personality.trustMeta as any;
    const updatedTrust = updateTrustMeta(currentTrust, success);
    await storage.updateAgent(agentId, {
      personality: { ...personality, trustMeta: updatedTrust } as any,
    });
  } catch {
    // Non-critical — trust update failure should not break task execution
  }
}
```

### Adding inactivityAutonomyEnabled check in execution cycle

```typescript
// Source: pattern from server/autonomy/background/backgroundRunner.ts line 235-240
const trigger = resolveAutonomyTrigger({
  lastUserActivityAt,  // Use project.lastSeenAt instead of last message
  pendingTasks: tasks.map((t: any) => ({ id: t.id, status: t.status })),
  autonomyEnabled: project.executionRules?.autonomyEnabled ?? false,
});
if (!trigger.shouldExecute) continue;

// NEW: gate inactivity triggers on per-project flag
if (
  trigger.reason === 'inactivity' &&
  !(project.executionRules as any)?.inactivityAutonomyEnabled
) continue;
```

### getAdjustedThresholds usage (already wired in pipeline)

```typescript
// Source: server/autonomy/execution/taskExecutionPipeline.ts line 84-85
const agentTrustScore = getAgentTrustScore(input.agent.personality);
const thresholds = getAdjustedThresholds(agentTrustScore);
// thresholds.peerReviewTrigger and thresholds.clarificationRequiredRisk
// are then used in the safety gate comparisons on lines 93-96, 112-113
```

### Schema type update for executionRules

```typescript
// Source: shared/schema.ts line 48-53 — update the $type<> annotation:
executionRules: jsonb("execution_rules").$type<{
  autonomyEnabled?: boolean;
  autonomyPaused?: boolean;
  inactivityAutonomyEnabled?: boolean;  // NEW — no db:push needed (JSONB)
  rules?: string;
  taskGraph?: unknown;
}>().default({}),
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Trust thresholds hard-coded | getAdjustedThresholds(trustScore) scales thresholds by up to +0.15 | Phase 6/7 implementation | Agents with good track records need fewer approvals |
| Inactivity trigger wired to health check cycle | Dedicated execution cycle runs every 15 min via backgroundRunner | Phase 6 | Execution is separated from health checks — different cadence |
| Trust meta was transient (in-memory) | Trust meta persisted to agent.personality JSONB after each execution | Phase 9 (to verify/complete) | Trust survives server restarts |

**Confirmed already done (no work needed):**
- `calculateTrustScore` — fully implemented in trustScorer.ts
- `getAdjustedThresholds` — fully implemented in trustAdapter.ts
- `updateAgentTrustScore` — fully implemented in taskExecutionPipeline.ts, called on success AND failure
- `resolveAutonomyTrigger` inactivity check — fully implemented in autonomyTriggerResolver.ts

**Gaps confirmed by code audit:**
1. `inactivityAutonomyEnabled` flag does not exist in schema.ts type or anywhere in codebase
2. `runAutonomousExecutionCycle` in backgroundRunner.ts does not gate on `inactivityAutonomyEnabled`
3. No test verifies that `agent.personality.trustMeta` is actually read back from storage with correct values after pipeline execution
4. `trustMeta` is not in the Drizzle type annotation for `agents.personality` (uses `as any`)

---

## Open Questions

1. **Inactivity threshold: 2h or 4h?**
   - What we know: resolveAutonomyTrigger hardcodes 2h; success criteria says "4+ hours"
   - What's unclear: Whether "4+ hours" is a functional requirement or descriptive language
   - Recommendation: Use 2h (more responsive), make it env-configurable via `INACTIVITY_THRESHOLD_HOURS` in policies.ts BUDGETS if precision matters

2. **Should triggerSource flow into handleTaskJob for gate enforcement?**
   - What we know: trigger.reason is already returned by resolveAutonomyTrigger as 'inactivity' | 'explicit' | 'none'
   - What's unclear: Whether it's worth threading this through queueTaskExecution job data
   - Recommendation: Keep gate in the cron cycle (before queueing). No need to thread reason through job data.

3. **Does `test-trust-scoring.ts` test 8 (countAutonomyEventsByAgent) actually run?**
   - What we know: The test checks storage.ts for `countAutonomyEventsByAgent` string — passes. But this method is NOT used by the trust pipeline (trust uses personality JSONB, not event counts).
   - What's unclear: Why does this test check for a method that isn't used for trust?
   - Recommendation: The test is a legacy check from an earlier design. It passes but tests the wrong thing. Plan 09-01 should add a test that actually runs the pipeline and reads back trustMeta from the mock storage.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Custom tsx scripts (project convention — no Jest/Vitest) |
| Config file | none — scripts run with `npx tsx scripts/test-*.ts` |
| Quick run command | `npx tsx scripts/test-trust-scoring.ts` |
| Full suite command | `npm run typecheck && npx tsx scripts/test-trust-scoring.ts && npx tsx scripts/test-execution-trigger.ts && npx tsx scripts/test-execution-pipeline.ts` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SAFE-04 | Trust score persisted to agent.personality after task completion | unit | `npx tsx scripts/test-trust-scoring.ts` | Partial (exists, tests module structure but NOT persistence round-trip) |
| SAFE-04 | Trust-adjusted thresholds lower approval frequency for high-trust agents | unit | `npx tsx scripts/test-trust-scoring.ts` (needs new test case) | Partial |
| EXEC-04 | Inactivity cron gates on inactivityAutonomyEnabled flag | unit | `npx tsx scripts/test-execution-trigger.ts` (needs new test case) | Partial |
| EXEC-04 | resolveAutonomyTrigger returns 'inactivity' reason after threshold elapsed | unit | `npx tsx scripts/test-execution-trigger.ts` | Missing (no test for inactivity path) |

### Sampling Rate
- **Per task commit:** `npx tsx scripts/test-trust-scoring.ts`
- **Per wave merge:** `npm run typecheck && npx tsx scripts/test-trust-scoring.ts && npx tsx scripts/test-execution-trigger.ts`
- **Phase gate:** Full suite above green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `scripts/test-trust-scoring.ts` — add test: pipeline mock that reads back `agent.personality.trustMeta` after executeTask completes (confirms round-trip persistence through storage mock)
- [ ] `scripts/test-trust-scoring.ts` — add test: getAdjustedThresholds with trustScore=1.0 produces higher thresholds than trustScore=0.0 (pure math verification)
- [ ] `scripts/test-execution-trigger.ts` — add test: resolveAutonomyTrigger with lastUserActivityAt 3h ago returns reason='inactivity', tasksToExecute=[first task only]
- [ ] `scripts/test-execution-trigger.ts` — add test: inactivity trigger returns shouldExecute=false when autonomyEnabled=false (flag still respected)

*(Framework install not needed — project uses npx tsx pattern throughout)*

---

## Sources

### Primary (HIGH confidence)
- Direct code audit: `server/autonomy/trustScoring/trustScorer.ts` — calculateTrustScore, updateTrustMeta (79 lines, fully verified)
- Direct code audit: `server/autonomy/trustScoring/trustAdapter.ts` — getAdjustedThresholds (39 lines, fully verified)
- Direct code audit: `server/autonomy/execution/taskExecutionPipeline.ts` — updateAgentTrustScore already called at lines 197, 245, 350 (full implementation confirmed)
- Direct code audit: `server/autonomy/triggers/autonomyTriggerResolver.ts` — inactivity check at line 44-64 (fully implemented)
- Direct code audit: `server/autonomy/background/backgroundRunner.ts` — runAutonomousExecutionCycle at line 211-261 (exists, needs inactivityAutonomyEnabled gate)
- Direct code audit: `shared/schema.ts` — executionRules JSONB type at line 48-53 (missing inactivityAutonomyEnabled)
- Direct code audit: `server/storage.ts` IStorage interface — all relevant methods confirmed present (countAutonomyEventsByAgent, getProjectTimestamps, setProjectLastSeenAt)
- Test execution: `npx tsx scripts/test-trust-scoring.ts` — 9/9 passed (confirmed test coverage and gaps)

### Secondary (MEDIUM confidence)
- `.planning/phases/09-progressive-trust-and-inactivity-trigger/09-CONTEXT.md` — user decisions and canonical code references

### Tertiary (LOW confidence)
None — all findings derived from direct code audit.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, all existing modules confirmed by reading source
- Architecture: HIGH — gaps confirmed by code audit, not inferred
- Pitfalls: HIGH — each pitfall traced to specific line numbers in existing code

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (stable codebase; these modules don't change frequently)
