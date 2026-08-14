# Roadmap: Hatches That Actually Learn & Know

> **Milestone-scoped GSD roadmap (additive).** 2026-08-13. Phases are milestone-relative (ITL-0 … ITL-5), NOT in the global `NN-` scheme, to avoid colliding with in-progress v2.1 / v2.2 phase directories. Promote to top-level `ROADMAP.md` + real phase dirs when those milestones close and this becomes active.
>
> **Build strategy:** honesty and grounding first (ITL-0), because the launch product may currently ship with no knowledge base and misleading claims. Then measure (ITL-2) before you learn (ITL-3), because you cannot feed quality forward that you cannot see. Web research + web-learning (ITL-4) is a committed build that depends on ITL-0's safety/grounding (untrusted web content is injection surface). Positioning (ITL-5) has an urgent "stop claiming" slice that runs alongside ITL-0.

## Phase overview

| # | Phase | Goal | Requirements | Success criteria | Priority |
|---|-------|------|--------------|------------------|----------|
| **ITL-0** | Knowledge Integrity & Grounding | Grounding is real in prod and honest when it fails | KNOW-01, KNOW-02, KNOW-03, KNOW-04, GRND-01, GRND-02 | 5 | **P0 launch-blocking** |
| **ITL-1** | Deep Grounding | Every document a user gives is actually searchable | KNOW-05, KNOW-06 | 4 | P1 |
| **ITL-2** | Quality Measurement | Measure everything, prove the measurement works, benchmark it, detect improvement, and make coverage visible in a matrix | MEAS-01, MEAS-02, MEAS-03, MEAS-04, MEAS-05, MEAS-06, MEAS-07, MEAS-08, MEAS-09 | 7 | P1 |
| **ITL-3** | Real Learning Loop | A bad outcome improves the next task (genuine self-improvement) | LEARN-01, LEARN-02, LEARN-03, LEARN-04, LEARN-05 | 5 | P1 |
| **ITL-4** | Live Web Research & Web-Learning | Agents search, read, and continuously learn from the internet, safely (committed build) | WEB-01, WEB-02, WEB-03, WEB-04 | 4 | P1 |
| **ITL-5** | Positioning Truth-Up | Every claim the product makes is true | POS-01, POS-02, POS-03 | 4 | P0 (stop-claiming) / P2 (rest) |

**29 requirements, each mapped to exactly one phase (100% coverage).** OPS-01/02/03 are cross-cutting operating rules (see REQUIREMENTS.md), applied to every phase. Completeness + evidence protocol: `COVERAGE-AND-EVIDENCE.md`.

**Dependency order:** ITL-0 first (launch-blocking) · ITL-2 before ITL-3 (measure before you feed forward) · ITL-4 (web research + web-learning) depends on ITL-0's grounding + safety, and its WEB-04 corpus-growth feeds KNOW/RAG · ITL-5's "stop claiming" slice runs alongside ITL-0, its "say what's true / self-documenting" slice lands after the real capabilities exist. Note: ITL-3 (improve from own outcomes) and ITL-4 WEB-04 (improve from new web knowledge) are the two self-improvement engines.

---

## ITL-0 · Knowledge Integrity & Grounding
**Goal:** make "grounded in real knowledge" actually true in production, and make the system honest the moment it is not. This is the launch-blocking phase.
**Requirements:** KNOW-01, KNOW-02, KNOW-03, KNOW-04, GRND-01, GRND-02

**Work:**
- **Verify + wire prod RAG (KNOW-01).** Founder runs `SELECT count(*) FROM role_knowledge` on prod + confirms embedding key. Add a startup/health assertion that logs (and optionally alerts via the existing ops webhook) if the corpus is empty or the embed key is missing. RAG must not be able to be silently off in prod.
- **Kill the silent-empty fallback (KNOW-02).** Wire the dead `miss` knowledge-gap flag into telemetry; when retrieval returns nothing, that is recorded and (feeding ITL-5/POS-02) the grounding state is observable, never invisible.
- **Freshness (KNOW-03).** Use `source_date` in ranking (recency weight) and/or render an honest "as of <date>"; stop presenting old frameworks as current.
- **Re-ingest path (KNOW-04).** A documented, repeatable refresh/expand procedure, including re-embed on provider change.
- **Enforce cite-or-admit (GRND-01).** Post-generation validation on the chat path: any cited URL/source must appear in the retrieved chunks, else strip or flag it.
- **Unsupported-claim guard (GRND-02).** Flag high-risk factual claims (%, $, "studies show") in outward-facing output that retrieval does not support, reusing the `OUTWARD_OR_FACTUAL` detector.

**Success criteria:**
1. Production provably retrieves from a populated corpus, or loudly fails/alerts if it cannot (no silent empty).
2. A retrieval miss is recorded as a signal, not swallowed.
3. Source recency measurably affects ranking or is honestly surfaced.
4. A cited source that was not retrieved is stripped or flagged before the user sees it (verified live).
5. There is a repeatable, documented way to refresh the corpus.

