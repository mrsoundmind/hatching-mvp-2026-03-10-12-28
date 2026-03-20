/**
 * scripts/test-handoff-routing.ts
 * Unit tests for handoff routing stability and cycle detection.
 * Covers: HAND-01 (routing), HAND-03 (cycle detection)
 *
 * Run: npx tsx scripts/test-handoff-routing.ts
 */

import { MAX_HANDOFF_HOPS } from '../server/autonomy/config/policies.js';
import { evaluateConductorDecision } from '../server/ai/conductor.js';
import { handoffTracker } from '../server/ai/expertiseMatching.js';
import { orchestrateHandoff } from '../server/autonomy/handoff/handoffOrchestrator.js';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve(fn())
    .then(() => { console.log('  PASS  ' + name); passed++; })
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('  FAIL  ' + name + '\n        ' + msg); failed++;
    });
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error('Assertion failed: ' + message);
}

const mockAgents = [
  { id: 'agent-pm-001', name: 'Maya', role: 'Product Manager', teamId: null },
  { id: 'agent-be-001', name: 'Alex', role: 'Backend Developer', teamId: null },
  { id: 'agent-ds-001', name: 'Sam', role: 'Designer', teamId: null },
];

function makeMockStorage(tasks: any[] = []) {
  const updatedTasks = new Map<string, any>();
  return {
    async getTasksByProject() { return tasks; },
    async getAgentsByProject() { return mockAgents; },
    async getProject(id: string) { return { id, name: 'Test Project' }; },
    async updateTask(id: string, updates: any) {
      updatedTasks.set(id, { ...(updatedTasks.get(id) ?? {}), ...updates });
      return { id, ...updates };
    },
    getUpdatedTask(id: string) { return updatedTasks.get(id); },
  };
}

function makeBroadcast() {
  const captures: any[] = [];
  const fn = (_c: string, p: unknown) => { captures.push(p); };
  fn.captures = captures;
  return fn;
}

async function runTests() {
  console.log('\nRunning handoff routing tests...\n');

  await test('Test 1: MAX_HANDOFF_HOPS is defined and defaults to 4', () => {
    assert(typeof MAX_HANDOFF_HOPS === 'number', 'MAX_HANDOFF_HOPS is a number');
    assert(MAX_HANDOFF_HOPS === 4, 'Expected 4, got ' + MAX_HANDOFF_HOPS);
  });

  await test('Test 2: Backend task routes to Backend Developer', () => {
    const result = evaluateConductorDecision({
      userMessage: 'Build API endpoint for user authentication and session management',
      conversationMode: 'project',
      availableAgents: mockAgents,
    });
    assert(
      result.primaryMatch?.role === 'Backend Developer',
      'Expected Backend Developer, got ' + (result.primaryMatch?.role ?? 'undefined'),
    );
  });

  await test('Test 3: Design task routes to Designer', () => {
    const result = evaluateConductorDecision({
      userMessage: 'Design onboarding flow wireframes and user journey map',
      conversationMode: 'project',
      availableAgents: mockAgents,
    });
    assert(
      result.primaryMatch?.role === 'Designer',
      'Expected Designer, got ' + (result.primaryMatch?.role ?? 'undefined'),
    );
  });

  await test('Test 4: Short title padded with description avoids PM fast-path', () => {
    const paddedMessage = 'Fix bug — The API endpoint for user session management is returning 500 errors';
    const result = evaluateConductorDecision({
      userMessage: paddedMessage,
      conversationMode: 'project',
      availableAgents: mockAgents,
    });
    assert(
      result.primaryMatch?.role === 'Backend Developer',
      'Expected Backend Developer for padded message, got ' + (result.primaryMatch?.role ?? 'undefined'),
    );
  });

  await test('Test 5: detectCycle returns hasCycle: true for A->B->A pattern', () => {
    handoffTracker.recordHandoff(
      {
        id: 'handoff-cycle-t5-' + Date.now(),
        fromAgent: mockAgents[0],
        toAgent: mockAgents[1],
        reason: 'test',
        context: 'A to B for cycle test',
        timestamp: new Date(),
        status: 'accepted',
      },
      0,
      true,
    );
    const cycleCheck = handoffTracker.detectCycle(mockAgents[1].id, mockAgents[0].id);
    assert(cycleCheck.hasCycle === true, 'Expected hasCycle: true, got ' + cycleCheck.hasCycle);
    assert(Array.isArray(cycleCheck.chain), 'Returns chain array');
  });

  await test('Test 6: orchestrateHandoff returns max_hops_reached when chain is full', async () => {
    const fullChain = Array.from({ length: MAX_HANDOFF_HOPS }, (_, i) => 'agent-' + i);
    const result = await orchestrateHandoff({
      completedTask: { id: 'task-done', title: 'Task', description: 'description text here', projectId: 'proj-1' },
      completedAgent: { id: 'agent-be-001', name: 'Alex', role: 'Backend Developer' },
      completedOutput: 'done',
      handoffChain: fullChain,
      storage: makeMockStorage() as any,
      broadcastToConversation: makeBroadcast(),
    });
    assert(result.status === 'max_hops_reached', 'Expected max_hops_reached, got ' + result.status);
  });

  await test('Test 7: orchestrateHandoff returns no_next_task when no dependent tasks', async () => {
    const result = await orchestrateHandoff({
      completedTask: { id: 'task-done-2', title: 'Task', description: 'No deps exist', projectId: 'proj-2' },
      completedAgent: { id: 'agent-be-001', name: 'Alex', role: 'Backend Developer' },
      completedOutput: 'done',
      handoffChain: [],
      storage: makeMockStorage() as any,
      broadcastToConversation: makeBroadcast(),
    });
    assert(result.status === 'no_next_task', 'Expected no_next_task, got ' + result.status);
  });

  await test('Test 8: orchestrateHandoff returns queued and stores context in task metadata', async () => {
    const depTask = {
      id: 'task-dep-8',
      title: 'Build API endpoint for user authentication and session management',
      description: 'Build API endpoint for user authentication and session management',
      status: 'todo',
      projectId: 'proj-8',
      metadata: { dependsOn: 'task-done-8' },
      assignee: null,
    };
    const storage = makeMockStorage([depTask]);
    const result = await orchestrateHandoff({
      completedTask: { id: 'task-done-8', title: 'Scope doc', description: 'Product scope document created', projectId: 'proj-8' },
      completedAgent: { id: 'agent-pm-001', name: 'Maya', role: 'Product Manager' },
      completedOutput: 'The scope document covers auth, sessions, and API design.',
      handoffChain: [],
      storage: storage as any,
      broadcastToConversation: makeBroadcast(),
    });
    assert(result.status === 'queued', 'Expected queued, got ' + result.status);
    assert(result.nextTaskId === 'task-dep-8', 'Expected nextTaskId task-dep-8, got ' + result.nextTaskId);
    const updated = storage.getUpdatedTask('task-dep-8') as any;
    assert(updated?.metadata?.previousAgentOutput != null, 'previousAgentOutput stored in metadata');
    assert(updated?.metadata?.previousAgentName === 'Maya', 'previousAgentName stored in metadata');
    assert(Array.isArray(updated?.metadata?.handoffChain), 'handoffChain stored in metadata');
  });

  console.log('\nResults: ' + passed + ' passed, ' + failed + ' failed out of ' + (passed + failed) + ' tests\n');
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => { console.error('Fatal:', err); process.exit(1); });
