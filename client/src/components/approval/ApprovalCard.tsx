import { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, AlertCircle, Check, X, ChevronRight } from 'lucide-react';
import { humanizeRiskReasons, isDestructiveRisk } from '@shared/riskReasons';
import { resolveAgentName, isGenericAgentName } from '@/lib/agentDisplay';

/**
 * One approval card, shared by the chat surface (AutonomousApprovalCard) and the sidebar
 * (ApprovalItem), so a decision looks identical wherever it appears. User-approved design
 * (mockup d946e189 / sidebar 1f3beb0c):
 *   - No left rail. The accent is a full-border + icon + label tint that follows the STAKES:
 *     red for a destructive/irreversible action, blue for a normal approval, so the card stands
 *     out among the sidebar's many neutral components and its color signals how careful to be.
 *   - Reads first: label + timestamp, the task title, a plain-language description of what will
 *     happen, then every reason it's paused (humanized, never raw codes), then an optional expand
 *     to read exactly what the agent prepared.
 *   - Buttons follow risk: for a destructive action the safe "Not now" leads and the confirm is a
 *     careful (outlined red) button, so nobody destroys data on a reflex click; a normal approval
 *     keeps the confirm as the primary.
 */

type Variant = 'chat' | 'sidebar';

export interface ApprovalCardProps {
  variant?: Variant;
  agentName: string;
  taskTitle?: string;
  taskDescription?: string | null;
  riskReasons: string[];
  draftPreview?: string | null;
  /** e.g. "just now" / "3 min ago". Optional. */
  raisedAtLabel?: string;
  /** Sidebar only: approval window elapsed. Renders an "Expired" badge instead of buttons. */
  isExpired?: boolean;
  isLoading: boolean;
  onApprove: () => void;
  onReject: () => void;
}

const ACCENT = {
  destructive: {
    border: 'rgba(242,96,106,.42)',
    wash: 'linear-gradient(180deg, rgba(242,96,106,.06), transparent 62%)',
    icon: '#ff8f97',
    iconBg: 'rgba(242,96,106,.13)',
    iconBorder: 'rgba(242,96,106,.34)',
    label: '#ff8f97',
  },
  normal: {
    border: 'rgba(108,130,255,.46)',
    wash: 'linear-gradient(180deg, rgba(108,130,255,.07), transparent 62%)',
    icon: '#aeb9ff',
    iconBg: 'rgba(108,130,255,.15)',
    iconBorder: 'rgba(108,130,255,.36)',
    label: '#aeb9ff',
  },
} as const;

