# Stack Research

**Domain:** Autonomous agent execution loop — background task runners, agent-to-agent handoffs, risk-based autonomy, self-policing peer review, chat summary briefings
**Researched:** 2026-03-19
**Confidence:** HIGH (based on codebase analysis + training knowledge; web tools unavailable for live version verification)

---

## Context: What Already Exists

This is a subsequent milestone on an existing v1.0 platform. The following are already installed and in production use — do NOT re-add or duplicate:

| Already Installed | Version | Notes |
|-------------------|---------|-------|
| `node-cron` | 4.2.1 | Running backgroundRunner health checks every 2h, world sensor every 6h |
| `@langchain/langgraph` | 0.4.9 | State machine for per-message multi-agent routing |
| `@langchain/core` | 0.3.74 | LangChain primitives |
| `ws` | 8.18.0 | WebSocket server + real-time streaming |
| `drizzle-orm` | 0.39.1 | ORM — all persistence must go through this |
| `zod` | 3.24.2 | Validation — all inputs must use this |
| `p-queue` | 6.6.2 | Concurrency queue — already a transitive dep |
| `eventemitter3` | 4.0.7 | EventEmitter — already a transitive dep |

The autonomy foundation (`server/autonomy/`) already has: `backgroundRunner`, `frictionMap`, `projectHealthScorer`, `proactiveOutreach`, `worldSensor`, `taskGraphEngine`, `peerReviewRunner`, `decisionAuthority`, `escalationLadder`. The v1.1 milestone is about **wiring these into a real execution loop** — not building from scratch.

---

## Recommended Stack Additions

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `pg-boss` | ^10.x | Durable job queue backed by PostgreSQL | No Redis required — runs on the existing Neon PostgreSQL. Jobs survive process restarts (unlike in-process node-cron). Supports retries, delays, deduplication, dead-letter queues, scheduled jobs. Perfect for agent handoff tasks that must not be lost if the process restarts. MEDIUM confidence on exact version — verify on npm before installing. |
| `p-queue` | 6.6.2 | In-process concurrency control for LLM calls | Already a transitive dep (via @langchain/). Use directly instead of adding a new package. Prevents LLM rate limit bursts when multiple background agents fire simultaneously. |
| `zod` | 3.24.2 | Already installed — use for all handoff task schemas | Validate every inter-agent message payload before processing. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node-cron` | 4.2.1 | Already installed — keep for lightweight periodic triggers | Keep for health checks (every 2h) and world sensor (every 6h). Do NOT replace with pg-boss for these — they don't need durability, just scheduling. |
| `drizzle-orm` | 0.39.1 | Already installed — extend schema for job state | Add `execution_runs` and `agent_handoffs` tables through Drizzle. All pg-boss job metadata should mirror into Drizzle tables for querying from the app. |
| `eventemitter3` | 4.0.7 | Already a transitive dep — use for internal progress events | Emit `execution:progress`, `execution:handoff`, `execution:complete` events internally. The WS broadcast layer listens and relays to clients. Keep event bus in-process for now (no Redis pub/sub needed at MVP scale). |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `tsx` | Already installed — run background worker scripts | Use `tsx scripts/test-execution-loop.ts` for integration tests |
| `drizzle-kit` | Already installed — schema migrations | Every new table added for execution state requires `npm run db:push` |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Redis / BullMQ** | Requires a new Redis instance — unnecessary infrastructure cost and operational overhead for single-node MVP. Neon PostgreSQL is already present. | `pg-boss` — same durability guarantees over existing DB |
| **Temporal.io** | Powerful but enormous operational complexity (separate service, separate SDK). Overkill for a 7-agent execution loop at MVP scale. | LangGraph state machine + pg-boss job queue |
| **Celery / Python worker** | Wrong language ecosystem. The codebase is TypeScript-only — a Python worker would create a polyglot split with shared-schema pain. | Node.js worker threads or pg-boss workers in the same process |
| **Socket.io** | The app already uses raw `ws`. Switching socket libraries mid-product would break existing WS protocol. Socket.io adds rooms/namespaces features that are not needed here. | Existing `ws` + `broadcastToConversation()` pattern |
| **Prisma** | Already using Drizzle ORM. Adding Prisma for execution state tables creates dual ORM hell — type conflicts, two migration systems, confusion. | Extend `shared/schema.ts` with Drizzle |
| **Kafka / RabbitMQ** | Message broker overkill. There are at most ~26 agents per project firing background tasks. A simple pg-boss queue handles hundreds of concurrent jobs with zero added infra. | pg-boss |
| **Worker threads (node:worker_threads)** | LLM calls are I/O-bound, not CPU-bound. Worker threads help CPU-bound work. The overhead of serializing LangGraph state across thread boundaries is not worth it. | Async/await + p-queue concurrency control |
| **Re-implementing the task queue in plain setTimeout/setInterval** | The current backgroundRunner already uses node-cron for periodic work. Using setTimeout for durable task handoffs risks losing jobs on restart, no retry support. | pg-boss for durable jobs |

---

## Integration Architecture: How New Pieces Connect to Existing Stack

### pg-boss: The Missing Durable Layer

The existing `backgroundRunner.ts` uses node-cron for **periodic triggers** (every 2h health check). That's appropriate for scheduled scans. But **agent-to-agent handoffs** are event-driven, not periodic — when an Engineer Hatch finishes a task, it should immediately hand off to the Designer Hatch with full context.

pg-boss fills this gap:

```
User: "Go ahead and work on this"
  → Chat handler creates pg-boss job: { type: 'agent_execution', taskId, projectId, ownerRole: 'PM' }
  → pg-boss worker picks up job
  → PM Hatch scopes the work → marks complete → creates successor job: { type: 'agent_execution', ownerRole: 'Engineer' }
  → Engineer Hatch picks up → works → hands to Designer
  → On completion: briefing job created → Maya summarizes all activity
  → WS broadcast: { type: 'execution_complete', briefing }
