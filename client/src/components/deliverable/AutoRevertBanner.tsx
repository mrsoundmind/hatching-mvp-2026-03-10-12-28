/**
 * Phase 36 (RUBR-02) — Inline non-blocking banner shown ABOVE ArtifactPanel content
 * when the most recent iterate was reverted (newScore < oldScore).
 *
 * UX contract (D-13..D-16):
 *   - Inline rendering only — not a blocking overlay, not a toast.
 *   - Amber/warning palette from user-approved wireframe (/tmp/phase-36-wireframe.html):
 *     bg hsla(35, 90%, 55%, 0.12), border hsla(35, 90%, 55%, 0.45),
 *     text hsl(36, 90%, 78%), strong-text hsl(36, 100%, 85%).
 *   - Dismissible via X button — dismissal is client-side only (re-appears on next revert).
 *   - "See what changed" toggles a local expanded state showing the rejected version's
 *     content + rubric breakdown (RubricBreakdown composed inside).
 *
 * Copy (D-14):
 *   "Refinement made it worse, kept previous version."
 *   "Rubric scored the new draft X.X / 10 vs Y.Y / 10. The earlier version is still active."
 */
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, AlertTriangle } from 'lucide-react';
import { RubricBreakdown } from './RubricBreakdown';

export interface AutoRevertBannerProps {
  oldScore: number;
  newScore: number;
  rejectedContent?: string;
  rejectedBreakdown?: Array<{ criterion: string; score: number; justification: string }>;
  rubricVersion?: string | null;
  onDismiss: () => void;
}

export function AutoRevertBanner({
  oldScore,
  newScore,
  rejectedContent,
  rejectedBreakdown,
  rubricVersion,
  onDismiss,
}: AutoRevertBannerProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="overflow-hidden"
      data-testid="auto-revert-banner"
    >
      <div
        className="rounded-[10px] px-3 py-2.5"
        style={{
          backgroundColor: 'hsla(35, 90%, 55%, 0.12)',
          border: '1px solid hsla(35, 90%, 55%, 0.45)',
          color: 'hsl(36, 90%, 78%)',
        }}
      >
        <div className="flex items-start gap-2.5">
          <AlertTriangle
            className="w-4 h-4 mt-0.5 shrink-0"
            style={{ color: 'hsl(35, 90%, 60%)' }}
          />
          <div className="flex-1 min-w-0 text-xs leading-relaxed">
            <div
              className="font-semibold"
              style={{ color: 'hsl(36, 100%, 85%)' }}
            >
              Refinement made it worse, kept previous version.
            </div>
            <div className="mt-0.5">
              The new draft scored {newScore.toFixed(1)} / 10 vs {oldScore.toFixed(1)} / 10.
              The earlier version is still active.
            </div>
            <button
              type="button"
              className="mt-1 text-[11px] underline underline-offset-2 hover:opacity-80"
              style={{ color: 'hsl(35, 90%, 65%)' }}
              onClick={() => setExpanded((e) => !e)}
              data-testid="auto-revert-banner-expand"
            >
              {expanded ? 'Hide details' : 'See what changed'}
            </button>
          </div>
          <button
            type="button"
            className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            style={{ color: 'hsl(36, 90%, 78%)' }}
            onClick={onDismiss}
            aria-label="Dismiss notice"
            data-testid="auto-revert-banner-dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        {expanded && (
          <div className="mt-3 space-y-3" data-testid="auto-revert-banner-expanded-content">
            {rejectedContent && (
              <div className="text-[11px]">
                <div
                  className="font-medium mb-1"
                  style={{ color: 'hsl(36, 100%, 85%)' }}
                >
                  Rejected version:
                </div>
                <pre
                  className="whitespace-pre-wrap break-words p-2 rounded max-h-40 overflow-y-auto leading-relaxed"
                  style={{ backgroundColor: 'hsla(35, 90%, 55%, 0.08)' }}
                >
                  {rejectedContent}
                </pre>
              </div>
            )}
            <RubricBreakdown
              rubricScore={{ total: newScore, breakdown: rejectedBreakdown ?? [] }}
              rubricVersion={rubricVersion ?? null}
            />
          </div>
        )}
      </div>
    </motion.div>
  );
}
