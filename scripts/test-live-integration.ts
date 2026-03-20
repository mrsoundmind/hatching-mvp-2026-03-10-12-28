import { classifyTaskIntent, type ClassifierContext } from '../server/ai/tasks/intentClassifier.js';
import { extractDueDate, extractPriority, checkRateLimit } from '../server/ai/tasks/taskCreator.js';
import { checkForDuplicate } from '../server/ai/tasks/duplicateDetector.js';
import { executeLifecycleCommand, type LifecycleContext } from '../server/ai/tasks/taskLifecycle.js';
import { detectCompletionSignal } from '../server/ai/tasks/completionDetector.js';
import { resolveAutonomyTrigger } from '../server/autonomy/triggers/autonomyTriggerResolver.js';
import { HandoffTracker } from '../server/ai/expertiseMatching.js';

let pass = 0, fail = 0;
function ok(cond: boolean, name: string) { 
  if (cond) { pass++; console.log('  ✅', name); } 
  else { fail++; console.log('  ❌', name); }
}

async function main() {
  const agents = [{ id: '1', name: 'Jordan', role: 'Engineer' }, { id: '2', name: 'Mira', role: 'Designer' }];
  const ctx = (depth: number): ClassifierContext => ({ availableAgents: agents, conversationDepth: depth });

  console.log('\n=== 1. False Positive Prevention ===');
  ok(classifyTaskIntent('hey', ctx(1)).type === 'NO_TASK_INTENT', '"hey" → no task');
  ok(classifyTaskIntent('hello!', ctx(1)).type === 'NO_TASK_INTENT', '"hello!" → no task');
  ok(classifyTaskIntent('thanks', ctx(2)).type === 'NO_TASK_INTENT', '"thanks" → no task');
  ok(classifyTaskIntent('lol', ctx(1)).type === 'NO_TASK_INTENT', '"lol" → no task');
  ok(classifyTaskIntent('what do you think?', ctx(2)).type === 'NO_TASK_INTENT', 'question → no task');
  ok(classifyTaskIntent('sounds good', ctx(2)).type === 'NO_TASK_INTENT', '"sounds good" → no task');
  ok(classifyTaskIntent('ok', ctx(1)).type === 'NO_TASK_INTENT', '"ok" → no task');
  ok(classifyTaskIntent('yo whats up', ctx(1)).type === 'NO_TASK_INTENT', '"yo whats up" → no task');

  console.log('\n=== 2. Task Creation ===');
  ok(classifyTaskIntent('create a task to fix the login bug', ctx(2)).type === 'EXPLICIT_TASK_REQUEST', 'explicit create');
  ok(classifyTaskIntent('task: implement dark mode', ctx(1)).type === 'EXPLICIT_TASK_REQUEST', '"task:" prefix');
  ok(classifyTaskIntent('@Jordan handle the API work', ctx(2)).type === 'USER_DELEGATION', '@mention delegation');
  ok(classifyTaskIntent('let the designer handle it', ctx(2)).type === 'USER_DELEGATION', 'role delegation');

  console.log('\n=== 3. Lifecycle Commands ===');
  ok(classifyTaskIntent('mark login bug as done', ctx(2)).type === 'TASK_LIFECYCLE_COMMAND', 'mark done');
  ok(classifyTaskIntent('what tasks do we have?', ctx(2)).type === 'TASK_LIFECYCLE_COMMAND', 'query');
  ok(classifyTaskIntent('delete the old task', ctx(2)).type === 'TASK_LIFECYCLE_COMMAND', 'delete');
  ok(classifyTaskIntent("how's the project going?", ctx(3)).type === 'TASK_LIFECYCLE_COMMAND', 'progress');

  console.log('\n=== 4. Due Date & Priority ===');
  ok(extractDueDate('fix this by tomorrow') !== null, '"by tomorrow"');
  ok(extractDueDate('finish by next week') !== null, '"by next week"');
  ok(extractDueDate('in 3 days') !== null, '"in 3 days"');
  ok(extractDueDate('just do it') === null, 'no date → null');
  ok(extractPriority('this is urgent!') === 'urgent', 'urgent');
  ok(extractPriority('high priority') === 'high', 'high');
  ok(extractPriority('nice to have') === 'low', 'low');
  ok(extractPriority('fix the bug') === undefined, 'no priority');

  console.log('\n=== 5. Duplicate Detection ===');
  const tasks: any[] = [
    { id: '1', title: 'Fix login redirect bug', status: 'todo' },
    { id: '2', title: 'Design user dashboard', status: 'in_progress' },
    { id: '3', title: 'Old task', status: 'completed' },
  ];
  ok(checkForDuplicate('Fix login redirect bug', tasks).isDuplicate, 'exact → dup');
  ok(checkForDuplicate('fix the login redirect', tasks).isDuplicate, 'near → dup');
  ok(!checkForDuplicate('Implement payments', tasks).isDuplicate, 'different → no dup');
  ok(!checkForDuplicate('Old task', tasks).isDuplicate, 'completed → skip');

  console.log('\n=== 6. Lifecycle Execution ===');
  const mockTasks = [
    { id: 't1', title: 'Fix login redirect bug', status: 'todo', priority: 'high', assignee: 'Jordan' },
    { id: 't2', title: 'Design user dashboard', status: 'in_progress', priority: 'medium', assignee: 'Mira' },
    { id: 't3', title: 'Write API tests', status: 'blocked', priority: 'low', assignee: 'Jordan' },
  ];
  const lcCtx: LifecycleContext = {
    projectTasks: [...mockTasks],
    agents,
    updateTask: async (id, updates) => { const t = mockTasks.find(x => x.id === id); if (t) Object.assign(t, updates); return t; },
    deleteTask: async (id) => { const t = mockTasks.find(x => x.id === id); if (t) t.status = 'completed'; },
  };

  const statusIntent = classifyTaskIntent('mark login redirect as done', ctx(2));
  if (statusIntent.type === 'TASK_LIFECYCLE_COMMAND') {
    const r = await executeLifecycleCommand(statusIntent, lcCtx);
    ok(r.success, 'mark done → success');
    ok(mockTasks[0].status === 'completed', 'status actually changed');
  }

  const queryIntent = classifyTaskIntent('what tasks do we have?', ctx(2));
  if (queryIntent.type === 'TASK_LIFECYCLE_COMMAND') {
    const r = await executeLifecycleCommand(queryIntent, lcCtx);
    ok(r.success && r.message.length > 10, 'query → returns list');
  }

  const progressIntent = classifyTaskIntent("how's the project going?", ctx(3));
  if (progressIntent.type === 'TASK_LIFECYCLE_COMMAND') {
    const r = await executeLifecycleCommand(progressIntent, lcCtx);
    ok(r.success && r.message.includes('%'), 'progress → percentage');
  }

  console.log('\n=== 7. Completion Detection ===');
  ok(detectCompletionSignal("I've finished the login fix.").detected, '"finished" → detected');
  ok(detectCompletionSignal("I've finished the login fix.").taskHint?.includes('login') ?? false, 'extracts "login"');
  ok(detectCompletionSignal('The dashboard is done.').detected, '"is done" → detected');
  ok(!detectCompletionSignal('Let me think about this.').detected, 'thinking → no');
  ok(!detectCompletionSignal('I can help with that.').detected, 'generic → no');

  console.log('\n=== 8. Rate Limiting ===');
  const u = 'rl-' + Date.now();
  for (let i = 0; i < 10; i++) checkRateLimit(u);
  ok(!checkRateLimit(u).allowed, '11th blocked');

  console.log('\n=== 9. Inactivity Trigger ===');
  ok(resolveAutonomyTrigger({ autonomyEnabled: true, lastUserActivityAt: new Date(Date.now() - 3*3600000), pendingTasks: [{ id: 't1', status: 'todo' }] }).shouldExecute, '3h → triggers');
  ok(resolveAutonomyTrigger({ autonomyEnabled: true, lastUserActivityAt: new Date(Date.now() - 3*3600000), pendingTasks: [{ id: 't1', status: 'todo' }] }).tasksToExecute.length === 1, '1 task limit');
  ok(!resolveAutonomyTrigger({ autonomyEnabled: true, lastUserActivityAt: new Date(Date.now() - 1800000), pendingTasks: [{ id: 't1', status: 'todo' }] }).shouldExecute, '30min → no');
  ok(!resolveAutonomyTrigger({ autonomyEnabled: false, lastUserActivityAt: new Date(Date.now() - 5*3600000), pendingTasks: [{ id: 't1', status: 'todo' }] }).shouldExecute, 'off → no');

  console.log('\n=== 10. Explicit Trigger ===');
  const trig = resolveAutonomyTrigger({ userMessage: 'go ahead', autonomyEnabled: true, lastUserActivityAt: new Date(), pendingTasks: [{ id: 't1', status: 'todo' }, { id: 't2', status: 'todo' }] });
  ok(trig.shouldExecute && trig.reason === 'explicit', '"go ahead" → explicit');
  ok(trig.tasksToExecute.length === 2, 'all todos queued');

  console.log('\n=== 11. Cycle Detection ===');
  const tracker = new HandoffTracker();
  const aA: any = { id: 'a', name: 'A', role: 'PM' };
  const aB: any = { id: 'b', name: 'B', role: 'Eng' };
  const aC: any = { id: 'c', name: 'C', role: 'Des' };
  tracker.recordHandoff({ id: 'h1', fromAgent: aA, toAgent: aB, reason: '', context: '', timestamp: new Date(), status: 'completed' as const }, 100, true);
  tracker.recordHandoff({ id: 'h2', fromAgent: aB, toAgent: aC, reason: '', context: '', timestamp: new Date(), status: 'completed' as const }, 100, true);
  ok(tracker.detectCycle('c', 'a').hasCycle, 'A→B→C→A cycle detected');

  console.log('\n════════════════════════════════════');
  console.log(`TOTAL: ${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
