import { randomUUID } from 'crypto';

export interface TaskGraphNode {
  id: string;
  title: string;
  ownerRole: string;
  dependencies: string[];
  expectedOutput: string;
  verificationStep: string;
  status: 'todo' | 'in_progress' | 'completed' | 'failed' | 'retry';
}

export interface TaskGraph {
  graphId: string;
  objective: string;
  tasks: TaskGraphNode[];
  createdAt: string;
}

const DEFAULT_ROLE_ORDER = ['Product Manager', 'Engineer', 'Designer', 'Operations'];

function inferOwnerRole(taskTitle: string): string {
  const text = taskTitle.toLowerCase();
  if (/design|ux|ui|brand|visual/.test(text)) return 'Designer';
  if (/build|api|code|bug|integration|test/.test(text)) return 'Engineer';
  if (/launch|ops|support|handoff|process/.test(text)) return 'Operations';
  return 'Product Manager';
}

export function createTaskGraph(input: {
  objective: string;
  requestedTasks?: string[];
  roleHints?: string[];
}): TaskGraph {
  const now = new Date().toISOString();
  const items = (input.requestedTasks && input.requestedTasks.length > 0)
    ? input.requestedTasks
    : [
      `Define plan for: ${input.objective}`,
      'Implement core scope and unblock dependencies',
      'Validate quality, safety, and release readiness',
      'Prepare launch and monitoring handoff',
    ];

  const tasks: TaskGraphNode[] = items.map((title, index) => {
    const role = inferOwnerRole(title);
    const previousId = index > 0 ? `task-${index}` : null;
    return {
      id: `task-${index + 1}`,
      title,
      ownerRole: input.roleHints?.[index] || role || DEFAULT_ROLE_ORDER[index % DEFAULT_ROLE_ORDER.length],
      dependencies: previousId ? [previousId] : [],
      expectedOutput: `${title} output artifact`,
      verificationStep: `Verify acceptance criteria for task ${index + 1}`,
      status: 'todo',
    };
  });

  return {
    graphId: `graph-${randomUUID()}`,
    objective: input.objective,
    tasks,
    createdAt: now,
  };
}

export function markTaskStatus(graph: TaskGraph, taskId: string, status: TaskGraphNode['status']): TaskGraph {
  return {
    ...graph,
    tasks: graph.tasks.map((task) => task.id === taskId ? { ...task, status } : task),
  };
}
