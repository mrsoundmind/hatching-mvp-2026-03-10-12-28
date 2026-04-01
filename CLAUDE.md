# CLAUDE.md — Hatchin MVP: Complete System Intelligence File

> **Purpose**: This file is the single source of truth for understanding, building, debugging, and scaling Hatchin. It is designed to be read by Claude Code at the start of every session to provide full context, prevent repeated mistakes, auto-detect issues, and make the best recommendations for every task.

---

## 0. WHAT IS HATCHIN?

Hatchin is an **AI-powered collaborative project execution platform**. Think of it as a team of AI colleagues ("Hatches") that live in your project, each with distinct roles, personalities, and expertise. Users interact with these AI agents via real-time chat, and the agents can:

- Have genuine, personality-driven conversations
- Detect and create tasks automatically from chat
- Route questions to the right specialist (engineer, designer, PM, etc.)
- Update the project "brain" (goals, direction, culture) based on discussions
- Learn user working styles over time
- Coordinate autonomously via multi-agent deliberation
- Execute tasks autonomously in the background and hand off work between specialists
- Self-review quality via peer review gates and progressive trust scoring

**Current Phase**: Post-v2.0 — production hardening + next milestone planning. v2.0 shipped (2026-03-30). v1.3 shipped (23/23). v1.2 shipped (16/16). v1.1 shipped (17/17). v1.0 shipped (31/31). Post-v1.1: World-class agent intelligence upgrade shipped (30 roles, 294 new tests). Smart Task Detection rewrite complete (7/7 phases).

**Latest Milestone**: v2.0 — Hatches That Deliver (shipped 2026-03-30). Cross-agent deliverable chains, artifact panel, PDF export, 15 deliverable types, 3 package templates (launch/content-sprint/research), organic detection, zero-friction onboarding.

**Previous Milestones**:
- v1.3 — Autonomy Visibility & Right Sidebar Revamp (shipped, 23/23 requirements). Tabbed right sidebar (Activity/Brain & Docs/Approvals), live autonomy feed, handoff visualization, agent working avatar state, approvals hub, task pipeline, project brain file upload, autonomy settings dial, work output viewer.
- v1.2 — Billing + LLM Intelligence (shipped 2026-03-23). Stripe monetization (Free/Pro tiers, $19/mo), smart LLM routing (Gemini Flash/Pro + Groq free tier), token tracking, usage capping, conversation compaction, reasoning cache, background task batching.

**Current Branch**: `main` (production).

### v1.1 — Autonomous Execution Loop

Before v1.1, Hatches could only talk. Now they can **work**.

- **Background Execution (EXEC-01–04):** Users tell a Hatch "go ahead and work on this" and it executes in the background via a durable job queue (pg-boss) — producing real output (plans, breakdowns, research). A per-project daily cost cap prevents runaway LLM spend. If a user goes idle for 2+ hours, queued work starts automatically.

- **Agent Handoffs (HAND-01–04):** When one Hatch finishes a task, the system routes the next task to the right specialist via `evaluateConductorDecision`. Hatches announce handoffs in character ("Done with the scope, tagging @Engineer"). BFS cycle detection prevents infinite loops. Each agent in the chain receives the previous agent's output as context.

- **Safety Gates (SAFE-01–04):** Three-tier safety system for autonomous execution:
  - Low-risk (< 0.35): auto-complete, no gates
  - Mid-risk (0.35–0.59): peer review by another Hatch before delivery (`runPeerReview`)
  - High-risk (≥ 0.60): blocked for user approval via inline approval card (Approve/Reject)
  - Progressive trust scoring: agents build trust through successful completions, gradually relaxing safety thresholds (up to +0.15 on peer review and clarification triggers)

- **User Experience (UX-01–05):** "Team is working..." indicator during execution. Inline approval cards for high-risk actions (one-click Approve/Reject). Browser tab badge when work completes in background. Maya delivers a return briefing summarizing completed work. Pause/cancel button to stop all autonomous execution.

**Key modules:**
- `server/autonomy/execution/taskExecutionPipeline.ts` — core execution with safety gates + peer review + trust scoring + role-aware escalation
- `server/autonomy/handoff/handoffOrchestrator.ts` — specialist routing + cycle detection + structured handoff context via `handoffProtocol`
- `server/autonomy/handoff/handoffAnnouncement.ts` — in-character handoff messages
- `server/autonomy/peerReview/peerReviewRunner.ts` — cross-agent peer review with role-specific `peerReviewLens`
- `server/autonomy/trustScoring/trustScorer.ts` — progressive trust calculation
- `server/autonomy/trustScoring/trustAdapter.ts` — trust-adjusted safety thresholds
- `server/autonomy/config/policies.ts` — budgets, cost caps, max hops
- `server/autonomy/events/eventLogger.ts` — autonomy event audit trail
- `client/src/components/AutonomousApprovalCard.tsx` — inline approval UI
- `shared/roleRegistry.ts` — 30 role definitions with deep personality (voice, pushback, collaboration, domain depth)
- `shared/roleIntelligence.ts` — 30 role intelligence profiles (reasoning, output standards, peer review lens, handoff protocol, escalation rules)
- `server/ai/openaiService.ts` — injects PROFESSIONAL DEPTH + DOMAIN INTELLIGENCE sections into LLM prompt
- `server/ai/personalityEvolution.ts` — dynamic `resolveBaseTraits()` from roleIntelligence (replaces hardcoded defaults)

### v1.2 — Billing + LLM Intelligence (shipped 2026-03-23)

Stripe billing (Free $0 / Pro $19/mo), smart LLM model routing, token tracking, usage capping, and 35-50% cost optimization. Existing users get 15-day Pro grace period on launch.

**7 phases:** Groq Eval → Token Tracking + Schema → Smart LLM Routing → Tier Gating → Stripe Integration → Frontend Billing UI → Deep Cost Optimization

**Tier structure:**
| | Free ("Hatcher") | Pro ($19/mo or $190/yr) |
|---|---|---|
| Chat messages | Unlimited* | Unlimited |
| Projects | 3 | Unlimited |
| Agents | All 30 | All 30 |
| Model | Gemini Pro (same quality) | Gemini Pro |
| Autonomy | Disabled | Full (50 exec/day) |

*Invisible safety cap: 500/day + 15 msgs/min rate limit. No counter shown. 99% of users never hit it.

**LLM routing (actual):**
- Simple messages → Groq llama-3.3-70b (FREE) → fallback → Gemini Pro
- Standard/Complex chat → Gemini Pro (all users, same quality)
- Task extraction → Groq (FREE) → fallback → Gemini Pro
- Conversation compaction → Groq (FREE)
- Autonomy tasks → Gemini Pro (Pro users only)

**Key modules:**
- `server/billing/usageTracker.ts` — token usage recording + daily aggregation + cost calculation
- `server/billing/stripeClient.ts` — Stripe SDK initialization (gracefully disabled without keys)
- `server/billing/checkoutService.ts` — Stripe Checkout + Customer Portal session creation
- `server/billing/webhookHandler.ts` — Stripe webhook handling with idempotency (4 event types)
- `server/routes/billing.ts` — billing API routes (status, checkout, portal, webhook)
- `server/middleware/tierGate.ts` — Free/Pro enforcement with kill switch (`FEATURE_BILLING_GATES`)
- `server/ai/taskComplexityClassifier.ts` — heuristic message complexity for adaptive maxTokens
- `server/ai/conversationCompactor.ts` — context compaction via Groq (feature-flagged: `FEATURE_CONVERSATION_COMPACTION`)
- `server/ai/reasoningCache.ts` — reasoning pattern cache (in-memory, 1hr TTL, project-scoped)
- `client/src/components/UpgradeModal.tsx` — upgrade prompt with Free vs Pro comparison
- `client/src/components/UsageBar.tsx` — usage progress bar in chat header
- `client/src/pages/AccountPage.tsx` — account + billing dashboard at `/account`

