# Requirements: Hatches That Actually Learn & Know

> Milestone-scoped, additive. 2026-08-13. Every requirement traces to a code-verified finding from the deep intelligence audit (artifact b00e317e). 29 requirements across 7 categories. Each is mapped to exactly one phase in `ROADMAP.md`. MEAS expanded (MEAS-05/06/07 per `ITL-2-MEASUREMENT-DESIGN.md`; MEAS-08/09 per `ITL-2-QUALITY-MATRIX.md`). WEB committed to a build + WEB-04 continuous web-learning added (D-3, founder 2026-08-13). Completeness + the evidence protocol are in `COVERAGE-AND-EVIDENCE.md` (every found problem maps to a requirement; every fix ships runtime proof).

## Legend
- **Priority:** P0 (launch-blocking) · P1 (core value) · P2 (important, not blocking)
- Each requirement names the **audit finding** it fixes and the **evidence** (file:line where known).

---

## KNOW: Knowledge base is real, current, and honest when empty

**KNOW-01 (P0): Production RAG must be verifiably live.**
`role_knowledge` must be populated in the production database, the embedding key set in prod env, and a startup/health assertion must confirm corpus presence and log/alert if it is empty. Today the corpus is proven only on isolated dev servers; `CLAUDE.md` says "RAG not yet wired into the prod deploy," so prod may retrieve nothing.
*Evidence:* retriever.ts `rolesWithCorpus()`; store.ts; CLAUDE.md 2026-08-03 note.

**KNOW-02 (P0): No silent-empty fallback.**
When retrieval returns nothing, the system records a knowledge-gap signal (wire the existing dead `miss` flag, currently computed and never read) and the agent's grounding state becomes observable rather than invisible. A user must never receive a pure-parametric answer that is indistinguishable from a grounded one.
*Evidence:* retriever.ts:185-186 (`miss` never read), :42-46/:224-227 (silent `[]`/`''` on any failure).

**KNOW-03 (P1): Freshness / recency.**
`source_date` (already stored) must be USED at ranking time (a recency weight) and/or surfaced as an honest "as of <date>" so decades-old material does not compete with current material on cosine similarity alone and is not presented as current.
*Evidence:* retriever.ts:62,252 (source_date rendered only in citation string, never ranked); seed dates skew 2024-2025 but include 2005-2021 and older.

**KNOW-04 (P1): Repeatable re-ingest path.**
A documented, repeatable way to refresh and expand the corpus (not a one-off script buried in git history). Includes a way to re-embed if the embedding model/provider changes (one-vector-space rule).
*Evidence:* corpus ingested once via scripts/ingest-role-knowledge.ts + seed batch-*.json; no scheduled/cron re-ingest exists.

**KNOW-05 (P1): Project brain documents use real RAG, not truncation.**
The brain-KB path currently slices raw text (~2,000 chars/doc, ~6,000 total) into the prompt, so a question about page 180 of a long brain doc never reaches the model. Replace with embed + retrieve (the same path attachments already use).
*Evidence:* openaiService.ts:285-305 (`MAX_DOC_CHARS=2000`, `knowledgeBudget=6000` truncation dump).

**KNOW-06 (P2): Unify the two grounding paths.**
Attachments use real RAG (conversationDocs.ts); brain docs use truncation. Collapse both behind one retrieval contract so grounding behaves consistently regardless of where the document lives.
*Evidence:* conversationDocs.ts (RAG) vs openaiService.ts:285-305 (dump).

---

## GRND: Grounding is enforced, not just requested

**GRND-01 (P0): Cite-or-admit ENFORCED on the chat path.**
Cite-or-admit is currently prompt-instruction only, with zero output-side validation. Add a post-generation check that validates any cited URL/source against the actually-retrieved chunks and strips or flags fabricated citations.
*Evidence:* openaiService.ts:453 (prompt rule only); responsePostProcessing.ts handles tone/format only; governance.ts `missing_citations` governs the background loop, not live chat.

