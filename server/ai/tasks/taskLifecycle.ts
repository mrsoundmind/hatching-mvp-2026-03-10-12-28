// Smart Task Detection — Task Lifecycle Commands
// Handles status/priority/assignee updates, delete, queries, filtered queries, and progress.

import type { TaskIntent } from './intentClassifier.js';

// ── Types ────────────────────────────────────────────────────────────────

export interface LifecycleContext {
  projectTasks: Array<{ id: string; title: string; status: string; priority?: string; assignee?: string; dueDate?: string | null }>;
  agents: Array<{ id: string; name: string; role: string }>;
  updateTask: (id: string, updates: Record<string, any>) => Promise<any>;
  deleteTask: (id: string) => Promise<void>;
}

export interface LifecycleResult {
  success: boolean;
  action: string;
  task?: any;
  tasks?: any[];
  message?: string;
  ambiguousMatches?: any[];
}

// ── Fuzzy Task Matching ──────────────────────────────────────────────────

export function fuzzyMatchTask(
  hint: string,
  tasks: Array<{ id: string; title: string; status: string; [k: string]: any }>
): any[] {
  if (!hint || hint.trim().length === 0) return [];
  const hintLower = hint.toLowerCase().trim();
  const hintWords = hintLower.split(/\s+/).filter(w => w.length > 1);

  const scored: Array<{ task: any; score: number }> = [];

  for (const task of tasks) {
    const titleLower = task.title.toLowerCase();

    // Exact title match
    if (titleLower === hintLower) {
      scored.push({ task, score: 1.0 });
      continue;
    }

    // Substring containment
    if (titleLower.includes(hintLower)) {
      scored.push({ task, score: 0.85 });
      continue;
    }

    // Word overlap — all hint words must appear in title
    const titleWords = titleLower.split(/\s+/);
    const allWordsMatch = hintWords.every(hw => titleWords.some(tw => tw.includes(hw)));
    if (allWordsMatch && hintWords.length > 0) {
      scored.push({ task, score: 0.7 });
      continue;
    }

    // Partial word overlap — at least half of hint words appear
    const matchCount = hintWords.filter(hw => titleWords.some(tw => tw.includes(hw))).length;
    if (matchCount > 0 && matchCount >= hintWords.length * 0.5) {
      scored.push({ task, score: 0.5 * (matchCount / hintWords.length) });
    }
  }

  // Filter by threshold and sort by score desc
  return scored
    .filter(s => s.score >= 0.4)
    .sort((a, b) => b.score - a.score)
    .map(s => s.task);
}

// ── Status Normalization ─────────────────────────────────────────────────

function normalizeStatus(raw: string): string {
  const s = raw.toLowerCase().trim();
  if (['done', 'complete', 'completed', 'finished'].includes(s)) return 'completed';
  if (['blocked', 'stuck'].includes(s)) return 'blocked';
  if (['in-progress', 'in progress', 'inprogress', 'wip', 'working'].includes(s)) return 'in_progress';
  if (['todo', 'to-do', 'to do', 'pending', 'open', 'new'].includes(s)) return 'todo';
  return s;
}

// ── Format Helpers ───────────────────────────────────────────────────────

export function formatTaskList(tasks: Array<{ title: string; status: string; priority?: string; assignee?: string }>): string {
  if (tasks.length === 0) return 'No tasks found.';
  return tasks.map(t => {
    const parts = [t.title];
    if (t.priority) parts.push(`[${t.priority.toUpperCase()}]`);
    if (t.status) parts.push(`(${t.status})`);
    if (t.assignee) parts.push(`→ ${t.assignee}`);
    return parts.join(' ');
  }).join('\n');
}

export function formatProgressSummary(tasks: Array<{ status: string; priority?: string; title?: string }>): string {
  const total = tasks.length;
  if (total === 0) return 'No tasks yet — the project board is empty.';

  const byStatus: Record<string, number> = {};
  for (const t of tasks) {
    byStatus[t.status] = (byStatus[t.status] || 0) + 1;
  }

  const completed = byStatus['completed'] || 0;
  const pct = Math.round((completed / total) * 100);

  const parts: string[] = [];
  parts.push(`${total} total tasks, ${pct}% complete.`);

  const statusLines: string[] = [];
  if (byStatus['completed']) statusLines.push(`${byStatus['completed']} completed`);
  if (byStatus['in_progress']) statusLines.push(`${byStatus['in_progress']} in progress`);
  if (byStatus['todo']) statusLines.push(`${byStatus['todo']} to do`);
  if (byStatus['blocked']) statusLines.push(`${byStatus['blocked']} blocked`);
  if (statusLines.length > 0) parts.push(statusLines.join(', ') + '.');

  // Highlight urgent/blocked
  const urgent = tasks.filter(t => t.priority === 'urgent' && t.status !== 'completed');
  if (urgent.length > 0) {
    parts.push(`Urgent: ${urgent.map(t => t.title || 'untitled').join(', ')}.`);
  }
  const blocked = tasks.filter(t => t.status === 'blocked');
  if (blocked.length > 0) {
    parts.push(`Blocked: ${blocked.map(t => t.title || 'untitled').join(', ')}.`);
  }

  return parts.join(' ');
}

