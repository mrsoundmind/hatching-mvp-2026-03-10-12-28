# Roadmap: Hatchin

## Milestones

- ✅ **v1.0 Text-Perfect, Human-First** — Phases 1-5 (shipped 2026-03-19) — [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 Autonomous Execution Loop** — Phases 6-9 (shipped 2026-03-23) — [archive](milestones/v1.1-ROADMAP.md)
- ✅ **v1.2 Billing + LLM Intelligence** — Phase 10 (shipped 2026-03-23) — [archive](milestones/v1.2-ROADMAP.md)
- 🚧 **v1.3 Autonomy Visibility & Right Sidebar Revamp** — Phases 11-15 (in progress)
- 📋 **v2.0 Hatches That Deliver** — Phases 16-21 (planned)

---

<details>
<summary>✅ v1.0 Text-Perfect, Human-First (Phases 1-5) — SHIPPED 2026-03-19</summary>

See archived roadmap: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

**Phases completed:**
- Phase 1: Hatch Conversation Quality
- Phase 2: User Journey Fixes
- Phase 3: Hatch Presence and Avatar System
- Phase 4: Data Reliability and Resilience
- Phase 5: Route Architecture Cleanup

</details>

<details>
<summary>✅ v1.1 Autonomous Execution Loop (Phases 6-9) — SHIPPED 2026-03-23</summary>

See archived roadmap: [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)

**Phases completed:**
- Phase 6: Background Execution Foundation (4 plans)
- Phase 7: Agent Handoffs and Approval UI (4 plans)
- Phase 8: Chat Summary and Tab Notifications (2 plans)
- Phase 9: Progressive Trust and Inactivity Trigger (2 plans)

**Key deliverables:** pg-boss background execution, agent handoff chain with cycle detection, three-tier safety gates, progressive trust scoring, Maya return briefing, tab notifications, inactivity auto-trigger.

</details>

<details>
<summary>✅ v1.2 Billing + LLM Intelligence (Phase 10) — SHIPPED 2026-03-23</summary>

See archived roadmap: [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md)

**Key deliverables:** Stripe Free/Pro billing ($19/mo), smart LLM routing (Gemini Flash/Pro + Groq free tier), token tracking, usage capping, conversation compaction, reasoning cache, background task batching.

</details>

---

## 🚧 v1.3 Autonomy Visibility & Right Sidebar Revamp (In Progress)

**Milestone Goal:** Make the autonomy backend visible and controllable from the frontend — tabbed sidebar shell, real-time activity feed, handoff visualization, agent working-state avatar animation, pending approvals hub, task pipeline, project brain file upload, and autonomy settings dial.

### Phases

- [ ] **Phase 11: Sidebar Shell + Activity Feed** - Tab structure, live autonomy event feed, stats card, agent working avatar state, empty states
- [ ] **Phase 12: Handoff Visualization** - Chat handoff cards, sidebar handoff timeline, user-initiated handoff, deliberation indicator
- [ ] **Phase 13: Approvals Hub + Task Pipeline** - Dedicated approvals tab, task pipeline view, expiry handling
- [ ] **Phase 14: Brain Redesign + Autonomy Settings** - File upload to project brain, knowledge base UI, autonomy dial, work output viewer
- [ ] **Phase 15: Polish** - Premium component designs via Stitch/Magic MCPs, visual consistency pass

---

## 📋 v2.0 Hatches That Deliver (Planned)

**Milestone Goal:** Transform Hatchin from "AI chatroom" to "AI team that ships coordinated work" — split-panel artifact viewer, schema-enforced deliverable generation, cross-agent document chains, project packages, organic detection, professional PDF export, and zero-friction onboarding.

### Phases

- [ ] **Phase 16: Database Foundation + Artifact Panel Shell** - Three new DB tables, CRUD API, artifact panel shell, deliverable chat card, coordination attribution
- [ ] **Phase 17: Deliverable Generation + Schema Enforcement** - Type registry, deliverable generator, streaming into panel, version history, deliverable browser
- [ ] **Phase 18: Cross-Agent Deliverable Chains** - Chain orchestrator, upstream context injection, stale reference warnings, visual chain diagram, async notifications
- [ ] **Phase 19: Organic Detection + Iteration UX** - Two-stage intent detection, confirmation card, section-level iteration, diff highlighting
- [ ] **Phase 20: Project Packages + Background Production** - Package templates, package UI, agent-missing recovery, background package execution
- [ ] **Phase 21: Zero-Friction Onboarding + PDF Export** - Project type classifier, first-deliverable onboarding, branded PDF export, package PDF export

---

## Phase Details

### Phase 11: Sidebar Shell + Activity Feed
**Goal**: Users can see real-time autonomy activity in a tabbed right sidebar — the gating architectural foundation for the entire milestone
**Depends on**: Nothing (first phase of v1.3 milestone)
**Requirements**: SIDE-01, SIDE-02, SIDE-03, SIDE-04, FEED-01, FEED-02, FEED-03, FEED-04, FEED-05, AGNT-01
**Success Criteria** (what must be TRUE):
  1. User sees a right sidebar with three tabs (Activity, Brain & Docs, Approvals) and switching between them works without losing scroll position or draft state
  2. User sees a live activity feed that updates in real time as autonomous work happens, showing agent avatar, event description, and timestamp for each event
  3. User sees a stats card at the top of the Activity tab showing tasks completed, handoffs, and cost spent today
  4. User can filter the feed by event type, agent, or time range using filter chips without a page reload
  5. Agent avatars in the left sidebar and project tree show a pulsing ring when that agent is actively executing a background task
**Plans**: 3 plans
Plans:
- [ ] 11-01-PLAN.md — Data foundation: typed event registry, sidebar hooks, backend stats/events endpoints
- [ ] 11-02-PLAN.md — Tab shell: 3-tab RightSidebar restructure with CSS-hide, badges, empty states
- [ ] 11-03-PLAN.md — Activity feed UI: stats card, filter chips, feed items, agent working avatar

### Phase 12: Handoff Visualization
**Goal**: Users can see handoff chains between agents — both in the chat as styled cards and in the sidebar as a timeline
**Depends on**: Phase 11
**Requirements**: HAND-01, HAND-02, HAND-03, HAND-04
**Success Criteria** (what must be TRUE):
  1. When a handoff occurs, the chat panel shows a styled card with the from-agent avatar, an arrow, the to-agent avatar, and the task being handed off
  2. The Activity tab sidebar shows a vertical handoff chain timeline with animated connectors linking the sequence of agents involved in a multi-agent run
  3. User can initiate a manual handoff by clicking "Hand off to..." in the chat input and selecting a target agent from a dropdown
  4. When multiple agents are coordinating, user sees a collapsible deliberation indicator card in chat that can be expanded to show coordination details
**Plans**: TBD

### Phase 13: Approvals Hub + Task Pipeline
**Goal**: Users have a dedicated approvals surface and can see task progress across pipeline stages without digging through chat
**Depends on**: Phase 11
**Requirements**: APPR-01, APPR-02, APPR-03, APPR-04
**Success Criteria** (what must be TRUE):
  1. User can view all pending approval requests in the Approvals tab and approve or reject any item with a single click without leaving the sidebar
  2. User can see tasks organized by pipeline stage (Queued, Assigned, In Progress, Review, Done) in a view readable at the sidebar's narrow width
  3. When an approval expires, user sees a clear "expired" state on that item instead of a broken approve button or silent failure
  4. When no approvals are pending, the Approvals tab shows an engaging empty state explaining what the tab is for and how approvals are created
**Plans**: TBD

### Phase 14: Brain Redesign + Autonomy Settings
**Goal**: Users can build a real knowledge base by uploading documents to the project brain, and can configure how autonomously their Hatches operate
**Depends on**: Phase 11
**Requirements**: BRAIN-01, BRAIN-02, BRAIN-03, BRAIN-04
**Success Criteria** (what must be TRUE):
  1. User can drag-and-drop a PDF, DOCX, TXT, or MD file onto the Brain & Docs tab to upload it (up to 10MB), and the file's content becomes searchable context for Hatches
  2. Uploaded documents appear in a card-based list showing filename, type badge, upload date, and a delete button
  3. User can configure autonomy behavior via a settings panel: toggle autonomous execution on/off, set the inactivity trigger, and choose an autonomy level from a four-position dial (Observe / Propose / Confirm / Autonomous)
  4. User can browse completed work outputs from background agents in an expandable card view without scrolling through full chat history
**Plans**: TBD

### Phase 15: Polish
**Goal**: All new sidebar components feel premium and visually consistent with Hatchin's established design system
**Depends on**: Phases 11-14
**Requirements**: PLSH-01
**Success Criteria** (what must be TRUE):
  1. All new sidebar tab components use designs generated via Stitch/Magic MCPs and are visually indistinguishable from the quality level of existing Hatchin components
  2. New components are consistent in spacing, color usage, typography, and animation style with the established Tailwind design tokens and Framer Motion patterns across the app
**Plans**: TBD

---

### Phase 16: Database Foundation + Artifact Panel Shell
**Goal**: Users can open a split-panel artifact viewer beside chat that displays deliverables with attribution — the data and UI foundation that every v2.0 feature requires
**Depends on**: Phase 15 (v1.3 must ship first; v1.3 sidebar provides the shell this overlays)
**Requirements**: ARTF-01, ARTF-02, ARTF-03, ARTF-04, COORD-01
**Success Criteria** (what must be TRUE):
  1. User can open any deliverable and see a split-panel view — chat remains fully visible and usable on the left, the document opens in a panel on the right without covering the conversation
  2. Each open deliverable shows which Hatch produced it (avatar, name, role), handoff notes where relevant, and a status badge (Draft / In Review / Complete)
  3. User can navigate back and forward through up to 20 saved versions of a deliverable and restore any previous version with one click
  4. User can copy the full deliverable content to clipboard or download it as a .md file from within the panel using a single button click
**Plans**: TBD

### Phase 17: Deliverable Generation + Schema Enforcement
**Goal**: Users can request a structured deliverable from any Hatch, see it stream into the artifact panel in real time, and browse all project deliverables from a list view
**Depends on**: Phase 16
**Requirements**: DLVR-01, DLVR-02, DLVR-03, DLVR-04, DLVR-05
**Success Criteria** (what must be TRUE):
  1. User can say "write me a PRD" (or tech spec, design brief, GTM plan, blog post, project plan) and the appropriate Hatch generates a document with the correct canonical sections — the document renders in the artifact panel as it streams, not after completion
  2. Each role reliably produces documents with consistent section structure across regenerations — the PM always produces Executive Summary, Problem, Goals, User Stories, Success Metrics, Timeline; the Engineer always produces Overview, Architecture, Implementation Plan, Dependencies, Risks, Testing Strategy
  3. User can browse all deliverables for a project in a list or grid view and filter them by deliverable type, the Hatch that produced them, or current status
  4. User can say "make the timeline more aggressive" or "add a risks section" while a deliverable is open and the Hatch updates only the relevant section in-place — not the whole document
**Plans**: TBD

### Phase 18: Cross-Agent Deliverable Chains
**Goal**: When one Hatch finishes a deliverable, downstream Hatches can produce linked documents that genuinely reference the upstream content — not generic placeholder text
**Depends on**: Phase 17
**Requirements**: CHAIN-01, CHAIN-02, CHAIN-03, CHAIN-04, COORD-02
**Success Criteria** (what must be TRUE):
  1. After a PM produces a PRD, the Engineer Hatch can produce a tech spec that explicitly references sections, decisions, and requirements from that PRD — the reference is substantive, not generic
  2. When a user iterates an upstream deliverable (PRD revised from v1 to v2), all downstream deliverables (tech spec, design brief) show a visible "may be outdated" warning with a one-click update action
  3. User sees a visual chain diagram in the artifact panel showing the relationship between linked deliverables (PRD → Tech Spec → Design Brief → GTM Plan) with the current status shown at each step
  4. When background deliverable production completes overnight, the user receives a Maya return briefing in chat ("Your team produced 4 documents. Review when ready.") rather than having to discover the work by browsing
**Plans**: TBD

### Phase 19: Organic Detection + Iteration UX
**Goal**: Hatches recognize when a conversation has enough context to produce a deliverable and propose it — never auto-creating — and iteration through chat updates documents with surgical precision
**Depends on**: Phase 17
**Requirements**: DTCT-01, DTCT-02
**Success Criteria** (what must be TRUE):
  1. When a conversation reaches sufficient context for a deliverable (a PRD-worthy product discussion, a GTM-worthy launch conversation), the relevant Hatch offers a confirmation card ("Ready to write this up as a PRD?") — the user must click to confirm before generation starts
  2. Organic detection never fires on a casual or exploratory conversation — a brainstorm or question-and-answer exchange does not trigger a deliverable proposal
**Plans**: TBD

### Phase 20: Project Packages + Background Production
**Goal**: Users can trigger a coordinated multi-agent deliverable package and track its progress as Hatches produce linked documents in the background
**Depends on**: Phase 18
**Requirements**: PKG-01, PKG-02, PKG-03
**Success Criteria** (what must be TRUE):
  1. User can trigger a named package ("Launch Package", "Content Sprint", "Research Package") and the system coordinates the appropriate chain of Hatches to produce all required deliverables in sequence
  2. While a package is running, user sees a progress indicator showing which deliverables are complete, which Hatch is currently working, and how many remain — not just a spinner
  3. If a package requires a Hatch type not present in the project, the user sees a clear "Agent missing" status for that step and a direct link to add the required Hatch — the package does not silently stall on that step
**Plans**: TBD

### Phase 21: Zero-Friction Onboarding + PDF Export
**Goal**: New users receive their first deliverable offer within 3 minutes of signup, and any deliverable or package can be exported as a professionally branded PDF
**Depends on**: Phases 19, 17
**Requirements**: ONBD-01, ONBD-02, XPRT-01, XPRT-02
**Success Criteria** (what must be TRUE):
  1. A new user completing onboarding receives a contextually relevant first-deliverable offer within 3 minutes — a product startup gets a PRD offer, a marketer gets a content brief offer, a solo developer gets a project plan offer
  2. The first deliverable is explicitly framed as a starting point ("Here's a first draft — tell me what to change") so new users immediately understand they can iterate through conversation
  3. User can export any single deliverable as a PDF with a cover page, table of contents, agent attribution section, page numbers, and Hatchin branding — the PDF is professional enough to share with external stakeholders
  4. User can export an entire package (Launch Package, Content Sprint) as a single combined PDF containing all linked deliverables in logical reading order
**Plans**: TBD

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Hatch Conversation Quality | v1.0 | — | Complete | 2026-03-19 |
| 2. User Journey Fixes | v1.0 | — | Complete | 2026-03-19 |
| 3. Hatch Presence and Avatar System | v1.0 | — | Complete | 2026-03-19 |
| 4. Data Reliability and Resilience | v1.0 | — | Complete | 2026-03-19 |
| 5. Route Architecture Cleanup | v1.0 | — | Complete | 2026-03-19 |
| 6. Background Execution Foundation | v1.1 | — | Complete | 2026-03-23 |
| 7. Agent Handoffs and Approval UI | v1.1 | — | Complete | 2026-03-23 |
| 8. Chat Summary and Tab Notifications | v1.1 | — | Complete | 2026-03-23 |
| 9. Progressive Trust and Inactivity Trigger | v1.1 | — | Complete | 2026-03-23 |
| 10. Billing + LLM Intelligence | v1.2 | — | Complete | 2026-03-23 |
| 11. Sidebar Shell + Activity Feed | v1.3 | 0/3 | Planned | - |
| 12. Handoff Visualization | v1.3 | 0/? | Not started | - |
| 13. Approvals Hub + Task Pipeline | v1.3 | 0/? | Not started | - |
| 14. Brain Redesign + Autonomy Settings | v1.3 | 0/? | Not started | - |
| 15. Polish | v1.3 | 0/? | Not started | - |
| 16. Database Foundation + Artifact Panel Shell | v2.0 | 0/? | Not started | - |
| 17. Deliverable Generation + Schema Enforcement | v2.0 | 0/? | Not started | - |
| 18. Cross-Agent Deliverable Chains | v2.0 | 0/? | Not started | - |
| 19. Organic Detection + Iteration UX | v2.0 | 0/? | Not started | - |
| 20. Project Packages + Background Production | v2.0 | 0/? | Not started | - |
| 21. Zero-Friction Onboarding + PDF Export | v2.0 | 0/? | Not started | - |

---
*Roadmap created: 2026-03-17*
*v1.0 shipped: 2026-03-19*
*v1.1 shipped: 2026-03-23*
*v1.2 shipped: 2026-03-23*
*v1.3 roadmap added: 2026-03-24*
*v2.0 roadmap added: 2026-03-25*
