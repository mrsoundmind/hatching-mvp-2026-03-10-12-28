import { motion } from 'framer-motion';
import { PIPELINE_STAGES } from './approvalUtils';
import type { Task } from '@shared/schema';

interface TaskPipelineViewProps {
  tasks: Task[];
}

/**
 * Read-only pipeline stage view showing task counts per stage.
 *
 * Renders 5 stages (Queued, Assigned, In Progress, Review, Done) as a compact
 * vertical list. The parent component (ApprovalsTab) is responsible for
 * not rendering this component when tasks is empty — show nothing rather than
 * 5 zero-count rows.
 */
export function TaskPipelineView({ tasks }: TaskPipelineViewProps) {
  return (
    <div className="mt-4 pt-4 border-t border-[var(--hatchin-border-subtle)]">
      <p className="text-xs font-semibold hatchin-text-muted mb-2 px-1">Task pipeline</p>
      <div role="list" className="space-y-1">
        {PIPELINE_STAGES.map((stage, i) => {
          const count = tasks.filter(stage.filter).length;
          return (
            <motion.div
              key={stage.id}
              role="listitem"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.03, duration: 0.12, ease: 'easeOut' }}
              className="flex items-center justify-between px-2 py-1.5 rounded-md"
            >
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full shrink-0 ${stage.dot}`} />
                <span className="text-xs hatchin-text-muted">{stage.label}</span>
              </div>
              <span className="text-xs font-semibold hatchin-text">{count}</span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
