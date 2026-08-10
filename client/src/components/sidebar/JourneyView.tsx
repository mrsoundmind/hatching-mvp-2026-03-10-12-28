import { useMemo, useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronRight, Lock, Play, FileText, Check, Trash2, Loader2 } from 'lucide-react';
import { useAgentWorkingState } from '@/hooks/useAgentWorkingState';
import { getTypeLabel } from '@shared/deliverableTypes';
import type { Task, Agent } from '@shared/schema';

/**
 * Business-in-a-Box — In-project Journey view (BIAB-1 / PROC-03).
 *
 * Renders the pack-seeded tasks as a guided, staged path (Get set up → Build →
 * Launch → Grow) instead of a flat board: a "first 3 moves" starter, per-stage
 * progress, a live "the team is working on this" state, and a link from each
 * task to the document it produces (opens the existing Artifact panel).
 *
 * Soft guidance, never gates (decision 2026-08-10): every stage is openable; a
 * future stage is only dimmed and collapsed, never locked out.
 *
 * All side-effects reuse existing app plumbing so no sibling-owned file changes:
 *  - open a document  → window CustomEvent 'open_deliverable' (home.tsx listens)
 *  - delegate to team → 'delegate_todos' via onDelegate (CenterPanel listens)
 */

const STAGE_ORDER = ['prerequisites', 'build', 'launch', 'grow'] as const;
type StageKey = (typeof STAGE_ORDER)[number];

const STAGE_LABEL: Record<StageKey, string> = {
  prerequisites: 'Get set up',
  build: 'Build',
  launch: 'Launch',
  grow: 'Grow',
};

// Map the seeded agent.color (blue|green|purple|amber) → a concrete avatar color.
const AVATAR_COLOR: Record<string, string> = {
  blue: 'var(--hatchin-blue)',
  green: 'var(--hatchin-green)',
  purple: 'var(--hatchin-purple)',
  amber: 'var(--hatchin-working-amber)',
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#f87171',
  high: '#fb923c',
  medium: '#60a5fa',
  low: 'var(--hatchin-text-muted)',
};

interface JourneyViewProps {
  projectId: string;
  tasks: Task[];
  isPro: boolean;
  autonomyEnabled: boolean;
  onToggle: (taskId: string, currentStatus: string) => void;
  onDelete: (taskId: string) => void;
  onDelegate: () => void;
  openBrainSettings: () => void;
}

interface StageGroup {
  key: StageKey;
  label: string;
  tasks: Task[];
  done: number;
  total: number;
  complete: boolean;
}

function stageOf(t: Task): StageKey | null {
  const s = (t.metadata as { stage?: string } | null)?.stage;
  return s && (STAGE_ORDER as readonly string[]).includes(s) ? (s as StageKey) : null;
}
function orderOf(t: Task): number {
  return (t.metadata as { order?: number } | null)?.order ?? 999;
}

