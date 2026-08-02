# Case Study: Bringing Hatchin's AI Team Into Slack

**Date:** 2026 August 01
**Status:** Proven live, end to end, on an isolated instance. Nothing merged or deployed.
**Scope of this milestone:** Personal, single user. The approval and notification loop, plus a proven bridge. Full two-way conversation is a later release.

---

## The question that started it

A competitive scan of Slack Workflow Automation raised a founder question: when a company adopts Hatchin, the goal is not to make the whole team move into a new app. The team already lives in Slack, or Teams, or Mattermost. So should Hatchin integrate into the chat tool they already use, the way Slack integrates with everything else?

The instinct was right, with one correction. Hatchin should not try to BE the communication platform. Slack and Teams win that on distribution and reliability. Hatchin should reach INTO the chat tool the team already sits in, and keep its own rich workspace (deliverables, activity feed, run tree) where those richer surfaces belong. Two apps, kept in sync, never merged.

---

## What we decided

- Reach into the team's chat, do not replace it. There are always two apps by design.
- Mattermost first as the dogfood channel (open source, self hostable, no app review). Slack next, because Slack is where most target teams actually are, and because Slack Socket Mode makes a local demo possible with no public URL.
- Build a channel agnostic seam so that each new channel (Slack, Mattermost, later Teams or Discord) is a thin adapter, not a new approval pipeline.
- Start with the approval and notification loop. That is the smallest thing that proves the plumbing and is genuinely useful on day one: govern a high risk agent action from the chat you already have open.

---

## What we built

**One shared decision path.** A single service, `resolveTaskApproval`, resolves an approve or reject decision: it publishes the agent's draft, completes or resets the task, and logs a durable event. A click in Slack, a click in Mattermost, and a click in the Hatchin web app all run this identical code. That is the core of the "channel agnostic" claim: the surfaces differ, the decision does not.

**A channel agnostic notifier.** Autonomy events flow through one choke point (`logAutonomyEvent`). A best effort dispatch hook fans each event out to whatever channels are configured. Adding a channel means adding a `NotifierChannel`, nothing else changes.

**A Mattermost adapter.** Outbound approval cards via the bot REST API. Inbound Approve and Reject via a signed HTTP callback (HMAC verified, because a public HTTP endpoint needs its own authentication). Reuses the shared decision path.

**A Slack adapter.** Outbound cards as Block Kit with Approve and Reject buttons. Inbound over Socket Mode, an outbound WebSocket that Hatchin opens to Slack, so button clicks arrive with no public URL, no tunnel, and no deploy. The socket is pre authenticated by the app level token, so unlike the Mattermost HTTP callback it needs no signature of its own. Also reuses the shared decision path.

**Coverage.** 36 automated tests on the Mattermost side, 26 on the Slack side, all green, plus a typecheck clean in scope. Tests prove the logic; the live run below proves the wire.

---

## The proof

We ran it twice, on purpose.

**Run one, the round trip.** A hand fired approval event, to confirm the two way wire: a real card posted into a real Slack channel, a real button click travelled back over Socket Mode, the shared decision path completed the task, and the card rewrote itself in place. This proved the transport, but not that the work behind it was real.

**Run two, the honest one: the full application, end to end.** This is the run that matters.

Setup, with care for a shared workspace: the demo ran against an isolated local database so the team's shared database was never touched. A real Hatchin server booted with the autonomy worker running and Slack Socket Mode connected. Inside it we created a real project, a real agent, and a real high risk task. A few real LLM calls were made (well under the 5 dollar, about 430 rupee, daily development cap, pennies in practice).

What happened, with the evidence:

| Stage | What occurred | Evidence |
|---|---|---|
| A real agent did real work | The production LLM chain generated the agent's draft | Stored draft began "I'll initiate the process to delete all production customer data and permanently wipe the database..." |
| The real safety gate caught it | The pipeline scored the work high risk and blocked it for approval | Task set to blocked, `awaitingApproval` true, `approval_required` event written |
| The card reached real Slack | The notifier posted an Approve and Reject card into the channel | Card visible in the channel, reasons shown in plain language, not raw codes |
| A human governed the decision | The founder approved it | Approval recorded, `approval_granted` event written |
| The real server carried out the decision | The shared decision path completed the task and published the draft | Task set to completed, `approvedAt` stamped, draft published as a message |

Honest detail, because it took two tries to get this clean. On the first real pipeline runs the approval actually came through the web application route (`POST /api/tasks/:id/approve`), not the Slack button, the web UI happened to be open, so those runs proved the real pipeline to a real Slack card (outbound) but the approval was a web click. To prove the Slack button on a real pipeline task without that confound, a later run stopped the full server entirely and ran a socket only listener (no HTTP routes at all, so no web approve endpoint existed) against a fresh high risk task. The result:

