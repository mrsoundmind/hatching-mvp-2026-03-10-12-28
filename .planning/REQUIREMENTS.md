# Requirements: Hatchin

**Defined:** 2026-03-24 (v1.3), 2026-03-25 (v2.0)
**Core Value:** No one should ever feel alone with their idea, have to start from scratch, or need to know how to prompt AI — just have a conversation and your team takes it from there.

---

## v2.0 Requirements — Hatches That Deliver

Requirements for transforming Hatchin from "AI chatroom" to "AI team that ships coordinated work."

### Artifact Panel

- [ ] **ARTF-01**: User sees a split-panel artifact viewer that slides in beside chat (non-blocking — chat remains visible and usable) when a deliverable is opened
- [ ] **ARTF-02**: User sees deliverables stored with version history (back/forward navigation, up to 20 versions retained) and can restore any previous version
- [ ] **ARTF-03**: Each deliverable shows agent attribution (avatar, name, role) and status badge (Draft / In Review / Complete)
- [ ] **ARTF-04**: User can copy deliverable content to clipboard and download as .md file with one click from the artifact panel

### Deliverable Generation

- [ ] **DLVR-01**: User can explicitly request a deliverable ("write me a PRD", "create a tech spec") and the appropriate Hatch generates a structured document with schema-enforced sections
- [ ] **DLVR-02**: Deliverable content streams into the artifact panel as it generates (30-60 seconds), with visible progress
- [ ] **DLVR-03**: Each role maps to specific deliverable types via a type registry (PM→PRD/UserStories, Engineer→TechSpec, Designer→DesignBrief, Marketing→GTMPlan, Copywriter→BlogPost, etc.) with canonical section schemas per type
- [ ] **DLVR-04**: User can browse all project deliverables in a list/grid view, filterable by type, agent, and status
- [ ] **DLVR-05**: User can iterate on an open deliverable by talking in chat ("make the timeline more aggressive", "add a risks section") and the Hatch updates the document in-place with section-level targeting

### Cross-Agent Chains

- [ ] **CHAIN-01**: When a deliverable is produced, downstream agents can be triggered to produce linked deliverables that reference the upstream document (PM→PRD→Engineer→TechSpec that references the PRD)
- [ ] **CHAIN-02**: Downstream agents receive full upstream deliverable content (not chat summary) injected into their generation prompt with intelligent truncation for token budget
- [ ] **CHAIN-03**: When an upstream deliverable is revised, downstream deliverables show a "may be outdated" warning with a one-click "Update" action to regenerate
- [ ] **CHAIN-04**: User sees a visual chain diagram showing the relationship between linked deliverables (PRD→TechSpec→DesignBrief→GTM) with status per step

### Project Packages

- [ ] **PKG-01**: User can trigger a project package ("Launch Package", "Content Sprint", "Research Package") that coordinates a chain of deliverables across multiple agents
- [ ] **PKG-02**: User sees package progress ("Launch Package 3/5 complete — Designer is working on the Design Brief") with per-deliverable status
- [ ] **PKG-03**: If a required agent is missing from the project, package creation surfaces an "agent missing" status with a recovery action (link to add agent) instead of silently failing

### Organic Detection

- [ ] **DTCT-01**: Hatch recognizes deliverable-worthy moments from conversation and proposes creating a deliverable via a confirmation card ("Ready to write this up as a PRD?") — never auto-creates
- [ ] **DTCT-02**: Organic detection uses conservative thresholds with two-stage classification (intent detection → proposal) to minimize false positives

### Export

- [ ] **XPRT-01**: User can export any deliverable as a branded PDF with cover page, table of contents, agent attribution, page numbers, and Hatchin branding
- [ ] **XPRT-02**: User can export an entire package as a combined PDF with all linked deliverables

### Onboarding

- [ ] **ONBD-01**: New user receives their first deliverable offer within 3 minutes of signup — project type classifier (product launch / content sprint / planning) determines which deliverable to generate first
- [ ] **ONBD-02**: First deliverable is framed as a starting point ("Here's a first draft — tell me what to adjust") to encourage iteration and demonstrate the value loop

