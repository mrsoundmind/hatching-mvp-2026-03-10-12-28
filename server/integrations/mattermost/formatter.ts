/**
 * Formats autonomy events into Mattermost message text — Mattermost bridge, Release 1 Phase 1.
 *
 * Pure and defensive: reads payload fields with fallbacks so a shape change never throws. Uses the
 * shared `humanizeRiskReasons` so raw safety codes NEVER leak into the channel (same rule as the
 * in-app approval cards). Returns null for event types we do not notify on.
 *
 * Payload shapes (from the emitters):
 *   approval_required  { taskId, taskTitle, agentName, riskReasons: string[] }  (taskExecutionPipeline)
 *   handoff_initiated  { fromAgent:{id,name}, toAgent:{id,name}, taskId }        (handoffOrchestrator)
 *   task_completed     { taskId, taskTitle | title, agentName | completedByAgentName }
 *   safety_triggered   { riskReasons | reasons }
 */

import type { AutonomyEvent } from '../../autonomy/events/eventTypes.js';
import { humanizeRiskReasons } from '@shared/riskReasons';

export interface FormattedNotification {
  text: string;
}

export function formatAutonomyEvent(event: AutonomyEvent, appBaseUrl: string): FormattedNotification | null {
  const p = (event.payload || {}) as Record<string, unknown>;
  const openLink = event.projectId ? `${appBaseUrl}/maya/${event.projectId}` : appBaseUrl;

  switch (event.eventType) {
    case 'approval_required': {
      const agent = str(p.agentName) ?? 'A Hatch';
      const title = str(p.taskTitle) ?? 'a high-risk action';
      const why = bullets(humanizeRiskReasons(p.riskReasons));
      return {
        text: `:rotating_light: **${agent}** needs your approval before continuing:\n**${title}**${why}\n\n[Approve or reject in Hatchin](${openLink})`,
      };
    }
    case 'task_completed': {
      const agent = str(p.agentName) ?? str(p.completedByAgentName) ?? 'A Hatch';
      const title = str(p.taskTitle) ?? str(p.title) ?? 'a task';
      return { text: `:white_check_mark: **${agent}** finished **${title}**.\n\n[Open in Hatchin](${openLink})` };
    }
    case 'handoff_initiated': {
      const from = str(readName(p.fromAgent)) ?? 'A Hatch';
      const to = str(readName(p.toAgent)) ?? 'another Hatch';
      return { text: `:twisted_rightwards_arrows: **${from}** handed the work to **${to}**.\n\n[Open in Hatchin](${openLink})` };
    }
    case 'safety_triggered': {
      const why = bullets(humanizeRiskReasons(p.riskReasons ?? p.reasons));
      return { text: `:warning: A high-risk action was held for review.${why}\n\n[Review in Hatchin](${openLink})` };
    }
    default:
      return null;
  }
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
