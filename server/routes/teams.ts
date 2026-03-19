import type { Express, Request } from 'express';
import { storage } from '../storage.js';
import { insertTeamSchema } from '@shared/schema';
import { buildConversationId } from '@shared/conversationId';
import { z } from 'zod';

const updateTeamSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  emoji: z.string().max(10).optional(),
}).strict();

export function registerTeamRoutes(app: Express): void {
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

  // Teams
  app.get("/api/teams", async (req, res) => {
    try {
      const teams = await storage.getTeams();
      const ownedProjectIds = await getOwnedProjectIds(getSessionUserId(req));
      res.json(teams.filter((team) => ownedProjectIds.has((team as any).projectId)));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch teams" });
    }
  });

  app.get("/api/projects/:projectId/teams", async (req, res) => {
    try {
      const ownedProject = await getOwnedProject(req.params.projectId, getSessionUserId(req));
      if (!ownedProject) {
        return res.status(404).json({ error: "Project not found" });
      }
      const teams = await storage.getTeamsByProject(req.params.projectId);
      res.json(teams);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch project teams" });
    }
  });

  app.post("/api/teams", async (req, res) => {
    try {
      const userId = getSessionUserId(req);
      const project = await getOwnedProject(req.body.projectId, userId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      const validatedData = insertTeamSchema.parse({ ...req.body, userId });
      const team = await storage.createTeam(validatedData);

      // Auto-create initial conversation for the new team
      try {
        await storage.createConversation({
          id: buildConversationId('team', team.projectId, team.id),
          userId,
          projectId: team.projectId,
          teamId: team.id,
          agentId: null,
          type: 'team',
          title: null
        } as any);
        devLog(`[TeamBootstrap] Created team conversation: team:${team.id}`);
      } catch (e) {
        console.error("Failed to auto-create team conversation:", e);
      }

      res.status(201).json(team);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid team data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create team" });
    }
  });

  app.delete("/api/teams/:id", async (req, res) => {
    try {
      const team = await getOwnedTeam(req.params.id, getSessionUserId(req));
      if (!team) {
        return res.status(404).json({ error: "Team not found" });
      }
      const success = await storage.deleteTeam(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Team not found" });
      }
      res.status(200).json({ message: "Team deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete team" });
    }
  });

  app.put("/api/teams/:id", async (req, res) => {
    try {
      const ownedTeam = await getOwnedTeam(req.params.id, getSessionUserId(req));
      if (!ownedTeam) {
        return res.status(404).json({ error: "Team not found" });
      }
      const parsed = updateTeamSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid team data", details: parsed.error.errors });
      const updatedTeam = await storage.updateTeam(req.params.id, parsed.data);
      if (!updatedTeam) {
        return res.status(404).json({ error: "Team not found" });
      }
      res.json(updatedTeam);
    } catch (error) {
      res.status(500).json({ error: "Failed to update team" });
    }
  });

  // Fix 11: PATCH for partial team updates (RightSidebar save)
  app.patch("/api/teams/:id", async (req, res) => {
    try {
      const ownedTeam = await getOwnedTeam(req.params.id, getSessionUserId(req));
      if (!ownedTeam) {
        return res.status(404).json({ error: "Team not found" });
      }
      const parsed = updateTeamSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid team data", details: parsed.error.errors });
      const updatedTeam = await storage.updateTeam(req.params.id, parsed.data);
      if (!updatedTeam) {
        return res.status(404).json({ error: "Team not found" });
      }
      res.json(updatedTeam);
    } catch (error) {
      res.status(500).json({ error: "Failed to update team" });
    }
  });
}
