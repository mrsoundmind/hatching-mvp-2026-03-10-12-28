# BUG-3 Interim — Coarse Multi-Agent Cost Estimate (drop-in spec)

**Goal:** make the per-user + global **dollar** caps approximately see multi-agent (and safety-intervention)
LLM spend, **without** touching the streaming internals of the 1,880-line `handleStreamingColleagueResponse`.
Audit-only spec — no code was changed. Effort: **~½ day (S)**. Closes: `BUG-3` (interim). Exact fix rides `ARCH-1`.

---

## Honest recalibration first — read this before deciding priority

I pushed back that the global $ kill is "blind" to multi-agent spend. That's **true** (`costGuard.ts:117 →
storage.getGlobalDailyCostCents` reads the recorded `usage` table, and multi-agent turns never call
`recordUsage`). But I owe you the arithmetic on *how much* it matters, because it changes the urgency:

Per generation, the estimate is ~3,500 prompt tokens + output. At the **default DeepSeek V4-flash** price
(`$0.14 / $0.28` per 1M, from `COST_TABLE`):
- A 3-agent turn ≈ `3 × 3500` prompt + ~2,400 completion tokens ≈ **~0.2 cents**.
- Your `MESSAGES_HARD_MAX=500`/day already caps turns, so worst case ≈ `500 × 0.2¢` ≈ **~$1/day/user of un-counted spend.** Negligible. **On flash, the message-count cap is the real brake and this gap is practically immaterial.**

Where it *does* matter: **premium-tier routing** (`gemini-2.5-pro` at `$1.25 / $5.00` per 1M). Same turn ≈
**~2.5 cents**, so `500` turns ≈ **~$12.50/day** — which blows past `COST_GUARD_USER_DAILY_CENTS=500` ($5)
while the cap reads $0. So: **low-Medium overall, real for premium/Pro users, immaterial for default flash.**

**Verdict:** still worth doing (correctness + premium tier + defense-in-depth), but it's a Tier-1 nicety,
not urgent. Ship it; don't lose sleep before it lands.

---

## The fix — two small edits

### Edit 1 — new exported helper in `server/billing/usageTracker.ts`
Put the estimate logic next to `COST_TABLE`/`estimateCostCents` (both already in this file, so no export
gymnastics). It records **cost only** (`messages: 0`) so it does **not** double-count the turn against the
message cap — the inbound send was already counted at the WS `costGuard`. Never throws.

```ts
// --- BUG-3 interim: estimated cost for turns without provider token metadata ---
// Conservative input estimate per agent generation (system prompt + brain + memory + history).
// Rounds up on purpose: a cost GUARD should err toward stopping spend, not under-counting it.
// Calibrate against a real LangSmith trace when convenient.
const EST_PROMPT_TOKENS_PER_GEN = Number(process.env.COST_EST_PROMPT_TOKENS_PER_GEN ?? 3500);
const CHARS_PER_TOKEN = 4;

/**
 * Record an ESTIMATED cost for a turn whose provider token usage isn't captured
 * (multi-agent team turns, safety interventions). Makes the per-user + global $ caps
 * approximately see this spend until ARCH-1 threads real usage through the response path.
 * Cost-only (messages: 0) so it doesn't inflate the message-count cap. Never throws.
 */
export async function recordEstimatedUsage(
  storage: IStorage,
  userId: string,
  provider: ProviderId,
  model: string,
  generationCount: number,
  outputText: string,
): Promise<void> {
  const promptTokens = Math.max(1, generationCount) * EST_PROMPT_TOKENS_PER_GEN;
  const completionTokens = Math.ceil((outputText?.length ?? 0) / CHARS_PER_TOKEN);
  const costCents = estimateCostCents(model, {
    promptTokens, completionTokens, totalTokens: promptTokens + completionTokens,
  });
  if (costCents <= 0) return; // Groq (free) or unknown model → nothing to record
  try {
    await storage.upsertDailyUsage(userId, todayDateStr(), {
      messages: 0,                       // cost-only: the turn was already counted at ingress
      promptTokens, completionTokens, totalTokens: promptTokens + completionTokens,
      costCents: Math.round(costCents),
      standardMessages: 0, premiumMessages: 0, autonomyExecutions: 0,
    });
    console.log(`[UsageTracker] estimated multi-agent cost recorded: ~${Math.round(costCents)}¢ (${generationCount} gens, est)`);
  } catch (err) {
    console.error('[UsageTracker] estimated usage failed:', (err as Error).message);
  }
}
```

> Assumes `upsertDailyUsage` is **additive** on `costCents` (it is — `recordUsage` relies on that to sum a
> day). If it were a set-not-add, both caps would already be broken for the single-agent path, so this is safe.

### Edit 2 — call it at the multi-agent site in `server/routes/chat.ts` (~line 2382)
Right after `accumulatedContent = await handleMultiAgentResponse(...)`, inside the `else if
(selectedAgents.length > 1)` block. **Use `(ws as any).__userId` directly** — `billingUserId` isn't declared
until `:3299`, well below this point.

```ts
accumulatedContent = await handleMultiAgentResponse(selectedAgents, userMessage, chatContext, sharedMemory, responseMessageId, conversationId, ws, abortController);

