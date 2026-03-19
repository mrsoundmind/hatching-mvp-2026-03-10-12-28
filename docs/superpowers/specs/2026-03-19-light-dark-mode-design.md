# Light & Dark Mode — Full App Theming

**Date**: 2026-03-19
**Status**: Approved
**Scope**: Landing page, login page, onboarding, main app — all pages and components

---

## Overview

Add light and dark mode theming across the entire Hatchin app. Uses the existing Tailwind `darkMode: ["class"]` configuration and CSS variable system. OS preference sets the initial default on first visit; after that the user's manual toggle choice persists via localStorage.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Default mode | OS preference on first visit, then user choice | Most modern approach, respects user system settings |
| Toggle behavior | Two-state (light/dark) | Simpler than three-way system/light/dark cycling |
| Toggle location | LeftSidebar footer | No top navbar exists; sidebar footer is near user avatar/settings |
| Landing page light mode | Full light redesign | White bg, pastel gradient washes, light glass cards |
| Approach | CSS Variables Only | Minimal code, leverages existing Tailwind + Shadcn infrastructure |
| Agent text color pattern | Merged Tailwind class (`text-blue-600 dark:text-blue-300`) | Avoids needing `useTheme()` at every call site; idiomatic Tailwind |
| FOUC prevention | Inline `<script>` in index.html | Blocks rendering flash before React hydrates |
| Code highlighting | Import light theme default, dark overrides in `.dark` scope | Single concrete approach, no dynamic stylesheet swapping |

---

## 1. FOUC Prevention

Add a blocking inline script in `client/index.html` **before** the React bundle loads:

```html
<script>
  if (localStorage.getItem('hatchin-theme') === 'dark' ||
      (!localStorage.getItem('hatchin-theme') && matchMedia('(prefers-color-scheme: dark)').matches))
    document.documentElement.classList.add('dark');
</script>
```

This runs synchronously before any CSS/JS and prevents the visible flash of wrong theme.

---

## 2. ThemeProvider

**File**: `client/src/components/ThemeProvider.tsx`

React context that manages theme state and applies it to the DOM.

**Behavior**:
- On mount: read `localStorage.getItem("hatchin-theme")`
  - If no stored value: read `window.matchMedia("(prefers-color-scheme: dark)")` to set initial theme
  - If stored value exists: use it directly
- Listen to `matchMedia` changes — if user has never manually toggled and changes OS theme while app is open, auto-update
- When theme changes: add/remove `.dark` class on `document.documentElement`, update localStorage
- Expose `{ theme, setTheme, toggleTheme }` via `useTheme()` hook

**Types**:
```typescript
type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}
```

**Integration**: Wrap `<Router />` with `<ThemeProvider>` in `App.tsx`:
```tsx
<QueryClientProvider client={queryClient}>
  <ThemeProvider>
    <TooltipProvider>
      <Toaster />
      <Router />
    </TooltipProvider>
  </ThemeProvider>
</QueryClientProvider>
```

---

## 3. ThemeToggle Component

**File**: `client/src/components/ThemeToggle.tsx`

- Small icon button using Lucide `Sun` and `Moon` icons
- Click calls `toggleTheme()` from `useTheme()`
- Placed in LeftSidebar footer area (near user avatar)

---

## 4. CSS Variable Updates

### Extended Variable Set

The codebase uses 8-10 distinct gray shades. We need additional semantic variables beyond the original 6 to cover the full range:

### `:root` (light mode) — New values

