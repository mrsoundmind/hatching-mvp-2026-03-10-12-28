import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Glasses, RotateCw, ChevronDown, Check, Loader2 } from 'lucide-react';

/**
 * Phase 39 (READ-03/04) — Fresh Reader Review banner for the Artifact panel.
 *
 * A doc-type deliverable is written by an agent that has the whole conversation in its head, so it
 * reads perfectly TO THE AUTHOR. This banner surfaces a context-blind reviewer's take: a teammate who
 * read the finished document with NONE of the backstory, the way the real outside reader will. It flags
 * every spot where understanding secretly needs context the reader doesn't have.
 *
 * Self-documenting by design (per feedback_ui_self_documenting): the banner reads top to bottom as a
 * tiny story — what we did (a stranger read it) → what we found → exactly where → how to fix — with
 * severity shown as plain words ("Reader gets stuck") rather than codes ("HIGH").
 */

export interface ReaderTestAnnotationUI {
  quote: string;
  issue: string;
  severity: 'low' | 'medium' | 'high';
  suggestion: string;
  charOffset: number;
}

export interface ReaderTestData {
  annotations: ReaderTestAnnotationUI[];
  readableWithoutContext: boolean;
  summary: string;
  reviewerModel: string;
  reviewedAt?: string;
  resolvedFromPrevious?: number;
}

interface ReaderTestBannerProps {
  readerTest: ReaderTestData;
  onRerun: () => void;
  isRerunning: boolean;
  addressed: Set<string>;
  dismissed: Set<string>;
  onMarkAddressed: (quote: string) => void;
  onDismiss: (quote: string) => void;
}

const SEVERITY: Record<ReaderTestAnnotationUI['severity'], { label: string; color: string }> = {
  high: { label: 'Reader gets stuck', color: '#f87171' },
  medium: { label: 'Reader has to guess', color: '#f59e0b' },
  low: { label: 'Minor stumble', color: 'var(--hatchin-text-muted)' },
};

const AMBER = '#f59e0b';
const GREEN = 'var(--hatchin-green)';

// The always-visible one-line explainer of what the reader test actually is.
const WHAT_LINE =
  "A teammate read this cold, with none of the backstory from your chat, exactly like the outside reader it's really for.";