**Audit:** `.planning/v1.2-MILESTONE-AUDIT.md` — 16/16 requirements, 8/8 E2E flows verified

### v1.3 — Autonomy Visibility & Right Sidebar Revamp (shipped, 23/23 requirements)

The autonomy backend (v1.1) is powerful but invisible. v1.3 makes it visible and controllable.

- **Right Sidebar Revamp (SIDE-01–04):** Tabbed layout — Activity / Tasks / Brain. CSS-hide inactive tabs (preserves scroll/draft state). Badge counts for unread events and pending approvals. Mobile-responsive via Sheet drawer.

- **Live Activity Feed (FEED-01–05):** Real-time feed of autonomy events with agent avatars and timestamps. Stats summary card (tasks completed, handoffs, cost). Filter chips by event type, agent, or time range. Event aggregation prevents flooding. Compelling empty state.

- **Handoff Visualization (HAND-01–04):** Chat handoff cards (from-agent → to-agent + task title). Sidebar handoff chain timeline with animated connectors. "Hand off to..." dropdown button. Deliberation indicator card.

- **Agent Status (AGNT-01):** Avatar "working" state — pulsing/rotating animation during background execution.

- **Approvals Hub (APPR-01–04):** One-click approve/reject. Task pipeline view (5 stages). Approval expiry handling. Empty state.

- **Brain Redesign (BRAIN-01–04):** PDF/DOCX/TXT/MD file upload via drag-and-drop (10MB max). Card-based knowledge base with type badges. 4-level autonomy dial (Observe/Propose/Confirm/Autonomous). Work output viewer.

- **Polish (PLSH-01):** Premium design tokens and animations across all components.

**Key modules (v1.3):**
- `client/src/components/sidebar/` — SidebarTabBar, ActivityTab, ActivityFeedItem, AutonomyStatsCard, FeedFilters, EmptyState, HandoffChainTimeline, ApprovalsTab, ApprovalItem, TaskPipelineView, BrainDocsTab, DocumentUploadZone, DocumentCard, AutonomySettingsPanel, WorkOutputSection, TasksTab
- `client/src/components/chat/` — HandoffCard, DeliberationCard
- `client/src/hooks/` — useAutonomyFeed, useSidebarEvent, useAgentWorkingState
- `server/lib/extractDocumentText.ts` — PDF/DOCX/TXT/MD text extraction

### v2.0 — Hatches That Deliver (shipped 2026-03-30)

Transforms Hatchin from "AI chatroom" to "AI team that ships coordinated work."

- **Deliverable System:** 15 deliverable types with role-to-type mapping and canonical section schemas. Streaming generation via Groq. Version history with restore. Iterate by section.

- **Cross-Agent Chains:** Upstream context injection, handoff orchestration, stale reference detection. 3 package templates: launch, content-sprint, research.

- **Artifact Panel:** Right-side split panel with markdown rendering, version navigation, refine input. Inline DeliverableChatCard in conversation.

- **Professional Export:** Branded PDF with table of contents, attribution, and Hatchin branding.

- **Organic Detection:** Regex-based intent detection from conversation, conservative thresholds, ProposalCard accept/dismiss UX.

**Key modules (v2.0):**
- `shared/schema.ts` — deliverables, deliverableVersions, deliverablePackages tables
- `shared/deliverableTypes.ts` — 15 types with role mapping + section schemas
- `server/routes/deliverables.ts` — 13 API endpoints (CRUD, generate, iterate, download, versions, packages)
- `server/ai/deliverableGenerator.ts` — Groq-based streaming generation
- `server/ai/deliverableDetector.ts` — Organic intent detection
- `server/ai/deliverableChainOrchestrator.ts` — Cross-agent chain coordination
- `server/ai/pdfExport.ts` — Branded PDF export
- `client/src/components/ArtifactPanel.tsx` — Split-panel viewer
- `client/src/components/DeliverableChatCard.tsx` — Inline deliverable in chat
- `client/src/components/PackageProgress.tsx` — Package progress tracking

### Smart Task Detection Rewrite (shipped 2026-03-31, 7/7 phases)

Replaced broken task detection with intent-classified pipeline. Zero-LLM pattern-based gating, Groq free tier for organic extraction.

- **Intent Classifier:** 5 intent types (EXPLICIT_TASK_REQUEST, USER_DELEGATION, TASK_LIFECYCLE_COMMAND, ORGANIC_CANDIDATE, NO_TASK_INTENT). Zero LLM cost.
- **Lifecycle Commands:** Status/priority/assignee updates, delete, query, filtered_query, progress. Fuzzy task matching.
- **Organic Extraction:** Groq-based, 30s cooldown, Jaccard duplicate detection (≥ 0.7).
- **Agent Awareness:** Assigned tasks injected into agent prompts with overdue warnings. Completion detection from agent responses.

**Key modules:**
- `server/ai/tasks/` — intentClassifier, taskCreator, taskLifecycle, organicExtractor, duplicateDetector, completionDetector

---

## 1. TECH STACK (CANONICAL)

### Frontend
| Concern | Library | Version | Notes |
|---------|---------|---------|-------|
| Framework | React | 18.3.1 | Functional components only |
| Router | Wouter | 3.3.5 | Lightweight, NOT React Router |
| Server state | TanStack React Query | 5.60.5 | Use for ALL server data |
| UI Components | Shadcn + Radix UI | 1.1-2.1 | Accessible primitives |
| Styling | Tailwind CSS | 3.4.17 | Utility-first, no inline styles |
| Animations | Framer Motion | 11.13.1 | GPU-accelerated, use wisely |
| Rich Text | React Markdown + GFM | 10.1.0 | For agent message rendering |
| Forms | React Hook Form + Zod | 7.55.0 | Zod for schema, RHF for state |
| Charts | Recharts | 2.15.2 | For analytics/progress views |
| Icons | Lucide React | 0.453.0 | Primary icon set |
| Build | Vite | 5.4.19 | HMR in dev, fast prod builds |

### Backend
| Concern | Library | Version | Notes |
|---------|---------|---------|-------|
| Server | Express | 4.21.2 | With Helmet security middleware |
| Database ORM | Drizzle ORM | 0.39.1 | Type-safe, migration-based |
| Database | PostgreSQL (Neon) | serverless | `@neondatabase/serverless` |
| LLM Primary | Google Gemini 2.5-Flash | — | `@google/generative-ai` 0.24.1 |
| LLM Fallback | OpenAI GPT-4o-mini | — | `openai` 5.21.0 |
| LLM Local | Ollama (llama3.1:8b) | — | Testing only |
| AI Orchestration | LangChain + LangGraph | 0.3.74 + 0.4.9 | Multi-agent state machine |
| Auth | OpenID Connect (Google) | — | `openid-client` 6.6.2 + PKCE |
| Session | express-session + pg-store | — | PostgreSQL-backed, 7-day TTL |
| Real-time | WebSocket (ws) | 8.18.0 | Streaming, typing, events |
| Validation | Zod | 3.24.2 | All inputs must be validated |
| Security | Helmet + CORS + rate-limit | — | Always on in production |
| Monitoring | LangSmith | — | Optional LLM tracing |
| TypeScript | 5.6.3 | strict mode | All code must pass typecheck |

---

## 2. PROJECT STRUCTURE

