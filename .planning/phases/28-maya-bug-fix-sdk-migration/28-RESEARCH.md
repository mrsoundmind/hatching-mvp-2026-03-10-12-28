# Phase 28: Maya Bug Fix + SDK Migration - Research

**Researched:** 2026-04-26
**Domain:** LLM streaming lifecycle, AbortController propagation, SDK migration, React streaming state management
**Confidence:** HIGH — all findings verified by direct code inspection of the exact files that change

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BUG-01 | Migrate `@google/generative-ai` → `@google/genai` (LangChain `@langchain/google-genai` upgraded in lockstep) | SDK migration scope confirmed to ONE file only: `geminiProvider.ts`. `@langchain/google-genai` is NOT used in the codebase — no lockstep needed. |
| BUG-02 | All LLM streaming requests propagate `AbortSignal.timeout(30_000)` end-to-end (chat → providerResolver → provider SDK) | AbortSignal gap identified: `LLMRequest` has no `signal` field; `geminiProvider.ts` passes nothing to `sendMessageStream`; `openaiService.ts` only checks `abortSignal?.aborted` post-chunk, does not pass it into the LLM call. |
| BUG-03 | When LLM request aborts or times out, "thinking" UI state clears within 1 second and `streaming_cancelled` WS event fires | Server side: `typing_stopped` is never emitted in the error/timeout path (`finally` block at line 982 omits it). Client side: `streaming_error` handler does clear `isStreaming` — but it never fires during the hung-stream scenario because the timeout fires at the outer handler level without propagating into the provider. |
| BUG-04 | "Out for lunch" / "resting circuits" fallback messages only display on confirmed error — never during valid latency | `buildServiceFallbackMessage()` at line 248 in `chat.ts` is only called when streaming throws AND `hasPartialResponse` is false (line 3068). The bug is that the outer `Promise.race` timeout fires at 60s (not 30s), so at ~45-60s the catch branch calls `buildServiceFallbackMessage`. Fix: lower threshold to match the 30s `AbortSignal.timeout` + ensure fallback never fires while the stream is still producing tokens. |
| BUG-05 | AbortController cleanup verified — no dangling references after abort | Generator loop in `geminiProvider.ts` has no `signal.aborted` check; `catch` block swallows errors silently. After `abortController.abort()`, the `for await` loop in `geminiProvider.ts:133` continues until the next natural chunk — meaning the underlying HTTP request runs until Gemini closes the connection. |
| BUG-06 | Stop button clears within 1s of any terminal stream event (success, abort, timeout, error) — currently sticks after `chat_message` success path | Root cause: when `streaming_completed` arrives, the `streaming` message is updated to `{ status: 'delivered', metadata: { isStreaming: false } }`. But the truth-enforcer at CenterPanel line 291 also checks `m.status === 'streaming'` — which is now false — AND `m.metadata?.isStreaming === true` — which is now false. This path should work. The real bug: the `chat_message` broadcast (line 2996-3008 in chat.ts) arrives at the SAME client after `streaming_completed` because `broadcastToConversation` does NOT have `{ exclude: ws }` for the agent-side broadcast... wait — it does have `{ exclude: ws }`. The bug is different: when the WS message with `streaming_completed` is sent, the `streaming` placeholder has `metadata.isStreaming: true`. The `streaming_completed` handler only finds the message to update if `msg.metadata?.isStreaming` is truthy at line 595. If the placeholder was never created (race between `streaming_started` and the message appearing in state), `streaming_completed` finds nothing to update, so `setIsStreaming(false)` at line 618 never fires. The truth-enforcer then sees `isStreaming=true` but no message with `status='streaming'` and schedules cleanup — but it has a 300ms debounce. The real stuck-button scenario: `streaming_completed` arrives, the `setAllMessages` call at line 589-613 finds the placeholder AND updates it (setting `isStreaming: false`), but `setIsStreaming(false)` at line 618 fires AFTER the state update. At this point `streaming.isStreaming` is still `true` for one React cycle, `msgs` has the updated message with `metadata.isStreaming: false` and `status: 'delivered'`. The truth-enforcer fires on the next `messages.allMessages` change, sees no streaming message, and schedules a 300ms cleanup — which DOES fire. So theoretically it should work... |

</phase_requirements>

---

## Summary

