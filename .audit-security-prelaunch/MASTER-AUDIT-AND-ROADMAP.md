# Hatchin — Master Pre-Launch Audit + Ordered Fix Roadmap

**One document, everything.** 21 read-only audit passes (6 security domains · 7 engineering pillars · 6
deep-dives · 2 focused cyber/user-safety) + operator-verified launch-blockers, consolidated with a
tiered, effort-estimated fix roadmap cross-referenced to each finding.

- **Branch:** `feat/v2.2-intelligence-fixes` · **Date:** 2026-08-01 · **Method:** static, read-only. Nothing modified.
- **Effort key:** S = <½ day · M = 1-2 days · L = 3-5 days · XL = 1 week+ (rough, solo-dev).
- **Finding IDs** (e.g. `DOS-1`) are referenced by the roadmap in Part 3.

---

# PART 0 — Verdict & Scorecard

## 🔴 NOT READY for public traffic — gaps are operational & lifecycle, not a breach or a rewrite

No breach-class hole: tenant isolation, auth object-authorization, XSS/SQLi/SSRF, and autonomy blast-radius
are sound; the code is strict-typed and has clean core seams. What blocks launch: **cost brakes are off,
the deploy can silently drop user data, operation is blind, billing can't downgrade, one account-takeover
vector, and no moderation on AI output.** All fixable in days-to-weeks.

| Domain | Verdict | Worst finding |
|---|---|---|
| S1 Auth & Tenant Isolation | 🟠 GO-WITH-FIXES | `SEC1-1` IDOR write |
| S2 Injection | 🟠 GO-WITH-FIXES | `INJ-1` action-block → DB write (XSS/SQLi/SSRF closed) |
| S3 Secrets & Config | 🟠 GO-WITH-FIXES | `SECRET-1` response-body logging |
| S4 Dependencies | 🟠 GO-WITH-FIXES | `DEP-1` ws DoS |
| S5 DoS / Cost | 🔴 **NO-GO** | `DOS-1` no cost cap + `DOS-2` WS unthrottled |
| S6 Autonomy | 🟠 GO-WITH-FIXES | `AUT-1` fail-open judge (no destructive path — good) |
| A Code Health | 🟡 NEEDS-WORK | `CODE-1` 3,438-line function |
| B Reliability | 🟡 NEEDS-WORK | `REL-1` DeepSeek no timeout/cancel |
| C Observability | 🔴 **FLYING-BLIND** | `OBS-1` no error tracking |
| D Testing / CI-CD | 🔴 **THIN-NET** | `TEST-1` no CI |
| E Performance | 🟡 WILL-DEGRADE | `PERF-1` N+1 on chat turn |
| F Data / DR | 🔴 **AT-RISK** | `DATA-1` db:push, 7/21 tables |
| G Architecture | 🟡 NEEDS-REFACTOR | `ARCH-1` WS-fused orchestrator |
| Infra + Git-History | 🟡 NEEDS-WORK | history CLEAN; `INFRA-1` root container |
| Frontend Security | 🟢 SOLID | `FE-1` replit script tag (LOW) |
| Compliance / Legal | 🔴 NOT-READY (EU/enterprise) | `COMP-1` no erasure |
| Accessibility | 🔴 GAPS→NOT-COMPLIANT | `A11Y-1` keyboard-locked nav |
| Billing | 🟡 NEEDS-WORK→AT-RISK | `BILL-1` broken downgrade |
| God-file Bug-Hunt | 🟡 NEEDS-WORK | `BUG-1` memory full-dump |
| API Data-Exposure | 🟡 GAPS (no live leak) | `APIX-1` trustMeta mass-assign |
| Account & Content Safety | 🟠 GAPS / 🔴 AT-RISK | `ACCT-1` email ATO · `ACCT-2` no output moderation |

**Tally:** ~9 Critical/near-critical · ~24 High · ~35 Medium · ~20 Low. Four red domains (DoS, Observability,
Testing, Data/DR) + Compliance/A11y red for regulated launch.

---

# PART 1 — Complete Findings Catalog (detailed)

## S1 — Auth & Tenant Isolation
- **`SEC1-1` [HIGH] IDOR write on `POST /api/personality/feedback`** — `server/routes.ts:381-441`. `agentId`
  comes from the body; handler does `getAgent → updateAgent → storeFeedback` with only a session-exists
  check — no verification the agent's project belongs to the caller, and no Zod on `feedback`/`messageContent`/
  `agentResponse`. Any authed user writes attacker-keyed traits + unbounded strings into another user's agent
  and poisons its training pipeline. Sibling routes (`:449`) do the check; this one omits it. **Fix:** add
  `getProject(agent.projectId)` ownership check (404 on mismatch) + a bounding Zod schema. *(operator-verified)*
- **`SEC1-2` [MEDIUM] CSRF exemptions are dead code → Stripe webhook 403 in prod** — `server/index.ts:187-211`.
  Mounted `app.use('/api', validateCsrf)` strips `/api`, so `startsWith('/api/billing/webhook')` never matches.
  In prod (CSRF active) the signature-verified webhook is 403'd → paid upgrades silently fail; logout needs a
  token. Fails closed but breaks billing. **Fix:** match `/billing/webhook` + `/auth/` (or `req.originalUrl`).
- **`SEC1-3` [LOW] Cross-tenant handoff aggregates** — `server/routes.ts:468-477`. `GET /api/handoffs/stats`
  returns `handoffTracker.getHandoffStats()` aggregated across ALL users. **Fix:** scope to owned projects.
- **`SEC1-4` [LOW] OAuth trusts `X-Forwarded-Host` when `APP_BASE_URL` unset** — `googleOAuth.ts:33-47`.
  **Fix:** require `APP_BASE_URL` + `GOOGLE_OAUTH_REDIRECT_URI` in prod.

## S2 — Injection & Input Validation
- **`INJ-1` [HIGH] LLM action-blocks drive unvalidated DB mutations behind a fuzzy keyword gate** —
  `server/routes/chat.ts:2411-2555`, `actionParser.ts:57`. Parsed `<!--BRAIN_UPDATE/TASK_SUGGESTION/
  HATCH_SUGGESTION-->` blocks are `JSON.parse`d and executed (`createTeam/createAgent/createTask/updateProject`)
  if `detectUserPermission(userMessage)` returns `granted` — matched on broad tokens ("ok/great/add/create").
  Payload is never re-validated with Zod at execution; `brain.field` is a computed key (no allow-list).
  Reachable via prompt injection in an uploaded brain doc or handoff output. **Tenant-bounded** (self-project),
  `__proto__` blocked. **Fix:** Zod-revalidate at execution, allow-list `brain.field`, require real consent.
