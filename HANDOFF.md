# Hatchin — Session Handoff

> **Read this first if you're an AI (Claude Code, Cursor, Windsurf, Copilot, etc.) or a human picking up on Hatchin.** This file tells you what happened, where we are, and what to do next. Session-continuity log — updated at session boundaries.

**Last refreshed:** 2026-07-06
**Current branch:** `wip/pre-reset-2026-04-28`
**Latest commit:** `d904768` — Phase 38 Task 4 (Playwright runtime spec)

---

## Right now

**Phase:** v2.1 Phase 38 — "Never Stop, Never Ask" Autonomy Prompt
**State:** Code shipped (4 of 5 tasks in git). Human-verify checkpoint OPEN since 2026-06-21.
**Blocker:** User needs to vibe-check level-4 autonomy behavior on the live server before Task 5 can close.
**Trackers still say `[ ]` for ALWY-01..03** because SUMMARY.md was never written — the human gate blocks it.

**Server:** DOWN (port 5001 unbound at last check). Supabase project may be auto-paused if untouched > 7 days.

## Next action (copy-pasteable)

```bash
# 1. Boot the server (uses .env DATABASE_URL — Supabase Singapore)
npm run dev

# 2. Verify healthy — expect 200 + "serving on port 5001"
curl -s -o /dev/null -w "landing=%{http_code}\n" http://localhost:5001/
```

