import { useMemo, useState, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { TaskPipelineView } from './TaskPipelineView';
import { WorkOutputSection } from './WorkOutputSection';
import { useSidebarEvent } from '@/hooks/useSidebarEvent';
import { AUTONOMY_EVENTS } from '@/lib/autonomyEvents';
import { useToast } from '@/hooks/use-toast';
import type { Task } from '@shared/schema';

const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#f87171',   // red-400
  high:   '#fb923c',   // orange-400
  medium: '#60a5fa',   // blue-400
  low:    'var(--hatchin-text-muted)',
};

interface TasksTabProps {
  projectId: string | undefined;
}

/**
 * Tasks Tab — canonical home for all project work.
 */
export function TasksTab({ projectId }: TasksTabProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: tasks, isLoading } = useQuery<Task[]>({
    queryKey: ['/api/tasks', `?projectId=${projectId}`],
    queryFn: async () => {
      const r = await fetch(`/api/tasks?projectId=${projectId}`);
      // 404 returns {error: "..."} — never cache non-array shapes since this
      // queryKey is shared with RightSidebar/ActivityTab/WorkOutputSection
      // and they all assume the data is Task[]. Caching an error object would
      // crash every consumer with "(allTasks ?? []).some is not a function".
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!projectId,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  // Invalidate on relevant events
  useSidebarEvent(AUTONOMY_EVENTS.APPROVAL_REQUIRED, () => {
    queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
  });
  useSidebarEvent(AUTONOMY_EVENTS.TASK_COMPLETED, () => {
    queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
  });
  useSidebarEvent('tasks_updated' as any, () => {
    queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
  });

  // 'completed' starts collapsed so finished work doesn't bury active work — but if
  // EVERYTHING is done, collapsing it leaves a board that looks empty even though the
  // team shipped. In that case start expanded so the user sees what was accomplished.
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set(['completed'])
  );
  const [autoExpandedCompleted, setAutoExpandedCompleted] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [showAddTask, setShowAddTask] = useState(false);

  const taskSections = useMemo(() => {
    const boardTasks = (tasks ?? []).filter(t => {
      const meta = t.metadata as Record<string, unknown>;
      return !(meta?.awaitingApproval === true && !meta?.approvedAt && !meta?.rejectedAt);
    });

    const urgent = boardTasks.filter(
      t => t.status !== 'completed' && (t.priority === 'urgent' || t.priority === 'high')
    );
    const active = boardTasks.filter(
      t =>
        t.status !== 'completed' &&
        t.priority !== 'urgent' &&
        t.priority !== 'high'
    );
    const completed = boardTasks.filter(t => t.status === 'completed');

    return [
      { id: 'urgent', title: 'Urgent', tasks: urgent, color: '#f87171' },
      { id: 'active', title: 'Active', tasks: active, color: '#60a5fa' },
      { id: 'completed', title: 'Completed', tasks: completed, color: '#4ade80' },
    ];
  }, [tasks]);

  const totalBoardTasks = taskSections.reduce((sum, s) => sum + s.tasks.length, 0);

  // Auto-expand Completed exactly once, when it is the ONLY section with anything in
  // it. Fires once (autoExpandedCompleted) so a deliberate collapse by the user sticks.
  useEffect(() => {
    if (autoExpandedCompleted) return;
    const count = (id: string) => taskSections.find(s => s.id === id)?.tasks.length ?? 0;
    if (count('completed') > 0 && count('active') === 0 && count('urgent') === 0) {
      setCollapsedSections(prev => {
        const next = new Set(prev);
        next.delete('completed');
        return next;
      });
      setAutoExpandedCompleted(true);
    }
  }, [taskSections, autoExpandedCompleted]);

  const toggleSection = useCallback((sectionId: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }, []);

  const toggleTaskStatus = useCallback(
    async (taskId: string, currentStatus: string) => {
      const newStatus = currentStatus === 'completed' ? 'todo' : 'completed';
      try {
        const res = await fetch(`/api/tasks/${taskId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        });
        if (res.ok) {
          queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
        }
      } catch {
        toast({ title: 'Error', description: 'Failed to update task.', variant: 'destructive' });
      }
    },
    [queryClient, toast]
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      try {
        const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
        if (res.ok) {
          queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
          toast({ description: 'Task deleted.' });
        }
      } catch {
        toast({ title: 'Error', description: 'Failed to delete task.', variant: 'destructive' });
      }
    },
    [queryClient, toast]
  );

  const addTask = useCallback(async () => {
    if (!newTaskTitle.trim() || !projectId) return;
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTaskTitle.trim(),
          status: 'todo',
          priority: 'medium',
          projectId,
        }),
      });
      if (res.ok) {
        setNewTaskTitle('');
        setShowAddTask(false);
        queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
        toast({ description: 'Task created.' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to create task.', variant: 'destructive' });
    }
  }, [newTaskTitle, projectId, queryClient, toast]);

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto hide-scrollbar">
      <div className="mb-3 px-1 shrink-0">
        <p className="text-xs font-medium hatchin-text mb-0.5">Mission Board</p>
        <p className="text-xs hatchin-text-muted">Tasks created by Hatches from chat, or added by you.</p>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-[var(--hatchin-blue)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : totalBoardTasks === 0 ? (
        <div className="flex-1 flex flex-col items-start justify-center py-8 px-2">
          <p className="text-base font-semibold hatchin-text mb-1">No missions yet.</p>
          <p className="text-xs hatchin-text-muted leading-relaxed mb-6 max-w-[220px]">
            Agents create tasks from chat automatically. You can also add your own.
          </p>
          {projectId && (
            <button
              onClick={() => setShowAddTask(v => !v)}
              className="text-xs font-semibold px-3 py-2 rounded-lg border border-[var(--hatchin-border-subtle)] hatchin-text hover:border-[var(--hatchin-blue)] hover:text-[var(--hatchin-blue)] transition-colors"
            >
              + New task
            </button>
          )}
          {showAddTask && (
            <div className="mt-3 w-full p-3 rounded-xl bg-[var(--glass-frosted)] border border-[var(--glass-border)]">
              <input
                type="text"
                value={newTaskTitle}
                onChange={e => setNewTaskTitle(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') addTask();
                  if (e.key === 'Escape') { setShowAddTask(false); setNewTaskTitle(''); }
                }}
                placeholder="What needs to be done?"
                className="w-full bg-transparent border-none outline-none hatchin-text text-xs mb-2"
                autoFocus
              />
              <div className="flex gap-1.5">
                <button onClick={addTask} className="px-3 py-1 bg-[var(--hatchin-blue)] text-white rounded-lg text-micro font-medium hover:opacity-90">Add</button>
                <button onClick={() => { setShowAddTask(false); setNewTaskTitle(''); }} className="px-3 py-1 bg-[var(--hatchin-surface)] hatchin-text rounded-lg text-micro">Cancel</button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* 1. Task Pipeline visual */}
          {tasks && tasks.length > 0 && <TaskPipelineView tasks={tasks} />}

          {/* 2. Task Board */}
          <div className="mt-2 px-1">
            {/* Section header — text-only, no icons */}
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="text-micro font-semibold text-[var(--hatchin-text-muted)] uppercase tracking-wider">
                Tasks
                <span className="ml-2 font-normal normal-case tracking-normal">{totalBoardTasks}</span>
              </p>
              <button
                onClick={() => setShowAddTask(v => !v)}
                className="text-micro font-medium text-[var(--hatchin-blue)] hover:opacity-80 transition-opacity"
              >
                + New
              </button>
            </div>

            {/* Inline add task */}
            {showAddTask && (
              <div className="mb-2 p-3 rounded-xl bg-[var(--glass-frosted)] border border-[var(--glass-border)]">
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={e => setNewTaskTitle(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') addTask();
                    if (e.key === 'Escape') { setShowAddTask(false); setNewTaskTitle(''); }
                  }}
                  placeholder="What needs to be done?"
                  className="w-full bg-transparent border-none outline-none hatchin-text text-xs mb-2"
                  autoFocus
                />
                <div className="flex gap-1.5">
                  <button onClick={addTask} className="px-3 py-1 bg-[var(--hatchin-blue)] text-white rounded-lg text-micro font-medium hover:opacity-90">Add</button>
                  <button onClick={() => { setShowAddTask(false); setNewTaskTitle(''); }} className="px-3 py-1 bg-[var(--hatchin-surface)] hatchin-text rounded-lg text-micro">Cancel</button>
                </div>
              </div>
            )}

            {/* Task sections */}
            <div className="space-y-1">
              {taskSections.map(section => {
                if (section.tasks.length === 0) return null;
                const isCollapsed = collapsedSections.has(section.id);
                return (
                  <div key={section.id}>
                    {/* Section header */}
                    <button
                      onClick={() => toggleSection(section.id)}
                      className="flex items-center gap-1.5 w-full py-1 text-left"
                    >
                      {isCollapsed
                        ? <ChevronRight className="w-3 h-3 hatchin-text-muted" />
                        : <ChevronDown className="w-3 h-3 hatchin-text-muted" />}
                      <span
                        className="text-micro font-semibold"
                        style={{ color: section.color }}
                      >
                        {section.title}
                      </span>
                      <span className="text-xs hatchin-text-muted ml-auto">{section.tasks.length}</span>
                    </button>

                    {!isCollapsed && (
                      <div className="space-y-0.5 pl-1">
                        {section.tasks.map(task => {
                          const priorityColor = PRIORITY_COLORS[task.priority ?? 'medium'];
                          const isDone = task.status === 'completed';
                          return (
                            <motion.div
                              key={task.id}
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="group flex items-stretch gap-2.5 px-2 py-2 rounded-lg hover:bg-[var(--glass-hover-bg)] transition-colors cursor-default"
                            >
                              <div className="flex flex-col items-center justify-center pt-1.5 shrink-0">
                                <div
                                  className="w-1.5 h-1.5 rounded-full transition-opacity"
                                  style={{ backgroundColor: priorityColor, opacity: isDone ? 0.3 : 1 }}
                                />
                              </div>

                              <div className="flex-1 min-w-0">
                                <button
                                  onClick={() => toggleTaskStatus(task.id, task.status ?? 'todo')}
                                  className="w-full text-left"
                                >
                                  <p
                                    className="text-xs leading-snug hatchin-text"
                                    style={isDone ? { textDecoration: 'line-through', opacity: 0.5 } : undefined}
                                  >
                                    {task.title}
                                  </p>
                                </button>
                                {task.assignee && (
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <p className="text-xs font-medium hatchin-text-muted">
                                      {task.assignee}
                                    </p>
                                    <span className="text-xs text-[var(--hatchin-border-subtle)]">•</span>
                                    <p className="text-xs hatchin-text-muted opacity-70">
                                      System Generated
                                    </p>
                                  </div>
                                )}
                              </div>

                              {/* Icon button instead of the literal "del" text: same
                                  pattern as DocumentCard, always reachable on touch
                                  (hover-only controls can't be revealed by a finger). */}
                              <button
                                type="button"
                                aria-label={`Delete task: ${task.title}`}
                                onClick={() => deleteTask(task.id)}
                                className="flex items-center justify-center rounded-lg shrink-0 min-h-[44px] min-w-[44px] lg:min-h-0 lg:min-w-0 lg:w-7 lg:h-7 text-[var(--hatchin-text-muted)] hover:text-red-400 hover:bg-red-500/10 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 focus-visible:opacity-100 transition-all"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* 3. Work Outputs */}
      {projectId && (
        <div className="px-3 py-3 mt-4 border-t border-[var(--hatchin-border-subtle)] shrink-0">
          <WorkOutputSection projectId={projectId} />
        </div>
      )}
    </div>
  );
}
