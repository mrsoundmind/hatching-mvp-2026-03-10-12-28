# Phase 4 (v2.1-UX) — Brain Tab Information Architecture

> Milestone-relative phase. v2.1-UX tracks phases as ROADMAP prose + verified commits, not the global
> `NN-slug` directory scheme (`04` and `39` are already taken by other milestones). This directory holds
> the plan and verification artifacts only.

## Authoritative spec

`.audit-ux-2026-07-20/BRAIN-TAB-FINDINGS.md` — a live functional audit. It already contains, per finding:
what, why, the VERIFY grep, current state, the fix, and how to verify after. Do not re-derive it.

## Cross-verification (done 2026-07-31, against live code)

6 of 8 findings fully valid and unfixed; 2 partially overtaken by Phase 0. See ROADMAP.md v2.1-UX
block "Phase 4" for the per-finding verdict with line anchors.

| Finding | Verdict |
|---|---|
| P0-A mislabeled Packages widget wears "Project Knowledge Base" name | CONFIRMED (`BrainDocsTab.tsx:107-113`) |
| P0-B duplicate section names | CONFIRMED (108 + 131) |
| P1-A real KB buried last | CONFIRMED |
| P1-B double Autonomy header | CONFIRMED (`BrainDocsTab.tsx:99` + `AutonomySettingsPanel.tsx:122-124`) |
| P1-C "Untitled Document" default | CONFIRMED (`server/routes/projects.ts:286`) |
| P2-A no count pills | CONFIRMED |
| P1-D "63% at 11px" | STALE — type migration already ran; reframe to header-hierarchy only |
| P1-E "9/10 fail 44px" | PARTIAL — touch is 44px; desktop `lg:` still 34/32px |

## Execution (4 atomic commits, per audit §3)

1. **P0-A + P0-B** — rename the Packages divider to "Packages", give it a real empty state, kill the
   duplicate "Knowledge Base" name.
2. **P1-A + P1-B** — reorder Knowledge Base up (lead with what the user came for); collapse the double
   Autonomy header into one.
3. **P1-C** — real document titles; never render "Untitled Document" (derive from filename / first line).
4. **P1-D + P1-E + P2-A** — header hierarchy (within the app-wide `text-micro` uppercase-label
   convention, no divergence), close the desktop 44px hit-area gap, add count/state pills to headers.

## Standing rules

Additive color only (navy/blue frozen, orange kept). Self-documenting (verbs + names, count pills not
bare numbers, no mid-word truncation). Verify in runtime on `localhost:5001` after each change. One
atomic commit per fix. Path-disjoint from the parallel v2.2/Mattermost server work on this branch.
UI-change approval protocol applies: show current state + get approval before editing `client/src/`.

## Do NOT touch (verified working live)

`DocumentUploadZone.tsx`, the delete fetch (`BrainDocsTab.tsx:47`), the autonomy PATCH
(`AutonomySettingsPanel.tsx`), the adherence injection (`openaiService.ts`). All sound.
