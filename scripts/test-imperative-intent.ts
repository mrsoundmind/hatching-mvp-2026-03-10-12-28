#!/usr/bin/env tsx
/**
 * Phase 36.5 — Unit tests for parseImperativeIntent.
 *
 * Pure parser unit tests: no DB, no LLM, no I/O. Each case asserts the
 * exact shape the WS chat handler will switch on.
 *
 * Run with: npx tsx scripts/test-imperative-intent.ts
 */

import assert from 'node:assert/strict';
import {
  parseImperativeIntent,
  type ImperativeIntent,
} from '../server/ai/imperativeIntentParser.js';

function ok(label: string): void {
  console.log(`PASS ${label}`);
}

// ─── create-agent ─────────────────────────────────────────────────────────────

async function case_createAgent_basic(): Promise<void> {
  const r = parseImperativeIntent('create an agent named Pixel as Social Media Manager');
  assert.ok(r, 'expected match');
  assert.equal(r!.kind, 'create-agent');
  if (r!.kind === 'create-agent') {
    assert.equal(r.name, 'Pixel');
    assert.equal(r.role, 'Social Media Manager');
  }
  ok('createAgent_basic: "create an agent named Pixel as Social Media Manager" → Pixel / Social Media Manager');
}

async function case_createAgent_called(): Promise<void> {
  const r = parseImperativeIntent('add an agent called Sam who is a QA Lead');
  assert.ok(r, 'expected match');
  assert.equal(r!.kind, 'create-agent');
  if (r!.kind === 'create-agent') {
    assert.equal(r.name, 'Sam');
    assert.equal(r.role, 'Qa Lead');
  }
  ok('createAgent_called: "add an agent called Sam who is a QA Lead" → Sam / Qa Lead');
}

async function case_createAgent_commaForm(): Promise<void> {
  const r = parseImperativeIntent('spawn agent named Riley, a Designer');
  assert.ok(r, 'expected match');
  assert.equal(r!.kind, 'create-agent');
  if (r!.kind === 'create-agent') {
    assert.equal(r.name, 'Riley');
    assert.equal(r.role, 'Designer');
  }
  ok('createAgent_commaForm: "spawn agent named Riley, a Designer" → Riley / Designer');
}

async function case_createAgent_noRole(): Promise<void> {
  const r = parseImperativeIntent('create an agent named Alex');
  assert.ok(r, 'expected match');
  assert.equal(r!.kind, 'create-agent');
  if (r!.kind === 'create-agent') {
    assert.equal(r.name, 'Alex');
    assert.equal(r.role, 'Specialist');
  }
  ok('createAgent_noRole: "create an agent named Alex" → Alex / Specialist (default role)');
}

async function case_createAgent_makeForm(): Promise<void> {
  const r = parseImperativeIntent('make an agent named Drew as an Email Specialist');
  assert.ok(r, 'expected match');
  if (r && r.kind === 'create-agent') {
    assert.equal(r.name, 'Drew');
    assert.equal(r.role, 'Email Specialist');
  }
  ok('createAgent_makeForm: "make an agent named Drew as an Email Specialist" → Drew / Email Specialist');
}

async function case_createAgent_negative(): Promise<void> {
  // No "named" / "called" anchor → must not match.
  const r = parseImperativeIntent('I think the agent should be creative');
  assert.equal(r, null, 'should not match without "named" or "called" anchor');
  ok('createAgent_negative: "I think the agent should be creative" → null (no anchor word)');
}

async function case_createAgent_partialWord(): Promise<void> {
  // Word-boundary check: "creative" must NOT trip the "create" stem.
  // (parseImperativeIntent itself uses \b but we cross-check the whole behavior here.)
  const r = parseImperativeIntent('creative agents are key');
  assert.equal(r, null, 'should not match — "creative" is not the imperative "create"');
  ok('createAgent_partialWord: "creative agents are key" → null (word-boundary)');
}

