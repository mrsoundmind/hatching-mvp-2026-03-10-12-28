/**
 * ITL-0 T3 evidence (KNOW-03). Deterministic unit test for the recency factor. No LLM, no DB, no cost.
 * Run: ./node_modules/.bin/tsx scripts/test-recency.ts
 */
import { recencyFactor } from '../server/knowledge/rag/retriever.js';

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} ${detail}`); }
}

// Fixed "now" so the test is deterministic.
const NOW = Date.parse('2026-08-13T00:00:00Z');

const recent = recencyFactor('2026-01-01', NOW);
const old = recencyFactor('2016-01-01', NOW);
const ancient = recencyFactor('1995-01-01', NOW);

console.log('=== ITL-0 T3: recency factor ===\n');
check('newer source scores higher than older', recent > old && old > ancient, `${recent} ${old} ${ancient}`);
check('a current-year source is near 1.0', recent > 0.85, String(recent));
check('a decade-old source is meaningfully lower', old < recent && old > 0, String(old));
check('undated source returns 0 (no boost)', recencyFactor(null, NOW) === 0 && recencyFactor(undefined, NOW) === 0);
check('unparseable date returns 0 (e.g. a range "2005-2021")', recencyFactor('2005-2021', NOW) === 0, String(recencyFactor('2005-2021', NOW)));
check('a year-only string parses', recencyFactor('2025', NOW) > 0.7, String(recencyFactor('2025', NOW)));
// Bounded: the factor is always in [0,1], so score*(1+w*factor) can lift a chunk by at most w (10% default).
check('factor is bounded to [0,1]', recent <= 1 && recent >= 0 && ancient >= 0, `${recent} ${ancient}`);

console.log(`\nResults: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
