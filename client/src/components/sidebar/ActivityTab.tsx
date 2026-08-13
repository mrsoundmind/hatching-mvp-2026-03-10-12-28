import { useAutonomyFeed } from '@/hooks/useAutonomyFeed';
import { useAgentWorkingState } from '@/hooks/useAgentWorkingState';
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
import { ActivityTimeRangeToggle } from './ActivityTimeRangeToggle';
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
    isLoading,
    activeFilter,
    setActiveFilter,
    agentFilter,
    setAgentFilter,
    timeFilter,
    setTimeFilter,
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

  // Status strip — honest "what is happening now" from real signals only.
  const workingAgentIds = useAgentWorkingState();
  const workingNames = useMemo(
    () => agents.filter(a => workingAgentIds.has(a.id)).map(a => a.name),
    [agents, workingAgentIds]
  );
  // The task a working Hatch is on: newest feed event by a working agent that carries a title.
  const currentTask = useMemo(() => {
    if (workingAgentIds.size === 0) return null;
    const ev = events.find(
      e => e.agentId && workingAgentIds.has(e.agentId) && typeof e.expandableData?.taskTitle === 'string'
    );
    return (ev?.expandableData?.taskTitle as string) || null;
  }, [events, workingAgentIds]);

  const scrollToApprovals = () => {
    document.getElementById('activity-pending-approvals')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="mb-2.5 px-1 shrink-0">
        <p className="text-xs font-medium hatchin-text mb-0.5">Live Activity</p>
        <p className="text-xs hatchin-text-muted">Real-time pulse of what your Hatches are working on.</p>
      </div>

      {/* Change 1 — glanceable "what's happening now / what needs you" strip.
          Only honest signals: who is working (useAgentWorkingState), what they're on
          (latest matching event), and how many need you (pendingApprovals). */}
      <ActivityStatusStrip
        workingNames={workingNames}
        currentTask={currentTask}
        pendingCount={pendingApprovals.length}
        onWaitingClick={scrollToApprovals}
      />

      {/* One control row. This was three stacked rows (view toggle, time segments, and
          a pair of counter cards) before the feed even began. The counters showed two
          big numbers with small labels — the template answer — and read 0 most of the
          time, taking the most valuable space in the panel to say less than the first
          feed row does. Removed, so the newest real event is what you see first. */}
      <div className="flex items-center justify-between gap-2 mb-2 mx-1 flex-wrap">
        <ActivityViewModeToggle mode={viewMode} onChange={setViewMode} />
        <ActivityTimeRangeToggle value={timeFilter} onChange={setTimeFilter} />
      </div>

      {/* Pending Approvals — pinned directly above the feed when any exist */}
      {pendingApprovals.length > 0 && (
        <div id="activity-pending-approvals" className="px-1 py-2 border-b border-[var(--hatchin-border-subtle)]">
          {/* Neutral heading — the old amber tint was part of the "yellow" the cards dropped;
              the per-card red/blue accent now carries the stakes, so the header stays quiet. */}
          <div className="flex items-center gap-1.5 mb-2 px-1">
            <ShieldAlert className="w-3.5 h-3.5 text-[var(--hatchin-text-muted)]" />
            <p className="text-xs font-semibold text-[var(--hatchin-text-bright)]">
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

/**
 * ActivityStatusStrip — the one-glance answer to "what is happening, and does it need me?"
 * Three honest states: a Hatch is working, something is waiting on you, or all caught up.
 * No vanity counters — every state is either current activity or an action for the user.
 */
function ActivityStatusStrip({
  workingNames,
  currentTask,
  pendingCount,
  onWaitingClick,
}: {
  workingNames: string[];
  currentTask: string | null;
  pendingCount: number;
  onWaitingClick: () => void;
}) {
  const isWorking = workingNames.length > 0;
  const workingSurface = {
    background: 'linear-gradient(180deg, var(--hatchin-working-tint), var(--hatchin-working-tint-2))',
    border: '1px solid var(--hatchin-working-line)',
  } as const;

  // Active: a Hatch is working now. Text gets the full width; the "waiting on you"
  // action drops to its own row so a heading never truncates mid-word in the narrow sidebar.
  if (isWorking) {
    const heading =
      workingNames.length === 1 ? `${workingNames[0]} is working now` : `${workingNames.length} Hatches are working now`;
    const sub = currentTask ? `on ${currentTask}` : 'on a background task';
    return (
      <div data-testid="activity-status-strip" className="mx-1 mb-2 rounded-lg px-3 py-2.5" style={workingSurface}>
        <div className="flex items-start gap-2.5">
          <span className="w-2 h-2 mt-[3px] rounded-full flex-none animate-pulse" style={{ background: 'var(--hatchin-working-coral)' }} />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold leading-snug" style={{ color: 'var(--hatchin-text-bright)' }}>
              {heading}
            </div>
            <div className="text-micro leading-snug mt-0.5 line-clamp-2" style={{ color: 'var(--hatchin-text-muted)' }}>
              {sub}
            </div>
          </div>
        </div>
        {pendingCount > 0 && (
          <button
            onClick={onWaitingClick}
            className="mt-2 w-full inline-flex items-center justify-center gap-1 h-7 rounded-md text-micro font-bold transition-opacity hover:opacity-90"
            style={{ background: 'var(--hatchin-working-coral)', color: '#231702' }}
          >
            {pendingCount} waiting on you →
          </button>
        )}
      </div>
    );
  }

  // Waiting: nobody working, but something needs the user. The whole strip is the action;
  // the heading carries the count, so only a compact chevron sits beside it (no crowding pill).
  if (pendingCount > 0) {
    return (
      <button
        type="button"
        onClick={onWaitingClick}
        data-testid="activity-status-strip"
        className="mx-1 mb-2 w-[calc(100%-0.5rem)] rounded-lg px-3 py-2.5 flex items-start gap-2.5 text-left transition-opacity hover:opacity-95"
        style={workingSurface}
      >
        <span className="w-2 h-2 mt-[3px] rounded-full flex-none" style={{ background: 'var(--hatchin-working-coral)' }} />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold leading-snug" style={{ color: 'var(--hatchin-text-bright)' }}>
            {pendingCount === 1 ? 'One decision is waiting on you' : `${pendingCount} decisions are waiting on you`}
          </div>
          <div className="text-micro leading-snug mt-0.5" style={{ color: 'var(--hatchin-text-muted)' }}>
            Review to let your team keep moving
          </div>
        </div>
        <span className="flex-none text-[15px] leading-none mt-0.5" style={{ color: 'var(--hatchin-working-coral)' }} aria-hidden="true">→</span>
      </button>
    );
  }

  // Calm: nothing working, nothing pending.
  return (
    <div
      data-testid="activity-status-strip"
      className="mx-1 mb-2 rounded-lg px-3 py-2 flex items-center gap-2.5"
      style={{ background: 'var(--hatchin-surface)', border: '1px solid var(--hatchin-border-subtle)' }}
    >
      <span className="w-2 h-2 rounded-full flex-none" style={{ background: 'var(--hatchin-green)' }} />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold leading-tight truncate" style={{ color: 'var(--hatchin-text-bright)' }}>
          All caught up
        </div>
        <div className="text-micro truncate leading-tight mt-0.5" style={{ color: 'var(--hatchin-text-muted)' }}>
          Nothing needs you right now
        </div>
      </div>
      <span
        className="flex-none inline-flex items-center h-6 px-2.5 rounded-full text-micro font-semibold"
        style={{ border: '1px solid var(--hatchin-border-subtle)', color: 'var(--hatchin-text-muted)' }}
      >
        Idle
      </span>
    </div>
  );
}
