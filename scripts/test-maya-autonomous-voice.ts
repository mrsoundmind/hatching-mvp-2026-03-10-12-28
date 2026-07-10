/**
 * Phase 38-03 — Maya voice snap at level-4 (ALWY-05).
 *
 * Verifies the MAYA_AUTONOMOUS_OVERRIDE block is appended AFTER
 * AUTONOMOUS_DIRECTIVE_BLOCK only when both autonomyLevel === 'autonomous' AND
 * agentIsSpecial === true. Ensures generic agents at level-4 and Maya at any
 * non-autonomous level do NOT receive the override.
 *
 * 4 cases:
 *   1. Maya + autonomous       → CONTAINS <maya_autonomous_override>
 *   2. Maya + confirm          → does NOT contain override, does NOT contain directive
 *   3. Generic (Alex PM) + autonomous → CONTAINS directive, does NOT contain override
 *   4. Generic + confirm       → contains neither
 */
import { buildSystemPrompt, MAYA_AUTONOMOUS_OVERRIDE } from '../server/ai/promptTemplate.js';

const mockPropsBase = {
  agentName: 'Alex',
  roleTitle: 'Product Manager',
  personality: 'Mock personality detail',
  expertMindset: 'Mock expert mindset detail',
  roleToolkit: 'Mock toolkit detail',
  signatureMoves: 'Mock signature moves detail',
  userMessage: 'help me shape this idea',
  chatContext: {
    mode: 'project' as const,
    participants: ['Alex', 'User'],
    scope: 'project scope',
  },
};

let failures = 0;

function assert(condition: boolean, id: string, message: string): void {
  if (!condition) {
    failures++;
    console.error(`FAIL [${id}] ${message}`);
  } else {
    console.log(`PASS [${id}] ${message}`);
  }
}

// -- Case 1 — Maya + autonomous → override present
const mayaAutonomous = buildSystemPrompt({
  ...mockPropsBase,
  agentName: 'Maya',
  roleTitle: 'Idea Partner',
  autonomyLevel: 'autonomous',
  agentIsSpecial: true,
});
assert(
  mayaAutonomous.includes('<maya_autonomous_override>'),
  '1a',
  'Maya + autonomous MUST contain <maya_autonomous_override>',
);
assert(
  mayaAutonomous.includes('</maya_autonomous_override>'),
  '1b',
  'Maya + autonomous MUST contain closing tag',
);
assert(
  mayaAutonomous.includes("Here's what I'd do:"),
  '1c',
  'Override MUST include commit-shape example ("Here\'s what I\'d do:")',
);
// Order: override must appear AFTER the general directive so LLM reads it last.
const directiveIdx = mayaAutonomous.indexOf('<autonomous_directive>');
const overrideIdx = mayaAutonomous.indexOf('<maya_autonomous_override>');
assert(
  directiveIdx > 0 && overrideIdx > directiveIdx,
  '1d',
  `Override MUST appear after general directive (directiveIdx=${directiveIdx}, overrideIdx=${overrideIdx})`,
);

// -- Case 2 — Maya + confirm → NO override, NO directive
const mayaConfirm = buildSystemPrompt({
  ...mockPropsBase,
  agentName: 'Maya',
  roleTitle: 'Idea Partner',
  autonomyLevel: 'confirm',
  agentIsSpecial: true,
});
assert(
  !mayaConfirm.includes('<maya_autonomous_override>'),
  '2a',
  'Maya + confirm MUST NOT contain override',
);
assert(
  !mayaConfirm.includes('<autonomous_directive>'),
  '2b',
  'Maya + confirm MUST NOT contain general directive',
);

// -- Case 3 — Generic agent + autonomous → directive YES, override NO
const genericAutonomous = buildSystemPrompt({
  ...mockPropsBase,
  agentName: 'Alex',
  roleTitle: 'Product Manager',
  autonomyLevel: 'autonomous',
  agentIsSpecial: false,
});
assert(
  genericAutonomous.includes('<autonomous_directive>'),
  '3a',
  'Generic + autonomous MUST contain general directive',
);
assert(
  !genericAutonomous.includes('<maya_autonomous_override>'),
  '3b',
  'Generic + autonomous MUST NOT contain Maya override',
);

// -- Case 4 — Generic + confirm → neither
const genericConfirm = buildSystemPrompt({
  ...mockPropsBase,
  agentName: 'Alex',
  roleTitle: 'Product Manager',
  autonomyLevel: 'confirm',
  agentIsSpecial: false,
});
assert(
  !genericConfirm.includes('<autonomous_directive>'),
  '4a',
  'Generic + confirm MUST NOT contain directive',
);
assert(
  !genericConfirm.includes('<maya_autonomous_override>'),
  '4b',
  'Generic + confirm MUST NOT contain override',
);

// -- Sanity — override constant is exported and non-empty
assert(
  typeof MAYA_AUTONOMOUS_OVERRIDE === 'string' && MAYA_AUTONOMOUS_OVERRIDE.length > 100,
  'S1',
  `MAYA_AUTONOMOUS_OVERRIDE constant exported (len=${MAYA_AUTONOMOUS_OVERRIDE?.length ?? 0})`,
);

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed.`);
  process.exit(1);
}

console.log('\nAll 10 assertions passed. Maya voice snap conditional-append works correctly.');
