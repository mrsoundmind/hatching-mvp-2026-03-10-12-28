# External-Repo Borrow Catalog (Accumulated Upgrades)

> Backlog Phase 999.1. A running, license-checked list of reusable ideas, assets, and patterns to borrow from open-source repos the founder sends. Built together later as ONE batch, not now. This doc only curates; no product code is written until the item is promoted via /gsd-review-backlog.

## Rules for this catalog
- **No code now.** Only capture what to borrow, why, where it fits in Hatchin, effort, and license. Build later as a batch.
- **License-check every item** before it is promoted. Preserve LICENSE + NOTICE + attribution; state changes. Verify each specific file's license, not just the repo's top-level one.
- **Watch trademarks.** Do not ship replicas of other companies' brand identities (a copyright-clean file can still be a trademark problem).
- **No fabricated proof / verify claims.** Star counts and "traction" from a README are unverified until checked.
- **Match the stack.** Hatchin is React 18 + Vite + Wouter + Express + Drizzle + Postgres. Next.js / other-stack UI code will not port cleanly; prefer patterns and self-contained (framework-agnostic) assets.
- **Fit the discipline.** These are deliverable/polish upgrades, not launch-bottleneck work. They wait behind the demo + analytics + activation priorities.

## Status legend
- **BORROW**: take it (pattern or permissively-licensed asset), build later.
- **INSPIRATION**: study it, reimplement our own; do not copy.
- **SKIP**: do not use (stack mismatch, trademark, security surface, or low value).

---

