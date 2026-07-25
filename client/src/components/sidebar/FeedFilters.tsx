import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion } from 'framer-motion';

interface FeedFiltersProps {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  agentFilter: string | null;
  onAgentFilterChange: (agentId: string | null) => void;
  agents: Array<{ id: string; name: string; role: string }>;
}

const FILTER_PILLS = [
  { id: 'all',      label: 'All',       color: 'var(--hatchin-text-muted)' },
  { id: 'task',     label: 'Tasks',     color: 'var(--hatchin-green)' },
  { id: 'handoff',  label: 'Handoffs',  color: 'var(--hatchin-blue)' },
  { id: 'review',   label: 'Reviews',   color: 'var(--hatchin-orange)' },
  { id: 'approval', label: 'Approvals', color: '#f59e0b' },
];

export function FeedFilters({
  activeFilter,
  onFilterChange,
  agentFilter,
  onAgentFilterChange,
  agents,
}: FeedFiltersProps) {
  const activeFilterData = FILTER_PILLS.find(p => p.id === activeFilter);
  const activeFilterColor = activeFilterData?.color;
  const activeFilterLabel = activeFilterData?.label || 'Filter';

  return (
    <div className="mb-4 px-1">
      <div className="flex items-center justify-between gap-2">
        <Select value={activeFilter} onValueChange={onFilterChange}>
          <SelectTrigger 
            className="h-8 flex-1 text-micro font-medium rounded-lg transition-colors border-transparent"
            style={{ 
              backgroundColor: activeFilterColor ? `${activeFilterColor}10` : 'var(--hatchin-surface)'
            }}
          >
            <SelectValue style={{ color: activeFilterColor || 'inherit' }} />
          </SelectTrigger>
          <SelectContent>
            {FILTER_PILLS.map((pill) => (
              <SelectItem key={pill.id} value={pill.id} className="text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: pill.color }} />
                  {pill.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Agent filter — only show when there are multiple agents */}
        {agents.length > 1 && (
          <Select value={agentFilter ?? '__all__'} onValueChange={(v) => onAgentFilterChange(v === '__all__' ? null : v)}>
            <SelectTrigger className="h-8 flex-1 text-micro font-medium bg-transparent border-[var(--hatchin-border-subtle)] rounded-lg">
              <SelectValue placeholder="All agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__" className="text-xs">All agents</SelectItem>
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id} className="text-xs">
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}
