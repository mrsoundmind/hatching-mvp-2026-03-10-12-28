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

- **Cost note (important):** ColPali is a DIFFERENT COST TIER from the current RAG, not a marginal add. Today doc RAG is near-free (cheap text embeddings + single-vector pgvector + CPU cosine). ColPali adds GPU vision inference on EVERY page and EVERY query (self-hosted GPU ballpark $200 to $700/mo, roughly Rs.17,000 to Rs.60,000/mo, or a hosted per-page endpoint), multi-vector storage, and a Python service to run. Verify current GPU/endpoint pricing before committing.
- **Cheaper path FIRST (try this before ColPali):** at ingest, send each visual page image to a multimodal LLM already in the stack (Gemini Flash vision or GPT-4o-mini vision) with "transcribe and describe this page including tables and charts," then embed the returned TEXT with the existing OpenAI pipeline into pgvector. One cheap vision call per page, no GPU, no multi-vector store, no Python service, reuses the entire current retrieval stack. Captures most of the content of decks/financials/scanned docs at a fraction of the cost. Not as strong as ColPali on fine-grained visual matching, but the right first step.
- **Precondition before pursuing ColPali proper:** confirm (a) real users upload visually-complex docs that the current text-extraction RAG demonstrably mishandles, AND (b) the cheaper describe-then-embed path above is not good enough, AND (c) the VLM inference infra is justified. In that order.

**Top pick from this repo:** 4.1 as the reference method IF Hatchin needs visual document retrieval. A real upgrade for complex PDFs, but infra-gated (Python service + VLM inference + multi-vector store), so it is a future capability, not a now-borrow.

---

## Repo 5: freqtrade/freqtrade
- **URL:** https://github.com/freqtrade/freqtrade
- **What it is:** a free, open-source crypto trading BOT written in Python. It runs unattended, trades on major exchanges, and ships the full autonomy toolchain: backtesting, ML parameter optimization (Hyperopt), adaptive prediction (FreqAI), a dry-run (paper-trading) mode, remote control via Telegram / REST / web UI, and a risk-management "protections" layer.
- **License:** GPL-3.0 (strong copyleft). This is the decisive fact: see the license gate below.
- **Maturity:** very mature, 53.6k stars, roughly 32.7k commits, stable/develop branch split, active. One of the most battle-tested open autonomy codebases there is.
- **Relation to Hatchin (read this first):** the LOWEST domain fit of any repo so far. It is a single-purpose crypto trading bot for a finance vertical, not an AI-team platform, and it is Python. There is nothing product-shaped to take. Its ONE real value is as a hardened reference for the AUTONOMY problem Hatchin also has: a bot that acts on your behalf while you are away and needs brakes, a simulation mode, and remote oversight. Everything here is INSPIRATION for Hatchin's autonomy safety layer, never code.
- **License gate (hard):** GPL-3.0 is viral copyleft. Copying any freqtrade code into Hatchin (a proprietary, closed SaaS) would force Hatchin's combined work to be GPL, a non-starter. Ideas and patterns are not copyrightable, so studying it and reimplementing our own is fine; literal code reuse is OUT. This alone caps the whole repo at INSPIRATION, no BORROW is possible.

| # | Item | Verdict | Why for Hatchin | Where it informs | Effort | License |
|---|---|---|---|---|---|---|
| 5.1 | **Dry-run / paper-trading mode (full pipeline runs, produces the same logs and results, touches nothing real)** | INSPIRATION (strong) | The cleanest model for two Hatchin needs: a "preview what the team would do" mode before autonomy acts, and (bigger) the dry-run-before-live step for the future "Hatchin can code" sandboxed executor. Same code path, real output, zero real-world effect. | autonomy layer + the future coding executor (see cross-cutting decision) | M | Study, reimplement (GPL, no copy) |
| 5.2 | **"Protections" layer (pluggable circuit-breakers: cooldown, max-drawdown stop, stoploss guard, lock after bad outcomes)** | INSPIRATION | A generalized registry of brakes that PAUSE autonomous action on adverse signals. Hatchin has cost caps + a stall watchdog + safety gates as separate pieces; freqtrade's protections is a clean pattern for unifying them into one pluggable safety framework. | `server/autonomy/` safety layer, cost guard, watchdog | M | Study, reimplement |
| 5.3 | **Remote control surface (status / start / stop / performance / force-exit over Telegram + REST + WebSocket)** | INSPIRATION (low) | A reference command set for controlling and inspecting a long-running autonomous process from a chat platform, i.e. what the Mattermost bridge needs (approvals + status + pause). The bridge already has its own design, so this confirms rather than adds. | Mattermost bridge milestone | reference | Study, reimplement |
| 5.4 | **Backtesting / evaluation harness (run a strategy against history, measure it)** | INSPIRATION (low) | Conceptually parallel to Hatchin's benchmark-suite + frozen rubrics + eval scripts, which already exist; ADK item 2.1 (trajectory eval) is the better reference for deepening evals. Low marginal value. | `eval/`, benchmark scripts | reference | Study, reimplement |
| 5.5 | **Hyperopt (numeric hyperparameter search) + FreqAI (price-prediction ML)** | SKIP | Finance-domain-specific: numeric strategy tuning and price forecasting. Hatchin does not tune numeric hyperparameters or forecast prices. No fit. | n/a | n/a | Domain mismatch |
| 5.6 | **Direct code / library use** | SKIP | Triple blocker: GPL-3.0 copyleft (legal no-go for a closed product), Python vs Node/TS, and wrong domain. | n/a | n/a | GPL-3.0 + stack + domain |

