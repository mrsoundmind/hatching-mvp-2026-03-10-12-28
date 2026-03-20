# Light & Dark Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add light and dark mode theming across the entire Hatchin app — landing page, login, onboarding, and main application.

**Architecture:** CSS-variable-driven theming using Tailwind's existing `darkMode: ["class"]` config. A `ThemeProvider` React context manages state (localStorage + OS preference), and a blocking inline script in `index.html` prevents FOUC. All 22+ files with hardcoded dark hex colors get replaced with semantic CSS variable references.

**Tech Stack:** React Context, Tailwind CSS `dark:` prefix, CSS custom properties, Lucide icons, localStorage.

**Spec:** `docs/superpowers/specs/2026-03-19-light-dark-mode-design.md`

---

## Task 1: FOUC Prevention Script + CSS Variable Foundation

**Files:**
- Modify: `client/index.html`
- Modify: `client/src/index.css`
- Modify: `tailwind.config.ts`

- [ ] **Step 1: Add FOUC prevention script to index.html**

In `client/index.html`, add this script tag inside `<head>`, after the font `<link>` tags (line 9) and before `</head>`:

```html
<script>
  if (localStorage.getItem('hatchin-theme') === 'dark' ||
      (!localStorage.getItem('hatchin-theme') && matchMedia('(prefers-color-scheme: dark)').matches))
    document.documentElement.classList.add('dark');
</script>
```

- [ ] **Step 2: Update `:root` CSS variables in index.css**

In `client/src/index.css`, replace the Hatchin custom colors block inside `:root` (lines 30-39) with light-mode values and add new semantic variables:

```css
  /* Hatchin Custom Colors — LIGHT VALUES */
  --hatchin-dark: hsl(220, 14%, 96%);
  --hatchin-panel: hsl(0, 0%, 100%);
  --hatchin-card: hsl(220, 13%, 95%);
  --hatchin-surface: hsl(220, 13%, 92%);
  --hatchin-surface-elevated: hsl(220, 13%, 97%);
  --hatchin-surface-muted: hsl(220, 14%, 93%);
  --hatchin-border: hsl(220, 13%, 87%);
  --hatchin-border-subtle: hsl(220, 13%, 90%);
  --hatchin-text: hsl(220, 15%, 15%);
  --hatchin-text-muted: hsl(220, 8%, 46%);
  --hatchin-text-bright: hsl(220, 15%, 10%);
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
```

- [ ] **Step 3: Add Hatchin dark overrides to `.dark` selector**

In `client/src/index.css`, add these variables inside the existing `.dark` block (after line 62):

```css
  /* Hatchin Custom Colors */
  --hatchin-dark: hsl(210, 5%, 22%);
  --hatchin-panel: hsl(216, 10%, 14%);
  --hatchin-card: hsl(216, 8%, 22%);
  --hatchin-surface: hsl(216, 8%, 23%);
  --hatchin-surface-elevated: hsl(216, 7%, 18%);
  --hatchin-surface-muted: hsl(216, 7%, 15%);
  --hatchin-border: hsl(216, 8%, 27%);
  --hatchin-border-subtle: hsl(216, 7%, 30%);
  --hatchin-text: hsl(210, 9%, 95%);
  --hatchin-text-muted: hsl(216, 6%, 67%);
  --hatchin-text-bright: hsl(0, 0%, 95%);

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
```

- [ ] **Step 4: Add new Tailwind color tokens**

In `tailwind.config.ts`, add these entries inside `theme.extend.colors` (after `'hatchin-orange'` on line 82):

```typescript
'hatchin-surface': 'var(--hatchin-surface)',
'hatchin-surface-elevated': 'var(--hatchin-surface-elevated)',
'hatchin-surface-muted': 'var(--hatchin-surface-muted)',
'hatchin-border-subtle': 'var(--hatchin-border-subtle)',
'hatchin-text-bright': 'var(--hatchin-text-bright)',
```

- [ ] **Step 5: Add new utility classes to index.css**

In `client/src/index.css`, add inside `@layer components` (after `.hatchin-bg-orange` block, around line 133):

