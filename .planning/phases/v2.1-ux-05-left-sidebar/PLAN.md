# Phase 5 (v2.1-UX) — Left Sidebar

> Milestone-relative phase (v2.1-UX tracks phases as ROADMAP prose, not the global `NN-` dir scheme).
> Spec: `.audit-agent-intelligence/`-adjacent left-sidebar audit (pasted by user 2026-08-01).

## Cross-verification (done 2026-08-01, live + code)

6 of 8 findings valid. **2 rejected:** P1-B (folder icons already align — live left-edges all 61px, a
reserved `w-4` chevron slot exists at ProjectTree.tsx:362) and P1-D's "36 vs 53px row-height"
sub-claim (rows are uniform 36px live; the 53 was `premium-divider` spacing). Do NOT "fix" those.

No functional defects — every action (select, expand, search, create, rename, delete, undo, account,
sign-out) verified working. This is presentation + accessibility only.

## Fixes (each its own commit, verified live)

1. **P0-B (highest value)** — render `project.emoji` (schema default 🚀, never shown) as the row glyph,
   fallback to the colored `<Folder>` only when absent; normalize the icon box. `ProjectTree.tsx:379`.
2. **P0-A** — replace the `<div onClick>` settings trigger + hand-rolled menu with the shadcn Radix
   `DropdownMenu` (exists in `ui/dropdown-menu.tsx`): keyboard-operable, `aria-haspopup`, Esc to close.
   `LeftSidebar.tsx:515-550`.
3. **P0-C** — keyboard-operable project tree: roving `tabIndex` (selected row 0, others -1) + Enter/Space
   select, ArrowRight/Left expand/collapse, ArrowUp/Down move focus. `ProjectTree.tsx:354`.
4. **P1-A** — `truncate` → `line-clamp-2` on project names (`:393`); shorten the search placeholder so it
   fits (`LeftSidebar.tsx:558`).
5. **P1-C** — kebab reachable on touch: keep `opacity-0 group-hover:opacity-100` for fine pointers, add
   `[@media(pointer:coarse)]:opacity-70` + `focus-visible:opacity-100`. `ProjectTree.tsx:402`.
6. **P1-D** — `transition-all` → `transition-[background-color,box-shadow]` on the row containers;
   give "+ New" a 44px hit area (`hit-target`). `ProjectTree.tsx:355` (+ sibling rows), `LeftSidebar.tsx:579`.
7. **P2-A** — count pill per project row (non-special agent count, e.g. "3"), reinforcing the emoji + name
   identity. Data: `agents.filter(a => a.projectId === id && !a.isSpecialAgent)`.

## Standing rules

Additive color only (navy/blue frozen, orange kept). Self-documenting. Verify in runtime on
`localhost:5001`. One atomic commit per fix. Path-disjoint from the parallel v2.2/Phase 39 server work
(this is `client/src` only). UI-change protocol: show current state + mockup, get approval before editing.

## Do NOT touch (fine per audit + cross-verify)

Type scale (13px floor respected), kebab tap area (already 44px via `hit-target`), the hover effect
itself, folder alignment (already aligned), all features. P1-B and the P1-D row-height claim are wrong.
