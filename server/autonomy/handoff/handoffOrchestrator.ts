import { evaluateConductorDecision } from '../../ai/conductor.js';
import { handoffTracker } from '../../ai/expertiseMatching.js';
import { queueTaskExecution } from '../execution/jobQueue.js';
import { logAutonomyEvent } from '../events/eventLogger.js';
import { MAX_HANDOFF_HOPS } from '../config/policies.js';
import type { IStorage } from '../../storage.js';
import { getRoleIntelligence } from '@shared/roleIntelligence';
// Phase 37 — autonomy run tree writer (non-fatal step writes)
import { startStep } from '../runs/runTreeWriter.js';

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
  // Phase 37 — autonomy run tree lineage. Optional so legacy callers (none currently)
  // still compile; when omitted, handoff step rows are skipped (writer short-circuit).
  runId?: string;
  traceId?: string;
  sourceStepId?: string | null;   // The completed task's step id — parent of this handoff step.
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
  const dependentTasks = allTasks.filter((t) => {
    if (t.status !== 'todo') return false;
    const dep = (t.metadata as any)?.dependsOn;
    if (!dep) return false;
    // Support both string and array of dependency IDs
    if (Array.isArray(dep)) return dep.includes(input.completedTask.id);
    return dep === input.completedTask.id;
  });
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

  // Filter out special agents (Maya) from handoff targets — they shouldn't receive task handoffs
  const eligibleAgents = agents.filter((a) => !(a as any).isSpecialAgent);

  // Respect an explicit assignee first. If the dependent task was deliberately assigned to someone
  // (by name or role), hand off to THAT teammate rather than letting the conductor re-pick, which
  // otherwise tends to keep the work with the agent who just finished (a Coda→Coda self-handoff even
  // when the next task is clearly design work assigned to Arlo). The conductor remains the fallback
  // for tasks with no assignee, or an assignee that doesn't resolve to an eligible teammate.
  const wanted = (nextTask.assignee ?? '').trim().toLowerCase();
  const assignedAgent = wanted
    ? eligibleAgents.find((a) => a.name.toLowerCase() === wanted || a.role.toLowerCase() === wanted)
    : undefined;
  const targetAgent = assignedAgent ?? conductorResult.primaryMatch ?? eligibleAgents[0];
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

  // Attach structured handoff context using role-specific handoff protocols
  const passingIntelligence = getRoleIntelligence(input.completedAgent.role);
  const receivingIntelligence = getRoleIntelligence(targetAgent.role);

  const structuredHandoff = {
    from: {
      agentName: input.completedAgent.name,
      role: input.completedAgent.role,
      passesFormat: passingIntelligence?.handoffProtocol?.passes,
    },
    to: {
      role: targetAgent.role,
      expectsFormat: receivingIntelligence?.handoffProtocol?.receives,
    },
    output: input.completedOutput,
    taskCompleted: input.completedTask.title,
  };

  await input.storage.updateTask(nextTask.id, {
    metadata: {
      ...((nextTask.metadata as any) ?? {}),
      previousAgentOutput: input.completedOutput,
      previousAgentName: input.completedAgent.name,
      handoffChain: [...input.handoffChain, input.completedAgent.id],
      structuredHandoff,
    } as any,
  });

  // Phase 37 — autonomy run tree: write the handoff step row (parent = source step from input).
  // status='complete' immediately because handoff is instant — the downstream work runs in the
  // next worker invocation as a separate 'task' step parented to this handoff row.
  // If runId/traceId weren't propagated (legacy/test callers), the writer no-ops and handoffStepId = null.
  const handoffStepId =
    input.runId !== undefined && input.traceId !== undefined
      ? await startStep(input.runId, input.sourceStepId ?? null, {
          traceId: input.traceId,
          agentId: input.completedAgent.id,
          agentName: input.completedAgent.name,
          agentRole: input.completedAgent.role,
          stepType: 'handoff',
          title: `${input.completedAgent.name} → ${targetAgent.name}: ${input.completedTask.title.slice(0, 150)}`,
          status: 'complete',
        })
      : null;

  // Phase 37 (D-07.1) — forward-compat event for backfill of POST-37 runs.
  // Co-existing with the run_steps row write so future re-runs of the backfill against richer
  // post-Phase-37 history can reconstruct full handoff trees from events alone.
  await logAutonomyEvent({
    eventType: 'handoff_initiated',
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
      fromAgent: { id: input.completedAgent.id, name: input.completedAgent.name },
      toAgent: { id: targetAgent.id, name: targetAgent.name },
      taskId: nextTask.id,
      sourceStepId: input.sourceStepId ?? null,
      handoffStepId,
    },
  });

  const queued = await queueTaskExecution({
    taskId: nextTask.id,
    projectId: input.completedTask.projectId,
    agentId: targetAgent.id,
    // Phase 37 — propagate to downstream worker so its 'task' step parents under this handoff
    traceId: input.traceId,
    parentStepId: handoffStepId ?? undefined,
  });

  const wasQueued = queued !== null && queued !== undefined;

  handoffTracker.recordHandoff(
    {
      id: 'handoff-' + Date.now(),
      fromAgent: input.completedAgent,
      toAgent: targetAgent,
      reason: 'Task completed: ' + input.completedTask.title,
      context: userMessage,
      timestamp: new Date(),
      status: wasQueued ? 'accepted' : 'pending',
    },
    0,
    wasQueued,
  );

  return { status: wasQueued ? 'queued' : 'no_next_task', nextAgentId: targetAgent.id, nextTaskId: nextTask.id } as HandoffResult;
}
