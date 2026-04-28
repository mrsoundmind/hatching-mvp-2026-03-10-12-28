# Hatchin ROADMAP-V2 — Post-v2.0 Strategic Plan

> **Status:** DRAFT — derived from 18-repo evaluation session, not yet validated against user signal.
> **Created:** 2026-04-28
> **Source:** synthesis of repos at `.planning/ROADMAP-V2-sources.md` (the 18 GitHub URLs reviewed)
> **Validation gate:** before committing to execution, run user interviews (see `USER-INTERVIEW-SCRIPT.md`).

---

## Narrative arc

- **v1.x** (shipped) — Hatches can talk and work autonomously
- **v2.0** (shipped) — Hatches can ship coordinated deliverables
- **v2.1 → v2.7** — Hatches become trustworthy, knowledgeable, document-fluent, planning-capable, domain-expert, and infrastructurally callable
- **v3.0** — Hatches become persistent colleagues with structured cognition
- **v4.0** — Hatches act on the user's computer, not just produce content

---

## v2.1 — Hatches That Self-Improve

**Theme:** Make autonomous work *trustworthy*. Refinements stop making things worse silently.

**Pillars:**
1. **Frozen-Rubric Deliverable Iteration** — every refinement scored 0–10 on locked, type-specific rubrics. Auto-revert if new version scores lower. Rubric explains "what a 10 looks like" so reverts are educational.
2. **Git-Style Run Tree** — autonomous runs become trees of advance/revert steps. New tables `autonomy_runs` + `autonomy_run_steps`. Activity feed visualizes the tree with score deltas.
3. **"Never Stop, Never Ask" Autonomy Prompt** — at level-4 autonomy, Hatches stop asking "should I keep going?". Prompt directive lifted verbatim from autoresearch's `program.md`.
4. **Reader Testing Peer Review Mode** — context-naïve fresh reviewer for doc-type deliverables. Catches hidden jargon and missing context.
5. **Internal eval migration to promptfoo** — engineering-quality work, not user-visible. Replaces bespoke `scripts/test-*` files.

**Sources:** autoresearch (3 patterns), gstack (rate-then-explain), doc-coauthoring (Reader Testing), promptfoo, context-engineering `advanced-evaluation`.

**Effort:** 4-7 weeks.

**Hard dependency:** none (foundation milestone).

**Key files:** `taskExecutionPipeline.ts`, `peerReviewRunner.ts`, `deliverableGenerator.ts`, new schema for `autonomy_runs`/`autonomy_run_steps`, `ArtifactPanel.tsx`.

---

## v2.1.5 — Hatches Research Live

**Theme:** Stop making things up. Pro-tier Hatches actually look things up mid-conversation.

**Pillar:** Live web research for 9 research-heavy roles (Robin, Kai, Nova, Cass, Rio, Sage, Blake, Mira, Wren, Maya). Pro-only feature. Provider-agnostic abstraction (default Tavily, swap-in Exa/Firecrawl/Perplexity).

**Sources:** tavily-mcp.

**Effort:** 1-2 weeks.

**Hard dependency:** none, but pairs naturally with v2.1's frozen rubric for citation-quality scoring.

**Key files:** new `server/ai/research/webResearchService.ts`, intent classifier extension in `server/ai/tasks/intentClassifier.ts`.

---

## v2.2 — Hatches Read Real Files

**Theme:** Stop fumbling user-uploaded documents. Read PDFs, Excel, PowerPoint properly.

**Pillars:**
1. **Smart Brain Upload** — PDF OCR for scanned docs, structured table extraction, XLSX sheet parsing, PPTX text extract.
2. **Hatches Fill Forms** — fillable PDFs (NDAs, vendor questionnaires, expense reports) get populated from project brain by ops/HR/strategy roles.
3. **Bound Package Export** — v2.0 package PDFs merge into one bound deliverable with cover + auto-TOC.

**Sources:** anthropics PDF skill (pypdf, pdfplumber patterns; Node equivalents pdf-lib, pdf-parse).

**Effort:** 4-6 weeks.

**Hard dependency:** none.

**Key files:** `extractDocumentText.ts`, `pdfExport.ts`, new `server/lib/formFiller.ts`, `DocumentUploadZone.tsx`.

---

## v2.3 — Hatchin Task Graph

**Theme:** Move from reactive task creation to strategic planning. Agents follow a DAG, not chat momentum.

**Pillars:**
1. **PRD → Task Tree decomposition** — Maya runs `decomposeProject(spec)` on a pasted PRD/brief. Output: hierarchical task tree with role-tagged assignees, deliverables, dependency edges, effort estimates.
2. **Task Dependency DAG** — explicit `task_dependencies (task_id, depends_on_task_id, kind: 'blocks'|'informs')`. Handoff orchestrator becomes DAG-aware.
3. **Workstreams** — parallel tracks (Engineering / Design / Marketing as separate DAG slices). Per-workstream model selection (cost-tune by track).
4. **Research Subtask Type** — `task.kind = 'research'` calls v2.1.5's webResearchService instead of generating prose.