```css
:root {
  /* Shadcn vars — keep as-is (already light) */

  /* Hatchin Custom Colors — NEW LIGHT VALUES */
  --hatchin-dark: hsl(220, 14%, 96%);           /* page background */
  --hatchin-panel: hsl(0, 0%, 100%);            /* panel/sidebar backgrounds */
  --hatchin-card: hsl(220, 13%, 95%);           /* card backgrounds */
  --hatchin-surface: hsl(220, 13%, 92%);        /* modal/input backgrounds (replaces #37383B) */
  --hatchin-surface-elevated: hsl(220, 13%, 97%); /* elevated surfaces (replaces #2A2D33) */
  --hatchin-surface-muted: hsl(220, 14%, 93%);  /* muted input backgrounds (replaces #212327) */
  --hatchin-border: hsl(220, 13%, 87%);         /* standard borders */
  --hatchin-border-subtle: hsl(220, 13%, 90%);  /* subtle borders (replaces #43444B) */
  --hatchin-text: hsl(220, 15%, 15%);           /* primary text */
  --hatchin-text-muted: hsl(220, 8%, 46%);      /* secondary text */
  --hatchin-text-bright: hsl(220, 15%, 10%);    /* high-emphasis text (replaces #F1F1F3) */

  /* Accents — same in both modes */
  --hatchin-blue: #6C82FF;
  --hatchin-green: hsl(158, 66%, 57%);
  --hatchin-orange: hsl(25, 100%, 64%);

  /* Premium layout */
  --premium-bg-start: hsl(220, 14%, 97%);
  --premium-bg-end: hsl(220, 14%, 94%);
  --premium-glow-opacity: 0.03;
  --premium-line-opacity: 0.15;

  /* Glass effects */
  --glass-bg: rgba(0, 0, 0, 0.02);
  --glass-border: rgba(0, 0, 0, 0.06);
  --glass-shadow: rgba(0, 0, 0, 0.06);
  --glass-hover-bg: rgba(0, 0, 0, 0.04);
  --glass-hover-border: rgba(0, 0, 0, 0.1);

  /* Scrollbar */
  --scrollbar-thumb: rgba(108, 130, 255, 0.3);
  --scrollbar-thumb-hover: rgba(108, 130, 255, 0.5);
}
```

### `.dark` — Hatchin overrides

```css
.dark {
  /* Shadcn vars — keep as-is (already dark) */

  /* Hatchin Custom Colors — CURRENT DARK VALUES */
  --hatchin-dark: hsl(210, 5%, 22%);
  --hatchin-panel: hsl(216, 10%, 14%);
  --hatchin-card: hsl(216, 8%, 22%);
  --hatchin-surface: hsl(216, 8%, 23%);         /* #37383B equivalent */
  --hatchin-surface-elevated: hsl(216, 7%, 18%); /* #2A2D33 equivalent */
  --hatchin-surface-muted: hsl(216, 7%, 15%);   /* #212327 equivalent */
  --hatchin-border: hsl(216, 8%, 27%);
  --hatchin-border-subtle: hsl(216, 7%, 30%);   /* #43444B equivalent */
  --hatchin-text: hsl(210, 9%, 95%);
  --hatchin-text-muted: hsl(216, 6%, 67%);
  --hatchin-text-bright: hsl(0, 0%, 95%);       /* #F1F1F3 equivalent */

  /* Premium layout */
  --premium-bg-start: #1A1D23;
  --premium-bg-end: #111318;
  --premium-glow-opacity: 0.05;
  --premium-line-opacity: 0.4;

  /* Glass effects */
  --glass-bg: rgba(255, 255, 255, 0.03);
  --glass-border: rgba(255, 255, 255, 0.08);
  --glass-shadow: rgba(0, 0, 0, 0.2);
  --glass-hover-bg: rgba(255, 255, 255, 0.05);
  --glass-hover-border: rgba(255, 255, 255, 0.12);

  /* Scrollbar */
  --scrollbar-thumb: rgba(108, 130, 255, 0.2);
  --scrollbar-thumb-hover: rgba(108, 130, 255, 0.4);
}
```

### New Tailwind Utility Classes

Add to `tailwind.config.ts` `theme.extend.colors`:
```typescript
'hatchin-surface': 'var(--hatchin-surface)',
'hatchin-surface-elevated': 'var(--hatchin-surface-elevated)',
'hatchin-surface-muted': 'var(--hatchin-surface-muted)',
'hatchin-border-subtle': 'var(--hatchin-border-subtle)',
'hatchin-text-bright': 'var(--hatchin-text-bright)',
```

Also add to `@layer components` in `index.css`:
```css
.hatchin-bg-surface { background-color: var(--hatchin-surface); }
.hatchin-bg-surface-elevated { background-color: var(--hatchin-surface-elevated); }
.hatchin-bg-surface-muted { background-color: var(--hatchin-surface-muted); }
.hatchin-border-subtle { border-color: var(--hatchin-border-subtle); }
.hatchin-text-bright { color: var(--hatchin-text-bright); }
```

