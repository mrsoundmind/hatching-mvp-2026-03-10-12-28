/**
 * Shared approve/reject resolution — Mattermost bridge, Release 1 Phase 2.
 *
 * Extracted verbatim from the inline logic in `server/routes/tasks.ts` so BOTH the session-authed
 * HTTP routes and the (session-exempt, signature-verified) Mattermost button callback drive the exact
 * same behavior. The routes keep their own auth + ownership checks and then delegate here.
 *
 * `requireAwaiting` closes the draft-state race for the Mattermost path: if the task was already
 * resolved in the web UI, the button click no-ops gracefully instead of re-resetting a done task.
 * The HTTP routes call WITHOUT it to preserve their original behavior exactly.
 */

import { storage } from '../storage.js';
import { logAutonomyEvent } from '../autonomy/events/eventLogger.js';

export type ApprovalDecision = 'approve' | 'reject';

export interface ApprovalBroadcasts {
  broadcastToConversation: (conversationId: string, data: unknown) => void;
  broadcastToProject: (projectId: string, data: unknown) => void;
}

export interface ApprovalResult {
  ok: boolean;
  /** Suggested HTTP status for the HTTP route. */
  status: number;
  error?: string;
  decision: ApprovalDecision;
  taskTitle?: string;
  agentName?: string | null;
}

export interface ApprovalOptions {
  reason?: string;
  /** When true, both decisions require the task to still be awaiting approval (Mattermost path). */
  requireAwaiting?: boolean;
}

export async function resolveTaskApproval(
  taskId: string,
  decision: ApprovalDecision,
  broadcasts: ApprovalBroadcasts,
  opts: ApprovalOptions = {},
): Promise<ApprovalResult> {
  const task = await storage.getTask(taskId);
  if (!task) return { ok: false, status: 404, error: 'Task not found', decision };

  const meta = (task.metadata ?? {}) as Record<string, unknown>;

  if (decision === 'approve') {
    if (!meta.awaitingApproval || !meta.draftOutput) {
      return { ok: false, status: 400, error: 'Task is not awaiting approval', decision };
    }

    // Clear awaitingApproval immediately to prevent concurrent double-approve.
    await storage.updateTask(taskId, { metadata: { ...meta, awaitingApproval: false } as any });

    const allAgents = await storage.getAgentsByProject(task.projectId);
    const agent = allAgents.find((a) => a.name === task.assignee || a.role === task.assignee) ?? null;

    const convId = agent ? `agent:${task.projectId}:${agent.id}` : `project:${task.projectId}`;
    const draftContent = meta.draftOutput as string;

    const createdMsg = await storage.createMessage({
      conversationId: convId,
      content: draftContent,
      messageType: 'agent',
      agentId: agent?.id ?? null,
      userId: null,
      metadata: { approvedByUser: true },
    } as any);

    broadcasts.broadcastToConversation(convId, { type: 'new_message', conversationId: convId, message: createdMsg });

    await storage.updateTask(taskId, {
      status: 'completed',
      metadata: {
        ...meta,
        awaitingApproval: false,
        draftOutput: draftContent,
        approvedAt: new Date().toISOString(),
      } as any,
    });

    broadcasts.broadcastToConversation(convId, {
      type: 'task_execution_completed',
      taskId: task.id,
      agentId: agent?.id ?? '',
      agentName: agent?.name ?? task.assignee ?? 'Unknown',
    });

    await logAutonomyEvent({
      eventType: 'approval_granted',
      projectId: task.projectId,
      hatchId: agent?.id ?? null,
      conversationId: convId,
      provider: null, mode: 'autonomous', teamId: null, latencyMs: null, confidence: null, riskScore: null,
      payload: { taskId: task.id, taskTitle: task.title, agentName: agent?.name ?? task.assignee ?? null },
    }).catch((e) => console.warn('[approval] approval_granted log failed:', (e as Error).message));

    return { ok: true, status: 200, decision, taskTitle: task.title, agentName: agent?.name ?? task.assignee ?? null };
  }

  // reject
  if (opts.requireAwaiting && !meta.awaitingApproval) {
    return { ok: false, status: 409, error: 'Task is not awaiting approval', decision };
  }

  await storage.updateTask(taskId, {
    status: 'todo',
    metadata: {
      ...meta,
      awaitingApproval: false,
      draftOutput: null,
      rejectedAt: new Date().toISOString(),
      ...(opts.reason ? { rejectionReason: opts.reason } : {}),
    } as any,
  });

  broadcasts.broadcastToProject(task.projectId, { type: 'task_approval_rejected', taskId: task.id });

  await logAutonomyEvent({
    eventType: 'approval_rejected',
    projectId: task.projectId,
    hatchId: null,
    conversationId: `project:${task.projectId}`,
    provider: null, mode: 'autonomous', teamId: null, latencyMs: null, confidence: null, riskScore: null,
    payload: { taskId: task.id, taskTitle: task.title, agentName: task.assignee ?? null },
  }).catch((e) => console.warn('[approval] approval_rejected log failed:', (e as Error).message));

  return { ok: true, status: 200, decision, taskTitle: task.title, agentName: task.assignee ?? null };
}
