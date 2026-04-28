# Phase 35: Production Hotfix Pass — Context

**Gathered:** 2026-04-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Close two production gaps surfaced by the Apr 28 audit:
1. **LEGAL-01 — Privacy/Terms 404:** Footer links exist (commit `3bbab4c`) but `/legal/privacy` and `/legal/terms` routes/pages do not. Clicking either lands on NotFound.
2. **LLMUX — Graceful LLM degradation banner:** Typed error map exists in `CenterPanel.tsx:651-662` (6 error codes mapped to friendly copy) but no surface-level UX for "all providers down" state. Users currently see in-message error fallback only; there's no out-of-band signal.

Plus AUDIT-01 — Playwright runtime spec verifying both fixes end-to-end against a live restarted server (per saved feedback rule "verify in runtime, not just in code/commits").

**Out of scope:** AUTH-GATE-01 (audit confirmed already shipped); rate-limit-specific UX (provider chain handles 429 → next provider, no degradation event); legal page CMS / dynamic content; multi-language legal copy.

</domain>

<decisions>
## Implementation Decisions

### Legal page content sourcing
- **D-01:** AI-drafted privacy + terms copy generated from Hatchin's actual data practices — must explicitly cover: Google OAuth scope (email/profile), Neon Postgres (US region), Stripe billing PII, LLM providers (Gemini / Groq / OpenAI — note that user prompts are sent to these processors), session cookies (httpOnly, 7-day TTL), data retention policy, deletion path.
- **D-02:** Two routes registered in `client/src/App.tsx`: `/legal/privacy` and `/legal/terms` — both wrap content in a simple readable doc layout (max-width prose, white background, no chat shell). Routes are public (no AuthGuard).
- **D-03:** Content lives in two new components (e.g., `client/src/pages/legal/PrivacyPage.tsx`, `client/src/pages/legal/TermsPage.tsx`) — pure markdown-style content, no CMS, no dynamic loading.
- **D-04:** First version is a draft — Claude generates the content, user reviews and edits before merging. The final commit message must say "DRAFT — for legal review" so it's clear to future readers that the copy is not lawyer-reviewed. Last-updated date in the file.

