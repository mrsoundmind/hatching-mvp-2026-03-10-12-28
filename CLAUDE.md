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

**Current Phase**: v2.1 in progress (Phases 35, 36, 36.5 shipped of 12). v3.0 closed partial 2026-04-28 (Phase 22 atomic budget + Phase 28 Maya bug fix shipped, remaining 11 phases re-scoped into V3). v2.0 shipped 2026-03-30. v1.3 / v1.2 / v1.1 / v1.0 all shipped.

**Latest Milestone in flight**: **v2.1 — Hatches That Self-Improve** (5–7w, 12 phases per ROADMAP-V3). Shipped so far:
- Phase 35 — Production Hotfix Pass (2026-05-11, Fly v19; re-verified 2026-06-03 on Supabase, 7/7 Playwright PASS): legal modal + deep-link hybrid (Privacy/Terms), PROVIDER_DEGRADED toast banner, AUDIT-01 Playwright spec
- Phase 36 — Frozen-Rubric Deliverable Iteration (2026-05-11/13; re-verified 2026-06-03 on Supabase, 4/4 Playwright PASS): 15 frozen rubrics, auto-revert on score regression, FBK schema columns, per-criterion breakdown UI, agent-prompt feedback signal injection. FBK-02 deferred per user simplification (server endpoints persist; no UI surface in v2.1).
- Phase 36.5 — Imperative Action Shortcuts hotfix (2026-05-13): regex-based imperative-command parser fires actions BEFORE LLM call; lowers Maya's turn-count gate
- Phase 37 — Git-Style Run Tree (2026-05-14): `autonomy_runs` + `autonomy_run_steps` schema, run-tree writer hooks into both executeTask paths, handoff_initiated event + parent-link, GET endpoint, Activity-tab tree visualization with **semantic-word badges** (✓ Improved / ⚠ Made worse — per `feedback_ui_self_documenting.md`), click-step opens exact deliverable version. TREE-05 backfill vacuously satisfied (Neon data abandoned during 2026-06-02 migration; no historical rows to backfill).
- Phase 38 — Never Stop, Never Ask (expanded scope 2026-07-09, Plans 01-04 shipped, Plan 05 human vibe-check remaining):
  - Plan 38-01 (2026-06-21, commits e676e37+b218021+d904768): `<autonomous_directive>` prompt block + snapshot-at-task-boundary + Playwright wire-level prompt-capture spec. Closes ALWY-01, partial ALWY-02, code-ships ALWY-03. Runtime coverage became genuine only after Plan 38-03 fixed the `buildProviderOrder` capture branch residual.
  - Plan 38-02 (2026-07-09, commits 673c158+a4e8942): `scoreDestructiveIntent()` in `server/ai/safety.ts` with regex sets DESTRUCTIVE_VERB_CRITICAL / DESTRUCTIVE_VERB_RESET / BULK_SCOPE / DATA_SCOPE, merged via `Math.max(existing_executionRisk, destructiveIntentScore)`. Unit 12/12 PASS + Playwright `phase-38-safety-floor` 2/2 PASS on live server. Closes ALWY-04.
  - Plan 38-03 (2026-07-10, commit 748ae66): `MAYA_AUTONOMOUS_OVERRIDE` sibling constant appended after `AUTONOMOUS_DIRECTIVE_BLOCK` when autonomy=autonomous + `agentIsSpecial`. Snaps Maya's opener from exploratory ("I keep coming back to...") to committed-synthesizer ("Here's what I'd do: X. Because Y. Flag if wrong."). Also fixed Plan 38-01 residual: `buildProviderOrder` had no `capture` branch → capture provider silently fell through to mock, invalidating phase-38 Playwright coverage until fix. Unit 10/10 + Playwright phase-38 6/6 PASS. Closes ALWY-05.
  - Plan 38-04 (2026-07-10, commit a017055): universal `AGENT_CAPABILITY_ENVELOPE` XML block in `staticPrefix` declaring CAN (four `[[...]]` proposal blocks) and CANNOT (delete/wipe/DB/file-system/code-exec/deployment) with enforcement line "NEVER describe having performed an action you cannot perform." Ordering strictly enforced: envelope → directive → override. Unit 19/19 + Playwright `phase-38-fake-action-guard` 2/2 PASS on live Groq server (destructive → `safety_intervention` fired, zero fake-action language; benign 247-char substantive response, no over-firing). Cross-plan regression 38-02 spec 2/2 PASS re-run. Foundational precursor to Phase 46 Slop Detection. Closes ALWY-06.
  - Plan 38-05 ✅ VERIFIED 2026-07-21 (commit a017055 line was 38-04; 38-05 is verification, no product code beyond the safety fix `e61be9b`): human-delegated vibe-check ("do it for me") on the DeepSeek production chain. All three level-4 prompts commit-shape with zero clarifying questions; safety floor fired at level-4; no confabulation; Confirm-level downgrade asked a clarifying question. Caught + fixed a pre-existing defect: the safety clarification message was run through the conversational tone guard (`adaptLength` trims short-user-message replies to 2 sentences), so the three safety questions were cut to "...clarify these points:\n1." on any short destructive command; `e61be9b` makes interventions bypass the guard, regression `scripts/test-safety-intervention-integrity.ts` 10/10. Closes ALWY-02 fully, ALWY-03 runtime, and **Phase 38 overall**. See `.planning/phases/38-never-stop-never-ask/38-VERIFICATION.md`.

