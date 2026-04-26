import { evaluateSafetyScore, AUTONOMOUS_SAFETY_THRESHOLDS } from '../../ai/safety.js';
import { getJobQueue } from './jobQueue.js';
import { BUDGETS, getTierBudgets } from '../config/policies.js';
import { reserveBudgetSlot, releaseBudgetSlot } from './budgetLedger.js';
import { logAutonomyEvent } from '../events/eventLogger.js';
import { orchestrateHandoff } from '../handoff/handoffOrchestrator.js';
import { emitHandoffAnnouncement } from '../handoff/handoffAnnouncement.js';
import { runPeerReview } from '../peerReview/peerReviewRunner.js';
import { updateTrustMeta } from '../trustScoring/trustScorer.js';
import { getAdjustedThresholds } from '../trustScoring/trustAdapter.js';
import { getRoleIntelligence } from '@shared/roleIntelligence';
import type { IStorage } from '../../storage.js';
import { recordUsage } from '../../billing/usageTracker.js';

/**
 * Role-aware risk adjustment: some roles should escalate at lower thresholds
 * (e.g., database migrations) while others can handle more autonomously
 * (e.g., content drafting).
 *
 * Returns a multiplier applied to the maxRisk score. Values > 1.0 make the role
 * MORE sensitive (escalate sooner), values < 1.0 make it LESS sensitive.
 */
function getRoleRiskMultiplier(role: string, taskDescription: string): number {
  const intelligence = getRoleIntelligence(role);
  if (!intelligence?.escalationRules) return 1.0;

  const rules = intelligence.escalationRules.toLowerCase();
  const task = taskDescription.toLowerCase();

  // Roles with database/infrastructure/deployment concerns escalate sooner
  if (/migration|schema|database|infrastructure|production deploy/i.test(rules)) {
    if (/migrat|schema|deploy|production|database|infra/i.test(task)) {
      return 1.3; // 30% more sensitive for high-impact infra tasks
    }
  }

  // Roles with external-facing / legal / financial concerns escalate sooner
  if (/legal|compliance|financial|external|public/i.test(rules)) {
    if (/legal|compliance|contract|financ|public|external/i.test(task)) {
      return 1.25;
    }
  }

  // Content/design/creative roles can handle more autonomously for drafting
  if (/draft|creative|content|design|exploration/i.test(rules)) {
    if (/draft|sketch|explore|brainstorm|concept|write/i.test(task)) {
      return 0.8; // 20% less sensitive for exploratory/creative work
    }
  }

  return 1.0;
}

export interface ExecuteTaskInput {
  task: { id: string; title: string; description: string | null; assignee: string | null; projectId: string };
  agent: { id: string; name: string; role: string; personality: unknown };
  project: { id: string; name: string; coreDirection: unknown; brain: unknown };
  conversationId: string;
  storage: IStorage;
  broadcastToConversation: (convId: string, payload: unknown) => void;
  generateText: (prompt: string, system: string, maxTokens?: number) => Promise<string>;
}

// ── 6.3: Background Task Batching ──
// Queue same-agent tasks and batch up to 3 into a single LLM call.
// System prompt is amortized across tasks, saving ~30-50% on batched calls.
const BATCH_MAX = 3;
const BATCH_WAIT_MS = 5_000; // Wait up to 5s to collect tasks
type BatchResult = { status: 'completed' | 'pending_approval' | 'failed' };
type PendingBatch = {
  agentId: string;
  tasks: ExecuteTaskInput[];
  timer: ReturnType<typeof setTimeout>;
  resolvers: Array<(result: BatchResult) => void>;
};
const pendingBatches = new Map<string, PendingBatch>();

/**
 * Queue a task for batched execution. Groups same-agent tasks into a single LLM call.
 * Falls back to single execution if batching fails.
 */
