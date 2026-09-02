// Chat Attachments — composer upload state.
// Manages the files a user attaches to the current conversation: upload (POST), remove (DELETE),
// promote to the project brain (PATCH), and load any already-attached (GET) on conversation change.
// The backend RAG-indexes each file so agents answer grounded in it; this hook is just the UI state.
import { useState, useEffect, useCallback, useRef } from 'react';

export type AttachmentStatus = 'uploading' | 'ready' | 'error';
export type AttachmentScope = 'ephemeral' | 'brain';

export interface Attachment {
  localId: string;
  filename: string;
  sizeBytes: number;
  status: AttachmentStatus;
  scope: AttachmentScope;
  docId?: string;
  error?: string;
}

const ALLOWED_EXT = ['.pdf', '.docx', '.txt', '.md', '.xlsx', '.csv'];

function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '';
}

let counter = 0;
const nextLocalId = () => `att_${Date.now()}_${counter++}`;

export function useAttachments(conversationId?: string) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  // Guard against a late GET response overwriting fresher local state after a conversation switch.
  const convRef = useRef(conversationId);
  convRef.current = conversationId;

  // Load already-attached (conversation-scoped) files when the conversation changes.
  useEffect(() => {
    if (!conversationId) { setAttachments([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/attachments`, { credentials: 'include' });
        if (!res.ok) return;
        const docs = await res.json();
        if (cancelled || convRef.current !== conversationId) return;
        // Only this chat's own files belong in the composer tray; project-brain docs live in the Brain tab.
        const ephemeral: Attachment[] = (Array.isArray(docs) ? docs : [])
          .filter((d: any) => d.scope === 'ephemeral')
          .map((d: any) => ({ localId: nextLocalId(), filename: d.filename, sizeBytes: d.sizeBytes ?? 0, status: 'ready' as const, scope: 'ephemeral' as const, docId: d.id }));
        setAttachments(ephemeral);
      } catch { /* fail-safe: an empty tray is fine */ }
    })();
    return () => { cancelled = true; };
  }, [conversationId]);

  const patch = useCallback((localId: string, next: Partial<Attachment>) => {
    setAttachments((prev) => prev.map((a) => (a.localId === localId ? { ...a, ...next } : a)));
  }, []);

  const upload = useCallback(async (file: File) => {
    if (!conversationId) return;
    const ext = extOf(file.name);
    const localId = nextLocalId();
    if (!ALLOWED_EXT.includes(ext)) {
      setAttachments((prev) => [...prev, { localId, filename: file.name, sizeBytes: file.size, status: 'error', scope: 'ephemeral', error: 'Only PDF, DOCX, XLSX, CSV, TXT, MD' }]);
      return;
    }
    setAttachments((prev) => [...prev, { localId, filename: file.name, sizeBytes: file.size, status: 'uploading', scope: 'ephemeral' }]);
    try {
      const form = new FormData();
      form.append('document', file);
      form.append('scope', 'ephemeral');
      const res = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/attachments`, { method: 'POST', body: form, credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        patch(localId, { status: 'error', error: data?.error || 'Upload failed' });
        return;
      }
      patch(localId, { status: 'ready', docId: data.id });
    } catch {
      patch(localId, { status: 'error', error: 'Upload failed' });
    }
  }, [conversationId, patch]);

  const remove = useCallback(async (localId: string) => {
    const target = attachments.find((a) => a.localId === localId);
    setAttachments((prev) => prev.filter((a) => a.localId !== localId));
    if (target?.docId && conversationId) {
      try {
        await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/attachments/${target.docId}`, { method: 'DELETE', credentials: 'include' });
      } catch { /* best-effort; the row can be cleaned up later */ }
    }
  }, [attachments, conversationId]);

  const addToBrain = useCallback(async (localId: string) => {
    const target = attachments.find((a) => a.localId === localId);
    if (!target?.docId || !conversationId) return;
    patch(localId, { scope: 'brain' }); // optimistic
    try {
      const res = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/attachments/${target.docId}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, credentials: 'include', body: JSON.stringify({ scope: 'brain' }),
      });
      if (!res.ok) patch(localId, { scope: 'ephemeral' }); // revert on failure
    } catch {
      patch(localId, { scope: 'ephemeral' });
    }
  }, [attachments, conversationId, patch]);

  // Edit an already-attached document per an instruction. The server edits it, posts an agent reply
  // into the chat with a download link, and broadcasts it, so the reply shows up via the normal WS flow.
  const editDocument = useCallback(async (docId: string, instruction: string): Promise<{ ok: boolean; error?: string }> => {
    if (!conversationId) return { ok: false, error: 'No conversation' };
    try {
      const res = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/attachments/${docId}/edit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ instruction }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: data?.error || 'Could not edit the document' };
      return { ok: true };
    } catch {
      return { ok: false, error: 'Could not edit the document' };
    }
  }, [conversationId]);

  return { attachments, upload, remove, addToBrain, editDocument };
}

// Does this message read like a request to EDIT the attached document (vs a question about it)?
export function looksLikeEditRequest(text: string): boolean {
  return /\b(edit|add|rewrite|re-write|revise|update|expand|append|insert|remove|delete|change|fix|adjust|improve|reword|shorten|lengthen|rework|polish|go through|fill in|flesh out|turn this into|make it)\b/i.test(text || '');
}
