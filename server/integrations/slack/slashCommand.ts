/**
 * `/hatchin ask ...` slash command — channel bridge, Slack adapter (Level A: the conversation taste).
 *
 * Deliberately one-shot and small: it reuses the WS-free `generateIntelligentResponse` generator, so it
 * needs NO chat-core refactor. No multi-agent conductor, no safety gate, no task or deliverable
 * detection (those arrive with the full-conversation release). It answers a question in character and
 * posts the reply into the channel.
 *
 * Formats supported (text after `/hatchin`):
 *   ask <question>          → the project's lead (Maya) answers
 *   @Name <question>        → the named Hatch answers
 *   ask @Name <question>    → same
 *   <question>              → the lead answers
 */

import { storage } from '../../storage.js';
import { generateIntelligentResponse } from '../../ai/openaiService.js';
import { postToSlack } from './slackAdapter.js';
import type { SlackConfig } from './config.js';
import type { FetchLike } from './slackAdapter.js';

export interface ParsedSlashCommand {
  command: string;
  addressed: string | null; // @Name, or null for the default lead
  question: string;
  channelId: string;
  userName: string | null;
}

/** Pull the command, addressed agent, and question out of a Slack slash_commands payload. */
export function parseSlashCommand(payload: unknown): ParsedSlashCommand | null {
  const p = (payload || {}) as Record<string, any>;
  const command = typeof p.command === 'string' ? p.command : '';
  if (command !== '/hatchin') return null;

  let rest = (typeof p.text === 'string' ? p.text : '').trim();
  // optional leading "ask" keyword (as a whole word, so a bare "/hatchin ask" leaves an empty question)
  rest = rest.replace(/^ask\b\s*/i, '');
  // optional leading @Name
  let addressed: string | null = null;
  const at = rest.match(/^@(\w[\w-]*)\s+([\s\S]+)$/);
  if (at) {
    addressed = at[1];
    rest = at[2];
  }
  return {
    command,
    addressed,
    question: rest.trim(),
    channelId: typeof p.channel_id === 'string' ? p.channel_id : '',
    userName: typeof p.user_name === 'string' ? p.user_name : null,
  };
}

/**
 * Remove the `[[...]]` proposal blocks (PROJECT_NAME / TASK / UPDATE / team-suggestion) an agent may
 * append to a reply. In the web app these are hidden side-effect triggers, parsed out before the message
 * is shown. Over Slack there is no such consumer, so if we posted the raw content the reader would see
 * internal syntax like `[[TASK: ...]]` — exactly the kind of unexplained token the self-documenting rule
 * forbids. Strip them and tidy the whitespace they leave behind.
 */
export function stripProposalBlocks(text: string): string {
  return text
    .replace(/\[\[[\s\S]*?\]\]/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Choose which Hatch answers: the addressed one by name/role, else the lead (Maya), else PM, else first. */
export function resolveAgent(addressed: string | null, agents: any[]): any | null {
  if (addressed) {
    const needle = addressed.toLowerCase();
    const found = agents.find(
      (a) => String(a.name).toLowerCase() === needle || String(a.role).toLowerCase().includes(needle),
    );
    if (found) return found;
  }
  return (
    agents.find((a) => a.isSpecialAgent) ??
    agents.find((a) => a.role === 'Product Manager') ??
    agents[0] ??
    null
  );
}

export interface SlashHandlerDeps {
  generate?: typeof generateIntelligentResponse;
  post?: (config: SlackConfig, msg: { channel: string; text: string; blocks?: unknown[] }, fetchImpl?: FetchLike) => Promise<string | null>;
  fetchImpl?: FetchLike;
}

export interface SlashResult {
  handled: boolean;
  agentName?: string;
  posted?: boolean;
  reason?: string;
}

/**
 * Handle one `/hatchin` invocation: resolve project + agent, generate a one-shot in-character reply,
 * post it into the channel. Best-effort and self-contained (only reads storage + posts to Slack).
 */
export async function handleHatchinCommand(
  payload: unknown,
  config: SlackConfig,
  deps: SlashHandlerDeps = {},
): Promise<SlashResult> {
  const generate = deps.generate ?? generateIntelligentResponse;
  const post = deps.post ?? postToSlack;

  const parsed = parseSlashCommand(payload);
  if (!parsed) return { handled: false, reason: 'not a /hatchin command' };

  const channel = parsed.channelId || config.channelId;

  if (!parsed.question) {
    await post(config, { channel, text: 'Ask me something, e.g. `/hatchin ask what should we prioritise this week?` or `/hatchin @Dev how would you structure the database?`' }, deps.fetchImpl);
    return { handled: true, posted: true, reason: 'empty question -> help' };
  }

  const project = await storage.getProject(config.projectId);
  const agents = await storage.getAgentsByProject(config.projectId);
  const agent = resolveAgent(parsed.addressed, agents);
  if (!agent) {
    await post(config, { channel, text: 'No Hatches are set up in the mapped project yet.' }, deps.fetchImpl);
    return { handled: true, posted: true, reason: 'no agents' };
  }

  const context = {
    mode: 'project' as const,
    projectName: project?.name ?? 'this project',
    projectId: config.projectId,
    agentRole: agent.role,
    agentId: agent.id,
    conversationHistory: [] as Array<{ role: 'user' | 'assistant'; content: string; timestamp: string }>,
    userName: parsed.userName,
    projectDirection: (project?.coreDirection as any) ?? null,
    teamMembers: agents.filter((a) => !a.isSpecialAgent).map((a) => ({ name: a.name, role: a.role })),
    agentIsSpecial: Boolean(agent.isSpecialAgent),
  };

  let reply: string;
  try {
    const response = await generate(parsed.question, agent.role, context as any);
    reply = stripProposalBlocks(response?.content ?? '') || 'I could not put together a good answer just now, try again in a moment.';
  } catch (err) {
    console.warn('[slack:slash] generation failed:', (err as Error).message);
    reply = 'Something went wrong reaching the team just now. Try again in a moment.';
  }

  // Slash commands are ephemeral: Slack does NOT echo the invoker's text into the channel when we reply
  // via the bot API, so the question would vanish and the answer would float with no visible prompt. Echo
  // the question (as a quote, attributed) above the reply so the exchange reads as a real conversation.
  const asker = parsed.userName || 'Someone';
  const echoed = `> *${asker} asked ${agent.name}:* ${parsed.question}\n\n*${agent.name}:* ${reply}`;
  await post(config, { channel, text: echoed }, deps.fetchImpl);
  return { handled: true, agentName: agent.name, posted: true };
}
