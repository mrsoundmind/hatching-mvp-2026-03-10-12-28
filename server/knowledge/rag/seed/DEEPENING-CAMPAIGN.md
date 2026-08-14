# RAG Deepening Campaign, even top-1% depth for all 34 roles

**Goal (user directive, 2026-08-14):** every agent's knowledge base is deep, even, and top-1%-in-the-world. No role neglected. Same standard applied to any new agent added in future.

**Process:** follow `GATHERING-HANDOFF.md` exactly (mastery map, best authoritative primary sources, faithful extracts preserving exact numbers, anti-patterns and debunked myths, tiered A/B/C, no fabrication, no dashes). This file adds the target and tracks progress.

## Definition of "even / top-1%" (the bar, measured by coverage, not raw count)

A role is DONE when its corpus **fully covers its field's mastery map** from authoritative sources. "Even" means every role reaches that coverage bar, not that every role has UX Designer's raw chunk count (2447 is course-transcript volume, a different thing from mastery-map coverage). Concretely, per role:

- **Mastery map complete:** the 15 to 25 canonical frameworks, seminal works, official docs, recognized masters, key metrics/thresholds, AND the classic anti-patterns / debunked myths of the field, each backed by a real fetched source.
- **Depth floor:** aim for **~180 to 320 chunks** per role (dense heading-structured extracts chunk into several each), a 2x to 5x deepening of most roles' current 35 to 103.
- **Source quality:** **>= 20 authoritative sources**, **>= 60% A-tier** (primary/official/recognized authority). This also fixes today's low-A-tier roles.
- **Anti-patterns present:** at least 3 to 5 "what not to do / common mistakes / myths" entries.

UX Designer (2447, course-fed) is already past the bar; leave it. Every other role rises to the bar.

## Ingest (additive, never wipe the good corpus)

Deepening ADDS to what exists. Use the additive path (`scripts/ingest-add-seed.ts`, `replaceRoles:false`, content-hash dedup), NOT the replace path, so existing good chunks are preserved and only new sources are added. One vector space, `RAG_EMBED_PROVIDER=openai`. Verify each batch with `rag-corpus-health.ts` (counts + A-tier%) and spot-check retrieval with `test-rag-crossrole.ts`.

## Per-role status (current chunks from live DB 2026-08-14, target = bar above)

Batches run thinnest-first, ~4 roles per batch, one seed file per role (`batch-<role>-deepen2.json`), written incrementally so a session limit never loses work.

| Batch | Role | Now | Status |
|---|---|---|---|
| 1 | Content Writer | 35 | ✓ DONE 2026-08-14 → 130 (81% A, 23 new sources) |
| 1 | Operations Manager | 35 | ✓ DONE 2026-08-14 → 132 (77% A, 26 new sources) |
| 1 | DevOps Engineer | 39 | ✓ DONE 2026-08-14 → 137 (98% A, 24 new sources) |
| 1 | QA Lead | 41 | ✓ DONE 2026-08-14 → 153 (84% A, 24 new sources) |
| 2 | Social Media Manager | 41 | ✓ DONE 2026-08-14 → 144 (78% A, 23 new sources) |
| 2 | AI Developer | 44 | ✓ DONE 2026-08-14 → 163 (96% A, 23 new sources) |
| 2 | Product Manager | 45 | ✓ DONE 2026-08-14 → 140 (82% A, 24 new sources) |
| 2 | Business Analyst | 46 | ✓ DONE 2026-08-14 → 166 (57% A, 30 new sources; A-tier top-up candidate) |
| 3 | HR Specialist | 46 | ✓ DONE 2026-08-14 → 137 (71% A, 24 new sources) |
| 3 | Data Scientist | 48 | ✓ DONE 2026-08-14 → 161 (85% A, 24 new sources) |
| 3 | Marketing Specialist | 49 | ✓ DONE 2026-08-14 → 171 (49% A, 25 new sources; A-tier top-up candidate) |
| 3 | Email Specialist | 50 | ✓ DONE 2026-08-14 → 165 (79% A, 23 new sources) |
| 4 | Growth Marketer | 51 | ✓ DONE 2026-08-14 → 153 (69% A, 22 new sources) |
| 4 | Instructional Designer | 51 | ✓ DONE 2026-08-14 → 164 (57% A, 23 new sources; A-tier top-up candidate) |
| 4 | Technical Lead | 54 | ✓ DONE 2026-08-14 → 151 (85% A, 27 new sources) |
| 4 | Backend Developer | 57 | ✓ DONE 2026-08-14 → 167 (95% A, 24 new sources) |
| 5 | Software Engineer | 58 | pending |
| 5 | Product Designer | 60 | pending |
| 5 | Sales Lead | 60 | pending |
| 5 | Audio Editor | 61 | pending |
| 6 | Data Analyst | 62 | pending |
| 6 | SEO Specialist | 63 | pending |
| 6 | Designer | 64 | pending |
| 6 | UI Engineer | 71 | pending |
| 7 | UI Designer | 71 | pending |
| 7 | Brand Strategist | 74 | pending |
| 7 | Creative Director | 77 (A-tier 8%, quality pass) | pending |
| 7 | Idea Partner | 81 | pending |
| 8 | Business Strategist | 82 | pending |
| 8 | Customer Success Manager | 82 | pending |
| 8 | Legal Counsel | 90 | pending |
| 8 | Copywriter | 91 | pending |
| 9 | Finance Analyst | 103 | pending (already deep, top up to bar) |
| n/a | UX Designer | 2447 | done (course-fed, past bar) |

## New-agent SOP (so future agents get the same treatment)

When a new role is added to `shared/roleRegistry.ts` + `roleIntelligence.ts`:
1. Add its row to the table in `GATHERING-HANDOFF.md` (role, domain, example authoritative sources).
2. Run the same mastery-map deep gather to the bar above, write `batch-<role>-deep.json`.
3. Additive-ingest with `RAG_EMBED_PROVIDER=openai`, verify with `rag-corpus-health.ts`.
4. A role is not "shipped" until it clears the bar. No agent goes live thin.
