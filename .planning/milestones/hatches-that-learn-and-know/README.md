# Milestone: Hatches That Actually Learn & Know

**Status:** planned (GSD-tracked, milestone-scoped, additive). Not started. Nothing merged. 2026-08-13.

## What this is
Close the gap between what Hatchin *claims* about agent intelligence and what the code actually does. A deep, code-verified audit (2026-08-13, 4 parallel investigations, file:line) found that three headline promises are aspirational, not real:
- **"Searches the web / finds the latest"**: there is NO live web access. LLM providers have zero tool-use wired; the one web client is dead-gated; the tool router discards its own decision.
- **"Grounded in a deep knowledge base"**: real RAG exists, but over a STATIC corpus embedded once (~Aug 2026), with no freshness, and it silently falls back to the raw model (no signal) when the corpus is empty. `CLAUDE.md` itself notes "RAG not yet wired into the prod deploy," so production may be answering with NO knowledge base at all.
- **"Agents get smarter / self-improve / learn from their mistakes"**: agents remember you (real), but the outcome-based growth loop that would make them improve is explicitly deferred and absent. The one legacy attempt (`trainingSystem`) is in-memory and wired to an unmounted UI.

And a fourth systemic gap: **nothing measures agent quality in production.** Only hand-run offline evals, most last committed 2026-05-04, several of which are structural proxies (keyword-regex "smartness," a router test with no model in the loop) rather than quality.

This milestone makes those claims true, or makes the product honest about them. Full evidence:
- Intelligence Audit (deep): https://claude.ai/code/artifact/b00e317e-e2e0-4252-95f7-e2009cb529d2

## Files
- `REQUIREMENTS.md`: 29 REQ-IDs across 7 categories (KNOW / GRND / LEARN / MEAS / WEB / POS / OPS) + operating rules + open decisions + out-of-scope.
- `COVERAGE-AND-EVIDENCE.md`: the completeness guarantee (every found problem, from every audit, mapped to a requirement, nothing dropped) + the evidence protocol (no fix is done without runtime proof of fixed / working / how).
- `ITL-2-MEASUREMENT-DESIGN.md`: the quality-measurement methodology (measure everything at three fidelities, quality taxonomy per surface, frozen benchmark, improvement detection, validating the judge itself).
- `ITL-2-QUALITY-MATRIX.md`: the surface-by-band traffic-lit matrix (WORKING / PRODUCING WELL / SAFE / OUTCOME / EFFICIENT), the operator surface + coverage gate + standing evidence surface. Expands MEAS to 9 requirements.
- `ITL-0-PLAN.md`: executable plan for the launch-blocking Knowledge Integrity phase.
- `ROADMAP.md`: ITL Phase 0 (Knowledge Integrity) → 1 (Deep Grounding) → 2 (Quality Measurement) → 3 (Real Learning Loop) → 4 (Live Web Research & Web-Learning) → 5 (Positioning Truth-Up), every REQ mapped once, success criteria, dependency order.

## Why this is milestone-scoped (additive), not standard GSD
Same reason the `business-in-a-box` milestone was authored additively: the standard `gsd-new-milestone` mechanics are unsafe here right now.
1. `gsd-sdk` is not installed on this machine (its `gsd-sdk query …` steps can't run).
2. Its `phases.clear` step would DELETE the `.planning/phases/` directories, including a parallel session's **uncommitted, untracked** v2.1-ux / v2.2 work, and reset `STATE.md` off the in-progress milestones.

So per parallel-work-safety, this milestone's Requirements + Roadmap were authored **additively** here, touching nothing else. **Promote to top-level** `REQUIREMENTS.md` / `ROADMAP.md` + real `NN-` phase dirs when v2.1 / v2.2 close, the sibling work is committed, and a clean transition (or `gsd-sdk`) is available.

## Sequencing
Two parts are **launch-blocking** and should not wait for the whole milestone:
- **ITL-0** (is RAG actually live in prod? is grounding honest?): the launch product may currently ship with no knowledge base and no one would know.
- **ITL-5's "stop claiming" slice** (drop "web search" / "self-improves" from public copy): do this before any public launch regardless of when the rest ships.

The build order is dependency-driven: you must **measure** quality (ITL-2) before you can **feed it forward** into a learning loop (ITL-3). Web search (ITL-4) is a decision-first phase; the decision can be made early even if the build is deferred or scoped out.

## Decisions (user, 2026-08-13)
- **D-1, Structure: a full milestone covering all six fix areas** (chosen over a lean 2-phase or single-phase cut).
- **D-2, Scope: everything in** ("all of it"), knowledge integrity, grounding depth, measurement, the learning loop, web research, and positioning honesty.
- **D-3, Web is a committed build, not a decision** (founder, 2026-08-13): agents search + read the web in-answer (WEB-01/02/03) AND continuously learn new info from the web to grow their knowledge over time (WEB-04). ITL-4 renamed Live Web Research & Web-Learning. Two self-improvement engines now exist: ITL-3 (from own outcomes) + WEB-04 (from new web knowledge).

## Open (needs the founder)
- **The one-line prod check that gates ITL-0:** run `SELECT count(*) FROM role_knowledge;` against the production Supabase and confirm the embedding key is set in prod env. If it returns 0, the deep-knowledge feature is silently off in the launch product. Not code-doable from this environment (no prod credentials).
- **Web provider sub-choice (WEB-02):** web is committed to a build (D-3); the remaining call is which search + fetch provider (e.g. a search API like Brave/Tavily/Serper, plus fetch+readability or a headless browser for page extraction) and its budget. Needed before WEB-02 builds.

## Status
Not started. Requirements + Roadmap authored 2026-08-13. Constellation note: top-level `STATE.md` / `ROADMAP.md` / `REQUIREMENTS.md` intentionally NOT touched (sibling-dirty per parallel-work-safety); this milestone dir is self-contained until promotion.
