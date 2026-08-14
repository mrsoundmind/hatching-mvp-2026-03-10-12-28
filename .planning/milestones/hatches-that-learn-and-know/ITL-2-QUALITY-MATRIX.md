# ITL-2 Quality & Health Matrix

> Milestone: Hatches That Actually Learn & Know. The matrix is how you see, at a glance, whether every intelligence surface is (1) WORKING and (2) PRODUCING WELL, and where the gaps are. It is the operational form of the ITL-2 taxonomy, the operator surface (MEAS-03 renders it), the coverage gate (MEAS-08: no P0 surface ships RED), and the standing evidence surface (a fix is real when its cell flips to LIVE). 2026-08-13. Statuses are code-verified from the two grounding inventories. No em/en dashes.

## Cell contract
Every cell carries: `metric | data source (file:line) | layer | target | STATUS | segment-by | response-when-red`.
- **Layer:** A = structural gate (deterministic, 100% traffic, free); B = captured signal (100% traffic, free); C = LLM judge (sampled live + full on benchmark).
- **STATUS traffic light (this is the answer to "what is missing"):**
  - **LIVE** = signal exists and is aggregatable today.
  - **RAW** = signal exists per-event but is not aggregated (needs a query/rollup, cheap).
  - **MISSING** = signal does not exist (needs instrumentation).
- **Segment-by overlay:** the whole grid re-sliceable by role, tier, pack, project, and which model actually ran. The last one answers "does the Gemini fallback produce worse output than DeepSeek."

## The five bands
- **A. WORKING** (operational): fired, success/fail/blocked, latency p50/p95, error/empty rate, provider + fallback.
- **B. PRODUCING WELL** (quality): per-surface quality dimensions, judged or signalled.
- **C. SAFE** (harm): hallucination, safety-intervention rate, fake-action, injection-resistance.
- **D. OUTCOME** (did it help the user): thumbs, task completion, output used, return.
- **E. EFFICIENT** (cost per quality): cost per unit crossed with its quality score.

---

## Band A: WORKING (is it operational)

| Surface | Fired | Success/Fail/Blocked | Latency p50/p95 | Error/empty rate | Provider + fallback |
|---|---|---|---|---|---|
| Chat reply | LIVE (messages) | n/a | RAW (`messages.metadata.llm.latencyMs`; `autonomy_events.latency_ms` + `summarizeLatency`) | MISSING (`streaming_error` per-event only) | RAW (`messages.metadata.llm.provider/fallbackChain`) |
| Deliverable | LIVE | RAW | RAW | MISSING | MISSING (no writer model on version) |
| Autonomy task | LIVE (`/autonomy/stats`) | RAW (`task_failed` emitted, stats excludes it) | RAW | MISSING | MISSING |
| Peer review (judge) | LIVE (`peer_review_started`) | n/a | RAW | n/a | LIVE (`payload.judgeModel`) |
| RAG retrieval | MISSING (`miss` flag computed, never read) | n/a | RAW | MISSING | n/a |
| Routing | LIVE (`hatch_selected`) | n/a | RAW | MISSING | LIVE (`provider` on event) |
| Memory | write LIVE (`memory_written`); recall MISSING | n/a | n/a | n/a | n/a |
| System | n/a | n/a | LIVE p50/p95 (evidence-pack) | MISSING (no rate; degraded tripwire only) | RAW (`provider_fallback` events, no per-provider rate) |

## Band B: PRODUCING WELL (is the output good)

| Surface | Quality dimensions | Signal source | STATUS |
|---|---|---|---|
| Chat reply | grounding, relevance, substance, voice, rule-compliance | thumbs (`message_reactions` via `benchmark-suite querySatisfaction`); rest need a judge | thumbs LIVE; grounding/relevance/substance/voice MISSING (no live judge); rule-compliance RAW (tone guard runs, not counted) |
| Deliverable | rubric score, completeness, reader-test clarity | `deliverable_versions.rubric_score`, `.reader_test` | rubric RAW, reader-test RAW (stored on version, not emitted as events, ignored by benchmark) |
| Autonomy task | peer-review verdict, goal achievement | `peer_review_feedback.payload.verdict` | verdict RAW (counted, but not broken down by verdict); goal achievement MISSING |
| Peer review (judge) | judge calibration vs human, verdict mix | needs a labeled set | calibration MISSING (MEAS-07); verdict mix RAW |
| RAG retrieval | precision (chunks relevant), used-in-answer, coverage | none | MISSING (whole quality axis) |
| Routing | correct specialist, confidence calibration | `hatch_selected.confidence/selectionScores`; offline `eval:routing` (structural) | confidence RAW; correctness MISSING in prod |
| Memory | recall precision, did-it-help | none | MISSING |

## Band C: SAFE (is it harmless)

| Metric | Source | STATUS |
|---|---|---|
| Safety-intervention rate | `safety_triggered` events | RAW (events exist, no rate) |
| Hallucination rate | needs GRND-01/02 + judge | MISSING |
| Fake-action rate | capability-envelope evals (offline) | RAW (offline only) |
| Injection-resistance | injection eval scripts (offline) | RAW (offline only) |

## Band D: OUTCOME (did it help the user)

| Metric | Source | STATUS |
|---|---|---|
| Thumbs approval rate | `message_reactions` | LIVE |
| Task completion rate | `tasks.status` | RAW (`benchmark-suite queryTaskValue`, not continuous) |
| Output actually used / edited | deliverable edits, `resolvedFromPrevious` | RAW |
| Return / re-engagement | needs product analytics | MISSING (growth-track dependency) |

## Band E: EFFICIENT (cost per quality)

| Metric | Source | STATUS |
|---|---|---|
| Cost per turn / deliverable | `usage_daily_summary`, `recordEstimatedUsage` | LIVE (cost) |
| Cost crossed with quality score | needs cost + judge together | MISSING (never crossed) |

---

## What the matrix makes undeniable (the RED gaps)
RAG retrieval quality and hit-rate (whole surface), memory recall (lost signal), live chat answer quality (no judge), error/empty-rate aggregation, per-provider quality on non-chat surfaces, quality-judge calibration, safety-rate aggregation, outcome/return signals, and cost-per-quality. Each RED cell has a requirement that fills it (see `COVERAGE-AND-EVIDENCE.md` section C); each AMBER cell is a cheap rollup over signals that already exist.

## How the matrix proves "it works and it is getting smarter"
- **Working:** the WORKING band cells flip RED/RAW to LIVE as ITL-0/ITL-2 instrument them, and each flip is an Evidence Ledger entry (a live demo).
- **Producing well:** the PRODUCING-WELL band gets a validated judge (MEAS-07) feeding a benchmark trendline (MEAS-05/06).
- **Getting smarter:** the ITL-3 learning loop only counts when the A/B counterfactual (capability on vs off) moves the benchmark, sliced by role and controlled for provider. That A/B delta on the frozen benchmark is the one proof of "smarter" that cannot be asserted, only demonstrated.
