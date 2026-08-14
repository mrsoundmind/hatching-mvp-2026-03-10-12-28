# PLAN: ITL-0 Knowledge Integrity & Grounding

> Milestone: Hatches That Actually Learn & Know. Phase ITL-0 (P0, launch-blocking). 2026-08-13. Authored, not executed. Every task is verified in runtime (OPS-01) and every behavior change ships behind a default-safe env flag so rollback is "flag off" (OPS-02). No em/en dashes, no fabricated proof (OPS-03).

## Goal
Make "grounded in real knowledge" actually true in production, and make the system honest the instant it is not. When this phase is done, RAG cannot be silently off in prod, a retrieval miss is a recorded signal instead of an invisible fallback, recency counts, and a cited source that was never retrieved never reaches the user.

## Requirements covered
KNOW-01, KNOW-02, KNOW-03, KNOW-04, GRND-01, GRND-02.

## Why this is first
The audit found production may currently answer with no knowledge base at all (CLAUDE.md: "RAG not yet wired into the prod deploy"), and every failure mode is swallowed silently. That is a correctness and trust risk that blocks an honest launch. Nothing else in the milestone matters if the base layer lies.

## Prerequisite (founder, not code, blocks T1's meaning)
**T0.** Run against the production Supabase: `SELECT count(*) FROM role_knowledge;` and confirm the embedding key (`OPENAI_API_KEY` / `RAG_EMBED_PROVIDER`) is set in the prod environment. Record the number in this file. If it is 0, the deep-knowledge feature is off in the launch product today, and T1 becomes urgent rather than preventive.

## Parallel-safety note (read before executing any task)
Several target files are frequently touched by the sibling sessions (`server/ai/openaiService.ts`, `server/routes/chat.ts`). Before editing ANY file below, re-check `git status --porcelain <file>`; if it is dirty from another session, coordinate or defer that task. `server/knowledge/rag/*` and `server/routes/health.ts` were clean at authoring time but re-check at execution.

---

## Tasks

### T1 (KNOW-01): production RAG health assertion
**Intent:** RAG must not be able to be silently empty in prod.
**Files:** `server/routes/health.ts` (extend the existing DB-ping health check) and/or a boot log in `server/index.ts`. Read-path helper: `server/knowledge/rag/store.ts` `rolesWithCorpus()`.
**Approach:** on boot (async, non-fatal) and inside the health endpoint, count distinct roles / total chunks in `role_knowledge` and check the embed key is present. If the corpus is empty or the key is missing, log a clear WARN and, if `OPS_ALERT_WEBHOOK_URL` is set, fire the existing spend-alarm-style webhook once. Never crash boot. Gate behind `RAG_HEALTHCHECK` (default on).
**Verify (runtime):** boot against a populated dev DB shows "role_knowledge: N chunks across M roles"; point at an empty DB and confirm the WARN + webhook fire, and the app still boots.
**Rollback:** `RAG_HEALTHCHECK=off`.

### T2 (KNOW-02): kill the silent-empty fallback, wire the dead `miss` flag
**Intent:** a retrieval miss becomes a recorded signal, and grounding state becomes observable.
**Files:** `server/knowledge/rag/retriever.ts` (the `miss` flag at ~:185-186, the silent `[]`/`''` returns at ~:42-46 and ~:224-227), a small structured logger (reuse `server/autonomy/events/eventLogger.ts` pattern or a plain namespaced console + counter).
**Approach:** when `retrieveKnowledgeBlockForChat` / `retrieveKnowledgeAcrossRoles` produce no usable chunks, emit a `retrieval_miss` structured record (query hash, role scope, reason: no-corpus / embed-fail / below-threshold) instead of returning `''` silently. Return a `grounded: boolean` alongside the block so callers (and later POS-02) can tell grounded from parametric. Fire-and-forget, never throws. Gate telemetry behind `RAG_MISS_TELEMETRY` (default on).
**Verify (runtime):** a query with no corpus logs `retrieval_miss reason=no-corpus`; a below-threshold query logs `reason=below-threshold`; a good query logs a hit with top score. No user-facing latency change.
**Rollback:** `RAG_MISS_TELEMETRY=off` (the `grounded` return value is inert if unused).

### T3 (KNOW-03): recency weighting / honest "as of"
**Intent:** stop old material competing with current material on cosine similarity alone.
**Files:** `server/knowledge/rag/retriever.ts` (the fuse/rerank stage; `source_date` is already carried and rendered at ~:62, ~:252).
**Approach:** apply a small, bounded recency weight in the fusion/rerank score (a deterministic multiplier from `source_date` age, capped so it never overrides strong relevance), controlled by `RAG_RECENCY_WEIGHT` (default a low value, e.g. 0.1; 0 disables). Also make the "as of <year>" more prominent in the rendered citation so the model and user see age.
**Verify (runtime):** given two near-duplicate chunks differing only by date, the newer ranks higher with the weight on and ties without it; citation shows the date. Spot-check that a highly relevant old chunk is not wrongly buried (relevance still dominates).
**Rollback:** `RAG_RECENCY_WEIGHT=0`.

