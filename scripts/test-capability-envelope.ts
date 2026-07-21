/**
 * Phase 38-04 — Universal capability envelope (ALWY-06).
 *
 * Verifies AGENT_CAPABILITY_ENVELOPE is:
 *   - Present at every autonomy level (identity, not autonomy-gated)
 *   - Contains all four [[...]] proposal block names in the CAN list
 *   - Contains explicit CANNOT phrasing (delete, wipe, database, file system)
 *   - Contains the "NEVER describe having performed" enforcement line
 *   - Positioned in the assembled prompt BEFORE AUTONOMOUS_DIRECTIVE_BLOCK
 *     and BEFORE MAYA_AUTONOMOUS_OVERRIDE (identity → override ordering)
 */
import {
  buildSystemPrompt,
  AGENT_CAPABILITY_ENVELOPE,
} from '../server/ai/promptTemplate.js';

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

// -- Case 1 — envelope present at every autonomy level for a generic agent
for (const level of ['observe', 'propose', 'confirm', 'autonomous'] as const) {
  const prompt = buildSystemPrompt({
    ...mockPropsBase,
    autonomyLevel: level,
  });
  assert(
    prompt.includes('<capability_envelope>'),
    `1-${level}`,
    `Envelope present at level "${level}"`,
  );
  assert(
    prompt.includes('</capability_envelope>'),
    `1-${level}-close`,
    `Envelope closing tag present at level "${level}"`,
  );
}

// -- Case 2 — CAN list contains all four canonical [[...]] block names
const anyPrompt = buildSystemPrompt({ ...mockPropsBase, autonomyLevel: 'confirm' });
for (const blockName of ['HATCH_SUGGESTION', 'TASK', 'UPDATE', 'PROJECT_NAME']) {
  assert(
    anyPrompt.includes(`[[${blockName}`),
    `2-${blockName}`,
    `CAN list mentions [[${blockName}...]]`,
  );
}

// -- Case 3 — CANNOT list contains destructive-op categories
for (const forbidden of ['Delete', 'wipe', 'database', 'file system']) {
  assert(
    anyPrompt.toLowerCase().includes(forbidden.toLowerCase()),
    `3-${forbidden}`,
    `CANNOT list mentions "${forbidden}"`,
  );
}

// -- Case 4 — enforcement line present
assert(
  anyPrompt.includes('NEVER describe having performed'),
  '4',
  'Envelope contains "NEVER describe having performed" enforcement line',
);

// -- Case 5 — ordering at level 'autonomous' + Maya: envelope < directive < override
const stackedPrompt = buildSystemPrompt({
  ...mockPropsBase,
  agentName: 'Maya',
  roleTitle: 'Idea Partner',
  autonomyLevel: 'autonomous',
  agentIsSpecial: true,
});
const envelopeIdx = stackedPrompt.indexOf('<capability_envelope>');
const directiveIdx = stackedPrompt.indexOf('<autonomous_directive>');
const overrideIdx = stackedPrompt.indexOf('<maya_autonomous_override>');
assert(
  envelopeIdx > 0 && directiveIdx > envelopeIdx && overrideIdx > directiveIdx,
  '5',
  `Ordering envelope(${envelopeIdx}) < directive(${directiveIdx}) < override(${overrideIdx})`,
);

// -- Case 6 — sanity: constant exported and non-empty
assert(
  typeof AGENT_CAPABILITY_ENVELOPE === 'string' && AGENT_CAPABILITY_ENVELOPE.length > 500,
  'S1',
  `AGENT_CAPABILITY_ENVELOPE exported and substantive (len=${AGENT_CAPABILITY_ENVELOPE?.length ?? 0})`,
);

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed.`);
  process.exit(1);
}

console.log('\nAll assertions passed. Capability envelope is universally injected and correctly ordered.');
