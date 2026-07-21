import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { Task } from '@shared/schema';
import AgentAvatar from '@/components/avatars/AgentAvatar';

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
    queryFn: async () => {
      const r = await fetch(`/api/tasks?projectId=${projectId}`);
      if (!r.ok) return []; // see TasksTab — shared queryKey must always cache Task[]
      return r.json();
    },
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
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[11px] font-semibold text-[var(--hatchin-text-muted)] uppercase tracking-wider">
          Work Outputs
        </span>
        <div className="flex-1 h-px bg-gradient-to-r from-[var(--hatchin-border-subtle)] to-transparent" />
      </div>

      <div className="space-y-1.5">
        {completedTasks.map(task => {
          const isOpen = expandedId === task.id;
          const meta = task.metadata as Record<string, unknown> | null | undefined;
          const outputContent =
            (meta?.output as string | undefined) ??
            task.description ??
            '';
          // The executing agent is recorded on completion (completedByAgentName). `assignee` only
          // holds a name when a human assigned the task, so it is the fallback, not the source.
          // No "Hatch" placeholder: an anonymous row is worse than no name, because "Hatch" reads
          // like a real teammate and hides which one actually did the work.
          const agentName =
            (meta?.completedByAgentName as string | undefined) ?? task.assignee ?? null;

          return (
            <Collapsible key={task.id} open={isOpen} onOpenChange={() => handleToggle(task.id)}>
              <div className="premium-card overflow-hidden">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="w-full flex items-center gap-2 px-3 py-3 min-h-[44px] lg:min-h-0 text-left hover:bg-[var(--hatchin-surface-elevated)] transition-colors"
                  >
                    {/* Same DiceBear avatar the chat and activity feed use, so a completed output is
                        recognizably the same teammate across all three surfaces. When the agent is
                        genuinely unknown (rows completed before the executing agent was recorded),
                        show a completed-work checkmark rather than a "?" bubble: a question mark
                        reads as a broken avatar, while the checkmark says what the row actually is. */}
                    <div className="shrink-0">
                      {agentName ? (
                        <AgentAvatar agentName={agentName} size={24} />
                      ) : (
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center bg-[var(--hatchin-surface-elevated)]"
                          title="Completed work"
                        >
                          <Check className="w-3 h-3 text-[var(--hatchin-text-muted)]" />
                        </div>
                      )}
                    </div>

                    {/* Title */}
                    <div className="flex-1 min-w-0">
                      {/* Wraps to two lines rather than truncating: a work output cut off mid-phrase
                          ("Alex · Draft the onboarding…") hides the one thing the row is for. */}
                      <p className="text-[12px] text-[var(--hatchin-text)] leading-snug line-clamp-2">
                        {agentName && <span className="font-medium">{agentName} · </span>}
                        {task.title}
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
                    <div className="prose prose-sm max-w-none max-h-[200px] overflow-y-auto text-[var(--hatchin-text-muted)] text-xs whitespace-pre-wrap">
                      {outputContent || '(No output content)'}
                    </div>
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
