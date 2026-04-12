# Hatchin

## What This Is

Hatchin is the bridge between having an idea and making it real. Anyone — regardless of technical background — comes in with a dream, gets an instant team of AI specialists ("Hatches"), and just has a conversation. No prompting. No instructions. No starting from scratch. You talk, your team listens, understands, and helps you move forward. A designer gets better at design by working with the Designer Hatch. A founder gets their product built by talking to their Product, Engineer, and Marketing Hatches. The team knows your project, remembers your context, and grows with you.

Hatchin solves the prompting problem. Most people can't use AI effectively because they don't know how to prompt it. Hatchin removes that barrier entirely — users don't talk to a model, they talk to a team. The Hatches handle everything underneath. The user just has to show up with an idea.

## Core Value

No one should ever feel alone with their idea, have to start from scratch, or need to know how to prompt AI — just have a conversation and your team takes it from there.

## Current Milestone: v3.0 Reliable Autonomy

**Goal:** Harden the autonomous execution loop so users can trust it. Eliminate runaway-spend risk via atomic budget enforcement, and let Hatches do recurring work on a schedule — chat-native ("Kai, draft the growth update every Monday"), not cron UIs.

**Target features:**
- Atomic budget enforcement — task checkout + budget check in a single DB transaction, closes the race condition where concurrent background tasks bypass the daily cap
- Scheduled routines — recurring autonomous work triggered by natural-language schedule ("every Monday", "daily at 9am"), integrated into the chat interface, using existing agent execution pipeline

**Scope philosophy:** Start narrow. Ship these two, validate, then revisit the other 5 Paperclip-inspired ideas (audit timeline UX, exportable templates, config rollback, mobile digest, per-agent budgets).

---

## Previous Milestone: v2.0 Hatches That Deliver

**Goal:** Transform Hatchin from "AI chatroom" to "AI team that ships coordinated work" — linked deliverable packages, visible team coordination, async production, professional export.

**Status:** COMPLETE — all features shipped 2026-03-30.

**What's shipped:**
- Deliverable system — artifact-style panel with markdown rendering, version history, agent attribution
- Cross-agent deliverable chains — 3 templates (launch, content-sprint, research) with handoff context injection
- Project packages — grouped deliverables with progress tracking and WS streaming
- Organic detection — pattern-based intent detection wired into chat flow
- Iteration UX — inline refine input in ArtifactPanel, calls iterate endpoint
- 15 deliverable types with role mapping and section schemas
- Full API (13 endpoints) + 4 WS event types
- Professional PDF export — branded pdfkit template with TOC, attribution, Hatchin branding
- Zero-friction onboarding — PackageSuggestionCard auto-suggests best chain template based on project agent roles

**Details:** See plan at `.claude/plans/splendid-munching-flask.md`

## Current State

**Shipped:** v1.3 — Autonomy Visibility & Right Sidebar Revamp (2026-03-30, Phase 15 polish in progress)
**Shipped:** v1.2 — Billing + LLM Intelligence (2026-03-23)
**Previous:** v1.1 — Autonomous Execution Loop (2026-03-23)
**Previous:** v1.0 — Text-Perfect, Human-First (2026-03-19)
**Codebase:** ~50,000+ LOC TypeScript
**Branch:** `reconcile-codex` (active development)

### What v1.1 Delivered
- Background task execution via pg-boss durable job queue — Hatches produce real output (plans, research, breakdowns)
- Agent-to-agent handoffs — PM scopes, Engineer picks up, Designer reviews; BFS cycle detection prevents loops
- Three-tier safety gates — low-risk auto-complete, mid-risk peer review, high-risk surfaces for user approval
- Progressive trust scoring — agents earn higher autonomy through successful completions (up to +0.15 threshold boost)
- Maya return briefing — LLM-generated conversational summary when user returns after 15+ min absence
- Tab notifications — flashing title + OS Notification API when background work completes
- Inactivity auto-trigger — queued work starts after 2+ hours idle (per-project opt-in)
- Per-project daily LLM cost cap prevents runaway spend
- Inline approval cards (Approve/Reject) for high-risk autonomous actions
- Pause/resume control for all autonomous execution

### What v1.0 Delivered
- Domain-specific conversation quality — each Hatch responds with genuine expertise, not generic AI
- Full project context awareness — Brain, direction, goals injected into every prompt
- 26 animated SVG character avatars with unique idle micro-animations and thinking states
- Complete user journey — landing page, onboarding, project creation, chat
- Personality evolution persisted to database (survives restart)
- Message idempotency keys + cursor-based pagination
- Production storage guard (prevents silent in-memory data loss)
- Modular route architecture — routes.ts split from 4,347 → 430 lines across 6 modules

## The Full Vision (where this is going)

### Autonomous Execution
The end state is a team that works while you sleep. Human conversation initiates and guides — but execution happens autonomously. Hatches hand off tasks to each other without being asked (Engineer picks up what the PM leaves, Designer gets looped in when UI decisions arise). Hatches police each other — quality gates, peer review, safety checks — all internally coordinated. The user wakes up to progress, not a blank canvas.

