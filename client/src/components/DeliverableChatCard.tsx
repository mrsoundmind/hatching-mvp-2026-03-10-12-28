import { motion } from 'framer-motion';
import { FileText, ExternalLink } from 'lucide-react';
import { resolveAgentName } from '@/lib/agentDisplay';

interface DeliverableChatCardProps {
  deliverableId: string;
  title: string;
  type: string;
  agentName: string;
  agentRole: string;
  status: string;
}

const TYPE_COLORS: Record<string, string> = {
  'prd': 'var(--hatchin-blue)',
  'tech-spec': 'var(--hatchin-green)',
  'design-brief': '#a855f7',
  'gtm-plan': 'var(--hatchin-orange)',
  'blog-post': '#ec4899',
  'landing-copy': '#f59e0b',
  'content-calendar': '#14b8a6',
  'email-sequence': '#6366f1',
  'project-plan': 'var(--hatchin-blue)',
  'competitive-analysis': '#f97316',
  'market-research': '#8b5cf6',
  'custom': 'var(--hatchin-text-muted)',
};

export function DeliverableChatCard({
  deliverableId,
  title,
  type,
  agentName,
  agentRole,
  status,
}: DeliverableChatCardProps) {
  const color = TYPE_COLORS[type] || TYPE_COLORS.custom;

  const handleOpen = () => {
    window.dispatchEvent(new CustomEvent('open_deliverable', { detail: { deliverableId } }));
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="premium-card p-3 my-2 mx-4 border-l-[3px] cursor-pointer hover:border-[var(--hatchin-blue)]/30 transition-colors"
      style={{ borderLeftColor: color }}
      onClick={handleOpen}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: color + '20' }}
        >
          <FileText className="w-4 h-4" style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate hatchin-text">{title}</span>
            <ExternalLink className="w-3 h-3 hatchin-text-muted shrink-0" />
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span
              className="text-xs font-bold uppercase px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: color, color: 'white' }}
            >
              {type.replace(/-/g, ' ')}
            </span>
            <span className="text-xs hatchin-text-muted">
              by {agentName} ({agentRole})
            </span>
            <span className="text-xs hatchin-text-muted ml-auto">
              {status === 'complete' ? 'Complete' : status === 'in_review' ? 'In Review' : 'Draft'}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Proposal card — shown when organic detection suggests creating a deliverable.
 * User can accept or dismiss.
 */
interface DeliverableProposalCardProps {
  type: string;
  title: string;
  agentName: string;
  agentRole: string;
  onAccept: () => void;
  onDismiss: () => void;
}

export function DeliverableProposalCard({
  type,
  title,
  agentName,
  onAccept,
  onDismiss,
}: DeliverableProposalCardProps) {
  const color = TYPE_COLORS[type] || TYPE_COLORS.custom;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="premium-card p-4 my-2 mx-4 border-l-[3px]"
      style={{ borderLeftColor: color }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: color + '20' }}
        >
          <FileText className="w-4 h-4" style={{ color }} />
        </div>
        <div className="flex-1">
          <p className="text-sm hatchin-text">
            {resolveAgentName(agentName, 'Your team')} thinks it's a good time to create a <strong>{title}</strong>.
          </p>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={onAccept}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-white min-h-[36px] transition-colors"
              style={{ backgroundColor: 'var(--hatchin-blue)' }}
            >
              Go ahead
            </button>
            <button
              onClick={onDismiss}
              className="px-3 py-1.5 rounded-lg text-xs font-medium hatchin-text-muted hover:bg-[var(--hatchin-surface)] min-h-[36px] transition-colors"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
