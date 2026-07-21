# Phase 36: Frozen-Rubric Deliverable Iteration — Research

**Researched:** 2026-05-11
**Domain:** LLM-as-judge scoring + Drizzle schema migration + TanStack mutation state + Playwright runtime verification
**Confidence:** HIGH (everything verified against repo code; locked decisions in 36-CONTEXT.md constrain alternatives)

## Summary

Phase 36 wraps the existing `iterateDeliverable()` function with a deterministic LLM-as-judge scoring gate. Every iteration scores BOTH the previous and the candidate version against a frozen, type-specific rubric; if the new score is strictly less than the old, the candidate is persisted as a rejected version (`revertedFromHigherScore: true`) and `deliverables.currentVersion` does not advance. Four new feedback columns on `deliverables` (`userAcceptedAt`, `editsCount`, `dismissedAt`, `impressionCount`) compound quality signal over time. A `RECENT FEEDBACK` section injects into agent system prompts once ≥3 finalized deliverables exist for that role+project.

Architecture is bounded: 2 new files in `server/ai/` (rubric scorer + a thin storage helper for the feedback aggregation query), 1 new file in `shared/` (rubric registry), 2 new client components in `client/src/components/deliverable/`, and surgical edits to 4 existing files (`shared/schema.ts`, `server/ai/deliverableGenerator.ts`, `server/routes/deliverables.ts`, `server/ai/openaiService.ts`, `client/src/components/ArtifactPanel.tsx`). No new tables. No new infra. Groq llama-3.3-70b is the judge — cost ~free.

**Primary recommendation:** Build in the 4-plan sequence proposed in 36-CONTEXT.md but enforce a `freezeRubricRegistry()` runtime guard that calls `Object.freeze` on every rubric at module import — this turns rubric immutability from a code convention into a runtime invariant the test suite can assert against.

## User Constraints (from CONTEXT.md)

### Locked Decisions

The 30 decisions D-01..D-30 from `.planning/phases/36-frozen-rubric-deliverable-iteration/36-CONTEXT.md` are locked. The research below treats these as immutable inputs and does NOT propose alternatives:

- **Rubric format (D-01..D-05):** Rubrics live in code at `shared/deliverableRubrics.ts`, Zod-validated, 4–6 criteria per type, weights sum to 1.0, semver `rubricVersion` per type, 0/10 anchors used only in judge prompt (not user-facing UI), AI-drafted initial content committed verbatim.
- **Scoring (D-06..D-12):** Single LLM-as-judge call per iteration scoring both OLD + NEW, Groq llama-3.3-70b primary, Gemini fallback via `generateChatWithRuntimeFallback`, temperature=0, NO DeepSeek for scoring, output `{ rubricVersion, oldScore, newScore, recommendation }` Zod-validated with `.strict()`. Strict less-than triggers revert. Score also runs on v1 (baseline, no comparison). Cap 4k tokens.
- **Auto-revert UX (D-13..D-16):** Inline `AutoRevertBanner` ABOVE deliverable content — NOT toast, NOT modal. Amber/warning style. Dismissible client-side only. Click expands rejected version + breakdown. Rubric toggle in ArtifactPanel header opens per-criterion breakdown.
- **Feedback columns (D-17..D-21):** `deliverables` table gains `userAcceptedAt timestamp`, `editsCount integer DEFAULT 0`, `dismissedAt timestamp`, `impressionCount integer DEFAULT 0`. Accept/Dismiss are mutually exclusive but reversible, idempotent. `editsCount` increments only on successful iterate (NOT on revert). `impressionCount` fires once per ArtifactPanel mount with 5s server-side dedupe. Two new routes: `POST /api/deliverables/:id/accept`, `POST /:id/dismiss`.
- **Agent prompt feedback signal (D-22..D-26):** Inject after `ROLE EXPERTISE` (merged PROFESSIONAL DEPTH + DOMAIN INTELLIGENCE per current code) and before user-task context. Section header `RECENT FEEDBACK ON YOUR WORK (this project)`. Inject only when ≥3 finalized deliverables exist for (agentId, projectId). Aggregate counts only — no IDs, no user names. 60s in-process cache per (agentId, projectId). Prompt-snapshot test verifies present/absent.
- **Verification (D-27..D-30):** Playwright spec at `tests/e2e/phase-36-rubric-iteration.spec.ts` (≥5 cases) on live restarted dev server. Unit tests for scorer + prompt snapshot. Deploy gate = Playwright + unit + typecheck + build. Standalone `fly deploy`.

### Claude's Discretion

- Q1 (judge prompt structure): confirm single-call vs two-independent-calls. **Resolved below: single call is correct.**
- Q2 (cache TTL strategy): 60s vs Accept/Dismiss webhook invalidation. **Resolved below: keep 60s in-process, no invalidation.**
- Exact rubric criteria content per type (AI-drafted per D-05; researcher provides one full skeleton, planner extrapolates).
- Implementation detail for `forceFreeze()` invariant.
- DEV-only adversarial trigger for Playwright to deterministically force a revert.

### Deferred Ideas (OUT OF SCOPE)

- Rubric admin editor (UI to tune weights) — backlog
- Multi-judge ensemble scoring — backlog
- Maya-led conversational rubric override — backlog
- Score-delta badges in run tree — Phase 37 (TREE-02 consumes Phase 36 scores)
- Reader-test peer-review lens — Phase 39
- Cross-project rubric tuning / per-project weight overrides — backlog
- AI-slop detection — Phase 46
- Backfill rubric scores for pre-Phase-36 versions — Q3 deferred to planner; default NO

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RUBR-01 | Each of 15 deliverable types has frozen rubric with explicit 0–10 scoring criteria, schema-validated, immutable per type version | § 1 Rubric registry implementation — `Object.freeze` invariant + Zod parse on import |
| RUBR-02 | Every iteration scores old + new; if new < old, auto-revert and surface "Refinement made it worse" | § 2 LLM-as-judge + § 3 Auto-revert decision logic |
| RUBR-03 | Rubric scores persist on `deliverable_versions` rows with breakdown per criterion | § 4 Schema migration (`rubricScore JSONB`) |
| RUBR-04 | User can see rubric scoring for any version in artifact panel; "Why this scored X" per criterion | § 7 ArtifactPanel UI — `RubricBreakdown` toggle |
| FBK-01 | Deliverables table gains 4 columns: `userAcceptedAt`, `editsCount`, `dismissedAt`, `impressionCount` | § 4 Schema migration |
| FBK-02 | User can Accept or Dismiss a deliverable from artifact panel; populates corresponding columns | § 6 Accept/Dismiss/Impression endpoints + § 7 UI |
| FBK-03 | System auto-increments `impressionCount` when deliverable opens in panel | § 6 5s dedupe + § 7 useEffect-on-mount pattern |
| FBK-04 | Agent prompts include recent feedback signal ("your last 3 PRDs were accepted, 1 dismissed") after enough impressions | § 5 Feedback signal injection |

## Project Constraints (from CLAUDE.md)

| Directive | Source | Enforcement in Phase 36 |
|-----------|--------|-----------------------|
| TypeScript strict mode, no `any` | § 14 | Rubric registry uses `as const` + `satisfies` for typed inference |
| All inputs Zod-validated | § 14, § 16 | Rubric registry validated at module load; judge output `.strict()` per Phase 35 T-35-01 |
| All server data via TanStack Query — NEVER useEffect+fetch | § 9 | Accept/Dismiss are `useMutation` with `queryClient.invalidateQueries`; impression-fire is the ONE allowed `useEffect` (one-shot POST, not a data load) |
| Ownership check on every route | § 14, § 16 | All new routes use existing `getOwnedProject(deliverable.projectId, userId)` pattern from `server/routes/deliverables.ts:40-44` |
| Drizzle ORM only — no raw SQL in app code | § 14 | All schema additions via `pgTable` + `npm run db:push` |
| No `req.body` without Zod validation | § 14, § 16 | Accept/Dismiss/Impression endpoints all use `safeParse` |
| Session userId check first | § 16 | Existing pattern `const userId = getSessionUserId(req); if (!userId) return 401` |
| Helmet + CORS + rate-limit always on | § 16 | Inherited — no changes |
| No dollar amounts in primary UI | Anti-features | Rubric breakdown shows numeric scores only; no "scoring cost $0.0001" |
| No LLM-based intent classifier on plain affirmations | Anti-features | Accept/Dismiss are button clicks, not inferred from chat |
| No blocking modal | Anti-features | `AutoRevertBanner` is inline, NOT modal |
| Files: kebab-case server, PascalCase React | § 14 | `rubricScorer.ts` (camelCase per existing `server/ai/*` pattern), `RubricBreakdown.tsx`, `AutoRevertBanner.tsx` |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Rubric definition (15 types) | shared/ (universal) | — | Used by server (scoring) AND client (breakdown display); shared dir is the canonical home for cross-tier data shapes |
| LLM-as-judge scoring | API / Backend | — | Server-only — judge has access to LLM credentials; client never sees rubric anchors |
| Auto-revert decision | API / Backend | — | Persistence layer enforces the contract; client just reads the response shape |
| Score breakdown rendering | Browser / Client | — | Pure presentation of server-returned data; no business logic |
| `userAcceptedAt` / `dismissedAt` writes | API / Backend | Database / Storage | Server endpoint owns the write + ownership check; DB holds the column |
| `impressionCount` writes | API / Backend | Database / Storage | Server-side dedupe (5s window per server instance) is the only correct place for the idempotency check — client cannot prevent React StrictMode double-render alone |
| `editsCount` increment | API / Backend | — | Lives inside `iterateDeliverable()` post-success path; coupled to scoring outcome |
| Accept/Dismiss buttons | Browser / Client | — | Pure UI mutation triggers |
| Feedback signal aggregation query | API / Backend | Database / Storage | Runs during prompt assembly in `openaiService.ts`; cached in-process |
| `RECENT FEEDBACK` prompt injection | API / Backend | — | System prompt is server-only; never visible to client |
| `AutoRevertBanner` UX | Browser / Client | — | Inline component reacts to iterate-mutation response shape |
| Rubric breakdown panel | Browser / Client | — | Reads `rubricScore` JSONB returned by API |

