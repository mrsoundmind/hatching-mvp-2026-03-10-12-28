import { useMemo, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Circle, ChevronDown, ChevronRight, Trash2, Plus, Target, User } from 'lucide-react';
import { ApprovalItem } from './ApprovalItem';
import { ApprovalsEmptyState } from './ApprovalsEmptyState';
import { TaskPipelineView } from './TaskPipelineView';
import { isApprovalExpired } from './approvalUtils';
import { useSidebarEvent } from '@/hooks/useSidebarEvent';
import { AUTONOMY_EVENTS } from '@/lib/autonomyEvents';
import { useToast } from '@/hooks/use-toast';
import type { Task } from '@shared/schema';

interface ApprovalsTabProps {
  projectId: string | undefined;
}

/**
 * Container for the full Approvals tab content + inline task board.
 *
 * Shows pending approvals at top, then the full task list grouped by
 * priority (Urgent, Active, Completed). Includes add/toggle/delete.
 */
export function ApprovalsTab({ projectId }: ApprovalsTabProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch all project tasks — same queryKey as RightSidebar for TanStack deduplication
  const { data: tasks, isLoading } = useQuery<Task[]>({
    // MUST match RightSidebar.tsx queryKey exactly — TanStack deduplication is key-format-sensitive
    queryKey: ['/api/tasks', `?projectId=${projectId}`],
    queryFn: async () => {
      const r = await fetch(`/api/tasks?projectId=${projectId}`);
      if (!r.ok) return []; // see TasksTab — shared queryKey must always cache Task[]
      return r.json();
    },
    enabled: !!projectId,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  // Invalidate task cache immediately when a new approval arrives via WS
  useSidebarEvent(AUTONOMY_EVENTS.APPROVAL_REQUIRED, () => {
    queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
  });

  // Also invalidate when a task completes (removes it from pending list)
  useSidebarEvent(AUTONOMY_EVENTS.TASK_COMPLETED, () => {
    queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
  });

  // Listen for task creation events from chat
  useSidebarEvent('tasks_updated' as any, () => {
    queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
  });

  // Derive pending approvals: tasks awaiting sign-off that haven't been actioned
  const pendingApprovals = useMemo(
    () =>
      (tasks ?? []).filter(t => {
        const meta = t.metadata as Record<string, unknown>;
        return (
          meta?.awaitingApproval === true &&
          !meta?.approvedAt &&
          !meta?.rejectedAt
        );
      }),
    [tasks]
  );

  // Sort: active approvals first, expired last
  const activeApprovals = pendingApprovals.filter(t => !isApprovalExpired(t));
  const expiredApprovals = pendingApprovals.filter(t => isApprovalExpired(t));
  const sortedApprovals = [...activeApprovals, ...expiredApprovals];

  // Task board state
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set(['completed']));
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [showAddTask, setShowAddTask] = useState(false);

  // Group tasks into sections
  const taskSections = useMemo(() => {
    const allTasks = tasks ?? [];
    // Exclude approval-pending tasks from the board (they show in the approvals section)
    const boardTasks = allTasks.filter(t => {
      const meta = t.metadata as Record<string, unknown>;
      return !(meta?.awaitingApproval === true && !meta?.approvedAt && !meta?.rejectedAt);
    });

    const urgent = boardTasks.filter(t => t.status !== 'completed' && (t.priority === 'urgent' || t.priority === 'high'));
    const active = boardTasks.filter(t => t.status !== 'completed' && t.priority !== 'urgent' && t.priority !== 'high');
    const completed = boardTasks.filter(t => t.status === 'completed');

    return [
      { id: 'urgent', title: 'Urgent', tasks: urgent, dot: 'bg-red-400' },
      { id: 'active', title: 'Active', tasks: active, dot: 'bg-blue-400' },
      { id: 'completed', title: 'Completed', tasks: completed, dot: 'bg-green-400' },
    ];
  }, [tasks]);

  const totalBoardTasks = taskSections.reduce((sum, s) => sum + s.tasks.length, 0);

  const toggleSection = useCallback((sectionId: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }, []);

  const toggleTaskStatus = useCallback(async (taskId: string, currentStatus: string) => {
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
  }, [queryClient, toast]);

  const deleteTask = useCallback(async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
        toast({ description: 'Task deleted.' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to delete task.', variant: 'destructive' });
    }
  }, [queryClient, toast]);

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

  // Full empty state: no approvals AND no tasks at all
  if (!isLoading && sortedApprovals.length === 0 && totalBoardTasks === 0) {
    return <ApprovalsEmptyState />;
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto hide-scrollbar">
      {/* Pending approvals section */}
      {sortedApprovals.length > 0 && (
        <div className="px-1 py-2">
          <p className="text-xs font-semibold hatchin-text-muted mb-2 px-1">Pending approvals</p>
          <div role="list" className="space-y-1">
            <AnimatePresence mode="popLayout">
              {sortedApprovals.map(task => (
                <ApprovalItem key={task.id} task={task} />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Task pipeline summary */}
      {tasks && tasks.length > 0 && <TaskPipelineView tasks={tasks} />}

      {/* Task board */}
      {totalBoardTasks > 0 && (
        <div className="mt-4 pt-4 border-t border-[var(--hatchin-border-subtle)]">
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="flex items-center gap-2">
              <Target className="w-3.5 h-3.5 text-blue-400" />
              <p className="text-xs font-semibold hatchin-text-muted">Tasks ({totalBoardTasks})</p>
            </div>
            <button
              onClick={() => setShowAddTask(v => !v)}
              className="text-blue-400 hover:text-blue-300 transition-colors p-1 rounded"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Inline add task */}
          {showAddTask && (
            <div className="mx-1 mb-2 p-2 rounded-lg bg-[var(--glass-frosted)] border border-[var(--glass-border)]">
              <input
                type="text"
                value={newTaskTitle}
                onChange={e => setNewTaskTitle(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') addTask();
                  if (e.key === 'Escape') { setShowAddTask(false); setNewTaskTitle(''); }
                }}
                placeholder="What needs to be done?"
                className="w-full bg-transparent border-none outline-none hatchin-text text-xs mb-1.5"
                autoFocus
              />
              <div className="flex gap-1.5">
                <button onClick={addTask} className="px-2 py-1 bg-blue-500 text-white rounded text-[10px] hover:bg-blue-600">Add</button>
                <button onClick={() => { setShowAddTask(false); setNewTaskTitle(''); }} className="px-2 py-1 bg-[var(--hatchin-surface)] hatchin-text rounded text-[10px]">Cancel</button>
              </div>
            </div>
          )}

          {/* Task sections */}
          <div className="space-y-1 px-1">
            {taskSections.map(section => {
              if (section.tasks.length === 0) return null;
              const isCollapsed = collapsedSections.has(section.id);
              return (
                <div key={section.id}>
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="flex items-center gap-2 w-full py-1 text-left"
                  >
                    {isCollapsed ? <ChevronRight className="w-3 h-3 hatchin-text-muted" /> : <ChevronDown className="w-3 h-3 hatchin-text-muted" />}
                    <span className={`w-2 h-2 rounded-full ${section.dot}`} />
                    <span className="text-xs font-medium hatchin-text">{section.title}</span>
                    <span className="text-[10px] hatchin-text-muted ml-auto">{section.tasks.length}</span>
                  </button>
                  {!isCollapsed && (
                    <div className="space-y-0.5 ml-2">
                      {section.tasks.map(task => (
                        <motion.div
                          key={task.id}
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="group flex items-start gap-2 p-1.5 rounded-md hover:bg-[var(--glass-hover-bg)] transition-colors"
                        >
                          <button
                            onClick={() => toggleTaskStatus(task.id, task.status ?? 'todo')}
                            className="mt-0.5 shrink-0"
                          >
                            {task.status === 'completed'
                              ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                              : <Circle className="w-3.5 h-3.5 hatchin-text-muted" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs hatchin-text break-words leading-snug ${task.status === 'completed' ? 'line-through opacity-60' : ''}`}>
                              {task.title}
                            </p>
                            {task.assignee && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <User className="w-2.5 h-2.5 hatchin-text-muted" />
                                <span className="text-[10px] hatchin-text-muted">{task.assignee}</span>
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => deleteTask(task.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300 p-0.5 shrink-0"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Show add task button even if no board tasks yet (but approvals exist) */}
      {totalBoardTasks === 0 && sortedApprovals.length > 0 && (
        <div className="mt-4 pt-4 border-t border-[var(--hatchin-border-subtle)] px-1">
          <button
            onClick={() => setShowAddTask(true)}
            className="flex items-center gap-2 text-xs hatchin-text-muted hover:hatchin-text transition-colors w-full py-2"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add a task</span>
          </button>
          {showAddTask && (
            <div className="mt-1 p-2 rounded-lg bg-[var(--glass-frosted)] border border-[var(--glass-border)]">
              <input
                type="text"
                value={newTaskTitle}
                onChange={e => setNewTaskTitle(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') addTask();
                  if (e.key === 'Escape') { setShowAddTask(false); setNewTaskTitle(''); }
                }}
                placeholder="What needs to be done?"
                className="w-full bg-transparent border-none outline-none hatchin-text text-xs mb-1.5"
                autoFocus
              />
              <div className="flex gap-1.5">
                <button onClick={addTask} className="px-2 py-1 bg-blue-500 text-white rounded text-[10px] hover:bg-blue-600">Add</button>
                <button onClick={() => { setShowAddTask(false); setNewTaskTitle(''); }} className="px-2 py-1 bg-[var(--hatchin-surface)] hatchin-text rounded text-[10px]">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
