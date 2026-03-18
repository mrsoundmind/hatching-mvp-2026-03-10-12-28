# Roadmap: Hatchin MVP — v1.0

**Milestone:** v1.0 — Text-Perfect, Human-First
**Goal:** Before anything else — image gen, coding, voice — every Hatch must feel genuinely expert, contextually aware, and personality-driven. Perfect the conversation layer. Fix the broken user journey. Make every interaction feel like talking to a real teammate who knows your project.
**Phases:** 5
**Requirements:** 31 mapped, 31 covered ✓

---

## Phase 1: Hatch Conversation Quality

**Goal:** Every Hatch responds with genuine domain expertise, full project context awareness, and a distinct personality voice. A user who has never heard of "prompt engineering" should be able to have a productive conversation with any Hatch on day one.

**Requirements:** CONV-01, CONV-02, CONV-03, CONV-04, CONV-05, CONV-06, CONV-07, CONV-08, AWARE-01, AWARE-02, AWARE-03, AWARE-04

### What exists vs what's missing (deep audit, 2026-03-17)

**What's actually working:**
- Streaming path in `openaiService.ts` injects: character voice (voicePrompt, tendencies, neverSays), project context (Brain direction), project memories (cross-session facts), user behavior profiling, personality adaptation, practitioner skills
- `responsePostProcessing.ts` has 7-layer tone guard: strips role intros, removes AI-isms, strips bullet dumps, adapts length, applies human closing, single-question guard
- `memoryExtractor.ts` extracts decisions/facts/preferences fire-and-forget after each response

**Critical gaps (specific files, specific fixes needed):**

**GAP 1 — `graph.ts` is a zombie that actively undermines everything**
`server/ai/graph.ts` is used by `/api/hatch/chat` (non-streaming fallback route). It uses a completely separate `FOUNDATION` constant, NOT the character profiles from roleRegistry. It FORCES "Heard/Got it/Noted/Understood/Noticing" starters (the exact sycophantic openers the tone guard removes) and FORCES "Next step: / Next 10-minute move: / Smallest next action:" endings (the exact patterns the tone guard removes). It bypasses ALL character injection, project context, memory, and user behavior analysis. It has only 8 hardcoded roles via regex keyword matching.
> **Fix**: Either wire `graph.ts` through the same `openaiService.ts` path, or delete it and remove the `/api/hatch/chat` route entirely (the streaming WS path is the real one).

**GAP 2 — Emotional signature defined but never injected**
Every character in `shared/roleRegistry.ts` has an `emotionalSignature` with specific phrases for 4 emotional states (excited, challenged, uncertain, celebrating). These are NEVER passed to the LLM. When the user is frustrated, Alex's challenged-state phrase ("Alright, let's slow down and be systematic...") should be triggered. Currently it just uses generic emotion guidelines.
> **Fix**: In `openaiService.ts`, detect emotional state, look up the character's matching `emotionalSignature` phrase, inject it as an instruction: "The user seems [state]. Respond with energy matching: '[signature phrase]'".

**GAP 3 — Memory extraction is heuristic regex, misses most facts**
`memoryExtractor.ts` uses regex patterns like `/we(?:'re| are| will| should) (?:going to |going with |using |building |implement)/gi`. It will completely miss "let's go with Supabase", "the target audience is designers over 30", "we decided to scrap the mobile version". Most real decisions don't match these patterns.
> **Fix**: Add an LLM-based extraction pass for high-importance conversations (length > 200 chars). Use a lightweight prompt: "Extract up to 3 key decisions, facts, or preferences from this exchange. Be specific." Fire-and-forget, same as current. Falls back to heuristic if LLM fails.

**GAP 4 — No first-message opener intelligence**
When a user first messages a Hatch in a project that has Brain context, the Hatch has no instruction to DEMONSTRATE it read the Brain. It might respond generically. The "I already know your project" moment — the thing that makes it feel like a real teammate, not a chatbot — needs to be explicitly prompted.
> **Fix**: In `openaiService.ts`, detect if `conversationHistory.length === 0` (first message). Inject: "This is your FIRST message in this conversation. You already know this project — demonstrate that immediately. Reference something specific from the project context before responding to their question. Make them feel you've been waiting to work on this."

**GAP 5 — No opinion / disagreement instruction**
The prompt tells Hatches to show curiosity and match energy, but never instructs them to push back when something is wrong. A senior engineer who always agrees is not believable. Real team members challenge bad decisions.
> **Fix**: Add to the system prompt: "When you see a decision that has clear risks or a better alternative, say so directly — once, briefly, without lecturing. Real colleagues push back. 'That might work but here's what I'd watch out for...' is more valuable than agreement."

**GAP 6 — Hatches only respond, never initiate**
Currently Hatches are purely reactive. The "you're never alone" promise requires Hatches that occasionally surface something proactively — referencing a past decision, flagging something relevant, asking if the user wants to continue a thread. This doesn't exist anywhere.
> **Fix**: This is partially a backend feature (proactive message trigger), partially a prompt feature. For now: when project memory contains an open question (memoryType: 'open_question') and the user's new message is related, inject: "You have an open question from a previous conversation: [question]. If relevant, you can reference it."