**GRND-02 (P1): Unsupported-factual-claim guard for outward-facing content.**
A lightweight check (heuristic or a cheap judge) that flags high-risk factual claims (%, $, "studies show," specific numbers) not backed by retrieval, at least for outward-facing / factual output. Reuses the existing `OUTWARD_OR_FACTUAL` detector already used for peer-review coverage.
*Evidence:* taskExecutionPipeline.ts `OUTWARD_OR_FACTUAL` regex; no runtime hallucination guard on chat.

---

## MEAS: Agent quality is measured, continuously, for every surface

> Methodology in `ITL-2-MEASUREMENT-DESIGN.md`: measure everything at three fidelities (structural gates + captured signals on 100% of traffic, LLM-judge sampled-live + full-on-benchmark); define quality per surface (taxonomy); freeze a benchmark; detect improvement three ways; and validate the judge itself.

**MEAS-01 (P1): Aggregate the captured quality signals across EVERY surface into a watchable trend.**
Peer-review verdicts (approve/revise/reject), reader-test results, thumbs reactions, frozen-rubric scores, and retrieval hit/miss are produced today but discarded per-event. Aggregate them (Layer B, 100% of traffic) into a queryable quality trend by surface / role / project / time. Coverage is "everything": chat replies, deliverables, autonomy tasks, retrieval, routing, memory (see the taxonomy in the design doc), not just chat.
*Evidence:* only aggregator is the manually-run scripts/benchmark-suite.ts (last committed 2026-03-28); runtime stats endpoint tracks only task/handoff/cost (autonomy.ts:719-775).

**MEAS-02 (P1): Retrieval telemetry.**
Log every retrieval: fired vs empty, score distribution, top-score, which roles contributed. Makes "is RAG working in prod" answerable from data, and directly powers KNOW-01/KNOW-02.
*Evidence:* no runtime retrieval instrumentation today (only offline test-rag-* scripts).

**MEAS-03 (P2): Operator quality surface.**
A minimal internal surface (endpoint or admin view) that shows the quality trend, retrieval hit-rate, and review pass/revise/reject mix, so quality is watchable without running a script. Honors "no fabricated proof": every number is real or absent.
*Evidence:* extends the task/handoff/cost-only stats endpoint.

**MEAS-04 (P2): Revive the genuine evals as a runnable, dated gate.**
Keep the real quality evals (competence A/B, blind-voice attribution, peer-review/reader-test judge calibration) current with committed, dated results; ideally a lightweight CI/cron. Retire or clearly label the structural proxies so their numbers are not mistaken for quality.
*Evidence:* eval/results newest 2026-05-04; no CI (.github/workflows absent); eval:bench = keyword regex; eval:routing = deterministic router, no model.

**MEAS-05 (P1): A frozen, versioned quality benchmark (the golden set).**
Improvement is only provable against a stable ruler. Build a frozen, versioned set of 80 to 150 representative inputs spanning all roles, task types, difficulty, and known edge cases (hallucination traps, injection, cite-or-admit triggers, memory recall), each with a rubric (what a 5 looks like) and reference key-points. Run it through the LIVE system on a cadence, Layer-C judge-scored, producing overall + per-dimension + per-role scores. Versioned so scores stay comparable; judge version tracked. Generalizes the Phase-36 frozen-rubric discipline from deliverables to the whole intelligence layer.
*Evidence:* Phase 36 frozen rubrics (deliverable-only); competence A/B golden pattern exists but is a tiny fixed set run once per session.

