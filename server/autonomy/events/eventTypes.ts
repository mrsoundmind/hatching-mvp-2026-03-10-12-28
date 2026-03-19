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
  | 'task_retried'
  // Living skills events
  | 'skill_gap_detected'
  | 'skill_update_created'
  | 'skill_performance_scored'
  | 'skill_promoted_to_canon'
  // Background autonomy events
  | 'background_health_check'
  | 'friction_detected'
  | 'proactive_outreach_queued'
  | 'proactive_outreach_sent'
  | 'world_update_detected';

export interface AutonomyEvent {
  eventType: AutonomyEventType;
  timestamp: string;
  traceId: string;
  turnId: string;
  requestId: string;
  userId: string | null;
  projectId: string | null;
  teamId: string | null;
  conversationId: string | null;
  hatchId: string | null;
  provider: string | null;
  mode: string | null;
  latencyMs: number | null;
  confidence: number | null;
  riskScore: number | null;
  payload?: Record<string, unknown> & {
    requestClass?: "single" | "deliberation" | "safety" | "task";
  };
}
