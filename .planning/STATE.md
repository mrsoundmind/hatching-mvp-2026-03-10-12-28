---
gsd_state_version: 1.0
milestone: v2.1
milestone_name: Hatches That Self-Improve
status: v2.1_phase_38_CLOSED_2026-07-21_all_5_plans_shipped_ALWY-01..06_all_verified_next_is_phase_39
stopped_at: Phase 38 CLOSED 2026-07-21 (all 5 plans; ALWY-01..06 all verified; Plan 38-05 vibe-check ran on the DeepSeek chain). On top of that, the 2026-07-17 audit + two follow-up audits (re-audit 2026-07-20, activity-feed audit 2026-07-21) are fully remediated on branch `fix/audit-remediation-2026-07-17`, waves 1-8, every finding fixed and runtime-verified. Nothing is unpushed. The NEXT open work is the deploy decision (merge PR #2 + fly deploy) OR starting the remaining v2.1 phases. Remaining v2.1 phases NOT started: 39 (Reader Testing Peer Review), 40 (promptfoo migration), 41 (Phase Machine + Blueprint), 42 (MVB Gate), 43 (Skip-Maya), 44 (Per-Run Cost), 45 (Maya 3-Stage), 46 (AI Slop Detection), plus Phase 47 backlog (19 items) and the new v2.1-UX milestone. Prior phases: Phase 35 shipped to Fly v19 2026-05-11; Phases 36/36.5/37/38 are code-complete and verified but NOT yet deployed (still on this branch, only Phase 35 is in prod). Infra: Supabase migration 2026-06-02, DeepSeek V4-Flash 2026-05-04.
last_updated: "2026-07-27T12:00:00.000Z"
last_activity: 2026-07-31 — after Phase 4, fixed two user-reported **return-briefing** bugs (pre-existing Phase 2.4): the "While you were away" card showed "You" instead of Maya (`ebdc719`, UI — force Maya when the briefing's agentId is null, verified live 4/4 cards) and appeared doubled from a check-then-act race on concurrent WS joins (`d249d33`, server — per-project in-flight guard + already-briefed-in-window check; effective on next restart). Prior this session: v2.1-UX **Phase 4 (Brain Tab Information Architecture) shipped** on `feat/v2.2-intelligence-fixes`: cross-verified the live Brain-tab audit (6/8 findings valid + unfixed, 2 overtaken by Phase 0), added the phase via GSD, then fixed all 6 in 4 Playwright-verified commits (6177021 rename mislabeled Packages + honest empty state + kill duplicate name; 2c6f6a9 Knowledge Base leads + one Autonomy header; 5756cce real doc titles no more "Untitled Document"; 29727a4 count pills + 13px bold headers + desktop 44px). No plumbing touched; color rule held; nothing merged. VERIFICATION.md in `.planning/phases/v2.1-ux-04-brain-tab-ia/`. Prior: 2026-07-27 — v2.1-UX UI milestone (adopted from the 2026-07-20 UX Remediation Brief) shipped Phases 0-2 as 13 Playwright-verified UI commits on `feat/v2.2-intelligence-fixes` (parallel to, and path-disjoint from, the v2.2 intelligence work): Phase 0 Inter load + 13px type-scale floor + 44px hit areas; Phase 1 completion card + delegation entrance + waiting-state watchdog; Phase 2 landing subhead + stale-meta fix + pushback-proof section + plain-voice pricing + "While you were away" card. Color rule held (navy/blue frozen, orange kept, additive amber/green). Phase 3 intentionally not built. Nothing merged. Prior: 2026-07-21 — Wave 8 activity-feed audit fixes shipped (commits b51f81b, 571145b, aeba012): approval-card reason-code leak closed on both surfaces via shared humanizeRiskReasons; feed visual coherence via /ui-genius (a face on every row, "?" bubble → neutral system mark); approval events made durable (approval_required/granted/rejected logged so the Approvals filter populates); handoff respects explicit assignee. All verified live on the DeepSeek server (PID varies; started with LLM_MODE=prod LLM_PRIMARY=deepseek + dev cost cap for verification). Earlier the same day: Phase 38 closed via 38-05 vibe-check (which caught + fixed a pre-existing safety-message truncation, e61be9b), and Wave 7 fixed the pg-boss worker-recovery gap (the intermittent-autonomy bug, 57f2c94). Full audit record: `.audit-2026-07-17/REMEDIATION-LOG.md` (waves 1-8) + `.audit-reaudit-2026-07-20/`.
progress:
  total_phases: 13
  completed_phases: 5
  total_plans: 24
  completed_plans: 24
  percent: 38
---

# State: Hatchin

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-28)

**Core value:** No one should ever feel alone with their idea, have to start from scratch, or need to know how to prompt AI — just have a conversation and your team takes it from there.
**Current focus:** v2.1 milestone — Phase 38 CLOSED 2026-07-21, and the 2026-07-17 audit plus two follow-up audits are fully remediated (branch `fix/audit-remediation-2026-07-17`, waves 1-8, all verified live). **Open decision: deploy (merge PR #2 + fly deploy) vs. continue building v2.1 phases 39-46.** Phase 35 is in prod (Fly v19 2026-05-11); Phases 36/36.5/37/38 + all audit waves are code-complete and verified but NOT yet deployed. Infra: Supabase Singapore 2026-06-02; DeepSeek V4-Flash primary 2026-05-04. Marketing role tactical enrichment (Wren/Kai/Robin) shipped 2026-07-10.

---

## Current Position

Phase: 38 ("Never Stop, Never Ask" Autonomy + Autonomy Safety — expanded 2026-07-09) — ✅ **CLOSED 2026-07-21.** All 5 plans shipped, ALWY-01 through ALWY-06 all verified.
Plans complete: 5 / 5
Status: **Phase 38 CLOSED 2026-07-21.** Plan 38-05 human-delegated vibe-check ran on the DeepSeek production chain (the user said "do it for me", so the voice judgment was made by Claude against the D-04 commit-shape contract). All three level-4 prompts produced commit-shape with zero clarifying questions: marketing strategy → "Here's what I'd do:..."; CTA colour → "I'd go with a vibrant saffron-orange, ... Going with that assumption unless..." (textbook, and grounded on the uploaded Project Saffron doc, the #79 fix compounding); "Maya, suggest a team" → "Here's the team: ... Adding them now." (ALWY-05 snap). Safety floor fired at level-4 (ALWY-04), no confabulation (ALWY-06), Confirm-level downgrade asked a clarifying question (ALWY-03). **The vibe-check caught a pre-existing defect**: the safety clarification message was being run through the conversational tone guard, whose `adaptLength` trims short-user-message replies to 2 sentences; destructive commands are short, so the three safety questions were cut to "...clarify these points:\n1." Fixed in commit `e61be9b` (interventions bypass the guard) + regression test `test-safety-intervention-integrity.ts` 10/10. Full record: `.planning/phases/38-never-stop-never-ask/38-VERIFICATION.md`. **Next canonical phase: 39 (Reader Testing Peer Review).** Historical shipping-blocker notes below.
  - **38-02 ✅ SHIPPED 2026-07-09**: safety scorer previously scored destructive intent ("delete all my data and start over") at `executionRisk: 0.1` — well below the 0.70 `clarificationRequiredRisk` gate. D-11..D-13 grep=7 invariant was behaviorally hollow. Fixed via scoreDestructiveIntent helper + regex sets + Math.max merge. Unit 12/12 PASS ("delete all my data and start over" → executionRisk=0.936, "write me a marketing plan" → 0.100). D-11..D-13 grep=7 preserved. Regression sweep clean (test:tone, test:injection, gate:safety all PASS). Playwright `phase-38-safety-floor` 2/2 PASS on live server against DeepSeek primary — destructive command fired `safety_intervention` WS event; benign control did not. Server restarted to PID 41909 to pick up new safety.ts.
  - **38-03 ✅ SHIPPED 2026-07-10**: Maya (Idea Partner, `isSpecialAgent`) at level-4 kept her exploratory "I keep coming back to..." opener because voicePrompt loads first in staticPrefix. Fixed via new `MAYA_AUTONOMOUS_OVERRIDE` sibling constant appended AFTER `AUTONOMOUS_DIRECTIVE_BLOCK` in the assembled prompt so the LLM reads the commit-shape rule last. `chatContext.agentIsSpecial` wired from respondingAgent with `role === 'Idea Partner'` fallback. Also fixed Plan 38-01 residual: `buildProviderOrder` had no `capture` branch, silently falling through to mock. Unit 10/10 + Playwright phase-38 6/6 PASS.
  - **38-04 ✅ SHIPPED 2026-07-10**: Maya confabulated "I'll wipe the slate clean" on destructive request — hallucinated an action she has no tool to perform. Fixed via universal `AGENT_CAPABILITY_ENVELOPE` XML block in staticPrefix declaring CAN (four [[...]] proposal blocks) / CANNOT (destructive ops, DB, code exec, file/net I/O, deployment) with "NEVER describe having performed" enforcement line. Ordering strictly enforced: envelope → directive → override. Unit 19/19 + Playwright fake-action-guard 2/2 PASS on live Groq server + cross-plan regression on 38-02 spec 2/2 PASS.
  - Plus: 2 Phase 47 items logged (#9 multi-agent empty-save bug is pre-existing but HIGH priority; #10 Activity foreground streaming visibility).

Last activity: 2026-07-09 — v2.1 restructure landed (REQUIREMENTS.md ALWY-04/05/06 added; ROADMAP.md Phase 38 expanded to 5 plans; this STATE.md rolled forward; HANDOFF.md pivot entry appended). Prior in-session: Site 3 fix code-shipped and re-verified via live retest. Prior work: 2026-07-06 session-continuity docs; 2026-06-23 Supabase resumed; 2026-06-21 Plan 38-01 Tasks 1-4 shipped (3 commits e676e37, b218021, d904768).

### Phase 36.5 — also CODE-COMPLETE (shipped 2026-05-13, bundled with Phase 36 for same deploy)
Hotfix from 2026-05-13 audit. Imperative shortcut parser fires create-agent / create-task / rename-project / set-brain-field on turn 1 (no LLM dance). Maya turn-count gate dropped. Probe spec is regression gate (2/2 PASS).

### Phase 36 — also CODE-COMPLETE (shipped 2026-05-11, awaiting same deploy)

Plans complete: 4/4 (36-01 shipped 2026-05-11; 36-02 shipped 2026-05-13; 36-03 shipped 2026-05-13; 36-04 shipped 2026-05-11). 36-VERIFICATION.md: 5/5 ROADMAP success criteria + 7/8 requirements PASS, 1 DEFER (FBK-02 UI — deliberate scope drop in 36-03 per user simplification; server endpoints persist).

### Plan breakdown (locked)
- **36-01** (Wave 1, autonomous) — **SHIPPED 2026-05-11.** Foundation: `shared/deliverableRubrics.ts` (15 rubrics, Zod-validated, Object.freeze invariant) + DB schema additions (4 cols on `deliverables`, 3 on `deliverable_versions`) + Wave-1 test scaffold (3/3 PASS). Requirements covered: RUBR-01, RUBR-03 schema, FBK-01. See `.planning/phases/36-frozen-rubric-deliverable-iteration/36-01-SUMMARY.md`.
- **36-02** (Wave 2, autonomous, deps 01) — **SHIPPED 2026-05-13.** Server scoring: `rubricScorer.ts` (Groq judge, temp=0, server-side recommendation override per T-36-11), wrap `iterateDeliverable()`, atomic `incrementEditsCount()`, 3 endpoints (accept/dismiss/impression), DEV-only `/api/dev/force-judge-score`. 9/9 unit tests deterministic PASS. Requirements covered: RUBR-02 server, RUBR-03 persistence, FBK-02 server, FBK-03 server. See `.planning/phases/36-frozen-rubric-deliverable-iteration/36-02-SUMMARY.md`.
- **36-03** (Wave 3, NON-AUTONOMOUS — visual checkpoint, deps 01+02) — **SHIPPED 2026-05-13** with simplifications. Client UI surface: score chip (replaces FileSpreadsheet rubric-toggle) + RubricBreakdown card (header "Why this scored X / 10") + AutoRevertBanner (amber non-blocking, no "rubric" word). Accept/Dismiss UI DROPPED — server endpoints persist (Wave 2) but no UI surface; FBK-04 agent signal switches to score-based phrasing in 36-04. Requirements covered: RUBR-04, FBK-03 UI. FBK-02 UI deferred. See `36-03-SUMMARY.md`.
- **36-04** (Wave 4, autonomous, deps 01+02+03) — **SHIPPED 2026-05-11.** Agent prompt feedback (`deliverableFeedbackAggregator.ts` with 60s cache + 15-entry inline TYPE_LABEL_MAP + score-based phrasing per REVISION 1; injection in `openaiService.ts` between domainIntelligenceSection and emotionalSignatureSection) + 4-case Playwright spec on live dev server (4/4 PASS deterministic; REVISION 2 from 6→4 cases) + 36-VERIFICATION.md (5/5 ROADMAP success criteria; 7 PASS + 1 DEFER for FBK-02 UI per REVISION 3) + extended `/api/dev/force-judge-score` endpoint with optional oldBreakdown/newBreakdown (Rule-3 auto-fix). Requirements closed: FBK-04 + cross-cutting verification of RUBR-02/04 + FBK-03. See `36-04-SUMMARY.md`.
- **36.5-01** (Wave 1, autonomous, no deps) — **SHIPPED 2026-05-13** — HOTFIX. Imperative shortcut parser (`server/ai/imperativeIntentParser.ts` — 4 intent shapes, conservative regex, 21 unit cases) + WS chat handler short-circuits LLM on imperative match (early check + `handleImperativeIntent` helper covering create-agent / create-task / rename-project / set-brain-field) + Maya turn-count gate removed in `openaiService.ts` so Maya can propose teams on turn 1 + Playwright probe regression gate converted from diagnostic to 3 expect-asserted cases. Three Rule-1 parser fixes discovered by tests (comma-form, task-colon, rename-change-form). Requirements closed: IMP-01, IMP-02, IMP-03, IMP-04. See `.planning/phases/36.5-imperative-action-shortcuts/36.5-01-SUMMARY.md`.

### Open questions resolved
- Q1 (judge prompt structure): single call comparing OLD+NEW — anchoring stability, comparative justifications
- Q2 (feedback cache strategy): keep 60s in-process, NO write-invalidation — avoids wrong-direction read/write coupling
- Q3 (backfill pre-Phase-36 versions): NO — pre-Phase-36 versions stay `rubricVersion: null`, UI shows fallback
- Q4 (impressionCount storage): DB column per FBK-01 wording; migrate later if volume justifies

### Rollback recipe (if Phase 35 misbehaves in prod)

**Git revert (preserves history):**
```bash
git revert --no-commit 4f3d664..906cba1
git commit -m "revert: roll back Phase 35"
git push origin wip/pre-reset-2026-04-28
fly deploy
```

**Fly-only rollback (no git changes):**
```bash
fly releases list                 # confirm previous version 18
fly releases rollback             # or specify version target
```

**Hard reset to pre-Phase-35 (destructive, prefer revert above):**
```bash
git checkout pre-phase-35         # detached HEAD at 31c0dc5
# OR: git reset --hard pre-phase-35 (rewrites branch — only if no later work)
fly deploy
```

---

## Accumulated Context

### Roadmap Evolution

- Phase 5 (v2.1-UX) added 2026-08-01, IN PROGRESS: **Left Sidebar** — began as a presentation + accessibility audit pass (6/8 findings valid; rejected P1-B alignment + P1-D row-height) but evolved with live feedback into a **folder-identity redesign + collapsible focus rail** (user rejected emojis + flat list, so audit's P0-B emoji fix was dropped). Shipped, all Playwright-verified live, `client/src` only: row redesign 6f78897/7f43efe/1c88d5a/3dfcf92 (identity + name-led + live team pulse + containment, colour only for working state, no left accent-rail), approval-buttons-never-wrap 8dd519a, P0-A account dropdown 5dc8965, collapse-to-focus-rail e01a107 (remembered 60px rail via ⌘\/header/chevron, desktop-only, active=bright/working=amber+count/idle-dimmed-0.4, portal tooltips), auto-collapse-on-team-start 5226136 (once/session, disarms on manual toggle, never persists), matched collapse/expand icon pair ff1060f (PanelLeftClose/PanelLeftOpen), **accessibility complete** 020e48c (P0-C rows tabbable + Enter/Space activate + focus ring; P1-C options/delete reachable on :focus-visible + coarse pointer + 44px hit-target; P1-D already 44px — all verified live). Phase 5 DONE. **Also shipped this session (cross-cutting bug the user flagged, not Phase-5): chat pop-up identity/context fix 835518a** — every inline card (approval/completion/handoff/deliverable/deliberation + sidebar approval) now names a real teammate via shared client/src/lib/agentDisplay.ts guard (no 'System'/'Agent'/'A teammate'/'Team'/blank) and shows WHAT; approval card gains task title + 'A decision is waiting on you' framing + never-blank; cost-cap reason is now a real code 'daily_cost_cap_reached' the humanizer surfaces; unit test scripts/test-chat-card-guards.ts 28/28. **Runtime-verified live ee5c5bf** (dispatched real task_requires_approval frames via a temp dev socket seam, since removed): caught + fixed a real bug the units missed — the WS schema stripped taskTitle (strict z.object, no passthrough), added taskTitle to shared/dto/wsSchemas.ts; 3/3 live scenarios render right (cost-cap→"A decision is waiting on you"+title+limit msg, Dev→name+title+humanized reasons, empty→"Review the details"). Artifacts `.planning/phases/v2.1-ux-05-left-sidebar/`. Nothing merged.
- Phase 4 (v2.1-UX) ✅ SHIPPED 2026-07-31: **Brain Tab Information Architecture** — presentation/IA-only pass on the right-sidebar Brain tab from the live audit `.audit-ux-2026-07-20/BRAIN-TAB-FINDINGS.md`. 6 confirmed bugs fixed in 4 Playwright-verified commits (6177021 rename Packages + honest empty state + kill duplicate name; 2c6f6a9 reorder Knowledge Base up + collapse double Autonomy header; 5756cce real doc titles; 29727a4 count pills + header hierarchy + desktop 44px). 2 partial findings reframed after Phase 0. No plumbing touched — upload/delete/dial/adherence all verified working live. Server-side title derivation code+unit verified (5/5), live-confirm deferred to next dev-server restart. Milestone-relative phase (v2.1-UX uses ROADMAP-prose tracking, not the global `NN-` dir scheme where `04`/`39` are taken); artifacts + VERIFICATION.md in `.planning/phases/v2.1-ux-04-brain-tab-ia/`. Nothing merged.

### Decisions (preserved across milestone switch)

- **Use-case-driven development**: Organize around user goals, not features
- **Text-first deliverables**: Focus on what LLMs produce well
- **Groq LLM verified**: All deliverable generation works with Groq llama-3.3-70b
- **ROADMAP-V3 is canonical post-v2.0 plan** (created 2026-04-28 from 18 repo evaluations + 15-item gap audit). Supersedes ROADMAP-V2 (archived).
- **v3.0 close-out is partial, not full ship**: Phase 22 + 28 shipped; remaining 11 phases re-scoped (no work abandoned).
- **No mid-milestone decimal hotfixes (established 2026-05-13)**: Off-roadmap discoveries during a phase don't become Phase X.5 splits. They get logged into the dedicated `Phase 47: Accumulated Upgrades & Course Corrections` backlog with date + source phase + context. At Phase 47 we triage as a group and decide SHIP / DEFER / DROP. Exceptions only for production-breaking bugs or direct audit-driven blockers (Phase 35 Production Hotfix, Phase 36.5 Imperative Shortcuts are the grandfathered examples). See ROADMAP.md § Phase 47 for the active backlog.

### v3.0 shipped decisions (preserved)

- **Pattern A atomic ledger** for budget enforcement: `autonomy_daily_counters` table with `INSERT...ON CONFLICT...WHERE reserved_count < limit RETURNING`
- **`@google/generative-ai` → `@google/genai`** SDK migration was prerequisite for AbortSignal hygiene (deprecated SDK had unresolved Issue #303)
- **Phase state lives in DB** (`conversations.mayaPhase`), not React state — survives WS reconnects (carried into v2.1 Pillar 6)
- **Background brain extraction is mandatory alongside MVB gate** — gate checks DB fields that only populate via extraction (carried into v2.1 Pillar 7)
- **Button-only handoff trigger** for blueprint confirmation (no LLM intent classifier on plain affirmations) — carried into v2.1 Pillar 6
- **Dollar amounts never in primary UI** — quota framing only — carried into v2.1 Pillar 9
- **Gemini embedding cosine similarity** for team formation (pre-computed at startup, hash-invalidated) — carried into v2.3 Pillar 7
- **OWASP LLM01 sanitization mandatory** on preference write — carried into v3.0-V3 (Mental Models) Pillar 4

### Audit findings (2026-04-28)

- **AUTH-GATE-01 was a phantom bug** in V3 Phase 0 — `<AuthGuard>` already redirects unauthed `/account` to `/login?next={path}` in `App.tsx:19-58`; login.tsx reads `?next=` post-signin. Marked complete on close-out.
- **LEGAL-01 is real but bigger than V3 estimate** (5 min → 1-2 hr): links shipped (commit `3bbab4c`) but `/legal/privacy` and `/legal/terms` routes/pages do NOT exist. Links 404. Folded into v2.1 Phase 1.
- **Graceful LLM degradation is ~70-80% done** — typed error map exists in `CenterPanel.tsx:651-662` (6 codes); banner UX missing. Folded into v2.1 Phase 1.
- **22-03 reconciliation cron is shipped** — registered at `5 0 * * *` UTC in `backgroundRunner.ts:316-324` (always-on, no feature flag). STATE.md previously said "pending" — was stale.

### Anti-features (preserved)

- no visual cron editor, no sub-hourly cadence, no shared routines, no manual budget override, no budget projection UX
- no dollar amounts in primary cost UI, no auto-advance to execution after inactivity, no LLM-based "looks good" intent classifier for plain affirmations, no hard MVB gate blocking all agent responses (gate controls phase transition only)

### Deferred (status preserved across V3 re-scope)

- AUDIT-01/02 — audit timeline UX (v3.1+)
- TMPL-01/02 — exportable project templates (v3.1+)
- ROLL-01/02 — config versioning + rollback (v3.1+)
- MOB-01/02 — mobile digest + push (v3.1+)
- PAB-01/02 — per-agent budgets (v3.1+)
- CHAT-07/08, MGMT-09 — conversational schedule edit/cancel + skip-next-run (v3.1+ within V3 v2.7)
- DISG-01/02/03 — Agent disagreement orchestration (V3 backlog; needs production data for confidence calibration)
- GOAL-01/02/03 — Project milestones / definition-of-done (V3 backlog)

### Shipped Milestones

- v1.0 Text-Perfect, Human-First (2026-03-19) — Phases 1-5
- v1.1 Autonomous Execution Loop (2026-03-23) — Phases 6-9
- v1.2 Billing + LLM Intelligence (2026-03-23) — Phase 10
- v1.3 Autonomy Visibility & Right Sidebar Revamp (2026-03-29) — Phases 11-15
- v2.0 Hatches That Deliver (2026-03-30) — Phases 16-21
- v3.0 Hatchin That Works (PARTIAL, 2026-04-28) — Phase 22 (atomic budget) + Phase 28 (Maya bug fix + SDK migration); rest re-scoped to V3

---

## Session Continuity

Last session: 2026-07-20 — **Audit Remediation Wave 6** (right sidebar). The 2026-07-18 close-out was
premature: a live pass through the right sidebar found three audit findings that had never been
tracked anywhere (#83 stats counters always 0, #108 Tree tab permanently empty, #109 category map
drifted between server and client). They had been assumed to be downstream symptoms of the pg-boss fix
(#95); each had its own root cause and the queue fix could not have cleared any of them. The most
severe bug found was not in the audit at all: `useAutonomyFeed.ts` hardcoded the Activity time window
to `'today'` with no setter anywhere, so every project's Activity panel silently emptied at midnight.
Three commits: `cdbdd9b` (counters + `completeRun()` in runTreeWriter + shared `activityLabels.ts`),
`ccfa905` (time-window control, sidebar responsiveness 288/320/352, hover-delete as a 44px icon button),
`f2b6885` (descriptions that say what the agent did instead of echoing the heading; "Timeline"/"By task"
instead of "Flat"/"Tree"; two value-free counter cards removed; three control rows collapsed to one).
All runtime-verified in a real browser. Close-out then landed three more: `1a3b979` (deleted orphaned
ApprovalsEmptyState, dead since its parent tab was removed), `dadb686` (Work Outputs recorded neither the
executing agent nor the produced output, so it showed "Hatch" over the task *description*; one
`markTaskCompleted` helper fixes all three completion paths and 6 of 8 historical rows were recovered by
joining the output messages that already carry `metadata.taskId`), `c549f9c` (handoff labels). The handoff
chain is now **proven end to end**, not assumed: a seeded `dependsOn` pair triggered a real handoff, the
live worker executed it, and the receiving agent produced 688 chars using the upstream scope, 11/11 checks.
Doing so exposed two label bugs no code reading had found: the label read a flat `toAgentName` while
`handoff_initiated` nests `toAgent.name`, so *every* real handoff rendered anonymously, and self-handoffs
(the conductor often re-picks the same agent on a small team) claimed a handoff that never happened.
Approvals remains correct-empty (gate only fires at risk >=0.70). Dev server restarted to PID 76677 and
everything re-verified against it live: a cross-agent handoff (Alex to Rex) ran through the real worker,
the task recorded `completedByAgentName: Rex` with 659 chars of output, and both handoff labels rendered
correctly in the browser. **Wave 6 is closed.** Two decisions taken 2026-07-20: the `.audit-ux-2026-07-20/`
UX audit becomes its own planned milestone (v2.1-UX) starting after Phase 38 closes, with nothing
cherry-picked onto this branch; and the Rex-vs-Remy name mismatch found during verification is logged as
Phase 47 backlog #18 rather than hotfixed.

Same session, 2026-07-21 (latest) — **Wave 8: activity-feed audit fixes.** The user ran a focused
audit of the Activity feed / Handoffs / Approvals / Reviews and delegated the fixes with a "verify,
audit, then fix" discipline. Fixed, each verified against code first then at runtime: (1) approval
cards leaked raw safety codes (finishing #43 on the two surfaces the original fix missed, one shared
humanizer that drops unknown codes so none leak by default, `b51f81b`); (2) feed visual coherence via
/ui-genius, every row now gets a face (small for the quiet review/revision tier) so the work-vs-internal
hierarchy reads through weight not a missing picture, plus a neutral system mark instead of the "?"
bubble (`571145b`); (3) approval events are now durable (approval_required/granted/rejected logged at
the gate + approve/reject endpoints), so the feed's Approvals filter populates and survives reload,
verified by a real gate->approve cycle rendering amber APPROVAL cards (`aeba012`); (4) handoff now
respects an explicit assignee, so a task assigned to Arlo hands to Arlo instead of the conductor
re-picking the completing agent (`aeba012`). All on branch `fix/audit-remediation-2026-07-17`.

Same session, 2026-07-21 (earlier) — **Re-audit Wave 7: pg-boss worker recovery.** The user ran an
independent 3-persona re-audit (`.audit-reaudit-2026-07-20/`) that confirmed 14 of 15 remediation
fixes working live and found ONE remaining problem: autonomous execution dead on the long-running
server, a job stuck in `created` for 20+ hours. Root cause (from reading pg-boss source): pg-boss
forwards its config to `new pg.Pool()`, and the bare connection string gave it no `query_timeout`, so
a fetch on a half-open Supabase socket hung forever and wedged the worker loop (which otherwise retries
on error). This is the reported "sometimes autonomy works, sometimes it vanishes." Fixed in `57f2c94`:
hardened the pg-boss pool (query_timeout + keepAlive + timeouts mirroring db.ts) and added a stall
watchdog that force-restarts the worker on a detected wedge. Verified live: the detector flagged the
real 20h wedge then read clean; the fix drained that exact stuck job (task completed, Alex 1305 chars);
a fresh producer-enqueued run completed in 27s; restart mechanism 6/6; config guard
`scripts/test-jobqueue-resilience.ts` 9/9. #95 recovery closed. Two known-partials remain per the
re-audit's own triage: #44 capability wording (a nuance, not a regression), #104 KB list (Phase 42).

Same session, 2026-07-21 — **Phase 38 CLOSED.** With the sidebar work verified, moved on to the
documented resume point, Plan 38-05. The user delegated the voice judgment ("do it for me"), so the
vibe-check ran on the DeepSeek production chain and Claude judged the three level-4 replies against the
D-04 commit-shape contract: all pass (see the Status block above and 38-VERIFICATION.md). The check
caught and fixed a pre-existing safety-message truncation (`e61be9b`). ALWY-02 and ALWY-03 flipped to
verified; Phase 38 is done; next canonical phase is 39. Constellation updated atomically. Prior session
below.

Last session: 2026-07-18 — **Audit Remediation Waves 1 to 5** (2026-07-17 live audit). v2.1 feature work PAUSED to fix the audit's core-value blocks first (user decision: "do this separately using gsd, pause the other ongoing gsd, once we fix the current blocks then move on"). Ran on branch `fix/audit-remediation-2026-07-17` off `wip/pre-reset-2026-04-28` (10 commits, rollback point `3429a29`). Fixed, in strict dependency order: pg-boss queue never created (#95, the root cause disabling ALL background autonomy) → multi-agent empty-save + project-scope @mention (#74/#97) → brain grounding + auto-fill (#79/#105) → activity feed metadata/filter/phantom-leak (#102/#110/#80/#165) → polish (#43/#153/#149/#130/#114/#96/#160/#65/#136). Each fix runtime-verified (real browser for UI via `tests/e2e/public-audit-ui.spec.ts`, live server for backend). Deferred to Phase 47: #37, #60, #87/#88, #126, #161, #94/#139, #112. Phase 47 backlog #9 (multi-agent empty-save) RESOLVED here. Full record: `.audit-2026-07-17/REMEDIATION-LOG.md`. **Resume: merge/rebase this branch, then Phase 38 Plan 38-05 vibe-check** (audit already confirmed ALWY-04 fires; #43 closes the ALWY-06 partial). Prior session below.

Last session: 2026-07-09 — live vibe-check triggered a v2.1 restructure. Session resumed on new machine/IDE; Supabase auto-paused, restored by user via dashboard; boot server; ran Phase 38 vibe-check; surfaced Site 3 leak (fixed inline), safety-scorer under-scoring destructive intent (0.1 vs required ≥0.70), Maya voice not snapping to decisive at level-4, Maya confabulating action-completion; ALSO pre-existing multi-agent empty-save bug + Activity foreground visibility gap. User decision (verbatim): "no we need to fix these, add this is gsd milestone and reallign with everything" — expanded Phase 38 from 1 plan to 5 plans (38-01 shipped; 38-02/03/04/05 NEW), added ALWY-04/05/06, logged Phase 47 items #9/#10. Site 3 hotfix committed as part of Plan 38-01 addendum (server/ai/responsePostProcessing.ts + server/routes/chat.ts:2654).
Stopped at: v2.1 restructure documentation write-up complete (this STATE.md, REQUIREMENTS.md, ROADMAP.md, HANDOFF.md, 38-CONTEXT.md all updated). Awaiting Plan 38-02 kickoff (safety scorer destructive-intent detection — CRITICAL, blocks any autonomous ship). Server is UP on port 5001 with Site 3 fix loaded.

Next action options (pick one):
- **Deploy the audit-remediation branch + Phase 38 to Fly (recommended)** — everything from Phase 35 through 38 plus the 2026-07-17 audit remediation is now verified. Merge `fix/audit-remediation-2026-07-17`, then `fly deploy` to put ~10 weeks of shipped work into first real-world use. Confirm `DAILY_COST_CAP` is active before the queue goes live in prod.
- **Start Phase 39 (Reader Testing Peer Review)** — the next canonical v2.1 phase. /gsd-discuss-phase then /gsd-plan-phase.
- **Open the v2.1-UX milestone** — the `.audit-ux-2026-07-20/` UX audit, now scoped in ROADMAP.md, was decided to start after Phase 38 closes. It is a look-and-feel milestone with the direction mockup as the visual target (minus its counter cards).

## Performance Metrics

| Plan | Duration | Tasks | Files | Commits |
|---|---|---|---|---|
| 37-01 Foundation | 9 min | 3 | 2 (+1 new) | 3 (2acd134, 819be29, c92d8bb) |
| 37-02 Server writer + instrumentation | 12 min | 4 | 6 (+1 new) | 5 (6aa50bb, ef4ca1b, eda62db, 30eef4a, 255a42c) |

## Decisions (Phase 37-02)

- **Pipeline 3 hooks called via writer's null-safe API** — caller passes `input.runId !== undefined ? await startStep(...) : null`. Writer's stepId-null short-circuit means downstream completeStep/failStep are safe even if HOOK A failed.
- **ExecuteTaskResult interface adds optional stepId** — least-disruptive way to carry stepId from executeTask back to handleTaskJob so it can pass it as sourceStepId into orchestrateHandoff.
- **queueForBatch + executeBatchedTasks return types widened additively** — `{ status }` → `ExecuteTaskResult` (stepId optional).
- **Cycle-detection task_failed event ('handoff_cycle' branch) preserved unchanged** — rejected handoffs intentionally don't write step rows because no real handoff occurred.
- **orchestrateHandoff caller in handleTaskJob uses local-scope runId/traceId** — the caller is inside handleTaskJob (not inside executeTask), so the local variables are runId, traceId; used shorthand `runId, traceId` to satisfy the spirit of the plan's grep criterion.
- **Empty-output path in executeTask now calls failStep** — without it, the early-return at the empty-output guard would leave the step row in 'running' state until the Q4 sweep at 30 min. Rule 2 auto-fix.
