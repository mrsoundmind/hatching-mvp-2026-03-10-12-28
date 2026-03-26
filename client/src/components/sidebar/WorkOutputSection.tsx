import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronUp } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { Task } from '@shared/schema';

interface WorkOutputSectionProps {
  projectId: string;
}

function formatTimestamp(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function WorkOutputSection({ projectId }: WorkOutputSectionProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: tasks } = useQuery<Task[]>({
    queryKey: ['/api/tasks', `?projectId=${projectId}`],
    queryFn: () =>
      fetch(`/api/tasks?projectId=${projectId}`).then(r => r.json()),
    enabled: !!projectId,
    staleTime: 15_000,
  });

  const completedTasks = (tasks ?? []).filter(t => t.status === 'completed');

  // Don't render section when no completed tasks
  if (completedTasks.length === 0) {
    return null;
  }

  const handleToggle = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  return (
    <div>
      <h3 className="text-[11px] font-semibold text-[var(--hatchin-text-muted)] uppercase tracking-wider mb-3">
        Work Outputs
      </h3>

      <div className="space-y-1.5">
        {completedTasks.map(task => {
          const isOpen = expandedId === task.id;
          const meta = task.metadata as Record<string, unknown> | null | undefined;
          const outputContent =
            (meta?.output as string | undefined) ??
            task.description ??
            '';
          const agentName = task.assignee ?? 'Hatch';

          return (
            <Collapsible key={task.id} open={isOpen} onOpenChange={() => handleToggle(task.id)}>
              <div className="rounded-lg border border-[var(--hatchin-border-subtle)] bg-[var(--hatchin-surface)] overflow-hidden">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-[var(--hatchin-surface-elevated)] transition-colors"
                  >
                    {/* Agent avatar */}
                    <div className="w-6 h-6 rounded-full bg-[var(--hatchin-surface-elevated)] border border-[var(--hatchin-border-subtle)] flex items-center justify-center text-[10px] font-semibold text-[var(--hatchin-text)] shrink-0">
                      {agentName.charAt(0).toUpperCase()}
                    </div>

                    {/* Title */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-[var(--hatchin-text)] truncate">
                        <span className="font-medium">{agentName}</span>
                        {task.title ? ` — ${task.title}` : ''}
                      </p>
                      <p className="text-[11px] text-[var(--hatchin-text-muted)]">
                        {formatTimestamp(task.updatedAt ?? task.createdAt)}
                      </p>
                    </div>

                    {/* Chevron */}
                    {isOpen ? (
                      <ChevronUp className="w-3.5 h-3.5 text-[var(--hatchin-text-muted)] shrink-0" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-[var(--hatchin-text-muted)] shrink-0" />
                    )}
                  </button>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="px-3 pb-3 pt-1">
                    <pre className="text-xs font-mono whitespace-pre-wrap max-h-[200px] overflow-y-auto text-[var(--hatchin-text-muted)]">
                      {outputContent || '(No output content)'}
                    </pre>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}