**MEAS-06 (P1): Improvement detection: trendline + regression gate + A/B counterfactual.**
Three mechanisms: (a) a trendline of benchmark score over time (overall/role/dimension) that answers "are we improving?"; (b) a regression gate that flags or blocks a change dropping the benchmark below the rolling baseline beyond noise (generalize the Phase-36 auto-revert-on-regression pattern); (c) an A/B counterfactual harness that runs the benchmark with a capability ON vs OFF and judges the delta, so a feature is PROVEN to improve quality, not assumed. This becomes the acceptance mechanism for ITL-3 (the learning loop only counts if it clears the A/B on the benchmark, ties to LEARN-05).
*Evidence:* competence A/B (RAG on/off, 4.40 to 5.00) is the counterfactual method today but manual and RAG-only; no continuous trendline or regression gate for the intelligence layer.

**MEAS-07 (P1): Validate the measurement itself (judge calibration + drift).**
The LLM judge's scores are only trustworthy if the judge is validated: calibrate it against a human-labeled subset and require high agreement before trusting its numbers, keep it a different model family than the writer (anti self-preference), and re-calibrate on a cadence tracking judge-vs-human agreement (drift). No number is shown that the judge has not been validated to produce; a benchmark that did not run shows "not run," never a stale or invented score (OPS-03).
*Evidence:* peer-review judge already meets this discipline (0% false-block / 100% catch on a labeled set); apply the same to the quality judge, which does not exist yet.

**MEAS-08 (P1): The Quality & Health Matrix (coverage view + operator surface + coverage gate).**
Build the surface-by-band matrix in `ITL-2-QUALITY-MATRIX.md` as a live artifact: every intelligence surface (chat, deliverable, autonomy task, peer review, RAG, routing, memory, system) across five bands (WORKING, PRODUCING WELL, SAFE, OUTCOME, EFFICIENT), each cell traffic-lit (LIVE / RAW / MISSING) with its data source, target, and segment-by. It is three things at once: the coverage view (RED cells are the gap list), the operator surface (MEAS-03 renders it, drillable), and a **coverage gate**, no P0 surface ships with a RED cell in the WORKING or PRODUCING-WELL bands. Segmentable by role, tier, pack, project, and which model actually ran.
*Evidence:* the matrix has no equivalent today; the two grounding inventories (operational + quality) are its seed data.

**MEAS-09 (P1): Close the signal gaps the matrix exposes.**
Instrument the MISSING cells: (a) a `memory_recalled` event so memory recall stops being a lost signal (biggest gap); (b) error/empty-rate aggregation (today errors are per-event only, no rate); (c) writer provider/model recorded on deliverables + tasks (today only chat `messages.metadata.llm` has it), so per-provider quality is answerable on every surface, not just chat; (d) RAG retrieval-quality signals (precision, used-in-answer), building on ITL-0 T2's hit/miss. Cross-references ITL-0 KNOW-02 and MEAS-02 to avoid duplication.
*Evidence:* memory recall LOST (only `memory_written` exists); error rate MISSING; writer model absent on `deliverable_versions`/`tasks`; RAG precision/used MISSING (from the grounding inventories).

---

## LEARN: Agents genuinely improve from outcomes

**LEARN-01 (P1): Outcome-based growth loop.**
A past task's quality outcome (peer-review verdict, reader-test result, rubric score, user feedback) feeds forward into the SAME agent/role's future prompts as concrete, actionable lessons, not just aggregate numbers. This is the mechanism that makes "self-improving" true; it is currently deferred and absent.
*Evidence:* no peer-review/rubric/reader-test injection in openaiService.ts or promptTemplate.ts; the only forward-feed (deliverableFeedbackAggregator) injects aggregate numbers, deliverable-only, needs ≥3 finalized deliverables.

**LEARN-02 (P1): Content-aware personality adaptation.**
Feedback must carry WHAT was wrong (the message content), so a thumbs-down teaches substance, not just nudges 6 coarse tone dials. Today empty strings are passed and the content is discarded.
*Evidence:* messages.ts:309-310 (empty content passed, "content-aware adaptation deferred"); personalityEvolution.ts:292-321 (±0.02/0.04 dial nudges only).

