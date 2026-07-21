import type { Express, Request } from 'express';
import { storage } from '../storage.js';
import { insertProjectSchema } from '@shared/schema';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { checkProjectLimit } from '../middleware/tierGate.js';
import multer from 'multer';
import path from 'path';
import { extractDocumentText } from '../lib/extractDocumentText.js';

const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  emoji: z.string().max(10).optional(),
  description: z.string().max(5000).nullable().optional(),
  coreDirection: z.object({
    whatBuilding: z.string().optional(),
    whyMatters: z.string().optional(),
    whoFor: z.string().optional(),
  }).nullable().optional(),
  brain: z.object({
    documents: z.array(z.object({
      id: z.string(),
      title: z.string(),
      content: z.string(),
      type: z.enum(["idea-development", "project-plan", "meeting-notes", "research", "uploaded-pdf", "uploaded-docx", "uploaded-txt", "uploaded-md"]),
      createdAt: z.string(),
    })).optional(),
    sharedMemory: z.string().optional(),
  }).nullable().optional(),
  executionRules: z.object({
    autonomyEnabled: z.boolean().optional(),
    autonomyPaused: z.boolean().optional(),
    inactivityAutonomyEnabled: z.boolean().optional(),
    autonomyLevel: z.enum(['observe', 'propose', 'confirm', 'autonomous']).optional(),
    inactivityTriggerMinutes: z.number().int().min(30).max(480).optional(),
    rules: z.string().optional(),
    taskGraph: z.unknown().optional(),
  }).nullable().optional(),
  starterPack: z.string().max(100).nullable().optional(),
  teamCulture: z.string().max(5000).nullable().optional(),
}).strict();

export interface RegisterProjectDeps {
  broadcastToConversation: (conversationId: string, data: unknown) => void;
}

