# Phase 35: Production Hotfix Pass — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-28
**Phase:** 35-production-hotfix-pass
**Areas discussed:** Legal page content sourcing, Banner placement/style/copy, PROVIDER_DEGRADED trigger threshold, AUDIT-01 spec scope + deploy gate

---

## Legal page content sourcing

| Option | Description | Selected |
|--------|-------------|----------|
| AI-drafted from Hatchin's actual data practices | I write privacy/terms covering: Google OAuth scope, Neon Postgres (US-East), Stripe billing (PII), LLM providers (Gemini/Groq/OpenAI — prompts sent), session cookies (httpOnly, 7-day TTL), data retention. Tailored to Hatchin's actual stack. ~30-45 min draft + your edit pass. Best legal accuracy without a lawyer. | ✓ |
| You provide the copy | Tell me where the .md/.html lives or paste it; I wire up the routes + pages. Smallest implementation risk — the legal accuracy is on you. Implementation is ~15 min. | |
| Generic SaaS template | Copy a known-good open-source template (Vercel/Stripe-style) and minimally adapt brand. Fastest (~10 min) but copy may not reflect Hatchin's actual data flows. | |
| Stub with 'Last updated: N/A — draft in progress' | Routes exist, pages render, but content explicitly marked DRAFT. Closes the 404 audit gap without committing to specific terms. | |

**User's choice:** AI-drafted from Hatchin's actual data practices (Recommended).
**Notes:** Implementation will produce a DRAFT version reviewable by user before merge — captured in D-04. Drift risk: if Hatchin's actual data flow changes (e.g., new LLM provider, region change), copy must be updated.

---

## Banner placement, style, and copy

| Option | Description | Selected |
|--------|-------------|----------|
| Toast (reuse existing shadcn toast infra) | Use existing useToast hook. Toast appears top-right or bottom-right, auto-dismisses on recovery via .dismiss() call. Zero new components. Fits 'non-blocking' requirement perfectly. | ✓ |
| Top-of-chat banner (above messages, below header) | Permanent strip until dismissed. Most visible. Requires new Banner component. | |
| Above-input banner (between message list and input box) | Strip just above the chat input. Mid-prominence. Maps well to 'agents slow' framing. | |
| Extend existing connection-status pill | Reuse the connection-status pill (small dot + text). Smallest new code surface. Cons: might be too subtle. | |

**User's choice:** Toast (reuse existing shadcn toast infra) (Recommended).
**Notes:** Default copy locked at "Agents are slow right now, hang tight" per D-07; matches V3 example + Hatchin "human, colleague-style" tone. Server can override via WS payload `reason` field if needed.

---

## PROVIDER_DEGRADED trigger threshold

| Option | Description | Selected |
|--------|-------------|----------|
| Consecutive failures across N requests in a 60s window | Server tracks last N (e.g., 3) requests; if all failed across the full provider chain, emit PROVIDER_DEGRADED. Recovery on next successful request emits PROVIDER_RECOVERED. Avoids false positives on single transient blip. | ✓ |
| Single request — emit on every chain exhaustion | Simplest: when a single request burns through Gemini→OpenAI→Groq and all fail, emit PROVIDER_DEGRADED. Higher false-positive rate. | |
| Separate health-check loop (background ping every 30s) | Cron-style health probe. More infrastructure (extra LLM calls = cost). Best signal accuracy. | |
| Hybrid: emit on first chain exhaustion + clear after 60s of no failures | Bias toward visibility — user sees signal quickly, banner clears soon if blip. Lower complexity than sliding-window counter. | |

**User's choice:** Consecutive failures across N requests in a 60s window (Recommended).
**Notes:** N defaulted to 3 in D-10; planner can adjust if there's a concrete reason but locked otherwise. 429 → next provider successes do NOT count as failures (D-13). Counter is per-server-instance, in-memory (sufficient for current single-node deploy). For multi-node deploy later, this needs coordination.

---

## AUDIT-01 spec scope + deploy gate

| Option | Description | Selected |
|--------|-------------|----------|
| Smoke test + deploy after Phase 35 ships | Playwright spec: link clicks + DEV-only mock provider outage → assert toast → restore → assert dismissed. ~3-5 min runtime. Then `fly deploy` Phase 35 in isolation. | ✓ |
| Full E2E + deploy after Phase 35 | Adds content-correctness checks, real provider outage simulation, multi-tab consistency. ~10-15 min runtime. | |
| Smoke test only — wait to deploy until more phases land | Verify in dev/staging, but don't fly deploy until Phase 36 or 41. Risk: production stays at 3bbab4c (Privacy/Terms still 404 in prod) for weeks. | |
| Full E2E + deploy to staging only first | Push to staging via separate fly app, manual sanity check, then promote. Slowest but safest. | |

**User's choice:** Smoke test + deploy after Phase 35 ships (Recommended).
**Notes:** Deploy gate is two-step per D-18: (a) Playwright smoke pass on macOS, (b) typecheck + build pass. No staging environment in current setup — direct prod deploy. Easy rollback because Phase 35 surface is small. AUDIT-01 spec runs against a live restarted dev server per saved feedback rule "verify in runtime, not just in code/commits".

---

## Claude's Discretion

- Exact wording of privacy/terms sections (subject to user review pass before merge)
- Toast variant styling (default shadcn vs custom)
- DEV-only mock-outage mechanism (env flag vs admin route vs test-mode header) — researcher's call
- Sliding-window counter implementation (array of timestamps vs ring buffer) — planner's call
- Whether to emit `PROVIDER_DEGRADED` per-socket or broadcast to all (recommend broadcast since degradation is global)

## Deferred Ideas

- Multi-language legal pages (i18n)
- Cookie consent banner (GDPR — separate compliance phase)
- Provider health dashboard for admins
- `PROVIDER_DEGRADED` telemetry / alerting (Sentry, datadog)
- Per-user provider preference
- Lawyer review of legal copy (out-of-band, post-merge)
- Cross-tab toast sync
- Banner cooldown / suppression logic