```
hatching-mvp-5th-march/
├── client/src/
│   ├── App.tsx                   # Router: /, /login, /onboarding, /maya/:id, /404
│   ├── pages/
│   │   ├── home.tsx              # Main layout: LeftSidebar + CenterPanel + RightSidebar + mobile Sheet drawers
│   │   ├── MayaChat.tsx          # Project-level Maya AI chat
│   │   ├── login.tsx             # Google OAuth login (animated gradient background)
│   │   ├── LandingPage.tsx       # Public landing page (wired at / for logged-out users)
│   │   ├── onboarding.tsx        # Post-signup onboarding flow
│   │   └── not-found.tsx         # 404
│   ├── components/
│   │   ├── LeftSidebar.tsx       # Project/team/agent tree + navigation
│   │   ├── CenterPanel.tsx       # Chat interface (messages, streaming, input)
│   │   ├── RightSidebar.tsx      # Project metadata editor (brain, direction, culture)
│   │   ├── MessageBubble.tsx     # Message rendering (user/agent/system)
│   │   ├── ProjectTree.tsx       # Hierarchical project browser
│   │   ├── TaskApprovalModal.tsx  # AI task approval flow (used by CenterPanel)
│   │   ├── AddHatchModal.tsx     # Create agent modal
│   │   ├── WelcomeModal.tsx      # First-time onboarding (egg animation)
│   │   ├── QuickStartModal.tsx   # Quick project creation
│   │   ├── StarterPacksModal.tsx # Template selection
│   │   ├── OnboardingSteps.tsx   # Step-by-step onboarding UI
│   │   ├── ArtifactPanel.tsx      # Deliverable viewer (v2.0)
│   │   ├── EggHatchingAnimation.tsx # Animated egg 🥚 loading state
│   │   ├── ErrorFallbacks.tsx    # AppErrorFallback + PanelErrorFallback components
│   │   ├── AutonomousApprovalCard.tsx # Inline approval UI for high-risk actions
│   │   └── ui/                   # Shadcn primitives (never modify directly)
│   ├── hooks/
│   │   ├── useAuth.ts            # Session + user auth state
│   │   ├── useRealTimeUpdates.ts # WebSocket listener hook
│   │   ├── useRightSidebarState.ts # Sidebar expansion state (localStorage)
│   │   └── useThreadNavigation.ts  # Message threading
│   ├── lib/
│   │   ├── queryClient.ts        # TanStack Query config
│   │   ├── websocket.ts          # WS hook: connect, reconnect, send
│   │   ├── chatMode.ts           # Chat mode utilities
│   │   ├── conversationId.ts     # Parse/build conversation IDs
│   │   ├── devLog.ts             # Dev-only console logs
│   │   └── utils.ts              # cn(), date helpers, etc.
│   └── devtools/
│       └── autonomyDashboard/    # Debug UI for autonomy events
│
├── server/
│   ├── index.ts                  # App entrypoint: middleware, session, CORS, WS attach
│   ├── routes.ts                 # ~430 lines: thin orchestrator (imports + registers route modules)
│   ├── storage.ts                # ~1,500+ lines: IStorage interface + MemStorage + DatabaseStorage
│   ├── db.ts                     # Neon PostgreSQL connection (pool)
│   ├── vite.ts                   # Vite dev server middleware integration
│   ├── ai/
│   │   ├── promptTemplate.ts     # Dynamic system prompt builder
│   │   ├── openaiService.ts      # Streaming LLM response generator
│   │   ├── graph.ts              # LangGraph state machine (router + hatch nodes)
│   │   ├── conductor.ts          # Multi-agent routing + decision authority
│   │   ├── safety.ts             # Risk scoring + intervention gates
│   │   ├── forecast.ts           # Decision outcome prediction
│   │   ├── expertiseMatching.ts  # Agent specialty scoring
│   │   ├── tasks/                # Smart Task Detection pipeline (intentClassifier, organicExtractor, etc.)
│   │   ├── personalityEvolution.ts # Agent learning from feedback
│   │   ├── trainingSystem.ts     # Feedback collection for training
│   │   ├── colleagueLogic.ts     # Role-specific response logic
│   │   ├── roleProfiles.ts       # Role → RoleProfile (expertise, toolkit, domain depth, critical thinking)
│   │   ├── characterProfiles.ts  # Role → CharacterProfile (voice, negative handling, collaboration style)
│   │   ├── actionParser.ts       # Parse [[ACTION]] blocks from responses
│   │   ├── mentionParser.ts      # Parse @agent and /route commands
│   │   └── responsePostProcessing.ts # Tone guard + response validation
│   ├── llm/
│   │   ├── providerResolver.ts   # Multi-provider fallback chain
│   │   ├── providerTypes.ts      # LLM interface definitions
│   │   └── providers/
│   │       ├── geminiProvider.ts # Gemini 2.5-Flash (PRIMARY)
│   │       ├── openaiProvider.ts # GPT-4o-mini (FALLBACK)
│   │       ├── groqProvider.ts  # Groq llama-3.3-70b (FREE tier)
│   │       ├── ollamaProvider.ts # Local testing
│   │       └── mockProvider.ts   # CI/unit tests
│   ├── autonomy/
│   │   ├── config/policies.ts    # Budgets, constraints, runtime modes
│   │   ├── conductor/            # Decision authority resolver
│   │   ├── events/eventLogger.ts # Autonomy event tracking
│   │   ├── integrity/            # Message ordering + idempotency
│   │   ├── peerReview/           # Cross-agent peer review
│   │   ├── taskGraph/            # Task dependency engine
│   │   └── traces/               # Deliberation trace storage
│   ├── auth/
│   │   └── googleOAuth.ts        # Google OAuth 2.0 + PKCE implementation
│   ├── orchestration/
│   │   ├── resolveSpeakingAuthority/ # Who responds in multi-agent chat
│   │   └── agentAvailability/    # Filter available agents per context
│   ├── knowledge/akl/            # Autonomous knowledge loop
│   ├── tools/
│   │   ├── toolRouter.ts         # Route requests to tools
│   │   └── cache/                # Tool result caching
│   ├── routes/
│   │   ├── health.ts             # GET /api/health
│   │   ├── autonomy.ts           # Autonomy event routes
│   │   ├── teams.ts              # /api/teams* CRUD (registerTeamRoutes)
│   │   ├── agents.ts             # /api/agents* CRUD (registerAgentRoutes)
│   │   ├── messages.ts           # /api/conversations*, /api/messages*, /api/training/feedback
│   │   ├── projects.ts           # /api/projects* + brain endpoints (RegisterProjectDeps)
│   │   ├── tasks.ts              # /api/tasks* + task-suggestions (RegisterTaskDeps)
│   │   └── chat.ts               # WS server, streaming handler, /api/hatch/chat (~2,878 lines)
│   ├── invariants/
│   │   └── assertPhase1.ts       # Phase 1 correctness assertions
│   ├── utils/configSnapshot.ts   # Config logging on startup
│   └── schemas/messageIngress.ts # Inbound message validation schema
│
├── shared/
│   ├── schema.ts                 # Drizzle ORM schema (ALL tables)
│   ├── roleRegistry.ts           # 30 role definitions: personality, voice, expertise, pushback, collaboration
│   ├── roleIntelligence.ts       # 30 role intelligence: reasoning, peer review lens, handoff protocol, escalation
│   ├── conversationId.ts         # Canonical conversation ID format
│   ├── templates.ts              # Starter pack definitions
│   └── dto/
│       ├── wsSchemas.ts          # WebSocket message type definitions
│       ├── apiSchemas.ts         # REST request/response schemas
│       └── errors.ts             # Typed error definitions
│
├── migrations/
│   ├── 0000_slim_weapon_omega.sql   # Full initial schema
│   └── 0001_opposite_killmonger.sql # Autonomy tables
│
├── scripts/                      # 40+ test/eval/gate scripts
├── baseline/                     # Test baseline data
├── eval/                         # Evaluation results
├── package.json                  # Monorepo dependencies
├── tsconfig.json                 # TypeScript (strict mode)
├── vite.config.ts                # Vite + path aliases
├── drizzle.config.ts             # Drizzle migration config
└── tailwind.config.ts            # Tailwind + custom tokens
```