```css
  .hatchin-bg-surface {
    background-color: var(--hatchin-surface);
  }

  .hatchin-bg-surface-elevated {
    background-color: var(--hatchin-surface-elevated);
  }

  .hatchin-bg-surface-muted {
    background-color: var(--hatchin-surface-muted);
  }

  .hatchin-border-subtle {
    border-color: var(--hatchin-border-subtle);
  }

  .hatchin-text-bright {
    color: var(--hatchin-text-bright);
  }
```

- [ ] **Step 6: Update premium utility classes to use CSS variables**

In `client/src/index.css`, update `.premium-column-bg` (around line 334):

Replace the hardcoded gradient:
```css
background: linear-gradient(180deg, #1A1D23 0%, #111318 100%);
```
With:
```css
background: linear-gradient(180deg, var(--premium-bg-start) 0%, var(--premium-bg-end) 100%);
```

Update `.premium-column-bg::after` — replace `rgba(108, 130, 255, 0.4)` with `rgba(108, 130, 255, var(--premium-line-opacity))`.

Update `.premium-column-bg::before` — replace `rgba(108, 130, 255, 0.05)` with `rgba(108, 130, 255, var(--premium-glow-opacity))`.

Update `.glass-card-premium` to use `var(--glass-bg)`, `var(--glass-border)`, `var(--glass-shadow)`, and hover states to use `var(--glass-hover-bg)`, `var(--glass-hover-border)`.

Update `.hatchin-glass` to use `var(--glass-bg)` and `var(--glass-border)`.

- [ ] **Step 7: Update scrollbar and animation CSS**

In `client/src/index.css`:

Replace scrollbar thumb colors (around line 201-208):
```css
::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 10px;
  transition: background 0.3s ease;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--scrollbar-thumb-hover);
}
```

Update `.bg-hatchin-colleague` (around line 116): replace `hsl(216, 8%, 18%)` with `var(--hatchin-card)`.

Update `.chat-bubble-user` (around line 137): replace `hsl(216, 8%, 18%)` with `var(--hatchin-card)`.

Update `.system-notice` (around line 245): replace `#A6A7AB` with `var(--hatchin-text-muted)`.

Update `flash-save-border` keyframe (around line 463): replace `border-color: rgba(255, 255, 255, 0.08)` with `border-color: var(--hatchin-border)`.

- [ ] **Step 8: Update code syntax highlighting**

In `client/src/index.css`, replace line 2:
```css
@import 'highlight.js/styles/github-dark.css';
```
With:
```css
@import 'highlight.js/styles/github.css';
```

Then add dark overrides inside the `.dark` block:
```css
  /* Code syntax highlighting — dark overrides */
  .dark .hljs { background: #0d1117; color: #e6edf3; }
  .dark .hljs-keyword { color: #ff7b72; }
  .dark .hljs-string { color: #a5d6ff; }
  .dark .hljs-comment { color: #8b949e; }
  .dark .hljs-function { color: #d2a8ff; }
  .dark .hljs-number { color: #79c0ff; }
  .dark .hljs-title { color: #d2a8ff; }
  .dark .hljs-built_in { color: #ffa657; }
  .dark .hljs-attr { color: #79c0ff; }
  .dark .hljs-variable { color: #ffa657; }
  .dark .hljs-type { color: #ff7b72; }
  .dark .hljs-literal { color: #79c0ff; }
```

Note: `.dark .hljs` overrides cannot go inside the `.dark { }` block in the `@layer base` section because highlight.js classes are not part of Tailwind layers. Place them after the `@layer components` section, around line 176.

- [ ] **Step 9: Verify the app still looks correct in dark mode**

Run: `npm run dev`

Open browser, inspect `<html>` element. Manually add `class="dark"` to it in DevTools. The app should look exactly like it does today (no visual changes in dark mode). Remove the class — it should show the new light theme colors.

- [ ] **Step 10: Run typecheck**

Run: `npm run typecheck`
Expected: PASS (no type errors from CSS/config changes)

- [ ] **Step 11: Commit**

```bash
git add client/index.html client/src/index.css tailwind.config.ts
git commit -m "feat(theme): add CSS variable foundation for light/dark mode"
```

