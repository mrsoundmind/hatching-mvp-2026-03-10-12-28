/**
 * Phase 37 (TREE-03, D-12) — recursive run tree step renderer.
 *
 * Renders one step row + (recursively) its children. Pure CSS indentation
 * (paddingLeft: depth * 16px). No tree library — straight recursive React.
 *
 * Depth cap: MAX_VISIBLE_DEPTH=3 prevents auto-render below depth 3.
 * Beyond that, the user clicks "···{N} more" to drill in. This bounds the
 * recursion depth AND keeps the sidebar's ~350-400px width readable.
 *
 * Click behavior (D-13):
 *   step.deliverableId set     → calls onClick(step) which bubbles up to
 *                                RunTreeView's handleStepClick → dispatches
 *                                'open_deliverable' CustomEvent with versionNumber.
 *   step.deliverableId absent  → toggles local 'expanded' state for the
 *                                depth-cap "···N more" affordance.
 */

import { useMemo, useState } from 'react';
import type { AutonomyRunStep } from '@shared/schema';
import { formatScoreDelta, formatScoreDeltaWord } from '@shared/scoreFormat';

// Phase 37 — verb-led step descriptions (feedback_ui_self_documenting 2026-05-14).
// User shouldn't have to decode icons. The verb tells them what happened.
function stepVerb(stepType: AutonomyRunStep['stepType']): string {
  switch (stepType) {
    case 'task':
      return 'worked on';
    case 'handoff':
      return 'handed off';
    case 'peer_review':
      return 'reviewed';
    case 'deliberation':
      return 'deliberated on';
    case 'safety_block':
      return 'paused (safety check)';
    case 'approval_request':
      return 'requested approval for';
    default:
      return 'worked on';
  }
}

