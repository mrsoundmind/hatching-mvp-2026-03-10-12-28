# Phase 03 — UI Review

**Audited:** 2026-03-18
**Baseline:** Abstract 6-pillar standards (no UI-SPEC.md for this phase)
**Screenshots:** Captured (dev server at localhost:5001) — desktop, mobile, tablet

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Raw role label leaks beside character name in MessageBubble; minor generic "Something went wrong" in ErrorFallbacks |
| 2. Visuals | 4/4 | 26 unique SVG avatars with per-character animations; thinking bubble and idle/thinking states correctly wired |
| 3. Color | 3/4 | Design system token `#6C82FF` used consistently but scattered as hardcoded literals instead of CSS custom properties |
| 4. Typography | 2/4 | 8 distinct font sizes in use including 6 arbitrary px values; 3 font weights in use is acceptable |
| 5. Spacing | 3/4 | Mostly scale-based; handful of arbitrary `[0px]`, `[2px]`, `[11px]` values in CenterPanel empty state |
| 6. Experience Design | 3/4 | Suspense fallback, FallbackAvatar, and error recovery present; speaking/celebrating states defined but never triggered |

**Overall: 18/24**

---

## Top 3 Priority Fixes

1. **Raw role string renders beside character name in MessageBubble** — Users see both "Dev" and "· software-engineer" on the same line, undermining the character identity that Phase 3 was built to establish — Remove line 297 `<span className="text-xs text-gray-500 ml-1">· {agentRole}</span>` from `MessageBubble.tsx`, or replace `agentRole` with the roleDef's `title` only when no characterName is available.

2. **Arbitrary px font sizes scatter the type scale** — Six hard-coded sizes (`text-[48px]`, `text-[36px]`, `text-[16px]`, `text-[14px]`, `text-[12px]`, `text-[11px]`) exist alongside Tailwind tokens in `CenterPanel.tsx`, `OnboardingSteps.tsx`, and `MessageBubble.tsx`, making the scale impossible to enforce — Consolidate to `text-4xl` (36px), `text-base` (16px), `text-sm` (14px), `text-xs` (12px), and add a `text-[11px]` alias only in `tailwind.config.ts` if truly needed.

3. **Design system accent color `#6C82FF` is a repeated hardcoded literal** — Appears raw in `BaseAvatar.tsx:115` (`ring-[#6C82FF]/40`), `BaseAvatar.tsx:80–90` (SVG fill), `WelcomeModal.tsx`, `ProjectNameModal.tsx`, `OnboardingSteps.tsx`, and others — Define `--hatchin-blue: #6C82FF` as a CSS custom property in `index.css` and reference it as `ring-[var(--hatchin-blue)]/40` or extend the Tailwind config with `colors.hatchin.blue` so all usage becomes `ring-hatchin-blue/40`.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

**Passing:** Character names ("Alex", "Dev", "Cleo") are used as display names in MessageBubble (`MessageBubble.tsx:91`), ProjectTree (`ProjectTree.tsx:593, 703`), and RightSidebar (`RightSidebar.tsx:297, 359`). Empty states are contextual: `LeftSidebar.tsx:616` uses "Nothing here yet. Press + New and tell Maya what you want to build." — specific and on-brand.

**Issue — Role label leaks in MessageBubble:**
`MessageBubble.tsx:296–297` renders `· {agentRole}` (raw role string like "software-engineer") immediately after the character name when `agentRole` is present. This exposes the internal role key to users, contradicts the PRES-04 goal, and reduces the sense of a personified teammate.

```
MessageBubble.tsx:296  {isAgent && agentRole && (
MessageBubble.tsx:297    <span className="text-xs text-gray-500 ml-1">· {agentRole}</span>
```

**Issue — Generic error fallback copy:**
`ErrorFallbacks.tsx:13–15` uses "Something went wrong" and "An unexpected error occurred in this panel." — generic patterns that give users no context on what failed or what to do.

