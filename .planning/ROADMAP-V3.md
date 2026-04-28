# Hatchin ROADMAP-V3 — Unified Plan (Post-v2.0)

> **Status:** ACTIVE — synthesized from 18 repo evaluations, 15-item gap audit (Apr 25-26), and product/methodology decisions.
> **Created:** 2026-04-28
> **Supersedes:** ROADMAP-V2 (archived at `.planning/archive/ROADMAP-V2-superseded-2026-04-28.md`)
> **Validation status:** USER-LETTER-DETAILED.pdf sent to Pro users; responses being collected.

---

## Narrative arc

- **v1.x** (shipped) — Hatches can talk and work autonomously
- **v2.0** (shipped) — Hatches can ship coordinated deliverables
- **v2.1 → v2.7** — Hatches become trustworthy, knowledgeable, document-fluent, methodology-aware, domain-expert, file-fluent, and infrastructurally callable
- **v3.0** — Hatches become persistent colleagues with structured cognition
- **v4.0** — Hatches act on the user's computer, not just produce content

---

## Quick summary

**12 active phases (Phase 0 hotfixes + 11 milestones), ~12-14 months parallelized, ~16-20 months serial.**

| Phase | Theme | Effort |
|---|---|---|
| 0 | Production Hotfix Pass | 1 day |
| v2.1 | Hatches That Self-Improve | 5-7w |
| v2.1.5 | Hatches Research Live | 1-2w |
| v2.2 | Hatches Read Real Files | 4-6w |
| v2.3 | Hatchin Project Methodology Engine | 8-9w |
| v2.4 | Hatch Intelligence: Marketing Depth (+ 31st Hatch: Security Officer) | 3-4w |
| v2.5 | Hatches Ship Real Files (with brand layer) | 7-9w |
| v2.5.5 | Hatches Produce Deep Research Reports | 4w |
| v2.6 | Hatch Trust & Safety | 4-5w (deferred — enterprise trigger) |
| v2.7 | Hatchin as Infrastructure | 4-5w |
| v3.0 | Hatch Mental Models | 8-10w |
| v4.0 | Hatches That Act ("Hatchin Desktop") | 12-16w |

---

## Parallelization map (real time savings)

Three legitimate parallel windows reduce critical path by 13-17 weeks:

| Window | Parallel pair | Savings |
|---|---|---|
| 1 | v2.1 (engineering) + v2.4 (content curation) | 3-4w |
| 2 | v2.2 (file uploads) + v2.3 (task graph) | 4-6w |
| 3 | v2.5.5 (deep research) + v2.7 (infrastructure) | 3-4w |

**Critical path: ~14 months to v3.0 ship. ~18 months to v4.0 ship.**

---

## Phase 0 — Production Hotfix Pass

**Theme:** Trivial production polish that's good either way.

| Item | Source | Effort |
|---|---|---|
| LEGAL-01 — privacy/terms links in landing footer | Gap audit #10 | 5 min |
| AUTH-GATE-01 — `/account` redirect for unauthed users to `/login?return=/account` | Gap audit #11 | 15 min |
| Graceful LLM degradation UX — typed errors + non-blocking banner | Gap audit #9 | 1-2 hr |

**Ship:** as 3 separate atomic commits via `/gsd-fast`. Total ~2 hours.

---

## v2.1 — Hatches That Self-Improve

**Theme:** Make autonomous work *trustworthy*. Refinements stop making things worse silently.

