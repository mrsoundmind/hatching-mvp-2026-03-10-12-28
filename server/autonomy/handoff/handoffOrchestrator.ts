import { evaluateConductorDecision } from '../../ai/conductor.js';
import { handoffTracker } from '../../ai/expertiseMatching.js';
import { queueTaskExecution } from '../execution/jobQueue.js';
import { logAutonomyEvent } from '../events/eventLogger.js';
import { MAX_HANDOFF_HOPS } from '../config/policies.js';
import type { IStorage } from '../../storage.js';

export interface HandoffResult {
  status: 'queued' | 'cycle_detected' | 'no_next_task' | 'max_hops_reached';
  nextAgentId?: string;
  nextTaskId?: string;
}

export async function orchestrateHandoff(input: {
  completedTask: { id: string; title: string; description: string | null; projectId: string };
  completedAgent: { id: string; name: string; role: string };
  completedOutput: string;
  handoffChain: string[];
  storage: IStorage;
  broadcastToConversation: (convId: string, payload: unknown) => void;
}): Promise<HandoffResult> {
  // Guard: max hops prevents runaway chains
  if (input.handoffChain.length >= MAX_HANDOFF_HOPS) {
    input.broadcastToConversation('project:' + input.completedTask.projectId, {
      type: 'handoff_chain_completed',
      projectId: input.completedTask.projectId,
      reason: 'max_hops_reached',
      hops: input.handoffChain.length,
    });
    return { status: 'max_hops_reached' };
  }

  // Find dependent tasks (tasks with metadata.dependsOn pointing to the completed task)
  const allTasks = await input.storage.getTasksByProject(input.completedTask.projectId);
  const dependentTasks = allTasks.filter(
    (t) => t.status === 'todo' && (t.metadata as any)?.dependsOn === input.completedTask.id,
  );
  if (dependentTasks.length === 0) return { status: 'no_next_task' };

  const nextTask = dependentTasks[0];
  const agents = await input.storage.getAgentsByProject(input.completedTask.projectId);

  // CRITICAL: pass description (not just title) to avoid conductor fast-path for short messages
  const userMessage =
    nextTask.description && nextTask.description.length > 20
      ? nextTask.description
      : (nextTask.title + ' — ' + (nextTask.description ?? '')).trim();

  const project = await input.storage.getProject(input.completedTask.projectId);

  const conductorResult = evaluateConductorDecision({
    userMessage,
    conversationMode: 'project',
    availableAgents: agents.map((a) => ({ id: a.id, name: a.name, role: a.role })),
    projectName: project?.name,
  });

  const targetAgent = conductorResult.primaryMatch ?? agents[0];
  if (!targetAgent) return { status: 'no_next_task' };

  // Cycle detection via existing HandoffTracker
  const cycleCheck = handoffTracker.detectCycle(input.completedAgent.id, targetAgent.id);
  if (cycleCheck.hasCycle) {
    const conversationId = 'project:' + input.completedTask.projectId;
    input.broadcastToConversation(conversationId, {
      type: 'handoff_cycle_detected',
      projectId: input.completedTask.projectId,
      chain: cycleCheck.chain,
    });
    await logAutonomyEvent({
      eventType: 'task_failed',
      projectId: input.completedTask.projectId,
      hatchId: input.completedAgent.id,
      conversationId: 'project:' + input.completedTask.projectId,
      provider: null,
      mode: 'autonomous',
      teamId: null,
      latencyMs: null,
      confidence: null,
      riskScore: null,
      payload: {
        reason: 'handoff_cycle',
        chain: cycleCheck.chain,
        taskId: input.completedTask.id,
      },
    });
    return { status: 'cycle_detected' };
  }

  // Attach previous output as context in task metadata before queuing
  await input.storage.updateTask(nextTask.id, {
    metadata: {
      ...((nextTask.metadata as any) ?? {}),
      previousAgentOutput: input.completedOutput,
      previousAgentName: input.completedAgent.name,
      handoffChain: [...input.handoffChain, input.completedAgent.id],
    } as any,
  });

  await queueTaskExecution({
    taskId: nextTask.id,
    projectId: input.completedTask.projectId,
    agentId: targetAgent.id,
  });

  handoffTracker.recordHandoff(
    {
      id: 'handoff-' + Date.now(),
      fromAgent: input.completedAgent,
      toAgent: targetAgent,
      reason: 'Task completed: ' + input.completedTask.title,
      context: userMessage,
      timestamp: new Date(),
      status: 'accepted',
    },
    0,
    true,
  );

  return { status: 'queued', nextAgentId: targetAgent.id, nextTaskId: nextTask.id };
}
