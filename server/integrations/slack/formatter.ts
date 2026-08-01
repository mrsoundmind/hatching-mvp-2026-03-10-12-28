/**
 * Formats autonomy events into Slack Block Kit — channel bridge, Slack adapter.
 *
 * Pure and defensive, same contract as the Mattermost formatter: reads payload fields with fallbacks
 * so a shape change never throws, and uses the shared `humanizeRiskReasons` so raw safety codes NEVER
 * leak into the channel. Returns null for event types we do not notify on.
 *
 * Slack mrkdwn differs from Markdown: *bold* (single asterisk), <url|text> links, :emoji:. So this
 * cannot reuse the Mattermost text; it emits Slack-native blocks plus a plain-text fallback.
 */

import type { AutonomyEvent } from '../../autonomy/events/eventTypes.js';
import { humanizeRiskReasons } from '@shared/riskReasons';

export interface FormattedSlackNotification {
  /** Plain-text fallback for notifications and screen readers. */
  text: string;
  /** Section blocks (the actions block with buttons is appended separately when applicable). */
  blocks: unknown[];
}

export function formatAutonomyEvent(event: AutonomyEvent, appBaseUrl: string): FormattedSlackNotification | null {
  const p = (event.payload || {}) as Record<string, unknown>;
  const openLink = event.projectId ? `${appBaseUrl}/maya/${event.projectId}` : appBaseUrl;

  switch (event.eventType) {
    case 'approval_required': {
      const agent = str(p.agentName) ?? 'A Hatch';
      const title = str(p.taskTitle) ?? 'a high-risk action';
      const why = bullets(humanizeRiskReasons(p.riskReasons));
      const md = `:rotating_light: *${agent}* needs your approval before continuing:\n*${title}*${why}`;
      return { text: `${agent} needs approval: ${title}`, blocks: [section(md)] };
    }
    case 'task_completed': {
      const agent = str(p.agentName) ?? str(p.completedByAgentName) ?? 'A Hatch';
      const title = str(p.taskTitle) ?? str(p.title) ?? 'a task';
      const md = `:white_check_mark: *${agent}* finished *${title}*.\n${link(openLink, 'Open in Hatchin')}`;
      return { text: `${agent} finished ${title}`, blocks: [section(md)] };
    }
    case 'handoff_initiated': {
      const from = str(readName(p.fromAgent)) ?? 'A Hatch';
      const to = str(readName(p.toAgent)) ?? 'another Hatch';
      const md = `:twisted_rightwards_arrows: *${from}* handed the work to *${to}*.\n${link(openLink, 'Open in Hatchin')}`;
      return { text: `${from} handed off to ${to}`, blocks: [section(md)] };
    }
    case 'safety_triggered': {
      const why = bullets(humanizeRiskReasons(p.riskReasons ?? p.reasons));
      const md = `:warning: A high-risk action was held for review.${why}\n${link(openLink, 'Review in Hatchin')}`;
      return { text: 'A high-risk action was held for review', blocks: [section(md)] };
    }
    default:
      return null;
  }
}

function section(mrkdwn: string): Record<string, unknown> {
  return { type: 'section', text: { type: 'mrkdwn', text: mrkdwn } };
}

function link(url: string, label: string): string {
  return `<${url}|${label}>`;
}

function bullets(reasons: string[]): string {
  return reasons.length ? '\n' + reasons.map((r) => `• ${r}`).join('\n') : '';
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function readName(v: unknown): string | null {
  if (v && typeof v === 'object' && 'name' in (v as Record<string, unknown>)) {
    const name = (v as Record<string, unknown>).name;
    return typeof name === 'string' ? name : null;
  }
  return null;
}
