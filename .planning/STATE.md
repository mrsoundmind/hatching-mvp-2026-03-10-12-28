---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: Autonomy Visibility & Right Sidebar Revamp
status: completed
stopped_at: Phase 15 context gathered
last_updated: "2026-03-29T09:29:06.305Z"
last_activity: 2026-03-26 — Completed 14-01 (brain upload backend + autonomy settings schema)
progress:
  total_phases: 11
  completed_phases: 4
  total_plans: 9
  completed_plans: 9
  percent: 70
---

# State: Hatchin

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-25)

**Core value:** No one should ever feel alone with their idea, have to start from scratch, or need to know how to prompt AI — just have a conversation and your team takes it from there.
**Current focus:** v2.0 — Hatches That Deliver (roadmap created, ready for phase planning)

---

## Current Position

Phase: 14 — Brain Redesign + Autonomy Settings
Plan: 14-02 (next)
Status: Plan 14-01 complete (brain upload backend + autonomy schema). 1/2 plans done in Phase 14.
Last activity: 2026-03-26 — Completed 14-01 (brain upload backend + autonomy settings schema)

Progress: [███████░░░] 70%

---

## v2.0 Phase Summary

| Phase | Goal | Requirements | Research Needed |
|-------|------|--------------|-----------------|
| 16 - Database Foundation + Artifact Panel Shell | Split-panel artifact viewer with attribution and version history | ARTF-01–04, COORD-01 | No (standard Drizzle migration + CRUD pattern) |
| 17 - Deliverable Generation + Schema Enforcement | Schema-enforced document generation streaming into artifact panel | DLVR-01–05 | Yes — canonical section schemas per deliverable type |
| 18 - Cross-Agent Deliverable Chains | Linked documents where downstream agents reference upstream content | CHAIN-01–04, COORD-02 | Yes — token budget management for multi-hop context injection |
| 19 - Organic Detection + Iteration UX | Conservative intent detection + section-level document iteration | DTCT-01–02 | Yes — intent classification boundary; diff rendering approach |
| 20 - Project Packages + Background Production | Coordinated multi-agent package execution with progress tracking | PKG-01–03 | No (extends existing pg-boss queue with new job type) |
| 21 - Zero-Friction Onboarding + PDF Export | First deliverable within 3 min + professional branded PDF export | ONBD-01–02, XPRT-01–02 | Yes — project type classifier design; PDF template testing |

**Phase ordering rationale:**
- Phase 16 gates all: deliverables table must exist before any generation
- Phase 17 gates Phases 18 and 19: schemas must exist before chains inject context, and before section-level iteration is possible
- Phase 18 gates Phase 20: packages are coordinated chains; chain infrastructure must exist first
- Phases 19 and 20 can be built in parallel after Phase 18 completes
- Phase 21 depends on Phase 19 (onboarding uses organic detection) and Phase 17 (PDF uses deliverable schemas)

---

## Performance Metrics

**Velocity:**
- Total plans completed: 0 (v2.0)
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

*Updated after each plan completion*

---
| Phase 11 P01 | 3min | 2 tasks | 6 files |
| Phase 11 P03 | 4min | 3 tasks | 8 files |
| Phase 12 P02 | 257 | 2 tasks | 5 files |
| Phase 13 P01 | 161 | 2 tasks | 5 files |
| Phase 13 P02 | 173 | 2 tasks | 6 files |
| Phase 14 P01 | 227s | 2 tasks | 6 files |
| Phase 14 P02 | 359 | 2 tasks | 6 files |
| Phase 14-brain-redesign-autonomy-settings P02 | 359 | 3 tasks | 6 files |

## Accumulated Context

### Decisions

