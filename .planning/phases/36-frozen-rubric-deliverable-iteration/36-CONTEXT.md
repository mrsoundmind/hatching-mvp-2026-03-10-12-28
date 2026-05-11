# Phase 36: Frozen-Rubric Deliverable Iteration — Context

**Gathered:** 2026-05-11
**Mode:** Auto (Claude picked recommended options for every decision)
**Status:** Ready for planning

<domain>
## Phase Boundary

**Goal:** Every deliverable refinement is scored against a locked, type-specific rubric. New version < old version → auto-revert. Quality compounds through new feedback columns (`userAcceptedAt`, `editsCount`, `dismissedAt`, `impressionCount`) and a role-specific feedback signal injected into the agent prompt.

**Concrete surface:**
- Per-type rubrics (one per the 15 deliverable types in `shared/deliverableTypes.ts`) — code-versioned, schema-validated, immutable per `rubricVersion`.
- LLM-as-judge runs on every iteration: scores OLD version and NEW version against the same rubric; if NEW < OLD, the iteration is rejected, `deliverables.currentVersion` stays put, and the rejected version is persisted with a `revertedFromHigherScore: true` marker (so it remains inspectable).
- ArtifactPanel UI: Accept / Dismiss buttons, rubric breakdown per criterion ("Why this scored X"), inline auto-revert banner when a worse iteration is rejected.
- Agent prompts: after impression threshold met (≥3 finalized deliverables for that role in this project), a "Recent Feedback" section is injected — e.g., "Your last 3 PRDs were accepted, 1 dismissed."

**Out of scope (belongs to later phases or backlog):**
- Score deltas attached to step nodes — that's Phase 37 (TREE-02 consumes RUBR scores).
- Reader-test peer-review lens — Phase 39 (READ-01..04).
- Cross-project rubric tuning UI / admin editor — backlog (v3.1+).
- Multi-judge ensemble scoring — single-judge is sufficient for MVP correctness.
- Maya-led conversational override of scores — backlog.
- Score visualization in the run-tree sidebar — Phase 37.
- AI-slop detection (advisory) — Phase 46.

</domain>

<canonical_refs>
## Canonical References

Downstream agents (researcher, planner) MUST read these before acting.

