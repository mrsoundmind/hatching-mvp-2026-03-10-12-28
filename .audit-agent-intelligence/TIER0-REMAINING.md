# Pre-Launch Hardening — Tier 0 status + remaining items

Branch `feat/v2.2-intelligence-fixes`. Nothing merged. Each fix self-reviewed + verified live before commit.

## Done (committed)

| Item | Finding | Commit | Verification |
|---|---|---|---|
| Cost brakes (rate + per-user $ cap + global kill, flag-independent) | DOS-1, DOS-2 | `cc0fb6f` | unit 9/9 + live WS block with gates OFF |
| IDOR on /api/personality/feedback (ownership + validation) | SEC1-1 | `cc0fb6f` | live HTTP 6/6 |
| Account takeover (strict provider,sub + email_verified + explicit conflict) | ACCT-1 | `cc0fb6f` | unit 6/6 |
| Hot-query cap (SQL order/limit/cursor + composite index + tiebreaker) | DOS-4, PERF-2, BUG-6 | `cc0fb6f` | live Supabase 8/8 |
| Health check probe + DB ping (503 only on infra down; Fly check on /health) | OBS-2, REL-4, INFRA-3 | `25b41e4` | live /health 200, DB ping resolves |
| Spend alarm (early warning before the kill) | OBS-6 | `319cf8f` | unit 14/14 |
| Structured error tracker + Sentry-ready hook + no 5xx leak | OBS-1, OBS-4, SECRET-2 | `32a17fb` | unit 9/9 + boot smoke |

Config knobs added: `COST_GUARD_MSGS_PER_MIN` (40), `COST_GUARD_USER_DAILY_CENTS` (500), `COST_GUARD_GLOBAL_DAILY_CENTS` (2000), `COST_GUARD_GLOBAL_WARN_CENTS` (1400), `OPS_ALERT_WEBHOOK_URL`, `MESSAGES_HARD_MAX` (500), `SENTRY_DSN` (optional). All safe defaults; tune per real traffic.

## Remaining — why each is not auto-fixed here, and exactly what to do

### 0.5 Backups (Supabase PITR) — YOUR action, ~2 minutes  ⬅ do this first
The single most important data-loss protection, and it's a dashboard toggle only you can flip.
1. Supabase Dashboard → your project → **Database → Backups**.
2. Enable **Point-In-Time Recovery** (needs the Supabase **Pro** plan, ~$25/mo, ~₹2,150). On Free you at least get daily backups.
3. Do ONE restore drill: restore to a scratch project and confirm the data comes back. A backup you've never restored is a hope, not a backup.

### 0.6 Sentry package — needs a working `npm`
The error tracker (`server/observability/errorTracker.ts`) is already wired and **auto-forwards to Sentry the moment the package + DSN exist** — no code change needed.
1. When `npm` works and `package.json` is clean: `npm i @sentry/node`.
2. Set `SENTRY_DSN` in Fly secrets: `fly secrets set SENTRY_DSN=...`.
That's it — forwarding turns on. Until then you still get structured JSON error logs.

### 0.4 Migration safety baseline — needs a staging DB + a clean `package.json`
The live schema was built with `drizzle-kit push`; `migrations/` covers only 7 of 21 tables, so a rename/removal in `schema.ts` can silently `DROP COLUMN` on the next push. Fixing this safely is delicate (you must baseline an already-populated DB) and must be rehearsed on staging, not prod. Plan:
1. On a **staging/scratch** Supabase project that mirrors prod schema: `drizzle-kit generate` to produce a full baseline migration; verify it lists all 21 tables.
2. Mark that baseline as **already-applied** on prod (record it in `__drizzle_migrations` without running the CREATEs, since the tables already exist).
3. Switch deploy from `push` to `drizzle-kit migrate` via a Fly `release_command`; freeze `push` for prod.
4. From then on, every schema change ships as a reviewed, ordered migration (expand-contract).
Blocked here by: no staging DB confirmed, `package.json` is sibling-dirty (can't add a `db:migrate` script cleanly), and local `npm` is broken.

### BUG-3 Multi-agent / safety turns don't record token cost — DEFERRED (bounded)
The per-user **dollar** cap under-counts multi-agent turns because only the single-agent path sets `llmMetadata`. It is NOT unbounded: the always-on **rate limit** counts every send (single or multi-agent) and the **global kill** bounds total recorded spend. The clean fix threads token usage through `handleStreamingColleagueResponse` (the ~1,880-line WS-fused function, audit CODE-1/ARCH-1); doing that surgery now risks breaking streaming for a bounded MEDIUM. It should ride with the **ARCH-1 orchestrator extraction** (Tier 2), where the response path is untangled and each generation's usage is capturable at one seam.

## Net
Money and data are both protected at runtime (cost brakes + spend alarm + health check + error capture). The remaining data-loss depth (PITR + migration safety) needs your Supabase action and a staging rehearsal; Sentry needs a working npm; BUG-3 rides the Tier-2 refactor. Nothing merged.
