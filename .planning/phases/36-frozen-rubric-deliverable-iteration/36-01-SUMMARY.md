---
phase: 36
plan: 01
subsystem: deliverables / rubric-foundation
tags: [foundation, rubric, schema, immutability, wave-1, autonomous]
dependency_graph:
  requires: []
  provides:
    - shared/deliverableRubrics.ts (DELIVERABLE_RUBRIC_REGISTRY + getRubricForType + Rubric type) — consumed by 36-02 server scorer
    - shared/schema.ts deliverables.userAcceptedAt/dismissedAt/editsCount/impressionCount — consumed by 36-02 accept/dismiss/impression endpoints + 36-03 ArtifactPanel + 36-04 aggregator
    - shared/schema.ts deliverable_versions.rubricVersion/rubricScore/revertedFromHigherScore — consumed by 36-02 iterateDeliverable persistence + 36-03 version history UI
  affects: [server/storage.ts (MemStorage createDeliverable v1 row literal extended for new defaulted fields)]
tech-stack:
  added: []
  patterns:
    - "Frozen registry: code-defined data + rubricSchema.parse(...) at module load + Object.freeze at all 4 levels (Map, rubric, criteria array, criterion) — fail-closed for an immutability invariant"
    - "Zod .strict() + .refine() weight-sum invariant — bad rubric crashes server on boot rather than entering production silently"
    - "Additive schema migration via direct ALTER TABLE ADD COLUMN IF NOT EXISTS — bypassed npm run db:push's interactive prompt about an unrelated users constraint drift; purely additive, idempotent"
    - "Test scaffolding mirroring scripts/test-provider-health-state.ts (Phase 35) — node:assert/strict, top-level async main, PASS line per case, first-FAIL-exits-1"
key-files:
  created:
    - shared/deliverableRubrics.ts
    - scripts/test-rubric-scorer.ts
    - .planning/phases/36-frozen-rubric-deliverable-iteration/36-01-SUMMARY.md
  modified:
    - shared/schema.ts (deliverables +4 cols, deliverable_versions +3 cols)
    - server/storage.ts (MemStorage createDeliverable v1 literal: rubricVersion/rubricScore/revertedFromHigherScore defaulted)
decisions:
  - "Authored all 15 rubric criterion sets directly per D-05 (Claude is the author); criterion keys snake_case, labels Title Case, weights chosen to sum exactly to 1.0 with rounded decimals (0.15/0.20/0.25), anchorAt10/anchorAt0 each one declarative sentence under 280 chars"
  - "Used direct ALTER TABLE ADD COLUMN IF NOT EXISTS rather than npm run db:push to avoid an interactive prompt about an unrelated pre-existing constraint (users_provider_sub_unique). Same purely-additive end state; safer than approving an unrelated constraint touch"
  - "Extended MemStorage.createDeliverable's v1-version literal to include the 3 new defaulted fields. Required for typecheck after schema additions; runtime semantics unchanged (pre-Phase-36 v1 rows were already conceptually null on rubricScore — this just makes the literal honest)"
  - "Plan called for `grep -E \"type: '(...15 types...)'\" ... | wc -l >= 15`; equivalent `grep -E \"^  type: \"` returns 15 (one per rubric block). Verified."
metrics:
  duration: 25m
  completed: 2026-05-11
  tasks_completed: 3
  files_changed: 4
  lines_added: ~900
deviations:
  - "[Rule 3 - Blocking issue] npm run db:push prompted interactively about an unrelated pre-existing users_provider_sub_unique constraint drift. Bypassed by issuing the 7 Phase 36 ALTER TABLE ADD COLUMN IF NOT EXISTS statements directly via `await db.execute(sql.raw(...))` — purely additive, idempotent, no touch of any unrelated table. Same end state as db:push for these columns. Verified live via information_schema.columns."
  - "[Rule 3 - Blocking issue] Adding the 3 new fields on deliverable_versions broke server/storage.ts MemStorage.createDeliverable typecheck (the auto-created v1 row literal at line 1423 was missing fields). Fixed inline by extending the literal with rubricVersion: null, rubricScore: null, revertedFromHigherScore: false. Same defaults the DB writes; no runtime behavior change."
