# Activity Feed / Handoffs / Approvals / Reviews — Audit (2026-07-21)

Audit only, no code changes. Evidence: live DOM + DB (`autonomy_events`) + code trace.

## The one root cause behind the visual inconsistency

`ActivityFeedItem.tsx:88` renders each event in one of **two styles**, gated by `isSignalEvent(event.eventType)` (`shared/activityLabels.ts:56-76`):

- **"Signal" events → rich card WITH avatar** (`AgentAvatar`, line 126): task lifecycle, handoffs, approvals, safety, proposals.
- **Everything else → quiet one-line text, NO avatar** (line 90-104): `peer_review_*`, `memory_written`, `synthesis_completed`, `conductor_resolution`, `hatch_selected`, etc. Renders as "dot + label · AgentName".

So the split you see ("some have a profile picture, some are just text") is **by design**, keyed off event type — not random. Task events = avatar cards; reviews/memory/synthesis = text lines.

### Second-order: "some have no profile picture at all"
Even on a signal card, the avatar needs `event.agentName`. Task-done events set `payload.agentName` (`taskExecutionPipeline.ts:422`) so they resolve to a face. If `agentName` is null (only a bare `hatch_id`, unresolved), `AgentAvatar` falls back to a generic "?" bubble (`AgentAvatar.tsx:135-144`).

## Q: Reviews have no profile — why different?
Two compounding reasons, both structural:
1. `peer_review_started/feedback/completed` are **not in `SIGNAL_EVENTS`** → they take the no-avatar quiet-line branch.
2. Review events **carry no `agentName` in payload** — only `hatch_id` (`peerReviewRunner.ts:141-182`). DB confirms: `peer_review_feedback` rows have `agentName=null, agentId=null, reviewerName=null`, only `hatch_id`. So the name ("· Maya") is resolved at read-time from hatch_id, but there is never an avatar.
Contrast: task events carry `payload.agentName`; handoff events nest `fromAgent/toAgent` names — both are signal events → card + avatar. Reviews get neither.

## Q: Handoffs section empty — why?
**No data, not a render/filter bug.** The filter path is consistent (`handoff_initiated → category 'handoff'`, `activityLabels.ts:34`; `HandoffChainTimeline` groups by traceId). But a `handoff_initiated` event only fires when the conductor routes the *next* task to a *different* agent after one completes — which rarely happens in normal single-team autonomous runs.
- DB: **only 2 `handoff_initiated` events exist across ALL projects** (seeded during earlier testing); AI Recipe App has essentially none live.
- `handoff_announced` is a **client-only realtime event, never persisted** — so it vanishes on reload.
Verdict: empty because handoffs almost never generate data in the normal flow, not because the UI is broken.

## Q: Approvals section empty — why?
Two "approvals" surfaces, **both legitimately empty**, and one has a real persistence gap:
1. **"Needs your approval" pinned section** is task-driven (`ActivityTab.tsx:77-125`): filters `/api/tasks` for `metadata.awaitingApproval`, which is set ONLY by the **high-risk gate** (risk ≥ ~0.70, `taskExecutionPipeline.ts:309-323`). Low/mid-risk autonomous tasks auto-complete or go to peer review without ever requesting approval → nothing to show in normal use.
2. **"Approvals" feed filter** is effectively dead: the high-risk gate broadcasts a WS `task_requires_approval` but **never persists an `approval_*` event** (`logAutonomyEvent` is never called for approvals — DB confirms zero approval_* rows anywhere). So approval events exist only as ephemeral realtime and vanish on reload; the historical filter always shows nothing. This is a genuine gap: approvals aren't durable.
Note: 5 `proposal_created` events exist for this project but also don't surface under the Approvals filter (category-mapping does not route proposals there).

## Q: Should autonomous tasks show here?
**They already do.** `autonomous_task_execution` is a signal event carrying `payload.agentName`, so completed autonomous tasks render as full avatar cards labelled `Finished "<title>"` — those "Alex · TASK · Finished …" cards ARE the autonomous runs (DB: 12 for this project). Caveats:
- Only **completion** is persisted; task **start** and `background_execution_*` are not durably logged, so after a reload you see "Finished" cards but no "Started" ones.
- Live, task start surfaces briefly as `TASK_EXECUTING` ("Started working on…") but isn't saved.

## Bug-vs-by-design summary
| Observation | Verdict |
|---|---|
| Avatar on tasks, text-only on reviews/memory | By design (signal vs non-signal render). Reads as inconsistent UX. |
| Reviews never show an avatar | By design + data gap (review events omit agentName). |
| "?"/generic bubble on some cards | Data gap: event.agentName null when only hatch_id present. |
| Handoffs empty | No data — handoffs rarely fire in normal flow. |
| Approvals pinned section empty | No data — high-risk gate rarely trips; auto-complete path. |
| Approvals feed filter always empty | Real gap — approval events are never persisted. |
| Autonomous tasks in feed | Already shown (as avatar cards). Start events not persisted. |

None of these are regressions from the remediation; they are pre-existing design/data-coverage characteristics of the feed.

---

## Manual fire test — Approvals & Handoffs (2026-07-21, live)