**Minor — OnboardingSteps role label:**
`OnboardingSteps.tsx:87` renders `{a.role}` (e.g. "Product Manager") above the character name on agent cards in the onboarding preview, showing both the role label and characterName stacked. Given the rest of the system hides role labels, this is a minor inconsistency rather than a blocker.

---

### Pillar 2: Visuals (4/4)

**Screenshot observation (desktop, 1440x900):** The landing/loading screen shows the Hatchin branded card UI with animated widget tiles — visually polished dark theme. The main chat interface screenshot could not be captured because the app requires authentication, but code-level audit covers the relevant components.

**Avatar system — all passing:**
- `AgentAvatar.tsx` routes 24 characters via `React.Suspense` with `FallbackAvatar` for unknowns — visual fallback is graceful (emoji or initial in role-colored circle).
- `BaseAvatar.tsx:15–27` — `avatarVariants.idle = {}` and `avatarVariants.thinking = {}` confirm no body bobbing. Only `celebrating` produces body movement.
- `BaseAvatar.tsx:65–103` — `ThinkingBubble` uses `AnimatePresence` for enter/exit, scaled proportionally to avatar size. Trail dots and pulsing cloud SVG is visually distinct from idle.
- `AlexAvatar.tsx` — brow raise every 4s, mouth scaleX pulse every 5s. `DevAvatar.tsx` — tired flat-top lids, distinct from Alex. Per-character idle animation diversity is verified.
- `AvatarWrapper` in `BaseAvatar.tsx:115` applies `ring-1 ring-[#6C82FF]/40` to all avatars — consistent visual framing across all 26 characters.

**Icon-only button accessibility:**
`ProjectTree.tsx:597–606` — the delete agent button uses only `<Trash2 className="w-3 h-3" />` with a `title` attribute ("Delete agent") but no `aria-label`. The `title` attribute provides a tooltip on hover but is not read by screen readers on some assistive technologies. Recommend adding `aria-label="Delete agent"`.

**Hierarchy — MessageBubble:**
Avatar (26px) + character name (text-sm font-medium) + optional role label creates a clear hierarchy within the message header row. The avatar sits left-aligned with the name, matching conventional chat UI patterns.

---

### Pillar 3: Color (3/4)

**`text-primary` / `bg-primary` / `border-primary` usage:** 0 instances found in non-ui components. The project uses custom tokens (`hatchin-blue`, `hatchin-border`, `hatchin-text`) via CSS classes and hardcoded hex literals rather than Tailwind's default primary.

**Hardcoded hex literal frequency in avatar and core components:**

| Token | Raw hex used | Locations |
|-------|-------------|-----------|
| Hatchin blue | `#6C82FF` | `BaseAvatar.tsx:80–90,115`, `WelcomeModal.tsx:20,34,39,83`, `OnboardingSteps.tsx:100,257,258,277`, `CenterPanel.tsx:2155`, `ProjectNameModal.tsx:90,106,126` |
| Background dark | `#0A0A0A` | `App.tsx:28,65` |
| Card background | `#1A1D23`, `#23262B`, `#2b2f36` | Various modals |
| Text primary | `#F1F1F3` | `WelcomeModal.tsx`, `ProjectNameModal.tsx`, `OnboardingSteps.tsx` |
| Text muted | `#A6A7AB` | Multiple components |
| Border | `#31343A`, `#43444B` | Modal components |

The brand accent `#6C82FF` appears in at least 12 distinct locations as a raw literal. This is the main concern — not overuse of the accent (usage is semantically correct: thought bubbles, avatar rings, active states, CTAs) but the fragility of having no single source of truth. If the accent ever changes, all 12+ locations must be updated manually.

**Positive:** Avatar background gradients use component-scoped `radialGradient` IDs (`alexBg`, `devBg`, etc.), meaning avatar colors are self-contained and do not bleed into the global token system.

---

### Pillar 4: Typography (2/4)

**Font size distribution (non-ui components):**

