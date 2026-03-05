export interface RoleIdentity {
  projectId: string;
  roleTemplateId: string;
  agentId?: string;
  canonicalRoleKey: string;
}

export interface SafetyScore {
  hallucinationRisk: number; // 0-1
  scopeRisk: number; // 0-1
  executionRisk: number; // 0-1
  confidence: number; // 0-1
  reasons: string[];
}

export interface PeerReviewReport {
  reviewerRoleId: string;
  critique: string;
  riskFlags: string[];
  confidenceDelta: number;
}

export interface DecisionForecast {
  scenario: string;
  probability: number; // 0-1
  impact: "low" | "medium" | "high";
  leadIndicators: string[];
  mitigation: string[];
}

export interface ConductorDecision {
  route: "authority_default" | "intent_specialist" | "addressed_agent";
  reviewRequired: boolean;
  interventionRequired: boolean;
  gateRequired: boolean;
  confidence: number;
  reviewerCount: 0 | 1 | 2;
  reasons: string[];
}

export interface LearningEvent {
  id: string;
  projectId: string;
  conversationId: string;
  roleIdentity: RoleIdentity;
  eventType:
    | "turn"
    | "feedback"
    | "task_outcome"
    | "approval"
    | "rejection"
    | "forecast_outcome";
  input: string;
  output: string;
  outcome?: string;
  reward?: number;
  createdAt: string;
}

export interface DeliberationRound {
  roundNo: number;
  speakerRoleId: string;
  claim: string;
  critiqueOf?: string;
  confidence: number;
  evidence?: string[];
  createdAt: string;
}

export interface DeliberationSession {
  id: string;
  projectId: string;
  conversationId: string;
  objective: string;
  status: "active" | "completed";
  rounds: DeliberationRound[];
  finalSynthesis?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActionProposal {
  id: string;
  projectId: string;
  source: "deliberation" | "autopilot";
  actionType: string;
  payload: Record<string, any>;
  riskLevel: "low" | "medium" | "high";
  status: "pending" | "approved" | "rejected" | "executed";
  createdAt: string;
  updatedAt: string;
}

