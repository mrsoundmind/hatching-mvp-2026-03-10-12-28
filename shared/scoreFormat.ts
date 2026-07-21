/**
 * Phase 37 — score delta formatting helper.
 *
 * Single canonical formatter for autonomy run tree step deltas (and any other
 * place a Phase-36-style score delta is rendered). Color thresholds match the
 * Phase 36 score-chip palette so badge styling stays visually consistent.
 *
 * D-09: server-side score-delta computation. Client just renders.
 * D-16: single helper, shared module (both server and client may import).
 *
 * Behavior contract (TREE-03):
 *   null / undefined / non-finite → { label: 'new',         tone: 'new'      }
 *   0                              → { label: '',            tone: 'silent'   }  (no badge rendered)
 *   n > 0                          → { label: '+' + n.toFixed(1), tone: 'positive' }
 *   n < 0                          → { label: '−' + |n|.toFixed(1), tone: 'negative' }  (U+2212 en-dash)
 *
 * Note: Negatives prefix with U+2212 (MATHEMATICAL MINUS SIGN), NOT the ASCII '-'
 * hyphen. Phase 36 score-chip palette uses the en-dash for visual consistency.
 */

export type ScoreDeltaTone = 'positive' | 'negative' | 'neutral' | 'new' | 'silent';

export interface FormattedScoreDelta {
  label: string;
  tone: ScoreDeltaTone;
}

export function formatScoreDelta(n: number | null | undefined): FormattedScoreDelta {
  if (n === null || n === undefined) return { label: 'new', tone: 'new' };
  if (!Number.isFinite(n)) return { label: 'new', tone: 'new' };  // defensive — Pitfall 4 NaN-defense
  if (n === 0) return { label: '', tone: 'silent' };
  if (n > 0) return { label: '+' + n.toFixed(1), tone: 'positive' };
  return { label: '−' + Math.abs(n).toFixed(1), tone: 'negative' };  // U+2212, NOT ASCII '-'
}

/**
 * Phase 37 — semantic-word variant of formatScoreDelta for user-facing surfaces.
 *
 * Per `feedback_ui_self_documenting.md` (established 2026-05-14): users shouldn't
 * have to decode `+1.4` to know if it's good or bad. Words always work.
 *
 *   null / undefined / non-finite → { label: 'New',         tone: 'new'      }
 *   0                              → { label: 'No change',   tone: 'neutral'  }
 *   n > 0  (aggregate)             → { label: 'Improved',    tone: 'positive' }
 *   n < 0  (aggregate)             → { label: 'Made worse',  tone: 'negative' }
 *   n > 0  (step)                  → { label: 'Better',      tone: 'positive' }
 *   n < 0  (step)                  → { label: 'Worse',       tone: 'negative' }
 *
 * The raw signed number stays available via formatScoreDelta() for tooltips /
 * hover-on-demand affordances. Default surface = words.
 */
export type DeltaScope = 'aggregate' | 'step';

export function formatScoreDeltaWord(
  n: number | null | undefined,
  scope: DeltaScope = 'step',
): FormattedScoreDelta {
  if (n === null || n === undefined) return { label: 'New', tone: 'new' };
  if (!Number.isFinite(n)) return { label: 'New', tone: 'new' };
  if (n === 0) return { label: 'No change', tone: 'neutral' };
  if (scope === 'aggregate') {
    return n > 0
      ? { label: 'Improved', tone: 'positive' }
      : { label: 'Made worse', tone: 'negative' };
  }
  // step scope
  return n > 0
    ? { label: 'Better', tone: 'positive' }
    : { label: 'Worse', tone: 'negative' };
}
