# Stack Research

**Domain:** Autonomy visibility UI — activity feeds, file upload with PDF parsing, approval management, kanban/pipeline views, real-time event streaming on an existing React 18 + Tailwind + Framer Motion + Shadcn platform
**Researched:** 2026-03-24
**Confidence:** HIGH (package versions verified via npm search; integration patterns confirmed against existing codebase)

---

## Context: Existing Stack (Do NOT Re-Add)

This is v1.3 on an existing platform. The following are already installed — do not duplicate:

| Already Installed | Version | Purpose |
|-------------------|---------|---------|
| `framer-motion` | 11.18.2 | Animation — use for all state transitions, pulsing, timeline entries |
| `@radix-ui/react-tabs` | 1.1.4 | Tab primitives — use for right sidebar tab bar |
| `@radix-ui/react-scroll-area` | 1.2.4 | Virtualized scrollable regions — use for activity feed container |
| `@radix-ui/react-switch` | 1.1.4 | Toggle controls — use for autonomy settings (inactivity, cost cap) |
| `@radix-ui/react-slider` | 1.2.4 | Range slider — use for autonomy level control |
| `@radix-ui/react-progress` | 1.1.3 | Progress bar — use for cost cap/usage indicator |
| `recharts` | 2.15.2 | Charts — use for autonomy stats card (execution count over time) |
| `date-fns` | 3.6.0 | Date utilities — use `formatDistanceToNow` for feed item timestamps |
| `react-resizable-panels` | 2.1.7 | Panel sizing — already handles sidebar resize |
| `ws` | 8.18.0 | WebSocket — existing WS connection in CenterPanel stays as-is |
| `@tanstack/react-query` | 5.60.5 | Server state — use for all autonomy data fetching |
| `lucide-react` | 0.453.0 | Icons — use for feed event type icons, upload icons |

The v1.3 milestone is **primarily frontend work** — the backend autonomy engine (pg-boss, autonomy_events table, trust scoring, handoff orchestrator) already exists. The question is which libraries are needed for the new UI surface.

---

## Recommended Stack Additions

### New Dependencies Required

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `react-dropzone` | ^15.0.0 | Drag-and-drop file upload zone for Brain & Docs tab | Industry standard for file drop UIs. 4,500+ downstream packages. Hook-based (`useDropzone`) — fits the existing React hooks pattern. Accepts MIME type restrictions (PDF, DOCX only). Works with React 18. Lightweight — handles the drop UI only; upload via existing fetch. |
| `multer` | ^2.0.2 | Server-side `multipart/form-data` parsing for `/api/projects/:id/documents` | Official Express middleware for file uploads. v2.0.2 fixes two high-severity CVEs (DoS via memory leak, malformed request crash) present in v1.x — do not use v1. `memoryStorage()` keeps file in `req.file.buffer` — no disk writes, extract text then store as base64 in `brain.documents` JSONB. Express/expressjs org-maintained. |
| `@types/multer` | ^2.1.0 | TypeScript types for multer v2 | Matches multer v2 API surface. Published 9 days ago (as of research date). |
| `pdf-parse` | ^1.1.1 | Extract plain text from PDF buffers on the server | Simplest API for the use case: `pdfParse(buffer)` returns `{ text, numpages, info }`. 2M weekly downloads, wraps Mozilla's pdf.js core. No native deps — runs on Neon/serverless edge without binary issues. Use to populate `brain.documents[].extractedText` for LLM context injection. MEDIUM confidence on exact version — verify on npm; the newer `pdf-parse-new` fork exists but the original is more battle-tested. |
| `@dnd-kit/core` | ^6.3.1 | Drag-and-drop primitives for task pipeline kanban view | Lightest option (10kb, zero deps). Pointer + touch + keyboard sensors. Accessible (ARIA). Used by Shadcn's official kanban examples. Works with Tailwind + TypeScript without ceremony. Already the community standard for kanban in React 18. |
| `@dnd-kit/sortable` | ^10.0.0 | Sortable item layer over dnd-kit core | Provides `useSortable` hook + `SortableContext` — handles the task card position management within pipeline columns without manual state math. Required companion to `@dnd-kit/core` for reorderable lists. |
| `@tanstack/react-virtual` | ^3.13.23 | Virtualise the activity feed list | Activity feed can accumulate 50+ autonomy events. Without virtualisation, a long feed re-renders every item on each WS chunk. `useVirtualizer` from this package renders only visible rows. Headless — fully compatible with Tailwind. Same TanStack family as existing `@tanstack/react-query`, consistent API patterns. Supports dynamic row heights (feed items vary in size). |

