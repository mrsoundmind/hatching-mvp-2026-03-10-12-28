import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import AgentAvatar from '@/components/avatars/AgentAvatar';

interface HandoffCardProps {
  fromAgentName: string;
  fromAgentRole?: string;
  toAgentName: string;
  toAgentRole?: string;
  taskTitle: string;
  timestamp: string;
}

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

export function HandoffCard({
  fromAgentName,
  fromAgentRole,
  toAgentName,
  toAgentRole,
  taskTitle,
  timestamp,
}: HandoffCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      <div className="mx-4 my-1.5 p-3 rounded-xl border border-[var(--hatchin-blue)]/20 bg-[var(--hatchin-blue)]/5 relative">
        {/* Timestamp */}
        <span className="absolute top-2.5 right-3 text-xs text-hatchin-text-muted">
          {formatRelativeTime(timestamp)}
        </span>

        {/* Agent row */}
        <div className="flex items-center gap-3 pr-14">
          {/* From agent */}
          <div className="flex items-center gap-1.5 min-w-0">
            <AgentAvatar agentName={fromAgentName} role={fromAgentRole} size={28} />
            <span className="text-sm font-medium hatchin-text truncate">{fromAgentName}</span>
          </div>

          {/* Arrow */}
          <ArrowRight className="w-4 h-4 text-[var(--hatchin-blue)] shrink-0" />

          {/* To agent */}
          <div className="flex items-center gap-1.5 min-w-0">
            <AgentAvatar agentName={toAgentName} role={toAgentRole} size={28} />
            <span className="text-sm font-medium hatchin-text truncate">{toAgentName}</span>
          </div>
        </div>

        {/* Task title */}
        <p className="text-xs text-hatchin-text-muted mt-1.5 truncate">
          Handed off: {taskTitle}
        </p>
      </div>
    </motion.div>
  );
}