// ─── create-task ──────────────────────────────────────────────────────────────

async function case_createTask_to(): Promise<void> {
  const r = parseImperativeIntent('add a task to update the landing page');
  assert.ok(r, 'expected match');
  assert.equal(r!.kind, 'create-task');
  if (r!.kind === 'create-task') {
    assert.equal(r.title, 'update the landing page');
    assert.equal(r.priority, 'medium');
  }
  ok('createTask_to: "add a task to update the landing page" → title / medium');
}

async function case_createTask_urgent(): Promise<void> {
  const r = parseImperativeIntent('add an urgent task to fix the bug');
  assert.ok(r, 'expected match');
  if (r && r.kind === 'create-task') {
    assert.equal(r.title, 'fix the bug');
    assert.equal(r.priority, 'high');
  }
  ok('createTask_urgent: "add an urgent task to fix the bug" → title / high');
}

async function case_createTask_colon(): Promise<void> {
  const r = parseImperativeIntent('create a task: review legal copy');
  assert.ok(r, 'expected match');
  if (r && r.kind === 'create-task') {
    assert.equal(r.title, 'review legal copy');
    assert.equal(r.priority, 'medium');
  }
  ok('createTask_colon: "create a task: review legal copy" → title / medium');
}

async function case_createTask_for(): Promise<void> {
  const r = parseImperativeIntent('make a task for shipping the iOS build');
  assert.ok(r, 'expected match');
  if (r && r.kind === 'create-task') {
    assert.equal(r.title, 'shipping the iOS build');
    assert.equal(r.priority, 'medium');
  }
  ok('createTask_for: "make a task for shipping the iOS build" → title / medium');
}

// ─── rename-project ───────────────────────────────────────────────────────────

async function case_renameProject_basic(): Promise<void> {
  const r = parseImperativeIntent('rename the project to Falcon');
  assert.ok(r, 'expected match');
  if (r && r.kind === 'rename-project') {
    assert.equal(r.name, 'Falcon');
  }
  ok('renameProject_basic: "rename the project to Falcon" → Falcon');
}

async function case_renameProject_multiword(): Promise<void> {
  const r = parseImperativeIntent('rename project to Falcon Mobile App');
  assert.ok(r, 'expected match');
  if (r && r.kind === 'rename-project') {
    assert.equal(r.name, 'Falcon Mobile App');
  }
  ok('renameProject_multiword: "rename project to Falcon Mobile App" → Falcon Mobile App');
}

async function case_renameProject_changeName(): Promise<void> {
  const r = parseImperativeIntent('change the project name to Falcon');
  assert.ok(r, 'expected match');
  if (r && r.kind === 'rename-project') {
    assert.equal(r.name, 'Falcon');
  }
  ok('renameProject_changeName: "change the project name to Falcon" → Falcon');
}

// ─── set-brain-field ──────────────────────────────────────────────────────────

async function case_setBrainField_goal(): Promise<void> {
  const r = parseImperativeIntent('set the project goal to ship by Q4');
  assert.ok(r, 'expected match');
  if (r && r.kind === 'set-brain-field') {
    assert.equal(r.field, 'goals');
    assert.equal(r.value, 'ship by Q4');
  }
  ok('setBrainField_goal: "set the project goal to ship by Q4" → goals / ship by Q4');
}

async function case_setBrainField_audience(): Promise<void> {
  const r = parseImperativeIntent('set the audience to enterprise SaaS founders');
  assert.ok(r, 'expected match');
  if (r && r.kind === 'set-brain-field') {
    assert.equal(r.field, 'coreDirection');
    assert.equal(r.value, 'enterprise SaaS founders');
  }
  ok('setBrainField_audience: "set the audience to enterprise SaaS founders" → coreDirection / value');
}

async function case_setBrainField_culture(): Promise<void> {
  const r = parseImperativeIntent('set culture to async-first');
  assert.ok(r, 'expected match');
  if (r && r.kind === 'set-brain-field') {
    assert.equal(r.field, 'teamCulture');
    assert.equal(r.value, 'async-first');
  }
  ok('setBrainField_culture: "set culture to async-first" → teamCulture / async-first');
}

