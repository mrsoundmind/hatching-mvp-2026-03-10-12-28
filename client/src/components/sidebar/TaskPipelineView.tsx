import { motion } from 'framer-motion';
import { PIPELINE_STAGES } from './approvalUtils';
import type { Task } from '@shared/schema';

interface TaskPipelineViewProps {
  tasks: Task[];
}

const STAGE_COLORS: Record<string, string> = {
  queued:     'var(--hatchin-text-muted)',
  assigned:   'var(--hatchin-blue)',
  inprogress: 'var(--hatchin-blue)',
  review:     'var(--hatchin-orange)',
  done:       'var(--hatchin-green)',
};

/**
 * Horizontal segmented progress bar showing task counts per pipeline stage.
 * No icons. Color-coded segments. Hover tooltip shows stage name + count.
 */
export function TaskPipelineView({ tasks }: TaskPipelineViewProps) {
  const total = tasks.length;
  if (total === 0) return null;

  const stageCounts = PIPELINE_STAGES.map(stage => ({
    ...stage,
    count: tasks.filter(stage.filter).length,
    color: STAGE_COLORS[stage.id] ?? 'var(--hatchin-text-muted)',
  }));

  return (
    <div className="mb-4 px-1">
      {/* Section label */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-micro font-semibold text-[var(--hatchin-text-muted)] uppercase tracking-wider">
          Pipeline
        </span>
        <div className="flex-1 h-px bg-gradient-to-r from-[var(--hatchin-border-subtle)] to-transparent" />
        <span className="text-xs font-semibold hatchin-text">{total} total</span>
      </div>
      <p className="text-xs text-[var(--hatchin-text-muted)] leading-relaxed mb-3">
        The overall flow of work across all tasks from queue to completion.
      </p>

      {/* Segmented horizontal bar */}
      <div className="flex h-1.5 rounded-full overflow-hidden gap-px bg-[var(--hatchin-surface)]">
        {stageCounts.map((stage) => {
          const pct = total > 0 ? (stage.count / total) * 100 : 0;
          if (pct === 0) return null;
          return (
            <motion.div
              key={stage.id}
              style={{ width: `${pct}%`, backgroundColor: stage.color }}
              initial={{ scaleX: 0, originX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="rounded-full"
              title={`${stage.label}: ${stage.count}`}
            />
          );
        })}
      </div>

      {/* Stage labels row */}
      <div className="flex mt-2 gap-x-1 flex-wrap gap-y-1">
        {stageCounts.map((stage) => (
          <motion.div
            key={stage.id}
            whileHover={{ backgroundColor: 'var(--hatchin-surface-elevated)' }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1"
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: stage.color, opacity: stage.count === 0 ? 0.3 : 1 }}
            />
            <span
              className="text-xs"
              style={{
                color: stage.count > 0 ? 'var(--hatchin-text)' : 'var(--hatchin-text-muted)',
                fontWeight: stage.count > 0 ? 600 : 400,
              }}
            >
              {stage.count} {stage.label}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