export function ApprovalCard({
  variant = 'chat',
  agentName,
  taskTitle,
  taskDescription,
  riskReasons,
  draftPreview,
  raisedAtLabel,
  isExpired = false,
  isLoading,
  onApprove,
  onReject,
}: ApprovalCardProps) {
  const [expanded, setExpanded] = useState(false);

  const destructive = isDestructiveRisk(riskReasons);
  const accent = destructive ? ACCENT.destructive : ACCENT.normal;
  const Icon = destructive ? AlertTriangle : AlertCircle;

  const hasRealAgent = !isGenericAgentName(agentName);
  const who = resolveAgentName(agentName, 'Your team');

  const title = (taskTitle ?? '').trim();
  const reasons = humanizeRiskReasons(riskReasons);
  const desc = (taskDescription ?? '').trim();
  // A plain-language line for what's happening. Fall back to an honest sentence when the task
  // carried no description, so the card is never contentless.
  const body =
    desc && desc.toLowerCase() !== title.toLowerCase()
      ? desc
      : `${hasRealAgent ? who : 'Your team'} paused this for your approval before it goes ahead.`;

  const preview = (draftPreview ?? '').trim();
  const isSidebar = variant === 'sidebar';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: isExpired ? 0 : 0.18, ease: 'easeOut' }}
      className={`rounded-xl shadow-sm bg-[var(--hatchin-surface-elevated)] ${isSidebar ? 'p-3.5' : 'mx-4 my-2 p-4'}`}
      style={{
        border: `1px solid ${accent.border}`,
        backgroundImage: accent.wash,
      }}
      data-testid="approval-card"
      data-risk={destructive ? 'destructive' : 'normal'}
    >
      <div className="flex items-start gap-2.5">
        {/* Icon tile — tinted by stakes */}
        <div
          className="w-7 h-7 rounded-lg grid place-items-center shrink-0"
          style={{ background: accent.iconBg, border: `1px solid ${accent.iconBorder}`, color: accent.icon }}
        >
          <Icon className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Label + timestamp */}
          <div className="flex items-baseline justify-between gap-2">
            <span
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: accent.label }}
            >
              Needs your approval
            </span>
            {raisedAtLabel && (
              <span className="text-[10.5px] text-[var(--hatchin-text-muted)] whitespace-nowrap shrink-0">
                {raisedAtLabel}
              </span>
            )}
          </div>

          {/* Title */}
          {title && (
            <p className="mt-0.5 text-[15px] font-bold text-[var(--hatchin-text-bright)] leading-snug">
              {title}
            </p>
          )}

          {/* What happens, in plain language */}
          <p className="mt-1.5 text-[13px] text-[var(--hatchin-text)] leading-relaxed">{body}</p>

          {/* Why it's paused — humanized reasons only (raw safety codes are telemetry) */}
          {reasons.length > 0 && (
            <div className="mt-2.5 rounded-lg border border-[var(--hatchin-border-subtle)] bg-white/[0.022] px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--hatchin-text-muted)] mb-1.5">
                Why this is paused for you
              </p>
              <ul className="space-y-1.5">
                {reasons.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12.5px] text-[var(--hatchin-text)] leading-snug">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--hatchin-text-muted)] shrink-0 mt-1.5" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Optional: read exactly what the agent prepared */}
          {preview && (
            <div className="mt-2.5">
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--hatchin-text-muted)] hover:text-[var(--hatchin-text)] transition-colors"
                aria-expanded={expanded}
              >
                <ChevronRight className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                {expanded ? 'Hide' : `See what ${hasRealAgent ? who : 'the team'} prepared`}
              </button>
              {expanded && (
                <div className="mt-2 rounded-lg border border-[var(--hatchin-border-subtle)] bg-black/25 px-3 py-2.5 text-[12px] text-[var(--hatchin-text)] leading-relaxed whitespace-pre-wrap break-words max-h-52 overflow-y-auto">
                  {preview}
                </div>
              )}
            </div>
          )}

          {/* Actions — safe choice leads for destructive; confirm leads for normal */}
          <div className={`flex gap-2 mt-3.5 ${isExpired ? '' : ''}`}>
            {isExpired ? (
              <span
                className="inline-flex text-[11px] font-semibold px-2.5 py-1 rounded-full bg-red-500/10 text-red-400"
                aria-label="Approval expired"
              >
                Expired
              </span>
            ) : destructive ? (
              <>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={onReject}
                  className={`${isSidebar ? 'flex-1' : ''} inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[40px] text-[12.5px] font-semibold rounded-lg bg-white/[0.055] text-[var(--hatchin-text-bright)] border border-[var(--hatchin-border)] hover:bg-white/[0.09] disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
                >
                  Not now
                </button>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={onApprove}
                  className={`${isSidebar ? 'flex-1' : ''} inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[40px] text-[12.5px] font-semibold rounded-lg bg-transparent text-red-400 border border-red-500/50 hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
                >
                  Approve
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={onApprove}
                  className={`${isSidebar ? 'flex-1' : ''} inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[40px] text-[12.5px] font-semibold rounded-lg bg-[var(--hatchin-blue)] text-white hover:bg-[var(--hatchin-blue)]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
                >
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  Approve
                </button>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={onReject}
                  className={`${isSidebar ? 'flex-1' : ''} inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[40px] text-[12.5px] font-semibold rounded-lg bg-transparent text-[var(--hatchin-text-muted)] border border-[var(--hatchin-border)] hover:bg-white/[0.04] hover:text-[var(--hatchin-text)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
                >
                  Not now
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
