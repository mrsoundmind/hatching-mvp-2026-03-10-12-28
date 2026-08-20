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

## Repo 3: xai-org/grok-build
- **URL:** https://github.com/xai-org/grok-build
- **What it is:** xAI's (x.ai) terminal-based AI **coding agent** (a Rust CLI/TUI). Understands a codebase, edits files, runs shell commands, searches the web, manages long-running tasks; interactive, headless for CI, or embedded in editors via the Agent Client Protocol (ACP). MCP servers, plugins, hooks, sandboxing.
- **License:** Apache-2.0 (first-party; deps keep their own).
- **Maturity:** official x.ai, ~25k stars, published binaries, active changelog.
- **Relation to Hatchin (originally the weakest fit):** wrong domain AND wrong language. grok-build is a developer tool (a coding agent for people working in a terminal, like Claude Code); Hatchin serves NON-technical founders an AI team that produces plans and documents. Hatchin's Engineer/Coda Hatch writes breakdowns and plans, it does not edit the user's repo or run their shell. And it is Rust vs Hatchin's Node/TS. So there is nothing to copy into the product.
- **UPDATE (2026-08-19, founder plan):** coding IS now a planned Hatchin capability, so this repo is re-rated UP. Items 3.2 (ACP) and 3.3 (sandboxed execution) move from far-future to ACTIVE REFERENCE. Recommended path is to DELEGATE coding to an existing runtime via ACP/MCP and run the output through Hatchin's peer review, NOT to fork this Rust codebase. See the cross-cutting decision below.

| # | Item | Verdict | Why for Hatchin | Where it informs | Effort | License |
|---|---|---|---|---|---|---|
| 3.1 | **Terminal coding-agent runtime (file edit, shell exec, Rust CLI/TUI)** | SKIP | Wrong domain (dev tool, not AI-team-for-founders) and wrong language (Rust). Not a product component. | n/a | n/a | Domain + stack mismatch |
| 3.2 | **Agent Client Protocol (ACP) for embedding agents in external clients** | INSPIRATION (far-future) | A standard to know IF Hatchin later exposes its agents to external clients/editors (relates to the Mattermost/chat-bridge idea). Not now. | future bridge work | reference | Apache-2.0 |
| 3.3 | **Sandboxing + safe shell/code execution** | INSPIRATION (far-future) | Only relevant if the Engineer/Coda Hatch ever executes real code (a long-term roadmap idea). A reference for doing it safely. | far-future feature | reference | Apache-2.0 |
| 3.4 | **MCP servers + plugins + hooks extensibility** | INSPIRATION (low) | Reference for making Hatchin's tool router extensible, but ADK item 2.4 already covers the tool-abstraction angle, so this adds little. | `tools/toolRouter.ts` | reference | Apache-2.0 |
| 3.5 | **As a founder coding tool (build Hatchin faster)** | NOTE, not a borrow | Another coding-agent CLI like Claude Code (already in use). Personal workflow choice, not something that goes into the product. | n/a | n/a | n/a |

**Top pick from this repo:** now items 3.2 (ACP) and 3.3 (sandboxing) as REFERENCE for the planned coding capability (see below). Still not a fork; grok-build is a reference/integration target, not a source of drop-in code.

---

## Repo 4: illuin-tech/colpali
- **URL:** https://github.com/illuin-tech/colpali
- **What it is:** "Efficient Document Retrieval with Vision Language Models." OCR-free document retrieval: it embeds the PAGE IMAGE of a document with a vision-language model and uses ColBERT-style late interaction (multi-vector embeddings + MaxSim scoring), so it retrieves over layout, tables, charts, and scanned pages WITHOUT an OCR / text-extraction pipeline. Python + PyTorch. Models on HuggingFace (PaliGemma-3B, Qwen2-VL, SmolVLM variants).
- **License:** MIT (original models use the Gemma license; newer variants Apache-2.0). Friendly.
- **Maturity:** ~2.8k stars, active, stable PyPI releases, ViDoRe benchmark, models on HF.
- **Relation to Hatchin:** the first repo that touches Hatchin's OWN territory, the RAG / knowledge layer worked on this session. Hatchin's "Upload & Ask" attachments and brain-docs RAG ingest files by extracting TEXT, then embedding it (OpenAI text-embedding-3-small). Fine for prose, but for VISUALLY-rich docs (pitch decks, financial models, scanned contracts, slide PDFs, exactly what the founder/agency ICP uploads) text extraction loses the layout and visual content. ColPali retrieves over the page image itself. A genuine potential upgrade to the attachment/brain experience for complex documents.