---

## Task 2: ThemeProvider + ThemeToggle + App Integration

**Files:**
- Create: `client/src/components/ThemeProvider.tsx`
- Create: `client/src/components/ThemeToggle.tsx`
- Modify: `client/src/App.tsx`
- Modify: `client/src/components/LeftSidebar.tsx`

- [ ] **Step 1: Create ThemeProvider.tsx**

Create `client/src/components/ThemeProvider.tsx`:

```typescript
import { createContext, useContext, useEffect, useState, useCallback } from "react";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getInitialTheme(): Theme {
  const stored = localStorage.getItem("hatchin-theme");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem("hatchin-theme", newTheme);
    applyTheme(newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  // Apply theme on mount (in case FOUC script didn't run or state diverged)
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Listen for OS theme changes (only if user hasn't manually set a preference)
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem("hatchin-theme")) {
        const newTheme = e.matches ? "dark" : "light";
        setThemeState(newTheme);
        applyTheme(newTheme);
      }
    };
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within a ThemeProvider");
  return context;
}
```

- [ ] **Step 2: Create ThemeToggle.tsx**

Create `client/src/components/ThemeToggle.tsx`:

```typescript
import { Sun, Moon } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center gap-3 w-full px-3 py-2 text-sm hatchin-text hover:bg-hatchin-border transition-colors rounded-md"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      {theme === "dark" ? "Light Mode" : "Dark Mode"}
    </button>
  );
}
```

- [ ] **Step 3: Wrap Router with ThemeProvider in App.tsx**

In `client/src/App.tsx`, add import at top:
```typescript
import { ThemeProvider } from "@/components/ThemeProvider";
```

Wrap the contents of the `App` function (lines 107-114):

