# Roadmap: Hatchin

## Milestones

- ✅ **v1.0 Text-Perfect, Human-First** — Phases 1-5 (shipped 2026-03-19) — [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 Autonomous Execution Loop** — Phases 6-9 (shipped 2026-03-23) — [archive](milestones/v1.1-ROADMAP.md)
- ✅ **v1.2 Billing + LLM Intelligence** — Phase 10 (shipped 2026-03-23) — [archive](milestones/v1.2-ROADMAP.md)
- 🚧 **v1.3 Autonomy Visibility & Right Sidebar Revamp** — Phases 11-15 (in progress)

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
**Plans**: TBD

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
| 11. Sidebar Shell + Activity Feed | v1.3 | 0/? | Not started | - |
| 12. Handoff Visualization | v1.3 | 0/? | Not started | - |
| 13. Approvals Hub + Task Pipeline | v1.3 | 0/? | Not started | - |
| 14. Brain Redesign + Autonomy Settings | v1.3 | 0/? | Not started | - |
| 15. Polish | v1.3 | 0/? | Not started | - |

---
*Roadmap created: 2026-03-17*
*v1.0 shipped: 2026-03-19*
*v1.1 shipped: 2026-03-23*
*v1.2 shipped: 2026-03-23*
*v1.3 roadmap added: 2026-03-24*
