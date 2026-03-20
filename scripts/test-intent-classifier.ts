/**
 * Tests for the Smart Task Detection intent classifier.
 */

import { classifyTaskIntent } from '../server/ai/tasks/intentClassifier.js';

const agents = [
  { id: '1', name: 'Jordan', role: 'Backend Developer' },
  { id: '2', name: 'Mira', role: 'Product Designer' },
  { id: '3', name: 'Alex', role: 'Product Manager' },
];

const baseContext = { availableAgents: agents, conversationDepth: 1 };
const deepContext = { availableAgents: agents, conversationDepth: 5 };

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

console.log('\n🧪 Intent Classifier Tests\n');

// ── NO_TASK_INTENT ──
console.log('── NO_TASK_INTENT ──');
{
  const r = classifyTaskIntent('hey', baseContext);
  assert(r.type === 'NO_TASK_INTENT', '"hey" → NO_TASK_INTENT');
}
{
  const r = classifyTaskIntent('hello how are you?', baseContext);
  assert(r.type === 'NO_TASK_INTENT', '"hello how are you?" → NO_TASK_INTENT');
}
{
  const r = classifyTaskIntent('thanks!', baseContext);
  assert(r.type === 'NO_TASK_INTENT', '"thanks!" → NO_TASK_INTENT');
}
{
  const r = classifyTaskIntent('what do you think about React?', baseContext);
  assert(r.type === 'NO_TASK_INTENT', '"what do you think..." → NO_TASK_INTENT');
}
{
  // @mention without delegation verb should NOT be delegation
  const r = classifyTaskIntent('@Maya what do you think about the design?', baseContext);
  assert(r.type === 'NO_TASK_INTENT', '"@Maya what do you think..." → NO_TASK_INTENT (no delegation verb)');
}

// ── EXPLICIT_TASK_REQUEST ──
console.log('\n── EXPLICIT_TASK_REQUEST ──');
{
  const r = classifyTaskIntent('create a task to fix the login bug', baseContext);
  assert(r.type === 'EXPLICIT_TASK_REQUEST', '"create a task to fix..." → EXPLICIT_TASK_REQUEST');
}
{
  const r = classifyTaskIntent('add a task for redesigning the dashboard', baseContext);
  assert(r.type === 'EXPLICIT_TASK_REQUEST', '"add a task for..." → EXPLICIT_TASK_REQUEST');
}
{
  const r = classifyTaskIntent('task: implement user authentication', baseContext);
  assert(r.type === 'EXPLICIT_TASK_REQUEST', '"task: implement..." → EXPLICIT_TASK_REQUEST');
}
{
  const r = classifyTaskIntent('add this to the task list', baseContext);
  assert(r.type === 'EXPLICIT_TASK_REQUEST', '"add this to the task list" → EXPLICIT_TASK_REQUEST');
}

// ── USER_DELEGATION ──
console.log('\n── USER_DELEGATION ──');
{
  const r = classifyTaskIntent('@Jordan handle the API integration', baseContext);
  assert(r.type === 'USER_DELEGATION', '"@Jordan handle..." → USER_DELEGATION');
}
{
  const r = classifyTaskIntent('pass this to the engineer', baseContext);
  assert(r.type === 'USER_DELEGATION', '"pass this to the engineer" → USER_DELEGATION');
}
{
  const r = classifyTaskIntent('assign this to Jordan', baseContext);
  assert(r.type === 'USER_DELEGATION', '"assign this to Jordan" → USER_DELEGATION');
}
{
  const r = classifyTaskIntent('let the designer handle this', baseContext);
  assert(r.type === 'USER_DELEGATION', '"let the designer handle..." → USER_DELEGATION');
}

// ── TASK_LIFECYCLE_COMMAND ──
console.log('\n── TASK_LIFECYCLE_COMMAND ──');
{
  const r = classifyTaskIntent('mark the login task as done', baseContext);
  assert(r.type === 'TASK_LIFECYCLE_COMMAND', '"mark...as done" → TASK_LIFECYCLE_COMMAND');
  if (r.type === 'TASK_LIFECYCLE_COMMAND') assert(r.command === 'status_update', 'command = status_update');
}
{
  const r = classifyTaskIntent('change priority of API task to urgent', baseContext);
  assert(r.type === 'TASK_LIFECYCLE_COMMAND', '"change priority..." → TASK_LIFECYCLE_COMMAND');
  if (r.type === 'TASK_LIFECYCLE_COMMAND') assert(r.command === 'priority_update', 'command = priority_update');
}
{
  const r = classifyTaskIntent('what tasks do we have?', baseContext);
  assert(r.type === 'TASK_LIFECYCLE_COMMAND', '"what tasks..." → TASK_LIFECYCLE_COMMAND');
  if (r.type === 'TASK_LIFECYCLE_COMMAND') assert(r.command === 'query', 'command = query');
}
{
  const r = classifyTaskIntent('delete the dashboard task', baseContext);
  assert(r.type === 'TASK_LIFECYCLE_COMMAND', '"delete the...task" → TASK_LIFECYCLE_COMMAND');
  if (r.type === 'TASK_LIFECYCLE_COMMAND') assert(r.command === 'delete', 'command = delete');
}
{
  const r = classifyTaskIntent("what are Jordan's tasks?", baseContext);
  assert(r.type === 'TASK_LIFECYCLE_COMMAND', '"what are Jordan\'s tasks?" → TASK_LIFECYCLE_COMMAND');
  if (r.type === 'TASK_LIFECYCLE_COMMAND') assert(r.command === 'filtered_query', 'command = filtered_query');
}
{
  const r = classifyTaskIntent('show blocked tasks', baseContext);
  assert(r.type === 'TASK_LIFECYCLE_COMMAND', '"show blocked tasks" → TASK_LIFECYCLE_COMMAND');
  if (r.type === 'TASK_LIFECYCLE_COMMAND') assert(r.command === 'filtered_query', 'command = filtered_query');
}
{
  const r = classifyTaskIntent("how's the project going?", baseContext);
  assert(r.type === 'TASK_LIFECYCLE_COMMAND', '"how\'s the project going?" → TASK_LIFECYCLE_COMMAND');
  if (r.type === 'TASK_LIFECYCLE_COMMAND') assert(r.command === 'progress', 'command = progress');
}
{
  const r = classifyTaskIntent('reassign the API task to Mira', baseContext);
  assert(r.type === 'TASK_LIFECYCLE_COMMAND', '"reassign...to Mira" → TASK_LIFECYCLE_COMMAND');
  if (r.type === 'TASK_LIFECYCLE_COMMAND') assert(r.command === 'assignee_update', 'command = assignee_update');
}

// ── ORGANIC_CANDIDATE ──
console.log('\n── ORGANIC_CANDIDATE ──');
{
  const r = classifyTaskIntent('we should probably implement user authentication next', deepContext);
  assert(r.type === 'ORGANIC_CANDIDATE', '"we should implement..." (deep) → ORGANIC_CANDIDATE');
}
{
  // Same message but shallow conversation — should NOT be organic
  const r = classifyTaskIntent('we should probably implement user authentication next', baseContext);
  assert(r.type === 'NO_TASK_INTENT', '"we should implement..." (shallow) → NO_TASK_INTENT');
}

console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