// ─── ambiguous / no-match cases ───────────────────────────────────────────────

async function case_ambiguous_question(): Promise<void> {
  const r = parseImperativeIntent('what should we build next?');
  assert.equal(r, null, 'questions should not match');
  ok('ambiguous_question: "what should we build next?" → null');
}

async function case_ambiguous_request(): Promise<void> {
  const r = parseImperativeIntent('I want help with the launch plan');
  assert.equal(r, null, 'soft requests should not match');
  ok('ambiguous_request: "I want help with the launch plan" → null');
}

async function case_ambiguous_planFor(): Promise<void> {
  // Critical case from probe: "plan for X" is intentionally NOT in the
  // imperative grammar — falls through to LLM-driven planning flow.
  const r = parseImperativeIntent('plan for shipping the mobile app this quarter');
  assert.equal(r, null, '"plan for X" is intentionally ambiguous — LLM handles it');
  ok('ambiguous_planFor: "plan for shipping the mobile app this quarter" → null (intentional fallback)');
}

async function case_edge_emptyString(): Promise<void> {
  assert.equal(parseImperativeIntent(''), null, 'empty string → null');
  assert.equal(parseImperativeIntent('   '), null, 'whitespace-only → null');
  assert.equal(parseImperativeIntent('ok'), null, '< 4 chars → null');
  ok('edge_emptyString: empty / whitespace / very-short inputs → null');
}

// ─── runner ──────────────────────────────────────────────────────────────────

const cases: Array<{ name: string; fn: () => Promise<void> }> = [
  { name: 'createAgent_basic', fn: case_createAgent_basic },
  { name: 'createAgent_called', fn: case_createAgent_called },
  { name: 'createAgent_commaForm', fn: case_createAgent_commaForm },
  { name: 'createAgent_noRole', fn: case_createAgent_noRole },
  { name: 'createAgent_makeForm', fn: case_createAgent_makeForm },
  { name: 'createAgent_negative', fn: case_createAgent_negative },
  { name: 'createAgent_partialWord', fn: case_createAgent_partialWord },
  { name: 'createTask_to', fn: case_createTask_to },
  { name: 'createTask_urgent', fn: case_createTask_urgent },
  { name: 'createTask_colon', fn: case_createTask_colon },
  { name: 'createTask_for', fn: case_createTask_for },
  { name: 'renameProject_basic', fn: case_renameProject_basic },
  { name: 'renameProject_multiword', fn: case_renameProject_multiword },
  { name: 'renameProject_changeName', fn: case_renameProject_changeName },
  { name: 'setBrainField_goal', fn: case_setBrainField_goal },
  { name: 'setBrainField_audience', fn: case_setBrainField_audience },
  { name: 'setBrainField_culture', fn: case_setBrainField_culture },
  { name: 'ambiguous_question', fn: case_ambiguous_question },
  { name: 'ambiguous_request', fn: case_ambiguous_request },
  { name: 'ambiguous_planFor', fn: case_ambiguous_planFor },
  { name: 'edge_emptyString', fn: case_edge_emptyString },
];

async function main(): Promise<void> {
  let failed = 0;
  for (const c of cases) {
    try {
      await c.fn();
    } catch (err) {
      failed++;
      console.error(`FAIL ${c.name}:`, err instanceof Error ? err.message : err);
    }
  }
  if (failed > 0) {
    console.error(`\n${failed}/${cases.length} cases FAILED`);
    process.exit(1);
  }
  console.log(`\nAll Phase 36.5 imperative intent cases passed (${cases.length}/${cases.length}).`);
}

main().catch((err) => {
  console.error('Unexpected runner error:', err);
  process.exit(1);
});

// Re-export type so tsx doesn't tree-shake the import
export type { ImperativeIntent };