export function registerProjectRoutes(app: Express, deps: RegisterProjectDeps): void {
  const devLog = (...args: any[]) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(...args);
    }
  };

  const getSessionUserId = (req: Request): string => (req.session as any).userId as string;

  const getOwnedProject = async (projectId: string, userId: string) => {
    const project = await storage.getProject(projectId);
    if (!project) return null;
    return (project as any).userId === userId ? project : null;
  };

  app.get("/api/projects", async (req, res) => {
    try {
      const projects = await storage.getProjects();
      const userId = getSessionUserId(req);
      const ownedProjects = projects.filter((project: any) => project.userId === userId);
      res.json(ownedProjects);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
    try {
      const project = await getOwnedProject(req.params.id, getSessionUserId(req));
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch project" });
    }
  });

  app.post("/api/projects", checkProjectLimit, async (req, res) => {
    try {
      const userId = getSessionUserId(req);
      const validatedData = insertProjectSchema.extend({
        starterPackId: z.string().optional(),
        projectType: z.string().optional()
      }).parse({ ...req.body, userId });
      const { starterPackId, projectType, ...projectData } = validatedData;
      const project = await storage.createProject(projectData);

      // Phase 1.1.c Step 1: Create canonical project conversation
      // conversationId = project:${projectId}
      const conversationId = `project:${project.id}`;

      // Idempotent: Check if conversation already exists
      const existingConversations = await storage.getConversationsByProject(project.id);
      const conversationExists = existingConversations.some(conv => conv.id === conversationId);

      if (!conversationExists) {
        // Create conversation with the canonical ID
        // Type assertion needed because InsertConversation omits id, but we support it
        await storage.createConversation({
          id: conversationId, // Use canonical ID instead of UUID
          userId,
          projectId: project.id,
          teamId: null,
          agentId: null,
          type: 'project',
          title: null
        } as any);

        if (process.env.NODE_ENV === 'development' || process.env.DEV) {
          devLog(`[ProjectBootstrap] Created project conversation: ${conversationId}`);
        }
      }

      // Unless this is a starter pack project, automatically set up Maya agent and brain
      // This ensures no new projects start with 0 agents (which breaks the orchestrator)
      if (!starterPackId || projectType === 'idea') {
        await storage.initializeIdeaProject(project.id);
      }

      // If this is a starter pack project, set up teams and agents
      if (starterPackId) {
        await storage.initializeStarterPackProject(project.id, starterPackId);
      }

      // Send Maya's welcome message so the user lands on a warm greeting, not an empty chat
      try {
        const agents = await storage.getAgentsByProject(project.id);
        const maya = agents.find(a => a.isSpecialAgent && a.name === 'Maya');
        if (maya) {
          const welcomeContent = starterPackId
            ? `Hey! I'm Maya, your idea partner for ${project.name}. I've set up your starter team — you can see them in the sidebar. Tell me what you're building and I'll help shape the direction, or just dive into chatting with your team.`
            : `Hey! I'm Maya, your idea partner. Tell me about ${project.name} — what's the idea? Even a rough sentence works. I'll help you shape it into a plan, build your team, and figure out next steps.`;

          await storage.createMessage({
            conversationId,
            agentId: maya.id,
            userId: null,
            content: welcomeContent,
            messageType: 'agent',
            metadata: { agentRole: 'Idea Partner' },
          });
        }
      } catch (err) {
        devLog('[ProjectBootstrap] Welcome message failed:', err);
      }

      res.status(201).json(project);

      // Broadcast project_created event so all open tabs update in real-time
      setImmediate(() => {
        try {
          deps.broadcastToConversation(`project:${project.id}`, {
            type: 'project_created',
            project,
            userId,
          });
        } catch (_) {
          // Non-fatal — broadcast is best-effort
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid project data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create project" });
    }
  });

  app.put("/api/projects/:id", async (req, res) => {
    try {
      const ownedProject = await getOwnedProject(req.params.id, getSessionUserId(req));
      if (!ownedProject) {
        return res.status(404).json({ error: "Project not found" });
      }
      const parsed = updateProjectSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid project data", details: parsed.error.errors });
      const project = await storage.updateProject(req.params.id, parsed.data);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      res.status(500).json({ error: "Failed to update project" });
    }
  });

  app.patch("/api/projects/:id", async (req, res) => {
    try {
      const ownedProject = await getOwnedProject(req.params.id, getSessionUserId(req));
      if (!ownedProject) {
        return res.status(404).json({ error: "Project not found" });
      }
      // Partial update support for right sidebar saves
      const parsed = updateProjectSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid project data", details: parsed.error.errors });
      const project = await storage.updateProject(req.params.id, parsed.data);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      res.status(500).json({ error: "Failed to update project" });
    }
  });

  // Delete project (soft-delete — marks deletedAt; client must call /purge after the
  // undo window expires, or the cron in server/index.ts cleans up stragglers).
  app.delete("/api/projects/:id", async (req, res) => {
    devLog('DELETE /api/projects/:id (soft) called with id:', req.params.id);
    try {
      const ownedProject = await getOwnedProject(req.params.id, getSessionUserId(req));
      if (!ownedProject) {
        return res.status(404).json({ error: "Project not found" });
      }
      const success = await storage.deleteProject(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.status(200).json({ message: "Project soft-deleted (undo window open)" });
    } catch (error) {
      console.error('Error in delete project endpoint:', error);
      res.status(500).json({ error: "Failed to delete project" });
    }
  });

  // Restore a soft-deleted project (called when user clicks Undo within the popup window).
  // Idempotent — restoring an already-active project is a no-op success.
  app.post("/api/projects/:id/restore", async (req, res) => {
    try {
      const ownedProject = await getOwnedProject(req.params.id, getSessionUserId(req));
      if (!ownedProject) {
        return res.status(404).json({ error: "Project not found" });
      }
      const success = await storage.restoreProject(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.status(200).json({ message: "Project restored" });
    } catch (error) {
      console.error('Error in restore project endpoint:', error);
      res.status(500).json({ error: "Failed to restore project" });
    }
  });

  // Hard-delete (purge) a project — client triggers this after the undo window expires
  // or user explicitly dismisses the popup. Cascades through teams/agents/conversations/
  // messages/etc. Server only purges projects already soft-deleted (deletedAt IS NOT NULL).
  app.post("/api/projects/:id/purge", async (req, res) => {
    try {
      const ownedProject = await getOwnedProject(req.params.id, getSessionUserId(req));
      if (!ownedProject) {
        return res.status(404).json({ error: "Project not found" });
      }
      // Guard: only purge soft-deleted rows. If the user clicked Undo first the row is
      // already active again — purging would silently destroy their restored project.
      if (!(ownedProject as any).deletedAt) {
        return res.status(409).json({ error: "Project is not soft-deleted; restore first or wait" });
      }
      const success = await storage.purgeProject(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.status(200).json({ message: "Project permanently deleted" });
    } catch (error) {
      console.error('Error in purge project endpoint:', error);
      res.status(500).json({ error: "Failed to purge project" });
    }
  });

  // Project Brain API Endpoints (P1-4 Fix)
  app.post("/api/projects/:id/brain/documents", async (req, res) => {
    try {
      const project = await getOwnedProject(req.params.id, getSessionUserId(req));
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const brainDocSchema = z.object({
        title: z.string().min(1).max(500).default("Untitled Document"),
        content: z.string().max(50000).default(""),
        type: z.enum(['idea-development', 'project-plan', 'meeting-notes', 'research']).default('idea-development'),
      });
      const parsed = brainDocSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid document data", details: parsed.error.errors });
      }
      const newDocument = {
        id: randomUUID(),
        title: parsed.data.title,
        content: parsed.data.content,
        type: parsed.data.type,
        createdAt: new Date().toISOString()
      };

      const existingBrain = project.brain || { documents: [], sharedMemory: "" };
      const updatedBrain = {
        ...existingBrain,
        documents: [...(existingBrain.documents || []), newDocument]
      };

      const updatedProject = await storage.updateProject(project.id, { brain: updatedBrain });
      res.status(201).json(updatedProject);
    } catch (error) {
      console.error("Failed to add brain document:", error);
      res.status(500).json({ error: "Failed to add document to project brain" });
    }
  });

  app.patch("/api/projects/:id/brain", async (req, res) => {
    try {
      const project = await getOwnedProject(req.params.id, getSessionUserId(req));
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const brainUpdateSchema = z.object({
        sharedMemory: z.string().max(100000).optional(),
      });
      const parsed = brainUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid brain data", details: parsed.error.errors });
      }
      const existingBrain = project.brain || { documents: [], sharedMemory: "" };
      const updatedBrain = {
        ...existingBrain,
        sharedMemory: parsed.data.sharedMemory !== undefined ? parsed.data.sharedMemory : existingBrain.sharedMemory
      };

      const updatedProject = await storage.updateProject(project.id, { brain: updatedBrain });
      res.json(updatedProject);
    } catch (error) {
      console.error("Failed to update brain memory:", error);
      res.status(500).json({ error: "Failed to update project brain memory" });
    }
  });

  // multer v2 memory storage — 10MB limit, allowed extensions only
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = ['.pdf', '.docx', '.txt', '.md'];
      const ext = path.extname(file.originalname).toLowerCase();
      if (allowed.includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error('INVALID_TYPE'));
      }
    },
  });

  // POST /api/projects/:id/brain/upload — upload a document file to the project brain
  app.post("/api/projects/:id/brain/upload", (req, res, next) => {
    upload.single('document')(req, res, (err: any) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ error: 'File must be under 10MB' });
        }
        return res.status(400).json({ error: err.message });
      }
      if (err) {
        if (err.message === 'INVALID_TYPE') {
          return res.status(400).json({ error: 'Only PDF, DOCX, TXT, and MD files are supported' });
        }
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  }, async (req, res) => {
    try {
      const project = await getOwnedProject(req.params.id, getSessionUserId(req));
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      if (!req.file) {
        return res.status(400).json({ error: 'No file provided' });
      }

      const ext = path.extname(req.file.originalname).toLowerCase();
      const content = await extractDocumentText(req.file.buffer, req.file.originalname);
      const docType = `uploaded-${ext.slice(1)}` as 'uploaded-pdf' | 'uploaded-docx' | 'uploaded-txt' | 'uploaded-md';

      const newDocument = {
        id: randomUUID(),
        title: req.file.originalname,
        content,
        type: docType,
        createdAt: new Date().toISOString(),
      };

      const existingBrain = project.brain || { documents: [], sharedMemory: '' };
      const updatedBrain = {
        ...existingBrain,
        documents: [...(existingBrain.documents || []), newDocument],
      };

      const updatedProject = await storage.updateProject(project.id, { brain: updatedBrain });
      res.status(201).json(updatedProject);
    } catch (error) {
      console.error('Failed to upload brain document:', error);
      res.status(500).json({ error: 'Failed to upload document' });
    }
  });

  // DELETE /api/projects/:id/brain/documents/:docId — remove a document from the project brain
  app.delete("/api/projects/:id/brain/documents/:docId", async (req, res) => {
    try {
      const project = await getOwnedProject(req.params.id, getSessionUserId(req));
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const existingBrain = project.brain || { documents: [], sharedMemory: '' };
      const filtered = (existingBrain.documents || []).filter(d => d.id !== req.params.docId);

      if (filtered.length === (existingBrain.documents || []).length) {
        return res.status(404).json({ error: 'Document not found' });
      }

      const updatedBrain = { ...existingBrain, documents: filtered };
      const updatedProject = await storage.updateProject(project.id, { brain: updatedBrain });
      res.json(updatedProject);
    } catch (error) {
      console.error('Failed to delete brain document:', error);
      res.status(500).json({ error: 'Failed to delete document' });
    }
  });

  // ---------------------------------------------------------------------
  // Phase 38 (ALWY-02) — DEV-only endpoints for Playwright runtime assertions.
  //
  // Pattern mirrors Phase 36-02's /api/dev/force-judge-score and Phase 37's
  // /api/dev/seed-run-tree: double-guard (conditional registration AND
  // in-handler production throw). NEVER exposed in production.
  //
  // - POST /api/dev/set-autonomy-level: flips a project's autonomyLevel for
  //   the snapshot-at-boundary test (T-38-06 mitigation: ownership-checked,
  //   400 on missing fields).
  // - GET  /api/dev/captured-prompts: returns the module-level captureProvider
  //   buffer. Only active when LLM_MODE=test TEST_LLM_PROVIDER=capture; in any
  //   other env the buffer stays empty.
  // - POST /api/dev/clear-captured-prompts: resets the buffer between tests.
  //
  // The capture buffer is in-memory only — never persisted — and evaporates
  // on server restart (T-38-07 mitigation).
  // ---------------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const setAutonomyLevelSchema = z.object({
      projectId: z.string().min(1),
      autonomyLevel: z.enum(['observe', 'propose', 'confirm', 'autonomous']),
    });

    app.post('/api/dev/set-autonomy-level', async (req, res) => {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('FATAL: /api/dev/set-autonomy-level called in production. DEV-only endpoint must not run in a production code path.');
      }
      try {
        const parsed = setAutonomyLevelSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: 'projectId and autonomyLevel required', detail: parsed.error.format() });
        }
        const { projectId, autonomyLevel } = parsed.data;
        const userId = getSessionUserId(req);
        // T-38-06 mitigation: ownership check even under NODE_ENV gate
        const project = await getOwnedProject(projectId, userId);
        if (!project) {
          return res.status(404).json({ error: 'Project not found or not owned by session user' });
        }
        const existing = (project.executionRules ?? {}) as Record<string, unknown>;
        const updated = await storage.updateProject(projectId, {
          executionRules: { ...existing, autonomyLevel } as any,
        });
        if (!updated) {
          return res.status(500).json({ error: 'Project update returned no row' });
        }
        return res.json({ ok: true, autonomyLevel, projectId: updated.id });
      } catch (error) {
        console.error('[dev] set-autonomy-level error:', error);
        return res.status(500).json({ error: 'Failed to set autonomy level', detail: (error as Error).message });
      }
    });

    app.get('/api/dev/captured-prompts', async (_req, res) => {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('FATAL: /api/dev/captured-prompts called in production. DEV-only endpoint must not run in a production code path.');
      }
      try {
        // Dynamic import so the captureProvider module is only loaded in dev/test
        const { getCapturedPrompts } = await import('../llm/providers/captureProvider.js');
        return res.json({ prompts: getCapturedPrompts() });
      } catch (error) {
        console.error('[dev] captured-prompts error:', error);
        return res.status(500).json({ error: 'Failed to read captured prompts', detail: (error as Error).message });
      }
    });

    app.post('/api/dev/clear-captured-prompts', async (_req, res) => {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('FATAL: /api/dev/clear-captured-prompts called in production. DEV-only endpoint must not run in a production code path.');
      }
      try {
        const { clearCapturedPrompts } = await import('../llm/providers/captureProvider.js');
        clearCapturedPrompts();
        return res.json({ ok: true });
      } catch (error) {
        console.error('[dev] clear-captured-prompts error:', error);
        return res.status(500).json({ error: 'Failed to clear captured prompts', detail: (error as Error).message });
      }
    });
  }
}