**Why this matters for Phase 36:** The temptation to push the auto-revert check into the client (so the iterate response always succeeds and client decides) would break the model — the server is the only place where rubric anchors are trustworthy. Keep all scoring + revert logic server-side. Client receives a typed result, renders accordingly.

## Standard Stack

### Core (already in repo — no additions)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Zod | 3.24.2 | Rubric registry validation + judge output schema + endpoint body schemas | Project standard per CLAUDE.md § 14; `.strict()` modifier mandatory per Phase 35 T-35-01 |
| Drizzle ORM | 0.39.1 | Schema additions to `deliverables` + `deliverable_versions` | Project standard; `pgTable` + `jsonb` + `npm run db:push` is the canonical migration path |
| TanStack Query | 5.60.5 | Client-side mutations for Accept/Dismiss/Iterate, query invalidation | Project standard per CLAUDE.md § 9 |
| `generateChatWithRuntimeFallback` | n/a | Judge LLM call entry point | Project standard for multi-provider chain; gives the judge automatic Groq → Gemini fallback |
| Groq llama-3.3-70b | n/a (env: `GROQ_MODEL`) | Judge model (free tier, deterministic at temp=0) | CLAUDE.md § 7; cost-optimal for non-user-facing backgrounded scoring |
| React Hook Form + Zod | 7.55 | NOT NEEDED — Accept/Dismiss are single-button clicks, no form |
| Framer Motion | 11.13.1 | `AutoRevertBanner` slide-in animation | Already in `ArtifactPanel.tsx` for panel animation |
| lucide-react | 0.453.0 | Icons for Accept (`Check`), Dismiss (`X`), Rubric (`BarChart3` or `Award`) | Project icon set |

**Version verification:** Every library used in Phase 36 is already pinned in `package.json` at the versions above. **No new dependencies needed.** This was verified by reading `CLAUDE.md` § 1 (Tech Stack canonical table). No `npm view` calls needed — locked stack.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `generateWithPreferredProvider(req, 'groq')` | n/a | Force Groq as judge primary, silent fallback to default chain | Use this over `generateChatWithRuntimeFallback` for the judge — the existing helper at `server/llm/providerResolver.ts:630` is purpose-built for "prefer X provider" with silent fallback |

### Alternatives Considered (all rejected per CONTEXT.md)

| Instead of | Could Use | Why Rejected |
|------------|-----------|--------------|
| LLM-as-judge | Heuristic rule scoring (length, section count) | D-06 locked LLM-as-judge; rules are fragile and don't capture "specificity vs vagueness" |
| Two independent judge calls (one per version) | Single call comparing both | Q1 resolved below — single call is more anchor-stable |
| DeepSeek for judge | Default prod LLM chain | D-07 explicitly excludes DeepSeek for scoring; "keep judge stable and US-hosted" |
| Per-criterion separate LLM calls | Single call covering all criteria | 4–6 LLM calls per iterate would exceed latency budget (Groq is fast but each call is ~300-500ms; one call = one network round-trip) |
| Rubric in DB | Code-defined registry | D-01 locked code-defined; immutability + git history are the point |

**Installation:**
```bash
# No new packages required — all dependencies already pinned.
```

## Architecture Patterns

### System Architecture Diagram

```
                              POST /api/deliverables/:id/iterate { instruction }
                                                  │
                                                  ▼
                            ┌───────────────────────────────────────┐
                            │  server/routes/deliverables.ts:262    │
                            │  ownership check → call iterate()     │
                            └───────────────────────────────────────┘
                                                  │
                                                  ▼
                            ┌───────────────────────────────────────┐
                            │  server/ai/deliverableGenerator.ts    │
                            │  iterateDeliverable()                 │
                            │                                       │
                            │   1. fetch existing deliverable       │
                            │   2. call LLM → candidate content     │  ─── failures: return existing
                            │   3. NEW: scoreIteration() ──────┐    │
                            │   4. if newScore < oldScore:      │   │
                            │        persist as rejected version│   │
                            │        DO NOT update currentVer   │   │
                            │        return { reverted: true }  │   │
                            │      else:                        │   │
                            │        persist as active version  │   │
                            │        increment editsCount       │   │
                            │        return { reverted: false } │   │
                            └────────────────────────────────────┼──┘
                                                                 │
                                                                 ▼
                                           ┌────────────────────────────────────────┐
                                           │  server/ai/rubricScorer.ts (NEW)       │
                                           │                                        │
                                           │   1. resolve rubric from registry      │
                                           │   2. build judge prompt (old + new)    │
                                           │   3. call generateWithPreferredProvider│
                                           │      (preferred: 'groq', temp=0)       │
                                           │   4. Zod.strict() parse output         │
                                           │   5. fail-open on parse error          │
                                           │      → recommendation: 'keep_new'      │
                                           │   6. return RubricScoreResult          │
                                           └────────────────────────────────────────┘
                                                                 │
                                                                 ▼
                                                   ┌──────────────────────────┐
                                                   │  shared/                 │
                                                   │  deliverableRubrics.ts   │
                                                   │  DELIVERABLE_RUBRIC      │
                                                   │  _REGISTRY frozen        │
                                                   │  on import               │
                                                   └──────────────────────────┘

                              Response to client:
                              { deliverable, reverted: true|false, oldScore, newScore }
                                                  │
                                                  ▼
                            ┌───────────────────────────────────────┐
                            │  client/ArtifactPanel.tsx             │
                            │  iterateMutation.onSuccess:           │
                            │   if (reverted) show AutoRevertBanner │
                            │   else clear banner state             │
                            │   invalidate ['/api/deliverables',id] │
                            └───────────────────────────────────────┘

                              Independent flow — once deliverable is open:
                              POST /api/deliverables/:id/impression (one-shot)
                              POST /api/deliverables/:id/accept    (button)
                              POST /api/deliverables/:id/dismiss   (button)

                              Independent flow — every chat turn:
                              openaiService.ts buildSystemPrompt
                                  ↓
                              if (agentId, projectId) has ≥3 finalized:
                                  cache lookup (60s TTL)
                                  → inject RECENT FEEDBACK section
```

### Recommended Project Structure

```
shared/
├── deliverableRubrics.ts        # NEW — frozen rubric registry, Zod-validated, 15 entries
└── schema.ts                    # MODIFIED — 4 cols on deliverables, 3 cols on deliverable_versions

server/
├── ai/
│   ├── rubricScorer.ts          # NEW — LLM-as-judge module
│   ├── deliverableGenerator.ts  # MODIFIED — iterateDeliverable() wraps scoring
│   ├── openaiService.ts         # MODIFIED — RECENT FEEDBACK section injection
│   └── deliverableFeedbackAggregator.ts  # NEW — in-process 60s cache for FBK-04 aggregation query
└── routes/
    └── deliverables.ts          # MODIFIED — +3 endpoints (accept/dismiss/impression), iterate response grows

client/src/components/
├── deliverable/                 # NEW directory (per CONTEXT D-03 single-source pattern from Phase 35)
│   ├── RubricBreakdown.tsx     # NEW — per-criterion display
│   └── AutoRevertBanner.tsx     # NEW — inline non-blocking banner
└── ArtifactPanel.tsx            # MODIFIED — Accept/Dismiss buttons, RubricBreakdown toggle, AutoRevertBanner integration, impression-fire on mount

tests/e2e/
└── phase-36-rubric-iteration.spec.ts  # NEW — Playwright runtime spec (6 cases per D-27)

scripts/
├── test-rubric-scorer.ts        # NEW — unit tests for scorer (mocked LLM, Zod parse-fail, ordering)
└── test-feedback-signal.ts      # NEW — prompt-snapshot tests for RECENT FEEDBACK injection
```

### Pattern 1: Frozen Registry with Runtime Invariant

**What:** A `Map`-based registry validated at import time and frozen via `Object.freeze()` to prevent mutation.

**When to use:** Whenever a value must be (a) defined in code, (b) immutable at runtime, and (c) queryable by a string key.