**Phase 38 CLOSED 2026-07-21. Next canonical phase: 39 (Reader Testing Peer Review Mode).**

Mid-milestone infra + marketing changes committed 2026-07-10 (folded into v2.1 per `feedback_no_decimal_hotfixes.md`):
- 5b9e674 marketing role tactical depth for Wren/Kai/Robin from coreyhaines31/marketingskills (MIT) + 2 eval scripts (eval-marketing-tactical.ts, eval-marketing-ab.ts). A/B validated 7/9 → 9/9 markers (+22pp): Wren gains numeric specificity, Robin prevents schema-confabulation on JS-injected JSON-LD.
- cdbda8e ProjectTree duplicate undo-toast removed (global undo popup already renders it, post-911bbb2 cleanup).
- ee7d072 AUTO-ROUTING.md (canonical routing matrix, 452L, referenced by CLAUDE.md §23) + HATCHIN-BRIEF.md (product/brand brief, 537L, dated 2026-06-13).
- 727d555 eval trendline (5 new runs from 2026-05-04) + Alex Chen persona snapshot refresh.
- 035325f 8 undo-project bug-hunt screenshots moved to `.evidence/undo-bug/`.

Pending: Phase 38 ✅ CLOSED 2026-07-21. Next: Phases 39 (Reader Testing Peer Review), 40 (promptfoo migration), 41 (Phase Machine + Blueprint), 42 (MVB Gate), 43 (Skip-Maya), 44 (Per-Run Cost Visibility), 45 (Maya 3-Stage Interrogation), 46 (AI Slop Detection), plus the new **v2.1-UX** milestone (look-and-feel, from the 2026-07-20 UX audit, now unblocked). **True next action: merge the audit-remediation branch + `fly deploy` (Phases 35 through 38 all verified), OR start Phase 39.**

**Mid-milestone infrastructure changes** (off-roadmap, no scope creep — tracked as quick tasks per `feedback_no_decimal_hotfixes.md`):
- **Phase A — DeepSeek migration** (shipped 2026-05-04): DeepSeek V4-Flash inserted as primary LLM provider; Gemini demoted to hot fallback; OpenAI removed from default prod chain (escape hatch only via `LLM_PRIMARY=openai`); cache-friendly prompt restructure (staticPrefix/dynamicSuffix) for 50× cheaper input on cache hit
- **quick-260601-ojf — Supabase migration** (shipped 2026-06-02): Neon over compute quota → migrated to Supabase Postgres (Singapore region); `server/db.ts` driver swap from `@neondatabase/serverless` to `pg` (node-postgres); Supavisor session-mode pooler; pg-boss + connect-pg-simple unchanged
- **quick-260427-ojf — DB-CRASH-01 hotfix** (shipped 2026-04-27): uncaughtException/unhandledRejection handlers for Neon idle-in-transaction recovery + traceStore.ts transaction-leak fix (handlers retained post-Supabase as defensive)

**Previous Milestones**:
- v1.3 — Autonomy Visibility & Right Sidebar Revamp (shipped 2026-03-29, 23/23). Tabbed right sidebar, live autonomy feed, handoff visualization, agent working-avatar state, approvals hub, task pipeline, project brain file upload, autonomy settings dial.
- v1.2 — Billing + LLM Intelligence (shipped 2026-03-23, 16/16). Stripe Free/Pro tiers ($19/mo), smart LLM routing, token tracking, usage capping, conversation compaction, reasoning cache, task batching.

**Current Branch**: `wip/pre-reset-2026-04-28` (active dev; ahead of `main` by the v2.1 + infra migration commits). v2.1 close-out will merge this back to `main`.

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
| Database ORM | Drizzle ORM | 0.39.1 | Type-safe, migration-based; uses `drizzle-orm/node-postgres` adapter |
| Database | PostgreSQL via Supabase | 17.6 | `pg` 8.21 (node-postgres) — was Neon serverless until 2026-06-02 |
| DB Pooler | Supavisor session mode | — | `aws-1-ap-southeast-1.pooler.supabase.com:5432`; pg-boss requires session mode, never transaction (6543). pg-boss's own pool is hardened in `jobQueue.ts` `buildBossConfig()` with `query_timeout` + keepAlive (2026-07-21, commit `57f2c94`): without `query_timeout` a fetch on a half-open Supavisor socket hangs forever and wedges the worker loop, the intermittent-autonomy bug. A stall watchdog (`startTaskWorkerWatchdog`) force-restarts the worker if it wedges anyway. |
| LLM Primary | DeepSeek V4-Flash | — | `openai` SDK 5.21.0 with custom `baseURL` (was Gemini 2.5-Flash until Phase A 2026-05-04) |
| LLM Fallback (hot) | Google Gemini 2.5-Flash/Pro | — | `@google/genai` 1.50.x (migrated from `@google/generative-ai` in Phase 28) |
| LLM Tier (Pro) | DeepSeek V4-Pro / Gemini 2.5-Pro | — | Premium routing via `resolveModelForTier('premium')` |
| LLM Free workloads | Groq Llama 3.3-70B | — | `groq-sdk` — simple chat, task extraction, compaction |
| LLM Local | Ollama (llama3.1:8b) | — | Test only (hard-blocked in providerResolver.ts:62 for prod) |
| LLM Escape hatch | OpenAI GPT-4o-mini | — | `openai` 5.21.0 — REMOVED from default prod chain in commit `34c8f23`; only used when `LLM_PRIMARY=openai` is explicitly set |
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
# Database — Supabase since 2026-06-02 (was Neon). Use Supavisor session-mode (5432), NOT transaction (6543)
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-1-<region>.pooler.supabase.com:5432/postgres
SESSION_SECRET=<strong-random-secret-min-32-chars>
DEEPSEEK_API_KEY=sk-...                 # Primary LLM since Phase A 2026-05-04
GEMINI_API_KEY=AIzaSy...                # Hot fallback (was primary pre-Phase A)
GROQ_API_KEY=gsk_...                    # Free-tier workloads (simple chat, task extraction, compaction)
GOOGLE_CLIENT_ID=681006596933-....apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
```

### Important Optional
```bash
NODE_ENV=development|production          # Affects security settings; gates DEV-only routes
STORAGE_MODE=db|memory                   # db = Postgres (default), memory = MemStorage; Gemini's 2026-06-02 gate skips DB-only boot steps in memory mode
LLM_MODE=prod|test                       # Switch provider chain
LLM_PRIMARY=deepseek|openai|gemini       # Escape hatch override; default unset = deepseek primary per Phase A
TEST_LLM_PROVIDER=mock|groq|ollama|openai # Used when LLM_MODE=test
TEST_OLLAMA_BASE_URL=http://localhost:11434
TEST_OLLAMA_MODEL=llama3.1:8b

