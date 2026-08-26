// The one new UI element for in-chat document editing: an agent reply that carries an edited file
// shows this card with a real download link. Everything else is the normal chat + composer.
import { FileText, Download } from 'lucide-react';

export interface EditedDocumentMeta {
  id: string;
  filename: string;
  mime?: string | null;
  downloadUrl: string;
  addedSections?: string[];
  keptSections?: number;
}

function formatLabel(filename: string): string {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  const name =
    ext === 'docx' ? 'Word' :
    ext === 'pdf' ? 'PDF' :
    ext === 'md' ? 'Markdown' :
    ext === 'txt' ? 'Text' : ext.toUpperCase();
  return `${name} · same format you sent`;
}

export function EditedDocumentCard({ doc }: { doc: EditedDocumentMeta }) {
  if (!doc?.downloadUrl || !doc?.filename) return null;
  return (
    <div
      data-testid="edited-document-card"
      className="mt-3 flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3"
    >
      <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
        <FileText className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-foreground" title={doc.filename}>
          {doc.filename}
        </div>
        <div className="text-xs text-muted-foreground">{formatLabel(doc.filename)}</div>
      </div>
      <a
        href={doc.downloadUrl}
        download={doc.filename}
        data-testid="edited-document-download"
        className="ml-auto inline-flex flex-shrink-0 items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition hover:brightness-110"
      >
        <Download className="h-4 w-4" />
        Download
      </a>
    </div>
  );
}
