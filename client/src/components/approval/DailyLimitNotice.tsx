import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';

/**
 * The daily cost cap, shown ONCE. Previously each blocked task fired its own approval card with a
 * dead Approve button; now the server sends a single `autonomy_daily_limit_reached` notice and this
 * renders it as calm, informational, and dismissible, no Approve/Reject (a budget cap isn't something
 * you approve, the work just resumes tomorrow). Neutral, never colored, so it doesn't read as a decision.
 */
export interface DailyLimitNoticeProps {
  /** How many tasks are queued behind the cap, if known. */
  queuedCount?: number | null;
  onDismiss: () => void;
}

export function DailyLimitNotice({ queuedCount, onDismiss }: DailyLimitNoticeProps) {
  const n = typeof queuedCount === 'number' && queuedCount > 0 ? queuedCount : null;
  const lead = n
    ? `${n} ${n === 1 ? 'task is' : 'tasks are'} queued and will pick back up automatically tomorrow.`
    : 'Queued work will pick back up automatically tomorrow.';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="mx-4 my-2 rounded-xl shadow-sm bg-[var(--hatchin-surface-elevated)] border border-[var(--hatchin-border)] p-4"
      data-testid="daily-limit-notice"
    >
      <div className="flex items-start gap-2.5">
        <div className="w-7 h-7 rounded-lg grid place-items-center shrink-0 bg-white/[0.05] border border-[var(--hatchin-border-subtle)] text-[var(--hatchin-text-muted)]">
          <Clock className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--hatchin-text-muted)]">
            Heads up
          </span>
          <p className="mt-0.5 text-[15px] font-bold text-[var(--hatchin-text-bright)] leading-snug">
            Your team reached today's work limit
          </p>
          <p className="mt-1.5 text-[13px] text-[var(--hatchin-text)] leading-relaxed">
            {lead} This limit prevents surprise costs, so nothing's needed from you.
          </p>
          <div className="flex mt-3.5">
            <button
              type="button"
              onClick={onDismiss}
              className="inline-flex items-center justify-center px-4 py-2.5 min-h-[40px] text-[12.5px] font-semibold rounded-lg bg-transparent text-[var(--hatchin-text-muted)] border border-[var(--hatchin-border)] hover:bg-white/[0.04] hover:text-[var(--hatchin-text)] transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
