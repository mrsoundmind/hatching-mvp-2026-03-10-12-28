---
phase: 36-frozen-rubric-deliverable-iteration
plan: 03
status: complete
completed: 2026-05-13
verification: visual-approved-by-user-via-playwright-screenshots
requirements-closed:
  - RUBR-04 (per-criterion score breakdown visible in artifact panel)
  - FBK-03 (impressionCount fires once per panel mount, 5s server-side dedupe)
requirements-deferred:
  - FBK-02 UI surface (Accept/Dismiss buttons) — server persistence shipped in 36-02, UI dropped per user direction; will surface implicitly via Phase 37 run-tree if needed
---

# 36-03 SUMMARY — Client UI

## What shipped

3 atomic commits implementing the simplified Wave-3 client surface:

| Commit | Task | Files |
|---|---|---|
| `f31ba1b` | Task 1 — RubricBreakdown component | `client/src/components/deliverable/RubricBreakdown.tsx` (NEW) |
| `8a027de` | Task 2 — AutoRevertBanner component | `client/src/components/deliverable/AutoRevertBanner.tsx` (NEW) |
| `36c850a` | Task 3 — wire score chip + breakdown + AutoRevertBanner into ArtifactPanel | `client/src/components/ArtifactPanel.tsx` (MODIFIED) + label/copy fixes on the two NEW components + `tests/phase-36-screenshot.mjs` (NEW harness) |

## Architecture

```
ArtifactPanel header (left → right):
  [TYPE badge] [Title] ...gap... [Score chip 8.4★] [× Close]
                                       │
                                       │ click → setShowRubric(true)
                                       ↓
ArtifactPanel body (top → bottom):
  ┌─────────────────────────────────────┐
  │ Attribution row (existing)          │
  ├─────────────────────────────────────┤
  │ AutoRevertBanner (conditional —     │
  │   shows when iterate returned       │
  │   reverted: true; dismissible)      │
  ├─────────────────────────────────────┤
  │ RubricBreakdown (conditional —      │
  │   shows when showRubric is true;    │
  │   header: "Why this scored 8.4/10") │
  ├─────────────────────────────────────┤
  │ Markdown content (existing)         │
  ├─────────────────────────────────────┤
  │ Refine / Copy / PDF / .md footer    │
  │   (existing, with new data-testids) │
  └─────────────────────────────────────┘
```

## Decisions adhered to

- **D-13 (auto-revert banner is inline non-blocking)** ✓ AutoRevertBanner uses Framer slide-down; never a toast, never a modal.
- **D-14 (banner copy + diff drawer)** ✓ "Refinement made it worse, kept previous version. The new draft scored X / 10 vs Y / 10." + expandable "See what changed" + × dismiss.
- **D-15 (banner dismissal not persisted)** ✓ Per-mount only; reappears on next revert.
- **D-16 (rubric toggle local state)** ✓ `useState(false)`, no server persistence.
- **D-20 (impression dedupe)** ✓ Single useEffect with `[deliverableId]` deps; server-side 5s dedupe absorbs StrictMode double-fire.

## Decisions revised mid-execution (2026-05-13)

User feedback during visual checkpoint led to two simplifications:

1. **Dropped Accept/Dismiss UI (FBK-02 UI surface).** Reason: "thumbs up/down adds UI weight for explicit feedback most users won't give; the agent learns enough from score history + impressions + edits." Server endpoints remain (Wave 2 already shipped); UI surface deferred. FBK-04 phrasing in 36-04 will switch from "X accepted, Y dismissed" to score-based phrasing.

2. **Replaced FileSpreadsheet rubric-toggle with a color-coded score chip.** Reason: "the file-spreadsheet icon has no meaning, and 'rubric' is jargon the general audience won't know." Score chip shows the actual numeric score (8.4) color-coded by quality (green ≥7, blue 5-6.9, orange <5), serves as both indicator AND toggle. One element doing two jobs.

