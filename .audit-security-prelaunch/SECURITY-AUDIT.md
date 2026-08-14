# Hatchin — Pre-Launch Security Audit (360°, code-level)

**Type:** Production-readiness security review (NOT a feature audit) · **Method:** static, read-only, 6 parallel
domain auditors over the live code on `feat/v2.2-intelligence-fixes` · **Date:** 2026-08-01 · **Nothing changed.**

Scope: every route handler + the WS server, OAuth/session/CSRF, LLM prompt-injection surface, the client
bundle, `npm audit`, cost-cap enforcement, and the autonomy approval gates. Static analysis only — no live
pen-test, no DAST, no fuzzing, the app was not driven.

---

## OVERALL VERDICT: 🔴 NO-GO (fixable) — do not go live until the 4 launch-blockers are closed

Five of six domains are **GO-WITH-FIXES**; one (**DoS / Cost**) is **NO-GO**. There is **no data-breach-class
hole** — tenant isolation, auth, XSS, SQLi, and SSRF are genuinely solid, and autonomy has no destructive
code path. The blockers are **(a) the app ships with its LLM cost brakes OFF and no rate limit on the
WebSocket path that carries the most expensive calls** — a single logged-in user can run your API bill to
the moon — and **(b) one cross-tenant IDOR write.** Both are contained, well-understood fixes.

### 🚧 Launch blockers (must fix before public traffic)

| # | Blocker | Where | Why it blocks |
|---|---|---|---|
| **1** | **No production LLM cost cap; billing/safety gates default OFF** | `middleware/tierGate.ts:8-11`, `autonomy/config/policies.ts:60-61`, `billing/usageTracker.ts:32-69` | Any authed user → unbounded spend on *your* keys. Cost is recorded after the call, never checked before. |
| **2** | **WebSocket message path has no rate limit** (Express limiters are HTTP-only) | `routes/chat.ts:432-440, 532-1160` | `send_message_streaming` in a loop = unbounded LLM cost + event-loop DoS. Only "brake" is the disabled cap from #1. |
| **3** | **Cross-tenant IDOR write** — `POST /api/personality/feedback` mutates another user's agent with no ownership check + no Zod | `routes.ts:381-441` | User A writes attacker-keyed traits + unbounded strings into User B's agent and poisons B's training pipeline. The one route in the codebase missing the ownership check. |
| **4** | **Expensive endpoints ungated** — `/api/deliverables/generate`,`/iterate`,`/api/packages` have no AI rate limit, no Pro gate, no cost cap; `/packages` fans out fire-and-forget | `routes/deliverables.ts:215-260, 263-284, 402-471` | Same unbounded-spend vector as #1/#2 over HTTP; one call spawns N background LLM chains. |

Close those four and this is a **GO-WITH-FIXES** — ship with the High list below scheduled as fast-follows.

---

## Findings by domain (Critical → Low)

