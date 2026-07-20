/**
 * Combined REST + real-time autonomy feed hook.
 *
 * Fetches historical events from GET /api/autonomy/events,
 * appends real-time events via CustomEvent bridge,
 * groups events by traceId with 3-second debounce,
 * and supports category/agent/time filtering.
 */

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSidebarEvent } from './useSidebarEvent';
import { useAgentWorkingState } from './useAgentWorkingState';
import { mapEventTypeToCategory, describeAutonomyEvent } from '@shared/activityLabels';
import {
  AUTONOMY_EVENTS,
  type TaskExecutingPayload,
  type TaskCompletedPayload,
  type HandoffAnnouncedPayload,
  type ApprovalRequiredPayload,
} from '@/lib/autonomyEvents';

// --- Exported interfaces ---

export interface FeedEvent {
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

export interface FeedStats {
  tasksCompleted: number;
  handoffs: number;
  costToday: string;
}

// --- Constants ---

const MAX_EVENTS = 200;
const DEBOUNCE_MS = 3000;

// --- Helpers ---

type FilterCategory = 'all' | 'task' | 'handoff' | 'review' | 'approval';
export type TimeFilter = 'today' | '7days' | 'all';

// mapEventTypeToCategory + the event descriptions live in shared/activityLabels.ts so
// the server feed and this client mirror cannot drift apart again.

interface RawApiEvent {
  id: string;
  traceId: string;
  eventType: string;
  agentId?: string | null;
  agentName?: string | null;
  label?: string;
  category?: string;
  timestamp: string;
  count?: number;
  expandableData?: Record<string, unknown>;
  hatchId?: string | null;
  payload?: Record<string, unknown>;
}

function mapAutonomyEventToFeedEvent(raw: RawApiEvent): FeedEvent {
  const agentId = raw.agentId || raw.hatchId || null;
  const agentName = raw.agentName || (raw.payload?.agentName as string) || (raw.payload?.hatchName as string) || null;
  const category = mapEventTypeToCategory(raw.eventType);
  const payload = raw.expandableData || raw.payload || {};

  return {
    id: raw.id || `${raw.traceId}-${raw.eventType}-${raw.timestamp}`,
    traceId: raw.traceId,
    eventType: raw.eventType,
    agentId,
    agentName,
    label: raw.label || describeAutonomyEvent(raw.eventType, payload),
    category,
    timestamp: raw.timestamp,
    expandableData: payload,
  };
}

function customEventToFeedEvent(
  eventType: string,
  payload: TaskExecutingPayload | TaskCompletedPayload | HandoffAnnouncedPayload | ApprovalRequiredPayload
): FeedEvent {
  const agentName = 'agentName' in payload ? payload.agentName : 'fromAgentName' in payload ? payload.fromAgentName : 'Agent';
  const agentId = 'agentId' in payload ? payload.agentId : 'fromAgentId' in payload ? payload.fromAgentId : null;

  return {
    id: `rt-${payload.traceId}-${eventType}-${Date.now()}`,
    traceId: payload.traceId,
    eventType,
    agentId,
    agentName,
    label: describeAutonomyEvent(eventType, payload as unknown as Record<string, unknown>),
    category: mapEventTypeToCategory(eventType),
    timestamp: new Date().toISOString(),
    expandableData: payload as unknown as Record<string, unknown>,
  };
}

function isWithinTimeRange(timestamp: string, filter: TimeFilter): boolean {
  if (filter === 'all') return true;
  const eventDate = new Date(timestamp);
  const now = new Date();
  if (filter === 'today') {
    return eventDate.toDateString() === now.toDateString();
  }
  // 7days
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return eventDate >= sevenDaysAgo;
}

// --- Main hook ---

export function useAutonomyFeed(projectId: string | undefined) {
  // State for real-time events
  const [realtimeEvents, setRealtimeEvents] = useState<FeedEvent[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  // #80: default to "all" — the previous "task" default hid every review/synthesis/conductor event,
  // so an active project's feed looked empty ("Your team is ready") despite 50+ events.
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');
  const [agentFilter, setAgentFilter] = useState<string | null>(null);
  // Was hardcoded to 'today' with NO setter, so the feed and both stat counters
  // silently reset to empty every midnight and nothing in the UI said why or let
  // you widen the window — an active project read as a dead one the next morning.
  // Defaults to 'all' (the events query is already capped at 50) so the panel can
  // never look falsely empty; the user narrows it deliberately.
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');

  // Debounce batching refs
  const pendingBatch = useRef<FeedEvent[]>([]);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear realtime events when project changes
  useEffect(() => {
    setRealtimeEvents([]);
    pendingBatch.current = [];
  }, [projectId]);

  // Agent working state (passthrough per CONTEXT.md)
  const workingAgents = useAgentWorkingState();

  // REST: fetch historical events
  const { data: historicalData, isLoading: isLoadingEvents } = useQuery<{ events: RawApiEvent[] }>({
    queryKey: ['/api/autonomy/events', `?projectId=${projectId}&limit=50`],
    enabled: !!projectId,
    staleTime: 30_000,
  });

  // REST: fetch stats
  const { data: statsData, isLoading: isLoadingStats } = useQuery<FeedStats>({
    // Period follows the visible time filter so the card can never disagree with the feed below it.
    queryKey: ['/api/autonomy/stats', `?projectId=${projectId}&period=${timeFilter}`],
    enabled: !!projectId,
    staleTime: 60_000,
  });

  // Flush pending batch with traceId grouping
  const flushBatch = useCallback(() => {
    const batch = [...pendingBatch.current];
    pendingBatch.current = [];
    if (batch.length === 0) return;

    // Group by traceId
    const grouped = new Map<string, FeedEvent[]>();
    for (const event of batch) {
      const existing = grouped.get(event.traceId) || [];
      existing.push(event);
      grouped.set(event.traceId, existing);
    }

    const merged: FeedEvent[] = [];
    for (const [traceId, events] of grouped) {
      if (events.length === 1) {
        merged.push(events[0]);
      } else {
        // Merge into summary event
        const agentNames = new Set(events.map(e => e.agentName).filter(Boolean));
        const latest = events.reduce((a, b) =>
          new Date(a.timestamp) > new Date(b.timestamp) ? a : b
        );
        merged.push({
          ...latest,
          id: `batch-${traceId}-${Date.now()}`,
          label: `${events.length} events across ${agentNames.size} agent${agentNames.size !== 1 ? 's' : ''}`,
          expandableData: {
            ...latest.expandableData,
            batchedEvents: events.length,
            involvedAgents: Array.from(agentNames),
          },
        });
      }
    }

    setRealtimeEvents(prev => {
      const combined = [...prev, ...merged];
      return combined.slice(-MAX_EVENTS);
    });
    setUnreadCount(prev => prev + merged.length);
  }, []);

  // Enqueue event with debounce
  const enqueueEvent = useCallback((event: FeedEvent) => {
    pendingBatch.current.push(event);
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(flushBatch, DEBOUNCE_MS);
  }, [flushBatch]);

  // Real-time CustomEvent listeners
  useSidebarEvent<TaskCompletedPayload>(
    AUTONOMY_EVENTS.TASK_COMPLETED,
    (detail) => {
      if (projectId && detail.projectId === projectId) {
        enqueueEvent(customEventToFeedEvent('task_completed', detail));
      }
    },
    [projectId, enqueueEvent]
  );

  useSidebarEvent<TaskExecutingPayload>(
    AUTONOMY_EVENTS.TASK_EXECUTING,
    (detail) => {
      if (projectId && detail.projectId === projectId) {
        enqueueEvent(customEventToFeedEvent('task_executing', detail));
      }
    },
    [projectId, enqueueEvent]
  );

  useSidebarEvent<HandoffAnnouncedPayload>(
    AUTONOMY_EVENTS.HANDOFF_ANNOUNCED,
    (detail) => {
      if (projectId && detail.projectId === projectId) {
        enqueueEvent(customEventToFeedEvent('handoff_announced', detail));
      }
    },
    [projectId, enqueueEvent]
  );

  useSidebarEvent<ApprovalRequiredPayload>(
    AUTONOMY_EVENTS.APPROVAL_REQUIRED,
    (detail) => {
      if (projectId && detail.projectId === projectId) {
        enqueueEvent(customEventToFeedEvent('approval_required', detail));
      }
    },
    [projectId, enqueueEvent]
  );

  // Clear unread
  const clearUnread = useCallback(() => {
    setUnreadCount(0);
  }, []);

  // Combine historical + realtime and filter strictly by active projectId
  const allEvents = useMemo(() => {
    const historical = (historicalData?.events || []).map(mapAutonomyEventToFeedEvent);

    // #165 fix: historical events are already filtered server-side by projectId, so trust them.
    // Realtime events, however, can arrive for a project you just switched away from (in-flight WS
    // frames) or carry no projectId at all — under the old mismatch-only filter, a realtime event
    // WITHOUT a projectId leaked into ANY project's feed and flickered in an empty project. Require
    // realtime events to positively match the selected project; anything ambiguous is dropped from
    // the live view (it still appears after the next historical refetch, which is projectId-scoped).
    const scopedRealtime = projectId
      ? realtimeEvents.filter(event => event.expandableData?.projectId === projectId)
      : realtimeEvents;

    return [...historical, ...scopedRealtime];
  }, [historicalData, realtimeEvents, projectId]);

  // Apply filters
  const filteredEvents = useMemo(() => {
    return allEvents.filter(event => {
      if (activeFilter !== 'all' && event.category !== activeFilter) return false;
      if (agentFilter && event.agentId !== agentFilter) return false;
      if (!isWithinTimeRange(event.timestamp, timeFilter)) return false;
      return true;
    });
  }, [allEvents, activeFilter, agentFilter, timeFilter]);

  return {
    events: filteredEvents,
    stats: statsData,
    isLoading: isLoadingEvents || isLoadingStats,
    workingAgents,
    unreadCount,
    clearUnread,
    activeFilter,
    setActiveFilter,
    agentFilter,
    setAgentFilter,
    timeFilter,
    setTimeFilter,
  };
}
