# Phase 2: User Journey Fixes - Research

**Researched:** 2026-03-17
**Domain:** React frontend UX — routing, state management, UI interaction bugs
**Confidence:** HIGH (all findings derived from direct source inspection)

---

## Summary

Phase 2 is entirely a frontend bug-fix and routing phase. Nine distinct UX regressions block new users from completing the core flows. Six of the nine issues are confirmed code-level bugs with exact file and line locations. Two (sidebar expand/collapse) are partially implemented and need behavior verification. One (DATA-04 agentRole backfill) requires a combined server-side read-time fix plus the client-side transform already in place.

The root causes fall into three categories: (1) a duplicate modal system that creates a disconnect between `LeftSidebar` and `home.tsx` — both define modal state independently, so the `LeftSidebar` path closes its own modal but `home.tsx` never reacts; (2) the textarea has no `disabled` attribute during streaming, which is correct, but an older "blocking" UX assumption may have driven other parts of the code that need cleanup; (3) the `agentRole` color resolution works for new messages but old DB messages have no backfill on the server read path.

**Primary recommendation:** Fix bugs in the order they block the user journey: create-project first (UX-01), then routing/landing (UX-02, UX-03), then sidebar behavior (UX-04, UX-05), then the polish issues (UX-06, UX-07, UX-08, DATA-04).

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UX-01 | User can create a project via the modal and land in the new project immediately | LeftSidebar modal closes but does not call home.tsx handlers — two separate modal systems |
| UX-02 | First-time user onboarded into first project with compelling welcome | OnboardingManager exists; WelcomeModal exists; verify post-create redirect lands in correct conversation |
| UX-03 | User sees landing page at `/` when not logged in | LandingPage exists and is imported but `/` route is behind AuthGuard — logged-out user hits login redirect not LandingPage |
| UX-04 | User can click a project in sidebar to expand it (others auto-collapse) | `handleSelectProject` has correct auto-collapse logic; `toggleProjectExpanded` also correct; behavior needs end-to-end verification |
| UX-05 | User can click a team in sidebar to expand its agents (others auto-collapse) | `handleSelectTeam` adds/removes single team from Set — does NOT auto-collapse other teams; bug confirmed |
| UX-06 | Textarea is always enabled — user can type while AI streams | Textarea has NO `disabled` attribute — already correct; `isStreaming` only controls send button swap and ring; confirm no race blocking submit |
| UX-07 | Agent chat bubble color is consistent when navigating between projects/teams | Color derives from `message.metadata.agentRole`; navigation does not clear message store; color should persist; verify with localStorage/navigation |
| UX-08 | Typing indicator appears in exactly one place | TWO indicator locations confirmed: in-message-list bubble (lines 2248–2276) gated by `isStreaming && streamingAgent && !hasStreamingPlaceholder`; bottom bar (line 2361) gated by `typingColleagues.length > 0 && !isStreaming` — the gating should prevent simultaneous display but both can appear during `isThinking` state before streaming starts |
| DATA-04 | `agentRole` stored in message metadata at creation and backfilled at read time for old messages | Server stores `agentRole` in metadata on write (routes.ts confirmed); read path (`getMessagesByConversation`) returns raw rows with no backfill; client CenterPanel.tsx line 1143 does a client-side backfill via `agentId` lookup but only if `agentId` is in `activeProjectAgents` — agents from other projects won't match |
</phase_requirements>

---

## Research Findings by Requirement

### UX-01: Create Project Button Does Nothing

**Confidence: HIGH** — code traced end-to-end.

**The bug:** There are TWO separate, independent modal systems for project creation.

**System A — `LeftSidebar` internal modals (lines 89–265 in LeftSidebar.tsx):**
- `handleAddProjectClick` → sets `showQuickStart = true` (LeftSidebar state)
- `handleProjectNameConfirm` → calls `onCreateIdeaProject(name, description)` (the prop)
- The prop IS passed from home.tsx: `onCreateIdeaProject={handleCreateIdeaProject}`
- `handleCreateIdeaProject` in home.tsx (line 320) calls `POST /api/projects` with `projectType: 'idea'`
- On success: sets `isEggHatching = true`, optimistically updates cache — **BUT does not close the LeftSidebar modal**
- The LeftSidebar `handleProjectNameConfirm` does call `setShowProjectName(false)` in its `finally` block (line 258) — so the modal DOES close
- The egg hatching animation fires, then `handleEggHatchingComplete` selects the new project