### Domain 5 — DoS, Resource & Cost 🔴 NO-GO
- **[CRITICAL]** No prod cost cap; `FEATURE_BILLING_GATES` opt-out by default → no per-user msg/min/project cap. `tierGate.ts:8-11`, `policies.ts:60-61`.
- **[CRITICAL]** WS path unthrottled; `join`/`typing`/`streaming` all unlimited; typing frames fan-out-broadcast. `chat.ts:532-1160`.
- **[HIGH]** `/api/deliverables/*` + `/api/packages` ungated + fire-and-forget fan-out. `deliverables.ts:215-471`.
- **[HIGH]** `getMessagesByConversation` reads the **whole** conversation into Node then `.slice()`s — LIMIT is applied post-fetch. `storage.ts:2219-2242`. (Fix: push `ORDER BY … LIMIT` into SQL like `searchMessages` already does.)
- **[MEDIUM]** WS: no `maxPayload` (≈100 MB frame default), no per-user connection cap, no ping/pong reaping. `chat.ts:432`.
- **[MEDIUM]** Doc parsing inflates the full 10 MB buffer before truncation (DOCX zip-bomb / PDF CPU). `extractDocumentText.ts:26-38`.
- **[MEDIUM]** Autonomy cost cap is **per-project**, so 50×(#projects) for a Pro user. `policies.ts:64-69`.
- **[LOW]** Rate limiters key on `req.ip` → NAT users share a bucket; IP rotation gets fresh buckets. Key authed routes on `session.userId`. `index.ts:74-91`.
- ✅ Safe: atomic race-free autonomy budget (`reserveBudgetSlot`), handoff hop cap = 4, 2 MB body limit, per-conversation stream de-dupe.

### Domain 1 — Auth & Tenant Isolation 🟠 GO-WITH-FIXES
- **[HIGH]** IDOR write `POST /api/personality/feedback` — no ownership check, no Zod. `routes.ts:381-441`. **(Blocker #3.)**
- **[MEDIUM]** CSRF exemptions are **dead code**: mounted `app.use('/api', validateCsrf)` strips `/api`, so `startsWith('/api/billing/webhook')` never matches → in prod the Stripe webhook is 403'd and paid upgrades silently fail; logout needs a CSRF token. Fails *closed* but breaks billing. `index.ts:187-211`.
- **[LOW]** `GET /api/handoffs/stats` returns platform-wide (cross-tenant) aggregates. `routes.ts:468-477`.
- **[LOW]** OAuth base URL trusts `X-Forwarded-Host` when `APP_BASE_URL` unset. `googleOAuth.ts:33-47`.
- **[INFO]** Explicit prod assertion for `SESSION_SECRET` recommended; tier gating defaults OFF (see Domain 5).
- ✅ Safe: **per-resource ownership enforced everywhere else** (404-on-mismatch), **WS authenticated + re-checks conversation ownership on every message**, OAuth state/nonce/PKCE + issuer/aud/exp, session regenerated on login, `returnTo` open-redirect-sanitized, Stripe raw-body sig-verified, Mattermost HMAC `timingSafeEqual`.

### Domain 2 — Injection & Input Validation 🟠 GO-WITH-FIXES
- **[HIGH]** LLM-emitted action blocks (`<!--BRAIN_UPDATE/TASK_SUGGESTION/HATCH_SUGGESTION-->`) drive **real DB mutations** with no runtime Zod re-validation, gated only by fuzzy keyword "consent" (`detectUserPermission`: "ok/great/add/create"). Reachable via prompt injection in an uploaded brain doc or handoff output. **Tenant-bounded** (self-project only), and computed-key assignment blocks `__proto__`. `chat.ts:2411-2555`, `actionParser.ts:57`. Fix: Zod-validate payload at execution, allow-list `brain.field`, require real consent.
- **[MEDIUM]** Brain/DOCX upload: extension-only type check + unbounded decompression (zip-bomb). `projects.ts:364-407`.
- **[LOW]** Safety-gate injection detection is literal-substring only → paraphrase evades. `safety.ts:46-56`. (Signal only.)
- **[LOW]** `searchMessages` LIKE doesn't escape `%`/`_`. Self-scoped. `storage.ts:2167`.
- ✅ Safe: **raw-HTML XSS not reachable** (react-markdown v10, no `rehype-raw`, no `dangerouslySetInnerHTML` on user content, `javascript:` hrefs sanitized), **no SQLi** (all `sql\`\`` parameterized), **no SSRF** (no user-supplied URL is fetched; DDG host is fixed + allow-listed).

### Domain 6 — Autonomy & Business-Logic 🟠 GO-WITH-FIXES
- **Structural (reassuring):** autonomous execution has **no code path to a destructive/irreversible action** — it only calls `generateText` / `createMessage` / `updateTask(status)` and never imports the action parser. The capability envelope is true at runtime because those tools don't exist.
- **[HIGH]** Low-risk-but-harmful output is *reviewed-then-shipped*, and the judge is **fail-open** at every layer (null verdict on any error → no block; prompt says "hold a high bar for BLOCKING"). `taskExecutionPipeline.ts:605-641`, `llmJudge.ts:165-173`.
- **[HIGH]** Destructive-intent scorer is shallow — misses synonyms (remove/purge/truncate/drop/rm…), scores only the **task text not the output**, and a ×0.8 "creative role" discount + creation-intent floor push scores under the gate. `safety.ts:73-127, 189-193`.
- **[MEDIUM]** `BRAIN_UPDATE` consent keyword isn't bound to the specific change; wholesale overwrite. (Cannot touch the `executionRules` autonomy/kill-switch column — that's separate.) `chat.ts:2532-2558`.
- **[MEDIUM]** Peer-review judge is prompt-injectable via the draft it reviews (no delimiter/untrusted-data framing). `llmJudge.ts:77-104`.
- **[MED/LOW]** Mattermost/Slack approve button: HMAC over `(taskId,action)` only — no session, no ownership, no nonce → **replayable**, and any tenant's taskId if the secret leaks. `integrations.ts:21-45`.
- **[LOW]** Handoff carries unsanitized upstream output (confabulation only — cannot trigger a mutation). Fake-action guard is prompt-only.
- ✅ Safe: cross-tenant approval blocked (owner-checked), cross-project handoff impossible, runaway loops structurally prevented (agents can't mint tasks), atomic per-job budget + tier cap + pause kill-switch + stall watchdog.

### Domain 4 — Dependencies & Supply Chain 🟠 GO-WITH-FIXES
`npm audit`: 1 critical / 10 high / 19 moderate / 2 low. Lockfile **clean** (all `https://registry.npmjs.org`, no git/http sources, no unexpected install scripts). Triaged by runtime reachability:
- **[HIGH] `ws` 8.18 → ≥8.21** — mem disclosure + DoS on the core WS path, **non-breaking bump. Most urgent.**
- **[HIGH] `multer` 2.1.1 → ≥2.2** — upload DoS, same-major fix.
- **[MODERATE] `express`, `express-rate-limit`** — in-range bumps.
- **[HIGH] `drizzle-orm` 0.39** identifier-SQLi — **not reachable** (no dynamic identifiers); upgrade is semver-major, schedule it.
- **[HIGH] `langsmith`** SSRF — only if tracing enabled; upgrade before enabling.
- **[CRITICAL] `shell-quote`** — transitive under **drizzle-kit (dev/migration only)**, not in the shipped runtime.
- Dev/build-only (not shipped): vite/postcss/esbuild, brace-expansion, etc.

### Domain 3 — Secrets & Config 🟠 GO-WITH-FIXES
- **[MEDIUM]** API **response bodies logged to the prod console** (no env gate) — PII / token-fragment leak into log sinks. `index.ts:237-256`.
- **[LOW-MED]** Global error handler returns raw `err.message` to clients on 500 in prod. `index.ts:282-287`.
- **[LOW]** `|| process.env.DEV` can widen dev-only paths if `DEV` set in prod. `chat.ts:513,1456`.
- ✅ Safe: **no hardcoded secrets** anywhere, **no client-bundle secret leakage** (no `VITE_` secrets), `.env` gitignored (only `.env.example` tracked, placeholders), env logging redacted, **Helmet CSP on in prod** (`scriptSrc 'self'`), CORS single-origin (no wildcard) + credentials, cookies `httpOnly`+`secure`+`sameSite=lax`, `trust proxy 1`, prod guards fail closed (storage-mode + session-secret + DB URL).

---

## Prioritized remediation order
1. **Blockers 1–4** (cost cap ON + checked-before-call, WS rate limit, IDOR fix, gate deliverables/packages).
2. **Highs:** `ws`+`multer` bump · `getMessagesByConversation` SQL LIMIT · action-block Zod+allow-list+real consent · CSRF exemption path bug (billing integrity) · autonomy judge soft-block-on-null + broaden destructive scorer.
3. **Mediums:** response-body logging · generic 500 · zip-bomb guard · WS `maxPayload`/conn-cap/keepalive · BRAIN_UPDATE consent binding · judge prompt-injection hardening · Mattermost HMAC nonce+expiry · per-user autonomy ceiling.
4. **Lows/Info:** the rest.

## Beyond code (operational, before/at launch)
- Put Cloudflare/WAF + a **hard daily spend alert** on the LLM provider accounts (belt to the code cap's suspenders).
- Rotate any key that has ever been in a shell history / paste.
- Add `npm audit` (and secret-scan) to CI so this doesn't regress.
- This was **static** — commission a live pen-test / DAST pass against staging before or shortly after launch.

*Auditors: 6 parallel domain agents (auth, injection, secrets, deps, DoS, autonomy). Read-only; nothing merged, nothing modified.*
