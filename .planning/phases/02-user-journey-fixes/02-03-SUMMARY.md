---
phase: 02-user-journey-fixes
plan: 03
subsystem: api
tags: [express, drizzle, postgresql, messages, agents, metadata]

# Dependency graph
requires:
  - phase: 01-hatch-conversation-quality
    provides: agentRole written to message metadata on new messages
provides:
  - Read-time agentRole backfill for old messages lacking metadata.agentRole
  - Batched agent lookup (unique agentIds fetched once per request) in GET messages handler
affects: [frontend-message-rendering, agent-color-display, CenterPanel, MessageBubble]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Batch-enrich read path: collect unique IDs, fetch in parallel, apply to results — never N+1"
    - "Read-time backfill: enrich at read instead of retroactive DB migration"

key-files:
  created: []
  modified:
    - server/routes.ts
    - shared/schema.ts

key-decisions:
  - "Read-time backfill chosen over DB migration — zero data risk, handles deleted agents gracefully (null role)"
  - "agentRole added to messages metadata type in shared/schema.ts to fix TypeScript strict-mode type error"
  - "Promise.all with deduplication ensures O(unique_agents) DB lookups, not O(messages)"

patterns-established:
  - "Enrichment pattern: filter → deduplicate IDs → batch fetch → map back to results"

requirements-completed: [DATA-04]

# Metrics
duration: 10min
completed: 2026-03-17
---

# Phase 2 Plan 03: agentRole Backfill Summary

**Read-time backfill of agentRole into historical message metadata using batched agent lookups — old messages now show correct role-specific colors without any DB migration**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-17T00:00:00Z
- **Completed:** 2026-03-17T00:10:00Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- GET /api/conversations/:conversationId/messages now enriches agent messages missing agentRole in metadata
- Batch lookup: unique agentIds collected and fetched once per request (no N+1 queries)
- Existing agentRole values are never overwritten — only absent ones are backfilled
- agentRole field added to messages metadata TypeScript type in shared/schema.ts

## Task Commits

Each task was committed atomically:

1. **Task 1: Backfill agentRole in the message read route** - `e3af4ce` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `server/routes.ts` - Added batched agentRole backfill block after getMessagesByConversation call
- `shared/schema.ts` - Added `agentRole?: string | null` to messages metadata type definition

## Decisions Made
- Read-time backfill chosen over a retroactive DB migration: zero risk of data corruption, gracefully handles cases where an agent was deleted (returns null role), and requires no migration tooling
- agentRole typed as `string | null` to cover the case where storage.getAgent returns undefined (deleted agent)
- Deduplication via `Set` before `Promise.all` ensures each agentId is fetched at most once regardless of how many messages reference the same agent

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added agentRole to messages metadata TypeScript type**
- **Found during:** Task 1 (backfill implementation)
- **Issue:** TypeScript strict mode rejected `msg.metadata?.agentRole` because the `$type<{...}>` on the messages metadata JSONB column did not include an `agentRole` field
- **Fix:** Added `agentRole?: string | null` to the metadata type object in `shared/schema.ts`
- **Files modified:** shared/schema.ts
- **Verification:** `npm run typecheck` exits 0
- **Committed in:** e3af4ce (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing type field)
**Impact on plan:** Necessary for TypeScript correctness. No scope creep.

## Issues Encountered
- TypeScript error on `msg.metadata?.agentRole` — metadata type in shared/schema.ts was missing the field. Fixed by adding the field to the type definition.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- agentRole backfill complete — old messages will now render with correct agent role colors in the frontend
- MessageBubble and agent color logic can rely on `metadata.agentRole` being present for all agent messages regardless of when they were created

---
*Phase: 02-user-journey-fixes*
*Completed: 2026-03-17*
