import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Check,
  Pencil,
  Send,
  Loader2,
  FileText,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Deliverable } from '@shared/schema';
import { RubricBreakdown } from './deliverable/RubricBreakdown';
import { AutoRevertBanner } from './deliverable/AutoRevertBanner';
import {
  iterateDeliverableResponseSchema,
  type IterateDeliverableResponse,
} from '@shared/dto/apiSchemas';

// Type badge colors
const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  'prd': { bg: 'var(--hatchin-blue)', text: 'white' },
  'tech-spec': { bg: 'var(--hatchin-green)', text: 'white' },
  'design-brief': { bg: '#a855f7', text: 'white' },
  'gtm-plan': { bg: 'var(--hatchin-orange)', text: 'white' },
  'user-stories': { bg: 'var(--hatchin-blue)', text: 'white' },
  'blog-post': { bg: '#ec4899', text: 'white' },
  'landing-copy': { bg: '#f59e0b', text: 'white' },
  'content-calendar': { bg: '#14b8a6', text: 'white' },
  'email-sequence': { bg: '#6366f1', text: 'white' },
  'seo-brief': { bg: '#22c55e', text: 'white' },
  'project-plan': { bg: 'var(--hatchin-blue)', text: 'white' },
  'competitive-analysis': { bg: '#f97316', text: 'white' },
  'market-research': { bg: '#8b5cf6', text: 'white' },
  'process-doc': { bg: '#64748b', text: 'white' },
  'data-report': { bg: '#06b6d4', text: 'white' },
  'custom': { bg: 'var(--hatchin-text-muted)', text: 'white' },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  'draft': { label: 'Draft', color: 'var(--hatchin-text-muted)' },
  'in_review': { label: 'In Review', color: 'var(--hatchin-orange)' },
  'complete': { label: 'Complete', color: 'var(--hatchin-green)' },
};

interface ArtifactPanelProps {
  deliverableId: string;
  onClose: () => void;
}

// Phase 36 — local shape mirroring the deliverable_versions.rubricScore JSONB column.
// (DTO lives at @shared/dto/apiSchemas — keeping a structural local type here avoids
// importing the server-only registry per T-36-31.)
type RubricBreakdownScore = {
  total: number;
  breakdown: Array<{ criterion: string; score: number; justification: string }>;
  skipped?: boolean;
  reason?: string;
};