**Verdict: The LeftSidebar → `onCreateIdeaProject` path appears functionally correct.** The bug reported ("button does nothing") may be environment-specific or there is a race condition in the egg hatching flow.

**System B — `home.tsx` shared modals (lines 38–43, 921–943):**
- `home.tsx` also renders its own `QuickStartModal`, `StarterPacksModal`, `ProjectNameModal`
- These are controlled by separate state variables in `home.tsx`
- The `handleProjectNameSubmit` (line 779) calls `setShowProjectName(false)` immediately on click, then calls `handleCreateProject` or `handleCreateProjectFromTemplate`
- For the idea path: `handleProjectNameSubmit` calls `handleCreateProject` (NOT `handleCreateIdeaProject`) when `selectedTemplate` is null — this creates a regular project, not an idea project. No egg animation fires. No Maya agent is created.

**Root bug for System B path:** When `home.tsx`'s own `ProjectNameModal` is submitted with no template, it calls `handleCreateProject` (plain project, no Maya). This project is created, `activeProjectId` is set, but the user lands in an empty project with no agents.

**Which path fires when user clicks "+ New"?**
The "+ New" button in `LeftSidebar` (line 559) calls `handleAddProjectClick` which sets `showQuickStart` on the **LeftSidebar**'s internal state, not home.tsx's state. So LeftSidebar's System A runs. System B only runs if `CenterPanel`'s `onAddProjectClick` is triggered (from `home.tsx` line 890).

**What actually needs to be verified:** Whether `handleProjectNameConfirm` in LeftSidebar calls `onCreateIdeaProject` correctly and whether the modal closure timing is correct. The egg hatching animation should complete and then auto-select the new project. If the user sees nothing, the likely culprit is that `ideaProjectData` is set but `isEggHatching` never becomes true, or the `handleEggHatchingComplete` refetch fails to find the project by name match.

**Fix strategy:** Consolidate to a single modal system. Remove the duplicate `QuickStartModal`/`StarterPacksModal`/`ProjectNameModal` from `home.tsx` (lines 921–943). All project creation flows through `LeftSidebar`'s handlers which correctly call the right `onCreateIdeaProject` or `onCreateProjectFromTemplate` prop.

---

### UX-02: First-Time User Onboarding

**Confidence: MEDIUM** — `OnboardingManager` component exists and is rendered in home.tsx (line 833). It calls `handleCreateIdeaProject` on the idea path. This should work. Needs manual verification that the egg hatching animation shows and the user lands in chat.

**No code change needed** unless the post-onboarding project selection is broken (same root cause as UX-01 if it is).

---

### UX-03: Landing Page at `/` for Logged-Out Users

**Confidence: HIGH** — code traced.

**Current behavior:**
- `App.tsx` line 62: Route `"/"` wraps `<Home />` in `<AuthGuard>`
- `AuthGuard` (line 15): if `!isSignedIn`, redirects to `/login?next=...`
- `LandingPage` is imported (line 10) and mounted at `/landing` (line 60) only
- Logged-out user visiting `/` hits AuthGuard redirect to `/login` — never sees LandingPage

**Fix:** Change the `"/"` route to render `LandingPage` for unauthenticated users and redirect to `<Home />` for authenticated users. The cleanest approach: make `"/"` conditionally render `LandingPage` or `<Home>`, bypassing the AuthGuard wrapper entirely for that route. Something like:

```tsx
<Route path="/">
  {isSignedIn ? <AuthGuard><Home /></AuthGuard> : <LandingPage />}
</Route>
```

Or: mount `LandingPage` at `"/"` directly and within LandingPage redirect authenticated users to `"/app"` (requires moving app to `/app`). The simpler option is the conditional render above.

**UX-02 connection:** The current `/login` page already has a "Sign in with Google" button. The LandingPage serves a different purpose — communicating the value proposition before login. This is purely a routing gap.

---

### UX-04: Project Expand/Collapse (Auto-Collapse Others)

**Confidence: HIGH** — code correct, needs verification.

`handleSelectProject` in home.tsx (lines 187–213):
```typescript
setExpandedProjects(prev =>
  prev.has(normalizedProjectId) && activeProjectId === normalizedProjectId
    ? new Set<string>()
    : new Set([normalizedProjectId])
);
```
This correctly: expands clicked project (and closes all others by creating a new Set with only one element), and collapses it if the same project is clicked again.

`toggleProjectExpanded` (lines 163–172) also correctly collapses all on expand:
```typescript
setExpandedProjects(prev => {
  if (prev.has(projectId)) return new Set();
  return new Set([projectId]);
});
```

