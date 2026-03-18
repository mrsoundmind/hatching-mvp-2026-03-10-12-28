# Requirements: Hatchin MVP

**Defined:** 2026-03-17
**Core Value:** No one should ever feel alone with their idea, have to start from scratch, or need to know how to prompt AI — just have a conversation and your team takes it from there.

## v1 Requirements

Focus: **Perfect the text/conversation layer.** Every Hatch must feel genuinely expert, contextually aware, and personality-driven. The user should never feel like they're talking to a generic AI.

### Conversation Quality (the core)

- [ ] **CONV-01**: Each Hatch responds with domain-specific expertise — an Engineer Hatch talks like a senior engineer, not a generic assistant
- [ ] **CONV-02**: Each Hatch is aware of the full project context (Brain, direction, goals, past key decisions) without the user having to repeat themselves
- [ ] **CONV-03**: Conversation memory works within a session — Hatch references what was discussed earlier and builds on it naturally
- [ ] **CONV-04**: Hatch asks at most one question per reply, and it's the *right* question — not a catch-all "tell me more"
- [ ] **CONV-05**: Hatch responses match the user's message length and energy — short casual message gets a short casual reply
- [ ] **CONV-06**: No response ever starts with "Great!", "Sure!", or any sycophantic opener
- [ ] **CONV-07**: No bullet points or markdown headers in chat responses — all natural prose
- [ ] **CONV-08**: Each Hatch has a distinct voice — Alex (PM) sounds strategically probing, Dev (Engineer) sounds precise and dry, Cleo (Designer) sounds expressive and visual

### Project Awareness

- [ ] **AWARE-01**: When a user creates a project and describes their idea, the Hatch team acknowledges the specific idea — not a generic welcome
- [ ] **AWARE-02**: Hatches reference the project Brain (goals, direction, culture) when it's relevant — "given what you're building..."
- [ ] **AWARE-03**: Task detection from chat accurately surfaces tasks without interrupting the conversation flow
- [ ] **AWARE-04**: When the user's intent shifts (from ideating to executing, or from one feature to another), the Hatch picks it up without being redirected

### User Journey (broken flows that block everything)

- [x] **UX-01**: User can create a project via the modal and land in the new project immediately (Create Project button currently does nothing)
- [x] **UX-02**: First-time user is onboarded into their first project with a compelling welcome that sets the tone
- [x] **UX-03**: User sees the landing page at `/` when not logged in — it communicates what Hatchin is and why it's different
- [ ] **UX-04**: User can click a project in the sidebar to expand it (others auto-collapse)
- [x] **UX-05**: User can click a team in the sidebar to expand its agents (others auto-collapse)
- [ ] **UX-06**: Textarea in chat is always enabled — user can type while the AI is streaming
- [x] **UX-07**: Agent chat bubble color is consistent when navigating between projects and teams (no color reset on nav)
- [x] **UX-08**: Typing indicator appears in one place only — not both in the message list and above the input

### Hatch Presence (making them feel alive)

- [x] **PRES-01**: Each agent avatar renders correctly in MessageBubble, ProjectTree, RightSidebar, and CenterPanel
- [x] **PRES-02**: Avatar idle state shows a unique micro-animation matching the character's personality (brow/mouth movement) — no full-body floating
- [x] **PRES-03**: Thinking state shows a thought bubble — not a head tilt
- [x] **PRES-04**: Agent display names show the character name (Alex, Dev, Cleo) everywhere — not the role label (Product Manager, Software Engineer)
- [x] **PRES-05**: Personality evolution (what a Hatch learns about the user's style) is persisted to the database — survives server restart

### Data Reliability

- [ ] **DATA-01**: Message creation uses an idempotency key — no duplicate messages on network retry
- [x] **DATA-02**: Long conversations use cursor-based pagination — first 50 messages load, user can load more
- [ ] **DATA-03**: Server asserts `STORAGE_MODE=db` at startup in production — prevents silent in-memory data loss
- [x] **DATA-04**: `agentRole` stored in message metadata at creation and backfilled at read time for old messages

### Architecture

- [x] **ARCH-01**: `routes.ts` (3,500+ lines) split into focused modules: `projects.ts`, `teams.ts`, `agents.ts`, `messages.ts`, `chat.ts`
- [x] **ARCH-02**: All existing tests pass after route split — no behavior changes

## v2 Requirements (future milestones)

### Multimodal

- **MM-01**: User can generate images from a conversation with the Designer or Creative Hatch
- **MM-02**: User can trigger Claude coding agent from a conversation with the Engineer Hatch
- **MM-03**: Code output from Claude agent is shown in a rich code block with apply/copy actions

### Integrations

- **INT-01**: User can connect a GitHub repo — Engineer Hatch can reference real files
- **INT-02**: Tasks sync bidirectionally with Linear
- **INT-03**: User receives Slack notifications for Hatch messages

### Growth & Craft

- **CRAFT-01**: Designer Hatch provides critique mode — user shares work, Hatch gives structured feedback
- **CRAFT-02**: Hatch tracks user's skill progress over time — "you've improved at X since last month"
- **CRAFT-03**: User can request a "teach me" session — Hatch enters teaching mode for their domain

### Analytics

- **ANLX-01**: User sees a dashboard of team activity — messages, tasks completed, response quality scores
- **ANLX-02**: Hatch feedback loop — user rates responses, training data accumulates

## Out of Scope (this milestone)

| Feature | Reason |
|---------|--------|
| Image generation | Text-first — perfect conversation before adding modalities |
| Claude coding integration | Text-first |
| Voice input | Text-first |
| Mobile app | Web-first, validate before native |
| Multi-tenant billing | Pre product-market fit |
| Custom LLM fine-tuning | Need 10K+ training examples first |
| GitHub / Linear integrations | v2+ |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CONV-01 | Phase 1 | Pending |
| CONV-02 | Phase 1 | Pending |
| CONV-03 | Phase 1 | Pending |
| CONV-04 | Phase 1 | Pending |
| CONV-05 | Phase 1 | Pending |
| CONV-06 | Phase 1 | Pending |
| CONV-07 | Phase 1 | Pending |
| CONV-08 | Phase 1 | Pending |
| AWARE-01 | Phase 1 | Pending |
| AWARE-02 | Phase 1 | Pending |
| AWARE-03 | Phase 1 | Pending |
| AWARE-04 | Phase 1 | Pending |
| UX-01 | Phase 2 | Complete |
| UX-02 | Phase 2 | Complete |
| UX-03 | Phase 2 | Complete |
| UX-04 | Phase 2 | Pending |
| UX-05 | Phase 2 | Complete |
| UX-06 | Phase 2 | Pending |
| UX-07 | Phase 2 | Complete |
| UX-08 | Phase 2 | Complete |
| PRES-01 | Phase 3 | Complete |
| PRES-02 | Phase 3 | Complete |
| PRES-03 | Phase 3 | Complete |
| PRES-04 | Phase 3 | Complete |
| PRES-05 | Phase 3 | Complete |
| DATA-01 | Phase 4 | Pending |
| DATA-02 | Phase 4 | Complete |
| DATA-03 | Phase 4 | Pending |
| DATA-04 | Phase 2 | Complete |
| ARCH-01 | Phase 5 | Complete |
| ARCH-02 | Phase 5 | Complete |

**Coverage:**
- v1 requirements: 31 total
- Mapped to phases: 31
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-17*
*Last updated: 2026-03-17 — Rewritten with full product vision*
