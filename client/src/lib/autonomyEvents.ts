/**
 * Typed CustomEvent registry for autonomy sidebar events.
 *
 * Every autonomy CustomEvent name lives here as a constant.
 * Dispatchers (CenterPanel) and listeners (sidebar hooks) both import from this file.
 * Never use string literals for autonomy event names elsewhere.
 */

export const AUTONOMY_EVENTS = {
  TASK_EXECUTING: 'autonomy:task_executing',
  TASK_COMPLETED: 'autonomy:task_completed',
  HANDOFF_ANNOUNCED: 'autonomy:handoff_announced',
  HANDOFF_CHAIN_COMPLETED: 'autonomy:handoff_chain_completed',
  APPROVAL_REQUIRED: 'autonomy:approval_required',
  PEER_REVIEW_RESULT: 'autonomy:peer_review_result',
  AGENT_WORKING_STATE: 'autonomy:agent_working_state',
  EXECUTION_STARTED: 'autonomy:execution_started',
} as const;

export type AutonomyEventName = typeof AUTONOMY_EVENTS[keyof typeof AUTONOMY_EVENTS];

// --- Payload interfaces ---

export interface TaskExecutingPayload {
  agentId: string;
  agentName: string;
  taskTitle: string;
  traceId: string;
  projectId: string;
}

export interface TaskCompletedPayload {
  agentId: string;
  agentName: string;
  taskTitle: string;
  traceId: string;
  projectId: string;
  riskScore?: number;
  peerReviewOutcome?: string;
}

export interface HandoffAnnouncedPayload {
  fromAgentId: string;
  fromAgentName: string;
  toAgentId: string;
  toAgentName: string;
  taskTitle: string;
  traceId: string;
  projectId: string;
}

export interface HandoffChainCompletedPayload {
  traceId: string;
  projectId: string;
  reason: string;
  hops: number;
}

export interface ApprovalRequiredPayload {
  traceId: string;
  agentId: string;
  agentName: string;
  taskTitle: string;
  riskScore: number;
  projectId: string;
}

export interface PeerReviewResultPayload {
  traceId: string;
  agentId: string;
  agentName: string;
  reviewerAgentId: string;
  reviewerAgentName: string;
  outcome: 'approved' | 'revision_requested' | 'overridden';
  projectId: string;
}

export interface AgentWorkingStatePayload {
  agentId: string;
  isWorking: boolean;
  projectId: string;
}

export interface ExecutionStartedPayload {
  traceId: string;
  agentId: string;
  agentName: string;
  taskTitle: string;
  projectId: string;
}

// --- Typed dispatcher ---

export function dispatchAutonomyEvent<T>(name: AutonomyEventName, detail: T): void {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}
