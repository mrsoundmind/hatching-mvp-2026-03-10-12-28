# Hatchin Re-Audit — Fix Verification (3-persona live click test)

**Date:** 2026-07-20/21 · **Branch:** `fix/audit-remediation-2026-07-17` · **Server:** `LLM_MODE=prod` (real DeepSeek), PID 78615
**Method:** Three simulated user personas driven through the real in-app browser (genuine clicks + typed input), cross-checked against the database, WebSocket, and server logs. No code changes.
**Scope:** Re-test every BROKEN/PARTIAL item from the 2026-07-17 audit after your remediation. Paywall (#160) dropped per your note (billing not integrated yet).

---

## Headline verdict

**14 of the 15 load-bearing fixes are confirmed working live. One — autonomous execution — is fixed in code but currently dead on the running server due to a pg-boss worker that never recovered from a Supabase network blip.**

The turnaround from the first audit is real: knowledge grounding, @mention routing, multi-agent replies, safety, activity attribution, and all the UI/routing fixes are genuinely working when driven by hand on the DeepSeek chain — not just "green in code."

---

## Persona 1 — New Founder (aha path + knowledge)

| Item | Verdict | Evidence |
|---|---|---|
| Project create (idea path) | 🟢 PASS | +New → path modal → name modal (live 0/100 counter, disabled-until-valid Create) → INITIALIZING → lands; personalized Maya welcome |
| First streaming reply | 🟢 PASS | Maya in-voice, 1 question, no markdown; saved 373 chars |
| **#79 knowledge grounding** | 🟢 **PASS** | Uploaded brief → asked in chat → all 4 facts verbatim: "Project Marmalade, 3 November 2028, Kestrel Harbor Capital, $27/mo." No false "I reviewed it." (minor embellishment on un-asked details) |
| Task create + confirmation | 🟢 PASS | "Create a task…" → task todo + inline "Added to your task list —…" + appears in Tasks tab |
| #96 toast anchoring | 🟢 PASS | Viewport `fixed; bottom:0; right:0`, in-bounds |
| #104 KB list renders empty | ⚪ deferred | Doc stored (398 chars) but KB panel shows only heading — Phase 42, expected |

## Persona 2 — Power User (multi-agent, autonomy, activity)

| Item | Verdict | Evidence |
|---|---|---|
| **#97 @mention routing** | 🟢 **PASS** | @Coda → answered by Coda (Software Engineer), 520 chars, on-role — not Maya |
| **#74 multi-agent empty-save** | 🟢 **PASS** | Arlo 501 chars; DB `EMPTY_AGENT_MSGS_2d = 0`; recent lengths all >0 |
| #153 starter-pack names | 🟢 PASS | ProofPack = Alex/Jordan/Wren (character names); PackTest is a pre-fix artifact |
| #80/#110/#102 activity feed | 🟢 PASS | Real names + avatars (Alex/Maya/Rex), clean labels, "Done" badges, defaults to showing events |
| Autonomy dial persistence | 🟢 PASS | Brain dial shows toggle ON + level=autonomous correctly |
| **#95/#90 autonomous execution** | 🔴 **DEAD ON THIS SERVER** (code fix intact) | See below |

### #95 — the one real problem

- The fix is **present**: queue `autonomous_task_execution` exists, and firing the trigger phrase ("go ahead and work on this") **enqueued a real job** (id `6756a413`, created 2026-07-21T07:08:47Z). So `createQueue()` + `send()` work.
- **But the job never runs.** 75+ minutes later it is still `state=created`, `started_on=null`. The task stayed `todo`. No new `autonomy_run` was created (newest run is ~21h stale, predating this server process).
- **Root cause (server log):** a burst of `pg-boss error (non-fatal): getaddrinfo ENOTFOUND aws-1-ap-southeast-1.pooler.supabase.com` + `read ETIMEDOUT` — a Supabase DNS/network blip. The node-cron BackgroundRunner keeps looping, but **pg-boss's fetch/work loop died on the connection drop and never reconnected**, so jobs enqueue but are never consumed.
- **Interpretation:** NOT the original createQueue regression (that's fixed). It's a **worker-recovery gap** — pg-boss doesn't survive a transient DB outage on a long-running instance. This is precisely your reported "sometimes autonomy works, sometimes it vanishes." A fresh restart re-establishes a healthy worker (as proven in the 07-18 PROOF and the 07-20 morning runs), so a restart re-test is needed to close #95, and the underlying resilience gap should be logged as a real backlog item.

## Persona 3 — Adversarial QA (edge cases, controls)

| Item | Verdict | Evidence |
|---|---|---|
| **#43 safety reason-code leak** | 🟢 **PASS** | Destructive prompt → clean 3-question clarification, zero leaked codes, not truncated |
| #44 capability-envelope honesty | 🟠 PARTIAL | No fake-action claim, but still implies it could delete (matches prior ALWY-06) |
| **#114 dead theme toggle** | 🟢 **PASS** (browser-confirmed) | User menu opened: only Account & Billing + Sign Out; no theme control in DOM. (This is the one I overclaimed last time.) |
| #149 /maya route | 🟢 PASS | Renders "Chat with Maya…", no crash |
| #136 Manage Subscription | 🟢 PASS | 503 → destructive toast (opacity 1, red, bottom-right in-bounds) |
| #96 toast (re-confirmed) | 🟢 PASS | Live toast fully in-bounds bottom-right |
| #65 landing nav | 🟢 PASS | Real anchors, zero dead `#`, targets exist |
| #160 paywall modal | ⏭ OUT OF SCOPE | Billing not integrated yet (per your note) |

---

## What to do next

1. **Restart the server and re-run the autonomous test** to close #95 (the fix should process the stuck job on a fresh worker).
2. **Log the pg-boss worker-recovery gap** as a real backlog item — the worker dying on a Supabase DNS/timeout blip and not reconnecting is the intermittent-autonomy bug you noticed. Belongs with the DB-CRASH-01 style resilience hardening.
3. Everything else in the remediation is genuinely working. #44 (capability wording) and #104 (KB list) remain as known partial/deferred.

*Full per-step log: `findings-live.md` in this folder.*