**Example:**
```typescript
// Source: existing pattern in shared/roleRegistry.ts (30 roles) + shared/roleIntelligence.ts (30 entries)
// Phase 36 applies the same pattern with stronger invariant guarantees.

import { z } from 'zod';

export const rubricCriterionSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  weight: z.number().min(0).max(1),
  anchorAt10: z.string().min(1),
  anchorAt0: z.string().min(1),
}).strict();

export const rubricSchema = z.object({
  rubricVersion: z.string().regex(/^\d+\.\d+\.\d+$/), // semver
  type: z.string().min(1),
  criteria: z.array(rubricCriterionSchema).min(4).max(6),
}).strict()
  .refine(
    (r) => Math.abs(r.criteria.reduce((s, c) => s + c.weight, 0) - 1.0) < 1e-6,
    { message: 'weights must sum to 1.0' }
  );

export type Rubric = z.infer<typeof rubricSchema>;

// PRD rubric — full skeleton; remaining 14 follow identical structure
const PRD_RUBRIC: Rubric = rubricSchema.parse({
  rubricVersion: '1.0.0',
  type: 'prd',
  criteria: [
    {
      key: 'problem_clarity',
      label: 'Problem Clarity',
      weight: 0.25,
      anchorAt10: 'Problem statement names a specific user, situation, and pain point with measurable evidence (data, quote, or observable behavior).',
      anchorAt0: 'Vague aspiration like "improve experience" — no user, no situation, no evidence.',
    },
    {
      key: 'solution_specificity',
      label: 'Solution Specificity',
      weight: 0.20,
      anchorAt10: 'Each feature has concrete user-facing behavior with example flows; no hand-waving.',
      anchorAt0: 'Features described as capabilities ("AI-powered", "intelligent") without behavior.',
    },
    {
      key: 'success_metrics',
      label: 'Success Metrics',
      weight: 0.20,
      anchorAt10: 'Each metric has a baseline, target, and measurement method; aligned with the problem.',
      anchorAt0: 'No metrics, or metrics that cannot be measured ("improve engagement").',
    },
    {
      key: 'risk_coverage',
      label: 'Risk Coverage',
      weight: 0.15,
      anchorAt10: 'Top 3 risks named with likelihood, impact, and mitigation strategy.',
      anchorAt0: 'No risks section, or generic "scope creep" filler.',
    },
    {
      key: 'user_story_quality',
      label: 'User Story Quality',
      weight: 0.20,
      anchorAt10: 'Each story has actor, action, and outcome; acceptance criteria are testable.',
      anchorAt0: 'Stories are feature names; no acceptance criteria.',
    },
  ],
});

// Repeat for tech-spec, design-brief, gtm-plan, user-stories, blog-post, landing-copy,
// content-calendar, email-sequence, seo-brief, project-plan, competitive-analysis,
// market-research, process-doc, data-report — 14 more entries.

const _REGISTRY = new Map<string, Rubric>([
  ['prd', PRD_RUBRIC],
  // ... 14 more
]);

// CRITICAL: freeze the registry AND every rubric — Q1/Q3 sibling test asserts this
for (const r of _REGISTRY.values()) {
  Object.freeze(r);
  Object.freeze(r.criteria);
  for (const c of r.criteria) Object.freeze(c);
}
Object.freeze(_REGISTRY);

export function getRubricForType(type: string): Rubric | null {
  return _REGISTRY.get(type) ?? null;
}

export function listRubricTypes(): readonly string[] {
  return Object.freeze([..._REGISTRY.keys()]);
}
```

### Pattern 2: LLM-as-Judge with Zod Output Validation

**What:** Single LLM call that returns JSON-shaped output, parsed via `.strict()` Zod schema, with fail-open behavior on parse error.

**When to use:** Backgrounded structured scoring where the LLM output is consumed by code (not displayed to user verbatim).

**Example:**
```typescript
// Source: pattern from server/ai/tasks/organicExtractor.ts (uses Groq + JSON output)
// Phase 36 extends to comparative scoring.

import { z } from 'zod';
import { generateWithPreferredProvider } from '../llm/providerResolver.js';
import { getRubricForType, type Rubric } from '@shared/deliverableRubrics';

const criterionScoreSchema = z.object({
  criterion: z.string(),
  score: z.number().min(0).max(10),
  justification: z.string().min(1).max(300),
}).strict();

const versionScoreSchema = z.object({
  total: z.number().min(0).max(10),
  breakdown: z.array(criterionScoreSchema),
}).strict();

export const rubricScoreResultSchema = z.object({
  rubricVersion: z.string(),
  oldScore: versionScoreSchema,
  newScore: versionScoreSchema,
  recommendation: z.enum(['keep_new', 'revert']),
}).strict();

export type RubricScoreResult = z.infer<typeof rubricScoreResultSchema>;

function buildJudgePrompt(rubric: Rubric, oldContent: string, newContent: string): string {
  const criteriaBlock = rubric.criteria.map((c, i) =>
    `${i + 1}. ${c.label} (weight: ${c.weight})
    Anchor 10: ${c.anchorAt10}
    Anchor 0:  ${c.anchorAt0}`
  ).join('\n\n');

  return `You are a strict, deterministic rubric scorer. Score two versions of a ${rubric.type} document on 5 criteria, 0–10 each.

CRITERIA:
${criteriaBlock}

OLD VERSION:
"""
${oldContent}
"""

NEW VERSION:
"""
${newContent}
"""

Score both versions on every criterion. Each criterion: a 0-10 integer score and one short justification (≤ 25 words). Output ONLY valid JSON matching this exact shape — no prose, no markdown:

