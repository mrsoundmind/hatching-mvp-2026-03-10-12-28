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
    return 'bg-[var(--hatchin-blue)] text-white';
  }
  if (type === 'uploaded-docx') {
    return 'bg-[var(--hatchin-orange)] text-white';
  }
  if (type === 'uploaded-md') {
    return 'bg-[var(--hatchin-green)] text-white';
  }
  // TXT and others
  return 'bg-[var(--hatchin-surface)] text-[var(--hatchin-text-muted)]';
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
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="flex items-center gap-2.5 px-3 py-3 rounded-[10px] bg-[var(--hatchin-surface-elevated)] border border-[var(--hatchin-border-subtle)]"
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
            className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${getTypeBadgeClass(doc.type)}`}
          >
            {getBadgeLabel(doc.type)}
          </span>
          <span className="text-[11px] text-[var(--hatchin-text-muted)]">
            {formatDate(doc.createdAt)}
          </span>
        </div>
      </div>

      {/* Delete button */}
      <button
        type="button"
        aria-label={`Delete ${doc.title}`}
        onClick={() => onDelete(doc.id)}
        className="w-8 h-8 flex items-center justify-center rounded text-[var(--hatchin-text-muted)] hover:text-red-400 transition-colors shrink-0"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}
