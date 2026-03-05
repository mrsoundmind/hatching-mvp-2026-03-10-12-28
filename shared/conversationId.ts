/**
 * Canonical Conversation ID Contract
 * 
 * Shared utility for building and parsing conversation IDs used across client and server.
 * 
 * Formats (must remain identical):
 * - Project: project:{projectId}
 * - Team: team:{projectId}:{teamId}
 * - Agent: agent:{projectId}:{agentId}
 */

export type ConversationScope = "project" | "team" | "agent";

export interface ParsedConversationId {
  scope: ConversationScope;
  projectId: string;
  contextId?: string; // teamId for team scope, agentId for agent scope
  raw: string;
}

/**
 * Builds a conversation ID using the canonical format.
 * 
 * @param scope - The conversation scope (project, team, or agent)
 * @param projectId - The project identifier (required)
 * @param contextId - The team or agent identifier (required for team/agent scope)
 * @returns The conversation ID string
 * @throws Error if inputs are invalid
 */
export function buildConversationId(
  scope: ConversationScope,
  projectId: string,
  contextId?: string
): string {
  if (!projectId || projectId.trim() === '') {
    throw new Error('projectId is required and cannot be empty');
  }

  switch (scope) {
    case 'project':
      if (contextId !== undefined) {
        throw new Error('project scope must not accept contextId');
      }
      return `project:${projectId}`;

    case 'team':
      if (!contextId || contextId.trim() === '') {
        throw new Error('contextId (teamId) is required for team conversation ID');
      }
      return `team:${projectId}:${contextId}`;

    case 'agent':
      if (!contextId || contextId.trim() === '') {
        throw new Error('contextId (agentId) is required for agent conversation ID');
      }
      return `agent:${projectId}:${contextId}`;

    default:
      // TypeScript exhaustive check
      const _exhaustive: never = scope;
      throw new Error(`Unknown conversation scope: ${_exhaustive}`);
  }
}

/**
 * Parses a conversation ID string into its components.
 * 
 * IMPORTANT: This parser uses ":" as a delimiter to support UUIDs and multi-word IDs.
 * 
 * @param conversationId - The conversation ID string to parse
 * @returns Parsed conversation ID components
 * @throws Error if the format is invalid
 */
export function parseConversationId(
  conversationId: string
): ParsedConversationId {
  if (!conversationId || conversationId.trim() === '') {
    throw new Error('conversationId cannot be empty');
  }

  const trimmed = conversationId.trim();

  // Must contain the colon delimiter
  if (!trimmed.includes(':')) {
    throw new Error(
      `Invalid conversation ID format: must contain ":" delimiter. Got: "${trimmed}"`
    );
  }

  const parts = trimmed.split(':');
  const scope = parts[0] as ConversationScope;

  if (scope !== 'project' && scope !== 'team' && scope !== 'agent') {
    throw new Error(
      `Invalid conversation scope: expected "project", "team" or "agent", got "${scope}"`
    );
  }

  if (scope === 'project') {
    if (parts.length !== 2) {
      throw new Error(`Invalid project conversation ID: expected 2 parts, got ${parts.length}`);
    }
    return {
      scope: 'project',
      projectId: parts[1],
      raw: trimmed
    };
  }

  // team or agent
  if (parts.length !== 3) {
    throw new Error(`Invalid ${scope} conversation ID: expected 3 parts, got ${parts.length}`);
  }

  return {
    scope,
    projectId: parts[1],
    contextId: parts[2],
    raw: trimmed
  };
}

