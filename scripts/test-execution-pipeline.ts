/**
 * Integration test suite for TaskExecutionPipeline (Plan 06-03).
 * Run: npx tsx scripts/test-execution-pipeline.ts
 *
 * Note (Phase 22): handleTaskJob tests (4, 5, 7) now need a real DB project
 * because reserveBudgetSlot uses pool.query with an FK constraint. These tests
 * create and tear down a test project via pool.query directly.
 */

import type { IStorage } from '../server/storage.js';
import type { Task, Message, Agent, Project } from '../shared/schema.js';
import { executeTask, handleTaskJob, startTaskWorker } from '../server/autonomy/execution/taskExecutionPipeline.js';
import { BUDGETS } from '../server/autonomy/config/policies.js';

// ─── Test project lifecycle (for handleTaskJob tests requiring real DB FK) ────
const TEST_PROJECT_ID = `test-pipeline-${Date.now()}`;
const TEST_USER_ID = `test-user-${Date.now()}`;

async function setupTestProject(): Promise<void> {
  const { pool } = await import('../server/db.js');
  const uniqueSuffix = Date.now();
  // Insert a minimal user + project so the FK constraint is satisfied.
  // provider_sub is NOT NULL UNIQUE — use a unique test value.
  await pool.query(
    `INSERT INTO users (id, email, name, tier, provider_sub)
     VALUES ($1, $2, $3, 'free', $4)
     ON CONFLICT (id) DO NOTHING`,
    [TEST_USER_ID, `test-pipeline-${uniqueSuffix}@test.example`, 'Test User', `test-pipeline-sub-${uniqueSuffix}`],
  );
  await pool.query(
    `INSERT INTO projects (id, user_id, name, emoji) VALUES ($1, $2, 'TestPipelineProject', '🧪')
     ON CONFLICT (id) DO NOTHING`,
    [TEST_PROJECT_ID, TEST_USER_ID],
  );
}

async function teardownTestProject(): Promise<void> {
  const { pool } = await import('../server/db.js');
  await pool.query(`DELETE FROM autonomy_daily_counters WHERE project_id = $1`, [TEST_PROJECT_ID]);
  await pool.query(`DELETE FROM projects WHERE id = $1`, [TEST_PROJECT_ID]);
  await pool.query(`DELETE FROM users WHERE id = $1`, [TEST_USER_ID]);
}

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
    title: 'Write authentication module plan',
    description: 'Plan the OAuth flow for the web application',
    status: 'todo',
    priority: 'medium',
    assignee: 'Engineer',
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
    name: 'Alex Engineer',
    role: 'Software Engineer',
    color: 'blue',
    teamId: 'team-001',
    projectId: 'project-001',
    personality: { traits: ['analytical'], communicationStyle: 'direct', expertise: ['backend'] },
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