| Path | Why |
|---|---|
| `.planning/REQUIREMENTS.md` (lines 27-38) | Phase 36 RUBR-01..04 + FBK-01..04 requirements — authoritative source of "what must be TRUE" |
| `.planning/ROADMAP.md` (lines 154-164) | Phase 36 success criteria (5/5 must pass) — these are the verification gate |
| `shared/schema.ts:301-349` | Existing `deliverables` + `deliverable_versions` tables — new columns extend these |
| `shared/deliverableTypes.ts` | DELIVERABLE_TYPE_REGISTRY — 15 types (prd, tech-spec, design-brief, gtm-plan, user-stories, blog-post, landing-copy, content-calendar, email-sequence, seo-brief, project-plan, competitive-analysis, market-research, process-doc, data-report) — one rubric per type |
| `server/ai/deliverableGenerator.ts:125-176` | `iterateDeliverable()` — the function where auto-revert scoring must hook in. Currently writes new version unconditionally. |
| `server/routes/deliverables.ts:262-280` | `POST /api/deliverables/:id/iterate` — request entry point; Accept/Dismiss endpoints land alongside |
| `server/llm/providerResolver.ts` | `generateChatWithRuntimeFallback()` — use this helper for LLM-as-judge calls (Groq primary, deterministic with temp=0) |
| `server/ai/openaiService.ts` | Agent prompt assembly — where "Recent Feedback" section gets injected (after PROFESSIONAL DEPTH / DOMAIN INTELLIGENCE sections, before user-task context) |
| `client/src/components/ArtifactPanel.tsx` | The only UI surface for deliverables — Accept/Dismiss buttons, rubric breakdown, auto-revert banner all land here |
| `client/src/hooks/use-toast.ts` | Reused for any transient confirmation (per Phase 35 D-05) — NOT for auto-revert banner (that's inline in panel) |
| `tests/e2e/phase-35-production-hotfix.spec.ts` | Pattern for Playwright runtime spec — mirror structure for Phase 36 |
| `.planning/phases/35-production-hotfix-pass/35-VERIFICATION.md` | Phase 35 verification template — Phase 36 mirrors the same structure |
| `CLAUDE.md` § 7 (LLM Provider Chain) | Groq llama-3.3-70b is FREE — judge calls should default to Groq for cost/latency, fall back to Gemini |

**MEMORY rules (always-on):**
- `feedback_verify_in_runtime.md` — phase "complete" in git ≠ "works"; Playwright spec must run on a live restarted dev server.
- `feedback_ui_change_protocol.md` — never edit user-facing UI without first explaining what/why/impact + showing a Playwright screenshot of current state; wait for explicit approval.

</canonical_refs>

<prior_decisions>
## Carrying Forward From Earlier Phases

**From v2.0 (Hatches That Deliver, shipped 2026-03-30):**
- Deliverable system architecture is locked: `deliverables` parent row + N `deliverable_versions` children. Phase 36 EXTENDS this — no schema redesign.
- 15 deliverable types are locked in `shared/deliverableTypes.ts`. Rubric count = type count = 15.
- ArtifactPanel is the canonical surface for any per-deliverable UI. No new panel.

**From Phase 35 (shipped 2026-05-11):**
- Toast infrastructure (`useToast`, `Toaster`) is reusable for transient messages but NOT for blocking/persistent UX.
- WebSocket schema discipline: every new WS event uses `z.object({...}).strict()` to reject unknown keys (T-35-01 mitigation pattern).
- Playwright runtime spec on live restarted dev server is the verification standard (saved feedback rule).
- DEV-only test endpoints double-guarded (`NODE_ENV !== 'production'` at handler + helper throws in prod) — same pattern available for any new DEV trigger.

**From v1.2 (Billing + LLM Intelligence, shipped 2026-03-23):**
- Groq llama-3.3-70b (FREE tier) is the cost-zero LLM option — preferred for backgrounded / non-user-facing calls like LLM-as-judge.
- `generateChatWithRuntimeFallback()` is the canonical entry into the multi-provider chain.

**From v1.1 (Autonomous Execution Loop, shipped 2026-03-23):**
- Peer-review lens infrastructure exists (`server/autonomy/peerReview/peerReviewRunner.ts`) but is per-role, not per-type. Phase 36 introduces a sibling but separate concept: per-type rubric scoring (not peer-review). Don't confuse the two.

**Anti-features (still binding):**
- No dollar amounts in primary UI (carried from v3.0). Don't show "scoring cost $0.0001" in artifact panel.
- No LLM-based intent classifier on plain affirmations (carried from v3.0). Accept/Dismiss is a button click, not an inferred intent.

</prior_decisions>

<code_context>
## Reusable Assets / Patterns

| Asset | Where | Reuse pattern |
|---|---|---|
| `iterateDeliverable()` | `server/ai/deliverableGenerator.ts:125` | Wrap with pre-write scoring gate: generate candidate → score OLD + NEW → if NEW < OLD, persist as rejected version (don't update `currentVersion`); else proceed as today |
| `generateChatWithRuntimeFallback()` | `server/llm/providerResolver.ts` | Call from a new `server/ai/rubricScorer.ts` with `temperature: 0`, Zod-validated structured output, preferred provider `groq` via env hint |
| Zod `.strict()` on WS schemas | `shared/dto/wsSchemas.ts` (Phase 35 pattern) | Use `.strict()` on rubric score schema + new feedback action WS events |
| ArtifactPanel `iterateMutation` | `client/src/components/ArtifactPanel.tsx:76-93` | Extend `onSuccess` to detect `{ reverted: true, reason }` shape and render inline banner instead of toast |
| `useQuery(['/api/deliverables', id])` | ArtifactPanel:47-50 | Same hook fetches Accept/Dismiss state — backend response shape grows by 4 columns, no new query needed |
| TanStack Query invalidation on mutation | ArtifactPanel:71-92 | Accept/Dismiss mutations follow the existing `iterateMutation` pattern |
| Single-source content components (Phase 35 hybrid pattern) | `client/src/components/legal/*.tsx` | Mirror for rubric breakdown: `client/src/components/deliverable/RubricBreakdown.tsx` — shared by ArtifactPanel + (later) Phase 37 run-tree node detail |
| `npm run db:push` | package.json | Add 4 new columns to `deliverables` + 2 new columns to `deliverable_versions` (`rubricVersion`, `rubricScore` JSONB) — no migration script needed |

## Files that will change (estimate)

**New files:**
- `shared/deliverableRubrics.ts` — frozen rubric registry, Zod-validated, one per type, semver-locked `rubricVersion`
- `server/ai/rubricScorer.ts` — LLM-as-judge module, Zod output schema, deterministic temp=0
- `client/src/components/deliverable/RubricBreakdown.tsx` — per-criterion display, "Why this scored X"
- `client/src/components/deliverable/AutoRevertBanner.tsx` — inline non-blocking banner above content
- `tests/e2e/phase-36-rubric-iteration.spec.ts` — Playwright spec (≥5 cases)
- `scripts/test-rubric-scorer.ts` — unit tests (mock LLM output → assert revert decision)

**Modified files:**
- `shared/schema.ts` — `deliverables` table gains `userAcceptedAt`, `editsCount`, `dismissedAt`, `impressionCount`; `deliverable_versions` gains `rubricVersion`, `rubricScore` (JSONB), `revertedFromHigherScore` (bool)
- `server/ai/deliverableGenerator.ts` — `iterateDeliverable()` wraps scoring + revert decision
- `server/routes/deliverables.ts` — add `POST /api/deliverables/:id/accept`, `POST /:id/dismiss`, `POST /:id/impression`; iterate response shape grows
- `server/ai/openaiService.ts` — inject "Recent Feedback" section in agent system prompt after PROFESSIONAL DEPTH section
- `client/src/components/ArtifactPanel.tsx` — Accept/Dismiss buttons, RubricBreakdown panel toggle, AutoRevertBanner integration, impression fire on open
- `playwright.config.ts` — register `phase-36` project entry

</code_context>

<decisions>
## Implementation Decisions

### Rubric definition format (RUBR-01)

- **D-01:** Rubrics live in **code**, not DB. New file `shared/deliverableRubrics.ts` exports `DELIVERABLE_RUBRIC_REGISTRY` — one entry per type, Zod-validated at module load. Code-versioned via git, immutable per deploy.
- **D-02:** Each rubric is a versioned object: `{ rubricVersion: '1.0.0', type: 'prd', criteria: [{ key, label, weight, anchorAt10, anchorAt0 }] }`. Criteria count: 4–6 per type (e.g., for PRD: Problem Clarity, Solution Specificity, Success Metrics, Risk Coverage, User Story Quality). Weights sum to 1.0; final score is weighted sum * 10.
- **D-03:** Anchors at 10 and 0 are short text descriptors used in the judge prompt to keep scoring stable (e.g., "10: each criterion has concrete acceptance test; 0: vague aspiration only"). NOT shown to user; only the criterion label + numeric score + 1-sentence justification surface in UI.
- **D-04:** Rubric immutability: each `deliverable_versions` row stores `rubricVersion` it was scored against. If we later change a rubric (bump to `2.0.0`), already-scored historical versions are NOT re-scored — they keep their `1.0.0` score. New versions get `2.0.0`.
- **D-05:** Initial rubric content is **AI-drafted** by Claude during plan execution (one rubric per type from the section schema), then committed verbatim. No lawyer-review-style hedging — rubrics are internal scoring tools, not user-facing copy.

### Scoring mechanism (RUBR-02, RUBR-03)

- **D-06:** Single LLM-as-judge call per iteration, scoring BOTH old and new versions in one prompt to anchor the comparison. New module: `server/ai/rubricScorer.ts`.
- **D-07:** Judge provider: **Groq llama-3.3-70b** (FREE tier, low latency, deterministic with `temperature: 0`). Fall back to Gemini via `generateChatWithRuntimeFallback()` if Groq fails. NO DeepSeek for scoring — keep judge stable and US-hosted to avoid mixing the production chain's failure modes into scoring.
- **D-08:** Output shape: Zod schema `{ rubricVersion, oldScore: { total, breakdown[] }, newScore: { total, breakdown[] }, recommendation: 'keep_new' | 'revert' }`. Breakdown = `[{ criterion, score: 0-10, justification: string }]`. `.strict()` modifier mandatory (Phase 35 T-35-01 pattern).
- **D-09:** Auto-revert trigger: `newScore.total < oldScore.total` (strict less-than; ties default to keeping new — gives the user the refinement they asked for if quality is equivalent).
- **D-10:** On revert: persist a new `deliverable_versions` row with the rejected content + `revertedFromHigherScore: true` flag, but DO NOT update `deliverables.currentVersion`. Inspectable in version history, just not active.
- **D-11:** Score also runs on first generation (v1) — no comparison, just baseline persistence. Subsequent iterations always compare against the previous active version (which may or may not be the latest row, due to reverts).
- **D-12:** Judge prompt budget: capped at 4k tokens (deliverable bodies are bounded by `maxTokens: 4000` in generator). One judge call per iterate; cost ~free via Groq.

### Auto-revert UX (RUBR-02)

- **D-13:** When `iterate` response carries `{ reverted: true, oldScore, newScore }`, ArtifactPanel renders a NEW inline component `AutoRevertBanner` ABOVE the deliverable content — amber/warning visual, NOT a blocking modal, NOT a toast.
- **D-14:** Banner copy: "Refinement made it worse, kept previous version. Click to see what changed." Click expands a diff drawer (lightweight: just show the rejected version side-by-side, mark scored criteria where it lost points). MVP: just toggle visibility of the rejected version's content + its breakdown; no fancy diff UI.
- **D-15:** Banner is dismissible (X button); dismissal is client-side only (not persisted) — appears again on next revert event.
- **D-16:** "Why this scored X" surface (RUBR-04): a "Rubric" toggle in the ArtifactPanel header opens a per-criterion breakdown (criterion label, score 0-10, 1-sentence justification). Toggle state is local component state, not persisted.

### Feedback columns + Accept/Dismiss (FBK-01, FBK-02, FBK-03)

- **D-17:** Schema additions on `deliverables` table: `userAcceptedAt timestamp`, `editsCount integer DEFAULT 0`, `dismissedAt timestamp`, `impressionCount integer DEFAULT 0`. All nullable except counters (which default 0). Applied via `npm run db:push`.
- **D-18:** Accept and Dismiss are **mutually exclusive but reversible** — clicking Accept sets `userAcceptedAt = now()` and clears `dismissedAt`; clicking Dismiss does the opposite. Clicking Accept on an already-accepted deliverable is a no-op (idempotent — useful for "Are you sure?" UI without state corruption). UI shows current state as filled/outlined icon variants.
- **D-19:** `editsCount` increments on every successful `iterate` call (NOT on reverts). Reverts do not count as edits because no version change occurred.
- **D-20:** `impressionCount` increments via dedicated `POST /api/deliverables/:id/impression` endpoint, fired ONCE per ArtifactPanel mount (use `useEffect` with `[deliverableId]` deps so it doesn't double-fire on re-render). Idempotency: backend de-dupes if same user fires more than once within 5 seconds (cheap in-memory window per server, just to drop double-React-strict-mode invocations in dev). Cross-session dedupe is NOT required — viewing the same deliverable twice in a week is two impressions.
- **D-21:** Two new API routes: `POST /api/deliverables/:id/accept` and `POST /api/deliverables/:id/dismiss`. Both check ownership (user_id on parent project). Idempotent. Return the updated deliverable row.

### Agent prompt feedback signal (FBK-04)

- **D-22:** Injection point: in `server/ai/openaiService.ts`, after the existing `PROFESSIONAL DEPTH` and `DOMAIN INTELLIGENCE` sections, before the user-task context. New section header: `RECENT FEEDBACK ON YOUR WORK (this project)`.
- **D-23:** Inclusion threshold: signal injects ONLY if this agent has ≥3 finalized deliverables (status='complete') in this project. Below threshold → section omitted entirely (avoid noise from N=1 signals).
- **D-24:** Signal content: aggregate counts only. Format: "Your last N {type-label}: {accepted} accepted, {dismissed} dismissed, {iterated} edited. {Optional 1-line trend if dismissal rate > 50%}." NO specific deliverable IDs, NO user names, NO raw justifications — just the rolled-up counts.
- **D-25:** Query: `SELECT type, COUNT(...) FILTER (...)` from `deliverables` for the last 10 finalized deliverables by this agentId on this projectId, grouped by type. Result cached in-process for 60s per (agentId, projectId) pair to avoid hammering on each chat turn.
- **D-26:** Verification: a prompt-snapshot test asserts the section IS present when ≥3 deliverables exist and the section is ABSENT when <3. (Pattern: similar to existing `test:voice` / `test:reasoning` snapshot tests.)

### Verification

- **D-27:** Playwright runtime spec at `tests/e2e/phase-36-rubric-iteration.spec.ts`. Cases:
  1. Generate a deliverable (any type) → assert rubric score persisted on v1 + visible in panel rubric toggle
  2. Iterate with a NEUTRAL instruction ("rephrase this section") → assert NEW score >= OLD → assert currentVersion advances + Accept button still neutral
  3. Iterate with an ADVERSARIAL instruction designed to lower quality ("remove all acceptance criteria") → assert revert triggered + AutoRevertBanner visible + currentVersion did NOT advance
  4. Click Accept → assert button state changes + `userAcceptedAt` persists across reload
  5. Click Dismiss → assert state flips + `dismissedAt` persists across reload
  6. Re-open the panel → assert `impressionCount` increments
  Spec runs against `npm run dev` live server (saved feedback rule).
- **D-28:** Unit tests: `scripts/test-rubric-scorer.ts` mocks LLM output → asserts revert decision math, Zod parse-fail on malformed judge output, deterministic ordering of criteria.
- **D-29:** Prompt-snapshot test: `scripts/test-feedback-signal.ts` — seeds 3 fake deliverables for agentId X in project Y, asserts agent system prompt contains "RECENT FEEDBACK" section; seeds 2 → asserts section absent.
- **D-30:** Deploy gate: green Playwright + green unit + `npm run typecheck` + `npm run build`. Same two-step gate as Phase 35. `fly deploy` ships Phase 36 in isolation after PRs are merged — small surface (3 new files + ~6 modified), easy rollback via `git revert` chain.

### Plan breakdown (researcher / planner can adjust)

- **36-01** — Foundation: rubric registry (`shared/deliverableRubrics.ts` with 15 rubrics + Zod validators), DB schema additions (4 cols on `deliverables`, 3 on `deliverable_versions`), unit tests on rubric structure validity. NO behavior changes yet.
- **36-02** — Server scoring: `server/ai/rubricScorer.ts`, hook into `iterateDeliverable()` for auto-revert, baseline scoring on first generation, persistence, accept/dismiss/impression endpoints.
- **36-03** — Client UI: ArtifactPanel Accept/Dismiss buttons, RubricBreakdown toggle, AutoRevertBanner, impression-fire on mount. **Visual checkpoint required before commit** (saved feedback rule — Playwright screenshots).
- **36-04** — Agent prompt feedback signal: `openaiService.ts` injection, storage helper, in-process cache, prompt-snapshot tests. + Playwright runtime spec covering end-to-end flow. + Phase verification doc.

</decisions>

<deferred>
## Noted for Later

- **Rubric admin editor (UI to tune weights/anchors per type)** — future phase / backlog. Code-defined rubrics are sufficient for MVP correctness; an admin UI is a tooling layer that can come after we see real iteration patterns.
- **Multi-judge ensemble scoring** — backlog. Single Groq judge is good enough at temp=0; ensemble adds latency and cost without clear quality gain at this stage.
- **Maya-led conversational rubric override** — backlog. Power-user mechanism for "I disagree with the score, accept anyway"; for MVP, user can already keep the worse version by ignoring the banner (revert is non-destructive — rejected version stays in history).
- **Score-delta badges in run tree** — Phase 37 (TREE-02 explicitly depends on Phase 36 rubric scores). Don't build the badge here.
- **Reader-test peer-review lens** — Phase 39. Different mechanism (context-naïve reviewer), not part of rubric scoring.
- **Cross-project rubric tuning / per-project weight overrides** — backlog. Project-specific rubrics would break the "frozen" contract; if needed, introduce as a new rubric type variant (e.g., `prd-startup` vs `prd-enterprise`) rather than mutable per-project weights.

</deferred>

<open_questions>
## Open Questions (for researcher / planner to resolve, not user)

- **Q1 (research):** Optimal judge prompt structure — does scoring OLD and NEW in one call (anchoring) really beat two independent calls? Test both, pick the more stable one.
- **Q2 (research):** Cache TTL for the feedback-signal aggregation query (default D-25: 60s in-process) — should this invalidate on Accept/Dismiss webhook write, or is staleness OK?
- **Q3 (planning):** Does Phase 36 need to backfill rubric scores for pre-Phase-36 deliverable versions? Default: NO (mark them as `rubricVersion: null` and skip the scoring breakdown UI for those). Phase 37 has a similar backfill question for `autonomy_events`; keep the answers symmetric.
- **Q4 (planning):** Should `impressionCount` be DB-stored or in a separate analytics table? Default: DB column on `deliverables` per RUBR-01 wording ("Deliverables table gains `impressionCount` int columns"). If volume becomes a concern, can migrate later.

</open_questions>

---

**Next:** `/gsd-plan-phase 36`