**Top pick from this repo:** 5.1 (dry-run mode) as the reference pattern, most valuable for the future coding-executor's dry-run-before-live step, then 5.2 (a unified protections / circuit-breaker framework) for the autonomy safety layer. Everything is study-and-reimplement; GPL-3.0 rules out copying any code.

---

## Repo 6: TauricResearch/TradingAgents
- **URL:** https://github.com/TauricResearch/TradingAgents
- **What it is:** a multi-agent LLM framework that mimics a real trading firm. Specialist LLM agents (a fundamentals/sentiment/news/technical analyst team, bull and bear researchers, a trader, and risk/portfolio managers) collaborate and DEBATE to reach a trading decision. Built on LangGraph; model-agnostic (OpenAI, Google, Anthropic, xAI, DeepSeek). Implementation of arXiv paper 2412.20138.
- **License:** Apache-2.0 (friendly). Unlike freqtrade, the license is NOT the blocker here.
- **Maturity:** the page shows 99.6k stars, but it is v0.3.1 (2026-07) and explicitly a RESEARCH framework carrying a "not financial, investment, or trading advice, research purposes only" disclaimer. Treat the star count as paper virality, not production traction (verify before citing anywhere).
- **Relation to Hatchin (read this first):** like ADK (Repo 2), this OVERLAPS Hatchin's core rather than filling a gap. It is a multi-agent orchestration framework, exactly what Hatchin already has (LangGraph JS + conductor + handoff + peer review + trust). It is also Python and domain-locked to trading. So there is nothing to drop in: it is a REFERENCE, all INSPIRATION. Its ONE distinctive idea that Hatchin does NOT already have is the structured BULL-vs-BEAR debate (see 6.1). Do not be tempted to add trading to Hatchin; the borrow is the debate pattern, not the trading domain (the repo itself disclaims real-trading use).

| # | Item | Verdict | Why for Hatchin | Where it informs | Effort | License |
|---|---|---|---|---|---|---|
| 6.1 | **Bull-vs-Bear structured debate (two agents deliberately argue OPPOSING sides before a decision is committed)** | INSPIRATION (strong, top pick) | The one genuinely new idea here. Hatchin deliberates and peer-REVIEWS work after the fact, but it does not assign adversarial advocates to stress-test a decision BEFORE committing. An "argue both sides" mode would sharpen genuinely ambiguous calls (strategy, positioning, risky autonomy actions). Distinct from peer review: pre-decision divergence vs post-work check. | conductor / deliberation traces / a "stress-test this decision" mode | M | Study, reimplement |
| 6.2 | **Analyst-team decomposition to trader synthesis (many specialists feed one synthesizer)** | INSPIRATION (low, already covered) | Hatchin's conductor + role specialists + Maya synthesizer already does this. Reference only. | existing conductor + Maya | reference | Study, reimplement |
| 6.3 | **Risk / portfolio manager approve-reject gate before an action runs** | INSPIRATION (low, already covered) | Maps to Hatchin's approval card + safety gate. Confirms the pattern, adds nothing new. | approval + safety layer | reference | Study, reimplement |
| 6.4 | **A concrete, opinionated LangGraph multi-agent example (stateful graph, bounded debate rounds, checkpoint/resume)** | INSPIRATION | Hatchin runs on LangGraph JS; this is a real, non-toy LangGraph (Python) app to study for structuring stateful multi-agent graphs and bounded debate rounds. The API is parallel, not identical. | `server/ai/graph.ts`, conductor | reference | Apache-2.0, study |
| 6.5 | **Direct code / library use** | SKIP | Python vs Node/TS, and domain-locked to trading (research-grade, disclaims real use). Overlaps Hatchin's core, fills no gap. License is fine; stack + domain block it. | n/a | n/a | Stack + domain |
| 6.6 | **Adding a "trading agents" feature to Hatchin** | SKIP (caution) | Wrong product, and the repo itself says research-only. The value is the DEBATE PATTERN, not a trading capability. | n/a | n/a | Out of scope |