**Sources:** claude-task-master (PRD parser, DAG, workstreams, research command), claude-squad (parallel-agent pattern reference), langflow (visual canvas reference for the UI).

**Effort:** 6 weeks.

**Hard dependency:** v2.1.5 (for research subtask).

---

## v2.4 — Hatch Intelligence: Marketing Depth

**Theme:** 11 marketing-adjacent Hatches transition from "competent generalist" to "domain expert."

**Pillar:** Port ~30 marketing skills as role-specific framework injections in `shared/roleIntelligence.ts`. Lazy-load per-skill into prompt context only when intent classifier matches. Cache via existing v1.2 reasoning cache.

**Affected roles:** Wren, Robin, Kai, Drew, Pixel, Nova, Cass, Mira, Blake, Quinn, Rio.

**Sources:** marketingskills (40 skills, ~30 ported).

**Effort:** 3-4 weeks (mostly content curation).

**Hard dependency:** none, but `context-degradation` skill informs prompt-safety design.

---

## v2.5 — Hatches Ship Real Files

**Theme:** Stop shipping markdown narratives. Ship actual professional artifacts in business formats.

**Pillars:**
0. **Brand Identity Foundation** — `project.brand` JSONB schema (colors, fonts, logo, voice tone). Cass interrogates user during onboarding (URL extract + image color sampling). All file generators read brand before producing output. Prerequisite for Pillars 1-3.
1. **XLSX deliverables** — working spreadsheets with industry-standard color coding (blue=inputs, black=formulas, green=cross-sheet links), zero formula errors gate, proper number formatting. Roles: Blake, Morgan, Rio, Sage, Quinn.
2. **PPTX deliverables** — branded decks with design-philosophy enforcement (no AI slop palettes, dominance over equality, committed visual motif). Roles: Cass, Zara, Nova, Kai, Maya.
3. **Interactive Prototype deliverables** — React+shadcn HTML bundles, sandboxed iframe rendering. Roles: Cleo, Lumi, Finn, Arlo, Roux.

**Sources:** xlsx skill, pptx skill, web-artifacts-builder, brand-guidelines (pattern reference).

**Effort:** 7-9 weeks.

**Hard dependency:** Pillar 0 must ship before 1-3.

**Affects:** 15 of 30 roles transitioning from "narrative" to "real artifact."

---

## v2.5.5 — Hatches Produce Deep Research Reports

**Theme:** Multi-Hatch orchestrated research engagements producing McKinsey-grade reports.

**Pillars:**
1. New `deepResearch` package template orchestrating multi-Hatch 8-phase pipeline (Scope → Plan → Retrieve → Triangulate → Outline → Synthesize → Critique → Refine → Package).
2. New `deep_research_report` deliverable type, brand-applied via v2.5 Pillar 0.
3. Multi-persona red teaming: 3 reviewer Hatches (Skeptical Practitioner = Blake/Cass, Adversarial Reviewer = Sam, Implementation Engineer = Dev/Coda).
4. Validation loops (9 structural checks + citation/hallucination detection) folded into v2.1 frozen rubric.

**Sources:** claude-deep-research-skill.

**Effort:** 4 weeks.

**Hard dependency:** v2.5 (brand layer applies to report output).

---

## v2.6 — Hatch Trust & Safety [DEFERRED CANDIDATE]

**Theme:** Continuous red-team scanning of Hatches; user-facing dashboard.

**Status:** **deferred until customer signal warrants it.** Enterprise-tier feature; not aligned with current $19 Pro pricing. Promote when a real Enterprise prospect requests it.

**Pillars (when activated):**
1. Three-tier attack scanning (regex / Groq-cheap / Pro-expensive) running async via pg-boss.
2. Brain-upload pre-scan (only sync scan in the system, ~5-10s).
3. Calibration-period dashboard with per-project allowlist + 👍/👎 feedback.
4. Risk score trend + smart grouping + delta-only default view.
5. Evidence reports (not certifications); partner-ready for Vanta/Drata.
6. Hard cost cap integrated with v1.1's budget infrastructure.

**Sources:** promptfoo (red-teaming), gstack `/cso` (8/10 confidence gate, false-positive exclusions).

**Effort:** 4-5 weeks when activated.

**Hard dependency:** v2.1 (uses frozen rubric infrastructure).

---

## v2.7 — Hatchin as Infrastructure

**Theme:** Configured Hatch teams become callable from outside Hatchin's chat UI.

**Pillars:**
1. **Project-as-API** — every Pro project gets stable REST endpoint per Hatch (`POST /api/v1/projects/:id/hatches/:hatchId/ask`). API key auth via AccountPage.
2. **Project-as-MCP-Server** — every Pro project exposes MCP endpoint. Hatches become MCP tools other AI agents can use.
3. **Webhook triggers** — schedule Hatches on cron or external events.
4. **Workflow export/import (JSON)** — package project (Hatches + brain + brand + task graph) as portable JSON. Marketplace candidate.

**Sources:** langflow (deploy-as-API, deploy-as-MCP, JSON export patterns).

**Effort:** 4-5 weeks.

**Hard dependency:** v2.5 (brand applies to API outputs), v2.3 (task graph for webhook scheduling).

