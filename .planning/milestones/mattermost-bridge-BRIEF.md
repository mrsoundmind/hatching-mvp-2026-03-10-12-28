# Milestone Brief: Reach & Integrations — Mattermost Bridge (Hatchin in your team chat)

> Status: MILESTONE BRIEF (stub-scaffolded 2026-07-25). NOT started. v2.1 remains the active milestone (paused on audit remediation). Sequence after the core loop is proven, and confirm the autonomy loop is producing work worth approving/discussing before starting. Consistent with the no-mid-milestone-decimal-hotfixes rule. Scaffolded on branch `feat/mattermost-bridge` off restore tag `pre-mattermost-integration` (commit 2fec8d4). Grounded in a research pass over the Mattermost integration surface, the Hatchin code, and how Slack plus mature AI products (Glean, Agentforce, Dust) build seamless chat integrations.

## Context (why this exists)

Prompted by a competitive scan of Slack Workflow Automation plus a founder strategic question: "when a company uses Hatchin, don't make them switch, integrate with the communication platform they already use." The instinct is right. The correction: Hatchin should NOT try to BE the communication platform (Slack and Teams win that on distribution and reliability). Instead Hatchin reaches INTO the chat app the team already sits in.

Locked decisions (2026-07-25 session):
- Personal, single-user. No org/workspace tenancy in this milestone.
- First release channel: Mattermost (open source, self-hostable, no app review, easy to dogfood). The adapter seam is kept channel-agnostic so Slack and Teams are later adapters. Note for later: Slack is where most target companies actually are and its assistant surfaces make a seamless bot easier, so Slack is the natural next channel.
- Depth sequencing (the key decision): v1 ships the APPROVAL + NOTIFICATION loop PLUS a thin conversation taste (a `/hatchin` slash command returning a one-shot agent reply). All three reuse endpoints/functions that already exist, with NO chat-core refactor. Full LEVEL 3 conversation (@mention a Hatch, threaded, full pipeline) is a LATER release that carries the larger refactor. Rationale: approvals alone prove the plumbing but not the desire; the slash-command taste lets v1 also test whether people actually want to talk to their team, cheaply.
- Notifications default to approvals-only; the other three event classes are opt-in (avoid channel noise).

Out of scope for this milestone: the inbound connector hub (Jira/Notion/Drive/GitHub), company/org tenancy, Slack/Teams adapters (later), and any redesign of Hatchin's own web chat UI.

## The UX: two apps, kept in sync

There are always TWO apps, by design. Mattermost stays where humans talk to humans. Hatchin stays the AI team's workspace with the rich surfaces (deliverables, artifact panel, activity feed, run tree) that cannot exist as a flat chat message. The bridge lets Hatchin reach into Mattermost; it never merges the two. Rich outputs carry an "Open in Hatchin" link.

- v1 (this milestone): Hatchin posts approvals (and optionally the other events) into Mattermost; you Approve or Reject high-risk actions right there; and you can `/hatchin ask ...` to get a one-shot reply from a Hatch, a taste of conversation, all without opening Hatchin.
- Later (Release 2): full conversation, @mention a Hatch in Mattermost and it replies in-thread via the real pipeline, mirrored into the Hatchin web UI on the same conversation.

## Why v1 is small: no chat-core refactor

v1 touches three seams, all of which already exist:
- Outbound (notify + approval card): a dispatch hook on `logAutonomyEvent()` (`server/autonomy/events/eventLogger.ts` ~265), the universal choke point every notify-worthy event already flows through.
- Inbound (approve/reject): the existing `POST /api/tasks/:id/approve` (~309) and `/reject` (~394) in `server/routes/tasks.ts`; pending state is `task.metadata.awaitingApproval` + `draftOutput`, set by the gate in `server/autonomy/execution/taskExecutionPipeline.ts` (~348 to 373).
- Conversation taste: `generateIntelligentResponse(userMessage, agentRole, context)` (`server/ai/openaiService.ts` ~569), the WS-free one-shot generator, called from a slash-command handler. Deliberately limited (one-shot Q&A, no multi-agent conductor, no safety gate, no task/deliverable detection), which is exactly why it needs no refactor.