---

# Phase 36 Plan 01: Foundation Summary

Built the Wave 1 foundation for Phase 36 frozen-rubric deliverable iteration: a code-defined, semver-locked, Zod-validated, Object.freeze-immutable rubric registry covering all 15 deliverable types, plus the additive schema columns that Waves 2-4 (server scoring, client UI, agent feedback signal) depend on. Zero behavior change — no server logic, no LLM calls, no UI mutations.

## What Shipped

### 1. `shared/deliverableRubrics.ts` — Frozen rubric registry

- **15 rubrics**, one per type slug — prd, tech-spec, design-brief, gtm-plan, user-stories, blog-post, landing-copy, content-calendar, email-sequence, seo-brief, project-plan, competitive-analysis, market-research, process-doc, data-report. All at `rubricVersion: '1.0.0'`.
- **Zod schemas:** `rubricCriterionSchema` (strict, snake_case key regex, label/anchor length bounds, weight 0-1) and `rubricSchema` (strict, semver regex, 15-type enum, criteria array 4-6, weights-sum-to-1.0 refine within 1e-6 tolerance).
- **Module-load fail-closed:** every rubric runs through `rubricSchema.parse(...)` — a malformed rubric crashes the server on boot.
- **Object.freeze at all 4 levels:** the registry Map, every rubric, every criteria array, every criterion. Mutation defense per threat T-36-01.
- **Public API surface (6 exports):** `rubricCriterionSchema`, `rubricSchema`, `Rubric` type, `DELIVERABLE_RUBRIC_REGISTRY` (`ReadonlyMap<string, Rubric>`), `getRubricForType(type) → Rubric | null`, `listRubricTypes() → readonly string[]`.

### Rubric content overview

| Type | Criteria count | Criterion keys (snake_case) | Weight distribution |
|------|---|---|---|
| prd | 5 | problem_clarity, solution_specificity, success_metrics, risk_coverage, user_story_quality | 0.25 / 0.20 / 0.20 / 0.15 / 0.20 |
| tech-spec | 5 | architecture_clarity, api_contract_specificity, data_model_completeness, failure_mode_coverage, testability | 0.20 × 5 |
| design-brief | 5 | problem_framing, user_persona_specificity, visual_direction_clarity, success_signals, constraints_named | 0.20 × 5 |
| gtm-plan | 5 | target_segment_specificity, positioning_clarity, channel_strategy, launch_milestones, success_metrics | 0.20 × 5 |
| user-stories | 4 | actor_action_outcome_format, acceptance_criteria_testability, edge_case_coverage, dependency_clarity | 0.25 × 4 |
| blog-post | 5 | hook_strength, thesis_clarity, evidence_specificity, narrative_flow, cta_quality | 0.20 × 5 |
| landing-copy | 5 | headline_hook, value_proposition_clarity, social_proof_specificity, cta_actionability, objection_handling | 0.25 / 0.20 / 0.20 / 0.15 / 0.20 |
| content-calendar | 5 | cadence_realism, topic_diversity, channel_alignment, ownership_assignment, success_measurement | 0.20 × 5 |
| email-sequence | 5 | subject_line_hook, opening_personalization, value_per_email, cta_progression, send_cadence | 0.20 / 0.20 / 0.25 / 0.20 / 0.15 |
| seo-brief | 5 | target_query_specificity, search_intent_alignment, content_outline_completeness, internal_link_strategy, success_metrics | 0.20 / 0.20 / 0.25 / 0.15 / 0.20 |
| project-plan | 5 | scope_clarity, milestone_specificity, dependency_mapping, risk_register, resource_allocation | 0.20 × 5 |
| competitive-analysis | 5 | competitor_selection_rationale, dimension_coverage, evidence_specificity, differentiation_insight, strategic_implication | 0.20 × 5 |
| market-research | 5 | problem_validation_evidence, market_sizing_method, segment_specificity, competitive_context, decision_recommendation | 0.20 × 5 |
| process-doc | 5 | trigger_clarity, step_atomicity, role_responsibility, failure_recovery, success_signals | 0.20 / 0.25 / 0.20 / 0.20 / 0.15 |
| data-report | 5 | question_specificity, methodology_transparency, finding_specificity, confidence_calibration, recommendation_actionability | 0.20 × 5 |

