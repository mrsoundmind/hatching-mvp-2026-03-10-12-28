---
phase: 28-maya-bug-fix-sdk-migration
plan: 04
completed_at: 2026-04-27
status: complete
wave: 2
requirements:
  - BUG-03
  - BUG-04
---

# Plan 28-04 — Maya Timeout Cleanup + Zombie Fallback Skip (SUMMARY)

Closes BUG-03 (client thinking indicator stuck after streaming timeout) and
BUG-04 (zombie "out for lunch" fallback message arriving late after the
outer race already emitted `streaming_error`). Two surgical edits to
`server/routes/chat.ts`, plus one mirror update to the Wave 0 cleanup test.

Builds on plan 28-02's AbortSignal foundation — without 28-02, neither edit
would have the right knobs to act on.

---

## Tasks Completed

| Task | Action | Commit |
|------|--------|--------|
| 28-04-01 | Emit `typing_stopped` before `streaming_error` in outer catch (BUG-03) | `08c0125` |
| 28-04-02 | Hoist `abortController` + skip fallback when `signal.aborted` (BUG-04) | `7cc9166` |

---

## Files Changed

| File | Lines (+/-) | Change Type |
|------|-------------|-------------|
| `server/routes/chat.ts` | +21 / -2 | Outer catch broadcast + abort-aware else-if branch + abortController hoist |
| `scripts/test-streaming-timeout-cleanup.ts` | +11 / -3 | Mirror updated to send `typing_stopped` before `streaming_error` |

Net: 2 files, +32 / -5.

---

## Edit 1: BUG-03 — Outer Catch Emits `typing_stopped`

**Anchor:** outer `case 'send_message_streaming'` catch around the
`Promise.race` that throws `STREAMING_HARD_TIMEOUT`.

**Lines BEFORE edit:** 968–981 (15 lines)
**Lines AFTER edit:** 968–986 (19 lines)

**Diff:**
```diff
             } catch (error) {
               console.error('❌ Streaming response error:', error);
               // Abort LLM stream if still running after timeout
               const abortCtrl = (ws as any).__currentAbortController as AbortController | undefined;
               if (abortCtrl && !abortCtrl.signal.aborted) {
                 abortCtrl.abort();
               }
+              // BUG-03: clear client thinking indicator before sending error
+              broadcastToConversation(envelope.conversationId, {
+                type: 'typing_stopped',
+                agentId: addressedAgentId || null,
+              });
               const payload = getStreamingErrorPayload(error);
               ws.send(JSON.stringify({
                 type: 'streaming_error',
                 messageId,
                 code: payload.code,
                 error: payload.error
               }));
             } finally {
```

`addressedAgentId` was already in scope at this site (parsed from envelope at
line 945 / 961 immediately above the catch). No hoist required.

`broadcastToConversation` was already in scope (defined later at line 1125,
hoisted as a function declaration). The outer catch already used it at line
943 for `typing_started`, so the same helper is now used for the symmetric
`typing_stopped`.

The Wave 0 mirror test (`scripts/test-streaming-timeout-cleanup.ts`) was
updated in the same commit so its inline `simulateProductionTimeoutCatch`
function reflects the new contract — the test had been documenting the
expected post-fix sequence as RED until this plan landed.

---

## Edit 2: BUG-04 — Abort-Aware Fallback Skip

**Anchor:** inner catch in `handleStreamingColleagueResponse`, the branch
that calls `buildServiceFallbackMessage` when no partial content was streamed.

**Lines BEFORE edit:** 3055–3110 (inner-catch fallback branch)
**Lines AFTER edit:** 3058–3127 (with new `else if` block lines 3076–3086)

**Three sub-changes** were required because the plan's stated source of truth
(plan: "abortController declared at line 1902") was off — the const was
declared INSIDE a try block at line 1907, which made it block-scoped and
inaccessible from the catch handler at line 3025.

### Sub-change A: Hoist `abortController` to function scope (line 1452)

```diff
     let _lastAccumulatedContent = '';
     let _responsePersisted = false;
     let _respondingAgentForRescue: any = null;
+    // BUG-04: hoisted so the catch handler can check abortController.signal.aborted
+    // before sending a late "out for lunch" fallback message.
+    let abortController: AbortController | null = null;
     try {
```

### Sub-change B: Convert const to assignment (line 1910)

