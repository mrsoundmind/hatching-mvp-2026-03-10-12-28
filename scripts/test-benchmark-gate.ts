/**
 * ITL-2 / MEAS-06 evidence. Deterministic unit test for the benchmark improvement/regression gate.
 * No LLM, no DB, no cost. Run: ./node_modules/.bin/tsx scripts/test-benchmark-gate.ts
 */
import { evaluateBenchmarkDelta } from '../server/eval/benchmarkGate.js';

let pass = 0, fail = 0;
function check(n: string, c: boolean, d = '') { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n} ${d}`); } }

console.log('=== ITL-2 / MEAS-06: benchmark improvement/regression gate ===\n');

const first = evaluateBenchmarkDelta(null, 3.4);
check('first run (no baseline) passes and is labeled "first"', first.verdict === 'first' && first.pass === true && first.baseline === null, JSON.stringify(first));

const improved = evaluateBenchmarkDelta(3.0, 3.6);
check('a clear rise is "improved" and passes', improved.verdict === 'improved' && improved.pass === true && Math.abs(improved.delta - 0.6) < 1e-9, JSON.stringify(improved));

const regressed = evaluateBenchmarkDelta(3.6, 3.0);
check('a real drop is "regressed" and FAILS the gate', regressed.verdict === 'regressed' && regressed.pass === false, JSON.stringify(regressed));

const flat = evaluateBenchmarkDelta(3.0, 3.05);
check('a change inside the noise band is "flat" and passes', flat.verdict === 'flat' && flat.pass === true, JSON.stringify(flat));

const pct = evaluateBenchmarkDelta(2.0, 3.0);
check('pctDelta is computed (2.0 -> 3.0 = +50%)', Math.abs(pct.pctDelta - 50) < 1e-9, String(pct.pctDelta));

// Tolerance band: clearly inside is flat, clearly beyond is a real move.
check('inside the tolerance band is flat', evaluateBenchmarkDelta(3.0, 3.08, 0.1).verdict === 'flat');
check('clearly beyond tolerance is a real move', evaluateBenchmarkDelta(3.0, 3.2, 0.1).verdict === 'improved');

console.log(`\nResults: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