# LLM model selection
DEEPSEEK_MODEL=deepseek-v4-flash         # Default primary model
DEEPSEEK_PRO_MODEL=deepseek-v4-pro       # Premium routing (PROMO pricing through 2026-05-31; re-evaluate post-promo)
DEEPSEEK_MIN_MAX_TOKENS=2000             # Floor enforced — V4 emits hidden reasoning tokens BEFORE content; <2000 returns empty (commit 31c0dc5)
GEMINI_MODEL=gemini-2.5-flash            # Hot fallback default
GEMINI_PRO_MODEL=gemini-2.5-pro          # Premium fallback for Pro tier
OPENAI_API_KEY=sk-...                    # Optional escape hatch only — NOT in default prod chain (removed in commit 34c8f23)
OPENAI_MODEL=gpt-4o-mini                 # Default if LLM_PRIMARY=openai

# OAuth + app routing
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:5001/api/auth/google/callback
APP_BASE_URL=http://localhost:5001
ALLOWED_ORIGIN=http://localhost:5001
LANGSMITH_API_KEY=ls_...                 # Optional LLM tracing
LANGSMITH_PROJECT=hatchin-chat

# Billing (Stripe) — v1.2
STRIPE_SECRET_KEY=sk_...                 # Stripe billing
STRIPE_WEBHOOK_SECRET=whsec_...          # Stripe webhook signature
STRIPE_PRO_MONTHLY_PRICE_ID=price_...    # Stripe price ID
STRIPE_PRO_ANNUAL_PRICE_ID=price_...     # Stripe annual price ID
FEATURE_BILLING_GATES=true|false         # Kill switch for tier gating (default: true in prod)
FEATURE_CONVERSATION_COMPACTION=false    # Context compaction (default: off)

# Autonomy (v3.0 + v2.1 — solo-dev safety)
BACKGROUND_AUTONOMY_ENABLED=true|false   # pg-boss task worker (default: off in dev; gated on STORAGE_MODE=db)
DAILY_COST_CAP_CENTS_DEV=500             # Per-day LLM spend cap for solo-dev safety (Phase A)
DEV_COST_CAP_ENABLED=true|false          # Activate dev cap
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
Production (Phase A — DeepSeek migration shipped 2026-05-04):
  Standard/Complex chat   → DeepSeek V4-Flash → [hot fallback] → Gemini 2.5-Flash
  Simple messages         → Groq llama-3.3-70b (FREE) → [fallback] → DeepSeek V4-Flash → Gemini 2.5-Flash
  Task extraction         → Groq llama-3.3-70b (FREE) → [fallback] → DeepSeek V4-Flash
  Conversation compaction → Groq (FREE)
  Autonomy / Pro tier     → DeepSeek V4-Pro → [fallback] → Gemini 2.5-Pro (resolveModelForTier('premium'))

  Removed from default chain (commit 34c8f23): OpenAI — escape hatch only via LLM_PRIMARY=openai
  Reasoning-token floor (commit 31c0dc5): DEEPSEEK_MIN_MAX_TOKENS=2000 — V4 emits hidden reasoning before content
  Cross-provider model fallback (commit ee57ce0): applyModelDefaults() rewrites model name when falling
    across provider boundaries (e.g. deepseek-v4-pro → gemini-2.5-pro)
  Cache-friendly prompts: staticPrefix (cacheable role identity + 14 response rules) + dynamicSuffix
    (per-turn data) for DeepSeek's 50× cheaper cache-hit input pricing

Test Mode (LLM_MODE=test):
  TEST_LLM_PROVIDER=groq    → Groq llama-3.3-70b
  TEST_LLM_PROVIDER=openai  → GPT-4o-mini
  TEST_LLM_PROVIDER=ollama  → Ollama llama3.1:8b (loop-back, no real API cost)
  TEST_LLM_PROVIDER=mock    → Mock (deterministic, zero-cost)
  default                   → Mock
