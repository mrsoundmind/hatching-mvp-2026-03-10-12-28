# ITL-2 Measurement Design: how we measure quality for everything, prove it works, and detect improvement

> Milestone: Hatches That Actually Learn & Know. Design doc for phase ITL-2 (Quality Measurement). 2026-08-13. This is the methodology that the ITL-2 requirements and plan implement. Principle from the founder: measuring quality is not "add a counter." It is measure everything, make sure the measurement itself works, hold a benchmark, and prove improvement. No em/en dashes, no fabricated numbers.

## The problem this solves
Today quality is measured by hand-run offline scripts (most last committed 2026-05-04), several of which are structural proxies, not quality. Nothing measures quality continuously in production, and the good signals we already capture (peer-review verdicts, reader-tests, reactions) are thrown away per-event. So we cannot answer "are the agents good, and are they improving?" with evidence. ITL-2 fixes that as a system, not a dashboard.

## Principle 1: measure everything, at three fidelities
Every output the intelligence layer produces gets measured. But an LLM judge on every call is too slow and too costly, so measurement runs in three layers, and everything gets at least the first two.

- **Layer A: structural gates (deterministic, 100% of traffic, near-free).** Rule compliance (no dashes, no headers, length match, one-question rule), citation validity (from ITL-0 GRND-01), non-empty output, format correctness. Pass/fail, always on.
- **Layer B: captured signals (100% of traffic, free).** Thumbs up/down reactions, peer-review verdicts (approve/revise/reject), reader-test results, frozen-rubric scores, retrieval hit/miss (ITL-0 T2). Already produced today; ITL-2 aggregates them instead of discarding them.
- **Layer C: LLM-as-judge scoring (sampled live + exhaustive on the benchmark).** A cross-model blind judge scores the rubric dimensions. This is the real "is this good" measure. It runs async (never in the user's latency path), sampled on live traffic (rate is a dial), and on 100% of the frozen benchmark on a cadence. Free Groq tier where possible, a different model family than the writer (anti self-preference bias).

"Everything" is satisfied because every output gets Layers A and B; the expensive Layer C is sampled live and complete on the benchmark, so coverage is total without unbounded cost.

## Principle 2: define "good" per surface (the quality taxonomy)
There is no single quality number. Each surface has its own dimensions, scored 1 to 5 by rubric (Layer C) plus binary gates (Layer A).

| Surface | Quality dimensions |
|---|---|
| **Chat reply** | Grounding (claims supported, no hallucination), Relevance (answers the real question), Substance (specific and actionable, not generic), Voice fidelity (sounds like the role), Rule compliance (tone gates) |
| **Deliverable** | Frozen-rubric score (per type), Completeness (all sections), Reader-test clarity, Accuracy |
| **Autonomy task** | Peer-review verdict, Goal achievement, Safety compliance |
| **RAG retrieval** | Hit-rate (fired vs empty), Precision (were retrieved chunks relevant), Usage (did the answer use them), Grounding coverage |
| **Routing** | Correct specialist and mode chosen |
| **Memory** | Recall precision (right memory surfaced), Use (did it change the answer) |
| **Learning (ITL-3)** | Improvement delta (post-feedback output better than pre, measured by this system) |

These roll up to a per-surface quality score and one overall Intelligence Quality score, always decomposable back to the dimension and surface so a drop is diagnosable, not just visible.

## Principle 3: freeze a benchmark (the golden set)
Improvement is only provable against a stable ruler.

- A **frozen, versioned golden set** of representative inputs (target 80 to 150): spread across all roles, task types (question, deliverable request, ambiguous goal, factual lookup, creative brief), difficulty levels, and known edge cases (hallucination traps, prompt-injection, cite-or-admit triggers, memory-recall cases).
- Each item carries a **rubric** (what a 5 looks like) and, where possible, reference key-points or an expert answer.
- The whole set runs through the LIVE system on a cadence (per meaningful change and nightly), Layer-C judge-scored, producing an overall plus per-dimension plus per-role score.
- **Versioned:** changing the set bumps its version; scores are only comparable within a version, and the judge version is tracked too. This is the same discipline as the existing frozen rubrics (Phase 36), generalized from deliverables to the whole intelligence layer.

## Principle 4: detect improvement three ways
1. **Trendline.** Benchmark score over time (overall, per role, per dimension). This is the literal "are we getting better" chart, and the answer to the founder's question.
2. **Regression gate.** A change that drops the benchmark below the rolling baseline beyond noise is flagged or blocked. Reuse and generalize the Phase-36 frozen-rubric auto-revert-on-regression pattern from deliverables to the benchmark.
3. **A/B counterfactual.** For any capability (RAG, the learning loop, a prompt change), run the benchmark with it ON vs OFF and judge the delta. This is how a feature is PROVEN to improve quality, not assumed. The competence A/B already does exactly this for RAG (4.40 to 5.00); ITL-2 generalizes it so every capability, especially the ITL-3 learning loop (LEARN-05), must clear this bar before it counts as an improvement.
4. **Live-vs-offline correlation (the honesty check on the benchmark itself).** Periodically confirm the offline benchmark score tracks live signals (thumbs, peer-review pass rate). If they diverge, the benchmark is not representative and must be refreshed. This keeps the ruler honest.

## Principle 5: validate the measurement itself (the part people skip)
An LLM judge can be confidently wrong, so its numbers are only trustworthy if the judge is validated. This is the founder's "make sure it works," applied to the measurer.

- **Judge calibration against human labels.** Run the judge on a human-labeled subset; require high agreement before its scores are trusted. This is exactly the discipline the peer-review judge already meets (0% false-block, 100% catch on a labeled set); apply it to the quality judge.
- **Cross-model.** Judge is a different model family than the writer (Groq judge vs DeepSeek/Gemini writer), so it does not grade its own homework.
- **Drift tracking.** Re-calibrate on a cadence; track judge-vs-human agreement over time. A judge that drifts silently corrupts every downstream number.
- **No fabricated proof (OPS-03).** Every number on the surface is real or absent. A benchmark that did not run shows "not run," never a stale or invented score.

## Cost posture (the one real decision, recommended default)
Layers A and B run on 100% of live traffic at negligible cost. Layer C (the judge) runs async and sampled on live traffic (default a low sample rate, a dial), and on 100% of the frozen benchmark on a cadence. Judge uses the free Groq tier where possible. This measures everything (A and B are universal) while keeping the expensive judge bounded (sampled live, exhaustive on the fixed benchmark). If the founder wants tighter live coverage, the sample rate is one env value; the cost tradeoff is explicit, not hidden.

## What already exists to build on (do not reinvent)
- **Frozen rubrics + auto-revert on score regression** (Phase 36): the benchmark + regression-gate pattern, currently deliverable-only. Generalize it.
- **Peer-review judge + calibration** (0% false-block / 100% catch): a validated, cross-model judge. Reuse for Layer C and copy its calibration discipline.
- **Competence A/B** (RAG on vs off, blind rubric judge): the A/B counterfactual method. Generalize to every capability.
- **Reader-test reviewer**: another validated judge for prose.
- **benchmark-suite.ts**: already aggregates signals (satisfaction, peer-review rate, feedback-quality correlation); make it continuous and add the golden set + trendline + judge validation.

The work is largely to generalize and make continuous the good patterns that already exist in pockets, extend them to every surface, freeze a benchmark, and add the trendline, the regression gate, and the judge-validation loop.

## How this reshapes ITL-2 (see REQUIREMENTS.md MEAS-01..07)
- MEAS-01 (aggregate signals) stays, now explicitly across ALL surfaces (Layer B, everything).
- MEAS-02 (retrieval telemetry) stays (Layer B for RAG).
- MEAS-03 (operator surface) stays, now the decomposable per-surface/per-dimension quality view plus the trendline.
- MEAS-04 (revive genuine evals) stays, folded into the benchmark cadence.
- MEAS-05 NEW: the frozen, versioned golden-set benchmark (Principle 3).
- MEAS-06 NEW: improvement detection: trendline + regression gate + A/B counterfactual (Principle 4).
- MEAS-07 NEW: validate the measurement itself: judge calibration vs human labels + drift tracking (Principle 5).

## Build order within ITL-2
1. Layer B aggregation (MEAS-01) and retrieval telemetry (MEAS-02): cheapest, uses signals we already have.
2. The golden set + judge scoring (MEAS-05) with the judge validated first (MEAS-07): do not trust judge numbers before the judge is calibrated.
3. The operator surface + trendline (MEAS-03) once there is real data to show.
4. Improvement detection: regression gate + A/B (MEAS-06), which then becomes the acceptance mechanism for ITL-3 (the learning loop only "counts" if it clears the A/B on the benchmark).

## Acceptance for ITL-2 (verified in runtime, OPS-01)
1. Every surface in the taxonomy has at least Layer A + B measurement live; the judge (Layer C) runs sampled-live and full-on-benchmark.
2. A frozen, versioned golden set exists and runs on a cadence, producing per-dimension, per-role, and overall scores.
3. The judge is calibrated against human labels with recorded agreement before its scores are trusted; drift is tracked.
4. An operator can see the quality trendline and drill into any drop by surface and dimension, with no fabricated numbers.
5. A regression that lowers the benchmark is flagged or blocked; a capability can be A/B-proven to improve quality (demonstrated on RAG, ready for ITL-3).
6. The offline benchmark is shown to track live signals, or the divergence is surfaced as a benchmark-refresh action.