**Top pick from this repo:** 6.1, the bull-vs-bear structured debate, the single pattern here that Hatchin does not already have. Everything else overlaps the existing orchestration core. Reference only; nothing to copy (Python + trading domain), though Apache-2.0 would permit code reuse if it were ever the same stack.

---

## Repo 7: langchain-ai/langgraph
- **URL:** https://github.com/langchain-ai/langgraph
- **What it is:** a low-level orchestration framework for building long-running, stateful agents. Native durable execution with auto-resume from failure, human-in-the-loop (inspect and modify agent state mid-run), short and long-term memory, streaming, subgraphs, time-travel, LangSmith debugging, and a hosted deployment platform.
- **License:** MIT (very friendly).
- **Maturity:** production-ready, ~40.3k stars, ~7k commits, active.
- **This repo is a SPECIAL CASE (read this first):** this is NOT an outside repo to borrow from. It is the FOUNDATION Hatchin already runs on. Hatchin depends on the JS twin, `@langchain/langgraph` (0.4.9), used in `server/ai/graph.ts` (router + hatch nodes). Note: this URL is the PYTHON repo; the API Hatchin actually tracks is [langgraphjs](https://github.com/langchain-ai/langgraphjs). So the normal BORROW/INSPIRATION/SKIP legend does not apply. The verdicts below are reframed as **UPSTREAM** (already in use), **ADOPT-MORE** (a native capability Hatchin hand-rolled, worth evaluating later), **REFERENCE**, and **SKIP (migration)**.
- **The genuinely useful lens:** this is a chance to audit "what did Hatchin build itself that its own framework already provides natively?" The answer is durability, human-in-the-loop, and memory. The honest conclusion is at the bottom: know these exist, do NOT migrate now.

| # | Item | Verdict | Why for Hatchin | Where it lands | Effort | License |
|---|---|---|---|---|---|---|
| 7.1 | **LangGraph JS core (orchestration substrate)** | UPSTREAM (already in use) | Already Hatchin's graph runtime. No action beyond hygiene: pin the version and test before upgrading (breaking changes are common; CLAUDE.md section 19 already flags this). Track langgraphjs, not this Python repo. | `server/ai/graph.ts` | n/a | MIT |
| 7.2 | **Native durable execution + Postgres checkpointer** | ADOPT-MORE (evaluate, far future) | Hatchin hand-rolled durability (pg-boss + `autonomy_runs`/`run_steps` + the stall watchdog) and it is now battle-tested (the 57f2c94 half-open-socket fix). LangGraph offers this natively. A real consolidation opportunity, but the hand-rolled path is proven and integrated, so this is "know it exists," not "do it." | autonomy durability layer | L (if ever) | MIT |
| 7.3 | **Native human-in-the-loop (interrupt/resume, inspect and edit state)** | REFERENCE | Hatchin's approval cards + safety gates sit ABOVE this as a product layer (humanized reasons, risk-tinted UI). LangGraph's `interrupt()` is a reference for the low-level mechanism; Hatchin's product layer is the value. Low reason to migrate. | approval + safety layer | reference | MIT |
| 7.4 | **Native memory store (short and long term)** | REFERENCE | Hatchin already has `conversation_memory` + RAG (pgvector) + v2.2 outcome-aware memory extraction, all integrated. LangGraph's store is a reference, not a replacement. | memory + RAG layer | reference | MIT |
| 7.5 | **Subgraph / bounded-loop / time-travel patterns** | ADOPT-MORE (low, as the graph grows) | The most forward-looking item: clean patterns for structuring bounded debate rounds (the Repo 6.1 bull/bear idea) and the future "Hatchin can code" delegate flow as the conductor graph gets more complex. Study the JS docs when that work starts. | conductor / graph.ts, future coding flow | S to M | MIT |
| 7.6 | **LangGraph Platform / Studio / hosted deployment** | SKIP | Hatchin deploys on Fly + Supabase + its own Express/WS. Adopting the hosted runtime means rebuilding on someone else's deployment (and the Platform tier is commercial). Not for Hatchin. | n/a | n/a | Platform is commercial |
| 7.7 | **Framework migration (rip out hand-rolled durability/HIL/memory for LangGraph-native)** | SKIP (now) | Big, risky, zero user-facing payoff, and Hatchin's hand-rolled pieces are proven in production. Never pre-launch; revisit only if maintenance burden becomes real. | n/a | n/a | n/a |

**Top pick from this repo:** there is no "borrow" here, the value is the AUDIT LENS. Hatchin hand-rolled durability (7.2), human-in-the-loop (7.3), and memory (7.4) that its own framework provides natively. The honest call: know they exist, keep the JS lib pinned and tested (7.1), do NOT migrate now (proven hand-rolled code + solo founder + pre-launch). The one live adopt-more candidate is 7.5 (subgraph / bounded-loop patterns) as the conductor graph grows for bull/bear debate and the coding delegate.

---

## Repo 8: NousResearch/Hermes-Bot-Mode
- **URL:** https://github.com/NousResearch/Hermes-Bot-Mode
- **What it is:** a desktop-app plugin (JavaScript, `plugin.js`) for Nous Research's Hermes Agent / Hermes Desktop. It turns agent profiles into a managed roster of named bots, each with its own chat history, avatar, personality config, and scheduled routines, so you can run multi-agent workflows inside one desktop interface.
- **License:** MIT (friendly).
- **Maturity:** small (about 645 stars, 114 commits) and ARCHIVED on 2026-08-17. Its functionality was folded into core Hermes Desktop as a bundled, default-on plugin, so the standalone repo is now obsolete. It is a frozen snapshot, not a live project: no dependency, no upgrades.
- **Relation to Hatchin (read this first):** the closest PRODUCT-CONCEPT overlap in the catalog so far. This is essentially a smaller, desktop version of Hatchin's own idea: a roster of named AI agents with avatars and personalities, per-agent chat + history, bot-to-bot messaging with @mentions, and coordinated group chats (2 to 6 bots). Hatchin already does nearly all of this, and usually deeper (conductor routing, peer review with teeth, deliberation, deliverables, RAG memory). So this is a UX / landscape REFERENCE, not a borrow. Two useful takeaways: (a) it VALIDATES the "team of named bots you chat with" category (a serious lab productized it), which also means that surface is now table stakes, not Hatchin's moat, so keep positioning on the orchestration depth; (b) one feature is a genuine idea worth taking (see 8.1). Code is a SKIP (archived + tightly coupled to the Hermes host runtime, not portable to React/Express).

| # | Item | Verdict | Why for Hatchin | Where it informs | Effort | License |
|---|---|---|---|---|---|---|
| 8.1 | **Scheduled recurring agent routines (per-bot cron: "run this every Monday")** | INSPIRATION (top pick) | The one thing Hatchin may not have as a first-class user-facing feature. Hatchin has background/autonomy execution (pg-boss) but not a user-set "every Monday, Kai drafts the weekly growth update" scheduler. Pairs naturally with the marketing-loops idea and the autonomy layer. | autonomy scheduler + a user-facing "routines" UI | M | Study, reimplement |
| 8.2 | **AI-generated portrait avatars for agents (also geometric / image options)** | INSPIRATION (low, polish) | Hatchin has agent avatars; distinct AI-generated Hatch portraits would be a nice identity polish. Caveat: image generation adds cost, so a low-priority nicety, not now. | agent identity / ProjectTree | S | Study, reimplement |
| 8.3 | **Named-bot roster + per-bot chat + history** | REFERENCE (already covered) | Hatchin's agents + conversations already do this. | existing agents / conversations | reference | n/a |
| 8.4 | **Bot-to-bot messaging + @mention + coordinated group chat (2 to 6)** | REFERENCE (already covered, Hatchin deeper) | Hatchin has handoffs, @mention routing, and conductor-coordinated multi-agent responses, with peer review on top. | existing conductor + handoff | reference | n/a |
| 8.5 | **Direct code / plugin reuse** | SKIP | Archived snapshot, and it is a plugin bound to the Hermes Desktop host (Hermes gateway RPCs, Hermes profiles, Hermes image gen), not portable to Hatchin's stack despite being JS. | n/a | n/a | Host-coupled + archived |

**Top pick from this repo:** 8.1, user-facing scheduled recurring agent routines, the one feature Hatchin does not already have as a first-class thing. Everything else Hatchin already does, usually deeper. Treat the whole repo as a landscape signal: the "named-bot team chat" surface is now table stakes, so Hatchin's edge stays the orchestration depth, not the roster.

---

> **Note on Repos 9 to 14 (the Nous Research ecosystem):** these are one connected family, not six unrelated projects. `hermes-agent` (Repo 10) is the hub; `Hermes-Bot-Mode` (Repo 8), `hermes-agent-self-evolution` (Repo 9), `hermes-paperclip-adapter` (Repo 11), and `Hermes-Function-Calling` (Repo 12) plug into or extend it; `atropos` (Repo 13) is a model-training tool; `autonovel` (Repo 14) is a showcase pipeline. Almost all are Python (Hatchin is Node/TS) and most overlap Hatchin's core or sit at a layer Hatchin does not operate at (model training), so the value is concentrated in a few METHODS, not drop-in code.

## Repo 9: NousResearch/hermes-agent-self-evolution
- **URL:** https://github.com/NousResearch/hermes-agent-self-evolution
- **What it is:** automated evolutionary improvement of an agent WITHOUT GPU training. It generates variant versions of skills / prompts / tool descriptions, reads execution traces to understand WHY something failed, proposes targeted textual mutations, evaluates the variants against a test set, passes survivors through constraint gates, and submits the winner as a PULL REQUEST for human review. Loop is DSPy + GEPA (Genetic-Pareto Prompt Evolution). Cost roughly $2 to $10 per optimization run.
- **License:** MIT (friendly).
- **Maturity:** 5.1k stars but VERY early (8 commits, Phase 1 only, rest planned). A promising method, not a finished tool.
- **Relation to Hatchin (this is the most on-theme repo in the whole catalog):** directly targets Hatchin's own "Hatches that self-improve / remember and grow" thesis (v2.1, v2.2, and the DEFERRED growth loop). Hatchin already has runtime improvement (frozen rubrics + auto-revert on regression, feedback injection, personality evolution, gated multi-pass, peer review with teeth). What Hatchin does NOT have is a disciplined OFFLINE optimizer that evolves the role prompts against an eval set and gates changes behind human review. That is exactly the deferred growth loop, and this repo is a clean worked pattern for it, mapping onto Hatchin's existing eval infra (benchmark-suite, frozen rubrics, competence eval, quality lessons).

| # | Item | Verdict | Why for Hatchin | Where it informs | Effort | License |
|---|---|---|---|---|---|---|
| 9.1 | **Offline optimize loop (propose prompt/skill variants to eval against a test set to keep the best to human PR)** | INSPIRATION (strong, top pick) | The disciplined form of Hatchin's deferred growth loop: improve the base quality of role prompts offline, measured against evals, gated by human approval. Maps onto benchmark-suite + frozen rubrics. | growth loop, `roleRegistry`/`roleIntelligence` prompts, eval infra | M to L | Study, reimplement |
| 9.2 | **Trace-informed failure diagnosis to targeted mutation** | INSPIRATION | Hatchin already has run traces + `qualityLessons`; using them to DIAGNOSE then propose a specific prompt fix is the missing link. | `qualityLessons`, autonomy traces | M | Study, reimplement |
| 9.3 | **Constraint gates before accepting a variant (tests pass, size limit, semantic preservation)** | INSPIRATION (confirms) | Matches Hatchin's own rigor-gate discipline (multi-pass rigor gate, auto-revert on regression). Good confirmation of the pattern. | growth loop gates | reference | Study, reimplement |
| 9.4 | **DSPy + GEPA libraries directly** | SKIP | Python; Hatchin is Node/TS. Reimplement the METHOD, do not import the stack. | n/a | n/a | Python stack |
| 9.5 | **Agents self-modifying prompts WITHOUT a human gate** | SKIP (caution) | Keep the human-PR gate this repo uses. Never let Hatchin's agents rewrite their own prompts unsupervised (safety + drift). | n/a | n/a | Safety |

**Top pick from this repo:** 9.1, the offline propose-eval-keep-then-human-PR loop, the exact disciplined shape of Hatchin's deferred growth loop. Method only (Python), and keep the human gate (9.5).

---

## Repo 10: NousResearch/hermes-agent
- **URL:** https://github.com/NousResearch/hermes-agent
- **What it is:** the HUB the other Hermes repos extend. A self-improving agent framework: a CLI plus a messaging gateway that "lives where you do" (Telegram, Discord, Slack, WhatsApp, Signal), with autonomous skill creation, a closed learning loop + persistent memory, a cron scheduler, multi-model support, FTS5 session search with LLM summarization, spawnable isolated subagents, and SEVEN terminal backends (local, Docker, SSH, Singularity, Modal, Daytona, Vercel).
- **License:** MIT. Python + JS/TS.
- **Maturity:** very active (about 25k commits). The fetch read a star count near 235k, which is implausibly high for this repo, so treat that number as UNVERIFIED and check directly before ever citing it.
- **Relation to Hatchin (read this first):** the closest full-framework sibling to Hatchin's whole thesis, and therefore mostly a REFERENCE + competitive signal, not a borrowable part (it overlaps Hatchin's core, and adopting it means rebuilding on someone else's runtime, which is Hatchin's moat). Crucial audience difference: this is a developer / power-user CLI for TECHNICAL people; Hatchin is a team-of-specialists product with peer review + deliverables for NON-technical founders. Its "self-improving agent with memory" claim is exactly Hatchin's differentiation line, so note the competitive reality: keep Hatchin positioned on the multi-agent TEAM + peer review + role depth, not on "an agent that learns."