export function ArtifactPanel({ deliverableId, onClose }: ArtifactPanelProps) {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [refineInstruction, setRefineInstruction] = useState('');
  // Phase 36 — local UI state for new rubric toggle + auto-revert banner (D-15/D-16: not persisted).
  const [showRubric, setShowRubric] = useState(false);
  const [revertBannerState, setRevertBannerState] = useState<{
    oldScore: number;
    newScore: number;
    rejectedContent?: string;
    rejectedBreakdown?: Array<{ criterion: string; score: number; justification: string }>;
    rubricVersion?: string | null;
  } | null>(null);

  // Fetch deliverable
  const { data: deliverableData, isLoading } = useQuery<{ deliverable: Deliverable }>({
    queryKey: ['/api/deliverables', deliverableId],
    enabled: !!deliverableId,
  });

  // Fetch versions (Phase 36 — version rows now carry rubricVersion + rubricScore + revertedFromHigherScore)
  const { data: versionsData } = useQuery<{
    versions: Array<{
      id: string;
      versionNumber: number;
      content: string;
      changeDescription: string | null;
      createdAt: string;
      rubricVersion?: string | null;
      rubricScore?: RubricBreakdownScore | null;
      revertedFromHigherScore?: boolean;
    }>;
  }>({
    queryKey: [`/api/deliverables/${deliverableId}/versions`],
    enabled: !!deliverableId,
  });

  // Restore version mutation
  const restoreMutation = useMutation({
    mutationFn: async (versionNumber: number) => {
      const res = await fetch(`/api/deliverables/${deliverableId}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionNumber }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to restore');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/deliverables', deliverableId] });
      queryClient.invalidateQueries({ queryKey: [`/api/deliverables/${deliverableId}/versions`] });
    },
  });

  const iterateMutation = useMutation({
    mutationFn: async (instruction: string) => {
      const res = await fetch(`/api/deliverables/${deliverableId}/iterate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to iterate');
      return res.json();
    },
    onSuccess: (raw: unknown) => {
      queryClient.invalidateQueries({ queryKey: ['/api/deliverables', deliverableId] });
      queryClient.invalidateQueries({ queryKey: [`/api/deliverables/${deliverableId}/versions`] });
      setRefineInstruction('');
      setIsRefining(false);

      // Phase 36 — parse the iterate response shape via iterateDeliverableResponseSchema
      // (Zod .strict()). On parse failure, treat as keep_new (no banner); on reverted=true,
      // surface AutoRevertBanner with old/new scores + rejected breakdown.
      const parsed = iterateDeliverableResponseSchema.safeParse(raw);
      if (!parsed.success) {
        // eslint-disable-next-line no-console
        console.warn('[ArtifactPanel] iterate response failed schema parse', parsed.error.flatten());
        setRevertBannerState(null);
        return;
      }
      if (parsed.data.reverted && parsed.data.oldScore && parsed.data.newScore) {
        const deliverableObj = parsed.data.deliverable as { rubricVersion?: string | null } | undefined;
        setRevertBannerState({
          oldScore: parsed.data.oldScore.total,
          newScore: parsed.data.newScore.total,
          rejectedBreakdown: parsed.data.newScore.breakdown,
          rubricVersion: deliverableObj?.rubricVersion ?? null,
        });
      } else {
        setRevertBannerState(null); // clear stale banner on a keep-new iterate
      }
    },
  });

  // Phase 36 — FBK-02 UI dropped per simplification 2026-05-13. Server endpoints
  // (POST /accept, /dismiss) still exist (Wave 2) but no UI surface in this phase;
  // the agent learning signal (FBK-04) uses score history + impressions + edits
  // instead of explicit accept/dismiss counts.

  // Phase 36 (FBK-03) — Fire one impression POST per panel mount / deliverableId change.
  // Server-side 5s dedupe (per (userId, deliverableId)) absorbs StrictMode double-fire,
  // so the client just does a single fire-and-forget. Failures are silently swallowed —
  // impression counting is non-critical and must never block the panel UI.
  useEffect(() => {
    if (!deliverableId) return;
    fetch(`/api/deliverables/${deliverableId}/impression`, {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {
      /* non-critical — silent */
    });
  }, [deliverableId]);

  // Phase 36 (T-36-37 / I-2) — Clear any stale AutoRevertBanner when the panel switches
  // to a different deliverable. Pure local-state reset (no I/O); kept in a separate
  // useEffect from the impression fire so a slow/failed POST cannot delay the banner clear.
  useEffect(() => {
    setRevertBannerState(null);
  }, [deliverableId]);

  const deliverable = deliverableData?.deliverable;
  const versions = versionsData?.versions || [];
  const currentVersion = deliverable?.currentVersion || 1;

  const handleCopy = async () => {
    if (!deliverable) return;
    await navigator.clipboard.writeText(deliverable.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!deliverable) return;
    window.open(`/api/deliverables/${deliverable.id}/download`, '_blank');
  };

  const handleDownloadPDF = () => {
    if (!deliverable) return;
    window.open(`/api/deliverables/${deliverable.id}/download/pdf`, '_blank');
  };

  const handleVersionNav = (direction: 'prev' | 'next') => {
    const target = direction === 'prev' ? currentVersion - 1 : currentVersion + 1;
    if (target < 1 || target > versions.length) return;
    restoreMutation.mutate(target);
  };

  const typeColor = TYPE_COLORS[deliverable?.type || 'custom'] || TYPE_COLORS.custom;
  const statusInfo = STATUS_LABELS[deliverable?.status || 'draft'] || STATUS_LABELS.draft;

  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 480, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="h-full min-h-0 premium-column-bg rounded-2xl flex flex-col my-2.5 overflow-hidden border border-[var(--hatchin-border-subtle)]"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--hatchin-border-subtle)] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Type badge */}
          <span
            className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0"
            style={{ backgroundColor: typeColor.bg, color: typeColor.text }}
          >
            {deliverable?.type?.replace(/-/g, ' ') || 'Document'}
          </span>
          {/* Title */}
          <h3 className="text-sm font-semibold truncate hatchin-text">
            {deliverable?.title || 'Loading...'}
          </h3>
        </div>
        {/* Phase 36 — Score chip (NEW) + Close (existing). The chip shows the
            active version's score and toggles the breakdown card on click.
            Color-coded by score: green >=7, blue 5-6.9, orange <5. Hides when
            no score yet (pre-Phase-36 deliverables, custom type, or v1 still
            scoring). One element replaces the prior Accept/Dismiss/Rubric trio. */}
        <div className="flex items-center gap-2 shrink-0">
          {(() => {
            const currentVersionRow = versions.find((v) => v.versionNumber === currentVersion);
            const total = currentVersionRow?.rubricScore?.total;
            if (typeof total !== 'number') return null;
            const tone: 'good' | 'ok' | 'low' =
              total >= 7 ? 'good' : total >= 5 ? 'ok' : 'low';
            const toneStyles: Record<typeof tone, { bg: string; color: string }> = {
              good: { bg: 'hsla(158, 66%, 47%, 0.18)', color: 'var(--hatchin-green)' },
              ok: { bg: 'hsla(248, 100%, 71%, 0.18)', color: 'var(--hatchin-blue)' },
              low: { bg: 'hsla(25, 100%, 60%, 0.18)', color: 'var(--hatchin-orange)' },
            };
            const active = showRubric;
            const baseStyle = toneStyles[tone];
            return (
              <button
                type="button"
                onClick={() => setShowRubric((v) => !v)}
                className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full border text-[11px] font-bold tabular-nums leading-none transition-[filter] hover:brightness-110"
                style={{
                  backgroundColor: active ? baseStyle.bg.replace('0.18', '0.28') : baseStyle.bg,
                  color: baseStyle.color,
                  borderColor: baseStyle.color,
                }}
                data-testid="score-chip"
                aria-pressed={active}
                aria-label={`Why this scored ${total.toFixed(1)} / 10`}
                title={`Why this scored ${total.toFixed(1)} / 10`}
              >
                {total.toFixed(1)}
                <span className="text-[10px] opacity-85">★</span>
              </button>
            );
          })()}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--hatchin-surface)] transition-colors"
            aria-label="Close artifact panel"
          >
            <X className="w-4 h-4 hatchin-text-muted" />
          </button>
        </div>
      </div>

      {/* Attribution + Status bar */}
      {deliverable && (
        <div className="px-4 py-2 border-b border-[var(--hatchin-border-subtle)] flex items-center justify-between text-[11px] shrink-0">
          <div className="flex items-center gap-2">
            {/* Agent circle */}
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
              style={{ backgroundColor: typeColor.bg }}
            >
              {(deliverable.agentName || 'A')[0]}
            </div>
            <span className="hatchin-text-muted">
              {deliverable.agentName || 'Agent'} ({deliverable.agentRole || 'Team'})
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* Status badge */}
            <span
              className="font-medium px-2 py-0.5 rounded-full text-[10px]"
              style={{ color: statusInfo.color, border: `1px solid ${statusInfo.color}` }}
            >
              {statusInfo.label}
            </span>
          </div>
        </div>
      )}

      {/* Version navigator */}
      {versions.length > 1 && (
        <div className="px-4 py-1.5 border-b border-[var(--hatchin-border-subtle)] flex items-center justify-between text-[11px] shrink-0">
          <button
            onClick={() => handleVersionNav('prev')}
            disabled={currentVersion <= 1}
            className="p-1 rounded hover:bg-[var(--hatchin-surface)] disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="hatchin-text-muted font-medium">
            v{currentVersion} of {versions.length}
          </span>
          <button
            onClick={() => handleVersionNav('next')}
            disabled={currentVersion >= versions.length}
            className="p-1 rounded hover:bg-[var(--hatchin-surface)] disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Handoff notes */}
      {deliverable?.handoffNotes && (
        <div className="px-4 py-2 border-b border-[var(--hatchin-border-subtle)] text-[11px] hatchin-text-muted italic bg-[var(--hatchin-surface)]/30 shrink-0">
          {deliverable.handoffNotes}
        </div>
      )}

      {/* Phase 36 — AutoRevertBanner (only when iterateMutation produced reverted=true) */}
      <AnimatePresence>
        {revertBannerState && (
          <div className="px-4 pt-3 shrink-0">
            <AutoRevertBanner
              oldScore={revertBannerState.oldScore}
              newScore={revertBannerState.newScore}
              rejectedContent={revertBannerState.rejectedContent}
              rejectedBreakdown={revertBannerState.rejectedBreakdown}
              rubricVersion={revertBannerState.rubricVersion}
              onDismiss={() => setRevertBannerState(null)}
            />
          </div>
        )}
      </AnimatePresence>

      {/* Phase 36 — RubricBreakdown (toggled via header rubric button; D-16 not persisted) */}
      {showRubric && (() => {
        const currentVersionRow = versions.find((v) => v.versionNumber === currentVersion);
        return (
          <div className="px-4 pt-3 shrink-0" data-testid="rubric-toggle-panel">
            <RubricBreakdown
              rubricScore={currentVersionRow?.rubricScore ?? null}
              rubricVersion={currentVersionRow?.rubricVersion ?? null}
            />
          </div>
        );
      })()}

      {/* Content area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 hide-scrollbar">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-4 rounded bg-[var(--hatchin-surface)] animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
            ))}
          </div>
        ) : deliverable?.content ? (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {deliverable.content}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="text-center py-12 hatchin-text-muted text-sm">
            No content yet. The agent is working on this deliverable.
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="px-4 py-2.5 border-t border-[var(--hatchin-border-subtle)] shrink-0 space-y-2">
        {isRefining && (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={refineInstruction}
              onChange={(e) => setRefineInstruction(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && refineInstruction.trim()) {
                  iterateMutation.mutate(refineInstruction.trim());
                }
              }}
              placeholder="e.g. Make the timeline more aggressive..."
              className="flex-1 text-xs px-3 py-2 rounded-lg bg-[var(--hatchin-surface)] border border-[var(--hatchin-border-subtle)] hatchin-text placeholder:text-[var(--hatchin-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--hatchin-blue)]"
              autoFocus
              disabled={iterateMutation.isPending}
              data-testid="refine-input"
            />
            <button
              onClick={() => {
                if (refineInstruction.trim()) iterateMutation.mutate(refineInstruction.trim());
              }}
              disabled={!refineInstruction.trim() || iterateMutation.isPending}
              className="p-2 rounded-lg bg-[var(--hatchin-blue)] text-white hover:opacity-90 disabled:opacity-40 transition-colors"
              data-testid="refine-send"
            >
              {iterateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsRefining(!isRefining)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors min-h-[36px] ${
              isRefining
                ? 'bg-[var(--hatchin-blue)] text-white'
                : 'bg-[var(--hatchin-surface)] hover:bg-[var(--hatchin-surface)]/80'
            }`}
            data-testid="refine-button"
          >
            <Pencil className="w-3.5 h-3.5" />
            Refine
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
              bg-[var(--hatchin-surface)] hover:bg-[var(--hatchin-surface)]/80 transition-colors min-h-[36px]"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[var(--hatchin-green)]" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
              bg-[var(--hatchin-blue)] text-white hover:opacity-90 transition-colors min-h-[36px]"
          >
            <FileText className="w-3.5 h-3.5" />
            PDF
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
              bg-[var(--hatchin-surface)] hover:bg-[var(--hatchin-surface)]/80 transition-colors min-h-[36px]"
          >
            <Download className="w-3.5 h-3.5" />
            .md
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// Deliverable list for browsing
interface DeliverableListProps {
  projectId: string;
  onSelect: (id: string) => void;
}

export function DeliverableList({ projectId, onSelect }: DeliverableListProps) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<{ deliverables: Deliverable[] }>({
    queryKey: [`/api/projects/${projectId}/deliverables`],
    enabled: !!projectId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/deliverables/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete deliverable');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/deliverables`] });
    },
  });

  const deliverables = data?.deliverables || [];

  if (isLoading) {
    return (
      <div className="space-y-2 p-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="premium-card p-3 animate-pulse">
            <div className="h-4 w-3/4 rounded bg-[var(--hatchin-surface)]" />
            <div className="h-3 w-1/2 rounded bg-[var(--hatchin-surface)] mt-2" />
          </div>
        ))}
      </div>
    );
  }

  if (deliverables.length === 0) {
    return (
      <div className="text-center py-8 px-4">
        <p className="text-sm hatchin-text-muted">No deliverables yet.</p>
        <p className="text-xs hatchin-text-muted mt-1">Ask your team to create a PRD, tech spec, or other document.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-2">
      {deliverables.map((d) => {
        const typeColor = TYPE_COLORS[d.type] || TYPE_COLORS.custom;
        const statusInfo = STATUS_LABELS[d.status] || STATUS_LABELS.draft;
        return (
          <div key={d.id} className="relative group">
            <motion.button
              onClick={() => onSelect(d.id)}
              className="premium-card p-3 w-full text-left flex items-start gap-3 hover:border-[var(--hatchin-blue)]/30 transition-colors"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                style={{ backgroundColor: typeColor.bg, color: typeColor.text }}
              >
                {(d.agentName || 'A')[0]}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate hatchin-text">{d.title}</span>
                  <span
                    className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-full shrink-0"
                    style={{ color: statusInfo.color, border: `1px solid ${statusInfo.color}` }}
                  >
                    {statusInfo.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full"
                    style={{ backgroundColor: typeColor.bg, color: typeColor.text }}
                  >
                    {d.type.replace(/-/g, ' ')}
                  </span>
                  <span className="text-[10px] hatchin-text-muted">
                    by {d.agentName || 'Agent'}
                  </span>
                </div>
              </div>
            </motion.button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm('Delete this deliverable?')) {
                  deleteMutation.mutate(d.id);
                }
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-red-400 hover:text-red-300 py-1 px-2"
            >
              del
            </button>
          </div>
        );
      })}
    </div>
  );
}
