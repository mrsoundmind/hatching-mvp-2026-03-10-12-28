// Phase 1.0: Team Lead Resolution
// Deterministic utility to identify exactly one Team Lead for a given team

export interface Agent {
  id: string;
  name: string;
  role: string;
  teamId?: string;
  isTeamLead?: boolean; // Future-proof: may not exist yet
}

export interface TeamLeadResult {
  lead: Agent;
  reason: string;
}

/**
 * Resolves the Team Lead for a given team using deterministic rules.
 * 
 * Rules (applied in order):
 * 1. Explicit team lead (if isTeamLead === true)
 * 2. Role-based priority matching
 * 3. PM exclusion (Product Manager never leads)
 * 4. Deterministic fallback (first agent)
 * 
 * @param teamId - The team ID (for logging purposes)
 * @param agents - Array of agents belonging to the team
 * @returns TeamLeadResult with lead agent and reason
 */
export function resolveTeamLead(teamId: string, agents: Agent[]): TeamLeadResult {
  if (!agents || agents.length === 0) {
    throw new Error(`Cannot resolve team lead: no agents provided for team ${teamId}`);
  }

  // Rule 1: Explicit Team Lead (future-proof, optional)
  const explicitLead = agents.find(agent => 
    agent.isTeamLead === true
  );
  
  if (explicitLead) {
    const result: TeamLeadResult = {
      lead: explicitLead,
      reason: "explicit_team_lead"
    };
    
    if (process.env.NODE_ENV === 'development' || process.env.DEV) {
      console.log(`[TeamLead] team=${teamId} lead=${explicitLead.id} reason=${result.reason}`);
    }
    
    return result;
  }

  // Rule 2: Role-Based Priority (Primary Rule)
  const rolePriority = [
    "Tech Lead",
    "Engineering Lead",
    "Design Lead",
    "UX Lead",
    "Product Lead",
    "Team Lead",
    "Lead",
    "Senior Engineer",
    "Senior Designer"
  ];

  // Filter out PMs first (Rule 3: PM Exclusion)
  const nonPMAgents = agents.filter(agent => {
    const roleLower = agent.role.toLowerCase();
    return !roleLower.includes("product manager");
  });

  // If all agents are PMs, we'll still need to return one (fallback will handle)
  const candidatesToCheck = nonPMAgents.length > 0 ? nonPMAgents : agents;

  // Try each priority role in order
  for (const priorityRole of rolePriority) {
    const priorityRoleLower = priorityRole.toLowerCase();
    
    // Find first agent whose role matches (case-insensitive, partial match)
    // Partial match: agent role contains priority role as substring OR
    // all words of priority role appear in agent role (in order)
    const matchingAgent = candidatesToCheck.find(agent => {
      const agentRoleLower = agent.role.toLowerCase();
      
      // Direct substring match
      if (agentRoleLower.includes(priorityRoleLower)) {
        return true;
      }
      
      // Partial word match: check if all words of priority role appear in agent role
      const priorityWords = priorityRoleLower.split(/\s+/).filter(w => w.length > 0);
      if (priorityWords.length > 1) {
        // For multi-word priority roles, check if all words appear in order
        let lastIndex = -1;
        let allWordsFound = true;
        for (const word of priorityWords) {
          const wordIndex = agentRoleLower.indexOf(word, lastIndex + 1);
          if (wordIndex === -1) {
            allWordsFound = false;
            break;
          }
          lastIndex = wordIndex;
        }
        if (allWordsFound) {
          return true;
        }
      }
      
      return false;
    });

    if (matchingAgent) {
      const result: TeamLeadResult = {
        lead: matchingAgent,
        reason: `role_priority:${priorityRole}`
      };
      
      if (process.env.NODE_ENV === 'development' || process.env.DEV) {
        console.log(`[TeamLead] team=${teamId} lead=${matchingAgent.id} reason=${result.reason}`);
      }
      
      return result;
    }
  }

  // Rule 4: Deterministic Fallback (Non-negotiable)
  // Select first agent in array (deterministic, not random)
  const fallbackAgent = candidatesToCheck[0];
  const result: TeamLeadResult = {
    lead: fallbackAgent,
    reason: "fallback:first_agent"
  };
  
  if (process.env.NODE_ENV === 'development' || process.env.DEV) {
    console.log(`[TeamLead] team=${teamId} lead=${fallbackAgent.id} reason=${result.reason}`);
  }
  
  return result;
}

