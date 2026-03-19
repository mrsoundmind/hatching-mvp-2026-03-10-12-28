---
phase: 02-user-journey-fixes
plan: 06
subsystem: ui
tags: [react, streaming, websocket, agent-colors, race-condition]

# Dependency graph
requires:
  - phase: 02-user-journey-fixes
    provides: agentRole backfill at API read time (02-03), typing indicator clear on streaming start (02-02)
provides:
  - agentRole injected into streaming placeholder at creation time (no green flash on first chunk)
  - activeProjectAgents guard prevents message transform before agents load (no green flash on page load)
  - typing indicator locations made mutually exclusive (never two indicators simultaneously)
affects: [03-hatch-presence, streaming-ui, agent-identity-display]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Streaming placeholder: inject metadata from activeProjectAgents at message creation time, not post-hoc"
    - "Agent-list guard: defer message transforms that require agent data until activeProjectAgents.length > 0"
    - "Mutual exclusion of UI indicators: guard in-list bubble with typingColleagues.length === 0; clear on send"

key-files:
  created: []
  modified:
    - client/src/components/CenterPanel.tsx

key-decisions:
  - "Guard agentRole backfill useEffect with activeProjectAgents.length === 0 return rather than showing empty messages — loading skeleton handles the gap"
  - "Use IIFE inside metadata object literal to look up agentRole synchronously during streaming placeholder creation"
  - "Clear typingColleagues on setIsThinking(true) in both submit handlers (action click + keyboard enter)"

patterns-established:
  - "Pattern: Always inject role metadata at message creation time in WS handlers — don't rely on post-hoc backfill for real-time messages"
  - "Pattern: Mutual exclusion for visual indicators — each indicator path must check the other's state before rendering"

requirements-completed: [UX-07, UX-08, DATA-04]

# Metrics
duration: 3min
completed: 2026-03-18
---

# Phase 2 Plan 06: CenterPanel Race Condition Fixes Summary

**Three targeted CenterPanel.tsx fixes eliminating agent color green-flash on streaming start, page load, and preventing dual typing indicators during the typing_started to streaming_started window.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-18T03:48:24Z
- **Completed:** 2026-03-18T03:51:53Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Streaming placeholder message now includes `agentRole` in metadata at creation time, so the first streaming chunk renders with the correct agent color immediately (UX-07)
- agentRole backfill `useEffect` now guards against running while `activeProjectAgents` is empty, preventing all messages from rendering with null role on fresh page load (DATA-04)
- In-message-list typing bubble is gated on `typingColleagues.length === 0` and both submit handlers now clear `typingColleagues` on send, ensuring only one indicator is visible at any time (UX-08)

## Task Commits

Both tasks committed atomically:

1. **Task 1: Inject agentRole into streaming placeholder and guard DATA-04 render flash** - `12f305b` (fix)
   - Also includes Task 2 changes (all in single commit as edits were staged together)

**Plan metadata:** (see final docs commit below)

## Files Created/Modified
- `client/src/components/CenterPanel.tsx` - Three targeted fixes: streaming placeholder metadata, useEffect guard, typing indicator mutual exclusion

## Decisions Made
- Used an IIFE inside the `metadata` object literal to look up `agentRole` from `activeProjectAgents` synchronously — avoids introducing a new variable into the already-large streaming_started handler
- Chose to guard with early `return` in the backfill `useEffect` rather than conditionally setting messages — the loading skeleton already handles the empty-messages UI state, so deferring the transform is safe and simple
- Clear `typingColleagues` in both submit handler paths (action click handler at line ~1802 and keyboard enter handler at line ~1900) to cover all entry points

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None — all changes applied cleanly, TypeScript passed with zero errors in client code (pre-existing TS errors in `server/storage.ts` and `server/routes.ts` are out of scope for this plan).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness
- All three gap items (UX-07, UX-08, DATA-04) from Phase 2 gap closure are resolved
- CenterPanel race conditions eliminated; agent color identity is now consistent from first render
- Ready to continue Phase 3 (Hatch Presence and Avatar System)

---
*Phase: 02-user-journey-fixes*
*Completed: 2026-03-18*
