/**
 * Activity feed vocabulary — the single source of truth for how an autonomy event
 * is described to a user, which category it belongs to, and whether it is signal
 * or plumbing.
 *
 * Why this file exists:
 *
 * 1. The category map used to be duplicated in server/routes/autonomy.ts and
 *    client/src/hooks/useAutonomyFeed.ts. The two copies drifted, which is exactly
 *    how `autonomous_task_execution` ended up categorised as 'system' and the Tasks
 *    filter showed nothing while the feed was full of completed tasks.
 *
 * 2. Event labels used to be built as `${agentName} · ${eventType.replace(/_/g,' ')}`,
 *    i.e. the database enum printed straight to the user ("Maya · proposal created").
 *    Interface copy names things by what people recognise, never by how the system is
 *    built, so every event now has a written description instead.
 *
 * Descriptions deliberately omit the agent name: the feed renders the name on its own
 * line directly above, and a label that repeats the line above it is noise.
 */

export type ActivityCategory = 'task' | 'handoff' | 'review' | 'approval' | 'system';

export function mapEventTypeToCategory(eventType: string): ActivityCategory {
  switch (eventType) {
    case 'task_started':
    case 'task_completed':
    case 'task_executing':
    case 'task_failed':
    case 'autonomous_task_execution': // the string the pipeline actually persists on completion
    case 'background_execution_started':
    case 'background_execution_completed':
      return 'task';
    case 'handoff_initiated': // the string handoffOrchestrator actually persists
    case 'handoff_announced':
    case 'handoff_chain_completed':
      return 'handoff';
    case 'peer_review_completed':
    case 'peer_review_started':
    case 'peer_review_feedback':
      return 'review';
    case 'approval_required':
    case 'approval_granted':
    case 'approval_rejected':
      return 'approval';
    default:
      return 'system';
  }
}

/**
 * Events a person running a project actually cares about: work starting, work
 * finishing, work moving between people, something needing them, something stopping.
 * Everything else is the machine narrating its own bookkeeping and renders quietly.
 */
const SIGNAL_EVENTS = new Set([
  'task_started',
  'task_executing',
  'task_completed',
  'task_failed',
  'autonomous_task_execution',
  'background_execution_started',
  'background_execution_completed',
  'handoff_initiated',
  'handoff_announced',
  'handoff_chain_completed',
  'approval_required',
  'approval_granted',
  'approval_rejected',
  'safety_triggered',
  'proposal_created',
]);

export function isSignalEvent(eventType: string): boolean {
  return SIGNAL_EVENTS.has(eventType);
}

function quoted(title: string): string {
  return `"${title.length > 60 ? `${title.slice(0, 60)}…` : title}"`;
}

/**
 * Plain-English description of what happened. Active voice, sentence case, no agent
 * name (the row shows it separately), no system vocabulary.
 */
export function describeAutonomyEvent(
  eventType: string,
  payload?: Record<string, unknown> | null,
): string {
  const p = payload ?? {};
  const rawTitle = typeof p.taskTitle === 'string' ? p.taskTitle.trim() : '';
  const onTask = rawTitle ? ` on ${quoted(rawTitle)}` : '';
  const toAgent = typeof p.toAgentName === 'string' ? p.toAgentName : null;

  switch (eventType) {
    // --- Work lifecycle ---
    case 'autonomous_task_execution':
    case 'task_completed':
    case 'background_execution_completed':
      return rawTitle ? `Finished ${quoted(rawTitle)}` : 'Finished a piece of work';
    case 'task_started':
    case 'task_executing':
    case 'background_execution_started':
      return rawTitle ? `Started working on ${quoted(rawTitle)}` : 'Started working in the background';
    case 'task_failed':
      return rawTitle ? `Could not finish ${quoted(rawTitle)}` : 'Could not finish a piece of work';

    // --- Handoffs ---
    case 'handoff_initiated':
    case 'handoff_announced':
      return toAgent ? `Handed the work to ${toAgent}` : `Handed the work on${onTask ? onTask.slice(3) : ' to a teammate'}`;
    case 'handoff_chain_completed': {
      const hops = typeof p.hops === 'number' ? p.hops : null;
      return hops ? `Finished a chain of ${hops} handoffs` : 'Finished a chain of handoffs';
    }

    // --- Things that need you ---
    case 'approval_required':
      return `Needs your approval before continuing${onTask}`;
    case 'approval_granted':
      return `You approved this${onTask}`;
    case 'approval_rejected':
      return `You rejected this${onTask}`;
    case 'safety_triggered':
      return 'Paused for a safety check';
    case 'proposal_created':
      return 'Suggested a next step for you to review';

    // --- Review ---
    case 'peer_review_started':
      return "Started reviewing a teammate's work";
    case 'peer_review_completed':
      return "Finished reviewing a teammate's work";
    case 'peer_review_feedback':
      return "Left feedback on a teammate's work";
    case 'revision_requested':
      return 'Asked for another pass at the draft';
    case 'revision_completed':
      return 'Revised the draft';

    // --- Thinking and background bookkeeping ---
    case 'memory_written':
      return 'Saved a detail worth remembering';
    case 'synthesis_completed':
      return 'Pulled the discussion into an answer';
    case 'hatch_selected':
      return 'Picked the right teammate for this';
    case 'conductor_resolution':
      return 'Worked out who should answer';
    case 'task_graph_created':
      return 'Broke the work into steps';
    case 'research_started':
      return 'Started digging into background';
    case 'sources_collected':
      return 'Gathered background sources';
    case 'knowledge_gap_detected':
      return 'Noticed something it did not know yet';
    case 'proactive_outreach_sent':
      return 'Reached out without being asked';
    case 'hallucination_detected':
      return 'Caught an unreliable answer before it landed';
    case 'decision_conflict_detected':
      return 'Flagged two decisions that conflict';
    case 'context_compacted':
      return 'Condensed the conversation to save space';
    case 'provider_fallback_resolved':
      return 'Switched to a backup AI provider';

    default: {
      // Last resort for an event type nobody has written copy for yet. Still avoids
      // raw snake_case, but this branch is a prompt to add a real description above.
      const readable = eventType.replace(/^agent_/, '').replace(/_/g, ' ');
      return readable.charAt(0).toUpperCase() + readable.slice(1);
    }
  }
}
