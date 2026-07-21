---
phase: 37-git-style-run-tree
plan: 03
status: complete
completed: 2026-05-14
verification: visual-approved-by-user-via-playwright-screenshots
requirements-closed:
  - TREE-03 (Activity-tab sidebar visualizes the run tree per project — collapsible nodes with semantic-word badges)
  - TREE-04 (Clicking a step node opens the deliverable version it produced via pendingVersionNumber wiring)
---

# 37-03 SUMMARY — Client UI (verb-led clarity pass)

## What shipped

3 atomic commits + 1 mid-checkpoint clarity refinement:

| Commit | Task | Files |
|---|---|---|
| `dbe7fb6` | Task 1 — score-format helper + run-tree hook + view-mode toggle | `shared/scoreFormat.ts` (NEW), `client/src/hooks/useAutonomyRunTree.ts` (NEW), `client/src/components/sidebar/ActivityViewModeToggle.tsx` (NEW) |
| `a568851` | Task 2 — recursive tree renderer | `client/src/components/sidebar/RunTreeView.tsx` (NEW), `client/src/components/sidebar/RunTreeNode.tsx` (NEW) |
| `14951be` | Tasks 3 + 4 + clarity pass (single visual-approved commit) | `client/src/components/sidebar/ActivityTab.tsx`, `client/src/components/sidebar/RunTreeView.tsx`, `client/src/components/sidebar/RunTreeNode.tsx`, `client/src/components/ArtifactPanel.tsx`, `client/src/pages/home.tsx`, `shared/scoreFormat.ts`, `tests/phase-37-screenshot.mjs` (NEW) |

## Architecture

```
Right sidebar Activity tab
  ├─ Live Activity header (existing)
  ├─ [Flat] [Tree] toggle (NEW — ActivityViewModeToggle)
  │      └─ persists per-project: localStorage['activityViewMode:${projectId}']
  ├─ Stats summary card (existing)
  ├─ Pending approvals (existing, when present)
  └─ Conditional body:
       ├─ Flat mode → existing ActivityFeedItem list (unchanged)
       └─ Tree mode → RunTreeView
             └─ useAutonomyRunTree hook (TanStack 30s polling +
                 task_completed/chain_completed WS invalidation)
             ├─ Empty state: "No autonomous runs yet" card
             └─ Run cards (collapsible per useEffect-once defaults):
                  ├─ Header:
                  │    chevron + 2-line title + agent chain ("Alex → Cass")
                  │    + semantic-word badge (✓ Improved / ⚠ Made worse / In progress)
                  └─ Body when expanded:
                       └─ RunTreeNode tree (recursive, 16px-per-gen indent)
                             • verb-led description: "<Agent> <verb> <title>"
                             • verbs: worked on / handed off / reviewed /
                                      deliberated on / paused (safety check) /
                                      requested approval for
                             • semantic-word delta pill: ✓ Better / ⚠ Worse / New
                             • click step with deliverableId →
                                   dispatch 'open_deliverable'
                                   with { deliverableId, versionNumber }
                                   (W-4 wiring)

ArtifactPanel
  ├─ pendingVersionNumber prop (NEW)
  └─ useEffect on mount + on prop change:
       if pendingVersionNumber set and versions loaded,
       call restoreMutation.mutate(pendingVersionNumber)
       → panel opens to the EXACT version the clicked step produced
       (not the default most-recent)

home.tsx
  └─ open_deliverable handler now accepts optional detail.versionNumber
       → captures into pendingVersionNumber state
       → passes prop to ArtifactPanel
       → clears on panel close
       (backward compatible — existing dispatchers from chat /
        package progress / brain docs tab unchanged)
```

## Decisions adhered to

- **D-10/11 (view-mode toggle inside Activity tab):** Not a new tab. Persisted per-project.
- **D-12 (RunTreeNode visual contract):** Indent 16px per generation, max depth 3 before "···N more" collapse, avatar palette deterministic from agent name.
- **D-13 (click step → open deliverable):** dispatches existing `open_deliverable` event with W-4 versionNumber field added.
- **D-14 (empty state copy):** "No autonomous runs yet. Once a Hatch starts working on a task in the background, you'll see the run tree here."
- **D-15 (versionNumber pinning):** ArtifactPanel auto-clicks version navigator via existing restoreMutation when prop set.
- **D-18 (flatHistorical hint):** Run cards with `metadata.flatHistorical = true` carry 0.85 opacity + "imported flat from history" inline note.
- **D-21 (30s polling, not WS streaming):** useAutonomyRunTree uses TanStack refetchInterval; WS task_completed / chain_completed invalidates.

## Decisions revised mid-execution (2026-05-14 clarity pass)

Per user feedback during visual checkpoint: *"Whole goal is to make sure everything we show is easily understandable by a user. They don't have to figure it out."* — three concrete redesigns applied before commit:

1. **Aggregate run badge: number → semantic word.** Before: `+1.4` (decode-it-yourself number). After: `✓ Improved` (green pill) / `⚠ Made worse` (amber pill) / `In progress` (muted pill). The raw signed number is preserved in the button's `title` attribute as a hover tooltip — interpretation-free for first-time readers, full precision available for the curious.