The `ProjectTree` renders the chevron for expand/collapse only when `projectTeams.length > 0` (line 316). If a project has no teams, there is no chevron — this is intentional but could appear broken.

**Potential issue:** Click on project name fires `onSelectProject` (line 305). Click on the chevron div fires `onToggleProjectExpanded` (line 312) but only if `projectTeams.length > 0`. Both paths are wired and correct. The behavior may appear broken in certain edge cases (e.g., newly created idea project where teams haven't loaded yet via React Query refetch).

**Fix needed:** Verify after project creation that teams are invalidated and refetched before the project row renders. `handleCreateIdeaProject` calls `queryClient.invalidateQueries({ queryKey: ["/api/teams"] })` — confirm this triggers before the EggHatching animation hides.

---

### UX-05: Team Expand/Collapse (Auto-Collapse Other Teams)

**Confidence: HIGH** — bug confirmed.

`handleSelectTeam` in home.tsx (lines 215–240):
```typescript
setExpandedTeams(prev => {
  const next = new Set(prev);
  if (next.has(normalizedTeamId) && activeTeamId === normalizedTeamId) {
    next.delete(normalizedTeamId);
  } else {
    next.add(normalizedTeamId);  // Adds to existing Set — does NOT clear other teams
  }
  return next;
});
```

The `else` branch adds to the existing Set, so multiple teams can be expanded simultaneously. This violates the requirement that "click a team → agents appear; click again → agents collapse" (implying accordion behavior where others collapse).

**Fix:** Change the `else` branch to `return new Set([normalizedTeamId])` — same pattern as projects.

---

### UX-06: Textarea Always Enabled During Streaming

**Confidence: HIGH** — code confirmed.

The textarea at CenterPanel.tsx line 2398 has NO `disabled` attribute. It is always enabled. The `isStreaming` state only:
1. Applies `ai-thinking-ring` CSS class to the form wrapper (line 2397)
2. Swaps the send button for a stop button (line 2420)

The `canSend` logic (line 1877) does not gate on `isStreaming` — it gates only on non-empty input and valid `conversationId`.

**UX-06 is already implemented correctly.** No code change needed. Verify this in manual testing.

---

### UX-07: Agent Bubble Color Consistent on Navigation

**Confidence: HIGH** — color derivation traced.

Color chain:
1. `MessageBubble` reads `message.metadata.agentRole` (line 86)
2. Passes to `getAgentColors(agentRole)` from `agentColors.ts`
3. `getAgentColors` calls `getRoleDefinition(role)` from `roleRegistry.ts`
4. Returns role-specific `bgCss`/`borderCss` or `DEFAULT_COLORS` (green) if role is null/unknown

**When does color reset to green (default)?**
When `message.metadata.agentRole` is `null` or `undefined`. This happens for:
- Messages loaded from DB that did not have `agentRole` stored in metadata at write time (pre-Phase 1 messages)
- The client-side backfill in CenterPanel line 1143–1161 tries to recover `agentRole` from `agentId` → `activeProjectAgents.find(a => a.id === msg.agentId)?.role`

**Navigation bug:** `activeProjectAgents` is derived from `agents.filter(a => a.projectId === activeProjectId)`. When the user navigates to a different project, `activeProjectAgents` changes. When they navigate back, the messages are in `allMessages[conversationId]` but the backfill hook `useEffect` (line 1138) only re-runs when `apiMessages` changes (when the query refetches for that conversationId). If the messages are already in local state from before navigation, and the `apiMessages` haven't refetched, the old `activeProjectAgents` reference may not match.

**The real fix for UX-07 (and DATA-04):** Ensure `agentRole` is reliably in `message.metadata` at the server level on read, so the client never needs to backfill at all.

---

### UX-08: Duplicate Typing Indicator

**Confidence: HIGH** — two distinct indicator locations confirmed.

**Location 1 — In-message-list bubble** (CenterPanel.tsx lines 2248–2276):
- Condition: `isStreaming && streamingAgent && !hasStreamingPlaceholder && !streamingMessageId.current && !isThinking`
- Shows a bouncing-dot bubble attributed to `streamingAgent` name inside the message scroll area
- This appears briefly between when streaming starts and when the first `streaming_chunk` arrives and a placeholder message is created

**Location 2 — Bottom typing bar** (CenterPanel.tsx lines 2361–2372):
- Condition: `typingColleagues.length > 0 && !isStreaming`
- Shows a text bar "AgentName is typing..." below the message list above the input
- Driven by WebSocket `typing_started` / `typing_stopped` events (lines 919–928)
- Gated behind `!isStreaming` so it hides once streaming begins

**When both show simultaneously:**
The server emits a `typing_started` WS event before sending the first streaming chunk. The client sets `typingColleagues` (triggers Location 2). Then the `streaming_started` WS event arrives, sets `isStreaming = true` (hides Location 2), and shows Location 1. In theory they should not overlap. In practice, if there is a timing gap where both `typingColleagues` has an entry AND `isStreaming` is true before the first chunk arrives, both could render briefly.

The `isThinking` state adds a third concern: `isThinking` is set to `true` when the user hits send (line 1887), before any WS response. During this window, neither indicator shows — the form just shows `ai-thinking-ring` CSS. Then when `streaming_started` arrives, `setIsStreaming(true)` fires, which triggers Location 1's condition check again.

**Fix needed:** Clear `typingColleagues` when `isStreaming` becomes true, or ensure Location 1 only shows when `!typingColleagues.length` (i.e., when there's no WebSocket-driven typing indicator already present).

---

### DATA-04: agentRole Backfill for Old Messages

**Confidence: HIGH** — server read path confirmed.

**Server side:** `getMessagesByConversation` in `storage.ts` (line 1522) returns raw DB rows with no post-processing. The `agentRole` field must be present in `messages.metadata` as stored at write time.

**Write time:** Phase 1 implemented `agentRole: respondingAgent?.role ?? null` in message metadata (confirmed at routes.ts lines 3240–3241, 3423, 3671, 2020, 2626). New messages written after Phase 1 will have `agentRole` in metadata.

**Old messages:** Messages written before Phase 1 have no `agentRole` in metadata. The client-side backfill (CenterPanel.tsx line 1143–1161) covers this by looking up the agent by `agentId`:
```typescript
const agentRoleFromId = msg.agentId
  ? activeProjectAgents.find((a: any) => a.id === msg.agentId)?.role
  : undefined;
```
This works IF: (a) the message has an `agentId`, and (b) that agent is in `activeProjectAgents`.

**The gap:** For old messages where `agentId` is present and the agent still exists, the client backfill works. For messages where the agent was deleted, or where the message predates the `agentId` field being populated, the color will fall back to green (default).

**Recommended fix (DATA-04):** Add server-side backfill in the route handler. After calling `getMessagesByConversation`, for each message where `metadata.agentRole` is null and `agentId` is not null, look up the agent's role from the agents table and inject it. This is a read-time enrichment — no schema change needed.

---

## Architecture Patterns

### Modal State: Dual-System Problem

`home.tsx` and `LeftSidebar.tsx` each maintain their own `showQuickStart`, `showStarterPacks`, `showProjectName`, `selectedTemplate`, `isCreatingProject` state variables. This duplication exists because `CenterPanel` also needs to trigger project creation (`onAddProjectClick` prop). The intended pattern appears to be: `home.tsx` owns the canonical state, but `LeftSidebar` ended up with its own copy.

**Pattern to follow:** Lift all modal state to `home.tsx`. Pass down only callback props. Remove the duplicate modal renders from `home.tsx` lines 921–943 if LeftSidebar handles them, OR remove them from LeftSidebar and pass the `home.tsx` modal open functions as props.

### Color Resolution: Role Registry Pattern

`agentColors.ts` is the single source of truth for all color-to-role mapping. It reads from `shared/roleRegistry.ts`. No hardcoded color strings should exist in components — always use `getAgentColors(role)`.

The `DEFAULT_COLORS` fallback is green (`bg-emerald-600`). Any missing `agentRole` in message metadata renders green. This is the visual symptom of DATA-04.

### Expand/Collapse State: Set-Based Accordion

Both projects and teams use `Set<string>` for expansion tracking. The accordion pattern (only one expanded at a time) requires: on expand, return `new Set([id])`. On toggle-collapse of already-expanded item, return `new Set()`. This pattern is correct for projects but broken for teams (teams uses `Set.add` instead).

### Routing: Wouter with AuthGuard

`App.tsx` uses Wouter's `<Switch>` + `<Route>`. The `AuthGuard` component wraps authenticated routes. For the landing page requirement, the `"/"` route needs to bypass AuthGuard and decide which component to render based on auth state.

The `useAuth` hook exposes `{ isSignedIn, isLoading, user, signOut }`. Both `isSignedIn` and `isLoading` are available at the Router level.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auth state in router | Custom auth context | `useAuth` hook (already exists) | Already wired to session API |
| Color lookup | Switch/if chain per role | `getAgentColors(role)` from `agentColors.ts` | Single source of truth, registry-backed |
| Modal deduplication | New modal component | Consolidate existing `ProjectNameModal` | Already handles all states, loading, validation |
| Agent backfill query | Separate API call | Enrich in existing `getMessagesByConversation` route handler | No extra round-trip |

---

## Common Pitfalls

### Pitfall 1: Calling the Wrong Create Project Handler
**What goes wrong:** Calling `handleCreateProject` (plain project, no Maya) instead of `handleCreateIdeaProject` (Maya + brain + egg animation) for the "Start with an idea" flow.
**Why it happens:** Both functions exist in home.tsx; the `home.tsx`-owned `ProjectNameModal` calls `handleCreateProject` when `selectedTemplate` is null.
**How to avoid:** Always route the "idea" flow through `handleCreateIdeaProject`. Remove the ambiguity by having a single entry point with an explicit `type: 'idea' | 'template' | 'plain'` parameter.

### Pitfall 2: Invalidating Queries Before Data Exists
**What goes wrong:** `queryClient.invalidateQueries` fires immediately after `POST /api/projects` returns, before the server has finished creating teams/agents via `initializeIdeaProject`.
**Why it happens:** `initializeIdeaProject` is called server-side synchronously within the route handler, so by the time the response is returned, teams and agents should exist. But if there's async processing, the cache invalidation may race with agent creation.
**How to avoid:** The egg hatching animation adds a 500ms delay before `handleEggHatchingComplete` fetches data (line 374). This is the existing mitigation. Do not remove it.

### Pitfall 3: `activeProjectAgents` Stale in useEffect
**What goes wrong:** The message transform `useEffect` in CenterPanel captures `activeProjectAgents` at render time. If `activeProjectAgents` changes (project switch) but `apiMessages` doesn't change, the effect doesn't re-run and the stale agent list is used for backfill.
**How to avoid:** Add `activeProjectAgents` to the useEffect dependency array (line 1188). This will cause the transform to re-run whenever the agent list changes.

### Pitfall 4: `LandingPage` at `/` Breaking Authenticated Flow
**What goes wrong:** If LandingPage is placed at `"/"` without an auth check, authenticated users are shown the landing page instead of the app.
**How to avoid:** The `"/"` route must check `isSignedIn` and redirect to `<Home>` (or `/app`) if the user is logged in. Use `useEffect` + `setLocation` or conditional render — not a hard redirect that breaks the back button.

---

## Code Examples

### Correct Accordion Team Expand Pattern

Current (broken) — adds to Set:
```typescript
// home.tsx handleSelectTeam
const next = new Set(prev);
if (next.has(normalizedTeamId) && activeTeamId === normalizedTeamId) {
  next.delete(normalizedTeamId);
} else {
  next.add(normalizedTeamId);  // BUG: does not collapse others
}
```

Fixed — mirrors project pattern:
```typescript
setExpandedTeams(prev => {
  if (prev.has(normalizedTeamId) && activeTeamId === normalizedTeamId) {
    return new Set<string>();
  }
  return new Set([normalizedTeamId]);
});
```

### Correct `/` Route for Unauthenticated Landing

```tsx
// App.tsx — replace the current "/" Route
function Router() {
  const { isSignedIn, isLoading } = useAuth();
  return (
    <Switch>
      <Route path="/landing" component={LandingPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/">
        {isLoading ? (
          <LoadingScreen />
        ) : isSignedIn ? (
          <Home />
        ) : (
          <LandingPage />
        )}
      </Route>
      {/* ... other routes ... */}
    </Switch>
  );
}
```
Note: `useAuth` must be called inside `Router` (or a wrapper that is inside `QueryClientProvider`).

### Server-Side agentRole Backfill at Read Time

```typescript
// routes.ts — after getMessagesByConversation
const messages = await storage.getMessagesByConversation(req.params.conversationId, options);

// Backfill agentRole for messages that lack it
const enriched = await Promise.all(
  messages.map(async (msg) => {
    if (msg.messageType === 'agent' && msg.agentId && !msg.metadata?.agentRole) {
      const agent = await storage.getAgent(msg.agentId);
      return {
        ...msg,
        metadata: { ...(msg.metadata || {}), agentRole: agent?.role ?? null }
      };
    }
    return msg;
  })
);

res.json(enriched);
```
For performance: if the conversation has many messages, batch the agent lookups (group by `agentId`, fetch each unique agent once).

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| LandingPage at `/landing` only | LandingPage needs to be at `/` for logged-out | This session | Requires route restructure |
| Teams expand additively (Set.add) | Should be accordion (Set.replace) | Fix in Phase 2 | Teams UX parity with projects |
| agentRole backfill client-side only | Should also be server-side | Fix in Phase 2 (DATA-04) | Reliable colors for old messages |

---

## Open Questions

1. **Is the "+ New" button in LeftSidebar creating projects successfully in the current state?**
   - What we know: LeftSidebar calls `onCreateIdeaProject` prop which calls `handleCreateIdeaProject` in home.tsx — this path looks functionally correct
   - What's unclear: Whether the EggHatchingAnimation component's `onComplete` fires reliably, or if there is a timeout/async issue
   - Recommendation: Manual test the full flow before assuming code changes are needed for UX-01 on the LeftSidebar path. The `home.tsx`-owned `ProjectNameModal` path is the confirmed bug (calls `handleCreateProject` instead of `handleCreateIdeaProject`).

2. **Should authenticated users at `/` redirect to `/app` (with app moved) or just render `<Home>` directly?**
   - What we know: All routes currently use `/`, `/login`, `/landing`, `/maya/:id`
   - What's unclear: Whether to introduce a dedicated `/app` path or keep `/` as the app for logged-in users
   - Recommendation: Keep `/` as the app for logged-in users (avoid URL churn). Use conditional render on the `"/"` route.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | TypeScript scripts (scripts/test-*.ts) + manual |
| Config file | package.json scripts |
| Quick run command | `npm run typecheck` |
| Full suite command | `npm run test:integrity && npm run test:dto` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UX-01 | Create Project button → project created, chat ready | manual | N/A — UI flow | ❌ manual only |
| UX-02 | Onboarding → first project welcome | manual | N/A — UI flow | ❌ manual only |
| UX-03 | `/` unauthenticated → LandingPage | manual | N/A — UI routing | ❌ manual only |
| UX-04 | Project click → expand, others collapse | manual | N/A — UI state | ❌ manual only |
| UX-05 | Team click → expand, others collapse | manual | N/A — UI state | ❌ manual only |
| UX-06 | Textarea enabled during streaming | manual | N/A — UI state | ❌ manual only |
| UX-07 | Agent color consistent on navigation | manual | N/A — UI render | ❌ manual only |
| UX-08 | One typing indicator location only | manual | N/A — UI render | ❌ manual only |
| DATA-04 | agentRole backfill for old messages | integration | manual API inspection | ❌ manual only |
| All | TypeScript compiles clean | automated | `npm run typecheck` | ✅ existing |

### Sampling Rate
- **Per task commit:** `npm run typecheck`
- **Per wave merge:** `npm run typecheck && npm run test:integrity && npm run test:dto`
- **Phase gate:** All success criteria manually verified before `/gsd:verify-work`

### Wave 0 Gaps
None — existing test infrastructure covers the automated gates. All UX requirements require manual browser testing.

---

## Sources

### Primary (HIGH confidence)
- Direct source inspection of `client/src/App.tsx` — routing structure
- Direct source inspection of `client/src/pages/home.tsx` — all creation handlers, modal state, selection handlers
- Direct source inspection of `client/src/components/LeftSidebar.tsx` — modal flow, prop calls
- Direct source inspection of `client/src/components/CenterPanel.tsx` — textarea, typing indicators, agentRole transform, streaming state
- Direct source inspection of `client/src/components/ProjectTree.tsx` — expand/collapse rendering
- Direct source inspection of `client/src/components/ProjectNameModal.tsx` — modal form behavior
- Direct source inspection of `client/src/lib/agentColors.ts` — color resolution chain
- Direct source inspection of `server/storage.ts` line 1522 — read path, no agentRole backfill
- Direct source inspection of `server/routes.ts` — agentRole stored at write time

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — confirmed Phase 2 is "not started", Phase 1 complete
- `.planning/REQUIREMENTS.md` — canonical requirement descriptions

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — existing React/Wouter/TanStack Query stack, no new libraries needed
- Bug root causes: HIGH — all traced to specific files and lines
- Fix strategies: HIGH for UX-03/UX-05/DATA-04 (straightforward code changes); MEDIUM for UX-01 (need manual verification of which path is broken)
- Architecture: HIGH — patterns traced from existing working code

**Research date:** 2026-03-17
**Valid until:** Stable — these are static source findings, not ecosystem research. Valid until the files change.