---

## 3. ENVIRONMENT VARIABLES

### Required (app will crash without these)
```bash
DATABASE_URL=postgresql://user:pass@*.neon.tech/db?sslmode=require
SESSION_SECRET=<strong-random-secret-min-32-chars>
GEMINI_API_KEY=AIzaSy...
GOOGLE_CLIENT_ID=681006596933-....apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
```

### Important Optional
```bash
NODE_ENV=development|production          # Affects security settings
GEMINI_MODEL=gemini-2.5-flash           # Default: gemini-2.5-flash
OPENAI_API_KEY=sk-...                   # Fallback provider
OPENAI_MODEL=gpt-4o-mini               # Default: gpt-4o-mini
LLM_MODE=prod|test                      # Switch provider chain
TEST_LLM_PROVIDER=openai|ollama|mock   # Used when LLM_MODE=test
TEST_OLLAMA_BASE_URL=http://localhost:11434
TEST_OLLAMA_MODEL=llama3.1:8b
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:5001/api/auth/google/callback
APP_BASE_URL=http://localhost:5001
ALLOWED_ORIGIN=http://localhost:5001
LANGSMITH_API_KEY=ls_...               # Optional LLM tracing
LANGSMITH_PROJECT=hatchin-chat
STORAGE_MODE=db|memory                 # db = PostgreSQL, memory = MemStorage

# v1.2 Billing & LLM Optimization
GROQ_API_KEY=gsk_...                   # Free tier at console.groq.com
GEMINI_PRO_MODEL=gemini-2.5-pro       # Premium model for autonomy (Pro users)
STRIPE_SECRET_KEY=sk_...               # Stripe billing
STRIPE_WEBHOOK_SECRET=whsec_...        # Stripe webhook signature
STRIPE_PRO_MONTHLY_PRICE_ID=price_...  # Stripe price ID
STRIPE_PRO_ANNUAL_PRICE_ID=price_...   # Stripe annual price ID
FEATURE_BILLING_GATES=true|false       # Kill switch for tier gating (default: true in prod)
FEATURE_CONVERSATION_COMPACTION=false  # Context compaction (default: off)
```

> **RULE**: Never hardcode secrets. Never commit `.env`. Always read from `process.env`.

---

## 4. DATABASE SCHEMA (COMPLETE)

> Schema file: `shared/schema.ts` — ALWAYS use Drizzle ORM, never raw SQL in application code.

### Tables Overview

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `users` | OAuth user accounts | `id`, `email`, `provider_sub`, `name`, `avatar_url` |
| `projects` | Top-level workspaces | `id`, `user_id`, `name`, `emoji`, `coreDirection`, `brain`, `executionRules` |
| `teams` | Agent groups within a project | `id`, `project_id`, `user_id`, `name`, `emoji` |
| `agents` | AI team members ("Hatches") | `id`, `project_id`, `team_id`, `name`, `role`, `personality`, `is_special_agent` |
| `conversations` | Chat thread containers | `id` (canonical string), `project_id`, `team_id`, `agent_id`, `type` |
| `messages` | Individual chat messages | `id`, `conversation_id`, `content`, `messageType`, `agent_id`, `user_id`, `metadata` |
| `message_reactions` | Thumbs up/down feedback | `message_id`, `user_id`, `reaction_type`, `agent_id`, `feedbackData` |
| `conversation_memory` | Shared memory within chats | `conversation_id`, `memory_type`, `content`, `importance` |
| `tasks` | Project tasks | `id`, `project_id`, `title`, `status`, `priority`, `assignee`, `parent_task_id` |
| `typing_indicators` | Real-time presence | `conversation_id`, `agent_id`, `expires_at` |
| `autonomy_events` | Autonomy event audit trail | `trace_id`, `event_type`, `payload`, `risk_score`, `confidence` |
| `deliberation_traces` | Multi-agent deliberation | `trace_id` (UNIQUE), `objective`, `rounds`, `review`, `final_synthesis` |

### Conversation ID Format (CRITICAL)
```
project:{projectId}          → Project-level chat (all agents)
team:{projectId}:{teamId}    → Team-level chat (team agents)
agent:{projectId}:{agentId}  → 1-on-1 with specific agent
```
> The canonical parser is in `shared/conversationId.ts`. Never construct these strings manually elsewhere.

### Key Schema Rules
- All IDs are UUIDs generated by `gen_random_uuid()` (PostgreSQL) or `crypto.randomUUID()` (JS)
- `projects.coreDirection` is JSONB: `{whatBuilding, whyMatters, whoFor}`
- `projects.brain` is JSONB: `{documents: [], sharedMemory: string}`
- `agents.personality` is JSONB: `{traits[], communicationStyle, expertise[], welcomeMessage}`
- `messages.metadata` is JSONB: `{isStreaming, typingDuration, responseTime, personality, mentions[], replyTo}`
- `tasks.parent_task_id` self-references `tasks.id` for hierarchical tasks
- `autonomy_events` uses `deliberation_traces.trace_id` as UNIQUE constraint

---

## 5. API ROUTES (COMPLETE REFERENCE)

### Auth
```
GET  /api/auth/me                          → {user} | 401
GET  /api/auth/google/start                → redirect to Google OAuth
GET  /api/auth/google/callback             → OAuth callback, creates session
POST /api/auth/logout                      → clears session
```

### Projects
```
GET    /api/projects                       → Project[]
GET    /api/projects/:id                   → Project | 404
POST   /api/projects                       → {name, emoji, description} → Project
PUT    /api/projects/:id                   → full update
PATCH  /api/projects/:id                   → partial update (used by RightSidebar)
DELETE /api/projects/:id                   → 204

POST   /api/projects/:id/brain/documents   → add brain document
PATCH  /api/projects/:id/brain             → update shared memory
```

### Teams
```
GET    /api/teams                          → Team[]
GET    /api/projects/:projectId/teams      → Team[] for project
POST   /api/teams                          → {name, emoji, project_id} → Team
PUT    /api/teams/:id                      → full update
PATCH  /api/teams/:id                      → partial update
DELETE /api/teams/:id                      → 204
```

### Agents ("Hatches")
```
GET    /api/agents                         → Agent[]
GET    /api/projects/:projectId/agents     → Agent[] for project
GET    /api/teams/:teamId/agents           → Agent[] for team
POST   /api/agents                         → {name, role, team_id, project_id} → Agent
PUT    /api/agents/:id                     → full update
PATCH  /api/agents/:id                     → partial update
DELETE /api/agents/:id                     → 204
```

### Conversations
```
GET    /api/conversations/:projectId       → Conversation[]
POST   /api/conversations                  → Conversation
DELETE /api/conversations/:id              → 204
PUT    /api/conversations/:id/archive      → archive
PUT    /api/conversations/:id/unarchive    → unarchive
GET    /api/projects/:projectId/conversations/archived → Conversation[]
```

### Messages
```
GET    /api/conversations/:conversationId/messages  → Message[] (paginated)
POST   /api/conversations/:conversationId/messages  → Message
POST   /api/messages                               → Message[] (bulk)
POST   /api/messages/:messageId/reactions          → MessageReaction
GET    /api/messages/:messageId/reactions          → MessageReaction[]
```

### AI
```
POST   /api/hatch/chat                     → LangGraph chat (non-streaming fallback)
POST   /api/training/feedback              → store feedback for agent training
```

### Billing (v1.2)
```
POST   /api/billing/checkout               → Stripe Checkout Session URL
POST   /api/billing/portal                 → Stripe Customer Portal URL
GET    /api/billing/status                 → subscription + usage summary (works without Stripe)
POST   /api/billing/webhook               → Stripe webhook (no auth, raw body, sig verified)
```