All weight sums verified within 1e-6 of 1.0 by the registry-shape unit test.

### 2. `shared/schema.ts` — Additive column additions

**`deliverables` table — 4 new columns** (placed between `metadata` and `createdAt`):

| Column (TS) | Column (SQL) | Type | Nullable | Default |
|---|---|---|---|---|
| `userAcceptedAt` | `user_accepted_at` | timestamp | YES | null |
| `dismissedAt` | `dismissed_at` | timestamp | YES | null |
| `editsCount` | `edits_count` | integer | NO | 0 |
| `impressionCount` | `impression_count` | integer | NO | 0 |

**`deliverable_versions` table — 3 new columns** (placed between `createdAt` and the index block):

| Column (TS) | Column (SQL) | Type | Nullable | Default |
|---|---|---|---|---|
| `rubricVersion` | `rubric_version` | text | YES | null |
| `rubricScore` | `rubric_score` | jsonb `$type<{ total, breakdown[], skipped?, reason? }>()` | YES | null |
| `revertedFromHigherScore` | `reverted_from_higher_score` | boolean | NO | false |

Nullable timestamps (`userAcceptedAt`, `dismissedAt`) deliberately do NOT have `.notNull()` — null is the meaningful "not yet accepted / dismissed" state per D-18. Counters (`editsCount`, `impressionCount`) are `.notNull().default(0)` — monotonically increasing per D-19 / D-20. `rubricVersion` + `rubricScore` are nullable per Q3 (pre-Phase-36 rows have null; 36-02 scorer populates them on new writes). `revertedFromHigherScore` defaults false; D-10's auto-revert path flips it to true on rejected versions.

### 3. `scripts/test-rubric-scorer.ts` — Wave-1 test scaffold

Three test cases, exits 0 on all PASS, non-zero on first FAIL:

1. **registry-shape** — all 15 expected types present, every rubric semver-versioned, 4-6 criteria per rubric, every criterion key snake_case, weights sum to 1.0 within 1e-6, every rubric round-trips through `rubricSchema.safeParse`.
2. **immutability-invariant** — `Object.isFrozen` returns true on the registry Map, every rubric, every criteria array, every criterion. Mutation attempt `(prd as any).criteria[0].weight = 999` leaves the value unchanged.
3. **persistence-shape** — type-flow assertion that `InsertDeliverableVersion` literal carrying `rubricVersion`, `rubricScore` (full shape), and `revertedFromHigherScore` compiles. Proves Task 2's schema additions flowed through Drizzle's `InsertModel` inference.

Wave 2 (36-02) appends 5 more cases (revert-decision, parse-fail-fail-open, editsCount-not-incremented-on-revert, prod-guard-on-forced-score-setter, deterministic-criterion-ordering) that require the `rubricScorer` module 36-02 creates.

## Decisions Adhered To

