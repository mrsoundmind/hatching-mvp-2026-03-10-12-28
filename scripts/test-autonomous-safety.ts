/**
 * RED phase test: autonomous safety scoring — Test 1 only
 */
import { evaluateSafetyScore } from '../server/ai/safety.js';

const autonomous = evaluateSafetyScore({
  userMessage: 'write a project plan',
  conversationMode: 'project',
  // @ts-ignore - not yet on type
  executionContext: 'autonomous_task',
});

if (autonomous.executionRisk < 0.20) {
  console.error(`FAIL: autonomous_task must boost executionRisk >= 0.20, got ${autonomous.executionRisk}`);
  process.exit(1);
}

console.log(`PASS: autonomous executionRisk = ${autonomous.executionRisk}`);