**Result**: Body already uses `var(--hatchin-dark)` and `var(--hatchin-text)` — it auto-switches. All `.hatchin-bg-*` utility classes auto-switch. All Shadcn components auto-switch.

---

## 5. Complete Hardcoded Color Audit

### Hex-to-Variable Mapping

| Hardcoded Hex | Semantic Variable | Usage |
|---------------|-------------------|-------|
| `#0A0A0A`, `#030303`, `#080a0f` | `bg-background` (Shadcn) | Page backgrounds |
| `#1A1D23`, `#111318` | `--premium-bg-start/end` | Premium column gradients |
| `#212327` | `--hatchin-surface-muted` | Input/muted backgrounds |
| `#23262B` | `--hatchin-card` | Card/modal backgrounds |
| `#2A2D33` | `--hatchin-surface-elevated` | Elevated surfaces |
| `#34373d`, `#37383B` | `--hatchin-surface` | Surface backgrounds |
| `#43444B` | `--hatchin-border-subtle` | Subtle borders |
| `#A6A7AB` | `--hatchin-text-muted` | Muted text |
| `#F1F1F3` | `--hatchin-text-bright` | Bright text |
| `text-white` | `text-foreground` | Primary text (on bg) |
| `text-gray-100/200` | `text-foreground` | Primary text |
| `text-gray-300/400/500` | `text-muted-foreground` | Secondary text |
| `text-slate-200/300` | `text-foreground` | Primary text |
| `text-slate-400/500` | `text-muted-foreground` | Secondary text |
| `bg-slate-800/40`, `bg-slate-900/60` | `bg-muted` or `bg-hatchin-surface/50` | Overlay backgrounds |

### Complete File List (22 files with hardcoded hex backgrounds)

**Pages**:
| File | Hardcoded Colors | Action |
|------|-----------------|--------|
| `App.tsx` | `bg-[#0A0A0A]`, `text-white` | → `bg-background`, `text-foreground` |
| `LandingPage.tsx` | `bg-[#030303]`, `bg-[#080a0f]`, `text-white`, `text-slate-*`, inline gradients, USP card colors | → `bg-background`, `text-foreground`, `text-muted-foreground`; USP active states: `bg-indigo-50 dark:bg-[#131724]` etc. |
| `login.tsx` | `bg-[#030303]`, `text-white`, `text-slate-400`, inline gradient orbs | → `bg-background`, `text-foreground`, `text-muted-foreground`; gradient orbs keep colors (work on both) |
| `onboarding.tsx` | `bg-[#...]` | → Semantic variable equivalents |
| `MayaChat.tsx` | `bg-[#...]` | → Semantic variable equivalents |

**Components**:
| File | Hardcoded Colors | Action |
|------|-----------------|--------|
| `CenterPanel.tsx` | `bg-[#...]` hex colors | → `bg-hatchin-*` semantic classes |
| `LeftSidebar.tsx` | `bg-[#...]` hex colors | → `bg-hatchin-*` semantic classes |
| `RightSidebar.tsx` | `bg-[#212327]` (5 instances), `#A6A7AB` | → `bg-hatchin-surface-muted`, `text-hatchin-text-muted` |
| `ProjectTree.tsx` | `bg-[#34373d]` (multiple) | → `bg-hatchin-surface` |
| `MessageBubble.tsx` | `hsl(216, 8%, 18%)` inline, `text-gray-*` | → `var(--hatchin-card)`, `text-foreground` |
| `TaskManager.tsx` | `bg-[#...]` | → Semantic classes |
| `TaskApprovalModal.tsx` | `bg-[#...]` | → Semantic classes |
| `WelcomeModal.tsx` | `bg-[#1A1D23]`, `border-[#31343A]`, `text-[#F1F1F3]`, `text-[#A6A7AB]` | → `bg-hatchin-panel`, `border-hatchin-border`, `text-hatchin-text-bright`, `text-hatchin-text-muted` |
| `AddHatchModal.tsx` | `bg-[#23262B]`, `text-[#F1F1F3]`, `text-[#A6A7AB]` | → `bg-hatchin-card`, `text-hatchin-text-bright`, `text-hatchin-text-muted` |
| `StarterPacksModal.tsx` | `bg-[#23262B]`, `border-[#43444B]` | → `bg-hatchin-card`, `border-hatchin-border-subtle` |
| `QuickStartModal.tsx` | `bg-[#...]` | → Semantic classes |
| `ProjectNameModal.tsx` | `bg-[#...]` | → Semantic classes |
| `NameInputModal.tsx` | `bg-[#...]` | → Semantic classes |
| `OnboardingSteps.tsx` | `bg-[#...]` | → Semantic classes |
| `PathSelectionModal.tsx` | `bg-[#...]` | → Semantic classes |
| `TemplateSelectionModal.tsx` | `bg-[#...]` | → Semantic classes |
| `EggHatchingAnimation.tsx` | Inline radial gradients, `#1a1d28`, `#0d0e14` | → Use `dark:` prefix variants where possible; animation-specific gradients use semantic vars |
| `ui/bento-card.tsx` | `bg-[#0A0C13]`, `bg-[#080A0F]`, `bg-[#0e1018]` | → `bg-background`, `bg-hatchin-panel` |
| `devtools/autonomyDashboard.tsx` | `bg-[#...]` | → Semantic classes |

