/**
 * Phase 37 (TREE-03, D-11 + D-14) — top-level run tree renderer.
 *
 * Renders one collapsible card per autonomy run (most-recent first; the server
 * already orders + limits to 20). Card header: chevron + rootGoal + step-count
 * badge + aggregate-delta badge. Body: recursive RunTreeNode per root step.
 *
 * Empty state (D-14): centered card with "No autonomous runs yet" copy.
 * D-18 flat-historical hint: subtle italic when run.metadata.flatHistorical=true.
 *
 * Click semantics (D-13 + TREE-04 / W-4):
 *   step with deliverableId  → dispatches 'open_deliverable' CustomEvent with
 *                              { deliverableId, versionNumber } where
 *                              versionNumber is sourced from the denormalized
 *                              step.deliverableVersionNumber column (W-4).
 *                              The home.tsx listener pipes versionNumber into
 *                              ArtifactPanel's pendingVersionNumber prop which
 *                              auto-navigates via restoreMutation.
 *   step without deliverable → RunTreeNode toggles its own 'expanded' state.
 */

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Activity } from 'lucide-react';
import { useAutonomyRunTree } from '../../hooks/useAutonomyRunTree';
import { RunTreeNode } from './RunTreeNode';
import { formatScoreDelta } from '@shared/scoreFormat';
import type { AutonomyRunStep } from '@shared/schema';

interface RunTreeViewProps {
  projectId: string | undefined;
}

export function RunTreeView({ projectId }: RunTreeViewProps) {
  const { runs, steps, isLoading } = useAutonomyRunTree(projectId);

  // Default-open the 3 most-recent runs (D-11). Memoized so refetches don't reset.
  const initialOpenIds = useMemo(
    () => new Set(runs.slice(0, 3).map((r) => r.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [runs.length === 0 ? 'empty' : runs[0]?.id]
  );
  const [expandedRunIds, setExpandedRunIds] = useState<Set<string>>(initialOpenIds);

  const handleStepClick = (step: AutonomyRunStep) => {
    if (!step.deliverableId) return;
    window.dispatchEvent(
      new CustomEvent('open_deliverable', {
        detail: {
          deliverableId: step.deliverableId,
          // W-4 — denormalized version number from the step row. When the step
          // produced a deliverable version, this is the exact version to open
          // (no second fetch). When null (D-06.1 common case — autonomy pipeline
          // doesn't currently produce Phase 36 deliverables), dispatch undefined
          // and ArtifactPanel opens to the most-recent version (backward compat).
          versionNumber:
            typeof step.deliverableVersionNumber === 'number'
              ? step.deliverableVersionNumber
              : undefined,
        },
      })
    );
  };

  const toggleRun = (id: string) => {
    setExpandedRunIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="px-3 py-6 hatchin-text-muted text-[12px] text-center">
        Loading run tree…
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[var(--hatchin-surface)] flex items-center justify-center mb-4">
          <Activity className="w-8 h-8 hatchin-text-muted" />
        </div>
        <h3 className="text-sm font-semibold hatchin-text mb-1.5">No autonomous runs yet</h3>
        <p className="text-xs hatchin-text-muted max-w-[240px] leading-relaxed">
          Once a Hatch starts working on a task in the background, you'll see the run tree here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 px-2 pb-2 overflow-y-auto flex-1 hide-scrollbar">
      {runs.map((run) => {
        const isOpen = expandedRunIds.has(run.id);
        const runSteps = steps.filter((s) => s.runId === run.id);
        const rootSteps = runSteps.filter((s) => s.parentStepId === null);
        const aggDelta = formatScoreDelta(run.aggregateScoreDelta);
        const meta = (run.metadata ?? {}) as Record<string, unknown>;
        const isFlatHistorical = meta.flatHistorical === true;

        return (
          <div
            key={run.id}
            className="premium-card overflow-hidden"
            style={{ opacity: isFlatHistorical ? 0.85 : 1 }}
            data-testid={`run-card-${run.id}`}
          >
            <button
              type="button"
              onClick={() => toggleRun(run.id)}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--hatchin-surface)]/40 transition-colors text-left"
              aria-expanded={isOpen}
              aria-label={`Run ${run.rootGoal ?? 'untitled'} — ${run.stepCount} steps`}
            >
              {isOpen ? (
                <ChevronDown className="w-3 h-3 shrink-0 hatchin-text-muted" />
              ) : (
                <ChevronRight className="w-3 h-3 shrink-0 hatchin-text-muted" />
              )}
              <span className="text-[12px] font-semibold truncate flex-1 hatchin-text">
                {run.rootGoal ?? '(no goal recorded)'}
              </span>
              <span className="text-[10px] hatchin-text-muted shrink-0">
                {run.stepCount} step{run.stepCount === 1 ? '' : 's'}
              </span>
              {aggDelta.tone === 'positive' && (
                <span
                  className="text-[10px] font-semibold tabular-nums shrink-0"
                  style={{ color: 'var(--hatchin-green)' }}
                >
                  {aggDelta.label}
                </span>
              )}
              {aggDelta.tone === 'negative' && (
                <span
                  className="text-[10px] font-semibold tabular-nums shrink-0"
                  style={{ color: 'var(--hatchin-orange)' }}
                >
                  {aggDelta.label}
                </span>
              )}
            </button>

            {isOpen && (
              <div className="pb-2 px-1">
                {rootSteps.length === 0 ? (
                  <div className="px-3 py-1.5 text-[10px] hatchin-text-muted italic">
                    (no steps recorded for this run)
                  </div>
                ) : (
                  rootSteps.map((s) => (
                    <RunTreeNode
                      key={s.id}
                      step={s}
                      allSteps={runSteps}
                      depth={0}
                      onClick={handleStepClick}
                    />
                  ))
                )}
                {isFlatHistorical && (
                  <div className="px-3 py-1 text-[9px] hatchin-text-muted italic">
                    imported flat from history — newer runs will show full tree
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