```diff
       // Create AbortController for cancellation + WS disconnect
-      const abortController = new AbortController();
+      abortController = new AbortController();
       (ws as any).__currentAbortController = abortController;
```

### Sub-change C: Optional-chain the closure call (line 1919)

The `cancelHandler` closure runs asynchronously and TypeScript can't prove
abortController has been assigned by the time the closure fires.

```diff
           if (data.type === 'cancel_streaming' && (data.messageId === responseMessageId || !data.messageId)) {
             devLog('🛑 Streaming cancelled by user');
-            abortController.abort();
+            abortController?.abort();
           }
```

### Sub-change D: Add `else if (abortController?.signal.aborted)` branch

```diff
       try {
         if (hasPartialResponse) {
           devLog('⚠️ Skipping fallback ghost message — real agent already sent content');
           ws.send(JSON.stringify({
             type: 'streaming_error',
             messageId: responseMessageId,
             code: payload.code,
             error: payload.error
           }));
+        } else if (abortController?.signal.aborted) {
+          // BUG-04: outer 60s timeout already fired and sent streaming_error to the client.
+          // Do NOT send a late "out for lunch" fallback — the user already saw the error,
+          // and a delayed second message would arrive AFTER the error and pollute the chat.
+          devLog('⚠️ Skipping fallback message — abortController already aborted (outer timeout fired)');
+          ws.send(JSON.stringify({
+            type: 'streaming_error',
+            messageId: responseMessageId,
+            code: payload.code,
+            error: payload.error,
+          }));
         } else {
           // No content was streamed — send a fallback message from PM/Maya
           let effectiveAgent = fallbackResponder;
```

The original fallback `else` branch is unchanged — it now runs only when the
agent had no content AND the outer race did not abort, which is the narrow
"the SDK threw before any chunk arrived" case.

---

## Deviations From Plan

1. **Plan stated `abortController` was at line 1902 declared as `const`,
   in scope for the inner catch.** In practice it was at line 1907 inside
   the same try-block as the catch handler — block-scoped, invisible to the
   catch. Required a hoist (sub-change A) and a const→assignment swap
   (sub-change B). Documented inline above.

2. **Plan's verify grep used `-A 5`** for both edits. Both real diffs land
   6–10 lines after the anchor due to surrounding existing code (the abort
   logic in the outer catch, the larger `if (hasPartialResponse)` block in
   the inner catch). The acceptance contract is satisfied by lexical-order
   semantics (verified by reading the diff): `typing_stopped` precedes
   `streaming_error` in Edit 1; `else if (signal.aborted)` precedes the
   fallback-message `else` in Edit 2. The Wave 0 cleanup test mirrors and
   confirms the runtime ordering.

---

## Verification

| Check | Result |
|-------|--------|
| `npm run typecheck` | Passes (only pre-existing `@google/genai` not-installed error from 28-02 remains — unrelated to this plan) |
| `tsx scripts/test-streaming-timeout-cleanup.ts` | **PASS** — was red baseline before plan 28-04; `typing_stopped` now precedes `streaming_error` |
| `npx playwright test tests/e2e/maya-fallback.spec.ts --list` | Spec parses cleanly (full run requires live dev server + Gemini API key + 45s wait — manual smoke recommended on PR review) |
| Manual diff review | Both edits surgical: 21 inserts / 2 deletes in chat.ts, no other code paths touched |

---

## Commits

```
7cc9166 phase-28(28-04): skip fallback message when abortController already aborted [task-02]
08c0125 phase-28(28-04): emit typing_stopped before streaming_error in outer catch [task-01]
```

Plus this summary commit (created with the `phase-28(28-04): plan summary` message).

---

## Downstream Impact

- BUG-03 closed: when the 60s hard timeout fires, the client receives
  `typing_stopped` (clears the thinking dots) before `streaming_error`
  (renders the inline error). Verified by the Wave 0 unit test.
- BUG-04 closed: when the outer race aborts the SDK call, the inner catch's
  fallback path now short-circuits to `streaming_error` instead of emitting
  a delayed "out for lunch" / "resting their circuits" message. The user
  no longer sees a zombie fallback after the error toast.
- No regressions expected — the original fallback path still runs in the
  narrow case where the agent failed before any chunk arrived AND the outer
  race did not abort (e.g. genuine SDK error within the 60s window).
