/**
 * Slack Web API adapter — channel bridge, Slack adapter (outbound).
 *
 * Posts and edits messages via the bot Web API (`chat.postMessage`, `chat.update`). Kept thin and
 * mirror-image of the Mattermost adapter: pure request builders so they unit-test without a network,
 * and executors that take an injectable fetch so tests never hit the wire.
 *
 * IMPORTANT: Slack returns HTTP 200 even for logical failures, with `{ ok:false, error:"..." }` in the
 * body. So success is `res.ok && body.ok`, never HTTP status alone.
 */

import nodeFetch from 'node-fetch';
import type { SlackConfig } from './config.js';

const SLACK_API = 'https://slack.com/api';

/** Minimal fetch shape we depend on, so tests can inject a fake without node-fetch's types. */
export interface FetchResponseLike {
  ok: boolean;
  status: number;
  statusText: string;
  text(): Promise<string>;
  json(): Promise<unknown>;
}
export interface FetchLike {
  (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }): Promise<FetchResponseLike>;
}

export interface SlackMessage {
  channel: string;
  /** Plain-text fallback (notifications, screen readers). Always set it. */
  text: string;
  /** Block Kit blocks (buttons, sections). Optional. */
  blocks?: unknown[];
  /** Thread root (Slack ts); keeps replies in one thread (used from the conversation release). */
  threadTs?: string;
}

export interface SlackUpdate {
  channel: string;
  /** ts of the message to edit (from the interactive payload's message.ts). */
  ts: string;
  text: string;
  blocks?: unknown[];
}

export interface SlackRequest {
  url: string;
  method: 'POST';
  headers: Record<string, string>;
  body: string;
}

const defaultFetch = nodeFetch as unknown as FetchLike;

const authHeaders = (token: string): Record<string, string> => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json; charset=utf-8',
});

/** Pure: build the chat.postMessage request. */
export function buildSlackPostRequest(config: SlackConfig, msg: SlackMessage): SlackRequest {
  const payload: Record<string, unknown> = { channel: msg.channel, text: msg.text };
  if (msg.blocks) payload.blocks = msg.blocks;
  if (msg.threadTs) payload.thread_ts = msg.threadTs;
  return { url: `${SLACK_API}/chat.postMessage`, method: 'POST', headers: authHeaders(config.botToken), body: JSON.stringify(payload) };
}

/** Pure: build the chat.update request (edit a card in place). */
export function buildSlackUpdateRequest(config: SlackConfig, upd: SlackUpdate): SlackRequest {
  const payload: Record<string, unknown> = { channel: upd.channel, ts: upd.ts, text: upd.text };
  if (upd.blocks) payload.blocks = upd.blocks;
  return { url: `${SLACK_API}/chat.update`, method: 'POST', headers: authHeaders(config.botToken), body: JSON.stringify(payload) };
}

async function sendChecked(req: SlackRequest, fetchImpl: FetchLike): Promise<{ ts: string | null }> {
  const res = await fetchImpl(req.url, { method: req.method, headers: req.headers, body: req.body });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Slack call failed: ${res.status} ${res.statusText} ${body.slice(0, 200)}`);
  }
  const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; ts?: string } | null;
  if (!data || !data.ok) {
    throw new Error(`Slack API error: ${data?.error ?? 'unknown_error'}`);
  }
  return { ts: data.ts ?? null };
}

/** Post a message. Throws on failure (caller in the notifier catches + swallows). Returns the ts. */
export async function postToSlack(config: SlackConfig, msg: SlackMessage, fetchImpl: FetchLike = defaultFetch): Promise<string | null> {
  const { ts } = await sendChecked(buildSlackPostRequest(config, msg), fetchImpl);
  return ts;
}

/** Edit a message in place (used by the inbound handler to drop the buttons after a decision). */
export async function updateSlackMessage(config: SlackConfig, upd: SlackUpdate, fetchImpl: FetchLike = defaultFetch): Promise<void> {
  await sendChecked(buildSlackUpdateRequest(config, upd), fetchImpl);
}
