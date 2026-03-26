import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { ApprovalItem } from './ApprovalItem';
import { ApprovalsEmptyState } from './ApprovalsEmptyState';
import { TaskPipelineView } from './TaskPipelineView';
import { isApprovalExpired } from './approvalUtils';
import { useSidebarEvent } from '@/hooks/useSidebarEvent';
import { AUTONOMY_EVENTS } from '@/lib/autonomyEvents';
import type { Task } from '@shared/schema';

interface ApprovalsTabProps {
  projectId: string | undefined;
}

/**
 * Container for the full Approvals tab content.
 *
 * Fetches all project tasks, derives pending approvals (tasks with
 * metadata.awaitingApproval === true), sorts them active-first / expired-last,
 * and renders an ApprovalItem per task. Shows TaskPipelineView below the list
 * when tasks exist. Shows ApprovalsEmptyState when no pending approvals remain.
 *
 * Real-time: invalidates task cache on APPROVAL_REQUIRED + TASK_COMPLETED
 * CustomEvents dispatched by CenterPanel, in addition to 30s polling.
 */
export function ApprovalsTab({ projectId }: ApprovalsTabProps) {
  const queryClient = useQueryClient();

  // Fetch all project tasks — same queryKey as RightSidebar for TanStack deduplication
  const { data: tasks, isLoading } = useQuery<Task[]>({
    // MUST match RightSidebar.tsx queryKey exactly — TanStack deduplication is key-format-sensitive
    queryKey: ['/api/tasks', `?projectId=${projectId}`],
    queryFn: () =>
      fetch(`/api/tasks?projectId=${projectId}`).then(r => r.json()),
    enabled: !!projectId,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  // Invalidate task cache immediately when a new approval arrives via WS
  useSidebarEvent(AUTONOMY_EVENTS.APPROVAL_REQUIRED, () => {
    queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
  });

  // Also invalidate when a task completes (removes it from pending list)
  useSidebarEvent(AUTONOMY_EVENTS.TASK_COMPLETED, () => {
    queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
  });

  // Derive pending approvals: tasks awaiting sign-off that haven't been actioned
  const pendingApprovals = useMemo(
    () =>
      (tasks ?? []).filter(t => {
        const meta = t.metadata as Record<string, unknown>;
        return (
          meta?.awaitingApproval === true &&
          !meta?.approvedAt &&
          !meta?.rejectedAt
        );
      }),
    [tasks]
  );

  // Sort: active approvals first, expired last
  const activeApprovals = pendingApprovals.filter(t => !isApprovalExpired(t));
  const expiredApprovals = pendingApprovals.filter(t => isApprovalExpired(t));
  const sortedApprovals = [...activeApprovals, ...expiredApprovals];

  // Empty state when loaded and nothing pending
  if (!isLoading && sortedApprovals.length === 0) {
    return <ApprovalsEmptyState />;
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Approval list with AnimatePresence for exit animations */}
      <div
        role="list"
        className="flex-1 overflow-y-auto hide-scrollbar space-y-1 px-2 py-2"
      >
        <AnimatePresence mode="popLayout">
          {sortedApprovals.map(task => (
            <ApprovalItem key={task.id} task={task} />
          ))}
        </AnimatePresence>
      </div>

      {/* Task pipeline — only shown when there are tasks to display */}
      {tasks && tasks.length > 0 && <TaskPipelineView tasks={tasks} />}
    </div>
  );
}
