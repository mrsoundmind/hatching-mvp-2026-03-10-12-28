# Phase 02 — UI Review

**Audited:** 2026-03-18
**Baseline:** Abstract 6-pillar standards (no UI-SPEC.md for this phase)
**Screenshots:** Captured (desktop 1440x900, tablet 768x1024, mobile 375x812)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | CTAs are specific and action-oriented; one residual generic "Cancel" in ProjectNameModal and a hardcoded fallback name "My Idea" remain |
| 2. Visuals | 3/4 | LandingPage has strong desktop hierarchy; mobile/tablet screenshots show the chat panel fully covering the viewport — side panels hidden on lg breakpoint are not replaced with any alternative layout |
| 3. Color | 3/4 | No accent overuse; hardcoded hex values in LandingPage are intentional per-panel theming, not component-level violations; 8 simultaneous accent colors on the panel grid is the one concern |
| 4. Typography | 3/4 | Tailwind scale used consistently; LandingPage mixes `text-[7px]` / `text-[8px]` / `text-[9px]` sub-scale pixel values that fall outside the Tailwind type scale |
| 5. Spacing | 2/4 | ProjectTree.tsx uses `mt-[-6px]`, `mb-[-6px]`, `pt-[7px]`, `pb-[7px]`, `ml-[4px]`, `mr-[4px]`, `mt-[-3px]`, `mb-[-3px]` — eight arbitrary spacing overrides in a single row element; LandingPage uses `text-[11px]` inline sizes throughout |
| 6. Experience Design | 3/4 | Streaming, loading, error, and empty states all covered; typing indicator mutual exclusion implemented correctly; minor gap: "Load earlier messages" button text has no loading alternative to "Loading..." |

**Overall: 17/24**

---

## Top 3 Priority Fixes

1. **ProjectTree arbitrary spacing hacks** — Users navigating the sidebar on small screens or with non-default font sizes will see misaligned rows, as the pixel-level nudges (`mt-[-3px]`, `pt-[7px]`, `ml-[4px]`) are not responsive and break the spacing scale contract — replace the eight arbitrary values on lines 298 and 302 of `ProjectTree.tsx` with standard Tailwind tokens (`space-y-0.5`, `py-1.5`, `px-2`) and remove the negative margin workarounds

2. **Mobile LandingPage shows only the chat panel — no value proposition content** — On 375px viewport (and 768px tablet), the 8-panel USP grid and the right USP column are both hidden (`hidden lg:grid`), leaving only the chat widget visible with an empty dark body; a first-time mobile visitor sees almost no copy explaining why they should sign up — add a mobile-first content fallback (a condensed USP list or a short tagline block) visible below the chat panel for screens smaller than `lg`

3. **Sub-Tailwind font sizes in LandingPage and ProjectTree** — `text-[7px]`, `text-[8px]`, `text-[9px]`, `text-[11px]`, `text-[12px]`, `text-[13px]` appear across both files; sizes below `text-xs` (12px) are below WCAG minimum for body text and are invisible at typical viewing distances — consolidate the tiny preview widget labels to `text-xs` minimum and the body copy sizes to `text-xs` / `text-sm` from the Tailwind scale

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

Phase 2 substantially improved copy quality across the modified components. The key findings:

**Passing:**
- `LandingPage.tsx`: All USP titles are specific value statements ("Stop Recruiting.", "Unfair Market Velocity.") with no generic filler — strong marketing copy
- `LandingPage.tsx` subtitle (line 584): "PM · Designer · Engineer · Analyst — assembled in seconds, executing your vision 24/7" is concrete and role-specific
- `CenterPanel.tsx` error copy (line 842–847): contextual error messages ("I'm finishing the previous response. Please wait a moment and try again.") rather than generic "Something went wrong"
- `LeftSidebar.tsx` empty state (line 616): "Nothing here yet. Press + New and tell Maya what you want to build." — specific and instructional
- Typing indicator (CenterPanel.tsx line 2473): "{AgentName} is typing..." — correctly names the agent rather than generic "AI is typing"

**Issues:**
- `ProjectNameModal.tsx` line 119: `"Cancel"` is a generic label with no context. The button dismisses a project creation modal — consider "Nevermind" or "Go back" to match the conversational tone of the rest of the product
- `home.tsx` line 831: Hardcoded fallback `'My Idea'` and description `'Developing and structuring my raw idea with Maya\'s help'` — the SUMMARY for plan 02-05 stated this was removed, but it remains as the `onComplete('idea')` fallback path. If this executes (e.g., when `onStartWithIdeaPromptName` is not set), users get a project named "My Idea" without being prompted — this is a deceptive auto-name, not a copy quality issue per se, but it produces a confusing label users never chose
- `CenterPanel.tsx` line 2301: `'Loading...'` in the "load earlier messages" button — while functional, it provides no progress context; "Fetching earlier messages..." would be clearer

### Pillar 2: Visuals (3/4)

