// Chat Attachments — upload / list / delete files attached to a conversation.
// Upload path is hardened (magic-byte sniff, size cap, per-user daily cap) and cost-guarded (embeddings
// cost money). On upload we extract text and RAG-embed it scoped to the conversation, so the agent can
// answer questions grounded in the file (see server/knowledge/rag/conversationDocs.ts). Ownership is
// enforced via the conversation's project.
import type { Express, Request, Response } from 'express';
import multer from 'multer';
import { storage } from '../storage.js';
import { extractDocumentText } from '../lib/extractDocumentText.js';
import { sniffUpload } from '../lib/uploadSecurity.js';
import { checkCostGuard, costGuardMessage } from '../billing/costGuard.js';
import { parseConversationId } from '../../shared/conversationId.js';
import {
  ingestConversationDocument,
  listConversationDocuments,
  getConversationDocument,
  deleteConversationDocument,
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
}
