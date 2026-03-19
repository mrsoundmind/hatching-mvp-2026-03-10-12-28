// Phase 1.1.a: Speaking Authority Resolution
// Deterministic utility to determine which agent is allowed to speak first in a conversation

import { resolveTeamLead, type Agent as TeamLeadAgent } from './resolveTeamLead';
import { parseConversationId } from '@shared/conversationId';

export interface Agent {
  id: string;
  name: string;
  role: string;
  teamId?: string | null;
}

export interface SpeakingAuthorityParams {
  conversationScope: 'project' | 'team' | 'agent';
  conversationId: string;
  availableAgents: Agent[];
  addressedAgentId?: string;
}

export interface SpeakingAuthorityResult {
  allowedSpeaker: Agent;
  reason: string;
}

/**
 * Resolves which agent is allowed to speak first in a conversation.
 * 
 * Rules (applied in strict order):
 * 1. Direct agent conversation → that agent speaks
 * 2. Explicit addressing → addressed agent speaks
 * 3. Project scope → PM speaks first
 * 4. Team scope → Team Lead speaks first
 * 5. Fallback → first agent
 * 
 * @param params - Speaking authority resolution parameters
 * @returns SpeakingAuthorityResult with allowed speaker and reason
 * @throws Error if availableAgents is empty
 */