- **`INJ-2` [MEDIUM] DOCX/brain upload zip-bomb + extension-only type check** — `projects.ts:364-407`,
  `extractDocumentText.ts`. `mammoth` inflates the whole DOCX zip with no ratio cap before truncation.
  **Fix:** decompression/size ceiling + magic-byte check + worker w/ memory bound.
- **`INJ-3` [LOW] Prompt-injection detection is a literal substring list** — `safety.ts:46-56`. Paraphrase
  evades. Signal only. **Fix:** validate effects (INJ-1), don't rely on the phrase list.
- **`INJ-4` [LOW] `searchMessages` LIKE unescaped wildcards** — `storage.ts:2167`. `%`/`_` act as wildcards.
- **✅ Closed:** XSS (react-markdown escapes raw HTML, no `rehype-raw`/`dangerouslySetInnerHTML` on user data),
  SQLi (all `sql\`\`` parameterized), SSRF (no user-supplied URL fetched).

## S3 — Secrets & Config
- **`SECRET-1` [MEDIUM] API response bodies logged to prod console** — `server/index.ts:237-256`. Monkey-patched
  `res.json` appends `JSON.stringify(body)` (truncated to 80 chars) with no env gate → PII/token fragments in
  persistent logs. **Fix:** gate to non-prod, or log shape/status only.
- **`SECRET-2` [LOW-MED] Raw `err.message` returned to clients on 500 in prod** — `index.ts:282-287`. **Fix:**
  fixed generic message for `status>=500` in prod.
- **`SECRET-3` [LOW] `|| process.env.DEV` widens dev paths** — `chat.ts:513,1456`. **Fix:** gate on `NODE_ENV`.
- **✅ Safe:** no hardcoded secrets, no client-bundle leak, `.env` gitignored, env logging redacted
  (`safeEnv.ts`), Helmet CSP on in prod, CORS single-origin, cookies hardened, prod guards fail closed.

## S4 — Dependencies (npm audit: 1C/10H/19M/2L; lockfile clean, no install-script/non-registry risk)
- **`DEP-1` [HIGH] `ws` 8.18 → ≥8.21** — mem disclosure + DoS on the core WS transport. Non-breaking. **Most urgent.**
- **`DEP-2` [HIGH] `multer` 2.1.1 → ≥2.2** — upload DoS. Same-major.
- **`DEP-3` [MODERATE] `express` + `express-rate-limit`** — in-range bumps.
- **`DEP-4` [HIGH, not reachable] `drizzle-orm` 0.39 identifier-SQLi** — no dynamic identifiers used; semver-major, schedule.
- **`DEP-5` [HIGH, conditional] `langsmith` SSRF** — only if tracing enabled; upgrade before enabling.
- **`DEP-6` [CRITICAL, not shipped] `shell-quote`** — transitive via drizzle-kit (dev/migration only).
- Dev/build-only: vite/postcss/esbuild/langchain-ecosystem/protobufjs — schedule, not launch-gating.

## S5 — DoS, Resource & Cost  🔴
- **`DOS-1` [CRITICAL] No prod cost cap; billing/safety gates default OFF** — `tierGate.ts:8-11`,
  `policies.ts:60-61`, `usageTracker.ts:32`. Cost recorded after the call, never checked before; only "cap" is
  a per-project call count. Any authed user → unbounded LLM spend on your keys. **Fix:** gates ON in prod +
  real per-user daily cents cap checked before each call + global kill. *(operator-verified)*
- **`DOS-2` [CRITICAL] WebSocket message path has no rate limit** — `chat.ts:432-440,532-1160`. Express limiters
  are HTTP-only; the WS upgrade bypasses them; `send_message_streaming` loop = unbounded spend + event-loop DoS;
  `join`/`typing` unlimited (broadcast amplification). **Fix:** per-socket + per-user sliding-window limiter,
  independent of the billing flag.
- **`DOS-3` [HIGH] `/api/deliverables/*` + `/api/packages` ungated** — `deliverables.ts:215-471`. No AI limit,
  no Pro gate, no cost cap; `/packages` fans out fire-and-forget to N agents. **Fix:** aiLimiter + Pro gate + per-user budget + bound concurrency.
- **`DOS-4` [HIGH] `getMessagesByConversation` full-history read** — `storage.ts:2219`, called unbounded at
  `chat.ts:2129`. No SQL LIMIT/ORDER; JS sort+slice. Scale cliff + memory-DoS lever. **Fix:** push
  `ORDER BY created_at DESC LIMIT n` + keyset cursor into SQL + composite index. *(operator-verified; also PERF-2/BUG-6)*