## Repo 1: nexu-io/open-design
- **URL:** https://github.com/nexu-io/open-design
- **What it is:** "open-source Claude Design alternative." Local-first desktop app that turns coding agents into design-artifact generators (prototypes, decks, dashboards, images, video) as real exportable files, brand-consistent via a `DESIGN.md`. Exports HTML/PDF/PPTX/MP4.
- **License:** Apache-2.0 (bundled parts keep their own license; `html-ppt` / `guizang-ppt` deck templates are MIT).
- **Maturity note (unverified):** README claims ~88k stars but it is v0.10.0 with hundreds of open issues/PRs. Verify traction + maturity before any dependency. Do NOT take a live runtime dependency on a v0.x app.
- **Relation to Hatchin:** adjacent, not a competitor. It generates design artifacts from ONE coding agent; it has no orchestration, no peer review, no agent team, no memory (Hatchin's moat). Overlaps only Hatchin's deliverable + ArtifactPanel + PDF-export surface.

| # | Item | Verdict | Why for Hatchin | Where it lands | Effort | License |
|---|---|---|---|---|---|---|
| 1.1 | **`DESIGN.md` brand-system pattern** | BORROW (concept) | One canonical brand spec (color, type, spacing, voice) injected so every generated deliverable is consistent. Today Hatchin's brand/voice is scattered (roleRegistry voice, tone guard, CLAUDE.md). Doubles as the brand spec for the marketing assets. | New brand spec injected into deliverable generation (`deliverableGenerator.ts` / prompt) + reused by the marketing playbook | S | Pattern only, no code |
| 1.2 | **HTML → PPTX + MP4 export** | BORROW | Hatchin exports branded PDF only. "Export this plan as a deck / video" strengthens deliverables. | Extend `server/ai/pdfExport.ts` into a multi-format exporter | M | MIT deck libs (`html-ppt`/`guizang-ppt`) or PptxGenJS; verify per file |
| 1.3 | **Sandboxed-iframe artifact rendering + export** | INSPIRATION | Richer HTML artifacts (like the reports we publish) rendered safely with export, beyond markdown. | `ArtifactPanel.tsx` | M | Study, reimplement |
| 1.4 | **151 "brand packs" (Shopify, Stripe, Apple, Tesla, and more)** | SKIP | Replicas of real companies' identities. Shipping them is a trademark/passing-off risk and collides with Hatchin's no-impersonation ethos. | Private inspiration only | n/a | Trademark risk |
| 1.5 | **Wholesale Next.js 16 frontend** | SKIP | Stack mismatch (Hatchin is Vite + Wouter). | n/a | n/a | n/a |
| 1.6 | **BYOK SSRF-guarded proxy / daemon-spawns-CLI runtime** | SKIP | Hatchin already has its own provider resolver; the proxy is a security-sensitive surface not worth importing. | n/a | n/a | n/a |

**Top pick from this repo:** 1.1 (`DESIGN.md`) then 1.2 (PPTX/MP4 export). 1.1 is the single genuinely good, zero-entanglement idea here.

---

## Repo 2: google/adk-python
- **URL:** https://github.com/google/adk-python
- **What it is:** Google's Agent Development Kit (ADK). Official, code-first Python toolkit for building, evaluating, and deploying multi-agent systems, model-agnostic (optimized for Gemini). Core abstractions: Agent, graph-based Workflow (routing, fan-out/fan-in, loops, retry), agent-to-agent Tasks, and Tools (custom functions, OpenAPI, MCP).
- **License:** Apache-2.0.
- **Maturity:** production-ready, official Google project, ~21k stars, ADK 2.0 (breaking from 1.x), bi-weekly releases.
- **Relation to Hatchin (read this first):** this one is a REFERENCE, not a source of borrowable code. It is Python; Hatchin is Node/TypeScript and already has its own multi-agent runtime (LangGraph JS plus a custom conductor, handoff orchestrator, peer review with teeth, and trust scoring). ADK overlaps Hatchin's CORE rather than filling a gap, so there is nothing to drop in. Its value is as a mature, Google-built yardstick to benchmark and sharpen Hatchin's own orchestration and evaluation against. No direct BORROW; the wins are INSPIRATION.

| # | Item | Verdict | Why for Hatchin | Where it informs | Effort | License |
|---|---|---|---|---|---|---|
| 2.1 | **Agent evaluation framework (`adk eval`: eval sets, trajectory + final-response scoring)** | INSPIRATION | Deepen the ITL-2 eval/benchmark work just built. ADK scores the agent's PATH (which tools/handoffs it took), not only the final answer, a strong next step for Hatchin's judge/benchmark. | `eval/`, the benchmark scripts, `qualityMetrics.ts` | S to M | Apache-2.0, reference |
| 2.2 | **Graph workflow abstractions (Sequential / Parallel / Loop agents, fan-out/fan-in, retry)** | INSPIRATION | A clean reference model to harden Hatchin's conductor + handoff orchestration (Hatchin already uses LangGraph JS for this). | `server/ai/graph.ts`, `conductor.ts`, handoff orchestrator | reference | Apache-2.0 |
| 2.3 | **Human-in-the-loop tool-confirmation flow** | INSPIRATION | Reference for Hatchin's approval-card and safety-gate UX (approve/reject before an action runs). | approval system | reference | Apache-2.0 |
| 2.4 | **Tool abstraction (MCP + OpenAPI + custom function)** | INSPIRATION | Reference for expanding Hatchin's tool use (the new web seam, future external tools) with a clean, testable tool contract. | `tools/toolRouter.ts`, `webContext.ts` | reference | Apache-2.0 |
| 2.5 | **Direct code / runtime dependency on ADK** | SKIP | Python vs Hatchin's Node/TS; adopting it means running a Python service and rebuilding on someone else's runtime. Hatchin's runtime is the moat and is already built. | n/a | n/a | Stack mismatch |
| 2.6 | **Deployment (Cloud Run / Vertex AI Agent Engine)** | SKIP | Hatchin runs on Fly plus Supabase plus Node. | n/a | n/a | n/a |

**Top pick from this repo:** 2.1 (the evaluation-framework methodology, especially trajectory evaluation) to extend this session's eval work. Everything here is study-and-reimplement, not copy.

---

## Repos pending (incoming from founder)
- _Add the next repo as Repo 3 with the same structure._

---

## Batch build plan (when promoted)
- To be defined at /gsd-review-backlog once the repo list is complete. Likely groups: (a) brand/DESIGN.md layer, (b) export formats, (c) artifact rendering. Sequence behind the launch bottleneck (demo + analytics + activation).