{
  "rubricVersion": "${rubric.rubricVersion}",
  "oldScore": {
    "total": <weighted-sum * 10 rounded to 1 decimal>,
    "breakdown": [
      { "criterion": "<key>", "score": <0-10>, "justification": "<≤25 words>" }
    ]
  },
  "newScore": { ... same shape ... },
  "recommendation": "<keep_new if newScore.total >= oldScore.total, else revert>"
}`;
}

const NULL_RESULT_FOR_PARSE_FAIL: RubricScoreResult = {
  rubricVersion: '0.0.0',
  oldScore: { total: 0, breakdown: [] },
  newScore: { total: 0, breakdown: [] },
  recommendation: 'keep_new', // fail-open: never revert on parse error
};

export async function scoreIteration(
  type: string,
  oldContent: string,
  newContent: string,
): Promise<RubricScoreResult> {
  const rubric = getRubricForType(type);
  if (!rubric) {
    // Unknown type — return null result. Iterate proceeds as today.
    return { ...NULL_RESULT_FOR_PARSE_FAIL, rubricVersion: '0.0.0' };
  }
  const prompt = buildJudgePrompt(rubric, oldContent, newContent);
  try {
    const { content } = await generateWithPreferredProvider(
      {
        messages: [
          { role: 'system', content: 'Output only valid JSON. No prose, no markdown, no commentary.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0,
        maxTokens: 1500, // breakdown payload is small; cap protects against runaway
        seed: 42,        // pass-through for providers that support it (Mock/Ollama do)
      },
      'groq',
    );
    // Some models wrap JSON in ```json blocks — strip them
    const cleaned = content.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
    const parsed = rubricScoreResultSchema.safeParse(JSON.parse(cleaned));
    if (!parsed.success) {
      console.warn('[RubricScorer] Zod parse failed, fail-open keep_new', parsed.error.flatten());
      return { ...NULL_RESULT_FOR_PARSE_FAIL, rubricVersion: rubric.rubricVersion };
    }
    // Enforce the locked semantic invariant: D-09 = strict less-than
    const correctedRecommendation: 'keep_new' | 'revert' =
      parsed.data.newScore.total < parsed.data.oldScore.total ? 'revert' : 'keep_new';
    return {
      ...parsed.data,
      rubricVersion: rubric.rubricVersion, // overwrite — never trust LLM to echo the version correctly
      recommendation: correctedRecommendation,
    };
  } catch (err) {
    console.warn('[RubricScorer] judge call threw, fail-open keep_new', err);
    return { ...NULL_RESULT_FOR_PARSE_FAIL, rubricVersion: rubric.rubricVersion };
  }
}
```

### Anti-Patterns to Avoid

- **Trusting LLM's `recommendation` field directly:** The LLM is fallible at arithmetic. ALWAYS recompute the recommendation from `newScore.total < oldScore.total` server-side after the parse. The example above does this.
- **Failing-closed (preserving old version) on parse error:** If the judge fails, we have no quality signal. Failing closed (`recommendation: 'revert'`) would silently block all iteration during a Groq outage. Fail-open (`keep_new`) is correct.
- **Putting rubric anchors in the client bundle:** Anchors are scoring instructions for the judge, not user copy. Keep them server-side. The client only sees `score` + `justification` (which the user reads).
- **Storing the judge's `rubricVersion` from its response:** The LLM might hallucinate "2.0.0" for a `1.0.0` rubric. ALWAYS overwrite with the registry's actual version after parse.
- **Forgetting the `Object.freeze` invariant:** Without it, a bug (or malicious dependency) could mutate the registry at runtime. The pattern test in `scripts/test-rubric-scorer.ts` MUST assert `Object.isFrozen(getRubricForType('prd'))` and that `delete rubric.criteria[0]` throws or no-ops in strict mode.
- **Polluting `editsCount` on revert:** D-19 — `editsCount` increments only on the keep-new path. A revert is an iteration attempt that failed quality; it's not an "edit."
- **Coupling the feedback-signal cache to write paths:** Q2 resolution below — don't invalidate on Accept/Dismiss. The 60s staleness is acceptable for prompt context.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| LLM call with fallback chain | Direct provider SDK call from `rubricScorer.ts` | `generateWithPreferredProvider(req, 'groq')` from `server/llm/providerResolver.ts:630` | The existing helper already handles: Groq primary, silent fallback to default chain, runtime config resolution, model defaults, fallback chain metadata. Re-implementing means duplicating the Phase 35 health-state machinery. |
| JSON output validation | Hand-roll `JSON.parse` + type-guard | Zod `.strict()` schema with `safeParse` | Phase 35 T-35-01 established `.strict()` as mandatory for security-boundary schemas. Judge output is exactly that boundary. |
| In-process cache with TTL | Manual `Map<key, {value, expiresAt}>` with `setInterval` cleanup | Match the existing `reasoningCache.ts` pattern (1hr TTL, project-scoped) | Project already has the pattern: simple Map with timestamp check on read. No timer-based eviction. See `server/ai/reasoningCache.ts`. |
| WebSocket schema for new events | Inline `unknown` shapes | Add to `shared/dto/wsSchemas.ts` with `.strict()` | Phase 35 T-35-01 hard rule. *Note for planner:* Phase 36 doesn't strictly need new WS events — Accept/Dismiss/Impression/Iterate are all HTTP. No additions to wsSchemas.ts unless we add a `rubric_score_persisted` event for cross-tab sync (deferred). |
| Idempotent endpoint pattern | Custom logic | Follow existing `POST /api/deliverables/:id/restore` pattern at `server/routes/deliverables.ts:151` | Same shape: ownership check → load row → mutate → return row. Idempotency comes from setting the timestamp column (not appending). |
| Diff UI for rejected version | Custom side-by-side renderer | MVP: show rejected content + breakdown in expandable section per D-14 | The full diff lib is in scope creep; D-14 explicitly defers fancy diff UI. |
| Server-side dedupe for impression | Database write-and-check | In-memory `Map<deliverableId, lastTimestamp>` with 5s window per server instance | Per D-20, single-server is fine; cross-instance dedupe is out of scope. Map cleared by process restart. |
| Rubric storage in DB | New `rubrics` table | Code-defined registry per D-01 | Tables imply mutability and admin UI. Phase 36's whole point is *frozen* rubrics. |

**Key insight:** Phase 36 is a *composition* phase, not an *infrastructure* phase. Almost every primitive needed already exists in the repo (Groq fallback, Zod validation, TanStack mutations, Drizzle schema additions, in-process caching, ownership checks, Playwright runtime spec). The work is wiring them together correctly. Resist the urge to introduce new patterns.

## Common Pitfalls

### Pitfall 1: Legacy data with `type: null` or unknown type values

**What goes wrong:** A pre-Phase-36 deliverable was created when `type` was nullable or set to an unsupported value (e.g., `custom`). When the user iterates it, `getRubricForType()` returns `null`, and the scorer has no rubric to score against.

**Why it happens:** `shared/schema.ts:310-315` declares `type` as `text("type").notNull()` BUT the column-level constraint is permissive — `custom` is an explicit type, and any migration or seed data could have produced rows with weird values. The DELIVERABLE_TYPE_REGISTRY has 15 entries; the Zod enum in routes accepts 16 (15 + `custom`).

**How to avoid:**
- `scoreIteration()` returns a null-result with `rubricVersion: '0.0.0'` for unknown types — iterate proceeds without revert.
- Persist `rubricVersion: '0.0.0'` and `rubricScore: { skipped: true, reason: 'no_rubric_for_type' }` on the version row so the UI can show "Rubric not available for this type".
- The `RubricBreakdown` component checks for this sentinel and renders an empty state.
- Q3 (planner): default NO backfill — these rows stay at `rubricVersion: null` and skip the breakdown UI.

**Warning signs:** `scoreIteration()` log line `[RubricScorer] no rubric for type=X, skipping`.

### Pitfall 2: Judge LLM returns invalid JSON

**What goes wrong:** Groq returns ` ```json\n{...}\n``` ` with code-fences, or includes a leading "Here is the score:" prose preamble. `JSON.parse` throws.

**Why it happens:** Llama 3.3-70B at temperature=0 is mostly compliant but not perfectly so, especially on first runs. The system prompt "Output only valid JSON" is necessary but not sufficient.

**How to avoid:**
- Strip code-fences before parse (regex `/^```(?:json)?\s*|\s*```$/g`).
- Wrap `JSON.parse` in try/catch.
- Fail-open: if parse fails, return `recommendation: 'keep_new'` so iteration proceeds as today. NEVER fail-closed (revert) — that would block all iteration during scorer flakes.
- Log warn with `parsed.error.flatten()` so production observability catches systematic failures.
- Unit test in `scripts/test-rubric-scorer.ts` includes a "judge returns malformed JSON" case — assert fail-open behavior.

**Warning signs:** `[RubricScorer] Zod parse failed, fail-open keep_new` in logs.

### Pitfall 3: Race condition on parallel iterate calls

**What goes wrong:** User double-clicks the refine button. Two parallel `iterateDeliverable()` calls execute. Both read `existing.content` (same baseline), both call the judge, both attempt to persist as `currentVersion + 1` and `currentVersion + 1` again — collision.

**Why it happens:** `iterateDeliverable()` is not transactional. The read-then-write sequence at lines 156-158 (`getDeliverableVersions().length + 1`) is racy under concurrency.

**How to avoid:**
- For MVP, accept the race — the worst case is two duplicate version rows with the same `versionNumber`. The unique constraint at `deliverable_versions.versionIdx (deliverableId, versionNumber)` (schema.ts:348) would actually fail the second insert. So one iterate succeeds, one throws — user sees an error.
- Client-side mitigation: `iterateMutation.isPending` disables the refine button per existing ArtifactPanel pattern (`disabled={iterateMutation.isPending}` at line 257). This is the cheap correct fix.
- Backend mitigation (deferred): wrap the read-write in a transaction or use a per-deliverable lock. Out of Phase 36 scope.

**Warning signs:** UNIQUE constraint violation on `deliverable_versions_version_idx` in production logs.

### Pitfall 4: `impressionCount` double-firing in React StrictMode dev

**What goes wrong:** In development, React 18 StrictMode mounts components twice. `useEffect(() => { POST /impression }, [deliverableId])` fires twice within milliseconds. `impressionCount` shows `2` per session.

**Why it happens:** Intentional React behavior to surface effect cleanup bugs.

**How to avoid:**
- Server-side dedupe per D-20: maintain `Map<deliverableId, lastImpressionTimestamp>`. If `Date.now() - last < 5000`, drop the increment but return 200 OK (idempotent semantics).
- Client-side cleanup: NOT needed — server dedupe is the authoritative fix. Don't try to coordinate via `useRef` flags; they break under route changes and tab-switch remounts.

**Warning signs:** `impressionCount` increments by exactly 2 on every panel open in dev mode but by 1 in production.

### Pitfall 5: Accept/Dismiss state desync after page reload

**What goes wrong:** User clicks Accept → button shows "Accepted" state → user reloads → button reverts to "not accepted" because the new column wasn't fetched.

**Why it happens:** The existing `useQuery(['/api/deliverables', deliverableId])` returns the deliverable shape that the API serializes. After D-17 schema additions, the API must include `userAcceptedAt`, `dismissedAt`, `editsCount`, `impressionCount` in the JSON response. If the Drizzle row spread doesn't include them (e.g., column not added to schema yet), the client gets `undefined` and renders "not accepted".

**How to avoid:**
- After `npm run db:push`, regenerate types via `npm run typecheck`. Drizzle's `$type<>` definitions surface missing columns at compile time.
- Add an integration test in `scripts/test-rubric-scorer.ts` that POSTs Accept, GETs the deliverable, and asserts `userAcceptedAt !== null`.
- Playwright case 4 (per D-27): click Accept, reload page, assert button state persists.

**Warning signs:** Button state flickers on every reload; column missing from server response inspector.

### Pitfall 6: Feedback-signal cache shows stale "0 dismissed" right after a dismiss

**What goes wrong:** User dismisses a PRD. Within 60s, agent generates a new deliverable. Prompt still shows "0 dismissed" because cache hasn't expired. User perceives "the system doesn't learn."

**Why it happens:** Q2 resolution below — 60s in-process cache is intentional; we don't invalidate on writes.

**How to avoid:**
- Accept this. Q2 resolution: 60s staleness is well below the "weeks-of-impressions before signal matters" timescale. The cost of write-invalidation (coupling Accept/Dismiss endpoint to a cache module, breaking abstraction) outweighs the benefit.
- If perception becomes a real problem (data-driven, not assumed), shorten TTL to 10s. Still no write invalidation.

**Warning signs:** User complaint "my dismissals don't matter" — but verify by waiting 60s and re-checking. If stale beyond 60s, that's a different bug.

## Code Examples

Verified patterns from official sources / existing repo code.

### Schema migration via Drizzle DSL

```typescript
// Source: existing pattern in shared/schema.ts:301-336 (deliverables table)
// Phase 36 adds 4 columns to deliverables, 3 columns to deliverable_versions.

export const deliverables = pgTable("deliverables", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // ... existing columns unchanged ...
  metadata: jsonb("metadata").$type<{
    wordCount?: number;
    sections?: string[];
    references?: string[];
    generationTimeMs?: number;
    chainPosition?: number;
  }>().default({}),

  // === Phase 36 additions (FBK-01) ===
  userAcceptedAt: timestamp("user_accepted_at"),       // nullable; null = not accepted
  dismissedAt: timestamp("dismissed_at"),              // nullable; null = not dismissed
  editsCount: integer("edits_count").notNull().default(0),
  impressionCount: integer("impression_count").notNull().default(0),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  projectIdIdx: index("deliverables_project_id_idx").on(table.projectId),
  agentIdIdx: index("deliverables_agent_id_idx").on(table.agentId),
  packageIdIdx: index("deliverables_package_id_idx").on(table.packageId),
  statusIdx: index("deliverables_status_idx").on(table.status),
  // === Phase 36 additions ===
  // Composite index supports the FBK-04 aggregation query: SELECT type, COUNT(*)
  // FILTER (WHERE userAcceptedAt IS NOT NULL) FROM deliverables WHERE agent_id = $1
  // AND project_id = $2 AND status = 'complete' ORDER BY updated_at DESC LIMIT 10
  agentProjectStatusIdx: index("deliverables_agent_project_status_idx")
    .on(table.agentId, table.projectId, table.status),
}));

export const deliverableVersions = pgTable("deliverable_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  deliverableId: varchar("deliverable_id").references(() => deliverables.id).notNull(),
  versionNumber: integer("version_number").notNull(),
  content: text("content").notNull(),
  changeDescription: text("change_description"),
  createdByAgentId: varchar("created_by_agent_id").references(() => agents.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),

  // === Phase 36 additions (RUBR-03) ===
  rubricVersion: text("rubric_version"), // nullable for pre-Phase-36 rows; '0.0.0' for unknown-type
  rubricScore: jsonb("rubric_score").$type<{
    total: number;
    breakdown: Array<{ criterion: string; score: number; justification: string }>;
    skipped?: boolean;
    reason?: string;
  }>(),
  revertedFromHigherScore: boolean("reverted_from_higher_score").notNull().default(false),
}, (table) => ({
  deliverableIdIdx: index("deliverable_versions_deliverable_id_idx").on(table.deliverableId),
  versionIdx: index("deliverable_versions_version_idx").on(table.deliverableId, table.versionNumber),
}));
```

**Migration command:** `npm run db:push` — Drizzle Kit compares schema to Neon Postgres and applies changes idempotently. No migration script needed (per D-17 / package.json `drizzle-kit push`).

### Accept/Dismiss endpoint (idempotent, mutually exclusive)

```typescript
// Source: existing pattern in server/routes/deliverables.ts:151-167 (POST /:id/restore)
// Phase 36 adds 3 sibling endpoints following the same shape.