export async function queueForBatch(
  input: ExecuteTaskInput,
): Promise<{ status: 'completed' | 'pending_approval' | 'failed' }> {
  const key = input.agent.id;
  const existing = pendingBatches.get(key);

  if (existing && existing.tasks.length < BATCH_MAX) {
    // Add to existing batch — each task gets its own resolver
    existing.tasks.push(input);
    const idx = existing.tasks.length - 1;

    return new Promise<{ status: 'completed' | 'pending_approval' | 'failed' }>((resolve) => {
      existing.resolvers.push(resolve);

      if (existing.tasks.length >= BATCH_MAX) {
        // Batch is full — fire immediately
        clearTimeout(existing.timer);
        const batch = pendingBatches.get(key);
        if (batch) {
          pendingBatches.delete(key);
          executeBatchedTasks(batch.tasks).then((results) => {
            batch.resolvers.forEach((r, i) => r(results[i] ?? { status: 'failed' }));
          }).catch(() => {
            batch.resolvers.forEach((r) => r({ status: 'failed' }));
          });
        }
      }
    });
  }

  // Start a new batch
  return new Promise<{ status: 'completed' | 'pending_approval' | 'failed' }>((resolve) => {
    const timer = setTimeout(async () => {
      const batch = pendingBatches.get(key);
      if (!batch) return;
      pendingBatches.delete(key);
      try {
        const results = await executeBatchedTasks(batch.tasks);
        batch.resolvers.forEach((r, i) => r(results[i] ?? { status: 'failed' }));
      } catch {
        batch.resolvers.forEach((r) => r({ status: 'failed' }));
      }
    }, BATCH_WAIT_MS);

    pendingBatches.set(key, {
      agentId: key,
      tasks: [input],
      timer,
      resolvers: [resolve],
    });
  });
}

/**
 * Execute multiple tasks for the same agent in a single LLM call.
 * Falls back to individual execution on parse failure.
 */
async function executeBatchedTasks(
  inputs: ExecuteTaskInput[],
): Promise<Array<{ status: 'completed' | 'pending_approval' | 'failed' }>> {
  if (inputs.length === 1) {
    return [await executeTask(inputs[0])];
  }

  const firstInput = inputs[0];
  const taskList = inputs.map((inp, i) => `TASK_${i + 1}: ${inp.task.title}`).join('\n');
  const systemPrompt = `You are a ${firstInput.agent.role}. Complete each task below and return your response as a JSON array with exactly ${inputs.length} objects, each having a "taskIndex" (1-based) and "output" (string) field. Example: [{"taskIndex":1,"output":"..."},{"taskIndex":2,"output":"..."}]`;

  try {
    const raw = await firstInput.generateText(taskList, systemPrompt, 800);

    // Try to parse batched response
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array in batched response');

    const parsed = JSON.parse(jsonMatch[0]) as Array<{ taskIndex: number; output: string }>;
    if (!Array.isArray(parsed) || parsed.length !== inputs.length) throw new Error('Batch size mismatch');

    // Process each task result through the normal safety pipeline
    const results: Array<{ status: 'completed' | 'pending_approval' | 'failed' }> = [];
    for (let i = 0; i < inputs.length; i++) {
      const taskOutput = parsed.find((p) => p.taskIndex === i + 1)?.output;
      if (!taskOutput?.trim()) {
        results.push({ status: 'failed' });
        continue;
      }
      // Run through executeTask's safety pipeline with pre-generated output
      results.push(await executeTaskWithOutput(inputs[i], taskOutput));
    }

    console.log(`[Batch] Executed ${inputs.length} tasks for ${firstInput.agent.role} in 1 LLM call`);
    return results;
  } catch {
    // Fallback: execute individually
    console.warn(`[Batch] Parse failed, falling back to individual execution for ${inputs.length} tasks`);
    return Promise.all(inputs.map((inp) => executeTask(inp)));
  }
}

/**
 * Run safety + peer review + storage pipeline with a pre-generated output.
 * Used by batched execution to avoid redundant LLM calls.
 */
