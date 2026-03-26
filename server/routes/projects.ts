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

  // Delete project
  app.delete("/api/projects/:id", async (req, res) => {
    devLog('DELETE /api/projects/:id called with id:', req.params.id);
    try {
      const ownedProject = await getOwnedProject(req.params.id, getSessionUserId(req));
      if (!ownedProject) {
        return res.status(404).json({ error: "Project not found" });
      }
      devLog('Calling storage.deleteProject with id:', req.params.id);
      const success = await storage.deleteProject(req.params.id);
      devLog('Storage deleteProject result:', success);

      if (!success) {
        devLog('Project not found in storage');
        return res.status(404).json({ error: "Project not found" });
      }
      devLog('Project deleted successfully from storage');
      res.status(200).json({ message: "Project deleted successfully" });
    } catch (error) {
      console.error('Error in delete project endpoint:', error);
      res.status(500).json({ error: "Failed to delete project" });
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
}
