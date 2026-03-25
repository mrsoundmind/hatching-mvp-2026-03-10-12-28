import { describe, it, expect } from 'vitest';
// Import from the pure utility module (no JSX) to avoid JSX parsing issues in vitest node env
import { groupHandoffsByTraceId } from '../client/src/components/sidebar/handoffChainUtils';

describe('groupHandoffsByTraceId', () => {
  it('groups events by traceId', () => {
    const events = [
      { id: '1', traceId: 'trace-a', eventType: 'handoff_announced', agentId: 'a1', agentName: 'Alex', label: 'handed off', category: 'handoff' as const, timestamp: '2026-03-25T10:00:00Z' },
      { id: '2', traceId: 'trace-a', eventType: 'handoff_announced', agentId: 'a2', agentName: 'Dev', label: 'received', category: 'handoff' as const, timestamp: '2026-03-25T10:01:00Z' },
      { id: '3', traceId: 'trace-b', eventType: 'handoff_announced', agentId: 'a3', agentName: 'Cleo', label: 'handed off', category: 'handoff' as const, timestamp: '2026-03-25T10:02:00Z' },
    ];
    const groups = groupHandoffsByTraceId(events);
    expect(groups.size).toBe(2);
    expect(groups.get('trace-a')?.length).toBe(2);
    expect(groups.get('trace-b')?.length).toBe(1);
  });

  it('filters out non-handoff events', () => {
    const events = [
      { id: '1', traceId: 'trace-a', eventType: 'task_completed', agentId: 'a1', agentName: 'Alex', label: 'done', category: 'task' as const, timestamp: '2026-03-25T10:00:00Z' },
      { id: '2', traceId: 'trace-a', eventType: 'handoff_announced', agentId: 'a2', agentName: 'Dev', label: 'handed off', category: 'handoff' as const, timestamp: '2026-03-25T10:01:00Z' },
    ];
    const groups = groupHandoffsByTraceId(events);
    expect(groups.size).toBe(1);
    expect(groups.get('trace-a')?.length).toBe(1);
  });

  it('sorts events within a group by timestamp ascending', () => {
    const events = [
      { id: '2', traceId: 'trace-a', eventType: 'handoff_announced', agentId: 'a2', agentName: 'Dev', label: 'received', category: 'handoff' as const, timestamp: '2026-03-25T10:05:00Z' },
      { id: '1', traceId: 'trace-a', eventType: 'handoff_announced', agentId: 'a1', agentName: 'Alex', label: 'handed off', category: 'handoff' as const, timestamp: '2026-03-25T10:00:00Z' },
    ];
    const groups = groupHandoffsByTraceId(events);
    const chain = groups.get('trace-a')!;
    expect(chain[0].agentName).toBe('Alex');
    expect(chain[1].agentName).toBe('Dev');
  });

  it('truncates chains longer than 5 to 5 events', () => {
    const events = Array.from({ length: 7 }, (_, i) => ({
      id: `${i}`,
      traceId: 'trace-a',
      eventType: 'handoff_announced',
      agentId: `a${i}`,
      agentName: `Agent${i}`,
      label: 'handoff',
      category: 'handoff' as const,
      timestamp: `2026-03-25T10:0${i}:00Z`,
    }));
    const groups = groupHandoffsByTraceId(events);
    expect(groups.get('trace-a')?.length).toBe(5);
  });

  it('returns empty map for empty input', () => {
    const groups = groupHandoffsByTraceId([]);
    expect(groups.size).toBe(0);
  });
});