```tsx
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 4: Replace hardcoded colors in App.tsx**

In `client/src/App.tsx`:

Replace all `bg-[#0A0A0A]` with `bg-background` (lines 28 and 65).
Replace all `text-white` in loading screens with `text-foreground` (lines 43 and 79).

- [ ] **Step 5: Add ThemeToggle to LeftSidebar user dropdown**

In `client/src/components/LeftSidebar.tsx`:

Add import at top:
```typescript
import { ThemeToggle } from "./ThemeToggle";
```

Add the toggle inside the user dropdown menu, before the "Sign Out" divider (around line 520, before the `<div className="border-t">` separator):

```tsx
<ThemeToggle />
```

- [ ] **Step 6: Verify toggle works**

Run: `npm run dev`

Open browser. Click user avatar dropdown in LeftSidebar. Click the theme toggle. The entire app background should switch between light and dark. Refresh the page — the choice should persist (no flash).

- [ ] **Step 7: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add client/src/components/ThemeProvider.tsx client/src/components/ThemeToggle.tsx client/src/App.tsx client/src/components/LeftSidebar.tsx
git commit -m "feat(theme): add ThemeProvider, ThemeToggle, and App integration"
```

---

## Task 3: Agent Role Colors — Dark Mode Prefix Merge

**Files:**
- Modify: `shared/roleRegistry.ts`

- [ ] **Step 1: Update all role `text` fields with dark: prefix**

In `shared/roleRegistry.ts`, update each role's `text` field to include both light and dark variants. For every role in `ROLE_DEFINITIONS`:

| Role | Current `text` | New `text` |
|------|---------------|------------|
| Product Manager (Alex) | `text-blue-300` | `text-blue-600 dark:text-blue-300` |
| Business Analyst (Morgan) | `text-blue-200` | `text-blue-700 dark:text-blue-200` |
| Backend Developer (Dev) | `text-orange-300` | `text-orange-600 dark:text-orange-300` |
| Frontend Developer (Pixel) | `text-cyan-300` | `text-cyan-600 dark:text-cyan-300` |
| UI/UX Designer (Cleo) | `text-purple-300` | `text-purple-600 dark:text-purple-300` |
| Data Scientist (Sage) | `text-emerald-300` | `text-emerald-600 dark:text-emerald-300` |
| Marketing Specialist (Buzz) | `text-pink-300` | `text-pink-600 dark:text-pink-300` |
| DevOps Engineer (Ops) | `text-amber-300` | `text-amber-600 dark:text-amber-300` |

Note: Read each role's actual `text` value first — the colors above are approximations. Match the hue family (blue→blue, orange→orange, etc.) and use the 600 shade for light, keeping the existing dark shade.

- [ ] **Step 2: Update all role `dot` fields**

Same pattern for `dot` fields — add `dark:` prefix:

| Current `dot` | New `dot` |
|--------------|-----------|
| `bg-blue-400` | `bg-blue-500 dark:bg-blue-400` |
| `bg-blue-300` | `bg-blue-500 dark:bg-blue-300` |
| `bg-orange-400` | `bg-orange-500 dark:bg-orange-400` |
| etc. | Same hue, 500 for light, keep existing dark |

- [ ] **Step 3: Update `avatarBg` and `avatarRing` if needed**

Check each role's `avatarBg` and `avatarRing`. Most use mid-range shades (e.g., `bg-blue-600`, `ring-blue-500/40`) that look fine on both light and dark backgrounds. Only update if a shade would be invisible on white — likely fine as-is since 500-600 shades have good contrast on both.

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS (no interface changes, just string value updates)

- [ ] **Step 5: Visually verify agent colors in both modes**

Run: `npm run dev`

Open a project chat. Toggle to light mode. Verify:
- Agent name text is readable (not washed out on light background)
- Agent dots are visible
- Agent avatars have contrast
- Message bubbles (semi-transparent tinted backgrounds) are visible

Toggle back to dark mode — should look exactly like before.

- [ ] **Step 6: Commit**

```bash
git add shared/roleRegistry.ts
git commit -m "feat(theme): add light/dark variants to agent role colors"
```

---

## Task 4: Main App Component Color Replacements (Batch 1 — Core Layout)

**Files:**
- Modify: `client/src/components/CenterPanel.tsx`
- Modify: `client/src/components/RightSidebar.tsx`
- Modify: `client/src/components/ProjectTree.tsx`
- Modify: `client/src/components/MessageBubble.tsx`
- Modify: `client/src/components/TaskManager.tsx`

- [ ] **Step 1: Replace hardcoded colors in CenterPanel.tsx**

Open `client/src/components/CenterPanel.tsx`. Find all `bg-[#...]` patterns and replace using the hex-to-variable mapping:

| Find | Replace With |
|------|-------------|
| `bg-[#0A0A0A]` or `bg-[#030303]` | `bg-background` |
| `bg-[#1A1D23]` or `bg-[#111318]` | `bg-hatchin-panel` |
| `bg-[#23262B]` | `bg-hatchin-card` |
| `bg-[#212327]` | `bg-hatchin-surface-muted` |
| `bg-[#34373d]` or `bg-[#37383B]` | `bg-hatchin-surface` |
| `border-[#43444B]` or `border-[#31343A]` | `border-hatchin-border-subtle` |
| `text-[#F1F1F3]` | `text-hatchin-text-bright` |
| `text-[#A6A7AB]` | `text-muted-foreground` |
| `text-white` (on dark bg) | `text-foreground` |
| `text-gray-100`, `text-gray-200` | `text-foreground` |
| `text-gray-300`, `text-gray-400`, `text-gray-500` | `text-muted-foreground` |

- [ ] **Step 2: Replace hardcoded colors in RightSidebar.tsx**

Same mapping as Step 1. Pay special attention to:
- 6 instances of `bg-[#212327]` → `bg-hatchin-surface-muted`
- Inline `color: '#A6A7AB'` → use `className` with `text-muted-foreground` instead

- [ ] **Step 3: Replace hardcoded colors in ProjectTree.tsx**

- Multiple `bg-[#34373d]` → `bg-hatchin-surface`
- Apply same text color mapping

- [ ] **Step 4: Replace hardcoded colors in MessageBubble.tsx**

- Inline `backgroundColor: 'hsl(216, 8%, 18%)'` → `backgroundColor: 'var(--hatchin-card)'`
- `text-gray-100` → `text-foreground`
- `text-gray-200` → `text-foreground`
- `text-gray-300`, `text-gray-400`, `text-gray-500` → `text-muted-foreground`

- [ ] **Step 5: Replace hardcoded colors in TaskManager.tsx**

Same hex-to-variable mapping.

- [ ] **Step 6: Visual verification**

Run: `npm run dev`

Toggle between light and dark. Verify the chat area, right sidebar, project tree, message bubbles, and task manager all look correct in both modes. No dark panels floating on light background.

- [ ] **Step 7: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add client/src/components/CenterPanel.tsx client/src/components/RightSidebar.tsx client/src/components/ProjectTree.tsx client/src/components/MessageBubble.tsx client/src/components/TaskManager.tsx
git commit -m "feat(theme): replace hardcoded colors in core layout components"
```

---

## Task 5: Modal Component Color Replacements (Batch 2)

**Files:**
- Modify: `client/src/components/WelcomeModal.tsx`
- Modify: `client/src/components/AddHatchModal.tsx`
- Modify: `client/src/components/StarterPacksModal.tsx`
- Modify: `client/src/components/QuickStartModal.tsx`
- Modify: `client/src/components/ProjectNameModal.tsx`
- Modify: `client/src/components/NameInputModal.tsx`
- Modify: `client/src/components/TaskApprovalModal.tsx`
- Modify: `client/src/components/TaskSuggestionModal.tsx`
- Modify: `client/src/components/TemplateSelectionModal.tsx`

- [ ] **Step 1: Replace colors in all modal components**

Apply the same hex-to-variable mapping from Task 4 to every modal. Key patterns:

| Find | Replace With |
|------|-------------|
| `bg-[#1A1D23]` | `bg-hatchin-panel` |
| `bg-[#23262B]` | `bg-hatchin-card` |
| `bg-[#212327]` | `bg-hatchin-surface-muted` |
| `border-[#31343A]`, `border-[#43444B]` | `border-hatchin-border-subtle` |
| `text-[#F1F1F3]` | `text-hatchin-text-bright` |
| `text-[#A6A7AB]` | `text-muted-foreground` |
| `text-white` | `text-foreground` |
| `text-gray-*` (100-500) | `text-foreground` or `text-muted-foreground` per shade |

Do each modal one at a time. After each file, save and check the browser to verify the modal still looks correct in dark mode.

- [ ] **Step 2: Handle TaskSuggestionModal text colors**

`TaskSuggestionModal.tsx` has 9+ `text-gray-*` instances. Replace:
- `text-gray-500`, `text-gray-600` → `text-muted-foreground`
- `text-gray-700`, `text-gray-800`, `text-gray-900` → `text-foreground`

- [ ] **Step 3: Visual verification**

Run: `npm run dev`

Open each modal in both light and dark mode:
1. Create project → QuickStartModal, StarterPacksModal, ProjectNameModal
2. Welcome modal (first-time user)
3. Add Hatch modal
4. Task approval/suggestion modals
5. Template selection

All modals should have correct contrast and readability in both modes.

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/components/WelcomeModal.tsx client/src/components/AddHatchModal.tsx client/src/components/StarterPacksModal.tsx client/src/components/QuickStartModal.tsx client/src/components/ProjectNameModal.tsx client/src/components/NameInputModal.tsx client/src/components/TaskApprovalModal.tsx client/src/components/TaskSuggestionModal.tsx client/src/components/TemplateSelectionModal.tsx
git commit -m "feat(theme): replace hardcoded colors in modal components"
```

---

## Task 6: Page Color Replacements (Landing, Login, Onboarding, etc.)

**Files:**
- Modify: `client/src/pages/LandingPage.tsx`
- Modify: `client/src/pages/login.tsx`
- Modify: `client/src/pages/onboarding.tsx`
- Modify: `client/src/pages/MayaChat.tsx`
- Modify: `client/src/pages/not-found.tsx`

- [ ] **Step 1: Replace colors in LandingPage.tsx**

This is the largest page change. Key replacements:

1. All `bg-[#030303]` → `bg-background`
2. All `bg-[#080a0f]` → `bg-background`
3. All `text-white` → `text-foreground`
4. All `text-slate-200`, `text-slate-300` → `text-foreground`
5. All `text-slate-400`, `text-slate-500` → `text-muted-foreground`
6. All `bg-slate-800/40`, `bg-slate-900/60` → `bg-muted`
7. All `border-slate-700/50`, `border-slate-800/80` → `border-border`

- [ ] **Step 2: Update USP card active state colors**

Find the `getColorClasses` function (or equivalent color mapping). Replace each dark-only background with a light/dark pair:

```typescript
// Example: replace bg-[#131724] with:
bg: "bg-indigo-50 dark:bg-[#131724]"
```

Full mapping:
| Color | Light | Dark |
|-------|-------|------|
| indigo | `bg-indigo-50` | `dark:bg-[#131724]` |
| emerald | `bg-emerald-50` | `dark:bg-[#111A18]` |
| fuchsia | `bg-fuchsia-50` | `dark:bg-[#1A121F]` |
| blue | `bg-blue-50` | `dark:bg-[#0f1724]` |
| amber | `bg-amber-50` | `dark:bg-[#1A1510]` |
| orange | `bg-orange-50` | `dark:bg-[#1A1208]` |
| green | `bg-green-50` | `dark:bg-[#0f1A14]` |
| rose | `bg-rose-50` | `dark:bg-[#1A0f14]` |
| default | `bg-slate-50` | `dark:bg-[#131724]` |

- [ ] **Step 3: Replace colors in login.tsx**

1. All `bg-[#030303]` → `bg-background`
2. `text-white` → `text-foreground`
3. `text-slate-400` → `text-muted-foreground`
4. Grid overlay with `#ffffff03`: add `dark:` variant — `bg-[linear-gradient(to_right,#00000005_1px,transparent_1px),linear-gradient(to_bottom,#00000005_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)]`
5. Gradient orbs (colorful radial gradients) — keep as-is, they work on both backgrounds

- [ ] **Step 4: Replace colors in onboarding.tsx**

Same hex-to-variable mapping. Replace all `bg-[#...]` and dark text colors.

- [ ] **Step 5: Replace colors in MayaChat.tsx**

Same hex-to-variable mapping.

- [ ] **Step 6: Replace colors in not-found.tsx**

- `text-gray-900` → `text-foreground`
- `text-gray-600` → `text-muted-foreground`

- [ ] **Step 7: Visual verification**

Run: `npm run dev`

Test in both modes:
1. Landing page (logged out at `/`)
2. Login page (`/login`)
3. Onboarding flow
4. MayaChat page
5. 404 page

- [ ] **Step 8: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add client/src/pages/LandingPage.tsx client/src/pages/login.tsx client/src/pages/onboarding.tsx client/src/pages/MayaChat.tsx client/src/pages/not-found.tsx
git commit -m "feat(theme): replace hardcoded colors in all page components"
```

---

## Task 7: Remaining Component Color Replacements (Batch 3)

**Files:**
- Modify: `client/src/components/OnboardingSteps.tsx`
- Modify: `client/src/components/PathSelectionModal.tsx`
- Modify: `client/src/components/EggHatchingAnimation.tsx`
- Modify: `client/src/components/ThreadContainer.tsx`
- Modify: `client/src/components/AppHeader.tsx`
- Modify: `client/src/components/ProgressTimeline.tsx`
- Modify: `client/src/components/ui/bento-card.tsx`
- Modify: `client/src/devtools/autonomyDashboard.tsx`

- [ ] **Step 1: Replace colors in OnboardingSteps.tsx and PathSelectionModal.tsx**

Same hex-to-variable mapping as previous tasks.

- [ ] **Step 2: Replace colors in EggHatchingAnimation.tsx**

This component has many inline radial gradients. Replace background colors where possible:
- `#1a1d28`, `#0d0e14` → use CSS vars or `dark:` prefix variants
- Egg gradient and glow effects can stay as-is (they're accent colors that work on both)

- [ ] **Step 3: Replace colors in ThreadContainer.tsx**

- `text-gray-300`, `text-gray-400` → `text-muted-foreground`
- `text-white` → `text-foreground`
- `bg-gray-800/*` → `bg-hatchin-surface`

- [ ] **Step 4: Replace colors in AppHeader.tsx**

- `text-white` (2 instances) → `text-foreground`

- [ ] **Step 5: Replace colors in ProgressTimeline.tsx**

- `text-gray-500` → `text-muted-foreground`

- [ ] **Step 6: Replace colors in bento-card.tsx**

- `bg-[#0A0C13]` → `bg-background`
- `bg-[#080A0F]` → `bg-background`
- `bg-[#0e1018]` → `bg-hatchin-panel`

- [ ] **Step 7: Replace colors in autonomyDashboard.tsx**

Same hex-to-variable mapping. This is a dev-only page — lower priority but should still work in both modes.

- [ ] **Step 8: Visual verification**

Run: `npm run dev`

Toggle both modes. Spot-check:
- Onboarding steps flow
- Egg hatching animation
- Thread container (reply threads)
- Bento cards on landing page
- Dev autonomy dashboard

- [ ] **Step 9: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add client/src/components/OnboardingSteps.tsx client/src/components/PathSelectionModal.tsx client/src/components/EggHatchingAnimation.tsx client/src/components/ThreadContainer.tsx client/src/components/AppHeader.tsx client/src/components/ProgressTimeline.tsx client/src/components/ui/bento-card.tsx client/src/devtools/autonomyDashboard.tsx
git commit -m "feat(theme): replace hardcoded colors in remaining components"
```

---

## Task 8: Full Integration Test + Build Verification

**Files:** None (verification only)

- [ ] **Step 1: Run full typecheck**

Run: `npm run typecheck`
Expected: PASS with zero errors

- [ ] **Step 2: Run production build**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Full visual walkthrough — Dark Mode**

Run: `npm run dev`

Set theme to dark. Walk through every screen:
1. Landing page (logged out)
2. Login page
3. Click "Sign in" → Onboarding flow (if new user)
4. Main app → LeftSidebar, CenterPanel, RightSidebar
5. Open each modal: QuickStart, StarterPacks, ProjectName, AddHatch
6. Send a chat message → verify message bubbles
7. Check task manager
8. Check MayaChat page

Everything should look exactly like the app does today.

- [ ] **Step 4: Full visual walkthrough — Light Mode**

Toggle to light mode. Repeat the same walkthrough:
1. All backgrounds should be light (white/light gray)
2. All text should be dark (readable on light backgrounds)
3. Agent bubbles should have visible colored tints
4. Accent colors (blue, green, orange) should pop
5. Modals should have light backgrounds with proper borders
6. No dark panels floating on light backgrounds
7. Scrollbar should be visible
8. Code blocks in messages should use light syntax theme

- [ ] **Step 5: Test persistence and FOUC**

1. Set to light mode → refresh page → should stay light (no dark flash)
2. Set to dark mode → refresh page → should stay dark (no light flash)
3. Clear localStorage (`localStorage.removeItem('hatchin-theme')`) → refresh → should follow OS preference

- [ ] **Step 6: Commit final verification**

If any fixes were needed, commit them:
```bash
git add -A
git commit -m "fix(theme): polish light/dark mode visual issues"
```

---

## Summary

| Task | What | Files | Estimated Steps |
|------|------|-------|----------------|
| 1 | CSS variable foundation + FOUC + premium utilities | 3 files | 11 |
| 2 | ThemeProvider + ThemeToggle + App integration | 4 files | 8 |
| 3 | Agent role color dark: prefix merge | 1 file | 6 |
| 4 | Core layout components (CenterPanel, RightSidebar, etc.) | 5 files | 8 |
| 5 | Modal components (9 modals) | 9 files | 5 |
| 6 | Page components (Landing, Login, etc.) | 5 files | 9 |
| 7 | Remaining components (Thread, Egg, Bento, etc.) | 8 files | 10 |
| 8 | Full integration test + build verification | 0 files | 6 |

**Total: 2 new + 32 modified files across 8 tasks**
