import { useEffect, useRef, useCallback } from 'react';
// Removed useWebSocket import - no longer needed
import type { Project, Team, Agent } from '@shared/schema';

interface RealTimeMetrics {
  messagesCount: number;
  lastActivity: Date;
  activeParticipants: string[];
  taskCompletions: number;
  milestoneReaches: number;
}

interface UseRealTimeUpdatesOptions {
  activeProject?: Project;
  activeTeam?: Team;
  activeAgent?: Agent;
  onMetricsUpdate?: (metrics: RealTimeMetrics) => void;
  onProgressUpdate?: (progress: number) => void;
  onTimelineUpdate?: (event: any) => void;
  onTaskSuggestion?: (suggestions: any[]) => void;
  debounceMs?: number;
}

export function useRealTimeUpdates({
  activeProject,
  activeTeam,
  activeAgent,
  onMetricsUpdate,
  onProgressUpdate,
  onTimelineUpdate,
  onTaskSuggestion,
  debounceMs = 500
}: UseRealTimeUpdatesOptions) {
  const metricsRef = useRef<RealTimeMetrics>({
    messagesCount: 0,
    lastActivity: new Date(),
    activeParticipants: [],
    taskCompletions: 0,
    milestoneReaches: 0,
  });
  
  const updateTimeoutRef = useRef<NodeJS.Timeout>();

  // Debounced update function
  const debouncedUpdate = useCallback(() => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    
    updateTimeoutRef.current = setTimeout(() => {
      onMetricsUpdate?.(metricsRef.current);
    }, debounceMs);
  }, [onMetricsUpdate, debounceMs]);

  // REMOVED: WebSocket connection entirely!
  // CenterPanel already handles all WebSocket messages
  // This hook now just provides simple metrics tracking

  // Public methods to update metrics from external sources
  const updateMessageCount = useCallback(() => {
    metricsRef.current.messagesCount += 1;
    metricsRef.current.lastActivity = new Date();
    debouncedUpdate();
  }, [debouncedUpdate]);

  const updateTaskCompletion = useCallback(() => {
    metricsRef.current.taskCompletions += 1;
    const progressIncrease = Math.min(5 + Math.random() * 10, 15);
    onProgressUpdate?.(progressIncrease);
    debouncedUpdate();
  }, [onProgressUpdate, debouncedUpdate]);

  const updateMilestone = useCallback(() => {
    metricsRef.current.milestoneReaches += 1;
    const timelineEvent = {
      title: 'Milestone Reached',
      date: new Date().toISOString(),
      status: 'Completed' as const,
      color: '#47DB9A'
    };
    onTimelineUpdate?.(timelineEvent);
    debouncedUpdate();
  }, [onTimelineUpdate, debouncedUpdate]);

  // Reset metrics when context changes
  useEffect(() => {
    metricsRef.current = {
      messagesCount: 0,
      lastActivity: new Date(),
      activeParticipants: [],
      taskCompletions: 0,
      milestoneReaches: 0,
    };
  }, [activeProject?.id, activeTeam?.id, activeAgent?.id]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  return {
    connectionStatus: 'connected' as const,
    metrics: metricsRef.current,
    isConnected: true,
    updateMessageCount,
    updateTaskCompletion,
    updateMilestone
  };
}