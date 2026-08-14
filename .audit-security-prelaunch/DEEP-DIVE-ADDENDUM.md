# Go-Live Readiness — Deep-Dive Addendum

**Follow-up to GO-LIVE-READINESS.md.** After the 13-domain breadth pass, a second round went deeper:
I **personally re-verified every Tier-0 blocker** against the code (zero false positives), and 6 more
read-only agents covered the dimensions the breadth pass under-served. **Read-only; nothing modified.**
**Date:** 2026-08-01.

---

## Tier-0 blockers — personally re-verified (not agent-reported)

| Blocker | My own read | Verdict |
|---|---|---|
| IDOR write | `routes.ts:381-441` — `agentId` from body → `getAgent`/`updateAgent`/`storeFeedback`, session-exists check only, no ownership, no Zod | ✅ real |
| Cost gates off by default | `tierGate.ts:8-11` — pass-through unless `FEATURE_BILLING_GATES` is `"true"`/`"1"`; comment confirms opt-in default | ✅ real |
| Full-history read | `storage.ts:2220` — `SELECT … WHERE conversationId` with no SQL LIMIT/ORDER; sorted+sliced in JS | ✅ real |
| No Fly health probe | `fly.toml` — `min_machines_running=0`, `auto_stop`, no `[[http_service.checks]]`, no `release_command` | ✅ real |
| Migration gap | 4 files = 7 `CREATE TABLE` vs 21 `pgTable` in schema; deploy = `drizzle-kit push` | ✅ real |

**Result: 5/5 blockers confirmed against real code. No false positives in the original audit.** The
absence-based ones (no backup, no error tracker, no aggregate spend alarm) were confirmed by grep returning nothing.

---

## Deep-dive results (6 additional pillars)