### No New Dependencies Needed (Covered by Existing Stack)

| Feature | Use Existing | Why |
|---------|-------------|-----|
| Tab shell for right sidebar | `@radix-ui/react-tabs` (already installed) | Three-tab layout (Activity / Brain & Docs / Approvals) maps directly to Radix Tabs primitives |
| Pulsing "working" avatar ring | `framer-motion` (already installed) | Add a `working` AvatarState to `BaseAvatar.tsx`; animate a ring with `motion.div` opacity + scale loop |
| Handoff chain timeline | `framer-motion` (already installed) | Animate each chain node entry with `staggerChildren` on a flex column |
| Approval action cards | `@radix-ui/react-dialog` + existing `Button` (already installed) | Approval hub items are structured cards with Approve/Reject — existing Shadcn primitives cover this |
| Feed timestamps | `date-fns` (already installed) | `formatDistanceToNow(event.createdAt, { addSuffix: true })` gives "2 min ago" labels |
| Activity stats | `recharts` (already installed) | Small sparkline of execution counts over last 7 days in the stats card |
| Autonomy toggles | `@radix-ui/react-switch` (already installed) | Inactivity trigger toggle, per-project autonomy enable/disable |
| Cost cap display | `@radix-ui/react-progress` (already installed) | Progress bar for daily cost used vs cap |
| Autonomy level slider | `@radix-ui/react-slider` (already installed) | 3-position autonomy level: Conservative / Balanced / Aggressive |
| Feed container scroll | `@radix-ui/react-scroll-area` (already installed) | Styled scrollable container already in codebase for message lists |
| Real-time feed updates | Existing WS (`ws` + `useRealTimeUpdates`) | Dispatch `CustomEvent` from CenterPanel (existing pattern) → sidebar hook listens |

---

## Installation

```bash
# Frontend additions
npm install react-dropzone @dnd-kit/core @dnd-kit/sortable @tanstack/react-virtual

# Backend additions (server-side only)
npm install multer pdf-parse
npm install -D @types/multer
```

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| `react-dropzone` | Native `<input type="file" />` + drag events | react-dropzone handles edge cases: reject MIME types, file size limits, drag-active visual state, accessibility — all out of the box. Native HTML requires rebuilding all of this. |
| `react-dropzone` | `uppy` (full upload suite) | Uppy is 40kb+ and brings its own UI system. Hatchin already has a UI system. `react-dropzone` is 8kb and hook-only — the upload itself is a plain `fetch` POST. |
| `multer` v2 | `formidable` | multer is the official Express-maintained middleware, integrates cleanly as Express middleware. formidable is standalone and requires manual wiring. No reason to deviate from Express ecosystem at this scale. |
| `pdf-parse` | `pdfjs-dist` directly | `pdfjs-dist` v5 is a full PDF renderer (3M weekly downloads, canvas support). For the brain documents use case, raw text extraction is all that's needed. `pdf-parse` wraps pdfjs with a single-function API. `pdfjs-dist` is appropriate if you later need to render PDF pages visually. |
| `pdf-parse` | `unpdf` (unjs) | `unpdf` is a modern edge-compatible wrapper (~200K downloads) — good for Cloudflare Workers. Not needed here; running on Node.js 20 with standard memory. `pdf-parse` has 10x the adoption and better battle-testing. |
| `@dnd-kit` | `react-beautiful-dnd` | `react-beautiful-dnd` is deprecated (Atlassian no longer maintains it). `@dnd-kit` is the successor the community migrated to. Shadcn's official kanban example uses `@dnd-kit`. |
| `@dnd-kit` | `react-dnd` | `react-dnd` uses a Redux-inspired internal model (providers, monitors) that adds significant boilerplate. `@dnd-kit` has a simpler hook-based API that fits the existing codebase patterns better. |
| `@tanstack/react-virtual` | `react-window` | `react-window` requires fixed item heights. Activity feed items vary in height (short event vs long deliberation trace). `@tanstack/react-virtual` supports dynamic measurement. Same TanStack family already in the project. |
| `CustomEvent` bridge for real-time | Lifting WS to global state | The existing WS connection lives in `CenterPanel`. Moving it to a global store (Zustand/Jotai) would require a large refactor. CustomEvent bus is the minimal-change path — already used as a pattern in the codebase. |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **`multer` v1.x** | Two high-severity CVEs (CVE-2025-47935, CVE-2025-47944) — memory leak DoS and malformed request crash. v1 is no longer safe in production. | `multer` ^2.0.2 |
| **`S3` / `@aws-sdk/client-s3`** | MVP scope says "base64 in brain.documents JSONB" — no external object storage needed. S3 adds AWS account dependency, presigned URL complexity, and billing. The brain documents are small (PDF text, not binary). | Store extracted text + base64 in existing JSONB column |
| **`Zustand` / `Jotai`** | TanStack Query + WS CustomEvent pattern already covers the state management needed. Adding a new global store for v1.3 would split state management into two systems without clear benefit. | `@tanstack/react-query` + CustomEvent |
| **`react-pdf`** | Renders PDF pages visually in-browser with canvas. Not needed — the use case is upload → extract text → show filename in brain list. Visual rendering is scope creep. | `pdf-parse` (server-side text extraction only) |
| **`react-beautiful-dnd`** | Deprecated. Atlassian archived it. No bug fixes. | `@dnd-kit/core` + `@dnd-kit/sortable` |
| **`Socket.io`** | App already uses raw `ws`. Protocol incompatibility — Socket.io clients can't talk to a raw `ws` server. Would require migrating all existing WS logic. | Existing `ws` + CustomEvent bridge |
| **`react-flow` / `@xyflow/react`** | Powerful graph visualization library used for node editors. Handoff chain is a simple linear timeline (PM → Engineer → Designer), not an arbitrary graph. Overkill at 200kb+. | Tailwind flex column + Framer Motion stagger |

