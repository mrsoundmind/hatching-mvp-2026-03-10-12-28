/**
 * Tests for duplicate task detection.
 */

import { checkForDuplicate } from '../server/ai/tasks/duplicateDetector.js';

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

const existingTasks = [
  { id: '1', title: 'Fix login redirect bug', status: 'in_progress', priority: 'high' },
  { id: '2', title: 'Design user dashboard', status: 'todo', priority: 'medium' },
  { id: '3', title: 'Add user authentication', status: 'completed', priority: 'high' },
  { id: '4', title: 'Implement API rate limiting', status: 'todo', priority: 'low' },
];

console.log('\n🧪 Duplicate Detector Tests\n');

// Exact match
{
  const r = checkForDuplicate('Fix login redirect bug', existingTasks);
  assert(r.isDuplicate === true, 'Exact match → isDuplicate');
  assert(r.similarity === 1.0, 'Exact match → similarity 1.0');
}

// Case-insensitive match
{
  const r = checkForDuplicate('fix login redirect bug', existingTasks);
  assert(r.isDuplicate === true, 'Case-insensitive exact → isDuplicate');
}

// Near match (extra words)
{
  const r = checkForDuplicate('Fix the login redirect bug', existingTasks);
  assert(r.isDuplicate === true, 'Near match with "the" → isDuplicate');
}

// Different task
{
  const r = checkForDuplicate('Build notification system', existingTasks);
  assert(r.isDuplicate === false, 'Different task → not duplicate');
}

// Completed tasks should be ignored
{
  const r = checkForDuplicate('Add user authentication', existingTasks);
  assert(r.isDuplicate === false, 'Completed task → not duplicate');
}

// Substring containment
{
  const r = checkForDuplicate('login redirect', existingTasks);
  assert(r.isDuplicate === true, 'Substring "login redirect" → isDuplicate');
}

console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