### LLMUX banner placement, style, copy
- **D-05:** Reuse existing shadcn toast infrastructure (`client/src/hooks/use-toast.ts` + `Toaster` mounted in App). No new Banner component.
- **D-06:** When `PROVIDER_DEGRADED` WS event arrives, client calls `toast({ title, description, duration: Infinity, variant: 'default' })` — toast persists until dismissed.
- **D-07:** Default copy: "Agents are slow right now, hang tight" (matches V3 example; matches Hatchin's "human, colleague-style" tone per CLAUDE.md). Can be overridden by `reason` field in WS payload if server wants to send a more specific message.
- **D-08:** Recovery: on next successful streamed response (any `streaming_completed` or `chat_message` event), client dismisses the persistent degradation toast via `toast.dismiss()`. LLMUX-03's "auto-dismiss within 5 seconds of next successful response" is satisfied by the recovery signal arriving on the next message; the 5-second criterion is measured from message arrival, not from a timer.
- **D-09:** Toast does NOT block input — user can keep typing; banner is purely informational.

### PROVIDER_DEGRADED trigger threshold
- **D-10:** Server emits `PROVIDER_DEGRADED` WS event when **3 consecutive requests within a 60-second sliding window** all exhaust the full provider chain (Gemini → OpenAI → Groq fallback all fail). Counter is per-server-instance, in-memory (sufficient for MVP single-node deploy).
- **D-11:** Server emits `PROVIDER_RECOVERED` WS event on the next successful request after a `PROVIDER_DEGRADED` was active.
- **D-12:** Counter resets on any successful request (including partial successes — at least one chunk streamed counts).
- **D-13:** 429 rate-limit errors that route to the next provider successfully do NOT count as failures (only full-chain exhaustion counts). This explicitly excludes transient 429s from triggering the banner.
- **D-14:** Counter logic lives in `server/llm/providerResolver.ts` (or a sibling module — researcher's call). New emit point in `server/routes/chat.ts` WS broadcast helper.

### AUDIT-01 spec scope + deploy gate
- **D-15:** Playwright spec is a **smoke test** at `tests/e2e/phase-35-production-hotfix.spec.ts` — runtime budget ~3-5 min:
  1. Visit landing, click Privacy → assert non-404 + visible legal heading
  2. Visit landing, click Terms → assert non-404 + visible legal heading
  3. Mock provider outage via DEV-only env flag (or test-mode toggle) → make 3 chat requests → assert toast appears with expected copy
  4. Restore providers → make 1 successful chat request → assert toast dismissed within 5s of message arrival
- **D-16:** Spec runs against a live restarted dev server (per saved feedback rule). Fits the existing Playwright structure under `tests/e2e/`.
- **D-17:** After spec passes, **`fly deploy` ships Phase 35 in isolation** — small surface (legal pages + banner toast + audit spec), easy to roll back if production behaves unexpectedly. Don't bundle with Phase 36+ phases.
- **D-18:** Deploy gate is two-step: (a) Playwright smoke pass locally on macOS, (b) typecheck + build pass. No staging environment in current setup.

### Claude's Discretion
- Exact wording of privacy/terms sections (subject to user review pass)
- Toast variant styling (default vs custom)
- DEV-only mock-outage mechanism (env flag vs admin route vs test-mode header)
- Sliding-window counter implementation (array of timestamps vs ring buffer)
- Whether to emit `PROVIDER_DEGRADED` per-socket or broadcast to all (recommend broadcast — degradation is global)

</decisions>

<specifics>
## Specific Ideas

- "Verify in runtime, not just in code/commits" — saved feedback rule. AUDIT-01 must run against a live restarted server, not just unit-test the components.
- "Human-like, colleague tone — not assistant tone" — per `CLAUDE.md` § 7 (Prompt Rules). Banner copy follows this: "Agents are slow right now, hang tight" reads colleague, not corporate.
- "No dollar amounts in primary cost UI" — not relevant to Phase 35 but listed in carried-forward decisions, noted to avoid drift.
- ROADMAP-V3 listed LEGAL-01 as a 5-min task. Audit + this discussion revealed the real scope is closer to 1-2 hr (page content + routes + Playwright). Captured here so the planner doesn't underbudget.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and requirements
- `.planning/REQUIREMENTS.md` § "Phase 35 — Production Hotfix Pass" — full requirement text for LEGAL-01, LLMUX-01..03, AUDIT-01
- `.planning/ROADMAP.md` § "Phase 35: Production Hotfix Pass" — goal, depends_on, success criteria

### Existing code surfaces affected
- `client/src/App.tsx:90-104` — current Router definition; new `/legal/privacy` and `/legal/terms` routes register here
- `client/src/pages/LandingPage.tsx:561,563` — existing Privacy/Terms `<a>` links (already shipped in `3bbab4c`)
- `client/src/pages/login.tsx:86,88` — login page Privacy/Terms links
- `client/src/components/CenterPanel.tsx:645-679` — existing typed `streaming_error` handling with friendly copy fallback (LLMUX-01..03 build on this)
- `client/src/hooks/use-toast.ts` — existing Toast hook (banner reuses this)
- `client/src/components/ui/toaster.tsx` — Toaster component (already mounted in App per scout)
- `client/src/components/chat/ChatMessageList.tsx:113-114` — existing connection-status pill (NOT reused for LLMUX banner per D-05; kept distinct)
- `server/llm/providerResolver.ts` — multi-provider chain; new counter logic lives here per D-14
- `server/routes/chat.ts` — WS broadcast helpers; new emit point for `PROVIDER_DEGRADED` / `PROVIDER_RECOVERED`
- `shared/dto/wsSchemas.ts` — add `PROVIDER_DEGRADED` and `PROVIDER_RECOVERED` event types

### Project conventions and rules
- `CLAUDE.md` § 7 "Prompt Rules" — banner copy tone follows "human-like, colleague tone — not assistant tone"
- `CLAUDE.md` § 16 "Security Checklist" — confirm session/auth still respected on new routes (legal pages are intentionally public per D-02)
- `~/.claude/projects/-Users-shashankrai-Documents-hatching-mvp-5th-march/memory/feedback_verify_in_runtime.md` — runtime verification rule (drives AUDIT-01 design)
- `~/.claude/projects/-Users-shashankrai-Documents-hatching-mvp-5th-march/memory/feedback_ui_change_protocol.md` — UI/UX changes need user approval; the LegalPage and Toast variant designs trigger this. Plan must include a screenshot-review gate before merging.

### Test infrastructure
- `tests/e2e/` — Playwright spec directory (existing). New spec lives at `tests/e2e/phase-35-production-hotfix.spec.ts`
- `tests/e2e/maya-fallback.spec.ts` (referenced) — existing Playwright pattern for chat-related E2E

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useToast` hook (`client/src/hooks/use-toast.ts`) — full shadcn toast API; supports persistent toasts (`duration: Infinity`) and programmatic dismissal (`toast.dismiss(id)`)
- `Toaster` component (`client/src/components/ui/toaster.tsx`) — already mounted in App; no new wiring needed
- `getConnectionStatusConfig` (`client/src/lib/websocket.ts:233`) — pattern reference for "status pill" UI; useful contrast for why we chose Toast instead
- Existing `streaming_error` typed-code mapping (`CenterPanel.tsx:651-662`) — pattern for "typed errors with friendly copy" extends naturally to `PROVIDER_DEGRADED`
- `providerResolver.ts` — multi-provider chain with `fallbackChain` metadata in result; counter hooks in here
- `useRealTimeUpdates` hook — handles all WS event dispatch; `PROVIDER_DEGRADED` / `PROVIDER_RECOVERED` handlers register here

### Established Patterns
- **Public routes vs AuthGuard:** App.tsx wraps protected routes in `<AuthGuard>`; legal pages are intentionally public per D-02 — pattern: register route at top level, no guard wrapper
- **WS event types:** New types added to `shared/dto/wsSchemas.ts` first, then client (`useRealTimeUpdates.ts`) and server (`chat.ts`) consume them
- **Markdown-style content:** Existing `CHANGELOG`, `MILESTONES.md` etc. live in `.planning/`; legal page content can be inline JSX with `<p>` blocks for simplicity (no markdown parser needed for static legal copy)

### Integration Points
- Router add: 2 new routes in `App.tsx`
- WS schema: 2 new event types in `wsSchemas.ts`
- Server: ~30-50 lines in `providerResolver.ts` (sliding-window counter) + ~10 lines emit in `chat.ts`
- Client: ~20 lines in `useRealTimeUpdates.ts` (event handlers calling `toast()` and `toast.dismiss()`)
- Playwright spec: ~80-120 lines; mock-provider-outage helper may need a new dev-only endpoint or env flag

</code_context>

<deferred>
## Deferred Ideas

- **Multi-language legal pages** — out of scope (Hatchin is en-only currently); add to v2.x backlog if i18n becomes a priority
- **Cookie consent banner** — separate compliance question (GDPR), out of Phase 35 scope; add to backlog
- **Provider health dashboard for admins** — internal observability, out of public-surface scope; add to backlog
- **PROVIDER_DEGRADED telemetry / alerting** — Sentry/datadog integration deferred to future infra phase
- **Per-user provider preference** — out of scope; provider chain is global
- **Lawyer review of legal copy** — happens out-of-band; Phase 35 ships AI-drafted DRAFT per D-04
- **Cross-tab toast sync** — if user has 2 tabs open during outage, each gets own toast; out of scope (toast lifecycle is per-tab)
- **Banner cooldown / suppression** — if PROVIDER_DEGRADED fires repeatedly, no rate-limiting on toast frequency in this phase; can add if observed in production

</deferred>

---

*Phase: 35-production-hotfix-pass*
*Context gathered: 2026-04-28*
