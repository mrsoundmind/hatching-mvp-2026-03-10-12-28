import { ApprovalCard } from './approval/ApprovalCard';

/**
 * Chat-surface adapter over the shared <ApprovalCard>. Keeps the taskId-passing callback signature
 * the chat message list already uses, and maps to the shared card (identical to the sidebar version).
 */
export interface AutonomousApprovalCardProps {
  taskId: string;
  agentName: string;
  taskTitle?: string;
  taskDescription?: string | null;
  riskReasons: string[];
  draftPreview?: string | null;
  raisedAtLabel?: string;
  onApprove: (taskId: string) => void;
  onReject: (taskId: string) => void;
  isLoading: boolean;
}

export function AutonomousApprovalCard({
  taskId,
  agentName,
  taskTitle,
  taskDescription,
  riskReasons,
  draftPreview,
  raisedAtLabel,
  onApprove,
  onReject,
  isLoading,
}: AutonomousApprovalCardProps) {
  return (
    <ApprovalCard
      variant="chat"
      agentName={agentName}
      taskTitle={taskTitle}
      taskDescription={taskDescription}
      riskReasons={riskReasons}
      draftPreview={draftPreview}
      raisedAtLabel={raisedAtLabel}
      isLoading={isLoading}
      onApprove={() => onApprove(taskId)}
      onReject={() => onReject(taskId)}
    />
  );
}
