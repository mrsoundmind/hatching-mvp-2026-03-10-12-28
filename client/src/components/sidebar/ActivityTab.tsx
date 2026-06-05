import { useAutonomyFeed } from '@/hooks/useAutonomyFeed';
import { AutonomyStatsCard } from './AutonomyStatsCard';
import { FeedFilters } from './FeedFilters';
import { ActivityFeedItem } from './ActivityFeedItem';
import { HandoffChainTimeline } from './HandoffChainTimeline';
import { ApprovalItem } from './ApprovalItem';
import { isApprovalExpired } from './approvalUtils';
import { EmptyState } from '@/components/ui/EmptyState';
import { Activity, ShieldAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { useSidebarEvent } from '@/hooks/useSidebarEvent';
import { AUTONOMY_EVENTS } from '@/lib/autonomyEvents';
import type { Task } from '@shared/schema';
// Phase 37 (D-10, TREE-03) — view-mode toggle + tree renderer
import { ActivityViewModeToggle } from './ActivityViewModeToggle';
import { RunTreeView } from './RunTreeView';

interface ActivityTabProps {
  projectId: string | undefined;
  agents: Array<{ id: string; name: string; role: string }>;
  executionRules?: Record<string, unknown> | null;
}

export function ActivityTab({ projectId, agents }: ActivityTabProps) {
  const queryClient = useQueryClient();

  // Phase 37 (D-10) — view-mode toggle with per-project localStorage persistence.
  // Default to 'flat' unconditionally; once the user toggles, the cache wins forever
  // (Pitfall 8 — first-paint reads cached value via lazy useState initializer to
  // avoid flicker between Flat and Tree on data arrival). SSR guard via `typeof
  // window` check — Vite/React dev defaults to CSR, the guard is defense-in-depth.
  const [viewMode, setViewMode] = useState<'flat' | 'tree'>(() => {
    if (typeof window === 'undefined' || !projectId) return 'flat';
    const cached = localStorage.getItem(`activityViewMode:${projectId}`);
    return cached === 'tree' || cached === 'flat' ? cached : 'flat';
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !projectId) return;
    localStorage.setItem(`activityViewMode:${projectId}`, viewMode);
  }, [viewMode, projectId]);

  const {
    events,
    stats,
    isLoading,
    activeFilter,
    setActiveFilter,
    agentFilter,
    setAgentFilter,
  } = useAutonomyFeed(projectId);

  // Fetch tasks to surface pending approvals here in Activity
  const { data: tasks } = useQuery<Task[]>({
    queryKey: ['/api/tasks', `?projectId=${projectId}`],
    queryFn: async () => {
      const r = await fetch(`/api/tasks?projectId=${projectId}`);
      if (!r.ok) return []; // see TasksTab — shared queryKey must always cache Task[]
      return r.json();
    },
    enabled: !!projectId,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  // Invalidate on relevant events
  useSidebarEvent(AUTONOMY_EVENTS.APPROVAL_REQUIRED, () => {
    queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
  });
  useSidebarEvent(AUTONOMY_EVENTS.TASK_COMPLETED, () => {
    queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
  });

  const pendingApprovals = useMemo(
    () =>
      (tasks ?? []).filter(t => {
        const meta = t.metadata as Record<string, unknown>;
        return (
          meta?.awaitingApproval === true &&
          !meta?.approvedAt &&
          !meta?.rejectedAt &&
          !isApprovalExpired(t)
        );
      }),
    [tasks]
  );

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="mb-3 px-1 shrink-0">
        <p className="text-[12px] font-medium hatchin-text mb-0.5">Live Activity</p>
        <p className="text-[10px] hatchin-text-muted">Real-time pulse of what your Hatches are working on.</p>
      </div>

      {/* Phase 37 (D-10) — view-mode toggle ABOVE stats card */}
      <ActivityViewModeToggle mode={viewMode} onChange={setViewMode} />

      <AutonomyStatsCard stats={stats} isLoading={isLoading} />

      {/* Pending Approvals — pinned directly above the feed when any exist */}
      {pendingApprovals.length > 0 && (
        <div className="px-1 py-2 border-b border-[var(--hatchin-border-subtle)]">
          <div className="flex items-center gap-1.5 mb-2 px-1">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <p className="text-xs font-semibold text-amber-400">
              Needs your approval ({pendingApprovals.length})
            </p>
          </div>
          <div role="list" className="space-y-1">
            <AnimatePresence mode="popLayout">
              {pendingApprovals.map(task => (
                <ApprovalItem key={task.id} task={task} />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {viewMode === 'tree' ? (
        /* Phase 37 (TREE-03) — recursive run tree renderer.
           Filters (handoff/task/etc) don't apply to the tree view — the tree is
           a structural visualization, not a filtered feed. */
        <RunTreeView projectId={projectId} />
      ) : (
        <>
          <FeedFilters
            activeFilter={activeFilter}
            onFilterChange={(f) => setActiveFilter(f as typeof activeFilter)}
            agentFilter={agentFilter}
            onAgentFilterChange={setAgentFilter}
            agents={agents}
          />

          {/* Feed list — show handoff timeline or flat list */}
          {activeFilter === 'handoff' ? (
            <div className="flex-1 overflow-y-auto hide-scrollbar px-3 py-2">
              <HandoffChainTimeline events={events} />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto hide-scrollbar space-y-0.5">
              {isLoading && events.length === 0 ? (
                <div className="space-y-2 px-3 py-2">
                  {/* Stats card skeleton */}
                  <div className="rounded-xl h-20 skeleton-shimmer" />
                  {/* Feed item skeletons */}
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-start gap-2 p-3 rounded-xl skeleton-shimmer" style={{ animationDelay: `${i * 0.15}s` }}>
                      <div className="w-6 h-6 rounded-full bg-[var(--hatchin-surface-elevated)] shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 w-3/4 rounded bg-[var(--hatchin-surface-elevated)]" />
                        <div className="h-2.5 w-1/2 rounded bg-[var(--hatchin-surface-elevated)]" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : events.length === 0 ? (
                <EmptyState
                  icon={Activity}
                  title="Your team is ready"
                  description="When your Hatches start working autonomously, you'll see their progress here. Try asking one to work on something in the background."
                />
              ) : (
                events.map((event) => (
                  <ActivityFeedItem key={event.id} event={event} />
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