### Coordination Visibility

- [ ] **COORD-01**: Deliverables show visible team coordination — attribution ("Written by Alex (PM)"), handoff notes ("Based on Alex's PRD — I diverged on timeline because..."), and cross-agent references
- [ ] **COORD-02**: Async background deliverable production notifies user on completion ("Your team produced 4 documents overnight. Review when ready.") using existing Maya return briefing pattern

---

## v1.3 Requirements — Autonomy Visibility & Right Sidebar Revamp

Requirements for the autonomy visibility milestone. Each maps to roadmap phases.

### Sidebar Structure

- [ ] **SIDE-01**: User sees a tabbed right sidebar with Activity, Brain & Docs, and Approvals tabs
- [ ] **SIDE-02**: Tab selection persists across navigation (inactive tabs retain scroll position and draft state via CSS-hide)
- [ ] **SIDE-03**: Activity tab shows unread event count badge; Approvals tab shows pending approval count badge
- [ ] **SIDE-04**: Sidebar tabs work on mobile via Sheet drawer with swipe-between-tabs gesture

### Activity Feed

- [ ] **FEED-01**: User sees a real-time feed of autonomy events (task started, completed, handoff, peer review) with agent avatars and timestamps
- [ ] **FEED-02**: User sees a stats summary card at top of Activity tab showing tasks completed, handoffs, and cost spent
- [ ] **FEED-03**: User can filter feed by event type (handoffs, tasks, reviews), by agent, or by time range via filter chips
- [ ] **FEED-04**: Rapid events are aggregated ("5 tasks assigned" instead of 5 separate items) to prevent flooding
- [ ] **FEED-05**: User sees a compelling empty state explaining what the Activity feed shows before any autonomous work happens

### Handoff Visualization

- [ ] **HAND-01**: Handoff messages in chat render as visual cards with from-agent avatar, arrow, to-agent avatar, and task title
- [ ] **HAND-02**: Activity tab shows a vertical handoff chain timeline with animated connectors between agents
- [ ] **HAND-03**: User can manually hand off a task to another agent via "Hand off to..." dropdown button in chat input
- [ ] **HAND-04**: User sees a deliberation indicator card when multiple agents are coordinating, expandable to show details

### Agent Status

- [ ] **AGNT-01**: Agent avatars show a pulsing/rotating "working" animation when executing tasks in background

### Approvals & Tasks

- [ ] **APPR-01**: User can view all pending approvals in a dedicated Approvals tab with one-click approve/reject buttons
- [ ] **APPR-02**: User sees a task pipeline view showing tasks in stages: Queued → Assigned → In Progress → Review → Done
- [ ] **APPR-03**: Stale approvals expire gracefully with clear "expired" messaging instead of silently failing
- [ ] **APPR-04**: Approvals tab shows a compelling empty state when no pending approvals exist

### Brain & Documents

- [ ] **BRAIN-01**: User can upload PDF, DOCX, TXT, and MD files to the project brain via drag-and-drop (10MB max)
- [ ] **BRAIN-02**: User sees uploaded documents in a clean card-based knowledge base with title, type badge, date, preview, and delete
- [ ] **BRAIN-03**: User can configure autonomy via settings panel: enabled toggle, inactivity trigger, 4-level autonomy dial (Observe/Propose/Confirm/Autonomous)
- [ ] **BRAIN-04**: User can browse deliverables produced by background agents with expandable preview cards

### Polish

- [ ] **PLSH-01**: All new sidebar components use premium designs generated via Stitch/Magic MCPs matching Hatchin's visual style

---

## Future Requirements

Deferred to v2.1+. Tracked but not in current roadmap.

### Trust & Analytics
- **TRST-01**: User sees each agent's trust level (new → established → trusted) with visual indicator
- **TRST-02**: User sees autonomy analytics dashboard (cost per agent, success rate, approval rate over time)

