/**
 * Slack Socket Mode client — channel bridge, Slack adapter (inbound).
 *
 * This is the reason Slack can demo the whole approve-from-chat loop with NO public URL: instead of
 * Slack POSTing to us (like Mattermost), WE dial OUT and hold a WebSocket, and button clicks arrive
 * over it. The socket is authenticated by the app-level token used to open it, so payloads on it are
 * trusted (no HMAC needed). A local Hatchin can run the full loop.
 *
 * Wire protocol (hand-rolled on the installed `ws`, no @slack/socket-mode dependency):
 *   1. POST apps.connections.open with the app token → { url } (a temporary wss URL).
 *   2. Connect. Slack sends `{type:'hello'}`, then envelopes `{envelope_id, type, payload}`.
 *   3. ACK every envelope within ~3s by sending `{envelope_id}` back over the socket. Ack FIRST, then
 *      do the work async (resolveTaskApproval + chat.update), so we never miss the ack window.
 *   4. Slack may send `{type:'disconnect'}` before closing (refresh) — reconnect with a fresh URL.
 *
 * The connection is only opened when appToken is configured; otherwise this module is inert.
 */

import nodeFetch from 'node-fetch';
import WebSocket from 'ws';
import type { SlackConfig } from './config.js';
import { getSlackConfig } from './config.js';
import { parseApprovalAction } from './approvalBlocks.js';
import { updateSlackMessage, type FetchLike } from './slackAdapter.js';
import { resolveTaskApproval, type ApprovalBroadcasts } from '../../services/taskApprovalService.js';

const defaultFetch = nodeFetch as unknown as FetchLike;

// ── Pure, testable protocol helpers ──────────────────────────────────────────

export type SocketMessage =
  | { kind: 'hello' }
  | { kind: 'disconnect'; reason: string }
  | { kind: 'envelope'; envelopeId: string; type: string; payload: unknown; acceptsResponsePayload: boolean }
  | { kind: 'other'; type: string };

/** Parse a raw Socket Mode frame into a tagged message. Never throws. */
export function parseSocketMessage(raw: string): SocketMessage {
  let msg: any;
  try {
    msg = JSON.parse(raw);
  } catch {
    return { kind: 'other', type: 'unparseable' };
  }
  if (msg?.type === 'hello') return { kind: 'hello' };
  if (msg?.type === 'disconnect') return { kind: 'disconnect', reason: String(msg.reason ?? 'unknown') };
  if (typeof msg?.envelope_id === 'string') {
    return {
      kind: 'envelope',
      envelopeId: msg.envelope_id,
      type: String(msg.type ?? ''),
      payload: msg.payload,
      acceptsResponsePayload: Boolean(msg.accepts_response_payload),
    };
  }
  return { kind: 'other', type: String(msg?.type ?? 'unknown') };
}

/** The exact ack frame Slack expects: the envelope id echoed back. */
export function buildAck(envelopeId: string): string {
  return JSON.stringify({ envelope_id: envelopeId });
}

// ── Interactive handler (testable, no socket) ────────────────────────────────

export interface ProcessResult {
  handled: boolean;
  decision?: 'approve' | 'reject';
  ok?: boolean;
}

/**
 * Handle one interactive envelope payload: resolve the approval through the SHARED service (the same
 * path the web UI and the Mattermost callback use), then edit the Slack card in place to drop the
 * buttons. Best-effort: any failure is logged, never thrown into the socket loop.
 */
export async function processInteractive(
  payload: unknown,
  config: SlackConfig,
  deps: ApprovalBroadcasts,
  fetchImpl: FetchLike = defaultFetch,
): Promise<ProcessResult> {
  const parsed = parseApprovalAction(payload);
  if (!parsed) return { handled: false };

  // requireAwaiting closes the race with the web UI: a stale click no-ops instead of re-acting.
  const result = await resolveTaskApproval(parsed.taskId, parsed.action, deps, { requireAwaiting: true });

  // Rewrite the card whether or not it was still actionable, so the buttons never dangle.
  if (parsed.channelId && parsed.messageTs) {
    const approved = parsed.action === 'approve';
    const line = !result.ok
      ? ':information_source: This request is no longer awaiting approval.'
      : approved
        ? `:white_check_mark: *Approved*${result.taskTitle ? `: ${result.taskTitle}` : ''}`
        : `:x: *Rejected*${result.taskTitle ? `: ${result.taskTitle}` : ''}`;
    try {
      await updateSlackMessage(
        config,
        { channel: parsed.channelId, ts: parsed.messageTs, text: line, blocks: [{ type: 'section', text: { type: 'mrkdwn', text: line } }] },
        fetchImpl,
      );
    } catch (err) {
      console.warn('[slack:socket] card update failed:', (err as Error).message);
    }
  }

  return { handled: true, decision: parsed.action, ok: result.ok };
}

// ── Connection lifecycle ─────────────────────────────────────────────────────

