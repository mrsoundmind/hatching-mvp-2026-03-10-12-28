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

**Current Phase**: v1.0 shipped (2026-03-19). All 31 requirements satisfied. Next milestone TBD.

**Current Branch**: `reconcile-codex` (feature branch) — main is the canonical production branch.

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
│   │   ├── home.tsx              # Main layout: LeftSidebar + CenterPanel + RightSidebar
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
│   │   ├── TaskManager.tsx       # Task list with filters + status
│   │   ├── AddHatchModal.tsx     # Create agent modal
│   │   ├── WelcomeModal.tsx      # First-time onboarding (egg animation)
│   │   ├── QuickStartModal.tsx   # Quick project creation
│   │   ├── StarterPacksModal.tsx # Template selection
│   │   ├── OnboardingSteps.tsx   # Step-by-step onboarding UI
│   │   ├── TaskSuggestionModal.tsx # AI task approval flow
│   │   ├── EggHatchingAnimation.tsx # Animated egg 🥚 loading state
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
│   │   ├── taskDetection.ts      # Extract tasks from chat messages
│   │   ├── personalityEvolution.ts # Agent learning from feedback
│   │   ├── trainingSystem.ts     # Feedback collection for training
│   │   ├── colleagueLogic.ts     # Role-specific response logic
│   │   ├── roleProfiles.ts       # Role definitions (PM, Engineer, Designer, etc.)
│   │   ├── actionParser.ts       # Parse [[ACTION]] blocks from responses
│   │   ├── mentionParser.ts      # Parse @agent and /route commands
│   │   └── responsePostProcessing.ts # Tone guard + response validation
│   ├── llm/
│   │   ├── providerResolver.ts   # Multi-provider fallback chain
│   │   ├── providerTypes.ts      # LLM interface definitions
│   │   └── providers/
│   │       ├── geminiProvider.ts # Gemini 2.5-Flash (PRIMARY)
│   │       ├── openaiProvider.ts # GPT-4o-mini (FALLBACK)
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

### System
```
GET    /api/health                         → {status, wsConnections, ...}
GET    /api/system/storage-status          → dev only: shows storage mode
```

> **All routes except /auth require a valid session (`req.session.userId`). Return 401 if missing.**

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

// Errors
{ type: 'error', code: string, message: string, details?: object, correlationId?: string }
```

---

## 7. AI SYSTEM ARCHITECTURE

### LLM Provider Chain
```
Production:
  GEMINI_API_KEY present? → Gemini 2.5-Flash → [fallback] → GPT-4o-mini

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
4. Safety gate: score risk (hallucination, scope, execution)
   - risk >= 0.8: block + request clarification
   - risk >= 0.6: peer review required
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

### Agent Roles (from `roleProfiles.ts`)
- Product Manager (default/fallback)
- Software Engineer
- UI/UX Designer
- Data Scientist
- Marketing Specialist
- Business Analyst
- DevOps Engineer
- Maya (special agent — project-level AI with broader context)

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

### Short-Term (1-2 weeks) — Highly Achievable
- [ ] Write CHANGELOG and README for onboarding new developers
- [ ] User analytics / usage metrics (Posthog or custom)
- [ ] Conversation archival and search
- [ ] Mobile responsive improvements

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
- Complex billing/payment before product-market fit
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

*Last updated: 2026-03-19 | Branch: reconcile-codex | v1.0 shipped | Author: Claude Code*
*This file should be updated whenever a significant architectural change is made.*