### System
```
GET    /api/health                         → {status, wsConnections, ...}
GET    /api/system/storage-status          → dev only: shows storage mode
```

> **All routes except /auth and /billing/webhook require a valid session (`req.session.userId`). Return 401 if missing.**

---

## 6. WEBSOCKET EVENTS (COMPLETE REFERENCE)

### Connection
```
Client connects to: ws://host/ws  (upgraded from HTTP)
```

### Client → Server (Inbound)
```typescript
{ type: 'join_conversation', conversationId: string }

{ type: 'send_message', conversationId: string, message: {
    content: string, userId?: string, messageType?: string, metadata?: object
}}

{ type: 'send_message_streaming', conversationId: string, message: {
    content: string, ...
}, addressedAgentId?: string, metadata?: object }

{ type: 'start_typing' | 'stop_typing', conversationId: string,
  agentId: string, estimatedDuration?: number }

{ type: 'cancel_streaming', messageId?: string, conversationId?: string }
```

### Server → Client (Outbound)
```typescript
{ type: 'connection_confirmed', conversationId: string }
{ type: 'new_message' | 'chat_message', conversationId?: string, message: Message }

// Streaming lifecycle
{ type: 'streaming_started', messageId: string, agentId?: string, agentName?: string }
{ type: 'streaming_chunk', messageId: string, chunk: string, accumulatedContent?: string }
{ type: 'streaming_completed', messageId: string, message: Message }
{ type: 'streaming_cancelled', messageId: string }
{ type: 'streaming_error', messageId: string, code: string, error: string }

// Presence
{ type: 'typing_started' | 'typing_stopped', ...metadata }

// Intelligence events
{ type: 'conductor_decision', ...routingMetadata }
{ type: 'safety_intervention' | 'peer_review_revision', ...details }
{ type: 'task_suggestions', tasks: TaskSuggestion[] }
{ type: 'task_created', task: Task }
{ type: 'teams_auto_hatched', projectId: string, teams: Team[], agents: Agent[] }
{ type: 'brain_updated_from_chat', projectId: string, field: string, value: string }
{ type: 'project_created', project: Project, userId: string }

// Billing (v1.2)
{ type: 'upgrade_required', reason: string, currentUsage: number, limit: number, upgradeUrl: string }
{ type: 'usage_warning', reason: 'approaching_limit', currentUsage: number, limit: number, percentUsed: number }

// Errors
{ type: 'error', code: string, message: string, details?: object, correlationId?: string }
```

---

## 7. AI SYSTEM ARCHITECTURE

### LLM Provider Chain
```
Production (v1.2 — shipped, final routing):
  Simple messages         → Groq llama-3.3-70b (FREE) → [fallback] → Gemini Pro
  Standard/Complex chat   → Gemini 2.5-Pro (all users, same quality)
  Task extraction         → Groq llama-3.3-70b (FREE) → [fallback] → Gemini Pro
  Conversation compaction → Groq (FREE)
  Autonomy tasks          → Gemini 2.5-Pro (Pro users only)

Test Mode (LLM_MODE=test):
  TEST_LLM_PROVIDER=openai  → GPT-4o-mini
  TEST_LLM_PROVIDER=ollama  → Ollama llama3.1:8b
  TEST_LLM_PROVIDER=mock    → Mock (deterministic, zero-cost)
  default                   → Mock
```

### Core AI Flow (Per Message)
```
1. WebSocket: receive send_message_streaming
2. Parse mentions/routes (@engineer, /route backend)
3. Conductor: resolve which agent(s) should respond
   - Project-level chat: Maya (isSpecialAgent) has priority, then PM fallback
   - resolveSpeakingAuthority.ts also prioritizes Maya for project scope
4. Safety gate: score risk (hallucination, scope, execution)
   - Explicit creation intents ("create a team", "add a task") get reduced baselines (0.05)
   - risk >= 0.70: block + request clarification (clarificationRequiredRisk)
   - risk >= 0.35: peer review required (peerReviewTrigger)
5. LangGraph state machine:
   - router_node: detect role from keywords/explicit mentions
   - hatch_node: inject personality prompt + call LLM + validate tone
6. Stream response chunks via WebSocket (streaming_chunk events)
7. Tone post-processing: enforce no markdown headers, no bullet lists
8. Task detection: scan response + user msg for implied tasks
9. Brain updates: detect if project direction was clarified
10. Store message in DB
11. Emit streaming_completed
```

### Agent Roles — World-Class Intelligence System (30 roles)

Two-file architecture designed for 200+ roles:
- **`shared/roleRegistry.ts`** — Identity/personality: `voicePrompt`, `negativeHandling`, `criticalThinking`, `collaborationStyle`, `domainDepth` for each role
- **`shared/roleIntelligence.ts`** — Expertise/autonomy: `reasoningPattern`, `outputStandards`, `peerReviewLens`, `handoffProtocol`, `escalationRules`, `baseTraitDefaults` for each role

Adding role #31+ requires only adding entries to these two arrays — no other code changes.

**LLM prompt injection** (in `openaiService.ts`): Two sections injected after CHARACTER VOICE:
- `PROFESSIONAL DEPTH` — domain depth, critical thinking, pushback style, collaboration style
- `DOMAIN INTELLIGENCE` — reasoning pattern, output standards

**30 roles (character names):**
Product Manager (Alex), Business Analyst (Morgan), Backend Developer (Dev), Software Engineer (Coda), Technical Lead (Jordan), AI Developer (Nyx), DevOps Engineer (Remy), Product Designer (Cleo), UX Designer (Lumi), UI Engineer (Finn), UI Designer (Arlo), Designer (Roux), Creative Director (Zara), Brand Strategist (Cass), QA Lead (Sam), Content Writer (Mira), Copywriter (Wren), Growth Marketer (Kai), Marketing Specialist (Nova), Social Media Manager (Pixel), SEO Specialist (Robin), Email Specialist (Drew), Data Analyst (Rio), Data Scientist (Sage), Operations Manager (Quinn), Business Strategist (Blake), HR Specialist (Taylor), Instructional Designer (Lee), Audio Editor (Vince), Maya (Idea Partner)

**Maya (Idea Partner) — special agent rules:**
- `isSpecialAgent: true` — marks Maya as the project-level intelligence, not a regular team member
- **Hidden from sidebar**: `ProjectTree.tsx` filters `!a.isSpecialAgent` on both team and individual agent lists
- **Routing priority**: Conductor and resolveSpeakingAuthority both route project-level chat to Maya first, PM Alex second
- **Welcome message**: `server/routes/projects.ts` inserts Maya's greeting on project creation (idea + starter pack variants)
- **No 1-on-1 conversation**: Maya speaks at project level only — no `agent:{projectId}:{mayaId}` conversation created

**Autonomy integration:**
- Peer review uses each reviewer's `peerReviewLens` for domain-specific checks (7 categories: engineering, design, data, strategy, marketing, QA, ops)
- Handoffs use `handoffProtocol.passes` / `handoffProtocol.receives` for structured context
- Escalation thresholds adjusted per role via `getRoleRiskMultiplier()` (infra roles escalate sooner, creative roles get more autonomy)
- Personality evolution uses `baseTraitDefaults` from roleIntelligence instead of hardcoded defaults

### Prompt Rules (CRITICAL — enforce always)
```
✓ No markdown headers (#, ##) in chat responses
✓ No bullet point lists — weave into natural sentences
✓ Maximum 1 question per reply
✓ Natural endings — NOT "Next step:" or "Let me know how..."
✓ Match user's message length (short message → short reply)
✓ Show genuine reactions and curiosity
✓ Never start with "Great!" or sycophantic openers
✓ Human-like, colleague tone — not assistant tone
```