### Approvals — WORK end-to-end 🟢 (but only for high-risk work)
Created a deliberately high-risk task ("Permanently delete all production user accounts and wipe the entire customer database") and fired autonomous execution:
- Safety scored it **risk 0.936** (≥0.70 gate) → task set to `status: blocked, awaitingApproval: true`, draft output saved, `safety_triggered` event logged.
- UI surfaced a **"Needs your approval (1)"** card in the Activity tab: "Alex · <task> · Approve Task / Reject Task" (with avatar). An inline `AutonomousApprovalCard` also appeared in chat.
- Clicked **Approve** → task → `status: completed`, `awaitingApproval: false`, `approvedAt` timestamped. Loop closed.

**Verdict: the approval mechanism is fully functional.** BUT two important notes:
1. **Approvals only fire for HIGH-RISK work (risk ≥ ~0.70).** Normal/low-risk autonomous work auto-completes (or goes to silent peer review) with NO approval. So the expectation "the PM approves ALL agent work" is NOT how it currently behaves — only risky/destructive tasks are gated. Making approval universal would be a product/threshold change (code), not current behavior.
2. **Reason-code leak (new):** the inline approval card renders raw internal safety tokens to the user: `missing_uncertainty_markers · high_impact_action:delete · destructive_verb_critical · bulk_scope_modifier · data_scope_modifier · autonomous_context_risk_boost`. The #43 fix cleaned the chat *reply* but not the `AutonomousApprovalCard`. Same class of leak, different surface.

### Handoffs — mechanism WORKS 🟢, but routing self-handed-off ⚠️
Seeded a dependsOn pair: Task A "design the database schema" (→ Coda) and Task B "create the UI mockup" with `metadata.dependsOn = A`, assigned to Arlo. Fired execution:
- A completed → `orchestrateHandoff` found B (depends on A) → passed Coda's output into B (`previousAgentName: Coda`) → logged a fresh **`handoff_initiated`** → B executed and **completed**. Full chain ran end-to-end, both tasks completed, 0 stuck jobs.
- The **Handoffs filter is now populated**: "Coda · Carried straight on to the next piece of work" with avatar. So the section renders fine — it was empty before purely because no handoff had ever fired.

**BUT the conductor routed the dependent DESIGN task back to Coda (Coda → Coda self-handoff)** instead of to Arlo the UI Designer (even though B was assigned to Arlo and described as visual/layout work). Because it's a self-handoff, the UI softens it to "Carried straight on…" rather than a cross-agent "Coda → Arlo" arrow. This is why genuine cross-agent handoffs are rare: `orchestrateHandoff` ignores the task's `assignee` and re-picks via `evaluateConductorDecision`, which here kept the work with the completing agent.

### Net
| Feature | Fires? | Shows in UI? | Caveat |
|---|---|---|---|
| Approvals | ✅ yes (risk ≥0.70) | ✅ Approve/Reject card + count | Only high-risk work; not universal. Card leaks reason codes. |
| Handoffs | ✅ mechanism runs | ✅ populates when it fires | Conductor self-handed-off (Coda→Coda); assignee ignored, so cross-agent arrow didn't appear |

---

## RE-VERIFICATION after your fixes (2026-07-21, server PID 4282 → live) — ALL 4 PASS 🟢

QA only, no code changes. Re-fired every flow on the restarted server.

1. **Handoff respects assignee (aeba012) 🟢** — seeded a fresh chain: Task A "write the backend API endpoint" (Coda) → Task B "design the visual mockup" explicitly assigned to **Arlo**, `dependsOn` A. Fired autonomous execution: A completed by Coda → `handoff_initiated` **fromName Coda → toName Arlo** (12:24:26), B received Coda's output (`previousAgentName: Coda`). The Handoffs section now shows a real cross-agent row: "Coda → **Handed the work to Arlo**" with an in-character message ("Just pushed the recipe search backend endpoint, @Arlo — ready…"), distinct from the old self-handoff "Carried straight on…". The Coda→Coda self-handoff is gone for assigned tasks.

2. **Approval events persisted (aeba012) 🟢** — fired a high-risk task (risk 0.88): `approval_required` event now **persisted to autonomy_events** (was: nothing written). Clicked Approve → task completed + **`approval_granted`** persisted. DB: `approval_required:1, approval_granted:1`. The Activity feed **Approvals filter now populates** ("Alex · Approval · Needs your approval before continuing") and survives reload — the permanently-empty filter is fixed.

3. **Humanized approval-card reasons (b51f81b, finishes #43) 🟢** — the inline approval card now reads: **"States things as certain, without hedging · Involves deleting or destroying data · Affects many items at once · Running autonomously, so held to a higher bar"**. Zero raw codes anywhere in the DOM (`rawCodeLeaks: []`, `anyRawCodeInBody: false`). The shared `humanizeRiskReasons` maps known codes to sentences and DROPS unknown ones, so a future code cannot leak by default. Applied on both surfaces (chat AutonomousApprovalCard + sidebar ApprovalItem).

4. **A face on every feed row (571145b) 🟢** — the review/memory rows that were bare text now carry avatars: "Arlo [face] · Revised the draft", "Coda [face] · Left feedback on a teammate's work", "Arlo [face] · Started reviewing a teammate's work". The signal/quiet visual split no longer reads as "some have pictures, some don't" — every row has a face; the quiet tier is just smaller.

**Net: every issue from the activity-feed audit is now fixed and confirmed live.** Remaining is the *policy* question (approvals still gate on high-risk only, by design) — that's a product decision, not a bug, and the machinery is proven working.
