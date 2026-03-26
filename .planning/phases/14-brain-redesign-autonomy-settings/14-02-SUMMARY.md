---
phase: 14-brain-redesign-autonomy-settings
plan: "02"
subsystem: client
tags: [brain-docs, file-upload, autonomy-settings, work-outputs, sidebar, react]
dependency_graph:
  requires:
    - POST /api/projects/:id/brain/upload (from 14-01)
    - DELETE /api/projects/:id/brain/documents/:docId (from 14-01)
    - executionRules.autonomyLevel + inactivityTriggerMinutes schema (from 14-01)
  provides:
    - client/src/components/sidebar/DocumentUploadZone.tsx
    - client/src/components/sidebar/DocumentCard.tsx
    - client/src/components/sidebar/AutonomySettingsPanel.tsx
    - client/src/components/sidebar/WorkOutputSection.tsx
    - client/src/components/sidebar/BrainDocsTab.tsx
    - BrainDocsTab wired into RightSidebar brain tab panel
  affects:
    - client/src/components/RightSidebar.tsx (brain tab panel replaced, 928->403 lines)
tech_stack:
  added: []
  patterns:
    - Framer Motion AnimatePresence for document card mount/exit
    - Debounced PATCH (800ms) via useRef<setTimeout> for autonomy settings
    - Optimistic document deletion with rollback on error
    - CSS radiogroup pattern for autonomy dial (4 segments)
    - Collapsible accordion (shadcn) for work output cards
    - CSS-hide tab panel pattern (display:flex/none) preserved
key_files:
  created:
    - client/src/components/sidebar/DocumentUploadZone.tsx
    - client/src/components/sidebar/DocumentCard.tsx
    - client/src/components/sidebar/AutonomySettingsPanel.tsx
    - client/src/components/sidebar/WorkOutputSection.tsx
    - client/src/components/sidebar/BrainDocsTab.tsx
  modified:
    - client/src/components/RightSidebar.tsx (brain tab panel replaced with BrainDocsTab)
decisions:
  - Old brain tab content (agent profile, core direction textareas, team dashboard, project overview) removed from brain tab panel — all views now show BrainDocsTab regardless of selected agent/team/project
  - Optimistic removal for document delete — card disappears immediately, re-appears on server error
  - WorkOutputSection renders nothing when no completed tasks (no empty state per UI-SPEC)
  - AutonomySettingsPanel uses border flash-save animation class for auto-save feedback
  - BrainDocsTab triggers DocumentUploadZone click via DOM querySelector as workaround (upload zone handles click internally via role="button")
metrics:
  duration: 359s
  completed: "2026-03-26T09:03:37Z"
  tasks: 2
  files: 6
---

# Phase 14 Plan 02: Brain & Docs Tab Frontend Summary

Five new sidebar components + RightSidebar wiring: DocumentUploadZone (drag-and-drop + browse with client-side validation), DocumentCard (type badges + animated delete), AutonomySettingsPanel (Switch + 4-position dial + inactivity trigger), WorkOutputSection (completed tasks in Collapsible accordion), and BrainDocsTab composing all four — replacing the entire old brain tab panel in RightSidebar.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create DocumentUploadZone, DocumentCard, AutonomySettingsPanel, WorkOutputSection | 33d5473 | 4 new sidebar components |
| 2 | Create BrainDocsTab container and wire into RightSidebar | ff0c74f | BrainDocsTab.tsx, RightSidebar.tsx |

## What Was Built

**`DocumentUploadZone.tsx`** — Drag-and-drop upload zone with:
- `role="button"` + `aria-label` + keyboard Enter/Space support
- Hidden `<input type="file" accept=".pdf,.docx,.txt,.md">`
- Client-side validation: extension allowlist + 10MB max before any network call
- States: idle (dashed border), dragging (blue border + bg tint), uploading (Loader2 spinner + filename), error (red border + message)
- POSTs to `brain/upload` via FormData field `"document"`
- Error messages per UI-SPEC copywriting contract

**`DocumentCard.tsx`** — Animated document list item with:
- `motion.div` with `layout`, `initial/animate/exit` matching ApprovalItem pattern
- Type badges: PDF=blue, DOCX=orange, MD=green, TXT=muted
- Single-click Trash2 delete (no confirmation), `aria-label="Delete {filename}"`
- Date formatted as "Mar 26"

**`AutonomySettingsPanel.tsx`** — Autonomy configuration with:
- shadcn Switch for "Autonomous execution" toggle
- Framer Motion height-animated inactivity trigger row (only when enabled)
- shadcn Select with 4 time options (30min to 4hr)
- 4-position autonomy dial: `role="radiogroup"`, 4 `role="radio"` buttons with `aria-checked`
- "Autonomous" position uses green highlight, others use blue
- 800ms debounced PATCH to `/api/projects/:id` with `{ executionRules: {...} }`
- `flash-save` CSS class added on successful PATCH
- `clearTimeout` cleanup on unmount

**`WorkOutputSection.tsx`** — Completed task output viewer with:
- Same `queryKey: ['/api/tasks', '?projectId=${projectId}']` as ApprovalsTab for TanStack deduplication
- Filters `status === 'completed'` tasks
- shadcn Collapsible accordion with accordion behavior (one open at a time)
- Expanded state shows `<pre className="text-xs font-mono whitespace-pre-wrap max-h-[200px]">` output block
- Renders nothing when no completed tasks

**`BrainDocsTab.tsx`** — Container composing all four:
- DocumentUploadZone at top (with `onUploadComplete` → invalidate + toast)
- EmptyState (BookOpen icon, "Your team's knowledge base" heading) when no documents; AnimatePresence document list when documents exist
- Optimistic document deletion with rollback + error toast
- Spacers + AutonomySettingsPanel + WorkOutputSection below

**`RightSidebar.tsx` update** — Brain tab panel replaced:
- Added `import { BrainDocsTab }`
- Replaced lines 398-928 (agent profile, team dashboard, project overview content) with single `<BrainDocsTab projectId={activeProject?.id} project={activeProject} />`
- Brain tab CSS-hide wrapper (`display: activeTab === 'brain' ? 'flex' : 'none'`) preserved
- Line count reduced from 928 to 403

## Checkpoint Status

Task 3 is a `checkpoint:human-verify` — pending user visual verification of the complete Brain & Docs tab.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- client/src/components/sidebar/DocumentUploadZone.tsx: FOUND
- client/src/components/sidebar/DocumentCard.tsx: FOUND
- client/src/components/sidebar/AutonomySettingsPanel.tsx: FOUND
- client/src/components/sidebar/WorkOutputSection.tsx: FOUND
- client/src/components/sidebar/BrainDocsTab.tsx: FOUND
- client/src/components/RightSidebar.tsx: MODIFIED (403 lines, brain tab replaced)
- commit 33d5473: FOUND
- commit ff0c74f: FOUND
- npm run typecheck: PASSES (pre-existing sparkles.tsx error unrelated to this plan)
- npm run build: PASSES