```

pg-boss integrates directly with the existing Neon PostgreSQL instance. No new infrastructure. The job table lives alongside the existing Drizzle tables.

### LangGraph: Extend for Background Execution Context

The existing `graph.ts` runs synchronously per HTTP request/WS message. For background execution, the same LangGraph nodes should be callable outside of a live WebSocket context. The key change is:

- Pass a `backgroundContext: true` flag to nodes
- In background mode, accumulate output instead of streaming chunks
- Emit progress via the internal EventEmitter (not WS directly from the graph)
- The pg-boss worker calls the graph, the graph emits events, the WS layer broadcasts to any connected client

No new LangGraph packages needed — just pattern changes to how the graph is invoked.

### EventEmitter as Internal Bus

```
pg-boss worker
  → calls runBackgroundExecution()
    → LangGraph node runs
    → emits: executionEvents.emit('progress', { jobId, chunk, agentId })
      → WS layer: if client connected → stream chunk
      → WS layer: if no client → buffer in execution_runs.progress_log (JSONB)
  → emits: executionEvents.emit('handoff', { fromRole, toRole, context })
    → creates next pg-boss job
  → emits: executionEvents.emit('complete', { summary })
    → creates briefing message in messages table
    → WS broadcast: { type: 'execution_complete' }
```

The `eventemitter3` dep already exists transitively — use it directly.

---

## New Schema Tables Required

These should be added to `shared/schema.ts` via Drizzle and applied with `npm run db:push`.

### `execution_runs`

Tracks a complete autonomous execution session (from "go ahead" trigger to final briefing).

```typescript
// Drizzle schema — add to shared/schema.ts
export const executionRuns = pgTable("execution_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id).notNull(),
  triggeredBy: varchar("triggered_by").references(() => users.id),
  triggerType: text("trigger_type").notNull(), // 'explicit' | 'inactivity'
  status: text("status").notNull().default("pending"), // 'pending' | 'running' | 'complete' | 'failed'
  objective: text("objective"),
  progressLog: jsonb("progress_log").$type<Array<{
    agentId: string; agentRole: string; chunk: string; ts: string;
  }>>().default([]),
  briefingSummary: text("briefing_summary"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});