## ITL-1 · Deep Grounding
**Goal:** every document a user provides is genuinely searchable, not partially ignored.
**Requirements:** KNOW-05, KNOW-06

**Work:**
- **Brain docs → real RAG (KNOW-05).** Replace the ~2,000/6,000-char truncation dump with embed + retrieve, so long brain documents are fully searchable. Confirm the cost guard covers the added embedding cost (open decision #4).
- **Unify grounding paths (KNOW-06).** One retrieval contract behind both attachments and brain docs so grounding behaves identically regardless of where a document lives.

**Success criteria:**
1. A question about content deep inside a long brain document is answered correctly (verified live with a real long doc).
2. Attachments and brain docs use the same retrieval path.
3. Re-embedding brain docs is covered by the cost guard.
4. No regression to the existing attachment RAG behavior.

## ITL-2 · Quality Measurement
**Goal:** measure quality for EVERY surface, prove the measurement itself works, hold a frozen benchmark, and detect improvement. Not a dashboard: a measurement system. Prerequisite for ITL-3. Full methodology in `ITL-2-MEASUREMENT-DESIGN.md` (three fidelities, quality taxonomy, golden set, improvement detection, judge validation).
**Requirements:** MEAS-01, MEAS-02, MEAS-03, MEAS-04, MEAS-05, MEAS-06, MEAS-07, MEAS-08, MEAS-09

**Work (build order matters, see design doc):**
- **Aggregate captured signals for everything (MEAS-01).** Layer B on 100% of traffic: peer-review verdicts, reader-tests, reactions, rubric scores, retrieval hit/miss, into a queryable trend by surface/role/project/time. Cheapest, uses signals we already have.
- **Retrieval telemetry (MEAS-02).** Log fired/empty, score distribution, contributing roles; powers ITL-0's prod-health story.
- **Frozen golden-set benchmark (MEAS-05).** 80 to 150 versioned representative inputs with rubrics; run through the LIVE system on a cadence, judge-scored (Layer C), per-dimension/role/overall. The stable ruler.
- **Validate the judge FIRST (MEAS-07).** Calibrate the quality judge against human labels (cross-model, like the peer-review judge's 0% false-block/100% catch) and track drift, before trusting any judge number.
- **Operator surface + trendline (MEAS-03).** A decomposable per-surface/per-dimension quality view + the trendline, once real data exists. Every number real or absent.
- **Improvement detection (MEAS-06).** Trendline + regression gate (generalize the Phase-36 auto-revert) + A/B counterfactual harness (generalize the competence A/B). Becomes ITL-3's acceptance mechanism.
- **Fold in the genuine evals (MEAS-04).** Competence A/B, blind-voice, judge-calibration run on the benchmark cadence with committed dated results; label/retire the structural proxies.
- **Build the Quality & Health Matrix (MEAS-08).** The surface-by-band traffic-lit grid (`ITL-2-QUALITY-MATRIX.md`) as the operator surface + coverage gate; no P0 surface RED in WORKING or PRODUCING-WELL.
- **Close the signal gaps the matrix exposes (MEAS-09).** `memory_recalled` event, error/empty-rate aggregation, writer provider/model on deliverables + tasks, RAG retrieval-quality signals.

**Success criteria:**
1. Every surface in the taxonomy has Layer A + B measurement live; the judge runs sampled-live and full-on-benchmark.
2. A frozen, versioned golden set runs on a cadence, producing per-dimension, per-role, and overall scores.
3. The judge is calibrated against human labels with recorded agreement before its scores are trusted; drift is tracked.
4. An operator sees the quality trendline and can drill into any drop by surface and dimension, no fabricated numbers.
5. A regression that lowers the benchmark is flagged or blocked; a capability can be A/B-proven to improve quality (shown on RAG, ready for ITL-3).
6. The offline benchmark is shown to track live signals, or the divergence is surfaced as a benchmark-refresh action.
7. The Quality & Health Matrix is populated live for every surface and band, with no P0 surface RED, and every previously-MISSING signal it named (memory recall, error rate, per-provider quality, RAG quality) is now LIVE.

## ITL-3 · Real Learning Loop
**Goal:** make "self-improving" true, a bad outcome measurably improves the next task. Depends on ITL-2.
**Requirements:** LEARN-01, LEARN-02, LEARN-03, LEARN-04, LEARN-05

**Work:**
- **Outcome-based growth loop (LEARN-01).** Feed a task's quality outcome (peer-review verdict, reader-test, rubric, feedback) forward into the same role's future prompts as concrete lessons, not aggregate numbers.
- **Content-aware personality (LEARN-02).** Carry WHAT was wrong into the adaptation signal; stop discarding message content.
- **Retire/wire trainingSystem (LEARN-03).** Persist + mount it, or remove it; no dead pseudo-loop.
- **Cross-agent learning (LEARN-04).** Make one agent's lesson available to relevant peers, scoped safely.
- **Guardrails (LEARN-05).** Bounded, reversible, A/B-verifiable; prove improvement against ITL-2's metrics, no fabricated improvement claims.

**Success criteria:**
1. An agent that received a "revise/reject" on a task does the next comparable task measurably better (A/B against ITL-2 metrics, verified live).
2. A thumbs-down changes substance, not just tone dials.
3. No dead learning code remains (trainingSystem resolved).
4. A lesson learned once is reusable by relevant peers.
5. The loop is bounded and reversible; improvement is proven, not assumed.

## ITL-4 · Live Web Research & Web-Learning
**Goal:** agents genuinely use the internet: they search and read the web inside an answer, AND continuously learn new information from the web to grow their own knowledge over time. Committed build (D-3), not a decision. Depends on ITL-0's grounding + safety being in place (untrusted web content is injection surface). This is where "agents use browsers/the internet" and "agents keep improving themselves from the internet" become real.
**Requirements:** WEB-01, WEB-02, WEB-03, WEB-04

**Work:**
- **Live web research in-answer (WEB-01).** Search (candidate URLs/snippets) + page extraction (fetch + read the real content), incorporated into the current answer with cite-or-admit attribution.
- **Safe plumbing (WEB-02).** Tool-use/function-calling in the provider path + a real search + fetch provider, gated by cost guard + injection filtering (OWASP-LLM01) + per-user budget; honest fail-safe to the grounded/parametric answer on error or budget.
- **No half-wired path (WEB-03).** Activate the real path end-to-end; remove the dead `webClient.ts` remnants, the discarded toolRouter branch, and the stubbed world-sensor.
- **Continuous web-knowledge acquisition (WEB-04).** Agents fetch + extract new info from the web and grow the role/project knowledge base over time (fixes KNOW-03 staleness at the source): injection-safe on ingest, cite-or-admit, cost-guarded, deduped, and the growth measured (new-chunks/week + retrieval-hit-rate improvement). The "keeps getting smarter using the internet" loop.

**Success criteria:**
1. An agent incorporates a live web search + page read into the current answer, cost- and injection-guarded, with an honest fallback (verified live).
2. No half-wired web code remains; the path that exists is the path that runs.
3. Agents autonomously add new, deduped, injection-checked knowledge from the web to the corpus, and the corpus provably grows (verified live: new chunks appear, a later query retrieves them).
4. Web-sourced knowledge follows cite-or-admit and is measured (growth + hit-rate), no fabricated freshness.

## ITL-5 · Positioning Truth-Up
**Goal:** every claim the product makes is true. UI-approval-gated per the UI-change protocol.
**Requirements:** POS-01, POS-02, POS-03

**Work:**
- **Stop-claiming slice (POS-01): URGENT, run alongside ITL-0.** Remove "live web search" and "self-improves / learns from mistakes" from landing, marketing, UpgradeModal, and in-product copy; replace with true claims (remembers, grounded, self-reviews).
- **Self-documenting knowledge state (POS-02).** Honest in-product signal of "from your knowledge base" vs "from general knowledge," powered by KNOW-02. Lands after ITL-0.
- **Fix agent count (POS-03).** Single source of truth for the role count (or "30+"); fix the stale "30."

**Success criteria:**
1. No public or in-product copy implies a capability the code does not have (verified against the ITL-0..4 outcomes).
2. Where relevant, users can tell whether an answer was grounded or general.
3. The advertised agent count matches reality from a single source.
4. All copy changes went through the UI-approval protocol (screenshots + approval before edit).

---

## Traceability (requirement → phase)

| Requirement | Phase |
|---|---|
| KNOW-01, KNOW-02, KNOW-03, KNOW-04 | ITL-0 |
| GRND-01, GRND-02 | ITL-0 |
| KNOW-05, KNOW-06 | ITL-1 |
| MEAS-01, MEAS-02, MEAS-03, MEAS-04, MEAS-05, MEAS-06, MEAS-07, MEAS-08, MEAS-09 | ITL-2 |
| LEARN-01, LEARN-02, LEARN-03, LEARN-04, LEARN-05 | ITL-3 |
| WEB-01, WEB-02, WEB-03, WEB-04 | ITL-4 |
| POS-01, POS-02, POS-03 | ITL-5 |
| OPS-01, OPS-02, OPS-03 | cross-cutting (all phases) |

**Coverage:** 29/29 buildable requirements mapped to exactly one phase. 3 operating rules applied across all. Every found problem (from all audits) traces to one of these in `COVERAGE-AND-EVIDENCE.md`.

## Status
Not started. Authored 2026-08-13. Next action when the milestone becomes active: run the ITL-0 prod-RAG check (founder), then `gsd-plan-phase` ITL-0 (or hand-author its PLAN.md in this dir) once v2.1 / v2.2 close and the branch is clean enough to promote.
