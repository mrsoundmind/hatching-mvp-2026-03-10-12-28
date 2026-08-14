import { useMemo, useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Lock, Play, FileText, Check, Trash2, Loader2, Compass, Hammer, Rocket, TrendingUp } from 'lucide-react';
import { useAgentWorkingState } from '@/hooks/useAgentWorkingState';
import AgentAvatar from '@/components/avatars/AgentAvatar';
import { getTypeLabel } from '@shared/deliverableTypes';
import type { Task, Agent } from '@shared/schema';
import '../starter-pack/biab.css';

/**
 * Business-in-a-Box — In-project Journey view (BIAB-1 / PROC-03).
 *
 * A faithful build of the approved v3 mockup's "Your journey" (artifact 17f0a255):
 * a progress bar, a blue "first moves" starter card, and staged sections of clean
 * task rows with live done / working states. Styling comes from ../starter-pack/biab.css
 * (which maps onto the app's own --hatchin-* tokens, so it matches the app + theme).
 *
 * Soft guidance, never gates (decision 2026-08-10): every stage is openable; a
 * future stage is only dimmed and collapsed, never locked out.
 *
 * Side-effects reuse existing app plumbing (no sibling-owned file changes):
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

const STAGE_ICON: Record<StageKey, typeof Compass> = {
  prerequisites: Compass,
  build: Hammer,
  launch: Rocket,
  grow: TrendingUp,
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
  const isWorking = useCallback((t: Task): boolean => {
    if (t.status === 'in_progress') return true;
    if (t.status === 'completed') return false;
    const id = t.assignee ? agentIdByName.get(t.assignee) : undefined;
    return !!id && workingAgents.has(id);
  }, [agentIdByName, workingAgents]);

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

  const currentKey = useMemo(() => {
    const c = stages.find(s => !s.complete);
    return c?.key ?? stages[stages.length - 1]?.key ?? null;
  }, [stages]);

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

  const firstMoves = useMemo(() => {
    const flat: Task[] = [];
    for (const s of stages) for (const t of s.tasks) if (t.status !== 'completed') flat.push(t);
    return flat.slice(0, 3);
  }, [stages]);

  const todoCount = useMemo(() => tasks.filter(t => t.status === 'todo').length, [tasks]);
  const totalStaged = useMemo(() => stages.reduce((n, s) => n + s.total, 0), [stages]);
  const doneStaged = useMemo(() => stages.reduce((n, s) => n + s.done, 0), [stages]);
  const pct = totalStaged ? Math.round((doneStaged / totalStaged) * 100) : 0;
  const currentLabel = currentKey ? STAGE_LABEL[currentKey] : '';

  const openDoc = useCallback((deliverableId: string) => {
    window.dispatchEvent(new CustomEvent('open_deliverable', { detail: { deliverableId } }));
  }, []);

  const taskRow = (t: Task) => {
    const isDone = t.status === 'completed';
    const working = isWorking(t);
    const meta = t.metadata as { deliverableId?: string; producesDocType?: string } | null;
    const docId = meta?.deliverableId;
    const docLabel = docId ? (meta?.producesDocType ? getTypeLabel(meta.producesDocType) : 'Document') : null;
    const hasMeta = working || !!docId || !!t.assignee;
    return (
      <div key={t.id} className={`biab-trow${isDone ? ' done' : ''}${working ? ' working' : ''}`}>
        <button type="button" className="cbx" aria-label={isDone ? 'Mark not done' : 'Mark done'} onClick={() => onToggle(t.id, t.status ?? 'todo')}>
          {isDone && <Check size={9} strokeWidth={3} />}
        </button>
        <div className="tmain">
          <span className="tt">{t.title}</span>
          {hasMeta && (
            <div className="tmeta">
              {working && <span className="live"><Loader2 size={10} className="animate-spin" /> Working</span>}
              {docId && (
                <button type="button" className="doc2" onClick={(e) => { e.stopPropagation(); openDoc(docId); }}>
                  <FileText size={10} /> {docLabel}
                </button>
              )}
              {t.assignee && (
                <span className="who2"><AgentAvatar agentName={t.assignee} size={16} /> {t.assignee}</span>
              )}
            </div>
          )}
        </div>
        <button type="button" className="tdel" aria-label={`Delete task: ${t.title}`} onClick={() => onDelete(t.id)}>
          <Trash2 size={13} />
        </button>
      </div>
    );
  };

  // Delegation / first-moves CTA (mirrors TasksTab's gating).
  const delegateCta = () => {
    if (firstMoves.length === 0) return null;
    if (!isPro) {
      return (
        <div className="rounded-xl px-3.5 py-3 mb-2 flex flex-col gap-1" style={{ background: 'var(--panel-2)', border: '1px solid var(--line)' }}>
          <span className="flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--ink)' }}>
            <Lock className="w-3.5 h-3.5 opacity-80 flex-none" /> Let the team do these for you
          </span>
          <span className="text-micro leading-relaxed" style={{ color: 'var(--ink-2)' }}>
            Having the team run tasks in the background is a{' '}
            <a href="/account" className="font-semibold hover:underline" style={{ color: 'var(--blue)' }}>Pro feature</a>. You can still work through them yourself.
          </span>
        </div>
      );
    }
    if (!autonomyEnabled) {
      return (
        <div className="rounded-xl px-3.5 py-3 mb-2 flex flex-col gap-1" style={{ background: 'var(--panel-2)', border: '1px solid var(--line)' }}>
          <span className="flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--ink)' }}>
            <Lock className="w-3.5 h-3.5 opacity-80 flex-none" /> Autonomy is off
          </span>
          <span className="text-micro leading-relaxed" style={{ color: 'var(--ink-2)' }}>
            Turn it on in{' '}
            <button onClick={openBrainSettings} className="font-semibold hover:underline" style={{ color: 'var(--blue)' }}>Brain, Autonomy settings</button>{' '}
            to let the team start on these.
          </span>
        </div>
      );
    }
    if (todoCount === 0) return null;
    return (
      <button
        onClick={onDelegate}
        className="hit-target mb-2 w-full flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-[filter] hover:brightness-110"
        style={{ background: 'var(--blue)' }}
      >
        <Play className="w-4 h-4 flex-none" fill="currentColor" />
        Let the team start on these
        <span className="opacity-80 font-medium">· {todoCount} to-do{todoCount !== 1 ? 's' : ''}</span>
      </button>
    );
  };

  if (stages.length === 0) return null; // caller guarantees staged tasks exist

  return (
    <div className="biab biab-jwrap">
      <div className="biab-jh2">Your journey</div>
      <div className="biab-jsub">{totalStaged} staged steps, already assigned</div>

      <div className="biab-prog">
        <div className="biab-track"><div className="biab-fill" style={{ width: `${pct}%` }} /></div>
        <div className="biab-plab"><span>{doneStaged} of {totalStaged} done</span><span>{currentLabel}</span></div>
      </div>

      {delegateCta()}

      {stages.map((s, idx) => {
        const isCurrent = s.key === currentKey;
        const isDone = s.complete;
        const isFuture = !isDone && !isCurrent;
        const isOpen = openStages.has(s.key);
        const Icon = STAGE_ICON[s.key];
        const badgeStyle = isDone
          ? { background: 'rgba(71,219,154,.14)', color: 'var(--green)' }
          : isCurrent
            ? { background: 'var(--blue-wash)', color: 'var(--blue)' }
            : { background: 'var(--panel-3)', color: 'var(--ink-3)' };
        return (
          <div className={`biab-jstg${isFuture && !isOpen ? ' dimmed' : ''}`} key={s.key}>
            <button type="button" className="h" onClick={() => toggleStage(s.key)}>
              {isOpen ? <ChevronDown size={14} className="chev" /> : <ChevronRight size={14} className="chev" />}
              <span className="b" style={badgeStyle}><Icon size={13} /></span>
              <h3>{s.label}</h3>
              {isDone
                ? <span className="biab-pill done">Done</span>
                : isCurrent
                  ? <span className="biab-pill here">You're here</span>
                  : <span className="biab-pill next">Up next</span>}
            </button>
            {isOpen && s.tasks.map(taskRow)}
          </div>
        );
      })}

      {others.length > 0 && (
        <div className="biab-jstg">
          <div className="h" style={{ cursor: 'default' }}>
            <h3 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--ink-3)' }}>
              Also on your list
            </h3>
          </div>
          {others.map(taskRow)}
        </div>
      )}
    </div>
  );
}
