# Changelog

All notable changes to Hatchin are documented here.

---

## v2.0 — Hatches That Deliver (2026-03-30)

Transforms Hatchin from "AI chatroom" to "AI team that ships coordinated work."

### Added
- **Deliverable system** — 15 deliverable types (PRD, tech spec, design brief, GTM plan, etc.) with role-to-type mapping and canonical section schemas
- **Cross-agent deliverable chains** — Upstream context injection, handoff orchestration between specialists, stale reference detection. 3 package templates: launch, content-sprint, research
- **Artifact panel** — Right-side split panel with markdown rendering, version navigation, and inline refine input
- **PDF export** — Branded PDF generation with table of contents, agent attribution, and Hatchin branding
- **Organic detection** — Regex-based intent detection from conversation with conservative thresholds and ProposalCard accept/dismiss UX
- **DeliverableChatCard** — Inline deliverable display within chat messages
- **PackageProgress** — Visual progress tracking for coordinated package completion
- **Database** — `deliverables`, `deliverableVersions`, `deliverablePackages` tables with full Zod schemas
- **API** — 13 deliverable endpoints (CRUD, generate, iterate, download, versions, packages)

### Technical
- Streaming generation via Groq llama-3.3-70b
- Version history with restore capability
- Section-level iteration (update specific sections without regenerating)
- Downstream reference detection for chain integrity

---

## Smart Task Detection Rewrite (2026-03-31)

Replaced broken task detection with intent-classified pipeline. Zero false positives, free-tier LLM usage.

### Added
- **Intent classifier** — Pattern-based (zero LLM cost) with 5 intent types: EXPLICIT_TASK_REQUEST, USER_DELEGATION, TASK_LIFECYCLE_COMMAND, ORGANIC_CANDIDATE, NO_TASK_INTENT
- **Lifecycle commands** — Natural language task management: status/priority/assignee updates, delete, query, filtered_query, progress summaries with fuzzy task matching
- **Organic extraction** — Groq-based task extraction with 30-second cooldown per conversation and Jaccard duplicate detection (threshold 0.7)
- **Agent awareness** — Assigned tasks injected into agent prompts with overdue/blocked warnings. Completion detection from agent responses
- **Completion detector** — Scans agent responses for "finished", "done with", "completed" patterns

### Removed
- `TaskDetectionAI` class (old GPT-4 direct path — expensive, bypassed routing)
- `TaskManager.tsx` (replaced by `sidebar/TasksTab.tsx`)
- `TaskSuggestionModal.tsx` (replaced by `TaskApprovalModal.tsx`)

### Changed
- `/api/task-suggestions/analyze` migrated from GPT-4 to Groq organic extractor (free tier)
- Rate limit: 10 task creates/min/user

---

## v1.3 — Autonomy Visibility & Right Sidebar Revamp (2026-03-29)

Makes the v1.1 autonomy backend visible and controllable. 23/23 requirements across 5 phases.

### Added
- **Tabbed right sidebar** — Activity / Tasks / Brain tabs with CSS-hide (preserves scroll/draft state)
- **Live activity feed** — Real-time autonomy events with agent avatars, timestamps, stats card (tasks completed, handoffs, cost), filter chips
- **Handoff visualization** — Chat handoff cards (from-agent → to-agent + task), sidebar handoff chain timeline with animated connectors, "Hand off to..." dropdown
- **Approvals hub** — One-click approve/reject, task pipeline view (5 stages), approval expiry handling
- **Brain redesign** — PDF/DOCX/TXT/MD file upload (drag-and-drop, 10MB max), card-based knowledge base with type badges, 4-level autonomy dial (Observe/Propose/Confirm/Autonomous), work output viewer
- **Agent working state** — Pulsing/rotating avatar animation during background execution
- **Deliberation indicator** — Card showing when agents are coordinating, auto-resolves after 30s
- **18 new sidebar components** in `client/src/components/sidebar/`
- **3 new hooks** — useAutonomyFeed, useSidebarEvent, useAgentWorkingState
- **Server endpoints** — `GET /api/autonomy/events`, `GET /api/autonomy/stats`, `POST /api/projects/:id/brain/upload`, `DELETE /api/projects/:id/brain/documents/:docId`

