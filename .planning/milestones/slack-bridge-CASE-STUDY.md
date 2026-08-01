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
| A human governed it from Slack | The founder clicked Approve in Slack | Click received by the running server over Socket Mode |
| The real server carried out the decision | The shared decision path completed the task and published the draft | Task set to completed, `approvedAt` stamped, draft published as a message, `approval_granted` event written |

No seeded event this time. A genuine agent produced genuinely dangerous output, the real autonomy pipeline caught it, it surfaced in Slack, a human approved it from there, and the real Hatchin server carried out the decision, all of it also visible in the web application.

---

## Why the architecture matters

- **No public URL.** Slack Socket Mode means Hatchin dials out and holds the socket. A customer connects Slack with two tokens and it works, with no inbound firewall, no tunnel, no webhook to expose. The whole loop ran from a local machine.
- **One pipeline, many surfaces.** The Slack click ran through the exact same decision path as the in app buttons and the Mattermost callback. Teams or Discord later is a small adapter, not another approval system. The engine is not rebuilt per channel.
- **Safety language travels.** The card said "Involves deleting or destroying data," not an internal safety code. The humanization that protects users in the web app carried automatically to the new surface.

---

## What this proves

- The core thesis is real, not a slide. Hatchin can reach into the chat a team already uses, and a human can govern a high risk agent action from there.
- The bridge works in both directions, with the work behind it genuine end to end.
- The design is genuinely channel agnostic. Slack was added as a sibling of Mattermost with no change to the decision pipeline.

## What this does not prove yet

- That people want it. One approval by the founder is a wiring proof, not demand.
- The full conversation. You cannot yet mention an agent in Slack and get a real threaded reply. That is the next release, and it carries the larger refactor.
- Scale and tenancy. This is single user and personal, not the org wide, multi tenant version. It ran on an isolated local database, not production, and nothing is merged or deployed.
- That the room is worth entering. An approval button is only valuable if the autonomy loop behind it produces work worth approving. The bridge is cheap now; the quality of the agents' work is where the real bet still sits.

---

## What is next

1. **The use case.** Replace the blunt "delete the database" test with a scenario where approving from chat is genuinely valuable: a marketer drafts a launch email and the founder approves the send from a phone, or an outbound support reply goes only after a human okay. This is what makes the bridge sellable rather than just a safety brake.
2. **The extension: agents in Slack.** Move from an approval pipe to a teammate you can talk to. Ship the cheap one shot slash command taste first to test whether people want to talk to the agents at all, then the full threaded conversation through the complete pipeline.

---

*Record written 2026 August 01. The bridge code (Mattermost and Slack adapters, the shared decision path, and the tests) exists on the working branch and is not yet merged. The live run described here used an isolated throwaway database and a disposable Slack workspace, both separate from any production system.*
