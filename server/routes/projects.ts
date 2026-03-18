import type { Express, Request } from 'express';
import { storage } from '../storage.js';
import { insertProjectSchema } from '@shared/schema';
import { z } from 'zod';
import { randomUUID } from 'crypto';

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

  app.post("/api/projects", async (req, res) => {
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
      const project = await storage.updateProject(req.params.id, req.body);
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
      const project = await storage.updateProject(req.params.id, req.body);
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

      const newDocument = {
        id: randomUUID(),
        title: req.body.title || "Untitled Document",
        content: req.body.content || "",
        type: req.body.type || 'idea-development',
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

      const existingBrain = project.brain || { documents: [], sharedMemory: "" };
      const updatedBrain = {
        ...existingBrain,
        sharedMemory: req.body.sharedMemory !== undefined ? req.body.sharedMemory : existingBrain.sharedMemory
      };

      const updatedProject = await storage.updateProject(project.id, { brain: updatedBrain });
      res.json(updatedProject);
    } catch (error) {
      console.error("Failed to update brain memory:", error);
      res.status(500).json({ error: "Failed to update project brain memory" });
    }
  });
}