### T4 (KNOW-04): repeatable re-ingest runbook
**Intent:** refreshing/expanding the corpus is a documented, repeatable operation, not tribal knowledge.
**Files:** new `.planning/milestones/hatches-that-learn-and-know/RE-INGEST-RUNBOOK.md`; references `scripts/ingest-role-knowledge.ts` and the seed `batch-*.json`.
**Approach:** document the exact commands to (a) refresh one role, (b) add a new role, (c) re-embed everything if the embedding provider/model changes (the one-vector-space rule), plus how to verify coverage with the existing `test-rag-coverage.ts`. No product code; this is the ops procedure that makes KNOW-01 sustainable.
**Verify:** follow the runbook on a dev DB to re-ingest one role and confirm `test-rag-coverage` still passes.
**Rollback:** n/a (doc only).

### T5 (GRND-01): enforce cite-or-admit on the chat path
**Intent:** a cited URL/source that was not actually retrieved never reaches the user.
**Files:** `server/ai/responsePostProcessing.ts` (add a citation-validation pass) or a guarded step right before emit in `server/routes/chat.ts`; needs the injected-sources list from the retrieval step (thread the retrieved source URLs/titles through, using T2's return).
**Approach:** after generation, extract any URLs/citations from the response; for each, check it appears in the set of actually-injected retrieved sources (domain + title match, conservative). If not present, strip the citation (keep the sentence) or replace with a neutral phrasing, and record a `fabricated_citation_stripped` signal. Behind `CITE_ENFORCE` (default on). Conservative matching to avoid stripping legitimate references the model was given.
**Verify (runtime):** craft a turn where retrieval returns known sources, force/observe a response citing a URL not among them, confirm it is stripped and logged; confirm a legitimately-retrieved citation passes through untouched.
**Rollback:** `CITE_ENFORCE=off`.

### T6 (GRND-02): unsupported-factual-claim guard for outward-facing output
**Intent:** flag high-risk factual claims that retrieval does not support, at least for outward-facing content.
**Files:** `server/ai/responsePostProcessing.ts`; reuse the `OUTWARD_OR_FACTUAL` regex already defined in `server/autonomy/execution/taskExecutionPipeline.ts` (export it to a shared spot so both use one source).
**Approach:** when output is outward-facing/factual (regex) AND the turn was ungrounded (T2 `grounded=false`), record an `unsupported_claim_flag` quality signal (feeds ITL-2) and, conservatively, allow an optional soft hedge. Do NOT block or rewrite aggressively; the goal is measurement + a light guard, not censorship. Behind `CLAIM_GUARD` (default on for telemetry, hedge off by default).
**Verify (runtime):** an outward-facing turn with a statistic and no retrieval backing produces an `unsupported_claim_flag`; a grounded turn does not; over-firing is checked on a benign sample.
**Rollback:** `CLAIM_GUARD=off`.

---

## Acceptance (phase done when all true, verified on a live restarted server)
1. Boot/health reports the real corpus size and loudly warns if empty (T1).
2. Retrieval misses are recorded with a reason, never silently swallowed (T2).
3. Recency measurably affects ranking, and citations show age (T3).
4. The re-ingest runbook exists and was followed once successfully (T4).
5. A fabricated citation is stripped before the user sees it; a real one passes (T5).
6. Unsupported outward-facing claims on ungrounded turns are flagged as a signal (T6).
7. `typecheck` clean; every change behind a default-safe flag; no em/en dashes; no fabricated numbers introduced.

## Risks & mitigations
- **Over-stripping legitimate citations (T5):** conservative domain+title match, `CITE_ENFORCE` flag, verify with real retrieved sources before enabling in prod.
- **Recency hurting relevance (T3):** small capped weight, 0-disable, A/B spot-check.
- **Telemetry noise/cost (T2/T6):** fire-and-forget, sampled if needed, no user-facing latency.
- **Hot-file collision (T5/T6 touch openaiService/chat/responsePostProcessing):** re-check `git status` per the parallel-safety note before editing; prefer `responsePostProcessing.ts` (least contended) as the hook point.

## Notes for the executor
- This plan is safe to execute incrementally: T1, T2, T4 are additive and low-risk (do first). T3, T5, T6 change output behavior, ship each behind its flag and verify live before enabling.
- T5/T6 depend on T2 (the `grounded` flag + injected-sources list threaded through). Do T2 before T5/T6.
- When v2.1/v2.2 close and this milestone is promoted to top-level GSD, convert this file into the phase's `PLAN.md` under a real `NN-` phase dir.