export function ReaderTestBanner({
  readerTest,
  onRerun,
  isRerunning,
  addressed,
  dismissed,
  onMarkAddressed,
  onDismiss,
}: ReaderTestBannerProps) {
  const [expanded, setExpanded] = useState(true);

  const visible = readerTest.annotations.filter((a) => !dismissed.has(a.quote));
  const unresolved = visible.filter((a) => !addressed.has(a.quote));
  const hadFindings = readerTest.annotations.length > 0;

  // Three states: never-had-findings (reviewer says clean), still-has-unresolved (amber),
  // and had-findings-but-user-cleared-them-all (prompt a re-run to confirm the fix landed).
  const clean = !hadFindings && readerTest.readableWithoutContext;
  const allHandled = hadFindings && unresolved.length === 0;
  const isAmber = !clean && !allHandled;

  const accent = isAmber ? AMBER : GREEN;
  const verdict = clean
    ? 'Good news: they could follow it start to finish.'
    : allHandled
      ? "You've handled every spot. Re-run to confirm a fresh reader can now follow it."
      : "They got stuck in a few spots that assume things they don't know.";
  const countLabel = clean
    ? 'Reads clean'
    : allHandled
      ? 'All spots addressed'
      : `${unresolved.length} spot${unresolved.length === 1 ? '' : 's'} to look at`;

  return (
    <div
      className="rounded-xl border p-3.5 mb-4"
      style={{
        borderColor: isAmber ? 'rgba(245,158,11,0.38)' : 'rgba(52,211,153,0.30)',
        backgroundColor: isAmber ? 'rgba(245,158,11,0.10)' : 'rgba(52,211,153,0.10)',
      }}
      data-testid="reader-test-banner"
      data-state={isAmber ? 'needs-look' : 'clean'}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-2.5 min-w-0">
          <Glasses className="w-4 h-4 mt-0.5 shrink-0" style={{ color: accent }} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold hatchin-text">
              Fresh reader review
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: accent }} />
            </div>
            <p className="text-micro hatchin-text-muted mt-1 leading-relaxed max-w-[52ch]">{WHAT_LINE}</p>
            <p className="text-xs hatchin-text mt-1.5 font-medium leading-relaxed max-w-[52ch]" data-testid="reader-test-verdict">
              {verdict}
            </p>
            {typeof readerTest.resolvedFromPrevious === 'number' && readerTest.resolvedFromPrevious > 0 && (
              <p className="text-micro mt-1.5 font-medium flex items-center gap-1.5" style={{ color: GREEN }}>
                <Check className="w-3 h-3" />
                Resolved {readerTest.resolvedFromPrevious} spot
                {readerTest.resolvedFromPrevious === 1 ? '' : 's'} a fresh reader flagged last time
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-micro font-bold whitespace-nowrap" style={{ color: accent }}>
            {countLabel}
          </span>
          <button
            type="button"
            onClick={onRerun}
            disabled={isRerunning}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-micro font-medium bg-[var(--hatchin-surface)] hover:bg-[var(--hatchin-surface)]/80 disabled:opacity-50 transition-colors"
            data-testid="reader-test-rerun"
          >
            {isRerunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCw className="w-3 h-3" />}
            {isRerunning ? 'Reading…' : 'Re-run'}
          </button>
          {isAmber && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-micro font-medium bg-[var(--hatchin-surface)] hover:bg-[var(--hatchin-surface)]/80 transition-colors"
              data-testid="reader-test-toggle-spots"
            >
              See spots
              <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isAmber && expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="grid gap-2.5 mt-3">
              {visible.map((a, i) => {
                const sev = SEVERITY[a.severity];
                const isDone = addressed.has(a.quote);
                return (
                  <div
                    key={`${a.quote}-${i}`}
                    className={`rounded-lg border border-[var(--hatchin-border-subtle)] p-3 bg-[var(--hatchin-surface)] transition-opacity ${isDone ? 'opacity-55' : ''}`}
                    data-testid="reader-test-card"
                  >
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sev.color }} />
                      <span
                        className="text-micro font-bold uppercase tracking-wide"
                        style={{ color: sev.color }}
                      >
                        {sev.label}
                      </span>
                      <span
                        className={`text-xs hatchin-text ${isDone ? 'line-through' : ''}`}
                        style={isDone ? { textDecorationColor: 'var(--hatchin-text-muted)' } : undefined}
                      >
                        &ldquo;{a.quote}&rdquo;
                      </span>
                    </div>
                    <p className="text-xs hatchin-text-muted leading-relaxed">{a.issue}</p>
                    {a.suggestion && (
                      <p className="text-xs hatchin-text-muted leading-relaxed mt-0.5">
                        <span style={{ color: GREEN }} className="font-medium">
                          Fix:
                        </span>{' '}
                        {a.suggestion}
                      </p>
                    )}
                    {isDone ? (
                      <p className="text-micro mt-2.5 font-medium flex items-center gap-1.5" style={{ color: GREEN }}>
                        <Check className="w-3 h-3" /> Addressed
                      </p>
                    ) : (
                      <div className="flex gap-2 mt-2.5">
                        <button
                          type="button"
                          onClick={() => onMarkAddressed(a.quote)}
                          className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-micro font-medium border transition-colors"
                          style={{ color: '#bfe9d3', borderColor: '#245b45', backgroundColor: 'rgba(52,211,153,0.08)' }}
                          data-testid="reader-test-mark-addressed"
                        >
                          <Check className="w-3 h-3" /> Mark addressed
                        </button>
                        <button
                          type="button"
                          onClick={() => onDismiss(a.quote)}
                          className="inline-flex items-center h-7 px-2.5 rounded-lg text-micro font-medium hatchin-text-muted hover:hatchin-text bg-transparent border border-[var(--hatchin-border-subtle)] hover:bg-[var(--hatchin-surface)]/80 transition-colors"
                          data-testid="reader-test-dismiss"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