The large refactor of `handleStreamingColleagueResponse` is NOT needed for v1. It is deferred to the Release 2 full-conversation release.

## Transport and reachability (grounded)

Like Slack's Socket Mode, Mattermost supports an outbound-connection model; Hatchin does not need to expose most of the surface publicly.

| Path | Direction | Needs a public Hatchin inbound URL? | Used in |
|---|---|---|---|
| Post / edit an approval card (REST `/api/v4/posts`) | Hatchin calls OUT | No | v1 |
| One-way notifications (incoming webhook or bot REST) | Hatchin calls OUT | No | v1 |
| Interactive Approve/Reject button callback | Mattermost POSTs IN | Yes (one endpoint module) | v1 |
| Slash command `/hatchin ...` (one-shot taste) | Mattermost POSTs IN | Yes (same endpoint module) | v1 |
| Reaction-based approval fallback (`reaction_added`) | Hatchin receives OUT over WebSocket | No | v1 fallback |
| Receive channel messages (bot WebSocket `posted`) | Hatchin dials OUT | No | Release 2 |

v1 needs one small public endpoint module hosting the button callback and the slash command (both POSTs from Mattermost, token-verified), which hosted Hatchin on Fly can expose. The bot WebSocket for receiving free messages is only needed for Release 2.

Libraries: official `@mattermost/client` (REST `Client4`, and later its `WebSocketClient`) plus our already-installed `ws` as the Node polyfill. DO NOT use the Mattermost "Apps Framework": it is deprecated and unsupported as of Mattermost v10. Build on bot account + REST + interactive message attachments + slash commands (and, later, the bot WebSocket).

## Seamless-integration principles (learned from Slack and mature AI products)

Adopt these from the start; they are what makes an integration feel native rather than clunky.

