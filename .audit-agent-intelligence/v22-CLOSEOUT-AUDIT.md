# v2.2 Close-Out — Independent Verification & Open Items (fix-oriented)

**Verifier:** Claude Code (QA) · **Date:** 2026-07-26 · **Branch:** `feat/v2.2-intelligence-fixes`
(HEAD `67fb230` at test time) · **Server:** production DeepSeek (`LLM_MODE=prod`), restarted from HEAD ·
**Judge chain:** Groq (cross-model). Nothing merged to the live app.

Purpose: verify the T1–T4 close-out fixes and flag what's actually left to fix. **T1/T3/T4 are closed.
T2 is cosmetic and correct-by-construction. The one item worth acting on is not a T-fix — it's that the
peer-review judge is gated so narrowly that most autonomous work never gets reviewed.**

---

## ⚑ OPEN ITEM (the thing to fix) — peer-review "teeth" only bite a narrow slice of work

**Severity: medium (product-value, not a regression).** The v2.2 headline is "real peer review with
teeth." Verified true *when it runs* — but it runs rarely.

### Evidence (live)
- I fired **4 substantive autonomous tasks** on the restarted server (a DB migration plan, a rollback
  plan, a competitive-stats brief, a fabricated-metrics investor line). **Only one — fired *before* the
  restart — ever produced a judge verdict.** The other three auto-completed with **zero** peer-review
  verdict events.
- DB: total judge verdict events sat frozen at **8** across all my post-restart attempts — none of my
  new tasks added one.

### Root cause (file:line)
- Peer review only fires when `maxRisk >= thresholds.peerReviewTrigger` —
  `server/autonomy/execution/taskExecutionPipeline.ts:382` (and the mid-risk gate at `:597`).
- `peerReviewTrigger` defaults to **0.35** — `server/autonomy/config/policies.ts:24`.
- So any autonomous task the safety scorer rates **< 0.35** ships with **no review at all** — no
  deterministic check, no LLM judge, no teeth. In practice that's most ordinary work (a rollback plan,
  routine copy, a schema tweak).
- The judge itself is correctly wired ON (`enableLlmJudge: true` at `taskExecutionPipeline.ts:403,621`;
  `FEATURE_PEER_REVIEW_JUDGE` defaults true at `peerReviewRunner.ts:10`) — the gate is upstream of it.

### Fix options (your call)
1. **Lower / re-tune `peerReviewTrigger`** so more real work is reviewed (cheapest; watch cost — every
   reviewed task adds a Groq judge call).
2. **Always run at least a cheap deterministic review** on every autonomous task, and reserve the LLM
   judge for `>= trigger` (keeps cost bounded, gives universal minimal coverage).
3. **Review by task type, not just risk** — always judge outward-facing/factual deliverables regardless
   of computed risk (an investor line should always be checked even if "risk" scores low).

### How to verify a fix
Fire several ordinary autonomous tasks and confirm each produces a `peer_review_feedback` verdict event:
```bash
node --env-file=.env -e "import('pg').then(async({default:pg})=>{const p=new pg.Pool({connectionString:process.env.DATABASE_URL});const r=await p.query(\"SELECT count(*) FILTER (WHERE payload ? 'verdict') verdict, count(*) total FROM autonomy_events WHERE event_type='peer_review_feedback' AND timestamp > now() - interval '15 min'\");console.log(JSON.stringify(r.rows[0]));await p.end();})"
```
Target: `verdict` count rises roughly 1:1 with the autonomous tasks you fire.

---

## T1–T4 verification record (what I checked, and the result)

| Item | What it changed | Verdict | How verified |
|---|---|---|---|
| **T1** — gate rewrite on material severity | `peerReviewRunner.ts:323-325`: only regenerate on `severity major\|critical` | 🟢 code-correct, ⚪ not live-exercised | Read the gate; logic sound (stops wasteful minor rewrites, block path untouched). Couldn't stage a minor-gap live case (see open item — judge rarely fires). |
| **T2** — confidence in payload | `peerReviewRunner.ts:290` adds `confidence: verdict.confidence` to payload | 🟢 correct-by-construction · cosmetic | It's in the **same object literal** as the column write (`:285`) that demonstrably works — they cannot diverge, so any event the current code creates carries it. The 8 existing verdict events lack it only because they **predate the fix**. Couldn't stage a post-fix event (judge didn't fire on 4 tries), but the code makes it a certainty. Cosmetic anyway: confidence was always in the column and reaches the UI. |
| **T3** — reviews get their own feed row | test helper only (`seed-peer-review-event.ts`); no product code | 🟢 closed — my earlier concern was WRONG | Observed live: `peer_review_feedback` events **do** render as standalone feed rows ("Alex · Review · Left feedback…"). My "folds under the task" nuance was unfounded; retracted. |
| **T4** — voice lock-in | `test-voice-distinctiveness.ts` gate 0.60→**0.40**; blind eval 5→**10** roles | 🟢 fully verified | `npx tsx scripts/test-voice-distinctiveness.ts` → 8/8, closest pair Nyx↔Sage **0.185** (gate 0.40 can now catch a regression; 0.60 never could). |

**Note on T4 scope:** this *locks in* the current voice distinctiveness — it does **not** deliver the
deeper per-role voice sharpening the original Phase-E plan scoped (correctly deferred). Voices were not
touched.

---

## Minor observability quirks (noticed in passing — not blocking, worth a glance)

1. **Autonomy events aren't reliably linked to their run's `trace_id`.** A completed run's
   `trace_id` returned **0** matching `autonomy_events`, which made it hard to tie a review verdict to
   the task that produced it. If you want the Activity feed to group a task's review under that task,
   this linkage needs to be solid. (`autonomy_runs.trace_id` vs the `trace_id` on the events.)
2. **`autonomy_events.timestamp` reads wrong.** A verdict event showed `timestamp` ≈ 9 hours off from
   its run's `created_at` (event said `05:54Z`, run was `15:00Z`). Feed ordering / "x min ago" labels
   depend on this column — worth checking how it's set.

---

## What I could NOT prove (honest limits of this pass)
- **A live post-fix judge verdict event.** The judge didn't fire on any of my 4 post-restart tasks
  (the open item above), and the integration test that forces a verdict uses **mock storage** (running
  it didn't change the DB count), so no real event was produced to inspect. T2 is argued from code, not
  from a captured live event.
- **T1's gate skipping a real minor-gap rewrite live** — same cause (judge didn't fire).

## Reproduction commands (audit it yourself)
```bash
# T4 voice guard
npx tsx scripts/test-voice-distinctiveness.ts
# Judge calibration (0% false-block / 100% catch) — note: writes no DB events
npx tsx --env-file=.env scripts/eval-peer-review-judge.ts
# Peer-review integration (bad draft blocked, good passes) — mock storage
npx tsx --env-file=.env scripts/test-peer-review-integration.ts
# T1/T2 code
git show b99b892 -- server/autonomy/peerReview/peerReviewRunner.ts
# The review gate (the open item)
sed -n '378,392p' server/autonomy/execution/taskExecutionPipeline.ts
grep -n peerReviewTrigger server/autonomy/config/policies.ts
```

## Bottom line
The four T-fixes hold: **T1/T3/T4 closed, T2 cosmetic-and-correct.** No regressions. The real remaining
work is **making the judge review more than a narrow risk-gated slice of autonomous output** — that's
the difference between "the teeth exist" (true) and "the teeth actually protect your users" (only
sometimes). Start there.