3. **Removed the word "rubric" from all user-facing UI.** RubricBreakdown inner header: "Rubric score" → "Why this scored 8.4 / 10". AutoRevertBanner: "Rubric scored the new draft…" → "The new draft scored…". Internal code still uses the term (it's the correct technical name for a scoring system); no user encounters it.

Net effect on UI: where the wireframe v1 had THREE new header buttons (Accept/Dismiss/Rubric-toggle), the shipped version has ONE (Score chip). Everything else (Breakdown card, AutoRevertBanner, useEffects, data-testids) is unchanged.

## Visual verification — APPROVED

User reviewed via Playwright screenshot capture session (2026-05-13):

**3 states verified end-to-end:**
1. **Default** — PRD opened, no breakdown expanded. Green `8.4 ★` chip visible in header (top right), Close (×) to its right. No other new elements. Refine/Copy/PDF/.md footer unchanged. (`/tmp/36-03-screenshot-1-default.png`)
2. **Breakdown expanded** — Same chip, now in active state. Breakdown card appears between attribution row and content: "Why this scored 8.4 / 10" header + 5 criterion rows (Problem Clarity 9, Solution Specificity 8, Success Metrics 9, Risk Coverage 7, User Story Quality 9). (`/tmp/36-03-screenshot-2-accepted.png`)
3. **Auto-revert** — Green chip still 8.4 (kept version's score). Amber banner above content: "Refinement made it worse, kept previous version. The new draft scored 5.2 / 10 vs 8.4 / 10. The earlier version is still active." + See what changed + × dismiss. (`/tmp/36-03-screenshot-3-revert.png`)

**One screenshot-harness issue caught + fixed mid-capture:**
- First capture pass showed the WelcomeModal overlay covering the panel because the fresh MemStorage instance had no `hasCompletedOnboarding` flag. Fixed by adding a `page.addInitScript` Proxy that returns `'true'` for any `hasCompletedOnboarding:*` key. Reproducible.

## Verification results

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS (5.29s, only pre-existing chunk-size warning) |
| 3 Playwright screenshots captured against live dev server | PASS (all 3 written to /tmp, user-approved) |
| `grep -c "Rubric\|rubric" client/src/components/ArtifactPanel.tsx` | 0 (no jargon in panel) |
| `grep -c "ThumbsUp\|ThumbsDown\|FileSpreadsheet" client/src/components/ArtifactPanel.tsx` | 0 (dropped imports clean) |
| `grep -c "data-testid=\"score-chip\"" client/src/components/ArtifactPanel.tsx` | 1 (new chip has stable selector) |

## Handoff to 36-04

**Agent prompt feedback signal (FBK-04) — phrasing change required:**
36-04 was originally specified to inject "Your last N PRDs: X accepted, Y dismissed" into agent prompts. Since Accept/Dismiss UI is dropped, the signal switches to a score-and-edit-based phrasing:

> "Your last 4 Product Requirements Documents averaged 7.8 / 10, with 1.5 refinement cycles each. Most-improved: PRD scored 6.1 → 8.4 over 3 iterations."

This still uses data the server collects (rubricScore on every version, editsCount on every deliverable, impressionCount) — no schema changes. Aggregator query in 36-04 Task 1 (`deliverableFeedbackAggregator.ts`) gets revised to compute averages + iteration counts instead of accept/dismiss counts.

**Playwright spec (36-04 Task 5) — selector update:**
The spec was originally written assuming Accept/Dismiss buttons exist. Drop case 4 and case 5 (Accept persistence, Dismiss persistence — no UI surface to test). Keep cases 1 (rubric persistence), 2 (neutral keep), 3 (adversarial revert), 6 (impression count) — those are still relevant. Net: 6 cases → 4 cases.

## Files

**New:**
- `client/src/components/deliverable/RubricBreakdown.tsx` (~120 lines after label fix)
- `client/src/components/deliverable/AutoRevertBanner.tsx` (~130 lines after copy fix)
- `tests/phase-36-screenshot.mjs` (~250 lines — Playwright harness for visual checkpoint, kept for re-runs)

**Modified:**
- `client/src/components/ArtifactPanel.tsx` (added 2 useEffects, score chip, 3 data-testids, RubricBreakdown + AutoRevertBanner mounts; removed Accept/Dismiss mutations + buttons + imports)

**User-WIP files (untouched):** `client/src/components/ProjectTree.tsx`, `eval/trendline.json`, `package-lock.json`
