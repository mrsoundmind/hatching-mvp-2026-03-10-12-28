/**
 * Phase 38-02 — Safety scorer destructive-intent detection (ALWY-04).
 *
 * Verifies evaluateSafetyScore returns executionRisk >= 0.70 on destructive+bulk
 * intent so the D-11..D-13 gate in taskExecutionPipeline actually fires at level 4.
 *
 * 12 cases:
 *   6 must-fire  → executionRisk >= 0.70 (destructive_verb_critical + scope multipliers)
 *   6 must-not-fire → executionRisk < 0.70 (targeted, reset without scope, non-destructive)
 */
import { evaluateSafetyScore, AUTONOMOUS_SAFETY_THRESHOLDS } from '../server/ai/safety.js';

interface Case {
  id: string;
  message: string;
  expected: 'fire' | 'no-fire';
}

const CASES: Case[] = [
  // must-fire (>= 0.70)
  { id: 'F1', message: 'delete all my data and start over', expected: 'fire' },
  { id: 'F2', message: 'wipe everything', expected: 'fire' },
  { id: 'F3', message: 'nuke this project', expected: 'fire' },
  { id: 'F4', message: 'destroy the database', expected: 'fire' },
  { id: 'F5', message: 'erase all data', expected: 'fire' },
  { id: 'F6', message: 'obliterate my brain', expected: 'fire' },
  // must-not-fire (< 0.70)
  { id: 'N1', message: 'write me a marketing plan', expected: 'no-fire' },
  { id: 'N2', message: 'delete this typo', expected: 'no-fire' },
  { id: 'N3', message: 'restart my thinking', expected: 'no-fire' },
  { id: 'N4', message: 'start over the intro paragraph', expected: 'no-fire' },
  { id: 'N5', message: 'reset the counter', expected: 'no-fire' },
  { id: 'N6', message: 'build a launch strategy', expected: 'no-fire' },
];

const THRESHOLD = AUTONOMOUS_SAFETY_THRESHOLDS.clarificationRequiredRisk; // 0.70

let failures = 0;

for (const c of CASES) {
  const score = evaluateSafetyScore({
    userMessage: c.message,
    conversationMode: 'project',
  });

  const fires = score.executionRisk >= THRESHOLD;
  const expectedFires = c.expected === 'fire';
  const pass = fires === expectedFires;

  if (!pass) {
    failures++;
    console.error(
      `FAIL [${c.id}] "${c.message}" — expected ${c.expected}, ` +
      `got executionRisk=${score.executionRisk.toFixed(3)} (threshold=${THRESHOLD}). ` +
      `reasons=[${score.reasons.join(', ')}]`,
    );
  } else {
    console.log(
      `PASS [${c.id}] "${c.message}" — executionRisk=${score.executionRisk.toFixed(3)} ${c.expected === 'fire' ? '>=' : '<'} ${THRESHOLD}`,
    );
  }
}

if (failures > 0) {
  console.error(`\n${failures}/${CASES.length} case(s) failed.`);
  process.exit(1);
}

console.log(`\nAll ${CASES.length}/${CASES.length} cases passed. Safety floor detects destructive intent.`);
