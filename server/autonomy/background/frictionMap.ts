const devLog = (...args: unknown[]) => { if (process.env.NODE_ENV !== "production") console.log(...args); };
// Friction Map — Maps friction points to agent actions, routed through Maya
// Maya acts as orchestrator: receives the full friction list, selects ONE action per cycle.
// This prevents multiple agents from proactively messaging simultaneously.

import { FrictionPoint, ProjectHealthReport } from "./projectHealthScorer.js";


export interface FrictionAction {
  agentId: string;
  agentRole: string;
  agentName: string;
  frictionType: FrictionPoint["signal"] | "world_update";
  context: string;
  severity: number;
  targetConversationId: string; // Where to send the proactive message
}

const QUIET_HOUR_START = 22; // 10pm
const QUIET_HOUR_END = 8;    // 8am
const RECENT_ACTIVITY_MINUTES = 30; // If user was active in last 30min, skip

/**
 * Given a health report and a list of available agents in the project,
 * Maya's orchestrator selects ONE FrictionAction to execute this cycle.
 * Returns null if nothing qualifies or guardrails prevent outreach.
 */
export function selectFrictionAction(
  report: ProjectHealthReport,
  agents: Array<{
    id: string;
    name: string;
    role: string;
    lastProactiveAt?: string | null;
  }>,
  lastUserActivityAt: Date | null,
  currentHourUtc: number = new Date().getUTCHours()
): FrictionAction | null {
  // Guardrail: quiet hours (UTC)
  if (currentHourUtc >= QUIET_HOUR_START || currentHourUtc < QUIET_HOUR_END) {
    devLog("[FrictionMap] Quiet hours — skipping proactive outreach");
    return null;
  }

  // Guardrail: user was recently active — don't interrupt
  if (lastUserActivityAt) {
    const minutesSinceActivity =
      (Date.now() - lastUserActivityAt.getTime()) / (1000 * 60);
    if (minutesSinceActivity < RECENT_ACTIVITY_MINUTES) {
      devLog("[FrictionMap] User recently active — skipping proactive outreach");
      return null;
    }
  }

  const qualifiedPoints = report.frictionPoints.filter(
    (fp) => fp.severity >= 0.5
  );
  if (qualifiedPoints.length === 0) return null;

  // For each friction point, find a qualifying agent
  for (const fp of qualifiedPoints) {
    const candidateAgent = agents.find((a) => {
      if (a.role !== fp.targetRole) return false;
      if (!canAgentSendProactiveMessage(a.lastProactiveAt)) return false;
      return true;
    });

    if (candidateAgent) {
      return {
        agentId: candidateAgent.id,
        agentRole: candidateAgent.role,
        agentName: candidateAgent.name,
        frictionType: fp.signal,
        context: fp.context,
        severity: fp.severity,
        targetConversationId: `project:${report.projectId}`,
      };
    }
  }

  return null;
}

function canAgentSendProactiveMessage(lastProactiveAt?: string | null): boolean {
  if (!lastProactiveAt) return true;
  const last = new Date(lastProactiveAt);
  const hoursSince = (Date.now() - last.getTime()) / (1000 * 60 * 60);
  return hoursSince >= 24;
}
