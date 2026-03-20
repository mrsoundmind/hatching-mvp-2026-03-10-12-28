/**
 * Tests for task creator — due date extraction + priority inference.
 */

import { extractDueDate, extractPriority } from '../server/ai/tasks/taskCreator.js';

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

console.log('\n🧪 Task Creator Tests\n');

// ── Due Date Extraction ──
console.log('── Due Date Extraction ──');

{
  const r = extractDueDate('fix the login bug by tomorrow');
  assert(r !== null, '"by tomorrow" → has due date');
  if (r) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    assert(r.toDateString() === tomorrow.toDateString(), '"by tomorrow" → correct date');
  }
}
{
  const r = extractDueDate('implement auth in 3 days');
  assert(r !== null, '"in 3 days" → has due date');
  if (r) {
    const expected = new Date();
    expected.setDate(expected.getDate() + 3);
    assert(r.toDateString() === expected.toDateString(), '"in 3 days" → correct date');
  }
}
{
  const r = extractDueDate('just fix the bug');
  assert(r === null, 'No date phrase → null');
}

// ── Priority Extraction ──
console.log('\n── Priority Extraction ──');

{
  const r = extractPriority('urgent: fix the login bug');
  assert(r === 'urgent', '"urgent:" → urgent');
}
{
  const r = extractPriority('this is critical and needs fixing');
  assert(r === 'urgent', '"critical" → urgent');
}
{
  const r = extractPriority('high priority task to fix auth');
  assert(r === 'high', '"high priority" → high');
}
{
  const r = extractPriority('would be nice to add dark mode');
  assert(r === 'low', '"nice to have" language → low');
}
{
  const r = extractPriority('fix the login bug');
  assert(r === undefined, 'No priority keywords → undefined');
}

console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
