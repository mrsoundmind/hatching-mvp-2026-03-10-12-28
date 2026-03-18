# Phase 05: Route Architecture Cleanup - Research

**Researched:** 2026-03-18
**Domain:** Express.js route modularization, TypeScript module splitting
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ARCH-01 | `routes.ts` (3,500+ lines) split into focused modules: `projects.ts`, `teams.ts`, `agents.ts`, `messages.ts`, `chat.ts` | Full route-group mapping documented below; exact line ranges identified |
| ARCH-02 | All existing tests pass after route split — no behavior changes | Test files identified; `test:integrity` and `test:dto` test pure utility modules, not routes — they will pass unchanged |
</phase_requirements>

---

## Summary

`server/routes.ts` is 4,347 lines and contains everything: HTTP routes for projects/teams/agents/conversations/messages/tasks, the WebSocket server setup, all AI streaming logic, auth routes, dev/personality/handoff routes, and ~8 inner functions. The file was built incrementally and has never been refactored.

The split is mechanically straightforward but has several important nuances. First, there are already stub files at `server/routes/chat.ts` and `server/routes/tasks.ts` (empty placeholders), and fully implemented `server/routes/autonomy.ts` and `server/routes/health.ts` that demonstrate the established pattern for this codebase: export a `register*Routes(app, deps)` function that receives `app` and any required closures as a deps object.

The most critical constraint is that `handleStreamingColleagueResponse` (lines 2330–3960) and the WebSocket server setup (lines 1497–2057) are deeply entangled: `broadcastToConversation`, `activeConnections`, `streamingConversations`, `activeStreamingResponses`, `wss`, and `sendWsError` are all created inside `registerRoutes` and used by the streaming handler. Extracting `chat.ts` requires either (a) passing all these as deps, or (b) extracting the WS setup first and making it a standalone module that receives the httpServer.

**Primary recommendation:** Use the established `register*Routes(app, deps)` factory pattern. Extract simpler groups (projects, teams, agents, messages) first via mechanical move. Extract chat last since it has the largest closure surface area.

---

## Current File Structure (Verified by Inspection)

### Exact Line Ranges

| Route Group | Start Line | End Line | Approx Lines | Notes |
|-------------|-----------|---------|-------------|-------|
| Top-level setup (imports, helpers, auth middleware) | 1 | 364 | 364 | Must stay in `routes.ts` or be a `setupRoutes.ts` |
| **Projects** | 365 | 565 | 200 | `GET/POST/PUT/PATCH/DELETE /api/projects*` + brain endpoints |
| **Teams** | 566 | 673 | 108 | `GET/POST/PUT/PATCH/DELETE /api/teams*` |
| **Agents** | 674 | 798 | 125 | `GET/POST/PUT/PATCH/DELETE /api/agents*` |
| **Messages / Conversations** | 799 | 1016 | 218 | Chat API routes: conversations + messages |
| `/api/hatch/chat` + reactions + feedback | 1017 | 1169 | 153 | `POST /api/hatch/chat`, reactions, training feedback |
| Auth (Google OAuth + login/logout/me) | 1171 | 1453 | 283 | Already in `server/auth/googleOAuth.ts` (logic); handlers here |
| Dev/personality/handoff routes | 1354 | 1492 | 139 | Dev training, personality, handoff stats |
| `registerAutonomyRoutes(app)` call | 1493 | 1493 | 1 | Already extracted |
| **WebSocket server setup + connection handler** | 1494 | 2057 | 564 | `wss`, `activeConnections`, `broadcastToConversation` |
| `handleMultiAgentResponse` + team consensus | 2058 | 2328 | 271 | AI chat inner functions |
| `handleStreamingColleagueResponse` | 2329 | 3960 | 1632 | The largest single block — the entire streaming AI pipeline |
| Memory extraction + user name extraction | 3962 | 4045 | 84 | Helper functions called inside streaming handler |
| **Tasks** | 4047 | 4347 | 301 | Tasks CRUD + extraction + suggestions |

**Observation:** `server/routes/tasks.ts` stub already exists. Tasks (lines 4047–4347) are cleanly self-contained and a good first cut.

### What Already Exists in `server/routes/`