export function resolveSpeakingAuthority(
  params: SpeakingAuthorityParams
): SpeakingAuthorityResult {
  const { conversationScope, conversationId, availableAgents, addressedAgentId } = params;

  // Error handling: empty agents array
  if (!availableAgents || availableAgents.length === 0) {
    throw new Error(
      `Cannot resolve speaking authority: no agents available for conversation ${conversationId}`
    );
  }

  // Rule 1: Explicit Addressing (Highest Priority - Overrides Everything)
  if (addressedAgentId) {
    const addressedAgent = availableAgents.find(a => a.id === addressedAgentId);

    if (addressedAgent) {
      const result: SpeakingAuthorityResult = {
        allowedSpeaker: addressedAgent,
        reason: 'explicit_addressing'
      };

      if (process.env.NODE_ENV === 'development' || process.env.DEV) {
        console.log(
          `[SpeakingAuthority] scope=${conversationScope} speaker=${addressedAgent.id} reason=${result.reason}`
        );
      }

      return result;
    }
    // If addressed agent not found, fall through to other rules
  }

  // Rule 2: Direct Agent Conversation
  if (conversationScope === 'agent') {
    // Parse conversationId to get the agent ID
    try {
      const parsed = parseConversationId(conversationId);
      if (parsed.scope === 'agent' && parsed.contextId) {
        const agentId = parsed.contextId;
        const agent = availableAgents.find(a => a.id === agentId);

        if (agent) {
          const result: SpeakingAuthorityResult = {
            allowedSpeaker: agent,
            reason: 'direct_agent_conversation'
          };

          if (process.env.NODE_ENV === 'development' || process.env.DEV) {
            console.log(
              `[SpeakingAuthority] scope=${conversationScope} speaker=${agent.id} reason=${result.reason}`
            );
          }

          return result;
        }
        // If agent not found in availableAgents, fall through to other rules
      }
    } catch (error: any) {
      // If parsing fails, try to match agentId from availableAgents
      // Format: agent:${projectId}:${agentId}
      // For ambiguous IDs, try to find which agent ID matches the end of the conversationId
      if (conversationId.startsWith('agent:')) {
        // Try each available agent's ID to see if it matches the end of the conversationId
        for (const agent of availableAgents) {
          // Check if conversationId ends with the agent ID
          // e.g., "agent:saas-startup:agent-1" should match agent with id "agent-1"
          if (conversationId.endsWith(`:${agent.id}`) || conversationId.endsWith(agent.id)) {
            const result: SpeakingAuthorityResult = {
              allowedSpeaker: agent,
              reason: 'direct_agent_conversation'
            };

            if (process.env.NODE_ENV === 'development' || process.env.DEV) {
              console.log(
                `[SpeakingAuthority] scope=${conversationScope} speaker=${agent.id} reason=${result.reason}`
              );
            }

            return result;
          }
        }
      }
      // If all parsing attempts fail, fall through to other rules
      if (process.env.NODE_ENV === 'development' || process.env.DEV) {
        console.warn(`[SpeakingAuthority] Failed to parse agent conversationId: ${conversationId}`, error.message);
      }
    }
  }

  // Rule 3: Project Scope Authority
  if (conversationScope === 'project') {
    // Find Product Manager(s)
    const productManagers = availableAgents.filter(agent => {
      const roleLower = agent.role.toLowerCase();
      return roleLower.includes('product manager');
    });

    if (productManagers.length > 0) {
      // Pick first PM deterministically
      const pm = productManagers[0];
      const result: SpeakingAuthorityResult = {
        allowedSpeaker: pm,
        reason: 'project_scope_pm_authority'
      };

      if (process.env.NODE_ENV === 'development' || process.env.DEV) {
        console.log(
          `[SpeakingAuthority] scope=${conversationScope} speaker=${pm.id} reason=${result.reason}`
        );
      }

      return result;
    }
    // If no PM exists, fall through to fallback
  }

  // Rule 4: Team Scope Authority
  if (conversationScope === 'team') {
    try {
      // Parse conversationId to get teamId
      const parsed = parseConversationId(conversationId);
      if (parsed.scope === 'team' && parsed.contextId) {
        const teamId = parsed.contextId;

        // Use resolveTeamLead to get the Team Lead
        // Convert Agent[] to TeamLeadAgent[] (they're compatible)
        const teamLeadAgents: TeamLeadAgent[] = availableAgents.map(agent => ({
          id: agent.id,
          name: agent.name,
          role: agent.role,
          teamId: agent.teamId
        }));

        const teamLeadResult = resolveTeamLead(teamId, teamLeadAgents);

        const result: SpeakingAuthorityResult = {
          allowedSpeaker: teamLeadResult.lead,
          reason: 'team_scope_team_lead'
        };

        if (process.env.NODE_ENV === 'development' || process.env.DEV) {
          console.log(
            `[SpeakingAuthority] scope=${conversationScope} speaker=${teamLeadResult.lead.id} reason=${result.reason}`
          );
        }

        return result;
      }
    } catch (error: any) {
      // If parsing fails, try to extract teamId from conversationId directly
      // Format: team:${projectId}:${teamId}
      if (conversationId.startsWith('team:')) {
        const parts = conversationId.split(':');
        if (parts.length >= 3) {
          // Take everything after the second colon as teamId
          const teamId = parts.slice(2).join(':');

          // Use resolveTeamLead to get the Team Lead
          const teamLeadAgents: TeamLeadAgent[] = availableAgents.map(agent => ({
            id: agent.id,
            name: agent.name,
            role: agent.role,
            teamId: agent.teamId
          }));

          try {
            const teamLeadResult = resolveTeamLead(teamId, teamLeadAgents);

            const result: SpeakingAuthorityResult = {
              allowedSpeaker: teamLeadResult.lead,
              reason: 'team_scope_team_lead'
            };

            if (process.env.NODE_ENV === 'development' || process.env.DEV) {
              console.log(
                `[SpeakingAuthority] scope=${conversationScope} speaker=${teamLeadResult.lead.id} reason=${result.reason}`
              );
            }

            return result;
          } catch (leadError: any) {
            // If team lead resolution fails, fall through to fallback
            if (process.env.NODE_ENV === 'development' || process.env.DEV) {
              console.warn(`[SpeakingAuthority] Failed to resolve team lead: ${leadError.message}`);
            }
          }
        }
      }
      // If all parsing attempts fail, fall through to fallback
      if (process.env.NODE_ENV === 'development' || process.env.DEV) {
        console.warn(`[SpeakingAuthority] Failed to resolve team lead for conversationId: ${conversationId}`, error.message);
      }
    }
  }

  // Rule 5: Deterministic Fallback (Never Random)
  const fallbackAgent = availableAgents[0];
  const result: SpeakingAuthorityResult = {
    allowedSpeaker: fallbackAgent,
    reason: 'fallback_first_agent'
  };

  if (process.env.NODE_ENV === 'development' || process.env.DEV) {
    console.log(
      `[SpeakingAuthority] scope=${conversationScope} speaker=${fallbackAgent.id} reason=${result.reason}`
    );
  }

  return result;
}