1. Ack fast, work async. The slash command and button callback must return 200 within seconds; do the LLM work in a pg-boss job, then post/update. Skipping this causes timeouts, retries, and duplicate actions.
2. Mask latency with a live status. On `/hatchin`, immediately return an ephemeral "Maya is thinking...", then replace it with the reply via `response_url` or bot REST.
3. Thread everything. Keep replies and multi-agent chatter in one thread (`root_id`), never top-level spam.
4. Do not fake token streaming into chat. Use "status plus one final message." Mattermost has no streaming primitive anyway.
5. @mention the agent like a teammate, and hand off to a human gracefully when stuck, never a dead end.
6. Minimal footprint. Least-privilege bot, one token per Mattermost server stored encrypted, verify every inbound request, store metadata not chat data.
7. A "home base" surface (Slack App Home / split-pane assistant) makes an app feel installed. The Mattermost analog is a plugin Right-Hand Sidebar; heavier (ships a Go+React plugin into the customer's server), so treat it as optional later polish.

## Phases

### Release 1 (this milestone): approvals + notifications + conversation taste, small

- Phase 1, outbound notifier: a channel-agnostic Notifier interface + a Mattermost adapter (bot account + `@mattermost/client` REST) + a hook on `logAutonomyEvent` filtered to the four event types, defaulting to approvals-only with the rest opt-in + a new `integration_connections` config (Mattermost base URL, bot token, signing/command secret, channel-to-project map; token encrypted at rest) + a small settings surface. Ships: approval events (and any opted-in events) post into Mattermost, threaded via `root_id`.
- Phase 2, inbound approvals: one signed, session-exempt endpoint (exempt like `/api/billing/webhook` at `server/routes.ts` ~78 to 83) that verifies the secret in the button `context`, maps Approve/Reject onto the existing task endpoints, and edits the card in place; reaction fallback if a public endpoint is ever unavailable. Ack fast, resolve in a pg-boss job, dedupe on the Mattermost event/post id via the existing `processed_webhooks` precedent (`shared/schema.ts` ~486). Ships: approve/reject high-risk actions from Mattermost, no browser session.
- Phase 3, thin conversation taste: a Mattermost slash command (`/hatchin ask ...` or `/hatchin @Name ...`) posts to the same session-exempt, token-verified endpoint module; ack fast with an ephemeral "thinking" reply, then run a one-shot `generateIntelligentResponse` in a pg-boss job. Resolve the project from the channel map, the agent via `resolveMentionedAgent` (`server/ai/mentionParser.ts`) or default to Maya/PM via `resolveSpeakingAuthority` (`server/orchestration/resolveSpeakingAuthority.ts`), history via `storage.getMessagesByConversation`; optionally persist via `storage.createMessage` to mirror the web UI; post the reply via `response_url` or bot REST. Deliberately one-shot: no multi-agent conductor, no safety gate, no task/deliverable detection (those arrive with the Release 2 orchestrator). Ships: `/hatchin ask` returns a real in-character reply from a Hatch.

### Release 2 (later): Level 3 full conversation

- Phase 4, chat-core refactor (LARGE but clean): extract a WS-agnostic orchestrator from `handleStreamingColleagueResponse` (`server/routes/chat.ts` ~1680, about 1,878 lines) taking `{ projectId, conversationId, userMessage, addressedAgentId? }` plus an optional chunk sink instead of a `ws`. Confirmed clean: the deps to inject are few (`broadcastToConversation`, `devLog`, `sendWsError`, `getStreamingErrorPayload`, `buildServiceFallbackMessage`, `deriveProjectBrainPatch`, `extractAndStoreMemory`, `extractUserName`), `storage` is a module import, and the broadcasters are already bundled via `onBroadcastReady` (`chat.ts` ~1416). The existing WS handler becomes the first caller with no behavior change. Doubles as Phase 47 backlog #3 (chat.ts God-file split) and #4 (decouple cross-cutting concerns) paydown.
- Phase 5, inbound conversation: bot outbound WebSocket receives `posted`, ack-fast enqueues a pg-boss job, the job calls the Phase 4 orchestrator (full pipeline: multi-agent, safety, task/deliverable detection), shows a thinking status, then persists and posts the reply threaded, mirrored into the web UI. Ships: @mention a Hatch in Mattermost, full-fidelity reply, in sync with the web app.
- Phase 6, polish (optional): suggested-prompt starter buttons, per-event toggles, secret rotation, and (heavier) the plugin Right-Hand Sidebar home base. Validate the channel-agnostic seam by stubbing a Slack adapter without building it.

## Reuse points and code reality (grounded)

- One-shot generation for the taste: `generateIntelligentResponse` (`server/ai/openaiService.ts`), WS-free and reusable as-is.
- Agent selection: `resolveMentionedAgent`, `resolveSpeakingAuthority`, `filterAvailableAgents`. Conversation anchor: `buildConversationId('project', projectId)` (`shared/conversationId.ts`).
- Config storage: NO settings/credentials table exists; add a small `integration_connections` table. `processed_webhooks` is the inbound-idempotency precedent.
- Outbound HTTP: no shared wrapper; follow convention, `import fetch from 'node-fetch'`, for Mattermost REST.
- WebSocket client (Release 2 only): `ws` is installed, used only as a server today; `new WebSocket(url)` needs no new dependency. `@mattermost/client`'s `WebSocketClient` needs `globalThis.WebSocket = require('ws')` in Node; pin a working version.
- Background jobs: reuse pg-boss (`server/autonomy/execution/jobQueue.ts`) by adding named queues; `singletonKey` on the event id pairs with the idempotency table; mind the `backgroundExecution` feature flag (queue is null when off).
- Deep link: `${APP_BASE_URL}/maya/${projectId}` opens a project today; deep-linking to a specific deliverable or conversation is not URL-addressable yet and would need a small new client route.
- Humanize card text with `humanizeRiskReasons` (`shared/riskReasons.ts`).

## Mattermost mechanics and gotchas (verify at build time)

- Bot account + bot access token; the bot must be a member of a channel to post there.
- Slash commands and interactive callbacks are token-verified (no built-in HMAC); compare the secret constant-time, plus a freshness window. Slash-command `response_url` is valid ~30 min / multiple uses; the immediate response should be an ephemeral ack.
- Edit-in-place is `PUT /api/v4/posts/{id}/patch` (method PUT, not PATCH).
- The bot must ignore its own posts and other bots.
- Release 2 only: the `posted` event's `data.post` is a double-JSON-encoded string (parse twice); WebSocket transports drop events on reconnect, so design for at-least-once plus backfill.

## Prerequisites and honest gating

- Real precondition before starting: confirm the autonomy loop is producing work worth approving and Hatches produce replies worth reading. An approval button and a chat taste are doors; the rooms must be worth entering.
- Release 1 has no chat-core dependency; the large refactor gates only Release 2.
- Multi-user/org tenancy is NOT needed for personal v1, but IS the hard prerequisite for the company-wide version (`shared/schema.ts` is single-user; `teams` are teams of agents). That is a separate, larger milestone.
- No machine-auth layer exists (session-cookie only); a bot token plus the one signed endpoint module cover v1.

## Risks and gotchas

- Ack timeout and retry storms: resolve/generate in a pg-boss job, never inline; dedupe on the Mattermost event/post id, or a retried callback double-acts or double-replies.
- Draft-state race: a Mattermost approve must no-op gracefully if the task was already resolved in Hatchin.
- Taste fidelity gap: the one-shot slash reply is lower fidelity than the web chat (no multi-agent, no safety gate, no task creation). Set expectations, and make the full experience the Release 2 upgrade rather than letting the taste feel broken.
- Channel noise: default to approvals-only notifications; the rest opt-in.
- Token/secret hygiene: encrypted at rest, never logged, constant-time verification, replay window.
- Release 2: double-reply/ordering (honor the per-conversation streaming locks via the extracted orchestrator), no fake streaming, loop prevention, reconnect backfill.

## Effort note

Release 1 is small: three seams that already exist plus one config table and one signed endpoint module (buttons + slash command). Release 2 is where the cost is, chiefly the ~1,878-line refactor (Phase 4); large in volume, clean in dependencies. Do Release 1, learn whether teams want approvals and conversation in their chat, then decide on Release 2.

## Success criteria

Release 1 (this milestone):
1. A high-risk agent action posts an Approve/Reject card into the connected Mattermost channel within seconds; approvals notify by default, other event classes only if opted in.
2. Tapping Approve completes the task in Hatchin (draft published, `approval_granted` logged) with no browser session; Reject resets it (`approval_rejected`); the card updates in place.
3. `/hatchin ask ...` returns a real in-character one-shot reply from the addressed Hatch (or Maya by default) within seconds, with a thinking status during the wait.
4. A retried or unsigned callback (button or command) does not double-act, double-reply, or mutate state.

Release 2 (later):
5. @mentioning a Hatch in Mattermost produces a full-pipeline reply in-thread (thinking status during the wait), mirrored into the web UI on `project:{projectId}`.
6. The extracted orchestrator is called by both the WS handler and the Mattermost handler with no behavior change to the web app (existing chat specs still pass).
7. Swapping in a Slack adapter requires no change to the orchestrator, the Notifier interface, or the approve/reject/slash reuse.

## Verification (end to end, when built)

Release 1: spin up a local Mattermost (docker) with a bot account in a test channel, plus a tunnel for the one inbound endpoint module. Configure the connection (base URL, bot token, secret) in settings. Seed a high-risk task using the `phase-38-safety-floor` fixture; confirm the Approve/Reject card; tap Approve (assert task completed + `approval_granted`); tap Reject on another (assert reset + `approval_rejected`); re-deliver a callback and assert no double-act; confirm an unsigned callback is rejected. Run `/hatchin ask "..."`; assert an ephemeral thinking ack then a real in-character reply, and (if persistence is on) the message pair visible in the Hatchin web UI.

Release 2: @mention a Hatch; assert a thinking status then a full-pipeline threaded reply, in sync with the web UI. Re-run the existing web chat e2e specs to prove the Phase 4 extraction caused no regression.

## Not in scope

Connector hub (Jira/Notion/Drive/GitHub), company/org tenancy, Slack/Teams adapters (later), redesign of Hatchin's web chat UI.