/** POST apps.connections.open → temporary wss URL. Injectable fetch for tests. */
export async function openSocketUrl(config: SlackConfig, fetchImpl: FetchLike = defaultFetch): Promise<string> {
  if (!config.appToken) throw new Error('Slack Socket Mode requires SLACK_APP_TOKEN');
  const res = await fetchImpl('https://slack.com/api/apps.connections.open', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.appToken}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: '',
  });
  const data = (await res.json().catch(() => null)) as { ok?: boolean; url?: string; error?: string } | null;
  if (!data?.ok || !data.url) throw new Error(`apps.connections.open failed: ${data?.error ?? 'unknown_error'}`);
  return data.url;
}

let started = false;

/**
 * Start Socket Mode if configured. Idempotent and inert without appToken, so it is safe to call
 * unconditionally on server startup. Reconnects on drop/refresh with a small backoff.
 */
export function startSlackSocketMode(deps: ApprovalBroadcasts): void {
  if (started) return;
  const config = getSlackConfig();
  if (!config || !config.appToken) return; // feature off / outbound-only
  started = true;

  let attempt = 0;

  const connect = async (): Promise<void> => {
    try {
      const url = await openSocketUrl(config);
      const ws = new WebSocket(url);

      // Half-open detection. Slack (or any NAT/proxy/sleep) can silently drop the TCP path without a
      // FIN, leaving us "connected" while Slack has no live consumer — so slash commands and button
      // clicks vanish into "the app did not respond" and no frame ever reaches us (not even Slack's
      // hourly refresh_requested disconnect). Same failure class as the pg-boss half-open Supabase
      // socket. Ping on an interval; if a ping goes unanswered by the next tick, terminate and let the
      // close handler reconnect. Any inbound frame (message or pong) is proof of life.
      let isAlive = true;
      let heartbeat: ReturnType<typeof setInterval> | null = null;

      ws.on('open', () => {
        attempt = 0;
        isAlive = true;
        console.log('[slack:socket] connected');
        heartbeat = setInterval(() => {
          if (!isAlive) {
            console.warn('[slack:socket] heartbeat missed — connection is half-open, terminating to reconnect');
            try { ws.terminate(); } catch { /* noop */ }
            return;
          }
          isAlive = false;
          try { ws.ping(); } catch { /* socket gone; close handler reconnects */ }
        }, 30_000);
      });

      ws.on('pong', () => { isAlive = true; });

      ws.on('message', (data: WebSocket.RawData) => {
        isAlive = true;
        const parsed = parseSocketMessage(data.toString());
        console.log('[slack:socket] rx:', parsed.kind === 'envelope' ? parsed.type : parsed.kind);
        if (parsed.kind === 'envelope') {
          // Ack FIRST (within the 3s window), then process off the critical path.
          try { ws.send(buildAck(parsed.envelopeId)); } catch { /* socket gone; reconnect handles it */ }
          if (parsed.type === 'interactive') {
            void processInteractive(parsed.payload, config, deps).catch((err) =>
              console.warn('[slack:socket] interactive handler error:', (err as Error).message),
            );
          } else if (parsed.type === 'slash_commands') {
            // `/hatchin ask ...` — one-shot in-character reply (Level A). Ack already sent above; the
            // reply posts async so we never miss the 3s window.
            void import('./slashCommand.js')
              .then((m) => m.handleHatchinCommand(parsed.payload, config))
              .catch((err) => console.warn('[slack:socket] slash handler error:', (err as Error).message));
          } else if (parsed.type === 'events_api') {
            // Normal chat: a message (or @mention) in the channel — reply in-character, no slash prefix.
            // Ack already sent above; the loop-prevention gate (ignore the bot's own posts) lives in the
            // handler so we never reply to ourselves.
            void import('./channelChat.js')
              .then((m) => m.handleChannelMessage(parsed.payload, config))
              .catch((err) => console.warn('[slack:socket] chat handler error:', (err as Error).message));
          }
        } else if (parsed.kind === 'disconnect') {
          console.log(`[slack:socket] disconnect (${parsed.reason}); reconnecting`);
          try { ws.close(); } catch { /* noop */ }
        }
      });

      ws.on('close', () => {
        if (heartbeat) { clearInterval(heartbeat); heartbeat = null; }
        scheduleReconnect();
      });
      ws.on('error', (err: Error) => {
        console.warn('[slack:socket] error:', err.message);
        try { ws.close(); } catch { /* noop */ }
      });
    } catch (err) {
      console.warn('[slack:socket] connect failed:', (err as Error).message);
      scheduleReconnect();
    }
  };

  const scheduleReconnect = (): void => {
    attempt += 1;
    const delay = Math.min(30_000, 1_000 * 2 ** Math.min(attempt, 5)); // 2s..30s
    setTimeout(() => { void connect(); }, delay);
  };

  void connect();
}
