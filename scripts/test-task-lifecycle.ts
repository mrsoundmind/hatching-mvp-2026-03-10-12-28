/**
 * Tests for taskLifecycle.ts — Task lifecycle command execution.
 */

import {
  executeLifecycleCommand,
  formatTaskList,
  formatProgressSummary,
  fuzzyMatchTask,
  type LifecycleContext,
} from '../server/ai/tasks/taskLifecycle.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}`);
    failed++;
  }
}

// ── Mock data ──────────────────────────────────────────────────────────

const mockTasks = [
  { id: '1', title: 'Fix login redirect bug', status: 'in_progress', priority: 'high', assignee: 'Jordan', dueDate: null },
  { id: '2', title: 'Design user dashboard', status: 'todo', priority: 'medium', assignee: 'Mira', dueDate: null },
  { id: '3', title: 'Implement API rate limiting', status: 'todo', priority: 'urgent', assignee: 'Jordan', dueDate: null },
  { id: '4', title: 'Login page redesign', status: 'blocked', priority: 'medium', assignee: 'Mira', dueDate: null },
  { id: '5', title: 'Write unit tests', status: 'completed', priority: 'low', assignee: 'Jordan', dueDate: null },
];

const agents = [
  { id: 'a1', name: 'Jordan', role: 'Backend Developer' },
  { id: 'a2', name: 'Mira', role: 'Product Designer' },
  { id: 'a3', name: 'Alex', role: 'Product Manager' },
];

console.log('\n🧪 Task Lifecycle Tests\n');

// ── fuzzyMatchTask ──────────────────────────────────────────────────────
console.log('── fuzzyMatchTask ──');
{
  const result = fuzzyMatchTask('login redirect', mockTasks);
  assert(result.length === 1, '"login redirect" → 1 match');
  assert(result[0].id === '1', 'matches Fix login redirect bug');
}
{
  const result = fuzzyMatchTask('login', mockTasks);
  assert(result.length === 2, '"login" → 2 matches (ambiguous)');
}
{
  const result = fuzzyMatchTask('dashboard', mockTasks);
  assert(result.length === 1, '"dashboard" → 1 match');
  assert(result[0].id === '2', 'matches Design user dashboard');
}
{
  const result = fuzzyMatchTask('nonexistent xyz', mockTasks);
  assert(result.length === 0, '"nonexistent xyz" → 0 matches');
}

// ── executeLifecycleCommand: status_update ──────────────────────────────
console.log('\n── status_update ──');
{
  const ctx: LifecycleContext = {
    projectTasks: [...mockTasks],
    agents,
    updateTask: async (id, updates) => ({ ...mockTasks.find(t => t.id === id)!, ...updates }),
    deleteTask: async () => {},
  };
  const result = await executeLifecycleCommand(
    { type: 'TASK_LIFECYCLE_COMMAND', command: 'status_update', taskHint: 'login redirect', newStatus: 'done' },
    ctx
  );
  assert(result.success, 'status update succeeds');
  assert(result.action === 'status_update', 'action = status_update');
  assert(result.task?.id === '1', 'updated correct task');
}

// ── executeLifecycleCommand: status_update ambiguous ─────────────────────
console.log('\n── status_update (ambiguous) ──');
{
  const ctx: LifecycleContext = {
    projectTasks: [...mockTasks],
    agents,
    updateTask: async (id, updates) => ({ ...mockTasks.find(t => t.id === id)!, ...updates }),
    deleteTask: async () => {},
  };
  const result = await executeLifecycleCommand(
    { type: 'TASK_LIFECYCLE_COMMAND', command: 'status_update', taskHint: 'login', newStatus: 'done' },
    ctx
  );
  assert(!result.success, 'ambiguous match → not successful');
  assert(result.ambiguousMatches!.length === 2, 'returns 2 ambiguous matches');
}

// ── executeLifecycleCommand: priority_update ─────────────────────────────
console.log('\n── priority_update ──');
{
  const ctx: LifecycleContext = {
    projectTasks: [...mockTasks],
    agents,
    updateTask: async (id, updates) => ({ ...mockTasks.find(t => t.id === id)!, ...updates }),
    deleteTask: async () => {},
  };
  const result = await executeLifecycleCommand(
    { type: 'TASK_LIFECYCLE_COMMAND', command: 'priority_update', taskHint: 'API rate', newPriority: 'high' },
    ctx
  );
  assert(result.success, 'priority update succeeds');
  assert(result.action === 'priority_update', 'action = priority_update');
}

// ── executeLifecycleCommand: assignee_update ─────────────────────────────
console.log('\n── assignee_update ──');
{
  const ctx: LifecycleContext = {
    projectTasks: [...mockTasks],
    agents,
    updateTask: async (id, updates) => ({ ...mockTasks.find(t => t.id === id)!, ...updates }),
    deleteTask: async () => {},
  };
  const result = await executeLifecycleCommand(
    { type: 'TASK_LIFECYCLE_COMMAND', command: 'assignee_update', taskHint: 'API rate', newAssignee: 'Mira' },
    ctx
  );
  assert(result.success, 'assignee update succeeds');
  assert(result.action === 'assignee_update', 'action = assignee_update');
}

