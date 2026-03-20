# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## phase6-regressions — join_conversation FORBIDDEN for projects with no conversation record in DB

- **Date:** 2026-03-20
- **Error patterns:** FORBIDDEN, join_conversation, No agents available, messages don't save, system fallback, conversationOwnedByUser, no conversation record, MemStorage, executionRules, text jsonb mismatch
- **Root cause:** `conversationOwnedByUser` in `server/routes/chat.ts` only checked for existing conversation DB records. Projects created before the auto-conversation bootstrap code (or created while STORAGE_MODE was unset) had zero conversation rows, causing `join_conversation` to always return FORBIDDEN. Sockets were never added to `activeConnections` so broadcast events (user message echo, typing indicator) never reached the client. Secondary: `execution_rules` column was `text` in DB but Drizzle schema declared it `jsonb` — needed `db:push`.
- **Fix:** Extracted `checkConversationAccess()` to `server/utils/conversationAccess.ts` with two-step check: (1) existing conversation record, (2) project ownership via conversationId format parsing fallback. `join_conversation` now calls `ensureConversationExists()` after access check to bootstrap missing conversation rows. Applied `ALTER TABLE projects ALTER COLUMN execution_rules TYPE jsonb` directly.
- **Files changed:** server/utils/conversationAccess.ts, server/routes/chat.ts, scripts/test-join-conversation-access.test.ts

---