**LEARN-03 (P2): Retire or genuinely wire the dead `trainingSystem`.**
It injects "successful/avoid patterns" into prompts but its storage is in-memory (wiped every restart) and its only UI writer (`MessageFeedback.tsx`) is not mounted. Either persist it and mount the writer, or remove it so it stops masquerading as a learning loop.
*Evidence:* trainingSystem.ts:52 (in-memory); MessageFeedback.tsx not imported anywhere; openaiService.ts:236 consumes it.

**LEARN-04 (P2): Cross-agent learning ("learn from each other").**
A lesson from one agent's reviewed work (or a peer-review verdict) is made available to relevant peers, scoped safely, so the "learn from each other" claim has a real substrate.
*Evidence:* no cross-agent lesson transfer exists; peer review polices the current task then discards the lesson.

**LEARN-05 (P1): Growth-loop guardrails.**
The loop must not degrade quality or drift: changes are bounded, reversible, measurable (ties to MEAS-01), and A/B-verifiable so "improvement" is provable, not assumed. No fabricated improvement claims.
*Evidence:* new; required so LEARN-01 cannot silently make agents worse.

---

## WEB: Agents use the internet, and learn from it (committed build)

> Decision made (D-3, founder, 2026-08-13): live web is a COMMITTED capability, not a "maybe." Agents search and read the web inside an answer (WEB-01/02/03), AND continuously learn new information from the web to grow their own knowledge over time (WEB-04). WEB-04 is the fusion of "uses the internet" and "keeps improving itself," and it currently exists only as dead code.

**WEB-01 (P1): Live web research inside an answer.**
When a question needs current or external information, the agent can search the web and read the relevant page(s), and incorporate the result into the CURRENT answer (not a future card), with source attribution under cite-or-admit. Covers both search (get candidate URLs/snippets) and page extraction (fetch + read the actual content).
*Evidence:* no live web access today; the `webClient.ts` DuckDuckGo path is gated off + post-response; `toolRouter` decides "web" then discards it (chat.ts:2644-2666).

**WEB-02 (P1): The safe plumbing (tool-use + guards).**
Wire tool-use/function-calling into the provider path with a real search + fetch provider, gated by the cost guard + injection filtering (untrusted web content is prompt-injection surface, OWASP-LLM01) + a per-user budget. Fail-safe: on error or budget, degrade honestly to the grounded/parametric answer and say so. Reuse `costGuard.ts` and `uploadSecurity.ts`/conversation-doc injection-drop patterns.
*Evidence:* providers have zero `tools` arrays; costGuard.ts + injection-filter patterns already exist to reuse.