### Action Blocks (parsed from agent responses)
```
[[PROJECT_NAME: My Project]]     → update project name
[[TASK: description]]            → create task suggestion
[[UPDATE: field: value]]         → update brain field
```

---

## 8. AUTHENTICATION FLOW

```
1. User hits /login → clicks "Sign in with Google"
2. GET /api/auth/google/start
   → generates: state, nonce, codeVerifier, codeChallenge
   → stores in session
   → redirects to Google auth URL
3. User consents on Google
4. GET /api/auth/google/callback?code=...&state=...
   → validates state, nonce, code
   → exchanges code + codeVerifier for tokens
   → extracts: sub, email, name, picture
   → upsertOAuthUser() → creates or updates user
   → regenerates session ID (anti-fixation)
   → sets req.session.userId
   → redirects to / or returnTo
5. All protected routes check req.session.userId → 401 if missing
6. POST /api/auth/logout → destroys session
```

**Session Config**: PostgreSQL store, 7-day TTL, httpOnly, secure (prod), sameSite: lax.

---

## 9. STATE MANAGEMENT PATTERNS

### Frontend — Use TanStack Query for ALL server data
```typescript
// Fetching
const { data: projects } = useQuery({ queryKey: ['/api/projects'] });

// Mutations with cache invalidation
const mutation = useMutation({
  mutationFn: (data) => fetch('/api/projects', { method: 'POST', body: JSON.stringify(data) }),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/projects'] })
});
```

### Frontend — WebSocket real-time state
```typescript
// Use useRealTimeUpdates hook — never create raw WebSocket in components
const { sendMessage } = useWebSocket(conversationId);
```

### Frontend — Persistent client state (localStorage)
- Active project/team/agent selection
- Sidebar expanded/collapsed states
- User preferences
> Use `useRightSidebarState` hook pattern — never access localStorage directly in components.

### Backend — Storage abstraction
```typescript
// ALWAYS use storage interface, never direct DB calls in routes
const project = await storage.getProject(projectId);
const message = await storage.createMessage(insertMessage);
```

---

## 10. BUILD & DEVELOPMENT COMMANDS

```bash
# Development
npm run dev              # Start full dev server (Vite HMR + Express) on port 5001

# Production build
npm run build            # Compile client (Vite → dist/public) + server (esbuild → dist/index.js)
npm run start            # Serve production build

# Type checking
npm run typecheck        # Full TypeScript check (no emit)
npm run lint             # Alias for typecheck

# Database
npm run db:push          # Apply schema changes to database (Drizzle push)

# Full QA
npm run qa:full          # lint + typecheck + build (run before merging)

# Tests & Evaluations
npm run test:dto         # DTO contract validation
npm run test:integrity   # Message ordering integrity
npm run test:memory      # Persistence tests
npm run test:tone        # Agent tone guard tests
npm run test:injection   # Prompt injection safety
npm run gate:safety      # Safety threshold gates
npm run gate:conductor   # Conductor routing validation
npm run gate:performance # Latency benchmarks
npm run eval:routing     # Agent routing accuracy
npm run eval:bench       # Full LLM benchmark
npm run eval:alive       # System liveness

# Agent Intelligence Tests (294 tests)
npm run test:voice       # Voice distinctiveness — unique names, Jaccard similarity, field coverage (8 tests)
npm run test:pushback    # Agent pushback — negativeHandling populated, domain-relevant, no duplicates (46 tests)
npm run test:reasoning   # Reasoning patterns — all roleIntelligence fields valid for 30 roles (240 tests)

# Unified Benchmark Suite (14 metric sections, graded A-F)
npm run benchmark        # Run all evals + DB metrics (works without LLM keys)
npm run benchmark:report # Generate markdown report from latest result
npm run benchmark:full   # Run benchmark + generate report in one command
```

---

## 11. ERROR DETECTION GUIDE

### Common Errors & How to Fix Them

#### 1. `Cannot find session userId` / 401 on all requests
- **Cause**: Missing `SESSION_SECRET`, session store connection failed, or cookies blocked
- **Fix**: Check `SESSION_SECRET` in `.env`. Check `DATABASE_URL` is reachable. In local dev, ensure `http://localhost:5001` matches `APP_BASE_URL`.

#### 2. LLM response is empty / `streaming_error`
- **Cause**: Missing or invalid `GEMINI_API_KEY` or `OPENAI_API_KEY`, quota exceeded
- **Fix**: Verify API keys. Check `LLM_MODE` env var. Try `LLM_MODE=test TEST_LLM_PROVIDER=mock` to isolate.
- **Detection**: Check `/api/health` for provider status

#### 3. `Project has no agents` / zero-agent orchestrator error
- **Cause**: A project was created without Maya (special agent)
- **Fix**: Call `storage.initializeIdeaProject(projectId)` after project creation. See `routes.ts` project creation handler.
- **Note**: Commit `937d51f` fixed this — ensure new project creation always calls initialize

#### 4. WebSocket disconnects / messages not received
- **Cause**: Race condition in WS message queue, stale connection, CORS mismatch
- **Fix**: Run `npm run test:ws-race` and `npm run test:ws-reconnect`. Check `ALLOWED_ORIGIN` matches client origin.

#### 5. Duplicate `deliberation_traces` insert error
- **Cause**: Duplicate `trace_id` insertion (UNIQUE constraint on `deliberation_traces.trace_id`)
- **Fix**: Generate truly unique trace IDs. See migration `0001_opposite_killmonger.sql`. Check for retry logic that re-uses same trace_id.

#### 6. TypeScript errors after adding to schema
- **Cause**: `shared/schema.ts` changed but types not regenerated
- **Fix**: Run `npm run typecheck`. Ensure `drizzle-zod` infers are updated.

#### 7. Agent responses include bullet points / headers
- **Cause**: Tone guard (`responsePostProcessing.ts`) not running or bypassed
- **Fix**: Ensure all streaming responses pass through `responsePostProcessing` before being emitted to client.

#### 8. Conversation shows wrong messages
- **Cause**: Conversation ID mismatch — manually constructed instead of using canonical parser
- **Fix**: Always use `shared/conversationId.ts` parser. Never construct `project:${id}` strings inline.

#### 9. Tasks not appearing after chat
- **Cause**: `task_suggestions` WS event not being listened to on frontend
- **Fix**: Check `useRealTimeUpdates.ts` handles `task_suggestions` and `task_created` events.

#### 10. Production: Insecure cookie warning
- **Cause**: `NODE_ENV` is not `production` or site served over HTTP
- **Fix**: Set `NODE_ENV=production` and serve over HTTPS. Session cookie is `secure: true` in prod.

---

## 12. KNOWN ARCHITECTURAL ISSUES & RECOMMENDATIONS

### ~~Issue 1: `routes.ts` is 3,500+ lines — God File~~ ✅ RESOLVED (v1.0, Phase 5)
Split into 6 focused modules in `server/routes/`. `routes.ts` is now 430 lines (thin orchestrator).

### ~~Issue 2: In-memory storage loses data in production~~ ✅ RESOLVED (v1.0, Phase 4)
`server/productionGuard.ts` asserts `STORAGE_MODE=db` at startup in production. Called from `server/index.ts`.

### ~~Issue 3: LandingPage.tsx not wired to router~~ ✅ RESOLVED (v1.0, Phase 2)
Wired at `/` in `App.tsx` for logged-out users. Redirects to app when logged in.

### ~~Issue 4: No pagination on message loading~~ ✅ RESOLVED (v1.0, Phase 4)
Cursor-based pagination implemented: storage returns last 50, API returns `{messages, hasMore, nextCursor}`, CenterPanel has "Load earlier messages" button.

