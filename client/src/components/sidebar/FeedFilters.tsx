interface FeedFiltersProps {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  agentFilter: string | null;
  onAgentFilterChange: (agentId: string | null) => void;
  timeFilter: string;
  onTimeFilterChange: (time: string) => void;
  agents: Array<{ id: string; name: string; role: string }>;
}

const EVENT_CHIPS = [
  { id: 'all', label: 'All' },
  { id: 'task', label: 'Tasks' },
  { id: 'handoff', label: 'Handoffs' },
  { id: 'review', label: 'Reviews' },
  { id: 'approval', label: 'Approvals' },
];

const TIME_CHIPS = [
  { id: 'today', label: 'Today' },
  { id: '7days', label: '7 days' },
  { id: 'all', label: 'All time' },
];

export function FeedFilters({
  activeFilter,
  onFilterChange,
  agentFilter,
  onAgentFilterChange,
  timeFilter,
  onTimeFilterChange,
  agents,
}: FeedFiltersProps) {
  const chipBase = 'text-[11px] px-2.5 py-1 rounded-full font-medium transition-colors cursor-pointer';
  const chipActive = `${chipBase} bg-[var(--hatchin-blue)] text-white`;
  const chipInactive = `${chipBase} border border-[var(--hatchin-border-subtle)] hatchin-text-muted hover:border-[var(--hatchin-blue)] hover:text-[var(--hatchin-blue)]`;

  return (
    <div className="mb-3 px-0.5 space-y-1.5">
      {/* Event type chips */}
      <div className="flex flex-wrap gap-1.5">
        {EVENT_CHIPS.map((chip) => (
          <button
            key={chip.id}
            className={activeFilter === chip.id ? chipActive : chipInactive}
            onClick={() => onFilterChange(chip.id)}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Time filter chips */}
      <div className="flex flex-wrap gap-1.5">
        {TIME_CHIPS.map((chip) => (
          <button
            key={`time-${chip.id}`}
            className={timeFilter === chip.id ? chipActive : chipInactive}
            onClick={() => onTimeFilterChange(chip.id)}
          >
            {chip.label}
          </button>
        ))}

        {/* Agent filter dropdown */}
        {agents.length > 0 && (
          <select
            className="text-[11px] px-2 py-1 rounded-full border border-[var(--hatchin-border-subtle)] bg-transparent hatchin-text cursor-pointer"
            value={agentFilter ?? ''}
            onChange={(e) => onAgentFilterChange(e.target.value || null)}
          >
            <option value="">All agents</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
