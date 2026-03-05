// E1.1: Agent Expertise Matching System
// Analyzes questions and matches them to the most appropriate agents

import { roleProfiles, type RoleProfile } from './roleProfiles';

export interface Agent {
  id: string;
  name: string;
  role: string;
  teamId?: string;
}

export interface ExpertiseMatch {
  agent: Agent;
  confidence: number;
  reasoning: string;
  expertiseAreas: string[];
}

export interface QuestionAnalysis {
  topics: string[];
  complexity: 'low' | 'medium' | 'high';
  domain: string;
  requiresMultipleAgents: boolean;
}

// E1.1: Analyze question topics for expertise matching
export function analyzeQuestion(userMessage: string): QuestionAnalysis {
  const message = userMessage.toLowerCase();
  
  // Define expertise keywords for each domain
  const expertiseKeywords = {
    design: ['design', 'ui', 'ux', 'user experience', 'interface', 'wireframe', 'prototype', 'visual', 'layout', 'usability', 'accessibility'],
    development: ['code', 'programming', 'development', 'api', 'database', 'backend', 'frontend', 'react', 'node', 'javascript', 'typescript', 'bug', 'debug'],
    product: ['product', 'roadmap', 'feature', 'strategy', 'prioritization', 'requirements', 'user story', 'backlog', 'sprint', 'milestone'],
    quality: ['testing', 'qa', 'quality', 'bug', 'test', 'automation', 'performance', 'reliability', 'validation', 'verification'],
    marketing: ['marketing', 'content', 'copy', 'brand', 'messaging', 'campaign', 'conversion', 'copywriting', 'seo', 'social']
  };
  
  // Analyze topics
  const topics: string[] = [];
  const domainScores: Record<string, number> = {};
  
  Object.entries(expertiseKeywords).forEach(([domain, keywords]) => {
    let score = 0;
    keywords.forEach(keyword => {
      if (message.includes(keyword)) {
        score++;
        topics.push(keyword);
      }
    });
    domainScores[domain] = score;
  });
  
  // Determine primary domain
  const primaryDomain = Object.entries(domainScores).reduce((a, b) => 
    domainScores[a[0]] > domainScores[b[0]] ? a : b
  )[0];
  
  // Determine complexity based on question length and technical terms
  const technicalTerms = ['architecture', 'scalability', 'performance', 'optimization', 'integration', 'deployment'];
  const hasTechnicalTerms = technicalTerms.some(term => message.includes(term));
  const complexity = message.length > 100 || hasTechnicalTerms ? 'high' : 
                   message.length > 50 ? 'medium' : 'low';
  
  // Determine if multiple agents might be needed
  const requiresMultipleAgents = Object.values(domainScores).filter(score => score > 0).length > 1;
  
  return {
    topics,
    complexity,
    domain: primaryDomain,
    requiresMultipleAgents
  };
}

// E1.2: Route questions to most relevant agents
export function findBestAgentMatch(
  userMessage: string, 
  availableAgents: Agent[]
): ExpertiseMatch[] {
  const analysis = analyzeQuestion(userMessage);
  const matches: ExpertiseMatch[] = [];
  
  // Define role-to-domain mapping
  const roleDomainMapping: Record<string, string[]> = {
    'Product Designer': ['design'],
    'UI Engineer': ['development', 'design'],
    'Product Manager': ['product', 'design', 'development'],
    'Backend Developer': ['development'],
    'QA Lead': ['quality', 'development'],
    'Content Writer': ['marketing'],
    'Designer': ['marketing', 'design']
  };
  
  // For generic greetings or very short messages, default to Product Manager
  if (userMessage.toLowerCase().trim().length <= 10 || 
      ['hey', 'hi', 'hello', 'good morning', 'good afternoon', 'good evening'].includes(userMessage.toLowerCase().trim())) {
    const productManager = availableAgents.find(agent => agent.role === 'Product Manager');
    if (productManager) {
      return [{
        agent: productManager,
        confidence: 0.8,
        reasoning: 'Default agent for generic greetings',
        expertiseAreas: ['general', 'coordination']
      }];
    }
  }
  
  // Score each agent based on expertise match
  availableAgents.forEach(agent => {
    const roleProfile = roleProfiles[agent.role];
    if (!roleProfile) return;
    
    const agentDomains = roleDomainMapping[agent.role] || [];
    const domainMatch = agentDomains.includes(analysis.domain);
    
    // Calculate confidence score
    let confidence = 0;
    let reasoning = '';
    const expertiseAreas: string[] = [];
    
    if (domainMatch) {
      confidence += 0.6; // Base match
      reasoning += `Strong match for ${analysis.domain} domain. `;
      expertiseAreas.push(analysis.domain);
    }
    
    // Check for specific expertise areas in the question
    const message = userMessage.toLowerCase();
    const toolkit = roleProfile.roleToolkit.toLowerCase();
    const signatureMoves = roleProfile.signatureMoves.toLowerCase();
    
    // Check for toolkit matches
    const toolkitWords = toolkit.split(/[,\s]+/).filter(word => word.length > 3);
    const toolkitMatches = toolkitWords.filter(word => message.includes(word));
    if (toolkitMatches.length > 0) {
      confidence += 0.2;
      reasoning += `Expertise in ${toolkitMatches.join(', ')}. `;
      expertiseAreas.push(...toolkitMatches);
    }
    
    // Check for signature moves matches
    const signatureWords = signatureMoves.split(/[,\s]+/).filter(word => word.length > 3);
    const signatureMatches = signatureWords.filter(word => message.includes(word));
    if (signatureMatches.length > 0) {
      confidence += 0.2;
      reasoning += `Specialized in ${signatureMatches.join(', ')}. `;
      expertiseAreas.push(...signatureMatches);
    }
    
    // Adjust for complexity
    if (analysis.complexity === 'high' && agent.role === 'Product Manager') {
      confidence += 0.1; // PMs handle complex coordination
    }
    
    // Ensure minimum confidence for any match
    if (confidence > 0.1) {
      matches.push({
        agent,
        confidence: Math.min(confidence, 1.0),
        reasoning: reasoning || `General expertise in ${agent.role}`,
        expertiseAreas: Array.from(new Set(expertiseAreas)) // Remove duplicates
      });
    }
  });
  
  // Sort by confidence (highest first)
  return matches.sort((a, b) => b.confidence - a.confidence);
}