v1.1 shipped the core autonomous loop: background execution via pg-boss, agent-to-agent handoffs with cycle detection, three-tier safety gates, progressive trust scoring, and inactivity-based auto-trigger. The next layer is proactive autonomy — Hatches that notice problems, initiate work without being asked, and coordinate across projects.

### B2B: Company-Level Intelligence
When selling to companies, Hatchin is curated to that company's DNA — once. Brand guidelines, tone of voice, design system, product knowledge, company values — uploaded at the company level, not per-project. Every project inside that company inherits this automatically. A Sales Hatch already knows the product. A Designer Hatch already knows the brand. An Engineer Hatch already knows the stack.

The project brain is singular. No re-adding context. No onboarding every new project from scratch. The company's intelligence lives in Hatchin and every team member (human or Hatch) starts from a fully informed position.

### Collaboration
Future: multiple real humans working alongside their Hatch team in the same project. Real teammates and AI teammates in the same conversation — the Hatches serve the whole team, not just one person.

## v2.0 Details: Hatches That Deliver

**The problem v2.0 solves:** Individual deliverables are table stakes (ChatGPT can write a PRD). The differentiator is **cross-agent coordination** — PM writes PRD → Engineer writes tech spec referencing it → Designer creates brief based on both → Marketing drafts GTM from the PRD. Five linked documents from a coordinated team. Can't do that in any single-chat AI.

**Target features:**
- Deliverable system — artifact-style panel (Claude desktop pattern), iteratable through conversation
- Cross-agent deliverable chains — linked documents where downstream agents reference upstream output
- Project packages — grouped deliverables by goal ("Launch Package", "Content Sprint", "Research Package")
- Both trigger paths — organic detection from chat + explicit user request
- Async deliverable production — team produces documents in background, notifies on completion
- Professional export — branded PDF with TOC, attribution, clean typography
- Zero-friction onboarding — first deliverable generating within 3 minutes of signup
- Visible team coordination — attribution, handoff notes in deliverables, cross-agent discussion
- Landing page demonstration — show actual output, not feature descriptions

**Use-case clusters:**
1. Product Launch — PM → PRD, Engineer → tech spec, Designer → design brief, Marketing → GTM plan
2. Marketing Content — Copywriter → blog posts, Social → calendar, SEO → keyword strategy, Email → sequences
3. Planning & Research — PM → project plan, Analyst → competitive analysis, Ops → SOPs

**Details:** See plan at `.claude/plans/splendid-munching-flask.md`

## Use Cases (What "Initiating Dreams" Looks Like)

- A non-technical founder describes a SaaS idea → PM drafts a PRD, Engineer writes a tech spec referencing it, Marketing produces a GTM plan — all linked, all overnight, all exportable as a professional package
- A marketer says "I need a content push for launch" → Copywriter drafts blog posts, Social Media generates a content calendar, Email creates a drip sequence — coordinated, on-brand, ready to publish
- A solo developer talks through architecture decisions with their Engineer Hatch → Engineer produces a technical spec document, flags risks, hands off to QA for a test plan
- A designer uses the Designer Hatch to get better at their craft — critique, inspiration, iteration feedback — plus a design brief document they can share with stakeholders
- Anyone wakes up with an idea and has a team ready to run with it — and wakes up the next morning to "Your team produced 4 documents overnight. Review when ready."

The common thread: **you never start from scratch, you never feel alone, and your team produces real work — not just conversation.**

## Requirements

### Validated

- ✓ Google OAuth login — v1.0
- ✓ Multi-agent LangGraph chat with streaming — v1.0
- ✓ Project / Team / Agent CRUD — v1.0
- ✓ WebSocket real-time messaging — v1.0
- ✓ Task detection from chat — v1.0
- ✓ Safety gates + peer review — v1.0
- ✓ 26 character Hatches with distinct roles and personalities — v1.0
- ✓ Animated SVG avatars with idle micro-animations — v1.0
- ✓ Project Brain (goals, direction, culture) — v1.0
- ✓ Domain-specific Hatch expertise (CONV-01–08) — v1.0
- ✓ Full project context awareness (AWARE-01–04) — v1.0
- ✓ Complete user journey: landing → onboarding → project → chat (UX-01–08) — v1.0
- ✓ Personality evolution persisted to database (PRES-05) — v1.0
- ✓ Message idempotency + cursor pagination (DATA-01–03) — v1.0
- ✓ Modular route architecture (ARCH-01–02) — v1.0
- ✓ Background task execution via pg-boss (EXEC-01–03) — v1.1
- ✓ Agent-to-agent handoffs with cycle detection (HAND-01–04) — v1.1
- ✓ Three-tier safety gates for autonomous execution (SAFE-01–03) — v1.1
- ✓ Progressive trust scoring (SAFE-04) — v1.1
- ✓ Maya return briefing + tab notifications (UX-03, UX-05) — v1.1
- ✓ Inline approval cards + pause/resume (UX-01, UX-02, UX-04) — v1.1
- ✓ Inactivity-based autonomous trigger (EXEC-04) — v1.1

### Out of Scope (current)