### ~~Issue 5: Agent personality evolution stored in-memory~~ ✅ RESOLVED (v1.0, Phase 3)
Persisted to `agents.personality` JSONB (`adaptedTraits` + `adaptationMeta` per user). Seeded from DB on cache miss.

### ~~Issue 6: No message deduplication~~ ✅ RESOLVED (v1.0, Phase 4)
`idempotencyKey` sent in WS metadata from CenterPanel. `checkIdempotencyKey()` in chat.ts blocks duplicates.

### Issue 7: CORS is single-origin
**Risk**: LOW now, MEDIUM when deploying to different domains
**Current**: `ALLOWED_ORIGIN` accepts one value
**Recommendation**: Support comma-separated list when needed for CDN/subdomain setups.

### Launch Audit Hardening (2026-03-22)
A 4-session production readiness audit was performed. Full tracker: `LAUNCH-AUDIT.md`. Key changes:

**Security:**
- Explicit auth guards added to `/api/safety/evaluate-turn` and `/api/forecasts/decision` (previously relied on global middleware only)
- Zod validation added to `/api/training/feedback` and `/api/tasks/extract`
- Session secret hardcoded fallback replaced with random dev-only secret
- Express body size limit set to 2MB explicitly

**Code Quality:**
- App-level `<ErrorBoundary>` wrapping Router in `App.tsx` (uses `ErrorFallbacks.tsx`)
- Panel-level error boundaries already existed in `home.tsx`

**UI/UX:**
- Mobile responsive: Sheet drawers for LeftSidebar/RightSidebar on `< lg` breakpoint (`home.tsx`)
- Mobile header bar with hamburger + panel toggle buttons
- WebSocket connection status banner in `CenterPanel.tsx`
- Inline form validation in `ProjectNameModal.tsx` (touched state, error messages, character counter)
- ARIA attributes: `role="log"`, `aria-live="polite"` on message list

**Marketing:**
- SEO meta tags added to `client/index.html` (description, OG, Twitter card)
- Footer/login legal links fixed from `href="#"` to `/legal/privacy` and `/legal/terms`
- Skip-to-signup link visible during all tour states on landing page

**Remaining (post-launch):** See `LAUNCH-AUDIT.md` for full backlog (chat.ts split, AddHatchModal validation, OG image, legal page content).

---

## 13. SCALABILITY GUIDE

### Current Capacity Estimates (Single Node)
| Resource | Estimated Limit | Action Needed |
|----------|----------------|---------------|
| WebSocket connections | ~1,000 concurrent | Add Redis pub/sub for multi-node |
| PostgreSQL queries | ~500 req/s (Neon) | Add connection pooling if hitting limits |
| LLM API rate | Gemini 60 RPM (Flash) | Add request queue + backpressure |
| Message storage | Unlimited (DB) | Add archival after 6 months |
| Session storage | Neon DB scale | Already PostgreSQL-backed |

### Scaling Path
1. **Horizontal API scaling**: Extract session to Redis (currently PostgreSQL — fine for now)
2. **WebSocket clustering**: Add Redis adapter for Socket.io or ws-redis when multiple nodes needed
3. **LLM rate limiting**: Request queue per user (per-user 10 req/min) already partially in place via rate limiter
4. **DB read scaling**: Add Neon read replicas for `getMessagesByConversation` queries
5. **Streaming**: Consider Server-Sent Events (SSE) as alternative to WS for one-way streaming (simpler)

### Don't Optimize Prematurely
- Current: single-node Node.js is fine for MVP (< 1,000 users)
- Focus on product correctness before infrastructure scaling
- Profile before adding caching layers

---

## 14. CODING STANDARDS & CONVENTIONS

### TypeScript
```typescript
// ✓ Always use strict types
interface CreateProjectInput {
  name: string;
  emoji: string;
  userId: string;
}

// ✓ Validate all external inputs with Zod
const schema = z.object({ name: z.string().min(1).max(100) });
const result = schema.safeParse(req.body);
if (!result.success) return res.status(400).json(result.error);

// ✗ Never use 'any' — use 'unknown' + type guard
const data: unknown = req.body; // ✓
const data: any = req.body;     // ✗
```

### React Components
```typescript
// ✓ Functional components with typed props
interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
}

export function MessageBubble({ message, isStreaming = false }: MessageBubbleProps) { ... }

// ✓ Always use TanStack Query for server data
// ✗ Never use useEffect + fetch for data loading
```

### API Routes
```typescript
// ✓ Always verify ownership before returning data
const project = await storage.getProject(projectId);
if (!project || project.user_id !== req.session.userId) {
  return res.status(404).json({ error: 'Project not found' });
}

// ✓ Use Zod for request body validation
// ✗ Never trust req.body without validation
```

### Database
```typescript
// ✓ Always use Drizzle ORM
const project = await db.select().from(projects).where(eq(projects.id, projectId));

// ✗ Never use raw SQL in application code
const result = await db.execute(sql`SELECT * FROM projects WHERE id = ${projectId}`);
// ↑ Only acceptable in migrations
```

