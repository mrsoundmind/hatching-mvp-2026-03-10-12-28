/**
 * Phase 1.2: Agent Availability Helper
 * 
 * Centralized definition of what "available" means for agents in different scopes.
 * Replaces ad-hoc "availableAgents" assumptions with a single source of truth.
 */

import type { Agent } from "../ai/expertiseMatching";

/**
 * Scope Context for agent availability filtering
 */
export interface ScopeContext {
  projectId: string;
  mode: "project" | "team" | "agent";
  teamId?: string; // Required for team mode
  agentId?: string; // Required for agent mode
}

/**
 * Check if an agent is available in the given scope context
 * 
 * Phase 1.2 definition (simple, future-proof):
 * - Agent is available if:
 *   - It exists
 *   - It belongs to the project
 *   - If mode is team: agent.teamId matches teamId
 *   - If mode is agent: agent.id matches agentId OR at minimum agent exists in project
 *     (authority will select the addressed/target anyway)
 * 
 * Extension points (future):
 * - enabled/disabled flags
 * - availability windows
 * - capacity limits
 */
export function isAgentAvailable(agent: Agent, scopeContext: ScopeContext): boolean {
  // Agent must exist
  if (!agent || !agent.id) {
    return false;
  }
  
  // For now, we assume all agents passed to this function belong to the project
  // (caller is responsible for pre-filtering by project)
  
  if (scopeContext.mode === "team") {
    // Team mode: agent must belong to the specified team
    if (!scopeContext.teamId) {
      return false;
    }
    return agent.teamId === scopeContext.teamId;
  } else if (scopeContext.mode === "agent") {
    // Agent mode: agent must match the specified agentId
    // OR at minimum exist in project (authority will select addressed/target anyway)
    if (scopeContext.agentId) {
      return agent.id === scopeContext.agentId;
    }
    // If no specific agentId, agent is available if it exists in project
    return true;
  } else {
    // Project mode: all agents in project are available
    return true;
  }
}

/**
 * Filter agents to only those available in the given scope context
 * 
 * @param agents - All agents to filter (should be pre-filtered by project)
 * @param scopeContext - Scope context for availability check
 * @returns Filtered list of available agents
 */
export function filterAvailableAgents(
  agents: Agent[],
  scopeContext: ScopeContext
): Agent[] {
  return agents.filter(agent => isAgentAvailable(agent, scopeContext));
}

