---
phase: 02-user-journey-fixes
plan: 05
subsystem: ui
tags: [onboarding, project-creation, agents, drizzle, schema, storage]

# Dependency graph
requires:
  - phase: 02-user-journey-fixes
    provides: "UX fixes foundation — typed WS events, agentRole backfill, LandingPage wiring"
provides:
  - "OnboardingManager idea path prompts user for project name via ProjectNameModal"
  - "DatabaseStorage.initializeIdeaProject creates Maya as project-level agent (no team)"
  - "agents.teamId schema made nullable to match existing DB migration"
affects:
  - 03-hatch-presence
  - any phase that reads agents or onboarding flow

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Project-level agents (no teamId) allowed — teamId nullable in schema and all Agent interfaces"
    - "OnboardingManager uses optional callback prop to delegate control back to parent for name prompt"

key-files:
  created: []
  modified:
    - client/src/components/OnboardingManager.tsx
    - client/src/pages/home.tsx
    - server/storage.ts
    - shared/schema.ts
    - server/ai/expertiseMatching.ts
    - server/orchestration/resolveSpeakingAuthority.ts
    - server/orchestration/resolveTeamLead.ts

key-decisions:
  - "Made agents.teamId nullable in Drizzle schema to align with existing DB migration (team_id already nullable in SQL)"
  - "OnboardingManager delegates idea path to parent via onStartWithIdeaPromptName callback instead of calling onComplete directly"
  - "Maya created with isSpecialAgent=true, color=teal, no team — discoverable by existing isSpecialAgent checks"
  - "Idempotency check in initializeIdeaProject prevents duplicate Maya on retry"

patterns-established:
  - "Agent interface consistency: all Agent interfaces (expertiseMatching, resolveSpeakingAuthority, resolveTeamLead) updated to teamId?: string | null to match schema"

requirements-completed: [UX-01, UX-02]

# Metrics
duration: 15min
completed: 2026-03-18
---

# Phase 02 Plan 05: Project Name Prompt + Maya-Only Creation Summary

**OnboardingManager idea path now opens ProjectNameModal so users name their project; DatabaseStorage creates Maya as a project-level agent with no auto-created team**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-18T00:00:00Z
- **Completed:** 2026-03-18T00:15:00Z
- **Tasks:** 2 of 3 (checkpoint pending human verify)
- **Files modified:** 7

## Accomplishments
- Onboarding "Start with an idea" path now routes through ProjectNameModal before creating a project
- DatabaseStorage.initializeIdeaProject inserts Maya agent with isSpecialAgent=true, teamId=null, role=Product Manager
- Removed hardcoded "My Idea" name from onboarding flow
- No "Strategy" team is auto-created for idea projects via the DB path
- Schema and all Agent interface types updated to allow nullable teamId (consistency fix)

## Task Commits

1. **Task 1: Wire project name prompt into OnboardingManager idea path** - `1caf4ea` (feat)
2. **Task 2: Fix DatabaseStorage.initializeIdeaProject to create Maya agent (no team)** - `4a3a55c` (feat)

## Files Created/Modified
- `client/src/components/OnboardingManager.tsx` - Added `onStartWithIdeaPromptName` optional prop; handleStartWithIdea calls it instead of hardcoded onComplete
- `client/src/pages/home.tsx` - Passes `onStartWithIdeaPromptName` handler to open ProjectNameModal with selectedTemplate=null
- `server/storage.ts` - DatabaseStorage.initializeIdeaProject now creates Maya agent; MemStorage.createAgent coerces teamId undefined to null
- `shared/schema.ts` - agents.teamId changed from `.notNull()` to nullable (matches actual DB migration)
- `server/ai/expertiseMatching.ts` - Agent.teamId: `string | null` (auto-fix)
- `server/orchestration/resolveSpeakingAuthority.ts` - Agent.teamId: `string | null` (auto-fix)
- `server/orchestration/resolveTeamLead.ts` - Agent.teamId: `string | null` (auto-fix)

## Decisions Made
- Made `agents.teamId` nullable in Drizzle schema because the original DB migration (`0000_slim_weapon_omega.sql`) already defines `team_id varchar REFERENCES teams(id)` with no `NOT NULL` — the Drizzle `.notNull()` was incorrect and would have caused a TypeScript error when inserting Maya with null teamId.
- Used the optional `onStartWithIdeaPromptName` callback pattern so OnboardingManager remains decoupled from the specific modal implementation in home.tsx.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Schema/DB type mismatch for agents.teamId**
- **Found during:** Task 2 (DatabaseStorage.initializeIdeaProject implementation)
- **Issue:** Drizzle schema had `teamId: varchar.notNull()` but the actual DB migration has `team_id varchar` (nullable). Plan specified `teamId: null` for Maya but TypeScript rejected it.
- **Fix:** Removed `.notNull()` from `agents.teamId` in `shared/schema.ts`. Updated all three local Agent interface definitions in orchestration/AI files to accept `string | null`.
- **Files modified:** shared/schema.ts, server/ai/expertiseMatching.ts, server/orchestration/resolveSpeakingAuthority.ts, server/orchestration/resolveTeamLead.ts, server/storage.ts
- **Verification:** `npm run typecheck` passes with zero errors; `npm run test:integrity` passes; `npm run test:dto` passes
- **Committed in:** `4a3a55c` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — schema type bug)
**Impact on plan:** Required for correctness — the DB already supported null teamId, just the TypeScript types were wrong. No scope creep.

## Issues Encountered
None beyond the schema type mismatch documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Checkpoint (Task 3) pending human verify — user must run dev server and confirm: (1) ProjectNameModal appears when choosing "Start with an idea", (2) project created with user-typed name, (3) Maya appears in sidebar with no team in between
- After checkpoint passes: plan 02-05 is complete; UX-01 and UX-02 satisfied
- Phase 3 (Hatch Presence) can proceed with Maya now consistently created at project level

## Self-Check

Committed files verified:
- `1caf4ea` exists: feat(02-05): wire project name prompt into onboarding idea path
- `4a3a55c` exists: feat(02-05): implement DatabaseStorage.initializeIdeaProject with Maya agent (no team)

---
*Phase: 02-user-journey-fixes*
*Completed: 2026-03-18 (checkpoint pending)*
