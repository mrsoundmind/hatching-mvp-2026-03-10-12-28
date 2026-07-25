/**
 * HandoffChainTimeline — groups handoff events by traceId and renders them
 * as a vertical timeline with animated connectors in the Activity tab sidebar.
 *
 * Used in ActivityTab when activeFilter === 'handoff'.
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import AgentAvatar from '@/components/avatars/AgentAvatar';
import type { FeedEvent } from '@/hooks/useAutonomyFeed';
import { groupHandoffsByTraceId } from './handoffChainUtils';

// Re-export so callers (and tests) can import from this file
export { groupHandoffsByTraceId } from './handoffChainUtils';

// --- Helpers ---

function formatRelativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

// --- Component ---

interface HandoffChainTimelineProps {
  events: FeedEvent[];
}

export function HandoffChainTimeline({ events }: HandoffChainTimelineProps) {
  const groups = useMemo(() => groupHandoffsByTraceId(events), [events]);

  if (groups.size === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <p className="text-sm font-medium hatchin-text">No handoffs yet</p>
        <p className="text-xs hatchin-text-muted mt-1">
          Handoff chains will appear here when your Hatches coordinate work.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {Array.from(groups.entries()).map(([traceId, chain]) => (
        <HandoffChain key={traceId} chain={chain} />
      ))}
    </div>
  );
}

interface HandoffChainProps {
  chain: FeedEvent[];
}

function HandoffChain({ chain }: HandoffChainProps) {
  return (
    <div className="mb-4 last:mb-0">
      {chain.map((event, index) => (
        <div key={event.id}>
          {/* Node row — staggered entry */}
          <motion.div
            className="premium-card p-2 flex items-center gap-2"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.06, duration: 0.18, ease: 'easeOut' }}
          >
            <AgentAvatar
              agentName={event.agentName}
              role={undefined}
              size={24}
              className="shrink-0"
            />
            <span className="text-xs font-medium hatchin-text truncate">
              {event.agentName ?? 'Agent'}
            </span>
            <span className="text-xs hatchin-text-muted truncate flex-1 min-w-0">
              {event.label}
            </span>
            <span className="text-xs hatchin-text-muted shrink-0">
              {formatRelativeTime(event.timestamp)}
            </span>
          </motion.div>

          {/* Gradient connector between nodes */}
          {index < chain.length - 1 && (
            <motion.div
              className="ml-3 w-0.5 bg-gradient-to-b from-[var(--hatchin-blue)] to-[var(--hatchin-blue)]/30 origin-top"
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.3, delay: index * 0.06 }}
              style={{ height: 24 }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