2. **Step rows: dropped abstract icons + verb-led description.** Before: `⏱ [A] Alex PM Draft the launch a...` — required the user to learn the step-type icon legend. After: `Alex worked on Draft the launch announcement copy` — the verb (`worked on` / `handed off` / `reviewed` / `deliberated on` / `paused (safety check)` / `requested approval for`) tells the user what type of step it is AND what happened. Avatar still visible for agent identity.

3. **Title truncation: mid-word → 2-line clamp.** Before: `Draft the launch ann...` cut off at sidebar width. After: `Draft the launch announcement an...` wraps to 2 lines via `-webkit-line-clamp: 2`. Users see the full goal without hover or expand.

4. **Step delta badges: number → semantic word.** Same principle as #1 at step level. `+0.6` → `✓ Better` (green pill), `-0.8` → `⚠ Worse` (amber pill), null → `New` (muted pill).

5. **"3 steps" → agent chain "Alex → Cass":** the actual narrative of who worked, not an abstract count. Deduplicates adjacent same-agent steps so `A → A → C` reads as `A → C`. Caps at 4 agents with `…` overflow.

Memory rule saved this session: `feedback_ui_self_documenting.md` — applies to all future Hatchin UI phases. The principle is now durable across sessions.

## Visual verification — APPROVED

User reviewed 3 Playwright screenshots captured against live dev server (`STORAGE_MODE=memory npm run dev`):

1. **`/tmp/37-03-screenshot-1-flat.png`** — Default Flat mode. Toggle visible. Existing UI preserved. **APPROVED.**
2. **`/tmp/37-03-screenshot-2-tree.png`** — Tree mode with 1 seeded 3-step run. Run card reads as a sentence: title wraps cleanly, agent chain "Alex → Cass" tells the story, "✓ Improved" badge in green. Each step row reads verb-led: "Alex worked on…", "Alex handed off…", "Cass worked on…" with "✓ Better" pills on improved steps. **APPROVED.**
3. **`/tmp/37-03-screenshot-3-empty.png`** — Tree mode, zero runs. Empty card with "No autonomous runs yet" + plain-English helper copy. **APPROVED.**

## Verification results

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS |
| 3 Playwright screenshots captured | PASS (all 3 written to /tmp, user-approved) |
| `grep -c "ThumbsUp\|ThumbsDown\|stepTypeIcons" client/src/components/sidebar/RunTreeNode.tsx` | 0 (icons removed cleanly) |
| `grep -c "formatScoreDeltaWord" shared/scoreFormat.ts` | 1+ (semantic-word helper added) |
| `grep -c "verb" client/src/components/sidebar/RunTreeNode.tsx` | 2+ (verb-led pattern in place) |
| User-WIP files (ProjectTree.tsx, package-lock.json, eval/trendline.json) | UNTOUCHED |

## Handoff to 37-04

**Playwright spec selectors:** the 3 screenshots used these data-testids — Phase 37 Playwright spec in 37-04 should reuse them:
- `[data-testid="run-tree-toggle"]` → view-mode toggle root
- `[data-testid="run-tree-view"]` → tree container
- `[data-testid="run-card-{runId}"]` → individual run card
- `[data-testid="run-tree-step-{stepId}"]` → individual step button

**Score-delta assertions:** Phase 37 Playwright spec case 3 (score-delta variants) should now assert the **word** text content, not the signed-number text. Examples: `await expect(badge).toContainText('Better')`, `await expect(badge).toContainText('Worse')`, `await expect(badge).toContainText('New')` instead of `toContainText('+0.6')` / `toContainText('-0.8')`. Raw numeric values still available via the button `title` attribute if a future spec wants to assert precision.

**Backfill UI (D-18):** the `flatHistorical = true` metadata flag is read by RunTreeView and renders the "imported flat from history" inline note. 37-04's backfill script should set this on every backfilled run row.

## Files

**New:**
- `client/src/hooks/useAutonomyRunTree.ts` (~90 lines)
- `client/src/components/sidebar/ActivityViewModeToggle.tsx` (~50 lines)
- `client/src/components/sidebar/RunTreeView.tsx` (~250 lines after clarity pass)
- `client/src/components/sidebar/RunTreeNode.tsx` (~140 lines after clarity pass)
- `shared/scoreFormat.ts` (~75 lines after `formatScoreDeltaWord` added)
- `tests/phase-37-screenshot.mjs` (~280 lines — Playwright screenshot harness)

**Modified:**
- `client/src/components/sidebar/ActivityTab.tsx` (+15 lines: view-mode state, conditional render)
- `client/src/components/ArtifactPanel.tsx` (+15 lines: pendingVersionNumber prop + auto-navigate useEffect)
- `client/src/pages/home.tsx` (+10 lines: open_deliverable handler accepts versionNumber, prop passthrough)

**User-WIP files (untouched):** `client/src/components/ProjectTree.tsx`, `eval/trendline.json`, `package-lock.json`