---

## 6. Premium Utility Classes — Light Variants

### `.premium-column-bg`

Now uses CSS variables (defined in section 4):

```css
.premium-column-bg {
  background: linear-gradient(180deg, var(--premium-bg-start) 0%, var(--premium-bg-end) 100%);
  position: relative;
}

.premium-column-bg::after {
  /* top line glow — use var(--premium-line-opacity) */
  background: linear-gradient(90deg,
    transparent 0%,
    rgba(108, 130, 255, 0.0) 10%,
    rgba(108, 130, 255, var(--premium-line-opacity)) 50%,
    rgba(108, 130, 255, 0.0) 90%,
    transparent 100%);
}

.premium-column-bg::before {
  background: radial-gradient(circle at 50% 0%,
    rgba(108, 130, 255, var(--premium-glow-opacity)), transparent 70%);
}
```

### `.glass-card-premium`

```css
.glass-card-premium {
  background: var(--glass-bg);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid var(--glass-border);
  box-shadow: 0 4px 20px var(--glass-shadow);
}

.glass-card-premium:hover {
  background: var(--glass-hover-bg);
  border-color: var(--glass-hover-border);
  box-shadow: 0 8px 30px var(--glass-shadow);
}
```

### `.hatchin-glass`

```css
.hatchin-glass {
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  background-color: var(--glass-bg);
  border: 1px solid var(--glass-border);
}
```

---

## 7. Landing Page Light Mode

**Background**: `bg-background` — white in light, near-black in dark.

**Gradient orbs**: Softer in light mode:
- Dark: `from-fuchsia-400/20` on black
- Light: `from-fuchsia-200/30` on white (pastel watercolor washes)

Use `dark:from-fuchsia-400/20 from-fuchsia-200/30` pattern on gradient elements.

**Text**: Replace `text-white` with `text-foreground`, `text-gray-400`/`text-slate-*` with `text-muted-foreground`.

**Glass cards**: Use `.glass-card-premium` vars from section 6.

**USP bento card active states** (`getColorClasses` function): The function returns hardcoded dark-mode-specific backgrounds like `bg-[#131724]`, `bg-[#111A18]`, `bg-[#1A121F]`. Replace with light/dark pairs:

| Color | Current Dark BG | Light Replacement | Dark Replacement |
|-------|-----------------|-------------------|------------------|
| indigo | `bg-[#131724]` | `bg-indigo-50` | `dark:bg-[#131724]` |
| emerald | `bg-[#111A18]` | `bg-emerald-50` | `dark:bg-[#111A18]` |
| fuchsia | `bg-[#1A121F]` | `bg-fuchsia-50` | `dark:bg-[#1A121F]` |
| blue | `bg-[#0f1724]` | `bg-blue-50` | `dark:bg-[#0f1724]` |
| amber | `bg-[#1A1510]` | `bg-amber-50` | `dark:bg-[#1A1510]` |
| orange | `bg-[#1A1208]` | `bg-orange-50` | `dark:bg-[#1A1208]` |
| green | `bg-[#0f1A14]` | `bg-green-50` | `dark:bg-[#0f1A14]` |
| rose | `bg-[#1A0f14]` | `bg-rose-50` | `dark:bg-[#1A0f14]` |
| default | `bg-[#131724]` | `bg-slate-50` | `dark:bg-[#131724]` |

