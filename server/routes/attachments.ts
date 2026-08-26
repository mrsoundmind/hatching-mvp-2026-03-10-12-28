// Chat Attachments — upload / list / delete files attached to a conversation.
// Upload path is hardened (magic-byte sniff, size cap, per-user daily cap) and cost-guarded (embeddings
// cost money). On upload we extract text and RAG-embed it scoped to the conversation, so the agent can
// answer questions grounded in the file (see server/knowledge/rag/conversationDocs.ts). Ownership is
// enforced via the conversation's project.
import type { Express, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import multer from 'multer';
import { storage } from '../storage.js';
import { extractDocumentText } from '../lib/extractDocumentText.js';
import { sniffUpload } from '../lib/uploadSecurity.js';
import { checkCostGuard, costGuardMessage } from '../billing/costGuard.js';
import { parseConversationId } from '../../shared/conversationId.js';
import { editDocument, isSupportedDocument, type SupportedExt } from '../documents/documentEditor.js';
import { getOriginalDocument, storeEditedDocument, getEditedDocument } from '../documents/documentStore.js';
import {
  ingestConversationDocument,
  listConversationDocuments,
  getConversationDocument,
  deleteConversationDocument,
  promoteToBrain,
  countUserUploadsToday,
  type DocScope,
} from '../knowledge/rag/conversationDocs.js';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB, matches the brain-upload path
const DAILY_UPLOAD_CAP = Number(process.env.RAG_DOC_DAILY_CAP ?? 50);

export function registerAttachmentRoutes(app: Express) {
  const getSessionUserId = (req: Request): string => (req.session as any).userId as string;

  // Resolve the project that owns a conversation, verifying the session user owns that project.
  const getOwnedProjectForConversation = async (conversationId: string, userId: string) => {
    let projectId: string;
    try {
      projectId = parseConversationId(conversationId).projectId;
    } catch {
      return null;
    }
    if (!projectId) return null;
    const project = await storage.getProject(projectId);
    if (!project || (project as any).userId !== userId) return null;
    return project;
  };

  const enforceCostGuard = async (userId: string, res: Response): Promise<boolean> => {
    const guard = await checkCostGuard(storage, userId);
    if (!guard.allowed && guard.reason) {
      res.status(429).json({ error: costGuardMessage(guard.reason), code: guard.reason });
      return false;
    }
    return true;
  };

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  });

  // POST /api/conversations/:conversationId/attachments — attach a file to a chat and RAG-index it.
  app.post(
    '/api/conversations/:conversationId/attachments',
    (req, res, next) => {
      upload.single('document')(req, res, (err: any) => {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File must be under 10MB' });
          return res.status(400).json({ error: err.message });
        }
        if (err) return res.status(400).json({ error: err.message });
        next();
      });
    },
    async (req, res) => {
      try {
        const userId = getSessionUserId(req);
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const conversationId = req.params.conversationId;
        const project = await getOwnedProjectForConversation(conversationId, userId);
        if (!project) return res.status(404).json({ error: 'Conversation not found' });

        if (!req.file) return res.status(400).json({ error: 'No file provided' });

        // Real-bytes content-type check (renamed binaries can't slip past the extension).
        const sniff = sniffUpload(req.file.buffer, req.file.originalname);
        if (!sniff.ok) return res.status(400).json({ error: sniff.reason || 'Unsupported file' });

        // Per-user daily cap (anti-abuse; embeddings cost money).
        const usedToday = await countUserUploadsToday(userId);
        if (usedToday >= DAILY_UPLOAD_CAP) {
          return res.status(429).json({ error: `Daily upload limit reached (${DAILY_UPLOAD_CAP} files). Try again tomorrow.`, code: 'upload_daily_cap' });
        }

        // Cost guard (embeddings spend) — same brake as the chat path.
        if (!(await enforceCostGuard(userId, res))) return;

        const scope: DocScope = req.body?.scope === 'brain' ? 'brain' : 'ephemeral';

        const text = await extractDocumentText(req.file.buffer, req.file.originalname);
        if (!text.trim()) {
          return res.status(422).json({ error: 'Could not read any text from that file. It may be scanned, image-only, or corrupt.' });
        }

        const result = await ingestConversationDocument({
          projectId: (project as any).id,
          conversationId: scope === 'brain' ? null : conversationId,
          filename: req.file.originalname,
          mime: req.file.mimetype,
          sizeBytes: req.file.size,
          text,
          uploadedByUserId: userId,
          scope,
          // Keep the original bytes for editable doc types so the file can be edited + returned later.
          rawBytes: isSupportedDocument(req.file.originalname) ? req.file.buffer : null,
        });

        return res.status(201).json({
          id: result.documentId,
          filename: req.file.originalname,
          mime: req.file.mimetype,
          sizeBytes: req.file.size,
          scope,
          chunks: result.chunks,
          charCount: result.charCount,
        });
      } catch (error) {
        console.error('Failed to upload attachment:', error);
        return res.status(500).json({ error: 'Failed to process attachment' });
      }
    },
  );

  // GET /api/conversations/:conversationId/attachments — list files attached to this chat (+ project brain).
  app.get('/api/conversations/:conversationId/attachments', async (req, res) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const conversationId = req.params.conversationId;
      const project = await getOwnedProjectForConversation(conversationId, userId);
      if (!project) return res.status(404).json({ error: 'Conversation not found' });
      const docs = await listConversationDocuments(conversationId, (project as any).id);
      return res.json(docs);
    } catch (error) {
      console.error('Failed to list attachments:', error);
      return res.status(500).json({ error: 'Failed to list attachments' });
    }
  });

  // PATCH /api/conversations/:conversationId/attachments/:docId — promote a chat file to the project brain.
  app.patch('/api/conversations/:conversationId/attachments/:docId', async (req, res) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const conversationId = req.params.conversationId;
      const project = await getOwnedProjectForConversation(conversationId, userId);
      if (!project) return res.status(404).json({ error: 'Conversation not found' });

      const doc = await getConversationDocument(req.params.docId);
      if (!doc || doc.projectId !== (project as any).id) return res.status(404).json({ error: 'Attachment not found' });

      if (req.body?.scope !== 'brain') {
        return res.status(400).json({ error: "Only { scope: 'brain' } is supported" });
      }
      const promoted = await promoteToBrain(req.params.docId);
      return res.json({ id: req.params.docId, scope: 'brain', promoted });
    } catch (error) {
      console.error('Failed to promote attachment:', error);
      return res.status(500).json({ error: 'Failed to update attachment' });
    }
  });

  // DELETE /api/conversations/:conversationId/attachments/:docId — remove a file + its chunks (erasure).
  app.delete('/api/conversations/:conversationId/attachments/:docId', async (req, res) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const conversationId = req.params.conversationId;
      const project = await getOwnedProjectForConversation(conversationId, userId);
      if (!project) return res.status(404).json({ error: 'Conversation not found' });

      // The document must belong to this owned project (prevents deleting another project's doc by id).
      const doc = await getConversationDocument(req.params.docId);
      if (!doc || doc.projectId !== (project as any).id) return res.status(404).json({ error: 'Attachment not found' });

      const deleted = await deleteConversationDocument(req.params.docId);
      return res.status(deleted ? 204 : 404).end();
    } catch (error) {
      console.error('Failed to delete attachment:', error);
      return res.status(500).json({ error: 'Failed to delete attachment' });
    }
  });

  const EXT_LABEL: Record<SupportedExt, string> = {
    '.docx': 'Word document', '.pdf': 'PDF', '.md': 'Markdown file', '.txt': 'text file',
  };

  // POST /api/conversations/:conversationId/attachments/:docId/edit
  // Edit a previously-attached document per an instruction, and post the edited file back INTO the chat
  // as a normal agent message carrying a durable download link. This is the whole "edit my document in
  // chat" feature — no separate UI, the reply just has a downloadable file.
  app.post('/api/conversations/:conversationId/attachments/:docId/edit', async (req, res) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const conversationId = req.params.conversationId;
      const project = await getOwnedProjectForConversation(conversationId, userId);
      if (!project) return res.status(404).json({ error: 'Conversation not found' });

      const instruction = String(req.body?.instruction ?? '').trim();
      if (!instruction) return res.status(400).json({ error: 'Tell me what to change in the document.' });

      // Editing spends an LLM call — same brake as the chat path.
      if (!(await enforceCostGuard(userId, res))) return;

      const original = await getOriginalDocument(req.params.docId);
      if (!original || original.projectId !== (project as any).id) {
        return res.status(404).json({ error: 'That document is not available to edit (it may pre-date the editing feature).' });
      }
      if (!isSupportedDocument(original.filename)) {
        return res.status(415).json({ error: 'That file type cannot be edited yet.' });
      }

      // Author the reply as a real teammate — Maya if present, else the first agent on the project.
      const agents = await storage.getAgentsByProject((project as any).id);
      const author = agents.find((a) => (a as any).isSpecialAgent) || agents[0] || null;
      const agentRole = (req.body?.agentRole as string | undefined) || (author as any)?.role;

      const edited = await editDocument({ buffer: original.buffer, filename: original.filename, instruction, agentRole });

      const editedId = await storeEditedDocument({
        projectId: (project as any).id,
        conversationId,
        sourceDocumentId: original.documentId,
        filename: edited.filename,
        mime: edited.mime,
        bytes: edited.buffer,
        createdByUserId: userId,
      });
      const downloadUrl = `/api/conversations/${encodeURIComponent(conversationId)}/attachments/edited/${editedId}/download`;

      const reply = `Done. ${edited.summary} Your edited ${EXT_LABEL[edited.ext]} is ready to download below.`;
      const editedDocument = {
        id: editedId, filename: edited.filename, mime: edited.mime, downloadUrl,
        addedSections: edited.addedSections, keptSections: edited.keptSections,
      };
      const message = await storage.createMessage({
        id: randomUUID(),
        conversationId,
        content: reply,
        messageType: 'agent',
        agentId: (author as any)?.id ?? null,
        userId: null,
        metadata: { agentRole: agentRole ?? null, editedDocument },
      } as any);

      // Show it live in the chat (durable already — it's a persisted message).
      try {
        const { getGlobalBroadcast } = await import('../routes.js');
        const broadcast = getGlobalBroadcast();
        if (broadcast) broadcast(conversationId, { type: 'new_message', conversationId, message });
      } catch { /* live push is best-effort; the message is persisted regardless */ }

      return res.status(201).json({ message, editedDocument: { ...editedDocument, summary: edited.summary } });
    } catch (error) {
      console.error('Failed to edit document:', error);
      return res.status(500).json({ error: 'Failed to edit the document' });
    }
  });

  // GET /api/conversations/:conversationId/attachments/edited/:editedId/download — stream the edited file.
  app.get('/api/conversations/:conversationId/attachments/edited/:editedId/download', async (req, res) => {
    try {
      const userId = getSessionUserId(req);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const conversationId = req.params.conversationId;
      const project = await getOwnedProjectForConversation(conversationId, userId);
      if (!project) return res.status(404).json({ error: 'Conversation not found' });

      const doc = await getEditedDocument(req.params.editedId);
      if (!doc || doc.conversationId !== conversationId) return res.status(404).json({ error: 'File not found' });

      res.setHeader('Content-Type', doc.mime || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${doc.filename.replace(/["\r\n]/g, '')}"`);
      res.setHeader('Content-Length', String(doc.buffer.length));
      return res.end(doc.buffer);
    } catch (error) {
      console.error('Failed to download edited document:', error);
      return res.status(500).json({ error: 'Failed to download the file' });
    }
  });
}
