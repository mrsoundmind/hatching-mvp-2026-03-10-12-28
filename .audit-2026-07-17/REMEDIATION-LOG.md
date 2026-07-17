# Hatchin Audit Remediation — Living Log

**Started:** 2026-07-17
**Branch:** `fix/audit-remediation-2026-07-17` (off `wip/pre-reset-2026-04-28`)
**Plan:** `~/.claude/plans/so-what-i-wanted-optimized-sprout.md` (approved)
**Source audit:** `.audit-2026-07-17/` (AUDIT-REPORT.md, findings.md 166 entries, COVERAGE-MAP.md)

This log is updated after EVERY fix is verified working, one entry per fix. It is the source of truth
for what was done and why. No dashes; money shown USD + INR (~₹86 per $1, India prices local).

## Conventions
- **Order:** strict dependency (root causes first). Waves 0 to 5.
- **Per fix:** RED test first (must fail) → surgical GREEN fix → runtime-verify as a real user
  (real pointer clicks/taps, desktop + mobile) → regression gates green → atomic commit → this log.
- **UI changes:** current-state screenshot + new-state screenshot + explicit approval BEFORE commit.
- **Status:** PENDING · RED (repro written, failing) · FIXING · VERIFIED (live, real-user) · DEFERRED.

## Baseline (Wave 0, 2026-07-17)
- `npx tsc --noEmit`: PASS (exit 0) — tree compiles clean; any later type error is ours.
- Dev server: live on :5001 (PID 37087, pre-existing, not owned by this session).
- pg-boss installed: 10.4.2 (confirms #95 v10 createQueue requirement).
- Full LLM gate baseline (`qa:autonomy`): TBD (run per-wave to control token cost).

## Summary table

| Fix | Finding(s) | Wave | Status | Outcome | Commit |
|---|---|---|---|---|---|
| pg-boss queue revival | #95 #90 #54 #166 | 1 | PENDING | — | — |
| Multi-agent empty-save | #74 #98 #111 | 2 | PENDING | — | — |
| Project-scope @mention guard | #97 #145 | 2 | PENDING | — | — |
| Knowledge grounding + honesty | #79 #144 | 3 | PENDING | — | — |
| Brain auto-fill + coreDirection visible | #104 #105 #158 | 3 | PENDING | — | — |
| Event metadata (name/label/avatar) | #102 #110 #81 | 4 | PENDING | — | — |
| Feed default filter | #80 #107 | 4 | PENDING | — | — |
| Phantom cross-project activity leak | #165 | 4 | PENDING | — | — |
| /maya route crash | #149 | 5 | PENDING | — | — |
| Safety reason-code leak | #43 | 5 | PENDING | — | — |
| /onboarding route 404 | #130 | 5 | PENDING | — | — |
| Dead Light Mode toggle | #114 | 5 | PENDING | — | — |
| Off-screen toast | #96 | 5 | PENDING | — | — |
| UpgradeModal invisible paywall | #160 | 5 | PENDING | — | — |
| Autonomy dial no Pro gate | #161 | 5 | PENDING | — | — |
| Starter-pack role-twice naming | #153 | 5 | PENDING | — | — |
| Long tail (auto-revert, verb inconsistencies, corrupt-PDF, Manage Subscription, landing links) | #126 #60 #87 #88 #37 #136 #65 | 5 | PENDING | — | — |
| Vanishing messages (re-repro first) | #22 | 0 | PENDING | needs fresh repro | — |
| @/slash autocomplete | #94 #139 | — | DEFERRED | net-new feature → Phase 47 backlog | — |
| a11y button labels | #112 | — | DEFERRED | a11y sweep → Phase 47 backlog | — |

---

## Detailed entries

_(appended per fix as each is verified working)_
