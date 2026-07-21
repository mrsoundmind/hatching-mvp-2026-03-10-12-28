# Hatchin — Complete Live Functional Audit

**Date:** 2026-07-17
**Method:** Exhaustive, button-by-button live testing against a running server. Waves 1-3 on the real DeepSeek chain; Waves 4-6 on the Groq/test chain (flow-valid; LLM-quality caveats flagged inline). Test user forced to Pro so autonomy was reachable; billing gates off (as in the real MVP deploy). Driven through the in-app browser with API/WebSocket/DB/server-log cross-checks.
**Coverage:** ~140 distinct features + controls exercised across every reachable page, panel, modal, and the full interactive-element inventory (130 controls).

> No dashes per your preference. Money shown USD + INR where relevant. This report supersedes the earlier draft.

---

## The one-line verdict

**The plumbing works; the product's reason-for-existing does not.** Standard UI — auth, projects, chat streaming, modals, onboarding, deliverable generation/export, navigation — is solid. But the four things that make Hatchin *Hatchin* — knowledge grounding, multi-agent collaboration, autonomous execution, and activity visibility — are broken in real use, and the app gives almost no feedback when things happen or fail.

## Health by verdict (164 tested — incl. Wave 7 gap-closing + DeepSeek re-verify)

| Verdict | Count | Meaning |
|---|---|---|
| ✅ WORKING | 107 | behaves as specified |
| 🟠 PARTIAL | 24 | works with a visible defect / UX flaw |
| 🔴 BROKEN | 24 | user-visible breakage |
| ⬛ / ⬜ / ❔ | ~9 | config-gated, not-testable (undo/pagination), inconclusive |

**~72% of tested items fully work** — but that number flatters the product, because most WORKING items are UI controls while the BROKEN ones are load-bearing AI features. Weighted by importance, the core value proposition is largely non-functional.

### Wave 7 changes (real DeepSeek chain + gap-closing)
- **Re-verified on production DeepSeek:** knowledge-ignored, @mention-wrong-agent, and multi-agent empty-save all **still broken** (mechanism bugs, provider-independent). Groq fabricated; DeepSeek deflects — same underlying gap.
- **Routing is better than first reported:** agents **do** reply correctly in **1-on-1** (Coda answered as the engineer) and **team-scope** (Arlo answered) chat. The bug is specifically **@mention at project scope** being overridden by Maya — not a global failure.
- **Deliverable packages WORK:** a launch package produced 3 coordinated docs (PRD, Design Brief, Timeline) — because packages use `executeDeliverableChain`, not the broken pg-boss queue.
- **Tier enforcement WORKS** (project cap 403) but the **UpgradeModal never shows** — the paywall is invisible.
- **New breakage:** the standalone **`/maya/:id` route crashes** ("apiMessages.map is not a function"). This incidentally **confirmed the error boundary works**.
- **Confirmed WORKING:** legal pages, /dev/autonomy dashboard, starter-pack creation, imperative agent-create, conversation archive/unarchive.
- **New polish bug:** starter-pack agents are named by role (name===role) → "role twice" bug reproduced.

---

## The 22 broken things, ranked (visible outcome)

### Tier 1 — kills the core value proposition
1. **[95] Autonomous execution is dead — pg-boss queue never created.** Root cause pinpointed: pg-boss v10 requires `createQueue()`, the codebase has zero. DB proof: job table empty, `autonomous_task_execution` queue doesn't exist. One-line fix in `taskExecutionPipeline.ts:909`. This single gap disables ALL background autonomy.
2. **[90/54] Background execution starts but never completes.** "Team is working on 1 task..." shows forever; task stays `todo`; no output, no approval card, no error.
3. **[79] Knowledge base is ignored — and the agent lies about it.** Uploaded a doc (Project Saffron / 14 Aug 2027 / Nusantara Ventures); agent answered "FridgeGenie / Q2 / Greenfield" then claimed "I've reviewed the Internal Brief" and fabricated its contents.
4. **[74/98/111] Multi-agent replies save empty → blank chat bubbles.** Any "As a team" (2+ agent) reply persists with length 0. User sees a Maya bubble with no text.
5. **[97] Calling a specific agent doesn't reach that agent.** @Coda "give me your engineering take" → Maya answers as a team; Coda never speaks.
6. **[101/100] Agents don't hand off to each other.** Manual "Hand off to..." just types "@name"; autonomous handoff is gated behind the dead queue. No handoff ever occurs.
7. **[102] Peer review / policing is hollow.** 21 review events fire but all payloads are empty and labels are junk ("peer review feedback: peer review feedback"). No reviewer, reviewee, feedback, or score — nothing to see.

