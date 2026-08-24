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

## Cross-cutting decision: the "Hatchin can code" capability (founder plan, 2026-08-19)
> Confirmed founder plan: give Hatchin's agents the ability to actually build and run code, not just describe it. This is a future MILESTONE, captured here because it re-rates several catalog items. Not built now.

- **Recommended approach: DELEGATE, do not rebuild.** The Engineer/Coda Hatch emits a coding task; an existing coding-agent runtime or sandboxed executor does the work; Hatchin's peer-review Hatch plus the approval gate check it before it ships. This reuses Hatchin's real moat (orchestration + peer review + memory) and treats coding as one more specialist backend, instead of reinventing a coding agent (huge, and someone else's moat). Do NOT fork a Rust coding agent into a Node shop.
- **Integration standards:** ACP (grok-build item 3.2) and MCP (already partly in the tool router) let Hatchin call a coding backend cleanly.
- **The infra piece (the real hard part):** a sandboxed code-execution environment (a hosted sandbox service or ephemeral machines). This, not a coding-agent fork, is the necessary and dangerous piece. Add a research spike before building. Arbitrary code execution is a serious security surface.
- **Positioning guardrail:** the differentiator must stay TEAM-WRAPPED, PEER-REVIEWED code, not the code engine. Do not try to out-code Cursor / Lovable / Replit; win on the team, review, and memory around the coding. Peer-reviewed code from a coordinated team is the edge; raw code generation is a commodity.
- **Sequencing:** a MILESTONE (months), sitting AFTER the launch bottleneck (demo + analytics + activation). Scaffold a milestone brief when ready.
- **Repos that inform it (reference, not forks):** grok-build (ACP, sandboxing, headless mode), ADK (tool-use, human-in-the-loop confirm-before-run, trajectory eval of code agents), freqtrade (dry-run-before-live simulation as the safe pre-execution step; GPL so patterns only, never code), LangGraph (our own substrate: native durable execution + human-in-the-loop + subgraph/bounded-loop patterns to structure the long-running coding-task graph with confirm-before-run).

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
