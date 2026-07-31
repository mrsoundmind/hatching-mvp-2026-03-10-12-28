import { motion } from 'framer-motion';
import { FileText, Trash2 } from 'lucide-react';

interface DocumentCardDoc {
  id: string;
  title: string;
  content?: string;
  type: string;
  createdAt: string;
}

/**
 * Belt-and-suspenders for legacy rows already stored as "Untitled Document" (the
 * server now derives real titles at creation, P1-C). Falls back to the first line
 * of content so the list stays scannable.
 */
function displayTitle(doc: DocumentCardDoc): string {
  const t = (doc.title || '').trim();
  if (t && t.toLowerCase() !== 'untitled document') return t;
  const firstLine = (doc.content || '')
    .split('\n')
    .map(l => l.trim())
    .find(l => l.length > 0) || '';
  const cleaned = firstLine.replace(/^#+\s*/, '').replace(/[*_`>#]/g, '').trim();
  return cleaned ? cleaned.slice(0, 80) : 'Untitled note';
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
  const title = displayTitle(doc);
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
          {title}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getTypeBadgeClass(doc.type)}`}
          >
            {getBadgeLabel(doc.type)}
          </span>
          <span className="text-micro text-[var(--hatchin-text-muted)]">
            {formatDate(doc.createdAt)}
          </span>
        </div>
      </div>

      {/* Delete button — stays a compact 32px icon visually, but .hit-target adds an
          invisible 44px centered hit area on every breakpoint (P1-E), so desktop no
          longer falls under the 44px minimum the way min-h-0/min-w-0 did. */}
      <button
        type="button"
        aria-label={`Delete ${title}`}
        onClick={() => onDelete(doc.id)}
        className="hit-target w-8 h-8 flex items-center justify-center rounded-lg text-[var(--hatchin-text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}