// BUG-3 interim: multi-agent turns don't set llmMetadata, so their $ spend was invisible to both dollar
// caps (only the message-count rate limit bounded them). Record a conservative estimate so the caps see it.
const maUserId = (ws as any).__userId as string | undefined;
if (maUserId) {
  const rt = getCurrentRuntimeConfig();
  void recordEstimatedUsage(storage, maUserId, rt.provider, rt.model, selectedAgents.length, accumulatedContent ?? '');
}
```

Add the import (or extend the existing usageTracker import at `chat.ts:75`):
```ts
import { recordUsage, recordEstimatedUsage } from "../billing/usageTracker.js";
```

### (Optional) same helper closes the safety-intervention half of BUG-3
The safety-intervention path also skips `recordUsage`. It's a single short generation (~1 gen, low cost), so
lower value, but for completeness call `recordEstimatedUsage(storage, userId, rt.provider, rt.model, 1,
interventionText)` where that message is built (`chat.ts` ~2320-2360, the `buildClarificationIntervention`
site). Skip if you want to keep the change minimal — the multi-agent path is 95% of the gap.

---

## Why this is correct (and its honest limits)
- **Flows to both caps.** `upsertDailyUsage` writes the same `costCents` column that `costGuard` reads for
  the per-user daily cap and `getGlobalDailyCostCents` for the global kill. Recording here makes multi-agent
  spend visible to both — the whole point of the fix.
- **Conservative by design.** Rounds up (3,500 prompt tokens/gen is a deliberate over-estimate; the real
  static prefix + brain + memory is often less). A cost guard tripping slightly *early* is the safe failure.
- **No streaming risk.** It runs *after* `handleMultiAgentResponse` returns, reads only `accumulatedContent`
  and `selectedAgents.length`, and is fire-and-forget (`void` + internal try/catch). Zero change to the
  generation path.
- **Free models cost nothing.** Groq (`llama-3.3-70b`, `0/0` in `COST_TABLE`) → `costCents <= 0` → early
  return, no phantom charge.
- **Limit:** it's an *estimate*, not measured tokens. The exact version (real per-generation token metadata)
  arrives with `ARCH-1` when `respondToMessage()` exposes one usage seam per generation. Until then this is
  approximately right and strictly better than $0. The `est` marker in the log lets observability tell
  estimated rows from measured ones if you later want to reconcile.

---

## Verification (mirror your existing discipline)
**Unit** (`scripts/test-estimated-usage.ts`, mock storage):
1. `recordEstimatedUsage(mock, 'u1', 'deepseek', 'deepseek-v4-flash', 3, 'x'.repeat(2400))` →
   asserts `upsertDailyUsage` called once with `messages: 0`, `promptTokens: 10500`, `completionTokens: 600`,
   `costCents: Math.round(estimateCostCents(...))`.
2. Groq model (`llama-3.3-70b-versatile`) → asserts `upsertDailyUsage` **not** called (cost 0, early return).
3. Empty output → `completionTokens: 0`, prompt-only cost still recorded.
4. `generationCount: 0` guarded to `Math.max(1, …)` (never records negative/zero prompt).

**Live** (the way you verified the others):
1. Set `COST_GUARD_USER_DAILY_CENTS` low + route to a **priced** model (e.g. `LLM_PRIMARY` on a gemini tier,
   or temporarily lower the cap), fire a multi-agent turn (a message that selects >1 agent), then hit the
   per-user cap check — confirm the daily `costCents` **increased** after a multi-agent turn (it stayed flat before).
2. Confirm the message-count cap did **not** double-increment (the estimate uses `messages: 0`).
3. Groq turn → confirm `costCents` unchanged.

**Regression:** `test-cost-guard.ts` (your 9/9) + `test:integrity` stay green (this only adds a fire-and-forget
write; no path it gates on changes).

---

## Effort / placement
- **~½ day (S).** ~25 lines in `usageTracker.ts` + ~5 lines at `chat.ts:2382` + one small test.
- **Roadmap slot:** Tier 1 (new item, call it `1.21`), or fold into `0.1`'s follow-up since it completes the
  dollar-cap coverage. Not launch-blocking on flash; do it before you route real traffic to a **premium** tier.
- **Config knob added:** `COST_EST_PROMPT_TOKENS_PER_GEN` (default 3500) — raise to be more conservative,
  calibrate down from a real trace.

*Audit-only spec. No code modified. The exact-metadata version supersedes this at ARCH-1.*