**Strategic impact:** repositions Hatchin from "ChatGPT competitor" to "Zapier-for-AI-agents" — different category, stickier moat.

---

## v3.0 — Hatch Mental Models

**Theme:** Persistent, structured cognition. Hatches remember, believe, want, and intend across sessions.

**Pillars:**
1. **Graph Memory Layer** — entity-relationship graph replaces flat `conversationMemory`. Tracked: people, decisions, constraints, deliverables, deadlines, brand attributes, preferences. Persists across sessions; survives context compaction.
2. **BDI Mental States per Hatch** — formal `{beliefs, desires, intentions}` per Hatch per project. Updates on every interaction; queryable.
3. **Cross-Session Continuity** — Maya's morning briefing reads from graph state. Replaces "what were we discussing?" cold start.
4. **Latent Briefing for Multi-Hatch Handoffs** — KV-cache compaction between agents (per `latent-briefing` skill) → reduces token cost in v2.0 packages.

**Sources:** context-engineering `memory-systems` + `bdi-mental-states` + `latent-briefing`.

**Stack additions:** Mem0 (Postgres-friendly) OR Zep+Graphiti (needs Neo4j). New `mental_states` + `entity_graph` tables.

**Effort:** 8-10 weeks.

**Hard dependency:** v2.1 (rubrics audit memory consistency), v2.3 (intentions point at DAG nodes), v2.5.5 (research outputs become graph nodes).

**Major-version bump rationale:** changes Hatchin's data model fundamentally.

---

## v4.0 — Hatches That Act ("Hatchin Desktop")

**Theme:** Hatches stop producing instructions you have to execute. They execute themselves, with approval, in your apps.

**Pillars:**
1. **Hatchin Desktop (macOS)** — Electron+native bridge wrapping Ghost OS as MCP. Local agent ↔ Hatchin Cloud via WebSocket.
2. **Recipe library per Hatch** — Robin learns SEO recipes (CMS edits), Drew learns email recipes (Gmail send), Pixel learns social recipes (LinkedIn post), Quinn learns ops recipes (Linear ticket). Project-portable JSON.
3. **Approval gating** — every action proposed in chat with one-click Approve. v2.1 rubric + v2.6 red-team gate every recipe before execution.
4. **Recipe marketplace** — users share/sell recipes. Network effect moat.

**Sources:** ghost-os (accessibility-tree computer-use, self-learning recipes).

**Effort:** 12-16 weeks.

**Hard dependency:** v3.0 (persistent memory required for trustworthy action).

**Constraints:** macOS-only initially; HIPAA/GDPR-sensitive (lawyer review required); reliability is brittle (frozen-rubric pattern is foundation).

**Strategic impact:** redefines Hatchin's category. Justifies $500-2,000/month Enterprise tier.

---

## Summary table

| Milestone | Theme | Effort | Hard deps |
|---|---|---|---|
| v2.1 | Self-Improve | 4-7w | — |
| v2.1.5 | Research Live | 1-2w | — |
| v2.2 | Read Real Files | 4-6w | — |
| v2.3 | Task Graph | 6w | v2.1.5 |
| v2.4 | Marketing Depth | 3-4w | — |
| v2.5 | Ship Real Files | 7-9w | — (Pillar 0 → 1-3 internal) |
| v2.5.5 | Deep Research | 4w | v2.5 |
| v2.6 | Trust & Safety | 4-5w | v2.1 (deferred) |
| v2.7 | Infrastructure | 4-5w | v2.5, v2.3 |
| v3.0 | Mental Models | 8-10w | v2.1, v2.3, v2.5.5 |
| v4.0 | Hatches That Act | 12-16w | v3.0 |

**Total runway:** ~12-15 months end-to-end.

---

## Side candidates (not their own milestone)

- **31st Hatch — Security Officer (gstack /cso pattern)** — folded into v2.4 as a role addition.
- **Maya enhancement — 3-stage interrogation** — inside v2.1 (combines gstack /office-hours + doc-coauthoring Stage 1).
- **AI Slop detection** — peer-review-lens addition for Cleo/Wren in v2.1.

---

## Architecture references (not new scope, inform every milestone)

- `context-engineering` skills (14) — design rigor for every multi-agent decision
- claude-squad — pattern reference for v2.1 run-tree UI + v2.3 workstreams
- container-use — foundation for deferred Engineer Hatch coding (v3.5+)

---

## Validation gate before execution

**Do NOT run `/gsd-new-milestone v2.1` until completing user validation per `USER-INTERVIEW-SCRIPT.md`.**

Decision rule:
- 5+ users name same gap → that becomes v2.1, override roadmap
- User signal points to gaps not in roadmap → add them, deprioritize unbacked milestones
- User signal validates v2.1 (autonomy trust) → proceed as written

---

## Rollback

- Per-milestone: `/gsd-undo` (built into GSD)
- Pre-milestone snapshot tags: `git tag pre-v2.1-snapshot` before each milestone starts
- Roadmap pivot: archive this file → `.planning/archive/ROADMAP-V2-aborted-YYYY-MM-DD.md`
- Skill/MCP rollback: `~/rollback-recent-installs.sh`