- **`DOS-5` [MEDIUM] WS: no `maxPayload` (≈100 MB frame), no per-user conn cap, no keepalive reaping** — `chat.ts:432`.
- **`DOS-6` [MEDIUM] Doc parsing inflates full 10 MB buffer before truncation** — `extractDocumentText.ts:26-38`.
- **`DOS-7` [MEDIUM] Autonomy cost cap is per-project (50×#projects for Pro)** — `policies.ts:64-69`.
- **`DOS-8` [LOW] Rate limiters key on `req.ip`** (NAT shares a bucket; rotation bypasses) — `index.ts:74-91`.

## S6 — Autonomy & Business-Logic
- **Structural ✅:** no code path to a destructive action; cross-tenant approval blocked; cross-project handoff
  impossible; runaway loops structurally prevented (agents can't mint tasks); atomic budget ledger.
- **`AUT-1` [HIGH] Low-risk-but-harmful output ships via a fail-open judge** — `taskExecutionPipeline.ts:605-641`,
  `llmJudge.ts:165-173`. Block only fires at risk≥0.70; below that the judge is the sole gate and returns null
  (no block) on any error, with a "hold a high bar for BLOCKING" prompt. **Fix:** treat missing verdict as a
  soft-block for outward/factual/destructive-scored content.
- **`AUT-2` [HIGH] Destructive-intent scorer is shallow, scores task not output** — `safety.ts:73-127,189-193`.
  Misses synonyms (remove/purge/truncate/drop/rm…), non-English, obfuscation; `hasExplicitCreationIntent` floors
  risk to 0.05; `getRoleRiskMultiplier` ×0.8 discount for creative roles. **Fix:** broaden verb/scope sets,
  score the draft output too, cap the creative discount. *(bounded today — fix before wiring any real tool)*
- **`AUT-3` [MEDIUM] `BRAIN_UPDATE` consent keyword not bound to the change** — `chat.ts:2532-2558`. Wholesale
  overwrite on any affirmative token (cannot touch the `executionRules` autonomy column — separate). **Fix:** bind approval to the proposed `{field,value}` + version brain.
- **`AUT-4` [MEDIUM] Peer-review judge is prompt-injectable via the draft it reviews** — `llmJudge.ts:77-104`.
  A verdict-keyword line in the draft can flip it to approve. **Fix:** hard-delimit + treat draft as untrusted.
- **`AUT-5` [MED/LOW] Mattermost/Slack approve HMAC is replayable** — `integrations.ts:21-45`. HMAC over
  `(taskId,action)` only — no session/ownership/nonce/expiry. **Fix:** add nonce+timestamp, bind to approver identity.
- **`AUT-6` [LOW]** Handoff carries unsanitized upstream output (confabulation only — cannot mutate); fake-action guard is prompt-only.

## A — Code Health & Maintainability  (typecheck ✅ clean/strict, 0 `@ts-ignore`; low TODO/dead-code)
- **`CODE-1` [HIGH] `registerChatRoutes` is one ~3,438-line function** — `chat.ts:183→3621`. 19 handler branches,
  662 lines nested ≥4 deep, 124 of the ~538 `any` escapes. Untestable, unsafe to refactor, everything touches it.
  **Fix:** extract a WS dispatch table of named handlers (the routes.ts "thin orchestrator" pattern).
- **`CODE-2` [HIGH] Lint is a no-op** — `package.json` `lint`/`check` both alias `tsc --noEmit`; ESLint not
  installed; 15 inert `eslint-disable`. Floating-promise/hook-deps bugs uncaught. **Fix:** install ESLint +
  `@typescript-eslint` + `react-hooks`; start with `no-floating-promises`.
- **`CODE-3` [MEDIUM] ~538 `any` escapes** (chat.ts 124, storage.ts 71, CenterPanel 26) defeat strict at the hottest files. **Fix:** ratchet (no new) + burn down storage.ts with `$inferSelect`.
- **`CODE-4` [MEDIUM] MemStorage (101) vs DatabaseStorage (98) drift** — `storage.ts:311,1821`. **Fix:** shared contract test against both, or collapse to one impl.
- **`CODE-5` [MEDIUM] 41 raw `pool.query`/`db.execute` bypass Drizzle** (tracked TODO P1-5). **Fix:** migrate to Drizzle.
- **`CODE-6` [MEDIUM] Dead code committed** — `LandingPage.bento-backup.tsx` (1,244 L), `runTreeBackfill.ts`. **Fix:** delete.
- **`CODE-7` [LOW]** 12 `useEffect+fetch` violate the TanStack-Query convention; `CenterPanel.tsx` 27 useState; 73 server `console.log`; tsconfig lacks `noUncheckedIndexedAccess`.

## B — Reliability & Resilience  (pg-boss wedge/DB-pool/trace-store now solid; WS+Stripe degrade gracefully)
- **`REL-1` [HIGH] DeepSeek (primary) has no per-call timeout and ignores cancellation** — `deepseekProvider.ts:19-23,79-84,111-118`. SDK default 600s; `abort()` only breaks the server read loop — the upstream generation keeps running and is fully billed. Only Gemini composes an abort signal. **Fix:** pass `signal` + set a 30-45s client timeout on DeepSeek/Groq/OpenAI (mirror Gemini).
- **`REL-2` [HIGH] Fallback chain can't recover a mid-stream provider failure** — `providerResolver.ts:431-476`. Only connect-time errors trigger fallback; a provider dying at token 3 yields a partial message + error. **Fix:** wrap stream iteration to re-enter the chain before first/N tokens.
- **`REL-3` [HIGH] pg-boss retry not idempotent → double-charge + duplicate message** — `jobQueue.ts:99-104`, `taskExecutionPipeline.ts:910-1085`. Post-execution steps (handoff/broadcast/completeRun) run outside try/catch; a throw retries the whole job → re-reserve budget, re-run LLM, re-post message. **Fix:** short-circuit if `task.status==='completed'` at handler top + wrap the tail.
- **`REL-4` [MEDIUM] Health check pings all providers live, unauth, no timeout; never probes DB** — `health.ts:36,51-53`, `providerResolver.ts:701-714`. Cost amplification + hangs when a provider is slow; DB down still returns 200. **Fix:** cache provider health, move behind auth, add timeout + `SELECT 1`.
- **`REL-5` [MEDIUM] Project + Maya init not atomic** — `storage.ts:1899,2080-2110` → zero-agent orphan projects. **Fix:** wrap in a transaction or self-heal on read.
- **`REL-6` [MEDIUM] Graceful shutdown drains neither WS nor in-flight jobs** — `index.ts:399-429`. Fly deploy hard-kills → lost/duplicated work (compounds REL-3). **Fix:** await `server.close` w/ timeout, close WS, bounded pg-boss drain, then `pool.end()`.
- **`REL-7` [LOW]** `unhandledRejection` swallows all non-Neon rejections (`index.ts:449-467`); billing `recordUsage` fire-and-forget empty catch (`taskExecutionPipeline.ts:1025`).

## C — Observability & Operability  🔴
- **`OBS-1` [CRITICAL] No error tracking** — `index.ts:282,449`. No Sentry/equivalent; prod errors are unstructured stdout, and `min_machines_running=0` means idle-then-cycled logs are gone. **Fix:** Sentry on Express + process handlers, tagged with user/project/reqId.
- **`OBS-2` [CRITICAL] Fly gets no readiness signal** — `fly.toml` has no `[[http_service.checks]]`; the good `/api/health` handler is never polled → wedged instances stay in rotation. **Fix:** add a check that 503s on `down` + a `/live` probe. *(operator-verified; also TEST-5/INFRA-3)*
- **`OBS-3` [HIGH] Zero app metrics** — no `/metrics`/prom-client; can't see spend/queue-depth/WS/error-rate without ad-hoc SQL. **Fix:** `prom-client` `/metrics` (or `/api/admin/stats`).
- **`OBS-4` [HIGH] Logging unstructured, 80-char-truncated, leaks response bodies, no correlation/user id, no levels** — `index.ts:243-256`. **Fix:** pino JSON logger + `reqId`/`userId` + `LOG_LEVEL`; stop logging bodies (also SECRET-1).
- **`OBS-5` [HIGH] `correlationId` is a dead field** — `chat.ts:226` only; no middleware mints/logs one → no end-to-end tracing. **Fix:** request/WS id middleware threaded into logs + events.
- **`OBS-6` [HIGH] No proactive alerting + the "cost cap" is call-count not dollars** — `policies.ts:60`, `taskExecutionPipeline.ts:900-923`. No page for spend/error-rate/provider-down/queue-stall. **Fix:** aggregate dollar ceiling + ops webhook (distinct from the user notifier). *(also DOS-1)*
- **`OBS-7` [MEDIUM]** LangSmith covers only the chat LLM path, best-effort, key-gated (`openaiService.ts:41`).
- **`OBS-8` [LOW]** Audit trail is agent-centric; no security/billing event log (logins, approvals, cost).

## D — Testing, CI-CD & Release  🔴  (109 of 134 test scripts orphaned; Playwright/vitest have no npm entry)
- **`TEST-1` [CRITICAL] No CI** — no `.github/workflows` etc. Nothing runs on push/PR; the 261-commit branch is human-memory-verified. **Fix:** GitHub Actions running mock-mode unit/gate suites + Playwright smoke, required-to-merge.
- **`TEST-2` [CRITICAL] `qa:full` runs zero tests** — it's `lint && typecheck && build`. A change that compiles but breaks auth/streaming/approval merges clean. **Fix:** add `test:dto/integrity/injection/tone gate:safety gate:conductor` + Playwright smoke.
- **`TEST-3` [CRITICAL] No authz/IDOR test anywhere** — the SEC1-1 IDOR + regressions would go undetected. **Fix:** `test-authz-idor` hitting every mutating route with a foreign id expecting 404.
- **`TEST-4` [HIGH] Cost-cap tests exist but are orphaned** — `test-budget-*.ts` not in package.json/CI. **Fix:** wire into the gate.
- **`TEST-5` [HIGH] Deploy = hard single-machine cutover, no health gate** — `fly.toml`. Severs WS, kills in-flight jobs, no canary. **Fix:** health check + ≥2 machines for rolling deploy.
- **`TEST-6` [HIGH] Schema migration unversioned + unordered vs deploy** — `db:push`, no `release_command`. **Fix:** versioned `migrate` in a Fly release_command, expand-contract. *(also DATA-1)*
- **`TEST-7` [MEDIUM]** No feature-flags/canary for the risky v2.2 code; **`TEST-8` [LOW]** Playwright e2e never invoked.

## E — Performance & Scalability  (schema mostly well-indexed; newest code batched — old read paths not)
- **`PERF-1` [CRITICAL] Nested N+1 on every chat turn: agent-memory × conversations** — `chat.ts:1475` → `storage.ts:2295-2304`. `getSharedMemoryForAgent` called per agent, each an N+1 over conversations, re-reading the whole project memory. **Fix:** hoist one `getProjectMemory` outside the loop, single `IN (...)`, memoize per turn.
- **`PERF-2` [CRITICAL] `getMessagesByConversation` full read + JS pagination** — `storage.ts:2219` (= DOS-4/BUG-6). Highest-frequency query, unbounded at `chat.ts:2129`. **Fix:** SQL `ORDER BY … LIMIT` + keyset + `messages(conversation_id, created_at)` composite index.
- **`PERF-3` [HIGH] Cross-tenant full-table scans on home load** — `projects.ts:80`, `agents.ts:51`, `teams.ts:42`, `tasks.ts:139` call `getProjects()`/`getAgents()` (whole table) then filter in JS. **Fix:** use the existing indexed `*ByUserId`/`*ByProject`. *(perf AND data-scoping)*
- **`PERF-4` [HIGH] Streaming re-render storm** — `CenterPanel.tsx:565/578`, `MessageBubble.tsx` no memo; full list re-parses markdown+highlight per chunk; no virtualization. **Fix:** `React.memo` bubbles, render only the streaming one live, virtualize the list.
- **`PERF-5` [MEDIUM] No client code-splitting** — `vite.config.ts`, `App.tsx`; framer-motion + highlight.js ship to logged-out visitors. **Fix:** route `React.lazy` + `manualChunks`.
- **`PERF-6` [MEDIUM] Unbounded in-memory maps leak** — `personalityEvolution.ts:38`, `autonomyStore.ts:27` (`.set`-only, no TTL/cap). **Fix:** LRU+TTL like `reasoningCache`.
- **`PERF-7` [MEDIUM]** Activity-feed name resolution sequential per project (`autonomy.ts:658`); pool `max:10` shared with session store (`db.ts:26`, `index.ts:164`).
- **`PERF-8` [LOW]** Reaction N+1 (`messages.ts:287/311/339/356`).
- **Missing indexes:** `messages(conversation_id, created_at)` composite (highest value), `tasks.status`, `tasks.team_id`, `message_reactions.user_id`.

## F — Data Integrity, Migrations & DR  🔴
- **`DATA-1` [CRITICAL] Deploy = `drizzle-kit push`; `migrations/` covers only 7 of 21 tables** — `package.json:13`, `migrations/`. Prod schema exists solely as a diff of `schema.ts` to the live DB; a rename/removal silently `DROP COLUMN`s user data; source can't rebuild the DB. **Fix:** `generate` a baseline migration, switch to `migrate` in a Fly `release_command`, staging-first. *(operator-verified)*
- **`DATA-2` [HIGH] No backup/PITR/restore** — none in repo; last migration lost all history. **Fix:** enable Supabase PITR or scheduled `pg_dump`, one restore drill.
- **`DATA-3` [HIGH] No right-to-erasure** — `PrivacyContent.tsx:170` promises deletion; no `deleteUser`/export endpoint. `usage_daily_summary` FK blocks a raw user delete. **Fix:** ordered `deleteUser` (projects→usage→reactions→Stripe→user) + export. *(also COMP-1)*
- **`DATA-4` [HIGH] `purgeProject` FK-violation infinite loop** — `storage.ts:1941`. Deletes `deliverables` before `autonomy_run_steps` (FK `no action`) → violation → rollback → 60s cron retries forever for any project with autonomous deliverables. **Fix:** delete run-steps/runs before deliverables (or set FK cascade).
- **`DATA-5` [MEDIUM] FKs are almost all `ON DELETE no action`** (only autonomy_* cascade) — integrity is app-order-enforced; any non-helper delete orphans/blocks. **Fix:** proper cascade/set-null semantics in the FKs.
- **`DATA-6` [MEDIUM] `coreDirection`/`brain` are last-write-wins JSONB, no version history** — `schema.ts:57-71`; an action-block overwrite is unrecoverable (deliverables get versions; brain doesn't). **Fix:** version/keep-prior on write.
- **`DATA-7` [MEDIUM] Data residency: DB Singapore, primary LLM China (DeepSeek)** — GDPR Chapter V transfer, unenforced. **Fix:** region-routing override (also COMP-4).
- **`DATA-8` [LOW]** JSONB no CHECK/Zod on direct-write paths; self-ref pointers (`parent*`/`thread*`) have no FK.
- **✅ Correct:** money is integer cents; UNIQUE on trace_id/email/provider_sub/webhook id + budget counter; `purgeProject` single transaction; Supavisor-hardened pool.

## G — Architecture & Extensibility
- **`ARCH-1` [CRITICAL for feature velocity] WS-fused orchestrator** — `chat.ts:1698` `handleStreamingColleagueResponse` (~1,880 L) threads `ws` through every branch (~50 inline `ws.send`), mixing conductor/safety/persistence/handoff/deliverable-detection. Core "generate a coordinated response" can't run from HTTP/Mattermost/cron; every chat change is high-blast-radius; it's why chat vs autonomy paths drift. **Fix:** extract `respondToMessage(): AsyncIterable<OrchestrationEvent>` transport-agnostic core; WS/HTTP/MM as thin subscribers. (Confirms Phase 47 #3/#4.)
- **`ARCH-2` [HIGH] Two divergent orchestration paths** — `taskExecutionPipeline.ts:170` (clean injected `generateText`) vs the fat WS function; cross-cutting changes must be applied twice. **Fix:** collapse onto the extracted core.
- **`ARCH-3` [HIGH] "Add a deliverable type" is a 5-place shotgun** — `deliverableTypes.ts:19,274`, `deliverableDetector.ts:31`, `deliverableFeedbackAggregator.ts:80`, `deliverableRubrics.ts`; silent fail-open on a miss. **Fix:** single `DeliverableTypeSpec` source of truth.
- **`ARCH-4` [HIGH] First-class role = shotgun + hardcoded role-string branches** — `expertiseMatching.ts:123/177/272/281` (`role === 'Product Manager'`), + avatar/color/modal registrations. **Fix:** move heuristics into `roleIntelligence` fields; make avatars data.
- **`ARCH-5` [MEDIUM] 56 outbound WS events untyped/unversioned** — `wsSchemas.ts` defines only inbound. **Fix:** discriminated-union `ServerEvent` + typed `send()` + protocol version.
- **`ARCH-6` [MEDIUM]** 90-method `IStorage` mega-interface; behavior is code not config (thin flag surface). **Fix:** split into domain repos; typed config service.
- **`ARCH-7` [LOW]** `home.tsx`/`CenterPanel.tsx` trending god-components (boundaries otherwise correct).

## Infra + Git-History  (🟢 git history CLEAN — no secret ever committed, nothing to rotate)
- **`INFRA-1` [MEDIUM] Container runs as root** — `Dockerfile:8-15` (no `USER`). RCE = root in container. **Fix:** non-root user before CMD.
- **`INFRA-2` [MEDIUM] DB TLS cert validation disabled** — `db.ts:27` `rejectUnauthorized:false`. Encrypted but MITM-able. **Fix:** supply Supabase CA + `verify-full`.
- **`INFRA-3` [MEDIUM] No Fly health checks** — `fly.toml` (= OBS-2).
- **`INFRA-4` [LOW-MED] Floating base image tag** — `node:20-slim` not digest-pinned (`Dockerfile:1,8`). **Fix:** pin by digest.
- **`INFRA-5` [LOW] Single region / `min_machines_running=0`** — intentional pre-launch; flip to 1 at launch.
- **✅ Safe:** secrets via `fly secrets`, `.dockerignore` complete, `npm ci` pinned, no install scripts, `force_https`.

## Frontend Security  🟢 SOLID
- **`FE-1` [LOW] Leftover `https://replit.com/replit-dev-banner.js` in `index.html:28`** — CSP-blocked in prod (defense by luck). **Fix:** remove the tag.
- **`FE-2` [LOW] CSP over-broad `connect/img/font https:`** — `index.ts:57-60` (scriptSrc 'self' is strong). **Fix:** pin to own origin + wss same-host; add `frame-ancestors 'none'`.
- **`FE-3` [INFO/functional] Inline theme-flash script blocked by prod CSP** — `index.html:18-22` → theme flash; CSP never validated against the shipped page. **Fix:** externalize or hash it.
- **✅ Safe:** no reachable XSS, no browser-stored secrets/tokens, CSRF interceptor, Zod-validated WS ingress, sanitized redirects, frameguard SAMEORIGIN.

## Compliance, Legal & Privacy  🔴 NOT-READY (regulated/EU)
- **`COMP-1` [CRITICAL] No right-to-erasure or data-export** — policy + landing FAQ promise deletion; no endpoint. GDPR 17/20, CCPA. **Fix:** self-service delete + JSON export + DSAR SLA. *(= DATA-3)*
- **`COMP-2` [HIGH] Privacy policy is factually stale** — `PrivacyContent.tsx:101-105` names "Neon, United States"; actual is Supabase, Singapore (2026-06-02). Wrong processor + country. **Fix:** correct + re-date + change-triggered review.
- **`COMP-3` [HIGH] Legal docs are DRAFT/un-lawyered** — `LegalPageLayout.tsx:42-59` "DRAFT — for legal review" + governing-law TODO, yet clickwrap binds users. **Fix:** counsel review, remove banners.
- **`COMP-4` [HIGH] China (DeepSeek) transfer unconditional, opt-out manual-email-only** — no region routing/SCCs. Single biggest legal risk. **Fix:** enforced region routing + SCCs/TIA before EU users. *(= DATA-7)*
- **`COMP-5` [HIGH] No DPA / subprocessor page** (policy also omits Supabase + Fly). **Fix:** publish subprocessor list + offer DPA.
- **`COMP-6` [MEDIUM]** No age gate; **`COMP-7` [MEDIUM]** no cookie consent notice; **`COMP-8` [MEDIUM]** no upload-PII warning; **`COMP-9` [MEDIUM]** landing FAQ overpromises deletion (`LandingPage.tsx:414`).
- **✅ Handled:** PCI offloaded to Stripe (SAQ-A), honest China disclosure, clickwrap present, no fake SOC2/ISO badges, session cookie accurately described.

## Accessibility (WCAG 2.1 AA)  🔴 GAPS→NOT-COMPLIANT
- **`A11Y-1` [CRITICAL] Core nav is keyboard/SR-inoperable** — `ProjectTree.tsx` (~13 rows) + `LeftSidebar.tsx:515` are `<div onClick>` with no role/tabIndex/onKeyDown. Can't switch project/team/agent without a mouse. WCAG 2.1.1/4.1.2, ADA/EAA. **Fix:** `<button>` or role+tabindex+onKeyDown; ideally `role="tree"`.
- **`A11Y-2` [CRITICAL] Zoom disabled** — `index.html:5` `maximum-scale=1`. WCAG 1.4.4. **Fix:** remove it.
- **`A11Y-3` [HIGH] 4 hand-rolled modals: no focus trap/Escape/restore** — `QuickStartModal:24`, `StarterPacksModal:461`, `AddHatchModal:558`, `ProjectNameModal:56`. **Fix:** migrate to the Radix `Dialog` already used elsewhere.
- **`A11Y-4` [HIGH] `prefers-reduced-motion` unenforced** — `index.css:760` gates one class; 123 infinite framer loops. WCAG 2.2.2/2.3.3. **Fix:** global reduced-motion rule + `useReducedMotion()`.
- **`A11Y-5` [MEDIUM]** No skip-link; thin desktop landmarks (`home.tsx`). **`A11Y-6` [LOW]** stray `text-gray-400` contrast (`ChatMessageList.tsx:161`).
- **✅ Safe:** Radix modals (trap/Escape), `role="log" aria-live` chat, labeled icon buttons, visible focus ring, UX-integrity clean (no dark patterns; cancel as prominent as upgrade).

## Billing & Monetization  🟡→AT-RISK once gates ON
- **`BILL-1` [CRITICAL] 7-day payment-failure grace is dead code → keep Pro through dunning** — `tierGate.ts:53-65` + `webhookHandler.ts:119-136`. Downgrade guard needs `subscriptionStatus==='none'`, but grace is only ever set with `'past_due'` → unreachable. Failed card keeps Pro ~2-4 weeks. **Fix:** downgrade on `graceExpiresAt<now` regardless of status.
- **`BILL-2` [HIGH] `subscription.updated` ignores terminal statuses** — `webhookHandler.ts:80-102` handles only active/trialing/past_due; `canceled/unpaid/paused` fall through with no write → Pro forever if cancel arrives via `updated` not `deleted`. **Fix:** downgrade on terminal statuses.
- **`BILL-3` [MEDIUM] The documented 15-day launch grace doesn't exist in code** — `storage.ts:353,555` set `graceExpiresAt:null`. A hand-set `tier=pro` with null grace never expires (guard needs truthy grace). **Fix:** dated backfill + treat null grace as expired.
- **`BILL-4` [MEDIUM] `MemStorage.getUserTier` hardcodes `pro`** — `storage.ts:1535-1539`. Memory-mode prod boot = everyone Pro. **Fix:** default free + assert.
- **`BILL-5` [LOW]** `checkout.session.completed` ignores `payment_status` (`webhookHandler.ts:55-78`); idempotency check-then-act race (`:22-52`); orphan Stripe customer on persist failure (`checkoutService.ts:26-35`); grace not cleared on recovery (`:91-95`).
- **✅ Safe:** cannot self-grant Pro (tier is webhook/checkout-only), raw-body sig verification, idempotency table, PCI offload, no float in charge math.

## God-File Bug-Hunt (chat.ts + storage.ts)
- **`BUG-1` [HIGH] `DatabaseStorage.getSharedMemoryForAgent` dumps the ENTIRE project memory into every prompt** — `storage.ts:2304-2307` (MemStorage curates to importance≥7/top-5, so dev hides it). Prompt grows unbounded as memories accumulate → rising per-message cost + eventual context overflow on long-lived projects. **Fix:** same importance-filter+cap+`ORDER BY … LIMIT` as MemStorage.
- **`BUG-2` [MEDIUM] Streaming-slot lock can wedge a conversation + TOCTOU** — `chat.ts:1005-1075,479-488`. `add` at :1021 is before the `try` whose `finally` clears it; a `ws.send` throw skips it → permanent `CONVERSATION_BUSY`. And two un-awaited sends both see an empty set → concurrent streams. **Fix:** move `add` inside try; make acquire atomic.
- **`BUG-3` [MEDIUM] Multi-agent & safety-intervention responses never usage-tracked** — `chat.ts:2367,3284-3295`. `recordUsage` gated on `llmMetadata`, only set by the single-agent path → team turns record zero spend → cost cap under-counts. **Fix:** surface aggregate token metadata + record. *(compounds DOS-1)*
- **`BUG-4` [MEDIUM] JSONB last-write-wins clobber** — `chat.ts:1357,2532,2955,3242`. Concurrent brain/personality writes lose one update (most reachable: two users' `adaptedTraits`). **Fix:** `jsonb_set`/per-key atomic or a write lock.
- **`BUG-5` [MEDIUM] `MemStorage.createMessage` ignores caller `id`** — `storage.ts:1073-1101` vs `2248`. Dev message-reconciliation differs from prod (ghost bubble), masks id bugs in testing. **Fix:** honor `message.id ?? randomUUID()`.
- **`BUG-6` [MEDIUM] `getMessagesByConversation` no ORDER/LIMIT + unstable same-ms sort** — `storage.ts:2219` (= DOS-4/PERF-2). **Fix:** SQL order+limit + tiebreaker key.
- **`BUG-7` [MEDIUM] `searchMessages` matches project by substring** — `storage.ts:1377` vs `2162`; `LIKE '%projectId%'` leaks across projects if one id is a substring of another (low risk with UUIDs) + unescaped wildcards + Mem/DB ordering divergence. **Fix:** parsed-scope match, escape LIKE.
- **`BUG-8` [LOW-MED] Fallback msg id `msg-${Date.now()}` collision drops a legit message** — `chat.ts:813-819,899-909`. **Fix:** add random suffix.
- **`BUG-9` [LOW]** Chat-path peer-review "revision" never persists (`chat.ts:2628-2703`); vestigial `streamingConversations` set.

## API Data-Exposure & Mass-Assignment  (no live cross-user leak today)
- **`APIX-1` [MEDIUM] Mass assignment of `personality` incl. `trustMeta.trustScore`** — `agents.ts:10` (`personality: z.record(z.unknown())`) → blind `.set` (`storage.ts:2050`). Authorized `PATCH /api/agents/:id` can overwrite the trust score that relaxes autonomy safety thresholds (+0.15). **Fix:** strict personality allow-list; reject `trustMeta`/`adaptedTraits`/`adaptationMeta` from clients.
- **`APIX-2` [MEDIUM] `isSpecialAgent` settable on create** — `agents.ts:92` (`insertAgentSchema` only omits id). Self-grant routing priority. **Fix:** omit/force server-side.
- **`APIX-3` [MEDIUM, latent] Full `personality` blob shipped on every agent GET** — `agents.ts:53,66,79`. Safe NOW (single-owner model, map holds only the owner's key) but leaks every collaborator's adapted traits the day sharing ships. **Fix:** DTO drops `adaptedTraits`/`adaptationMeta`/`trustMeta`.
- **`APIX-4` [LOW]** Null-project autonomy events returned to all users (`autonomy.ts:632-635`); message `messageType`/`agentId` spoofable in own conversation (`messages.ts:152,176`); verbose `err.message` (`deliverables.ts:210,258,293,327`).
- **✅ Safe:** `/api/auth/me` clean DTO (no provider_sub/Stripe/grace); project/team/task mutations `.strict()` (no ownership-takeover/reparent); UUID ids + uniform 404 (no enumeration oracle).

## Account Security & Content/AI-Output Safety
- **`ACCT-1` [HIGH] Account takeover via email fallback** — `storage.ts:1849-1866`. `upsertOAuthUser` looks up `getUserByProviderSub() || getUserByEmail()` and on the email hit **overwrites `provider_sub`**. A reassigned Google Workspace email → new person inherits the prior owner's entire account; latent cross-provider hijack. **Fix:** look up strictly by `(provider, sub)`; no email fallback on unauthenticated login; require `email_verified===true` (`googleOAuth.ts:152`).
- **`ACCT-2` [HIGH] Zero moderation on AI output shown to users** — `responsePostProcessing.ts` (tone only), `safety.ts` (scores intent/actions, never harmful content). Self-harm/medical/legal/illegal output streams unfiltered. **Fix:** output-moderation pass + self-harm interstitial with crisis resources.
- **`ACCT-3` [MEDIUM] Uploaded docs unscanned** — `projects.ts:379`, `extractDocumentText.ts`. No malware/CSAM/content scan; text enters prompt unscanned (indirect injection). *Mitigated:* raw binary discarded, only text stored. **Fix:** scan/normalize text before prompt insertion.
- **`ACCT-4` [MEDIUM] Injection guard is an 8-phrase blocklist** — `safety.ts:47-56`; paraphrase extracts system prompt + project context. **Fix:** treat brain/retrieved text as untrusted + output-side leak checks.
- **`ACCT-5` [LOW]** CSWSH (WS no CSRF token — likely mitigated by `sameSite=lax`; add explicit Origin check on upgrade); 7-day session no idle timeout (`index.ts:154-159`).
- **✅ Safe:** OAuth-only (no password/reset ATO), session fixation handled, dev routes prod-gated, notifier is not a user-controllable spam relay, no user-enumeration oracle.

---

# PART 2 — Verified-Safe Inventory (what NOT to touch / what's genuinely strong)
- **No breach-class hole:** tenant isolation enforced on every resource route except SEC1-1; WS authenticated + re-checks conversation ownership per message; OAuth state/nonce/PKCE/issuer/aud/exp; session regenerated on login; raw-HTML XSS unreachable; all SQL parameterized; no SSRF; no client-bundle or git-history secret.
- **Autonomy safe by construction:** no destructive code path; cross-tenant approval blocked; cross-project handoff impossible; runaway loops prevented; atomic budget ledger.
- **Types real:** strict enforced, typecheck clean, zero `@ts-ignore`.
- **Firefought infra now solid:** pg-boss wedge watchdog, Supavisor pool, trace-store transactions, Stripe webhook idempotency + raw-body sig verify, WS idempotency/ordering, PCI offload (SAQ-A).
- **Clean seams:** LLM provider registry, 2-array role model, pure `shared/`, injected-generator autonomy pipeline.
- **Correct data modeling:** integer cents, uniqueness constraints, no float in billing; `/auth/me` clean DTO; `.strict()` mutation schemas; UUID + uniform 404.
- **Frontend SOLID**, **UX-integrity clean** (no dark patterns), **notifier not a spam relay**, **honest China disclosure**.

---

# PART 3 — Ordered Fix Roadmap

> Rule of thumb: **Tier 0 before any public traffic. Tier 1 before marketing/scale. Tier 2 is the enterprise climb.**
> Each item lists the findings it closes and a rough effort. Sequenced by dependency + impact.

## TIER 0 — Launch blockers (target: ~1 week of focused work)

| # | Fix | Closes | Effort |
|---|---|---|---|
| **0.1** | Turn billing/safety gates **ON** in prod + add a real **per-user daily cents cap checked before each LLM call** + a global daily-spend hard ceiling. Include multi-agent turns in usage. | `DOS-1`, `OBS-6`, `BUG-3` | **M** |
| **0.2** | **Rate-limit the WebSocket message path** (per-socket + per-user, independent of the billing flag) + gate `/api/deliverables/*` and `/api/packages` with aiLimiter + Pro gate. | `DOS-2`, `DOS-3` | **M** |
| **0.3** | **Fix the IDOR** (add ownership check + Zod on `/api/personality/feedback`) and the **account-takeover** (look up strictly by `(provider, sub)`, drop email fallback, require `email_verified`). | `SEC1-1`, `ACCT-1` | **S** |
| **0.4** | **Migration safety:** `drizzle-kit generate` a baseline snapshot of the live schema, commit it, switch deploy to `drizzle-kit migrate` in a Fly `release_command`; freeze `push` for prod. Staging-first. | `DATA-1`, `TEST-6` | **M** |
| **0.5** | **Backups:** enable Supabase PITR (or scheduled `pg_dump` to object storage) + do **one real restore drill** into a scratch DB. | `DATA-2` | **S** |
| **0.6** | **Error tracking + health probe:** wire Sentry into Express + `uncaught/unhandledRejection`; add a Fly `[[http_service.checks]]` probe on `/api/health` that 503s on `down`. | `OBS-1`, `OBS-2`, `TEST-5`, `INFRA-3` | **S** |
| **0.7** | **Spend alarm:** an aggregate daily-spend alert + hard kill (distinct from the user notifier). | `OBS-6`, `DOS-1` | **S** |
| **0.8** | **Cap the hottest query:** `getMessagesByConversation` → SQL `ORDER BY created_at DESC LIMIT n` + keyset cursor + `messages(conversation_id, created_at)` composite index. | `DOS-4`, `PERF-2`, `BUG-6` | **S** |

**Exit criterion for Tier 0:** a single logged-in user cannot run unbounded LLM cost; a schema change can't drop data and the DB is restorable; the IDOR + ATO are closed; you get paged when something breaks or spend spikes.

## TIER 1 — Fast-follow (target: ~1-2 weeks, before marketing/scale)

| # | Fix | Closes | Effort |
|---|---|---|---|
| 1.1 | Bump `ws`→≥8.21 and `multer`→≥2.2 (same PR, smoke-test). | `DEP-1`, `DEP-2` | S |
| 1.2 | DeepSeek/Groq/OpenAI: pass `signal` + set a 30-45s client timeout (mirror Gemini). | `REL-1` | S |
| 1.3 | pg-boss idempotent retry: short-circuit on `task.status==='completed'` + wrap the post-execution tail. | `REL-3`, `REL-6` | M |
| 1.4 | Stand up **CI** (GitHub Actions): mock-mode unit/gate suites + a new authz-IDOR test + Playwright smoke, required-to-merge; redefine `qa:full` to actually run tests; wire the orphaned budget suite. | `TEST-1`, `TEST-2`, `TEST-3`, `TEST-4` | M |
| 1.5 | Metrics + ops alerting: `prom-client` `/metrics` (spend/queue/WS/error-rate) + provider-down/queue-stall alerts. | `OBS-3`, `OBS-6` | M |
| 1.6 | Fix the CSRF-exemption path bug (unblocks the Stripe webhook in prod). | `SEC1-2` | S |
| 1.7 | **Billing downgrade:** fix the grace guard + handle terminal `subscription.updated` statuses **before flipping gates**. | `BILL-1`, `BILL-2` | M |
| 1.8 | Action-block hardening: Zod-revalidate payload at execution, allow-list `brain.field`, require real consent. | `INJ-1`, `AUT-3` | M |
| 1.9 | Mass-assignment lockdown: strict `personality` allow-list (reject `trustMeta`/adapted*), lock `isSpecialAgent` on create, server-set `messageType`/`agentId`. | `APIX-1`, `APIX-2`, `APIX-4` | S |
| 1.10 | Autonomy: soft-block on missing judge verdict for outward/factual content; broaden the destructive scorer + score the output. | `AUT-1`, `AUT-2` | M |
| 1.11 | Cap `getSharedMemoryForAgent` in the DB path (importance filter + top-N + ORDER BY LIMIT). | `BUG-1`, `PERF-1` | S |
| 1.12 | Scope `GET /api/projects\|agents\|teams` to `*ByUserId`; hoist the per-agent memory read out of the loop. | `PERF-3`, `PERF-1` | M |
| 1.13 | **AI-output moderation** pass + a self-harm interstitial with crisis resources. | `ACCT-2` | M |
| 1.14 | Correct the Privacy Policy (Neon→Supabase/Singapore, re-date) + remove the "DRAFT" banners after a counsel pass; soften the landing "delete everything" claim. | `COMP-2`, `COMP-3`, `COMP-9` | S + legal |
| 1.15 | **A11y front door:** make `ProjectTree`/`LeftSidebar` rows real focusable buttons; remove `maximum-scale=1`. | `A11Y-1`, `A11Y-2` | M |
| 1.16 | Stop logging response bodies; return generic 500s in prod. | `SECRET-1`, `SECRET-2`, `OBS-4` | S |
| 1.17 | WS hardening: `maxPayload`, per-user connection cap, ping/pong reaping; graceful SIGTERM drain. | `DOS-5`, `REL-6` | S |
| 1.18 | Streaming-slot lock: move `add` inside try + atomic acquire. | `BUG-2` | S |
| 1.19 | Non-root container + DB TLS `verify-full` + digest-pin the base image. | `INFRA-1`, `INFRA-2`, `INFRA-4` | S |
| 1.20 | Health check: cache provider pings behind auth + add `SELECT 1` DB probe. | `REL-4` | S |

## TIER 2 — Maturity / enterprise climb (weeks; not launch-gating for a controlled beta)

| # | Fix | Closes | Effort |
|---|---|---|---|
| 2.1 | **Extract the WS-agnostic `respondToMessage()` orchestrator** (typed event stream; WS/HTTP/Mattermost as subscribers). Unblocks integrations + kills chat/autonomy drift + shrinks blast radius. | `ARCH-1`, `ARCH-2`, `CODE-1` | **XL** |
| 2.2 | Install ESLint (`@typescript-eslint` + `react-hooks`), baseline, gate in CI; ratchet down `any`. | `CODE-2`, `CODE-3` | M |
| 2.3 | Right-to-erasure + data-export endpoints; DPA + subprocessor page; enforced region-routing (EU→non-China). | `COMP-1`, `DATA-3`, `COMP-4`, `COMP-5`, `DATA-7` | L |
| 2.4 | Structured logging (pino) + request/WS correlation id + OTel tracing across WS→LLM→DB; security/billing audit stream. | `OBS-4`, `OBS-5`, `OBS-7`, `OBS-8` | M |
| 2.5 | Per-project feature-flag service (ship risky code dark; kill without redeploy). | `TEST-7`, `ARCH-6` | M |
| 2.6 | Frontend: `React.memo` bubbles + virtualize the list + route-level code-splitting. | `PERF-4`, `PERF-5` | M |
| 2.7 | Pool tuning (raise app `max`, separate session-store pool) + evict the unbounded in-memory maps. | `PERF-7`, `PERF-6` | S |
| 2.8 | JSONB atomic writes (`jsonb_set`/locks); version `coreDirection`/`brain`. | `BUG-4`, `DATA-6` | M |
| 2.9 | `purgeProject` FK-order fix + proper `ON DELETE` cascade/set-null semantics. | `DATA-4`, `DATA-5`, `DATA-8` | M |
| 2.10 | Collapse deliverable-type + role registries to single sources of truth; split `IStorage` into domain repos; type the outbound WS contract. | `ARCH-3`, `ARCH-4`, `ARCH-5`, `ARCH-6` | L |
| 2.11 | Fallback chain recovers mid-stream; DeepSeek fallback on token-level failure. | `REL-2` | M |
| 2.12 | Upload content scanning + injection defense beyond the blocklist (untrusted-data framing). | `ACCT-3`, `ACCT-4`, `INJ-2`, `INJ-3` | M |
| 2.13 | Cookie-consent notice, age attestation, upload-PII warning; IP-key limiters on authed routes. | `COMP-6`, `COMP-7`, `COMP-8`, `DOS-8` | S |
| 2.14 | A11y: reduced-motion global, migrate 4 modals to Radix, add skip-link + landmarks, contrast sweep. | `A11Y-3`, `A11Y-4`, `A11Y-5`, `A11Y-6` | M |
| 2.15 | Delete dead code, migrate 41 raw `pool.query` to Drizzle, move 12 `useEffect+fetch` to Query, `MemStorage.createMessage` id. | `CODE-5`, `CODE-6`, `CODE-7`, `BUG-5`, `BUG-7`, `BUG-8` | M |
| 2.16 | **Commission a live pen-test + load test + axe a11y scan** against staging (the dynamic layer this static audit can't cover). | all (validation) | external |

---

# PART 4 — Method & Honest Limits
21 read-only passes (6 security · 7 pillars · 6 deep · 2 focused) by parallel auditors, plus operator
line-by-line verification of every Tier-0 blocker (5/5 confirmed, zero false positives). **Static only** —
findings are code-reads, not executed exploits; no load test, no live pen-test, no automated a11y scan; the
app was not driven and nothing was modified. The remaining ceiling is dynamic (Tier 2, item 2.16). Effort
estimates are rough solo-dev sizes; validate against your own velocity.

*Consolidated from SECURITY-AUDIT.md, GO-LIVE-READINESS.md, DEEP-DIVE-ADDENDUM.md. Nothing merged, nothing modified.*