| # | Item | Verdict | Why for Hatchin | Where it informs | Effort | License |
|---|---|---|---|---|---|---|
| 10.1 | **Sandboxed execution backends (Docker / SSH / Modal / Daytona / Vercel as pluggable code-run targets)** | INSPIRATION (top pick, coding milestone) | The most concrete reference yet for the HARD part of "Hatchin can code": a real menu of sandbox / ephemeral execution backends to run delegated code safely, exactly the security surface flagged in the cross-cutting decision. | "Hatchin can code" sandbox executor | reference | MIT |
| 10.2 | **Multi-platform messaging gateway (Telegram/Discord/Slack/WhatsApp/Signal)** | INSPIRATION (low) | Overlaps Hatchin's already-scoped Mattermost bridge milestone. Confirms the outbound-bot pattern, adds little new. | Mattermost bridge | reference | MIT |
| 10.3 | **FTS5 session search + LLM summarization** | INSPIRATION | Maps to Hatchin's "conversation archival + search" short-term roadmap item. A concrete, cheap pattern to reference. | conversation search (roadmap) | S to M | Study, reimplement |
| 10.4 | **Cron scheduler for automations** | INSPIRATION (dup of 8.1) | Same scheduled-routines idea as Bot-Mode; reinforces that feature is worth building. | autonomy scheduler | M | Study, reimplement |
| 10.5 | **Direct code / framework adoption** | SKIP | Overlaps Hatchin's core, Python-centric, would mean rebuilding on their runtime. Hatchin's runtime is the moat. | n/a | n/a | Stack + core overlap |