**Desktop (1440px) — passing:**
- Clear three-column layout: 8 USP panels left, central chat column, 8 USP panels right
- The hero headline "Your AI team is alive and waiting." is the unambiguous visual focal point with gradient text on "alive"
- The animated chat widget in the center creates a natural focal draw
- Background grid pattern adds depth without competing with content
- Per-panel color glow activates on USP hover/selection — provides strong wayfinding

**Tablet (768px) — needs work:**
- At 768px, all USP panels are hidden (both left and right columns use `hidden lg:grid`). The viewport shows only the chat panel centered with large dark margins above and below. The hero heading and subtitle remain, but there is no secondary content below them and no call-to-action visible in the above-the-fold viewport
- The chat panel appears floating in a very large dark area with the "SYSTEM PROCESSING DATA" status bar at the bottom — the layout looks incomplete rather than intentional

**Mobile (375px) — needs work:**
- Same issue as tablet — the USP grid is hidden and nothing replaces it. The hero ("Your AI team is alive and waiting.") appears at the top and then there is only the chat widget. The "SKIP →" button is present in the chat header but its purpose is unclear to a new visitor with no surrounding context panels visible

**Icon/accessibility:**
- The chevron expand/collapse icons in `ProjectTree.tsx` have `title="Delete team"` and `title="Delete agent"` on hover actions (lines 496, 605, 715) — these are `title` attributes, not `aria-label`, which may not reliably surface to screen readers; however this is pre-existing, not a Phase 2 regression
- The Framer Motion accordion in `ProjectTree.tsx` (plan 02-07) uses `overflow-hidden` correctly — no content bleed during transitions

### Pillar 3: Color (3/4)

**Passing:**
- Primary token usage: `text-primary`, `bg-primary`, `border-primary` appear 10 times total — not overused
- The `agentRole`-based color system (`getAgentColors(role)` from `agentColors.ts`) is the correct single source of truth — no hardcoded color strings in component files for agent colors
- Default green (`bg-emerald-600`) fallback for unknown `agentRole` is now guarded by the Phase 2 fixes (agent list guard in useEffect, metadata injection at streaming start)

**Issues:**
- `LandingPage.tsx` lines 383, 521–529: hardcoded hex values (`#6366f1`, `#10b981`, etc.) and per-panel bg values (`bg-[#131724]`, `bg-[#111A18]`, `bg-[#1A121F]`, `bg-[#111827]`, `bg-[#1C1917]`, `bg-[#1C140F]`, `bg-[#0F1C14]`, `bg-[#1C1215]`) — these are intentional per-panel dark tint backgrounds and are not component-level design token violations, but they do create 8 unique background colors that are only defined inline and cannot be updated centrally
- The LandingPage activates 8 different accent colors (fuchsia, emerald, indigo, blue, amber, orange, green, rose) across the USP panels. At any moment, up to 2 active panels can glow simultaneously. This is intentional for the interactive demo but means the 60/30/10 color split principle is not strictly observed — however, since all panels are decorative and only one is in focus at a time (the active panel), this is contextually acceptable
- `LandingPage.tsx` line 551: `bg-[#040609]` and line 647: `bg-[#080A0F]/95` are hardcoded root background colors. These should ideally be CSS custom properties so the dark theme base can be adjusted without a grep

### Pillar 4: Typography (3/4)

**Passing:**
- Tailwind scale in active components (CenterPanel, ProjectTree, OnboardingManager): `text-xs`, `text-sm`, `text-base`, `text-lg` — 4 distinct sizes, within the acceptable range
- Font weight distribution: `font-medium` dominates (appropriate for UI labels), `font-semibold` for headings, `font-bold` for display text — a sensible three-weight system
- LandingPage hero uses responsive sizes: `text-2xl md:text-3xl lg:text-4xl` — good responsive scaling

**Issues:**
- `LandingPage.tsx` uses pixel-specific sub-scale sizes extensively in preview widgets: `text-[7px]` (line 58), `text-[8px]` (line 127), `text-[9px]` (lines 31, 57), `text-[10px]` (line 148). These are below Tailwind's `text-xs` (12px) minimum. For decorative mock-UI previews this is intentional (the previews simulate condensed real UIs), but anything at 7–9px is effectively invisible for users with standard viewing distance
- `ProjectTree.tsx` lines 282, 334, 339: `text-[11px]`, `text-[13px]` — both off the Tailwind scale. `text-[11px]` is below `text-xs` (12px). Should use `text-xs` (12px) and `text-sm` (14px) respectively
- `CenterPanel.tsx` lines 2198, 2204, 2251, 2252: `text-[12px]`, `text-[16px]`, `text-[14px]` — off-scale. These should map to `text-xs`, `text-base`, `text-sm`
- `font-extrabold` appears once in `LandingPage.tsx` line 178 — this weight is used in exactly one place in the whole codebase; it should be `font-bold` for consistency unless that weight is specifically needed for the "$35 / MO" price emphasis

### Pillar 5: Spacing (2/4)

**Passing:**
- `OnboardingManager.tsx` and the new streaming/typing indicator changes in `CenterPanel.tsx` use standard Tailwind tokens exclusively
- Gap and padding in the LandingPage layout (`gap-3`, `px-4`, `py-5`, `pb-6`) follow the Tailwind scale

