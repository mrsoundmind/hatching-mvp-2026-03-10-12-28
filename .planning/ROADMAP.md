# Roadmap: Hatchin MVP — v1.0

**Milestone:** v1.0 — Text-Perfect, Human-First
**Goal:** Before anything else — image gen, coding, voice — every Hatch must feel genuinely expert, contextually aware, and personality-driven. Perfect the conversation layer. Fix the broken user journey. Make every interaction feel like talking to a real teammate who knows your project.
**Phases:** 5
**Requirements:** 31 mapped, 31 covered ✓

---

## Phase 1: Hatch Conversation Quality

**Goal:** Every Hatch responds with genuine domain expertise, full project context awareness, and a distinct personality voice. A user who has never heard of "prompt engineering" should be able to have a productive conversation with any Hatch on day one.

**Requirements:** CONV-01, CONV-02, CONV-03, CONV-04, CONV-05, CONV-06, CONV-07, CONV-08, AWARE-01, AWARE-02, AWARE-03, AWARE-04

**Success Criteria:**
1. Send a technical question to the Engineer Hatch — response references specific technologies, asks a precise follow-up, and uses engineering vocabulary naturally
2. Send a design question to the Designer Hatch — response references visual principles, asks about user context, and has a different tone than the Engineer
3. Start a project, add Brain context, then ask a Hatch something — it references the Brain without being prompted ("given what you're building for X audience...")
4. Have a 5-message conversation — the Hatch references something from message 2 in message 5 without being reminded
5. Send a 3-word message — Hatch replies with a short, focused reply (not 3 paragraphs)
6. Send a longer exploratory message — Hatch matches that energy with a fuller response
7. No response in the test set begins with "Great!", "Sure!", "Of course!", or any variant
8. No response contains bullet points or markdown headers

**Status:** not-started

---

## Phase 2: User Journey Fixes

**Goal:** Every core user flow works end-to-end. A new user can sign up, create their first project, and start chatting with their Hatch team without hitting any dead ends.

**Requirements:** UX-01, UX-02, UX-03, UX-04, UX-05, UX-06, UX-07, UX-08, DATA-04

**Success Criteria:**
1. Click "Create Project" in the modal with a name → project is created, selected, and chat is ready — button does not silently fail
2. Visit `/` when logged out → LandingPage renders with Hatchin's value proposition
3. Visit `/` when logged in → redirect to the app immediately
4. Click a project in the sidebar → it expands and all others collapse
5. Click a team in the sidebar → agents appear; click again → agents collapse
6. AI is streaming a response → textarea is fully enabled, user can type a follow-up
7. Navigate away from a conversation and come back → agent bubble color is the same as before
8. AI is thinking → typing indicator appears in exactly one place (not both message list and above input)
9. Old messages loaded from DB show correct agent role color (not always default green)

**Status:** not-started

---

## Phase 3: Hatch Presence & Avatar System

**Goal:** Every Hatch has a visual identity that matches their personality. Avatars render everywhere, animate subtly, and make the app feel like a living team — not a dashboard.

**Requirements:** PRES-01, PRES-02, PRES-03, PRES-04, PRES-05

**Success Criteria:**
1. Open any conversation → agent avatar renders in MessageBubble next to every agent reply
2. Open the sidebar → each agent shows their SVG avatar (not a letter or emoji fallback)
3. Open RightSidebar with an agent active → their avatar renders in the header (size 40)
4. Idle avatar → only face/eye micro-animation (brow lift or mouth movement matching personality) — no full-body float
5. AI is thinking → thought bubble appears above avatar; no head rotation
6. Every agent display shows character name (Alex, Dev, Cleo) — not role label (Product Manager, Software Engineer, Designer)
7. Restart the server → agent personality learning (e.g. "this user prefers concise replies") is still present in the next conversation

**Status:** not-started

---

## Phase 4: Data Reliability & Resilience

**Goal:** Data that should persist actually persists. Duplicate messages can't happen. Long conversations don't kill performance. Production is protected from silent data loss.

**Requirements:** DATA-01, DATA-02, DATA-03

**Success Criteria:**
1. Send the same message twice rapidly (simulated network retry) → only one message appears in the conversation
2. Open a conversation with 200+ messages → first 50 load; "Load earlier messages" appears; clicking it loads the next 50
3. Start the server with `NODE_ENV=production` and `STORAGE_MODE=memory` → server throws a startup error with a clear message
4. Start the server normally → no errors; all behavior unchanged

**Status:** not-started

---

## Phase 5: Route Architecture Cleanup

**Goal:** Break the 3,500-line `routes.ts` god file into focused, maintainable modules. Zero behavior changes — pure reorganization.

**Requirements:** ARCH-01, ARCH-02

**Success Criteria:**
1. `server/routes/projects.ts` exists and handles all `/api/projects*` routes
2. `server/routes/teams.ts` exists and handles all `/api/teams*` routes
3. `server/routes/agents.ts` exists and handles all `/api/agents*` routes
4. `server/routes/messages.ts` exists and handles all `/api/conversations*` and `/api/messages*` routes
5. `server/routes/chat.ts` exists and handles `/api/hatch/chat` and WebSocket message handlers
6. `npm run typecheck` passes with zero errors
7. `npm run test:integrity` passes
8. `npm run test:dto` passes
9. Original `routes.ts` is deleted or reduced to only imports/registration

**Status:** not-started

---

## Future Milestones (not v1.0 — captured for context)

### v1.1 — Multimodal Expansion
- Image generation from Designer/Creative Hatch conversations
- Claude coding agent triggered from Engineer Hatch
- Voice input via Whisper transcription

### v1.2 — Autonomous Execution Loop
- Hatches hand off tasks to each other without user direction
- Background task execution (Hatches work while user is offline)
- Hatches police each other: quality gates, peer review, safety — fully internal
- User wakes up to progress updates, not blank state
- Autonomous Brain updates from execution results

### v1.3 — B2B Company Brain
- Company-level knowledge layer: brand guidelines, tone of voice, design system, product docs uploaded once
- All projects within a company inherit company brain automatically
- Per-project brain adds to, not replaces, company brain
- Hatch team is pre-informed by company context from day one
- Admin panel for company brain management

### v1.4 — Collaboration
- Multiple real users working in the same project alongside their Hatch team
- Real teammates and AI teammates in the same conversation
- Role-based access: who can add Hatches, edit Brain, see which conversations

---

## Definition of Done

The milestone is complete when a non-technical user can:
1. Open Hatchin for the first time and understand what it is from the landing page
2. Sign up and create their first project without friction
3. Message any Hatch and receive a reply that feels expert, contextually aware, and distinctly that character's voice
4. Come back the next day and have the Hatch remember what they discussed
5. Never once feel like they need to "prompt" anything

**Technical gates:**
- [ ] All 31 v1 requirements verified
- [ ] `npm run typecheck` passes (zero errors)
- [ ] `npm run gate:safety` passes
- [ ] `npm run test:integrity` passes
- [ ] `npm run test:dto` passes
- [ ] Create Project tested manually — works end-to-end
- [ ] Conversation quality test: 10-message conversation with each role feels distinctly different

---
*Roadmap created: 2026-03-17*
*Milestone: v1.0 — Text-Perfect, Human-First*
