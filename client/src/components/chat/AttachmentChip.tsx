// Chat Attachments — a single file chip in the composer tray.
// Shows a colored type badge, filename, size, and live status (Uploading amber -> Ready green),
// with an optional "Add to project brain" link and a remove (x). Self-documenting: words not codes.
import { Brain, Check, Loader2, X } from 'lucide-react';
import type { Attachment } from '@/hooks/useAttachments';

const TYPE_COLORS: Record<string, string> = {
  pdf: '#E5533D', docx: '#2B6CE5', txt: '#6B7280', md: '#111827',
};

function fmtSize(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function typeOf(filename: string): string {
  const i = filename.lastIndexOf('.');
  return i >= 0 ? filename.slice(i + 1).toLowerCase() : 'file';
}

interface Props {
  att: Attachment;
  onRemove: (localId: string) => void;
  onAddToBrain: (localId: string) => void;
}

export function AttachmentChip({ att, onRemove, onAddToBrain }: Props) {
  const type = typeOf(att.filename);
  const badge = TYPE_COLORS[type] || '#6B7280';

  return (
    <div
      className="inline-flex items-center gap-2 rounded-lg border border-[var(--hatchin-border)] bg-[var(--hatchin-surface-elevated)] px-2 py-1.5 max-w-[300px]"
      data-testid="attachment-chip"
    >
      <span
        className="flex-none grid place-items-center rounded-md text-[9px] font-extrabold uppercase tracking-wide text-white"
        style={{ width: 24, height: 24, background: badge }}
      >
        {type.slice(0, 4)}
      </span>

      <span className="min-w-0">
        <span className="block truncate text-[13px] font-semibold text-[var(--hatchin-text)]" title={att.filename}>
          {att.filename}
        </span>
        <span className="flex items-center gap-1.5 text-micro text-[var(--hatchin-text-muted)]">
          {att.status === 'uploading' && (
            <span className="inline-flex items-center gap-1" style={{ color: 'var(--hatchin-working-amber)' }}>
              <Loader2 className="w-3 h-3 animate-spin" /> Uploading…
            </span>
          )}
          {att.status === 'ready' && att.scope === 'ephemeral' && (
            <span className="inline-flex items-center gap-1" style={{ color: 'var(--hatchin-green)' }}>
              <Check className="w-3 h-3" /> Ready
            </span>
          )}
          {att.status === 'ready' && att.scope === 'brain' && (
            <span className="inline-flex items-center gap-1" style={{ color: 'var(--hatchin-blue)' }}>
              <Brain className="w-3 h-3" /> In project brain
            </span>
          )}
          {att.status === 'error' && (
            <span style={{ color: '#D2503F' }}>{att.error || 'Failed'}</span>
          )}
          {fmtSize(att.sizeBytes) && <span aria-hidden>· {fmtSize(att.sizeBytes)}</span>}
        </span>
      </span>

      {att.status === 'ready' && att.scope === 'ephemeral' && (
        <button
          type="button"
          onClick={() => onAddToBrain(att.localId)}
          title="Make this available to every agent in every chat"
          className="hit-target flex-none inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-micro font-semibold transition-colors"
          style={{ color: 'var(--hatchin-blue)' }}
          data-testid="attachment-add-brain"
        >
          <Brain className="w-3.5 h-3.5" /> Add to brain
        </button>
      )}

      <button
        type="button"
        onClick={() => onRemove(att.localId)}
        aria-label={`Remove ${att.filename}`}
        className="hit-target flex-none rounded-md p-1 text-[var(--hatchin-text-muted)] hover:text-[var(--hatchin-text)] hover:bg-white/5 transition-colors"
        data-testid="attachment-remove"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