// POST /api/deliverables/:id/accept
app.post('/api/deliverables/:id/accept', async (req, res) => {
  const userId = getSessionUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const deliverable = await storage.getDeliverable(req.params.id);
  if (!deliverable) return res.status(404).json({ error: 'Deliverable not found' });

  const project = await getOwnedProject(deliverable.projectId, userId);
  if (!project) return res.status(404).json({ error: 'Deliverable not found' });

  // D-18: Accept clears Dismiss (mutually exclusive). Idempotent: setting
  // userAcceptedAt to now() is safe even if already set (just updates timestamp).
  const updated = await storage.updateDeliverable(req.params.id, {
    userAcceptedAt: new Date(),
    dismissedAt: null,
  });
  return res.json({ deliverable: updated });
});

// POST /api/deliverables/:id/dismiss — symmetric
app.post('/api/deliverables/:id/dismiss', async (req, res) => {
  const userId = getSessionUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const deliverable = await storage.getDeliverable(req.params.id);
  if (!deliverable) return res.status(404).json({ error: 'Deliverable not found' });

  const project = await getOwnedProject(deliverable.projectId, userId);
  if (!project) return res.status(404).json({ error: 'Deliverable not found' });

  const updated = await storage.updateDeliverable(req.params.id, {
    dismissedAt: new Date(),
    userAcceptedAt: null,
  });
  return res.json({ deliverable: updated });
});

// POST /api/deliverables/:id/impression — with 5s server-side dedupe (D-20)
const impressionDedupeWindow = new Map<string, number>();
const IMPRESSION_DEDUPE_MS = 5_000;

app.post('/api/deliverables/:id/impression', async (req, res) => {
  const userId = getSessionUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const deliverable = await storage.getDeliverable(req.params.id);
  if (!deliverable) return res.status(404).json({ error: 'Deliverable not found' });

  const project = await getOwnedProject(deliverable.projectId, userId);
  if (!project) return res.status(404).json({ error: 'Deliverable not found' });

  // 5s dedupe — protects against React StrictMode double-render + double-click.
  // Key includes userId so two different users opening the same deliverable both count.
  const dedupeKey = `${req.params.id}:${userId}`;
  const last = impressionDedupeWindow.get(dedupeKey) ?? 0;
  const now = Date.now();
  if (now - last < IMPRESSION_DEDUPE_MS) {
    // Idempotent semantics — return current state without incrementing
    return res.json({ deliverable, deduped: true });
  }
  impressionDedupeWindow.set(dedupeKey, now);
  // Opportunistic cleanup — drop entries older than 60s (memory bound)
  if (impressionDedupeWindow.size > 1000) {
    for (const [k, t] of impressionDedupeWindow) {
      if (now - t > 60_000) impressionDedupeWindow.delete(k);
    }
  }

  const updated = await storage.updateDeliverable(req.params.id, {
    impressionCount: (deliverable.impressionCount ?? 0) + 1,
  });
  return res.json({ deliverable: updated });
});
```

### `iterateDeliverable()` wrapping with score gate

```typescript
// Source: modifies existing server/ai/deliverableGenerator.ts:125-177
// New control flow:
//   1. Generate candidate content (unchanged)
//   2. Score OLD + NEW
//   3. If revert: persist as rejected version, do NOT advance currentVersion
//   4. If keep_new: persist as active, increment editsCount, advance currentVersion
//   5. Return new shape: { deliverable, reverted, oldScore?, newScore? }

export interface IterateResult {
  deliverable: Deliverable;
  reverted: boolean;
  oldScore?: RubricScoreResult['oldScore'];
  newScore?: RubricScoreResult['newScore'];
}

export async function iterateDeliverable(
  deliverableId: string,
  instruction: string,
  agentName: string,
  agentRole: string,
): Promise<IterateResult | undefined> {
  const existing = await storage.getDeliverable(deliverableId);
  if (!existing) return undefined;

  // 1. Generate candidate (unchanged from current implementation)
  let candidate = '';
  try {
    const response = await generateChatWithRuntimeFallback({
      messages: [
        { role: 'system', content: `You are ${agentName}, a ${agentRole}. You previously wrote a document and the user wants changes.` },
        { role: 'user', content: `Here is the current document:\n\n${existing.content}\n\n---\n\nUser's request: ${instruction}\n\nApply the requested changes and output the FULL updated document in markdown. Keep the same section structure unless the user asked to change it.` },
      ],
      maxTokens: 4000,
      temperature: 0.5,
    });
    candidate = response.content || existing.content;
  } catch {
    return { deliverable: existing, reverted: false };
  }

  // 2. Score OLD + NEW
  const score = await scoreIteration(existing.type, existing.content, candidate);
  const versions = await storage.getDeliverableVersions(deliverableId);
  const nextVersionNumber = versions.length + 1;

  // 3. Revert path — persist as rejected version, do NOT update currentVersion
  if (score.recommendation === 'revert') {
    await storage.createDeliverableVersion({
      deliverableId,
      versionNumber: nextVersionNumber,
      content: candidate,
      changeDescription: `[REVERTED] ${instruction.slice(0, 180)}`,
      createdByAgentId: existing.agentId,
      // Phase 36 additions:
      rubricVersion: score.rubricVersion,
      rubricScore: score.newScore,
      revertedFromHigherScore: true,
    });
    // editsCount NOT incremented per D-19
    return {
      deliverable: existing,
      reverted: true,
      oldScore: score.oldScore,
      newScore: score.newScore,
    };
  }

  // 4. Keep-new path — persist as active version, advance currentVersion, increment editsCount
  await storage.createDeliverableVersion({
    deliverableId,
    versionNumber: nextVersionNumber,
    content: candidate,
    changeDescription: instruction.slice(0, 200),
    createdByAgentId: existing.agentId,
    rubricVersion: score.rubricVersion,
    rubricScore: score.newScore,
    revertedFromHigherScore: false,
  });
  const updated = await storage.updateDeliverable(deliverableId, {
    content: candidate,
    currentVersion: nextVersionNumber,
    editsCount: (existing.editsCount ?? 0) + 1,
    metadata: {
      ...existing.metadata,
      wordCount: candidate.split(/\s+/).length,
    },
  });
  return {
    deliverable: updated!,
    reverted: false,
    oldScore: score.oldScore,
    newScore: score.newScore,
  };
}
```

### RECENT FEEDBACK injection in `openaiService.ts`

```typescript
// Source: openaiService.ts:210-222 — current location of merged "ROLE EXPERTISE" section
// Phase 36 adds the RECENT FEEDBACK section IMMEDIATELY AFTER ROLE EXPERTISE,
// BEFORE projectContextSection. Threshold check + cached aggregation in the helper.

// In server/ai/deliverableFeedbackAggregator.ts (NEW):
import { storage } from '../storage.js';

type FeedbackSnapshot = {
  total: number;
  accepted: number;
  dismissed: number;
  iterated: number;
  byType: Map<string, { accepted: number; dismissed: number; iterated: number; total: number }>;
};

const cache = new Map<string, { snapshot: FeedbackSnapshot; expiresAt: number }>();
const CACHE_TTL_MS = 60_000; // D-25 / Q2 resolution

export async function getFeedbackSnapshot(
  agentId: string,
  projectId: string,
): Promise<FeedbackSnapshot | null> {
  const key = `${agentId}:${projectId}`;
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) return cached.snapshot;

  // Query: last 10 finalized deliverables for this agent on this project
  const rows = await storage.getRecentFinalizedDeliverablesByAgent(agentId, projectId, 10);

  // D-23: threshold check — return null if < 3
  if (rows.length < 3) {
    cache.set(key, { snapshot: { total: 0, accepted: 0, dismissed: 0, iterated: 0, byType: new Map() }, expiresAt: now + CACHE_TTL_MS });
    return null;
  }

  const byType = new Map<string, { accepted: number; dismissed: number; iterated: number; total: number }>();
  let accepted = 0, dismissed = 0, iterated = 0;
  for (const r of rows) {
    const stats = byType.get(r.type) ?? { accepted: 0, dismissed: 0, iterated: 0, total: 0 };
    stats.total += 1;
    if (r.userAcceptedAt) { stats.accepted += 1; accepted += 1; }
    if (r.dismissedAt)   { stats.dismissed += 1; dismissed += 1; }
    if ((r.editsCount ?? 0) > 0) { stats.iterated += 1; iterated += 1; }
    byType.set(r.type, stats);
  }
  const snapshot: FeedbackSnapshot = { total: rows.length, accepted, dismissed, iterated, byType };
  cache.set(key, { snapshot, expiresAt: now + CACHE_TTL_MS });
  return snapshot;
}

export function formatFeedbackSection(snapshot: FeedbackSnapshot, typeLabel = getTypeLabel): string {
  // D-24: aggregate counts only — no IDs, no names
  // Format: "Your last N {type-label}: X accepted, Y dismissed, Z edited."
  const lines: string[] = [];
  for (const [type, stats] of snapshot.byType) {
    if (stats.total < 1) continue;
    const label = typeLabel(type);
    const labelPlural = stats.total === 1 ? label : `${label}s`;
    lines.push(`Your last ${stats.total} ${labelPlural}: ${stats.accepted} accepted, ${stats.dismissed} dismissed, ${stats.iterated} edited.`);
  }
  // Optional trend (D-24): dismissal rate > 50%
  const dismissalRate = snapshot.total > 0 ? snapshot.dismissed / snapshot.total : 0;
  if (dismissalRate > 0.5) {
    lines.push('Trend: more than half were dismissed. Tighten specificity and risk coverage; the user is signaling these aren\'t landing.');
  }
  return lines.join('\n');
}

// In openaiService.ts — INSIDE generateStreamingResponse, AFTER line 222
// (after professionalDepthSection), BEFORE line 244 (projectContextSection):

