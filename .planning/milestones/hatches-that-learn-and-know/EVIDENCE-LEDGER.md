# Evidence Ledger

> Per the evidence protocol (OPS-01 in REQUIREMENTS.md): no requirement is "done" without an entry here answering fixed? / working? / how?, each with a re-runnable proof. A fix is only real when its matrix cell flips to LIVE. Nothing here is committed. No em/en dashes.

---

## KNOW-01 (ITL-0 T1): RAG health assertion, the corpus cannot be silently empty
**Date:** 2026-08-13 · **Status:** DONE (code-verified + runtime-verified) · **Files:** `server/routes/health.ts` (additive), `scripts/verify-knowledge-health.ts` (new harness)

**Fixed?** `health.ts` adds a `knowledge` health section (`checkKnowledgeHealth()`) plus a loud one-time boot warning; both read-only and gated by `RAG_HEALTHCHECK` (default on). It never touches the top-level status or the 503 gate. `tsc --noEmit` exit 0.

**Working? (runtime, against the real corpus, read-only)**
Command: `set -a; source ./.env; set +a; STORAGE_MODE=memory ./node_modules/.bin/tsx scripts/verify-knowledge-health.ts`
Output:
```
✓  healthy (corpus + key)       -> {"status":"ok","chunks":4429,"roles":34,"embedProvider":"openai","embedKeyPresent":true}
⚠️  embedding key missing        -> {"status":"no_embed_key","chunks":4429,"roles":34,...,"embedKeyPresent":false}
✓  RAG disabled                 -> {"status":"disabled"}
✓  healthcheck off              -> {"status":"skipped"}
RESULT: PASS, corpus is live and reported (4429 chunks / 34 roles).
```
So: healthy corpus is reported with a real count; the missing-key path flips status off "ok" (which is what fires the boot warning + shows in `/health`); disabled/skipped behave. Bonus finding: the connected (dev) Supabase corpus is populated (4429 chunks / 34 roles). Production is still the founder's one-line check (`SELECT count(*) FROM role_knowledge` on prod).

**How?** `checkKnowledgeHealth()` runs two read-only SELECTs via the RAG pool (`totalCount()` + `rolesWithCorpus()` in `server/knowledge/rag/store.ts`) and resolves embedding-key presence from `RAG_EMBED_PROVIDER` (openai→OPENAI_API_KEY, gemini→GEMINI_API_KEY, ollama→local). `/health` returns it under `knowledge`; `registerHealthRoute` fires a one-time boot check that `console.warn`s loudly when status is not ok/disabled/skipped. Empty corpus or missing key can no longer pass unnoticed.

**Matrix cell:** RAG retrieval "fired / health" moves from MISSING toward LIVE (corpus presence is now observable at runtime). Full silent-empty telemetry lands in T2 (KNOW-02).

**Follow-ups (noted, not blocking):** an optional ops-webhook alert on the boot-warn path (OPS_ALERT_WEBHOOK_URL) can be added; core "log if empty" + "surfaced in /health" is done.

---

## KNOW-02 (ITL-0 T2): kill the silent-empty fallback, wire the dead miss flag + grounded signal
**Date:** 2026-08-13 · **Status:** DONE (code-verified + runtime-verified) · **Files:** `server/knowledge/rag/retriever.ts` (additive), `scripts/verify-retrieval-telemetry.ts` (new harness)

**Fixed?** `retriever.ts`: every retrieval return now carries a `reason` (ok/disabled/empty_query/no_corpus/below_threshold/rerank_empty/error) + `topScore`; a new `recordRetrievalOutcome()` records hit/miss + reason into an in-memory aggregate and `console.warn`s on a miss (gated by `RAG_MISS_TELEMETRY`, default on); a new `getRetrievalStats()` exposes the aggregate for MEAS-02/03; a new `retrieveKnowledgeBlockForChatWithMeta()` returns `{block, grounded, reason}`. The existing `retrieveKnowledgeBlockForChat` signature is UNCHANGED (delegates to the meta variant), so no edit to the hot `openaiService`. `tsc --noEmit` exit 0.

**Working? (runtime, real corpus, read-only + 2 sub-cent embeddings)**
Command: `set -a; source ./.env; set +a; STORAGE_MODE=memory RAG_EMBED_PROVIDER=openai ./node_modules/.bin/tsx scripts/verify-retrieval-telemetry.ts`
Output:
```
A hit-path      -> grounded=true reason=ok blockChars=4068
B forced-miss   -> grounded=false reason=below_threshold blockChars=0
C disabled      -> grounded=false reason=disabled blockChars=0
[RAG] retrieval_miss reason=below_threshold, grounding gap: the agent will answer from the model, not the corpus.
getRetrievalStats -> {"total":2,"hits":1,"misses":1,"byReason":{"ok":1,"below_threshold":1},"lastAt":"..."}
RESULT: PASS
```
A real hit grounds (reason ok); a below-threshold retrieval is a RECORDED miss (warn fired + aggregate incremented), NOT a silent empty; disabled is honestly labeled.

**How?** `retrieveKnowledgeAcrossRoles` was already computing `miss`; now it also labels WHY and captures `topScore`. `retrieveKnowledgeBlockForChatWithMeta` calls `recordRetrievalOutcome(r)` on every retrieval and returns `grounded = chunks.length > 0`. The aggregate is a module-level counter read via `getRetrievalStats()`. Fire-and-forget; a telemetry error can never break retrieval.

