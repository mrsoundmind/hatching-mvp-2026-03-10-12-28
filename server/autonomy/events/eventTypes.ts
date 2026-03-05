export type AutonomyEventType =
  | 'hatch_selected'
  | 'deliberation_round'
  | 'synthesis_completed'
  | 'safety_triggered'
  | 'proposal_created'
  | 'proposal_approved'
  | 'memory_written'
  | 'provider_fallback'
  | 'peer_review_started'
  | 'peer_review_feedback'
  | 'revision_requested'
  | 'revision_completed'
  | 'peer_review_overridden'
  | 'hallucination_detected'
  | 'contradiction_resolved'
  | 'drift_detected'
  | 'knowledge_gap_detected'
  | 'research_started'
  | 'sources_collected'
  | 'updatecard_created'
  | 'updatecard_review_passed'
  | 'updatecard_review_failed'
  | 'canon_promotion_attempted'
  | 'canon_promoted'
  | 'canon_rollback'
  | 'decision_conflict_detected'
  | 'conductor_resolution'
  | 'deliberation_timeout'
  | 'policy_override'
  | 'budget_exceeded'
  | 'forced_resolution'
  | 'task_graph_created'
  | 'task_assigned'
  | 'task_completed'
  | 'task_failed'
  | 'task_retried';

export interface AutonomyEvent {
  eventType: AutonomyEventType;
  timestamp: string;
  projectId: string | null;
  teamId: string | null;
  conversationId: string | null;
  hatchId: string | null;
  provider: string | null;
  mode: string | null;
  latencyMs: number | null;
  confidence: number | null;
  riskScore: number | null;
  payload?: Record<string, unknown>;
}