- **D-01..D-05 (Rubric format):** Rubrics live in code (not DB), 4-6 criteria per type, weights sum to 1.0, anchors at 10 and 0 used only by the LLM judge (never user-facing), AI-drafted content authored verbatim. All 15 rubrics conform.
- **D-04 (Rubric immutability semantics):** All initial rubrics at `rubricVersion: '1.0.0'`; future tweaks will bump to `'1.1.0'` or `'2.0.0'` and old `deliverable_versions` rows keep their original version — enforced by storing `rubricVersion` per version.
- **D-17 (Schema additions):** Exactly 4 cols on `deliverables` + 3 on `deliverable_versions` with the specified nullability and defaults. No migration .sql file (column adds applied directly).
- **D-18 (Accept/Dismiss mutually exclusive):** Both timestamps nullable so each state is observable; 36-02 will implement the mutually-exclusive write semantics on the endpoints.
- **D-19 (editsCount only on iterate keep-new):** Column defaulted to 0; 36-02 owns the increment logic.
- **D-20 (impressionCount via dedicated endpoint):** Column defaulted to 0; 36-02 owns the dedupe + endpoint.
- **Q3 (no backfill):** Pre-Phase-36 `deliverable_versions` rows keep `rubricVersion = null` and `rubricScore = null` — verified by the column nullability.
- **T-36-01 (Tampering — runtime registry mutation):** Mitigated by Object.freeze loop at all 4 levels + `case_immutabilityInvariant` test.
- **T-36-02 (Info Disclosure — anchor strings to client bundle):** Mitigated by registry export shape (no anchor-only type-level export) AND zero-imports-from-client invariant (`grep -r "deliverableRubrics" client/` returns 0).
- **T-36-03 (Tampering — malformed rubric):** Mitigated by `rubricSchema.parse(...)` on every rubric at module load — fails server boot if violated.

## Verification Results

| Gate | Status | Evidence |
|---|---|---|
| `npx tsc --noEmit` | PASS | Exit 0 |
| `npx tsx scripts/test-rubric-scorer.ts` | PASS | 3/3 cases PASS, deterministic across re-runs |
| `npm run build` | PASS | Vite client + esbuild server build, exit 0 |
| `grep -c "rubricVersion: '1.0.0'" shared/deliverableRubrics.ts` | 15 | ≥ 15 |
| `grep -c "Object.freeze" shared/deliverableRubrics.ts` | 6 | ≥ 3 |
| `grep -E "(user_accepted_at\|dismissed_at\|edits_count\|impression_count\|rubric_version\|rubric_score\|reverted_from_higher_score)" shared/schema.ts \| wc -l` | 7 | ≥ 7 |
| Schema columns applied to dev DB | YES | information_schema.columns shows all 7 with correct types/nullability/defaults |
| `npx tsx -e "import { listRubricTypes } from './shared/deliverableRubrics'; console.log(listRubricTypes().length);"` | 15 | ≥ 15 |
| `grep -c 'index("deliverables_' shared/schema.ts` | 4 | Unchanged from pre-edit (no new indexes per plan) |
| `grep -r "deliverableRubrics" client/` | 0 | T-36-02 mitigation holds |

### Database migration verification (live)

