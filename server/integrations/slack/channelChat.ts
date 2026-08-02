/**
 * Normal-chat mode — channel bridge, Slack adapter (Level A+, the conversation, no slash prefix).
 *
 * Instead of `/hatchin ask ...`, you just talk in the mapped channel and a Hatch replies, like a normal
 * Slack conversation: your message shows as you, the reply shows as the bot. This is driven by Slack
 * *events* (delivered over the same Socket Mode connection as buttons and slash commands):
 *   - subscribe to `message.channels`  → the bot replies to every message in the channel (dedicated room)
 *   - subscribe to `app_mention`        → the bot replies only when it is @mentioned (shared room)
 * The handler is identical for both; the choice is which event you subscribe to in the Slack app config.
 *
 * Still deliberately one-shot per turn (reuses the WS-free `generateIntelligentResponse`, no chat-core
 * refactor), BUT it reads the last few channel messages so replies have short-term memory and read as a
 * real back-and-forth rather than amnesiac Q&A. No multi-agent conductor, no safety gate, no task or
 * deliverable creation (those arrive with the full-conversation release).
 */

import nodeFetch from 'node-fetch';
import { storage } from '../../storage.js';
import { generateIntelligentResponse } from '../../ai/openaiService.js';
import { postToSlack, type FetchLike } from './slackAdapter.js';
import { resolveAgent, stripProposalBlocks } from './slashCommand.js';
import type { SlackConfig } from './config.js';

const defaultFetch = nodeFetch as unknown as FetchLike;

export interface ParsedChannelMessage {
  channel: string;
  user: string | null;
  text: string;
  ts: string;
  isBot: boolean; // has a bot_id → posted by this app or another app; never reply to these
  subtype: string | null; // edits/joins/deletes carry a subtype; only plain messages get a reply
}

/** Pull the inner event out of an events_api envelope payload. Handles `message` and `app_mention`. */
export function parseChannelMessage(payload: unknown): ParsedChannelMessage | null {
  const p = (payload || {}) as Record<string, any>;
  const event = (p.event || {}) as Record<string, any>;
  if (event.type !== 'message' && event.type !== 'app_mention') return null;
  return {
    channel: typeof event.channel === 'string' ? event.channel : '',
    user: typeof event.user === 'string' ? event.user : null,
    text: typeof event.text === 'string' ? event.text : '',
    ts: typeof event.ts === 'string' ? event.ts : '',
    isBot: Boolean(event.bot_id),
    subtype: typeof event.subtype === 'string' ? event.subtype : null,
  };
}

/**
 * Should this message get a reply? The loop-prevention gate: never reply to the bot's own posts or any
 * other app (isBot), skip edits/joins/deletes (subtype), only the mapped channel, and ignore empty text.
 */
export function shouldReply(
  msg: ParsedChannelMessage | null,
  config: SlackConfig,
): { reply: boolean; reason: string } {
  if (!msg) return { reply: false, reason: 'unparseable' };
  if (msg.isBot) return { reply: false, reason: 'bot/self message' };
  if (msg.subtype) return { reply: false, reason: `subtype:${msg.subtype}` };
  if (msg.channel !== config.channelId) return { reply: false, reason: 'other channel' };
  if (!stripMentions(msg.text).trim()) return { reply: false, reason: 'empty after mentions' };
  return { reply: true, reason: 'ok' };
}

/** Remove Slack user mentions like `<@U123>` (the leading @bot on an app_mention, or any others). */
export function stripMentions(text: string): string {
  return text.replace(/<@[A-Z0-9]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

type HistoryTurn = { role: 'user' | 'assistant'; content: string; timestamp: string };

/** Read the last few channel messages (chronological) as conversation history, excluding the just-arrived
 *  one. Bot posts become `assistant` turns (with our "*Name:*" prefix stripped); everything else is `user`. */
export async function fetchChannelHistory(
  config: SlackConfig,
  channel: string,
  excludeTs: string,
  limit: number,
  fetchImpl: FetchLike = defaultFetch,
): Promise<HistoryTurn[]> {
  const res = await fetchImpl(`https://slack.com/api/conversations.history?channel=${channel}&limit=${limit}`, {
    headers: { Authorization: `Bearer ${config.botToken}` },
  });
  const body = (await res.json().catch(() => null)) as { ok?: boolean; messages?: any[] } | null;
  if (!body?.ok || !Array.isArray(body.messages)) return [];
  return body.messages
    .filter((m) => typeof m.text === 'string' && m.text.trim() && !m.subtype && m.ts !== excludeTs)
    .reverse() // Slack returns newest-first; we want chronological
    .map((m) => ({
      role: m.bot_id ? ('assistant' as const) : ('user' as const),
      content: stripMentions(String(m.text)).replace(/^\*[^*]+:\*\s*/, ''),
      timestamp: String(m.ts || ''),
    }));
}

export interface ChannelChatDeps {
  generate?: typeof generateIntelligentResponse;
  post?: typeof postToSlack;
  fetchHistory?: typeof fetchChannelHistory;
  fetchImpl?: FetchLike;
}

export interface ChannelChatResult {
  handled: boolean;
  agentName?: string;
  reason?: string;
}

/**
 * Handle one channel message: gate it, read recent history for context, generate a one-shot in-character
 * reply from the project's lead (Maya by default), and post it back into the channel. Best-effort and
 * self-contained (reads storage + Slack, no WS). Errors post a graceful fallback rather than going silent.
 */
export async function handleChannelMessage(
  payload: unknown,
  config: SlackConfig,
  deps: ChannelChatDeps = {},
): Promise<ChannelChatResult> {
  const generate = deps.generate ?? generateIntelligentResponse;
  const post = deps.post ?? postToSlack;
  const getHistory = deps.fetchHistory ?? fetchChannelHistory;

  const msg = parseChannelMessage(payload);
  const gate = shouldReply(msg, config);
  if (!gate.reply || !msg) return { handled: false, reason: gate.reason };

  const question = stripMentions(msg.text);

  const project = await storage.getProject(config.projectId);
  const agents = await storage.getAgentsByProject(config.projectId);
  const agent = resolveAgent(null, agents); // default lead (Maya); explicit addressing can come later
  if (!agent) {
    await post(config, { channel: msg.channel, text: 'No Hatches are set up in the mapped project yet.' }, deps.fetchImpl);
    return { handled: true, reason: 'no agents' };
  }

  const history = await getHistory(config, msg.channel, msg.ts, 10, deps.fetchImpl).catch(() => [] as HistoryTurn[]);

  const context = {
    mode: 'project' as const,
    projectName: project?.name ?? 'this project',
    projectId: config.projectId,
    agentRole: agent.role,
    agentId: agent.id,
    conversationHistory: history,
    userName: null,
    projectDirection: (project?.coreDirection as any) ?? null,
    teamMembers: agents.filter((a) => !a.isSpecialAgent).map((a) => ({ name: a.name, role: a.role })),
    agentIsSpecial: Boolean(agent.isSpecialAgent),
  };

  let reply: string;
  try {
    const response = await generate(question, agent.role, context as any);
    reply = stripProposalBlocks(response?.content ?? '') || 'Give me a moment and ask me again, I could not put that together just now.';
  } catch (err) {
    console.warn('[slack:chat] generation failed:', (err as Error).message);
    reply = 'Something went wrong reaching the team just now. Try again in a moment.';
  }

  await post(config, { channel: msg.channel, text: `*${agent.name}:* ${reply}` }, deps.fetchImpl);
  return { handled: true, agentName: agent.name };
}
