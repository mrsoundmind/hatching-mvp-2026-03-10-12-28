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

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Activity } from 'lucide-react';
import { useAutonomyRunTree } from '../../hooks/useAutonomyRunTree';
import { RunTreeNode } from './RunTreeNode';
import { formatScoreDelta, formatScoreDeltaWord } from '@shared/scoreFormat';
import type { AutonomyRunStep } from '@shared/schema';

interface RunTreeViewProps {
  projectId: string | undefined;
}

/**
 * Badge for a run that produced no measurable quality delta.
 *
 * Previously this always rendered "In progress" because it keyed off
 * aggregateScoreDelta (null for ~every live run — Phase 47 #2, the pipeline
 * rarely produces scored deliverables), so finished runs looked permanently
 * unfinished. Reading run.status tells the truth in plain words.
 */
function runStatusBadge(status: string | null): {
  label: string;
  color: string;
  bg?: string;
  border: string;
} {
  switch (status) {
    case 'complete':
      return {
        label: '✓ Done',
        color: 'var(--hatchin-green)',
        bg: 'hsla(158, 66%, 47%, 0.12)',
        border: '1px solid hsla(158, 66%, 47%, 0.45)',
      };
    case 'failed':
      return {
        label: '⚠ Stopped',
        color: 'var(--hatchin-orange)',
        bg: 'hsla(25, 100%, 60%, 0.12)',
        border: '1px solid hsla(25, 100%, 60%, 0.45)',
      };
    case 'cancelled':
      return {
        label: 'Cancelled',
        color: 'var(--hatchin-text-muted)',
        border: '1px solid var(--hatchin-border-subtle)',
      };
    default:
      return {
        label: 'In progress',
        color: 'var(--hatchin-text-muted)',
        border: '1px solid var(--hatchin-border-subtle)',
      };
  }
}

export function RunTreeView({ projectId }: RunTreeViewProps) {
  const { runs, steps, isLoading } = useAutonomyRunTree(projectId);

  // Track user-toggled run IDs. Auto-default: the 3 most-recent runs open.
  // Once the user manually toggles a run, the manual choice is preserved across
  // refetches (we don't auto-re-open closed runs or auto-close manually-opened
  // ones). The 3-most-recent default re-applies when a fresh run appears at the
  // top of the list (its id wasn't in the previous run set).
  const [expandedRunIds, setExpandedRunIds] = useState<Set<string>>(() => new Set());
  const [autoOpenedIds, setAutoOpenedIds] = useState<Set<string>>(() => new Set());

  // Auto-open default: when new run ids appear in the most-recent 3, open them
  // ONCE (won't re-open if the user later closes them).
  useEffect(() => {
    if (runs.length === 0) return;
    const topThreeIds = runs.slice(0, 3).map((r) => r.id);
    const newToOpen = topThreeIds.filter((id) => !autoOpenedIds.has(id));
    if (newToOpen.length === 0) return;
    setExpandedRunIds((prev) => {
      const next = new Set(prev);
      newToOpen.forEach((id) => next.add(id));
      return next;
    });
    setAutoOpenedIds((prev) => {
      const next = new Set(prev);
      newToOpen.forEach((id) => next.add(id));
      return next;
    });
  }, [runs, autoOpenedIds]);

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
      <div className="px-3 py-6 hatchin-text-muted text-xs text-center">
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
        const aggWord = formatScoreDeltaWord(run.aggregateScoreDelta, 'aggregate');
        const statusBadge = runStatusBadge(run.status);
        const meta = (run.metadata ?? {}) as Record<string, unknown>;
        const isFlatHistorical = meta.flatHistorical === true;

        // Phase 37 — agent chain summary (feedback_ui_self_documenting 2026-05-14).
        // "3 steps" was unclear; show the actual story: "Alex → Cass → Mira"
        // Walks rootSteps depth-first to preserve chronological order; deduplicates
        // adjacent same-agent steps so a chain like A→A→C reads as A → C.
        const agentChain: string[] = [];
        runSteps
          .slice()
          .sort((a, b) => {
            const ta = a.startedAt ? new Date(a.startedAt).getTime() : 0;
            const tb = b.startedAt ? new Date(b.startedAt).getTime() : 0;
            return ta - tb;
          })
          .forEach((s) => {
            const name = s.agentName ?? '?';
            if (agentChain[agentChain.length - 1] !== name) agentChain.push(name);
          });
        const chainStr = agentChain.length > 0 ? agentChain.slice(0, 4).join(' → ') + (agentChain.length > 4 ? ' …' : '') : '';

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
              className="w-full flex items-start gap-2 px-3 py-2.5 hover:bg-[var(--hatchin-surface)]/40 transition-colors text-left"
              aria-expanded={isOpen}
              aria-label={`Run ${run.rootGoal ?? 'untitled'} — ${aggWord.tone === 'new' ? statusBadge.label.replace(/^[^\w]+\s*/, '') : aggWord.label}`}
              title={aggDelta.label && aggDelta.label !== 'new' ? `Quality change: ${aggDelta.label} (raw)` : undefined}
            >
              {isOpen ? (
                <ChevronDown className="w-3 h-3 shrink-0 hatchin-text-muted mt-1" />
              ) : (
                <ChevronRight className="w-3 h-3 shrink-0 hatchin-text-muted mt-1" />
              )}
              <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                {/* Title — wraps to 2 lines instead of mid-word truncation */}
                <span
                  className="text-xs font-semibold leading-snug hatchin-text"
                  style={{
                    display: '-webkit-box',
                    WebkitBoxOrient: 'vertical',
                    WebkitLineClamp: 2,
                    overflow: 'hidden',
                  }}
                >
                  {run.rootGoal ?? '(no goal recorded)'}
                </span>
                {/* Agent chain story — "Alex → Cass → Mira" */}
                {chainStr && (
                  <span className="text-xs hatchin-text-muted">
                    {chainStr}
                  </span>
                )}
              </span>
              {/* Semantic-word aggregate badge */}
              {aggWord.tone === 'positive' && (
                <span
                  className="text-xs font-semibold shrink-0 px-2 py-0.5 rounded-full whitespace-nowrap mt-0.5"
                  style={{
                    color: 'var(--hatchin-green)',
                    backgroundColor: 'hsla(158, 66%, 47%, 0.12)',
                    border: '1px solid hsla(158, 66%, 47%, 0.45)',
                  }}
                >
                  ✓ {aggWord.label}
                </span>
              )}
              {aggWord.tone === 'negative' && (
                <span
                  className="text-xs font-semibold shrink-0 px-2 py-0.5 rounded-full whitespace-nowrap mt-0.5"
                  style={{
                    color: 'var(--hatchin-orange)',
                    backgroundColor: 'hsla(25, 100%, 60%, 0.12)',
                    border: '1px solid hsla(25, 100%, 60%, 0.45)',
                  }}
                >
                  ⚠ {aggWord.label}
                </span>
              )}
              {aggWord.tone === 'new' && (
                <span
                  className="text-xs font-semibold shrink-0 px-2 py-0.5 rounded-full whitespace-nowrap mt-0.5"
                  style={{
                    color: statusBadge.color,
                    backgroundColor: statusBadge.bg,
                    border: statusBadge.border,
                  }}
                >
                  {statusBadge.label}
                </span>
              )}
            </button>

            {isOpen && (
              <div className="pb-2 px-1">
                {rootSteps.length === 0 ? (
                  <div className="px-3 py-1.5 text-xs hatchin-text-muted italic">
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
                  <div className="px-3 py-1 text-xs hatchin-text-muted italic">
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