// E1.3: Multi-agent response coordination
export function coordinateMultiAgentResponse(
  userMessage: string,
  availableAgents: Agent[],
  maxAgents: number = 2
): Agent[] {
  const matches = findBestAgentMatch(userMessage, availableAgents);
  const analysis = analyzeQuestion(userMessage);
  
  // If question requires multiple agents or is complex, select top agents
  if (analysis.requiresMultipleAgents || analysis.complexity === 'high') {
    return matches
      .slice(0, maxAgents)
      .filter(match => match.confidence > 0.3)
      .map(match => match.agent);
  }
  
  // Otherwise, return the best single agent
  return matches.length > 0 && matches[0].confidence > 0.4 
    ? [matches[0].agent] 
    : [];
}

// E1.4: Expertise confidence scoring
export function calculateExpertiseConfidence(
  agent: Agent,
  userMessage: string,
  context: { projectType?: string; teamFocus?: string }
): number {
  const analysis = analyzeQuestion(userMessage);
  const roleProfile = roleProfiles[agent.role];
  
  if (!roleProfile) return 0;
  
  let confidence = 0;
  
  // Base confidence from domain match
  const roleDomainMapping: Record<string, string[]> = {
    'Product Designer': ['design'],
    'UI Engineer': ['development', 'design'],
    'Product Manager': ['product', 'design', 'development'],
    'Backend Developer': ['development'],
    'QA Lead': ['quality', 'development'],
    'Content Writer': ['marketing'],
    'Designer': ['marketing', 'design']
  };
  
  const agentDomains = roleDomainMapping[agent.role] || [];
  if (agentDomains.includes(analysis.domain)) {
    confidence += 0.5;
  }
  
  // Context-specific adjustments
  if (context.projectType === 'saas' && agent.role === 'Product Manager') {
    confidence += 0.2;
  }
  
  if (context.teamFocus === 'design' && agent.role === 'Product Designer') {
    confidence += 0.2;
  }
  
  // Question complexity adjustment
  if (analysis.complexity === 'high' && agent.role === 'Product Manager') {
    confidence += 0.1;
  }
  
  return Math.min(confidence, 1.0);
}

// Helper function to get agent expertise summary
export function getAgentExpertiseSummary(agent: Agent): string {
  const roleProfile = roleProfiles[agent.role];
  if (!roleProfile) return 'General expertise';
  
  return `${roleProfile.roleTitle}: ${roleProfile.expertMindset}`;
}

// E3: Agent Handoff System
export interface HandoffRequest {
  id: string;
  fromAgent: Agent;
  toAgent: Agent;
  reason: string;
  context: string;
  timestamp: Date;
  status: 'pending' | 'accepted' | 'rejected' | 'completed';
}

export interface HandoffHistory {
  handoffId: string;
  fromAgent: Agent;
  toAgent: Agent;
  reason: string;
  context: string;
  timestamp: Date;
  duration: number; // in milliseconds
  success: boolean;
}

