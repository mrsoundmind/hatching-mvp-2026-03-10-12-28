---
phase: 35-production-hotfix-pass
plan: 03
status: complete
completed: 2026-05-11
verification: static-gates-passed; visual-gate-deferred-to-35-05
requirements-closed:
  - LLMUX-02
  - LLMUX-03
---

# 35-03 SUMMARY — Client toast handlers

## What shipped

Commit `55af0ea` — `feat(35-03): wire PROVIDER_DEGRADED/PROVIDER_RECOVERED toast in CenterPanel`.

Three surgical additions to `client/src/components/CenterPanel.tsx`:

| Lines | What |
|---|---|
| 61 | Extended existing `const { toast } = useToast();` → `const { toast, dismiss } = useToast();`. Single source, no `showToast`/`dismissToast` aliasing (C2 invariant). |
| 113–119 | New `degradationToastIdRef = useRef<string \| null>(null)` with inline comment explaining the eviction-aware design (TOAST_LIMIT=1 means competing toasts displace ours; the ref is for cleanup, not gating). |
| 641–650 | Inside existing `streaming_completed` branch: idempotent dismiss + clear of degradation toast (D-08 fallback — server-driven PROVIDER_RECOVERED is primary; this is robustness). |
| 1065–1093 | Two new WS dispatcher branches: `provider_degraded` ALWAYS calls `toast({ duration: Infinity, title: 'Agents are slow', description: reason \|\| 'Agents are slow right now, hang tight' })` and overwrites the ref (no ref-gating, C1 invariant); `provider_recovered` dismisses by stored id (idempotent on stale id) then unconditionally clears the ref. |

## Decisions adhered to

- **D-05** ✓ Reuse existing shadcn `useToast` — no new Banner component
- **D-06** ✓ `duration: Infinity` for persistent toast
- **D-07** ✓ Default copy "Agents are slow right now, hang tight"; server-overridable via `reason` field
- **D-08** ✓ Recovery on PROVIDER_RECOVERED (primary) + streaming_completed (fallback) — both honored
- **D-09** ✓ Non-blocking — input remains usable (Radix Toast role="status" default)

## Static verification (all green)

- `npx tsc --noEmit` — clean
- `grep -c 'useToast()' CenterPanel.tsx` → 1 (single destructure invariant)
- `grep -c 'degradationToastIdRef' CenterPanel.tsx` → 9 (1 declaration + set/dismiss sites)
- `provider_degraded` branch contains NO early-return / null-check on `degradationToastIdRef` (C1 invariant)
- Existing `streaming_completed` branch extended in place (no new dispatcher branch for that event)

## Visual verification — DEFERRED to 35-05

**Circular dependency discovered at checkpoint:** the natural way to trigger PROVIDER_DEGRADED in a running app is via `/api/dev/force-outage` — which is built in 35-05, not yet available at 35-03's checkpoint. Alternative paths (DevTools console injection, in-process recordFailure calls) don't exercise the full WS dispatcher → toast render pipeline end-to-end.

**Resolution (user-approved 2026-05-11):** mark static gates as sufficient for closing 35-03; route the visual approval into 35-05's checkpoint, where the Playwright spec will:
- Cases 3 + 4 of the spec exercise force-outage → toast appears + force-recovery → toast dismisses within 5s
- These end-to-end pass = visual verification effectively passes
- If 35-05 spec catches a visual issue, fixes loop back here

This is recorded in 35-05-PLAN.md case 3+4 acceptance.

## Files modified

- `client/src/components/CenterPanel.tsx` — +48 lines, -1 line (net +47)

## Handoff to 35-04

No handoff — 35-04 is an independent client-side plan (legal pages); no shared files with 35-03 (verified by plan-checker wave-overlap audit).

## Handoff to 35-05

- The WS dispatcher branches at lines 1065–1093 are the surface 35-05's Playwright spec verifies.
- Spec selector for the toast: `page.locator('[role="status"]').filter({ hasText: 'Agents are slow' })`.
- Recovery dismiss: `await expect(...).not.toBeVisible({ timeout: 5_000 })` after `/api/dev/force-recovery` call.
- The 5s criterion is measured from `force-recovery` POST → toast disappears.
