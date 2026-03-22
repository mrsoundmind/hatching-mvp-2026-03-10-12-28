// UX-03: Maya Return Briefing
// LLM-generated summary of autonomous work that happened while the user was away.
// Follows the handoffAnnouncement.ts dependency-injection pattern.

import type { IStorage } from '../storage.js';

export interface BriefingInput {
  projectId: string;
  userId: string;
  lastBriefedAt: Date | null;        // null = never briefed, include all events
  storage: IStorage;
  broadcastToConversation: (convId: string, payload: unknown) => void;
  generateText: (prompt: string, system: string) => Promise<string>;
}

export interface BriefingResult {
  hasBriefing: boolean;
  messageId: string | null;           // ID of stored Maya message, or null if no briefing
}

export async function generateReturnBriefing(input: BriefingInput): Promise<BriefingResult> {
  const since = input.lastBriefedAt ?? new Date(0);
  const events = await input.storage.getAutonomyEventsSince(input.projectId, since);

  if (events.length === 0) {
    return { hasBriefing: false, messageId: null };
  }

  // Build data context from events
  const completedEvents = events.filter(e => e.eventType === 'task_completed');
  const failedEvents = events.filter(e => e.eventType === 'task_failed');
  const approvedEvents = events.filter(e => e.eventType === 'proposal_approved');
  const completedCount = completedEvents.length;
  const failedCount = failedEvents.length;

  // Resolve agent names
  const agents = await input.storage.getAgentsByProject(input.projectId);
  const agentMap = new Map<string, string>();
  for (const agent of agents) {
    agentMap.set(agent.id, agent.name);
  }

  // Collect involved agent IDs (deduplicated)
  const involvedAgentIds = [...new Set(events.map(e => e.agentId).filter((id): id is string => id !== null))];
  const involvedAgentNames = involvedAgentIds.map(id => agentMap.get(id) ?? 'a teammate').filter(Boolean);

  // Extract task titles from payload
  const completedTitles = completedEvents
    .map(e => (e.payload as any)?.taskTitle ?? (e.payload as any)?.title)
    .filter(Boolean)
    .slice(0, 3) as string[];
  const failedTitles = failedEvents
    .map(e => (e.payload as any)?.taskTitle ?? (e.payload as any)?.title)
    .filter(Boolean)
    .slice(0, 2) as string[];

  // Detect handoff chains: sequential events with different agentIds
  const handoffPairs: string[] = [];
  for (let i = 1; i < events.length; i++) {
    const prev = events[i - 1];
    const curr = events[i];
    if (prev.agentId && curr.agentId && prev.agentId !== curr.agentId) {
      const prevName = agentMap.get(prev.agentId) ?? 'a teammate';
      const currName = agentMap.get(curr.agentId) ?? 'another teammate';
      handoffPairs.push(`${prevName} handed to ${currName}`);
    }
  }
  const handoffSummary = handoffPairs.length > 0 ? `Handoffs: ${handoffPairs.slice(0, 2).join(', ')}.` : '';

  // Find Maya (special agent) for authorship
  const maya = agents.find(a => a.isSpecialAgent);

  // Build LLM prompt
  const completedLine = completedCount > 0
    ? `- ${completedCount} tasks completed: ${completedTitles.join(', ') || '(see task list)'}`
    : '';
  const failedLine = failedCount > 0
    ? `- ${failedCount} tasks need review: ${failedTitles.join(', ') || '(see task list)'}`
    : '';
  const approvedLine = approvedEvents.length > 0
    ? `- ${approvedEvents.length} proposal(s) approved`
    : '';
  const agentsLine = involvedAgentNames.length > 0
    ? `- Agents involved: ${involvedAgentNames.join(', ')}`
    : '';

  const dataSection = [completedLine, failedLine, approvedLine, agentsLine, handoffSummary]
    .filter(Boolean)
    .join('\n');

  const prompt = `You are Maya, the project coordinator for this team.
The user has been away and just returned. Summarize what happened.

Data:
${dataSection}

Rules:
- Lead with outcomes, not process: "Authentication module scoped — two items need your review"
- Name the agents: "Dev finished the auth endpoint, Sam flagged a gap"
- If all tasks completed successfully: "Everything's handled — ${completedCount} task${completedCount !== 1 ? 's' : ''} done while you were away"
- If some failed/blocked: "Dev tried X but flagged it for your review"
- Mention key handoffs if they happened
- 1-3 sentences maximum. Natural colleague voice. No bullet points. No markdown headers.
- If tasks await approval, mention it but don't duplicate the approval card UI.`;

  const system = `You are Maya, the team's project coordinator. Warm, concise, colleague tone.`;

  let briefingText: string;
  try {
    briefingText = await input.generateText(prompt, system);
    // Post-process: strip markdown as safety net (same as handoffAnnouncement.ts)
    briefingText = briefingText
      .replace(/^#+\s/gm, '')   // remove ## headers
      .replace(/^\*+\s/gm, '')  // remove ** or * bullet lines
      .replace(/^-\s/gm, '')    // remove - bullet points
      .replace(/\*\*/g, '')     // remove bold markers
      .trim();
  } catch {
    // Template fallback per user decision
    const parts: string[] = [];
    if (completedCount > 0) parts.push(`${completedCount} task${completedCount > 1 ? 's' : ''} completed`);
    if (failedCount > 0) parts.push(`${failedCount} need${failedCount > 1 ? '' : 's'} review`);
    briefingText = `While you were away: ${parts.join(', ')}.`;
  }

  // Store as real Maya message
  const conversationId = `project:${input.projectId}`;
  const msg = await input.storage.createMessage({
    conversationId,
    content: briefingText,
    messageType: 'agent',
    agentId: maya?.id ?? null,
    userId: null,
    metadata: {
      isAutonomous: true,
      isReturnBriefing: true,
      completedTasks: completedCount,
      failedTasks: failedCount,
    } as any,
  });

  // Broadcast as new_message (NOT return_briefing)
  input.broadcastToConversation(conversationId, {
    type: 'new_message',
    conversationId,
    message: msg,
  });

  return { hasBriefing: true, messageId: msg.id };
}
