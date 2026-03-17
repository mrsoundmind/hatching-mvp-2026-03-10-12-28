---
phase: 02-user-journey-fixes
plan: "01"
subsystem: routing-and-project-creation
tags: [routing, auth, project-creation, ux, bug-fix]
dependency_graph:
  requires: []
  provides: [conditional-root-route, idea-project-creation-fix]
  affects: [client/src/App.tsx, client/src/pages/home.tsx]
tech_stack:
  added: []
  patterns: [conditional-render-on-auth-state, wouter-route-guard]
key_files:
  created: []
  modified:
    - client/src/App.tsx
    - client/src/pages/home.tsx
decisions:
  - "Use conditional render in Router() rather than useEffect redirect for / route — preserves back-button behavior and avoids flash of wrong content"
  - "Keep AuthGuard for /maya and /dev/autonomy — only the / route needed the fix since those routes are strictly protected"
metrics:
  duration: "~10 minutes"
  completed: "2026-03-17"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 2
---

# Phase 2 Plan 01: Routing and Project Creation Fix Summary

**One-liner:** Fixed two blocking user journey bugs: logged-out users now see LandingPage at `/` instead of being redirected to login, and the project name modal now correctly creates idea projects with Maya agent instead of empty plain projects.

---

## What Was Done

### Task 1 — Fix `/` route: show LandingPage for logged-out users (commit: 364aa40)

**Problem:** The `"/"` route in `App.tsx` wrapped `<Home />` inside `<AuthGuard>`, which used `useEffect` to redirect unauthenticated users to `/login`. Logged-out users never saw `LandingPage` when visiting `/`.

**Fix:** Added `useAuth()` call inside `Router()` and replaced the `AuthGuard`-wrapped `<Home />` with a three-way conditional render:
- `isLoading` → egg spinner (same markup as `AuthGuard`'s loading state)
- `isSignedIn` → `<Home />`
- logged-out → `<LandingPage />`

`AuthGuard` is retained for `/maya/:projectId` and `/dev/autonomy` which still require authentication.

**Files modified:** `client/src/App.tsx`

---

### Task 2 — Fix home.tsx modal: idea path creates idea project (commit: 4fa560a)

**Problem:** `handleProjectNameSubmit` in `home.tsx` called `handleCreateProject(name, description)` in its `else` branch (when `selectedTemplate` is null). `handleCreateProject` creates a plain project with no `projectType`, which bypasses Maya agent creation, brain initialization, and egg hatching animation.

**Fix:** Changed the `else` branch to call `handleCreateIdeaProject(name, description)` instead. This ensures the "Start with an idea" flow triggers:
- `projectType: 'idea'` in the POST body
- Maya agent creation via `initializeIdeaProject` on the server
- Egg hatching animation via `setIsEggHatching(true)`
- Correct post-creation auto-selection via `handleEggHatchingComplete`

`handleCreateProject` (plain) remains unchanged — it is still used by the undo-restore flow.

**Files modified:** `client/src/pages/home.tsx`

---

## Verification

- `npm run typecheck` exits 0 with zero errors
- `grep -n "isSignedIn" client/src/App.tsx` shows `isSignedIn` used inside `Router()` (lines 58, 83)
- `grep -n "LandingPage" client/src/App.tsx` shows `LandingPage` in the `"/"` route (line 86)
- `grep -n "AuthGuard" client/src/App.tsx` shows `AuthGuard` wrapping `/maya` and `/dev/autonomy` only (lines 91, 97)
- `grep -n "handleCreateIdeaProject" client/src/pages/home.tsx` shows it called in `handleProjectNameSubmit`'s else branch (line 781)
- `grep -n "handleCreateProject(name" client/src/pages/home.tsx` returns no matches

---

## Manual Smoke Tests (to verify at runtime)

1. Visit `/` when logged out → LandingPage renders (not `/login` redirect)
2. Visit `/` when logged in → Home app renders directly
3. Click CenterPanel "+ New" → QuickStart modal → "Start with an idea" → enter name → submit → egg hatching animation fires → new project with Maya agent appears selected in sidebar

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Self-Check: PASSED

- `client/src/App.tsx` modified and committed as 364aa40
- `client/src/pages/home.tsx` modified and committed as 4fa560a
- Both commits exist in git log
- `npm run typecheck` exits 0