/** Make a project that references the real DB project (for handleTaskJob tests) */
function makeRealProject(overrides: Partial<Project> = {}): Project {
  return makeProject({ id: TEST_PROJECT_ID, userId: TEST_USER_ID, ...overrides });
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

// ─── Test 1: Low-risk auto-execute ───────────────────────────────────────────
async function testLowRiskAutoExecute(): Promise<void> {
  console.log('\nTest 1: Low-risk auto-execute');

  const task = makeTask();
  const agent = makeAgent();
  const project = makeProject();
  const state: MockStorageState = {
    tasks: new Map([[task.id, task]]),
    messages: [],
    agents: [agent],
    project,
    autonomyEventCount: 0,
  };
  const storage = makeMockStorage(state);
  const broadcastEvents: Array<{ convId: string; payload: unknown }> = [];

  const generateText = async (_prompt: string, _system: string) =>
    'Here is the project plan for authentication using OAuth2 with PKCE flow.';

  const result = await executeTask({
    task: { id: task.id, title: task.title, description: task.description, assignee: task.assignee, projectId: task.projectId },
    agent: { id: agent.id, name: agent.name, role: agent.role, personality: agent.personality },
    project: { id: project.id, name: project.name, coreDirection: project.coreDirection, brain: project.brain },
    conversationId: `project:${project.id}`,
    storage,
    broadcastToConversation: (convId, payload) => broadcastEvents.push({ convId, payload }),
    generateText,
  });

  assert(result.status === 'completed', `status should be 'completed', got '${result.status}'`);

  const updatedTask = state.tasks.get(task.id);
  assert(updatedTask?.status === 'completed', `task status should be 'completed', got '${updatedTask?.status}'`);

  assert(state.messages.length > 0, 'a message should be stored');
  const msg = state.messages[0];
  assert((msg?.metadata as any)?.isAutonomous === true, 'message.metadata.isAutonomous should be true');

  const approvalEvents = broadcastEvents.filter((e) => (e.payload as any)?.type === 'task_requires_approval');
  assert(approvalEvents.length === 0, 'no task_requires_approval event for low-risk task');
}

// ─── Test 3: Backward check — no runTurn / graph.invoke ──────────────────────
async function testNoRunTurnOrGraphInvoke(): Promise<void> {
  console.log('\nTest 3: taskExecutionPipeline.ts does not use runTurn or graph.invoke');
  const { readFileSync } = await import('fs');
  const pipelinePath = new URL('../server/autonomy/execution/taskExecutionPipeline.ts', import.meta.url).pathname;
  const content = readFileSync(pipelinePath, 'utf-8');
  if (content.includes('runTurn')) {
    console.error('  FAIL: taskExecutionPipeline.ts must NOT contain "runTurn"');
    testsFailed++;
  } else {
    console.log('  PASS: no "runTurn" found');
    testsPassed++;
  }
  if (content.includes('graph.invoke')) {
    console.error('  FAIL: taskExecutionPipeline.ts must NOT contain "graph.invoke"');
    testsFailed++;
  } else {
    console.log('  PASS: no "graph.invoke" found');
    testsPassed++;
  }
}

// ─── Test 2: High-risk block ──────────────────────────────────────────────────
async function testHighRiskBlock(): Promise<void> {
  console.log('\nTest 2: High-risk block');

  const task = makeTask();
  const agent = makeAgent();
  const project = makeProject();
  const state: MockStorageState = {
    tasks: new Map([[task.id, task]]),
    messages: [],
    agents: [agent],
    project,
    autonomyEventCount: 0,
  };
  const storage = makeMockStorage(state);
  const broadcastEvents: Array<{ convId: string; payload: unknown }> = [];

  // Returns risky text that triggers high executionRisk
  const generateText = async (_p: string, _s: string) =>
    'I will delete production deploy and publish to all users now. Drop table users. Send to all users immediately.';

  const result = await executeTask({
    task: { id: task.id, title: task.title, description: task.description, assignee: task.assignee, projectId: task.projectId },
    agent: { id: agent.id, name: agent.name, role: agent.role, personality: agent.personality },
    project: { id: project.id, name: project.name, coreDirection: project.coreDirection, brain: project.brain },
    conversationId: `project:${project.id}`,
    storage,
    broadcastToConversation: (convId, payload) => broadcastEvents.push({ convId, payload }),
    generateText,
  });

  assert(result.status === 'pending_approval', `status should be 'pending_approval', got '${result.status}'`);

  const updatedTask = state.tasks.get(task.id);
  assert(updatedTask?.status === 'blocked', `task status should be 'blocked', got '${updatedTask?.status}'`);

  const approvalEvents = broadcastEvents.filter((e) => (e.payload as any)?.type === 'task_requires_approval');
  assert(approvalEvents.length > 0, 'task_requires_approval event should be broadcast');

  assert(state.messages.length === 0, 'no message should be stored for high-risk task');
}

// ─── Test 4: Cost cap enforcement ────────────────────────────────────────────
async function testCostCapEnforcement(): Promise<void> {
  console.log('\nTest 4: Cost cap enforcement — handleTaskJob skips when daily cap reached');
  // Use real DB project so reserveBudgetSlot FK constraint is satisfied.
  // Pre-fill the ledger to limit=0 (free tier with no slots) by using tierLimit=0.
  // The reservation will immediately fail (reserved_count >= limit_count when limit=0).
  const { pool } = await import('../server/db.js');
  const today = new Date().toISOString().slice(0, 10);
  // Ensure the ledger row exists at limit=0 (free tier — no autonomy allowed)
  await pool.query(
    `INSERT INTO autonomy_daily_counters (project_id, date, reserved_count, limit_count)
     VALUES ($1, $2, 0, 0)
     ON CONFLICT (project_id, date) DO UPDATE SET limit_count = 0, reserved_count = 0`,
    [TEST_PROJECT_ID, today],
  );

  const task = makeTask({ projectId: TEST_PROJECT_ID });
  const agent = makeAgent({ projectId: TEST_PROJECT_ID });
  const project = makeRealProject();
  let generateTextCalled = false;
  const state: MockStorageState = {
    tasks: new Map([[task.id, task]]), messages: [], agents: [agent], project,
    autonomyEventCount: 0,
  };
  const storage = makeMockStorage(state);
  const generateText = async () => { generateTextCalled = true; return 'should not run'; };

  await handleTaskJob(
    { data: { taskId: task.id, projectId: project.id, agentId: agent.id } },
    { storage, broadcastToConversation: () => {}, generateText },
  );

  // Clean up ledger row
  await pool.query(`DELETE FROM autonomy_daily_counters WHERE project_id = $1 AND date = $2`, [TEST_PROJECT_ID, today]);

  if (generateTextCalled) {
    console.error('  FAIL: generateText must NOT be called when daily cap is reached');
    testsFailed++;
  } else {
    console.log('  PASS: executeTask skipped when daily cap reached');
    testsPassed++;
  }
}

// ─── Test 5: WS event — background_execution_started ─────────────────────────
async function testBackgroundExecutionStartedEvent(): Promise<void> {
  console.log('\nTest 5: WS event — background_execution_started broadcast before executeTask');
  // Use real DB project so reserveBudgetSlot FK constraint is satisfied.
  const task = makeTask({ projectId: TEST_PROJECT_ID });
  const agent = makeAgent({ projectId: TEST_PROJECT_ID });
  const project = makeRealProject();
  const state: MockStorageState = {
    tasks: new Map([[task.id, task]]), messages: [], agents: [agent], project,
    autonomyEventCount: 0,
  };
  const storage = makeMockStorage(state);
  const broadcastEvents: Array<unknown> = [];
  const generateText = async () => 'Here is the authentication plan.';

  await handleTaskJob(
    { data: { taskId: task.id, projectId: project.id, agentId: agent.id } },
    { storage, broadcastToConversation: (_, p) => broadcastEvents.push(p), generateText },
  );

  const startedEvents = broadcastEvents.filter((e) => (e as any)?.type === 'background_execution_started');
  if (startedEvents.length === 0) {
    console.error('  FAIL: background_execution_started event must be broadcast');
    testsFailed++;
  } else {
    console.log('  PASS: background_execution_started event broadcast');
    testsPassed++;
  }
}

// ─── Test 6: WS event — task_execution_completed ─────────────────────────────
async function testTaskExecutionCompletedEvent(): Promise<void> {
  console.log('\nTest 6: WS event — task_execution_completed broadcast after low-risk completion');
  const task = makeTask();
  const agent = makeAgent();
  const project = makeProject();
  const state: MockStorageState = {
    tasks: new Map([[task.id, task]]), messages: [], agents: [agent], project,
    autonomyEventCount: 0,
  };
  const storage = makeMockStorage(state);
  const broadcastEvents: Array<unknown> = [];
  const generateText = async () => 'Here is the authentication plan with clear implementation details.';

  await executeTask({
    task: { id: task.id, title: task.title, description: task.description, assignee: task.assignee, projectId: task.projectId },
    agent: { id: agent.id, name: agent.name, role: agent.role, personality: agent.personality },
    project: { id: project.id, name: project.name, coreDirection: project.coreDirection, brain: project.brain },
    conversationId: `project:${project.id}`,
    storage,
    broadcastToConversation: (_, p) => broadcastEvents.push(p),
    generateText,
  });

  const completedEvents = broadcastEvents.filter((e) => (e as any)?.type === 'task_execution_completed');
  if (completedEvents.length === 0) {
    console.error('  FAIL: task_execution_completed event must be broadcast after completion');
    testsFailed++;
  } else {
    console.log('  PASS: task_execution_completed event broadcast');
    testsPassed++;
  }
  const evt = completedEvents[0] as any;
  if (evt?.taskId !== task.id) {
    console.error(`  FAIL: task_execution_completed.taskId should be '${task.id}', got '${evt?.taskId}'`);
    testsFailed++;
  } else {
    console.log('  PASS: task_execution_completed.taskId is correct');
    testsPassed++;
  }
}

// ─── Test 7: handleTaskJob calls executeTask when cap not reached ─────────────
async function testHandleTaskJobCallsExecuteTask(): Promise<void> {
  console.log('\nTest 7: handleTaskJob calls executeTask (task completes) when cap not reached');
  // Use real DB project so reserveBudgetSlot FK constraint is satisfied.
  const task = makeTask({ projectId: TEST_PROJECT_ID });
  const agent = makeAgent({ projectId: TEST_PROJECT_ID });
  const project = makeRealProject();
  const state: MockStorageState = {
    tasks: new Map([[task.id, task]]), messages: [], agents: [agent], project,
    autonomyEventCount: 0,
  };
  const storage = makeMockStorage(state);
  const broadcastEvents: Array<unknown> = [];
  const generateText = async () => 'Here is the authentication plan.';

  await handleTaskJob(
    { data: { taskId: task.id, projectId: project.id, agentId: agent.id } },
    { storage, broadcastToConversation: (_, p) => broadcastEvents.push(p), generateText },
  );

  if (state.tasks.get(task.id)?.status !== 'completed') {
    console.error(`  FAIL: task should be 'completed' after handleTaskJob, got '${state.tasks.get(task.id)?.status}'`);
    testsFailed++;
  } else {
    console.log('  PASS: handleTaskJob completed the task via executeTask');
    testsPassed++;
  }
}

// ─── Test 8: startTaskWorker is exported ─────────────────────────────────────
function testStartTaskWorkerExported(): void {
  console.log('\nTest 8: startTaskWorker is exported from taskExecutionPipeline');
  if (typeof startTaskWorker !== 'function') {
    console.error('  FAIL: startTaskWorker should be a function');
    testsFailed++;
  } else {
    console.log('  PASS: startTaskWorker is exported and is a function');
    testsPassed++;
  }
}

// ─── Test 9: startTaskWorker registers boss.work ─────────────────────────────
async function testStartTaskWorkerRegistersWork(): Promise<void> {
  console.log('\nTest 9: startTaskWorker registers boss.work for autonomous_task_execution');
  let registeredQueue: string | null = null;
  // Mock getJobQueue by checking the pipeline file contains boss.work call
  const { readFileSync } = await import('fs');
  const pipelinePath = new URL('../server/autonomy/execution/taskExecutionPipeline.ts', import.meta.url).pathname;
  const content = readFileSync(pipelinePath, 'utf-8');
  if (content.includes("boss.work('autonomous_task_execution'")) {
    console.log('  PASS: startTaskWorker contains boss.work(\'autonomous_task_execution\')');
    testsPassed++;
  } else {
    console.error('  FAIL: startTaskWorker must call boss.work(\'autonomous_task_execution\')');
    testsFailed++;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log('=== TaskExecutionPipeline Tests ===');

  // Create real DB project for handleTaskJob tests (Phase 22: reserveBudgetSlot needs real FK)
  await setupTestProject();

  try { await testLowRiskAutoExecute(); } catch (e) { console.error('  ERROR in Test 1:', e); testsFailed++; }
  try { await testHighRiskBlock(); } catch (e) { console.error('  ERROR in Test 2:', e); testsFailed++; }
  try { await testNoRunTurnOrGraphInvoke(); } catch (e) { console.error('  ERROR in Test 3:', e); testsFailed++; }
  try { await testCostCapEnforcement(); } catch (e) { console.error('  ERROR in Test 4:', e); testsFailed++; }
  try { await testBackgroundExecutionStartedEvent(); } catch (e) { console.error('  ERROR in Test 5:', e); testsFailed++; }
  try { await testTaskExecutionCompletedEvent(); } catch (e) { console.error('  ERROR in Test 6:', e); testsFailed++; }
  try { await testHandleTaskJobCallsExecuteTask(); } catch (e) { console.error('  ERROR in Test 7:', e); testsFailed++; }
  try { testStartTaskWorkerExported(); } catch (e) { console.error('  ERROR in Test 8:', e); testsFailed++; }
  try { await testStartTaskWorkerRegistersWork(); } catch (e) { console.error('  ERROR in Test 9:', e); testsFailed++; }

  // Clean up real DB project
  await teardownTestProject().catch((e) => console.error('  WARN: teardown failed (non-fatal):', e));

  console.log(`\n=== Results: ${testsPassed} passed, ${testsFailed} failed ===`);
  process.exit(testsFailed > 0 ? 1 : 0);
}

main().catch((err) => { console.error('Unexpected error:', err); process.exit(1); });
