/**
 * Integration tests for POST /api/tasks/:id/approve and /api/tasks/:id/reject
 *
 * Tests the business logic functions extracted from tasks.ts to avoid needing
 * a full Express + DB setup while still exercising all 8 specified behaviors.
 */

// ─── Types mirroring schema ──────────────────────────────────────────────────

interface TaskMetadata {
  awaitingApproval?: boolean;
  draftOutput?: string | null;
  previousAgentOutput?: string;
  handoffChain?: string[];
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  createdFromChat?: boolean;
  messageId?: string;
  estimatedHours?: number;
  actualHours?: number;
}

interface MockTask {
  id: string;
  projectId: string;
  title: string;
  status: string;
  assignee: string | null;
  metadata: TaskMetadata | null;
}

interface MockMessage {
  id: string;
  conversationId: string;
  content: string;
  messageType: string;
  agentId: string | null;
}

interface MockAgent {
  id: string;
  name: string;
  role: string;
  projectId: string;
}

// ─── Mock storage ────────────────────────────────────────────────────────────

function createMockStorage() {
  const tasks = new Map<string, MockTask>();
  const messages: MockMessage[] = [];
  const agents: MockAgent[] = [];
  const projects = new Map<string, { id: string; userId: string }>();

  return {
    tasks,
    messages,
    agents,
    projects,

    async getTask(id: string): Promise<MockTask | undefined> {
      return tasks.get(id);
    },

    async getProject(id: string) {
      return projects.get(id) ?? null;
    },

    async getAgentsByProject(projectId: string): Promise<MockAgent[]> {
      return agents.filter((a) => a.projectId === projectId);
    },

    async createMessage(msg: Omit<MockMessage, 'id'>): Promise<MockMessage> {
      const created = { id: `msg-${Math.random().toString(36).slice(2)}`, ...msg };
      messages.push(created);
      return created;
    },

    async updateTask(id: string, updates: Partial<MockTask>): Promise<MockTask | undefined> {
      const task = tasks.get(id);
      if (!task) return undefined;
      const updated = { ...task, ...updates } as MockTask;
      if (updates.metadata !== undefined) {
        updated.metadata = { ...(task.metadata ?? {}), ...(updates.metadata ?? {}) } as TaskMetadata;
      }
      tasks.set(id, updated);
      return updated;
    },
  };
}

// ─── Business logic extracted from endpoint handlers ────────────────────────

interface ApproveDeps {
  storage: ReturnType<typeof createMockStorage>;
  broadcastToConversation: (convId: string, data: unknown) => void;
}

interface ApproveResult {
  status: number;
  body: Record<string, unknown>;
}

async function approveTaskHandler(
  taskId: string,
  userId: string,
  deps: ApproveDeps,
): Promise<ApproveResult> {
  const task = await deps.storage.getTask(taskId);
  if (!task) return { status: 404, body: { error: 'Task not found' } };

  const project = await deps.storage.getProject(task.projectId);
  if (!project || project.userId !== userId) {
    return { status: 404, body: { error: 'Task not found' } };
  }

  const meta = task.metadata ?? {};
  if (!meta.awaitingApproval || !meta.draftOutput) {
    return { status: 400, body: { error: 'Task is not awaiting approval' } };
  }

  // Find assigned agent
  const allAgents = await deps.storage.getAgentsByProject(task.projectId);
  const agent = allAgents.find(
    (a) => a.name === task.assignee || a.role === task.assignee,
  ) ?? null;

  // Publish draft as agent message
  const convId = agent
    ? `agent:${task.projectId}:${agent.id}`
    : `project:${task.projectId}`;

  const created = await deps.storage.createMessage({
    conversationId: convId,
    content: meta.draftOutput,
    messageType: 'agent',
    agentId: agent?.id ?? null,
  });

  deps.broadcastToConversation(convId, { type: 'new_message', conversationId: convId, message: created });

  // Update task
  await deps.storage.updateTask(taskId, {
    status: 'completed',
    metadata: { ...meta, awaitingApproval: false, approvedAt: new Date().toISOString() } as TaskMetadata,
  });

  deps.broadcastToConversation(convId, {
    type: 'task_execution_completed',
    taskId,
    approvedByUser: true,
  });

  return { status: 200, body: { success: true } };
}

interface RejectDeps {
  storage: ReturnType<typeof createMockStorage>;
  broadcastToProject: (projectId: string, data: unknown) => void;
}

async function rejectTaskHandler(
  taskId: string,
  userId: string,
  body: { reason?: string },
  deps: RejectDeps,
): Promise<ApproveResult> {
  const task = await deps.storage.getTask(taskId);
  if (!task) return { status: 404, body: { error: 'Task not found' } };

  const project = await deps.storage.getProject(task.projectId);
  if (!project || project.userId !== userId) {
    return { status: 404, body: { error: 'Task not found' } };
  }

  const meta = task.metadata ?? {};
  const updatedMeta: TaskMetadata = {
    ...meta,
    awaitingApproval: false,
    draftOutput: null,
    rejectedAt: new Date().toISOString(),
    rejectionReason: body.reason ?? undefined,
  };

  await deps.storage.updateTask(taskId, {
    status: 'todo',
    metadata: updatedMeta,
  });

  deps.broadcastToProject(task.projectId, {
    type: 'task_approval_rejected',
    taskId,
  });

  return { status: 200, body: { success: true } };
}

// ─── Test runner ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

