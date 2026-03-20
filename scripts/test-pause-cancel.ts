/**
 * Test suite for UX-04: Pause/Cancel autonomous execution.
 * Verifies that handleTaskJob short-circuits when project.executionRules.autonomyPaused === true.
 * Run: npx tsx scripts/test-pause-cancel.ts
 */

import type { IStorage } from '../server/storage.js';
import type { Task, Message, Agent, Project } from '../shared/schema.js';
import { handleTaskJob } from '../server/autonomy/execution/taskExecutionPipeline.js';
import { BUDGETS } from '../server/autonomy/config/policies.js';

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`  FAIL: ${message}`);
    testsFailed++;
  } else {
    console.log(`  PASS: ${message}`);
    testsPassed++;
  }
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-001',
    projectId: 'project-001',
    title: 'Write a concise project summary',
    description: 'Summarize current project goals in one paragraph',
    status: 'todo',
    priority: 'medium',
    assignee: 'Product Manager',
    parentTaskId: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: 'agent-001',
    userId: 'user-001',
    name: 'Jordan PM',
    role: 'Product Manager',
    color: 'blue',
    teamId: 'team-001',
    projectId: 'project-001',
    personality: { traits: ['organized'], communicationStyle: 'clear', expertise: ['product'] },
    isSpecialAgent: false,
    ...overrides,
  };
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'project-001',
    userId: 'user-001',
    name: 'HatchApp',
    emoji: '🚀',
    description: 'AI collaboration platform',
    color: 'blue',
    isExpanded: true,
    progress: 10,
    timeSpent: '0h',
    coreDirection: { whatBuilding: 'AI team collaboration tool', whyMatters: 'Async AI teammates', whoFor: 'Startup founders' },
    executionRules: null,
    teamCulture: null,
    brain: { documents: [], sharedMemory: '' },
    ...overrides,
  };
}

interface MockStorageState {
  tasks: Map<string, Task>;
  messages: Message[];
  agents: Agent[];
  project: Project;
  autonomyEventCount: number;
}

