# Hatchin — Go-Live Readiness Review (Full 360°)

**What this is:** the complete pre-production audit a mature org runs before a launch sign-off — **13 domains**
(6 security + 7 engineering pillars), each audited read-only against the live code on
`feat/v2.2-intelligence-fixes`, `file:line` evidence, severity-ranked. **Static analysis only** — no live
pen-test/DAST/load-test; nothing was modified. **Date:** 2026-08-01.

---

## OVERALL VERDICT: 🔴 NOT READY FOR PUBLIC TRAFFIC — but the gaps are operational, not a rewrite

The single most important framing: **there is no breach-class hole and no architectural dead-end.** Tenant
isolation, auth, XSS/SQLi/SSRF, and the autonomy blast-radius are genuinely solid, and the *code* is
healthier than average for an MVP (strict types actually enforced, clean provider/role seams, hardened DB
pool). What's missing is the **operational shell a real product needs**: the cost brakes are off, the deploy
can silently drop user data, and if it breaks at 2am you're blind. Those are days-of-work fixes, not months.

### Scorecard (13 domains)

| # | Domain | Verdict | Worst issue |
|---|---|---|---|
| **Security** | | | |
| S1 | Auth & Tenant Isolation | 🟠 GO-WITH-FIXES | IDOR write on `/api/personality/feedback` |
| S2 | Injection & Input Validation | 🟠 GO-WITH-FIXES | LLM action-blocks → DB writes (tenant-bounded); XSS/SQLi/SSRF **closed** |
| S3 | Secrets & Config | 🟠 GO-WITH-FIXES | response bodies logged to prod console; no hardcoded secrets/bundle leak |
| S4 | Dependencies | 🟠 GO-WITH-FIXES | `ws`→≥8.21, `multer`→≥2.2; lockfile clean |
| S5 | **DoS / Cost** | 🔴 **NO-GO** | **no prod cost cap + WS path unthrottled → unbounded LLM spend** |
| S6 | Autonomy / Business-Logic | 🟠 GO-WITH-FIXES | fail-open judge + shallow scorer; **no destructive code path (good)** |
| **Engineering** | | | |
| A | Code Health | 🟡 NEEDS-WORK | `chat.ts` = one 3,438-line function; lint is a no-op |
| B | Reliability | 🟡 NEEDS-WORK | DeepSeek no timeout/cancel; pg-boss retry double-charges |
| C | **Observability** | 🔴 **FLYING-BLIND** | **no error tracking, no metrics, no alerting; Fly never polls /health** |
| D | **Testing / CI-CD** | 🔴 **THIN-NET** | **no CI; `qa:full` runs zero tests; unversioned `db:push` deploy** |
| E | Performance | 🟡 WILL-DEGRADE | full-history read + N+1 on the two hottest paths |
| F | **Data / DR** | 🔴 **AT-RISK** | **`db:push` deploy; migrations cover 7/21 tables; no backup/restore** |
| G | Architecture | 🟡 NEEDS-REFACTOR | WS-fused 1,880-line orchestrator blocks non-WS features |

**4 red domains** (DoS/Cost, Observability, Testing, Data/DR) — none is a code-security breach; all four are
"you can't safely *operate or evolve* this yet."

---

## TIER 0 — Hard blockers (do NOT take public traffic until these are closed)

These cause **unbounded cost, permanent data loss, an unauthorized write, or total operational blindness.**

