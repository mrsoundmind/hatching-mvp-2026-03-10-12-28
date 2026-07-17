import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { FeedEvent } from '@/hooks/useAutonomyFeed';
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

// Deterministic color from agent name — no icons
const AVATAR_PALETTES = [
  { bg: '#1d4ed8', text: '#bfdbfe' }, // blue
  { bg: '#0f766e', text: '#99f6e4' }, // teal
  { bg: '#7c3aed', text: '#ddd6fe' }, // violet
  { bg: '#b45309', text: '#fde68a' }, // amber
  { bg: '#be185d', text: '#fbcfe8' }, // pink
  { bg: '#1e40af', text: '#bfdbfe' }, // indigo
  { bg: '#065f46', text: '#a7f3d0' }, // green
];

function avatarPalette(name: string | null) {
  if (!name) return { bg: '#374151', text: '#9ca3af' };
  const index = name.charCodeAt(0) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[index];
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

function getCategoryLabel(category: FeedEvent['category']): string {
  switch (category) {
    case 'task':     return 'Task';
    case 'handoff':  return 'Handoff';
    case 'review':   return 'Review';
    case 'approval': return 'Approval';
    default:         return 'System';
  }
}

// Convert expanded technical data into a single plain-English sentence
function buildHumanSummary(event: FeedEvent): string {
  const d = event.expandableData ?? {};
  const parts: string[] = [];

  if (typeof d.taskTitle === 'string' && d.taskTitle) {
    parts.push(`Working on: "${d.taskTitle}"`);
  }
  if (typeof d.toAgentName === 'string') {
    parts.push(`Passed to ${d.toAgentName}`);
  }
  if (typeof d.reason === 'string' && d.reason) {
    parts.push(d.reason);
  }
  if (typeof d.output === 'string' && d.output) {
    // Show first 120 chars of output
    parts.push(d.output.slice(0, 120) + (d.output.length > 120 ? '…' : ''));
  }
  if (typeof d.summary === 'string' && d.summary) {
    parts.push(d.summary.slice(0, 120) + (d.summary.length > 120 ? '…' : ''));
  }
  if (typeof d.hops === 'number') {
    parts.push(`${d.hops} agents were involved`);
  }

  // Fallback — don't show raw JSON
  if (parts.length === 0) {
    return event.label;
  }
  return parts.join(' · ');
}

interface ActivityFeedItemProps {
  event: FeedEvent;
}

export function ActivityFeedItem({ event }: ActivityFeedItemProps) {
  const [expanded, setExpanded] = useState(false);
  const accent = getCategoryAccent(event.category);
  const palette = avatarPalette(event.agentName);
  const isAgentEvent = event.eventType.startsWith('agent_') || event.eventType.startsWith('hatch_') || !!event.agentId;
  const displayName = event.agentName || (isAgentEvent ? 'Hatch' : 'System');
  const humanSummary = buildHumanSummary(event);
  const hasDetail = humanSummary !== event.label || !!event.expandableData;

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
        aria-expanded={expanded}
      >
        {/* Agent avatar — same DiceBear avatar the chat uses (seeded by agent name) so the feed
            matches the conversation; AgentAvatar falls back to a colored bubble for agentless events. */}
        <div className="shrink-0 mt-0.5">
          <AgentAvatar agentName={event.agentName} size={28} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Agent name */}
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[12px] font-semibold" style={{ color: palette.text }}>
              {displayName}
            </span>
            <span
              className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{ color: accent, backgroundColor: `${accent}1e` }}
            >
              {getCategoryLabel(event.category)}
            </span>
          </div>

          {/* Action label — plain English */}
          <p className="text-[12px] hatchin-text leading-snug">{event.label}</p>
          <p className="text-[10px] hatchin-text-muted mt-0.5">{formatRelativeTime(event.timestamp)}</p>
        </div>

        {/* Expand chevron hint */}
        {hasDetail && (
          <span className="text-[10px] hatchin-text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1">
            {expanded ? '▴' : '▾'}
          </span>
        )}
      </button>

      {/* Expanded human-readable detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="ml-10 mr-2 mb-2 px-3 py-2 rounded-xl text-[12px] hatchin-text-muted leading-relaxed"
              style={{ background: `${accent}12` }}
            >
              {humanSummary}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