| Class | Count | Notes |
|-------|-------|-------|
| `text-sm` | 165 | Appropriate — body text |
| `text-xs` | 108 | Appropriate — metadata, labels |
| `text-lg` | 34 | Headings, modal titles |
| `text-xl` | 10 | Section headings |
| `text-base` | 5 | Sparse — inconsistent with `text-sm` dominance |
| `text-3xl` | 5 | Hero/large text |
| `text-4xl` | 2 | Rare large text |
| `text-2xl` | 2 | Rare |

8 distinct Tailwind size classes in use exceeds the recommended 4 maximum for a focused design system. The scale is not wildly off, but the additional 6 arbitrary px classes compound the problem:

**Arbitrary font size instances (should be consolidated):**

| File | Line | Value | Recommended token |
|------|------|-------|-------------------|
| `CenterPanel.tsx` | 2125 | `text-[48px]` | `text-5xl` (48px) |
| `CenterPanel.tsx` | 2250 | `text-[36px]` | `text-4xl` (36px) |
| `CenterPanel.tsx` | 2251 | `text-[16px]` | `text-base` (16px) |
| `CenterPanel.tsx` | 2252 | `text-[14px]` | `text-sm` (14px) |
| `CenterPanel.tsx` | 2198, 2204 | `text-[12px]` | `text-xs` (12px) |
| `OnboardingSteps.tsx` | 38 | `text-[12px]` | `text-xs` (12px) |
| `OnboardingSteps.tsx` | 49, 142 | `text-[11px]` | No token — use `text-xs` or add custom |
| `OnboardingSteps.tsx` | 88 | `text-[9px]` | Very small — accessibility concern |
| `MessageBubble.tsx` | 212 | `text-[11px]` | No token — use `text-xs` |
| `MessageBubble.tsx` | 235, 236 | `text-[12px]`, `text-[11px]` | `text-xs` |

`text-[9px]` at `OnboardingSteps.tsx:88` is below the 11px accessibility minimum for sighted users and will render as effectively invisible on standard DPI screens.

**Font weight distribution:**

| Class | Count |
|-------|-------|
| `font-medium` | 100 |
| `font-semibold` | 45 |
| `font-bold` | 29 |
| `font-normal` | 3 |

3 weights (`medium`, `semibold`, `bold`) is within the recommended 2–3 range. The `font-normal` appears only 3 times, suggesting it is used for contrast rather than as a default weight. This is acceptable.

---

### Pillar 5: Spacing (3/4)

**Tailwind scale usage:** Standard spacing classes (`p-`, `px-`, `py-`, `gap-`, `m-`) are predominantly used. The avatar system itself is clean — `AvatarWrapper` uses only `style={{ width: size, height: size }}` with inline values derived from the `size` prop, which is a correct pattern for dynamic sizing.

**Arbitrary spacing instances found:**

| File | Line | Value | Issue |
|------|------|-------|-------|
| `CenterPanel.tsx` | 2250 | `mt-[0px] mb-[0px]` | Redundant — equivalent to omitting margin entirely |
| `CenterPanel.tsx` | 2252 | `mt-[0px] mb-[0px]` | Same — should be removed |
| `CenterPanel.tsx` | 2256 | `pt-[11px] pb-[11px]` | Use `py-3` (12px) or `py-2.5` (10px) |
| `OnboardingSteps.tsx` | 224 | `min-h-[280px]` | Acceptable — dimensional constraint |
| `OnboardingSteps.tsx` | 235 | `h-[120px]` | Acceptable — dimensional constraint |
| `ThreadContainer.tsx` | 166 | `min-w-[16px] h-[16px]` | Acceptable — badge sizing |
| `EggHatchingAnimation.tsx` | 39 | `w-[400px] h-[400px]` | Acceptable — animation canvas |

The `mt-[0px] mb-[0px]` pattern at `CenterPanel.tsx:2250–2252` is pure noise — these classes have zero visual effect and clutter the markup. They are likely leftover from iterative adjustments.

**Avatar spacing:** `MessageBubble.tsx:282` uses `gap-2 mb-2 px-1` for the avatar + name row — all standard tokens. `ProjectTree.tsx:573` uses `gap-2` for agent list items. Consistent.