| # | Item | Verdict | Why for Hatchin | Where it informs | Effort | License |
|---|---|---|---|---|---|---|
| 4.1 | **OCR-free visual document retrieval (embed the page image, ColBERT late interaction)** | INSPIRATION / future capability | Retrieve over visually-rich PDFs (decks, financials, scanned contracts) that text-extraction RAG loses. State of the art for this. | `conversationDocs.ts` / attachments + brain-docs RAG | L | MIT (models Gemma/Apache) |
| 4.2 | **Token pooling compression (about 66% fewer vectors, ~98% performance kept)** | INSPIRATION | Keeps multi-vector storage affordable IF ColPali is adopted. | future retrieval store | reference | MIT |
| 4.3 | **Interpretability / similarity-map visualization** | INSPIRATION (low) | Could show WHERE on a page an answer came from, a self-documenting "here is the source" UX that fits the cite-or-admit + source-chip work. | future artifact/source UX | reference | MIT |
| 4.4 | **Direct library use inside Hatchin** | SKIP | Python + PyTorch in a Node app. Requires a separate Python inference service, VLM inference (GPU or a hosted endpoint), and a multi-vector / late-interaction store (Hatchin's pgvector is single-vector cosine). Not a drop-in. | n/a | n/a | Infra-gated |

- **Precondition before pursuing:** confirm (a) real users upload visually-complex docs that the current text-extraction RAG demonstrably mishandles, and (b) the VLM inference infra (GPU or hosted) is justified. Cheaper first step: measure the problem, and consider a HOSTED ColPali-style retrieval endpoint before self-hosting a GPU.

**Top pick from this repo:** 4.1 as the reference method IF Hatchin needs visual document retrieval. A real upgrade for complex PDFs, but infra-gated (Python service + VLM inference + multi-vector store), so it is a future capability, not a now-borrow.

---

## Cross-cutting decision: the "Hatchin can code" capability (founder plan, 2026-08-19)
> Confirmed founder plan: give Hatchin's agents the ability to actually build and run code, not just describe it. This is a future MILESTONE, captured here because it re-rates several catalog items. Not built now.

- **Recommended approach: DELEGATE, do not rebuild.** The Engineer/Coda Hatch emits a coding task; an existing coding-agent runtime or sandboxed executor does the work; Hatchin's peer-review Hatch plus the approval gate check it before it ships. This reuses Hatchin's real moat (orchestration + peer review + memory) and treats coding as one more specialist backend, instead of reinventing a coding agent (huge, and someone else's moat). Do NOT fork a Rust coding agent into a Node shop.
- **Integration standards:** ACP (grok-build item 3.2) and MCP (already partly in the tool router) let Hatchin call a coding backend cleanly.
- **The infra piece (the real hard part):** a sandboxed code-execution environment (a hosted sandbox service or ephemeral machines). This, not a coding-agent fork, is the necessary and dangerous piece. Add a research spike before building. Arbitrary code execution is a serious security surface.
- **Positioning guardrail:** the differentiator must stay TEAM-WRAPPED, PEER-REVIEWED code, not the code engine. Do not try to out-code Cursor / Lovable / Replit; win on the team, review, and memory around the coding. Peer-reviewed code from a coordinated team is the edge; raw code generation is a commodity.
- **Sequencing:** a MILESTONE (months), sitting AFTER the launch bottleneck (demo + analytics + activation). Scaffold a milestone brief when ready.
- **Repos that inform it (reference, not forks):** grok-build (ACP, sandboxing, headless mode), ADK (tool-use, human-in-the-loop confirm-before-run, trajectory eval of code agents).

---

## Reference (not a borrow): October (october.dev)
> Not open-source, so nothing to borrow. Logged as a landscape/architecture REFERENCE because it is a productized proof of the "Hatchin can code" delegate approach above.

- **URL:** https://www.october.dev/
- **What it is:** "Infrastructure for supervised AI collaboration." A desktop app (not primarily a CLI) that coordinates multiple real coding agents (Claude Code, Cursor, Cline, Gemini, up to 17 harnesses) across machines, with an "October Bus" for inter-agent messaging over MCP, shared task boards, and a human holding final decision authority. Aimed at TECHNICAL teams (developers, infra, incident response).
- **Openness / license:** not stated on the page; appears to be a closed commercial product with no public repo. Treat as closed: NO code to borrow, and no license to rely on.
- **Verdict:** REFERENCE / LANDSCAPE, not a borrow.
  - **Why it matters:** it is a shipped, productized version of exactly the delegate architecture recommended for the "Hatchin can code" capability (delegate to existing coding agents over MCP + a coordination bus + shared task board + human-in-the-loop final authority). Strong evidence the delegate-not-rebuild direction is viable, and a reference for how the coordination + human-escalation layer can work. Study it, do not copy it.
  - **Competitive read:** different audience (technical teams orchestrating dev agents vs Hatchin's non-technical founders getting a business team), so NOT a direct competitor to Hatchin's core today. Competitor-adjacent only in the future coding-coordination space; Hatchin's edge there stays "we own the team + peer review," not "agent-neutral infra." Watch it.

---

## Repos pending (incoming from founder)
- _Add the next repo as Repo 5 with the same structure._

---

## Batch build plan (when promoted)
- To be defined at /gsd-review-backlog once the repo list is complete. Likely groups: (a) brand/DESIGN.md layer, (b) export formats, (c) artifact rendering. Sequence behind the launch bottleneck (demo + analytics + activation).