**WEB-03 (P2): No half-wired web path.**
Activate the real path end-to-end and remove the dead-gated `webClient.ts` remnants + the discarded `toolRouter` branch + the stubbed world-sensor, so the codebase reflects reality (no code that pretends to browse but doesn't).
*Evidence:* webClient.ts (gated off, post-response), backgroundRunner.ts world-sensing stub, toolRouter.ts unused decision.

**WEB-04 (P1): Continuous web-knowledge acquisition (agents keep improving themselves from the internet).**
Agents autonomously (and on-demand) fetch and extract new information from the web and grow the role/project knowledge base over time, so the corpus stops being frozen at its Aug-2026 ingest (fixes the KNOW-03 staleness at the source). Injection-safe on ingest, cite-or-admit, cost-guarded, deduped against the existing corpus, and the growth is measured (new-chunks/week, and whether retrieval hit-rate improves, ties to MEAS). This is the true "keeps getting smarter using the internet" loop; today it is only a dead attempt (the AKL / `webClient` write "UpdateCards" but are gated off and never touch `role_knowledge`).
*Evidence:* server/knowledge/akl/runner.ts (gated, writes future cards only, never refreshes `role_knowledge`); backgroundRunner world-sensing stub returns empty. Feeds KNOW (corpus growth) and complements LEARN-01 (which improves from the agent's OWN outcomes; WEB-04 improves from NEW external knowledge).

---

## POS: Positioning tells the truth

**POS-01 (P0): Correct all external claims.**
Landing, marketing, UpgradeModal, and in-product copy must not imply live web search or autonomous self-improvement that is not real. Replace with what is true: remembers your project + working style, grounded in a curated knowledge base + your docs, a second specialist reviews the work. UI-approval-gated per the UI-change protocol.
*Evidence:* audit positioning table; claims vs verified capabilities.

**POS-02 (P2): Self-documenting knowledge state in-product.**
Where relevant, the UI honestly signals "answered from your knowledge base" vs "from general knowledge" (powered by KNOW-02), so users are not misled about grounding. Self-documenting per the founder's UI rule. UI-approval-gated.
*Evidence:* ties to KNOW-02; no grounding indicator exists today.

**POS-03 (P2): Fix the stale agent count.**
Marketing says "30 agents" but there are 34-35 real roles (Add-Hatch picker shows 33). Single source of truth or "30+". Understates the product and is internally inconsistent. (Also re-audit finding F5.)
*Evidence:* UpgradeModal.tsx:51, LandingBento.tsx:32, LandingPage.tsx:469 vs roleRegistry/roleIntelligence (35 entries).

---

## OPS: Operating rules (cross-cutting, apply to every phase)

**OPS-01: Verify in runtime, with a durable evidence entry (the evidence protocol).** No requirement is "done" until it has an evidence entry answering three questions, each with a re-runnable proof, not a claim: (1) fixed? the diff + `tsc` clean; (2) working? demonstrated on a live restarted server with real providers where the claim needs it, via a named command / test / eval / real-browser run with its output, plus a before/after where behavior changes; (3) how? a short mechanism explanation + the file:line. Entries accumulate in `EVIDENCE-LEDGER.md`, and a fix is only real when its matrix cell (MEAS-08) flips to LIVE. "Getting smarter" is proven only by the ITL-3 A/B delta on the frozen benchmark (MEAS-06), never asserted. A change that cannot be demonstrated live is labeled "code-shipped, runtime-pending," not done. Full protocol + the completeness coverage map in `COVERAGE-AND-EVIDENCE.md`. (Per `feedback_verify_in_runtime`.)

**OPS-02: Parallel-safety + additive.** Authored milestone-scoped; do not touch top-level `STATE.md` / `ROADMAP.md` / `REQUIREMENTS.md` or another session's phase dirs while v2.1 / v2.2 are in flight. Re-read hot files before editing; edit only in-scope files; no git ops or process kills without explicit ask. Promote to top-level GSD on a clean milestone transition.

**OPS-03: No fabricated proof.** Any user-facing metric, benchmark, or capability claim is real or absent. This is the whole reason the milestone exists; it must not itself introduce an unearned number.

---

## Open decisions
1. **Prod RAG populated?** (gates KNOW-01): founder runs the one-line count. Highest-impact unknown.
2. **Web search: RESOLVED (D-3, build).** Committed as a build (WEB-01..04). Remaining sub-choice: which search + fetch provider (a search API like Brave/Tavily/Serper, plus fetch+readability or a headless browser for page extraction). Confirm provider + budget before WEB-02.
3. **Learning-loop substance vs. safety appetite** (LEARN-01/05): how aggressively should past outcomes rewrite future prompts, given drift risk? Bounded + measured either way.
4. **Embedding cost of brain-docs RAG** (KNOW-05): re-embedding user brain docs adds embedding-API cost; confirm the cost guard covers it.

## Out of scope (this milestone)
- Fine-tuning or training custom per-role models (needs 10K+ examples; not now).
- Replacing the LLM providers or the RAG store.
- Multi-tenant / horizontal-scale concerns (separate track).
- The pre-launch hardening Tier-0 items (PITR, Sentry, migration baseline): tracked separately in `project_prelaunch_hardening_remaining`.
- Product analytics for acquisition/activation funnels (that is the marketing-plan / growth track; MEAS here is specifically agent-quality, not funnel).