| File | Status | Pattern |
|------|--------|---------|
| `health.ts` | Fully implemented | `registerHealthRoute(app, deps)` with typed `deps` interface |
| `autonomy.ts` | Fully implemented | `registerAutonomyRoutes(app)` — replicates `getSessionUserId`/`getOwnedProject` locally |
| `chat.ts` | Stub only | `registerChatRoutes(_app)` — intentionally empty |
| `tasks.ts` | Stub only | `registerTaskRoutes(_app)` — intentionally empty |

---

## Standard Stack

### Core (Already in Use — No New Dependencies)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| Express | 4.21.2 | HTTP server + routing | `app.get/post/put/patch/delete` — no change |
| TypeScript | 5.6.3 strict | Type safety | All new modules must use typed deps interfaces |
| Zod | 3.24.2 | Input validation | Already used in every route handler |
| `ws` | 8.18.0 | WebSocket server | Stays in `chat.ts` or a `websocket.ts` module |

### The Established Pattern (from `autonomy.ts` and `health.ts`)

```typescript
// Pattern: typed deps interface + register function
interface RegisterXxxDeps {
  getSessionUserId: (req: Request) => string;
  getOwnedProject: (projectId: string, userId: string) => Promise<Project | null>;
}

export function registerXxxRoutes(app: Express, deps: RegisterXxxDeps): void {
  app.get('/api/xxx', async (req, res) => {
    const userId = deps.getSessionUserId(req);
    // ...
  });
}
```

**Observation:** `autonomy.ts` duplicates `getSessionUserId` and `getOwnedProject` locally (lines 31–44 of `autonomy.ts`) rather than receiving them from `routes.ts`. This is intentional — each module is self-contained. The planner should adopt this same approach for all new modules.

---

## Architecture Patterns

### Recommended Final Structure

```
server/
├── routes.ts               # Reduced: imports + registerRoutes() orchestrator only
├── routes/
│   ├── health.ts           # DONE: GET /health
│   ├── autonomy.ts         # DONE: /api/conductor/*, /api/safety/*, etc.
│   ├── chat.ts             # FILL IN: /api/hatch/chat + WebSocket server + streaming handler
│   ├── tasks.ts            # FILL IN: /api/tasks*, /api/task-suggestions/*
│   ├── projects.ts         # NEW: /api/projects*
│   ├── teams.ts            # NEW: /api/teams*
│   ├── agents.ts           # NEW: /api/agents*
│   └── messages.ts         # NEW: /api/conversations* + /api/messages*
```

### Pattern 1: Self-Contained Module (Recommended for projects/teams/agents/messages)

Each module redefines the minimal set of shared helpers it needs (`getSessionUserId`, `getOwnedProject`, etc.) rather than importing them from `routes.ts`. This is the pattern already used in `autonomy.ts` — consistent and avoids circular imports.

```typescript
// Source: server/routes/autonomy.ts lines 31-44 (verified)
import type { Express, Request } from 'express';
import { storage } from '../storage.js';

export function registerProjectRoutes(app: Express): void {
  const getSessionUserId = (req: Request): string => (req.session as any).userId as string;
  const getOwnedProject = async (projectId: string, userId: string) => {
    const project = await storage.getProject(projectId);
    if (!project) return null;
    return (project as any).userId === userId ? project : null;
  };

  app.get('/api/projects', async (req, res) => { ... });
  // ... remaining project routes
}
```

### Pattern 2: Chat/WS Module (More Complex Deps)

The `chat.ts` module requires access to the `httpServer` (for WS attachment) and needs to export `broadcastToConversation` back to the global broadcast reference. The cleanest approach:

```typescript
// server/routes/chat.ts
import { createServer, type Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import type { Express } from 'express';

interface RegisterChatDeps {
  sessionParser?: SessionParser;
  onBroadcastReady: (broadcast: (conversationId: string, data: unknown) => void) => void;
}

export function registerChatRoutes(
  app: Express,
  httpServer: Server,
  deps: RegisterChatDeps
): void {
  // WebSocket setup, activeConnections, all streaming logic lives here
}
```

The `_globalBroadcast` reference currently in `routes.ts` needs to remain accessible from `index.ts` via `getGlobalBroadcast()`. This export stays in `routes.ts` since it's re-exported from there.

### Pattern 3: Auth Routes Stay in routes.ts (or separate auth.ts)

Auth routes (lines 1171–1353) import from `server/auth/googleOAuth.ts` which is already extracted. These could move to `server/routes/auth.ts` but they are NOT in the Phase 5 success criteria — the spec only requires projects, teams, agents, messages, chat. Auth can be deferred.

### Anti-Patterns to Avoid

