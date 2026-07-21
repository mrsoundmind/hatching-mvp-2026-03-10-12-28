/**
 * Phase 37 (TREE-03) — autonomy run tree fetch hook.
 *
 * Fetches GET /api/projects/:projectId/runs every 30s and invalidates on
 * AUTONOMY_EVENTS.TASK_COMPLETED + HANDOFF_CHAIN_COMPLETED CustomEvents so the
 * tree refreshes in near-real-time when a chain completes between poll ticks.
 *
 * Polling cadence: 30s (D-21). WS streaming was deferred to Phase 47; the WS
 * invalidation here is the lightweight bridge between poll cycles (D-22).
 *
 * Mirrors useAutonomyFeed.ts:241-251 (REST + invalidation on autonomy events).
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AutonomyRun, AutonomyRunStep } from '@shared/schema';
import { useSidebarEvent } from './useSidebarEvent';
import { AUTONOMY_EVENTS } from '@/lib/autonomyEvents';

interface RunTreeResponse {
  runs: AutonomyRun[];
  steps: AutonomyRunStep[];
}

export function useAutonomyRunTree(projectId: string | undefined) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<RunTreeResponse>({
    queryKey: ['/api/projects', projectId, 'runs'],
    queryFn: () =>
      fetch(`/api/projects/${projectId}/runs`, { credentials: 'include' }).then((r) => {
        if (!r.ok) throw new Error(`run-tree fetch failed: ${r.status}`);
        return r.json();
      }),
    enabled: !!projectId,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  // Invalidate on TASK_COMPLETED — most common between-poll event
  useSidebarEvent(
    AUTONOMY_EVENTS.TASK_COMPLETED,
    () => {
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'runs'] });
      }
    },
    [projectId, queryClient]
  );

  // Invalidate on HANDOFF_CHAIN_COMPLETED — chains finishing between polls
  useSidebarEvent(
    AUTONOMY_EVENTS.HANDOFF_CHAIN_COMPLETED,
    () => {
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'runs'] });
      }
    },
    [projectId, queryClient]
  );

  return {
    runs: data?.runs ?? [],
    steps: data?.steps ?? [],
    isLoading,
  };
}