The `globalBackground()` radial gradient function uses `rgba()` at 0.15 opacity — these work fine on both light and dark backgrounds as subtle washes. No changes needed.

**CTA buttons**: Keep `hatchin-blue` as primary — works on both backgrounds.

**Agent persona gradient pills**: Keep the same gradient colors — they pop on both white and dark.

---

## 8. Login Page Light Mode

Same treatment as landing page:
- `bg-[#030303]` → `bg-background`
- `text-white` → `text-foreground`
- `text-slate-400` → `text-muted-foreground`
- Animated background orbs: keep colorful gradients (they work on both with lower opacity on light via `dark:` prefix if needed)
- Floating agent cards: keep their gradients
- Grid overlay: `#ffffff03` → use `dark:` variant with appropriate opacity

---

## 9. Onboarding & Modal Pages

`onboarding.tsx`, `OnboardingSteps.tsx`, `PathSelectionModal.tsx` — same hex replacement pattern. Map all `bg-[#...]` to nearest semantic variable.

---

## 10. Agent Role Text Colors

Agent roles in `shared/roleRegistry.ts` define Tailwind classes like `text-blue-300` — optimized for dark backgrounds only.

**Solution**: Merge both variants into a single `text` field using Tailwind's `dark:` prefix:

```typescript
// In ROLE_DEFINITIONS — BEFORE
{
  role: "product_manager",
  text: "text-blue-300",
}

// AFTER
{
  role: "product_manager",
  text: "text-blue-600 dark:text-blue-300",
}
```

This approach:
- Requires no changes to `AgentColorSet` interface
- Requires no `useTheme()` hook at any call site
- Is idiomatic Tailwind — just works everywhere `text` is used as a className
- All 8+ roles get updated in `shared/roleRegistry.ts` only

Similarly for `dot` classes:
```typescript
dot: "bg-blue-500 dark:bg-blue-400",
```

`avatarBg` and `avatarRing` classes likely need the same treatment if their current shades don't contrast well on light backgrounds.

**`bgCss` and `borderCss` fields**: These are inline CSS values used for agent message bubble backgrounds (e.g., `hsla(217, 70%, 55%, 0.12)`) and borders (e.g., `hsla(217, 70%, 55%, 0.35)`). Since these are semi-transparent tints at 12% and 35% opacity respectively, they produce a subtle colored wash that reads well on both light and dark backgrounds. **No changes needed** for these fields.

---

## 11. Code Syntax Highlighting

Current: `@import 'highlight.js/styles/github-dark.css'` at line 2 of `index.css`.

**Solution**: Import the light theme by default, override with dark theme in `.dark` scope:

```css
/* Light theme — loaded by default */
@import 'highlight.js/styles/github.css';
```

Then in the `.dark` selector, override the key highlight.js CSS variables/properties. The `github` and `github-dark` themes from highlight.js share the same class structure, so we can scope the dark overrides:

```css
.dark .hljs {
  background: #0d1117;
  color: #e6edf3;
}
.dark .hljs-keyword { color: #ff7b72; }
.dark .hljs-string { color: #a5d6ff; }
.dark .hljs-comment { color: #8b949e; }
.dark .hljs-function { color: #d2a8ff; }
.dark .hljs-number { color: #79c0ff; }
.dark .hljs-title { color: #d2a8ff; }
.dark .hljs-built_in { color: #ffa657; }
/* ... remaining overrides from github-dark theme */
```

This avoids style conflicts from importing two full stylesheets and gives precise control.

---

## 12. Scrollbar Theming

Uses CSS variables defined in section 4:

```css
::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 10px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--scrollbar-thumb-hover);
}
```

---

## 13. Animation Fixes

### `flash-save-border` (index.css)

Current dark-mode fallback:
```css
100% { border-color: rgba(255, 255, 255, 0.08); }
```

Fix: use semantic variable:
```css
100% { border-color: var(--hatchin-border); box-shadow: none; }
```

### Other glow animations

The `rgba(108, 130, 255, ...)` glow animations (coachmark-pulse, ai-task-ring, brain-glow-pulse, ai-thinking-ring) work fine on both light and dark — blue glow is visible on both backgrounds. No changes needed.

---

## Files Modified (Complete Summary)

