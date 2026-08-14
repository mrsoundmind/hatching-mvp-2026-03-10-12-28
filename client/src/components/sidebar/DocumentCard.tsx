import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { FileText, Trash2 } from 'lucide-react';
import * as HoverCardPrimitive from '@radix-ui/react-hover-card';

import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';

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

/**
 * A one-line "what is this document about" preview drawn from the stored content,
 * so the card answers the founder's question without opening the file. Skips a
 * leading heading that just repeats the title. (A richer auto-generated summary and
 * category is the server-side follow-up, R1-4.)
 */
function contentPreview(doc: DocumentCardDoc): string {
  const lines = (doc.content || '')
    .split('\n')
    .map(l => l.replace(/^#+\s*/, '').replace(/[*_`>#]/g, '').trim())
    .filter(Boolean);
  if (lines.length === 0) return '';
  const titleKey = (doc.title || '')
    .replace(/\.(pdf|docx?|md|txt)$/i, '')
    .replace(/[-_]/g, ' ')
    .trim()
    .toLowerCase();
  let body = lines;
  const first = lines[0].toLowerCase();
  if (first === titleKey || (lines[0].length < 48 && lines.length > 1)) {
    body = lines.slice(1);
  }
  const text = (body.join(' ') || lines.join(' ')).trim();
  return text ? text.slice(0, 140) : '';
}

/**
 * A fuller, multi-line excerpt shown on hover, so the card can stay compact but the
 * whole document is one hover away. Keeps line structure, strips heavy markdown.
 */
function detailPreview(doc: DocumentCardDoc): string {
  const raw = (doc.content || '').trim();
  if (!raw) return '';
  const cleaned = raw
    .split('\n')
    .map(l =>
      l
        .replace(/^#{1,6}\s*/, '')
        .replace(/^[-*]\s+/, '• ')
        .replace(/[*_`>]/g, '')
        .trimEnd(),
    )
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const LIMIT = 480;
  return cleaned.length > LIMIT ? cleaned.slice(0, LIMIT).trimEnd() + '…' : cleaned;
}

function wordCount(doc: DocumentCardDoc): number {
  const words = (doc.content || '').trim().split(/\s+/).filter(Boolean);
  return words.length;
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

/** Human-readable file kind, so the card reads "Markdown" not "MD". */
function friendlyType(type: string): string {
  const ext = type.replace('uploaded-', '').toLowerCase();
  const map: Record<string, string> = { pdf: 'PDF', docx: 'Word', doc: 'Word', md: 'Markdown', txt: 'Text' };
  return map[ext] || ext.toUpperCase();
}

/**
 * forwardRef so framer-motion's AnimatePresence (in BrainDocsTab) can attach a ref
 * without the "Function components cannot be given refs" console warning.
 */
export const DocumentCard = forwardRef<HTMLDivElement, DocumentCardProps>(
  function DocumentCard({ doc, onDelete }, ref) {
    const title = displayTitle(doc);
    const preview = contentPreview(doc);
    const detail = detailPreview(doc);
    const words = wordCount(doc);

    return (
      <HoverCard openDelay={200} closeDelay={100}>
        <HoverCardTrigger asChild>
          <motion.div
            ref={ref}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            whileHover={{ y: -1 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="premium-card flex items-start gap-3 px-3 py-3"
          >
            {/* File icon */}
            <FileText className="w-4 h-4 text-[var(--hatchin-text-muted)] shrink-0 mt-0.5" />

            {/* Middle: title + what-is-this preview + meta */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--hatchin-text-bright)] leading-snug line-clamp-2">
                {title}
              </p>
              {preview && (
                <p className="text-xs text-[var(--hatchin-text-muted)] leading-snug mt-1 line-clamp-2">
                  {preview}
                </p>
              )}
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getTypeBadgeClass(doc.type)}`}
                >
                  {friendlyType(doc.type)}
                </span>
                <span className="text-micro text-[var(--hatchin-text-muted)]">
                  Added {formatDate(doc.createdAt)}
                </span>
              </div>
            </div>

            {/* Delete button. Compact 32px icon with an invisible 44px .hit-target overlay. */}
            <button
              type="button"
              aria-label={`Delete ${title}`}
              onClick={() => onDelete(doc.id)}
              className="hit-target w-8 h-8 flex items-center justify-center rounded-lg text-[var(--hatchin-text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0 mt-0.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        </HoverCardTrigger>

        {/* Hover: the fuller picture, portaled so the sidebar overflow does not clip it. */}
        <HoverCardPrimitive.Portal>
          <HoverCardContent
            side="left"
            align="start"
            sideOffset={12}
            className="w-80 border-[var(--hatchin-border-subtle)] bg-[var(--hatchin-surface)] text-[var(--hatchin-text-bright)] shadow-2xl"
          >
            <div className="flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-[var(--hatchin-text-muted)] shrink-0" />
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getTypeBadgeClass(doc.type)}`}
              >
                {friendlyType(doc.type)}
              </span>
              <span className="text-micro text-[var(--hatchin-text-muted)]">
                {words > 0 ? `${words.toLocaleString()} words` : 'Uploaded'} &middot; Added {formatDate(doc.createdAt)}
              </span>
            </div>

            <p className="text-sm font-semibold text-[var(--hatchin-text-bright)] leading-snug mt-2.5">
              {title}
            </p>

            {detail ? (
              <p className="text-xs text-[var(--hatchin-text-muted)] leading-relaxed mt-2 whitespace-pre-line max-h-56 overflow-hidden">
                {detail}
              </p>
            ) : (
              <p className="text-xs text-[var(--hatchin-text-muted)] mt-2">No readable text was extracted from this file.</p>
            )}

            <p className="text-micro text-[var(--hatchin-text-muted)] mt-3 pt-2.5 border-t border-[var(--hatchin-border-subtle)]">
              Your team reads this when they work on the project.
            </p>
          </HoverCardContent>
        </HoverCardPrimitive.Portal>
      </HoverCard>
    );
  },
);