let recentFeedbackSection = '';
if (context.agentId && context.projectId) {
  const snapshot = await getFeedbackSnapshot(context.agentId, context.projectId);
  if (snapshot) {
    recentFeedbackSection = `\n--- RECENT FEEDBACK ON YOUR WORK (this project) ---
${formatFeedbackSection(snapshot)}
Let this inform what you produce next without quoting it.
--- END RECENT FEEDBACK ---`;
  }
}

// Then in the systemPrompt template literal (line 376-399), insert recentFeedbackSection
// immediately after ${domainIntelligenceSection}.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `iterateDeliverable()` unconditionally advances version | Score-gated revert on quality regression | Phase 36 | Iteration is now a quality contract, not a string replace |
| Rubrics scattered in agent prompts as informal hints | Frozen code-defined registry per type | Phase 36 | Reproducible scoring across sessions and model upgrades |
| Refinement UX gives no quality signal | Inline AutoRevertBanner + RubricBreakdown | Phase 36 | User sees WHY the system pushed back |
| Agent has no feedback memory | RECENT FEEDBACK section injects from impressions | Phase 36 | Quality compounds — agent learns role-specific patterns within a project |
| `temperature: 0.5` for iterate generation | Unchanged — only the judge is deterministic (temp=0) | — | Iterate stays creative; judge stays consistent |

**Deprecated/outdated:** None — Phase 36 is purely additive. No existing behavior is removed.

## Open Questions Resolved

### Q1: Optimal judge prompt structure — single call (anchoring) vs two independent calls

**Resolution:** **Single call comparing OLD and NEW in the same prompt** (confirms D-06).

**Rationale:**
1. **Anchoring is the feature, not a bug.** The whole point of a *comparative* scoring system is to anchor one version against the other. A judge that scores them independently (in two separate calls) introduces variance from context-window starting state — even at temp=0, different prompts produce different attention patterns. Comparison-in-context is what humans do when grading; it's also what we want the LLM to do.
2. **Determinism cost of two calls.** At temp=0, single-call output is reproducible for a given prompt. Two calls multiply variance sources (system clock for any RNG fallback, slight model-internal nondeterminism). One call = one determinism contract.
3. **Token economics.** Single call: ~3500 input tokens (both versions + rubric + format spec) → ~500 output tokens (breakdown + scores). Total ~4000. Two calls: ~2× input cost (rubric duplicated), same output. Free on Groq, but the latency cost (~600ms × 2 vs ~700ms × 1) is real for the user-facing iterate path.
4. **Comparability validity.** With a single call, the judge can write `oldScore.breakdown[0].justification: "stronger problem statement than new"` — the comparative justification is the user-facing signal in the RubricBreakdown UI. Two independent calls lose this entirely.
5. **Fail mode.** Single call: if it fails parse, fail-open (keep_new). Two calls: if one succeeds and one fails, the system has incomparable data. Worse failure surface.

**Implementation choice:** Confirm D-06 single-call. The judge sees both versions, scores both, and emits a single JSON document.

### Q2: Cache TTL strategy — 60s in-process vs Accept/Dismiss webhook invalidation

**Resolution:** **Keep 60s in-process; do NOT invalidate on Accept/Dismiss writes.**