```

**Eval gate status (Phase A acceptance):** smoke:deepseek 6/6 · test:tone PASS · test:voice 8/8 · test:pushback 46/46 · test:reasoning 240/240 · eval:routing 93.33% · eval:bench 29.00/35 vs Groq baseline 26.83 (+8.1%) · gate:safety PASS · gate:conductor 10/10 improved-or-equal, 0 regressions · gate:performance pending live traffic.

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

**LLM prompt injection** (in `openaiService.ts` at line 214): single merged `ROLE EXPERTISE` section injected after CHARACTER VOICE. Combines six fields into one block:
- `Domain:` ← roleProfile.domainDepth
- `Reasoning:` ← roleIntelligence.reasoningPattern
- `Output standard:` ← roleIntelligence.outputStandards
- `Critical thinking:` ← roleProfile.criticalThinking
- `Pushback:` ← characterProfile.negativeHandling
- `Collaboration:` ← characterProfile.collaborationStyle

The older `PROFESSIONAL DEPTH` + `DOMAIN INTELLIGENCE` two-section layout (pre-Phase A) was merged to reduce prompt overhead. `peerReviewLens` and `handoffProtocol` are NOT chat-injected — they're consumed by `peerReviewRunner.ts` and `handoffOrchestrator.ts` downstream.

**Marketing role tactical depth** (Wren, Kai, Robin — updated 2026-06-09): `reasoningPattern` / `outputStandards` / `peerReviewLens` for these three roles were enriched with frameworks adapted from [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) (MIT, © 2025 Corey Haines). Append-only edit — original frameworks preserved; tactical layer (banned-word lists, CRO impact ordering, audit attack order, schema-detection caveats, hreflang reciprocity) added. Other 27 roles untouched.

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

## 23. AUTO-ROUTING DIRECTIVE (always on, approval-first)

> **Principle**: When the user texts a freeform request — an idea, a bug, a feature, a question, or a note — DO NOT ask which slash command to use and DO NOT enumerate the GSD menu. Detect intent, **propose** the right Skill via an `AskUserQuestion` popup, and invoke **only after explicit approval**. NEVER fire any skill on your own. The user wants the Hatchin/Maya UX with a brake pedal: clear proposal, single-click approval, always in control.
>
> Full matrix lives in [AUTO-ROUTING.md](./AUTO-ROUTING.md) at project root. The fast-path below covers ~80% of cases. For edge cases, collisions, chained intents, Hatchin-specific overrides, or new skills — defer to AUTO-ROUTING.md.

### Approval protocol (every routing decision requires approval — no auto-fire)

For every freeform user message that implies action, fire an `AskUserQuestion` popup BEFORE invoking any skill. Format:

**Question**: "Proposed: `<skill>` — approve?"
**Header**: short skill name (≤12 chars)
**Body must include**:
- Skill name
- Detected intent
- Why (one-clause reason)
- Confidence (HIGH | MED | LOW + 0.xx score)
- What will happen if approved (one line)
- For chains: full chain (`A → B → C`) — one approval covers ALL stages
- For extra-warning skills: cost/scope/irreversibility note

**Options (max 4)**:
1. **Approve** (Recommended for HIGH confidence) — proceed with proposed skill
2. **Different skill** — user describes alternative or picks runner-up
3. **Just answer, no skill** — chat-only response, skip routing
4. **Cancel** — drop the action

**After approval**, narrate progress:
```
[<skill>] <current step>
```

**After completion**:
```
✓ <skill> done: <one-line outcome>  ·  Next: <suggested next step>
```

**Chain rules**: one approval covers the entire chain. Narrate transitions between stages (`→ Continuing: <next-skill>`). User can abort anytime by typing `stop` / `pause` / `wait` — route to `gsd-pause-work`.

### Confidence thresholds (affect popup CONTENT, not WHETHER to ask)

All routes ask via popup. Confidence shapes the body:

- **HIGH (≥0.8)** — single proposed skill, "Approve" pre-marked Recommended
- **MED (0.5–0.8)** — single proposed skill + runner-up listed in body, user can pick via "Different skill"
- **LOW (<0.5)** — top 2 candidates both surfaced as options (Approve = top-1, Different skill = top-2 named)
- **No match** — propose `gsd-do` (built-in router) as the fallback

Confidence bumps (+): verbatim skill name (+0.5), strong intent verb (+0.3), Hatchin domain noun (+0.2), file path / URL match (+0.4), prior-turn continuation (inherit), project state implies it like `PLAN.md` exists → execute-ready (+0.2).

### Top-15 fast-path (covers ~80% of cases)

| You say... | Propose |
|---|---|
| "fix bug X" / "Y is broken" / "why isn't Z working?" | `gsd-debug` |
| "trivial — fix this typo" / "one-liner" | `gsd-fast` |
| "quick task: X" / "small fix" / "while we're here..." | `gsd-quick` |
| "let's explore X" / "what if..." / "I have an idea" | `gsd-explore` |
| "let's add phase X" / new scope work | `gsd-add-phase` → `gsd-discuss-phase` |
| "plan phase X" / "make PLAN.md" | `gsd-plan-phase` |
| "execute phase X" / "run the plan" | `gsd-execute-phase` |
| "verify it works" / "validate" | `gsd-verify-work` |
| "ship it" / "open PR" / "merge ready" | `gsd-ship` |
| "where are we?" / "project state" | `gsd-progress` |
| "what's next?" | `gsd-next` |
| "note: X" / random thought | `gsd-note` |
| "park this for later" / "backlog this" | `gsd-add-backlog` |
| "review my changes" / "review the diff" | `gsd-code-review` |
| "review the UI" / "audit the design" | `gsd-ui-review` |

### Always-manual (refuse to propose — user must invoke explicitly)

- **Destructive**: `gsd-undo`, `gsd-remove-phase`, `gsd-remove-workspace`, `gsd-cleanup`, `gsd-from-gsd2`, `gsd-reapply-patches`
- **Settings / install**: `gsd-set-profile`, `gsd-settings*`, `gsd-update`, `gsd-sync-skills`, `init`, `update-config`, `fewer-permission-prompts`, `keybindings-help`
- **Paid services**: `gsd-ultraplan-phase`

For these, do NOT show a routing popup. Tell the user the skill is on the always-manual list and ask them to invoke it explicitly via slash command.

### Extra-warning routes (popup body MUST flag the risk before approval)

`gsd-autonomous` · `gsd-new-milestone` · `gsd-complete-milestone` · `gsd-new-project` · `gsd-new-workspace` · `loop` · `schedule`

For these, the popup body must include estimated cost / scope / irreversibility — make sure the user sees the risk before clicking Approve.

### Hatchin-specific overrides (layered on top of the matrix)

These come from durable user preferences in `~/.claude/projects/.../memory/`:

- **No mid-milestone decimal hotfixes** (`feedback_no_decimal_hotfixes.md`) — block auto-routing to `gsd-insert-phase`; redirect to `gsd-add-backlog` with "Accumulated Upgrades" tag and narrate the redirect
- **Verify in runtime** (`feedback_verify_in_runtime.md`) — after any "fix shipped" / `gsd-execute-phase` claim, auto-chain `playwright-tester` or `verify` against the live restarted server before reporting done
- **UI change approval** (`feedback_ui_change_protocol.md`) — before any skill that edits `client/src/`, narrate `→ UI change detected. Showing current state via Playwright before edit.` and wait for explicit approval (server-side changes skip this gate)
- **Self-documenting UI** (`feedback_ui_self_documenting.md`) — when invoking `gsd-ui-phase` or `gsd-ui-review`, inject self-documenting rules into the spec/audit criteria
- **Always update CLAUDE.md** — when architecture, conventions, or system surface changes, refresh this file (and bump the "Last updated" footer line)

### Reference

See [AUTO-ROUTING.md](./AUTO-ROUTING.md) for: confidence-math details, full skill inventory (~111 usable), all chains, collision tiebreakers, concept-skill loading rules, and the update procedure for adding new skills to the matrix.

---

*Last updated: 2026-07-31 (v2.2 Phase 39 Reader Testing — Plan 39-01 server shipped; v2.1-UX Phases 0-2 shipped parallel) | Branch: fix/audit-remediation-2026-07-17 (audit remediation, off wip/pre-reset-2026-04-28) | v2.1 in progress: Phase 35/36/36.5/37 shipped + Phase 38 Plans 01/02/03/04 all shipped 2026-06-21 through 2026-07-10 (Plan 38-05 human vibe-check + 38-VERIFICATION.md remaining before phase closes). ALWY-01/03/04/05/06 all ✅ SHIPPED, ALWY-02 ⚠ PARTIAL (final closure via 38-05). Progress 23/24 plans (96%). | Phase A DeepSeek migration shipped 2026-05-04 | Supabase migration shipped 2026-06-02 | Phase 35+36 Playwright 12/12 PASS on Supabase | Section 23 (Auto-Routing, approval-first) added 2026-06-04, every skill requires popup approval before firing, see AUTO-ROUTING.md | 2026-06-09: marketing role tactical depth (Wren/Kai/Robin) enriched from coreyhaines31/marketingskills (MIT), committed 2026-07-10 as 5b9e674; injection note: old PROFESSIONAL DEPTH+DOMAIN INTELLIGENCE pair merged into single ROLE EXPERTISE section | 2026-07-06: HANDOFF.md added at repo root, read that first for session-continuity | 2026-07-10 session: shipped Plan 38-02 (safety scorer destructive-intent, ALWY-04, commits 673c158+a4e8942), Plan 38-03 (Maya voice snap at level-4, ALWY-05, commit 748ae66, also fixed buildProviderOrder capture branch residual from Plan 38-01), Plan 38-04 (universal AGENT_CAPABILITY_ENVELOPE, ALWY-06, commit a017055). Marketing enrichment eval A/B validated 7/9 → 9/9 markers (+22pp) with Robin schema-confabulation prevention landing textbook. Fly.io cost model: min=0 pre-public ~$0-3/mo ₹0-258, min=1 post-launch ~$6.48/mo ₹557. Ambient constellation rule broadened 2026-07-10: CLAUDE.md AND HANDOFF.md AND STATE.md AND REQUIREMENTS.md AND ROADMAP.md updated atomically per change. | 2026-07-18 Audit Remediation (2026-07-17 live audit): v2.1 feature work paused; 10 commits on fix/audit-remediation-2026-07-17 fixed the core-value blocks in strict dependency order (pg-boss createQueue #95 revives ALL background autonomy; multi-agent empty-save #74; project-scope @mention #97; brain grounding + auto-fill #79/#105; activity metadata/default-filter/phantom-leak #102/#110/#80/#165; polish #43/#153/#149/#130/#114/#96/#160/#65/#136). Each runtime-verified (real browser for UI via tests/e2e/public-audit-ui.spec.ts, live server for backend). Deferred to Phase 47: #37/#60/#87/#88/#126/#161/#94/#139/#112. Phase 47 backlog #9 resolved. Note #104/#105 were deferred to Phase 42, NOT fixed, despite commit b7e5292's message claiming them. | 2026-07-20 Wave 6 (remediation reopened): right-sidebar pass found 3 never-tracked audit findings (#83 stats counters counted event names nothing emits; #108 Tree empty because no code path ever finalized a run, fixed by new completeRun() in runTreeWriter.ts; #109 category map duplicated server/client and drifted, collapsed into shared/activityLabels.ts) plus a bug absent from the audit: useAutonomyFeed.ts hardcoded the Activity time window to 'today' with no setter, emptying every project's panel at midnight. Commits cdbdd9b, ccfa905, f2b6885, all browser-verified. Close-out: 1a3b979 (deleted orphaned ApprovalsEmptyState), dadb686 (Work Outputs recorded neither executing agent nor produced output, so it showed "Hatch" over the task description; new markTaskCompleted helper covers all 3 completion paths, 6 of 8 historical rows recovered by joining messages on metadata.taskId), c549f9c (handoff chain PROVEN end to end via seeded dependsOn pair, live worker executed it, receiving agent produced 688 chars from the upstream scope; exposed 2 label bugs: the label read flat toAgentName while handoff_initiated nests toAgent.name so every real handoff rendered anonymously, and self-handoffs claimed a handoff that never happened). All Wave 6 re-verified live on restarted server (Alex→Rex handoff, browser labels correct). Decisions: 2026-07-20 UX audit → new v2.1-UX milestone (starts after Phase 38); Rex-vs-Remy chat/feed name mismatch → Phase 47 backlog #18. | 2026-07-21 Phase 38 CLOSED via Plan 38-05 vibe-check on DeepSeek (user-delegated); caught + fixed pre-existing safety-message truncation (e61be9b: safety interventions bypass the tone guard, whose adaptLength was cutting the 3 clarification questions to "...clarify these points:\n1." on short destructive commands; regression test-safety-intervention-integrity.ts 10/10). ALWY-01..06 all ✅. | 2026-07-21 Wave 7: user's independent 3-persona re-audit (.audit-reaudit-2026-07-20/) confirmed 14/15 remediation fixes live and found the intermittent-autonomy bug: pg-boss's fetch loop hangs forever on a half-open Supabase socket (no query_timeout) and wedges, so jobs enqueue but stay 'created' on a long-running instance until restart. Fixed 57f2c94: hardened pg-boss pool (query_timeout + keepAlive) + stall watchdog. Verified live (drained the real 20h-stuck job + fresh run 27s). Known-partial remaining per re-audit triage: #104 KB list (Phase 42). | 2026-07-21 Wave 8: focused Activity-feed audit fixed with verify-then-fix discipline: approval cards leaked raw safety codes (finishing #43 on the 2 surfaces the original missed, shared humanizeRiskReasons in shared/riskReasons.ts, b51f81b); feed visual coherence via /ui-genius (every row gets a face, small for the quiet review tier, "?" bubble → neutral system mark, 571145b); approval events now durable (approval_required/granted/rejected logged at gate + endpoints so the Approvals filter populates, aeba012); handoff respects explicit assignee (Coda→Coda self-handoff → assignee wins, aeba012). All verified live. Note #44 capability wording was closed as part of the humanizer/approval work. Next: merge + fly deploy (all audit blockers fixed) or Phase 39. Full record: .audit-2026-07-17/REMEDIATION-LOG.md. | 2026-07-23 competitive/landscape scan (no code): user asked how Hatchin compares to Slack Workflow Automation + the Claude "C-suite agent" skill packs (alirezarezvani/claude-skills + claude-cto-team, MIT). Verdict recorded — Slack automates the known (trigger→steps+connectors), Hatchin handles the unknown (ambiguous goal→reasoning+deliverable+handoff), so don't position Hatchin as "workflow automation"; the packs are commoditized advisory prompt-personas with no orchestration/peer-review/trust/autonomy/memory runtime, and our roleIntelligence is comparably deep, so the runtime is the moat. Logged the one useful borrow (quantified role formulas + structured peer-review verdict template + confidence tags, all MIT-reusable) as Phase 47 backlog #19; NOT built now per no-mid-milestone-decimal-hotfixes (v2.1 paused on the audit-remediation branch, this is polish). Constellation touched: ROADMAP #19, STATE count 18→19, this footer, HANDOFF log; REQUIREMENTS + COMPLETE-GUIDE intentionally not touched (a pre-triage backlog item creates no requirement and ships no feature). | 2026-07-25: scaffolded a future milestone stub "Reach & Integrations — Mattermost Bridge" (chat-platform bridge, Mattermost first, channel-agnostic seam for Slack/Teams later). Decisions: don't be a comms platform, reach into the team's existing chat; v1 = approvals + a /hatchin one-shot conversation taste reusing logAutonomyEvent + the approve/reject endpoints + generateIntelligentResponse (NO chat-core refactor); Release 2 = full @mention conversation gated on extracting a WS-agnostic orchestrator from handleStreamingColleagueResponse (~1,878 lines, also pays down Phase 47 #3/#4). Grounded in a Mattermost + Slack seamless-integration research pass (outbound bot WebSocket like Socket Mode, ack-fast-work-async, thread everything, no fake streaming, Mattermost Apps Framework deprecated). Restore tag pre-mattermost-integration on 2fec8d4; isolated branch feat/mattermost-bridge; full brief .planning/milestones/mattermost-bridge-BRIEF.md. NOT started; v2.1 still active (paused on audit remediation). | 2026-07-26: v2.2 "Hatches That Remember & Grow" (new branch feat/v2.2-intelligence-fixes, off the audit-verified code) fixes the four agent-intelligence gaps from the 2026-07-25 audit. Phases A (memory: outcome-aware extraction, retire crude keyword extractor), B (first-person voice), C (feedback anchored to role baseline — stops trait-flatten + sycophancy), E (first-person role-expertise reframe), F (agents address the user by name, remembered cross-project) shipped in prior sessions. **Phase D shipped 2026-07-26 — real peer review with teeth:** peer review was deterministic regex, never read the work; now `server/autonomy/peerReview/llmJudge.ts` is a genuine LLM-as-judge (approve/revise/reject + mustFix + confidence) running on **Groq** deliberately — a different model family than the DeepSeek/Gemini writer (anti self-preference bias) and free — **blind to authorship**, fail-safe to no-block. Opt-in `enableLlmJudge` in `peerReviewRunner.ts` (autonomous path only; chat path at chat.ts:2618 unchanged): confident reject → existing `pending_approval` block path (teeth), revise → REAL bounded regeneration via the author model then re-judge (replaces the cosmetic synthesizer). Visibility: `peer_review_feedback` is now a signal event in shared/activityLabels.ts with verb labels ("approved it"/"asked for changes"/"sent it back") + reason/fixes on expand in ActivityFeedItem.tsx (render half landed via parallel UI commit 745ebd8). Verified in runtime: calibration `scripts/eval-peer-review-judge.ts` 0% false-block / 100% catch; integration `scripts/test-peer-review-integration.ts` 7/7 live (bad→blocked, good→passes); real-browser feed proof. typecheck + 5 regression suites green. Commits 6ec4973 (server) + c2887fa (visibility). Nothing merged; all v2.2 on-branch. Deferred to a later milestone: per-role RAG, outcome-based growth loop (consumes Phase C's deferred content-wiring), ambient watchdog policing. NOTE: a parallel session is committing a UI type-scale refresh onto the same branch (commits 745ebd8/d675d87/4bc2461/f03c00c/9a064d6/90af4db). | 2026-07-26 v2.2 close-out (post independent QA browser audit): cross-verified 4 QA residuals against live code/DB before touching anything; 2 were non-issues. T1 (b99b892) judge over-eager 'revise' on good work → now regenerates only on major/critical severity (minor revises ship; reject unaffected; calibration 0% false-block/100% catch held, integration 7/7). T2 (b99b892) 'confidence null' was a MISREAD — it's on the event confidence column + reaches UI via expandableData, only absent from payload JSON (added for completeness). T3 (9ba5149) 'review folds under task' does NOT happen — normalizeAutonomyEvent gives each review event a unique trace id → own feed row (proven code+DB+browser). T4 (8f3b5d0) voices already distinct (max Jaccard 0.185, blind 100%), so no 30-voice rewrite (would strip correct domain words); instead LOCKED IN: test:voice gate 0.60→0.40 + blind eval broadened 5→10 roles (10/10, competence held), roleRegistry/roleIntelligence prose untouched. Audit report artifact updated. Nothing merged. | 2026-07-27 peer-review COVERAGE fix (f5682ab): a 2nd QA pass found the judge only fired when maxRisk>=peerReviewTrigger (0.35), so most low-risk ordinary work shipped UNREVIEWED (whole history had 8 judge verdicts). New shouldReviewAutonomousOutput() in taskExecutionPipeline.ts broadens the gate at both call sites: reviews fire on mid/high risk OR outward-facing/factual content (regardless of risk) OR any substantive deliverable; only trivial acks skip. peerReviewRunner: enableLlmJudge now force-runs review past the legacy risk-only shouldTriggerPeerReview veto (reason coverage_review). Verified: test-review-coverage 5/5, integration 9/9, LIVE before/after 8→11 verdicts after 3 ordinary tasks; calibration still 0% false-block/100% catch; gate:safety+integrity green; chat path untouched. Config: PEER_REVIEW_MIN_CHARS (default 180). Both former feed-lineage residuals now FIXED eb228ca (2026-07-27): R1 — review + autonomous_task_execution events carry taskId + runTraceId in PAYLOAD so a verdict joins back to its task/run; per-event grouping trace_id stays unique so each review keeps its own feed row (T3 preserved, linkage is a payload pointer not the grouping key). R2 — the "~9h timestamp skew" was an artifact of R1 (verdict compared to an unrelated run because unjoinable); columns are timestamptz/UTC and correct, joined to the right run the pair is 1.3s apart. Verified live scripts/verify-review-lineage-live.ts 6/6 + all regressions green. v2.2 now has ZERO known residuals. | 2026-07-27 v2.1-UX UI milestone (adopted from the 2026-07-20 UX Remediation Brief, `.audit-ux-2026-07-20/`) shipped Phases 0-2 on `feat/v2.2-intelligence-fixes` alongside v2.2, 13 UI commits each Playwright-verified live, path-disjoint from the v2.2/Mattermost server work: **Phase 0** `d675d87` load Inter (index.html never requested it), `4bc2461` 13px type-scale floor (`text-xs`→13, new `text-micro`=11, 196 sub-13px sizes migrated across 36 files), `f03c00c` 44px hit areas via invisible `.hit-target` overlay; **Phase 1** `9a064d6`+`90af4db` completion card (chat "done" moment; producer+reviewer via new `task_execution_completed` payload fields agentRole/taskTitle/peerReviewed/reviewerName/reviewerRole/summary; Keep/Refine/Looks-good; no manual hand-off since handoff is automatic), `a8383a8` delegation entrance ("Let the team work on these" in TasksTab + composer "go ahead" hint, gated Pro+autonomyEnabled, reuses checkForAutonomyTrigger), `67fb230` 2-min waiting-state watchdog; **Phase 2** `9f9490b` sharper landing subhead + legibility (headline kept), `c8fed03` refreshed stale `<title>`/OG meta, `dfeeed9` "They don't just agree with you." pushback-proof section (3 verbatim negativeHandling quotes, additive, bento kept), `73f2d55` pricing in plain voice (dropped SKU/TIER/OPERATIONAL/"Deploy →", prices + orange kept), `32468fe` "While you were away" return-briefing card (reads existing metadata.isReturnBriefing). Color rule held (navy/blue frozen, orange kept, additive amber=work/green=done). Phase 3 intentionally NOT built. Nothing merged. | 2026-07-31 v2.2 Phase 39 (Reader Testing Peer Review) — Plan 39-01 (server) shipped: reader-facing doc types (PRD/blog/email/copy/brief/research/process) now get a context-BLIND fresh-reader review the moment they're written (auto) plus a manual re-run endpoint (`POST /api/deliverables/:id/reader-test`). New `server/ai/readerTestReviewer.ts` mirrors the Phase D judge pattern (cross-model Groq vs the DeepSeek/Gemini writer → no self-preference; free; fail-safe null → never blocks). Deliverables never touched peer review before, so this is a NEW reviewer on the document side, independent of the autonomous-task judge. Quote-anchored plain-language annotations persist on new nullable JSONB `deliverable_versions.reader_test` (db:push applied live); `reviewDeliverableForReaderTest()` in deliverableGenerator.ts orchestrates run+persist; READ-04 revision impact = `resolvedFromPrevious` count + reused frozen-rubric score delta. Doc-type gate `isReaderFacingDocType` in shared/deliverableTypes.ts (10 prose types in, 6 structured out, fails closed). Verified: doctype 19/19, context-blind 18/18, LIVE Groq calibration 100% catch / 0% false-alarm, LIVE Groq+Supabase integration 10/10 (6/7 flagged phrases resolved after a fix), tsc 0 errors, gate:safety/integrity/dto green, peer-review path untouched. READ-01/02 done; READ-03/04 server-side done — annotation + accept/reject UI is Plan 39-02 (UI-approval gate). Scoped commit only (my 6 code files + 4 test scripts + REQUIREMENTS/CLAUDE/HANDOFF/GUIDE); STATE.md + ROADMAP.md + package.json intentionally NOT staged (they carry a sibling session's uncommitted v2.1-UX Phase 4 edits — Phase 39 lines land there when the branch is clean). Nothing merged. | 2026-07-31 v2.1-UX **Phase 4 (Brain Tab Information Architecture) shipped** on `feat/v2.2-intelligence-fixes` (added via GSD as a milestone-relative phase — v2.1-UX uses ROADMAP-prose tracking, not the global `NN-` dir scheme where `04`/`39` are taken; artifacts `.planning/phases/v2.1-ux-04-brain-tab-ia/`). Cross-verified the live Brain-tab audit (`.audit-ux-2026-07-20/BRAIN-TAB-FINDINGS.md`) first: 6/8 findings valid + unfixed, 2 (type/tap) overtaken by Phase 0 so reframed. No functional repair — upload/delete/autonomy-dial/knowledge-adherence all re-verified working live; this was a labeling + ordering + self-documenting pass on `BrainDocsTab.tsx` + `AutonomySettingsPanel.tsx` + `DocumentCard.tsx` (+ `server/routes/projects.ts` title default). 4 atomic Playwright-verified commits: `6177021` P0-A/B (the "Project Knowledge Base" divider rendered the empty `<PackageProgress>` — renamed to Packages + honest "No active packages" empty state, duplicate name gone), `2c6f6a9` P1-A/B (Knowledge Base leads the tab under Core Direction; inner "Autonomy Settings" header removed so one Autonomy header), `5756cce` P1-C (server derives a real doc title from content's first line + client fallback for legacy rows — never "Untitled Document"; server-side live-confirm deferred to next dev-server restart, plain `tsx` no watch, unit 5/5), `29727a4` P1-D/E/P2-A (count/state pills on every header, headers 13px bold bright, level buttons + delete 44px). Constellation: STATE + ROADMAP + this footer + HANDOFF updated (the sibling session reserved STATE/ROADMAP for me); REQUIREMENTS + COMPLETE-GUIDE intentionally not touched (an IA/presentation fix ships no new feature/requirement, per the 2026-07-23 precedent). VERIFICATION.md in the phase dir. Nothing merged. | Author: Claude Code*
*This file should be updated whenever a significant architectural change is made. Status-doc constellation (this file, HANDOFF.md, HATCHIN-COMPLETE-GUIDE.md at repo root, .planning/STATE.md, .planning/REQUIREMENTS.md, .planning/ROADMAP.md) must stay in sync per feedback_always_update_claudemd.md. HATCHIN-COMPLETE-GUIDE.md is the product/feature catalog: every feature, every agent, how they police each other via peer review, how they grow and learn from each other over time. For session-by-session progress and daily-log style continuity, see HANDOFF.md.*