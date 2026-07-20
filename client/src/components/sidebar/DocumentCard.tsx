import { motion } from 'framer-motion';
import { FileText, Trash2 } from 'lucide-react';

interface DocumentCardDoc {
  id: string;
  title: string;
  type: string;
  createdAt: string;
}

interface DocumentCardProps {
  doc: DocumentCardDoc;
  onDelete: (id: string) => void;
}

function getTypeBadgeClass(type: string): string {
  if (type === 'uploaded-pdf') {
    return 'bg-[var(--hatchin-blue)]/15 text-[var(--hatchin-blue)]';
  }
  if (type === 'uploaded-docx') {
    return 'bg-[var(--hatchin-orange)]/15 text-[var(--hatchin-orange)]';
  }
  if (type === 'uploaded-md') {
    return 'bg-[var(--hatchin-green)]/15 text-[var(--hatchin-green)]';
  }
  // TXT and others
  return 'bg-[var(--hatchin-text-muted)]/15 text-[var(--hatchin-text-muted)]';
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getBadgeLabel(type: string): string {
  return type.replace('uploaded-', '').toUpperCase();
}

export function DocumentCard({ doc, onDelete }: DocumentCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      whileHover={{ y: -1 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="premium-card flex items-center gap-3 px-3 py-3"
    >
      {/* File icon */}
      <FileText className="w-4 h-4 text-[var(--hatchin-text-muted)] shrink-0" />

      {/* Middle: title + meta */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--hatchin-text-bright)] truncate">
          {doc.title}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${getTypeBadgeClass(doc.type)}`}
          >
            {getBadgeLabel(doc.type)}
          </span>
          <span className="text-[11px] text-[var(--hatchin-text-muted)]">
            {formatDate(doc.createdAt)}
          </span>
        </div>
      </div>

      {/* Delete button.
          min-h-auto/min-w-auto are not real Tailwind utilities, so the lg: overrides
          were silently dropped and this stayed 44x44 on desktop against a 14px icon.
          min-h-0/min-w-0 are valid and let w-8/h-8 (32px) win from lg up, while touch
          keeps the 44px target. */}
      <button
        type="button"
        aria-label={`Delete ${doc.title}`}
        onClick={() => onDelete(doc.id)}
        className="min-h-[44px] min-w-[44px] lg:min-h-0 lg:min-w-0 w-8 h-8 flex items-center justify-center rounded-lg text-[var(--hatchin-text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}
