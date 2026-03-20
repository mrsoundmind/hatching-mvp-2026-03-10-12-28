import { evaluateSafetyScore, AUTONOMOUS_SAFETY_THRESHOLDS } from '../../ai/safety.js';
import { getJobQueue } from './jobQueue.js';
import { BUDGETS } from '../config/policies.js';
import { logAutonomyEvent } from '../events/eventLogger.js';
import type { IStorage } from '../../storage.js';

export interface ExecuteTaskInput {
  task: { id: string; title: string; description: string | null; assignee: string | null; projectId: string };
  agent: { id: string; name: string; role: string; personality: unknown };
  project: { id: string; name: string; coreDirection: unknown; brain: unknown };
  conversationId: string;
  storage: IStorage;
  broadcastToConversation: (convId: string, payload: unknown) => void;
  generateText: (prompt: string, system: string, maxTokens?: number) => Promise<string>;
}

export async function executeTask(
  input: ExecuteTaskInput,
): Promise<{ status: 'completed' | 'pending_approval' | 'failed' }> {
  const output = await input.generateText(
    `Task: ${input.task.title}`,
    `You are a ${input.agent.role}.`,
  );

  const safety = evaluateSafetyScore({
    userMessage: input.task.description ?? input.task.title,
    draftResponse: output,
    conversationMode: 'project',
    projectName: input.project.name,
    executionContext: 'autonomous_task',
  });

  if (
    safety.executionRisk >= AUTONOMOUS_SAFETY_THRESHOLDS.clarificationRequiredRisk ||
    safety.scopeRisk >= AUTONOMOUS_SAFETY_THRESHOLDS.clarificationRequiredRisk
  ) {
    await input.storage.updateTask(input.task.id, {
      status: 'blocked',
      metadata: { awaitingApproval: true, draftOutput: output } as any,
    });
    input.broadcastToConversation(input.conversationId, {
      type: 'task_requires_approval',
      taskId: input.task.id,
      agentName: input.agent.name,
      riskReasons: safety.reasons,
    });
    return { status: 'pending_approval' };
  }

  await input.storage.createMessage({
    conversationId: input.conversationId,
    content: output,
    messageType: 'agent',
    agentId: input.agent.id,
    userId: null,
    metadata: { isAutonomous: true, taskId: input.task.id } as any,
  });

  await input.storage.updateTask(input.task.id, { status: 'completed' });

  // Log autonomy event so cost cap counter increments (EXEC-03)
  await logAutonomyEvent({
    eventType: 'autonomous_task_execution',
    projectId: input.task.projectId,
    hatchId: input.agent.id,
    conversationId: input.conversationId,
    confidence: 1.0,
    riskScore: null,
    latencyMs: null,
    mode: 'autonomous',
    provider: null,
    teamId: null,
    payload: { taskId: input.task.id, taskTitle: input.task.title, agentName: input.agent.name },
  });

  input.broadcastToConversation(input.conversationId, {
    type: 'task_execution_completed',
    taskId: input.task.id,
    agentId: input.agent.id,
    agentName: input.agent.name,
  });

  return { status: 'completed' };
}

export async function handleTaskJob(
  job: { data: { taskId: string; projectId: string; agentId: string } },
  deps: {
    storage: IStorage;
    broadcastToConversation: (convId: string, payload: unknown) => void;
    generateText: (prompt: string, system: string, maxTokens?: number) => Promise<string>;
  },
): Promise<void> {
  // Cost cap check first
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = await deps.storage.countAutonomyEventsForProjectToday(job.data.projectId, today);
  if (todayCount >= BUDGETS.maxBackgroundLlmCallsPerProjectPerDay) {
    return;
  }

  const [task, agents, project] = await Promise.all([
    deps.storage.getTask(job.data.taskId),
    deps.storage.getAgentsByProject(job.data.projectId),
    deps.storage.getProject(job.data.projectId),
  ]);
  if (!task || !project) return;
  const agent = agents.find((a) => a.id === job.data.agentId);
  if (!agent) return;

  const conversationId = `project:${job.data.projectId}`;

  deps.broadcastToConversation(conversationId, {
    type: 'background_execution_started',
    projectId: job.data.projectId,
    taskId: job.data.taskId,
    agentName: agent.name,
  });

  await executeTask({
    task: { id: task.id, title: task.title, description: task.description ?? null, assignee: task.assignee ?? null, projectId: task.projectId },
    agent: { id: agent.id, name: agent.name, role: agent.role, personality: agent.personality },
    project: { id: project.id, name: project.name, coreDirection: project.coreDirection, brain: project.brain },
    conversationId,
    storage: deps.storage,
    broadcastToConversation: deps.broadcastToConversation,
    generateText: deps.generateText,
  });
}

export async function startTaskWorker(deps: {
  storage: IStorage;
  broadcastToConversation: (convId: string, payload: unknown) => void;
  generateText: (prompt: string, system: string, maxTokens?: number) => Promise<string>;
}): Promise<void> {
  const boss = await getJobQueue();
  if (!boss) return;
  await boss.work('autonomous_task_execution', async (job) => {
    await handleTaskJob(job as any, deps);
  });
}