export function JourneyView({
  projectId, tasks, isPro, autonomyEnabled, onToggle, onDelete, onDelegate, openBrainSettings,
}: JourneyViewProps) {
  const workingAgents = useAgentWorkingState();

  // Agents — only to map a task's assignee (a name) to an id so we can tell when
  // that teammate is executing work live. Fail-soft: no agents → no working badge.
  const { data: agents } = useQuery<Agent[]>({
    queryKey: [`/api/projects/${projectId}/agents`],
    queryFn: async () => {
      const r = await fetch(`/api/projects/${projectId}/agents`);
      return r.ok ? r.json() : [];
    },
    enabled: !!projectId,
    staleTime: 60_000,
  });

  const agentIdByName = useMemo(() => {
    const m = new Map<string, string>();
    (agents ?? []).forEach(a => { if (a.name) m.set(a.name, a.id); });
    return m;
  }, [agents]);
  const colorByName = useMemo(() => {
    const m = new Map<string, string>();
    (agents ?? []).forEach(a => { if (a.name) m.set(a.name, AVATAR_COLOR[a.color] ?? 'var(--hatchin-blue)'); });
    return m;
  }, [agents]);

  const isWorking = useCallback((t: Task): boolean => {
    if (t.status === 'in_progress') return true;
    if (t.status === 'completed') return false;
    const id = t.assignee ? agentIdByName.get(t.assignee) : undefined;
    return !!id && workingAgents.has(id);
  }, [agentIdByName, workingAgents]);

  // Group the staged tasks by lifecycle stage, ordered; keep any non-staged tasks
  // (e.g. added from chat) in a separate "Also on your list" bucket.
  const { stages, others } = useMemo(() => {
    const byStage = new Map<StageKey, Task[]>();
    STAGE_ORDER.forEach(s => byStage.set(s, []));
    const other: Task[] = [];
    for (const t of tasks) {
      const s = stageOf(t);
      if (s) byStage.get(s)!.push(t);
      else other.push(t);
    }
    const groups: StageGroup[] = STAGE_ORDER
      .map(key => {
        const list = byStage.get(key)!.slice().sort((a, b) => orderOf(a) - orderOf(b));
        const done = list.filter(t => t.status === 'completed').length;
        return { key, label: STAGE_LABEL[key], tasks: list, done, total: list.length, complete: list.length > 0 && done === list.length };
      })
      .filter(g => g.total > 0);
    return { stages: groups, others: other };
  }, [tasks]);

  // Current stage = first stage that still has unfinished work.
  const currentKey = useMemo(() => {
    const c = stages.find(s => !s.complete);
    return c?.key ?? stages[stages.length - 1]?.key ?? null;
  }, [stages]);

  // Expansion: current stage open, completed stages collapsed, future stages
  // collapsed (but openable). Seeded once; user toggles stick afterward.
  const [openStages, setOpenStages] = useState<Set<string>>(new Set());
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (seeded || stages.length === 0 || !currentKey) return;
    setOpenStages(new Set([currentKey]));
    setSeeded(true);
  }, [seeded, stages, currentKey]);
  const toggleStage = useCallback((k: string) => {
    setOpenStages(prev => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  }, []);

  // First 3 moves — earliest unfinished tasks across the journey, in order.
  const firstMoves = useMemo(() => {
    const flat: Task[] = [];
    for (const s of stages) for (const t of s.tasks) if (t.status !== 'completed') flat.push(t);
    return flat.slice(0, 3);
  }, [stages]);

  const todoCount = useMemo(() => tasks.filter(t => t.status === 'todo').length, [tasks]);

  const openDoc = useCallback((deliverableId: string) => {
    window.dispatchEvent(new CustomEvent('open_deliverable', { detail: { deliverableId } }));
  }, []);

  const avatar = (name: string | null) => {
    if (!name) return null;
    const color = colorByName.get(name) ?? 'var(--hatchin-blue)';
    return (
      <span className="inline-grid place-items-center rounded-full text-white shrink-0"
            style={{ width: 16, height: 16, background: color, fontSize: 9, fontWeight: 800 }}>
        {name[0]}
      </span>
    );
  };

  const docChip = (t: Task) => {
    const meta = t.metadata as { deliverableId?: string; producesDocType?: string } | null;
    if (!meta?.deliverableId) return null;
    const label = meta.producesDocType ? getTypeLabel(meta.producesDocType) : 'Document';
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); openDoc(meta.deliverableId!); }}
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-micro font-semibold transition-colors"
        style={{ color: 'var(--hatchin-blue)', background: 'color-mix(in srgb, var(--hatchin-blue) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--hatchin-blue) 26%, transparent)' }}
      >
        <FileText className="w-3 h-3" /> {label}
      </button>
    );
  };

  const taskRow = (t: Task) => {
    const isDone = t.status === 'completed';
    const working = isWorking(t);
    const priorityColor = PRIORITY_COLORS[t.priority ?? 'medium'];
    return (
      <motion.div
        key={t.id}
        initial={{ opacity: 0, y: -3 }}
        animate={{ opacity: 1, y: 0 }}
        className="group flex items-start gap-2.5 px-2 py-2 rounded-lg hover:bg-[var(--hatchin-surface-elevated)] transition-colors"
      >
        <button
          type="button"
          aria-label={isDone ? 'Mark not done' : 'Mark done'}
          onClick={() => onToggle(t.id, t.status ?? 'todo')}
          className="shrink-0 grid place-items-center rounded-full transition-all mt-0.5"
          style={{
            width: 17, height: 17,
            border: `1.6px solid ${isDone ? 'var(--hatchin-green)' : 'var(--hatchin-border)'}`,
            background: isDone ? 'var(--hatchin-green)' : 'transparent',
          }}
        >
          {isDone && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-xs leading-snug hatchin-text"
             style={isDone ? { textDecoration: 'line-through', opacity: 0.5 } : undefined}>
            {t.title}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-micro font-semibold hatchin-text-muted">
              <span className="rounded-full shrink-0" style={{ width: 6, height: 6, background: priorityColor, opacity: isDone ? 0.3 : 1 }} />
              {avatar(t.assignee)}
              {t.assignee}
            </span>
            {working && (
              <span className="inline-flex items-center gap-1 text-micro font-semibold"
                    style={{ color: 'var(--hatchin-working-coral)' }}>
                <Loader2 className="w-3 h-3 animate-spin" />
                Working on it now
              </span>
            )}
            {!working && docChip(t)}
          </div>
        </div>

        <button
          type="button"
          aria-label={`Delete task: ${t.title}`}
          onClick={() => onDelete(t.id)}
          className="flex items-center justify-center rounded-lg shrink-0 min-h-[44px] min-w-[44px] lg:min-h-0 lg:min-w-0 lg:w-7 lg:h-7 text-[var(--hatchin-text-muted)] hover:text-red-400 hover:bg-red-500/10 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 focus-visible:opacity-100 transition-all"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </motion.div>
    );
  };

  // ── Delegation / first-moves CTA (mirrors TasksTab's gating) ──────────────
  const delegateCta = () => {
    if (firstMoves.length === 0) return null;
    if (!isPro) {
      return (
        <div className="rounded-xl px-3.5 py-3 mt-3 flex flex-col gap-1"
             style={{ background: 'var(--hatchin-surface-elevated)', border: '1px solid var(--hatchin-border-subtle)' }}>
          <span className="flex items-center gap-2 text-xs font-semibold hatchin-text">
            <Lock className="w-3.5 h-3.5 opacity-80 flex-none" /> Let the team do these for you
          </span>
          <span className="text-micro hatchin-text-muted leading-relaxed">
            Having the team run tasks in the background is a{' '}
            <a href="/account" className="text-[var(--hatchin-blue)] font-semibold hover:underline">Pro feature</a>. You can still work through them yourself.
          </span>
        </div>
      );
    }
    if (!autonomyEnabled) {
      return (
        <div className="rounded-xl px-3.5 py-3 mt-3 flex flex-col gap-1"
             style={{ background: 'var(--hatchin-surface-elevated)', border: '1px solid var(--hatchin-border-subtle)' }}>
          <span className="flex items-center gap-2 text-xs font-semibold hatchin-text">
            <Lock className="w-3.5 h-3.5 opacity-80 flex-none" /> Autonomy is off
          </span>
          <span className="text-micro hatchin-text-muted leading-relaxed">
            Turn it on in{' '}
            <button onClick={openBrainSettings} className="text-[var(--hatchin-blue)] font-semibold hover:underline">Brain, Autonomy settings</button>{' '}
            to let the team start on these.
          </span>
        </div>
      );
    }
    if (todoCount === 0) return null;
    return (
      <button
        onClick={onDelegate}
        className="hit-target mt-3 w-full flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-[filter] hover:brightness-110"
        style={{ background: 'var(--hatchin-blue)' }}
      >
        <Play className="w-4 h-4 flex-none" fill="currentColor" />
        Let the team start on these
        <span className="opacity-80 font-medium">· {todoCount} to-do{todoCount !== 1 ? 's' : ''}</span>
      </button>
    );
  };

  if (stages.length === 0) return null; // caller guarantees staged tasks exist

  return (
    <div className="px-1">
      <div className="mb-3 px-1">
        <p className="text-xs font-semibold hatchin-text mb-0.5">Your plan</p>
        <p className="text-xs hatchin-text-muted leading-relaxed">Your team set this up. Work through it one stage at a time, or hand a stage to the team.</p>
      </div>

      {/* First 3 moves */}
      {firstMoves.length > 0 && (
        <div className="rounded-2xl px-3.5 pt-3 pb-3.5 mb-4 mx-0.5"
             style={{ background: 'var(--hatchin-surface-elevated)', border: '1px solid var(--hatchin-border-subtle)' }}>
          <div className="flex items-center gap-2 mb-2.5">
            <span className="rounded-full" style={{ width: 6, height: 6, background: 'var(--hatchin-orange)' }} />
            <span className="text-micro font-bold uppercase tracking-wider" style={{ color: 'var(--hatchin-orange)' }}>
              Your first {firstMoves.length === 1 ? 'move' : `${firstMoves.length} moves`}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            {firstMoves.map((m, i) => (
              <div key={m.id} className="flex items-center gap-2.5 py-1">
                <span className="grid place-items-center rounded-full shrink-0 text-micro font-bold hatchin-text-muted"
                      style={{ width: 18, height: 18, background: 'var(--hatchin-surface)', border: '1px solid var(--hatchin-border-subtle)' }}>
                  {i + 1}
                </span>
                <span className="flex-1 text-xs hatchin-text leading-snug">{m.title}</span>
                <span className="inline-flex items-center gap-1.5 text-micro hatchin-text-muted font-semibold shrink-0">
                  {avatar(m.assignee)}{m.assignee}
                </span>
              </div>
            ))}
          </div>
          {delegateCta()}
        </div>
      )}

      <p className="text-micro font-semibold hatchin-text-muted uppercase tracking-wider mb-2 px-1">
        The journey<span className="ml-2 font-normal normal-case tracking-normal">{stages.length} stages</span>
      </p>

      {/* Stages */}
      <div className="flex flex-col gap-2">
        {stages.map((s, idx) => {
          const isCurrent = s.key === currentKey;
          const isDone = s.complete;
          const isFuture = !isDone && !isCurrent;
          const isOpen = openStages.has(s.key);
          const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
          return (
            <div
              key={s.key}
              className="rounded-2xl overflow-hidden"
              style={{
                background: 'var(--hatchin-card)',
                border: `1px solid ${isDone ? 'color-mix(in srgb, var(--hatchin-green) 40%, var(--hatchin-border-subtle))' : 'var(--hatchin-border-subtle)'}`,
                opacity: isFuture && !isOpen ? 0.62 : 1,
              }}
            >
              <button
                onClick={() => toggleStage(s.key)}
                className="flex items-center gap-2.5 w-full text-left px-3 py-3"
              >
                {isOpen ? <ChevronDown className="w-3.5 h-3.5 hatchin-text-muted shrink-0" />
                        : <ChevronRight className="w-3.5 h-3.5 hatchin-text-muted shrink-0" />}
                <span className="grid place-items-center rounded-lg shrink-0 text-xs font-extrabold"
                      style={{
                        width: 24, height: 24,
                        background: isDone ? 'color-mix(in srgb, var(--hatchin-green) 16%, transparent)' : isCurrent ? 'var(--hatchin-blue)' : 'var(--hatchin-surface)',
                        color: isDone ? 'var(--hatchin-green)' : isCurrent ? '#fff' : 'var(--hatchin-text-muted)',
                        border: isDone || isCurrent ? 'none' : '1px solid var(--hatchin-border-subtle)',
                      }}>
                  {isDone ? '✓' : idx + 1}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2 text-xs font-bold hatchin-text">
                    {s.label}
                    {isDone
                      ? <span className="text-micro font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--hatchin-green) 14%, transparent)', color: 'var(--hatchin-green)' }}>Done</span>
                      : isCurrent
                        ? <span className="text-micro font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--hatchin-working-tint)', color: 'var(--hatchin-working-coral)' }}>You're here</span>
                        : <span className="text-micro font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--hatchin-surface-muted)', color: 'var(--hatchin-text-muted)' }}>Up next</span>}
                  </span>
                  <span className="flex items-center gap-2 mt-1 text-micro hatchin-text-muted">
                    {isFuture && <Lock className="w-3 h-3" />}
                    <span className="rounded-full overflow-hidden" style={{ height: 4, width: 110, background: 'var(--hatchin-surface-muted)' }}>
                      <i className="block h-full rounded-full" style={{ width: `${pct}%`, background: isCurrent ? 'var(--hatchin-blue)' : 'var(--hatchin-green)' }} />
                    </span>
                    {s.done} of {s.total} done
                  </span>
                </span>
              </button>
              {isOpen && (
                <div className="px-2.5 pb-2.5 flex flex-col gap-0.5">
                  {s.tasks.map(taskRow)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Non-staged tasks (added later / from chat) */}
      {others.length > 0 && (
        <div className="mt-4">
          <p className="text-micro font-semibold hatchin-text-muted uppercase tracking-wider mb-2 px-1">
            Also on your list<span className="ml-2 font-normal normal-case tracking-normal">{others.length}</span>
          </p>
          <div className="flex flex-col gap-0.5">
            {others.map(taskRow)}
          </div>
        </div>
      )}
    </div>
  );
}