### Naming
- **Files**: `kebab-case.ts` (server utilities), `PascalCase.tsx` (React components)
- **Variables/Functions**: `camelCase`
- **Types/Interfaces**: `PascalCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Env vars**: `UPPER_SNAKE_CASE`
- **Database columns**: `snake_case`
- **JSON/JSONB fields**: `camelCase` (TypeScript convention wins)

### Git
- **Commit format**: `type(scope): description` — e.g., `feat(agents): add personality evolution persistence`
- **Types**: `feat`, `fix`, `perf`, `style`, `refactor`, `chore`, `docs`, `test`
- **Branch strategy**: Feature branches off `main`, merge via PR
- **Never force-push main**

---

## 15. REALISTIC GOALS & ACHIEVABILITY ASSESSMENT

### What's Working Well (Keep)
- Core chat + streaming — solid foundation
- LangGraph multi-agent routing — powerful and extensible
- Google OAuth — production-ready
- Drizzle ORM schema — clean and well-typed
- Multi-provider LLM fallback — resilient
- Safety + peer review gates — differentiating feature
- Task detection from chat — clever and valuable

### Completed in v1.0
- [x] Wire `LandingPage.tsx` into router
- [x] Persist personality evolution to database
- [x] Add `STORAGE_MODE=db` assertion in production
- [x] Full `routes.ts` modularization (6 modules)
- [x] Implement cursor pagination in `CenterPanel.tsx`
- [x] Add message deduplication key

### v1.2 — Completed (shipped 2026-03-23)
- [x] **Billing + LLM Intelligence** — Stripe monetization, Free/Pro tiers ($19/mo), smart LLM routing (Flash/Pro/Groq), token tracking, usage capping, conversation compaction, reasoning cache, task batching
- Audit: `.planning/v1.2-MILESTONE-AUDIT.md` — 16/16 requirements, 8/8 E2E flows

### v1.3 — Completed (shipped 2026-03-29)
- [x] **Autonomy Visibility & Right Sidebar Revamp** — 5 phases (11-15), 23/23 requirements

### v2.0 — Completed (shipped 2026-03-30)
- [x] **Hatches That Deliver** — Deliverable system, cross-agent chains, artifact panel, PDF export, organic detection

### Smart Task Detection — Completed (shipped 2026-03-31)
- [x] **7-phase rewrite** — Intent classifier, lifecycle commands, organic extraction, agent awareness, frontend, cleanup

### Short-Term (current)
- [ ] Write CHANGELOG and README for onboarding new developers
- [ ] User analytics / usage metrics (Posthog or custom)
- [ ] Conversation archival and search

### Medium-Term (1-2 months) — Achievable with focus
- [ ] Agent marketplace / public templates
- [ ] Cross-project agent sharing
- [ ] Agent voice/persona customization UI
- [ ] Image generation from Designer Hatch conversations
- [ ] Claude coding agent from Engineer Hatch

### Long-Term (3-6 months) — Ambitious but realistic
- [ ] Multi-user collaboration (real-time multi-cursor)
- [ ] Agent-to-agent async tasks without user prompting
- [ ] GitHub / Linear / Notion integrations
- [ ] Audio input (Whisper transcription)
- [ ] Fine-tuned models per role (trained on platform feedback)
- [ ] Horizontal scaling with Redis adapter

### NOT Realistic Right Now (Avoid)
- Building a mobile app before web is stable
- Multi-tenant SaaS infrastructure before user validation
- Training custom LLMs before sufficient feedback data (need 10K+ examples)
- Real-time video calls (massive infra complexity, not core value)

---

## 16. SECURITY CHECKLIST

Run mentally before every PR:

- [ ] Is `req.session.userId` checked before accessing user data?
- [ ] Is every route handler validating input with Zod?
- [ ] Are SQL queries parameterized? (Drizzle ORM guarantees this)
- [ ] Is no sensitive data logged to console in production?
- [ ] Is `NODE_ENV=production` triggering HTTPS-only cookies?
- [ ] Are API keys only read from `process.env`, never hardcoded?
- [ ] Is CORS restricted to `ALLOWED_ORIGIN`?
- [ ] Is rate limiting applied to AI chat endpoints?
- [ ] Are user-created strings sanitized before AI prompt injection?
- [ ] Is ownership verified before data mutations (not just reads)?

### Known Security Invariants
- Session cookies: `httpOnly: true`, `secure: true` (prod), `sameSite: 'lax'`
- Helmet middleware adds security headers on all responses
- Rate limit: 200 req/15min global, 15 req/min for AI
- Google OAuth uses PKCE — prevents authorization code interception
- User can only access their own projects, teams, agents, conversations

---

## 17. TESTING STRATEGY

### Test Pyramid
```
Unit Tests (scripts/test-*.ts)     → Individual modules (tone, injection, DTO)
Integration Tests (eval-*.ts)      → API + DB + LLM (routing, routing accuracy)
Gate Tests (gate-*.ts)             → Safety + performance thresholds
Stress Tests (stress-test-*.ts)    → Concurrency, load, edge cases
```

### Before Any Merge
```bash
npm run typecheck        # Must pass
npm run gate:safety      # Must pass
npm run test:integrity   # Must pass
npm run test:dto         # Must pass
```

### Testing LLM Without API Costs
```bash
LLM_MODE=test TEST_LLM_PROVIDER=mock npm run dev
```

### Testing Real LLM Locally
```bash
# Start Ollama: ollama serve + ollama pull llama3.1:8b
LLM_MODE=test TEST_LLM_PROVIDER=ollama npm run dev
```

---

## 18. QUICK REFERENCE CARD

### Add a new API route
1. Open `server/routes.ts` (or appropriate module in `server/routes/`)
2. Add ownership check + Zod validation
3. Call storage method
4. Return typed response
5. Add to this CLAUDE.md API section

### Add a new WebSocket event
1. Define type in `shared/dto/wsSchemas.ts`
2. Emit in `server/routes.ts` using `broadcastToConversation()`
3. Handle in `client/src/hooks/useRealTimeUpdates.ts`
4. Add to WS events section of this file

### Add a new database table
1. Define in `shared/schema.ts` with Drizzle schema
2. Run `npm run db:push`
3. Add CRUD methods to `IStorage` interface in `storage.ts`
4. Implement in both `MemStorage` and `DatabaseStorage`
5. Add to schema section of this file

### Add a new AI feature
1. Create module in `server/ai/` with a clear single responsibility
2. Integrate into `graph.ts` or `conductor.ts` as a new node/step
3. Add appropriate safety scoring if it takes actions
4. Emit WS event for frontend observability
5. Add test in `scripts/`

### Add a new React page
1. Create in `client/src/pages/`
2. Add route in `client/src/App.tsx` using Wouter `<Route>`
3. Add auth guard if needed (`useAuth` hook)
4. Use TanStack Query for any server data

---

## 19. DEPENDENCIES TO WATCH

| Package | Concern | Action if Issue |
|---------|---------|----------------|
| `@langchain/langgraph` | Active development, breaking changes | Pin version, test before upgrading |
| `@google/generative-ai` | Gemini API changes | Monitor changelog, test streaming on upgrade |
| `drizzle-orm` | Schema type inference can break | Run typecheck after any upgrade |
| `openid-client` | OAuth spec compliance | Don't upgrade without testing full auth flow |
| `ws` | WebSocket protocol | Test reconnect logic after upgrade |
| `express-session` | Session security | Check release notes for security patches |

---

## 20. FILE RELATIONSHIPS MAP

```
User request → App.tsx (routing) → Page (home.tsx)
                                         ↓
                          LeftSidebar ←→ CenterPanel ←→ RightSidebar
                               ↓              ↓              ↓
                          useAuth      useRealTimeUpdates  TanStack Query
                               ↓              ↓              ↓
                          /api/auth   WebSocket (ws)    /api/* REST endpoints
                               ↓              ↓              ↓
                          server/auth   routes.ts (WS)   routes.ts (HTTP)
                                              ↓              ↓
                                         AI pipeline      storage.ts
                                         (graph.ts →          ↓
                                          conductor →     PostgreSQL
                                          safety →        (Drizzle ORM)
                                          LLM providers)
                                              ↓
                                     streaming_chunk WS events
                                              ↓
                                     CenterPanel (renders chunks)
```

---

---

## 21. LANGGRAPH BEST PRACTICES (from official LangGraphJS repo)

### System Layer Responsibilities
- **Channels Layer**: Base communication & state management (`BaseChannel`, `LastValue`, `Topic`)
- **Checkpointer Layer**: Persistence and state serialization — use for time-travel debugging
- **Pregel Layer**: Message passing execution engine with superstep-based computation
- **Graph Layer**: High-level workflow definition (`Graph`, `StateGraph`)
- **StateGraph** extends Graph with shared state — this is what `graph.ts` uses

### Error Handling in LangGraph
```typescript
// ✓ Extend BaseLangGraphError for graph-level errors
class HatchinGraphError extends Error {
  constructor(message: string, public readonly nodeId?: string) {
    super(message);
    this.name = 'HatchinGraphError';
  }
}
// Use in graph.ts / conductor.ts when agent routing fails
```

### Imports Convention
- Order: external deps → internal modules → types
- Use ES module file extensions in imports

### Testing LangGraph Nodes
- Unit test each node function in isolation with mock state
- Integration test the full graph with `TEST_LLM_PROVIDER=mock`
- Use `.int.test.ts` suffix for integration tests that require live LLM

---

## 22. INSTALLED DEVELOPER TOOLS

### Hooks (auto-run on file edit)
- **TypeScript Quality Hooks** (`.claude/hooks/react-app/` + `.claude/hooks/node-typescript/`) — runs TypeScript + ESLint + Prettier on every file edit
- **TDD Guard** (`tdd-guard` global) — enforces Red-Green-Refactor, blocks implementation without failing tests

### Slash Commands (`~/.claude/commands/`)
- `/tdd` — full TDD workflow: branch → red → green → refactor → PR
- `/create-pr` — creates branch, splits commits logically, pushes, opens PR

### Skills/Plugins
- **Trail of Bits Security Skills** — use for auditing AI/LLM routes, auth, and prompt injection (`static-analysis`, `supply-chain-risk-auditor`, `insecure-defaults`, etc.)
- **agent-skills** — includes `read-only-postgres` for safe Neon DB querying during debug sessions

---

*Last updated: 2026-04-01 | Branch: main | v2.0 shipped | v1.3 shipped | Smart Task Detection complete | Author: Claude Code*
*This file should be updated whenever a significant architectural change is made.*