### Advanced Interactions
- **ADVN-01**: User can configure notification preferences for autonomy events
- **ADVN-02**: User can search through historical autonomy events
- **ADVN-03**: Keyboard shortcuts for quick approve/reject from Approvals hub

### Advanced Deliverables (v2.1+)
- **ADLV-01**: Rich text WYSIWYG editor for deliverables (Tiptap/Slate.js)
- **ADLV-02**: Real-time multi-user collaborative editing on deliverables
- **ADLV-03**: Public sharing links for deliverables
- **ADLV-04**: Full git-style revision history with diff view
- **ADLV-05**: Custom package templates (B2B feature)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Visual deliverables (wireframes, moodboards) | LLMs can't produce these well — future via MCP integrations |
| Code generation/execution | Future via sandbox integration |
| Full LangGraph graph visualization | Developer tool, not consumer UI |
| Per-message token counters | Breaks colleague metaphor |
| Raw JSON event viewer | Developer debug tool |
| S3/cloud file storage | Overkill for MVP; DB storage is sufficient at current scale |
| WYSIWYG document editing | Contradicts "team produces work for you" brand; v2.1+ |
| Auto-creating deliverables without confirmation | Trust-destroying — organic detection must always propose first |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ARTF-01 | Phase 16 | Pending |
| ARTF-02 | Phase 16 | Pending |
| ARTF-03 | Phase 16 | Pending |
| ARTF-04 | Phase 16 | Pending |
| DLVR-01 | Phase 17 | Pending |
| DLVR-02 | Phase 17 | Pending |
| DLVR-03 | Phase 17 | Pending |
| DLVR-04 | Phase 17 | Pending |
| DLVR-05 | Phase 17 | Pending |
| CHAIN-01 | Phase 18 | Pending |
| CHAIN-02 | Phase 18 | Pending |
| CHAIN-03 | Phase 18 | Pending |
| CHAIN-04 | Phase 18 | Pending |
| PKG-01 | Phase 20 | Pending |
| PKG-02 | Phase 20 | Pending |
| PKG-03 | Phase 20 | Pending |
| DTCT-01 | Phase 19 | Pending |
| DTCT-02 | Phase 19 | Pending |
| XPRT-01 | Phase 21 | Pending |
| XPRT-02 | Phase 21 | Pending |
| ONBD-01 | Phase 21 | Pending |
| ONBD-02 | Phase 21 | Pending |
| COORD-01 | Phase 16 | Pending |
| COORD-02 | Phase 18 | Pending |
| SIDE-01 | Phase 11 | Pending |
| SIDE-02 | Phase 11 | Pending |
| SIDE-03 | Phase 11 | Pending |
| SIDE-04 | Phase 11 | Pending |
| FEED-01 | Phase 11 | Pending |
| FEED-02 | Phase 11 | Pending |
| FEED-03 | Phase 11 | Pending |
| FEED-04 | Phase 11 | Pending |
| FEED-05 | Phase 11 | Pending |
| AGNT-01 | Phase 11 | Pending |
| HAND-01 | Phase 12 | Pending |
| HAND-02 | Phase 12 | Pending |
| HAND-03 | Phase 12 | Pending |
| HAND-04 | Phase 12 | Pending |
| APPR-01 | Phase 13 | Pending |
| APPR-02 | Phase 13 | Pending |
| APPR-03 | Phase 13 | Pending |
| APPR-04 | Phase 13 | Pending |
| BRAIN-01 | Phase 14 | Pending |
| BRAIN-02 | Phase 14 | Pending |
| BRAIN-03 | Phase 14 | Pending |
| BRAIN-04 | Phase 14 | Pending |
| PLSH-01 | Phase 15 | Pending |

**Coverage:**
- v2.0 requirements: 24 total — 24/24 mapped ✓
- v1.3 requirements: 23 total — 23/23 mapped ✓
- Total: 47 — 47/47 mapped ✓

---
*Requirements defined: 2026-03-24 (v1.3), 2026-03-25 (v2.0)*
*Last updated: 2026-03-25 — v2.0 traceability complete (24/24 mapped to Phases 16-21)*