async function executeTaskWithOutput(
  input: ExecuteTaskInput,
  output: string,
): Promise<{ status: 'completed' | 'pending_approval' | 'failed' }> {
  if (!output.trim()) return { status: 'failed' };

  const safety = evaluateSafetyScore({
    userMessage: input.task.description ?? input.task.title,
    draftResponse: output,
    conversationMode: 'project',
    projectName: input.project.name,
    executionContext: 'autonomous_task',
  });

  const agentTrustScore = getAgentTrustScore(input.agent.personality);
  const thresholds = getAdjustedThresholds(agentTrustScore);
  const roleMultiplier = getRoleRiskMultiplier(input.agent.role, input.task.description ?? input.task.title);
  const adjustedExecutionRisk = Math.min(1.0, safety.executionRisk * roleMultiplier);
  const adjustedScopeRisk = Math.min(1.0, safety.scopeRisk * roleMultiplier);
  const adjustedHallucinationRisk = Math.min(1.0, safety.hallucinationRisk * roleMultiplier);

  if (
    adjustedExecutionRisk >= thresholds.clarificationRequiredRisk ||
    adjustedScopeRisk >= thresholds.clarificationRequiredRisk ||
    adjustedHallucinationRisk >= thresholds.clarificationRequiredRisk
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

  // Peer review gate for batched tasks (same as executeTask)
  const maxRisk = Math.max(adjustedExecutionRisk, adjustedScopeRisk, adjustedHallucinationRisk);
  let finalOutput = output;
  let peerReviewed = false;

  if (maxRisk >= thresholds.peerReviewTrigger) {
    const projectAgents = await input.storage.getAgentsByProject(input.task.projectId);
    const reviewers = projectAgents
      .filter((a) => a.id !== input.agent.id)
      .map((a) => ({ id: a.id, name: a.name, role: a.role }));

    try {
      const peerResult = await runPeerReview({
        projectId: input.task.projectId,
        conversationId: input.conversationId,
        primaryHatchId: input.agent.id,
        primaryHatchRole: input.agent.role,
        reviewers,
        provider: 'autonomous',
        mode: 'autonomous',
        confidence: 1.0 - maxRisk,
        riskScore: maxRisk,
        userMessage: input.task.description ?? input.task.title,
        draftResponse: output,
        projectName: input.project.name,
      });

      if (peerResult?.clarificationRequired) {
        await input.storage.updateTask(input.task.id, {
          status: 'blocked',
          metadata: { awaitingApproval: true, draftOutput: output, peerReviewBlocked: true, batched: true } as any,
        });
        input.broadcastToConversation(input.conversationId, {
          type: 'task_requires_approval',
          taskId: input.task.id,
          agentName: input.agent.name,
          riskReasons: peerResult.reason,
        });
        return { status: 'pending_approval' };
      }

      if (peerResult?.revisedContent) {
        finalOutput = peerResult.revisedContent;
      }
      peerReviewed = true;
    } catch {
      console.warn(`[Pipeline] Peer review failed for batched task ${input.task.id} — proceeding without review`);
    }
  }

  // Store and broadcast
  const storedMsg = await input.storage.createMessage({
    conversationId: input.conversationId,
    content: finalOutput,
    messageType: 'agent',
    agentId: input.agent.id,
    userId: null,
    metadata: { isAutonomous: true, taskId: input.task.id, batched: true, peerReviewed } as any,
  });

  input.broadcastToConversation(input.conversationId, {
    type: 'new_message',
    conversationId: input.conversationId,
    message: storedMsg,
  });

  await input.storage.updateTask(input.task.id, { status: 'completed' });

  await logAutonomyEvent({
    eventType: 'autonomous_task_execution',
    projectId: input.task.projectId,
    hatchId: input.agent.id,
    conversationId: input.conversationId,
    confidence: 1.0,
    riskScore: maxRisk,
    latencyMs: null,
    mode: 'autonomous',
    provider: null,
    teamId: null,
    payload: { taskId: input.task.id, taskTitle: input.task.title, agentName: input.agent.name, batched: true, peerReviewed },
  });

  input.broadcastToConversation(input.conversationId, {
    type: 'task_execution_completed',
    taskId: input.task.id,
    agentId: input.agent.id,
    agentName: input.agent.name,
  });

  await updateAgentTrustScore(input.storage, input.agent.id, true);
  return { status: 'completed' };
}

export async function executeTask(
  input: ExecuteTaskInput,
): Promise<{ status: 'completed' | 'pending_approval' | 'failed' }> {
  const output = await input.generateText(
    `Task: ${input.task.title}`,
    `You are a ${input.agent.role}.`,
  );

  // Guard against empty LLM output — don't store blank messages
  if (!output || !output.trim()) {
    return { status: 'failed' };
  }

  const safety = evaluateSafetyScore({
    userMessage: input.task.description ?? input.task.title,
    draftResponse: output,
    conversationMode: 'project',
    projectName: input.project.name,
    executionContext: 'autonomous_task',
  });

  // SAFE-04: Get trust-adjusted thresholds for this agent
  const agentTrustScore = getAgentTrustScore(input.agent.personality);
  const thresholds = getAdjustedThresholds(agentTrustScore);

  // Role-aware risk adjustment: multiply risk by role-specific sensitivity
  const roleMultiplier = getRoleRiskMultiplier(input.agent.role, input.task.description ?? input.task.title);
  const adjustedExecutionRisk = Math.min(1.0, safety.executionRisk * roleMultiplier);
  const adjustedScopeRisk = Math.min(1.0, safety.scopeRisk * roleMultiplier);
  const adjustedHallucinationRisk = Math.min(1.0, safety.hallucinationRisk * roleMultiplier);

  if (
    adjustedExecutionRisk >= thresholds.clarificationRequiredRisk ||
    adjustedScopeRisk >= thresholds.clarificationRequiredRisk ||
    adjustedHallucinationRisk >= thresholds.clarificationRequiredRisk
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

  // SAFE-03: Mid-risk peer review gate (peerReviewTrigger <= risk < clarificationRequiredRisk)
  const maxRisk = Math.max(adjustedExecutionRisk, adjustedScopeRisk, adjustedHallucinationRisk);
  if (maxRisk >= thresholds.peerReviewTrigger) {
    const projectAgents = await input.storage.getAgentsByProject(input.task.projectId);
    const reviewers = projectAgents
      .filter((a) => a.id !== input.agent.id)
      .map((a) => ({ id: a.id, name: a.name, role: a.role }));

    let peerResult: Awaited<ReturnType<typeof runPeerReview>> | null = null;
    try {
      peerResult = await runPeerReview({
        projectId: input.task.projectId,
        conversationId: input.conversationId,
        primaryHatchId: input.agent.id,
        primaryHatchRole: input.agent.role,
        reviewers,
        provider: 'autonomous',
        mode: 'autonomous',
        confidence: 1.0 - maxRisk,
        riskScore: maxRisk,
        userMessage: input.task.description ?? input.task.title,
        draftResponse: output,
        projectName: input.project.name,
      });
    } catch (peerReviewErr) {
      // Peer review infrastructure failure — log and fall through to non-reviewed path
      console.warn(`[Pipeline] Peer review failed for task ${input.task.id}:`, peerReviewErr);
    }

    if (peerResult && peerResult.clarificationRequired) {
      await input.storage.updateTask(input.task.id, {
        status: 'blocked',
        metadata: { awaitingApproval: true, draftOutput: output, peerReviewBlocked: true } as any,
      });
      input.broadcastToConversation(input.conversationId, {
        type: 'task_requires_approval',
        taskId: input.task.id,
        agentName: input.agent.name,
        riskReasons: peerResult.reason,
      });
      return { status: 'pending_approval' };
    }

    // If peer review succeeded (not null), use its result
    if (peerResult) {
      const finalOutput = peerResult.revisedContent || output;

      const peerMsg = await input.storage.createMessage({
        conversationId: input.conversationId,
        content: finalOutput,
        messageType: 'agent',
        agentId: input.agent.id,
        userId: null,
        metadata: { isAutonomous: true, taskId: input.task.id, peerReviewed: true } as any,
      });

      // Broadcast so users see the autonomous output in real-time chat
      input.broadcastToConversation(input.conversationId, {
        type: 'new_message',
        conversationId: input.conversationId,
        message: peerMsg,
      });

      await input.storage.updateTask(input.task.id, { status: 'completed' });

      await logAutonomyEvent({
        eventType: 'autonomous_task_execution',
        projectId: input.task.projectId,
        hatchId: input.agent.id,
        conversationId: input.conversationId,
        confidence: 1.0,
        riskScore: maxRisk,
        latencyMs: null,
        mode: 'autonomous',
        provider: null,
        teamId: null,
        payload: { taskId: input.task.id, taskTitle: input.task.title, agentName: input.agent.name, peerReviewed: true },
      });

      input.broadcastToConversation(input.conversationId, {
        type: 'task_execution_completed',
        taskId: input.task.id,
        agentId: input.agent.id,
        agentName: input.agent.name,
      });

      // SAFE-04: Peer-reviewed tasks also earn trust
      await updateAgentTrustScore(input.storage, input.agent.id, true);

      return { status: 'completed' };
    }
    // If peerResult is null (catch fired), fall through to non-reviewed path below
  }

  const storedMsg = await input.storage.createMessage({
    conversationId: input.conversationId,
    content: output,
    messageType: 'agent',
    agentId: input.agent.id,
    userId: null,
    metadata: { isAutonomous: true, taskId: input.task.id } as any,
  });

  // Broadcast so users see the autonomous output in real-time chat
  input.broadcastToConversation(input.conversationId, {
    type: 'new_message',
    conversationId: input.conversationId,
    message: storedMsg,
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

  // SAFE-04: Update agent trust score after successful completion
  await updateAgentTrustScore(input.storage, input.agent.id, true);

  return { status: 'completed' };
}

/** Extract trust score from agent personality JSONB (defaults to 0.0). */
function getAgentTrustScore(personality: unknown): number {
  const p = personality as Record<string, unknown> | null | undefined;
  const trustMeta = p?.trustMeta as { trustScore?: number } | undefined;
  return trustMeta?.trustScore ?? 0.0;
}

/**
 * SAFE-04: Update agent trust score in personality JSONB.
 * Called after task completion (success) or failure.
 */
async function updateAgentTrustScore(
  storage: IStorage,
  agentId: string,
  success: boolean,
): Promise<void> {
  try {
    const agent = await storage.getAgent(agentId);
    if (!agent) return;
    const personality = (agent.personality ?? {}) as Record<string, unknown>;
    const currentTrust = personality.trustMeta as any;
    const updatedTrust = updateTrustMeta(currentTrust, success);
    await storage.updateAgent(agentId, {
      personality: { ...personality, trustMeta: updatedTrust } as any,
    });
  } catch {
    // Non-critical — trust update failure should not break task execution
  }
}

export async function handleTaskJob(
  job: { data: { taskId: string; projectId: string; agentId: string } },
  deps: {
    storage: IStorage;
    broadcastToConversation: (convId: string, payload: unknown) => void;
    generateText: (prompt: string, system: string, maxTokens?: number) => Promise<string>;
  },
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);

  // Pause check + tier resolution must happen BEFORE budget reservation so we
  // know the correct limit and don't consume a slot for a paused project.
  const project = await deps.storage.getProject(job.data.projectId);
  if (!project) return;
  if ((project.executionRules as any)?.autonomyPaused === true) {
    // Re-queue the task instead of silently dropping it
    await deps.storage.updateTask(job.data.taskId, {
      status: 'todo',
      metadata: { pausedAt: new Date().toISOString(), willRetryOnResume: true } as any,
    });
    console.log(`[Pipeline] Project ${job.data.projectId} is paused — task ${job.data.taskId} reset to 'todo'`);
    return;
  }

  // Resolve tier limit. Free tier = 0 (autonomy disabled); Pro tier = 50/day.
  // Falls back to BUDGETS.maxBackgroundLlmCallsPerProjectPerDay if user lookup fails.
  let tierLimit = BUDGETS.maxBackgroundLlmCallsPerProjectPerDay;
  if (project.userId) {
    const user = await deps.storage.getUser(project.userId);
    if (user) {
      tierLimit = getTierBudgets(user.tier as 'free' | 'pro').maxBackgroundLlmCallsPerProjectPerDay;
    }
  }

  // Atomic budget reservation — single SQL statement; concurrent races are safe.
  // Returns false if the daily limit is already reached.
  const reserved = await reserveBudgetSlot(job.data.projectId, today, tierLimit);
  if (!reserved) {
    await deps.storage.updateTask(job.data.taskId, {
      status: 'blocked',
      metadata: { costCapReached: true, dailyLimit: tierLimit } as any,
    });
    const conversationId = `project:${job.data.projectId}`;
    deps.broadcastToConversation(conversationId, {
      type: 'task_requires_approval',
      taskId: job.data.taskId,
      agentName: 'System',
      riskReasons: ['Daily autonomous execution limit reached. This task will resume tomorrow or can be manually approved.'],
    });
    return;
  }

  const [task, agents] = await Promise.all([
    deps.storage.getTask(job.data.taskId),
    deps.storage.getAgentsByProject(job.data.projectId),
  ]);
  if (!task) return;
  const agent = agents.find((a) => a.id === job.data.agentId);
  if (!agent) return;

  const conversationId = `project:${job.data.projectId}`;

  deps.broadcastToConversation(conversationId, {
    type: 'background_execution_started',
    projectId: job.data.projectId,
    taskId: job.data.taskId,
    agentName: agent.name,
  });

  let result: { status: 'completed' | 'pending_approval' | 'failed' };
  try {
    result = await queueForBatch({
      task: { id: task.id, title: task.title, description: task.description ?? null, assignee: task.assignee ?? null, projectId: task.projectId },
      agent: { id: agent.id, name: agent.name, role: agent.role, personality: agent.personality },
      project: { id: project.id, name: project.name, coreDirection: project.coreDirection, brain: project.brain },
      conversationId,
      storage: deps.storage,
      broadcastToConversation: deps.broadcastToConversation,
      generateText: deps.generateText,
    });
  } catch (err) {
    // Release the reserved slot — task failed mid-execution. BUDG-02 idempotent release.
    // Use try/catch so a release failure does not mask the original error.
    try {
      await releaseBudgetSlot(job.data.projectId, today);
    } catch (releaseErr) {
      console.error('[Pipeline] releaseBudgetSlot failed (non-fatal):', (releaseErr as Error).message);
    }
    // Only mark as blocked if the task wasn't already completed (avoids corrupting status
    // when broadcastToConversation throws after successful task execution)
    const currentTask = await deps.storage.getTask(job.data.taskId);
    if (currentTask && currentTask.status !== 'completed') {
      await deps.storage.updateTask(job.data.taskId, {
        status: 'blocked',
        metadata: { executionError: true, errorMessage: (err as Error).message } as any,
      });
    }
    await updateAgentTrustScore(deps.storage, job.data.agentId, false);
    await logAutonomyEvent({
      eventType: 'task_failed',
      projectId: job.data.projectId,
      hatchId: job.data.agentId,
      conversationId,
      provider: null,
      mode: 'autonomous',
      teamId: null,
      latencyMs: null,
      confidence: null,
      riskScore: null,
      payload: { taskId: job.data.taskId, error: (err as Error).message },
    });
    deps.broadcastToConversation(conversationId, {
      type: 'task_execution_failed',
      taskId: job.data.taskId,
      agentName: agent.name,
      error: (err as Error).message,
    });
    return;
  }

  // Record autonomy usage for billing (fire-and-forget)
  if (project.userId) {
    recordUsage(deps.storage, project.userId, 'gemini', 'gemini-2.5-flash', 'standard', undefined, 'autonomy')
      .catch(() => {});
  }

  // Handoff chain: only when task completed successfully
  if (result.status === 'completed') {
    // Fetch the output stored by executeTask as context for the next agent
    const recentMessages = await deps.storage.getMessagesByConversation(conversationId, { limit: 1 });
    const completedOutput = recentMessages[0]?.content ?? '';

    const handoffMeta = (task.metadata as any) ?? {};
    const handoffChain: string[] = handoffMeta.handoffChain ?? [];

    const handoffResult = await orchestrateHandoff({
      completedTask: {
        id: task.id,
        title: task.title,
        description: task.description ?? null,
        projectId: task.projectId,
      },
      completedAgent: { id: agent.id, name: agent.name, role: agent.role },
      completedOutput,
      handoffChain,
      storage: deps.storage,
      broadcastToConversation: deps.broadcastToConversation,
    });

    // Emit in-character announcement after successful handoff queue (HAND-02)
    // Ordering: output message was stored BEFORE this — users see output first
    if (handoffResult.status === 'queued' && handoffResult.nextAgentId) {
      const nextAgent = agents.find((a) => a.id === handoffResult.nextAgentId);
      if (nextAgent) {
        try {
          await emitHandoffAnnouncement({
            completedAgent: { id: agent.id, name: agent.name, role: agent.role },
            nextAgent: { id: nextAgent.id, name: nextAgent.name, role: nextAgent.role },
            completedTaskTitle: task.title,
            projectId: task.projectId,
            conversationId,
            storage: deps.storage,
            broadcastToConversation: deps.broadcastToConversation,
            generateText: deps.generateText,
          });
        } catch {
          // Announcement failure is non-critical — task handoff already queued
        }
      }
    }
  }
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