**Top pick from this repo:** 10.1, the sandbox execution backends, a genuinely useful reference for the coding milestone's dangerous part. Everything else is landscape + confirmation of things Hatchin already has or has scoped.

---

## Repo 11: NousResearch/hermes-paperclip-adapter
- **URL:** https://github.com/NousResearch/hermes-paperclip-adapter
- **What it is:** a bridge that lets Hermes Agent operate as an "employee" inside Paperclip (a management platform): task assignment + automated execution via Hermes's tools, session continuity, and cost tracking. It spawns the Hermes CLI in single-query mode, captures and parses the raw transcript into TYPED objects, post-processes to markdown, reclassifies stderr so benign logs are not treated as errors, and tracks cost per task. 8 inference providers; MCP client support.
- **License:** MIT. **TypeScript** (the first repo in the coding cluster whose code is actually stack-compatible with Hatchin as a reference).
- **Maturity:** 1.8k stars, early (14 commits).
- **Relation to Hatchin:** this is the DELEGATE ADAPTER PATTERN made concrete, and in the right language. It is almost exactly the integration seam "Hatchin can code" needs: wrap an external coding-agent CLI as a managed worker, run it, capture and parse its output into structured results, track its cost, and hand it back for review. It is coupled to Hermes CLI + Paperclip's API so it is not a drop-in, but the PATTERN is the most directly relevant TypeScript reference in the whole coding cluster. (Landscape aside: "AI as an employee on a task board" is itself a shipped product here, worth watching.)