### Technical
- CustomEvent bridge from CenterPanel to sidebar
- multer v2 for file upload with pdf-parse for PDF text extraction
- No DB migrations required — all data in existing JSONB columns

---

## v1.2 — Billing + LLM Intelligence (2026-03-23)

Stripe monetization and smart LLM routing. 16/16 requirements across 7 phases.

### Added
- **Stripe billing** — Free ($0) / Pro ($19/mo or $190/yr) tiers with Checkout, Customer Portal, and webhook handling
- **Smart LLM routing** — Simple messages → Groq (FREE), standard/complex → Gemini Pro, task extraction → Groq, autonomy → Gemini Pro (Pro only)
- **Token tracking** — Per-request usage recording, daily aggregation, cost calculation
- **Tier gating** — Project limits (3 free), autonomy access (Pro only), message safety caps (500/day invisible, 15 msg/min)
- **15-day grace period** — Existing users get Pro trial on billing launch
- **Conversation compaction** — Context summarization via Groq (feature-flagged)
- **Reasoning cache** — In-memory, 1hr TTL, project-scoped
- **Background task batching** — Groups same-agent tasks for 30-50% LLM cost savings
- **Account page** — Subscription management, usage metrics at `/account`
- **Upgrade modal** — Context-aware Free vs Pro comparison
- **Usage bar** — Progress indicator in chat header

### Technical
- Kill switch: `FEATURE_BILLING_GATES=false` disables all tier enforcement
- Stripe works gracefully without API keys (billing status endpoint always responds)
- Task complexity classifier for adaptive maxTokens

---

## v1.1 — Autonomous Execution Loop (2026-03-20)

Agents don't just talk — they work. 17/17 requirements.

### Added
- **Background execution** — pg-boss job queue for durable task execution with per-project daily cost cap
- **Agent handoffs** — Specialist routing via conductor, BFS cycle detection, structured handoff context
- **3-tier safety gates** — Auto-complete (< 0.35), peer review (0.35-0.59), user approval (>= 0.60)
- **Progressive trust scoring** — Agents build trust through successful completions (up to +0.15 threshold adjustment)
- **Peer review** — Cross-agent review with 7 role-specific rubric categories
- **"Team is working..." indicator** — Chat banner during background execution
- **Inline approval cards** — One-click Approve/Reject for high-risk actions
- **Browser tab badge** — Notification when background work completes
- **Maya return briefing** — Summary of completed work when user returns
- **Pause/cancel autonomy** — Stop all background execution
- **294 agent intelligence tests** — Voice distinctiveness, pushback, reasoning patterns for 30 roles

### Technical
- 30 role definitions with deep personality (voice, pushback, collaboration, domain depth)
- 30 role intelligence profiles (reasoning, output standards, peer review lens, handoff protocol, escalation rules)
- Role-aware risk multipliers (infra roles escalate sooner, creative roles get more autonomy)

---

## v1.0 — Foundation (2026-03-15)

Core platform infrastructure. 31/31 requirements.

### Added
- **Real-time chat** — WebSocket streaming with token-by-token display, typing indicators
- **LangGraph multi-agent routing** — State machine with router + hatch nodes
- **30 AI agent roles** — Each with unique character name, personality, expertise, and voice
- **Google OAuth** — PKCE-based authentication with session management
- **Drizzle ORM schema** — 14 PostgreSQL tables with full type safety
- **Multi-provider LLM** — Gemini (primary) + OpenAI (fallback) + Groq (free) + Ollama (local)
- **Safety scoring** — 3-dimension risk assessment (hallucination, scope, execution)
- **Task detection** — AI-powered extraction from chat conversations
- **Personality evolution** — Agents learn from user feedback (thumbs up/down)
- **Project brain** — Core direction, execution rules, team culture in JSONB
- **Landing page** — Public marketing page for logged-out users
- **Starter packs** — 38 project templates across 7 categories
- **Message pagination** — Cursor-based with "Load earlier messages"
- **Message deduplication** — Idempotency key tracking

### Technical
- Routes modularized into 6 focused modules
- Production storage guard (STORAGE_MODE=db assertion)
- Helmet + CORS + rate limiting security middleware
- PostgreSQL session store with 7-day TTL
