import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { FeedEvent } from '@/hooks/useAutonomyFeed';

function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function getCategoryColor(category: FeedEvent['category']): string {
  switch (category) {
    case 'task':
      return 'bg-[var(--hatchin-green)]';
    case 'handoff':
      return 'bg-[var(--hatchin-blue)]';
    case 'review':
      return 'bg-[var(--hatchin-orange)]';
    case 'approval':
      return 'bg-amber-400';
    case 'system':
    default:
      return 'bg-gray-400';
  }
}

interface ActivityFeedItemProps {
  event: FeedEvent;
}

export function ActivityFeedItem({ event }: ActivityFeedItemProps) {
  const [expanded, setExpanded] = useState(false);
  const hasExpandableData = event.expandableData && Object.keys(event.expandableData).length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      <div
        className="flex items-start gap-2.5 py-2.5 px-3 rounded-lg hover:bg-[var(--hatchin-surface-hover)] transition-colors cursor-pointer group"
        onClick={() => hasExpandableData && setExpanded(!expanded)}
      >
        {/* Color-coded left border */}
        <div className={`w-[3px] self-stretch rounded-full shrink-0 ${getCategoryColor(event.category)}`} />

        {/* Agent avatar area */}
        <div className="w-8 h-8 rounded-full bg-[var(--hatchin-surface)] flex items-center justify-center text-xs font-semibold hatchin-text shrink-0">
          {event.agentName ? event.agentName.charAt(0).toUpperCase() : '?'}
        </div>

        {/* Content area */}
        <div className="flex-1 min-w-0">
          <p className="text-xs hatchin-text leading-snug truncate">{event.label}</p>
          <p className="text-[10px] hatchin-text-muted mt-0.5">{formatRelativeTime(event.timestamp)}</p>
        </div>

        {/* Expandable chevron */}
        {hasExpandableData && (
          <span className="shrink-0 group-hover:opacity-100 opacity-0 transition-opacity">
            {expanded ? (
              <ChevronDown className="w-3.5 h-3.5 hatchin-text-muted" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 hatchin-text-muted" />
            )}
          </span>
        )}
      </div>

      {/* Expanded detail */}
      {expanded && hasExpandableData && (
        <div className="mt-1 ml-[42px] mr-3 text-[11px] hatchin-text-muted bg-[var(--hatchin-surface)] rounded-lg p-2.5 space-y-1">
          {Object.entries(event.expandableData!).map(([key, value]) => (
            <div key={key} className="flex gap-2">
              <span className="font-medium shrink-0">{key}:</span>
              <span className="truncate">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