| Pillar | Verdict | Headline |
|---|---|---|
| Frontend / Client Security | 🟢 **SOLID** | No client XSS, no browser secrets, strict `scriptSrc 'self'`; only LOW/INFO items |
| Infra + **Git-History Secrets** | 🟡 NEEDS-WORK | **Git history CLEAN — no secret ever committed, nothing to rotate**; root container + DB TLS unverified |
| Compliance / Legal / Privacy | 🔴 **NOT-READY** (regulated/EU) | No erasure/export; **privacy policy names the wrong DB (Neon/US vs real Supabase/Singapore)**; DRAFT terms; unconditional China transfer |
| Accessibility (WCAG AA) | 🔴 **GAPS→NOT-COMPLIANT** | Core left-nav is `<div onClick>` — **keyboard/screen-reader can't switch projects**; `maximum-scale=1` blocks zoom |
| Billing / Monetization | 🟡 NEEDS-WORK→AT-RISK | Origination sound (can't self-grant Pro), but **downgrade is broken — cancelled/failed users keep Pro indefinitely** |
| God-file Bug-Hunt (chat.ts+storage.ts) | 🟡 NEEDS-WORK | **`getSharedMemoryForAgent` dumps the ENTIRE project memory into every prompt in prod** (cost/context bomb) |

### New findings that rise to blocker/near-blocker class

**[HIGH — prod-only cost/quality bomb] `DatabaseStorage.getSharedMemoryForAgent` injects the entire, uncapped, unsorted project-memory table into every agent prompt.** `storage.ts:2304-2307` (MemStorage curates to importance≥7/top-5, so dev never shows it). Grows unbounded as memories accumulate → rising per-message token cost and eventual context-window overflow on long-lived projects. **Compounds the cost problem.** Fix: give the DB path the same importance-filter + cap + `ORDER BY … LIMIT` as MemStorage.

**[HIGH — compounds the #1 cost blocker] Multi-agent & safety-intervention responses are never usage-tracked.** `chat.ts:2367,3284-3295` — `recordUsage` is gated on `llmMetadata`, only populated by the single-agent path; team turns record **zero** usage, so even once the cost cap is enabled it under-counts multi-agent spend. Fix: surface aggregate token metadata from the multi-agent path and call `recordUsage`.

**[HIGH — revenue leak] Billing downgrade lifecycle is broken.** `tierGate.ts:53-65` + `webhookHandler.ts:80-102`: the 7-day payment-failure grace is dead code (guard checks `subscriptionStatus==='none'` but grace is only set with `'past_due'`), and `subscription.updated` ignores terminal statuses (`canceled`/`unpaid`/`paused`). Cancelled/failed accounts keep Pro until (if) `subscription.deleted` fires. **Must fix before flipping `FEATURE_BILLING_GATES=true`.** Origination is sound — no route trusts a client tier.

**[HIGH — legal, but cheap] Privacy policy is factually wrong right now.** `PrivacyContent.tsx:101-105` still says data lives in "Neon, United States"; it's actually Supabase, Singapore (since 2026-06-02). Wrong processor + wrong country = a live misrepresentation. Plus the legal docs render a "DRAFT — for legal review" banner while login binds users to them. Fast fixes, real exposure.

**[HIGH — ADA/EAA] Core navigation is keyboard-inaccessible.** `ProjectTree.tsx` (~13 rows) + `LeftSidebar.tsx:515` use `<div onClick>` with no `role`/`tabIndex`/`onKeyDown` — a keyboard/screen-reader user cannot switch project/team/agent at all. Plus `index.html:5` `maximum-scale=1` disables zoom. Both are hard WCAG AA fails.

### Other notable deep findings (Medium)
- **Streaming-slot lock can wedge a conversation permanently** (`chat.ts:1021` add-before-try; a `ws.send` throw skips the `finally` that clears it) + a TOCTOU that lets two concurrent sends stream on one conversation. `chat.ts:1005-1075`.
- **JSONB last-write-wins clobber** on brain/personality/coreDirection — concurrent writes silently lose one update (most reachable: two users' `adaptedTraits` racing). `chat.ts:2532,2955,3242`.
- **`searchMessages` matches project by substring** (`LIKE '%projectId%'`) — cross-project leak if one id is a substring of another (low risk with UUIDs, real with seed ids) + unescaped LIKE wildcards.
- **`MemStorage.createMessage` ignores caller `id`** → dev message-reconciliation differs from prod (masks id bugs in testing).
- **Infra:** container runs as **root** (`Dockerfile`), **DB TLS `rejectUnauthorized:false`** (`db.ts:27`, MITM-able), floating `node:20-slim` tag.
- **Frontend:** leftover `https://replit.com/replit-dev-banner.js` in `index.html` (CSP-blocked in prod), and the **inline theme-flash script is blocked by your own prod CSP** (functional bug: theme flash) — the CSP was never validated against the shipped page.

### Reassuring deep-dive confirmations
- **Git history is clean** — no live secret ever committed; nothing to rotate. (The scariest unknown, cleared.)
- **Frontend security is SOLID** — no XSS reachable, no browser-stored secrets/tokens, CSRF interceptor works, WS ingress Zod-validated.
- **You cannot self-grant Pro** — tier is webhook/checkout-only; PCI correctly offloaded to Stripe (SAQ-A).
- **UX-integrity is clean** — no dark patterns; cancel is as prominent as upgrade.

---

## Revised launch-blocker picture (breadth + deep, consolidated)

**Tier 0 (unchanged core) —** cost cap + WS rate limit, migration baseline + backup, the IDOR, error-tracking + Fly health probe, aggregate spend alarm, the hot-query cap.

**Promoted into Tier 0/1 by the deep dive:**
- **Billing downgrade fix** — before enabling gates, or you leak Pro. *(if monetization is on at launch)*
- **Multi-agent usage tracking + `getSharedMemoryForAgent` cap** — both compound the cost blocker; a cap that doesn't count multi-agent spend and a prompt that grows unbounded undo each other.
- **Privacy-policy correction (Neon→Supabase) + un-DRAFT the terms** — cheap, and currently a live misrepresentation.
- **A11y core-nav keyboard access + remove `maximum-scale=1`** — ADA/EAA exposure; the nav fix is mechanical.

**Tier 2 additions:** non-root container, DB TLS `verify-full`, digest-pin the base image, right-to-erasure/export endpoint + DPA/subprocessor page + enforced region-routing (the full EU/enterprise compliance climb), reduced-motion global, modal focus-trap migration, JSONB atomic writes, streaming-lock hardening.

---

## Wave 4 — Cyber-security & user-safety focused passes (API-leak / ATO / content-safety)

Added specifically for "API leaking / cybersecurity / user safety." Two read-only passes.

### API excessive data exposure (API3) + mass assignment (API6) — verdict: GAPS (no live leak)
- **Definitive answer on the per-user `personality` blob leak: NO live cross-user leak today.** Hatchin has
  no project-sharing/member model (grep for collaborator/member/shared_with/invite = nothing), so an agent's
  `adaptedTraits[userId]`/`adaptationMeta[userId]` map only ever holds the single owner's own key. **But it's
  latent:** `GET /api/agents|…/agents` returns the full raw `personality` blob (`agents.ts:53,66,79`), so the
  instant any multi-user/shared-project feature ships, those endpoints leak **every** collaborator's adapted
  traits + feedback. Fix now with a DTO that drops `adaptedTraits`/`adaptationMeta`/`trustMeta`.
- **[MEDIUM] Mass assignment of `personality` incl. `trustMeta.trustScore` via agent PATCH/PUT** —
  `agents.ts:10` uses `personality: z.record(z.unknown())` (open blob) → blind `.set(updates)`. An authorized
  client can `PATCH` `{"personality":{"trustMeta":{"trustScore":1}}}` and **overwrite the progressive-trust
  state that relaxes the autonomy safety thresholds** (+0.15). A client-writable path into safety-gate
  relaxation — real integrity issue even single-user. Fix: strict personality allow-list; never accept
  `trustMeta`/`adaptedTraits`/`adaptationMeta` from the client.
- **[MEDIUM] `isSpecialAgent` settable on agent create** (`agents.ts:92`, `insertAgentSchema` only omits id) —
  client can self-grant conductor/speaking-authority priority. Bounded to own project. Fix: omit/force it server-side.
- **[LOW] Autonomy events with `projectId===null` returned to every user** (`autonomy.ts:632`), message
  `messageType`/`agentId` spoofable in own conversation (`messages.ts:152`), verbose `err.message` in some 500s.
- ✅ **Correctly built:** `/api/auth/me` is a clean DTO — does NOT leak `providerSub`/`stripeCustomerId`/
  `graceExpiresAt`; project/team/task mutations are `.strict()` allow-lists (no ownership-takeover/reparent);
  UUID ids + uniform 404 (no enumeration oracle).

### Account-takeover + content/AI-output safety — verdict: A) GAPS · B) AT-RISK (product-harm)
- **[HIGH — account takeover] Email fallback re-binds accounts.** `upsertOAuthUser` (`storage.ts:1849-1866`)
  looks up `getUserByProviderSub() || getUserByEmail()` and on the email hit **overwrites `provider_sub`**.
  Identity is NOT strictly keyed on the stable Google subject — a reassigned Workspace email lets a new person
  inherit the prior owner's entire account; latent cross-provider hijack if a 2nd provider is added. Fix: look
  up strictly by `(provider, sub)`; never email-fallback on unauthenticated login. (Also: require
  `email_verified === true`, `googleOAuth.ts:152`.)
- **[HIGH — user safety] ZERO app-layer moderation on AI output shown to users.** `responsePostProcessing.ts`
  is tone/format only; `safety.ts` scores intent/actions, never harmful **content** (self-harm, medical/legal
  danger, hate, illegal instructions). Model output streams to users unfiltered — you rely entirely on the
  providers' own safety. Add an output-moderation pass + at minimum a self-harm interstitial with crisis resources.
- **[MEDIUM] Uploaded docs unscanned** (`projects.ts:379`) — extension-only validation, no malware/CSAM/content
  scan; text enters the prompt unscanned (indirect-injection vector). *Mitigated:* raw binary is discarded, only
  extracted text is stored/never served back — so the CSAM/malware-*storage* vector is largely absent.
- **[MEDIUM] Injection/exfil guard is an 8-phrase English blocklist** (`safety.ts:47`) — any paraphrase/
  non-English/doc-embedded instruction bypasses it and can extract the system prompt + in-window project context.
- **[LOW] Flag to confirm:** cross-site WebSocket hijacking — WS carries the mutation surface with no CSRF token;
  **likely already blocked by `sameSite=lax`** (a cross-site WS handshake won't send the cookie), but add an
  explicit `Origin` check on upgrade as belt-and-suspenders.
- ✅ **Safe:** OAuth-only = no password/reset ATO surface; session fixation handled (regenerate on login);
  dev-login prod-gated; the notifier is NOT a user-controllable spam relay (channel/token from deploy env, not
  user input); no user-enumeration oracle.

**Net for "API leaking / cyber / user safety":** no *live* data breach — API-object auth, tenant isolation,
enumeration, and the sensitive DTOs are sound. The real items are: **(1)** the account-takeover email fallback
(HIGH, fix before launch), **(2)** no AI-output moderation (HIGH product-safety, add a guardrail), **(3)**
mass-assignable `trustMeta` feeding safety-gate relaxation (MEDIUM), and **(4)** the latent personality-blob
over-exposure that becomes a real leak the day sharing ships. The plus `[[UPDATE]]`/action-block writes and the
IDOR from the security wave round out the "authorized-but-too-much" surface.

---

## The honest ceiling of this audit
This is now about as deep as **static, read-only** analysis goes — 19 domain passes, blockers personally
verified, the two god-files read end-to-end, git history scanned. The remaining ceiling is **dynamic**:
a live pen-test (actually firing the exploits), a load test (measuring the perf cliffs), and an automated
a11y scan (axe) — all of which require executing against a running instance / mutating state, which was
explicitly out of scope this round. Commission those against staging before or right after launch.

*13 breadth + 6 deep read-only auditors + operator-verified blockers. Nothing merged, nothing modified.*
