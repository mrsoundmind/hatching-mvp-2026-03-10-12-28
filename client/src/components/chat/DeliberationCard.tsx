import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, ChevronDown, Check } from 'lucide-react';

interface DeliberationCardProps {
  agentNames: string[];
  roundCount: number;
  status: 'ongoing' | 'resolved';
  summary?: string;
  onDismiss?: () => void;
}

export function DeliberationCard({
  agentNames,
  roundCount,
  status,
  summary,
  onDismiss,
}: DeliberationCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const isResolved = status === 'resolved';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      <div className="mx-4 my-1.5 p-3 rounded-xl border border-gray-400/20 bg-gray-400/5">
        {/* Header row */}
        <div className="flex items-center gap-2">
          {isResolved ? (
            <Check className="w-4 h-4 text-green-400 shrink-0" />
          ) : (
            <Users className="w-4 h-4 text-gray-400 shrink-0" />
          )}

          <span className="flex-1 text-sm font-medium hatchin-text">
            {isResolved ? 'Coordination complete' : 'Agents coordinating...'}
          </span>

          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="p-0.5 rounded transition-colors hover:bg-gray-400/10 text-hatchin-text-muted"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-150 ${isExpanded ? 'rotate-180' : ''}`}
            />
          </button>

          {isResolved && onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="text-xs text-hatchin-text-muted hover:text-hatchin-text transition-colors ml-1"
            >
              Dismiss
            </button>
          )}
        </div>

        {/* Agent names row */}
        <span className="text-xs text-hatchin-text-muted mt-1 block">
          {agentNames.join(' + ')} {agentNames.length === 1 ? 'is' : 'are'} working through this
        </span>

        {/* Expandable detail section */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <div className="mt-2 pt-2 border-t border-gray-400/15">
                <p className="text-xs text-hatchin-text-muted">
                  {roundCount} coordination round{roundCount !== 1 ? 's' : ''}
                </p>
                {summary && (
                  <p className="text-xs text-hatchin-text mt-1">{summary}</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
