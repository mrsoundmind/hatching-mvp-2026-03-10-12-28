import { motion } from 'framer-motion';
import type { FeedStats, TimeFilter } from '@/hooks/useAutonomyFeed';

interface AutonomyStatsCardProps {
  stats: FeedStats | undefined;
  isLoading: boolean;
  timeFilter: TimeFilter;
}

// The counters are scoped to the selected window, so the label has to say which
// one — "0 tasks done" next to a busy feed reads as broken, "0 tasks done today"
// reads as true (feedback_ui_self_documenting).
const RANGE_SUFFIX: Record<TimeFilter, string> = {
  today: 'today',
  '7days': 'this week',
  all: 'all time',
};

export function AutonomyStatsCard({ stats, isLoading, timeFilter }: AutonomyStatsCardProps) {
  const suffix = RANGE_SUFFIX[timeFilter];
  const tasks = stats?.tasksCompleted ?? 0;
  const handoffs = stats?.handoffs ?? 0;
  const values = [
    // Singular/plural so it never reads "1 tasks done".
    { value: tasks, label: `${tasks === 1 ? 'task' : 'tasks'} done ${suffix}`, color: 'var(--hatchin-green)' },
    { value: handoffs, label: `${handoffs === 1 ? 'handoff' : 'handoffs'} ${suffix}`, color: 'var(--hatchin-blue)' },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-2 mb-4">
        {[0, 1].map(i => (
          <div key={i} className="premium-card p-3 flex flex-col gap-1">
            <div className="h-5 w-8 rounded skeleton-shimmer" />
            <div className="h-3 w-12 rounded skeleton-shimmer" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 mb-4">
      {values.map((stat, i) => (
        <motion.div
          key={stat.label}
          className="premium-card p-3 flex flex-col gap-1 cursor-default"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: i * 0.06, ease: 'easeOut' }}
          whileHover={{ y: -1 }}
        >
          <motion.span
            className="text-xl font-bold leading-none"
            style={{ color: stat.color }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: i * 0.08 + 0.1 }}
          >
            {stat.value}
          </motion.span>
          <span className="text-[10px] hatchin-text-muted leading-none mt-1">{stat.label}</span>
        </motion.div>
      ))}
    </div>
  );
}
