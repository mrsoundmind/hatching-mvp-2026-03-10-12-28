// Tier 0.6 (OBS-1/OBS-4) — errorTracker.captureException must produce a structured, parseable log
// line and must NEVER throw, whatever it is handed. Run: npx tsx scripts/test-error-tracker.ts
import { captureException } from '../server/observability/errorTracker.js';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log(`  PASS  ${n}`); } else { fail++; console.log(`  FAIL  ${n}  ${d}`); } };

// Capture console.error output to assert structure.
const orig = console.error;
const lines: string[] = [];
console.error = (...args: any[]) => { lines.push(args.map(String).join(' ')); };

try {
  captureException(new Error('boom'), { kind: 'test', userId: 'u1' });
  captureException('plain string error');
  captureException({ weird: true, code: 'X' });
  captureException(null);
} finally {
  console.error = orig;
}

check('emitted a line per capture', lines.length === 4, `got ${lines.length}`);

const first = (() => { try { return JSON.parse(lines[0]); } catch { return null; } })();
check('first line is valid JSON', first !== null);
check('has level=error', first?.level === 'error');
check('has message', first?.message === 'boom');
check('has stack', typeof first?.stack === 'string' && first.stack.includes('boom'));
check('carries context', first?.context?.kind === 'test' && first?.context?.userId === 'u1');

const second = (() => { try { return JSON.parse(lines[1]); } catch { return null; } })();
check('string error wrapped with message', second?.message === 'plain string error');

const third = (() => { try { return JSON.parse(lines[2]); } catch { return null; } })();
check('object error captured (code surfaced)', third?.code === 'X');

// null must not throw and still logs a line
check('null handled without throwing', lines.length === 4);

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
