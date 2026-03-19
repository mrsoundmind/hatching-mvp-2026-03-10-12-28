# Hatchin

## What This Is

Hatchin is the bridge between having an idea and making it real. Anyone — regardless of technical background — comes in with a dream, gets an instant team of AI specialists ("Hatches"), and just has a conversation. No prompting. No instructions. No starting from scratch. You talk, your team listens, understands, and helps you move forward. A designer gets better at design by working with the Designer Hatch. A founder gets their product built by talking to their Product, Engineer, and Marketing Hatches. The team knows your project, remembers your context, and grows with you.

Hatchin solves the prompting problem. Most people can't use AI effectively because they don't know how to prompt it. Hatchin removes that barrier entirely — users don't talk to a model, they talk to a team. The Hatches handle everything underneath. The user just has to show up with an idea.

## Core Value

No one should ever feel alone with their idea, have to start from scratch, or need to know how to prompt AI — just have a conversation and your team takes it from there.

## Current State

**Shipped:** v1.0 — Text-Perfect, Human-First (2026-03-19)
**Codebase:** ~47,000 LOC TypeScript across 162 files
**Branch:** `reconcile-codex` (active development)

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

This autonomous foundation is already partially built (LangGraph state machine, peer review gates, task detection). The next layer is closing the loop: autonomous handover, background execution, and a Hatch that knows when to act vs when to ask.

### B2B: Company-Level Intelligence
When selling to companies, Hatchin is curated to that company's DNA — once. Brand guidelines, tone of voice, design system, product knowledge, company values — uploaded at the company level, not per-project. Every project inside that company inherits this automatically. A Sales Hatch already knows the product. A Designer Hatch already knows the brand. An Engineer Hatch already knows the stack.

The project brain is singular. No re-adding context. No onboarding every new project from scratch. The company's intelligence lives in Hatchin and every team member (human or Hatch) starts from a fully informed position.

### Collaboration
Future: multiple real humans working alongside their Hatch team in the same project. Real teammates and AI teammates in the same conversation — the Hatches serve the whole team, not just one person.

## Next Milestone Goals

Pending — use `/gsd:new-milestone` to define v1.1 requirements and roadmap.

Candidate directions from the roadmap:
- **v1.1 Multimodal Expansion** — image generation from Designer Hatch, Claude coding agent from Engineer Hatch, voice input
- **v1.2 Autonomous Execution Loop** — Hatches hand off tasks, background execution, user wakes up to progress
- **v1.3 B2B Company Brain** — company-level knowledge layer inherited by all projects
- **v1.4 Collaboration** — multiple real users + AI teammates in the same project

## Use Cases (What "Initiating Dreams" Looks Like)

- A non-technical founder talks to their team about a SaaS idea → Hatches shape the product, break it into tasks, assign ownership, and start executing
- A designer uses the Designer Hatch to get better at their craft — critique, inspiration, iteration feedback
- A solo developer talks through architecture decisions with their Engineer Hatch — no rubber duck, a real specialist
- A marketer drafts a campaign by thinking out loud with the Marketing Hatch — the Hatch asks the right questions, fills in the gaps
- Anyone wakes up with an idea and has a team ready to run with it by end of day

The common thread: **you never start from scratch, you never feel alone, you never have to manage AI like a tool.**

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

### Active

(Empty — define next milestone with `/gsd:new-milestone`)

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

**Architecture (post v1.0):**
- `server/routes.ts` — 430-line thin orchestrator
- `server/routes/` — 6 focused modules (teams, agents, messages, projects, tasks, chat)
- Personality evolution persisted to `agents.personality` JSONB
- Message idempotency via `checkIdempotencyKey()` in WS handler
- Cursor-based pagination in storage + API + frontend

## Constraints

- **TypeScript strict mode**: All code must pass `npm run typecheck`
- **No raw SQL**: Always use Drizzle ORM in application code
- **Auth required**: All routes except `/auth` must check `req.session.userId`
- **Zod validation**: All API inputs validated with Zod schemas
- **Conversation quality**: Hatch responses must always pass tone guard

## Key Decisions

| Decision | Rationale | Outcome |
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

---
*Last updated: 2026-03-19 after v1.0 milestone*
