/**
 * Centralized chat mode derivation utility
 * 
 * Contract: Mode is derived ONLY from selection state:
 * - mode = 'agent' iff activeAgentId is a non-empty string
 * - else mode = 'team' iff activeTeamId is a non-empty string
 * - else mode = 'project'
 * 
 * This is the single source of truth for chat mode derivation.
 * All UI components must use this function to determine the current chat mode.
 */

export type ChatMode = 'project' | 'team' | 'agent';

/**
 * Derives the chat mode from selection state.
 * 
 * @param params - Selection state parameters
 * @param params.activeAgentId - Currently selected agent ID (null or non-empty string)
 * @param params.activeTeamId - Currently selected team ID (null or non-empty string)
 * @returns The derived chat mode
 */
export function deriveChatMode(params: {
  activeAgentId: string | null;
  activeTeamId: string | null;
}): ChatMode {
  const { activeAgentId, activeTeamId } = params;
  
  // Return 'agent' iff activeAgentId is a non-empty string
  if (activeAgentId && activeAgentId.trim().length > 0) {
    return 'agent';
  }
  
  // Return 'team' iff activeTeamId is a non-empty string
  if (activeTeamId && activeTeamId.trim().length > 0) {
    return 'team';
  }
  
  // Default to 'project' mode
  return 'project';
}

