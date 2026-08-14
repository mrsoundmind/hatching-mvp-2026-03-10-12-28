/**
 * ITL-3 / LEARN-01 evidence. Deterministic unit test for the growth-loop lessons formatter. No LLM,
 * no DB, no cost. Run: ./node_modules/.bin/tsx scripts/test-quality-lessons.ts
 */
import { formatQualityLessons, type LessonInput } from '../server/ai/qualityLessons.js';

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} ${detail}`); }
}

console.log('=== ITL-3 / LEARN-01: growth-loop lessons formatter ===\n');

// 1) A revise verdict with must-fix items becomes forward-feed lessons.
const l1 = formatQualityLessons([{ verdict: 'revise', mustFix: ['name a specific framework', 'add a metric'] }]);
check('revise + mustFix produces a lessons block', l1.includes('name a specific framework') && l1.includes('add a metric') && l1.startsWith('Recent reviews'), JSON.stringify(l1));

// 2) Approve carries no lesson.
const l2 = formatQualityLessons([{ verdict: 'approve', mustFix: ['should not appear'] }]);
check('approve verdict is skipped (no lesson)', l2 === '', JSON.stringify(l2));

// 3) Reject is included.
const l3 = formatQualityLessons([{ verdict: 'reject', mustFix: ['fix the fabricated stat'] }]);
check('reject + mustFix is included', l3.includes('fix the fabricated stat'), JSON.stringify(l3));

// 4) Case-insensitive dedup across reviews.
const l4 = formatQualityLessons([
  { verdict: 'revise', mustFix: ['Add a metric'] },
  { verdict: 'revise', mustFix: ['add a metric', 'cite a source'] },
]);
check('dedups case-insensitively', (l4.match(/add a metric/gi) || []).length === 1 && l4.includes('cite a source'), JSON.stringify(l4));

// 5) Caps the number of lessons.
const many: LessonInput[] = [{ verdict: 'revise', mustFix: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }];
const l5 = formatQualityLessons(many, 5);
check('caps at the max (5)', (l5.match(/\n- /g) || []).length === 5, JSON.stringify(l5));

// 6) Empty / no-fix input yields no block.
check('empty input yields no block', formatQualityLessons([]) === '' && formatQualityLessons([{ verdict: 'revise', mustFix: [] }]) === '');

console.log(`\nResults: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
