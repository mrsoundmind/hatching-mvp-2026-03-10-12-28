# Plan: Outcome-Based Growing Playbook — "Hatches that get smarter from experience"

> Status: **PLAN ONLY, not built.** Deliberate post-launch project (respects the no-mid-milestone-hotfix
> rule). Nothing here ships without its own benchmark. Author: exploration session 2026-08.

## Recommended sequencing (read this first — from the 2026-08 review)

**Do NOT build the learning layer first. Build the outcome signal as a SCOREBOARD, not a brain.**

The honest verdict on this whole plan: the design is sound, but as a near-term lever it is weak —
its upside is capped by the frozen model (better notes, not a smarter brain), and the "learn across many
users" gates only pay off at user volume Hatchin does not have pre-launch. Building it now is premature.

BUT the linchpin it depends on — the honest "did it work?" outcome signal — is valuable on its OWN,
immediately, as a **production quality metric** (the audit's "zero live quality metrics" gap). So:

1. **Phase 1 (do soon, cheap, pre-launch-appropriate): capture the outcome signal as a MEASUREMENT.**
   Wire the behavioral signals below (deliverable kept-vs-reverted, task done-vs-reopened, Keep/Refine
   clicks, thumbs) into a simple read-only health view: *are the agents actually helping users?* No
   learning, no promotion, no risk. This is the first honest answer to "is the product working."
2. **Phase 2 (defer): the growing playbook.** Only once the scoreboard shows clear, repeatable patterns
   AND there is enough user volume to make the repetition gate meaningful, build the learning layer on top
   of the same signal. Everything below is the Phase 2 design, ready when that day comes.

## The problem (measured, not assumed)

The agents remember what you tell them but do **not** get smarter from experience. This session measured why:

- **Growth-loop lessons (LEARN-01)** — wired, default-on. Benchmarked (`scripts/eval-learning-loop.ts`,
  6 roles, model held constant, real path): **~zero effect** (+0.08/dim, inside the noise; per-role Δ stdev
  3.42 vs mean 0.50), and it can hurt precision roles. A transient prompt nudge that doesn't reliably transfer.
- **AKL (autonomous knowledge loop)** — the stronger mechanism, but **dormant**: its research step is gated on
  `ENABLE_WEB_IN_PROD_MODE` (default `false`, unset) with no search provider, so `runRoleScopedResearch` returns
  `blocked` and `runner.ts:98` early-returns `promoted:false`. It detects gaps and logs them but learns nothing.
- The base model (DeepSeek) is **frozen** — it does not learn from conversations. Experience can only help by giving
  it better *notes* (context/knowledge), never more raw reasoning. (The "ceiling is the model" finding, same week.)

**Key distinction this plan rests on:** the outcome-based playbook learns from Hatchin's OWN successful work
(in-house), so unlike the AKL it does **NOT need web search enabled.** It is safe to build and run with web off.

## The design (plain version)

A **growing playbook**: agents distill short, reusable lessons from work that actually *succeeded*, store them in a
searchable library, and pull only the few relevant lessons into each future answer. The agents effectively write
their own textbook from what works and re-read the relevant page each time.

### Space is a non-issue (design it right)
- Store the **lesson (1-2 sentences, a few hundred bytes)**, never the conversation. A million lessons ≈ a few
  hundred MB ≈ pennies. Disk is not the constraint.
- **Dedupe** (merge repeats) and **expire** (stale/recency-tagged lessons drop off).
- The real limit is the agent's **attention (context window)**, not disk. So **retrieve only the top 3-5 relevant
  lessons per answer** — reuse the existing per-role RAG matrix (`server/knowledge/rag/*`). Library grows forever;
  each answer stays lean. This is exactly how the knowledge matrix already works.

### Good vs bad learning — the three gates
A lesson only enters the playbook if it passes all three:
1. **Outcome gate (the linchpin):** only distill a lesson from work that *succeeded*. See the grounded signal
   inventory below. Work the user rejected/refined-away produces NO lesson (or a negative one).
2. **Repetition gate:** a lesson only "graduates" to the relied-on playbook after the pattern works **several times
   across different users/projects** — one success is a fluke, a repeat is real. Kills most noise.
3. **Gatekeeper + rollback gate:** before a lesson becomes canon, a reviewer (agent or rule) checks it is true,
   non-contradictory, a *general principle* (not one user's quirk), and free of private secrets. It can be **rolled
   back** if it later degrades answers. **This gate already exists** — it is the AKL's `governance.ts` +
   `promotion.ts` (`attemptCanonPromotion`/`rollbackCanon`, canon files under `roleBrains/*.canon.json` with
   `baseline/*.canon.backup.json`). We feed outcome-verified lessons INTO it instead of web-research results.

## The linchpin: honest "did it work?" signals that ALREADY exist (grounded in code)

The whole thing lives or dies on the outcome signal. Good news: Hatchin already captures several. Ranked:

**Strong (behavioral, semi-objective) — build the outcome gate on these first:**
- **Deliverable kept vs reverted vs refined:** `deliverableGenerator.ts` — `revertedFromHigherScore` (a change that
  scored LOWER was rejected → negative), `editsCount`/`incrementEditsCount` (kept with 0 edits → positive; heavily
  re-iterated → weak negative), `countResolvedAnnotations`/`resolvedFromPrevious` (reader-test flags fixed next
  version → positive "it improved").
- **Task lifecycle:** `taskExecutionPipeline.markTaskCompleted`, `task_completed` vs `task_failed` events; a task
  reopened/redone after "done" → negative. Completed-and-stayed-done → positive.

**Direct but sparse:**
- **Completion card Keep / Refine / Looks-good** (`task_execution_completed`, the chat "done" moment): "Looks
  good"/Keep → positive, "Refine" → weak negative. NOTE: verify the client actually records WHICH button was
  pressed back as an event — if not, wiring that capture is a small, high-value first task (it is a clean per-turn
  user-outcome signal).
- **Thumbs up/down** (`message_reactions`, `feedbackData`): already consumed by `personalityEvolution` (tone) and
  `markSkillUsed`. Direct but rare.

**Internal proxy (already feeding the weak lessons loop — do NOT rely on alone):**
- **Peer-review verdicts** (`peer_review_feedback`: approve/revise/reject). Agent-judged, not a user outcome.

**Design rule:** weight behavioral signals over opinion signals. A lesson from a deliverable the user KEPT
untouched and a task that stayed DONE is worth far more than a thumbs-up or a peer-review approve.

## Reuse map (most of the machinery exists)
- **Reuse:** AKL governance + promotion + rollback (`akl/governance.ts`, `akl/promotion.ts`); the RAG store +
  retrieval matrix for storing/injecting lessons (`knowledge/rag/*`); `peer_review_feedback`/event logging; the
  injection seam in `openaiService.ts` (where `getQualityLessons` already plugs in); `eval-learning-loop.ts` as the
  benchmark harness.
- **Build new:** (1) an **outcome extractor** that turns the behavioral signals above into a per-lesson success/fail
  label; (2) the **repetition/graduation gate** (count corroborating successes before promoting); (3) wiring
  outcome-verified lessons into the existing governance→promotion path (instead of web research); (4) retrieval of
  playbook lessons by relevance (not the current project-wide dump).

## Privacy
The gatekeeper keeps the **general principle** ("tie pricing to value") and strips the **private specific**
("Acme's budget is $2M"). Default lesson scope is the project/team; cross-project promotion only for de-identified
general principles that cleared the repetition gate. This handles the earlier cross-user privacy concern.

## Prerequisites / sequencing
- **No web needed** — this learns from in-house successes, so it can ship with `ENABLE_WEB_IN_PROD_MODE` still off.
  (Activating the AKL's external web research is a SEPARATE, later, riskier decision — cost + prompt-injection.)
- **First task is the outcome signal**, not the playbook. If the "did it work?" label is weak, the playbook fills
  with noise (proven: that is why the transient-lessons version scored zero). Wire + validate the outcome extractor
  before building the library.
- **Post-launch, deliberate.** Not mid-pre-launch (no-mid-milestone-hotfix rule).

## Definition of done (must be measured)
- Benchmark (extend `eval-learning-loop.ts`): agents with the outcome-gated playbook, over MANY rounds/users,
  measurably beat the no-playbook baseline on the 6-dimension score — model held constant — with the gain OUTSIDE
  the noise band, and NO regression on precision roles. If it does not clear the bar, it does not ship.
- Rollback verified (a bad promoted lesson can be pulled and answers recover).
- Space/attention verified (retrieval stays at top-K; injected token budget bounded).

## Honest ceiling (set expectations)
Even done perfectly, this gives agents better *notes from experience*, not a smarter *brain*. It raises the floor
and adds consistency; it does not lift the model-bound reasoning ceiling. "Gets wiser with experience" is real and
worth building; "becomes a genius over time on a frozen model" is not.