| # | Item | Verdict | Why for Hatchin | Where it informs | Effort | License |
|---|---|---|---|---|---|---|
| 11.1 | **Wrap an external agent CLI as a managed worker (spawn single-query, capture and parse transcript to typed objects, post-process, cost-track)** | INSPIRATION (top pick, coding milestone) | The concrete, TypeScript version of Hatchin's delegate-not-rebuild plan: how to call an external coding agent and get safe structured results back. | "Hatchin can code" delegate/integration layer | M | Study, reimplement |
| 11.2 | **Structured transcript parsing (raw agent output to typed objects) + stderr reclassification** | INSPIRATION | The discipline for safely consuming an external agent's messy output; analogous to Hatchin's `actionParser` but for a delegated agent. | coding delegate layer, actionParser analog | S to M | Study, reimplement |
| 11.3 | **Per-delegated-task cost tracking** | INSPIRATION (low) | Hatchin already has a cost guard + usage tracker; per-task cost on a delegated agent is a small extension. | cost guard | reference | MIT |
| 11.4 | **Direct adapter reuse** | SKIP | Bound to the Hermes CLI + Paperclip API, neither of which is Hatchin's agent or platform. Take the pattern, not the code. | n/a | n/a | Host-coupled |

**Top pick from this repo:** 11.1, the "wrap an external agent CLI as a peer-reviewable worker" seam, the most stack-compatible reference for how "Hatchin can code" would actually delegate. Pattern, not code.