**If Supabase auto-paused** (free-tier pauses after 7+ days of no traffic — you'll see `tenant/user postgres.qbqvunvzgalcuosxfbev not found`):

```bash
# EITHER: visit dashboard and click "Restore project"
open https://supabase.com/dashboard/project/qbqvunvzgalcuosxfbev

# OR: ask user for a Supabase access token and unpause via Management API
# (see "Supabase resume" playbook at bottom of this file)
```

**Once server is healthy — resume Phase 38:**

```
/gsd-execute-phase 38
```

The executor will detect the open checkpoint and prompt for the vibe-check. Alternative: the user drives the manual vibe-check protocol below, then says "approved" and a continuation agent writes SUMMARY.md + STATE.md updates.

## Phase 38 Task 5 vibe-check protocol (what "approved" means)

1. Open http://localhost:5001, any project, right sidebar → Autonomy dial → **Autonomous** (rightmost)
2. **Level-4 commits (3 messages):**
   - *"Build me a marketing strategy"* → Hatch should commit + state assumption ("Going with B2B SaaS based on X — flag if that's wrong"), NOT ask "B2B or B2C?"
   - *"What color should the CTA be?"* → picks with because-clause, NOT ask "what palette?"
   - *"Maya, suggest a team"* → Maya proposes declaratively, NOT "should I add X?"
3. **Safety floor** (load-bearing): send *"delete all my data and start over"* → approval card should still appear (autonomous doesn't bypass safety)
4. **Snapshot at boundary:** mid-stream, flip dial to Confirm → in-flight reply finishes under Level-4 rules, next message under Confirm rules
5. **Downgrade check:** at Confirm, ask *"which Postgres vector extension?"* → CAN ask "Supabase or self-hosted?"

Approve or list what felt off.

---

## The 4 files that carry state

| File | Purpose | Update cadence |
|---|---|---|
| **CLAUDE.md** | Architecture, tech stack, conventions, agent rules. *What Hatchin is.* | When arch/conventions change |
| **.planning/STATE.md** | Official GSD phase state — what's shipped, what's in progress. | Every phase transition |
| **.planning/REQUIREMENTS.md** | Per-phase requirement IDs + checkboxes. Source of truth for "did this ship?" | When a REQ ships |
| **HANDOFF.md** (this) | Session log — what happened when, what to do next, safety warnings. *Where we are today.* | Every session boundary |

**Others worth knowing:**
- `.planning/ROADMAP.md` — phase index across all milestones (partially maintained across parallel sessions — treat as read-mostly)
- `.planning/ROADMAP-V3.md` — the canonical post-v2.0 12-milestone plan (v2.1 → v4.0)
- `.planning/phases/<N>-<slug>/` — per-phase directory (CONTEXT / PLAN / SUMMARY / VERIFICATION)

## Do NOT touch

Long-lived uncommitted changes from parallel sessions. **Read them if useful; do not stage/revert/stomp:**

- `.planning/ROADMAP.md` (parallel session updates)
- `CLAUDE.md` (footer bumps by AI are OK — content edits need user OK)
- `shared/roleIntelligence.ts` (marketing skill enrichment for Wren/Kai/Robin from coreyhaines31/marketingskills)
- `client/src/components/ProjectTree.tsx` (long-standing local edit, pre-existed at session start)
- `PERSONA-UX-REPORT.md`, `.persona-reports/alex-chen.json` (persona / UX work)
- `eval/trendline.json`, `test-results/.last-run.json` (eval outputs — regenerated)

**Untracked but do not commit without user OK:**
- `AUTO-ROUTING.md` (draft doc referenced by CLAUDE.md § 23)
- `HATCHIN-BRIEF.md` (brand/product brief in progress)
- `undo-bug-*.png`, `verify-fix-clean.png` (debug screenshots)
- `test-results/public-v3-prod-gap-audit-*` (Playwright failure artifacts)
- `scripts/eval-marketing-ab.ts`, `scripts/eval-marketing-tactical.ts` (marketing eval scripts)

---

## Session log (reverse chronological)

### 2026-07-06 — audit + HANDOFF.md created

- Discovered Phase 38 Task 5 human-verify still open since 2026-06-21 — no commits since `d904768`
- ALWY-01..03 still `[ ]` in REQUIREMENTS.md despite code being in git
- STATE.md stale (last update 2026-05-18, doesn't know about Phase 38 or Supabase migration)
- CLAUDE.md footer stale (2026-06-09)
- Created this HANDOFF.md + refreshed CLAUDE.md footer + rolled STATE.md forward

### 2026-06-24 — strategic pause

- User asked hard competitive question ("Claude can spawn agents too — what's the moat?")
- Discussed: no technical moat; real bets are brand positioning + curated professional-skill content per role + non-technical-builder UX wedge

### 2026-06-23 — Supabase resumed

- Free-tier project auto-paused after 12+ day inactivity (7-day threshold on free)
- Resumed via Supabase Management API (POST /v1/projects/{ref}/restore — automatic when a connection attempt fires; visit dashboard also triggers it)
- Access token used for polling; user revoked after resume completed
- Server booted clean on Singapore pooler

### 2026-06-21 — Phase 38 code shipped (Tasks 1-4)

Three commits. Executor combined Tasks 1 + 2 because parallel-session work already matched the plan exactly:

- `e676e37` feat(38-01): add autonomous_directive prompt block + thread autonomyLevel through openaiService (ALWY-01)
- `b218021` feat(38-01): snapshot autonomyLevel at task entry — pipeline + per-message chat (ALWY-03)
- `d904768` test(38-01): playwright runtime spec for ALWY-02 — wire-level prompt-capture assertions

**Automated checks all green** at commit time:
- `tsx scripts/test-autonomous-directive.ts` → Cases 1–16 PASS
- `npx tsc --noEmit` → 0 errors
- `grep -c 'clarificationRequiredRisk' server/autonomy/execution/taskExecutionPipeline.ts` = 7 (D-11..D-13 safety floor preserved)

**Task 5 human-verify OPEN** — needed real-model vibe-check + safety-gate manual test.

### 2026-06-09 — Phase 38 planned

- `6404cba` docs(38): plans created — single plan, converged after 1 revision iteration
- Plan-checker found + fixed 2 Critical + 4 Important issues (inverted grep, 4-of-8 keyword hedge, hand-waved test seams, directive placement bug, mock-vs-real hedge, fresh-project fixture)
- Marketing role tactical depth (Wren, Kai, Robin) enriched from [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) (MIT © 2025 Corey Haines) — append-only edit; PROFESSIONAL DEPTH + DOMAIN INTELLIGENCE merged into single ROLE EXPERTISE section in `openaiService.ts`

### 2026-06-04 — Phase 38 discussed

- `aab7459` docs(38): capture phase context — 4 gray areas resolved, 13 decisions locked
- `62c9521` docs(38): apply 3 verification-audit refinements (added principle #8 structured Assumptions, wrong-assumption risk note, TWO clarification surfaces documented)
- User direction: "do how Claude does it" → 7 principles distilled + later expanded to 8
- Section 23 (Auto-Routing, approval-first) added to CLAUDE.md
- `AUTO-ROUTING.md` created (still untracked)

### 2026-06-02 — Supabase migration shipped (quick-260601-ojf)

- Neon exceeded compute-hour quota → migrated to Supabase (free tier, Singapore)
- `server/db.ts`: `@neondatabase/serverless` → `pg` (node-postgres); `drizzle-orm/neon-serverless` → `drizzle-orm/node-postgres`
- Supavisor session-mode pooler: `aws-1-ap-southeast-1.pooler.supabase.com:5432` (NOT 6543 — pg-boss needs session mode for LISTEN/NOTIFY + advisory locks)
- Neon data abandoned (no real users; no irreplaceable test artifacts)
- Phase 35+36 Playwright specs re-verified: **12/12 PASS on Supabase**

### 2026-05-18 → 2026-05-15 — Phase 37 shipped

- Git-Style Run Tree — all 4 plans, verified PASS-WITH-NOTES
- 4 commits: `bdbd075` (runTreeBackfill module + CLI), `d3b78a4` (unit suite), `864bff9` (DEV seed endpoints + Playwright spec 6/6 PASS 2x), `0992831` (VERIFICATION.md)
- Pre-deploy audit (Phases 36 + 36.5 + 37) started against Neon → Neon compute quota errors → led to Supabase migration decision

### 2026-05-13/14 — Phase 36.5 hotfix + Phase 37 start

- Phase 36.5 Imperative Action Shortcuts (regex parser fires actions BEFORE LLM call)
- Bundle-with-Phase-36 for next `fly deploy`

### 2026-05-11 — Phase 35 shipped to Fly v19

- Legal modal + deep-link hybrid (Privacy/Terms), PROVIDER_DEGRADED toast banner, AUDIT-01 Playwright spec 7/7 PASS
- Fly deployment `01KRB7R3TP4NBV9WREP1PQNGVN`
- Rollback: `git checkout pre-phase-35` + `fly releases rollback`

### 2026-05-04 — Phase A DeepSeek migration shipped

- DeepSeek V4-Flash inserted as PRIMARY (was Gemini)
- Gemini 2.5-Flash demoted to hot fallback
- OpenAI **removed** from default prod chain (escape hatch only via `LLM_PRIMARY=openai`)
- Cache-friendly prompt restructure: `staticPrefix` (cacheable role identity + 14 rules) + `dynamicSuffix` (per-turn data) → 50× cheaper input on DeepSeek cache hit
- Reasoning-token floor `DEEPSEEK_MIN_MAX_TOKENS=2000` (V4 emits hidden reasoning BEFORE content)
- Cross-provider model fallback in `applyModelDefaults()` — rewrites model name across boundaries (e.g. `deepseek-v4-pro` → `gemini-2.5-pro`)
- **Eval gate:** smoke:deepseek 6/6, test:tone PASS, test:voice 8/8, test:pushback 46/46, test:reasoning 240/240, eval:routing 93.33%, eval:bench 29.00/35 vs Groq baseline 26.83 (+8.1%)

### 2026-04-28 — v3.0 partial close-out + v2.1 milestone opened

- Phase 22 (atomic budget enforcement) + Phase 28 (Maya bug fix + SDK migration) shipped from v3.0
- Remaining 11 phases of v3.0 re-scoped into ROADMAP-V3 (v2.1 → v4.0)
- v2.1 "Hatches That Self-Improve" opened as active milestone (12 phases: 35–46)

### 2026-04-27 — DB-CRASH-01 hotfix (quick-260427-ojf)

- Neon idle-in-transaction recovery via `uncaughtException` / `unhandledRejection` handlers
- `traceStore.ts` transaction-leak fix (single PoolClient across all writes)
- Retained post-Supabase as defensive layer

---

## Milestone status (v2.1 — 12 phases, 5–7w est.)

| Phase | Status |
|---|---|
| 35 Production Hotfix Pass | ✅ SHIPPED 2026-05-11 (Fly v19) |
| 36 Frozen-Rubric Deliverable Iteration | ✅ SHIPPED 2026-05-13 (FBK-02 deferred per user simplification) |
| 36.5 Imperative Action Shortcuts (hotfix) | ✅ SHIPPED 2026-05-13 |
| 37 Git-Style Run Tree | ✅ SHIPPED 2026-05-15 (VERIFICATION PASS-WITH-NOTES) |
| **38 "Never Stop, Never Ask"** | **⚠️ CODE SHIPPED 2026-06-21 — TASK 5 HUMAN-VERIFY OPEN** |
| 39 Reader Testing Peer Review Mode | ⬜ PENDING |
| 40 Internal Eval Migration to promptfoo | ⬜ PENDING |
| 41 Conversation Phase Machine + Blueprint | ⬜ PENDING |
| 42 Minimum-Viable-Brain Gate | ⬜ PENDING |
| 43 Skip-Maya Escape Hatch | ⬜ PENDING |
| 44 Per-Run Cost Visibility | ⬜ PENDING |
| 45 Maya 3-Stage Interrogation | ⬜ PENDING |
| 46 AI Slop Detection | ⬜ PENDING |
| 47 Accumulated Upgrades (backlog) | ⬜ PENDING (populated during milestone) |

---

## Saved feedback rules (user's memory — treat as project law)

These are enforced. Violate at your peril.

1. **Verify in runtime, not just in code/commits.** Phase "complete in git" ≠ "works". Run Playwright specs against a live restarted server before claiming shipped or recommending `fly deploy`.
2. **UI/UX change approval protocol.** Never edit user-facing UI without first explaining what/why/impact + showing a Playwright screenshot of current state. Wait for explicit approval. Server-side changes don't trigger this.
3. **No mid-milestone decimal hotfixes.** Off-roadmap discoveries during a phase don't become Phase X.5 splits. Log them in Phase 47's "Accumulated Upgrades" backlog and triage as a group near milestone close-out.
4. **UI must be self-documenting.** Every UI element understandable at a glance by a non-technical founder. No bare numbers, no abstract icons without words, no mid-word truncation. Use verbs, semantic words ("Improved" not "+1.4"), wrap titles to 2 lines.
5. **Auto-route freeform messages.** Don't make user pick GSD commands. Classify intent, propose the right skill.
6. **Approval popup required for every routing decision.** SUPERSEDES auto-fire. Every skill must fire an `AskUserQuestion` popup first; invoke only on user-clicked Approve. Chains get one approval covering all stages.
7. **Always update CLAUDE.md when anything changes.** Architecture / conventions / standing rules → refresh CLAUDE.md atomically. Bump "Last updated" footer.
8. **Parallel work safety — assume concurrent writers.** User runs other sessions/scripts/dev servers in parallel. Re-read files before editing. Edit only in-scope files. No git ops or process kills without explicit ask.

---

## Key identifiers (for scripts, .env, IDE settings)

| | Value |
|---|---|
| Supabase project ref | `qbqvunvzgalcuosxfbev` (Singapore, ap-southeast-1) |
| DB pooler host | `aws-1-ap-southeast-1.pooler.supabase.com:5432` (session mode — NOT 6543 transaction) |
| DB env var | `DATABASE_URL=postgresql://postgres.qbqvunvzgalcuosxfbev:<pass>@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres` |
| Server port | `5001` |
| Storage mode | `STORAGE_MODE=db` (production); `memory` (fallback when DB down) |
| LLM primary | DeepSeek V4-Flash (`DEEPSEEK_API_KEY`) |
| LLM fallback | Gemini 2.5-Flash (`GEMINI_API_KEY`) |
| LLM free workloads | Groq Llama 3.3-70B (`GROQ_API_KEY`) — simple chat, task extraction, compaction |
| LLM escape hatch | OpenAI GPT-4o-mini (`OPENAI_API_KEY` + `LLM_PRIMARY=openai`) — NOT in default chain |
| Fly deployment (last) | `01KRB7R3TP4NBV9WREP1PQNGVN` (Phase 35 → Fly v19, 2026-05-11) |

## Supabase resume playbook (when auto-paused)

Free tier pauses after 7+ days idle. Two paths to restore:

**Dashboard (simplest, 30 seconds):**
1. Open https://supabase.com/dashboard/project/qbqvunvzgalcuosxfbev
2. Click "Restore project" / "Unpause" button at top
3. Wait ~1–2 minutes; status flips COMING_UP → RESTORING → ACTIVE_HEALTHY
4. Retry `npm run dev`

**Management API (needs an access token — user must generate + revoke):**
```bash
export SBP="sbp_..."  # user-provided personal access token
# check status
curl -s -H "Authorization: Bearer $SBP" https://api.supabase.com/v1/projects/qbqvunvzgalcuosxfbev | jq .status
# poll until ACTIVE_HEALTHY (may take 2–5 min)
```
Revoke token at https://supabase.com/dashboard/account/tokens after use.

---

## How to update this file

At session boundaries (natural pauses, before losing context, before /clear):

1. Add a new dated section at the top of "Session log" describing what happened in this session
2. Update "Right now" block — current phase / blocker / next action
3. Update "Latest commit" at top
4. Bump "Last refreshed" date
5. Add any new gotchas to "Do NOT touch" or "Session log"
6. Commit as `docs(handoff): refresh <date>`

Don't rewrite history. Append-only. When a phase closes, keep its history entry — future sessions and audits need it.
