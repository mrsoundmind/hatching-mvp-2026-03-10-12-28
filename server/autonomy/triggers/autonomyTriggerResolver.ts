export interface AutonomyTriggerDecision {
  shouldExecute: boolean;
  reason: 'explicit' | 'inactivity' | 'none';
  tasksToExecute: string[];
}

const TRIGGER_PHRASES = [
  'go ahead',
  'work on this',
  'take it from here',
  'you handle it',
  'start working',
  'begin execution',
  'handle this autonomously',
  'go work on',
];

export function resolveAutonomyTrigger(input: {
  userMessage?: string;
  lastUserActivityAt: Date | null;
  pendingTasks: Array<{ id: string; status: string }>;
  autonomyEnabled: boolean;
}): AutonomyTriggerDecision {
  if (!input.autonomyEnabled) {
    return { shouldExecute: false, reason: 'none', tasksToExecute: [] };
  }

  const lower = (input.userMessage ?? '').toLowerCase();
  const hasExplicitTrigger = TRIGGER_PHRASES.some(phrase => lower.includes(phrase));

  if (hasExplicitTrigger) {
    const todoTasks = input.pendingTasks
      .filter(t => t.status === 'todo')
      .map(t => t.id);

    if (todoTasks.length === 0) {
      return { shouldExecute: false, reason: 'none', tasksToExecute: [] };
    }

    return { shouldExecute: true, reason: 'explicit', tasksToExecute: todoTasks };
  }

  // EXEC-04: Inactivity auto-trigger
  // If user has been inactive for the threshold period and there are pending tasks,
  // automatically begin low-risk task execution
  if (input.lastUserActivityAt) {
    const inactiveMs = Date.now() - input.lastUserActivityAt.getTime();
    const INACTIVITY_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours

    if (inactiveMs >= INACTIVITY_THRESHOLD_MS) {
      const todoTasks = input.pendingTasks
        .filter(t => t.status === 'todo')
        .map(t => t.id);

      if (todoTasks.length > 0) {
        // Only execute first task to limit blast radius during inactivity
        return {
          shouldExecute: true,
          reason: 'inactivity',
          tasksToExecute: [todoTasks[0]],
        };
      }
    }
  }

  return { shouldExecute: false, reason: 'none', tasksToExecute: [] };
}