**Pillars:**
1. **Frozen-Rubric Deliverable Iteration** — every refinement scored 0–10 on locked, type-specific rubrics. Auto-revert if new version scores lower. Rubric explains "what a 10 looks like."
2. **Git-Style Run Tree** — `autonomy_runs` + `autonomy_run_steps` tables. Activity feed visualizes the tree with score deltas.
3. **"Never Stop, Never Ask" Autonomy Prompt** — at level-4 autonomy, Hatches stop asking "should I keep going?".
4. **Reader Testing Peer Review Mode** — context-naïve fresh reviewer for doc-type deliverables.
5. **Internal eval migration to promptfoo** — replaces bespoke `scripts/test-*` files.
6. **Conversation Phase Machine** (gap #1) — Discovery → Draft → Building states; Maya knows what mode she's in.
7. **Minimum-Viable-Brain Gate** (gap #2) — Maya stops asking once enough context is gathered.
8. **Skip-Maya Escape Hatch** (gap #12) — opt-in 3-field form for power users who want speed over conversation.
9. **Per-Run Cost Visibility** (gap #7) — autonomy quota and recent-run cost shown in UsageBar.
10. **Maya 3-Stage Interrogation** — gstack /office-hours + doc-coauthoring patterns folded into Maya's project-kickoff.
11. **AI Slop Detection** — peer-review-lens addition for Cleo/Wren/Mira/copy-producing Hatches.

**Sources:** autoresearch (3 patterns), gstack (rate-then-explain), doc-coauthoring (Reader Testing + 3-stage), promptfoo, context-engineering `advanced-evaluation`, gap audit items 1, 2, 7, 9, 12.

**Effort:** 5-7 weeks.

**Hard dependency:** none (foundation milestone).

**Key files:** `taskExecutionPipeline.ts`, `peerReviewRunner.ts`, `deliverableGenerator.ts`, new schema for `autonomy_runs`/`autonomy_run_steps`, `ArtifactPanel.tsx`, `UsageBar.tsx`, new `server/ai/research/conversationPhase.ts`.

---

## v2.1.5 — Hatches Research Live

**Theme:** Stop making things up. Pro-tier Hatches actually look things up mid-conversation.

**Pillar:** Live web research for 9 research-heavy roles (Robin, Kai, Nova, Cass, Rio, Sage, Blake, Mira, Wren, Maya). Pro-only. Provider-agnostic abstraction (default Tavily, swap-in Exa/Firecrawl/Perplexity).

**Sources:** tavily-mcp, context-engineering `tool-design`.

**Effort:** 1-2 weeks.

**Hard dependency:** none.

**Key files:** new `server/ai/research/webResearchService.ts`, intent classifier extension in `server/ai/tasks/intentClassifier.ts`.

---

## v2.2 — Hatches Read Real Files

**Theme:** Stop fumbling user-uploaded documents.

**Pillars:**
1. **Smart Brain Upload** — PDF OCR for scanned docs, structured table extraction, XLSX sheet parsing, PPTX text extract.
2. **Hatches Fill Forms** — fillable PDFs populated from project brain.
3. **Bound Package Export** — v2.0 package PDFs merge into one bound deliverable.

**Sources:** anthropics PDF skill, context-engineering `context-compression` (large-file context handling).

**Effort:** 4-6 weeks.

**Key files:** `extractDocumentText.ts`, `pdfExport.ts`, new `server/lib/formFiller.ts`, `DocumentUploadZone.tsx`.

---

## v2.3 — Hatchin Project Methodology Engine

**Theme:** Move from reactive task creation to strategic, methodology-aware project orchestration.

**Pillars:**
1. **PRD → Task Tree decomposition** — Maya parses a brief into hierarchical task tree.
2. **Task Dependency DAG** — `task_dependencies (task_id, depends_on_task_id, kind: 'blocks'|'informs')`. DAG-aware handoff orchestrator.
3. **Workstreams** — parallel tracks with per-workstream model selection (cost-tune by track).
4. **Research Subtask Type** — `task.kind = 'research'` invokes v2.1.5's webResearchService.
5. **Methodology Templates** — pick a methodology when creating a project: Conversational, Sprint, GSD, Agile-Lite, Custom. Each defines hierarchy depth, required fields, quality gates, vocabulary.
6. **Methodology-Aware UI** — same task data displays differently per methodology (Kanban for Sprint, hierarchical tree for GSD, list for Conversational).
7. **Dynamic Team Formation** (gap #13) — embedding-based 3-4 agent recommendation when starting a new project workstream.

**Sources:** claude-task-master, claude-squad (parallel-agent reference), langflow (visual canvas reference), GSD methodology (the planning system Hatchin itself uses), context-engineering `multi-agent-patterns`, gap audit #13.

**Effort:** 8-9 weeks (was 6w; +3w for methodology templates and dynamic team formation).

**Hard dependency:** v2.1.5.

**Key files:** `shared/schema.ts` extension, new `server/orchestration/methodologyEngine.ts`, `client/src/components/sidebar/TasksTab.tsx` rewrite.

---

## v2.4 — Hatch Intelligence: Marketing Depth

**Theme:** 11 marketing-adjacent Hatches transition from "competent generalist" to "domain expert." Plus a new 31st Hatch.

**Pillars:**
1. **Port ~32 marketing skills into role-specific framework injections** in `shared/roleIntelligence.ts`. Per-skill mapping locked in `.planning/v2.4-MARKETING-SKILL-MAPPING.md`. Lazy-load on intent match. Cached via v1.2's reasoning cache.
2. **31st Hatch: Security Officer** — gstack /cso pattern. OWASP Top 10 + STRIDE threat model with 8/10+ confidence gate. Triggered when project has code or sensitive data flows.
3. **Foundation skill `product-marketing-context`** — becomes a structured field on `project.brain` captured during onboarding.

**Affected roles (existing):** Wren, Robin, Kai, Drew, Pixel, Nova, Cass, Mira, Blake, Quinn, Rio.
**New role:** Security Officer (Hatch #31).

**Sources:** marketingskills (40 skills, 32 ported), gstack (/cso pattern), context-engineering `context-degradation` (prompt-safety design for skill injection).

**Effort:** 3-4 weeks (mostly content curation).

**Hard dependency:** none.

---

## v2.5 — Hatches Ship Real Files

**Theme:** Stop shipping markdown narratives. Ship actual professional artifacts in business formats, in *your* brand.

**Pillars:**
0. **Brand Identity Foundation** — `project.brand` JSONB schema (colors, fonts, logo, voice tone). Cass interrogates user during onboarding (URL extract + image color sampling). All file generators read brand before producing output. Prerequisite for Pillars 1-3.
1. **XLSX deliverables** — working spreadsheets, industry-standard color coding, zero formula errors. Roles: Blake, Morgan, Rio, Sage, Quinn.
2. **PPTX deliverables** — branded decks with design-philosophy enforcement. Roles: Cass, Zara, Nova, Kai, Maya.
3. **Interactive Prototype deliverables** — React+shadcn HTML bundles, sandboxed iframe rendering. Roles: Cleo, Lumi, Finn, Arlo, Roux.

**Sources:** xlsx skill, pptx skill, web-artifacts-builder, brand-guidelines (pattern reference).

**Effort:** 7-9 weeks.

**Hard dependency:** Pillar 0 ships before 1-3.

**Affects:** 15 of 31 roles.

---

## v2.5.5 — Hatches Produce Deep Research Reports

**Theme:** Multi-Hatch orchestrated research engagements producing McKinsey-grade reports.

**Pillars:**
1. New `deepResearch` package template orchestrating multi-Hatch 8-phase pipeline.
2. New `deep_research_report` deliverable type, brand-applied via v2.5 Pillar 0.
3. Multi-persona red teaming: Skeptical Practitioner = Blake/Cass, Adversarial Reviewer = Sam, Implementation Engineer = Dev/Coda.
4. Validation loops folded into v2.1 frozen rubric.

**Sources:** claude-deep-research-skill, context-engineering `latent-briefing` (KV-cache compaction across 8 phases — performance optimization).

**Effort:** 4 weeks.

**Hard dependency:** v2.5 (brand layer applies to report output).

---

## v2.6 — Hatch Trust & Safety [DEFERRED — enterprise trigger]

**Status:** Backlog. Promote when a real Enterprise prospect requests it.

**Pillars (when activated):**
1. Three-tier attack scanning (regex / Groq-cheap / Pro-expensive) running async via pg-boss.
2. Brain-upload pre-scan (only sync scan in the system).
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
1. **Project-as-API** — every Pro project gets stable REST endpoint per Hatch.
2. **Project-as-MCP-Server** — Hatches become MCP tools other AI agents can use.
3. **Webhook triggers + Scheduled routines** (gap #15) — schedule Hatches on cron or external events.
4. **Workflow export/import (JSON)** — package project as portable JSON.
5. **Atomic Budget Enforcement** (gap #14) — fixes runaway-spend race condition; hard ceilings per project.

**Sources:** langflow, gap audit #14 + #15, context-engineering `tool-design`.

**Effort:** 4-5 weeks.

**Hard dependency:** v2.5 (brand applies to API outputs), v2.3 (task graph for webhook scheduling).

**Strategic impact:** repositions Hatchin from "ChatGPT competitor" to "Zapier-for-AI-agents."

---

## v3.0 — Hatch Mental Models

**Theme:** Persistent, structured cognition. Hatches remember, believe, want, and intend across sessions.

**Pillars:**
1. **Graph Memory Layer** — entity-relationship graph replaces flat `conversationMemory`. Tracked: people, decisions, constraints, deliverables, deadlines, brand attributes, preferences.
2. **BDI Mental States per Hatch** — formal `{beliefs, desires, intentions}` per Hatch per project.
3. **Cross-Session Continuity** — Maya's morning briefing reads from graph state.
4. **Cross-Project User Preferences** (gap #3) — tone, verbosity, role learned once, applied across all user's projects.
5. **Latent Briefing for Multi-Hatch Handoffs** — KV-cache compaction reduces token cost in v2.0 packages.

**Sources:** context-engineering `memory-systems` + `bdi-mental-states` + `latent-briefing`, gap audit #3.

**Stack additions:** Mem0 (Postgres-friendly) OR Zep+Graphiti (needs Neo4j). New `mental_states` + `entity_graph` tables.

**Effort:** 8-10 weeks.

**Hard dependency:** v2.1, v2.3, v2.5.5.

---

## v4.0 — Hatches That Act ("Hatchin Desktop")

**Theme:** Hatches stop producing instructions you have to execute. They execute themselves, with approval, in your apps.

**Pillars:**
1. Hatchin Desktop (macOS) — Electron+native bridge wrapping Ghost OS as MCP.
2. Recipe library per Hatch — Robin learns SEO recipes, Drew learns email recipes, etc.
3. Approval gating — every action proposed with one-click Approve.
4. Recipe marketplace — users share/sell recipes.

**Sources:** ghost-os, container-use (foundation pattern for sandboxed execution when needed).

**Effort:** 12-16 weeks.

**Hard dependency:** v3.0.

**Constraints:** macOS-only initially, HIPAA/GDPR-sensitive, reliability brittle.

**Strategic impact:** redefines Hatchin's category. Justifies $500-2,000/month Enterprise tier.

**See:** `.planning/SEED-V4.md` for full thesis, constraints, pricing implications.

---

## Backlog (acknowledged, uncommitted)

These are real ideas but don't have committed milestone homes. Surface to active roadmap when triggered.

| Item | Source | Trigger to promote |
|---|---|---|
| Disagreement Orchestration | Gap audit #4 (deferred to v3.2) | After v3.0 stabilizes; user signal demands multi-Hatch debate |
| Project Milestones / Definition-of-Done | Gap audit #5 (deferred to v3.2) | When users explicitly request milestone tracking inside projects |
| v2.6 Trust & Safety | ROADMAP-V2 deferral | First Enterprise prospect requests compliance |
| Engineer Hatch Ships Code (v3.5+) | container-use foundation | After v3.0 + when Hatchin's audience demonstrably wants code execution |

---

## Architecture references (not features, inform every milestone)

These were evaluated but don't live in any single milestone — they're load-bearing for design decisions across the roadmap.

- **context-engineering 14 skills** (Muratcan Koylan):
  - `advanced-evaluation` → v2.1 Pillar 1 spec
  - `context-degradation` → v2.4 prompt-safety design
  - `memory-systems` → v3.0 framework selection
  - `multi-agent-patterns` → v2.3 architecture
  - `tool-design` → v2.7 API design + v2.1.5 research wrapper
  - `latent-briefing` → v2.5.5 multi-phase optimization
  - `context-compression` → v2.2 large-file uploads
  - Other 7 (filesystem-context, hosted-agents, evaluation, project-development, context-fundamentals, context-optimization, bdi-mental-states) — general engineering reference

- **claude-squad** — pattern reference for v2.1 run-tree UI + v2.3 workstreams + per-workstream model selection
- **container-use** — foundation pattern for deferred Engineer Hatch coding (v3.5+)
- **claude-task-master** — methodology reference for v2.3 Pillars 1-4
- **GSD itself** — methodology template inspiration for v2.3 Pillar 5

---

## Validation gate

**Status:** USER-LETTER-DETAILED.pdf sent to Pro users (8-12). Responses being collected.

**Decision rule:**
- 5+ users name same gap → that becomes v2.1, override roadmap
- User signal points to gaps not in roadmap → add them, deprioritize unbacked
- User signal validates current v2.1 → proceed as written
- Users say all features are beneficial (current state) → proceed with sequencing as written, re-validate per milestone

---

## Rollback strategy

- **Per-milestone:** `/gsd-undo` (built into GSD)
- **Pre-milestone snapshot tags:** `git tag pre-v2.1-snapshot` before each milestone starts
- **Roadmap pivot:** archive this file → `.planning/archive/ROADMAP-V3-aborted-YYYY-MM-DD.md`, write V4 with reasoning
- **Skill/MCP rollback:** `~/rollback-recent-installs.sh`

---

## Cross-walk: every input source accounted for

### 18 repos evaluated → all integrated
autoresearch (v2.1), context7 (deferred), gstack (v2.1+v2.4 Security Officer), anthropics PDF (v2.2), claude-task-master (v2.3), tavily-mcp (v2.1.5), doc-coauthoring (v2.1), pptx (v2.5), xlsx (v2.5), web-artifacts-builder (v2.5), marketingskills (v2.4), brand-guidelines (v2.5 P0), claude-deep-research (v2.5.5), context-engineering (architecture), promptfoo (v2.1+v2.6), langflow (v2.7), claude-squad (v2.1+v2.3 patterns), container-use (deferred seed), ghost-os (v4.0).

### 15 gap audit items → 13 included, 2 deferred to backlog
- Items 1, 2, 7, 9, 12 → folded into v2.1
- Items 10, 11 → Phase 0 hotfixes
- Item 3 → folded into v3.0
- Item 13 → folded into v2.3
- Items 14, 15 → folded into v2.7
- Items 4, 5 → backlog (disagreement orchestration, project DoD)
- Items already shipped/exist (Maya bug, DB-CRASH-01, time/momentum awareness) → no action

### 3 side candidates → all folded
- Maya 3-stage interrogation → v2.1
- AI Slop detection → v2.1
- 31st Hatch Security Officer → v2.4

### Original ROADMAP-V2 → all 11 milestones preserved
v2.1 through v4.0 carried forward, expanded with gap items where relevant.

---

## What's NOT in this roadmap (for transparency)

- Anything outside the 18 repos + 15 gaps + 3 side candidates
- New ideas you haven't surfaced yet
- Features users will request after seeing the survey responses
- Reactions to competitive moves we haven't seen
- Anything that depends on v3.0 + v4.0 outcomes (those become real plans only when those milestones are about to start)

This is a 12-14 month plan, not a 3-year plan. After v3.0 ships, write ROADMAP-V4 based on what you've learned.