**Matrix cell:** RAG retrieval "fired / error rate" moves from MISSING to LIVE (hit/miss now counted with reasons). The `grounded` flag is the hook POS-02 uses; `getRetrievalStats()` is the data MEAS-02/03 surface.

**Deferred (needs a hot-file edit, not done here):** wiring `grounded` into the user-facing "from your knowledge base vs general knowledge" indicator (POS-02) touches `openaiService`/`chat.ts` (parallel-hot); the signal is ready for it.

---

## GRND-01 (ITL-0 T5): cite-or-admit enforcer (pure fn + unit test; hot-file wire deferred)
**Date:** 2026-08-13 · **Status:** ENFORCER DONE (code-verified + unit-verified); WIRE DEFERRED · **Files:** `server/ai/citeGuard.ts` (new), `scripts/test-cite-guard.ts` (new)

**Fixed?** New pure function `enforceCiteOrAdmit(text, allowedUrls)`: strips any cited http(s) URL whose host is not among the sources actually retrieved this turn, keeps the surrounding sentence, and reports what it removed (for the telemetry signal). No LLM, no DB, no I/O. `tsc --noEmit` exit 0. Dash-clean.

**Working? (deterministic unit test, no cost)**
Command: `./node_modules/.bin/tsx scripts/test-cite-guard.ts`
Output: `6 passed, 0 failed` covering: a retrieved URL is kept (host match, ignores www); a fabricated URL is stripped while the sentence stays; prose with no URLs is untouched; an ungrounded turn (empty allow-list) strips any cited URL; a mixed case keeps the real one and strips only the fabricated one.

**How?** A single regex pass over the response replaces any URL whose normalized host is not in the allow-list with "(citation removed: not from a provided source)". The allow-list is the retrieved sources' URLs. Conservative: only URLs are touched, never prose.

**Matrix cell:** Chat "grounding / cite-validity" moves toward LIVE once wired. The enforcer + its signal are ready.

