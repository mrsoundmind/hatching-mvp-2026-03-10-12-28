/**
 * Activity tab time-range control.
 *
 * Exists because the feed's time window used to be hardcoded to 'today' with no
 * setter and no label. Every midnight the feed and counters silently reset to empty,
 * so an active project looked dead the next morning with nothing explaining why.
 *
 * Rendered as a dropdown rather than a segmented control on purpose: a segmented
 * control announces "this is a primary mode of the view", and a time window is a
 * setting, not a mode. The dropdown states the current range in words next to a clock
 * so it stays readable at a glance while costing one line instead of a whole row.
 */

import { Clock } from 'lucide-react';
import type { TimeFilter } from '@/hooks/useAutonomyFeed';

const OPTIONS: Array<{ value: TimeFilter; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: '7days', label: 'Last 7 days' },
  { value: 'all', label: 'All time' },
];

interface ActivityTimeRangeToggleProps {
  value: TimeFilter;
  onChange: (value: TimeFilter) => void;
}

export function ActivityTimeRangeToggle({ value, onChange }: ActivityTimeRangeToggleProps) {
  const current = OPTIONS.find((o) => o.value === value) ?? OPTIONS[2];

  return (
    <div className="relative inline-flex items-center gap-1.5 rounded-lg bg-[var(--hatchin-surface)] pl-2 pr-1 py-1">
      <Clock className="w-3 h-3 hatchin-text-muted shrink-0" aria-hidden />
      <span className="text-[10px] font-semibold hatchin-text whitespace-nowrap">{current.label}</span>
      <span className="text-[8px] hatchin-text-muted pr-1" aria-hidden>▾</span>
      {/* Native select overlaid so the control keeps platform keyboard + touch behaviour
          (and the mobile wheel picker) instead of a bespoke menu that has to reimplement it. */}
      <select
        aria-label="Activity time range"
        value={value}
        onChange={(e) => onChange(e.target.value as TimeFilter)}
        data-testid="activity-time-range"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      >
        {OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