1. **Turn cost brakes ON + enforce a real dollar cap before each LLM call.** `FEATURE_BILLING_GATES` defaults OFF; cost is recorded *after* the call, never checked before; the only "cap" is a per-project call count. → unbounded spend on your keys. `middleware/tierGate.ts:8-11`, `policies.ts:60-61`, `billing/usageTracker.ts:32`. *(S5, C, F-adjacent)*
2. **Rate-limit the WebSocket message path** (Express limiters are HTTP-only) + gate `/api/deliverables/*` and `/api/packages`. One authed user loops `send_message_streaming` → unbounded spend + event-loop DoS. `chat.ts:532-1160`, `deliverables.ts:215-471`. *(S5)*
3. **Fix migration discipline before any schema change ships.** Deploy = `drizzle-kit push` diffing `schema.ts` to live; `migrations/` describes only **7 of 21 tables**. A rename/removal silently `DROP COLUMN`s user data, and the source can't rebuild the DB. Generate a baseline migration, switch to `drizzle-kit migrate` in a Fly `release_command`, staging-first. `package.json:13`, `migrations/`. *(F, D)*
4. **Backups + one tested restore.** No PITR/dump/restore story anywhere; the last (Neon→Supabase) migration already lost all history. Enable Supabase PITR or scheduled `pg_dump`, do one real restore drill. *(F)*
5. **Fix the IDOR write.** `POST /api/personality/feedback` mutates any user's agent with no ownership check + no Zod. Add the ownership check (mirror the sibling routes) + a Zod schema. `routes.ts:381-441`. *(S1, D)*
6. **Wire error tracking + a Fly health probe.** No Sentry/equivalent (prod errors die in stdout, and `min_machines_running=0` means they're often gone); Fly never polls the good `/api/health` handler, so a wedged instance stays in rotation. Add Sentry on Express + the process handlers; add a `[[http_service.checks]]` probe that 503s on `down`. `index.ts:282,449`, `fly.toml`, `health.ts`. *(C, B, D)*
7. **One aggregate daily-spend alarm with a hard ceiling.** Distinct from #1's per-user cap: a global kill + a page so a spend spike can't run overnight undetected. *(C, S5)*
8. **Cap the hottest query.** `getMessagesByConversation` reads the *entire* conversation into memory (no SQL LIMIT) and is called unbounded on every message send — both a scale cliff and a memory-DoS lever. Push `ORDER BY created_at DESC LIMIT n` + keyset cursor into SQL, add a `messages(conversation_id, created_at)` composite index. `storage.ts:2219`, `chat.ts:2129`. *(E, S5)*

---

## TIER 1 — Fast-follow (first week; before marketing / real scale)

- **Deps:** bump `ws`→≥8.21 (WS DoS + mem disclosure, non-breaking) and `multer`→≥2.2, same PR. *(S4)*
- **DeepSeek timeout + cancellation:** primary LLM has no per-call timeout (10-min hang possible) and ignores cancel (cancelled turns still billed). Mirror Gemini's `composeAbortSignal`. `deepseekProvider.ts`. *(B)*
- **pg-boss idempotent retry:** guard `handleTaskJob` on `task.status==='completed'` and wrap the post-execution tail — currently a retry double-charges the cap and posts a duplicate message (compounds on every deploy). `jobQueue.ts:99`, `taskExecutionPipeline.ts`. *(B)*
- **A real merge/deploy gate:** `qa:full` runs *zero* tests and there's **no CI**. Add GitHub Actions running the mock-safe unit/gate suites + a Playwright smoke on PR, required-to-merge; add an authz-IDOR test. 109 of 134 test scripts are orphaned — wire the budget + approval + peer-review suites. *(D)*
- **Metrics + ops alerting:** a `/metrics` (or `/api/admin/stats`) surface for spend/queue-depth/WS/error-rate; alerts for provider-all-down and queue-stall. *(C)*
- **CSRF exemption path bug:** the exemptions never match (mounted-path prefix), so in prod the **Stripe webhook is 403'd** and paid upgrades silently fail. `index.ts:187-211`. *(S1)*
- **Action-block hardening:** re-validate parsed LLM action payloads with Zod, allow-list the `brain.field` key, require real consent (not a fuzzy keyword). `chat.ts:2411-2555`. *(S2)*
- **Autonomy backstop:** make a *missing* judge verdict a soft-block (not fail-open) for outward/factual content; broaden the destructive-verb scorer and score the output, not just the task. *(S6)* — bounded today (no destructive path) but fix before wiring any real tool.
- **The other N+1s:** scope `GET /api/projects|agents|teams` to `*ByUserId` (they full-scan every tenant's table on page load — perf *and* data-scoping), and hoist the agent-memory read out of the per-agent loop. `projects.ts:80`, `chat.ts:1475`. *(E)*
- **Response-body logging + generic 500s** in prod. `index.ts:237-287`. *(S3)*
- **WS hardening:** set `maxPayload`, cap connections per user, add ping/pong reaping. *(S5, B)*
- **Graceful shutdown:** drain WS + pg-boss on SIGTERM so a Fly deploy doesn't kill/duplicate in-flight work. *(B)*

---

## TIER 2 — The "Fortune 500" maturity roadmap (weeks, not launch-gating)

- **Refactor the WS-fused orchestrator** (`chat.ts` `handleStreamingColleagueResponse`, 1,880 lines) into a transport-agnostic `respondToMessage()` emitting typed events — unblocks Mattermost Release 2 / mobile / HTTP, kills the chat-vs-autonomy dual-path drift, and shrinks the blast radius of every chat change. *(G, A)*
- **Install a real linter** (ESLint + `@typescript-eslint` + `react-hooks`) — today it's a no-op alias; ratchet down the ~538 `any` escapes starting in `storage.ts`. *(A)*
- **Right-to-erasure (GDPR/CCPA):** build an ordered `deleteUser` — the privacy policy promises deletion the product can't perform; PII survives in `users`/Stripe/reactions. Fix `purgeProject`'s FK-violation infinite-loop too. *(F)*
- **Data residency:** enforce the per-tenant LLM routing override before onboarding EU/regulated users (default path sends chat/brain to China-hosted DeepSeek). *(F)*
- **Structured logging + distributed tracing** (pino + a request/WS correlation id + OTel spans across WS→LLM→DB). *(C)*
- **Per-project feature-flag service** so risky behavior (the judge, coverage gate) can ship dark / be killed without a redeploy. *(G, D)*
- **Frontend:** `React.memo` message bubbles + virtualize the list (re-render storm on stream), route-level code-splitting so logged-out visitors don't download framer-motion + highlight.js. *(E)*
- **Pool tuning:** app pool `max:10` is shared with the session store; raise it + give the session store its own pool. *(E)*
- **Collapse the "add a deliverable type / first-class role" shotguns** into single-source registries; split the 90-method `IStorage` into domain repositories; drop MemStorage drift via a shared contract test. *(G, A)*
- **Delete dead code** (`LandingPage.bento-backup.tsx` 1,244 lines, `runTreeBackfill.ts`); migrate the 41 raw `pool.query` calls to Drizzle; move the 12 `useEffect+fetch` to TanStack Query. *(A)*
- **Commission a live pen-test / DAST + a load test** against staging — this audit was static.

---

## What's genuinely strong (don't lose it in the fix rush)
- **No breach-class security hole:** tenant isolation enforced everywhere (one route excepted), WS authenticated + ownership-checked per message, OAuth state/nonce/PKCE + session regen, raw-HTML XSS unreachable, all SQL parameterized, no user-URL fetch (no SSRF), no hardcoded secrets, no client-bundle leak.
- **Autonomy is safe by construction:** no code path to delete/deploy/run-code; cross-tenant approval blocked; runaway loops structurally impossible; atomic race-free budget ledger.
- **Types are real:** strict mode enforced, typecheck clean, zero `@ts-ignore`.
- **The infra that was firefought is now solid:** pg-boss wedge watchdog, Supavisor-hardened pool, trace-store transactions, Stripe webhook idempotency, WS idempotency + ordering guards.
- **Clean extension seams exist:** LLM provider registry, the 2-array role model, pure `shared/` boundary, the autonomy pipeline's injected-generator DI — proof the team *can* build extensibly.
- **Money is modeled correctly** (integer cents), uniqueness constraints where they matter, honest privacy disclosure.

---

## Honest bottom line
This is a **strong MVP with a thin operational shell**, not a shaky codebase. You are **not** one bug away from
a data breach — you're several days away from being able to *safely run and pay for* a public launch. Close
**Tier 0** (cost cap + WS limit, migration safety + backup, the IDOR, error-tracking + health-probe, the
hot-query cap) and you can open the doors to a controlled/beta audience. **Tier 1** hardens it for a real
push; **Tier 2** is the multi-week climb toward the enterprise bar you asked about — led by extracting that
WebSocket-fused orchestrator, which is the one refactor that pays off across features, reliability, and testability.

*13 parallel read-only auditors (auth, injection, secrets, deps, DoS, autonomy · code-health, reliability,
observability, testing, performance, data/DR, architecture). Nothing merged, nothing modified. Static only —
pair with a live pen-test + load test before or shortly after launch.*