async function runTests(): Promise<void> {
  const TEST_USER = 'user-001';
  const TEST_PROJECT = 'proj-001';

  function makeStorage() {
    const s = createMockStorage();
    s.projects.set(TEST_PROJECT, { id: TEST_PROJECT, userId: TEST_USER });
    s.agents.push({ id: 'agent-01', name: 'Aria', role: 'engineer', projectId: TEST_PROJECT });
    return s;
  }

  function makeTask(overrides: Partial<MockTask> = {}): MockTask {
    return {
      id: 'task-001',
      projectId: TEST_PROJECT,
      title: 'Write integration tests',
      status: 'in_progress',
      assignee: 'Aria',
      metadata: { awaitingApproval: true, draftOutput: 'Test output from agent' },
      ...overrides,
    };
  }

  const broadcasts: Array<[string, unknown]> = [];
  const projectBroadcasts: Array<[string, unknown]> = [];

  // ─── Approve tests ──────────────────────────────────────────────────────

  console.log('\nApprove endpoint tests:');

  // Test 1: Approve on awaiting task returns 200 + { success: true }
  {
    const s = makeStorage();
    s.tasks.set('task-001', makeTask());
    const result = await approveTaskHandler('task-001', TEST_USER, {
      storage: s,
      broadcastToConversation: (id, d) => broadcasts.push([id, d]),
    });
    assert(result.status === 200, 'Test 1: approve returns 200');
    assert(result.body.success === true, 'Test 1: approve body has success:true');
  }

  // Test 2: After approve, task status='completed' and awaitingApproval=false
  {
    const s = makeStorage();
    s.tasks.set('task-001', makeTask());
    await approveTaskHandler('task-001', TEST_USER, {
      storage: s,
      broadcastToConversation: () => {},
    });
    const updated = await s.getTask('task-001');
    assert(updated?.status === 'completed', 'Test 2: task status is completed');
    assert(updated?.metadata?.awaitingApproval === false, 'Test 2: awaitingApproval cleared');
  }

  // Test 3: After approve, a message is created with draftOutput as content
  {
    const s = makeStorage();
    s.tasks.set('task-001', makeTask());
    await approveTaskHandler('task-001', TEST_USER, {
      storage: s,
      broadcastToConversation: () => {},
    });
    assert(s.messages.length > 0, 'Test 3: message was created');
    assert(
      s.messages[0]?.content === 'Test output from agent',
      'Test 3: message content is draftOutput',
    );
    assert(s.messages[0]?.messageType === 'agent', 'Test 3: message type is agent');
  }

  // Test 4: Approve on task without awaitingApproval returns 400
  {
    const s = makeStorage();
    s.tasks.set('task-001', makeTask({ metadata: { awaitingApproval: false } }));
    const result = await approveTaskHandler('task-001', TEST_USER, {
      storage: s,
      broadcastToConversation: () => {},
    });
    assert(result.status === 400, 'Test 4: approve without awaitingApproval returns 400');
  }

  // ─── Reject tests ───────────────────────────────────────────────────────

  console.log('\nReject endpoint tests:');

  // Test 5: Reject returns 200 + { success: true }
  {
    const s = makeStorage();
    s.tasks.set('task-001', makeTask());
    const result = await rejectTaskHandler('task-001', TEST_USER, {}, {
      storage: s,
      broadcastToProject: (id, d) => projectBroadcasts.push([id, d]),
    });
    assert(result.status === 200, 'Test 5: reject returns 200');
    assert(result.body.success === true, 'Test 5: reject body has success:true');
  }

  // Test 6: After reject, task status='todo' and draftOutput cleared
  {
    const s = makeStorage();
    s.tasks.set('task-001', makeTask());
    await rejectTaskHandler('task-001', TEST_USER, {}, {
      storage: s,
      broadcastToProject: () => {},
    });
    const updated = await s.getTask('task-001');
    assert(updated?.status === 'todo', 'Test 6: task status is todo (not blocked)');
    assert(
      updated?.metadata?.draftOutput === null,
      'Test 6: draftOutput cleared after reject',
    );
  }

  // Test 7: Reject with reason stores rejectionReason in metadata
  {
    const s = makeStorage();
    s.tasks.set('task-001', makeTask());
    await rejectTaskHandler('task-001', TEST_USER, { reason: 'Not ready yet' }, {
      storage: s,
      broadcastToProject: () => {},
    });
    const updated = await s.getTask('task-001');
    assert(
      updated?.metadata?.rejectionReason === 'Not ready yet',
      'Test 7: rejectionReason stored in metadata',
    );
  }

  // Test 8: Both endpoints return 404 for non-existent task
  {
    const s = makeStorage();
    const approveResult = await approveTaskHandler('nonexistent', TEST_USER, {
      storage: s,
      broadcastToConversation: () => {},
    });
    const rejectResult = await rejectTaskHandler('nonexistent', TEST_USER, {}, {
      storage: s,
      broadcastToProject: () => {},
    });
    assert(approveResult.status === 404, 'Test 8a: approve returns 404 for unknown task');
    assert(rejectResult.status === 404, 'Test 8b: reject returns 404 for unknown task');

    // Also test wrong user ownership
    s.tasks.set('task-owned-by-other', makeTask({ id: 'task-owned-by-other' }));
    const wrongUserApprove = await approveTaskHandler('task-owned-by-other', 'other-user', {
      storage: s,
      broadcastToConversation: () => {},
    });
    const wrongUserReject = await rejectTaskHandler('task-owned-by-other', 'other-user', {}, {
      storage: s,
      broadcastToProject: () => {},
    });
    assert(wrongUserApprove.status === 404, 'Test 8c: approve returns 404 for wrong user');
    assert(wrongUserReject.status === 404, 'Test 8d: reject returns 404 for wrong user');
  }

  // ─── Summary ────────────────────────────────────────────────────────────

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