---

## Integration Points with Existing Stack

### File Upload Flow

```
Browser: useDropzone (react-dropzone)
  → FormData with file blob
  → POST /api/projects/:id/documents (new route in server/routes/projects.ts)
    → multer.memoryStorage() middleware
    → pdf-parse(req.file.buffer) → { text, numpages }
    → storage.updateProjectBrain(projectId, { documents: [...existing, { name, extractedText, base64 }] })
    → Returns updated brain document list
  → TanStack Query invalidates ['project', id] cache
  → DocumentViewer in BrainDocsTab re-renders
```

### Activity Feed Real-Time Flow

```
Server: WS emits autonomy_event (already implemented in eventLogger.ts)
  → CenterPanel.tsx: receives WS message
    → dispatchEvent(new CustomEvent('autonomy:event', { detail: event }))
  → useAutonomyFeed.ts: window.addEventListener('autonomy:event', handler)
    → appends to local feed state (React useState)
    → @tanstack/react-virtual virtualizer measures new row height
    → scrollToIndex(feed.length - 1) if user is at bottom
```

### Task Pipeline (Kanban) Flow

```
TanStack Query: useQuery(['tasks', projectId]) → tasks[]
  → Group by status: queued | assigned | in-progress | review | done
  → @dnd-kit DndContext wraps columns
  → useSortable per task card
  → onDragEnd: PATCH /api/tasks/:id { status: targetColumn }
    → TanStack Query invalidates ['tasks', projectId]
```

### Avatar Working State

```
BaseAvatar.tsx: add 'working' to AvatarState type
  → Add pulsing ring: motion.div with animate={{ opacity: [0.4, 1, 0.4], scale: [1, 1.12, 1] }}
  → AgentAvatar.tsx: derives state from agent.isExecuting prop
  → LeftSidebar passes isExecuting from autonomy WS events
```

---

## Stack Patterns by Variant

**For the activity feed (Phase 11):**
- Use `@tanstack/react-virtual` only if feed can grow > 50 items in a session
- For initial implementation with < 50 items: plain `overflow-y-auto` div is fine, add virtual when needed
- Feed polling fallback: if WS disconnects, `useQuery` polls `GET /api/autonomy/events?projectId=X` every 10s

