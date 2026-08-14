# Phase 2 — Build Plan: Per-Role Internet-Sourced Knowledge (RAG)

**Status: PLAN ONLY. No code until you approve.** This is the build plan the audit pointed to.
Grounded in the real seams found in Phase 1 — reuse-first, not a rewrite.

## Why (from the audit)
The agents are capable (4/4 subtle-error catches, good calibration on DeepSeek), but their knowledge is
**parametric only**: it can't be current, can't cite verifiable sources, and thins out / hedges on the
long tail (Superhuman-exact-numbers). Your goal — "each role holds the world's knowledge for its role,
from books/articles/case studies, and answers from that, not the model's memory" — is a **retrieval**
problem, not a prompt problem. The platform already has the *shape* of this; it has almost none of the
*substance*.

## What already exists (reuse these — do NOT rebuild)
- **Injection seam is LIVE in chat.** `openaiService.ts` already loads per-role knowledge into every
  reply: `loadRoleBrain`/`renderRoleBrainContext` (`knowledge/roleBrains/loader.ts`) +
  `loadRoleSkillsWithUpdates` (`knowledge/skillUpdates/skillUpdateStore.ts`), plus the brain-doc
  grounding block (~L261-275, 6000-char budget). **We plug retrieved chunks in here — no new wiring.**
- **Per-role stores exist** but are tiny/static: `roleBrains/{role}.canon.json` (~500 B) +
  `{role}.playbook.json` (~400 B), only ~5 of 30 roles, read whole-file (no relevance ranking).
- **Fetch + governance seams**: `tools/web/webClient.ts` (fetch), `sourceTrust.ts` (A/B/C trust tiers),
  `webPolicy.ts` (per-role domain allow-list + budget + injection sanitization), `cache/cacheStore.ts`
  + `ttlPolicy.ts` (caching/freshness), AKL `gapDetector.ts` (when to retrieve), `promotion.ts` +
  `updateCard.ts` (promote evidence into per-role stores).
- **DB**: Supabase Postgres, **pgvector NOT yet enabled** (must enable for semantic search).

## What's missing (the actual build)
1. **Real retrieval** — replace DuckDuckGo *instant-answer* snippets with real article/case-study
   content (search API → fetch full text → clean).
2. **A real per-role corpus** — ingest curated sources → chunk → embed → store, for all 30 roles.
3. **Semantic retrieval** — pgvector top-K by query embedding, replacing whole-file injection.
4. **Gap-gated retrieval in chat** — retrieve only when `gapDetector` says the answer needs it (cost).
5. **Citations** — carry source URL/title/date through to the reply so answers are verifiable.

## Target architecture (4 stages, all reuse the seams above)
```
INGEST (offline/cron)         RETRIEVE (per turn, gated)        INJECT (existing seam)
curated per-role source  ──►  gapDetector says "needs it?" ──►  renderRoleBrainContext gains a
list → fetch full text        │  yes → embed(userMsg+role)       "RETRIEVED KNOWLEDGE (cite these)"
→ clean → chunk → embed       │  → pgvector top-K for role       block in openaiService, with
→ store in role_knowledge     │  → trust-filter + dedupe         source title/url/date → LLM must
(pgvector) with source meta   │                                  cite; "admit if none found"
```
- **Store**: new `role_knowledge` table (pgvector): `id, role, chunk, embedding, source_url,
  source_title, source_date, trust_tier`. Enable `pgvector` on Supabase.
- **Retrieve**: `retrieveForRole(role, query, k)` → embed query → `ORDER BY embedding <=> $q LIMIT k`,
  filtered by `webPolicy` trust/domain. Cache by (role, query-hash) via existing `cacheStore`.
- **Inject**: extend `renderRoleBrainContext` output with a retrieved block; add one prompt line:
  "Answer from RETRIEVED KNOWLEDGE and cite [title](url). If it doesn't cover the question, say so —
  do not invent sources." (directly fixes the long-tail confabulation the audit found).

## Recommended decisions (you flagged these — here are my defaults, override any)
1. **Sources: curated per-role allow-list, NOT open crawl.** Open crawl invites low-quality pages,
   legal/ToS risk, and prompt-injection. Start with a vetted list per role (e.g. PM → Reforge,
   First Round, SVPG, Intercom blog, Lenny's; UX → NN/g, Laws of UX; Eng → official docs, martinfowler,
   Google SRE book; Growth → Reforge, AARRR canon). `webPolicy.ts` already models per-role allow-lists.
2. **Freshness: hybrid.** One-time bulk ingest of the evergreen corpus + a **monthly refresh cron**
   (reuse `worldSensor`/`ttlPolicy`) for changed pages, + **on-demand** fill when `gapDetector` misses.
3. **Host/budget: Supabase pgvector (you already run Supabase) + a small embeddings model.** Keep cost
   near-zero at rest; the only per-turn cost is one embedding + a vector query, and only when the gap
   detector fires (not every message). Bulk embedding is a one-time job.

## Phased rollout (crawl → walk → run)
- **P2.0 Spike (proves the loop, ~2-3 roles):** enable pgvector; hand-ingest ~50 vetted docs for PM +
  Engineer + UX; build `retrieveForRole` + the injection block; gate on `gapDetector`. Success = the
  Superhuman-numbers probe now answers **with a real cited source**, and the "cite or admit" line kills
  the fabrication. Measure: exemplar-accuracy + citation-rate before/after on the Phase-1 probes.
- **P2.1 Ingestion pipeline:** generalize fetch→clean→chunk→embed→store; wire the curated allow-list;
  backfill all 30 roles; add the refresh cron.
- **P2.2 Quality + safety:** trust-tier ranking, dedupe, injection-sanitization on ingested text
  (reuse `isInjectionLike`), per-role budget caps, and a "retrieved-knowledge" surface in the UI so
  users see what a claim is grounded on (also fixes the invisible-knowledge gap).
- **P2.3 (optional) Outcome loop tie-in:** feed which retrieved chunks led to accepted work back into
  ranking — the beginning of the real "evolve as a professional" loop the audit found missing.

## Verification (how we'll know it worked)
Re-run the Phase-1 knowledge/honesty probes against the RAG-enabled build:
- Exemplar probes now cite a **real retrievable source** (not parametric memory), checked by opening
  the URL. Target: ≥90% of factual/case-study claims carry a valid citation.
- The "exact numbers / obscure case" probes either cite a source or explicitly say "not in my sources"
  — **zero confident fabrication**.
- Latency budget: retrieval adds < ~500ms and fires on < ~40% of turns (gap-gated).
- No regression in the non-knowledge dimensions (policing, context) — same Phase-1 probes.

## Risks & mitigations
- **Prompt injection via ingested pages** → sanitize on ingest (`isInjectionLike` already exists),
  trust-tier ranking, never execute instructions from retrieved text.
- **Source licensing/ToS** → curated allow-list of sources that permit it; store snippets + link, not
  full reproductions.
- **Cost creep** → gap-gated retrieval + cache + one-time bulk embed; monitor per-turn token delta.
- **Stale/contradictory sources** → source-date in metadata, freshness cron, prefer higher trust tier.
- **Over-retrieval flattening voice** → keep retrieved block small (top-K 3-5, budgeted), it augments
  the role persona, doesn't replace it.

## Out of scope for Phase 2
The "evolve-as-a-professional" outcome-learning loop and ambient peer-policing (both audit findings) are
separate builds — noted, not included here. This plan is specifically the per-role internet-knowledge
(RAG) pipeline you asked for.
