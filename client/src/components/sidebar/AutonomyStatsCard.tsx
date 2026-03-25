import { CheckCircle, ArrowRightLeft, DollarSign } from 'lucide-react';
import type { FeedStats } from '@/hooks/useAutonomyFeed';

interface AutonomyStatsCardProps {
  stats: FeedStats | undefined;
  isLoading: boolean;
}

export function AutonomyStatsCard({ stats, isLoading }: AutonomyStatsCardProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-[var(--hatchin-border-subtle)] bg-[var(--hatchin-surface)] p-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="h-4 w-16 rounded bg-[var(--hatchin-surface-hover)] animate-shimmer" />
          <div className="h-4 w-16 rounded bg-[var(--hatchin-surface-hover)] animate-shimmer" />
          <div className="h-4 w-16 rounded bg-[var(--hatchin-surface-hover)] animate-shimmer" />
        </div>
      </div>
    );
  }

  const tasksCompleted = stats?.tasksCompleted ?? 0;
  const handoffs = stats?.handoffs ?? 0;
  const costToday = stats?.costToday ?? '$0.00';

  return (
    <div className="rounded-xl border border-[var(--hatchin-border-subtle)] bg-[var(--hatchin-surface)] p-3 mb-3">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs">
          <CheckCircle className="w-3.5 h-3.5 text-[var(--hatchin-green)]" />
          <span className="font-semibold hatchin-text">{tasksCompleted}</span>
          <span className="hatchin-text-muted">tasks</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <ArrowRightLeft className="w-3.5 h-3.5 text-[var(--hatchin-blue)]" />
          <span className="font-semibold hatchin-text">{handoffs}</span>
          <span className="hatchin-text-muted">handoffs</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <DollarSign className="w-3.5 h-3.5 hatchin-text-muted" />
          <span className="font-semibold hatchin-text">{costToday}</span>
          <span className="hatchin-text-muted">spent</span>
        </div>
      </div>
    </div>
  );
}