---

## Repo 12: NousResearch/Hermes-Function-Calling
- **URL:** https://github.com/NousResearch/Hermes-Function-Calling
- **What it is:** inference code that lets the Hermes Pro model do function calling + structured JSON output. ChatML with `<tool_call>` / `<tool_response>` XML tags, Pydantic schema validation, a JSON mode, and example scripts.
- **License:** MIT. Python.
- **Maturity:** 1.5k stars, active (111 commits). Targets Hermes 2 Pro (Llama 3 8B); the format is NOT fully model-agnostic (trained for Hermes).
- **Relation to Hatchin (weakest fit of the Nous cluster):** it is a tool-use PROMPT FORMAT for a model family Hatchin does not use (Hatchin runs DeepSeek / Gemini / Groq), it is Python, and Hatchin already has its own action-block format (`[[ACTION]]`) + tool router + the providers' native JSON modes. ADK item 2.4 already covers "clean, testable, model-agnostic tool contract" better.

| # | Item | Verdict | Why for Hatchin | Where it informs | Effort | License |
|---|---|---|---|---|---|---|
| 12.1 | **Tagged tool-call format + Pydantic-validated structured output** | INSPIRATION (low) | A reference IF Hatchin ever hardens its `[[ACTION]]` blocks into a stricter, schema-validated tagged format. But ADK 2.4 is the better, model-agnostic reference. | `actionParser`, tool contract | reference | Study |
| 12.2 | **Direct use of this code / Hermes models** | SKIP | Hermes-specific, Python, and Hatchin has its own format on different providers. | n/a | n/a | Model + stack |

**Top pick from this repo:** none worth acting on. 12.1 only as a distant reference behind ADK 2.4. This is the lowest-fit repo in the Nous set.

---

## Repo 13: NousResearch/atropos
- **URL:** https://github.com/NousResearch/atropos
- **What it is:** an environment microservice framework for asynchronous reinforcement learning with LLMs: collecting, distributing, and evaluating model TRAJECTORIES across environments (dataset tasks like GSM8K/MMLU, games, code execution, RLHF/RLAIF, multimodal), with WandB + HTML visualization and trainer integrations (Axolotl, Tinker) plus teacher distillation.
- **License:** MIT. Python.
- **Maturity:** 1.3k stars, ARCHIVED on 2026-07-04 (read-only), about 1.6k commits (mature but frozen). GPUs needed only for local inference/training.
- **Relation to Hatchin:** wrong LAYER. This is model-TRAINING infrastructure (RL / RLHF / distillation). Hatchin explicitly does NOT train models (CLAUDE.md section 15 lists "training custom LLMs" as not realistic now). It is also archived and Python.

| # | Item | Verdict | Why for Hatchin | Where it informs | Effort | License |
|---|---|---|---|---|---|---|
| 13.1 | **Standardized eval "environments" + trajectory collection/evaluation** | INSPIRATION (low) | A structural reference for a library of standardized test scenarios to run agents against, but ADK 2.1 already covers trajectory evaluation, is not archived, and is closer to Hatchin's needs. | eval / benchmark harness | reference | Study |
| 13.2 | **RL training / RLHF trajectories / trainer integrations / distillation** | SKIP | Hatchin does not train models (out of scope per CLAUDE.md section 15). Archived, Python, GPU-oriented. | n/a | n/a | Wrong layer |

**Top pick from this repo:** none. A model-training-layer tool, off Hatchin's path; 13.1 only as a distant reference behind ADK 2.1.

---

## Repo 14: NousResearch/autonovel
- **URL:** https://github.com/NousResearch/autonovel
- **What it is:** an autonomous pipeline that turns a seed concept into a complete, publication-ready NOVEL (print PDF, ePub, audiobook, landing page). Multi-phase: Foundation (world/characters/outline) to First Draft (chapters with evaluation) to Automated Revision (adversarial editing, reader panels, dual-persona Opus critic review, modify-evaluate-keep/discard) to Export. It runs a DUAL slop-detection "immune system" (mechanical regex + LLM evaluation) and co-evolving voice/world/character/plot/prose layers.
- **License:** NOT SPECIFIED (no LICENSE file). This matters: no license means all rights reserved by default, so ZERO code reuse is permitted. Ideas and patterns are not copyrightable (inspiration is fine), but nothing can be copied.
- **Maturity:** about 1.5k stars, very early (3 commits, one novel produced). A functional prototype. Depends on Claude (Sonnet + Opus), fal.ai, ElevenLabs, LaTeX.
- **Relation to Hatchin:** the DOMAIN is fiction, not Hatchin's business deliverables, but the METHOD is a worked example of two things Hatchin has already PLANNED. Its dual slop-detection maps straight onto Hatchin's planned Phase 46 (AI Slop Detection), and its adversarial reader-panel revision loop maps onto Hatchin's Phase 39 (Reader Testing) + peer review with teeth. Honest caveat: Hatchin's v2.3 finding was that multi-pass revision NO-OPS on long structured deliverables (they already score about 4.7/5), so the revision-loop value is uncertain for Hatchin's document types; apply where it measurably helps, not blanket.

