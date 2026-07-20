import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { FeedEvent } from '@/hooks/useAutonomyFeed';
import { isSignalEvent } from '@shared/activityLabels';
import AgentAvatar from '@/components/avatars/AgentAvatar';

function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

// Category accent color
function getCategoryAccent(category: FeedEvent['category']): string {
  switch (category) {
    case 'task':     return '#4ade80';
    case 'handoff':  return '#60a5fa';
    case 'review':   return '#fb923c';
    case 'approval': return '#fbbf24';
    default:         return '#6b7280';
  }
}

// 'system' deliberately has no label. It was rendered as a "SYSTEM" pill on nearly
// every row, and a badge that reads the same everywhere distinguishes nothing — it
// was pure noise in system vocabulary. Only categories that mean something to a
// person get a badge now.
function getCategoryLabel(category: FeedEvent['category']): string | null {
  switch (category) {
    case 'task':     return 'Task';
    case 'handoff':  return 'Handoff';
    case 'review':   return 'Review';
    case 'approval': return 'Approval';
    default:         return null;
  }
}

function clip(text: string, max = 120): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

/**
 * Extra detail worth expanding to see — or null when there is none.
 *
 * This used to fall back to `event.label`, so expanding a row showed the exact text
 * already on the row. Worse, the caller treated `expandableData` as proof of detail,
 * but it defaults to `{}` (truthy), so EVERY row advertised an expand that repeated
 * itself. Returning null lets the caller drop the affordance entirely.
 *
 * taskTitle is intentionally excluded: the label already reads Finished "<title>".
 */
function buildHumanDetail(event: FeedEvent): string | null {
  const d = event.expandableData ?? {};
  const parts: string[] = [];

  if (typeof d.toAgentName === 'string' && d.toAgentName) parts.push(`Passed to ${d.toAgentName}`);
  if (typeof d.reason === 'string' && d.reason.trim()) parts.push(clip(d.reason));
  if (typeof d.summary === 'string' && d.summary.trim()) parts.push(clip(d.summary));
  if (typeof d.output === 'string' && d.output.trim()) parts.push(clip(d.output));
  if (typeof d.hops === 'number') parts.push(`${d.hops} teammates involved`);
  if (typeof d.batchedEvents === 'number') parts.push(`${d.batchedEvents} steps in this run`);

  return parts.length > 0 ? parts.join(' · ') : null;
}

interface ActivityFeedItemProps {
  event: FeedEvent;
}

export function ActivityFeedItem({ event }: ActivityFeedItemProps) {
  const [expanded, setExpanded] = useState(false);
  const accent = getCategoryAccent(event.category);
  const categoryLabel = getCategoryLabel(event.category);
  const detail = buildHumanDetail(event);
  const hasDetail = !!detail && detail !== event.label;
  const time = formatRelativeTime(event.timestamp);

  // Signal vs plumbing. Work starting/finishing/moving, approvals and safety stops are
  // what someone running a project actually scans for; the rest is the system narrating
  // its own bookkeeping and earns a single quiet line instead of a full card.
  if (!isSignalEvent(event.eventType)) {
    return (
      <div className="flex items-baseline gap-2 px-3 py-1.5">
        <span
          className="w-1 h-1 rounded-full shrink-0 translate-y-[-2px]"
          style={{ backgroundColor: 'var(--hatchin-text-muted)', opacity: 0.5 }}
          aria-hidden
        />
        <p className="text-[11px] hatchin-text-muted leading-snug flex-1 min-w-0">
          {event.label}
          {/* nowrap so the separator never strands itself at the end of a line */}
          {event.agentName && (
            <span className="opacity-70 whitespace-nowrap">{` · ${event.agentName}`}</span>
          )}
        </p>
        <span className="text-[10px] hatchin-text-muted opacity-60 shrink-0 whitespace-nowrap">{time}</span>
      </div>
    );
  }

  return (
    <motion.div
      className="premium-card mb-2"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      <button
        className="w-full flex items-start gap-3 px-3 py-3 rounded-xl transition-colors text-left group relative"
        onClick={() => hasDetail && setExpanded(!expanded)}
        aria-expanded={hasDetail ? expanded : undefined}
        // A row with nothing behind it is not a control.
        style={{ cursor: hasDetail ? 'pointer' : 'default' }}
      >
        {/* Same DiceBear avatar the chat uses (seeded by agent name) so the feed matches
            the conversation; AgentAvatar falls back to a colored bubble when agentless. */}
        <div className="shrink-0 mt-0.5">
          <AgentAvatar agentName={event.agentName} size={28} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 min-w-0">
            {event.agentName && (
              <span className="text-[12px] font-semibold hatchin-text truncate">{event.agentName}</span>
            )}
            {categoryLabel && (
              <span
                className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0"
                style={{ color: accent, backgroundColor: `${accent}1e` }}
              >
                {categoryLabel}
              </span>
            )}
            <span className="text-[10px] hatchin-text-muted shrink-0 ml-auto whitespace-nowrap">{time}</span>
          </div>

          {/* What actually happened, in words */}
          <p className="text-[12px] hatchin-text leading-snug">{event.label}</p>
        </div>

        {hasDetail && (
          <span className="text-[10px] hatchin-text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1">
            {expanded ? '▴' : '▾'}
          </span>
        )}
      </button>

      <AnimatePresence>
        {expanded && detail && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div
              className="ml-10 mr-2 mb-2 px-3 py-2 rounded-xl text-[12px] hatchin-text-muted leading-relaxed"
              style={{ background: `${accent}12` }}
            >
              {detail}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