- **Importing shared helpers from routes.ts into sub-modules**: creates circular imports. Each module should be self-contained, re-declaring small helpers locally (same pattern as `autonomy.ts`).
- **Creating a `shared-helpers.ts` for route utilities**: unnecessary indirection for 3-line functions. Follow the existing pattern.
- **Moving WebSocket setup before extracting HTTP routes**: WS setup (1,600 lines) is the hardest part. Extract the simple HTTP groups first.
- **Changing function signatures**: `handleStreamingColleagueResponse` and `handleMultiAgentResponse` should move as-is — zero logic changes.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Module factory pattern | Custom DI container | Simple function parameter pattern | Already established in `autonomy.ts` and `health.ts` |
| Route validation | New middleware | Existing Zod validators already in each handler | Each handler already validates |
| Auth re-use | New auth module abstraction | Replicate the 3-line helper locally | Same pattern as `autonomy.ts` |

---

## Common Pitfalls

### Pitfall 1: Circular Import Between routes.ts and Sub-Modules
**What goes wrong:** If `routes.ts` imports from `routes/projects.ts` AND `routes/projects.ts` imports anything from `routes.ts` (like `getSessionUserId`), Node.js will give you undefined values at runtime.
**Why it happens:** ES module circular dependency resolution.
**How to avoid:** Sub-modules import only from `../storage.js`, `@shared/*`, and other non-routes modules. Never import from `../routes.ts`.
**Warning signs:** TypeScript compiles fine but runtime gets `undefined` function errors.

### Pitfall 2: Forgetting to Delete Stub Registrations
**What goes wrong:** `chat.ts` stub is already imported in `routes.ts` at line 72? No — it's NOT. The stub `registerChatRoutes` is defined but not called from anywhere. BUT when you fill in the stub, if you add routes there while the original routes in `routes.ts` still exist, both will respond to the same path. Express registers both handlers; the first one wins but both fire.
**How to avoid:** Delete the corresponding block from `routes.ts` immediately when you fill in a sub-module.

### Pitfall 3: The broadcastToConversation Closure
**What goes wrong:** `broadcastToConversation` is defined inside `registerRoutes` at line 2060 and references `activeConnections` (a closure variable from line 1523). The `_globalBroadcast` at line 2079 sets the global reference after WS setup.
**Why it matters for extraction:** If `chat.ts` defines `broadcastToConversation` locally, the `_globalBroadcast` in `routes.ts` will never be set, breaking the autonomy runner which calls `getGlobalBroadcast()`.
**How to avoid:** Either (a) keep `_globalBroadcast` assignment in `routes.ts` and have `chat.ts` call a callback when broadcast is ready, or (b) move `getGlobalBroadcast`/`_globalBroadcast` into `chat.ts` and re-export from there.

### Pitfall 4: TypeScript `import.meta` / `.js` Extension Requirements
**What goes wrong:** The project uses `.js` extensions on all local imports (verified: `import { storage } from "./storage"` vs `import { storage } from './storage.js'` in `autonomy.ts`). `routes.ts` uses both styles.
**How to avoid:** Follow `autonomy.ts` style — use `.js` extensions for sub-module imports to match the ESM + tsx configuration.
**Warning signs:** `npm run typecheck` passes but `npm run build` fails with module resolution errors.

### Pitfall 5: tasks.ts Has Imports of `insertTaskSchema` Not Yet in Sub-Module
**What goes wrong:** The task routes at line 4068 use `insertTaskSchema` from `@shared/schema` and `type Task`. If you copy those lines without bringing the imports, TypeScript will error.
**How to avoid:** Always grep the moved code for all referenced names and add corresponding imports to the new file before deleting from `routes.ts`.

---

## Code Examples

### Verified Pattern: How autonomy.ts registers routes (the exact template to follow)

```typescript
// Source: server/routes/autonomy.ts (verified, lines 1-44)
import type { Express, Request } from 'express';
import { storage } from '../storage.js';
// ... other imports

export function registerAutonomyRoutes(app: Express): void {
  const getSessionUserId = (req: Request): string | undefined => (req.session as any)?.userId as string | undefined;

  const getOwnedProjectIds = async (userId: string): Promise<Set<string>> => {
    const projects = await storage.getProjects();
    return new Set(projects.filter((project: any) => project.userId === userId).map((project) => project.id));
  };

  const requireOwnedProject = async (projectId: string, userId: string) => {
    const project = await storage.getProject(projectId);
    if (!project) return null;
    return (project as any).userId === userId ? project : null;
  };

  app.post('/api/conductor/evaluate-turn', async (req, res) => { ... });
  // ...
}
```

