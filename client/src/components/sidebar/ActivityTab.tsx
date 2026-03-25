import { useAutonomyFeed } from '@/hooks/useAutonomyFeed';
import { AutonomyStatsCard } from './AutonomyStatsCard';
import { FeedFilters } from './FeedFilters';
import { ActivityFeedItem } from './ActivityFeedItem';
import { HandoffChainTimeline } from './HandoffChainTimeline';
import { EmptyState } from '@/components/ui/EmptyState';
import { Activity } from 'lucide-react';

interface ActivityTabProps {
  projectId: string | undefined;
  agents: Array<{ id: string; name: string; role: string }>;
}

export function ActivityTab({ projectId, agents }: ActivityTabProps) {
  const {
    events,
    stats,
    isLoading,
    activeFilter,
    setActiveFilter,
    agentFilter,
    setAgentFilter,
    timeFilter,
    setTimeFilter,
  } = useAutonomyFeed(projectId);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <AutonomyStatsCard stats={stats} isLoading={isLoading} />

      <FeedFilters
        activeFilter={activeFilter}
        onFilterChange={(f) => setActiveFilter(f as typeof activeFilter)}
        agentFilter={agentFilter}
        onAgentFilterChange={setAgentFilter}
        timeFilter={timeFilter}
        onTimeFilterChange={(t) => setTimeFilter(t as typeof timeFilter)}
        agents={agents}
      />

      {/* Feed list — show timeline when handoff filter active, flat list otherwise */}
      {activeFilter === 'handoff' ? (
        <div className="flex-1 overflow-y-auto hide-scrollbar px-3 py-2">
          <HandoffChainTimeline events={events} />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto hide-scrollbar space-y-0.5">
          {isLoading && events.length === 0 ? (
            <>
              <div className="h-14 rounded-lg bg-[var(--hatchin-surface-hover)] animate-shimmer mb-2" />
              <div className="h-14 rounded-lg bg-[var(--hatchin-surface-hover)] animate-shimmer mb-2" />
              <div className="h-14 rounded-lg bg-[var(--hatchin-surface-hover)] animate-shimmer mb-2" />
            </>
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
    </div>
  );
}