```

### `agent_handoffs`

Audit trail for each agent-to-agent handoff within an execution run.

```typescript
export const agentHandoffs = pgTable("agent_handoffs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  executionRunId: varchar("execution_run_id").references(() => executionRuns.id).notNull(),
  fromAgentId: varchar("from_agent_id").references(() => agents.id),
  toAgentId: varchar("to_agent_id").references(() => agents.id),
  fromRole: text("from_role").notNull(),
  toRole: text("to_role").notNull(),
  handoffContext: text("handoff_context"),
  riskScore: doublePrecision("risk_score"),
  approved: boolean("approved").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `pg-boss` over Neon PostgreSQL | BullMQ + Redis | Only if the app outgrows single-node and needs Redis anyway (e.g., for WS multi-node clustering). At that point, BullMQ is worth the Redis cost. |
| Extend LangGraph for background mode | Build a separate execution engine | Only if background execution needs fundamentally different routing logic than chat. Currently both share the same role-routing — keep them unified. |
| In-process EventEmitter for progress | Redis pub/sub | Only needed when running multiple Node.js instances. At single-node MVP scale, in-process EventEmitter is zero-latency and zero-cost. |
| node-cron for periodic health checks (keep existing) | pg-boss scheduled jobs | pg-boss can do scheduled jobs too, but replacing node-cron that already works would be scope creep. Keep node-cron for periodic work, pg-boss for event-driven work. |
| Drizzle schema extension | Separate migration tool | Prisma/Knex etc. would create dual-ORM. Drizzle is already established — extend it. |

---

## Stack Patterns by Variant

**If BACKGROUND_AUTONOMY_ENABLED=false (default):**
- No pg-boss workers start
- No execution_runs created
- Chat still works fully — autonomy is opt-in

**If user provides explicit trigger ("go ahead"):**
- Create pg-boss job immediately (synchronous response to user action)
- Risk gate: if risk_score > 0.7, pause and surface approval modal before creating job
- Low-risk tasks (risk < 0.3): auto-approved, job created immediately

**If implementing inactivity trigger (future):**
- node-cron job checks last user activity
- If inactive > N hours AND project has pending tasks → create execution job
- This is a separate cron schedule from the health check cycle — add to backgroundRunner.ts

**If buffering progress for offline users:**
- Append chunks to `execution_runs.progress_log` (JSONB array)
- On user reconnect: `GET /api/projects/:id/execution-runs/latest` returns buffered log
- Frontend replays buffered chunks in ExecutionProgress component

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `pg-boss@10.x` | `drizzle-orm@0.39.1` | pg-boss manages its own tables — no Drizzle conflicts. Use Neon PostgreSQL connection string directly for pg-boss init. Verify pg-boss supports `@neondatabase/serverless` driver — may need standard `pg` package for pg-boss connection while Drizzle uses Neon serverless. |
| `pg-boss@10.x` | `node@20.x` | pg-boss requires Node 16+ — fine with current setup |
| `p-queue@6.6.2` (existing) | All current deps | Already installed transitively, safe to import directly |
| `eventemitter3@4.0.7` (existing) | All current deps | Already installed transitively, safe to import directly |

---

## Installation

```bash
# Durable job queue (the only NEW package needed)
npm install pg-boss

# No other new packages needed — use what's already installed:
# p-queue (already dep of @langchain), eventemitter3 (already dep of ws/langchain)
```

**One-time setup** — pg-boss creates its own schema tables in PostgreSQL on first `start()`:

```typescript
import PgBoss from 'pg-boss';
const boss = new PgBoss(process.env.DATABASE_URL!);
await boss.start(); // creates pgboss schema if not exists
```

---

## What the v1.1 Milestone Does NOT Need

These are explicitly out of scope for autonomous execution loop:

- **LangSmith upgrade** — already integrated, no change needed
- **New LLM provider** — Gemini 2.5-Flash + GPT-4o-mini fallback is sufficient for background execution
- **SSE (Server-Sent Events)** — WebSocket already handles streaming; adding SSE would duplicate the transport layer
- **New frontend state library** — TanStack Query + WebSocket hook pattern handles execution state updates; no Zustand/Jotai needed
- **GraphQL** — REST + WebSocket is sufficient; GraphQL subscriptions would be a full protocol migration
- **Docker/containerization changes** — single-process Node.js is fine for MVP

---

## Sources

- Codebase analysis (`server/autonomy/background/backgroundRunner.ts`, `frictionMap.ts`, `proactiveOutreach.ts`, `worldSensor.ts`, `taskGraphEngine.ts`, `peerReviewRunner.ts`, `decisionAuthority.ts`) — HIGH confidence
- `package.json` — installed versions confirmed directly — HIGH confidence
- `server/autonomy/config/policies.ts` — existing feature flags and budget constants — HIGH confidence
- `shared/schema.ts` — existing Drizzle schema structure — HIGH confidence
- Training knowledge on pg-boss, BullMQ, LangGraph patterns — MEDIUM confidence (verify pg-boss version on npm before installing; web tools unavailable during research)

---

*Stack research for: Hatchin v1.1 autonomous execution loop*
*Researched: 2026-03-19*