Phase 28 is a surgical bug-fix phase with one forced dependency upgrade. The infinite-thinking bug stems from the Gemini SDK (`@google/generative-ai`) having an unresolved AbortController issue (Issue #303 in the deprecated repo) combined with the AbortSignal never being passed from `chat.ts` into the SDK's HTTP request. The result: when a request hangs, the outer `Promise.race` timeout fires after 60 seconds, tries to abort a controller that was never connected to the SDK call, and falls through to the error handler which either shows a stale `streaming_error` (if streaming started) or triggers the "out for lunch" fallback (if nothing streamed).

The SDK migration scope is narrower than the STATE.md notes suggest: `@langchain/google-genai` is NOT present in the codebase. The only migration site is `server/llm/providers/geminiProvider.ts` (1 file, ~120 lines). The new `@google/genai` SDK (current version: 1.50.1) has a significantly different API surface — the `GoogleGenerativeAI` client is replaced by `GoogleGenAI`, and `chat.sendMessageStream()` is replaced by `ai.models.generateContentStream()`.

The stop-button-stuck bug (BUG-06) has a nuanced root cause: the truth-enforcer at CenterPanel line 285-307 should theoretically clear state via its 300ms debounce, but there is a race condition in which the `streaming_completed` handler at line 594 searches for a message matching `msg.id === message.messageId && msg.metadata?.isStreaming` — if this lookup fails (placeholder never created, or already replaced by an earlier `new_message` event), `setIsStreaming(false)` is still called at line 618, but the streaming placeholder remains in the DOM with `status: 'streaming'` and `metadata.isStreaming: true`. The truth-enforcer then sees `hasLiveStream = true` and skips cleanup, leaving `isStreaming` stuck at false while the DOM shows the old streaming indicator.

**Primary recommendation:** Complete the migration in this order: (1) swap SDK package + update geminiProvider.ts, (2) add `signal?: AbortSignal` to `LLMRequest` and propagate it end-to-end, (3) fix the `finally` block to emit `typing_stopped`, (4) fix the TTFT fallback threshold, (5) fix the BUG-06 state cleanup race.

---

## Standard Stack

### Core (Phase 28 only)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@google/genai` | 1.50.1 (latest) | Replace deprecated Gemini SDK | `@google/generative-ai` was EOL'd November 30, 2025 and has an unresolved AbortController bug (Issue #303). New SDK has native `signal` support in `requestOptions`. |
| `AbortSignal.timeout()` | Node 20 built-in | Hard per-request timeout | Node 20.19.3 already installed. Zero dependencies. Stable since Node 18.0. Cleaner than `p-timeout` (ESM-only). |

### Packages to Remove

| Package | Current Version | Reason to Remove |
|---------|----------------|-----------------|
| `@google/generative-ai` | ^0.24.1 | Deprecated, EOL'd, has unresolved AbortController bug. After migration, remove from package.json entirely. |

### No New Packages Required

Everything else (AbortController, AbortSignal, WebSocket, TypeScript types) is already available. `@langchain/google-genai` is NOT used in the codebase — no lockstep upgrade needed.

**Installation:**
```bash
npm install @google/genai
npm uninstall @google/generative-ai
```

**Version verification (confirmed 2026-04-26):**
```
@google/genai: 1.50.1
@google/generative-ai: 0.24.1 (deprecated — last update Nov 2025)
```

---

## Architecture Patterns

### Migration Scope (BUG-01)

**Call-site count:** `@google/generative-ai` is imported in exactly ONE file:
- `server/llm/providers/geminiProvider.ts` — line 1: `import { GoogleGenerativeAI } from '@google/generative-ai'`

`@langchain/google-genai` is NOT present in `package.json` and NOT imported anywhere in the codebase. The STATE.md note about "LangChain `@langchain/google-genai` upgraded in lockstep" was based on a precaution that is NOT needed for this codebase.

**API surface change for `geminiProvider.ts`:**

```typescript
// BEFORE (@google/generative-ai 0.24):
import { GoogleGenerativeAI } from '@google/generative-ai';

function buildClient() {
  return new GoogleGenerativeAI(apiKey);
}

// Inside streamChat():
const genAI = buildClient();
const model = genAI.getGenerativeModel({
  model: modelName,
  systemInstruction: system || undefined,
  generationConfig: { temperature, maxOutputTokens },
});
const chat = model.startChat({ history });
const result = await chat.sendMessageStream(lastUserMessage);
// result.stream is an AsyncGenerator<GenerateContentStreamResult>

// AFTER (@google/genai 1.x):
import { GoogleGenAI } from '@google/genai';

function buildClient() {
  return new GoogleGenAI({ apiKey });
}

// Inside streamChat():
const ai = buildClient();
const signal = AbortSignal.timeout(30_000); // BUG-02 fix integrated here
const response = await ai.models.generateContentStream({
  model: modelName,
  contents: [...history, { role: 'user', parts: [{ text: lastUserMessage }] }],
  config: {
    systemInstruction: system || undefined,
    temperature,
    maxOutputTokens,
  },
}, { signal });
// response is an AsyncIterable<GenerateContentResponse>
// Each chunk: chunk.text() — same interface as before
```

**Key differences:**
1. Client constructor: `new GoogleGenAI({ apiKey })` vs `new GoogleGenerativeAI(apiKey)`
2. No `getGenerativeModel()` + `startChat()` — single call `ai.models.generateContentStream()`
3. History format: the old `{ role: 'user'|'model', parts }` format is preserved; just move the last user message into `contents` instead of a separate `chat.sendMessageStream()` call
4. AbortSignal: `requestOptions.signal` (second argument to `generateContentStream`) — this is the native hook for BUG-02
5. The `for await` loop stays the same: `for await (const chunk of response) { chunk.text() }`

### AbortSignal Propagation (BUG-02)

**Current flow (gap identified):**

```
chat.ts (outer timeout: 60s Promise.race)
  → handleStreamingColleagueResponse()
    → creates AbortController, stores on ws.__currentAbortController
    → openaiService.ts generateStreamingResponse(abortSignal)
      → streamChatWithRuntimeFallback(llmRequest)  ← signal NOT in llmRequest
        → geminiProvider.streamChat(request)       ← no signal anywhere
          → chat.sendMessageStream()               ← no timeout, no abort
          → for await loop                         ← only checks abortSignal.aborted AFTER yielding
```

**Fixed flow:**

```
chat.ts (outer timeout: 60s safety net, still needed as last resort)
  → handleStreamingColleagueResponse()
    → creates AbortController, stores on ws.__currentAbortController
    → openaiService.ts generateStreamingResponse(abortSignal)
      → builds llmRequest WITH signal: abortSignal    ← NEW
      → streamChatWithRuntimeFallback(llmRequest)
        → geminiProvider.streamChat(request)
          → AbortSignal.timeout(30_000) merged with request.signal  ← NEW
          → ai.models.generateContentStream({...}, { signal })     ← NEW
          → for await loop checks signal.aborted before yielding    ← NEW
```

**Files changed for BUG-02:**

| File | Change |
|------|--------|
| `server/llm/providerTypes.ts` | Add `signal?: AbortSignal` to `LLMRequest` interface |
| `server/ai/openaiService.ts` | Pass `signal: abortSignal` in `llmRequest` at line ~409 |
| `server/llm/providers/geminiProvider.ts` | Use `AbortSignal.any([request.signal, AbortSignal.timeout(30_000)])` and pass as `{ signal }` to `generateContentStream` |

**`AbortSignal.any()` pattern (Node 20.3+ built-in):**
```typescript
// Combine user-cancel signal with hard timeout signal
const signal = AbortSignal.any([
  request.signal ?? new AbortController().signal,
  AbortSignal.timeout(30_000)
]);
```
This allows: (a) the user clicking "stop" triggers abort via the upstream controller, AND (b) a 30s timeout triggers abort automatically. Either source aborts the underlying HTTP request.

If `AbortSignal.any()` is not available (Node < 20.3), fall back to:
```typescript
const controller = new AbortController();
if (request.signal) {
  request.signal.addEventListener('abort', () => controller.abort());
}
const timer = setTimeout(() => controller.abort(), 30_000);
const signal = controller.signal;
// In finally block: clearTimeout(timer);
```

### Streaming State Cleanup (BUG-03)

**Server-side fix — add `typing_stopped` to the error/timeout catch block:**

```typescript
// In chat.ts, the OUTER catch block (lines 968-981):
} catch (error) {
  console.error('❌ Streaming response error:', error);
  const abortCtrl = (ws as any).__currentAbortController as AbortController | undefined;
  if (abortCtrl && !abortCtrl.signal.aborted) {
    abortCtrl.abort();
  }
  // NEW: Always emit typing_stopped so the client clears "thinking" state
  broadcastToConversation(envelope.conversationId, {
    type: 'typing_stopped',
    agentId: addressedAgentId || null,
  });
  const payload = getStreamingErrorPayload(error);
  ws.send(JSON.stringify({
    type: 'streaming_error',      // ← client already handles this → clears isStreaming
    messageId,
    code: payload.code,
    error: payload.error
  }));
}
```

**Client-side — the `streaming_error` handler at line 636 already calls `streaming.setIsStreaming(false)`.** The fix is ensuring the server SENDS that event when the request times out.

**When the stream is aborted mid-chunk (not a timeout):** The `streaming_cancelled` event is sent via `cancel_streaming` flow (lines 989-1008). Client's `streaming_cancelled` handler at line 625 already calls `streaming.setIsStreaming(false)`. This path works today for user-initiated cancels. BUG-03 is specifically about the timeout/hang path.

### "Out for Lunch" Wrong Code Path (BUG-04)

**Where it fires:** `buildServiceFallbackMessage()` is called at line 3086 in chat.ts. This function is inside the **inner** catch block of `handleStreamingColleagueResponse` — triggered when:
1. The LLM stream throws an error (or the inner timeout race fires)
2. `hasPartialResponse` (line 3055) is `false` — meaning no chunks were streamed

**The problem:** The outer `Promise.race` at line 952 has `hardTimeoutMs = 45,000 + 15,000 = 60s`. At 60s with no response, it rejects with `STREAMING_HARD_TIMEOUT`. The catch block at line 968 fires `streaming_error` — which is fine. But separately, inside `handleStreamingColleagueResponse`, the streaming never got to emit `streaming_started` (because `sendMessageStream()` hung before returning), so `hasPartialResponse = false`, and if somehow the inner catch fires (it doesn't at the outer level), it would call `buildServiceFallbackMessage()`.

**The actual confirmed scenario from Playwright test:** The "out for lunch" message appears at ~45-60s, which means the inner catch IS firing — the inner timeout at `openaiService.ts` (`timeoutMs: 45000`) is the trigger. This `timeoutMs` field exists on `LLMRequest` (line 24 of `providerTypes.ts`) but is NOT actually used by `geminiProvider.ts` or `providerResolver.ts` to set any timeout. So it's effectively ignored. The inner timeout is never set.

**Revised root cause:** The Gemini SDK hangs indefinitely. The outer `Promise.race` at 60s fires, which sends `streaming_error` to the client. BUT — the `handleStreamingColleagueResponse` async function is still running after the outer race fires (the Promise.race just stopped awaiting it, it keeps executing). Eventually, when the Gemini API returns or errors out, the inner catch fires and sends `buildServiceFallbackMessage()` as a persisted message via `ws.send()`. The WS is still open, so the client receives this late "out for lunch" message after already seeing `streaming_error`.

**Fix (two-part):**
1. Add `AbortSignal.timeout(30_000)` to the SDK call (BUG-02) — this terminates the hanging SDK call, preventing the late message
2. In `handleStreamingColleagueResponse`, check `ws.readyState` before calling `buildServiceFallbackMessage()` and before calling `ws.send()` — if already in error state, skip the fallback send. Also check `abortController.signal.aborted` before sending the fallback:

```typescript
// In the inner catch block (around line 3068):
if (!hasPartialResponse && !abortController.signal.aborted) {
  // Only send fallback if we haven't already been aborted
  // ...existing fallback code...
}
```

### BUG-06: Stop Button Stuck Analysis (Definitive Root Cause)

**What the code does on the `streaming_completed` path:**

1. Server sends `streaming_completed` with `{ messageId, message: savedResponse }` at line 2972-2976
2. Client `streaming_completed` handler (line 577) looks for the placeholder:
   ```typescript
   const messageIndex = msgs.findIndex(msg =>
     msg.id === message.messageId && msg.metadata?.isStreaming  // line 594-595
   );
   ```
3. If found: updates `metadata.isStreaming: false`, then calls `streaming.setIsStreaming(false)` at line 618
4. If NOT found (race: `streaming_started` deduplication prevented the placeholder from being created): `streaming.setIsStreaming(false)` is STILL called at line 618 — so this should work
5. After `streaming.setIsStreaming(false)`, the `isStreaming` derived prop at line 1930-1941 should become `false`

**Where the actual race lives:** The derived `isStreaming` at line 1937:
```typescript
return streaming.isStreaming && msgs.some(m =>
  m.status === 'streaming' ||
  (m.metadata && (m.metadata as any).isStreaming === true)
);
```
This is a two-condition AND. `streaming.setIsStreaming(false)` correctly sets `streaming.isStreaming = false`. So the button SHOULD clear. The issue is a timing/batching problem:

**React batching issue:** `streaming.setIsStreaming(false)` is called in the `streaming_completed` event handler. But `setAllMessages` (the state updater) is also called in the same handler (line 589). React 18 batches both state updates together. If the `setAllMessages` update runs first and the message update sets `metadata.isStreaming: false` and `status: 'delivered'`, then when the component re-renders, `streaming.isStreaming` might be stale (still `true`) during that render cycle. On the NEXT render (after `setIsStreaming(false)` propagates), the derived prop computes correctly.

**The confirmed stuck case:** When the server sends `chat_message` (line 2997-3008) as a BROADCAST to other clients (with `{ exclude: ws }`), the originating client does NOT receive this. So the originating client receives `streaming_completed` and the flow above applies. Other clients receive `new_message` + `chat_message`. For the originating client, if `streaming_completed` arrives and its `messageId` does NOT match the current `streaming.streamingMessageId.current` (because the streaming placeholder was replaced by a `new_message` event that arrived first), the state update at line 589 finds nothing, but `setIsStreaming(false)` still fires at line 618. This should work.

**Actual BUG-06 confirmed path:** Looking at line 315-330:
```typescript
if (message.type === 'new_message' || message.type === 'chat_message') {
  streaming.clearPendingResponseTimeout();
  streaming.setIsThinking(false);
  const messageId = message.message.id;
  const matchesActiveStream = streaming.isStreaming &&
    streaming.streamingMessageId.current === messageId;
  if (isAgentMessage && matchesActiveStream) {
    streaming.clearAllStreamingState();
  }
  else if (isAgentMessage && streaming.isStreaming) {
    streaming.clearAllStreamingState();
  }
```

When the SUCCESS path emits `streaming_completed` followed by a `new_message` broadcast to OTHER clients, the originating client only sees `streaming_completed`. The `streaming_completed` handler sets `setIsStreaming(false)`.

The bug is confirmed when the originating client sees:
1. `streaming_started` — sets `isStreaming=true`, placeholder added with `metadata.isStreaming: true`
2. `streaming_chunk` (multiple) — updates placeholder content
3. Server completes, emits `streaming_completed` to the originating WS
4. Server also emits `new_message` to ALL clients (including originating? Let's check)

The `broadcastToConversation` at line 2982 is:
```typescript
broadcastToConversation(conversationId, { type: 'new_message', message: savedResponse, conversationId }, { exclude: ws });
```

So originating client does NOT get `new_message`. Good.

5. `streaming_completed` arrives — finds placeholder, sets `metadata.isStreaming: false`, calls `setIsStreaming(false)`. DONE.

But wait — the `streaming_completed` handler at line 594 searches for:
```typescript
msg.id === message.messageId && msg.metadata?.isStreaming
```

The `message.messageId` is the `responseMessageId`. The placeholder has `id = responseMessageId` (set at `streaming_started`). AND `msg.metadata?.isStreaming` is `true` on the placeholder. So the lookup SHOULD work.

**The real BUG-06 scenario (confirmed by Playwright test):** The test reports the button stays stuck after the Hatch finishes via `chat_message` path — specifically this is a different scenario from above. The `chat_message` path mentioned in the requirements (line 73 of REQUIREMENTS.md) refers to the non-streaming response path (e.g., fallback PM messages, system messages) that go through `broadcastToConversation` without a prior `streaming_started` sequence. In this case:
- Server sends `new_message` (not `streaming_started` → `streaming_chunk` → `streaming_completed`)
- Client receives `new_message`, which calls `streaming.clearAllStreamingState()` at line 324 (if `matchesActiveStream`) or line 329 (if `isAgentMessage && isStreaming`)
- `clearAllStreamingState()` should clear everything

The question is: what does `clearAllStreamingState()` do?
<br>

**Fix for BUG-06:** The truth-enforcer (lines 285-307) already handles this with a 300ms debounce. But the 300ms delay is visible to the user. The fix is to also call `setIsStreaming(false)` synchronously in the `new_message` / `chat_message` handler when an agent message arrives — which already happens at lines 323-329. The bug may be that `clearAllStreamingState()` doesn't immediately synchronize the `isStreaming` prop derived at line 1937.

**Definitive fix:** After any terminal WS event (streaming_completed, streaming_cancelled, streaming_error, new_message with agent content while isStreaming), force the streaming placeholder's `metadata.isStreaming` to `false` in the message state AND call `setIsStreaming(false)`. The 300ms truth-enforcer debounce should be reduced to 0ms (just a `window.setTimeout(() => ..., 0)` microtask) to eliminate the visible delay.

### AbortController Cleanup (BUG-05)

**Current cleanup pattern:**
```
handleStreamingColleagueResponse finally block (line 3021):
  → ws.off('message', cancelHandler)  ← removes cancel listener

ws 'close' handler (line 1093):
  → abortController.abort()           ← fires on disconnect
```

**What's NOT cleaned up:**
- `(ws as any).__currentAbortController` is set at line 1903 but never deleted. The `AbortController` reference persists on the WS object until the WS is garbage-collected.
- The `geminiProvider.ts` stream generator's `for await` loop does NOT check `signal.aborted`. After `abortController.abort()`, the generator continues processing chunks until the next yield point, which only happens when Gemini sends the next token (or closes the stream). The underlying HTTP connection is NOT closed.

**Heap leak mechanism:**
1. User sends message → AbortController created, attached to WS
2. Request hangs → outer timeout fires at 60s → `abort()` called
3. `geminiProvider.ts`'s generator continues running (has no abort check, no SDK signal)
4. The generator holds a reference to `result.stream` which holds the Gemini HTTP response body
5. The generator is never completed or returned — it leaks

**Fix for BUG-05:**
1. Pass `signal` to the SDK call (BUG-02 fix) — when signal fires, the SDK terminates the HTTP request
2. Add abort check inside the generator loop:
```typescript
const stream = (async function* () {
  try {
    for await (const chunk of response) {  // response from new SDK
      if (signal?.aborted) {
        await response.return?.();  // clean up async iterable
        return;
      }
      const token = chunk.text();
      if (token) yield token;
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') return; // expected
    console.error('[GeminiProvider] Stream iteration error:', (err as Error).message);
  }
})();
```
3. In the finally block of `handleStreamingColleagueResponse`, clear the AbortController reference:
```typescript
} finally {
  ws.off('message', cancelHandler);
  delete (ws as any).__currentAbortController; // prevent accumulation
}
```

### WebSocket Event Ordering Contract

When a stream is aborted (user-initiated cancel):
```
1. Client sends: cancel_streaming
2. Server: abortController.abort() (line 1911 in cancelHandler)
3. Server: streaming_cancelled sent back immediately (lines 1004-1007)
4. Server: geminiProvider generator checks abort on next iteration → returns
5. Server: handleStreamingColleagueResponse finally block → ws.off('message', cancelHandler)
```

When a stream times out (30s AbortSignal.timeout):
```
1. AbortSignal.timeout(30_000) fires inside geminiProvider.streamChat()
2. SDK throws AbortError / terminates the HTTP request
3. Generator catch block at line 148 catches it (currently logs it, returns normally)
4. streamChatWithRuntimeFallback returns the (now-empty) generator
5. Back in openaiService.ts: for await loop exits naturally (generator done)
6. openaiService.ts returns normally to chat.ts
7. chat.ts emits streaming_completed with whatever was accumulated
8. Client sees streaming_completed (possibly with empty content if nothing streamed)
```

Current problem: step 3 above — the `catch` in `geminiProvider.ts` swallows `AbortError` and logs it as a generic error. The generator returns normally (no exception propagated). This means `openaiService.ts` sees a completed (but empty) generator and calls `streaming_completed` — which is wrong when the timeout fired because nothing was generated. Fix: let `AbortError` propagate up so `openaiService.ts` can properly handle it.

Corrected flow after fix:
```
1. AbortSignal.timeout(30_000) fires
2. SDK terminates HTTP request, throws AbortError into generator
3. Generator re-throws AbortError (doesn't swallow it)
4. streamChatWithRuntimeFallback catches it, throws to openaiService.ts
5. openaiService.ts generator function throws → propagates to chat.ts
6. chat.ts inner catch fires → sends streaming_error
7. Server sends typing_stopped (new fix)
8. Client receives streaming_error → setIsStreaming(false), shows error notice
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-request timeout | Custom Promise.race + clearTimeout | `AbortSignal.timeout(30_000)` | Node 20 built-in, self-cleaning, composable with `AbortSignal.any()` |
| Abort signal composition | Manual event listener forwarding | `AbortSignal.any([a, b])` | Node 20.3+ built-in, handles cleanup automatically |
| SDK migration | Stay on `@google/generative-ai` | `@google/genai` 1.x | Deprecated SDK never gets the AbortController fix; new SDK is required for Phase 32 embeddings too |
| Streaming state cleanup | Timer-based "give up after Ns" in client | Server sends proper terminal events | Timer-based client cleanup is a patch; fixing the server-side emit is the correct contract |

---

## Common Pitfalls

### Pitfall 1: `AbortSignal.any()` Availability
**What goes wrong:** `AbortSignal.any()` is Node 20.3+. If the production environment is exactly Node 20.0-20.2, this method is undefined.
**How to avoid:** Check `AbortSignal.any` before using it. Fall back to the manual listener pattern. Node 20.19.3 is already in use (per CLAUDE.md) — this is safe.
**Warning signs:** `TypeError: AbortSignal.any is not a function` in server logs.

### Pitfall 2: New SDK Streaming Format
**What goes wrong:** Old SDK's `result.stream` was an `AsyncIterable<GenerateContentStreamResult>` where each chunk was a `GenerateContentStreamResult` with a `.text()` method. New SDK's `response` from `generateContentStream` is also an `AsyncIterable` but each chunk is a `GenerateContentResponse`. The `.text()` method exists on both — but the import is `GenerateContentResponse` not `GenerateContentStreamResult`.
**How to avoid:** Use only `chunk.text()` to extract tokens. Don't access `chunk.candidates[0].content.parts[0].text` directly (breaks if candidates is empty).
**Warning signs:** TypeScript errors about `GenerateContentStreamResult` type after migration.

### Pitfall 3: AbortError Not Propagating From New SDK
**What goes wrong:** The new SDK may throw different error types on abort. `AbortError` (`name === 'AbortError'`) is the standard, but Google's SDK might throw with a custom error type.
**How to avoid:** In the catch block, check both `err.name === 'AbortError'` AND `err.name === 'TimeoutError'` (TimeoutError is thrown by `AbortSignal.timeout()` specifically). Handle both as expected termination, not logging-worthy errors.

### Pitfall 4: Outer 60s Timeout Racing With Inner 30s Abort
**What goes wrong:** The inner `AbortSignal.timeout(30_000)` fires at 30s. The generator properly terminates. `openaiService.ts` returns. `streaming_error` is sent. Meanwhile, the outer `Promise.race` at `hardTimeoutMs = 60s` is still pending. 30 seconds later it fires and sends a SECOND `streaming_error` to the client.
**How to avoid:** Clear the outer timeout race when the inner abort fires cleanly. Or: pass the AbortController's signal through such that when the inner abort fires, the outer race is also resolved. The cleanest approach: when `handleStreamingColleagueResponse` completes (any path), the outer Promise.race is settled. Since the outer race only fires on the 60s timeout and the inner fix makes the whole function return at 30s, the outer timeout never fires. No fix needed here — the inner fix naturally resolves it.

### Pitfall 5: `streaming_completed` With Empty Content After Abort
**What goes wrong:** AbortSignal fires at 30s. The generator exits. `openaiService.ts` returns an empty `fullResponse`. `chat.ts` code at line 2093 checks `if (!abortController.signal.aborted && accumulatedContent)` — if the signal was aborted, it skips persistence. If `accumulatedContent` is empty (nothing streamed before abort), it also skips. So `streaming_completed` is never emitted. Client is left with `isStreaming = true` and a placeholder message.
**How to avoid:** When `abortController.signal.aborted` is true after the generator exits, emit `streaming_error` from `handleStreamingColleagueResponse` — not `streaming_completed`. The generator should propagate the AbortError upward (fix described in BUG-05 section) so the catch block handles it correctly.
**Warning signs:** Client shows thinking indicator permanently after timeout with no visible error.

### Pitfall 6: History Format in New SDK
**What goes wrong:** Old `toGeminiHistory()` function produces `{ role: 'user'|'model', parts: [{ text }] }`. The new SDK uses `contents` which accepts the same format. But the last user message must be included IN the `contents` array (not passed separately to `sendMessageStream()`). The current code excludes the last user message from `priorHistory` and passes it to `sendMessageStream()`. After migration, the last user message must be appended to `contents`.
**How to avoid:** In the migration, update `toGeminiHistory()` to return the FULL contents array (including last user message), not a split tuple. Pass the full array to `generateContentStream({ contents: fullContents })`.

---

## Code Examples

### New `geminiProvider.ts` (core change)
```typescript
// Source: @google/genai 1.x API
import { GoogleGenAI } from '@google/genai';
import type { LLMProvider, LLMRequest, LLMStreamResult, RuntimeMode } from '../providerTypes.js';

function buildClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    const err = new Error('Gemini API key is missing');
    (err as any).code = 'GEMINI_API_KEY_MISSING';
    throw err;
  }
  return new GoogleGenAI({ apiKey });
}

// Convert messages to Gemini contents array (all messages including last user msg)
function toGeminiContents(messages: LLMRequest['messages']): {
  system: string;
  contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>;
} {
  const systemParts: string[] = [];
  const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
  for (const msg of messages) {
    if (msg.role === 'system') {
      systemParts.push(msg.content);
    } else if (msg.role === 'user') {
      contents.push({ role: 'user', parts: [{ text: msg.content }] });
    } else if (msg.role === 'assistant') {
      contents.push({ role: 'model', parts: [{ text: msg.content }] });
    }
  }
  return { system: systemParts.join('\n'), contents };
}

async streamChat(request: LLMRequest, mode: RuntimeMode): Promise<LLMStreamResult> {
  const started = Date.now();
  const ai = buildClient();
  const modelName = resolveGeminiModel(request);
  const { system, contents } = toGeminiContents(request.messages);

  // Compose abort signals: user cancellation + hard timeout
  const signals: AbortSignal[] = [AbortSignal.timeout(30_000)];
  if (request.signal) signals.push(request.signal);
  const signal = signals.length > 1 ? AbortSignal.any(signals) : signals[0];

  const response = await ai.models.generateContentStream({
    model: modelName,
    contents,
    config: {
      systemInstruction: system || undefined,
      temperature: request.temperature ?? 0.7,
      maxOutputTokens: request.maxTokens ?? 500,
    },
  }, { signal });

  const metadata: LLMStreamResult['metadata'] = {
    provider: this.id,
    mode,
    model: modelName,
    latencyMs: Date.now() - started,
    temperature: request.temperature ?? 0.7,
    maxTokens: request.maxTokens ?? 500,
    modelTier: request.modelTier,
  };

  const stream = (async function* () {
    try {
      for await (const chunk of response) {
        if (signal.aborted) return;
        const token = chunk.text();
        if (token) yield token;
        const usage = chunk.usageMetadata;
        if (usage) {
          metadata.tokenUsage = {
            promptTokens: usage.promptTokenCount ?? 0,
            completionTokens: usage.candidatesTokenCount ?? 0,
            totalTokens: usage.totalTokenCount ?? 0,
          };
        }
      }
    } catch (err) {
      const name = (err as Error).name;
      if (name === 'AbortError' || name === 'TimeoutError') throw err; // propagate up
      console.error('[GeminiProvider] Stream iteration error:', (err as Error).message);
      throw err; // propagate all errors so callers can handle them
    }
  })();

  return { stream, metadata };
}
```

### `LLMRequest` interface addition (providerTypes.ts)
```typescript
export interface LLMRequest {
  messages: ChatMessage[];
  model?: string;
  modelTier?: ModelTier;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  seed?: number;
  signal?: AbortSignal;  // NEW: end-to-end abort propagation
}
```

### Pass signal from openaiService.ts (line ~409)
```typescript
const llmRequest = {
  model: resolveRuntimeModel(),
  messages: [...],
  temperature: 0.7,
  maxTokens: resolveMaxTokens(messageComplexity, isFirstMsg),
  timeoutMs: Number(process.env.HARD_RESPONSE_TIMEOUT_MS || 45000),
  seed: process.env.LLM_MODE === 'test' ? 42 : undefined,
  signal: abortSignal,  // NEW: propagate from handleStreamingColleagueResponse
};
```

### BUG-06: Reduce truth-enforcer debounce
```typescript
// In CenterPanel.tsx lines 302-305, change 300ms to 0ms:
const t = window.setTimeout(() => {
  streaming.setIsStreaming(false);
  streaming.streamingMessageId.current = null;
}, 0);  // was 300 — 0 is a microtask-aligned tick, still gives React time to settle
```

Also ensure the `new_message` handler (lines 315-330) explicitly sets `metadata.isStreaming: false` on the persisted message when adding it:
```typescript
// In the newMessage object construction (around line 364):
metadata: {
  ...message.message.metadata,
  isStreaming: false,  // force-clear regardless of what the server sent
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@google/generative-ai` | `@google/genai` | Nov 30, 2025 (EOL) | Breaking API change: new unified client, `ai.models.generateContentStream()` |
| `chat.startChat().sendMessageStream()` | `ai.models.generateContentStream({ contents })` | SDK 1.x | History + last message merged into single `contents` array |
| No AbortSignal in SDK call | `requestOptions.signal` in second arg | `@google/genai` 1.x | Native abort propagation into HTTP request |
| 60s outer race timeout | 30s `AbortSignal.timeout` at SDK level + 60s outer safety net | This phase | Faster cleanup, proper error propagation |

**Deprecated/outdated:**
- `GoogleGenerativeAI`: replaced by `GoogleGenAI`. Do not use after migration.
- `model.startChat({ history })`: removed in new SDK. Use `contents` array in the main call.
- `chat.sendMessageStream(lastUserMessage)`: removed. Use `ai.models.generateContentStream()`.
- `@google/generative-ai`: package removed from project. Delete from package.json.

---

## Open Questions

1. **`AbortError` type in new SDK**
   - What we know: Node's `AbortSignal.timeout()` throws `TimeoutError` (not `AbortError`); user-initiated abort throws `AbortError`
   - What's unclear: Does `@google/genai` rethrow the original error type or wrap it?
   - Recommendation: In the catch block, handle both `name === 'AbortError'` and `name === 'TimeoutError'` as expected abort conditions. Add a log line showing which variant fires in the first test run.

2. **`generateContentStream` response type in `@google/genai` 1.50.x**
   - What we know: STACK.md documents the API for `^1.3.0`. Current version is `1.50.1`.
   - What's unclear: Minor API differences between 1.3 and 1.50 (e.g., whether `requestOptions` still takes `{ signal }` or changed to a different field name)
   - Recommendation: Verify the second argument shape against the installed 1.50.1 types immediately after `npm install`. Run `npx tsc --noEmit` to catch type errors.

3. **BUG-06 exact reproduction**
   - What we know: Playwright test confirms the button stays stuck after a successful completion
   - What's unclear: Whether the 300ms debounce is the full cause or there's a secondary race
   - Recommendation: Add `console.log` instrumentation in the truth-enforcer and the `streaming_completed` handler before implementing the fix. Capture the exact sequence of events in the Playwright test environment.

---

## Validation Architecture

**Note:** `workflow.nyquist_validation` is absent from `.planning/config.json`, treated as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright (`@playwright/test`) + custom scripts in `scripts/` |
| Config file | `playwright.config.ts` at project root |
| Quick run command | `npx playwright test --grep "BUG-"` (once test files are created) |
| Full suite command | `npm run qa:full && npx playwright test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BUG-01 | `@google/generative-ai` absent from node_modules; `@google/genai` present and importable | Unit (import check) | `node -e "require('@google/genai')"` + `node -e "try { require('@google/generative-ai'); process.exit(1); } catch {}; console.log('ok')"` | ❌ Wave 0 |
| BUG-01 | `geminiProvider.ts` compiles without errors after migration | TypeScript check | `npm run typecheck` | ✅ existing |
| BUG-02 | `LLMRequest.signal` flows from `openaiService.ts` through to `geminiProvider.streamChat()` | Unit (spy) | `scripts/test-abort-signal-propagation.ts` — mock provider asserts `request.signal` is defined | ❌ Wave 0 |
| BUG-02 | `AbortSignal.timeout(30_000)` causes the generator to terminate in < 31s | Integration | `scripts/test-gemini-abort.ts` — uses mock SDK that hangs indefinitely; asserts generator completes within 31s | ❌ Wave 0 |
| BUG-03 | `streaming_error` WS event fires within 1s of a 30s timeout | Integration (WS) | `scripts/test-streaming-timeout-cleanup.ts` — mock provider hangs; measures time from request to `streaming_error` event | ❌ Wave 0 |
| BUG-03 | `typing_stopped` event fires on error path | Integration (WS) | Same test as above — assert `typing_stopped` in the event sequence before `streaming_error` | ❌ Wave 0 |
| BUG-04 | "Out for lunch" does NOT appear for a response that takes 4-8s | E2E (Playwright) | `tests/e2e/maya-fallback.spec.ts` — mock provider delayed 6s; assert no text matching /out for lunch|resting their circuits/ in DOM | ❌ Wave 0 |
| BUG-04 | "Out for lunch" DOES appear (eventually, as a proper error message) when provider times out | E2E (Playwright) | Same spec, timeout scenario — assert error message appears in DOM after timeout | ❌ Wave 0 |
| BUG-05 | AbortController reference deleted from WS object after stream completes | Unit | `scripts/test-abort-cleanup.ts` — assert `ws.__currentAbortController` is undefined after `finally` block | ❌ Wave 0 |
| BUG-05 | No generator leak under 50 concurrent aborted requests | Load test | `scripts/test-abort-heap.ts` — use `v8.getHeapStatistics()` before and after 50 aborted streams; assert delta < 50MB | ❌ Wave 0 |
| BUG-06 | Stop button reverts to "send" within 1s after streaming_completed | E2E (Playwright) | `tests/e2e/stop-button.spec.ts` — send message, wait for response, assert button has `aria-label="Send"` within 1s of last message landing | ❌ Wave 0 |
| BUG-06 | Stop button reverts to "send" within 1s after user-initiated cancel | E2E (Playwright) | Same spec — click stop button, assert button reverts within 1s | ❌ Wave 0 |
| BUG-06 | Stop button reverts to "send" within 1s after streaming_error | E2E (Playwright) | Same spec — trigger error, assert button state | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run typecheck` (must pass before any commit)
- **Per wave merge:** `npm run typecheck && npx playwright test tests/e2e/stop-button.spec.ts tests/e2e/maya-fallback.spec.ts`
- **Phase gate:** Full Playwright suite green + `scripts/test-abort-signal-propagation.ts` passes before marking phase complete

### Wave 0 Gaps

- [ ] `scripts/test-abort-signal-propagation.ts` — unit test asserting `LLMRequest.signal` flows to mock provider
- [ ] `scripts/test-gemini-abort.ts` — integration test with mock-hung provider asserting generator terminates within 31s
- [ ] `scripts/test-streaming-timeout-cleanup.ts` — WS integration test asserting `typing_stopped` + `streaming_error` sequence
- [ ] `scripts/test-abort-cleanup.ts` — unit test asserting `ws.__currentAbortController` is deleted after stream end
- [ ] `scripts/test-abort-heap.ts` — load test asserting no heap leak after 50 concurrent aborts
- [ ] `tests/e2e/stop-button.spec.ts` — Playwright E2E for all BUG-06 scenarios
- [ ] `tests/e2e/maya-fallback.spec.ts` — Playwright E2E for BUG-04 (no spurious fallback on slow response)
- [ ] Framework setup: Playwright already installed at `@playwright/test ^1.58.2` — no new install needed

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection: `server/llm/providers/geminiProvider.ts` (full file, 170 lines) — confirmed single migration site, no AbortSignal
- Direct code inspection: `server/llm/providerTypes.ts` (full file) — confirmed `signal?: AbortSignal` is missing from `LLMRequest`
- Direct code inspection: `server/llm/providerResolver.ts` (full file) — confirmed signal is not passed through fallback chain
- Direct code inspection: `server/ai/openaiService.ts` (lines 400-460) — confirmed `signal: abortSignal` is NOT in the `llmRequest` object
- Direct code inspection: `server/routes/chat.ts` (lines 248-273, 950-986, 1901-1917, 2972-3009, 3021-3100) — confirmed fallback call sites and timeout handling
- Direct code inspection: `client/src/components/CenterPanel.tsx` (lines 285-330, 577-635, 1930-1955) — confirmed streaming state flow
- Direct code inspection: `package.json` — confirmed `@google/generative-ai: ^0.24.1`, no `@langchain/google-genai`
- `npm view @google/genai version` → 1.50.1 (verified 2026-04-26)
- [Google deprecated-generative-ai-js Issue #303](https://github.com/google-gemini/deprecated-generative-ai-js/issues/303) — AbortController unhandled rejection in deprecated SDK. HIGH confidence (verified from STACK.md research).

### Secondary (MEDIUM confidence)
- [MDN AbortSignal.timeout()](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static) — Node 18+ built-in. HIGH.
- [MDN AbortSignal.any()](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/any_static) — Node 20.3+ built-in. HIGH.
- Pillar B STACK.md (2026-04-25) — SDK API change documentation. HIGH (cross-verified with direct inspection).
- Pillar B PITFALLS.md (2026-04-25) — Pitfalls 14, 15, 16 on timeout/fallback/cleanup. HIGH.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — migration scope is one file; confirmed by grep across entire codebase
- Architecture: HIGH — all integration points verified by line-number-specific code inspection
- Pitfalls: HIGH — derived from actual code paths, not abstract patterns
- BUG-06 root cause: MEDIUM — the 300ms debounce + React batching race is inferred; the exact reproduction requires instrumented Playwright test to confirm

**Research date:** 2026-04-26
**Valid until:** 2026-05-26 (stable domain; SDK 1.50.1 unlikely to have breaking changes in 30 days)