| # | Item | Verdict | Why for Hatchin | Where it informs | Effort | License |
|---|---|---|---|---|---|---|
| 14.1 | **Dual slop-detection (mechanical regex + LLM evaluator)** | INSPIRATION (strong, top pick) | A direct worked reference for Hatchin's already-planned Phase 46 (AI Slop Detection). Pairs with the existing tone guard (mechanical) + peer-review judge (LLM). | Phase 46, `responsePostProcessing`, peer-review judge | M | Ideas only (no license) |
| 14.2 | **Adversarial revision loop (reader panels + dual-persona critic + keep/discard)** | INSPIRATION | Reference for Phase 39 (Reader Testing) + peer review. Caveat: v2.3 showed multi-pass no-ops on long structured docs, so measure before applying broadly. | Phase 39, peer review, multi-pass | M | Ideas only |
| 14.3 | **Multi-phase long-document pipeline (foundation to draft to revise to export)** | INSPIRATION (low) | A staged approach for very long deliverables; uncertain value given the v2.3 finding. | deliverable generator | reference | Ideas only |
| 14.4 | **Multi-format publishing (ePub / audiobook / landing page)** | SKIP (low) | Far from Hatchin's business-deliverable domain; PDF already exists and PPTX/MP4 is covered by open-design 1.2. | n/a | n/a | Out of scope |
| 14.5 | **Direct code reuse** | SKIP (hard) | No license = all rights reserved (no reuse permitted), and it is Python + fiction domain regardless. Ideas only. | n/a | n/a | No license |

**Top pick from this repo:** 14.1, the dual (mechanical + LLM) slop-detection, a concrete worked reference for the already-planned Phase 46, and 14.2 for Phase 39 with the multi-pass caveat. Ideas only, no code (no license + wrong stack).

---

## Cross-cutting decision: the "Hatchin can code" capability (founder plan, 2026-08-19)
> Confirmed founder plan: give Hatchin's agents the ability to actually build and run code, not just describe it. This is a future MILESTONE, captured here because it re-rates several catalog items. Not built now.

- **Recommended approach: DELEGATE, do not rebuild.** The Engineer/Coda Hatch emits a coding task; an existing coding-agent runtime or sandboxed executor does the work; Hatchin's peer-review Hatch plus the approval gate check it before it ships. This reuses Hatchin's real moat (orchestration + peer review + memory) and treats coding as one more specialist backend, instead of reinventing a coding agent (huge, and someone else's moat). Do NOT fork a Rust coding agent into a Node shop.
- **Integration standards:** ACP (grok-build item 3.2) and MCP (already partly in the tool router) let Hatchin call a coding backend cleanly.
- **The infra piece (the real hard part):** a sandboxed code-execution environment (a hosted sandbox service or ephemeral machines). This, not a coding-agent fork, is the necessary and dangerous piece. Add a research spike before building. Arbitrary code execution is a serious security surface.
- **Positioning guardrail:** the differentiator must stay TEAM-WRAPPED, PEER-REVIEWED code, not the code engine. Do not try to out-code Cursor / Lovable / Replit; win on the team, review, and memory around the coding. Peer-reviewed code from a coordinated team is the edge; raw code generation is a commodity.
- **Sequencing:** a MILESTONE (months), sitting AFTER the launch bottleneck (demo + analytics + activation). Scaffold a milestone brief when ready.
- **Repos that inform it (reference, not forks):** grok-build (ACP, sandboxing, headless mode), ADK (tool-use, human-in-the-loop confirm-before-run, trajectory eval of code agents), freqtrade (dry-run-before-live simulation as the safe pre-execution step; GPL so patterns only, never code), LangGraph (our own substrate: native durable execution + human-in-the-loop + subgraph/bounded-loop patterns to structure the long-running coding-task graph with confirm-before-run), hermes-agent (item 10.1: a concrete menu of sandbox execution backends, Docker/SSH/Modal/Daytona/Vercel, for the dangerous sandbox-executor part), and hermes-paperclip-adapter (item 11.1: the TypeScript "wrap an external agent CLI as a managed, cost-tracked, peer-reviewable worker" seam, the most stack-compatible reference for the delegate layer).

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
