---
phase: 04-data-reliability-and-resilience
plan: 01
subsystem: data-integrity
tags: [production-guard, idempotency, data-reliability, websocket]
dependency_graph:
  requires: []
  provides: [production-storage-guard, client-idempotency-key]
  affects: [server/index.ts, client/src/components/CenterPanel.tsx]
tech_stack:
  added: [server/productionGuard.ts]
  patterns: [pure-exported-guard-function, tdd-red-green-refactor]
key_files:
  created:
    - server/productionGuard.ts
    - scripts/test-production-guard.ts
    - scripts/test-idempotency-e2e.ts
  modified:
    - server/index.ts
    - client/src/components/CenterPanel.tsx
decisions:
  - "Guard function extracted to server/productionGuard.ts (not server/index.ts) for testability — importing index.ts boots the full Express server and DB"
  - "idempotencyKey uses tempMessageId + Date.now() composite — unique even if tempMessageId is reused within the same millisecond"
metrics:
  duration: "~25 minutes"
  completed: "2026-03-18"
  tasks_completed: 1
  files_changed: 5
---

# Phase 04 Plan 01: Production Storage Guard + Message Idempotency Summary

Production startup assertion prevents silent data loss when STORAGE_MODE=memory in production; client-side idempotencyKey on every WS send enables server-side dedup via existing checkIdempotencyKey().

## What Was Built

### DATA-03: Production STORAGE_MODE Guard

A pure, exported function `assertProductionStorageMode(nodeEnv, storageMode)` in `server/productionGuard.ts` throws a clear FATAL error when `NODE_ENV=production` and `STORAGE_MODE` is not `'db'`. The function is wired into `server/index.ts` immediately after the existing SESSION_SECRET / DATABASE_URL guards (line 32).

The guard is extracted into a dedicated module (not inlined in `server/index.ts`) because importing `server/index.ts` triggers full Express + DB startup, making it untestable as a unit.

### DATA-01: Client-Side idempotencyKey

Two WS send locations in `client/src/components/CenterPanel.tsx` now include `idempotencyKey` in the message metadata:

1. **Action-prompt send** (~line 1832): `idempotencyKey: \`${tempMessageId}-${Date.now()}\``
2. **Main chat submit** (~line 1968): same pattern

The server-side `checkIdempotencyKey()` in `server/autonomy/integrity/conversationIntegrity.ts` was already implemented and working — it blocks duplicate keys before `storage.createMessage()` is called. The client was the missing piece.

### Test Coverage

- `scripts/test-production-guard.ts`: 4 assertions covering throw on production+memory, no-throw on production+db, no-throw in development, and source-level wiring check that `server/index.ts` calls the function
- `scripts/test-idempotency-e2e.ts`: 5 assertions covering first-key passes, duplicate-key blocked with correct reason, different-key passes, missing-key passes, empty-key passes

## Decisions Made

1. **Guard in dedicated module**: `server/productionGuard.ts` rather than inline in `server/index.ts` — importing `index.ts` starts the server, making pure unit testing impossible without a running DB.

2. **Composite idempotencyKey format**: `${tempMessageId}-${Date.now()}` — `tempMessageId` is already `temp-${Date.now()}` so the composite is effectively a double-timestamp that survives any edge case where the same `tempMessageId` is reused.

3. **No changes to server-side dedup logic**: `checkIdempotencyKey()` in `conversationIntegrity.ts` already handled all cases correctly. This plan only wired the client to send the key.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test import path changed from server/index.ts to server/productionGuard.ts**
- **Found during:** Task 1 (TDD RED phase)
- **Issue:** The plan's original test imported from `server/index.js` which boots the full Express server and fails with "DATABASE_URL must be set" in test environments
- **Fix:** Extracted guard to `server/productionGuard.ts` (pure module, no side effects), updated test to import from there
- **Files modified:** server/productionGuard.ts (new), scripts/test-production-guard.ts (updated import)
- **Commit:** 5d9b80e

## Self-Check: PASSED

Files exist:
- server/productionGuard.ts: FOUND
- scripts/test-production-guard.ts: FOUND
- scripts/test-idempotency-e2e.ts: FOUND

Commits:
- 5d9b80e: feat(04-01): production storage guard + client idempotencyKey — FOUND

Acceptance criteria:
- assertProductionStorageMode in server/index.ts: 2 lines (import + call) — PASS
- STORAGE_MODE=db in error message: PASS
- idempotencyKey in CenterPanel.tsx: 2 occurrences — PASS
- test-production-guard.ts exits 0: PASS
- test-idempotency-e2e.ts exits 0: PASS
- typecheck exits 0: PASS