**GAP 7 — `userDesignation` is always null**
`openaiService.ts` injects `userDesignation` (what role the USER has on the project) — a powerful context signal. But it reads from `project.coreDirection.userRole` which doesn't exist in the schema. `coreDirection` is `{whatBuilding, whyMatters, whoFor}` — no `userRole`. So this injection is always empty.
> **Fix**: Either add `userRole` to the `coreDirection` schema and collect it during project creation, OR derive it from the user's self-description in early messages (Maya usually extracts this).

**GAP 8 — Team routing is invisible**
When the conductor routes a message from Alex to Dev, the user just sees Dev respond. There's no "passing the baton" moment that makes the team feel real. The routing is technically correct but experientially invisible.
> **Fix**: When a Hatch receives a message that was routed from another Hatch (conductor decision), inject a brief transition: the Hatch should acknowledge the handoff naturally ("Alex was right to loop me in on this — [response]") rather than responding as if they received the message cold.

**Success Criteria:**
1. Send a technical question to the Engineer Hatch — response uses engineering vocabulary, references project stack/context, asks a precise follow-up
2. Send a design question to the Designer Hatch — different tone than Engineer, references visual thinking
3. First message in a project with Brain context → Hatch references something specific from the Brain without being asked
4. Have a 5-message conversation → Hatch references something from message 2 in message 5
5. Send a 3-word message → Hatch replies in 1-2 sentences max
6. State something architecturally questionable → Hatch pushes back once, briefly, naturally
7. No response begins with "Great!", "Sure!", "Of course!", "Heard —", "Got it —" or any variant
8. No response contains bullet points or markdown headers
9. `graph.ts` path either deleted or wired through the same character/context system

**Status:** complete — all 8 gaps implemented (2026-03-17)

---

## Phase 2: User Journey Fixes

**Goal:** Every core user flow works end-to-end. A new user can sign up, create their first project, and start chatting with their Hatch team without hitting any dead ends.

**Requirements:** UX-01, UX-02, UX-03, UX-04, UX-05, UX-06, UX-07, UX-08, DATA-04

**Plans:** 7/7 plans complete

Plans:
- [x] 02-01-PLAN.md — Fix `/` routing (LandingPage for logged-out) + home.tsx modal calls handleCreateIdeaProject
- [x] 02-02-PLAN.md — Fix team accordion (Set.replace not Set.add) + clear typingColleagues on streaming_started
- [x] 02-03-PLAN.md — Server-side agentRole backfill in GET messages route (batched, read-time enrichment)
- [x] 02-04-PLAN.md — Fix activeProjectAgents in backfill useEffect dep array + human verification checkpoint
- [ ] 02-05-PLAN.md — GAP CLOSURE: UX-01/UX-02 — Project name prompt + Maya-only creation + Maya SVG avatar
- [ ] 02-06-PLAN.md — GAP CLOSURE: UX-07/UX-08/DATA-04 — Streaming color race, typing indicator dedup, load flash
- [ ] 02-07-PLAN.md — GAP CLOSURE: UX-05 — Team accordion AnimatePresence smooth collapse

**Success Criteria:**
1. Click "Create Project" in the modal with a name → project is created, selected, and chat is ready — button does not silently fail — GAP (no name prompt; team auto-created; Maya shows fallback avatar)
2. Visit `/` when logged out → LandingPage renders with Hatchin's value proposition — PASSED
3. Visit `/` when logged in → redirect to the app immediately — (not independently tested)
4. Click a project in the sidebar → it expands and all others collapse — PASSED
5. Click a team in the sidebar → agents appear; click again → agents collapse — PARTIAL (works but animation glitch on last team)
6. AI is streaming a response → textarea is fully enabled, user can type a follow-up — PASSED
7. Navigate away from a conversation and come back → agent bubble color is the same as before — PARTIAL (first reply flashes old color before correcting)
8. AI is thinking → typing indicator appears in exactly one place (not both message list and above input) — GAP (multiple indicators still appear)
9. Old messages loaded from DB show correct agent role color (not always default green) — PARTIAL (flashes green on initial load before correcting)

**Status:** complete (3/9 fully passing; 5 gap items documented in 02-04-SUMMARY.md for follow-up)

---

## Phase 3: Hatch Presence & Avatar System

**Goal:** Every Hatch has a visual identity that matches their personality. Avatars render everywhere, animate subtly, and make the app feel like a living team — not a dashboard.

**Requirements:** PRES-01, PRES-02, PRES-03, PRES-04, PRES-05

**Plans:** 1 plan

Plans:
- [ ] 03-01-PLAN.md — Avatar system verification + personality evolution persistence to DB

**Success Criteria:**
1. Open any conversation → agent avatar renders in MessageBubble next to every agent reply
2. Open the sidebar → each agent shows their SVG avatar (not a letter or emoji fallback)
3. Open RightSidebar with an agent active → their avatar renders in the header (size 40)
4. Idle avatar → only face/eye micro-animation (brow lift or mouth movement matching personality) — no full-body float
5. AI is thinking → thought bubble appears above avatar; no head rotation
6. Every agent display shows character name (Alex, Dev, Cleo) — not role label (Product Manager, Software Engineer, Designer)
7. Restart the server → agent personality learning (e.g. "this user prefers concise replies") is still present in the next conversation

**Status:** planned

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