- Image generation — text-first milestone shipped
- Claude coding agent integration — text-first
- Voice input — text-first
- GitHub / Linear integrations — v2+
- Mobile app — web-first
- Multi-tenant billing — pre product-market fit
- Custom LLM fine-tuning — need data volume first

## The Anti-Prompting Philosophy

Traditional AI tools: user must learn to write prompts, manage context, understand model limitations.

Hatchin: user just talks. The Hatches:
- Already know the project context (Brain, direction, past chats)
- Know each other's domains (the Engineer defers to the Designer on UI, the PM routes to the right Hatch)
- Ask clarifying questions like real colleagues (not "provide more context", but "what part is slowing you down?")
- Build on prior conversations without being reminded
- Never break character or feel like a generic assistant

**The measure of success:** A user who has never heard of "prompt engineering" should be able to use every Hatch effectively on day one.

## Context

**Stack:** React 18 + Wouter + TanStack Query + Tailwind + Framer Motion (frontend) / Express + Drizzle ORM + Neon PostgreSQL + LangGraph + Gemini 2.5-Flash (backend).

**Current branch:** `reconcile-codex` — active feature development, merges into `main`.

**LLM chain:** Gemini 2.5-Flash (primary) → GPT-4o-mini (fallback) → Mock (test).

**Prompt rules (enforced always):**
- No markdown headers or bullet lists in chat responses
- Maximum 1 question per reply
- Natural endings — no "Let me know how I can help"
- Match user's message length
- Genuine reactions, not assistant-speak
- Never start with "Great!" or sycophantic openers

**Architecture (post v1.1):**
- `server/routes.ts` — 430-line thin orchestrator
- `server/routes/` — 6 focused modules (teams, agents, messages, projects, tasks, chat)
- `server/autonomy/` — execution pipeline, handoff orchestrator, peer review, trust scoring, event logger, background runner
- pg-boss durable job queue for background task execution
- Three-tier safety gates: auto-complete / peer review / user approval
- Progressive trust via `trustMeta` in `agents.personality` JSONB
- Inactivity trigger via `project.lastSeenAt` + `inactivityAutonomyEnabled` flag
- Maya return briefing via `returnBriefing.ts` (LLM-generated, stored as real message)

## Constraints

- **TypeScript strict mode**: All code must pass `npm run typecheck`
- **No raw SQL**: Always use Drizzle ORM in application code
- **Auth required**: All routes except `/auth` must check `req.session.userId`
- **Zod validation**: All API inputs validated with Zod schemas
- **Conversation quality**: Hatch responses must always pass tone guard

## Key Decisions

| Decision | Rationale | Outcome |
| Use-case-driven development (not feature-driven) | Organizes work around user goals, ensures every feature serves a real workflow | Pending — v2.0 |
| Deliverable chains as core differentiator | Single deliverables = ChatGPT. Coordinated team output = unique value. | Pending — v2.0 |
| Artifact panel (Claude desktop pattern) | Proven UX, users already understand it, iterable through conversation | Pending — v2.0 |
| Text-first deliverables, visual via MCPs later | LLMs produce excellent text. Be realistic about capabilities. | Pending — v2.0 |
|----------|-----------|---------|
| Text-first, then multimodal | Perfect the conversation before adding complexity | ✓ Good — v1.0 shipped with strong conversation quality |
| LangGraph for multi-agent routing | Extensible state machine, supports peer review, deliberation | ✓ Good |
| Gemini 2.5-Flash as primary LLM | Cost-effective, fast, sufficient quality for conversation | ✓ Good |
| Neon PostgreSQL serverless | Scales to zero, easy setup, right for MVP | ✓ Good |
| 26 named characters (not generic agents) | Personality-driven, memorable, builds attachment — Alex feels different from Dev | ✓ Good |
| Project Brain (JSONB) | Hatches always have full project context injected into prompt | ✓ Good |
| Anti-prompting as core design principle | Differentiator — not another AI chat tool | ✓ Good — validated through v1.0 user journey |
| Route modularization via deps injection | Avoids circular imports while enabling WS broadcast from route modules | ✓ Good |
| Personality persistence to agents.personality JSONB | Survives restart, no new table needed, per-user trait adaptation | ✓ Good |
| pg-boss for durable job queue (v1.1) | Runs on existing Neon PostgreSQL — no Redis needed | ✓ Good — reliable background execution |
| generateText injection (not runTurn) for autonomous execution | Isolates background pipeline from chat graph — simpler, testable | ✓ Good — clean separation |
| Stricter safety thresholds in autonomous mode (0.60 vs 0.80) | No user present to catch mistakes — higher bar for auto-approval | ✓ Good |
| Inactivity trigger gated per-project (not global flag) | Users opt-in per project; no surprise autonomous work | ✓ Good |
| Return briefing as real agent message (not separate WS event) | Briefing appears in chat history, survives page refresh | ✓ Good |
| Trust scoring via successRate * maturityFactor (bounded 0–1) | Simple, predictable, needs 10+ completions to reach full trust | ✓ Good |

---
*Last updated: 2026-03-30 — v1.3 shipping, v2.0 core infrastructure complete*