### Tier 2 — makes the product feel broken / unfinished
8. **[80/107] Activity feed looks dead.** Defaults to a "Tasks" filter that hides all 50 events; 3 of 5 filters are empty for an active project.
9. **[110] Feed events show anonymous "Hatch" + blank avatar** instead of the real agent's name/pic — the `agentId` is present but `agentName` is null and the UI uses the null.
10. **[104/105] Project Knowledge Base section renders empty**; the project brain never populates from conversation.
11. **[96] No visible confirmation for any create/update/delete.** The "Task created" toast renders clipped off-screen; chat-based creation shows nothing.
12. **[22] Messages vanish after the organic task-approval flow** (until reload).

### Tier 3 — dead controls / polish
13. **[114] "Light Mode" theme toggle is a dead no-op** (FORCE_DARK_MODE).
14. **[94] @mention autocomplete missing**; **[139] /route has no command menu**.
15. **[130] /onboarding route 404s** (orphaned page file).
16. Plus: safety reply leaks internal reason codes; "delete a task" trips the safety gate; "create a task *called* X" ≠ "*to* X"; corrupt-PDF uploads silently empty; auto-revert didn't fire on a score regression; landing markets 4 broken features; "Manage Subscription" fails silently; 88 unlabeled a11y buttons.

---

## What genuinely works (93 items)

Auth + session, 3-panel + mobile Sheet layout, project create (idea path) + egg animation + Maya welcome, all creation modals + validation, project soft-delete/restore endpoints, team/agent creation from packs, tree hierarchy + Maya-hidden, real-LLM streaming chat + tone guard + persistence + stop button, Enter/Shift+Enter, markdown, reply preview, reactions, all 4 task-creation paths, task lifecycle commands, task delete, right-sidebar Tasks/pipeline/section-collapse/work-output, brain upload/delete + validation, autonomy dial (toggle + 4 levels + inactivity select) + persistence, the destructive-intent safety gate (ALWY-04 fixed since the last vibe-check), deliverable generate + rubric breakdown + iterate + versions + PDF/.md export + artifact panel, billing status + account page, provider-degraded banner, the full onboarding flow (Welcome → 4 steps → PathSelection), StarterPacks (8 categories / ~33 packs), search, 404 page.

---

## Reconciliation with HANDOFF.md open items
- **ALWY-04 destructive-intent gate**: FIXED (fires now, was 0.1 no-op on 2026-07-09).
- **ALWY-06 capability envelope**: PARTIAL (no overt fake claim, but implies it could delete + leaks reason codes).
- **Phase 47 #9 multi-agent empty-save**: CONFIRMED broken (was "unconfirmed").
- **Phase 47 #10 foreground visibility**: confirmed — background exec never runs, so nothing to show; feed/tree/stats all read empty.

## Not reachable via automation (still untested)
Timed undo-delete popup (endpoint works; Radix confirm needs a manual click), "load earlier" pagination (needs 50+ messages), error boundaries (need an induced crash).

## Test environment
Server started with inline `LLM_MODE=prod` (Waves 1-3) then restarted on `.env` defaults (Groq) under preview management; `.env` file untouched. Test user "Audit Bot" forced Pro (revertible). Nothing committed. Full per-feature log in `findings.md` (143 entries); coverage cross-reference in `COVERAGE-MAP.md`. Test debris remains in the "AI Recipe App" project (blank bubbles, probe tasks, brain docs) pending your OK to wipe.
