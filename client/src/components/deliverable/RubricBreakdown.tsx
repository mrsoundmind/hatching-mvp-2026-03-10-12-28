/**
 * Phase 36 (RUBR-04) — Per-criterion rubric breakdown.
 *
 * Pure presentation. Consumes the rubricScore JSONB shape from a deliverable_versions row.
 *
 * IMPORTANT: This component MUST NOT import the rubric registry from shared. The rubric
 * registry's anchorAt0/anchorAt10 fields are server-only (T-36-02 / T-36-31). We only need
 * the `criterion` key (snake_case), `score`, and `justification` that the server already
 * returns in rubricScore.breakdown.
 *
 * Three render states:
 *   1. null rubricScore  → "Score pending" (pre-Phase-36 version, or v1 baseline scoring failed)
 *   2. skipped: true     → "Rubric not available for this type" (legacy custom type)
 *   3. populated         → per-criterion list
 *
 * Visual contract follows the user-approved wireframe at /tmp/phase-36-wireframe.html:
 *   - Surface-elevated card with subtle border, 10px radius, 12px padding.
 *   - Total row at top: muted "Rubric score" label + large color-coded total (green ≥7,
 *     blue 5-6.9, orange <5).
 *   - Per-criterion rows: criterion name (left, primary text), 1-line justification (middle,
 *     muted), score on right (bold, tabular-nums, blue).
 */
import React from 'react';

export interface RubricBreakdownProps {
  rubricScore: {
    total: number;
    breakdown: Array<{ criterion: string; score: number; justification: string }>;
    skipped?: boolean;
    reason?: string;
  } | null;
  rubricVersion: string | null;
}

/** Convert snake_case criterion key to Title Case for display. */
function humanizeKey(key: string): string {
  return key
    .split('_')
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

/** Color-code the total score per the wireframe palette. */
function totalScoreColor(total: number): string {
  if (total >= 7) return 'var(--hatchin-green)';
  if (total >= 5) return 'var(--hatchin-blue)';
  return 'var(--hatchin-orange)';
}

export function RubricBreakdown({ rubricScore, rubricVersion }: RubricBreakdownProps) {
  if (!rubricScore) {
    return (
      <div
        className="p-3 rounded-[10px] bg-[var(--hatchin-surface-elevated)] border border-[var(--hatchin-border-subtle)] text-xs hatchin-text-muted"
        data-testid="rubric-breakdown-empty"
      >
        Score pending.
      </div>
    );
  }

  if (rubricScore.skipped) {
    return (
      <div
        className="p-3 rounded-[10px] bg-[var(--hatchin-surface-elevated)] border border-[var(--hatchin-border-subtle)] text-xs hatchin-text-muted"
        data-testid="rubric-breakdown-skipped"
      >
        Rubric not available for this type.
        {rubricScore.reason && <div className="mt-1 opacity-75">({rubricScore.reason})</div>}
      </div>
    );
  }

  return (
    <div
      className="p-3 rounded-[10px] bg-[var(--hatchin-surface-elevated)] border border-[var(--hatchin-border-subtle)] text-xs"
      data-testid="rubric-breakdown"
    >
      {/* Total row */}
      <div className="flex items-baseline justify-between pb-2 mb-2 border-b border-[var(--hatchin-border-subtle)]">
        <span className="text-micro font-medium tracking-wide hatchin-text-muted">
          Why this scored {rubricScore.total.toFixed(1)} / 10
        </span>
        <span className="flex items-baseline gap-2">
          <span
            className="text-lg font-bold tabular-nums"
            style={{ color: totalScoreColor(rubricScore.total) }}
          >
            {rubricScore.total.toFixed(1)} / 10
          </span>
          {rubricVersion && (
            <span className="hatchin-text-muted text-xs">v{rubricVersion}</span>
          )}
        </span>
      </div>

      {/* Per-criterion rows */}
      <div>
        {rubricScore.breakdown.map((row, i) => (
          <div
            key={`${row.criterion}-${i}`}
            className="flex items-start justify-between gap-3 py-1.5"
            data-testid={`rubric-criterion-${row.criterion}`}
          >
            <span className="font-medium hatchin-text min-w-[120px] shrink-0">
              {humanizeKey(row.criterion)}
            </span>
            <span className="flex-1 hatchin-text-muted leading-relaxed text-micro">
              {row.justification}
            </span>
            <span
              className="shrink-0 font-bold tabular-nums"
              style={{ color: 'var(--hatchin-blue)' }}
            >
              {row.score}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
