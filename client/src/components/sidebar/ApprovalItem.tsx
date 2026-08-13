import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { isApprovalExpired, APPROVAL_EXPIRY_MS } from './approvalUtils';
import { relativeTime } from '@/lib/relativeTime';
import { ApprovalCard } from '@/components/approval/ApprovalCard';
import type { Task } from '@shared/schema';

interface ApprovalItemProps {
  task: Task;
}

export function ApprovalItem({ task }: ApprovalItemProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Cast to Record<string, unknown> — metadata at runtime contains fields
  // (awaitingApproval, riskScore, riskReasons, draftOutput, approvedAt, rejectedAt) that
  // are not in the typed schema (they are written by taskExecutionPipeline.ts).
  const meta = task.metadata as Record<string, unknown>;

  // Bug 6: Auto-refresh when approval expires so the UI updates to show "Expired"
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!meta?.awaitingApproval || meta.approvedAt || meta.rejectedAt) return;
    const updatedAtMs = new Date(task.updatedAt).getTime();
    const expiresAt = updatedAtMs + APPROVAL_EXPIRY_MS;
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) return; // already expired
    const timer = setTimeout(() => setTick(t => t + 1), remaining + 100);
    return () => clearTimeout(timer);
  }, [task.updatedAt, meta?.awaitingApproval, meta?.approvedAt, meta?.rejectedAt]);

  const isExpired = isApprovalExpired(task);

  const approveMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/tasks/${task.id}/approve`, { method: 'POST' }).then(r => {
        if (!r.ok) throw new Error('Failed to approve');
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
    },
    onError: () => {
      toast({ description: "Couldn't process your decision. Try again.", variant: 'destructive' });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/tasks/${task.id}/reject`, { method: 'POST' }).then(r => {
        if (!r.ok) throw new Error('Failed to reject');
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
    },
    onError: () => {
      toast({ description: "Couldn't process your decision. Try again.", variant: 'destructive' });
    },
  });

  const isLoading = approveMutation.isPending || rejectMutation.isPending;

  const riskReasons = Array.isArray(meta?.riskReasons) ? (meta.riskReasons as string[]) : [];
  const draft = typeof meta?.draftOutput === 'string' ? (meta.draftOutput as string) : '';
  const draftPreview = draft ? (draft.length > 600 ? `${draft.slice(0, 600).trimEnd()}…` : draft) : null;

  return (
    <ApprovalCard
      variant="sidebar"
      agentName={task.assignee ?? ''}
      taskTitle={task.title}
      taskDescription={task.description}
      riskReasons={riskReasons}
      draftPreview={draftPreview}
      raisedAtLabel={relativeTime(task.updatedAt)}
      isExpired={isExpired}
      isLoading={isLoading}
      onApprove={() => approveMutation.mutate()}
      onReject={() => rejectMutation.mutate()}
    />
  );
}
