/**
 * Mattermost REST adapter — Mattermost bridge, Release 1 Phase 1 (outbound only).
 *
 * Posts a message via the bot REST API (`POST /api/v4/posts`). Kept deliberately thin: the request
 * is built by a pure function (`buildMattermostPostRequest`) so it can be unit-tested without a
 * network, and the executor (`postToMattermost`) takes an injectable fetch so tests never hit the wire.
 *
 * DO NOT build on the Mattermost "Apps Framework" (deprecated since v10). Bot token + REST is the path.
 * Later increments add threading (`root_id`), edit-in-place (`PUT /api/v4/posts/{id}/patch`), and the
 * inbound button/slash endpoint.
 */

import nodeFetch from 'node-fetch';
import type { MattermostConfig } from '../config.js';

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

export interface MattermostPost {
  channelId: string;
  message: string;
  /** Thread root; set to keep replies in one thread (used from Release 2 conversation). */
  rootId?: string;
  /** Message attachments / interactive buttons (used from Phase 2 approvals). */
  props?: Record<string, unknown>;
}

export interface MattermostRequest {
  url: string;
  method: 'POST';
  headers: Record<string, string>;
  body: string;
}

const defaultFetch = nodeFetch as unknown as FetchLike;

/** Pure: build the exact HTTP request for a Mattermost post. */
export function buildMattermostPostRequest(config: MattermostConfig, post: MattermostPost): MattermostRequest {
  const payload: Record<string, unknown> = {
    channel_id: post.channelId,
    message: post.message,
  };
  if (post.rootId) payload.root_id = post.rootId;
  if (post.props) payload.props = post.props;

  return {
    url: `${config.baseUrl}/api/v4/posts`,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  };
}

/**
 * Posts to Mattermost. Throws on non-2xx (caller in the notifier catches and swallows so the
 * autonomy event path is never affected). Returns the created post id (useful later for edit-in-place).
 */
export async function postToMattermost(
  config: MattermostConfig,
  post: MattermostPost,
  fetchImpl: FetchLike = defaultFetch,
): Promise<string | null> {
  const req = buildMattermostPostRequest(config, post);
  const res = await fetchImpl(req.url, { method: req.method, headers: req.headers, body: req.body });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Mattermost post failed: ${res.status} ${res.statusText} ${body.slice(0, 200)}`);
  }
  const data = (await res.json().catch(() => null)) as { id?: string } | null;
  return data?.id ?? null;
}
