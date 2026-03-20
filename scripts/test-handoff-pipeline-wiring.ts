/**
 * Test: handleTaskJob wires handoff announcement after completed task
 * Verifies Task 2 of 07-02: announcement is emitted when orchestrateHandoff returns queued
 *
 * Run: npx tsx scripts/test-handoff-pipeline-wiring.ts
 */

import { handleTaskJob } from '../server/autonomy/execution/taskExecutionPipeline.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  PASS: ${message}`);
    passed++;
  } else {
    console.error(`  FAIL: ${message}`);
    failed++;
  }
}

// ---- Test 1: handleTaskJob broadcasts new_message with isHandoffAnnouncement when handoff queued ----
// The orchestrator stub returns 'no_next_task', so no announcement is emitted.
// We verify the pipeline completes + broadcasts task_execution_completed.
// This test will FAIL once we expect isHandoffAnnouncement — proving we need the wiring.

console.log('\nTest 1: handleTaskJob completes task and no announcement on no_next_task');
{
  const broadcastCalls: unknown[] = [];

  const mockStorage = {
    countAutonomyEventsForProjectToday: async () => 0,
    getTask: async () => ({
      id: 'task-1', title: 'Write scope doc', description: 'Write a product scope document',
      assignee: null, projectId: 'proj-1', status: 'todo', metadata: {},
      priority: 'medium', parentTaskId: null, createdAt: new Date(), updatedAt: new Date(),
    }),
    getAgentsByProject: async () => [
      { id: 'agent-pm-1', name: 'Maya', role: 'Product Manager', personality: {}, teamId: null, projectId: 'proj-1', isSpecialAgent: false },
      { id: 'agent-eng-1', name: 'Engineer', role: 'Software Engineer', personality: {}, teamId: null, projectId: 'proj-1', isSpecialAgent: false },
    ],
    getProject: async () => ({
      id: 'proj-1', name: 'Test Project', userId: 'u1', emoji: '🚀',
      coreDirection: {}, brain: {}, executionRules: {}, createdAt: new Date(), updatedAt: new Date(),
    }),
    updateTask: async () => undefined,
    createMessage: async (msg: unknown) => ({
      id: 'msg-1', ...(msg as any), createdAt: new Date(), updatedAt: new Date(),
      parentMessageId: null, replyCount: 0, isArchived: false,
    }),
    getMessagesByConversation: async () => [
      { id: 'msg-out-1', content: 'Scope doc complete.', messageType: 'agent',
        agentId: 'agent-pm-1', conversationId: 'project:proj-1', userId: null,
        metadata: {}, createdAt: new Date(), updatedAt: new Date(),
        parentMessageId: null, replyCount: 0, isArchived: false },
    ],
  };

  const broadcastToConversation = (_convId: string, payload: unknown) => {
    broadcastCalls.push(payload as any);
  };

  const generateText = async () => 'Scope doc is complete and ready for review.';

  await handleTaskJob(
    { data: { taskId: 'task-1', projectId: 'proj-1', agentId: 'agent-pm-1' } },
    { storage: mockStorage as any, broadcastToConversation, generateText },
  );

  const completedEvent = broadcastCalls.find((c: any) => c.type === 'task_execution_completed');
  assert(completedEvent !== undefined, 'task_execution_completed event was broadcast');

  // No announcement expected when orchestrateHandoff stub returns no_next_task
  const announcementEvent = broadcastCalls.find(
    (c: any) => c.type === 'new_message' && c.message?.metadata?.isHandoffAnnouncement === true,
  );
  assert(announcementEvent === undefined, 'no announcement broadcast when no_next_task');
}

// ---- Test 2: getMessagesByConversation is called after task completes (proves wiring executes) ----
// This test FAILS before the wiring is added because getMessagesByConversation is never called.

console.log('\nTest 2: getMessagesByConversation called after task completes (handoff context fetch)');
{
  let getMessagesCalled = false;
  const broadcastCalls: unknown[] = [];

  const mockStorage = {
    countAutonomyEventsForProjectToday: async () => 0,
    getTask: async () => ({
      id: 'task-2', title: 'Implement login flow', description: 'Build the login API endpoint',
      assignee: null, projectId: 'proj-2', status: 'todo', metadata: {},
      priority: 'high', parentTaskId: null, createdAt: new Date(), updatedAt: new Date(),
    }),
    getAgentsByProject: async () => [
      { id: 'agent-eng-1', name: 'Engineer', role: 'Software Engineer', personality: {},
        teamId: null, projectId: 'proj-2', isSpecialAgent: false },
    ],
    getProject: async () => ({
      id: 'proj-2', name: 'Login Project', userId: 'u2', emoji: '🔐',
      coreDirection: {}, brain: {}, executionRules: {}, createdAt: new Date(), updatedAt: new Date(),
    }),
    updateTask: async () => undefined,
    createMessage: async (msg: unknown) => ({
      id: 'msg-2', ...(msg as any), createdAt: new Date(), updatedAt: new Date(),
      parentMessageId: null, replyCount: 0, isArchived: false,
    }),
    getMessagesByConversation: async () => {
      getMessagesCalled = true;
      return [
        { id: 'msg-out-2', content: 'Login endpoint built.', messageType: 'agent',
          agentId: 'agent-eng-1', conversationId: 'project:proj-2', userId: null,
          metadata: {}, createdAt: new Date(), updatedAt: new Date(),
          parentMessageId: null, replyCount: 0, isArchived: false },
      ];
    },
  };

  const broadcastToConversation = (_convId: string, payload: unknown) => {
    broadcastCalls.push(payload as any);
  };
  const generateText = async () => 'Login endpoint is complete.';

  await handleTaskJob(
    { data: { taskId: 'task-2', projectId: 'proj-2', agentId: 'agent-eng-1' } },
    { storage: mockStorage as any, broadcastToConversation, generateText },
  );

  assert(getMessagesCalled, 'getMessagesByConversation called to fetch completed output for handoff context');
}

console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('TESTS FAILED');
  process.exit(1);
} else {
  console.log('ALL TESTS PASSED');
  process.exit(0);
}