**Issues (primary concern):**
- `ProjectTree.tsx` line 298: `mt-[-6px] mb-[-6px]` — negative margin workaround applied to a container div to compensate for spacing added elsewhere
- `ProjectTree.tsx` line 302: `pt-[7px] pb-[7px] ml-[4px] mr-[4px] mt-[-3px] mb-[-3px]` — six arbitrary spacing values on a single `div` that represents one project row. This signals the row's padding was never systematized; it was tuned pixel-by-pixel to visually align with surrounding elements. These values are:
  - Not on the 4px Tailwind spacing scale (`[4px]` is `p-1`, `[8px]` is `p-2`)
  - Mixed with negative margins to fight a layout that likely has conflicting parent padding
  - Will break if the sidebar font size or zoom changes
  - Fix: replace with `py-1.5 px-2` and remove the negative margin overrides; adjust the parent container spacing instead
- `LandingPage.tsx` inline style on line 554: `backgroundSize: "30px 30px"` — pixel-value inline style for the grid background. Acceptable for a one-off decorative pattern, but noting it as non-Tailwind
- `CenterPanel.tsx` line 2256: `pt-[11px] pb-[11px]` — off-scale padding on the action button row. Should be `py-3` (12px) or `py-2.5` (10px) from the standard scale

### Pillar 6: Experience Design (3/4)

**Passing — Phase 2 improvements verified:**
- **Typing indicator mutual exclusion** (plans 02-02, 02-06): `typingColleagues.length === 0` gate on the in-list streaming bubble (line 2357), cleared on `streaming_started` (line 569), cleared on both submit handlers (lines 1877, 1976) — full mutual exclusion confirmed
- **agentRole green-flash elimination** (plans 02-03, 02-04, 02-06): server-side backfill at read time, guard in useEffect when `activeProjectAgents.length === 0` (line 1193), agentRole injected at streaming placeholder creation time (lines 602–604) — the race is closed at all three points
- **Streaming state management**: 35 references to streaming state across CenterPanel; all lifecycle events handled (`streaming_started`, `streaming_chunk`, `streaming_completed`, `streaming_error`, `cancel_streaming`)
- **Loading states**: `isLoadingMessages`, `loadingEarlier`, `messagesLoading`, pending response timeout — multiple loading state layers
- **Error states**: 42 error/isError references; `ErrorBoundary` wraps panel areas (home.tsx); contextual error messages for streaming failures
- **Empty state**: `LandingPage.tsx` line 616 empty sidebar copy is specific and instructional; `CenterPanel.tsx` line 2121 empty state block exists
- **Accordion UX** (plan 02-07): Framer Motion `AnimatePresence` + `motion.div` with `initial={false}` confirmed in ProjectTree.tsx lines 550–663 — smooth height animation

**Issues:**
- `CenterPanel.tsx` line 2301: "Load earlier messages" button text switches to "Loading..." during fetch — `"Loading..."` is a generic state label with no time estimate or progress indicator; consider "Fetching..." or adding a spinner alongside the text
- The `LandingPage.tsx` interactive chat UI shows "SYSTEM PROCESSING DATA" (line 769) as a status footer when idle. This text has no explanation and appears to be decorative, but a first-time visitor might interpret it as a real system status — it would be clearer as "Your AI team is ready" or similar affirmative copy
- OnboardingManager fallback path (home.tsx line 831): if `onStartWithIdeaPromptName` is undefined, the onboarding creates a project named "My Idea" without user input — this is a silent failure mode that deposits users into a project with a meaningless auto-generated name

---

## Registry Safety

shadcn is initialized (`components.json` exists). No third-party registry entries in `components.json` — only official shadcn registry in use. Registry audit: 0 third-party blocks, no flags.

---

## Files Audited

**Phase 2 primary files (modified):**
- `client/src/App.tsx` — routing fix, LandingPage conditional render
- `client/src/pages/home.tsx` — idea path creation, team accordion, onboarding wiring
- `client/src/pages/LandingPage.tsx` — full page visual audit
- `client/src/components/CenterPanel.tsx` — typing indicator, agentRole backfill, streaming states
- `client/src/components/ProjectTree.tsx` — accordion animation, spacing audit
- `client/src/components/OnboardingManager.tsx` — idea path callback wiring
- `server/routes.ts` — agentRole backfill at read time
- `shared/schema.ts` — agents.teamId nullable

**Supporting files read:**
- `client/src/components/ProjectNameModal.tsx` — CTA copy audit
- `client/src/components/LeftSidebar.tsx` — empty state copy
- `client/src/components/ErrorFallbacks.tsx` — error state patterns

**Screenshots captured:**
- `.planning/ui-reviews/02-20260318-190910/desktop.png` (1440x900)
- `.planning/ui-reviews/02-20260318-190910/tablet.png` (768x1024)
- `.planning/ui-reviews/02-20260318-190910/mobile.png` (375x812)
