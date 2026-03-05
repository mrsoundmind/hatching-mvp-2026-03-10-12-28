/**
 * Builds conversation IDs using the canonical format.
 * 
 * Formats:
 * - project → project-{projectId}
 * - team → team-{projectId}-{teamId}
 * - agent → agent-{projectId}-{agentId}
 */
export function buildConversationId(
  mode: 'project' | 'team' | 'agent',
  projectId: string,
  contextId?: string
): string {
  if (!projectId) {
    throw new Error('projectId is required to build conversation ID');
  }

  switch (mode) {
    case 'project':
      return `project:${projectId}`;

    case 'team':
      if (!contextId) {
        throw new Error('contextId (teamId) is required for team conversation ID');
      }
      return `team:${projectId}:${contextId}`;

    case 'agent':
      if (!contextId) {
        throw new Error('contextId (agentId) is required for agent conversation ID');
      }
      return `agent:${projectId}:${contextId}`;

    default:
      // TypeScript exhaustive check
      const _exhaustive: never = mode;
      throw new Error(`Unknown chat mode: ${_exhaustive}`);
  }
}

