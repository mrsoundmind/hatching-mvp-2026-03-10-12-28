import React, { useState, useCallback, useEffect } from 'react';
import {
  CheckCircle2,
  Circle,
  Plus,
  User,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Trash2,
  Target,
  GripVertical
} from 'lucide-react';
import type { Task } from '@shared/schema';
import { TaskSuggestionModal } from './TaskSuggestionModal';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useToast } from '@/hooks/use-toast';

interface HierarchicalTask extends Task {
  subtasks?: HierarchicalTask[];
  isExpanded?: boolean;
}

interface TaskSection {
  id: string;
  title: string;
  tasks: HierarchicalTask[];
  collapsed: boolean;
}

interface TaskManagerProps {
  projectId: string;
  teamId?: string;
  agentId?: string;
  isConnected: boolean;
}

const TaskManager: React.FC<TaskManagerProps> = ({
  projectId,
  teamId,
  agentId,
  isConnected
}) => {
  // Task suggestion state
  const [showTaskSuggestions, setShowTaskSuggestions] = useState(false);
  const [taskSuggestions, setTaskSuggestions] = useState<any[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasNewSuggestions, setHasNewSuggestions] = useState(false);

  // Task sections state - start empty by default
  const [sections, setSections] = useState<TaskSection[]>([]);

  // Check if we should show sample data
  const shouldShowSampleData = import.meta.env.DEV &&
    (window as any).SEED_SAMPLE === 'true';
  const { toast } = useToast();

  // Sample task data - only shown when SEED_SAMPLE=true
  const sampleSections: any[] = [{

    id: 'urgent',
    title: 'Urgent Tasks',
    collapsed: false,
    tasks: [
      {
        id: 'task-1',
        title: 'Fix authentication bug',
        status: 'in_progress',
        priority: 'urgent',
        assignee: 'Backend Developer',
        dueDate: new Date('2025-08-13'),
        createdAt: new Date('2025-08-13T08:00:00Z'),
        updatedAt: new Date('2025-08-13T08:00:00Z'),
        tags: ['bug', 'auth'],
        projectId,
        teamId: teamId || null,
        parentTaskId: null,
        metadata: null,
        description: null,
        completedAt: null
      },
      {
        id: 'task-2',
        title: 'Deploy hotfix to production',
        status: 'todo',
        priority: 'urgent',
        assignee: 'Backend Developer',
        dueDate: new Date('2025-08-14'),
        createdAt: new Date('2025-08-13T10:30:00Z'),
        updatedAt: new Date('2025-08-13T10:30:00Z'),
        tags: ['deployment', 'hotfix'],
        projectId,
        teamId: teamId || null,
        parentTaskId: null,
        metadata: null,
        description: null,
        completedAt: null
      }
    ]
  },
  {
    id: 'team-tasks',
    title: 'All Team Tasks',
    collapsed: false,
    tasks: [
      {
        id: 'task-3',
        title: 'User Dashboard Design System',
        status: 'in_progress',
        priority: 'high',
        assignee: 'Product Designer',
        dueDate: new Date('2025-08-20'),
        createdAt: new Date('2025-08-10T14:00:00Z'),
        updatedAt: new Date('2025-08-12T14:00:00Z'),
        tags: ['design', 'wireframes'],
        projectId,
        teamId: teamId || null,
        parentTaskId: null,
        metadata: null,
        description: null,
        completedAt: null,
        isExpanded: true,
        subtasks: [
          {
            id: 'task-3-1',
            title: 'Create wireframes for main dashboard',
            status: 'completed',
            priority: 'high',
            assignee: 'Product Designer',
            createdAt: new Date('2025-08-10'),
            updatedAt: new Date('2025-08-11'),
            completedAt: new Date('2025-08-11'),
            tags: ['wireframes'],
            projectId,
            teamId: teamId || null,
            parentTaskId: 'task-3'
          },
          {
            id: 'task-3-2',
            title: 'Design component library',
            status: 'in_progress',
            priority: 'medium',
            assignee: 'Product Designer',
            createdAt: new Date('2025-08-11'),
            updatedAt: new Date('2025-08-12'),
            tags: ['components', 'library'],
            projectId,
            teamId: teamId || null,
            parentTaskId: 'task-3'
          },
          {
            id: 'task-3-3',
            title: 'User testing feedback integration',
            status: 'todo',
            priority: 'medium',
            assignee: 'Product Designer',
            createdAt: new Date('2025-08-12'),
            updatedAt: new Date('2025-08-12'),
            tags: ['testing', 'feedback'],
            projectId,
            teamId: teamId || null,
            parentTaskId: 'task-3'
          }
        ]
      },
      {
        id: 'task-4',
        title: 'API Development & Documentation',
        status: 'in_progress',
        priority: 'high',
        assignee: 'Backend Developer',
        dueDate: new Date('2025-08-25'),
        createdAt: new Date('2025-08-08T16:00:00Z'),
        updatedAt: new Date('2025-08-13T16:00:00Z'),
        tags: ['api', 'backend'],
        projectId,
        teamId: teamId || null,
        parentTaskId: null,
        metadata: null,
        description: null,
        completedAt: null,
        isExpanded: false,
        subtasks: [
          {
            id: 'task-4-1',
            title: 'Design RESTful API endpoints',
            status: 'completed',
            priority: 'high',
            assignee: 'Backend Developer',
            createdAt: new Date('2025-08-08'),
            updatedAt: new Date('2025-08-09'),
            completedAt: new Date('2025-08-09'),
            tags: ['api', 'design'],
            projectId,
            teamId: teamId || null,
            parentTaskId: 'task-4'
          },
          {
            id: 'task-4-2',
            title: 'Implement user management endpoints',
            status: 'in_progress',
            priority: 'high',
            assignee: 'Backend Developer',
            createdAt: new Date('2025-08-09'),
            updatedAt: new Date('2025-08-13'),
            tags: ['users', 'endpoints'],
            projectId,
            teamId: teamId || null,
            parentTaskId: 'task-4'
          },
          {
            id: 'task-4-3',
            title: 'Write comprehensive API documentation',
            status: 'todo',
            priority: 'medium',
            assignee: 'Backend Developer',
            createdAt: new Date('2025-08-12'),
            updatedAt: new Date('2025-08-12'),
            tags: ['documentation'],
            projectId,
            teamId: teamId || null,
            parentTaskId: 'task-4'
          }
        ]
      },
      {
        id: 'task-5',
        title: 'Frontend User Interface',
        status: 'todo',
        priority: 'medium',
        assignee: 'UI Engineer',
        dueDate: new Date('2025-08-30'),
        createdAt: new Date('2025-08-12T11:00:00Z'),
        updatedAt: new Date('2025-08-12T11:00:00Z'),
        tags: ['frontend', 'ui'],
        projectId,
        teamId: teamId || null,
        parentTaskId: null,
        metadata: null,
        description: null,
        completedAt: null,
        isExpanded: false,
        subtasks: [
          {
            id: 'task-5-1',
            title: 'Set up React project structure',
            status: 'completed',
            priority: 'high',
            assignee: 'UI Engineer',
            createdAt: new Date('2025-08-12'),
            updatedAt: new Date('2025-08-12'),
            completedAt: new Date('2025-08-12'),
            tags: ['setup', 'react'],
            projectId,
            teamId: teamId || null,
            parentTaskId: 'task-5'
          },
          {
            id: 'task-5-2',
            title: 'Implement user settings page',
            status: 'todo',
            priority: 'medium',
            assignee: 'UI Engineer',
            createdAt: new Date('2025-08-12'),
            updatedAt: new Date('2025-08-12'),
            tags: ['settings', 'page'],
            projectId,
            teamId: teamId || null,
            parentTaskId: 'task-5'
          },
          {
            id: 'task-5-3',
            title: 'Build responsive navigation',
            status: 'todo',
            priority: 'medium',
            assignee: 'UI Engineer',
            createdAt: new Date('2025-08-12'),
            updatedAt: new Date('2025-08-12'),
            tags: ['navigation', 'responsive'],
            projectId,
            teamId: teamId || null,
            parentTaskId: 'task-5'
          }
        ]
      }
    ]
  },
  {
    id: 'completed',
    title: 'Completed Tasks',
    collapsed: true,
    tasks: [
      {
        id: 'task-6',
        title: 'Project Setup & Infrastructure',
        status: 'completed',
        priority: 'high',
        assignee: 'Backend Developer',
        dueDate: new Date('2025-08-10'),
        createdAt: new Date('2025-08-05T09:00:00Z'),
        updatedAt: new Date('2025-08-08T17:00:00Z'),
        completedAt: new Date('2025-08-08T17:00:00Z'),
        tags: ['setup', 'infrastructure'],
        projectId,
        teamId: teamId || null,
        parentTaskId: null,
        description: null,
        isExpanded: false,
        subtasks: [
          {
            id: 'task-6-1',
            title: 'Set up development environment',
            status: 'completed',
            priority: 'high',
            assignee: 'Backend Developer',
            createdAt: new Date('2025-08-05'),
            updatedAt: new Date('2025-08-06'),
            completedAt: new Date('2025-08-06'),
            tags: ['environment'],
            projectId,
            teamId: teamId || null,
            parentTaskId: 'task-6'
          },
          {
            id: 'task-6-2',
            title: 'Configure monitoring dashboard',
            status: 'completed',
            priority: 'medium',
            assignee: 'Backend Developer',
            createdAt: new Date('2025-08-07'),
            updatedAt: new Date('2025-08-08'),
            completedAt: new Date('2025-08-08'),
            tags: ['monitoring'],
            projectId,
            teamId: teamId || null,
            parentTaskId: 'task-6'
          }
        ]
      }
    ]
  }
  ] as unknown as HierarchicalTask[];

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [dragOverSection, setDragOverSection] = useState<string | null>(null);

  // Initialize sections with sample data only when SEED_SAMPLE=true
  useEffect(() => {
    if (shouldShowSampleData) {
      setSections(sampleSections);
    }
  }, [shouldShowSampleData]);

  // Fetch tasks from backend and map into sections
  const refreshTasks = useCallback(async () => {
    if (!projectId) return;
    try {
      const [tasksRes, agentsRes] = await Promise.all([
        fetch(`/api/tasks?projectId=${projectId}`),
        fetch(`/api/projects/${projectId}/agents`)
      ]);

      if (!tasksRes.ok) return;
      const tasks = await tasksRes.json();
      const agents = agentsRes.ok ? await agentsRes.json() : [];

      const mapped: HierarchicalTask[] = (tasks || []).map((t: any) => {
        // Find human-readable name from agents list, otherwise fallback to original value
        const mappedAgent = agents.find((a: any) => a.id === t.assigneeId);

        return {
          id: t.id,
          title: t.title,
          status: t.status || 'todo',
          priority: (t.priority || 'medium').toLowerCase(),
          assignee: mappedAgent ? mappedAgent.name : t.assigneeId,
          createdAt: new Date(t.createdAt),
          updatedAt: new Date(t.updatedAt),
          projectId: t.projectId,
          teamId: teamId || null,
          parentTaskId: null,
          metadata: null,
          description: null,
          completedAt: null,
          isExpanded: false,
          subtasks: []
        };
      });

      const urgent = mapped.filter(t => t.status !== 'completed' && t.priority === 'high');
      const normal = mapped.filter(t => t.status !== 'completed' && t.priority !== 'high');
      const completed = mapped.filter(t => t.status === 'completed');

      setSections([
        { id: 'urgent', title: 'Urgent Tasks', collapsed: false, tasks: urgent },
        { id: 'team-tasks', title: 'All Team Tasks', collapsed: false, tasks: normal },
        { id: 'completed', title: 'Completed Tasks', collapsed: true, tasks: completed }
      ]);
    } catch (e) {
      console.warn('Failed to refresh tasks');
    }
  }, [projectId, teamId]);

  useEffect(() => {
    refreshTasks();
  }, [refreshTasks]);

  // Listen for tasks_updated events from chat and server broadcasts
  useEffect(() => {
    const handler = (e: any) => {
      if (!e?.detail?.projectId || e.detail.projectId === projectId) {
        refreshTasks();
      }
    };
    window.addEventListener('tasks_updated', handler as any);
    return () => window.removeEventListener('tasks_updated', handler as any);
  }, [projectId, refreshTasks]);

  const toggleSection = useCallback((sectionId: string) => {
    setSections(prev => prev.map(section =>
      section.id === sectionId
        ? { ...section, collapsed: !section.collapsed }
        : section
    ));
  }, []);

  const toggleTaskStatus = useCallback(async (taskId: string) => {
    // Find task locally
    let taskToToggle = null;
    sections.forEach(s => {
      s.tasks.forEach(t => { if (t.id === taskId) taskToToggle = t; });
    });
    if (!taskToToggle) return;

    const newStatus = (taskToToggle as any).status === 'completed' ? 'todo' : 'completed';
    const newCompletedAt = newStatus === 'completed' ? new Date().toISOString() : null;

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, completedAt: newCompletedAt })
      });
      if (res.ok) {
        refreshTasks();
      } else {
        toast({ title: 'Error', description: 'Failed to update task status.', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to update task status.', variant: 'destructive' });
    }
  }, [sections, refreshTasks, toast]);

  const toggleTaskExpansion = useCallback((taskId: string) => {
    const updateTaskRecursively = (tasks: HierarchicalTask[]): HierarchicalTask[] => {
      return tasks.map(task => {
        if (task.id === taskId) {
          return {
            ...task,
            isExpanded: !task.isExpanded
          };
        }
        if (task.subtasks) {
          return {
            ...task,
            subtasks: updateTaskRecursively(task.subtasks)
          };
        }
        return task;
      });
    };

    setSections(prev => prev.map(section => ({
      ...section,
      tasks: updateTaskRecursively(section.tasks)
    })));
  }, []);

  const deleteTask = useCallback(async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        refreshTasks();
        toast({ title: 'Success', description: 'Task deleted.' });
      } else {
        toast({ title: 'Error', description: 'Failed to delete task.', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to delete task.', variant: 'destructive' });
    }
  }, [refreshTasks, toast]);

  // Task suggestion functions
  const analyzeConversationForTasks = useCallback(async () => {
    setIsAnalyzing(true);
    try {
      // Get current conversation ID (you'll need to implement this based on your chat system)
      const conversationId = `project:${projectId}`; // This should be the actual conversation ID

      const response = await fetch('/api/task-suggestions/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId,
          projectId,
          teamId,
          agentId
        })
      });

      const data = await response.json();

      if (data.suggestions && data.suggestions.length > 0) {
        setTaskSuggestions(data.suggestions);
        setShowTaskSuggestions(true);
        setHasNewSuggestions(true);
      } else {
        // Show a message that no tasks were suggested
        toast({ description: 'No actionable tasks found in recent conversation. Try discussing specific features or improvements!' });
      }
    } catch (error) {
      console.error('Error analyzing conversation for tasks:', error);
      toast({ title: 'Error', description: 'Failed to analyze conversation for tasks. Please try again.', variant: 'destructive' });
    } finally {
      setIsAnalyzing(false);
    }
  }, [projectId, teamId, agentId]);

  const handleApproveTasks = useCallback(async (approvedTasks: any[]) => {
    try {
      const response = await fetch('/api/task-suggestions/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          approvedTasks,
          projectId
        })
      });

      const data = await response.json();

      if (data.success) {
        // Add the approved tasks to the appropriate section
        const newTasks = data.createdTasks.map((task: any) => ({
          id: task.id,
          title: task.title,
          status: 'todo',
          priority: task.priority.toLowerCase(),
          assignee: task.assigneeId, // You might need to map this to the actual assignee name
          createdAt: new Date(task.createdAt),
          updatedAt: new Date(task.updatedAt),
          projectId: task.projectId,
          teamId: teamId || null,
          parentTaskId: null,
          metadata: null,
          description: null,
          completedAt: null
        }));

        // Add to the appropriate section based on priority
        setSections(prev => prev.map(section => {
          if (section.id === 'urgent' && newTasks.some((task: any) => task.priority === 'high')) {
            return {
              ...section,
              tasks: [...section.tasks, ...newTasks.filter((task: any) => task.priority === 'high')]
            };
          } else if (section.id === 'team-tasks') {
            return {
              ...section,
              tasks: [...section.tasks, ...newTasks.filter((task: any) => task.priority !== 'high')]
            };
          }
          return section;
        }));

        setHasNewSuggestions(false);
        refreshTasks();
        toast({ title: 'Success', description: `Successfully created ${data.createdTasks.length} tasks!` });
      }
    } catch (error) {
      console.error('Error creating approved tasks:', error);
      toast({ title: 'Error', description: 'Failed to create approved tasks. Please try again.', variant: 'destructive' });
    }
  }, [projectId, teamId, refreshTasks, toast]);

  const handleRejectAll = useCallback(() => {
    setTaskSuggestions([]);
    setHasNewSuggestions(false);
  }, []);

  const addNewTask = useCallback(async () => {
    if (!newTaskTitle.trim()) return;

    // Smart assignment based on task content
    const getSmartAssignee = (title: string) => {
      const lowerTitle = title.toLowerCase();
      if (lowerTitle.includes('design') || lowerTitle.includes('wireframe') || lowerTitle.includes('ui')) {
        return 'Product Designer';
      } else if (lowerTitle.includes('backend') || lowerTitle.includes('api') || lowerTitle.includes('database')) {
        return 'Backend Developer';
      } else if (lowerTitle.includes('frontend') || lowerTitle.includes('component') || lowerTitle.includes('interface')) {
        return 'UI Engineer';
      } else if (lowerTitle.includes('test') || lowerTitle.includes('qa') || lowerTitle.includes('bug')) {
        return 'QA Lead';
      } else if (lowerTitle.includes('product') || lowerTitle.includes('feature') || lowerTitle.includes('requirement')) {
        return 'Product Manager';
      }
      return 'Backend Developer'; // Default fallback
    };

    const newTask = {
      title: newTaskTitle,
      status: 'todo',
      priority: 'medium',
      tags: [],
      projectId,
      teamId: teamId || null,
      assignee: getSmartAssignee(newTaskTitle)
    };

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTask)
      });
      if (res.ok) {
        refreshTasks();
        setNewTaskTitle('');
        setShowNewTaskForm(false);
        toast({ title: 'Success', description: 'Task added.' });
      } else {
        toast({ title: 'Error', description: 'Failed to add task.', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to add task.', variant: 'destructive' });
    }
  }, [newTaskTitle, projectId, teamId, refreshTasks, toast]);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTask(taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, sectionId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverSection(sectionId);
  };

  const handleDragLeave = () => {
    setDragOverSection(null);
  };

  const handleDrop = useCallback(async (e: React.DragEvent, targetSectionId: string) => {
    e.preventDefault();
    setDragOverSection(null);

    if (!draggedTask) return;

    const updates: Record<string, string> = {};
    if (targetSectionId === 'completed') {
      updates.status = 'completed';
    } else {
      updates.status = 'in_progress';
      updates.priority = targetSectionId === 'urgent' ? 'high' : 'medium';
    }

    try {
      const res = await fetch(`/api/tasks/${draggedTask}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        refreshTasks();
      }
    } catch (err) {
      console.error('Drag drop update failed');
      toast({ title: 'Error', description: 'Failed to move task.', variant: 'destructive' });
    }

    setDraggedTask(null);
  }, [draggedTask, refreshTasks, toast]);

  const getStatusIcon = (status: Task['status']) => {
    if (status === 'completed') {
      return <CheckCircle2 className="w-4 h-4 text-green-400" />;
    }

    return <Circle className="w-4 h-4 hatchin-text-muted" />;
  };

  // Recursive function to render tasks with subtasks
  const renderTask = (task: HierarchicalTask, level: number = 0, sectionId: string) => {
    const hasSubtasks = task.subtasks && task.subtasks.length > 0;
    const indent = level > 0 ? `ml-${level * 6}` : '';

    return (
      <div key={task.id} className={`${indent} ${level > 0 ? 'border-l border-gray-600 pl-4' : ''}`}>
        <div
          draggable={sectionId !== 'completed'}
          onDragStart={(e) => handleDragStart(e, task.id)}
          className="group rounded-lg p-3 hover:bg-gray-800/60 transition-all cursor-move bg-[#33373d] mb-2"
          data-testid={`task-${task.id}`}
        >
          <div className="flex items-start gap-3">
            <div className="flex items-center gap-2">
              {sectionId !== 'completed' && level === 0 && (
                <GripVertical className="w-4 h-4 hatchin-text-muted opacity-50" />
              )}

              {hasSubtasks && (
                <button
                  onClick={() => toggleTaskExpansion(task.id)}
                  className="hover:scale-110 transition-transform"
                  data-testid={`expand-task-${task.id}`}
                >
                  {task.isExpanded ? (
                    <ChevronDown className="w-4 h-4 hatchin-text-muted" />
                  ) : (
                    <ChevronRight className="w-4 h-4 hatchin-text-muted" />
                  )}
                </button>
              )}

              <button
                onClick={() => toggleTaskStatus(task.id)}
                className="hover:scale-110 transition-transform"
                data-testid={`toggle-task-${task.id}`}
              >
                {getStatusIcon(task.status)}
              </button>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="font-medium hatchin-text break-words flex-1 mr-3 text-[12px]">
                  {task.title}
                </h4>

                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="text-red-400 hover:text-red-300 transition-colors p-1"
                    data-testid={`delete-task-${task.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {task.assignee && (
                <div className="flex items-center gap-2 mt-2">
                  <User className="w-3 h-3 hatchin-text-muted" />
                  <span className="text-xs hatchin-text-muted">{task.assignee}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Render subtasks if expanded */}
        {hasSubtasks && task.isExpanded && (
          <div className="mt-2 space-y-1">
            {task.subtasks!.map((subtask) => renderTask(subtask, level + 1, sectionId))}
          </div>
        )}
      </div>
    );
  };



  const countTasksRecursively = (tasks: HierarchicalTask[]): { total: number; completed: number } => {
    let total = 0;
    let completed = 0;

    tasks.forEach(task => {
      total++;
      if (task.status === 'completed') {
        completed++;
      }

      if (task.subtasks && task.subtasks.length > 0) {
        const subCounts = countTasksRecursively(task.subtasks);
        total += subCounts.total;
        completed += subCounts.completed;
      }
    });

    return { total, completed };
  };

  const getTotalTasks = () => {
    return sections.reduce((total, section) => {
      const sectionCounts = countTasksRecursively(section.tasks);
      return total + sectionCounts.total;
    }, 0);
  };

  const getCompletedTasks = () => {
    return sections.reduce((total, section) => {
      const sectionCounts = countTasksRecursively(section.tasks);
      return total + sectionCounts.completed;
    }, 0);
  };



  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mt-[-5px] mb-[-5px]">
        <div className="flex items-center gap-3">
          <Target className="w-5 h-5 text-blue-400" />
          <h3 className="font-semibold hatchin-text text-[12px]">Task Manager</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewTaskForm(true)}
            className="text-blue-400 hover:text-blue-300 transition-colors p-2 hover:bg-blue-400/10 rounded-lg"
            data-testid="button-add-task"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* New Task Form */}
      {showNewTaskForm && (
        <div className="mb-4 p-3 bg-gray-800/30 rounded-lg border border-gray-700">
          <input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="What needs to be done?"
            className="w-full bg-transparent border-none outline-none hatchin-text text-sm mb-2"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                addNewTask();
              }
              if (e.key === 'Escape') {
                setShowNewTaskForm(false);
                setNewTaskTitle('');
              }
            }}
            autoFocus
            data-testid="input-new-task"
          />
          <div className="flex gap-2">
            <button
              onClick={addNewTask}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors"
              data-testid="button-save-task"
            >
              Add Task
            </button>
            <button
              onClick={() => {
                setShowNewTaskForm(false);
                setNewTaskTitle('');
              }}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-700 transition-colors"
              data-testid="button-cancel-task"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {/* Global Empty State — shown when NO tasks exist anywhere */}
      {sections.every(s => s.tasks.length === 0) && !showNewTaskForm && (
        <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#6C82FF]/15 flex items-center justify-center mb-4">
            <Target className="w-6 h-6 text-[#6C82FF]" />
          </div>
          <h3 className="font-semibold hatchin-text text-sm mb-1">No tasks yet</h3>
          <p className="text-xs hatchin-text-muted max-w-[200px] mb-4 leading-relaxed">
            Ask Maya to outline a project and watch this board fill up automatically.
          </p>
          <button
            className="text-xs px-3 py-1.5 bg-[#6C82FF]/20 text-[#6C82FF] rounded-full hover:bg-[#6C82FF]/30 transition-colors border border-[#6C82FF]/30"
            onClick={() => {
              const event = new CustomEvent('hatchin:suggest-task-chat');
              window.dispatchEvent(event);
            }}
          >
            ⚡ Ask Maya to plan your first sprint
          </button>
        </div>
      )}

      {/* Task Sections */}
      <div className="space-y-2">
        {sections.map((section) => (
          <div key={section.id} className="space-y-2">
            <div
              className="flex items-center justify-between cursor-pointer group py-1"
              onClick={() => toggleSection(section.id)}
              data-testid={`section-${section.id}`}
            >
              <div className="flex items-center gap-3">
                {section.collapsed ? (
                  <ChevronRight className="w-4 h-4 hatchin-text-muted" />
                ) : (
                  <ChevronDown className="w-4 h-4 hatchin-text-muted" />
                )}
                <span className="font-medium hatchin-text text-[12px]">{section.title}</span>
                <span className="text-sm hatchin-text-muted bg-gray-700 px-2 py-1 rounded-full">
                  {section.tasks.length}
                </span>
              </div>
            </div>

            {!section.collapsed && (
              <div
                className={`space-y-2 min-h-[40px] rounded-lg transition-all ${dragOverSection === section.id ? 'bg-blue-500/10 border-2 border-blue-400/50' : ''
                  }`}
                onDragOver={(e) => handleDragOver(e, section.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, section.id)}
              >
                {section.tasks.map((task) => renderTask(task, 0, section.id))}

                {section.tasks.length === 0 && (
                  <div className="text-center py-3">
                    <p className="text-xs hatchin-text-muted opacity-60">
                      {dragOverSection === section.id ? '📥 Drop task here' : 'No tasks in this section'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Task Suggestion Modal */}
      <TaskSuggestionModal
        isOpen={showTaskSuggestions}
        onClose={() => setShowTaskSuggestions(false)}
        suggestions={taskSuggestions}
        onApproveTasks={handleApproveTasks}
        onRejectAll={handleRejectAll}
      />
    </>
  );
};

export default TaskManager;