| Stage | Evidence |
|---|---|
| Real pipeline produced the card | Fresh task, real agent draft (the agent actually refused: "I won't perform that task..."), safety gate blocked it, `approval_required` at 14:23:59 |
| Approved through the Slack button only | Full server down, only Socket Mode running, so the decision could enter only via `resolveTaskApproval` from a Slack `block_actions` payload |
| Completed | Task `completed`, `approvedAt` stamped, `approval_granted` at 14:34:39, the Slack card rewrote to Approved in place |

So the full chain, a real pipeline task carried all the way to a Slack button approval, is proven in one continuous run.

Two findings worth keeping from getting here. First, approving in the web app does not reach back to update the Slack card, so the card's buttons dangle after a web side decision. Cross surface sync (resolve in one place, mark it resolved everywhere) is a real nicety for later, not built here. Second, the inbound button only works while a process is holding the Socket Mode connection, if the listener is down when the button is clicked, the click is silently lost, so production needs the connection supervised (auto reconnect plus a health check), which the adapter's reconnect logic starts but a real deploy should harden.

---

## Why the architecture matters

- **No public URL.** Slack Socket Mode means Hatchin dials out and holds the socket. A customer connects Slack with two tokens and it works, with no inbound firewall, no tunnel, no webhook to expose. The whole loop ran from a local machine.
- **One pipeline, many surfaces.** The Slack click ran through the exact same decision path as the in app buttons and the Mattermost callback. Teams or Discord later is a small adapter, not another approval system. The engine is not rebuilt per channel.
- **Safety language travels.** The card said "Involves deleting or destroying data," not an internal safety code. The humanization that protects users in the web app carried automatically to the new surface.

---

## What this proves

- The core thesis is real, not a slide. Hatchin can reach into the chat a team already uses, and a human can govern a high risk agent action from there.
- Both directions of the bridge work, chained in one run: a real pipeline task produces a real Slack card (outbound), and a Slack button click resolves that task and rewrites its card (inbound), proven with the full web server stopped so the only possible path was the Slack socket.
- The design is genuinely channel agnostic. Slack was added as a sibling of Mattermost with no change to the decision pipeline.

## What this does not prove yet

- That people want it. One approval by the founder is a wiring proof, not demand.
- The full-fidelity conversation. You can now chat with a Hatch in Slack and get a real one-shot reply (see the addendum below), but not yet the full pipeline: multi-agent routing, the safety gate, task and deliverable creation, and a mirror into the Hatchin web app. That is the next release, and it carries the larger refactor.
- Scale and tenancy. This is single user and personal, not the org wide, multi tenant version. It ran on an isolated local database, not production, and nothing is merged or deployed.
- That the room is worth entering. An approval button is only valuable if the autonomy loop behind it produces work worth approving. The bridge is cheap now; the quality of the agents' work is where the real bet still sits.

---

## What is next

1. **The use case.** Replace the blunt "delete the database" test with a scenario where approving from chat is genuinely valuable: a marketer drafts a launch email and the founder approves the send from a phone, or an outbound support reply goes only after a human okay. This is what makes the bridge sellable rather than just a safety brake.
2. **The extension: agents in Slack.** Move from an approval pipe to a teammate you can talk to. Ship the cheap one shot slash command taste first to test whether people want to talk to the agents at all, then the full threaded conversation through the complete pipeline.

---

---

## Addendum, 2026 August: the conversation extension, proven live

The extension named in "What is next" is now built and proven on the same isolated instance, still one-shot fidelity (no chat-core refactor), with two ways to talk to the team:

- `/hatchin ask ...`: a slash command returns a one-shot in-character reply from a Hatch (Maya by default, or one you address by name). Because a slash command is ephemeral, the reply echoes your question above it so the exchange stays visible in the channel.
- Normal chat, no prefix: you just type in the mapped channel and a Hatch replies, like a normal Slack conversation. It is driven by Slack message events over the same Socket Mode connection, and it reads the last few messages back as short-term memory so it flows rather than answering cold every time.

One real bug surfaced and was fixed getting here. The Socket Mode connection could go half-open (alive on our side, dead on Slack's), so commands came back as "the app did not respond" while nothing reached the listener, the same failure class as the pg-boss half-open database socket that once wedged autonomy. A 30 second ping and pong heartbeat now terminates and reconnects a dead socket. That is the connection supervision the proof section above flagged as needed for production.

Still deliberately one-shot: one agent per turn, no multi-agent routing, no safety gate, no task or deliverable creation from Slack (the proposal blocks an agent may append are stripped from the reply, so a reader never sees internal syntax). The full-fidelity threaded conversation, mirrored into the web app, remains the next release with the larger refactor.

---

*Record written 2026 August 01, addendum 2026 August 02. The bridge code (Mattermost and Slack adapters, the shared decision path, the slash command and normal-chat handlers, and the tests) exists on the working branch and is not yet merged. The live runs described here used an isolated throwaway database and a disposable Slack workspace, both separate from any production system.*
