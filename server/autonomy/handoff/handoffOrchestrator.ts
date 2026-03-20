import type { IStorage } from '../../storage.js';

export interface HandoffResult {
  status: 'queued' | 'cycle_detected' | 'no_next_task' | 'max_hops_reached';
  nextAgentId?: string;
  nextTaskId?: string;
}

/**
 * Stub — full implementation provided by Plan 07-01.
 * Determines which agent picks up the next task after a completed handoff,
 * checks for cycles, attaches previous output as context, and queues the job.
 */
export async function orchestrateHandoff(_input: {
  completedTask: { id: string; title: string; description: string | null; projectId: string };
  completedAgent: { id: string; name: string; role: string };
  completedOutput: string;
  handoffChain: string[];
  storage: IStorage;
  broadcastToConversation: (convId: string, payload: unknown) => void;
}): Promise<HandoffResult> {
  return { status: 'no_next_task' };
}