**For the task pipeline (Phase 13):**
- For Phase 13's MVP: static column view without drag-and-drop is acceptable to ship first
- Add `@dnd-kit` only when the pipeline needs drag-and-drop reordering — it's a nice-to-have, not blocking
- If drag-and-drop is deferred: still install `@dnd-kit` but render columns without drag context

**For PDF upload (Phase 14):**
- `multer.memoryStorage()` is appropriate for PDFs up to ~10MB — sufficient for project docs
- If users upload very large PDFs (>10MB): switch to disk storage with temp file cleanup, but this is not v1.3 scope
- DOCX support: skip for v1.3. `pdf-parse` handles PDF. DOCX parsing requires `mammoth` (another dep) — defer until user demand justifies it.

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `react-dropzone@15.0.0` | `react@18.3.1` | React 16.8+ required (uses hooks). React 18 fully supported. Verified. |
| `multer@2.0.2` | `express@4.21.2` | Express 4.x fully supported. v2 is an official Express org release. |
| `@types/multer@2.1.0` | `multer@2.0.2` | Type definitions match multer v2 API. Published 9 days before research date. |
| `pdf-parse@1.1.1` | `node@20.16.11` | Pure JavaScript, no native deps. Runs on any Node version. |
| `@dnd-kit/core@6.3.1` | `react@18.3.1` | React 16.8+ required. Published ~March 2025. React 18 supported. |
| `@dnd-kit/sortable@10.0.0` | `@dnd-kit/core@6.3.1` | Must use matching dnd-kit ecosystem versions. Install together. |
| `@tanstack/react-virtual@3.13.23` | `react@18.3.1` | React 18 supported. Actively maintained (published 7 days before research date). |
| `framer-motion@11.18.2` | All above | No conflicts — animation layer is orthogonal to all new deps. |

---

## Sources

- `package.json` (direct read) — installed versions confirmed — HIGH confidence
- [react-dropzone npm](https://www.npmjs.com/package/react-dropzone) — v15.0.0, React 18 compatible — HIGH confidence
- [multer GitHub releases](https://github.com/expressjs/multer/releases) — v2.0.2, CVE fixes confirmed — HIGH confidence
- [@types/multer npm](https://www.npmjs.com/package/@types/multer) — v2.1.0, published 9 days ago — HIGH confidence
- [pdf-parse npm](https://www.npmjs.com/package/pdf-parse) — 2M weekly downloads, simple server API — MEDIUM confidence (version is 1.1.1; newer `pdf-parse-new` fork exists but not recommended over original for stability)
- [pkgpulse blog: unpdf vs pdf-parse vs pdfjs-dist 2026](https://www.pkgpulse.com/blog/unpdf-vs-pdf-parse-vs-pdfjs-dist-pdf-parsing-extraction-nodejs-2026) — pdf-parse recommended for simple Node.js server-side text extraction — MEDIUM confidence
- [@dnd-kit/core npm](https://www.npmjs.com/package/@dnd-kit/core) — v6.3.1 — HIGH confidence
- [@dnd-kit/sortable npm](https://www.npmjs.com/package/@dnd-kit/sortable) — v10.0.0 — HIGH confidence
- [marmelab blog: Kanban with Shadcn + dnd-kit (Jan 2026)](https://marmelab.com/blog/2026/01/15/building-a-kanban-board-with-shadcn.html) — confirms @dnd-kit as current standard — HIGH confidence
- [@tanstack/react-virtual npm](https://www.npmjs.com/package/@tanstack/react-virtual) — v3.13.23, published 7 days before research date — HIGH confidence
- [Express security releases May 2025](https://expressjs.com/2025/05/19/security-releases.html) — multer v1.x CVEs confirmed — HIGH confidence
- `.planning/v1.3-autonomy-visibility-sidebar-revamp.md` — architecture decisions (multer + pdf-parse for uploads, no DB migrations, CustomEvent bridge) — HIGH confidence
- `client/src/components/avatars/BaseAvatar.tsx` — existing AvatarState type, Framer Motion patterns — HIGH confidence

---

*Stack research for: Hatchin v1.3 autonomy visibility UI — activity feeds, file upload, kanban pipeline, real-time event streaming*
*Researched: 2026-03-24*
