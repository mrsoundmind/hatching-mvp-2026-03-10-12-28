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
| pg-boss queue revival | #95 #90 #54 #166 | 1 | VERIFIED (E2E, real output) | task todo→completed with a fresh 622-char agent message in ~9s; +2 second-order bugs fixed (v10 array handler, pooler drops) | (pending commit) |
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

### Wave 1 — pg-boss autonomous execution (#95, #90, #54, #166) — IN PROGRESS

**Root cause (verified):** pg-boss v10.4.2 requires an explicit `createQueue()` before `send()`/`work()`
(breaking change from v9's auto-create). The repo had zero `createQueue` calls, so `boss.send()`
silently no-oped (its INSERT joins the queue table, which returns zero rows for a missing queue) and
the worker never received jobs. RED proof: `check-pgboss.mjs` showed `QUEUES: ["__pgboss__send-it"]`
only, `JOBS: []`. This single gap disabled ALL background autonomy (execution, handoffs, approval
cards, on-execution peer review, run tree).

**What changed:**
- `server/autonomy/execution/jobQueue.ts`: added exported constant `QUEUE_TASK_EXECUTION` (single
  source of truth for the queue name across create/send/work — a name mismatch would silently re-break
  execution) and `await _boss.createQueue(QUEUE_TASK_EXECUTION)` in `getJobQueue()` right after
  `_boss.start()`. Idempotent (`create_queue()` is `ON CONFLICT DO NOTHING`), placed in the singleton
  factory so the queue exists for ALL producers (chat trigger, backgroundRunner, handoff), not just
  the worker boot. `send()` now uses the constant.
- `server/autonomy/execution/taskExecutionPipeline.ts`: `boss.work` now uses the constant AND iterates
  the job batch — **second-order bug fixed (see below)**.

**Second-order bug discovered + fixed (masked by #95, never run before):** pg-boss v10 delivers an
ARRAY of jobs to the work handler (`WorkHandler<ReqData>` = `(jobs: Job[])`), a breaking change from
v9's single-job callback. The handler passed the array straight to `handleTaskJob`, so `job.data` was
undefined → `TypeError: Cannot read properties of undefined (reading 'projectId')` at
taskExecutionPipeline.ts:710. The `as any` cast had hidden the type mismatch. Fixed by iterating:
`for (const job of jobs) await handleTaskJob(job, deps)`. RED proof: 3/3 jobs FAILED with this exact
error (from `pgboss.job.output`). GREEN: after fix, the job reaches `completed` state.

**Third fix — DB pooler robustness (made execution actually reliable):** the Supabase Supavisor pooler
drops idle connections ("Connection terminated unexpectedly" on both the app pool and pg-boss's pool),
which failed the autonomous task's output write mid-execution (task marked complete but no message
produced). Hardened the app pool in `server/db.ts`: `keepAlive: true`, `keepAliveInitialDelayMillis`,
`idleTimeoutMillis: 30s` (recycle before the pooler kills), `connectionTimeoutMillis: 10s` (fail fast).
This is the pool `executeTask` uses for its output-message write. pg-boss's own pool errors stay
non-fatal (it reconnects + retries).

**Verification status — VERIFIED end-to-end (runtime):**
- `verify-jobqueue.ts`: queue `autonomous_task_execution` now exists; `send()` returns a real jobId
  (was silent `null`).
- Handler fix: an enqueued job transitions `created → active → completed` (was `failed` 3/3).
- `verify-execution.ts` (post-hardening): enqueued a real task → `t=3s active, t=6s active, t=9s
  task=completed msgs 41→42 job=completed` → **RESULT: NEW OUTPUT MESSAGE PRODUCED**. The message is a
  substantive 622-char on-role reply from Alex (the assigned agent). This closes the audit's #90
  ("starts but never completes, no output") and #95 (queue never created).
- Remaining: real-user browser confirmation (the UI rendering of messages/task-board/"Team is working"
  is already audit-confirmed working; the backend execution was the broken half and is now fixed).

**Files:** `server/autonomy/execution/jobQueue.ts`, `server/autonomy/execution/taskExecutionPipeline.ts`,
`server/db.ts`. Typecheck: PASS. Verification tooling: `.audit-2026-07-17/verify-jobqueue.ts`,
`enqueue-task.ts`, `verify-execution.ts`, `check-pgboss.mjs`.
