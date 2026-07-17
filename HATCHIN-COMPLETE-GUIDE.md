# Hatchin, Complete Product & System Documentation

> **Last updated**: 2026-07-10 | **Branch**: `wip/pre-reset-2026-04-28` | **Version**: v2.0 shipped, v2.1 Phase 38 code-complete (Plan 05 vibe-check pending)

This is the single-source-of-truth guide for everything Hatchin does: every feature, how it works, what outcome it produces; every one of the 30 agents; the knowledge system; how agents police each other via peer review; how they grow, learn, and improve from each other over time.

Kept in sync with reality per [feedback_always_update_claudemd.md](https://claude.ai/) memory rule. Constellation partner to [CLAUDE.md](CLAUDE.md), [HANDOFF.md](HANDOFF.md), [.planning/STATE.md](.planning/STATE.md), [.planning/REQUIREMENTS.md](.planning/REQUIREMENTS.md), [.planning/ROADMAP.md](.planning/ROADMAP.md).

---

## Table of Contents

1. [What is Hatchin?](#1-what-is-hatchin)
2. [Core Concepts](#2-core-concepts)
3. [User-Facing Features](#3-user-facing-features)
4. [All 30 AI Agent Roles](#4-all-30-ai-agent-roles)
5. [Starter Pack Templates](#5-starter-pack-templates)
6. [AI System Architecture](#6-ai-system-architecture)
7. [Autonomy System](#7-autonomy-system)
8. [Agents Policing Each Other (Peer Review Deep Dive)](#8-agents-policing-each-other-peer-review-deep-dive)
9. [Growing and Learning From Each Other](#9-growing-and-learning-from-each-other)
10. [AI Slop Prevention (Phase 38 stack)](#10-ai-slop-prevention-phase-38-stack)
11. [Deliverable System (v2.0)](#11-deliverable-system-v20)
12. [Billing & Monetization](#12-billing--monetization)
13. [Tech Stack](#13-tech-stack)
14. [Database Schema](#14-database-schema)
15. [API Reference](#15-api-reference)
16. [WebSocket Events](#16-websocket-events)
17. [Authentication](#17-authentication)
18. [Frontend Architecture](#18-frontend-architecture)
19. [Backend Architecture](#19-backend-architecture)
20. [Safety & Security](#20-safety--security)
21. [LLM Provider System](#21-llm-provider-system)
22. [Knowledge System](#22-knowledge-system)
23. [Testing & QA](#23-testing--qa)
24. [Environment Variables](#24-environment-variables)
25. [Project Structure](#25-project-structure)
26. [Version History](#26-version-history)
27. [Roadmap](#27-roadmap)

---

## 1. What is Hatchin?

Hatchin is an **AI-powered collaborative project execution platform**. Not one chatbot: a whole team of AI colleagues ("Hatches"), each with a distinct role, personality, and area of expertise. You chat with them like real teammates. They think, remember, disagree, collaborate, and produce actual work.

### What agents do

- Have genuine, personality-driven conversations as distinct characters (no assistant voice)
- Detect and create tasks automatically from natural chat
- Route questions to the right specialist (engineer, designer, PM, marketer, etc.)
- Update the project "brain" (goals, direction, culture) from conversations
- Learn each user's working style over time via personality evolution
- Coordinate autonomously via multi-agent deliberation
- Execute tasks in the background and hand off work between specialists
- Self-review quality via peer review gates (agents policing each other)
- Grow trust progressively based on outcomes (higher trust, less friction)
- Manage risk through 3-tier safety gates (auto-complete, peer review, user approval)
- Refuse to fake actions they cannot perform (capability envelope, Phase 38-04)
- Snap voice from exploratory to committed when the user demands maximum autonomy (Phase 38-03)
- Land destructive requests behind an approval card even in "never stop, never ask" mode (Phase 38-02)

### The one-liner

Hatchin gives you an entire AI team, not a single chatbot, that collaborates like real colleagues, works autonomously when trusted, asks for permission when the stakes are high, and never pretends to have done work it cannot actually do.

### The current live tagline

> *Where great ideas find the team to build them.*

---

## 2. Core Concepts

### Projects

Top-level workspaces. Each project has a "brain" (core direction, execution rules, team culture), teams of agents, conversations, tasks, deliverables, and autonomy runs. A user can have multiple projects (3 on Free tier, unlimited on Pro).

### Teams

Groups of agents within a project. Example: a "Product Team" with a PM, Designer, and Engineer. Teams scope conversations and task routing.

### Agents (Hatches)

AI team members with distinct personalities, expertise, and character names. There are 30 roles available (Alex the PM, Cleo the Designer, Dev the Backend Developer, etc.). Each agent has:

- A character name, emoji, and color identity
- A unique voice prompt defining how they speak
- Domain expertise and critical thinking style
- Pushback behavior (how they challenge bad ideas)
- Collaboration style (how they work with other agents)
- A peer review lens (what they look for in others' work)
- A handoff protocol (structured passes/receives)
- A trust score that grows or shrinks based on outcomes
- Adaptive personality traits that evolve per user

### Maya (Idea Partner)

Maya is the special project-level intelligence. She is not a regular team member: she is hidden from the sidebar and exists only at the project scope. Maya is the first agent users interact with. She helps with brainstorming, strategic guidance, and big-picture thinking. All project-level conversations route to Maya first (PM Alex as fallback).

At autonomy level 4 ("Autonomous"), Maya's voice snaps from exploratory-partner ("I keep coming back to...") to committed-synthesizer ("Here's what I'd do: X. Because Y. Flag if wrong.") via the [`MAYA_AUTONOMOUS_OVERRIDE`](server/ai/promptTemplate.ts) block shipped in Phase 38-03.

### Conversations

Three scopes, all keyed by canonical ID format:

| Scope | ID Format | Who Responds |
|---|---|---|
| **Project-level** | `project:{projectId}` | Maya priority, PM Alex fallback, then whoever the Conductor routes to |
| **Team-level** | `team:{projectId}:{teamId}` | Team agents only, best expertise match |
| **1-on-1** | `agent:{projectId}:{agentId}` | That specific agent |

Canonical parser: [shared/conversationId.ts](shared/conversationId.ts). Never construct ID strings manually elsewhere.

### Tasks

Work items extracted from chat or created manually. Statuses: `todo`, `in_progress`, `completed`, `blocked`. Priorities: `urgent`, `high`, `medium`, `low`. Support parent-child hierarchy via `parent_task_id`.

Smart task detection (rewritten 2026-03-31) uses a 5-intent classifier:
1. `EXPLICIT_TASK_REQUEST` (user says "create a task")
2. `USER_DELEGATION` (user says "you handle this")
3. `TASK_LIFECYCLE_COMMAND` (status/priority/assignee changes, fuzzy task matching)
4. `ORGANIC_CANDIDATE` (implied task from conversation)
5. `NO_TASK_INTENT`

Organic extraction runs on Groq (free tier), 30-second cooldown per conversation, Jaccard duplicate detection at 0.7 threshold.

### Deliverables (v2.0)

15 typed deliverable formats (PRD, brief, blog post, email, launch plan, research report, etc.) with canonical section schemas. Streaming generation via Groq. Version history with restore. Iterate by section. Cross-agent chains via upstream context injection. See [Section 11](#11-deliverable-system-v20).

### Autonomy Dial (v1.3, 4 levels)

Users set autonomy per project via the right sidebar dial. Each level shapes prompt injection, safety-gate behavior, and cost caps:

| Level | Name | Behavior |
|---|---|---|
| 1 | **Observe** | Agents only respond when directly addressed; no background work; every action confirmed |
| 2 | **Propose** | Agents suggest actions but require user click to execute |
| 3 | **Confirm** (default) | Agents ask one clarifying question per turn; background work confined to explicit tasks |
| 4 | **Autonomous** | "Never stop, never ask." Agents commit and continue. Safety floor still fires on destructive intent. Maya voice snaps to committed-synthesizer. Capability envelope prevents fake-action confabulation. |

The dial value is snapshotted at task-entry boundary (per chat message, per pg-boss job, per handoff continuation). Mid-run downgrades apply to the NEXT task, not the in-flight one.

### 3-Tier Safety Gates

Every LLM call is scored across three risk dimensions (hallucination, scope, execution). The aggregate risk routes the response:

| Aggregate Risk | Action | User Experience |
|---|---|---|
| < 0.35 | Auto-complete | Invisible: work just happens |
| 0.35 to 0.59 | Peer review | Another agent reviews before delivery |
| ≥ 0.70 | User approval | Inline Approve/Reject card in chat |

The 0.70 threshold applies regardless of autonomy level. Phase 38-02 made destructive-verb detection actually fire this gate (previously `executionRisk` for "delete all my data" scored 0.1, well below the gate: now scores 0.94).

---

## 3. User-Facing Features

### 3.1 Pages & Navigation

| Route | Page | Description |
|---|---|---|
| `/` | Landing (logged out) / Home (logged in) | Public marketing or main app |
| `/login` | Google OAuth login | Animated background, PKCE flow |
| `/account` | Account & Billing | Subscription status, usage metrics, upgrade/manage |
| `/maya/:projectId` | Maya Chat | Dedicated project-level Maya conversation |
| `/legal/privacy` | Privacy Policy | Public legal page (Phase 35) |
| `/legal/terms` | Terms of Service | Public legal page (Phase 35) |
| `/dev/autonomy` | Autonomy Dashboard | Dev-only debug tool |
| `*` | 404 | Not found |

### 3.2 Three-Panel Layout (Home)

The main app uses a three-panel layout with responsive breakpoints:

**Left Sidebar**
- Hatchin logo + branding
- Project search (`Cmd/Ctrl+K` shortcut)
- Theme toggle (dark mode forced currently)
- User dropdown (profile, settings, billing, logout)
- Hierarchical project tree: Projects → Teams → Agents (Maya hidden per `isSpecialAgent` filter)
- Inline renaming (double-click)
- Context menus (edit, delete with 3-second undo, pin/unpin)
- Delete undo via global popup (post-2026-05 undo overhaul, `911bbb2`)
- Search highlighting with regex matching
- Project creation flows (QuickStart, StarterPacks)

**Center Panel (Chat)**
- Chat header with project/team/agent name
- WebSocket connection status indicator
- **PROVIDER_DEGRADED banner** (Phase 35, 2026-05-11): shows when primary LLM provider is failing over
- Autonomous work indicator ("Team is working...")
- Pause/cancel autonomy buttons
- Message feed:
  - User messages (right-aligned, blue)
  - Agent messages (left-aligned, role-colored avatar + character name)
  - System messages (gray, informational)
  - Handoff cards (from-agent → to-agent animated visualization)
  - Deliberation cards (multi-agent coordination)
  - **AutonomousApprovalCard** (Approve/Reject for high-risk actions)
  - **DeliverableChatCard** (v2.0: inline deliverable preview + open in ArtifactPanel)
  - **ProposalCard** (v2.0: organic deliverable-intent detection)
- Message actions: react (thumbs up/down), reply (threading), copy
- `@agentName` routes to specific agent; `/route backend` sends to backend specialists
- Streaming with thinking indicators
- 20-second watchdog timeout for stuck streams
- Markdown rendering (GFM) with syntax highlighting
- Task suggestion extraction from chat
- Empty states for new projects with CTAs

**Right Sidebar (Tabbed, v1.3)**
- **Activity Tab**: Real-time autonomy feed, stats card (tasks completed, handoffs, cost), filter chips, **git-style run tree** (Phase 37, 2026-05-14) with semantic-word badges (✓ Improved, ⚠ Made worse)
- **Brain & Docs Tab**: Core direction editor, execution rules, team culture, document upload (PDF/DOCX/TXT/MD, 10MB max)
- **Approvals Tab**: Pending approvals, task pipeline view (Queued → Assigned → In Progress → Review → Done)
- Progress timeline (Explore → Build → Launch)
- Task manager with filters and status toggles
- **Autonomy dial** (4 levels: Observe / Propose / Confirm / Autonomous)
- Auto-save on blur with green checkmark confirmation

**ArtifactPanel (v2.0)**
- Right-side split panel that opens when viewing a deliverable
- Markdown rendering with section navigation
- Version history with restore
- "Refine" input for section-level iteration
- **Score chip** (Phase 36, 2026-05-11): shows deliverable rubric score with breakdown
- **AutoRevertBanner** (Phase 36): amber non-blocking indicator when a rubric score regresses vs. prior version
- Branded PDF export

### 3.3 Chat Features

**Streaming & Real-Time**
- WebSocket to `/ws`
- Token-by-token streaming with accumulated content display
- Typing indicators with agent names and estimated duration
- Real-time autonomy events pushed to sidebar
- **Prompt cache friendly split** (Phase A DeepSeek migration): `staticPrefix` (identity + rules, ~5,000 tokens, cacheable at 50× cheaper input) + `dynamicSuffix` (per-turn variables)

**Message Types**
- User, agent, system messages
- Handoff cards, deliberation cards, approval cards, deliverable cards, proposal cards
- Legal modal (Phase 35, 2026-05-11): first-visit acceptance for Privacy/Terms, deep-link hybrid

**Mentions & Routing**
- `@agentName` for direct routing
- `/route backend` for role-based routing
- Project-level chat routes to Maya first, PM Alex fallback
- Team-level chat scoped to team agents
- Conductor AI decides in multi-agent contexts

**Task Detection (rewritten 2026-03-31)**
- 5-intent classifier, zero LLM cost
- Lifecycle command parser: status, priority, assignee, delete, query, filtered_query, progress
- Organic extraction via Groq, 30-second cooldown, 0.7 Jaccard duplicate detection
- Assigned-tasks injected into agent prompts with overdue warnings
- Completion detection from agent responses

**Imperative Action Shortcuts (Phase 36.5, 2026-05-13)**
- Regex-based imperative-command parser fires actions BEFORE LLM call
- Recognizes: create-agent, create-task, rename-project, set-brain-field
- Lowers Maya's turn-count gate on first use
- Probe spec (`agent-action-probe.spec.ts`) is the regression guard

### 3.4 Modals & Flows

| Modal | Trigger | Purpose |
|---|---|---|
| WelcomeModal | First login | Animated egg + "Your AI team just woke up" |
| QuickStartModal | "New Project" | Idea-based project creation with Maya |
| StarterPacksModal | "Use Template" | 38 templates across 7 categories |
| ProjectNameModal | Post-creation | Name confirmation with validation |
| AddHatchModal | "Add Agent" | Browse all 30 roles or team templates |
| OnboardingSteps | Post-signup | 4-step walkthrough (ChatPreview, AgentHatch, BrainFill, ChatProgress) |
| TaskSuggestionModal | AI detects tasks | Review + bulk approve/reject |
| UpgradeModal | Tier limit hit | Free vs Pro comparison + Stripe checkout |
| EggHatchingAnimation | Project creation | 3-stage animated loading |

### 3.5 Mobile Responsiveness

- Breakpoint: `< 1024px` triggers mobile layout
- Left sidebar becomes a Sheet drawer (hamburger)
- Right sidebar becomes a Sheet drawer (panel toggle)
- Center panel fills full width
- Mobile header bar with menu and panel toggle buttons
- Swipe gesture support on drawers

### 3.6 Theme & Visual Design

- Dark mode forced (`FORCE_DARK_MODE = true`)
- CSS custom properties: `--hatchin-blue`, `--hatchin-card`, `--hatchin-border-subtle`, `--glass-frosted-strong`
- Role-based bubble colors (each of 30 roles has a unique scheme)
- Framer Motion animations (page transitions, modals, messages, egg hatching)
- Gradient backgrounds, glass morphism, shadow elevation system
- Custom scrollbar behavior (hide on idle, show on scroll)

### 3.7 Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl+K` | Focus project search |
| `Enter` | Send message |
| `Shift+Enter` | New line |
| `Escape` | Clear search, close modal, cancel reply |

---

## 4. All 30 AI Agent Roles

Each role has a character name, emoji, color identity, voice prompt, domain expertise, critical thinking style, pushback behavior, collaboration style, handoff protocol, and peer review lens.

### Complete Role Roster

| # | Role | Character | Emoji | Color | Domain |
|---|---|---|---|---|---|
| 1 | Product Manager | Alex | 📋 | Blue | Product strategy, roadmaps, prioritization |
| 2 | Business Analyst | Morgan | 💼 | Purple | Requirements, stakeholder analysis, process modeling |
| 3 | Backend Developer | Dev | ⚙️ | Gray | APIs, databases, server architecture |
| 4 | Software Engineer | Coda | 💻 | Blue | Full-stack development, system design |
| 5 | Technical Lead | Jordan | 🏗️ | Blue | Architecture decisions, tech debt, code review |
| 6 | AI Developer | Nyx | 🤖 | Green | ML/AI systems, model selection, data pipelines |
| 7 | DevOps Engineer | Remy | 🔧 | Amber | CI/CD, infrastructure, deployment, monitoring |
| 8 | Product Designer | Cleo | 🎨 | Green | User research, interaction design, prototyping |
| 9 | UX Designer | Lumi | 👥 | Green | Usability, user flows, accessibility |
| 10 | UI Engineer | Finn | ⚡ | Amber | Frontend implementation, design systems, performance |
| 11 | UI Designer | Arlo | 🎨 | Blue | Visual design, layouts, typography |
| 12 | Designer | Roux | 🖌️ | Green | General design, illustration, visual storytelling |
| 13 | Creative Director | Zara | 🎬 | Purple | Brand vision, creative strategy, campaign direction |
| 14 | Brand Strategist | Cass | 🏷️ | Blue | Brand identity, positioning, messaging frameworks |
| 15 | QA Lead | Sam | ✓ | Green | Testing strategy, quality gates, bug triage |
| 16 | Content Writer | Mira | 📝 | Blue | Long-form content, documentation, storytelling |
| 17 | **Copywriter (Wren, tactical enrichment 2026-07-10)** | Wren | ✍️ | Green | Short-form copy, headlines, CTAs, ad copy, PAS/BAB/AIDA frameworks, banned-word discipline |
| 18 | **Growth Marketer (Kai, tactical enrichment 2026-07-10)** | Kai | 📈 | Green | Growth loops, CRO diagnosis-order (value-prop → headline-match → CTA → hierarchy → trust → objections → friction), 4-section CRO output (Quick Wins / High-Impact / Test Ideas / Copy Alternatives) |
| 19 | Marketing Specialist | Nova | 📢 | Purple | Campaign planning, channel strategy, analytics |
| 20 | Social Media Manager | Pixel | 📱 | Purple | Social content, community management, trends |
| 21 | **SEO Specialist (Robin, tactical enrichment 2026-07-10)** | Robin | 🔍 | Amber | Search intent + authority, audit-priority order, schema-detection tooling caveat (web_fetch cannot detect JS-injected JSON-LD), hreflang reciprocity + ISO codes + canonical-in-set rules |
| 22 | Email Specialist | Drew | 📧 | Blue | Email sequences, automation, deliverability |
| 23 | Data Analyst | Rio | 📊 | Amber | Data visualization, SQL, business intelligence |
| 24 | Data Scientist | Sage | 📉 | Purple | Statistical modeling, ML experiments, A/B tests |
| 25 | Operations Manager | Quinn | ⚡ | Purple | Process optimization, resource planning, workflows |
| 26 | Business Strategist | Blake | 📊 | Purple | Market analysis, competitive intelligence, business models |
| 27 | HR Specialist | Taylor | 👥 | Green | Hiring, culture, team dynamics, onboarding |
| 28 | Instructional Designer | Lee | 🎓 | Blue | Curriculum design, learning experiences, course structure |
| 29 | Audio Editor | Vince | 🎵 | Amber | Audio production, podcast editing, sound design |
| 30 | **Idea Partner (Maya)** | Maya | ✦ | Teal | **SPECIAL**: project-level intelligence, brainstorming, strategic guidance, voice snaps to committed-synthesizer at level 4 (Phase 38-03) |

### Role Intelligence Architecture

Every role has TWO data sources kept intentionally separated so adding role #31+ requires only appending to these two arrays:

**[shared/roleRegistry.ts](shared/roleRegistry.ts)** — Identity & Personality:
- `voicePrompt` — How the agent speaks (unique writing style)
- `negativeHandling` — How they push back on bad ideas
- `criticalThinking` — How they analyze and challenge assumptions
- `collaborationStyle` — How they work with other agents
- `domainDepth` — Deep domain-specific expertise areas
- `neverSays` — Phrases the agent avoids

**[shared/roleIntelligence.ts](shared/roleIntelligence.ts)** — Expertise & Autonomy:
- `reasoningPattern` — How they think (engineering: hypothesis→test; design: diverge→converge; growth: constraint→hypothesis→experiment→measurement→scale-or-kill)
- `outputStandards` — Quality benchmarks for their deliverables
- `peerReviewLens` — What they look for when reviewing others' work (7 categories: engineering, design, data, strategy, marketing, QA, ops)
- `handoffProtocol` — Structured context for passing/receiving work (`passes` and `receives` formats)
- `escalationRules` — When they should ask for help vs. proceed autonomously
- `baseTraitDefaults` — Default personality traits (formality, verbosity, empathy, directness, enthusiasm, technicalDepth)

### Prompt Injection Layout (current, post-Phase A)

For each LLM call, the assembled prompt is:

```
staticPrefix (cacheable identity — hits DeepSeek's 50x cheaper cache-hit pricing)
├── Character voice
├── ROLE EXPERTISE (single merged block, was PROFESSIONAL DEPTH + DOMAIN INTELLIGENCE):
│   ├── Domain (from roleProfile.domainDepth)
│   ├── Reasoning (from roleIntelligence.reasoningPattern)
│   ├── Output standard (from roleIntelligence.outputStandards)
│   ├── Critical thinking (from roleProfile.criticalThinking)
│   ├── Pushback (from characterProfile.negativeHandling)
│   └── Collaboration (from characterProfile.collaborationStyle)
├── 14 response rules
└── AGENT_CAPABILITY_ENVELOPE (Phase 38-04, universal, always present)

dynamicSuffix (per-turn, NOT cached)
├── Recent messages
├── Project brain + tasks + memory
├── User message
├── AUTONOMOUS_DIRECTIVE_BLOCK (if autonomyLevel === 'autonomous')
└── MAYA_AUTONOMOUS_OVERRIDE (if autonomous AND isSpecialAgent)
```

`peerReviewLens` and `handoffProtocol` are NOT injected into chat prompts. They are consumed downstream by [peerReviewRunner.ts](server/autonomy/peerReview/peerReviewRunner.ts) and [handoffOrchestrator.ts](server/autonomy/handoff/handoffOrchestrator.ts).

### Maya Special Agent Rules

- `isSpecialAgent: true` in [shared/roleRegistry.ts](shared/roleRegistry.ts)
- Hidden from sidebar: [client/src/components/ProjectTree.tsx](client/src/components/ProjectTree.tsx) filters `!a.isSpecialAgent` on both team and individual agent lists
- Routing priority: Conductor and `resolveSpeakingAuthority` route project-level chat to Maya first, PM Alex second
- Welcome message: [server/routes/projects.ts](server/routes/projects.ts) inserts Maya's greeting on project creation (idea + starter pack variants)
- No 1-on-1 conversation: Maya speaks at project level only
- **At autonomy level 4**: `MAYA_AUTONOMOUS_OVERRIDE` block appended AFTER `AUTONOMOUS_DIRECTIVE_BLOCK` snaps her voice from exploratory-partner ("I keep coming back to...") to committed-synthesizer ("Here's what I'd do: X. Because Y. Flag if wrong."), while preserving her intellectual liveness

### Marketing Role Tactical Enrichment (Wren / Kai / Robin, 2026-07-10)

Three roles received `reasoningPattern` / `outputStandards` / `peerReviewLens` upgrades adapted from [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) (MIT, © 2025 Corey Haines). Append-only edit; original strategic frameworks preserved; tactical layer added.

A/B eval validated 2026-07-10: **7/9 → 9/9 markers (+22pp lift)**. Wren gained numeric specificity ("Automate 80% of your team's busywork in minutes, not months" vs abstract "Automate the Ordinary, Elevate the Exceptional"). **Robin prevented schema-confabulation textbook** (baseline confidently claimed "I found that the site is missing schema markup" from text-fetched HTML that strips JSON-LD; upgrade correctly declined and offered structured audit).

Other 27 roles untouched.

---

## 5. Starter Pack Templates

38 templates across 7 categories, each pre-configuring a project with specific agents and welcome messages. See [shared/templates.ts](shared/templates.ts).

### Business + Startups (5)
- SaaS Startup — Alex (PM), Coda (Engineer), Cleo (Designer), Kai (Growth)
- AI Tool Startup — Nyx (AI Dev), Jordan (Tech Lead), Blake (Strategy), Morgan (BA)
- Marketplace App — Alex (PM), Dev (Backend), Lumi (UX), Rio (Data)
- Solo Founder Support — Maya + Blake (Strategy), Kai (Growth), Mira (Content)
- Investor Deck Sprint — Blake (Strategy), Zara (Creative), Wren (Copy), Rio (Data)

### Brands & Commerce (4)
- E-commerce Launch — Cleo, Kai, Drew, Robin
- DTC Brand Strategy — Cass, Zara, Nova, Pixel
- Amazon Optimization — Robin, Rio, Wren, Quinn
- Product Packaging — Arlo, Zara, Cass, Roux

### Creative & Content (6)
- Creative Studio — Zara, Roux, Arlo, Vince
- Portfolio Builder — Finn, Cleo, Mira, Robin
- Content Calendar — Mira, Pixel, Robin, Wren
- YouTube Strategy — Vince, Pixel, Wren, Rio
- Podcast Launch — Vince, Mira, Nova, Drew
- Media Production — Zara, Vince, Roux, Quinn

### Freelancers & Solopreneurs (4)
- Freelance Brand Kit — Cass, Arlo, Wren, Cleo
- Client Pitch Kit — Blake, Wren, Zara, Morgan
- Notion Template Business — Cleo, Kai, Drew, Robin
- Newsletter Strategy — Drew, Mira, Kai, Rio

### Growth & Marketing (4)
- Launch Campaign — Kai, Nova, Wren, Rio
- Ad Funnel Builder — Kai, Wren, Rio, Drew
- SEO Sprint — Robin, Mira, Rio, Dev
- Email Sequence Builder — Drew, Wren, Kai, Rio

### Internal Teams & Ops (3)
- Team Onboarding — Taylor, Quinn, Lee, Mira
- Weekly Sync System — Alex, Quinn, Rio, Morgan
- Internal Wiki Setup — Mira, Lee, Quinn, Dev

### Education & Research (3)
- Online Course Builder — Lee, Mira, Cleo, Kai
- Academic Research — Sage, Mira, Morgan, Rio
- Slide Deck Assistant — Zara, Wren, Arlo, Cleo

### Personal & Experimental (5)
- Side Hustle Brainstormer — Blake, Kai, Wren, Rio
- Life Dashboard — Quinn, Rio, Taylor, Cleo
- AI Character Creator — Nyx, Zara, Mira, Roux
- Personal Knowledge Base — Lee, Mira, Dev, Quinn
- Moodboard Generator — Roux, Zara, Arlo, Cass

Each template ships with 3 pre-drafted deliverable packages (v2.0): launch, content-sprint, research.

---

## 6. AI System Architecture

### Core AI Flow (Per Message)

```
1. WebSocket receives send_message_streaming
2. Snapshot autonomyLevel at task-entry boundary
3. Parse mentions/routes (@engineer, /route backend)
4. Imperative Action Shortcut check (Phase 36.5) — fires BEFORE LLM call if
   regex matches create-agent / create-task / rename-project / set-brain-field
5. Conductor: resolve which agent(s) should respond
   - Project-level: Maya priority, PM Alex fallback
   - Team-level: best match from team agents
   - 1-on-1: that specific agent
6. Safety gate: score risk across 3 dimensions
   - hallucinationRisk (absolute claims, missing uncertainty, future predictions)
   - scopeRisk (cross-project conflicts, conversation mode mismatch)
   - executionRisk (destructive verbs + bulk/data scope multipliers,
     evasion patterns, prompt injection, RISKY_EXECUTION substring hits)
7. Risk routing:
   - >= 0.70: block, request clarification, fire safety_intervention WS event
   - 0.35 to 0.69: peer review required
   - < 0.35: auto-complete
8. Assemble prompt: staticPrefix (cacheable identity + capability envelope) +
   dynamicSuffix (per-turn variables + optional autonomous directive + optional
   Maya override)
9. Provider chain: DeepSeek V4-Flash primary → Gemini 2.5-Flash hot fallback →
   Groq llama-3.3-70b free safety net
10. Stream response chunks via WebSocket
11. Tone post-processing: enforce rules, autonomy-aware soft-closing suppression
12. Task detection: 5-intent classifier + organic extraction via Groq
13. Brain updates: detect project direction changes
14. Store message in DB (Supabase Postgres via node-postgres)
15. Emit streaming_completed
```

### Conductor System

The conductor ([server/ai/conductor.ts](server/ai/conductor.ts)) decides which agent responds to each message:
- Role inference from keywords ("QA", "backend", "design" trigger specialists)
- Maya priority for project-level conversations
- Specialty matching via expertise scoring
- Safety integration (risk score affects routing)
- Deliberation detection (multi-agent keywords trigger coordination)
- Returns: primary agent, fallback agents, safety score, reasoning
- Sets `interventionRequired = needsClarification(safetyScore)` — fires the `safety_intervention` WS event at [chat.ts:2299](server/routes/chat.ts) when `executionRisk ≥ 0.70`

### Prompt Construction (post-Phase A)

Two-part split for DeepSeek cache-friendly pricing (50× cheaper on cache hit):

**staticPrefix (cacheable, ~5,000 tokens):**
1. Character identity (`agentName`, `roleTitle`, `voicePrompt`, `personality`)
2. `ROLE EXPERTISE` single merged block (Domain, Reasoning, Output standard, Critical thinking, Pushback, Collaboration)
3. 14 response rules
4. `AGENT_CAPABILITY_ENVELOPE` (Phase 38-04, universal, always present)

**dynamicSuffix (per-turn, breaks cache):**
1. Recent messages
2. Project brain (core direction + execution rules + team culture)
3. Task context
4. User message
5. `AUTONOMOUS_DIRECTIVE_BLOCK` (Phase 38-01, if `autonomyLevel === 'autonomous'`)
6. `MAYA_AUTONOMOUS_OVERRIDE` (Phase 38-03, if autonomous AND `agentIsSpecial`)

### Response Prose Rules (enforced via tone post-processing at [server/ai/responsePostProcessing.ts](server/ai/responsePostProcessing.ts))

- No markdown headers (`#`, `##`) in chat responses
- No bullet lists in chat (weave into natural sentences)
- Maximum 1 question per reply
- Natural endings, no "Next step:" or "Let me know how..."
- Match user's message length (short in, short out)
- Show genuine reactions and curiosity
- Never start with "Great!" or sycophantic openers
- Human-like colleague tone, not assistant tone
- **Autonomy-aware soft-closing suppression** (Phase 38-01 Site 3 fix, 2026-07-09): `applyAdaptiveClosing` early-returns when `autonomyLevel === 'autonomous'` so trailing "What's the next thing on your mind?" cannot leak past the directive

### Action Blocks (parsed from agent responses)

```
[[PROJECT_NAME: My Project]]                 → update project name
[[TASK: description]]                        → create task suggestion
[[UPDATE: field: value]]                     → update brain field
[[HATCH_SUGGESTION: {teams:[...]}]]          → propose a team (Maya at project level)
```

These are the ONLY four action blocks agents can propose. The capability envelope explicitly names them in the CAN list so agents know they can commit these actions declaratively.

---

## 7. Autonomy System

### Background Execution (v1.1)

Users tell agents to "go ahead and work on this". Agents execute in the background producing real deliverables.

**Task Execution Pipeline** ([server/autonomy/execution/taskExecutionPipeline.ts](server/autonomy/execution/taskExecutionPipeline.ts)):
- Background task batching: groups same-agent tasks (up to 3 per batch), 5s collection window
- Single LLM call amortizes system prompt (30 to 50% cost savings)
- Falls back to solo execution on parse failure
- Per-project daily cost cap prevents runaway LLM spend
- If user goes idle 2+ hours, queued work starts automatically
- **D-11..D-13 safety-floor invariant**: `grep -c clarificationRequiredRisk taskExecutionPipeline.ts` must equal **7** (this session verified: preserved). Phase 38-02 made the gate actually fire on destructive intent (previously behaviorally hollow).

**Safety Gates**:
| Risk | Action | Experience |
|---|---|---|
| < 0.35 | Auto-complete | Invisible |
| 0.35 to 0.59 | Peer review | Another agent reviews before delivery |
| ≥ 0.70 | User approval | Inline Approve/Reject card |

**Role-Aware Risk**: `getRoleRiskMultiplier()` adjusts thresholds:
- Infrastructure roles (DevOps, Backend) escalate sooner
- Creative roles (Designer, Writer) get more autonomy

### Autonomy Dial (4 levels, v1.3)

| Level | Name | What Changes |
|---|---|---|
| 1 | **Observe** | Agents wait for direct address; no background work |
| 2 | **Propose** | Agents suggest; user clicks to execute |
| 3 | **Confirm** (default) | 1 clarifying question per turn; explicit tasks only in background |
| 4 | **Autonomous** | `AUTONOMOUS_DIRECTIVE_BLOCK` fires; Maya voice snaps; capability envelope still gates fake actions; safety floor still fires on destructive intent |

Snapshot at task-entry boundary: mid-run downgrades apply to NEXT task, not in-flight.

### Agent Handoffs (v1.1)

When one agent finishes a task, the system routes the next task to the right specialist.

**Handoff Orchestrator** ([server/autonomy/handoff/handoffOrchestrator.ts](server/autonomy/handoff/handoffOrchestrator.ts)):
- Finds dependent tasks (marked with `metadata.dependsOn`)
- Conductor routes to next specialist based on task description
- BFS cycle detection prevents infinite loops
- Max hops limit (default 4) prevents runaway chains
- Structured handoff context via `handoffProtocol`:
  - Each role defines what it `passes` (output format) and `receives` (expected input)
  - Previous agent's output attached to task metadata
- In-character handoff announcements ("Done with the scope, tagging @Engineer")
- Broadcasts `handoff_initiated` event to Activity feed
- Written to `autonomy_run_steps` for the run-tree visualization

### Progressive Trust Scoring (v1.1)

**Trust Scorer** ([server/autonomy/trustScoring/trustScorer.ts](server/autonomy/trustScoring/trustScorer.ts)):
```
success_rate    = tasksCompleted / (tasksCompleted + tasksFailed)
maturityFactor  = min(1.0, totalTasks / 10)
trustScore      = success_rate * maturityFactor
```
- Agents need 10+ completions to reach full trust potential
- 3 completions with 0 failures = 0.3 trust, not 1.0 (bounded [0.0, 1.0])

**Trust Adapter** ([server/autonomy/trustScoring/trustAdapter.ts](server/autonomy/trustScoring/trustAdapter.ts)):
- Adjusts safety thresholds based on trust
- Max boost: +0.15 on peer review trigger and clarification threshold
- High-trust agents skip some gates; low-trust agents need more supervision
- Trust does NOT boost destructive-intent detection (Plan 38-02: the safety floor is universal)

### Git-Style Run Tree (Phase 37, 2026-05-14)

Every autonomous run is written to `autonomy_runs` + `autonomy_run_steps` and rendered as a tree in the Activity tab:

- Parent-link on `handoff_initiated` events shows agent-to-agent flow
- Click-step opens the exact deliverable version that step produced
- **Semantic-word badges** per [feedback_ui_self_documenting.md](https://claude.ai/): ✓ Improved, ⚠ Made worse (no bare numbers, no abstract icons)
- Foreground streaming visibility is a known gap → Phase 47 backlog item #10

### Autonomy Events

All autonomy activity logged for audit:

**Event types**: `task_started`, `task_completed`, `task_failed`, `task_retried`, `peer_review_started`, `peer_review_completed`, `peer_review_revised`, `handoff_initiated`, `handoff_cycle_detected`, `safety_triggered`, `synthesis_completed`, `deliberation_started`, `run_tree_step`

**Storage**: Dual backend — PostgreSQL primary + file fallback (`baseline/autonomy-events.jsonl`)

### Deliberation Traces

Multi-agent deliberation is tracked:
- UNIQUE `trace_id` per deliberation (enforced by DB constraint)
- Per-round agent contributions in `deliberation_traces.rounds` JSONB
- Peer review feedback in `deliberation_traces.review` JSONB
- Final synthesis decision in `deliberation_traces.final_synthesis`

---

## 8. Agents Policing Each Other (Peer Review Deep Dive)

Agents self-audit through a cross-agent peer review system. This is where the "team of colleagues" metaphor becomes literal: Alex can catch Coda's over-engineering, Sam can catch Wren's weak CTA, Robin can catch Nova's schema confabulation.

### When Peer Review Triggers

At [server/autonomy/peerReview/peerReviewRunner.ts](server/autonomy/peerReview/peerReviewRunner.ts):

- Aggregate risk score ≥ 0.35 (mid-tier gate)
- Confidence score < 0.55
- Factual claims detected in the draft (`predict`, `research`, `evidence`, `data`, `citation` keywords)
- Explicit user recheck ("are you sure", "double-check that")
- Proposal turn (agent is proposing an action)
- Safety-sensitive context (destructive verb match from Plan 38-02, cross-project scope, prompt injection)
- Canon contradiction (agent's claim contradicts stored knowledge)

### The Peer Review Process

1. **Select 2 reviewers** from the project's agents, excluding the primary agent who authored the draft. Reviewers are chosen by role-lens fit for the content type.

2. **Each reviewer uses their role-specific `peerReviewLens`** from [shared/roleIntelligence.ts](shared/roleIntelligence.ts). Seven category lenses:

| Lens | Roles that own it | What they look for |
|---|---|---|
| **engineering** | Coda, Dev, Jordan, Finn, Nyx, Remy | Correctness, edge cases, complexity, test coverage, security, performance |
| **design** | Cleo, Lumi, Arlo, Roux, Zara | Usability, accessibility, visual hierarchy, brand consistency, information density |
| **data** | Rio, Sage | Statistical validity, sample size, confounders, vanity vs actionable metrics |
| **strategy** | Blake, Morgan, Alex | Second-order effects, competitive framing, resource realism, tradeoffs |
| **marketing** | Wren, Kai, Nova, Robin, Drew, Pixel, Cass | Persuasion mechanics, banned words, specificity, CTA hierarchy, schema-detection honesty |
| **QA** | Sam | Failure modes, missing test cases, ambiguous acceptance criteria |
| **ops** | Quinn, Taylor | Process feasibility, dependency chains, ownership clarity |

3. **Domain-specific rubric evaluation**: Each reviewer produces a structured verdict with issues found, severity, and suggested revisions.

4. **Revision synthesis**: The runner either
   - Applies fixes if reviewers agree on a specific patch
   - Requests clarification from the user if reviewers disagree fundamentally
   - Escalates to user approval if severity is high

5. **High-risk gate**: When aggregate risk ≥ 0.65 (double review trigger), the runner uses 2 reviewers by default. Below that, 1 reviewer.

### Peer Review Verdict Categories

- **APPROVED**: Ships as-drafted
- **REVISED**: Runner applies suggested fixes and ships
- **CLARIFICATION_REQUIRED**: Kicks back to user with the reviewer's concern
- **BLOCKED**: Reviewer found a hard failure (security, factual error, capability violation) → user approval required

### Marketing Peer Review Examples (with tactical enrichment)

Post-2026-07-10, the marketing lens roles catch specific failure modes:

- **Wren reviewing Copy**: flags banned words (streamline, utilize, leverage, innovative, robust, seamless), passive voice in headline/CTA, adjectives-doing-evidence-work without numbers, multiple competing CTAs above fold
- **Kai reviewing CRO output**: flags recommendations that don't identify page type, don't state primary conversion goal, don't name traffic source, or add trust signals before checking headline-source match
- **Robin reviewing SEO output**: flags "no schema found" claims from `web_fetch` alone (correct answer: use Rich Results Test), non-reciprocal hreflang, invalid ISO codes (en-UK is wrong, en-GB is right), cross-locale canonicals

### Cross-Agent Verdict Propagation

Peer review outcomes feed [trustAdapter.ts](server/autonomy/trustScoring/trustAdapter.ts):
- APPROVED verdicts increase the drafter's trust score
- REVISED verdicts are neutral (trust unchanged, but reviewer's trust bumps up for catching)
- CLARIFICATION_REQUIRED and BLOCKED reduce the drafter's trust slightly
- Reviewers who consistently catch bugs earn a higher trust multiplier of their own

---

## 9. Growing and Learning From Each Other

Hatchin agents aren't static prompts. They evolve along four separate learning tracks that compound over sessions.

### Track 1: Personality Evolution per User

[server/ai/personalityEvolution.ts](server/ai/personalityEvolution.ts)

Every agent has a set of base personality traits (formality, verbosity, empathy, directness, enthusiasm, technicalDepth) declared in [shared/roleIntelligence.ts](shared/roleIntelligence.ts) as `baseTraitDefaults`. These are the starting point.

User feedback shifts the traits per-user:
- Thumbs-up on a message → moves trait vector slightly toward the values that produced the reply
- Thumbs-down → moves it away
- Message content signals (short/long, formal/casual, technical/general) feed the classifier
- Adapted traits are stored in `agents.personality.adaptedTraits` JSONB, keyed by user ID
- Seeded from role defaults on first interaction with a new user
- Persisted across sessions (v1.0 shipped this: previously in-memory)

**Outcome**: Over 20-30 messages, Alex talks to a senior engineer more tersely and technically than he does to a first-time founder, even though he's "the same" Alex.

### Track 2: Progressive Trust Scoring

[server/autonomy/trustScoring/trustScorer.ts](server/autonomy/trustScoring/trustScorer.ts)

Every agent has a trust score bounded [0.0, 1.0], derived from actual task outcomes:

```
success_rate    = tasksCompleted / (tasksCompleted + tasksFailed)
maturityFactor  = min(1.0, totalTasks / 10)
trustScore      = success_rate * maturityFactor
```

- Fresh agents start at 0.0 and require 10+ completions to reach full trust potential
- Failure ratio matters more than raw count (10 successes with 1 failure > 20 successes with 5 failures)
- Trust feeds the [trustAdapter.ts](server/autonomy/trustScoring/trustAdapter.ts) which adjusts safety thresholds:
  - Max boost of +0.15 on `peerReviewTrigger` (0.35 → 0.50)
  - Max boost of +0.15 on `clarificationRequiredRisk` (0.70 → 0.85)
- **Trust does NOT boost destructive-intent detection**: the Plan 38-02 safety floor is universal. Coda at 1.0 trust still gets blocked on "delete all my data".

**Outcome**: A high-trust Sam runs QA reviews without asking the user every time. A low-trust newly-added Finn double-checks with peer review even on low-risk work.

### Track 3: Reasoning Cache (Cross-Session Pattern Reuse)

[server/ai/reasoningCache.ts](server/ai/reasoningCache.ts)

In-memory, 1-hour TTL, project-scoped cache of reasoning patterns:
- When an agent solves a problem, the reasoning path is hashed and cached
- Next time a similar problem arises in the same project, the cached reasoning is available as context
- Reduces LLM cost on repeated patterns
- Cleared on project scope changes to prevent cross-project leakage

**Outcome**: If Alex worked out a scoring rubric last hour, the same session doesn't re-derive it: the cached rubric ships as prompt context.

### Track 4: Autonomous Knowledge Loop (AKL)

[server/knowledge/akl/](server/knowledge/akl/)

Agents propose knowledge updates that get validated and stored:

**Update Cards** ([updateCard.ts](server/knowledge/akl/updateCard.ts)):
- Role, field, evidence (citations with URL, source date, summary, confidence)
- Tags, confidence score, expiry date

**Governance** ([governance.ts](server/knowledge/akl/governance.ts)):
- Citation validation (non-empty required)
- Source trust tiers (Tier A/B/C domains)
- Low-trust sources (Tier C) capped at confidence 0.55
- 120 updates per role cap (rotates oldest out)
- Expired updates pruned automatically

**Knowledge Loop Runner** ([runner.ts](server/knowledge/akl/runner.ts)):
- Monitors project brain for contradiction signals
- Agents propose knowledge updates (confidence-weighted)
- **Peer review validates before persistence** (Track 3 feeds into Track 4)
- Broadcasts knowledge updates to project

**Outcome**: When Kai discovers a new CRO pattern in one project, it gets stored, cited, and available to other Kai instances. Roles teach the role.

### Track 5: Frozen Rubric Deliverable Iteration (Phase 36, 2026-05-13)

Fifteen frozen rubrics ([shared/deliverableRubrics.ts](shared/deliverableRubrics.ts), Zod-validated, `Object.freeze` invariant) score deliverables per iteration:

- Groq judge scores each deliverable version against its rubric
- **Auto-revert on score regression**: if a new iteration scores lower than the prior version, the runner reverts and surfaces an `AutoRevertBanner`
- Score chip in the Artifact panel shows per-criterion breakdown
- Agent-prompt feedback signal injection: the losing agent sees the rubric feedback and adjusts its next iteration
- FBK-02 UI deferred per user simplification (server endpoints persist)

**Outcome**: Agents can iterate their own drafts without shipping worse versions. The rubric is the "boss" that they can't overrule silently.

### Learning Signals Cross-Feed

The tracks aren't isolated:

| From | To | Signal |
|---|---|---|
| User reaction (Track 1) | Personality traits | Thumbs up/down shifts traits |
| Task outcome (Track 2) | Trust score | Success/fail updates score |
| Trust score (Track 2) | Safety threshold (Section 20) | High trust relaxes gates (except destructive) |
| Peer review verdict (Section 8) | Trust score (Track 2) | Reviewer catches raise reviewer trust; drafter revisions lower drafter trust slightly |
| Reasoning pattern (Track 3) | Prompt context | Cached rationale injects into next similar prompt |
| Knowledge update (Track 4) | All agents in project | Broadcast so other roles see the update |
| Rubric score (Track 5) | Agent-prompt feedback | Losing agents see the criterion breakdown next iteration |

**Emergent behavior**: Over a few weeks in a real project, the agents "know" that user better than a fresh-instantiated version would. The team is measurably different from what came out of the box.

---

## 10. AI Slop Prevention (Phase 38 stack)

Phase 38 addresses the class of failures where LLMs confidently claim to have done things they cannot do, ask endless clarification instead of committing, or hedge into unusability at maximum autonomy. Four plans shipped in code:

### Plan 38-01: Autonomous Directive (ALWY-01, 2026-06-21)

At `autonomyLevel === 'autonomous'`, an XML-delimited [`<autonomous_directive>`](server/ai/promptTemplate.ts) block appends to `dynamicSuffix`. Eight D-04 principles the LLM must follow:

1. **Commit, don't hedge.** "I'll" not "Should I". Declarative, not question.
2. **State assumptions out loud.** "Going with X because Y, flag if wrong."
3. **Don't pause between subtasks.** Finish the chain; report when done.
4. **No hedging filler.** Drop "maybe", "perhaps", "I think".
5. **Correction AFTER, not permission BEFORE.**
6. **When stuck, frame as a real binary.**
7. **Inline justification.** Brief because-clause on non-obvious choices.
8. **Deliverable outputs lead with an Assumptions section** at the top listing premises.

Safety gates still apply independently.

### Plan 38-02: Safety Scorer Destructive-Intent Detection (ALWY-04, 2026-07-09)

[server/ai/safety.ts::scoreDestructiveIntent()](server/ai/safety.ts) with four regex sets:

| Set | Pattern | Weight |
|---|---|---|
| `DESTRUCTIVE_VERB_CRITICAL` | `\b(delete\|wipe\|nuke\|erase\|destroy\|obliterate)\b` | base 0.60 |
| `DESTRUCTIVE_VERB_RESET` | `\b(reset\|start over\|restart\|clean slate)\b` | base 0.45 |
| `BULK_SCOPE` | `\b(all\|everything\|every\|entire)\b` | multiplier ×1.3 |
| `DATA_SCOPE` | `\b(data\|database\|db\|project\|history\|conversations?\|messages?\|tasks?\|team\|agents?\|brain)\b` | multiplier ×1.2 |

Merged via `Math.max(existing_executionRisk, destructiveIntentScore)`. Test results:

| Input | Score | Fires 0.70 gate? |
|---|---|---|
| "delete all my data and start over" | 0.936 | Yes |
| "wipe everything" | 0.780 | Yes |
| "nuke this project" | 0.720 | Yes |
| "destroy the database" | 0.720 | Yes |
| "delete this typo" | 0.600 | No (correct, targeted) |
| "write me a marketing plan" | 0.100 | No (correct, benign) |

Verified: 12/12 unit + 2/2 Playwright on live server + D-11..D-13 grep=7 preserved.

### Plan 38-03: Maya Voice Snap at Level-4 (ALWY-05, 2026-07-10)

[server/ai/promptTemplate.ts::MAYA_AUTONOMOUS_OVERRIDE](server/ai/promptTemplate.ts) block appended AFTER `AUTONOMOUS_DIRECTIVE_BLOCK` when autonomous AND `agentIsSpecial`. Explicitly instructs Maya:

- Do NOT open with "I keep coming back to..." or question-shape openers
- DO open with "Here's what I'd do: X. Because Y. Flag if wrong."
- Preserve intellectual liveness, but land the plane

Also fixed a Plan 38-01 residual: `buildProviderOrder` had no `capture` branch, so the phase-38 Playwright spec was silently running against `mock` instead of `capture`. Fixed.

### Plan 38-04: Universal Capability Envelope (ALWY-06, 2026-07-10)

[server/ai/promptTemplate.ts::AGENT_CAPABILITY_ENVELOPE](server/ai/promptTemplate.ts) universal block injected into `staticPrefix`. Declares:

**CAN list:**
- Propose a team via `[[HATCH_SUGGESTION:{...}]]`
- Propose a task via `[[TASK: description]]`
- Propose a brain-field update via `[[UPDATE: field: value]]`
- Propose a project rename via `[[PROJECT_NAME: NewName]]`
- Discuss, plan, design, draft, review, synthesize (all text-shaped work)

**CANNOT list:**
- Delete, wipe, erase, or remove any data, project, team, agent, task, message, or file
- Modify the database directly or run any SQL
- Execute code, run scripts, or call external APIs
- Access the file system, read or write files, or scan directories
- Deploy anything, restart services, or change infrastructure
- Perform any action outside of appending one of the four `[[...]]` proposal blocks

**Enforcement line:**
> NEVER describe having performed an action you cannot perform. NEVER use language like "I've deleted...", "I'll wipe...", "wiping now...", "cleared the...", "reset the database..." unless the sentence is immediately followed by one of the four `[[...]]` blocks that literally propagates the action.

**Prompt ordering** (strict): envelope (identity, always present) → autonomous_directive (if L4) → maya_autonomous_override (if L4 + Maya).

Verified: 19/19 unit + 2/2 Playwright on live Groq server. Destructive command → safety_intervention fired (defense in depth with Plan 38-02) with zero fake-action language. Benign migration-planning → 247-char substantive response, no over-firing.

### Plan 38-05: Human Vibe-Check (ALWY-02 final closure, pending)

The last piece. Human at browser, four test prompts at level-4:
1. Commit-shape opener test (no exploratory "I keep coming back to...")
2. Destructive command test (approval card OR honest disclaimer, NOT fake action)
3. Mid-run dial-flip test (snapshot boundary applies to next message)
4. Second destructive verb test (envelope generalizes across verbs)

When all four pass, `38-VERIFICATION.md` gets written and Phase 38 closes.

---

## 11. Deliverable System (v2.0)

Shipped 2026-03-30. Transforms Hatchin from "AI chatroom" to "AI team that ships coordinated work."

### 15 Deliverable Types

Each type has a role-to-type mapping and a canonical section schema:

| Type | Primary Role | Sections |
|---|---|---|
| PRD | Alex (PM) | Problem, Goals, Non-goals, User Stories, Requirements, Metrics, Risks |
| Blog Post | Mira (Content) | Hook, Body, CTA |
| Email Sequence | Drew | Subject Lines, Body per email, CTAs |
| Ad Copy | Wren | Headlines, Descriptions, Primary Text, CTAs |
| Landing Page Copy | Wren + Kai | Hero, Benefits, Social Proof, CTA |
| Launch Plan | Kai (Growth) | Positioning, Channels, Timeline, KPIs |
| Research Report | Sage (Data Scientist) | Question, Method, Findings, Recommendations |
| Brief | Cass (Brand) | Positioning, Audience, Voice, Constraints |
| Design Spec | Cleo | User Flow, Wireframes, States, Interactions |
| Tech Spec | Coda + Jordan | Architecture, APIs, Data Model, Tradeoffs |
| SEO Audit | Robin | Crawlability, Technical, On-Page, Content, Authority |
| CRO Audit | Kai | Quick Wins, High-Impact, Test Ideas, Copy Alternatives |
| Sales Deck | Blake | Problem, Solution, Traction, Ask |
| Onboarding Doc | Taylor | Welcome, Setup, Culture, First Week |
| Course Module | Lee | Objectives, Content, Exercises, Assessment |

### Generation Flow

[server/ai/deliverableGenerator.ts](server/ai/deliverableGenerator.ts):
- Streaming generation via Groq (cost)
- Section-by-section rendering
- Auto-linked to source conversation
- Written to `deliverables` + `deliverable_versions` tables

### Cross-Agent Chains

[server/ai/deliverableChainOrchestrator.ts](server/ai/deliverableChainOrchestrator.ts):
- Upstream context injection: downstream deliverables see upstream deliverables' content
- Stale reference detection: when upstream changes, downstream marks stale
- 3 package templates: **launch** (PRD → Design Spec → Copy → Launch Plan), **content-sprint** (Brief → 4 Blog Posts → Email Sequence), **research** (Question → Research Report → Recommendations Deck)

### Iteration & Version History

- Every save creates a `deliverable_versions` row with hash and timestamp
- Restore from any prior version
- Section-level "Refine" input triggers targeted re-generation for one section
- **Frozen Rubric scoring** (Phase 36): Groq judge scores each version, auto-reverts on regression, `edits_count` atomic increment
- Feedback signal (thumbs up/down + rubric criterion breakdown) injected back into agent prompt for next iteration

### Organic Detection

[server/ai/deliverableDetector.ts](server/ai/deliverableDetector.ts):
- Regex-based intent detection from conversation ("draft me a brief", "write the launch plan")
- Conservative thresholds to avoid false positives
- **ProposalCard** UX (v2.0): user sees inline "Draft a PRD?" prompt and clicks Accept or Dismiss

### Professional Export

[server/ai/pdfExport.ts](server/ai/pdfExport.ts):
- Branded PDF with table of contents
- Author attribution to the agent who drafted it
- Hatchin footer branding
- Downloaded via `/api/deliverables/:id/download`

---

## 12. Billing & Monetization

### Tier Structure (v1.2)

| Feature | Free ("Hatcher") | Pro ($19/mo or $190/yr) |
|---|---|---|
| Chat messages | Unlimited* | Unlimited |
| Projects | 3 | Unlimited |
| AI agents | All 30 | All 30 |
| AI model quality | Gemini Pro (same) | Gemini Pro (same) |
| Autonomy | Disabled | Full (50 exec/day) |
| Rate limit | 15 msg/min | 30 msg/min |

*Invisible safety cap: 500/day. No counter shown. 99% of users never hit it.

Prices in dual currency per user memory rule: ₹1,634/mo ($19) or ₹16,340/yr ($190) at ~₹86/$.

### Stripe Integration

- **Checkout**: Creates Stripe Checkout Session for Pro upgrade
- **Customer Portal**: Self-service subscription management
- **Webhooks**: 4 event types handled with idempotency
  - `customer.subscription.created` → set tier='pro'
  - `customer.subscription.updated` → update period end
  - `customer.subscription.deleted` → downgrade to free (15-day grace)
- **Grace Period**: 15-day Pro trial for existing users on billing launch

### Usage Tracking

- Token usage recorded per request (fire-and-forget)
- Daily aggregation with cost calculation
- Current cost table (post-Phase A DeepSeek migration):
  - DeepSeek V4-Flash: $0.014/M input (cached) / $0.28/M input (miss) / $0.42/M output
  - Gemini Flash: $0.15/$0.60 per 1M (input/output)
  - Gemini Pro: $1.25/$5.00 per 1M
  - Groq llama-3.3-70b: FREE
  - GPT-4o-mini: $0.15/$0.60 per 1M (escape hatch only, removed from default chain)
- In-memory cache for rate limiting (per-minute tracker)

### Tier Gating

- `requirePro()` middleware → 403 for non-Pro users
- `checkMessageSafetyCap()` → per-minute + daily cap checks
- `checkProjectLimit()` → blocks 4th project for Free users
- `checkAutonomyAccess()` → autonomy disabled for Free tier
- Kill switch: `FEATURE_BILLING_GATES=false` disables all gates

### Frontend Billing UI

- **AccountPage** (`/account`): Plan tier, subscription status, period end, usage metrics, upgrade/manage buttons
- **UpgradeModal**: Context-aware (`project_limit`, `autonomy`, `daily_cap`), Free vs Pro comparison, monthly/annual toggle
- **UsageBar**: Usage progress in chat header
- **WebSocket alerts**: `upgrade_required` and `usage_warning` events

### Infrastructure Cost Estimate (2026-07-10)

Fly.io Bombay (`bom`) shared 1x CPU, 1GB RAM. Per `fly.toml` comment, min=1 costs ~$6.48/mo.

| Stage | Monthly cost |
|---|---|
| Pre-public min=0 (now) | $0 to $3, ₹0 to ₹258 |
| Post-launch min=1 | ~$6.48, ~₹557 |
| 100 free + 10 Pro users | ~$196, ~₹16,856 (offset ~$190 revenue = near break-even) |
| 1,000 users | $700 to $1,700, ₹60,200 to ₹1,46,200 |

Break-even at 10th Pro sub. DeepSeek V4-Pro promo expires 2026-05-31: re-evaluate then. Post-promo V4-Pro becomes more expensive than Gemini 2.5-Pro on input ($1.74 vs $1.25 per M tokens).

---

## 13. Tech Stack

### Frontend

| Concern | Library | Version |
|---|---|---|
| Framework | React | 18.3.1 |
| Router | Wouter | 3.3.5 |
| Server state | TanStack React Query | 5.60.5 |
| UI Components | Shadcn + Radix UI | 1.1 to 2.1 |
| Styling | Tailwind CSS | 3.4.17 |
| Animations | Framer Motion | 11.13.1 |
| Rich Text | React Markdown + GFM | 10.1.0 |
| Forms | React Hook Form + Zod | 7.55.0 |
| Charts | Recharts | 2.15.2 |
| Icons | Lucide React | 0.453.0 |
| Build | Vite | 5.4.19 |
| TypeScript | 5.6.3 (strict) | — |

### Backend

| Concern | Library | Version |
|---|---|---|
| Server | Express | 4.21.2 |
| Database ORM | Drizzle ORM | 0.39.1 (`drizzle-orm/node-postgres` adapter) |
| Database | PostgreSQL 17.6 via Supabase | `pg` 8.21 (node-postgres). Was Neon serverless until 2026-06-02. |
| DB Pooler | Supavisor session mode | `aws-1-ap-southeast-1.pooler.supabase.com:5432`. **Never use transaction mode 6543 (pg-boss requires session).** |
| LLM Primary | DeepSeek V4-Flash | `openai` SDK 5.21.0 with custom `baseURL`. Was Gemini 2.5-Flash until Phase A 2026-05-04. |
| LLM Fallback (hot) | Google Gemini 2.5-Flash/Pro | `@google/genai` 1.50.x |
| LLM Tier (Pro) | DeepSeek V4-Pro / Gemini 2.5-Pro | via `resolveModelForTier('premium')` |
| LLM Free workloads | Groq Llama 3.3-70B | `groq-sdk`. Simple chat, task extraction, compaction, rubric judge. |
| LLM Local | Ollama (llama3.1:8b) | Test only, hard-blocked in prod |
| LLM Escape hatch | OpenAI GPT-4o-mini | Only when `LLM_PRIMARY=openai` explicit |
| AI Orchestration | LangChain + LangGraph | 0.3.74 + 0.4.9 |
| Auth | OpenID Connect (Google) | `openid-client` 6.6.2 + PKCE |
| Session | express-session + pg-store | PostgreSQL-backed, 7-day TTL |
| Real-time | WebSocket (ws) | 8.18.0 |
| Validation | Zod | 3.24.2 |
| Security | Helmet + CORS + rate-limit | Always on in production |
| Billing | Stripe | 20.4.1 |
| Job Queue | pg-boss | Session-mode Postgres required |
| Monitoring | LangSmith (optional) | Trace LLM calls |

---

## 14. Database Schema

Full schema: [shared/schema.ts](shared/schema.ts). All IDs are UUIDs (`gen_random_uuid()` PostgreSQL or `crypto.randomUUID()` JS). Never write raw SQL in application code (Drizzle only).

### Tables Overview

| Table | Purpose | Key Columns |
|---|---|---|
| `users` | OAuth accounts | id, email, provider_sub, name, avatar_url, tier, subscriptionStatus, subscriptionPeriodEnd, graceExpiresAt |
| `projects` | Workspaces | id, user_id, name, emoji, coreDirection (JSONB), brain (JSONB), executionRules (JSONB) |
| `teams` | Agent groups | id, project_id, user_id, name, emoji |
| `agents` | AI team members | id, project_id, team_id, name, role, personality (JSONB), isSpecialAgent |
| `conversations` | Chat containers | id (canonical string), project_id, team_id, agent_id, type, title, archived |
| `messages` | Chat messages | id, conversation_id, content, messageType, agent_id, user_id, metadata (JSONB), parentMessageId, threadRootId, threadDepth |
| `message_reactions` | Feedback | message_id, user_id, reaction_type, agent_id, feedbackData (JSONB) |
| `conversation_memory` | Compaction | conversation_id, memory_type, content, importance |
| `tasks` | Work items | id, project_id, title, status, priority, assignee, parent_task_id, metadata (JSONB) |
| `typing_indicators` | Presence | conversation_id, agent_id, expires_at |
| `autonomy_events` | Audit trail | trace_id, event_type, payload (JSONB), risk_score, confidence, latency_ms |
| `autonomy_runs` | Phase 37 run tree | id, project_id, initiator_agent_id, status, started_at, finished_at |
| `autonomy_run_steps` | Phase 37 tree steps | id, run_id, parent_step_id, agent_id, event_type, deliverable_version_id |
| `deliberation_traces` | Multi-agent | trace_id (UNIQUE), objective, rounds (JSONB), review, final_synthesis |
| `deliverables` | v2.0 typed outputs | id, project_id, type, title, current_version_id, edits_count, rubric_score, agent_id |
| `deliverable_versions` | v2.0 history | id, deliverable_id, content (JSONB), rubric_breakdown (JSONB), author_agent_id, created_at |
| `deliverable_packages` | v2.0 chains | id, project_id, template, status, deliverable_ids (JSONB array) |
| `usage_daily_summary` | Token tracking | user_id, date, messages, tokens, cost, model split |
| `processed_webhooks` | Stripe idempotency | stripeEventId |

### Key JSONB Structures

- `projects.coreDirection`: `{whatBuilding, whyMatters, whoFor}`
- `projects.brain`: `{documents: [{type, title, content}], sharedMemory: string}`
- `agents.personality`: `{traits[], communicationStyle, expertise[], welcomeMessage, adaptedTraits, adaptationMeta, trustMeta}`
- `messages.metadata`: `{isStreaming, typingDuration, responseTime, personality, mentions[], replyTo, idempotencyKey}`
- `tasks.metadata`: `{dependsOn, handoffContext, peerReviewResult}`
- `deliverable_versions.content`: `{sections: [{heading, body}]}`
- `deliverable_versions.rubric_breakdown`: `{score: number, criteria: [{name, score, note}]}`

### Conversation ID Format (Critical)

```
project:{projectId}          → Project-level chat (all agents)
team:{projectId}:{teamId}    → Team-level chat (team agents)
agent:{projectId}:{agentId}  → 1-on-1 with specific agent
```

Canonical parser: [shared/conversationId.ts](shared/conversationId.ts). Never construct these strings manually elsewhere.

---

## 15. API Reference

### Auth
```
GET  /api/auth/me                          → Current user or 401
GET  /api/auth/google/start                → Redirect to Google OAuth
GET  /api/auth/google/callback             → OAuth callback
POST /api/auth/logout                      → Destroy session
```

### Projects
```
GET    /api/projects                       → User's projects
GET    /api/projects/:id                   → Single project
POST   /api/projects                       → Create (tier-gated)
PUT    /api/projects/:id                   → Full update
PATCH  /api/projects/:id                   → Partial update
DELETE /api/projects/:id                   → Delete (soft-delete with 3s undo, v2.1)
POST   /api/projects/:id/brain/documents   → Add brain document
PATCH  /api/projects/:id/brain             → Update shared memory
POST   /api/projects/:id/undo-delete       → Restore within undo window (v2.1)
```

### Teams
```
GET    /api/teams                          → All teams
GET    /api/projects/:projectId/teams      → Project teams
POST   /api/teams                          → Create
PUT    /api/teams/:id                      → Full update
PATCH  /api/teams/:id                      → Partial update
DELETE /api/teams/:id                      → Delete
```

### Agents
```
GET    /api/agents                         → All agents
GET    /api/projects/:projectId/agents     → Project agents
GET    /api/teams/:teamId/agents           → Team agents
POST   /api/agents                         → Create
PUT    /api/agents/:id                     → Full update
PATCH  /api/agents/:id                     → Partial update
DELETE /api/agents/:id                     → Delete
```

### Conversations
```
GET    /api/conversations/:projectId       → Project conversations
POST   /api/conversations                  → Create
DELETE /api/conversations/:id              → Delete
PUT    /api/conversations/:id/archive      → Archive
PUT    /api/conversations/:id/unarchive    → Unarchive
GET    /api/projects/:projectId/conversations/archived → Archived list
```

### Messages
```
GET    /api/conversations/:conversationId/messages  → Paginated (cursor-based)
POST   /api/conversations/:conversationId/messages  → Create
POST   /api/messages                                → Bulk create
POST   /api/messages/:messageId/reactions           → Add reaction
GET    /api/messages/:messageId/reactions           → Get reactions
```

### Tasks
```
GET    /api/tasks?projectId=X              → Project tasks
POST   /api/tasks                          → Create
PUT    /api/tasks/:id                      → Full update
PATCH  /api/tasks/:id                      → Partial update
DELETE /api/tasks/:id                      → Delete
POST   /api/tasks/extract                  → AI task extraction
POST   /api/task-suggestions/analyze       → Suggestion analysis
```

### Deliverables (v2.0)
```
GET    /api/deliverables?projectId=X       → Project deliverables
GET    /api/deliverables/:id               → Single deliverable + current version
POST   /api/deliverables                   → Create + trigger initial generation
POST   /api/deliverables/:id/iterate       → Iterate one section or whole doc
GET    /api/deliverables/:id/versions      → Version history
POST   /api/deliverables/:id/restore       → Restore a prior version
GET    /api/deliverables/:id/download      → Branded PDF export
POST   /api/deliverables/:id/accept        → Feedback signal: user liked this version
POST   /api/deliverables/:id/dismiss       → Feedback signal: user rejected
POST   /api/deliverables/:id/impression    → Feedback signal: user opened
POST   /api/deliverable-packages           → Start a chain (launch/content-sprint/research)
GET    /api/deliverable-packages/:id       → Package status + progress
```

### Autonomy
```
GET    /api/autonomy/runs?projectId=X      → Run tree list
GET    /api/autonomy/runs/:id              → Single run + steps
```

### Chat (AI)
```
POST   /api/hatch/chat                     → Non-streaming fallback
WS     ws://host/ws                        → Streaming chat
```

### Billing
```
GET    /api/billing/status                 → Subscription + usage (always works)
POST   /api/billing/checkout               → Stripe Checkout URL
POST   /api/billing/portal                 → Stripe Customer Portal URL
POST   /api/billing/webhook               → Stripe webhook (raw body, sig verified)
```

### System
```
GET    /api/health                         → Server status
GET    /api/system/storage-status          → Dev: storage mode info
```

### Training
```
POST   /api/training/feedback              → Store agent training feedback
```

### Dev-Only (guarded by NODE_ENV === 'development')
```
POST   /api/dev/set-autonomy-level         → Flip project autonomyLevel (Playwright)
GET    /api/dev/captured-prompts           → Read capture buffer (Playwright)
POST   /api/dev/clear-captured-prompts     → Reset capture buffer (Playwright)
POST   /api/dev/force-judge-score          → Force rubric score for testing
POST   /api/dev/seed-run-tree              → Seed deterministic run tree (Phase 37)
POST   /api/dev/reset-run-tree             → Reset run tree
POST   /api/dev/mark-flat-historical       → TREE-05 backfill marker
```

---

## 16. WebSocket Events

### Client → Server (Inbound)

| Event | Payload | Description |
|---|---|---|
| `join_conversation` | conversationId | Subscribe |
| `send_message` | conversationId, message | Non-streaming |
| `send_message_streaming` | conversationId, message, addressedAgentId | Streaming |
| `start_typing` | conversationId, agentId, estimatedDuration | Typing on |
| `stop_typing` | conversationId, agentId | Typing off |
| `cancel_streaming` | messageId, conversationId | Cancel in-progress |

### Server → Client (Outbound)

| Event | Description |
|---|---|
| `connection_confirmed` | WebSocket established |
| `streaming_started` | LLM began response (messageId, agentId, agentName) |
| `streaming_chunk` | Token chunk + accumulated content |
| `streaming_completed` | Final message stored |
| `streaming_cancelled` | Response cancelled |
| `streaming_error` | Error with code and message |
| `new_message` / `chat_message` | Message created |
| `typing_started` / `typing_stopped` | Agent presence |
| `conductor_decision` | Routing metadata |
| `safety_intervention` | Safety gate ≥ 0.70 triggered (Phase 38-02 makes this fire on destructive intent) |
| `peer_review_started` / `peer_review_completed` / `peer_review_revision` | Peer review lifecycle |
| `task_suggestions` | AI-extracted tasks for approval |
| `task_created` | Task confirmed |
| `teams_auto_hatched` | Starter pack teams created |
| `brain_updated_from_chat` | Direction field changed |
| `project_created` | New project created |
| `background_execution_started` | Autonomy triggered |
| `handoff_initiated` | Agent handoff (Phase 37 writes to run tree) |
| `handoff_announced` | In-character handoff message |
| `deliberation_started` / `deliberation_completed` | Multi-agent coordination |
| `deliverable_started` / `deliverable_chunk` / `deliverable_completed` | v2.0 deliverable streaming |
| `deliverable_version_saved` | New version persisted |
| `rubric_scored` / `rubric_regressed` | Phase 36 rubric events |
| `upgrade_required` | Tier limit reached |
| `usage_warning` | Approaching usage limit |
| `error` | Generic error |

---

## 17. Authentication

### Google OAuth 2.0 + PKCE Flow

```
1. User clicks "Sign in with Google" on /login
2. GET /api/auth/google/start
   → Generates: state, nonce, codeVerifier, codeChallenge (PKCE)
   → Stores in session
   → Redirects to Google auth URL (openid email profile scope)
3. User consents
4. GET /api/auth/google/callback?code=...&state=...
   → Validates state (CSRF), nonce, code
   → Exchanges code + codeVerifier for tokens (PKCE prevents interception)
   → Extracts: sub, email, name, picture
   → upsertOAuthUser() creates or updates user
   → Regenerates session ID (anti-fixation)
   → Sets req.session.userId
   → Redirects to / or returnTo
5. All protected routes check req.session.userId → 401 if missing
6. POST /api/auth/logout destroys session
```

### Session Configuration
- Store: PostgreSQL via `connect-pg-simple` (Supabase-hosted since 2026-06-02)
- TTL: 7 days
- Flags: `httpOnly: true`, `secure: true` (prod), `sameSite: 'lax'`
- Secret: 32+ chars, from `SESSION_SECRET` env var

---

## 18. Frontend Architecture

### State Management

**Server State** — TanStack React Query:
- All API data fetched via `useQuery`
- Mutations with automatic cache invalidation
- Optimistic updates via `setQueryData`
- Query keys: `['/api/projects']`, `['/api/teams']`, `['/api/agents']`, etc.

**Real-Time State** — WebSocket:
- `useRealTimeUpdates` hook for chat/autonomy events
- `useWebSocket` for connection management
- Streaming state: `isStreaming`, `streamingMessageId`, `streamingContent`, `streamingAgent`

**Client State** — localStorage:
- Active project/team/agent selection
- Sidebar expanded/collapsed states
- Theme preference
- Onboarding completed flags
- Maya visited flag

**Cross-Component Communication** — CustomEvent bridge:
- `project_brain_updated` — brain changes from chat
- `ai_streaming_active` — streaming state to sidebar
- `tasks_updated` — task list changes
- `task_created_from_chat` — task from suggestions

### Key Hooks

| Hook | Purpose |
|---|---|
| `useAuth()` | Session & user state |
| `useRealTimeUpdates()` | WebSocket event listener |
| `useRightSidebarState()` | Sidebar expansion + metadata |
| `useThreadNavigation()` | Message threading |
| `useWebSocket()` | WS connection + message sending |
| `useAutonomyFeed()` | Autonomy event feed with filtering |
| `useAgentWorkingState()` | Agent background execution indicators |
| `use-toast()` | Toast notifications |

### Error Handling

- **App-level**: `<ErrorBoundary>` in App.tsx with `AppErrorFallback`
- **Panel-level**: `PanelErrorFallback` in home.tsx for isolated panel errors
- **API errors**: Toast notifications, inline error messages
- **Validation**: Inline field errors (character count, touched state)

### Avatar System

- 30 role-specific avatar components (custom SVGs or emoji-based)
- Role → color mapping via `getAgentColors()`
- Size variants: 28px, 32px, 48px
- Working state indicator: pulsing ring animation during execution (v1.3)
- Fallback to character initials

---

## 19. Backend Architecture

### Middleware Stack (Order)

1. Trust proxy
2. Helmet (security headers)
3. CORS (origin whitelist)
4. Rate limiters (200 req/15min global, 15 req/min AI)
5. Session middleware (PostgreSQL store via Supabase)
6. Raw body parser for Stripe webhook
7. JSON body parser (2MB limit)
8. URL-encoded parser
9. Request logging
10. Global auth guard (`/api/*` routes)

### Storage Abstraction

```typescript
interface IStorage {
  getUser(id: string): Promise<User | undefined>
  upsertOAuthUser(data): Promise<User>
  getProject(id: string): Promise<Project | undefined>
  getProjectsByUserId(userId: string): Promise<Project[]>
  createProject(data): Promise<Project>
  updateProject(id, data): Promise<Project>
  softDeleteProject(id): Promise<void>          // v2.1: soft-delete with undo window
  restoreProject(id): Promise<void>             // v2.1: undo-project fix
  // Teams, Agents, Conversations, Messages, Tasks, Deliverables, AutonomyRuns...
}
```

Two implementations:
- **MemStorage**: In-memory Maps (dev/test, non-durable)
- **DatabaseStorage**: PostgreSQL via Drizzle ORM (production)

Production guard: `STORAGE_MODE=db` asserted at startup in production.

### Route Modules

```
server/routes/
├── health.ts       → GET /api/health
├── projects.ts     → /api/projects/* + brain endpoints
├── teams.ts        → /api/teams/*
├── agents.ts       → /api/agents/*
├── messages.ts     → /api/conversations/*, /api/messages/*
├── tasks.ts        → /api/tasks/* + suggestions
├── deliverables.ts → /api/deliverables/* (13 endpoints v2.0)
├── autonomy.ts     → /api/autonomy/*
├── billing.ts      → /api/billing/*
└── chat.ts         → WebSocket + streaming (~2,878 lines, split pending in Phase 47 #3)
```

`routes.ts` is a thin ~430-line orchestrator that imports and registers all modules.

---

## 20. Safety & Security

### Input Validation
- All POST/PUT bodies validated with Zod schemas
- Message ingress validation ([schemas/messageIngress.ts](server/schemas/messageIngress.ts))
- Task extraction is conservative (explicit checks only)

### Safety Scoring (3 dimensions)

| Dimension | Baseline | Triggers |
|---|---|---|
| Hallucination Risk | 0.15 | Absolute claims (`ABSOLUTE_CLAIMS`), missing uncertainty markers, future predictions |
| Scope Risk | 0.10 | Cross-project conflicts (`SCOPE_CONFLICT`), conversation mode mismatch |
| Execution Risk | 0.10 | **Destructive verbs + bulk/data multipliers (Phase 38-02)**, `RISKY_EXECUTION` substrings, evasion patterns, prompt injection |

- Explicit creation intents reduce all baselines to 0.05
- Prompt injection detection → max risk 0.82 across all dimensions
- Destructive-intent detection: base 0.60 (critical verbs) or 0.45 (reset verbs), multiplied ×1.3 for bulk scope, ×1.2 for data scope. Merged via `Math.max`.

### D-11..D-13 Safety Floor Invariant

`grep -c clarificationRequiredRisk server/autonomy/execution/taskExecutionPipeline.ts` must equal **7**. Preserved across all Phase 38 shipments. Verified 2026-07-10.

### Prompt Injection Detection

```typescript
const PROMPT_INJECTION_PATTERNS = [
  "ignore previous instructions",
  "reveal system prompt",
  "developer message",
  "god mode",
  "bypass policy",
  "disable safeguards",
  "jailbreak",
  "tool output says",
];
```

Match → all three risk dimensions boost to at least 0.72-0.82 (worst case wins).

### Capability Envelope (Phase 38-04, universal)

Every LLM call includes `AGENT_CAPABILITY_ENVELOPE` in `staticPrefix`. Prevents fake-action confabulation at the prompt layer. Defense in depth with the safety scorer.

### Security Features

- Helmet security headers on all responses
- CORS restricted to `ALLOWED_ORIGIN`
- Rate limiting: 200 req/15min global, 15 req/min AI
- Session: `httpOnly`, `secure` (prod), `sameSite: 'lax'`
- Google OAuth uses PKCE (prevents authorization code interception)
- Ownership verification on all data mutations
- Express body size limit: 2MB
- No raw SQL in application code (Drizzle ORM only)
- Explicit auth guards on safety and forecast routes
- Rate-limited dev endpoints gated by `NODE_ENV === 'development'`

### Conversation Integrity

- Message ID deduplication (`seenMessageIds` per conversation)
- Idempotency key tracking
- Timestamp ordering (out-of-order detection with 1s tolerance)
- TTL pruning (2-hour state TTL, max 10K conversations in memory)

### Uncaught Rejection Handlers (quick-260427-ojf, 2026-04-27)

`uncaughtException` + `unhandledRejection` handlers added for Neon idle-in-transaction recovery. Retained post-Supabase migration as defensive layer. [server/autonomy/traces/traceStore.ts](server/autonomy/traces/traceStore.ts) transaction-leak also fixed.

---

## 21. LLM Provider System

### Provider Chain (Phase A, 2026-05-04)

**Production Mode:**

| Use Case | Provider Chain | Cost |
|---|---|---|
| Standard/Complex chat | DeepSeek V4-Flash → Gemini 2.5-Flash | $0.014/M cached input |
| Simple messages | Groq llama-3.3-70b → DeepSeek → Gemini | FREE first |
| Task extraction | Groq → DeepSeek → Gemini | FREE first |
| Conversation compaction | Groq | FREE |
| Rubric judge (Phase 36) | Groq (temp=0) | FREE |
| Autonomy tasks (Pro) | DeepSeek V4-Pro → Gemini 2.5-Pro | via `resolveModelForTier('premium')` |
| Peer review (Pro) | Same as autonomy | Premium |

**OpenAI** removed from default prod chain in commit `34c8f23`. Only fires when `LLM_PRIMARY=openai` explicitly set.

**Test Mode** (`LLM_MODE=test`):
- `TEST_LLM_PROVIDER=capture` → Records assembled prompts to in-memory buffer (Playwright wire-level assertions)
- `TEST_LLM_PROVIDER=openai` → GPT-4o-mini
- `TEST_LLM_PROVIDER=ollama` → Local llama3.1:8b
- `TEST_LLM_PROVIDER=groq` → Groq (free)
- `TEST_LLM_PROVIDER=mock` → Deterministic, zero-cost

### Cache-Friendly Prompt Split (Phase A)

DeepSeek auto-caches stable prefixes ≥ 1,024 tokens with 50× cheaper cache-hit input. Prompt is split:
- **`staticPrefix`** (~5,000 tokens): identity, role expertise, response rules, capability envelope. Same across all turns with this agent → cache hits.
- **`dynamicSuffix`** (per-turn): recent messages, project brain, user message, autonomous directive, Maya override. Never cached.

Result: after first turn per agent-user pair, input token cost drops 50× on repeated queries.

### DEEPSEEK_MIN_MAX_TOKENS Floor

V4 emits hidden reasoning tokens BEFORE content. If `max_tokens < 2000`, the reasoning consumes the entire budget and content is empty. Floor enforced in providerResolver at 2000 (`31c0dc5`).

### Cross-Provider Model Fallback (`ee57ce0`)

`applyModelDefaults()` rewrites model name when falling across provider boundaries. Example: `deepseek-v4-pro` request → Gemini fallback → automatically rewritten to `gemini-2.5-pro`.

### buildProviderOrder Capture Branch Fix (Plan 38-03, 2026-07-10)

Previously `buildProviderOrder` had no `capture` case, so `TEST_LLM_PROVIDER=capture` silently fell through to `mock`, invalidating Phase 38-01 Playwright coverage. Fixed in commit `748ae66`. All prior phase-38 Playwright runs are now genuinely against the capture provider.

### Provider Implementations

| Provider | File | Model | Features |
|---|---|---|---|
| DeepSeek | [deepseekProvider.ts](server/llm/providers/deepseekProvider.ts) | deepseek-v4-flash / v4-pro | Cache-friendly prefix, reasoning-token floor |
| Gemini | [geminiProvider.ts](server/llm/providers/geminiProvider.ts) | gemini-2.5-flash / 2.5-pro | Streaming, usage metadata |
| Groq | [groqProvider.ts](server/llm/providers/groqProvider.ts) | llama-3.3-70b-versatile | FREE, fast TTFT |
| OpenAI | [openaiProvider.ts](server/llm/providers/openaiProvider.ts) | gpt-4o-mini | Escape hatch only |
| Ollama | [ollamaProvider.ts](server/llm/providers/ollamaProvider.ts) | llama3.1:8b | Local test, prod-blocked |
| Capture | [captureProvider.ts](server/llm/providers/captureProvider.ts) | — | Records prompts, doesn't call LLM |
| Mock | [mockProvider.ts](server/llm/providers/mockProvider.ts) | — | Deterministic, CI/test |

### Cost Optimization (v1.2 + Phase A)

- **Groq free tier**: Task extraction, simple messages, compaction, rubric judge = $0
- **Background task batching**: Groups same-agent tasks, single LLM call (30-50% savings)
- **Conversation compaction**: Summarizes long conversations to reduce context window
- **Reasoning cache**: In-memory, 1hr TTL, project-scoped
- **Adaptive maxTokens**: Task complexity classifier adjusts per message
- **DeepSeek cache-friendly split**: 50× cheaper input on cache hit

---

## 22. Knowledge System

### Project Brain

Every project has a brain stored as `projects.brain` JSONB:
- `sharedMemory`: freeform text (~1-10KB) that persists across all conversations
- `documents`: array of uploaded files (PDF/DOCX/TXT/MD, 10MB max) with extracted text
- Loaded into every agent prompt via `dynamicSuffix`

Users edit the brain via the Right Sidebar Brain & Docs tab. Auto-save on blur. Green checkmark confirmation.

### Core Direction

`projects.coreDirection` JSONB captures the strategic layer:
- `whatBuilding`: elevator description
- `whyMatters`: motivation
- `whoFor`: target user

Set at project creation (from Maya's onboarding chat or starter pack template), editable in the Right Sidebar.

### Execution Rules

`projects.executionRules` JSONB captures constraints and preferences:
- `autonomyLevel`: 'observe' | 'propose' | 'confirm' | 'autonomous' (drives Phase 38 behavior)
- `budgetCap`: per-day LLM cost limit
- `escalationPreferences`: which risks always need user approval regardless of trust

### Autonomous Knowledge Loop (AKL)

See [Section 9 Track 4](#9-growing-and-learning-from-each-other) for details on how agents propose, validate, and store knowledge updates.

### Frozen Rubrics (Phase 36)

Fifteen deliverable-type rubrics in [shared/deliverableRubrics.ts](shared/deliverableRubrics.ts). Zod-validated. Object-frozen invariant. Each rubric has:
- Type identifier (matches deliverable type)
- Criteria list (~5-8 per type)
- Scoring rubric per criterion (0-2 scale, guidance per level)
- Aggregate scoring formula

Groq (temp=0) judges each iteration. Auto-revert on regression. Score chip in Artifact panel shows per-criterion breakdown.

### Role Brains (Reasoning Cache)

Per-role `reasoningPattern` from `roleIntelligence.ts` is the default. Per-project reasoning is cached in-memory (1hr TTL) so repeated similar problems reuse the derivation.

---

## 23. Testing & QA

### Test Pyramid

```
Unit Tests (scripts/test-*.ts)     → Individual modules
Integration Tests (eval-*.ts)      → API + DB + LLM
Gate Tests (gate-*.ts)             → Safety + performance thresholds
Stress Tests (stress-test-*.ts)    → Concurrency, load, edge cases
Playwright (tests/e2e/*.spec.ts)   → Live-server end-to-end
```

### Phase 38 Test Coverage (added 2026-07-09/10)

| Script | Cases | Purpose |
|---|---|---|
| `scripts/test-autonomous-directive.ts` | 16 | Prompt snapshot: directive present/absent across 4 levels × {Maya, generic} |
| `scripts/test-safety-destructive-intent.ts` | 12 | Regex + weighting: 6 fire ≥ 0.70, 6 stay below |
| `scripts/test-maya-autonomous-voice.ts` | 10 | Maya override presence + ordering + generic-agent isolation |
| `scripts/test-capability-envelope.ts` | 19 | Envelope at all 4 levels + all four CAN block names + all four CANNOT categories + enforcement line + ordering |
| `tests/e2e/phase-38-never-stop-never-ask.spec.ts` | 5 | Live server: directive + snapshot + Maya grammar + envelope |
| `tests/e2e/phase-38-safety-floor.spec.ts` | 2 | Live server: destructive → safety_intervention fires |
| `tests/e2e/phase-38-fake-action-guard.spec.ts` | 2 | Live server: destructive → disclaimer OR intervention, no fake action |

Total Phase 38 coverage: **66 assertions**, all green on live server 2026-07-10.

### Available Test Commands

```bash
# Type checking
npm run typecheck        # Full TypeScript check
npm run lint             # Alias for typecheck

# Unit tests
npm run test:dto         # DTO contract validation
npm run test:integrity   # Message ordering integrity
npm run test:memory      # Persistence tests
npm run test:tone        # Agent tone guard
npm run test:injection   # Prompt injection safety

# Agent intelligence tests (294 tests)
npm run test:voice       # Voice distinctiveness (8 tests)
npm run test:pushback    # Agent pushback (46 tests)
npm run test:reasoning   # Reasoning patterns for 30 roles (240 tests)

# Gate tests
npm run gate:safety      # Safety threshold gates
npm run gate:conductor   # Conductor routing validation
npm run gate:performance # Latency benchmarks

# Evaluations
npm run eval:routing     # Agent routing accuracy
npm run eval:bench       # Full LLM benchmark
npm run eval:alive       # System liveness

# Marketing tactical evaluations (2026-07-10)
npx tsx scripts/eval-marketing-tactical.ts  # Wren/Kai/Robin marker check
npx tsx scripts/eval-marketing-ab.ts        # Baseline vs upgrade A/B

# Benchmark suite (14 metric sections, graded A-F)
npm run benchmark        # All evals + DB metrics
npm run benchmark:report # Generate markdown report
npm run benchmark:full   # Benchmark + report combined

# Playwright end-to-end
npx playwright test --project=phase-38              # All 5 Phase 38 tests
npx playwright test --project=phase-38-safety-floor # Plan 38-02
npx playwright test --project=phase-38-fake-action-guard # Plan 38-04

# Full QA
npm run qa:full          # lint + typecheck + build
```

### Before Any Merge

```bash
npm run typecheck        # Must pass
npm run gate:safety      # Must pass
npm run test:integrity   # Must pass
npm run test:dto         # Must pass
```

### Testing Without API Costs

```bash
LLM_MODE=test TEST_LLM_PROVIDER=mock npm run dev
```

---

## 24. Environment Variables

### Required (app crashes without these)
```bash
DATABASE_URL=postgresql://postgres.<ref>:<pw>@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
SESSION_SECRET=<32+ char secret>
DEEPSEEK_API_KEY=sk-...                 # Primary LLM (Phase A, 2026-05-04)
GEMINI_API_KEY=AIzaSy...                # Hot fallback
GROQ_API_KEY=gsk_...                    # Free-tier workloads
GOOGLE_CLIENT_ID=681006596933-....apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
```

### LLM Configuration
```bash
LLM_MODE=prod|test                       # Provider chain mode
LLM_PRIMARY=deepseek|openai|gemini       # Default: deepseek (Phase A)
TEST_LLM_PROVIDER=mock|groq|ollama|openai|capture

DEEPSEEK_MODEL=deepseek-v4-flash         # Default
DEEPSEEK_PRO_MODEL=deepseek-v4-pro       # Premium tier
DEEPSEEK_MIN_MAX_TOKENS=2000             # Floor (reasoning tokens fill smaller budgets)
GEMINI_MODEL=gemini-2.5-flash            # Fallback default
GEMINI_PRO_MODEL=gemini-2.5-pro          # Premium fallback

OPENAI_API_KEY=sk-...                    # Escape hatch only
OPENAI_MODEL=gpt-4o-mini
TEST_OLLAMA_BASE_URL=http://localhost:11434
TEST_OLLAMA_MODEL=llama3.1:8b
```

### Application
```bash
NODE_ENV=development|production
STORAGE_MODE=db|memory                   # db = PostgreSQL, memory = MemStorage
APP_BASE_URL=http://localhost:5001
ALLOWED_ORIGIN=http://localhost:5001
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:5001/api/auth/google/callback
```

### Billing (v1.2)
```bash
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_MONTHLY_PRICE_ID=price_...
STRIPE_PRO_ANNUAL_PRICE_ID=price_...
FEATURE_BILLING_GATES=true|false         # Kill switch (default: true in prod)
FEATURE_CONVERSATION_COMPACTION=false    # Context compaction (default: off)
```

### Autonomy Safety (v3.0 + v2.1)
```bash
BACKGROUND_AUTONOMY_ENABLED=true|false   # pg-boss task worker (default: off in dev)
DAILY_COST_CAP_CENTS_DEV=200             # Solo-dev cost cap (~₹165)
DEV_COST_CAP=true|false                  # Activate dev cap
```

### Monitoring (optional)
```bash
LANGSMITH_API_KEY=ls_...
LANGSMITH_PROJECT=hatchin-chat
```

**Rule**: Never hardcode secrets. Never commit `.env`. Always read from `process.env`.

---

## 25. Project Structure

```
hatching-mvp-5th-march/
├── client/src/
│   ├── App.tsx                       # Router
│   ├── pages/
│   │   ├── home.tsx                  # Three-panel layout
│   │   ├── LandingPage.tsx           # Public marketing
│   │   ├── login.tsx                 # Google OAuth
│   │   ├── AccountPage.tsx           # Billing dashboard
│   │   ├── MayaChat.tsx              # Maya chat
│   │   ├── onboarding.tsx            # Post-signup flow
│   │   └── not-found.tsx             # 404
│   ├── components/
│   │   ├── LeftSidebar.tsx           # Project tree + nav
│   │   ├── CenterPanel.tsx           # Chat interface
│   │   ├── RightSidebar.tsx          # Activity/Brain/Approvals tabs
│   │   ├── MessageBubble.tsx         # Message rendering
│   │   ├── ArtifactPanel.tsx         # v2.0 deliverable viewer
│   │   ├── DeliverableChatCard.tsx   # v2.0 inline deliverable
│   │   ├── PackageProgress.tsx       # v2.0 chain progress
│   │   ├── TaskManager.tsx           # Task list + filters
│   │   ├── ProgressTimeline.tsx      # Explore → Build → Launch
│   │   ├── WelcomeModal.tsx          # First-time welcome
│   │   ├── QuickStartModal.tsx       # Quick project creation
│   │   ├── StarterPacksModal.tsx     # Template selection
│   │   ├── ProjectNameModal.tsx      # Project naming
│   │   ├── AddHatchModal.tsx         # Add agent modal
│   │   ├── OnboardingSteps.tsx       # 4-step walkthrough
│   │   ├── TaskSuggestionModal.tsx   # AI task approval
│   │   ├── UpgradeModal.tsx          # Billing upgrade prompt
│   │   ├── AutonomousApprovalCard.tsx # Inline approval
│   │   ├── EggHatchingAnimation.tsx  # Animated loading
│   │   ├── ErrorFallbacks.tsx        # Error boundaries
│   │   ├── ThemeProvider.tsx         # Dark mode theming
│   │   ├── ProjectTree.tsx           # Sidebar tree (Maya filter)
│   │   ├── avatars/                  # 30 role-specific avatars
│   │   ├── sidebar/                  # v1.3 sidebar components
│   │   ├── chat/                     # Handoff/deliberation cards
│   │   └── ui/                       # Shadcn primitives
│   ├── hooks/                        # useAuth, useRealTimeUpdates, etc.
│   ├── lib/                          # queryClient, websocket, utils
│   └── devtools/                     # Autonomy debug dashboard
│
├── server/
│   ├── index.ts                      # Entrypoint + middleware
│   ├── routes.ts                     # Thin orchestrator (~430 lines)
│   ├── storage.ts                    # IStorage + Mem + DatabaseStorage
│   ├── db.ts                         # Supabase connection (node-postgres)
│   ├── ai/
│   │   ├── promptTemplate.ts         # buildSystemPrompt, AUTONOMOUS_DIRECTIVE, MAYA_OVERRIDE, CAPABILITY_ENVELOPE
│   │   ├── openaiService.ts          # Streaming + intelligent-response paths
│   │   ├── conductor.ts              # Multi-agent routing + safety integration
│   │   ├── safety.ts                 # 3-tier scoring + destructive-intent detection
│   │   ├── personalityEvolution.ts   # Agent learning from feedback
│   │   ├── roleProfiles.ts           # Role → expertise
│   │   ├── characterProfiles.ts      # Role → personality
│   │   ├── responsePostProcessing.ts # Tone guard + autonomy-aware soft-closing
│   │   ├── deliverableGenerator.ts   # v2.0 streaming deliverable gen
│   │   ├── deliverableDetector.ts    # v2.0 organic intent detection
│   │   ├── deliverableChainOrchestrator.ts # v2.0 cross-agent chains
│   │   ├── pdfExport.ts              # v2.0 branded PDF
│   │   ├── conversationCompactor.ts  # Groq-based compaction
│   │   ├── reasoningCache.ts         # In-memory reasoning cache
│   │   ├── taskComplexityClassifier.ts # Adaptive maxTokens
│   │   ├── imperativeShortcuts.ts    # Phase 36.5 pre-LLM action parser
│   │   └── tasks/                    # Intent classifier + organic extractor + lifecycle
│   ├── llm/
│   │   ├── providerResolver.ts       # Multi-provider chain + capture branch
│   │   └── providers/                # DeepSeek, Gemini, Groq, OpenAI, Ollama, Capture, Mock
│   ├── autonomy/
│   │   ├── execution/                # Task execution pipeline (D-11..D-13 gate consumer)
│   │   ├── handoff/                  # Agent handoff orchestration + announcements
│   │   ├── peerReview/               # Cross-agent quality review
│   │   ├── trustScoring/             # Progressive trust + threshold adaptation
│   │   ├── config/policies.ts        # Budgets, cost caps, max hops
│   │   ├── events/eventLogger.ts     # Audit trail (dual backend)
│   │   ├── integrity/                # Message ordering + deduplication
│   │   ├── taskGraph/                # Task dependency engine
│   │   ├── traces/                   # Deliberation storage
│   │   └── runs/                     # Phase 37 git-style run tree writer
│   ├── auth/googleOAuth.ts           # OAuth 2.0 + PKCE
│   ├── billing/
│   │   ├── usageTracker.ts           # Token usage + cost
│   │   ├── stripeClient.ts           # Stripe SDK init
│   │   ├── checkoutService.ts        # Checkout + Portal sessions
│   │   └── webhookHandler.ts         # 4 event types
│   ├── middleware/tierGate.ts        # Free/Pro enforcement
│   ├── orchestration/                # Speaking authority resolver
│   ├── knowledge/akl/                # Autonomous knowledge loop
│   ├── routes/                       # Route modules
│   ├── schemas/messageIngress.ts     # Message validation
│   └── dev/                          # Dev-only endpoints (autonomy testing, capture buffer)
│
├── shared/
│   ├── schema.ts                     # Drizzle ORM (17+ tables)
│   ├── roleRegistry.ts               # 30 role identity + personality
│   ├── roleIntelligence.ts           # 30 role expertise + intelligence (Wren/Kai/Robin enriched)
│   ├── deliverableTypes.ts           # 15 deliverable types + section schemas
│   ├── deliverableRubrics.ts         # 15 frozen Phase 36 rubrics
│   ├── templates.ts                  # 38 starter pack templates
│   ├── conversationId.ts             # Canonical ID parser
│   └── dto/                          # WebSocket + API schemas
│
├── migrations/                       # SQL migration files
├── scripts/                          # Test/eval/gate scripts (including marketing A/B evals)
├── tests/e2e/                        # Playwright specs (phase-XX-*.spec.ts)
├── .planning/                        # GSD phase planning + STATE + REQUIREMENTS + ROADMAP
├── .evidence/                        # Bug-hunt evidence archives
├── CLAUDE.md                         # Architecture of record (constellation)
├── HANDOFF.md                        # Session log (constellation)
├── HATCHIN-COMPLETE-GUIDE.md         # This file (constellation)
├── AUTO-ROUTING.md                   # Canonical routing matrix (referenced by CLAUDE.md §23)
├── HATCHIN-BRIEF.md                  # Product & brand brief
├── package.json                      # Monorepo dependencies
├── tsconfig.json                     # TypeScript strict mode
├── vite.config.ts                    # Vite + path aliases
├── drizzle.config.ts                 # Migration config
├── tailwind.config.ts                # Tailwind + custom tokens
├── fly.toml                          # Fly.io deployment config (Bombay region)
└── playwright.config.ts              # Playwright + phase-XX project entries
```

---

## 26. Version History

### v1.0 — Foundation (shipped, 31/31 requirements)
- Core chat + streaming infrastructure
- LangGraph multi-agent routing
- Google OAuth with PKCE
- Drizzle ORM schema + PostgreSQL
- Multi-provider LLM fallback (Gemini + OpenAI)
- Landing page wired to router
- Personality evolution persisted to DB
- Production storage mode assertion
- Routes modularized (6 modules)
- Cursor pagination in messages
- Message deduplication

### v1.1 — Autonomous Execution Loop (shipped, 17/17 requirements)
- Background task execution via pg-boss job queue
- Agent handoffs with cycle detection (BFS)
- 3-tier safety gates (auto, peer review, user approval)
- Progressive trust scoring
- Peer review with role-specific rubrics (7 lens categories)
- "Team is working..." indicator
- Inline approval cards
- Browser tab badge for background work
- Maya return briefing
- Pause/cancel autonomy
- Autonomy event logging (dual backend)
- 294 agent intelligence tests

### v1.2 — Billing + LLM Intelligence (shipped 2026-03-23, 16/16)
- Stripe monetization (Free / Pro $19/mo)
- Smart LLM routing
- Token usage tracking + daily aggregation
- Tier gating
- 15-day grace period
- Conversation compaction (feature-flagged)
- Reasoning cache (1hr TTL)
- Background task batching (30-50% savings)
- Task complexity classifier
- Account page + upgrade modal + usage bar

### v1.3 — Autonomy Visibility & Right Sidebar Revamp (shipped 2026-03-29, 23/23)
- Tabbed right sidebar (Activity / Brain & Docs / Approvals)
- Live activity feed + stats card + filter chips
- Agent working state (pulsing avatar)
- Handoff cards + chain timeline
- Approvals hub + task pipeline
- Brain doc upload (PDF/DOCX/TXT/MD)
- **4-level autonomy dial (Observe / Propose / Confirm / Autonomous)**
- Work output viewer
- Premium polish tokens

### v2.0 — Hatches That Deliver (shipped 2026-03-30)
- 15-type deliverable system with rubric infrastructure
- Cross-agent chains (upstream context injection)
- 3 package templates (launch, content-sprint, research)
- ArtifactPanel with version history and refine input
- DeliverableChatCard + ProposalCard inline UI
- Branded PDF export
- Organic detection (regex-based intent from conversation)

### Smart Task Detection Rewrite (2026-03-31, 7/7)
- 5-intent classifier (zero LLM cost)
- Lifecycle commands (status/priority/assignee/delete/query/progress)
- Organic extraction via Groq (30s cooldown, 0.7 Jaccard duplicate detection)
- Agent-awareness (assigned tasks injected into prompts)
- Completion detection from agent responses

### v2.1 — Hatches That Self-Improve (in flight)

Phases shipped:
- **Phase 35 Production Hotfix Pass** (2026-05-11, Fly v19; re-verified 2026-06-03 on Supabase, 7/7 Playwright PASS): legal modal + deep-link hybrid, PROVIDER_DEGRADED banner, AUDIT-01 spec
- **Phase 36 Frozen-Rubric Deliverable Iteration** (2026-05-13; re-verified 2026-06-03, 4/4 PASS): 15 frozen rubrics, auto-revert on regression, score chip, breakdown UI, agent-prompt feedback signal
- **Phase 36.5 Imperative Action Shortcuts** hotfix (2026-05-13): regex-based imperative-command parser fires actions BEFORE LLM call
- **Phase 37 Git-Style Run Tree** (2026-05-14): `autonomy_runs` + `autonomy_run_steps` schema, handoff_initiated + parent-link, Activity-tab tree visualization, semantic-word badges
- **Phase 38 "Never Stop, Never Ask + Autonomy Safety"** (expanded 2026-07-09, Plans 01-04 shipped through 2026-07-10):
  - Plan 38-01 (ALWY-01/02/03): `<autonomous_directive>` block + snapshot-at-task-entry + Playwright wire-level spec
  - Plan 38-02 (ALWY-04): safety scorer destructive-intent detection
  - Plan 38-03 (ALWY-05): Maya voice snap + buildProviderOrder capture branch fix
  - Plan 38-04 (ALWY-06): universal capability envelope
  - Plan 38-05: human vibe-check (pending, blocks phase close)

Mid-milestone infra changes (folded 2026-07-10):
- **Phase A DeepSeek migration** (2026-05-04): V4-Flash primary, cache-friendly split, OpenAI removed from default chain
- **quick-260601-ojf Supabase migration** (2026-06-02): Neon over compute quota, Supabase Singapore session-mode pooler
- **quick-260427-ojf DB-CRASH-01 hotfix** (2026-04-27): idle-in-transaction recovery handlers
- **Marketing role tactical enrichment** (Wren/Kai/Robin, 2026-07-10): coreyhaines31/marketingskills MIT attribution

Pending: Plan 38-05, then Phases 39-46 per ROADMAP-V3.

---

## 27. Roadmap

### v2.1 Remaining (12 phases total, 5 shipped)

**Phase 38 close-out** (Plan 05 vibe-check only)
- Human at browser at level-4 on trial project runs 4 test prompts
- Write `38-VERIFICATION.md`
- Close ALWY-02 fully
- Phase closes

**Phase 39 — Reader Testing Peer Review Mode** (pending, next after 38)
- New `peerReviewMode: 'reader-test'` lens for doc-type deliverables
- Reviewer sees ONLY deliverable + project name + role context, never conversation history
- Catches "this only makes sense if you wrote it" failures

**Phase 40 — Internal Eval Migration to promptfoo**
- Standardize eval harness

**Phase 41 — Conversation Phase Machine + Blueprint**
- Explicit conversation phases (Ideation → Definition → Execution → Ship)
- Blueprint deliverable that captures the phase transition

**Phase 42 — Minimum-Viable-Brain Gate**
- Refuse to start work until brain has minimum fields
- Prevent "cold-start slop" from Maya suggesting teams without knowing what the project actually is

**Phase 43 — Skip-Maya Escape Hatch**
- Power users can jump directly to a specialist without Maya intro
- Preserve default Maya-first flow

**Phase 44 — Per-Run Cost Visibility**
- Show cost per autonomy run in the Activity tab
- Feed into daily cost cap discussion

**Phase 45 — Maya 3-Stage Interrogation**
- Structured discovery for new projects (Idea → Constraints → Success criteria)
- Replace the current freeform first-turn

**Phase 46 — AI Slop Detection**
- Post-hoc classifier for fake-action language, hedge language, generic responses
- Uses capability envelope (Phase 38-04) as the canonical CAN/CANNOT source
- Automatic tone-signal reduction for confabulation

**Phase 47 — Accumulated Upgrades** (backlog, populated during milestone)
- #3 `chat.ts` split (~2,878 lines currently, target: ≤ 800 per file)
- #6 `CenterPanel.tsx` decomposition
- #9 Multi-agent empty-save bug fix (HIGH priority)
- #10 Activity foreground streaming visibility (MEDIUM)

### Post-v2.1 Direction

**Short-term:**
- `fly deploy` bundling Phases 35+36+36.5+37+38 (~10 weeks shipped work)
- CHANGELOG + README for developer onboarding
- Domain registration + DNS
- Public launch preparation

**Medium-term (1-2 months):**
- Agent marketplace / public templates
- Cross-project agent sharing
- Agent voice/persona customization UI
- Image generation from Designer Hatch
- Coding agent from Engineer Hatch (Coda spawns Claude Code)

**Long-term (3-6 months):**
- Multi-user collaboration (real-time multi-cursor)
- Agent-to-agent async tasks without user prompting
- GitHub / Linear / Notion integrations
- Audio input (Whisper transcription)
- Fine-tuned models per role (need 10K+ training examples first)
- Horizontal scaling with Redis adapter

### Not on the Roadmap (deliberately)

- Mobile app before web is stable
- Multi-tenant SaaS infrastructure before validation
- Real-time video calls
- Custom LLM training before sufficient feedback data

---

*This document is one of five files in the status-doc constellation. When features, architecture, or agent behavior change, this file MUST be refreshed atomically per the memory rule. Its constellation partners are [CLAUDE.md](CLAUDE.md), [HANDOFF.md](HANDOFF.md), [.planning/STATE.md](.planning/STATE.md), [.planning/REQUIREMENTS.md](.planning/REQUIREMENTS.md), and [.planning/ROADMAP.md](.planning/ROADMAP.md).*

*Last refreshed 2026-07-10 covering v2.0 shipped + v2.1 Phases 35 through 38 (Plans 01-04) shipped. Plan 38-05 vibe-check pending. Author: Claude Code.*