function makeMockStorage(state: MockStorageState): IStorage {
  return {
    getTask: async (id: string) => state.tasks.get(id),
    updateTask: async (id: string, updates: Partial<Task>) => {
      const existing = state.tasks.get(id);
      if (!existing) return undefined;
      const updated = { ...existing, ...updates } as Task;
      state.tasks.set(id, updated);
      return updated;
    },
    createMessage: async (msg: any) => {
      const created: Message = {
        id: `msg-${Date.now()}`,
        conversationId: msg.conversationId,
        content: msg.content,
        messageType: msg.messageType ?? 'agent',
        agentId: msg.agentId ?? null,
        userId: msg.userId ?? null,
        metadata: msg.metadata ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      state.messages.push(created);
      return created;
    },
    getProject: async (id: string) => state.project.id === id ? state.project : undefined,
    getAgentsByProject: async (_projectId: string) => state.agents,
    countAutonomyEventsForProjectToday: async (_projectId: string, _dateStr: string) => state.autonomyEventCount,
    getUser: async () => undefined,
    getUserByEmail: async () => undefined,
    getUserByProviderSub: async () => undefined,
    getUserByUsername: async () => undefined,
    createUser: async () => { throw new Error('not implemented'); },
    upsertOAuthUser: async () => { throw new Error('not implemented'); },
    getProjects: async () => [],
    createProject: async () => { throw new Error('not implemented'); },
    updateProject: async () => undefined,
    deleteProject: async () => false,
    getTeams: async () => [],
    getTeamsByProject: async () => [],
    getTeam: async () => undefined,
    createTeam: async () => { throw new Error('not implemented'); },
    updateTeam: async () => undefined,
    deleteTeam: async () => false,
    getAgents: async () => [],
    getAgentsByTeam: async () => [],
    getAgent: async () => undefined,
    createAgent: async () => { throw new Error('not implemented'); },
    updateAgent: async () => undefined,
    deleteAgent: async () => false,
    initializeIdeaProject: async () => {},
    initializeStarterPackProject: async () => {},
    archiveConversation: async () => false,
    unarchiveConversation: async () => false,
    getArchivedConversations: async () => [],
    deleteConversation: async () => false,
    getTasksByProject: async () => [],
    getTasksByAssignee: async () => [],
    createTask: async () => { throw new Error('not implemented'); },
    deleteTask: async () => false,
    getConversationsByProject: async () => [],
    createConversation: async () => { throw new Error('not implemented'); },
    getMessagesByConversation: async () => [],
    getMessage: async () => undefined,
    setTypingIndicator: async () => {},
    addMessageReaction: async () => { throw new Error('not implemented'); },
    getMessageReactions: async () => [],
    storeFeedback: async () => {},
    addConversationMemory: async () => {},
    getConversationMemory: async () => [],
    getProjectMemory: async () => [],
    getSharedMemoryForAgent: async () => '',
    hasConversation: async () => false,
    createConversationMemory: async () => ({}),
    getRelevantProjectMemories: async () => [],
    getLastProactiveOutreachAt: async () => null,
    setLastProactiveOutreachAt: async () => {},
  } as IStorage;
}

// ─── Test 1: handleTaskJob returns early when autonomyPaused === true ──────────
async function testPausedSkipsExecution(): Promise<void> {
  console.log('\nTest 1: handleTaskJob returns early (does not call generateText) when autonomyPaused === true');

  const task = makeTask();
  const agent = makeAgent();
  const project = makeProject({
    executionRules: { autonomyPaused: true } as any,
  });

  let generateTextCalled = false;
  const state: MockStorageState = {
    tasks: new Map([[task.id, task]]),
    messages: [],
    agents: [agent],
    project,
    autonomyEventCount: 0,
  };
  const storage = makeMockStorage(state);
  const generateText = async () => {
    generateTextCalled = true;
    return 'should never be reached';
  };

  await handleTaskJob(
    { data: { taskId: task.id, projectId: project.id, agentId: agent.id } },
    { storage, broadcastToConversation: () => {}, generateText },
  );

  assert(!generateTextCalled, 'generateText must NOT be called when autonomyPaused === true');
  assert(state.messages.length === 0, 'no message should be stored when paused');
  const taskState = state.tasks.get(task.id);
  assert(taskState?.status === 'todo', `task status must remain 'todo' when paused, got '${taskState?.status}'`);
}

// ─── Test 2: handleTaskJob proceeds normally when autonomyPaused === false ─────
async function testNotPausedProceedsNormally(): Promise<void> {
  console.log('\nTest 2: handleTaskJob proceeds normally when autonomyPaused === false');

  const task = makeTask();
  const agent = makeAgent();
  const project = makeProject({
    executionRules: { autonomyPaused: false } as any,
  });

  let generateTextCalled = false;
  const state: MockStorageState = {
    tasks: new Map([[task.id, task]]),
    messages: [],
    agents: [agent],
    project,
    autonomyEventCount: 0,
  };
  const storage = makeMockStorage(state);
  const generateText = async () => {
    generateTextCalled = true;
    return 'Here is a helpful project summary for the team to review.';
  };

  await handleTaskJob(
    { data: { taskId: task.id, projectId: project.id, agentId: agent.id } },
    { storage, broadcastToConversation: () => {}, generateText },
  );

  assert(generateTextCalled, 'generateText must be called when autonomyPaused === false');
  const taskState = state.tasks.get(task.id);
  assert(taskState?.status === 'completed', `task should be 'completed', got '${taskState?.status}'`);
}

// ─── Test 3: handleTaskJob proceeds normally when executionRules is null ───────
async function testUndefinedPausedProceedsNormally(): Promise<void> {
  console.log('\nTest 3: handleTaskJob proceeds normally when executionRules.autonomyPaused is undefined');

  const task = makeTask();
  const agent = makeAgent();
  const project = makeProject({
    executionRules: null, // no executionRules at all
  });

  let generateTextCalled = false;
  const state: MockStorageState = {
    tasks: new Map([[task.id, task]]),
    messages: [],
    agents: [agent],
    project,
    autonomyEventCount: 0,
  };
  const storage = makeMockStorage(state);
  const generateText = async () => {
    generateTextCalled = true;
    return 'Here is the project summary for review.';
  };

  await handleTaskJob(
    { data: { taskId: task.id, projectId: project.id, agentId: agent.id } },
    { storage, broadcastToConversation: () => {}, generateText },
  );

  assert(generateTextCalled, 'generateText must be called when autonomyPaused is undefined');
  const taskState = state.tasks.get(task.id);
  assert(taskState?.status === 'completed', `task should be 'completed', got '${taskState?.status}'`);
}

// ─── Test 4: Cost cap still enforced even when not paused ─────────────────────
async function testCostCapStillEnforced(): Promise<void> {
  console.log('\nTest 4: Cost cap still enforced when autonomyPaused === false but daily cap reached');

  const task = makeTask();
  const agent = makeAgent();
  const project = makeProject({
    executionRules: { autonomyPaused: false } as any,
  });

  let generateTextCalled = false;
  const state: MockStorageState = {
    tasks: new Map([[task.id, task]]),
    messages: [],
    agents: [agent],
    project,
    autonomyEventCount: BUDGETS.maxBackgroundLlmCallsPerProjectPerDay,
  };
  const storage = makeMockStorage(state);
  const generateText = async () => {
    generateTextCalled = true;
    return 'should not be called';
  };

  await handleTaskJob(
    { data: { taskId: task.id, projectId: project.id, agentId: agent.id } },
    { storage, broadcastToConversation: () => {}, generateText },
  );

  assert(!generateTextCalled, 'generateText must NOT be called when daily cap is reached (even if not paused)');
  const taskState = state.tasks.get(task.id);
  assert(taskState?.status === 'todo', `task status must remain 'todo' when cap exceeded, got '${taskState?.status}'`);
}

// ─── Test 5: Schema type includes autonomyPaused ──────────────────────────────
async function testSchemaTypeHasAutonomyPaused(): Promise<void> {
  console.log('\nTest 5: shared/schema.ts executionRules type includes autonomyPaused');
  const { readFileSync } = await import('fs');
  const schemaPath = new URL('../shared/schema.ts', import.meta.url).pathname;
  const content = readFileSync(schemaPath, 'utf-8');
  assert(
    content.includes('autonomyPaused?: boolean'),
    'shared/schema.ts must declare autonomyPaused?: boolean in executionRules type',
  );
}

// ─── Test 6: Pipeline source code has the autonomyPaused guard ────────────────
async function testPipelineSourceHasGuard(): Promise<void> {
  console.log('\nTest 6: taskExecutionPipeline.ts source contains autonomyPaused guard');
  const { readFileSync } = await import('fs');
  const pipelinePath = new URL('../server/autonomy/execution/taskExecutionPipeline.ts', import.meta.url).pathname;
  const content = readFileSync(pipelinePath, 'utf-8');
  assert(
    content.includes('autonomyPaused'),
    'taskExecutionPipeline.ts must contain autonomyPaused guard',
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log('=== Pause/Cancel Autonomous Execution Tests (UX-04) ===');

  try { await testPausedSkipsExecution(); } catch (e) { console.error('  ERROR in Test 1:', e); testsFailed++; }
  try { await testNotPausedProceedsNormally(); } catch (e) { console.error('  ERROR in Test 2:', e); testsFailed++; }
  try { await testUndefinedPausedProceedsNormally(); } catch (e) { console.error('  ERROR in Test 3:', e); testsFailed++; }
  try { await testCostCapStillEnforced(); } catch (e) { console.error('  ERROR in Test 4:', e); testsFailed++; }
  try { await testSchemaTypeHasAutonomyPaused(); } catch (e) { console.error('  ERROR in Test 5:', e); testsFailed++; }
  try { await testPipelineSourceHasGuard(); } catch (e) { console.error('  ERROR in Test 6:', e); testsFailed++; }

  console.log(`\n=== Results: ${testsPassed} passed, ${testsFailed} failed ===`);
  process.exit(testsFailed > 0 ? 1 : 0);
}

main().catch((err) => { console.error('Unexpected error:', err); process.exit(1); });
