# Hatchin

## What This Is

Hatchin is the bridge between having an idea and making it real. Anyone — regardless of technical background — comes in with a dream, gets an instant team of AI specialists ("Hatches"), and just has a conversation. No prompting. No instructions. No starting from scratch. You talk, your team listens, understands, and helps you move forward. A designer gets better at design by working with the Designer Hatch. A founder gets their product built by talking to their Product, Engineer, and Marketing Hatches. The team knows your project, remembers your context, and grows with you.

Hatchin solves the prompting problem. Most people can't use AI effectively because they don't know how to prompt it. Hatchin removes that barrier entirely — users don't talk to a model, they talk to a team. The Hatches handle everything underneath. The user just has to show up with an idea.

## Core Value

No one should ever feel alone with their idea, have to start from scratch, or need to know how to prompt AI — just have a conversation and your team takes it from there.

## The Full Vision (where this is going)

### Autonomous Execution
The end state is a team that works while you sleep. Human conversation initiates and guides — but execution happens autonomously. Hatches hand off tasks to each other without being asked (Engineer picks up what the PM leaves, Designer gets looped in when UI decisions arise). Hatches police each other — quality gates, peer review, safety checks — all internally coordinated. The user wakes up to progress, not a blank canvas.

This autonomous foundation is already partially built (LangGraph state machine, peer review gates, task detection). The next layer is closing the loop: autonomous handover, background execution, and a Hatch that knows when to act vs when to ask.

### B2B: Company-Level Intelligence
When selling to companies, Hatchin is curated to that company's DNA — once. Brand guidelines, tone of voice, design system, product knowledge, company values — uploaded at the company level, not per-project. Every project inside that company inherits this automatically. A Sales Hatch already knows the product. A Designer Hatch already knows the brand. An Engineer Hatch already knows the stack.

The project brain is singular. No re-adding context. No onboarding every new project from scratch. The company's intelligence lives in Hatchin and every team member (human or Hatch) starts from a fully informed position.

### Collaboration
Future: multiple real humans working alongside their Hatch team in the same project. Real teammates and AI teammates in the same conversation — the Hatches serve the whole team, not just one person.

## Current Phase Focus

**Text-first, conversation-perfect.** Before image generation, before coding integration, before autonomy expansion — every Hatch must feel genuinely expert, contextually aware, and deeply present in conversation. When a user messages their Engineer Hatch about a performance issue, the response should feel like a senior engineer who knows the project, not a generic AI answer. This is the foundation everything else builds on.

**Build order:** Text quality → User journey → Avatar presence → Data reliability → Architecture → then: image gen, coding agent, autonomous execution loop, B2B company brain, collaboration.

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
- ✓ Animated SVG avatars — v1.0
- ✓ Project Brain (goals, direction, culture) — v1.0

### Active

- [ ] Hatch responses feel genuinely expert — domain-specific, not generic
- [ ] Each Hatch has contextual awareness of the full project (brain, direction, past decisions)
- [ ] Conversation memory works — Hatch remembers what was discussed, builds on it
- [ ] No prompting required — user says anything naturally, Hatch understands intent
- [ ] Create Project flow works end-to-end (currently broken)
- [ ] LandingPage at `/` communicates the vision compellingly
- [ ] Sidebar navigation works (auto-collapse/expand)
- [ ] Input never blocked while AI responds
- [ ] Agent bubble colors consistent across navigation
- [ ] Personality evolution persisted to database (survives restart)
- [ ] Message deduplication + pagination
- [ ] routes.ts modularized

### Out of Scope (this milestone)

- Image generation — text-first
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

**Known architecture debt:**
- `routes.ts` is 3,500+ lines (god file)
- Personality evolution stored in-memory (resets on restart)
- No message pagination (all messages load at once)
- LandingPage.tsx exists but not wired to router
- No message deduplication key

## Constraints

- **TypeScript strict mode**: All code must pass `npm run typecheck`
- **No raw SQL**: Always use Drizzle ORM in application code
- **Auth required**: All routes except `/auth` must check `req.session.userId`
- **Zod validation**: All API inputs validated with Zod schemas
- **Conversation quality**: Hatch responses must always pass tone guard

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Text-first, then multimodal | Perfect the conversation before adding complexity | — Pending |
| LangGraph for multi-agent routing | Extensible state machine, supports peer review, deliberation | ✓ Good |
| Gemini 2.5-Flash as primary LLM | Cost-effective, fast, sufficient quality for conversation | ✓ Good |
| Neon PostgreSQL serverless | Scales to zero, easy setup, right for MVP | ✓ Good |
| 26 named characters (not generic agents) | Personality-driven, memorable, builds attachment — Alex feels different from Dev | ✓ Good |
| Project Brain (JSONB) | Hatches always have full project context injected into prompt | ✓ Good |
| Anti-prompting as core design principle | Differentiator — not another AI chat tool | — Pending validation |

---
*Last updated: 2026-03-17 — Rewritten to capture full product vision*
