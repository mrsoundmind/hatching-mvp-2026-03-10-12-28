import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { isApprovalExpired, APPROVAL_EXPIRY_MS } from './approvalUtils';
import { humanizeRiskReasons } from '@shared/riskReasons';
import { resolveAgentName } from '@/lib/agentDisplay';
import type { Task } from '@shared/schema';

interface ApprovalItemProps {
  task: Task;
}

export function ApprovalItem({ task }: ApprovalItemProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Cast to Record<string, unknown> — metadata at runtime contains fields
  // (awaitingApproval, riskScore, riskReasons, approvedAt, rejectedAt) that
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
      toast({
        description: "Couldn't process your decision. Try again.",
        variant: 'destructive',
      });
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
      toast({
        description: "Couldn't process your decision. Try again.",
        variant: 'destructive',
      });
    },
  });

  const isLoading = approveMutation.isPending || rejectMutation.isPending;
  const agentName = resolveAgentName(task.assignee, 'Your team');
  const riskScore = meta?.riskScore as number | undefined;
  const borderColor =
    riskScore && riskScore >= 0.6
      ? 'border-l-[var(--hatchin-orange)]'
      : 'border-l-amber-400';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      whileHover={{ y: -1 }}
      transition={{ duration: isExpired ? 0 : 0.18, ease: 'easeOut' }}
      className={`premium-card p-3 border-l-[3px] ${borderColor}`}
    >
      {/* Agent avatar — 32px circle with initial letter */}
      <div className="flex items-start gap-2">
        <div className="w-8 h-8 rounded-full bg-[var(--hatchin-surface-elevated)] flex items-center justify-center text-xs font-semibold shrink-0">
          {agentName.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          {/* Agent name */}
          <p className="text-sm font-semibold text-[var(--hatchin-text-bright)]">
            {agentName}
          </p>

          {/* Task title */}
          <p className="text-xs text-[var(--hatchin-text)] mt-1 truncate">{task.title}</p>

          {/* Risk reasons, humanized. Raw safety codes are telemetry (#43); the humanizer maps them
              and drops anything unrecognized so no code leaks here even for historical rows. */}
          {humanizeRiskReasons(meta?.riskReasons).length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              {humanizeRiskReasons(meta?.riskReasons).join(' · ')}
            </p>
          )}

          {/* Expired badge OR approve/reject buttons */}
          <div className="flex gap-2 mt-2">
            {isExpired ? (
              <span
                className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-full bg-red-500/10 text-red-400"
                aria-label="Approval expired"
              >
                Expired
              </span>
            ) : (
              <>
                <motion.button
                  type="button"
                  disabled={isLoading}
                  onClick={() => approveMutation.mutate()}
                  aria-label={`Approve task: ${task.title}`}
                  whileHover={{ scale: 1.02 }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] text-xs font-medium rounded-lg whitespace-nowrap bg-[var(--hatchin-blue)] text-white hover:bg-[var(--hatchin-blue)]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                  Approve
                </motion.button>

                <motion.button
                  type="button"
                  disabled={isLoading}
                  onClick={() => rejectMutation.mutate()}
                  aria-label={`Reject task: ${task.title}`}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] text-xs font-medium rounded-lg whitespace-nowrap border border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <XCircle className="w-3.5 h-3.5 shrink-0" />
                  Reject
                </motion.button>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
