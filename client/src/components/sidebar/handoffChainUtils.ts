/**
 * Pure grouping utilities for handoff chain timeline.
 * Kept in a separate .ts file so unit tests can import without JSX parsing.
 * Uses an inline FeedEvent type definition to avoid path alias resolution
 * issues in vitest's node environment (which doesn't have @/ aliased).
 */

// Inline type to allow import from vitest node environment without @/ alias
export interface FeedEventLike {
  id: string;
  traceId: string;
  eventType: string;
  agentId: string | null;
  agentName: string | null;
  label: string;
  category: 'task' | 'handoff' | 'review' | 'approval' | 'system';
  timestamp: string;
  expandableData?: Record<string, unknown>;
}

/**
 * Groups feed events by traceId, keeping only handoff-category events.
 * - Filters to category === 'handoff'
 * - Groups by traceId
 * - Sorts each group by timestamp ascending
 * - Truncates each group to max 5 events
 */
export function groupHandoffsByTraceId(events: FeedEventLike[]): Map<string, FeedEventLike[]> {
  const handoffEvents = events.filter((e) => e.category === 'handoff');

  const grouped = new Map<string, FeedEventLike[]>();
  for (const event of handoffEvents) {
    const existing = grouped.get(event.traceId) ?? [];
    existing.push(event);
    grouped.set(event.traceId, existing);
  }

  // Sort each group by timestamp ascending and truncate to 5
  for (const [traceId, group] of grouped) {
    group.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    grouped.set(traceId, group.slice(0, 5));
  }

  return grouped;
}