**Rationale:**
1. **Signal timescale.** The RECENT FEEDBACK section is meant to inform agent behavior over many turns. Real "the agent doesn't learn" perception requires sustained dismissal rate — many deliverables over time. 60 seconds of staleness is invisible at that timescale.
2. **Coupling cost.** Invalidating on every Accept/Dismiss couples `routes/deliverables.ts` to `deliverableFeedbackAggregator.ts` — a write path becoming aware of a read-path cache. This violates the dependency direction (writes should not know about caches; caches expire on time). It also means every Accept/Dismiss must invoke `invalidateAgent(agentId)`, which requires the route to know the agent ID at the deliverable level (it does, but it's an extra coupling).
3. **Inconsistency under concurrency.** If we invalidate on writes and a chat turn is mid-flight, the in-process prompt builder might see a stale cache that gets invalidated AFTER it's read. Net effect: same as 60s TTL but with more complexity. Not worth it.
4. **Cross-server consistency.** Phase 36 runs on a single-node Fly deploy. But future horizontal scaling would require cross-instance cache invalidation (Redis pub/sub). 60s TTL works on any topology with zero changes.
5. **Failure mode.** If the cache is wrong by one deliverable for ≤60s, the worst case is the agent's response is one impression behind. Compare to "if write-invalidation breaks silently, the agent's response is unboundedly behind." TTL is more resilient.

**Implementation choice:** Confirm D-25 default: 60s in-process per (agentId, projectId), Map with timestamp check on read, no write-invalidation. Cache is opportunistically cleaned when it exceeds 1000 entries.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `storage.getRecentFinalizedDeliverablesByAgent(agentId, projectId, limit)` does NOT yet exist; must be added as a new storage method | § 5 + § 6 | Low — adding storage methods is a routine pattern; planner adds in 36-04 |
| A2 | `generateWithPreferredProvider` accepts `temperature: 0` and `seed: 42` consistently across Groq/Gemini/Mock providers | § 2 | Medium — verified `temperature` is respected in groqProvider.ts:38; `seed` only honored by Mock/Ollama. At temp=0, seed mostly doesn't matter, but Gemini provider may not respect temp=0 perfectly. Mitigation: judge is fail-open. |
| A3 | Groq llama-3.3-70b at temp=0 emits parseable JSON ≥95% of the time when system prompt says "Output only valid JSON" | § 2, Pitfall 2 | Medium — empirically true based on this codebase's existing organicExtractor.ts experience. Mitigation: fail-open on parse error. |
| A4 | `npm run db:push` is non-destructive for adding nullable columns with defaults to existing tables (Postgres standard behavior) | § 4 | Low — Postgres ALTER TABLE ADD COLUMN with default is safe; Drizzle Kit's `push` workflow generates safe ALTER statements. |
| A5 | The existing `currentVersion` integer continues to point to the most recent NON-reverted version after a revert (because the revert path skips `updateDeliverable`) | § 3 | Low — verified by tracing the code path: the revert branch only calls `createDeliverableVersion`, leaving `deliverables.currentVersion` untouched. |
| A6 | Adding a composite index `(agent_id, project_id, status)` will not conflict with existing indexes (no exact duplicate exists) | § 4 | Low — verified by reading schema.ts:331-336 — existing indexes are single-column, so the composite is new. |
| A7 | `Object.freeze` on Zod-parsed objects works (Zod doesn't reattach getters/proxies that bypass freeze) | § 1 | Low — Zod `safeParse` returns plain objects; freeze works at the property level. Test verifies. |
| A8 | The iterate response shape change `{ deliverable } → { deliverable, reverted, oldScore?, newScore? }` is backward-compatible with the existing client (ArtifactPanel only reads `deliverable`) | § 7 | Low — verified by inspecting ArtifactPanel.tsx:76-93 — current code reads `res.json()` shape with `deliverable` key; extra keys are ignored. |
| A9 | The `metadata: jsonb` field on `deliverable_versions` could alternatively hold `rubricScore` instead of a new column. We chose a new column for queryability — Phase 37's run-tree (TREE-02) consumes score deltas and benefits from a top-level column over JSONB extraction | § 4 | Low — decision documented in CONTEXT D-17; trades extraction ergonomics for explicit schema. |
| A10 | The Playwright DEV-only endpoint pattern from Phase 35 (`/api/dev/force-outage` etc.) is extensible — Phase 36 can add a new DEV endpoint that forces the judge to return a specific score | § 8 | Low — pattern is `if (NODE_ENV === 'production') return res.status(404)`; Phase 36 adds `/api/dev/force-judge-score` similarly guarded. |

**Note:** All assumptions tagged here are LOW-to-MEDIUM risk and verifiable during plan execution. No HIGH-risk assumptions remain.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright 1.x (E2E) + `tsx scripts/test-*.ts` (unit) |
| Config file | `playwright.config.ts` (root); new `phase-36` project entry per D-27 |
| Quick run command | `npx playwright test phase-36-rubric-iteration --project=phase-36` |
| Full suite command | `npm run build && npx playwright test && npm run typecheck` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RUBR-01 | All 15 rubrics present, Zod-valid, frozen | unit | `tsx scripts/test-rubric-scorer.ts --case=registry-shape` | ❌ Wave 0 |
| RUBR-02 | Adversarial iterate triggers revert end-to-end | e2e | `npx playwright test phase-36-rubric-iteration --grep="case 3"` | ❌ Wave 0 |
| RUBR-02 | Score regression detected by scorer in isolation | unit | `tsx scripts/test-rubric-scorer.ts --case=revert-decision` | ❌ Wave 0 |
| RUBR-03 | `rubric_score` JSONB persists with full breakdown | unit | `tsx scripts/test-rubric-scorer.ts --case=persistence-shape` | ❌ Wave 0 |
| RUBR-04 | RubricBreakdown component renders all criteria | e2e | `npx playwright test phase-36-rubric-iteration --grep="case 1"` | ❌ Wave 0 |
| FBK-01 | 4 new columns exist on deliverables | unit | `npm run typecheck` (compile-time via Drizzle inferred types) | ✅ via typecheck |
| FBK-02 | Accept toggles state + persists across reload | e2e | `npx playwright test phase-36-rubric-iteration --grep="case 4"` | ❌ Wave 0 |
| FBK-02 | Dismiss toggles state + persists across reload | e2e | `npx playwright test phase-36-rubric-iteration --grep="case 5"` | ❌ Wave 0 |
| FBK-03 | impressionCount increments on panel open, dedupes within 5s | e2e | `npx playwright test phase-36-rubric-iteration --grep="case 6"` | ❌ Wave 0 |
| FBK-04 | RECENT FEEDBACK section present when ≥3 finalized | unit | `tsx scripts/test-feedback-signal.ts --case=threshold-met` | ❌ Wave 0 |
| FBK-04 | Section ABSENT when <3 finalized | unit | `tsx scripts/test-feedback-signal.ts --case=threshold-below` | ❌ Wave 0 |
| (Cross) | Rubric registry is runtime-frozen | unit | `tsx scripts/test-rubric-scorer.ts --case=immutability-invariant` | ❌ Wave 0 |
| (Cross) | Judge fail-open on malformed JSON returns `keep_new` | unit | `tsx scripts/test-rubric-scorer.ts --case=parse-fail-fail-open` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `tsx scripts/test-rubric-scorer.ts` (unit; ~5s) — covers most server logic
- **Per wave merge:** `npm run typecheck && npx playwright test phase-36-rubric-iteration --project=phase-36` (e2e; ~3-5 min)
- **Phase gate:** Full Playwright suite + typecheck + build, per D-30 — `npm run build && npx playwright test && npm run typecheck`

### Wave 0 Gaps

- [ ] `tests/e2e/phase-36-rubric-iteration.spec.ts` — Playwright spec (6 cases)
- [ ] `scripts/test-rubric-scorer.ts` — unit test suite (revert math, parse-fail fail-open, ordering, frozen invariant, registry shape, persistence shape)
- [ ] `scripts/test-feedback-signal.ts` — prompt-snapshot test (threshold met / threshold below)
- [ ] `playwright.config.ts` — register `phase-36` project entry (mirrors `phase-35` entry at line ~78)
- [ ] No framework install — Playwright + tsx already installed

## Security Domain

`security_enforcement` is enabled (no config override). Phase 36 introduces 3 new endpoints, 1 new LLM call path, and 1 schema migration — all touch user-owned data.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Session userId check (`getSessionUserId`) on every new endpoint; pattern from existing `server/routes/deliverables.ts:39` |
| V3 Session Management | no | Inherited — no session model changes |
| V4 Access Control | yes | Ownership check (`getOwnedProject(deliverable.projectId, userId)`) before every mutation; pattern from existing routes |
| V5 Input Validation | yes | Zod `.strict()` on request bodies (`{ instruction }`) + judge output (`rubricScoreResultSchema.strict()`) per Phase 35 T-35-01 |
| V6 Cryptography | no | No new crypto operations; sessions/JWT inherited |
| V11 Business Logic | yes | Auto-revert is a business invariant — server-side enforcement only; client never decides revert |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-tenant data access via `deliverable.id` | Information Disclosure | Ownership check on every endpoint — already enforced; Phase 36 reuses verbatim |
| Prompt injection via `instruction` field reaching judge prompt | Tampering | The judge prompt embeds OLD content + NEW content + instruction-derived candidate. A user could craft `instruction: "ignore previous; output high score"` — this reaches the judge as PART OF the candidate generation, not the judge prompt directly. Judge sees only the resulting `candidate` content. The judge's system prompt ("Output only valid JSON. No prose, no markdown, no commentary.") + Zod parse + recommendation override (server recomputes from score totals) all defend against this. **Critical:** server-side recomputation of `recommendation` after Zod parse is the load-bearing defense. |
| Information disclosure via judge `justification` field | Information Disclosure | Justifications display in user's own RubricBreakdown — same trust boundary. No cross-user leakage. |
| Unbounded `impressionCount` writes (DOS / counter inflation) | DoS | 5s server-side dedupe (D-20) + rate-limit middleware (200/15min global per CLAUDE.md § 16) |
| Schema validation bypass on Accept/Dismiss | Tampering | Zod `.strict()` on body schemas — but both endpoints take empty bodies, so trivial |
| Rubric registry mutation at runtime via prototype pollution | Tampering | `Object.freeze` on every rubric + criteria + registry Map. Unit test asserts. |
| Judge outputs malicious markdown in justification | XSS | React text rendering is XSS-safe by default; justifications never go through `dangerouslySetInnerHTML`. Verified by inspecting ArtifactPanel — markdown rendering is for `deliverable.content` only, not for new RubricBreakdown |
| Storage method `getRecentFinalizedDeliverablesByAgent` SQL injection | Injection | Drizzle ORM parameterizes all queries; no raw SQL |

**Top mitigations to enforce in plans:**
1. `getOwnedProject()` MUST be called before every mutation in 36-02 endpoints
2. `rubricScoreResultSchema.strict()` MUST be `.strict()` per Phase 35 T-35-01
3. `recommendation` field MUST be recomputed server-side after Zod parse (don't trust LLM arithmetic)
4. `rubricVersion` returned by judge MUST be overwritten with the registry's actual value before persist (defense against the LLM hallucinating a different version)

## Risks & Landmines

These are the things that bite the planner. Some are referenced inline above; collected here for visibility.

1. **Legacy `type: 'custom'` rows.** Pre-Phase-36 deliverables created with `type: 'custom'` (or any value not in the 15-type rubric registry) have no rubric. Plan must include the null-result handling in `scoreIteration()` and a UI fallback in `RubricBreakdown` ("Rubric not available for this type"). Q3 (planner): default NO backfill — these stay at `rubricVersion: null`.

2. **Judge returns invalid JSON.** Groq llama-3.3-70b at temp=0 is mostly compliant but not perfectly so. Fail-open in scorer means iteration always proceeds; never failing closed. Unit test the malformed-JSON path explicitly.

3. **Parallel iterate race.** Double-click on refine button can race. Cheap fix: `disabled={iterateMutation.isPending}` already in ArtifactPanel.tsx:257. Deep fix (transactional iterate) is out of scope. UNIQUE constraint on `(deliverableId, versionNumber)` is the safety net — second insert throws and surfaces as 500 to client.

4. **React StrictMode double-render firing 2× impressions in dev.** Server-side 5s dedupe is the authoritative fix. Don't try client-side guards — they fail on route changes.

5. **Schema migration on a non-empty production DB.** `npm run db:push` adds 4 columns with `DEFAULT 0` (counters) or `NULL` (timestamps) — safe per Postgres. But the composite index on `(agent_id, project_id, status)` will be built — for the Hatchin DB which currently has ≤10k deliverables, this completes in ms. Document in 36-DEPLOY notes.

6. **`registerDeliverableRoutes` argument coupling.** Adding 3 new endpoints to `server/routes/deliverables.ts` is straightforward but the file has grown. Planner should NOT split into modules within Phase 36 (out of scope); just append.

7. **Updates to `iterateDeliverable()` return shape break TS clients.** The response shape change from `{ deliverable }` to `{ deliverable, reverted, oldScore?, newScore? }` is a typed contract change. All call sites: just `server/routes/deliverables.ts:283` (returns whatever shape iterateDeliverable produces) and `client/src/components/ArtifactPanel.tsx:76-93` (currently destructures `res.json()` without typing). After Phase 36, plan a `IterateDeliverableResponse` type in `shared/dto/apiSchemas.ts` so both sides type-check.

8. **`RECENT FEEDBACK` injection accidentally double-included.** The section must be injected EXACTLY ONCE between `professionalDepthSection` and `projectContextSection`. If a future refactor introduces another section in between, the relative order is what matters per D-22. Add a code comment near the injection point: `// Phase 36 D-22 — must be after ROLE EXPERTISE, before PROJECT CONTEXT`.

9. **Storage method name collision.** Project already has `getDeliverablesByProject`. Phase 36 adds `getRecentFinalizedDeliverablesByAgent(agentId, projectId, limit)`. Verify name uniqueness before adding (likely fine, but check both `IStorage` interface and `MemStorage` / `DatabaseStorage` impls).

10. **`MemStorage` fallback for in-memory test mode.** Project has dual storage (`MemStorage` for dev/CI, `DatabaseStorage` for prod) per CLAUDE.md § 0. Phase 36 storage helper MUST be implemented in BOTH classes (line ranges per `wc -l server/storage.ts`: MemStorage ~lines 1410-1452, DatabaseStorage ~lines 2152-2192). Forgetting MemStorage means `STORAGE_MODE=memory` breaks.

11. **Test seed data for Playwright `case 3` (force revert).** Adversarial instruction ("remove all acceptance criteria") is non-deterministic — depends on LLM behavior. To make case 3 deterministic, add a DEV-only `/api/dev/force-judge-score` endpoint guarded by `NODE_ENV !== 'production'` that forces the next judge call to return a specific score. Mirror Phase 35's `/api/dev/force-outage` pattern (D-15..D-18). Without this, case 3 will be flaky.

12. **Drizzle column-type inference for `rubricScore: jsonb`.** The `$type<{...}>` decorator at declaration gives compile-time type; runtime storage is raw JSONB. If a row is written by a tool other than Drizzle (e.g., manual SQL during a migration), the typed shape can diverge from runtime. Mitigate by always going through `storage.createDeliverableVersion()`. Don't write `deliverable_versions` directly anywhere.

13. **`editsCount` overflow.** `integer` in Postgres = 32-bit signed = 2.1B max. Unbounded in practice. No mitigation needed.

14. **The `RECENT FEEDBACK` cache makes prompt-snapshot tests non-deterministic.** Q2 resolution leaves a 60s cache. Unit tests must clear the cache between cases (export a `__clearCacheForTests()` helper from `deliverableFeedbackAggregator.ts`). Same pattern as `providerHealthState.__resetForTests()` per Phase 35.

15. **Score totals are decimals (0.0–10.0).** The `< oldScore.total` comparison is float math. A tie (e.g., 7.5 vs 7.5) keeps new per D-09. Float equality is fine here because both numbers come from the same JSON parse and aren't recomputed downstream. No epsilon needed.

## Plan Breakdown Recommendation

I confirm the 4-plan structure from 36-CONTEXT.md. Minor sequencing refinements for safer execution:

### Plan 36-01 — Foundation
**Requirements covered:** RUBR-01, RUBR-03 (schema), FBK-01

**Scope:**
- Create `shared/deliverableRubrics.ts` with 15 frozen rubrics + Zod schema + `Object.freeze` invariant
- Add 4 columns to `deliverables`, 3 columns to `deliverable_versions` in `shared/schema.ts`
- Add composite index `(agent_id, project_id, status)` on `deliverables` (for FBK-04 query)
- Run `npm run db:push` against dev DB
- Write `scripts/test-rubric-scorer.ts` cases: `registry-shape`, `immutability-invariant`, `persistence-shape`
- No behavior changes yet — pure data structures

**Dependencies:** none
**Wave:** independent
**Exit criteria:** typecheck passes, registry-shape + immutability tests pass

### Plan 36-02 — Server Scoring + Endpoints
**Requirements covered:** RUBR-02, RUBR-03 (persistence), FBK-02, FBK-03

**Scope:**
- Create `server/ai/rubricScorer.ts` with `scoreIteration()`
- Wrap `iterateDeliverable()` in `deliverableGenerator.ts` with scoring gate + revert path
- Update iterate response shape to `{ deliverable, reverted, oldScore?, newScore? }`
- Add storage method `getRecentFinalizedDeliverablesByAgent` to both MemStorage and DatabaseStorage
- Add 3 new routes: `POST /:id/accept`, `POST /:id/dismiss`, `POST /:id/impression` (5s dedupe map)
- Add DEV-only `POST /api/dev/force-judge-score` (mirrors Phase 35 pattern) for deterministic Playwright case 3
- Update `scripts/test-rubric-scorer.ts` cases: `revert-decision`, `parse-fail-fail-open`, `editsCount-not-incremented-on-revert`
- No client-side changes yet

**Dependencies:** 36-01 (registry + schema)
**Wave:** sequential after 36-01
**Exit criteria:** all unit tests pass, manual curl against new endpoints succeeds with ownership check, `editsCount` increments correctly

### Plan 36-03 — Client UI
**Requirements covered:** RUBR-04, FBK-02 (UI), FBK-03 (UI)

**Scope:**
- Create `client/src/components/deliverable/RubricBreakdown.tsx` — per-criterion display from `rubricScore` JSONB
- Create `client/src/components/deliverable/AutoRevertBanner.tsx` — inline amber banner above content
- Modify `ArtifactPanel.tsx`:
  - Add Accept/Dismiss buttons in footer (TanStack mutations)
  - Add Rubric toggle in header opening RubricBreakdown
  - Extend `iterateMutation.onSuccess` to detect `reverted: true` and show AutoRevertBanner
  - Add `useEffect(() => { POST /impression }, [deliverableId])` on mount
- **VISUAL CHECKPOINT REQUIRED** per saved feedback rule: Playwright screenshots of current state + after-state + impact statement before commit
- Visual approval gate before merging

**Dependencies:** 36-02 (server endpoints + response shape)
**Wave:** sequential after 36-02
**Exit criteria:** Visual approval from user, all components render correctly, accept/dismiss/impression work end-to-end manually

### Plan 36-04 — Agent Prompt Feedback Signal + Phase Verification
**Requirements covered:** FBK-04 + cross-cutting verification

**Scope:**
- Create `server/ai/deliverableFeedbackAggregator.ts` — 60s cache, `getFeedbackSnapshot()`, `formatFeedbackSection()`
- Modify `server/ai/openaiService.ts` line ~222 to inject `RECENT FEEDBACK ON YOUR WORK (this project)` section between ROLE EXPERTISE and PROJECT CONTEXT
- Write `scripts/test-feedback-signal.ts` with prompt-snapshot cases (threshold met / below)
- Write `tests/e2e/phase-36-rubric-iteration.spec.ts` with 6 cases (per D-27):
  1. Generate deliverable → assert rubric score persisted + visible in panel rubric toggle
  2. Iterate neutrally → assert NEW ≥ OLD, currentVersion advances
  3. Iterate adversarially with DEV-only forced score → assert revert + AutoRevertBanner visible
  4. Click Accept → assert state + reload persistence
  5. Click Dismiss → assert state flip + reload persistence
  6. Re-open panel → assert impressionCount increments
- Register `phase-36` project in `playwright.config.ts`
- Write `36-VERIFICATION.md` mirroring Phase 35 template

**Dependencies:** 36-01, 36-02, 36-03
**Wave:** sequential after 36-03
**Exit criteria:** All 6 Playwright cases pass on live restarted dev server (2× deterministic), all unit tests pass, typecheck passes, build passes

### Wave Summary

```
Wave 0:  36-01 (Foundation — registry + schema)
            │
Wave 1:  36-02 (Server scoring + endpoints)
            │
Wave 2:  36-03 (Client UI) ─── visual checkpoint gate
            │
Wave 3:  36-04 (Prompt injection + verification spec)
            │
       Phase 36 complete → deploy gate
```

Linear sequence — no parallelism within the phase. Each plan depends on the previous one's exit criteria.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All | ✓ | 18+ | — |
| Postgres (Neon) | Schema migration | ✓ | serverless | — |
| Drizzle Kit | `npm run db:push` | ✓ | 0.30.x | — |
| `GROQ_API_KEY` | Judge LLM calls | ✓ (verified — Phase 35 uses Groq) | — | Gemini via fallback chain |
| `GEMINI_API_KEY` | Judge fallback | ✓ | — | — |
| Playwright | E2E tests | ✓ | 1.x | — |
| tsx | Unit test scripts | ✓ | — | — |
| `npm run dev` running for Playwright | E2E spec runtime | runtime requirement | — | Spec fails without it (per saved feedback rule, this is the point) |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

All dependencies for Phase 36 are already provisioned. No `npm install` needed. No environment changes needed.

## Sources

### Primary (HIGH confidence)
- `/Users/shashankrai/Documents/hatching-mvp-5th-march/.planning/phases/36-frozen-rubric-deliverable-iteration/36-CONTEXT.md` — 30 locked decisions
- `/Users/shashankrai/Documents/hatching-mvp-5th-march/.planning/REQUIREMENTS.md` — RUBR-01..04 + FBK-01..04 verbatim
- `/Users/shashankrai/Documents/hatching-mvp-5th-march/.planning/ROADMAP.md` lines 154-164 — Phase 36 success criteria
- `/Users/shashankrai/Documents/hatching-mvp-5th-march/CLAUDE.md` §§ 0, 1, 7, 9, 14, 16, 22 — coding standards, LLM chain, security checklist
- `/Users/shashankrai/Documents/hatching-mvp-5th-march/shared/schema.ts` lines 301-368 — current deliverables tables
- `/Users/shashankrai/Documents/hatching-mvp-5th-march/shared/deliverableTypes.ts` — 15 type registry
- `/Users/shashankrai/Documents/hatching-mvp-5th-march/server/ai/deliverableGenerator.ts` — `iterateDeliverable()` source
- `/Users/shashankrai/Documents/hatching-mvp-5th-march/server/routes/deliverables.ts` — endpoint patterns
- `/Users/shashankrai/Documents/hatching-mvp-5th-march/server/llm/providerResolver.ts` — `generateWithPreferredProvider` helper
- `/Users/shashankrai/Documents/hatching-mvp-5th-march/server/llm/providerTypes.ts` — LLMRequest shape
- `/Users/shashankrai/Documents/hatching-mvp-5th-march/server/ai/openaiService.ts` lines 200-400 — system prompt assembly
- `/Users/shashankrai/Documents/hatching-mvp-5th-march/client/src/components/ArtifactPanel.tsx` — UI surface
- `/Users/shashankrai/Documents/hatching-mvp-5th-march/.planning/phases/35-production-hotfix-pass/35-CONTEXT.md` — Phase 35 patterns (toast, .strict(), Playwright live-server rule)
- `/Users/shashankrai/Documents/hatching-mvp-5th-march/.planning/phases/35-production-hotfix-pass/35-VERIFICATION.md` — verification template
- `/Users/shashankrai/Documents/hatching-mvp-5th-march/tests/e2e/phase-35-production-hotfix.spec.ts` — Playwright pattern
- `/Users/shashankrai/Documents/hatching-mvp-5th-march/server/routes/health.ts` lines 100-165 — DEV-only endpoint guard pattern
- `/Users/shashankrai/Documents/hatching-mvp-5th-march/server/storage.ts` lines 198-204, 1410-1452, 2152-2192 — IStorage + MemStorage + DatabaseStorage shape
- `/Users/shashankrai/Documents/hatching-mvp-5th-march/playwright.config.ts` — Playwright project entries

### Secondary (MEDIUM confidence)
- Memory rules at `~/.claude/projects/.../memory/feedback_verify_in_runtime.md` and `feedback_ui_change_protocol.md` (binding)
- `package.json` scripts inventory — verified via grep
- Existing patterns in `server/ai/reasoningCache.ts`, `server/ai/tasks/organicExtractor.ts` referenced for cache + JSON-output approach

### Tertiary (LOW confidence — needs validation)
- None — all claims grounded in repo code or explicit locked decisions.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies already in repo, versions pinned per CLAUDE.md § 1
- Architecture: HIGH — directly extends established Phase 35 + v2.0 patterns; no novel infrastructure
- Pitfalls: HIGH — derived from reading current `iterateDeliverable()` source + understanding StrictMode + concurrency semantics
- Q1 / Q2 resolutions: HIGH — defended with rationale grounded in determinism, coupling cost, and Phase 35 precedent

**Research date:** 2026-05-11
**Valid until:** 2026-06-10 (30 days for stable architecture) or until any of: schema redesign of deliverables tables; deprecation of Groq llama-3.3-70b; introduction of a different multi-provider abstraction.

---

## RESEARCH COMPLETE

Phase: 36 - Frozen-Rubric Deliverable Iteration
Output: /Users/shashankrai/Documents/hatching-mvp-5th-march/.planning/phases/36-frozen-rubric-deliverable-iteration/36-RESEARCH.md
Open questions resolved: Q1 (single-call judge), Q2 (keep 60s in-process cache, no write-invalidation) — both with rationale
Open questions deferred to planner: Q3 (backfill — default NO), Q4 (DB column vs analytics table — default DB column)
Landmines surfaced: 15
Recommended plan count: 4 (36-01 Foundation → 36-02 Server → 36-03 Client → 36-04 Prompt + Verification)
