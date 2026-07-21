/**
 * Phase 37 (TREE-03, D-10) — Activity tab view-mode toggle.
 *
 * Segmented control with two options: [Flat] [Tree]. The Activity tab owns the
 * state + localStorage persistence; this component is purely presentational.
 *
 * ARIA: role="radiogroup" with each button role="radio" + aria-checked. Matches
 * the WCAG 1.3.1 + 4.1.2 pattern for segmented controls.
 */

interface ActivityViewModeToggleProps {
  mode: 'flat' | 'tree';
  onChange: (mode: 'flat' | 'tree') => void;
}

export function ActivityViewModeToggle({ mode, onChange }: ActivityViewModeToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Activity view mode"
      className="inline-flex rounded-lg bg-[var(--hatchin-surface)] p-0.5 mb-2 mx-1"
    >
      {(['flat', 'tree'] as const).map((opt) => {
        const active = mode === opt;
        return (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt)}
            data-testid={`view-mode-${opt}`}
            title={
              opt === 'flat'
                ? 'Everything as it happened, newest first'
                : 'Grouped under the task that produced it'
            }
            className={`px-2.5 py-1 text-[10px] font-semibold rounded-md transition-colors ${
              active
                ? 'bg-[var(--hatchin-surface-elevated)] hatchin-text'
                : 'hatchin-text-muted hover:hatchin-text'
            }`}
          >
            {/* "Flat" and "Tree" name the data structure, not anything the user
                recognises. "Timeline" and "By task" borrow words they already have
                (there is a Tasks tab) instead of teaching two new ones. */}
            {opt === 'flat' ? 'Timeline' : 'By task'}
          </button>
        );
      })}
    </div>
  );
}