### How health.ts uses a typed deps interface (for WS health callback)

```typescript
// Source: server/routes/health.ts (verified, lines 10-17)
interface RegisterHealthDeps {
  getWsHealth: () => {
    status: 'ok' | 'degraded' | 'down';
    connections: number;
  };
}

export function registerHealthRoute(app: Express, deps: RegisterHealthDeps): void { ... }
```

### How routes.ts calls the already-extracted modules (verified, lines 130-132, 1493)

```typescript
registerHealthRoute(app, { getWsHealth: () => getWsHealth() });
// ... much later ...
registerAutonomyRoutes(app);
```

### The `devLog` pattern (must be replicated in each sub-module)

```typescript
// Source: server/routes.ts lines 11-15 (verified)
const devLog = (...args: any[]) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(...args);
  }
};
```

This is a local module helper — each new module file should include its own copy.

---

## Shared Helpers That Will Be Replicated (Not Imported)

These 4 helpers appear in `routes.ts` and also in `autonomy.ts` (which independently re-declared them). Each new module should re-declare locally:

| Helper | Lines in routes.ts | Pattern |
|--------|-------------------|---------|
| `getSessionUserId` | 327 | 1-liner: `(req.session as any).userId` |
| `getOwnedProjectIds` | 329–332 | async, filters `storage.getProjects()` |
| `getOwnedProject` | 334–338 | async, single project ownership check |
| `getOwnedTeam` | 340–345 | async, checks team ownership via project |
| `getOwnedAgent` | 347–352 | async, checks agent ownership via project |
| `conversationOwnedByUser` | 354–363 | async, WS auth — only needed in `chat.ts` |
| `requireAuth` middleware | 312–317 | HTTP middleware — stays in `routes.ts` since the `app.use('/api', ...)` middleware registration must remain there |
| `devLog` | 11–15 | local console guard |

**Note:** `requireAuth` and the `app.use('/api', requireAuth)` registration at line 320 MUST stay in `routes.ts` because they must be registered on `app` before any route modules are registered.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| All routes in one file | Register-function per module, file per domain | Established by `autonomy.ts` and `health.ts` — follow exactly |
| God-file routes | `register*Routes(app)` factory | Already proven pattern in this codebase |
| Stub files | Fill in actual routes, delete from routes.ts | `chat.ts` and `tasks.ts` stubs are ready to be filled |

---

## Extraction Order (Recommended)

Based on complexity and closure dependencies:

1. **tasks.ts** — Self-contained, no closure deps, stub already exists. Lines 4047–4347 of `routes.ts`. ~300 lines. Easiest first cut.
2. **projects.ts** — Self-contained. Lines 365–565. ~200 lines. Uses only `storage` and session helpers.
3. **teams.ts** — Self-contained. Lines 566–673. ~108 lines.
4. **agents.ts** — Self-contained. Lines 674–798. ~125 lines.
5. **messages.ts** — Lines 799–1016. ~218 lines. Covers conversations + messages REST endpoints (NOT the WS streaming — that stays in chat.ts).
6. **chat.ts** — Lines 1017–2057 (HTTP hatch/chat + WS setup) + 2058–3961 (all streaming/AI functions). ~2,900 lines. Most complex due to closures. Stub exists. Fill last.

---

## What Stays in routes.ts After Extraction

The final `routes.ts` should contain only:

