import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { humanizeRiskReasons } from '@shared/riskReasons';
import { resolveAgentName, isGenericAgentName } from '@/lib/agentDisplay';

export interface AutonomousApprovalCardProps {
  taskId: string;
  agentName: string;
  /** What the approval is about — shown so the card is never a nameless "needs approval". */
  taskTitle?: string;
  riskReasons: string[];
  onApprove: (taskId: string) => void;
  onReject: (taskId: string) => void;
  isLoading: boolean;
}

export function AutonomousApprovalCard({
  taskId,
  agentName,
  taskTitle,
  riskReasons,
  onApprove,
  onReject,
  isLoading,
}: AutonomousApprovalCardProps) {
  // WHO: a real agent, or nothing (never "System"/"Agent"/blank rendered as a teammate). When the
  // actor is generic (e.g. a system-level cost-cap block), we frame it as a decision, not a teammate.
  const hasRealAgent = !isGenericAgentName(agentName);
  const who = resolveAgentName(agentName, '');
  const headline = hasRealAgent ? `${who} needs your approval` : 'A decision is waiting on you';

  // WHY: humanized reasons only (raw safety codes are telemetry). If everything drops and there's no
  // title to lean on, show a neutral line so the card is never contentless.
  const reasons = humanizeRiskReasons(riskReasons);
  const title = (taskTitle ?? '').trim();
  const fallbackContext = reasons.length === 0 && !title ? 'Review the details before you decide.' : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="mx-4 my-2 premium-card p-4 border-l-[3px] border-l-[var(--hatchin-orange)]"
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <AlertCircle className="w-5 h-5 text-orange-400 mt-0.5 shrink-0" />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--hatchin-text-bright)]">
            {headline}
          </p>

          {/* WHAT — the task being approved. */}
          {title && (
            <p className="mt-1 text-xs text-[var(--hatchin-text)] truncate">{title}</p>
          )}

          {/* WHY — plain-language reasons only. The raw safety codes are telemetry (#43); a humanizer maps
              them and drops anything unrecognized so a new code can never leak here. */}
          {reasons.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              {reasons.join(' · ')}
            </p>
          )}
          {fallbackContext && (
            <p className="mt-1 text-xs text-muted-foreground">{fallbackContext}</p>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              disabled={isLoading}
              onClick={() => onApprove(taskId)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] text-xs font-medium rounded-lg whitespace-nowrap bg-[var(--hatchin-blue)] text-white hover:bg-[var(--hatchin-blue)]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <CheckCircle className="w-3.5 h-3.5 shrink-0" />
              Approve
            </button>

            <button
              type="button"
              disabled={isLoading}
              onClick={() => onReject(taskId)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] text-xs font-medium rounded-lg whitespace-nowrap border border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <XCircle className="w-3.5 h-3.5 shrink-0" />
              Reject
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
