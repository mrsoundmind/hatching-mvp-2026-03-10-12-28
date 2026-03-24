# Requirements: Hatchin v1.3 — Autonomy Visibility & Right Sidebar Revamp

**Defined:** 2026-03-24
**Core Value:** No one should ever feel alone with their idea, have to start from scratch, or need to know how to prompt AI — just have a conversation and your team takes it from there.

## v1.3 Requirements

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

## Future Requirements

Deferred to v1.4+. Tracked but not in current roadmap.

### Trust & Analytics
- **TRST-01**: User sees each agent's trust level (new → established → trusted) with visual indicator
- **TRST-02**: User sees autonomy analytics dashboard (cost per agent, success rate, approval rate over time)

### Advanced Interactions
- **ADVN-01**: User can configure notification preferences for autonomy events
- **ADVN-02**: User can search through historical autonomy events
- **ADVN-03**: Keyboard shortcuts for quick approve/reject from Approvals hub

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full LangGraph graph visualization | Wrong audience — developer tool in consumer product |
| Per-message token counters | Breaks the "colleague" metaphor — colleagues don't show billable hours per sentence |
| Raw JSON event viewer | Developer debug tool, not consumer UI |
| Requiring approval for every action | Approval fatigue destroys autonomy value |
| S3/cloud file storage | Overkill for MVP; base64 in JSONB is sufficient at current scale |
| Custom LLM fine-tuning UI | Premature — need data volume first |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
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
- v1.3 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-24*
*Last updated: 2026-03-24 after initial definition*