### New Files
| File | Purpose |
|------|---------|
| `client/src/components/ThemeProvider.tsx` | Theme context + `useTheme()` hook |
| `client/src/components/ThemeToggle.tsx` | Sun/Moon toggle button |

### Modified Files
| File | Change |
|------|--------|
| `client/index.html` | Add FOUC prevention inline script |
| `client/src/App.tsx` | Wrap with ThemeProvider, replace `bg-[#0A0A0A]` and `text-white` |
| `client/src/index.css` | Update all CSS variables, premium utilities, scrollbar, animations |
| `tailwind.config.ts` | Add new semantic color tokens |
| `client/src/pages/LandingPage.tsx` | Full light mode treatment, USP card color pairs |
| `client/src/pages/login.tsx` | Replace hardcoded dark colors |
| `client/src/pages/onboarding.tsx` | Replace hardcoded dark colors |
| `client/src/pages/MayaChat.tsx` | Replace hardcoded dark colors |
| `client/src/components/LeftSidebar.tsx` | Add ThemeToggle, replace hex colors |
| `client/src/components/CenterPanel.tsx` | Replace hex colors |
| `client/src/components/RightSidebar.tsx` | Replace 5x `bg-[#212327]` + `#A6A7AB` |
| `client/src/components/ProjectTree.tsx` | Replace `bg-[#34373d]` |
| `client/src/components/MessageBubble.tsx` | Theme-aware user bubble, text colors |
| `client/src/components/TaskManager.tsx` | Replace hex colors |
| `client/src/components/TaskApprovalModal.tsx` | Replace hex colors |
| `client/src/components/WelcomeModal.tsx` | Replace hex colors |
| `client/src/components/AddHatchModal.tsx` | Replace hex colors |
| `client/src/components/StarterPacksModal.tsx` | Replace hex colors |
| `client/src/components/QuickStartModal.tsx` | Replace hex colors |
| `client/src/components/ProjectNameModal.tsx` | Replace hex colors |
| `client/src/components/NameInputModal.tsx` | Replace hex colors |
| `client/src/components/OnboardingSteps.tsx` | Replace hex colors |
| `client/src/components/PathSelectionModal.tsx` | Replace hex colors |
| `client/src/components/TemplateSelectionModal.tsx` | Replace hex colors |
| `client/src/components/EggHatchingAnimation.tsx` | Theme-aware gradients |
| `client/src/components/ui/bento-card.tsx` | Replace hex colors |
| `client/src/devtools/autonomyDashboard.tsx` | Replace hex colors |
| `client/src/components/TaskSuggestionModal.tsx` | Replace `text-gray-*` (9+ instances) with `text-foreground`/`text-muted-foreground` |
| `client/src/components/ThreadContainer.tsx` | Replace `text-gray-*`, `text-white`, `bg-gray-*` (6+ instances) |
| `client/src/components/AppHeader.tsx` | Replace `text-white` (2 instances) with `text-foreground` |
| `client/src/components/ProgressTimeline.tsx` | Replace `text-gray-500` with `text-muted-foreground` |
| `client/src/pages/not-found.tsx` | Replace `text-gray-900`/`text-gray-600` with `text-foreground`/`text-muted-foreground` |
| `shared/roleRegistry.ts` | Merge `dark:` prefix into `text`, `dot`, `avatarBg`, `avatarRing` fields |

### Total: 2 new files + 32 modified files

---

## What Stays the Same

- Accent colors (`--hatchin-blue`, `--hatchin-green`, `--hatchin-orange`) — identical in both modes
- Agent bubble backgrounds — transparent `hsla()` overlays work on both
- Agent gradient pills — colorful gradients work on both
- CTA button colors — `hatchin-blue` on both
- All Shadcn component behavior — they already use CSS variables
- Glow animation keyframes — blue glow works on both backgrounds
- Login/landing gradient orbs — colorful radial gradients visible on both

---

## Known Limitations

- The `addVariablesForColors` plugin in `tailwind.config.ts` flattens all Tailwind colors into `:root` CSS variables. These won't update when `.dark` is toggled. This is fine since the app uses Tailwind classes (which do respond to `dark:`) rather than raw `var(--blue-300)`.

---

*Spec written: 2026-03-19*
*Revised: 2026-03-19 — addressed review findings (complete color audit, FOUC prevention, concrete highlight.js approach, agent text color pattern, animation fixes, USP card colors)*