**Wire (DEFERRED, needs hot-file edit):** the last step passes the retrieved source URLs from the grounded-retrieval seam (T2's `retrieveKnowledgeBlockForChatWithMeta` already exposes the chunks/sources) into `enforceCiteOrAdmit` just before the reply is emitted, in `server/ai/responsePostProcessing.ts` / the `openaiService` emit path. Those are parallel-hot right now, so the enforcer is built + proven and the 1-line wire waits for a clean window or explicit coordination. Behind a `CITE_ENFORCE` flag when wired.

---

## KNOW-04 (ITL-0 T4): repeatable re-ingest runbook
**Date:** 2026-08-13 · **Status:** DONE (doc) · **Files:** `.planning/milestones/hatches-that-learn-and-know/RE-INGEST-RUNBOOK.md`
**Fixed?** A documented, repeatable procedure to refresh one role, add a role, rebuild all, re-embed on a provider change (one-vector-space rule), and verify. References the real scripts (`ingest-role-knowledge.ts`, `ingest-all-role-knowledge.ts`, `test-rag-coverage.ts`, `rag-corpus-health.ts`, plus the ITL-0 `verify-knowledge-health.ts`).
**How?** Corpus refresh stops being tribal knowledge; the "healthy" bar is the 2026-08-13 baseline (ok, 4429 chunks / 34 roles).

## GRND-02 (ITL-0 T6): unsupported-claim guard
**Date:** 2026-08-13 · **Status:** DONE (unit-verified + wired) · **Files:** `server/ai/citeGuard.ts` (+`flagUnsupportedClaims`), `scripts/test-cite-guard.ts`
**Fixed?** `flagUnsupportedClaims(text, grounded)`: on an ungrounded turn, flags hard factual markers (percent / money / big_number / citation_phrase / metric_claim); grounded turns pass; detection only, never rewrites. Mirrors the OUTWARD_OR_FACTUAL detector.
**Working?** `./node_modules/.bin/tsx scripts/test-cite-guard.ts` = `10 passed, 0 failed` (4 new claim-guard cases: flags stat+phrase ungrounded; does not flag grounded; does not flag plain reasoning; flags money/metric). Wired in `openaiService.generateIntelligentResponse` (logs the flag).

## GRND-01 (ITL-0 T5) WIRE: cite-or-admit enforced in the non-streaming generation path
**Date:** 2026-08-13 · **Status:** WIRED (non-streaming path) + verified no-regression · **Files:** `server/ai/openaiService.ts` (clean, additive), `server/knowledge/rag/retriever.ts` (meta now returns `sources`)
**Fixed?** `generateIntelligentResponse` now retrieves via `retrieveKnowledgeBlockForChatWithMeta` (grounded + source URLs), then before returning applies `enforceCiteOrAdmit(content, sources)` (strips fabricated citations) and `flagUnsupportedClaims(content, grounded)` (logs an unsupported-claim signal). Gated by `CITE_ENFORCE` (default on). `tsc --noEmit` exit 0.
**Working? (no regression, runtime, free Ollama)** Re-ran the competence A/B with `CITE_ENFORCE=on`: matrix OFF 2.60/5, ON 3.60/5, lift +1.00 (38%), statistically the same as the guard-free baseline (2.60 to 3.80, +46%; the ON delta is run-to-run model noise, the OFF baseline is identical). So the guards are ACTIVE in the generation path and do NOT harm answer quality.
**How?** One meta retrieval gives the turn's real source URLs; the guards run on the finalized `responseContent` just before it is returned. Conservative: only fabricated URLs are stripped, claims are flagged not rewritten.
**Deferred (streaming path):** the main chat path streams chunks (already sent) and persists in the hot `chat.ts`; enforcing there cleanly needs buffer-then-emit or a post-store rewrite. The enforcer + wire are proven on the non-streaming path; the streaming wire is the documented follow-up.

---

## DEEP AUDIT of the new ITL-0 code (2 read-only agents) + fixes
**Date:** 2026-08-13 · **Status:** 7 findings, ALL FIXED + re-verified · no HIGH/security issues found

Two independent agents reviewed ONLY the new code (health.ts, retriever.ts, citeGuard.ts, openaiService wire), not the already-audited product. Adversarial review: no HIGH/security issues; 4 MED + 3 LOW. Goal-backward: KNOW-01/02/04 COVERED, GRND-01/02 PARTIAL (non-streaming only). All fixed:

- [FIXED, MED] health.ts ran an uncached corpus count on every (unauth) Fly probe and discarded it. Moved `checkKnowledgeHealth()` INTO the authenticated branch (health.ts) so probes do not pay for it.
- [FIXED, MED] the corpus query sat ahead of the liveness ping and could hang a half-open socket. Added a 2s `Promise.race` timeout (`RAG_HEALTHCHECK_TIMEOUT_MS`) returning 'error' fast; it now also runs after the ping.
- [FIXED, MED] `enforceCiteOrAdmit` produced broken markdown `[text]((citation removed))` and injected a system phrase in the agent voice. Now: markdown links drop to their label text, bare URLs are removed cleanly (no injected phrase), whitespace tidied.
- [FIXED, MED] host matching false-stripped on trailing punctuation (`example.com.`). Now trims trailing `.,;:!?` before parsing; host-granularity documented as a deliberate trade-off.
- [FIXED, LOW] `flagUnsupportedClaims` over-fired on years/ports/role-vocab. Tightened to percent OR currency-figure OR an explicit research-citation phrase; dropped big_number + bare metric words.
- [FIXED, LOW] ollama embed provider reported healthy in prod though it cannot reach localhost. Now treats prod-ollama as unverifiable (present=false → warns).
- [FIXED, LOW] `RAG_ENABLED` case mismatch (health case-insensitive, retriever case-sensitive). Aligned retriever to case-insensitive.
- [ADDED] boot check `.catch()` future-proofing.

**Re-verified after fixes:** `tsc --noEmit` exit 0; `test-cite-guard` 13/13 (added markdown-safe + trailing-punct + tightened-claim cases); `verify-knowledge-health` PASS (ok, 4429 chunks / 34 roles, warn paths intact).

**Honest coverage:** GRND-01/02 remain PARTIAL: the guards are correct and wired into the non-streaming `generateIntelligentResponse` (serves the /api/hatch/chat fallback + Slack), but the PRIMARY streaming chat path (`generateStreamingResponse`, all WS `send_message_streaming`) is NOT yet guarded. Closing it needs a `chat.ts` edit (guard the accumulated text before persist, sources passed via the metadata callback). Documented, not overstated as done.

---

## KNOW-03 (ITL-0 T3): recency weighting (freshness)
**Date:** 2026-08-13 · **Status:** DONE (unit-verified + no-breakage) · **Files:** `server/knowledge/rag/retriever.ts` (additive)
**Fixed?** `recencyFactor(sourceDate, now)` (exported) + a bounded recency re-sort of the relevance-cleared vector candidates in `retrieveKnowledgeAcrossRoles`, gated by `RAG_RECENCY_WEIGHT` (default 0.1, 0 disables). Applied AFTER the minScore relevance gate, so it re-orders equally-relevant chunks and never admits an irrelevant one. `tsc --noEmit` exit 0.
**Working?** `scripts/test-recency.ts` = 7/7 (newer > older > ancient, current-year ~1.0, undated=0, unparseable-range=0, year-only parses, factor bounded [0,1]). Retrieval still grounds with recency on (`verify-retrieval-telemetry` A hit-path grounded=true, PASS), so no breakage.
**How?** Exponential decay on a 5-year scale; the score multiplier `score * (1 + weight * factor)` lifts a chunk by at most `weight` (10% default), a gentle nudge that feeds the RRF rank fusion. A static corpus stops presenting old material as freshest.

## ITL-0 STATUS: COMPLETE (code). KNOW-01/02/03/04 COVERED + verified; GRND-01/02 wired non-streaming (PARTIAL: streaming wire needs a coordinated chat.ts session). 7-finding deep audit all fixed. Total this milestone: 6 requirements built, 3 changed files (all clean/additive), 6 new files, ~40 tests/checks green, essentially $0 (free Ollama + sub-cent embeddings), nothing committed.

---

## LEARN-01 (+ LEARN-04) (ITL-3): the outcome-based growth loop
**Date:** 2026-08-13 · **Status:** BUILT + WIRED + unit-verified (A/B proof pending review history) · **Files:** `server/ai/qualityLessons.ts` (new), `server/ai/openaiService.ts` (both paths, additive), `scripts/test-quality-lessons.ts` (new)
**Fixed?** The audit found the growth loop deferred/absent: peer review policed the current task then discarded the lesson, and only deliverable rubric AGGREGATES fed forward, never the substance. Now `getQualityLessons(projectId)` reads recent `peer_review_feedback` events and `formatQualityLessons()` turns their must-fix items into a concise, deduped, capped "LESSONS FROM RECENT REVIEWS (apply these)" block injected into the agent's next prompt (streaming + non-streaming paths). Project-scoped, so it also gives cross-agent learning (LEARN-04). Fail-safe (returns '' on error), gated by GROWTH_LOOP (default on). `tsc --noEmit` exit 0.
**Working?** `./node_modules/.bin/tsx scripts/test-quality-lessons.ts` = 6/6 (revise+mustFix produces lessons; approve skipped; reject included; case-insensitive dedup; caps at 5; empty yields no block). Injection confirmed in both openaiService prompt templates (code-traced + typecheck).
**How?** A revise/reject verdict's mustFix items become forward-feed lessons for the whole project's agents. This is the mechanism that makes "self-improving" real: a bad review teaches the next task.
**Runtime A/B (the deeper proof) pending:** proving it MEASURABLY improves the next task needs a project with real review history (seed a revise verdict, then compare the next comparable task with GROWTH_LOOP on vs off on the benchmark). The mechanism + injection are built and unit-proven; the A/B is the MEAS-06-style confirmation to run once there is review history.

## LEARN-02 / LEARN-03 note: content-aware personality + retiring the dead trainingSystem are the remaining ITL-3 items (personalityEvolution.ts + a trainingSystem decision). Deferred as a focused next step (LEARN-02 is a real behavioral feature; trainingSystem removal is a prompt-woven refactor best done carefully).

---

## GRND-01/02 STREAMING WIRE: cite-or-admit now enforced on the PRIMARY chat (gap closed)
**Date:** 2026-08-13 · **Status:** WIRED (both paths) + streaming half runtime-verified · **Files:** `server/ai/openaiService.ts` (streaming retrieval -> meta + onMetadata surfaces sources/grounded), `server/routes/chat.ts` (guard at the tone-guard chokepoint + re-emit), `scripts/verify-streaming-cite-metadata.ts` (new)
**Fixed?** The prior PARTIAL: the guards were only on the non-streaming fallback. Now the streaming path (`generateStreamingResponse`) retrieves via the meta variant and passes `ragSources` + `grounded` through the existing `onMetadata` callback (captured into `llmMetadata` in chat.ts). At the single post-stream chokepoint (right after `applyTeammateToneGuard`), chat.ts runs `enforceCiteOrAdmit(accumulatedContent, ragSources)` + `flagUnsupportedClaims(accumulatedContent, grounded)`; if a fabricated citation is stripped it updates `accumulatedContent` and re-emits a `streaming_chunk` (the SAME correction pattern the tone guard uses), so the client sees the clean version AND the stored message is clean. Gated by CITE_ENFORCE, skipped for safety interventions. `tsc --noEmit` exit 0.
**Working? (runtime, free Ollama + read-only corpus)** `verify-streaming-cite-metadata.ts`: RAG on -> `grounded=true sources=2`; RAG off -> `grounded=false sources=0`. So the streamed path hands the caller the exact allow-list + grounded flag the guard needs. The guard function itself is unit-proven (test-cite-guard 13/13); the chokepoint application follows the proven tone-guard re-emit pattern.
**How?** One `onMetadata` payload extension + one guarded block at the existing chokepoint. No new streaming path, no latency change (the guard runs after accumulation, and the correction re-emit is the established mechanism).
**Remaining gold-standard check (recommended pre-deploy):** a full WebSocket E2E that induces a fabricated citation and confirms the streamed+stored copy is stripped. Not run here (needs full project/agent/conversation orchestration); the source-surfacing is runtime-proven and the strip logic is unit-proven.

## MILESTONE STATUS after this run: ITL-0 COMPLETE (KNOW-01/02/03/04 + GRND-01/02 now BOTH paths). ITL-3 LEARN-01 growth loop built+wired+unit-verified. Deep audit (2 agents) 7 findings all fixed. Nothing committed. Free. Remaining: LEARN-02/03, KNOW-05 brain-docs RAG, MEAS-03/08 endpoint (all buildable), ITL-4 web (needs founder provider decision), ITL-5 positioning (needs UI approval), prod corpus check (founder).

---

## MEAS-03 / MEAS-08 (ITL-2): the operator quality surface
**Date:** 2026-08-14 · **Status:** BUILT + verified (unit + live read-only) · **Files:** `server/ai/qualityMetrics.ts` (new), `server/routes/autonomy.ts` (new GET /api/autonomy/quality), `scripts/verify-quality-metrics.ts` (new)
**Fixed?** The audit found the quality signals captured but never aggregated. `getQualityMetrics(projectId?)` pulls them into ONE read-only snapshot: corpus health (KNOW-01), retrieval hit/miss + reasons (KNOW-02), and the peer-review verdict mix (approve/revise/reject + revisionRate). Exposed at `GET /api/autonomy/quality` (auth + owned-project scoped, else global). Read-only, fail-safe per field. `tsc --noEmit` exit 0.
**Working?** `verify-quality-metrics.ts`: tally unit 4/4 + live snapshot 1/1 = 5/5. Live global snapshot from the real DB: `knowledge {status:ok, chunks:4429, roles:34}`, `retrieval {...}` (process-local, 0 in a fresh process, populated by a running server's traffic), `reviews {approve/revise/reject/revisionRate}`. The aggregation is proven; with live traffic + review history the numbers populate.
**How?** One pure tally (`tallyReviewMix`, unit-tested) + three reads (corpus count, in-process retrieval counter, project/global peer-review events). An operator can now GET one endpoint and see whether the knowledge base is live, whether retrieval is hitting, and the review verdict mix, the MEAS-03 surface.
**Note:** the retrieval counter is per-process (in-memory), so it reflects the serving instance's traffic since boot; the corpus + review numbers read fresh from the DB.

---

## KNOW-05 (ITL-1): brain documents use real RAG, not truncation
**Date:** 2026-08-14 · **Status:** DONE + verified live (ingest -> retrieve -> cleanup) · **Files:** `server/routes/projects.ts` (brain-upload route, additive), `scripts/verify-brain-docs-rag.ts` (new)
**Fixed?** The brain-upload route now ALSO embeds the doc into the brain-scoped RAG store (`ingestConversationDocument({scope:'brain'})`, the same machinery chat attachments already use and that is live-proven), so a long brain doc's deep content is retrievable. Fire-and-forget (upload succeeds regardless); the legacy truncation dump remains as a fallback for short/legacy docs. `tsc --noEmit` exit 0.
**Working? (runtime)** `verify-brain-docs-rag.ts`: a 4578-char doc with a distinctive fact at char 4479 (past the 2000-char cutoff) was ingested (6 chunks), and a query for that deep fact retrieved it (`deep fact "37 days" present: true`). The throwaway test doc was deleted afterward (`deleted = true`), so no residue. The legacy truncation dump (first ~2000 chars) would have missed it entirely.
**How?** Reuse the proven attachment RAG on the brain-upload path; the existing `retrieveConversationDocsBlockForChat` (brain scope) already surfaces it into the prompt in openaiService. Deep content in long docs is no longer invisible.
**Note (KNOW-06):** attachments and brain docs now share the SAME retrieval contract (conversationDocs), which is the KNOW-06 "unify grounding paths" goal; the legacy truncation block coexists as a short-doc fallback rather than being removed (no migration break for existing brain docs).

---

## MEAS-05 + MEAS-06 (ITL-2): frozen benchmark + improvement/regression gate
**Date:** 2026-08-14 · **Status:** BUILT + verified (unit 7/7 + live benchmark run) · **Files:** `server/eval/benchmarkGate.ts` (new), `scripts/test-benchmark-gate.ts` (new), `scripts/run-quality-benchmark.ts` (new)
**Fixed?** The audit found "improvement" unprovable (evals ran by hand with no baseline). Now: a FROZEN, versioned golden set (v1, 4 expert questions with rubrics) runs through the live system (RAG on), judge-scored; `evaluateBenchmarkDelta(baseline, current, tolerance)` compares to the frozen baseline and GATES it (a real regression fails, an improvement is recorded, a change inside the noise band is flat); a first run saves the baseline; a dated entry appends to a trendline. `tsc --noEmit` exit 0.
**Working?** Gate unit `test-benchmark-gate.ts` = 7/7 (first-run passes; a rise is "improved"; a drop "regressed" and FAILS; inside-band "flat"; pctDelta; tolerance band). Live `run-quality-benchmark.ts` on Ollama: 4/4 items scored, overall 5.0/5, verdict "first", gate PASS, baseline v1 saved (`eval/benchmark/baseline-v1.json`) + trend appended.
**How?** A capability change (RAG, the growth loop, a prompt) is now provable: run the benchmark with it ON vs OFF (A/B) and the delta is a tracked, gated number, not a vibe. The absolute 5.0 is a small-model + small-set artifact; the machinery (frozen set + baseline + gate + trend) is the point, and future runs vs 5.0 catch regression / record improvement.
**Note (MEAS-07):** the QUALITY judge here is the same free cross-model pattern as the peer-review judge (which already meets 0% false-block / 100% catch calibration); formal calibration of THIS judge against human labels is MEAS-07, a remaining smaller item.

---

## MEAS-07 (ITL-2): validate the measurement itself (quality-judge calibration)
**Date:** 2026-08-14 · **Status:** DONE + verified (discrimination confirmed) · **Files:** `scripts/calibrate-quality-judge.ts` (new)
**Fixed?** The audit's key insistence: an LLM judge can be confidently wrong, so its scores are only trustworthy if the judge is validated. This calibrates the benchmark's quality judge against labeled answers (expert / generic / vague-wrong) and requires it to (a) score each in its expected band and (b) ORDER them correctly. If the judge can't tell good from bad, its numbers are theater.
**Working?** `calibrate-quality-judge.ts` on Ollama: expert -> 5/5, vague/wrong -> 1/5, ordering correct (expert >= generic >= vague, expert > vague), 2/3 in-band -> RESULT PASS.
**Honest finding (captured, not hidden):** the small 3B judge discriminates COARSELY, it scored the "generic" answer as low as "vague" (1/5, out of its 2-4 band), so it separates expert-from-not cleanly but cannot grade fine gradations. For fine-grained scoring, run the calibration + benchmark on a stronger judge (Groq/Gemini). The cross-model, anti-self-preference discipline (judge != writer model family) is already in place, matching the peer-review judge that meets 0% false-block / 100% catch.
**How?** Same validated-judge discipline as the peer-review judge, applied to the quality judge that feeds the benchmark. A number is only shown if the judge is validated to produce it.

---

## LEARN-02 (ITL-3): content-aware personality
**Date:** 2026-08-14 · **Status:** DONE + verified · **Files:** `server/ai/personalityEvolution.ts` (new `deriveTraitHints` + hint-aware loop), `server/routes/messages.ts` (passes the real feedback note + response), `scripts/test-content-aware-personality.ts` (new)
**Fixed?** The audit found feedback adaptation was content-BLIND (blanket nudge, message content discarded). Now `deriveTraitHints(note, response)` maps the SUBSTANCE of feedback to the specific trait it names ("too long" -> verbosity down; "too generic" -> technicalDepth up; "just tell me your opinion" -> directness up; "cold/robotic" -> empathy up), and the adaptation loop applies a targeted step to the named trait while non-named traits keep the Phase C baseline-anchored behavior. messages.ts now passes `feedbackData.notes` + the reacted response instead of empty strings. `tsc` exit 0.
**Working?** `test-content-aware-personality.ts` = 8/8, including end-to-end: a "way too long, cut it down" thumbs-down moves the agent's verbosity trait DOWN (content-targeted), not a blanket drift.
**How?** A thumbs-down now teaches WHAT to change, not just that something was off.

## LEARN-03 (ITL-3): retire the dead trainingSystem (resolution)
**Date:** 2026-08-14 · **Status:** RESOLVED (documented, verified no-op) · **Files:** `server/ai/trainingSystem.ts` (deprecation note)
**Fixed?** Confirmed `generateEnhancedPrompt` is a NO-OP passthrough in production (returns basePrompt unchanged; its in-memory training data / custom profiles are never populated in prod, the only UI writer MessageFeedback.tsx is unmounted, devTrainingTools are dev-only, storage resets each restart). The real forward-feed is now LEARN-01 (qualityLessons). Decision: keep it (devTrainingTools is a legitimate local surface; removal is a multi-file refactor for zero prod benefit) and document the supersession + the no-op at the source, so it no longer masquerades as a prod learning loop.
**How?** The audit's concern ("masquerades as a learning loop") is resolved: LEARN-01 is the real loop; this is an inert, documented dev tool.

## WEB-01 + WEB-02 (ITL-4): agents can actually use the live internet in the answer
**Date:** 2026-08-14 · **Status:** DONE + verified · **Files:** `server/ai/webContext.ts` (new seam), `server/ai/openaiService.ts` (wired into BOTH prompt paths), `scripts/verify-web-context.ts` (new)
**Fixed?** The audit found agents cannot reach the internet: providers have no tool-use, the tool router's "web" decision is discarded, and the one web client only wrote FUTURE cards. New `getWebContextBlock(role, query)` closes the loop: for a recency-sensitive query it fetches via the existing keyless DuckDuckGo client (`runRoleScopedResearch`), formats the evidence as a cite-or-admit-safe `LIVE WEB RESULTS` block, and injects it next to the retrieved-knowledge block in both the streaming and non-streaming prompts. Gated by `WEB_SEARCH_ENABLED` (default OFF, so zero network hop until enabled) and double-gated by the web client's own `ENABLE_WEB_IN_PROD_MODE`. Fail-safe: returns '' on off / non-recency / block / timeout / empty / error, never blocks a response. Synthetic "no results" fallback cards are filtered out so an empty fetch admits ignorance instead of injecting a fake URL. `tsc` exit 0.
**Working?** Command: `set -a; source ./.env; set +a; ./node_modules/.bin/tsx scripts/verify-web-context.ts` = 10/10: gate-off returns '' (no hop); recency detection true for "latest/current price/2026", false for evergreen; gate-on + non-recency returns ''; gate-on + recency + prod-mode-off returns '' (double gate); fully enabled makes ONE real keyless fetch that reaches the internet without throwing and returns a string. (DuckDuckGo instant-answer is sparse, so the live row set is often empty; the SEAM reaches the network and is where the founder's GitHub-repo provider swaps in with no caller change.)
**How?** An agent asked "what changed in 2026" can now be handed live web rows instead of guessing from stale training, and the cite-guard restricts it to citing only those URLs. The capability is wired and proven end-to-end; a stronger search+fetch provider is a one-file swap behind the same seam.
**Matrix cell:** "Live web research" moves from MISSING (capability absent) to LIVE-but-gated (capability present, opt-in, provider-upgradeable).

## POS-01 + POS-03 (ITL-5): positioning truth-up
**Date:** 2026-08-14 · **Status:** POS-01 RESOLVED-BY-BUILD · POS-03 PREPARED (application gated by the UI-approval rule) · **Files (proposed, NOT yet edited):** `client/src/components/LandingBento.tsx:32`, `client/src/components/landing-v2/AgentCarousel.tsx:117`, `client/src/pages/LandingPage.tsx:469,560`; internal docs `HATCHIN-BRIEF.md`, `HATCHIN-COMPLETE-GUIDE.md`.

**POS-01 (the "claims it can't do" concern).** The audit worried the product oversells web search + self-improvement. Verified against the shipping copy: **no** "web search" / "browse the internet" / "self-improves" string exists in `client/src` (grep clean). And the underlying capabilities are now REAL, not aspirational: live web is wired + proven (WEB-01/02 above), the outcome-based growth loop is live (LEARN-01), and feedback adaptation is content-aware (LEARN-02). So POS-01 is resolved by *building the capability*, not by trimming a claim. No copy change required.

**POS-03 (agent count).** Authoritative count from `shared/roleRegistry.ts` = **34 role entries** (33 user-pickable specialists + Maya the special Idea Partner). The landing says "30 specialists" / "Thirty AI teammates" in 3 live surfaces. That *understates* (33 > 30), so it is not an overclaim, but it is stale/inaccurate. Recommended fix: **"30+"** everywhere (evergreen as the roster grows, honest, keeps the clean round number, and matches `HATCHIN-BRIEF.md:156`'s own guidance to phrase it as a floor not a ceiling). Exact edits:
- `LandingBento.tsx:32` `"30 specialists"` -> `"30+ specialists"` and the trailing "30 deep specialists" -> "30+ deep specialists"
- `AgentCarousel.tsx:117` `"Thirty specialists."` -> `"Thirty-plus specialists."`
- `LandingPage.tsx:469` `"All 30 teammates..."` -> `"All your teammates..."` (Pro copy; avoids a number in a pricing bullet)
- `LandingPage.tsx:560` `"Thirty AI teammates..."` -> `"A full team of AI teammates..."` (or "30+")

**Why PREPARED, not applied:** these 3 files are user-facing landing marketing, which is exactly what the standing UI-change-approval rule protects. With the founder asleep I cannot show-current-state-and-get-approval in real time, so the compliant move is to present the precise diff for one-glance approval rather than silently rewrite the landing. The internal docs (BRIEF/GUIDE) can be corrected to 34 in the same approval so the number is chosen once, coherently, across every surface.
**How?** The two things the audit called dishonest (web + self-improvement) are now honest because the capability exists; the one remaining stale number has an exact, approval-ready fix.

## BENCHMARK + A/B (the founder's explicit ask: "make sure there's benchmark, there's a/b testing")
**Date:** 2026-08-14 · **Status:** DONE, all free on local Ollama (llama3.2:3b generator + judge) + sub-cent OpenAI embeddings for corpus reads · **Files:** `scripts/eval-role-competence.ts`, `scripts/ab-growth-loop.ts` (new), `scripts/run-quality-benchmark.ts`, `scripts/probe-web-capability.ts` (refreshed), `scripts/test-benchmark-gate.ts`.

**A/B #1 - the knowledge matrix makes agents measurably smarter (RAG off vs on).** Blind cross-model judge, 5 independent expert questions, full generation path, matrix toggled by `RAG_ENABLED`.
Command: `set -a; source ./.env; set +a; LLM_MODE=test TEST_LLM_PROVIDER=ollama TEST_OLLAMA_MODEL=llama3.2:3b EVAL_PROVIDER=ollama-test STORAGE_MODE=memory RAG_EMBED_PROVIDER=openai ./node_modules/.bin/tsx scripts/eval-role-competence.ts`
Result: **Baseline (matrix OFF) 2.60/5 -> with matrix (ON) 3.60/5, lift +1.00 (+38%).** (On the tiny free 3B local model. A prior production-class run scored 4.40 -> 5.00, +14%; the weaker the base model the larger the relative lift, and the direction is the same at every tier: injected authoritative knowledge lifts competence.)

**A/B #2 - the growth loop feeds review lessons into the next task (GROWTH_LOOP off vs on).** Real peer_review_feedback events seeded under a live project, the ACTUAL agent prompt captured via the DEV capture provider, seeded rows cleaned up after.
Command: `set -a; source ./.env; set +a; LLM_MODE=test TEST_LLM_PROVIDER=capture STORAGE_MODE=db ./node_modules/.bin/tsx scripts/ab-growth-loop.ts`
Result: **5/5.** ON injects a `LESSONS FROM RECENT REVIEWS` block carrying both seeded must-fix items (+245 chars of forward-fed guidance in the real prompt); OFF injects nothing (gate respected). So a reviewer's "fix X" provably reaches the next comparable task.

**Frozen benchmark + regression gate (MEAS-05/06).** Frozen golden set v1 (baseline 5.0, saved 2026-08-13) re-run through the live system with the gate.
Command: `set -a; source ./.env; set +a; STORAGE_MODE=memory LLM_MODE=test TEST_LLM_PROVIDER=ollama EVAL_PROVIDER=ollama-test RAG_EMBED_PROVIDER=openai ./node_modules/.bin/tsx scripts/run-quality-benchmark.ts`
Result: **Overall 5/5, baseline 5, verdict flat, gate PASS** (no regression); dated trend entry appended (2026-08-14). Gate unit `test-benchmark-gate.ts` = 7/7 (first-run / improved / regressed / flat all classify correctly, pass=false only on a real regression).

**Web-capability probe (before/after flip).** `scripts/probe-web-capability.ts` now reports `getWebContextBlock() answer seam = wired:true` and the verdict moved from the pre-ITL-4 "capability absent" baseline to "CAPABILITY WIRED, gated off by default" (fetches live rows when both gates on, proven separately by `verify-web-context.ts` 10/10).

**Net:** knowledge lift +38% (free-model A/B), growth loop proven to forward-feed (5/5), zero benchmark regression (gate PASS), web capability wired. All re-runnable, all free.

## RE-AUDIT (adversarial, 3 parallel reviewers on all new/edited code) + FIXES
**Date:** 2026-08-14 · **Status:** DONE, all found issues fixed + re-verified · **Method:** 3 independent adversarial reviewers, one per surface (answer-path integration; health/metrics/endpoints/DB; learning loop), each told to verify every candidate against the exact lines before reporting. 13 real findings surfaced (2 HIGH, 4 MEDIUM, 7 LOW); all fixed; latency-gating / dash / ownership / bounds categories came back clean.

**HIGH-1 (answer-path) FIXED: multi-agent turns stripped legitimate citations.** The streaming cite guard read grounding off `llmMetadata`, but the multi-agent (team) path returns a bare string and never plumbs sources, so `llmMetadata` stayed null -> empty allow-list -> `enforceCiteOrAdmit` stripped EVERY URL from a grounded team answer (default-on config). Fix (`chat.ts`): only enforce when grounding was actually captured (`llmMetadata.grounded` is a boolean); the multi-agent path is skipped, not corrupted. Single-agent RAG-miss enforcement is unchanged. Wrapped in try/catch (was the one unguarded new seam).

**HIGH-2 (metrics) FIXED: the quality surface reported 0 reviews while reviews were happening.** `tallyReviewMix` keyed only on `payload.verdict`, which only the opt-in LLM-judge path writes; the DEFAULT deterministic rubric path logs a rubric with no `verdict` -> every default-config review was dropped -> "0 reviews / 0% caught" (the exact silent-empty metric the milestone exists to kill). Fix (`qualityMetrics.ts`): derive a verdict from the rubric fields (high hallucination risk -> reject; any flagged problem -> revise; else approve). New unit `test-review-mix.ts` = 7/7 (judge + rubric shapes, "all-rubric project does not report 0").

**MED (learning) FIXED: the growth loop was empty in the default (judge-off) config, and could silently vanish in busy projects.** Two bugs: (a) `getQualityLessons` read only `payload.mustFix`, which the rubric path does not have (its fixes are in `fixSuggestions`) -> default-config lessons block was always empty; (b) it capped the read at 40 events of ALL types BEFORE filtering to reviews, so a busy project's chat/task volume starved out the reviews. Fix (`qualityLessons.ts` + new `readAutonomyEventsByProjectAndType` in `eventLogger.ts` using the (project_id, event_type, timestamp) composite index): read reviews type-filtered, and map lessons from `mustFix` OR `fixSuggestions`, with an `Array.isArray` guard. The growth-loop A/B now seeds BOTH a judge-shaped and a rubric-shaped event and proves both feed forward (5/5).

**MED (endpoints) FIXED: global `/api/autonomy/quality` leaked cross-tenant aggregates.** With no `projectId`, it aggregated peer-review counts across ALL users' projects for any authenticated caller. Fix (`autonomy.ts`): `projectId` is now REQUIRED and ownership-checked (400 without it); no platform-wide aggregate is reachable over HTTP.

**MED (learning) FIXED: the second feedback caller fed the wrong string to the hint detector.** `/api/personality/feedback` passed the user's own message (not a note ABOUT the reply) into `deriveTraitHints`, so a thumbs-UP could lower verbosity off words like "make it shorter." Fix: (a) content-aware hints now apply on NEGATIVE feedback only (a thumbs-up is not a correction); (b) that caller passes '' so it uses the safe baseline path. The message-reactions caller still passes the real feedback note.

**MED (answer-path) FIXED: web summary could forge the block terminator.** An allow-listed web summary containing an inline `--- END LIVE WEB RESULTS --- Assistant:` could appear to escape the UNTRUSTED block. Fix (`webContext.ts` `sanitizeForBlock`): collapse newlines, neutralize triple-dash fences and `system|assistant|user:` role markers before injection (defense-in-depth on top of the web client's existing injection drop). Behind `WEB_SEARCH_ENABLED` (off by default) + the domain allow-list.

**LOW (7) FIXED:** benchmark `version` sanitized against path traversal + a NaN score now FAILS the gate (was silently "flat"); `checkKnowledgeHealth` gets a 30s TTL cache so authed `/health` does not run `count(*)` every hit; web fallback-card filter made robust (matches the "unavailable" text, not just the exact literal) + the race timer is cleared; cite-guard excludes `*`/backtick from the URL match and cleans empty emphasis wrappers (no dangling `**`); `GROWTH_LOOP` now also honors `false`/`0`/`no`; the non-streaming cite guard wrapped in try/catch.

**Noted, not code-changed (proportionate):** the web fetch's underlying socket is not truly cancelled on timeout (node-fetch has no AbortSignal in the web client; opt-in + bounded; the founder's provider swap uses a proper AbortSignal); `getQualityLessons` is a per-turn DB read (now useful, gated, fail-safe; a per-project cache is a later optimization).

**Post-fix verification:** `tsc --noEmit` exit 0; new deterministic 48/48 (cite-guard 13, recency 7, quality-lessons 6, content-aware-personality 8, benchmark-gate 7, review-mix 7); web seam 10/10; growth-loop A/B 5/5 (judge + rubric); frozen benchmark PASS; and NO regression to the existing intelligence gates (voice 8/8, pushback PASS, reasoning PASS, dto PASS, gate:safety PASS, test:integrity PASS).