---

### Pillar 6: Experience Design (3/4)

**Loading states — present and well-designed:**
- `AgentAvatar.tsx:129–137` — `React.Suspense` with `FallbackAvatar` for each lazy-loaded character component. The fallback is a colored circle with an emoji/initial, visually consistent with the loaded avatar.
- `ProjectTree.tsx:574` and `RightSidebar.tsx:288` — explicit `React.Suspense` wrappers around `AgentAvatar` with role-colored circle fallbacks.
- `EggHatchingAnimation.tsx` provides a visual loading state for the overall app initialization.

**Error states — present but minimal:**
- `ErrorFallbacks.tsx` provides an `ErrorBoundary` component, though the copy is generic (see Copywriting findings).
- No error state exists for the avatar system itself if all 26 character components fail to load — `FallbackAvatar` handles the case, but it silently renders a fallback rather than surfacing any error context.

**Empty states — context-appropriate:**
- `LeftSidebar.tsx:616` — "Nothing here yet" with specific next action ("Press + New").
- `CenterPanel.tsx:2121` — empty conversation state with welcome icon and contextual title.

**Gaps — unused avatar states:**
`BaseAvatar.tsx:6` defines `AvatarState = "idle" | "thinking" | "speaking" | "celebrating"`. Only `idle` and `thinking` are triggered in production code (`MessageBubble.tsx:287` toggles based on `isStreaming`, `RightSidebar.tsx:291` toggles based on `isAIStreaming`). `speaking` is functionally identical to `idle` (same `eyeThinkingVariants` definition at `BaseAvatar.tsx:45–53`). `celebrating` has animation in `avatarVariants` but is never passed as a `state` prop from any component. These states represent a design intention that is partially unimplemented — user interaction moments like task completion, thumbs-up reaction, or project creation would benefit from the `celebrating` state being triggered.

**Disabled state — input is handled:**
`CenterPanel.tsx:2501` applies `ai-thinking-ring` to the form during streaming, and `CenterPanel.tsx:2517` has keyboard submission guard logic. The send button disables during AI response. Appropriate.

**Confirmation for destructive actions:**
`ProjectTree.tsx:612–620` shows an inline confirmation dialog before deleting an agent. Appropriate pattern.

---

## Files Audited

**Avatar system (Phase 3 primary scope):**
- `/client/src/components/avatars/AgentAvatar.tsx`
- `/client/src/components/avatars/BaseAvatar.tsx`
- `/client/src/components/avatars/AlexAvatar.tsx`
- `/client/src/components/avatars/DevAvatar.tsx`
- (24 additional character avatar files present, spot-checked)

**Avatar integration sites:**
- `/client/src/components/MessageBubble.tsx`
- `/client/src/components/ProjectTree.tsx`
- `/client/src/components/RightSidebar.tsx`
- `/client/src/components/OnboardingSteps.tsx`

**Supporting components:**
- `/client/src/components/CenterPanel.tsx`
- `/client/src/components/ErrorFallbacks.tsx`
- `/client/src/components/WelcomeModal.tsx`
- `/client/src/components/ProjectNameModal.tsx`
- `/client/src/components/NameInputModal.tsx`
- `/client/src/App.tsx`

**Backend (personality persistence — PRES-05):**
- `/server/routes.ts` (lines 1074–1100, 1397–1422)
- `/shared/schema.ts` (lines 75–84)

**Screenshots captured:**
- `.planning/ui-reviews/03-20260318-190904/desktop.png` (1440x900)
- `.planning/ui-reviews/03-20260318-190904/mobile.png` (375x812)
- `.planning/ui-reviews/03-20260318-190904/tablet.png` (768x1024)

Note: Screenshots show the LandingPage (unauthenticated route) rather than the main chat UI, as the app requires login to reach `MessageBubble`, `ProjectTree`, and `RightSidebar`. The avatar rendering audit is therefore entirely code-based for integration sites.

**Registry audit:** shadcn initialized (official registry only, no third-party blocks). No registry audit required.