```
deliverables new cols:
  dismissed_at        timestamp  NULL  null
  edits_count         integer    NOT NULL  0
  impression_count    integer    NOT NULL  0
  user_accepted_at    timestamp  NULL  null

deliverable_versions new cols:
  reverted_from_higher_score  boolean  NOT NULL  false
  rubric_score                jsonb    NULL  null
  rubric_version              text     NULL  null
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] npm run db:push hit an unrelated interactive prompt**

- **Found during:** Task 2
- **Issue:** `npm run db:push` paused on a prompt about adding `users_provider_sub_unique` constraint to the users table (which contains 17 rows). That constraint is pre-existing drift unrelated to Phase 36 — it would otherwise need an explicit go/no-go decision.
- **Fix:** Bypassed `db:push` by issuing the 7 Phase 36 ALTER TABLE ADD COLUMN IF NOT EXISTS statements directly through `await db.execute(sql.raw(...))`. Purely additive, idempotent, no touch of any unrelated table. Same end state as `db:push` for the deliverables / deliverable_versions tables.
- **Files modified:** None beyond plan (only DB state changed).
- **Verification:** information_schema.columns confirms all 7 columns now live with correct types, nullability, and defaults.

**2. [Rule 3 - Blocking issue] MemStorage v1 row literal broke typecheck**

- **Found during:** Task 2 (immediately after schema edit)
- **Issue:** `server/storage.ts:1423` constructs a `DeliverableVersion` literal in `MemStorage.createDeliverable` to auto-create the v1 row. After Task 2 added 3 new fields to the table type, this literal was missing them and `tsc --noEmit` errored.
- **Fix:** Extended the literal with `rubricVersion: null`, `rubricScore: null`, `revertedFromHigherScore: false` (same defaults the DB writes).
- **Files modified:** `server/storage.ts` (one literal extended).
- **Runtime impact:** None. Pre-Phase-36 v1 rows on MemStorage were already conceptually null on these fields — the literal just makes that honest now.
- **Commit:** `422c654` (rolled into the Task 2 commit since both edits are part of the same atomic schema delta).

## Exports Surface (for downstream plans)

```typescript
// shared/deliverableRubrics.ts exports:
export const rubricCriterionSchema: ZodObject<...>;
export const rubricSchema: ZodEffects<...>;
export type Rubric = z.infer<typeof rubricSchema>;
export const DELIVERABLE_RUBRIC_REGISTRY: ReadonlyMap<string, Rubric>;
export function getRubricForType(type: string): Rubric | null;
export function listRubricTypes(): readonly string[];
```

**Downstream consumption:**

- **36-02 (server scoring)** imports `getRubricForType` + `Rubric` type for `rubricScorer.ts` prompt assembly. Also imports the Drizzle `deliverables.userAcceptedAt/dismissedAt/editsCount/impressionCount` columns for accept/dismiss/impression endpoints, and `deliverable_versions.rubricVersion/rubricScore/revertedFromHigherScore` for iterate persistence.
- **36-03 (client UI)** imports NOTHING from `shared/deliverableRubrics.ts` (T-36-02 mitigation — anchor strings must not reach the bundle). Reads `rubricScore` JSONB from the deliverable_versions row only.
- **36-04 (agent feedback signal)** imports NOTHING from `shared/deliverableRubrics.ts`. Reads `userAcceptedAt`, `dismissedAt`, `editsCount` from the `deliverables` row via the aggregator.

## Test Case Manifest

| Case | Plan that added it | Verifies |
|---|---|---|
| registry-shape | 36-01 (this plan) | 15 types, semver versioning, criteria count, key format, weight sums |
| immutability-invariant | 36-01 (this plan) | Object.isFrozen at 4 levels, mutation no-op |
| persistence-shape | 36-01 (this plan) | InsertDeliverableVersion type-flow with 3 new columns |
| revert-decision | 36-02 (Wave 2) | rubricScorer revert/keep logic |
| parse-fail-fail-open | 36-02 (Wave 2) | malformed judge output → fail-open keep-new |
| editsCount-not-incremented-on-revert | 36-02 (Wave 2) | atomic counter increment skipped on revert path |
| prod-guard-on-forced-score-setter | 36-02 (Wave 2) | DEV-only force-judge-score endpoint blocks in prod |
| deterministic-criterion-ordering | 36-02 (Wave 2) | breakdown[] order matches rubric.criteria order |

## Commits

- `1829ef8` — feat(36-01): add frozen rubric registry with 15 deliverable-type rubrics
- `422c654` — feat(36-01): add 4 cols on deliverables + 3 on deliverable_versions
- `64bcac4` — test(36-01): Wave-1 rubric registry validation cases

## Self-Check: PASSED

- shared/deliverableRubrics.ts: FOUND
- shared/schema.ts (modified): FOUND
- scripts/test-rubric-scorer.ts: FOUND
- Commit 1829ef8: FOUND
- Commit 422c654: FOUND
- Commit 64bcac4: FOUND