Key decisions for v2.0:
- **Use-case-driven development**: Organize around user goals (Product Launch, Marketing Content, Planning & Research), not features
- **Deliverable chains as core differentiator**: Single deliverables = ChatGPT. Coordinated team output across agents = unique value
- **Artifact panel (Claude desktop pattern)**: Non-blocking absolute-position overlay on RightSidebar — conversation context never lost when opening a document
- **Text-first deliverables**: Focus on what LLMs produce well (PRDs, specs, plans, copy). Visual outputs via MCP integrations later
- **Both trigger paths**: Explicit request (reliable, ship first in Phase 17) + organic detection (magic, Phase 19)
- **Project packages as unit of value**: "Launch Package" not 12 loose docs — coordinates PM → Engineer → Designer → Marketing
- **Zero-friction onboarding**: First deliverable generating within 3 minutes of signup (Phase 21)
- **Professional PDF export**: Branded with TOC and attribution via @react-pdf/renderer (server-side only, never Vite-bundled)
- **Schema enforcement**: temperature: 0.3 + JSON template injection prevents LLM structural variance across regenerations
- **Section-level iteration**: Revision regenerates only the target section and splices it back in — not whole-document regeneration
- **Two-stage organic detection**: Classify intent first, then propose with confirmation card — never auto-create
- **Stale reference tracking**: referencedDocuments snapshot at generation time; surface warnings; never auto-update silently
- **Agent-missing validation at package creation**: Not execution time — surface recovery action immediately
- **deliverable_versions as separate table**: Keeps base row small; supports pagination; enables future full-text search on content
- **sourceConversationId on every deliverable**: Chat context preserved; "revise this" can target the originating conversation
- **COORD-02 async notifications use existing Maya briefing pattern**: No new notification infrastructure needed
- [Phase 11]: CSS-hide pattern (display:none) for tab panels to preserve scroll/draft state
- [Phase 11]: Separate layoutId namespaces: sidebar-tab vs brain-tab-indicator to avoid Framer Motion conflicts
- [Phase 11]: Called useAgentWorkingState in ProjectTree directly since LeftSidebar delegates all avatar rendering to ProjectTree
- [Phase 12]: HandoffCard renders in the message loop when metadata.isHandoffAnnouncement===true, replacing MessageBubble for that message
- [Phase 12]: DeliberationCard auto-resolves after 30s timeout — clears even if no synthesis_completed arrives
- [Phase 12]: Extracted pure grouping logic to handoffChainUtils.ts (no JSX) so vitest node env can import without JSX parse errors — HandoffChainTimeline re-exports for consumers
- [Phase 13]: Frontend-only expiry derivation using updatedAt + 30-min constant — avoids DB migration for ephemeral approval state
- [Phase 13]: blocked status intentionally maps to Review display label in PIPELINE_STAGES — DB has no review status value
- [Phase 13]: Identical queryKey in ApprovalsTab + RightSidebar ensures TanStack deduplication — one fetch serves both consumers
- [Phase 13]: SidebarTabBar extended from 2 to 3 tabs with ShieldCheck + amber dot badge for approvals
- [Phase 14]: Old brain tab content (agent/team/project views) replaced entirely with BrainDocsTab — all contexts now show upload, docs, autonomy settings, work outputs
- [Phase 14]: Optimistic document deletion with rollback — card removed immediately, restored on server error
- [Phase 14]: Old brain tab content removed entirely — BrainDocsTab now renders for all project/team/agent contexts

### Research Flags (for /gsd:research-phase during planning)

- **Phase 17**: Canonical section definitions and word-count targets per deliverable type need to be defined before any iteration logic is built — this is content design with significant downstream implications
- **Phase 18**: Token budget management for multi-hop context injection (PRD + Tech Spec must both fit in Designer's context window) — intelligent truncation strategy needs explicit token-count validation
- **Phase 19**: Intent classification boundary between "deliverable-adjacent planning" and genuine production intent; diff highlighting library choice and render performance for large documents
- **Phase 21**: Project type classifier design (categories + classification from onboarding answers); PDF template development and testing against real LLM-generated content

### Stack Additions for v2.0

Four new npm packages required (all others already installed):
- `@react-pdf/renderer@4.3.0` — server-side branded PDF export (must be server-side only, never Vite-bundled)
- `rehype-sanitize@6.0.0` — AST-based XSS protection for LLM-produced markdown in artifact panel
- `rehype-slug@6.0.0` — section anchor links for TOC navigation
- `rehype-autolink-headings@7.1.0` — anchor link generation for TOC

### v1.3 Decisions

- **DB-level project filtering** in readAutonomyEventsByProject for efficiency (SQL WHERE), with in-memory fallback
- **Cast eventType to string** for stats aggregation to handle event types not yet in AutonomyEventType union
- **workingAgents passthrough** via useAutonomyFeed composition per CONTEXT.md locked interface
- [Phase 14]: pdf-parse v2.x uses named PDFParse class (not default function) — import { PDFParse } and instantiate with new PDFParse({ data: Uint8Array })
- [Phase 14]: multer.memoryStorage() for uploads — avoids temp file cleanup, fits 10MB constraint
- [Phase 14]: fileFilter in multer rejects non-allowed types with INVALID_TYPE error caught in middleware wrapper
- [Phase 14]: autonomyLevel enum (observe/propose/confirm/autonomous) added to both schema.ts and Zod schema; inactivityTriggerMinutes validated as int 30–480

### v1.3 Context (preserved)

- v1.3 Phase 11 Plan 01 complete — data foundation hooks and backend endpoints shipped
- v1.3 provides the architectural foundation (tabbed sidebar, activity feed, CSS tab hiding pattern) that v2.0 fills with deliverable content
- v2.0 ArtifactPanel renders as absolute-positioned overlay on the v1.3 RightSidebar shell — not a new route or tab

### Pending Todos

- v1.3 must complete (Phases 11-15) before Phase 16 can begin
- Run `/gsd:research-phase 17` before planning Phase 17 (deliverable schemas are content design decisions)
- Run `/gsd:research-phase 18` before planning Phase 18 (token budget management for multi-hop chains)

### Blockers/Concerns

- **v1.3 must ship first**: v2.0 ArtifactPanel depends on the v1.3 RightSidebar shell architecture being in place
- **Deliverable schema design (Phase 17 research flag)**: Canonical section names, ordering, word count targets per type must be locked before the first deliverable generates — cannot be retrofitted

---

## Session Continuity

Last session: 2026-03-29T09:29:06.301Z
Stopped at: Phase 15 context gathered
Resume file: .planning/phases/15-polish/15-CONTEXT.md
Next action: Execute 14-02-PLAN.md (Brain Redesign UI + Autonomy Settings Frontend)
