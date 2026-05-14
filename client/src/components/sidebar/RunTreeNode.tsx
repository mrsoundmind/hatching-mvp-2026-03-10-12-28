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
import { Clock, ArrowRightLeft, Search, MessagesSquare, ShieldAlert } from 'lucide-react';
import type { AutonomyRunStep } from '@shared/schema';
import { formatScoreDelta } from '@shared/scoreFormat';

// D-12 — step type → lucide icon mapping
const stepTypeIcons: Record<AutonomyRunStep['stepType'], typeof Clock> = {
  task: Clock,
  handoff: ArrowRightLeft,
  peer_review: Search,
  deliberation: MessagesSquare,
  safety_block: ShieldAlert,
  approval_request: ShieldAlert,
};

// D-12 — step type → CSS variable color
const stepTypeColor: Record<AutonomyRunStep['stepType'], string> = {
  task: 'var(--hatchin-blue)',
  handoff: 'var(--hatchin-text-muted)',
  peer_review: 'var(--hatchin-teal, var(--hatchin-blue))',
  deliberation: 'var(--hatchin-text-muted)',
  safety_block: 'var(--hatchin-orange)',
  approval_request: 'var(--hatchin-orange)',
};

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

  const StepIcon = stepTypeIcons[step.stepType] ?? Clock;
  const iconColor = stepTypeColor[step.stepType] ?? 'var(--hatchin-text-muted)';
  const hasDeliverable = !!step.deliverableId;
  const delta = formatScoreDelta(step.scoreDelta);
  const palette = avatarPalette(step.agentName);
  const initial = step.agentName ? step.agentName.charAt(0).toUpperCase() : '?';

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
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--hatchin-surface)] text-left transition-colors"
        aria-label={`Step ${step.title ?? step.stepType} — ${step.status}`}
        data-testid={`run-tree-step-${step.id}`}
      >
        {/* Step-type icon */}
        <StepIcon className="w-3 h-3 shrink-0" style={{ color: iconColor }} />

        {/* 16px agent avatar circle with first letter */}
        <span
          className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0"
          style={{ backgroundColor: palette.bg, color: palette.text }}
          aria-hidden
        >
          {initial}
        </span>

        {/* Agent name (semibold 11px) */}
        <span
          className="text-[11px] font-semibold shrink-0"
          style={{ color: 'var(--hatchin-text)' }}
        >
          {step.agentName ?? 'Unknown'}
        </span>

        {/* Role (muted 9px) */}
        {step.agentRole && (
          <span className="text-[9px] hatchin-text-muted shrink-0">{step.agentRole}</span>
        )}

        {/* Title (10px muted truncated) */}
        <span className="text-[10px] hatchin-text-muted truncate flex-1 min-w-0">
          {step.title ?? '(no title)'}
        </span>

        {/* Score-delta badge (or 'new' for null + deliverable) */}
        {delta.tone === 'positive' && (
          <span
            className="text-[10px] font-semibold tabular-nums shrink-0"
            style={{ color: 'var(--hatchin-green)' }}
          >
            {delta.label}
          </span>
        )}
        {delta.tone === 'negative' && (
          <span
            className="text-[10px] font-semibold tabular-nums shrink-0"
            style={{ color: 'var(--hatchin-orange)' }}
          >
            {delta.label}
          </span>
        )}
        {delta.tone === 'new' && hasDeliverable && (
          <span
            className="text-[9px] italic shrink-0 hatchin-text-muted"
            style={{ fontStyle: 'italic' }}
          >
            new
          </span>
        )}
      </button>

      {/* Depth-cap affordance — "···N more" when collapsed beyond MAX_VISIBLE_DEPTH */}
      {!expanded && stepChildren.length > 0 && depth >= MAX_VISIBLE_DEPTH && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="ml-6 mt-0.5 text-[10px] hatchin-text-muted hover:hatchin-text transition-colors"
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