// ── executeLifecycleCommand: delete ──────────────────────────────────────
console.log('\n── delete (soft) ──');
{
  const ctx: LifecycleContext = {
    projectTasks: [...mockTasks],
    agents,
    updateTask: async (id, updates) => ({ ...mockTasks.find(t => t.id === id)!, ...updates }),
    deleteTask: async () => {},
  };
  const result = await executeLifecycleCommand(
    { type: 'TASK_LIFECYCLE_COMMAND', command: 'delete', taskHint: 'dashboard' },
    ctx
  );
  assert(result.success, 'delete succeeds');
  assert(result.action === 'delete', 'action = delete');
}

// ── executeLifecycleCommand: query ───────────────────────────────────────
console.log('\n── query ──');
{
  const ctx: LifecycleContext = {
    projectTasks: [...mockTasks],
    agents,
    updateTask: async (id, updates) => ({ ...mockTasks.find(t => t.id === id)!, ...updates }),
    deleteTask: async () => {},
  };
  const result = await executeLifecycleCommand(
    { type: 'TASK_LIFECYCLE_COMMAND', command: 'query' },
    ctx
  );
  assert(result.success, 'query succeeds');
  assert(result.action === 'query', 'action = query');
  assert(typeof result.message === 'string' && result.message.length > 0, 'returns non-empty message');
}

// ── executeLifecycleCommand: filtered_query ──────────────────────────────
console.log('\n── filtered_query ──');
{
  const ctx: LifecycleContext = {
    projectTasks: [...mockTasks],
    agents,
    updateTask: async (id, updates) => ({ ...mockTasks.find(t => t.id === id)!, ...updates }),
    deleteTask: async () => {},
  };
  const result = await executeLifecycleCommand(
    { type: 'TASK_LIFECYCLE_COMMAND', command: 'filtered_query', filters: { assignee: 'jordan' } },
    ctx
  );
  assert(result.success, 'filtered query succeeds');
  assert(result.action === 'filtered_query', 'action = filtered_query');
  assert(typeof result.message === 'string' && result.message.includes('Jordan'), 'message mentions Jordan');
}
{
  const ctx: LifecycleContext = {
    projectTasks: [...mockTasks],
    agents,
    updateTask: async (id, updates) => ({ ...mockTasks.find(t => t.id === id)!, ...updates }),
    deleteTask: async () => {},
  };
  const result = await executeLifecycleCommand(
    { type: 'TASK_LIFECYCLE_COMMAND', command: 'filtered_query', filters: { status: 'blocked' } },
    ctx
  );
  assert(result.success, 'filtered by status succeeds');
  assert(typeof result.message === 'string' && result.message.toLowerCase().includes('login page'), 'finds blocked task');
}

// ── executeLifecycleCommand: progress ────────────────────────────────────
console.log('\n── progress ──');
{
  const ctx: LifecycleContext = {
    projectTasks: [...mockTasks],
    agents,
    updateTask: async (id, updates) => ({ ...mockTasks.find(t => t.id === id)!, ...updates }),
    deleteTask: async () => {},
  };
  const result = await executeLifecycleCommand(
    { type: 'TASK_LIFECYCLE_COMMAND', command: 'progress' },
    ctx
  );
  assert(result.success, 'progress succeeds');
  assert(result.action === 'progress', 'action = progress');
  assert(typeof result.message === 'string' && result.message.includes('20%'), 'shows completion percentage (1/5 = 20%)');
}

// ── executeLifecycleCommand: no match ────────────────────────────────────
console.log('\n── no match ──');
{
  const ctx: LifecycleContext = {
    projectTasks: [...mockTasks],
    agents,
    updateTask: async (id, updates) => ({ ...mockTasks.find(t => t.id === id)!, ...updates }),
    deleteTask: async () => {},
  };
  const result = await executeLifecycleCommand(
    { type: 'TASK_LIFECYCLE_COMMAND', command: 'status_update', taskHint: 'foobar nonexistent', newStatus: 'done' },
    ctx
  );
  assert(!result.success, 'no match → not successful');
  assert(typeof result.message === 'string' && result.message.includes("couldn't find"), 'returns helpful message');
}

// ── formatTaskList ───────────────────────────────────────────────────────
console.log('\n── formatTaskList ──');
{
  const formatted = formatTaskList(mockTasks.filter(t => t.status !== 'completed'));
  assert(typeof formatted === 'string', 'returns string');
  assert(formatted.includes('login redirect'), 'includes task titles');
  assert(formatted.includes('HIGH'), 'includes priority');
}

// ── formatProgressSummary ────────────────────────────────────────────────
console.log('\n── formatProgressSummary ──');
{
  const summary = formatProgressSummary(mockTasks);
  assert(typeof summary === 'string', 'returns string');
  assert(summary.includes('20%'), 'includes completion percentage');
  assert(summary.includes('5'), 'includes total count');
}

console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