1. All `import` statements (reduced to what's still needed)
2. `type SessionParser` and `type AuthedWebSocket` type aliases
3. `_globalBroadcast` + `getGlobalBroadcast()` export (if not moved to `chat.ts`)
4. `export async function registerRoutes(app, sessionParser)` — the orchestrator body shrinks to:
   - `initializePreTrainedColleagues()` call
   - `getWsHealth` stub + `registerHealthRoute(app, ...)` call
   - `requireAuth` middleware + `app.use('/api', requireAuth)` registration
   - `getSessionUserId` definition (used by auth middleware scope)
   - `app.get("/api/system/storage-status")` (dev-only, no auth)
   - Auth routes (lines 1171–1453) — OR these move to `server/routes/auth.ts`
   - Dev/personality/handoff routes (1354–1492) — OR move to `server/routes/dev.ts`
   - `registerAutonomyRoutes(app)` call
   - `registerProjectRoutes(app)` call
   - `registerTeamRoutes(app)` call
   - `registerAgentRoutes(app)` call
   - `registerMessageRoutes(app)` call
   - `registerTaskRoutes(app)` call
   - `registerChatRoutes(app)` call (which returns or sets up httpServer)
   - `return httpServer`

---

## Open Questions

1. **Auth routes ownership**
   - What we know: Auth routes (lines 1171–1453) are not in Phase 5 success criteria. They use helpers from `server/auth/googleOAuth.ts` (already extracted).
   - What's unclear: Should auth routes move to `server/routes/auth.ts` as part of this phase or be left in `routes.ts`?
   - Recommendation: Leave auth routes in `routes.ts` for this phase. They're not in the spec and don't affect the 5 target modules.

2. **`_globalBroadcast` ownership after chat.ts extraction**
   - What we know: `getGlobalBroadcast()` is exported from `routes.ts` and imported by `server/index.ts` at line 8. After `chat.ts` extraction, the broadcast is set inside `chat.ts`.
   - What's unclear: Should `_globalBroadcast` move to `chat.ts` with a re-export, or stay in `routes.ts` with a callback passed to `registerChatRoutes`?
   - Recommendation: Pass an `onBroadcastReady` callback from `routes.ts` to `registerChatRoutes`. This keeps the `getGlobalBroadcast()` export stable and avoids changing `index.ts`.

3. **Dev/personality/handoff routes**
   - What we know: Lines 1354–1492 contain dev training, personality evolution API, and handoff stats. These are not mentioned in success criteria.
   - What's unclear: Do they need a module?
   - Recommendation: Leave in `routes.ts` for this phase. They're auxiliary and don't affect the 5 target modules.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | tsx (direct script execution, no test runner) |
| Config file | none — scripts run via `tsx scripts/test-*.ts` |
| Quick run command | `npm run test:dto && npm run test:integrity` |
| Full suite command | `npm run typecheck && npm run test:integrity && npm run test:dto` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ARCH-01 | Route modules exist and handle correct paths | Manual smoke test + typecheck | `npm run typecheck` | Planned in Wave 0 |
| ARCH-02 | All tests pass unchanged | Regression | `npm run test:integrity && npm run test:dto` | YES — existing scripts |

**Key finding:** `test:integrity` tests `server/autonomy/integrity/conversationIntegrity.ts` — a pure utility module with no dependency on `routes.ts`. It will pass regardless of route reorganization.

**Key finding:** `test:dto` tests `shared/dto/wsSchemas.ts` and `shared/dto/apiSchemas.ts` — pure schema modules with no dependency on `routes.ts`. It will pass regardless of route reorganization.

**Therefore:** ARCH-02 (all tests pass) is satisfied by the nature of these tests. The only real gate is `npm run typecheck` passing after each module extraction.

### Sampling Rate
- **Per task commit:** `npm run typecheck`
- **Per wave merge:** `npm run typecheck && npm run test:integrity && npm run test:dto`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] No new test files needed — `test:integrity` and `test:dto` are route-independent
- [ ] TypeScript is the primary correctness gate — run after every module extraction

---

## Sources

### Primary (HIGH confidence)
- Direct inspection of `server/routes.ts` (4,347 lines, 2026-03-18) — all line ranges and structure
- Direct inspection of `server/routes/autonomy.ts` — the established extraction pattern
- Direct inspection of `server/routes/health.ts` — the typed deps pattern
- Direct inspection of `server/routes/chat.ts` and `tasks.ts` — confirmed as stubs
- `server/index.ts` — confirmed how `registerRoutes` and `getGlobalBroadcast` are imported

### Secondary (MEDIUM confidence)
- Express.js route modularization pattern is industry standard — no novel patterns needed here
- TypeScript strict mode with ESM `.js` extensions — confirmed by project `tsconfig.json` and existing import style in `autonomy.ts`

---

## Metadata

**Confidence breakdown:**
- Route group mapping (line ranges): HIGH — directly inspected
- Extraction pattern: HIGH — verified against existing `autonomy.ts` which already does this
- Chat/WS complexity: HIGH — directly read the closure structure
- Test independence: HIGH — verified `test:integrity` and `test:dto` import only from non-routes modules

**Research date:** 2026-03-18
**Valid until:** Indefinite — purely internal refactor, no external dependencies
