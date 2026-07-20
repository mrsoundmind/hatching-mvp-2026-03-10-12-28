/**
 * Activity tab time-range control.
 *
 * Exists because the feed's time window used to be hardcoded to 'today' with no
 * setter and no label (useAutonomyFeed.ts). Every midnight the feed and both stat
 * counters silently reset to empty, so an active project looked dead the next
 * morning and nothing in the UI explained why or offered a way to widen it.
 *
 * Mirrors ActivityViewModeToggle's segmented-control pattern and ARIA contract
 * (role="radiogroup" + role="radio"/aria-checked, WCAG 1.3.1 + 4.1.2).
 */

import type { TimeFilter } from '@/hooks/useAutonomyFeed';

const OPTIONS: Array<{ value: TimeFilter; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: '7days', label: '7 days' },
  { value: 'all', label: 'All time' },
];

interface ActivityTimeRangeToggleProps {
  value: TimeFilter;
  onChange: (value: TimeFilter) => void;
}

export function ActivityTimeRangeToggle({ value, onChange }: ActivityTimeRangeToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Activity time range"
      className="inline-flex rounded-lg bg-[var(--hatchin-surface)] p-0.5 mb-2 mx-1"
    >
      {OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            data-testid={`time-range-${opt.value}`}
            className={`px-2.5 py-1 text-[10px] font-semibold rounded-md transition-colors ${
              active
                ? 'bg-[var(--hatchin-surface-elevated)] hatchin-text'
                : 'hatchin-text-muted hover:hatchin-text'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