// ── Main Lifecycle Command Executor ──────────────────────────────────────

type LifecycleIntent = Extract<TaskIntent, { type: 'TASK_LIFECYCLE_COMMAND' }>;

export async function executeLifecycleCommand(
  intent: LifecycleIntent,
  ctx: LifecycleContext
): Promise<LifecycleResult> {
  const { command, taskHint, newStatus, newPriority, newAssignee, filters } = intent;

  // ── Commands that need a task match ──
  if (['status_update', 'priority_update', 'assignee_update', 'delete'].includes(command)) {
    if (!taskHint) {
      return { success: false, action: command, message: "I couldn't find a task matching that — could you be more specific?" };
    }

    const matches = fuzzyMatchTask(taskHint, ctx.projectTasks);

    if (matches.length === 0) {
      return { success: false, action: command, message: `I couldn't find a task matching "${taskHint}".` };
    }

    if (matches.length > 1) {
      return {
        success: false,
        action: command,
        ambiguousMatches: matches,
        message: `I found ${matches.length} tasks matching "${taskHint}". Which one?\n${matches.map((t: any, i: number) => `${i + 1}. ${t.title}`).join('\n')}`,
      };
    }

    const task = matches[0];

    switch (command) {
      case 'status_update': {
        const status = normalizeStatus(newStatus || 'completed');
        const updated = await ctx.updateTask(task.id, {
          status,
          ...(status === 'completed' ? { completedAt: new Date().toISOString() } : {}),
        });
        return { success: true, action: 'status_update', task: updated, message: `Updated "${task.title}" to ${status}.` };
      }

      case 'priority_update': {
        const updated = await ctx.updateTask(task.id, { priority: newPriority });
        return { success: true, action: 'priority_update', task: updated, message: `Changed priority of "${task.title}" to ${newPriority}.` };
      }

      case 'assignee_update': {
        const agent = ctx.agents.find(a => a.name.toLowerCase() === (newAssignee || '').toLowerCase());
        const assigneeName = agent?.name || newAssignee || 'unassigned';
        const updated = await ctx.updateTask(task.id, {
          assignee: assigneeName,
          ...(agent ? { agentId: agent.id } : {}),
        });
        return { success: true, action: 'assignee_update', task: updated, message: `Reassigned "${task.title}" to ${assigneeName}.` };
      }

      case 'delete': {
        // Soft delete — set status to cancelled
        const updated = await ctx.updateTask(task.id, { status: 'completed' });
        return { success: true, action: 'delete', task: updated, message: `Removed "${task.title}" from the task list.` };
      }
    }
  }

  // ── Query commands ──
  if (command === 'query') {
    const openTasks = ctx.projectTasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled');
    if (openTasks.length === 0) {
      return { success: true, action: 'query', tasks: [], message: 'No open tasks right now — the board is clear.' };
    }
    return { success: true, action: 'query', tasks: openTasks, message: formatTaskList(openTasks) };
  }

  if (command === 'filtered_query') {
    let filtered = [...ctx.projectTasks];
    if (filters?.assignee) {
      const assigneeLower = filters.assignee.toLowerCase();
      filtered = filtered.filter(t => t.assignee?.toLowerCase().includes(assigneeLower));
    }
    if (filters?.status) {
      const normalized = normalizeStatus(filters.status);
      filtered = filtered.filter(t => t.status === normalized);
    }
    if (filters?.priority) {
      filtered = filtered.filter(t => t.priority?.toLowerCase() === filters.priority!.toLowerCase());
    }

    if (filtered.length === 0) {
      return { success: true, action: 'filtered_query', tasks: [], message: 'No tasks match that filter.' };
    }
    return { success: true, action: 'filtered_query', tasks: filtered, message: formatTaskList(filtered) };
  }

  if (command === 'progress') {
    return { success: true, action: 'progress', message: formatProgressSummary(ctx.projectTasks) };
  }

  return { success: false, action: command, message: `Unknown lifecycle command: ${command}` };
}