// Human duration. "Finished in 1.3s" beats a bare millisecond count
// (feedback_ui_self_documenting).
function formatDuration(ms: number | null | undefined): string | null {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return null;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${Math.round(seconds % 60)}s`;
}

/**
 * What this step actually did / is doing / will do.
 *
 * The row used to render "{agent} worked on {step.title}", but step.title IS the
 * run's rootGoal — i.e. the card heading directly above it — so the line carried
 * zero new information. Now a completed step shows a one-line summary of the text
 * the agent really produced (captured server-side into metadata.summary), and
 * non-terminal states say plainly what is happening instead.
 *
 * Steps written before the summary existed fall back to the old phrasing rather
 * than rendering blank.
 */
function stepDescription(
  status: string | null,
  agentName: string,
  verb: string,
  title: string,
  summaryText: string | null,
  errorText: string | null,
): { lead: string; body: string | null } {
  switch (status) {
    case 'failed':
      return { lead: `${agentName} stopped`, body: errorText ?? 'this step did not finish' };
    case 'running':
      return { lead: `${agentName} is working on this now`, body: null };
    case 'pending':
      return { lead: 'Queued, not started yet', body: null };
    case 'skipped':
      return { lead: `${agentName} skipped this step`, body: null };
    default:
      return summaryText
        ? { lead: agentName, body: summaryText }
        : { lead: `${agentName} ${verb}`, body: title };
  }
}

// Deterministic agent-name → palette mapping (mirrors ActivityFeedItem.tsx avatar palette)
const AVATAR_PALETTES = [
  { bg: '#1d4ed8', text: '#bfdbfe' },
  { bg: '#0f766e', text: '#99f6e4' },
  { bg: '#7c3aed', text: '#ddd6fe' },
  { bg: '#b45309', text: '#fde68a' },
  { bg: '#be185d', text: '#fbcfe8' },
  { bg: '#1e40af', text: '#bfdbfe' },
  { bg: '#065f46', text: '#a7f3d0' },
];

function avatarPalette(name: string | null) {
  if (!name) return { bg: '#374151', text: '#9ca3af' };
  const index = name.charCodeAt(0) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[index];
}

export const MAX_VISIBLE_DEPTH = 3;

interface RunTreeNodeProps {
  step: AutonomyRunStep;
  allSteps: AutonomyRunStep[];
  depth: number;
  onClick: (step: AutonomyRunStep) => void;
}

export function RunTreeNode({ step, allSteps, depth, onClick }: RunTreeNodeProps) {
  const stepChildren = useMemo(
    () => allSteps.filter((s) => s.parentStepId === step.id),
    [allSteps, step.id]
  );
  // Auto-expand if within MAX_VISIBLE_DEPTH; collapsed beyond.
  const [expanded, setExpanded] = useState(depth < MAX_VISIBLE_DEPTH);

  const hasDeliverable = !!step.deliverableId;
  const delta = formatScoreDelta(step.scoreDelta);
  const deltaWord = formatScoreDeltaWord(step.scoreDelta, 'step');
  const palette = avatarPalette(step.agentName);
  const initial = step.agentName ? step.agentName.charAt(0).toUpperCase() : '?';
  const verb = stepVerb(step.stepType);
  const agentName = step.agentName ?? 'Unknown';

  const meta = (step.metadata ?? {}) as Record<string, unknown>;
  const summaryText = typeof meta.summary === 'string' && meta.summary.trim() ? meta.summary : null;
  const errorText = typeof meta.error === 'string' && meta.error.trim() ? meta.error : null;
  const { lead, body } = stepDescription(step.status, agentName, verb, step.title ?? '(untitled)', summaryText, errorText);
  const duration = step.status === 'complete' ? formatDuration(step.latencyMs) : null;

  const handleClick = () => {
    if (hasDeliverable) {
      onClick(step);
    } else {
      setExpanded((v) => !v);
    }
  };

  return (
    <div style={{ paddingLeft: `${Math.min(depth, MAX_VISIBLE_DEPTH) * 16}px` }}>
      <button
        type="button"
        onClick={handleClick}
        className="w-full flex items-start gap-2 px-2 py-2 rounded-lg hover:bg-[var(--hatchin-surface)] text-left transition-colors"
        aria-label={body ? `${lead}: ${body}` : lead}
        data-testid={`run-tree-step-${step.id}`}
        title={delta.label && delta.label !== 'new' ? `Quality change: ${delta.label}` : undefined}
      >
        {/* 18px agent avatar circle with first letter */}
        <span
          className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
          style={{ backgroundColor: palette.bg, color: palette.text }}
          aria-hidden
        >
          {initial}
        </span>

        {/* What happened, in words (wraps naturally — no truncation) */}
        <span className="text-micro leading-snug flex-1 min-w-0 flex flex-col gap-0.5">
          <span style={{ color: 'var(--hatchin-text)' }}>
            <span className="font-semibold">{lead}</span>
            {body && (
              <>
                <span className="hatchin-text-muted">{' · '}</span>
                <span className="hatchin-text-muted">{body}</span>
              </>
            )}
          </span>
          {duration && (
            <span className="text-xs hatchin-text-muted">Finished in {duration}</span>
          )}
        </span>

        {/* Semantic-word delta badge: "Better" (green) / "Worse" (amber) / "New" (muted pill) */}
        {deltaWord.tone === 'positive' && (
          <span
            className="text-xs font-semibold shrink-0 px-1.5 py-0.5 rounded-full whitespace-nowrap mt-0.5"
            style={{
              color: 'var(--hatchin-green)',
              backgroundColor: 'hsla(158, 66%, 47%, 0.12)',
              border: '1px solid hsla(158, 66%, 47%, 0.45)',
            }}
          >
            ✓ {deltaWord.label}
          </span>
        )}
        {deltaWord.tone === 'negative' && (
          <span
            className="text-xs font-semibold shrink-0 px-1.5 py-0.5 rounded-full whitespace-nowrap mt-0.5"
            style={{
              color: 'var(--hatchin-orange)',
              backgroundColor: 'hsla(25, 100%, 60%, 0.12)',
              border: '1px solid hsla(25, 100%, 60%, 0.45)',
            }}
          >
            ⚠ {deltaWord.label}
          </span>
        )}
        {deltaWord.tone === 'new' && hasDeliverable && (
          <span
            className="text-xs font-medium shrink-0 px-1.5 py-0.5 rounded-full whitespace-nowrap mt-0.5"
            style={{
              color: 'var(--hatchin-text-muted)',
              border: '1px solid var(--hatchin-border-subtle)',
            }}
          >
            New
          </span>
        )}
      </button>

      {/* Depth-cap affordance — "···N more" when collapsed beyond MAX_VISIBLE_DEPTH */}
      {!expanded && stepChildren.length > 0 && depth >= MAX_VISIBLE_DEPTH && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="ml-6 mt-0.5 text-xs hatchin-text-muted hover:hatchin-text transition-colors"
        >
          ···{stepChildren.length} more
        </button>
      )}

      {/* Recursive children */}
      {expanded &&
        stepChildren.map((child) => (
          <RunTreeNode
            key={child.id}
            step={child}
            allSteps={allSteps}
            depth={depth + 1}
            onClick={onClick}
          />
        ))}
    </div>
  );
}
