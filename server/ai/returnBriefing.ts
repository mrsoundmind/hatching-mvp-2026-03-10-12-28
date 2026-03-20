// UX-03: Maya Return Briefing
// Summarizes background activity that happened while the user was away

import type { IStorage } from '../storage.js';

export interface BriefingInput {
  projectId: string;
  userId: string;
  lastSeenAt: Date;
  storage: IStorage;
}

export interface BriefingSummary {
  hasBriefing: boolean;
  summary: string;
  completedTasks: number;
  newMessages: number;
  brainUpdates: number;
}

export async function generateReturnBriefing(input: BriefingInput): Promise<BriefingSummary> {
  const { projectId, lastSeenAt, storage } = input;
  const empty: BriefingSummary = { hasBriefing: false, summary: '', completedTasks: 0, newMessages: 0, brainUpdates: 0 };

  try {
    // Check tasks completed since user left
    const allTasks = await storage.getTasksByProject(projectId);
    const completedSince = allTasks.filter(t =>
      t.status === 'completed' &&
      t.updatedAt &&
      new Date(t.updatedAt) > lastSeenAt
    );

    // Check messages since user left
    const conversationId = `project:${projectId}`;
    const recentMessages = await storage.getMessagesByConversation(conversationId);
    const messagesSince = recentMessages.filter(m =>
      m.messageType === 'agent' &&
      m.metadata &&
      (m.metadata as any).isAutonomous &&
      m.createdAt &&
      new Date(m.createdAt) > lastSeenAt
    );

    if (completedSince.length === 0 && messagesSince.length === 0) {
      return empty;
    }

    // Build natural language summary
    const parts: string[] = [];

    if (completedSince.length > 0) {
      const taskNames = completedSince.slice(0, 3).map(t => t.title);
      if (completedSince.length <= 3) {
        parts.push(`completed ${taskNames.join(', ')}`);
      } else {
        parts.push(`completed ${taskNames.join(', ')} and ${completedSince.length - 3} more task${completedSince.length - 3 > 1 ? 's' : ''}`);
      }
    }

    if (messagesSince.length > 0) {
      parts.push(`left ${messagesSince.length} update${messagesSince.length !== 1 ? 's' : ''} in chat`);
    }

    const summary = `While you were away, the team ${parts.join(' and ')}.`;

    return {
      hasBriefing: true,
      summary,
      completedTasks: completedSince.length,
      newMessages: messagesSince.length,
      brainUpdates: 0,
    };
  } catch {
    return empty;
  }
}
