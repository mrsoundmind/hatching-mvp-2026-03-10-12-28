---
phase: 28-maya-bug-fix-sdk-migration
plan: 03
completed_at: 2026-04-27
status: complete
requirements_closed:
  - BUG-06
files_modified:
  - client/src/components/CenterPanel.tsx
commits:
  - 8b5dbf048d5bc0c5a2c8505ea0d21fcebb72a243
---

# 28-03 Plan Summary — BUG-06 Stop Button Stuck Fix

## What was done

Two surgical client-side edits to `client/src/components/CenterPanel.tsx` to close BUG-06: stop button stuck in "Stop" state after a Hatch finishes responding (success path).

### Edit 1: Truth-enforcer debounce reduced 300ms -> 0ms (lines 300-305)

**Before:**
```typescript
if (hasLiveStream) return;
// Give React a tick to settle — streaming_started sets isStreaming(true) and
// adds the placeholder in the same pass; the effect then sees both.
const t = window.setTimeout(() => {
  streaming.setIsStreaming(false);
  streaming.streamingMessageId.current = null;
}, 300);
return () => window.clearTimeout(t);
```

**After:**
```typescript
if (hasLiveStream) return;
// 0ms timeout = microtask tick, lets React commit the messages.allMessages
// update first so we observe the final state, then clear isStreaming.
const t = window.setTimeout(() => {
  streaming.setIsStreaming(false);
  streaming.streamingMessageId.current = null;
}, 0);
return () => window.clearTimeout(t);
```

Rationale: The wrapper `setTimeout` is preserved so React still gets a tick to commit the `messages.allMessages` update before the effect observes the final state. With `0` it becomes a microtask-aligned tick rather than a 300ms human-visible delay.

### Edit 2: Force metadata.isStreaming: false in new_message handler (lines 368-371)

**Before:**
```typescript
threadDepth: message.message.threadDepth || 0,
metadata: message.message.metadata
};
```

**After:**
```typescript
threadDepth: message.message.threadDepth || 0,
metadata: {
  ...((message.message.metadata as any) || {}),
  isStreaming: false,  // BUG-06: force-clear regardless of server payload — this is a delivered message
}
};
```

Rationale: The derived `isStreaming` at line ~1937 ANDs `streaming.isStreaming` with `msgs.some(m => ... m.metadata.isStreaming === true)`. If the server-side broadcast leaks `metadata.isStreaming: true` on a late `chat_message` event, the second condition stays truthy even after the first is cleared, leaving the Stop button live. Force-clearing on the client breaks that loop — the persisted message is by definition delivered.

The spread `...((message.message.metadata as any) || {})` handles `null` / `undefined` server payloads safely.

## Acceptance criteria

| Criterion | Result |
|---|---|
| `sed -n '285,310p' CenterPanel.tsx \| grep -c '300'` returns `0` | PASS (0) |
| `sed -n '285,310p' CenterPanel.tsx \| grep -c '}, 0);'` returns `1` | PASS (1) |
| `sed -n '350,380p' CenterPanel.tsx \| grep -c 'isStreaming: false'` returns `>= 1` | PASS (1) |
| `newMessage.metadata` is now an object literal with spread + override (NOT a passthrough) | PASS |
| `npm run typecheck` exits 0 | PASS |

## Pre-condition / Post-condition (Playwright)

**Pre-condition (red baseline) — NOT verified in worktree environment.**

The plan called for running `npx playwright test tests/e2e/stop-button.spec.ts --reporter=line` before the edits to confirm the spec was RED. The Wave 0 spec authored in plan 28-01 is intentionally red until this plan lands.

**Environment limitation:** This worktree runs in a sandboxed host where `Server.listen({ port: 5001, reusePort: true })` (server/index.ts:301-304) fails with `ENOTSUP: operation not supported`. The failure is reproducible against both `0.0.0.0:5001` and `127.0.0.1:5001` whenever `reusePort: true` is set on port 5001 specifically; binding to other ports or the same port without `reusePort` succeeds. This is a host-level `SO_REUSEPORT` restriction unrelated to the BUG-06 fix and outside the scope of this plan.

Consequence: The Playwright `webServer` step in `playwright.config.ts` (which spawns `npm run dev`) cannot start in this environment, so `npx playwright test tests/e2e/stop-button.spec.ts` exits 1 at the webServer phase before any test code runs — neither the red baseline nor the post-fix green run can be empirically captured here.

The fix should be validated on a host that does not have the `SO_REUSEPORT` restriction (developer laptops, CI). Specifically:
- Run `npx playwright test tests/e2e/stop-button.spec.ts -g "success"` — must pass
- Run `npx playwright test tests/e2e/stop-button.spec.ts -g "cancel"` — must pass
- The error path test is `test.skip(...)` until plan 28-04 lands.

The `npm run typecheck` gate (which does NOT need a live server) passed cleanly post-edit.

## Behavioral notes

- The truth-enforcer's 0ms cleanup is a SAFETY NET, not the primary path. Primary clearing of `isStreaming` happens via the `streaming_completed` handler at line ~618 (which calls `streaming.setIsStreaming(false)` directly). The truth-enforcer only fires when events are lost (mobile flaky WS, server emitting `chat_message` instead of `streaming_completed`) — in that case the 300ms -> 0ms change shaves the visible stuck-button window down to a microtask tick.
- Edit 2 specifically defends against the `chat_message` leak path: server-side `broadcastToConversation(... { exclude: ws })` emits `new_message` to non-originating clients. If a future change ever drops the `exclude: ws` (or the originating client receives both a `streaming_completed` and a late `chat_message` for the same message id), the persisted message still gets `metadata.isStreaming: false` regardless of what the server sent.
- No other code in CenterPanel.tsx was modified. The `streaming_completed` handler was intentionally left alone — the bug was downstream of it (in the truth-enforcer's debounce + the late-arriving `chat_message` path), not in the handler itself.

## Pitfalls / things to watch

- If a future refactor changes the `messages.metadata` field shape, the spread `...((message.message.metadata as any) || {})` may need to be revisited — at the moment it correctly handles `null`, `undefined`, and arbitrary record shapes.
- The 0ms cleanup will fire for every `messages.allMessages` change while `streaming.isStreaming` is true. This is fine (the `if (!streaming.isStreaming) return` guard at the top short-circuits), but if the cleanup ever does anything heavier than two state setters, the cost should be revisited.

## Independence

This plan is INDEPENDENT of plan 28-02 (SDK migration). Only `client/src/components/CenterPanel.tsx` was touched. No server-side, schema, or shared module changes.
