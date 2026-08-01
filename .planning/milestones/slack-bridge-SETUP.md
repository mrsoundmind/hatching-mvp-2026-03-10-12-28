# Slack Bridge: live-demo setup runbook

> Sibling adapter to the Mattermost bridge (see `mattermost-bridge-BRIEF.md`). Same channel-agnostic
> seam: the Notifier, the shared `resolveTaskApproval` service, and the `logAutonomyEvent` hook are
> reused unchanged. Only the Slack-specific formatting, transport, and token setup are new.
>
> Why Slack for the first live demo: a Slack workspace is free with no credit card, and Socket Mode
> means Hatchin dials OUT and holds a WebSocket, so button clicks arrive with NO public URL, no tunnel,
> and no deploy. A local Hatchin can run the entire approve-from-chat loop. That is the exact wall the
> Mattermost demo hit (no free reachable instance, and a public URL needed for the button callback).

## What the demo proves

1. A high-risk agent action posts an Approve or Reject card into your Slack channel within seconds.
2. Clicking Approve completes the task in Hatchin (draft published, `approval_granted` logged) with no
   browser session; Reject resets it (`approval_rejected`). The card rewrites in place to show the
   outcome and drops the buttons.
3. A stale click (already resolved in the web UI) no-ops gracefully instead of re-acting.

What it does NOT do yet: full conversation (@mention a Hatch and get a threaded reply). That is the
later Level 3 release and needs the chat-core refactor. This demo is the approval loop only.

## One-time Slack setup (about 10 minutes, no cost)

1. Create a free Slack workspace at slack.com/get-started (no card).
2. Create an app: api.slack.com/apps, click "Create New App", choose "From scratch", name it "Hatchin",
   pick your workspace.
3. Turn on Socket Mode: left nav "Socket Mode", toggle it on. Slack prompts you to generate an
   app-level token with the `connections:write` scope. Name it, generate, and copy the `xapp-...`
   token. This is `SLACK_APP_TOKEN`.
4. Enable Interactivity: left nav "Interactivity & Shortcuts", toggle Interactivity on. With Socket
   Mode enabled there is NO request URL to fill in; button clicks route over the socket.
5. Add the bot scope: left nav "OAuth & Permissions", under "Bot Token Scopes" add `chat:write`.
   (Optional: add `chat:write.public` so the bot can post without being invited to the channel.)
6. Install the app: on the same page click "Install to Workspace", approve. Copy the "Bot User OAuth
   Token" (`xoxb-...`). This is `SLACK_BOT_TOKEN`.
7. Create a channel (e.g. #hatchin) and invite the bot: type `/invite @Hatchin` in the channel. Then
   get the channel id: click the channel name, "About" tab, copy the Channel ID (`C...`) at the bottom.
   This is `SLACK_CHANNEL_ID`.
8. Pick which Hatchin project this channel maps to, and copy its project id. This is `SLACK_PROJECT_ID`.

## Env vars

Add to your local `.env` (feature is a full no-op unless the first three are set):

```bash
SLACK_BOT_TOKEN=xoxb-...        # required, bot posts + edits cards
SLACK_CHANNEL_ID=C...           # required, the channel to post into
SLACK_PROJECT_ID=<hatchin-project-id>   # required, the project this channel maps to
SLACK_APP_TOKEN=xapp-...        # optional; WITHOUT it, cards post as text + deep link and skip the
                                # buttons (no listener to receive clicks). WITH it, buttons work.
APP_BASE_URL=http://localhost:5001      # for the "Open in Hatchin" links
SLACK_NOTIFY_EVENTS=approval_required   # optional; default is approvals only, to avoid channel noise
```

## Run the demo

1. Start Hatchin: `npm run dev`. On boot you should see `[slack:socket] connected` in the logs. If you
   do not, `SLACK_APP_TOKEN` is missing or wrong, or the app is not installed.
2. Trigger a high-risk action so the safety floor fires and a task lands in `awaitingApproval`. The
   simplest path is the `phase-38-safety-floor` fixture, or in the app tell a Hatch to do something the
   safety scorer flags as destructive (e.g. "delete all the staging data"). The gate writes an
   `approval_required` event.
3. Within seconds an Approve / Reject card appears in #hatchin.
4. Click Approve. The task completes in Hatchin (check the web UI: the draft is published and the task
   is done), and the Slack card rewrites to ":white_check_mark: Approved: <task>".
5. Trigger another, click Reject (it asks you to confirm). The task resets to todo in Hatchin, and the
   card rewrites to ":x: Rejected: <task>".
6. To see the stale-click guard: open the same approval in the web UI and Approve it there, then click
   the Slack button. The card rewrites to "no longer awaiting approval" and nothing is double-acted.

## How it maps to the code

- Outbound card: `logAutonomyEvent` (unchanged hook) → `dispatchAutonomyEvent` → `SlackNotifierChannel`
  in `server/integrations/notifier.ts` → `formatAutonomyEvent` (Block Kit) + `buildApprovalActionsBlock`
  (the buttons) → `postToSlack` (`chat.postMessage`).
- Inbound click: `startSlackSocketMode` (booted in `server/routes.ts`) holds the Socket Mode WebSocket
  → `parseSocketMessage` → ack the envelope within 3s → `processInteractive` → `parseApprovalAction`
  → `resolveTaskApproval` (the SAME service the web UI and Mattermost callback use) → `updateSlackMessage`
  (`chat.update`) rewrites the card.
- Security: the socket is authenticated by the app-level token used to open it, so payloads on it are
  trusted; no HMAC is needed (unlike the Mattermost public HTTP callback). The button `value` carries
  the taskId; `action_id` says approve vs reject; the handler re-checks the task is still awaiting.

## Token hygiene

`xoxb-` and `xapp-` are secrets. Keep them in `.env` (gitignored), never commit or log them. If a token
leaks, rotate it: OAuth & Permissions page for the bot token, App-Level Tokens section for the app token.
For a throwaway demo workspace the blast radius is nil; for any real workspace, treat them like passwords.

## Automated coverage already in place

- `scripts/test-slack-notifier.ts` (19): config, Block Kit formatter incl. the raw-code leak guard,
  approval-button build + parse, Web API request builders, `postToSlack` over an injected fetch
  (200-with-ok:false still throws), notifier project/event gate.
- `scripts/test-slack-socket.ts` (7): frame parse, ack shape, `apps.connections.open` over a mock
  fetch, and `processInteractive` against in-memory storage (approve completes + rewrites the card,
  reject resets, stale click no-ops, non-approval payload is ignored).

These prove the logic end to end without the wire. The live demo above proves the wire.