// E3.1: Smooth handoff between agents
export function initiateHandoff(
  fromAgent: Agent,
  toAgent: Agent,
  reason: string,
  context: string
): HandoffRequest {
  return {
    id: `handoff-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    fromAgent,
    toAgent,
    reason,
    context,
    timestamp: new Date(),
    status: 'pending'
  };
}

// E3.2: Context transfer during handoffs
export function transferContext(
  handoffRequest: HandoffRequest,
  conversationHistory: any[],
  sharedMemory: string
): string {
  const contextSummary = `
HANDOFF CONTEXT:
From: ${handoffRequest.fromAgent.name} (${handoffRequest.fromAgent.role})
To: ${handoffRequest.toAgent.name} (${handoffRequest.toAgent.role})
Reason: ${handoffRequest.reason}
Context: ${handoffRequest.context}

CONVERSATION HISTORY:
${conversationHistory.slice(-5).map(msg => 
  `${msg.role}: ${msg.content}`
).join('\n')}

SHARED MEMORY:
${sharedMemory}

Please continue the conversation from this context.
  `.trim();
  
  return contextSummary;
}

// E3.3: Handoff request and acceptance flow
export function processHandoffRequest(
  handoffRequest: HandoffRequest,
  availableAgents: Agent[]
): { accepted: boolean; reason: string } {
  // Check if target agent is available
  const targetAgent = availableAgents.find(agent => agent.id === handoffRequest.toAgent.id);
  
  if (!targetAgent) {
    return {
      accepted: false,
      reason: 'Target agent is not available'
    };
  }
  
  // Check if handoff makes sense based on expertise
  const fromConfidence = calculateExpertiseConfidence(
    handoffRequest.fromAgent, 
    handoffRequest.context, 
    {}
  );
  const toConfidence = calculateExpertiseConfidence(
    handoffRequest.toAgent, 
    handoffRequest.context, 
    {}
  );
  
  // Accept handoff if target agent has higher confidence
  if (toConfidence > fromConfidence) {
    return {
      accepted: true,
      reason: `Target agent has higher expertise (${toConfidence.toFixed(2)} vs ${fromConfidence.toFixed(2)})`
    };
  }
  
  // Accept if confidence is similar and it's a logical handoff
  if (Math.abs(toConfidence - fromConfidence) < 0.1) {
    return {
      accepted: true,
      reason: 'Similar expertise levels, handoff accepted for better context'
    };
  }
  
  return {
    accepted: false,
    reason: 'Current agent has better expertise for this context'
  };
}

// E3.4: Handoff history tracking
export class HandoffTracker {
  private handoffHistory: HandoffHistory[] = [];
  
  recordHandoff(handoffRequest: HandoffRequest, duration: number, success: boolean): void {
    const handoffRecord: HandoffHistory = {
      handoffId: handoffRequest.id,
      fromAgent: handoffRequest.fromAgent,
      toAgent: handoffRequest.toAgent,
      reason: handoffRequest.reason,
      context: handoffRequest.context,
      timestamp: handoffRequest.timestamp,
      duration,
      success
    };
    
    this.handoffHistory.push(handoffRecord);
    
    // Keep only last 100 handoffs to prevent memory issues
    if (this.handoffHistory.length > 100) {
      this.handoffHistory = this.handoffHistory.slice(-100);
    }
  }
  
  getHandoffHistory(agentId?: string): HandoffHistory[] {
    if (agentId) {
      return this.handoffHistory.filter(h => 
        h.fromAgent.id === agentId || h.toAgent.id === agentId
      );
    }
    return [...this.handoffHistory];
  }
  
  getHandoffStats(): {
    totalHandoffs: number;
    successfulHandoffs: number;
    averageDuration: number;
    mostCommonHandoff: string;
  } {
    const totalHandoffs = this.handoffHistory.length;
    const successfulHandoffs = this.handoffHistory.filter(h => h.success).length;
    const averageDuration = totalHandoffs > 0 
      ? this.handoffHistory.reduce((sum, h) => sum + h.duration, 0) / totalHandoffs 
      : 0;
    
    // Find most common handoff pattern
    const handoffPatterns = this.handoffHistory.map(h => 
      `${h.fromAgent.role} -> ${h.toAgent.role}`
    );
    const patternCounts = handoffPatterns.reduce((acc, pattern) => {
      acc[pattern] = (acc[pattern] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const mostCommonHandoff = Object.entries(patternCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'None';
    
    return {
      totalHandoffs,
      successfulHandoffs,
      averageDuration,
      mostCommonHandoff
    };
  }
}

// Global handoff tracker instance
export const handoffTracker = new HandoffTracker();
