import type { Express, Request } from 'express';
import { storage } from '../storage.js';
import { insertAgentSchema } from '@shared/schema';
import { buildConversationId } from '@shared/conversationId';
import { z } from 'zod';

const updateAgentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: z.string().max(100).optional(),
  personality: z.record(z.unknown()).optional(),
  isSpecialAgent: z.boolean().optional(),
}).strict();

export function registerAgentRoutes(app: Express): void {
  const devLog = (...args: any[]) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(...args);
    }
  };

  const getSessionUserId = (req: Request): string => (req.session as any).userId as string;

  const getOwnedProjectIds = async (userId: string): Promise<Set<string>> => {
    const projects = await storage.getProjects();
    return new Set(projects.filter((project: any) => project.userId === userId).map((project) => project.id));
  };

  const getOwnedProject = async (projectId: string, userId: string) => {
    const project = await storage.getProject(projectId);
    if (!project) return null;
    return (project as any).userId === userId ? project : null;
  };

  const getOwnedTeam = async (teamId: string, userId: string) => {
    const team = await storage.getTeam(teamId);
    if (!team) return null;
    const project = await getOwnedProject((team as any).projectId, userId);
    return project ? team : null;
  };

  const getOwnedAgent = async (agentId: string, userId: string) => {
    const agent = await storage.getAgent(agentId);
    if (!agent) return null;
    const project = await getOwnedProject((agent as any).projectId, userId);
    return project ? agent : null;
  };

  // Agents
  app.get("/api/agents", async (req, res) => {
    try {
      const agents = await storage.getAgents();
      const ownedProjectIds = await getOwnedProjectIds(getSessionUserId(req));
      res.json(agents.filter((agent) => ownedProjectIds.has((agent as any).projectId)));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch agents" });
    }
  });

  app.get("/api/projects/:projectId/agents", async (req, res) => {
    try {
      const ownedProject = await getOwnedProject(req.params.projectId, getSessionUserId(req));
      if (!ownedProject) {
        return res.status(404).json({ error: "Project not found" });
      }
      const agents = await storage.getAgentsByProject(req.params.projectId);
      res.json(agents);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch project agents" });
    }
  });

  app.get("/api/teams/:teamId/agents", async (req, res) => {
    try {
      const team = await getOwnedTeam(req.params.teamId, getSessionUserId(req));
      if (!team) {
        return res.status(404).json({ error: "Team not found" });
      }
      const agents = await storage.getAgentsByTeam(req.params.teamId);
      res.json(agents);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch team agents" });
    }
  });

  app.post("/api/agents", async (req, res) => {
    try {
      const userId = getSessionUserId(req);
      const team = await getOwnedTeam(req.body.teamId, userId);
      if (!team) {
        return res.status(404).json({ error: "Team not found" });
      }
      const validatedData = insertAgentSchema.parse({
        ...req.body,
        userId,
        projectId: (team as any).projectId,
      });
      const agent = await storage.createAgent(validatedData);

      // Auto-create initial conversation for the new agent
      try {
        await storage.createConversation({
          id: buildConversationId('agent', agent.projectId, agent.id),
          userId,
          projectId: agent.projectId,
          teamId: agent.teamId || null,
          agentId: agent.id,
          type: 'agent',
          title: null
        } as any);
        devLog(`[AgentBootstrap] Created agent conversation: agent:${agent.id}`);
      } catch (e) {
        console.error("Failed to auto-create agent conversation:", e);
      }

      res.status(201).json(agent);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid agent data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create agent" });
    }
  });

  app.delete("/api/agents/:id", async (req, res) => {
    try {
      const ownedAgent = await getOwnedAgent(req.params.id, getSessionUserId(req));
      if (!ownedAgent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      const success = await storage.deleteAgent(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Agent not found" });
      }
      res.status(200).json({ message: "Agent deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete agent" });
    }
  });

  app.put("/api/agents/:id", async (req, res) => {
    try {
      const ownedAgent = await getOwnedAgent(req.params.id, getSessionUserId(req));
      if (!ownedAgent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      const parsed = updateAgentSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid agent data", details: parsed.error.errors });
      const agent = await storage.updateAgent(req.params.id, parsed.data);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      res.json(agent);
    } catch (error) {
      res.status(500).json({ error: "Failed to update agent" });
    }
  });

  // Fix 11: PATCH for partial agent updates (RightSidebar save)
  app.patch("/api/agents/:id", async (req, res) => {
    try {
      const ownedAgent = await getOwnedAgent(req.params.id, getSessionUserId(req));
      if (!ownedAgent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      const parsed = updateAgentSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid agent data", details: parsed.error.errors });
      const agent = await storage.updateAgent(req.params.id, parsed.data);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      res.json(agent);
    } catch (error) {
      res.status(500).json({ error: "Failed to update agent" });
    }
  });
}
