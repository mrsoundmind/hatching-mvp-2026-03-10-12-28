import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertProjectSchema, insertTeamSchema, insertAgentSchema, insertMessageSchema, insertConversationSchema, insertTaskSchema, type Task, type Project } from "@shared/schema";
import { parseConversationId } from "@shared/conversationId";
import { wsClientMessageSchema } from "@shared/dto/wsSchemas";
import { randomUUID } from "crypto";
import { z } from "zod";

const devLog = (...args: any[]) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(...args);
  }
};
import { OpenAIConfigurationError, generateIntelligentResponse, generateStreamingResponse } from "./ai/openaiService.js";
import { personalityEngine } from "./ai/personalityEvolution.js";
import { trainingSystem } from "./ai/trainingSystem.js";
import { initializePreTrainedColleagues, devTrainingTools } from "./ai/devTrainingTools.js";
import { runTurn } from "./ai/graph.js";
import { evaluateConductorDecision, buildRoleIdentity } from "./ai/conductor.js";
import { evaluateSafetyScore, buildClarificationIntervention } from "./ai/safety.js";
import { buildDecisionForecast, isStrategicTurn } from "./ai/forecast.js";
import {
  createActionProposal,
  recordLearningEvent,
} from "./ai/autonomyStore.js";
import {
  analyzeQuestion,
  findBestAgentMatch,
  coordinateMultiAgentResponse,
  calculateExpertiseConfidence,
  initiateHandoff,
  transferContext,
  processHandoffRequest,
  handoffTracker,
  type Agent
} from "./ai/expertiseMatching.js";
import { TaskDetectionAI, type TaskSuggestion, type ConversationContext } from "./ai/taskDetection.js";
import { resolveSpeakingAuthority } from "./orchestration/resolveSpeakingAuthority";
import { validateMessageIngress } from "./schemas/messageIngress";
import { filterAvailableAgents, type ScopeContext } from "./orchestration/agentAvailability";
import { assertPhase1Invariants } from "./invariants/assertPhase1";
import {
  getCurrentRuntimeConfig,
} from "./llm/providerResolver.js";
import { writeConfigSnapshot } from "./utils/configSnapshot.js";
import { logAutonomyEvent } from "./autonomy/events/eventLogger.js";
import {
  appendDeliberationRound,
  createDeliberationTrace,
  finalizeDeliberationTrace,
} from "./autonomy/traces/traceStore.js";
import {
  assertConversationOrdering,
  assertUniqueMessageId,
  checkIdempotencyKey,
  ensureMessageId,
} from "./autonomy/integrity/conversationIntegrity.js";
import { runPeerReview } from "./autonomy/peerReview/peerReviewRunner.js";
import { runAutonomousKnowledgeLoop } from "./knowledge/akl/runner.js";
import { resolveDecisionConflict } from "./autonomy/conductor/decisionAuthority.js";
import { routeTools } from "./tools/toolRouter.js";
import { createTaskGraph } from "./autonomy/taskGraph/taskGraphEngine.js";
import { BUDGETS } from "./autonomy/config/policies.js";
import { registerHealthRoute } from "./routes/health.js";
import { registerAutonomyRoutes } from "./routes/autonomy.js";

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize pre-trained AI colleagues on server start
  initializePreTrainedColleagues();

  // Phase 1.2: Environment helpers for production-safe error handling
  const isProd = process.env.NODE_ENV === "production";
  // Phase 1.2: WebSocket error responder helper (never throws)
  function sendWsError(
    ws: WebSocket,
    params: {
      code: string;
      message: string;
      details?: Record<string, unknown>;
      correlationId?: string;
    }
  ): void {
    try {
      const errorResponse = {
        type: "error",
        code: params.code,
        message: params.message,
        ...(params.details && { details: params.details }),
        ...(params.correlationId && { correlationId: params.correlationId }),
      };
      ws.send(JSON.stringify(errorResponse));
    } catch (sendError) {
      // If sending error fails, log but never throw (production safety)
      console.error("[sendWsError] Failed to send error response:", sendError);
    }
  }

  let getWsHealth = () => ({
    status: "down" as "ok" | "degraded" | "down",
    connections: 0,
  });

  registerHealthRoute(app, {
    getWsHealth: () => getWsHealth(),
  });

  function getStreamingErrorPayload(error: any): { code: string; error: string } {
    if (error instanceof OpenAIConfigurationError || error?.code === "OPENAI_API_KEY_MISSING") {
      return {
        code: "OPENAI_NOT_CONFIGURED",
        error: "I’m temporarily unavailable right now. Please retry in a moment."
      };
    }

    const status = Number(error?.status || error?.statusCode || error?.response?.status || 0);
    const apiCode = typeof error?.code === "string" ? error.code.toLowerCase() : "";
    const message = typeof error?.message === "string" ? error.message.toLowerCase() : "";

    if (status === 401 || apiCode.includes("invalid_api_key") || message.includes("invalid api key")) {
      return {
        code: "OPENAI_AUTH_FAILED",
        error: "I’m temporarily unavailable right now. Please retry in a moment."
      };
    }

    if (
      status === 429 ||
      apiCode.includes("rate_limit") ||
      apiCode.includes("insufficient_quota") ||
      message.includes("rate limit") ||
      message.includes("quota")
    ) {
      return {
        code: "OPENAI_RATE_LIMITED",
        error: "I’m handling high traffic right now. Please retry in a minute."
      };
    }

    if (
      status === 404 ||
      apiCode.includes("model_not_found") ||
      message.includes("model") && message.includes("not found")
    ) {
      return {
        code: "OPENAI_MODEL_UNAVAILABLE",
        error: "I’m temporarily unavailable right now. Please retry in a moment."
      };
    }

    return {
      code: "STREAMING_GENERATION_FAILED",
      error: "I’m still here, but this reply could not be completed. Please try again."
    };
  }

  function buildServiceFallbackMessage(params: {
    mode: "project" | "team" | "agent";
    agentName?: string;
    userMessage: string;
    errorCode: string;
  }): string {
    const speaker = params.agentName || "Project Manager";
    const cleanedInput = (params.userMessage || "").replace(/\s+/g, " ").trim();
    const shortInput = cleanedInput.length > 100 ? `${cleanedInput.slice(0, 100).trimEnd()}...` : cleanedInput;

    if (params.mode === "agent") {
      return `${speaker} here. I’m still with you, but I hit a temporary capacity spike. Share the exact outcome + deadline you want from this role, and I’ll return a concrete execution checklist.`;
    }

    if (params.mode === "team") {
      return `Team lead update: I’m still on this, but there’s a temporary response delay. To keep momentum, send the team’s top objective, main blocker, and deadline. I’ll turn that into an owner-wise action plan.`;
    }

    return shortInput
      ? `Got it on "${shortInput}". I’m still on this, but there’s a temporary response delay. Send your top priority and one hard constraint (time, budget, or scope), and I’ll map the fastest execution plan.`
      : `I’m still on this, but there’s a temporary response delay. Send your top priority and one hard constraint (time, budget, or scope), and I’ll map the fastest execution plan.`;
  }

  function deriveProjectBrainPatch(params: {
    userMessage: string;
    assistantResponse: string;
    existingProject: Project;
  }): {
    coreDirection?: { whatBuilding?: string; whyMatters?: string; whoFor?: string };
    executionRules?: string;
    teamCulture?: string;
  } | null {
    const normalize = (input: string, max = 240) => {
      const compact = input.replace(/\s+/g, " ").trim();
      if (!compact) return "";
      return compact.length > max ? `${compact.slice(0, max - 1).trimEnd()}...` : compact;
    };

    const explicitAfter = (regex: RegExp, text: string) => {
      const match = text.match(regex);
      return match?.[1] ? normalize(match[1]) : "";
    };

    const user = normalize(params.userMessage || "", 420);
    if (!user) return null;

    const patch: {
      coreDirection?: { whatBuilding?: string; whyMatters?: string; whoFor?: string };
      executionRules?: string;
      teamCulture?: string;
    } = {};

    const explicitWhat = explicitAfter(
      /(?:what are you building|building)\s*[:\-]\s*(.+?)(?=\s*(?:why does this matter|why|who is this for|target audience|for whom|execution rules|rules|constraints|culture|brand voice|tone)\s*[:\-]|$)/i,
      user
    );
    const explicitWhy = explicitAfter(
      /(?:why does this matter|why)\s*[:\-]\s*(.+?)(?=\s*(?:who is this for|target audience|for whom|execution rules|rules|constraints|culture|brand voice|tone)\s*[:\-]|$)/i,
      user
    );
    const explicitWho = explicitAfter(
      /(?:who is this for|target audience|for whom)\s*[:\-]\s*(.+?)(?=\s*(?:execution rules|rules|constraints|culture|brand voice|tone)\s*[:\-]|$)/i,
      user
    );
    const explicitRules = explicitAfter(
      /(?:execution rules|rules|constraints)\s*[:\-]\s*(.+?)(?=\s*(?:culture|brand voice|tone)\s*[:\-]|$)/i,
      user
    );
    const explicitCulture = explicitAfter(
      /(?:culture|brand voice|tone)\s*[:\-]\s*(.+)$/i,
      user
    );

    const explicitCount = [explicitWhat, explicitWhy, explicitWho, explicitRules, explicitCulture]
      .filter((value) => value.length > 0).length;
    if (explicitCount === 0) {
      return null;
    }

    const coreDirectionPatch: { whatBuilding?: string; whyMatters?: string; whoFor?: string } = {};

    if (explicitWhat) {
      coreDirectionPatch.whatBuilding = explicitWhat;
    }

    if (explicitWhy) {
      coreDirectionPatch.whyMatters = explicitWhy;
    }

    if (explicitWho) {
      coreDirectionPatch.whoFor = explicitWho;
    }

    if (Object.keys(coreDirectionPatch).length > 0) {
      patch.coreDirection = coreDirectionPatch;
    }

    if (explicitRules) {
      patch.executionRules = explicitRules;
    }

    if (explicitCulture) {
      patch.teamCulture = explicitCulture;
    }

    return Object.keys(patch).length > 0 ? patch : null;
  }

  // Phase 0.6.a: Storage status endpoint (read-only, no auth required)
  app.get("/api/system/storage-status", async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: "Storage status is not available in production" });
    }
    const { getStorageModeInfo } = await import("./storage");
    const info = getStorageModeInfo();
    res.json({
      mode: info.mode,
      durable: info.durable,
      notes: info.notes
    });
  });

  // Phase 1.1: Global Authentication Middleware (BUG-1 Fix)
  function requireAuth(req: Request, res: Response, next: NextFunction) {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  }

  // Protect all API routes except auth endpoints and public storage status
  app.use('/api', (req, res, next) => {
    if (req.path.startsWith('/auth') || req.path === '/system/storage-status') {
      return next();
    }
    requireAuth(req, res, next);
  });

  // Projects
  app.get("/api/projects", async (req, res) => {
    try {
      const projects = await storage.getProjects();
      res.json(projects);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
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
      const validatedData = insertProjectSchema.extend({
        starterPackId: z.string().optional(),
        projectType: z.string().optional()
      }).parse(req.body);
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

      // If this is an "idea" project, automatically set up Maya agent and brain
      if (projectType === 'idea') {
        await storage.initializeIdeaProject(project.id);
      }

      // If this is a starter pack project, set up teams and agents
      if (starterPackId) {
        await storage.initializeStarterPackProject(project.id, starterPackId);
      }

      res.status(201).json(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid project data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create project" });
    }
  });

  app.put("/api/projects/:id", async (req, res) => {
    try {
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
    devLog('🗑️ DELETE /api/projects/:id called with id:', req.params.id);
    try {
      devLog('🗑️ Calling storage.deleteProject with id:', req.params.id);
      const success = await storage.deleteProject(req.params.id);
      devLog('🗑️ Storage deleteProject result:', success);

      if (!success) {
        devLog('❌ Project not found in storage');
        return res.status(404).json({ error: "Project not found" });
      }
      devLog('✅ Project deleted successfully from storage');
      res.status(200).json({ message: "Project deleted successfully" });
    } catch (error) {
      console.error('❌ Error in delete project endpoint:', error);
      res.status(500).json({ error: "Failed to delete project" });
    }
  });

  // Project Brain API Endpoints (P1-4 Fix)
  app.post("/api/projects/:id/brain/documents", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
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
      const project = await storage.getProject(req.params.id);
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

  // Teams
  app.get("/api/teams", async (req, res) => {
    try {
      const teams = await storage.getTeams();
      res.json(teams);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch teams" });
    }
  });

  app.get("/api/projects/:projectId/teams", async (req, res) => {
    try {
      const teams = await storage.getTeamsByProject(req.params.projectId);
      res.json(teams);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch project teams" });
    }
  });

  app.post("/api/teams", async (req, res) => {
    try {
      const validatedData = insertTeamSchema.parse(req.body);
      const team = await storage.createTeam(validatedData);

      // Auto-create initial conversation for the new team
      try {
        await storage.createConversation({
          id: `team:${team.id}`,
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
      const team = await storage.updateTeam(req.params.id, req.body);
      if (!team) {
        return res.status(404).json({ error: "Team not found" });
      }
      res.json(team);
    } catch (error) {
      res.status(500).json({ error: "Failed to update team" });
    }
  });

  // Fix 11: PATCH for partial team updates (RightSidebar save)
  app.patch("/api/teams/:id", async (req, res) => {
    try {
      const team = await storage.updateTeam(req.params.id, req.body);
      if (!team) {
        return res.status(404).json({ error: "Team not found" });
      }
      res.json(team);
    } catch (error) {
      res.status(500).json({ error: "Failed to update team" });
    }
  });

  // Agents
  app.get("/api/agents", async (req, res) => {
    try {
      const agents = await storage.getAgents();
      res.json(agents);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch agents" });
    }
  });

  app.get("/api/projects/:projectId/agents", async (req, res) => {
    try {
      const agents = await storage.getAgentsByProject(req.params.projectId);
      res.json(agents);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch project agents" });
    }
  });

  app.get("/api/teams/:teamId/agents", async (req, res) => {
    try {
      const agents = await storage.getAgentsByTeam(req.params.teamId);
      res.json(agents);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch team agents" });
    }
  });

  app.post("/api/agents", async (req, res) => {
    try {
      const validatedData = insertAgentSchema.parse(req.body);
      const agent = await storage.createAgent(validatedData);

      // Auto-create initial conversation for the new agent
      try {
        await storage.createConversation({
          id: `agent:${agent.id}`,
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
      const agent = await storage.updateAgent(req.params.id, req.body);
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
      const agent = await storage.updateAgent(req.params.id, req.body);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      res.json(agent);
    } catch (error) {
      res.status(500).json({ error: "Failed to update agent" });
    }
  });

  // Chat API Routes
  app.get("/api/conversations/:projectId", async (req, res) => {
    try {
      const conversations = await storage.getConversationsByProject(req.params.projectId);
      res.json(conversations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  app.post("/api/conversations", async (req, res) => {
    try {
      const validatedData = insertConversationSchema.parse(req.body);
      const conversation = await storage.createConversation(validatedData);
      res.status(201).json(conversation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid conversation data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });

  // D1.2: Enhanced message loading with pagination and filtering
  app.get("/api/conversations/:conversationId/messages", async (req, res) => {
    try {
      const { page = "1", limit = "50", before, after, messageType } = req.query;
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);

      const messages = await storage.getMessagesByConversation(
        req.params.conversationId,
        {
          page: pageNum,
          limit: limitNum,
          before: before as string,
          after: after as string,
          messageType: messageType as string
        }
      );

      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // Add endpoint for creating messages in specific conversations
  app.post("/api/conversations/:conversationId/messages", async (req, res) => {
    try {
      const { conversationId } = req.params;
      const messageData = {
        ...req.body,
        conversationId: conversationId
      };

      // Phase 1.2: Resolve actual userId from session
      const sessId = (req as any).session?.userId;
      const uid = (req.body.userId === 'user' || req.body.userId === 'current-user' || !req.body.userId)
        ? sessId
        : req.body.userId;

      const validatedData = insertMessageSchema.parse({
        ...messageData,
        userId: uid
      });
      const message = await storage.createMessage(validatedData);
      res.status(201).json(message);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid message data", details: error.errors });
      }
      console.error('Error creating message in conversation:', error);
      res.status(500).json({ error: "Failed to create message" });
    }
  });

  app.post("/api/messages", async (req, res) => {
    try {
      // Phase 1.2: Resolve actual userId from session
      const sessIdGlobal = (req as any).session?.userId;
      const uidGlobal = (req.body.userId === 'user' || req.body.userId === 'current-user' || !req.body.userId)
        ? sessIdGlobal
        : req.body.userId;

      const validatedData = insertMessageSchema.parse({
        ...req.body,
        userId: uidGlobal
      });
      const message = await storage.createMessage(validatedData);
      res.status(201).json(message);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid message data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create message" });
    }
  });

  // D1.3: Conversation management API routes
  app.put("/api/conversations/:conversationId/archive", async (req, res) => {
    try {
      const success = await storage.archiveConversation(req.params.conversationId);
      if (!success) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      res.json({ message: "Conversation archived successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to archive conversation" });
    }
  });

  app.put("/api/conversations/:conversationId/unarchive", async (req, res) => {
    try {
      const success = await storage.unarchiveConversation(req.params.conversationId);
      if (!success) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      res.json({ message: "Conversation unarchived successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to unarchive conversation" });
    }
  });

  app.get("/api/projects/:projectId/conversations/archived", async (req, res) => {
    try {
      const archivedConversations = await storage.getArchivedConversations(req.params.projectId);
      res.json(archivedConversations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch archived conversations" });
    }
  });

  app.delete("/api/conversations/:conversationId", async (req, res) => {
    try {
      const success = await storage.deleteConversation(req.params.conversationId);
      if (!success) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      res.json({ message: "Conversation deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete conversation" });
    }
  });

  // LangGraph Hatch chat endpoint
  app.post("/api/hatch/chat", async (req, res) => {
    try {
      const { threadId = "default", user = "", history = [], enablePeerNotes = false } = req.body || {};
      const out = await runTurn({ threadId, user, history, enablePeerNotes });

      // Fallback: if LangGraph returned an empty reply, synthesize via OpenAI path
      if (!out.reply || out.reply.trim().length === 0) {
        try {
          const context = {
            mode: 'project' as const,
            projectName: 'SaaS Startup',
            agentRole: 'Product Manager',
            conversationHistory: (history || []).map((m: any) => ({
              role: m.role === 'assistant' ? 'assistant' : 'user',
              content: m.content || '',
              timestamp: new Date().toISOString(),
            })),
            userId: (req.session as any).userId || 'anonymous',
          };

          const ai = await generateIntelligentResponse(
            user || 'Help me plan next steps.',
            'Product Manager',
            context,
          );

          return res.json({
            messages: [...(history || []), { role: 'assistant', content: ai.content, metadata: ai.metadata }],
            reply: ai.content,
            metadata: ai.metadata,
            needsConsent: false,
          });
        } catch (e) {
          console.error('Fallback OpenAI generation failed:', e);
          if (e instanceof OpenAIConfigurationError) {
            return res.status(503).json({
              code: "OPENAI_NOT_CONFIGURED",
              error: "I’m temporarily unavailable right now. Please retry in a moment."
            });
          }
          // If fallback also fails, return the original out to keep behavior predictable
          return res.json(out);
        }
      }

      res.json(out);
    } catch (error) {
      console.error("LangGraph chat error:", error);
      res.status(500).json({ error: "Failed to process chat" });
    }
  });

  // A1.2 & A1.3: Message reactions for AI training
  app.post('/api/messages/:messageId/reactions', async (req, res) => {
    try {
      const { messageId } = req.params;
      const reactionData = req.body;

      // Validate reaction data
      if (!reactionData.reactionType || !['thumbs_up', 'thumbs_down'].includes(reactionData.reactionType)) {
        return res.status(400).json({ error: 'Invalid reaction type' });
      }

      // Use user ID from session
      const userId = (req.session as any).userId || 'anonymous';

      const reaction = await storage.addMessageReaction({
        messageId,
        userId,
        reactionType: reactionData.reactionType,
        agentId: reactionData.agentId,
        feedbackData: reactionData.feedbackData || {}
      });

      // B4: Integrate reaction with personality evolution
      if (reactionData.agentId) {
        const feedback = reactionData.reactionType === 'thumbs_up' ? 'positive' : 'negative';
        personalityEngine.adaptPersonalityFromFeedback(
          reactionData.agentId,
          userId,
          feedback,
          '', // User message context would need to be passed from frontend
          '' // Agent response would need to be retrieved
        );

        devLog(`🎯 B4: Personality feedback integrated: ${feedback} reaction for ${reactionData.agentId}`);
      }

      res.json(reaction);
    } catch (error) {
      console.error('Error adding message reaction:', error);
      res.status(500).json({ error: 'Failed to add reaction' });
    }
  });

  // Get reactions for a message
  app.get('/api/messages/:messageId/reactions', async (req, res) => {
    try {
      const { messageId } = req.params;
      const reactions = await storage.getMessageReactions(messageId);
      res.json(reactions);
    } catch (error) {
      console.error('Error fetching message reactions:', error);
      res.status(500).json({ error: 'Failed to fetch reactions' });
    }
  });

  // Simple feedback endpoint (for user thumbs up/down)
  app.post("/api/training/feedback", async (req, res) => {
    try {
      const { messageId, conversationId, userMessage, agentResponse, agentRole, rating } = req.body;

      const trainingFeedback = trainingSystem.addFeedback({
        messageId,
        conversationId,
        userMessage,
        agentResponse,
        agentRole,
        rating
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to record feedback" });
    }
  });

  // Fix 3c: Block /api/dev/* in production
  if (process.env.NODE_ENV === 'production' && process.env.DEV !== 'true') {
    app.all("/api/dev/*", (_req, res) => {
      res.status(403).json({ error: 'Dev endpoints are disabled in production.' });
    });
  }

  // Fix 2: Auth endpoints — login, who am I, logout
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { name } = req.body;
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'name is required' });
      }

      const trimmedName = name.trim();
      const username = `session:${trimmedName.toLowerCase().replace(/\s+/g, '_')}`;

      let user = await storage.getUserByUsername(username);
      if (!user) {
        user = await storage.createUser({
          username,
          password: randomUUID(),
        });
      }

      req.session.userId = user.id;
      req.session.userName = trimmedName;
      return res.json({ id: req.session.userId, name: req.session.userName });
    } catch (error) {
      console.error('Login failed:', error);
      return res.status(500).json({ error: 'Login failed' });
    }
  });

  app.get('/api/auth/me', (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    return res.json({ id: req.session.userId, name: req.session.userName });
  });

  app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) return res.status(500).json({ error: 'Logout failed' });
      return res.json({ message: 'Logged out' });
    });
  });

  // Developer training endpoints (protected - only for internal use)
  app.post("/api/dev/training/personality", async (req, res) => {
    try {
      const { role, personality } = req.body;
      const profile = devTrainingTools.updatePersonality(role, personality);
      res.json({ success: true, profile });
    } catch (error) {
      res.status(500).json({ error: "Failed to update personality" });
    }
  });

  app.post("/api/dev/training/example", async (req, res) => {
    try {
      const { role, userInput, idealResponse, category } = req.body;
      const example = devTrainingTools.addExample(role, userInput, idealResponse, category);
      res.json({ success: true, example });
    } catch (error) {
      res.status(500).json({ error: "Failed to add example" });
    }
  });

  app.get("/api/dev/training/stats", async (req, res) => {
    try {
      const stats = devTrainingTools.getStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to get stats" });
    }
  });

  // B4: Personality Evolution API endpoints
  app.get("/api/personality/:agentId/:userId", async (req, res) => {
    try {
      const { agentId, userId } = req.params;
      const stats = personalityEngine.getPersonalityStats(agentId, userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching personality stats:", error);
      res.status(500).json({ error: "Failed to fetch personality data" });
    }
  });

  app.post("/api/personality/feedback", async (req, res) => {
    try {
      const { agentId, userId, feedback, messageContent, agentResponse } = req.body;

      if (!agentId || !userId || !feedback) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const updatedProfile = personalityEngine.adaptPersonalityFromFeedback(
        agentId, userId, feedback, messageContent || '', agentResponse || ''
      );

      // Store feedback for future analysis
      await storage.storeFeedback(agentId, userId, {
        feedback,
        messageContent,
        agentResponse,
        timestamp: new Date().toISOString()
      });

      res.json({
        success: true,
        adaptationConfidence: updatedProfile.adaptationConfidence,
        interactionCount: updatedProfile.interactionCount
      });
    } catch (error) {
      console.error("Error processing personality feedback:", error);
      res.status(500).json({ error: "Failed to process feedback" });
    }
  });

  app.get("/api/personality/analytics/:agentId", async (req, res) => {
    try {
      const { agentId } = req.params;
      const analytics = {
        totalUsers: 0,
        averageAdaptation: 0,
        commonTraitAdjustments: [],
        feedbackStats: { positive: 0, negative: 0 }
      };

      // This would aggregate data across all users for this agent
      // For now, return basic structure
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching personality analytics:", error);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  // E3.4: Handoff statistics API
  app.get("/api/handoffs/stats", async (req, res) => {
    try {
      const stats = handoffTracker.getHandoffStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch handoff stats" });
    }
  });

  app.get("/api/handoffs/history", async (req, res) => {
    try {
      const { agentId } = req.query;
      const history = handoffTracker.getHandoffHistory(agentId as string);
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch handoff history" });
    }
  });

  registerAutonomyRoutes(app);

  const httpServer = createServer(app);

  // WebSocket Server Setup
  const wss = new WebSocketServer({
    server: httpServer,
    path: '/ws'
  });

  // Store active connections by conversation ID
  const activeConnections = new Map<string, Set<WebSocket>>();

  // Track conversations using streaming to prevent double handlers
  const streamingConversations = new Set<string>();

  // Track active streaming responses to prevent duplicates
  const activeStreamingResponses = new Set<string>();

  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  async function waitForStreamingSlot(conversationId: string, timeoutMs = 45000): Promise<boolean> {
    const startedAt = Date.now();
    while (activeStreamingResponses.has(conversationId)) {
      if (Date.now() - startedAt >= timeoutMs) {
        return false;
      }
      await wait(50);
    }
    return true;
  }

  getWsHealth = () => {
    let activeCount = 0;
    activeConnections.forEach((connections) => {
      activeCount += connections.size;
    });
    return {
      status: "ok" as const,
      connections: activeCount,
    };
  };

  // Helper to ensure canonical conversation exists for all scopes
  const ensureConversationExists = async (params: {
    conversationId: string;
    projectId: string;
    teamId?: string | null;
    agentId?: string | null;
    type: 'project' | 'team' | 'agent';
  }) => {
    // Check if conversation already exists (idempotent check)
    const existingConversations = await storage.getConversationsByProject(params.projectId);
    const existing = existingConversations.find(conv => conv.id === params.conversationId);

    if (existing) {
      if (process.env.NODE_ENV === 'development' || process.env.DEV) {
        devLog(`[ConversationBootstrap] Conversation already exists: ${params.conversationId}`);
      }
      return existing;
    }

    // Create conversation with canonical ID
    const newConversation = await storage.createConversation({
      id: params.conversationId,
      projectId: params.projectId,
      teamId: params.teamId ?? null,
      agentId: params.agentId ?? null,
      type: params.type === 'agent' ? 'hatch' : params.type, // Storage uses 'hatch' for agent type
      title: null
    } as any);

    devLog(`[ConversationBootstrap] Created new canonical conversation: ${params.conversationId}`);
    return newConversation;
  };

  wss.on('connection', (ws: WebSocket, req) => {
    devLog('New WebSocket connection established');

    ws.on('message', async (rawMessage: Buffer) => {
      try {
        const parsedData = JSON.parse(rawMessage.toString());
        const dtoCheck = wsClientMessageSchema.safeParse(parsedData);
        if (!dtoCheck.success) {
          sendWsError(ws, {
            code: "INVALID_ENVELOPE",
            message: "Invalid websocket payload shape.",
            details: { issues: dtoCheck.error.issues },
          });
          return;
        }
        const data = dtoCheck.data as any;

        switch (data.type) {
          case 'join_conversation': {
            const conversationId = data.conversationId;
            if (!conversationId || typeof conversationId !== 'string' || !conversationId.trim()) {
              sendWsError(ws, {
                code: "INVALID_JOIN",
                message: "conversationId is required and must be a non-empty string.",
                details: {},
              });
              break;
            }
            try {
              parseConversationId(conversationId.trim());
            } catch {
              sendWsError(ws, {
                code: "INVALID_JOIN",
                message: "conversationId must be project:, team:, or agent: format.",
                details: {},
              });
              break;
            }
            if (!activeConnections.has(conversationId)) {
              activeConnections.set(conversationId, new Set());
            }
            activeConnections.get(conversationId)!.add(ws);
            ws.send(JSON.stringify({
              type: 'connection_confirmed',
              conversationId
            }));
            break;
          }

          case 'send_message_streaming':
            devLog('🔄 Processing streaming message:', data);

            // Phase 1.2: Production-safe envelope validation (never rethrow — log and send error)
            let validationResult;
            try {
              validationResult = validateMessageIngress(data);
            } catch (err: any) {
              console.error('WebSocket validation error:', err?.message ?? err);
              sendWsError(ws, {
                code: "INVALID_ENVELOPE",
                message: "Invalid message payload.",
                details: { reason: err?.message ?? "Validation failed" },
              });
              break;
            }

            if (!validationResult.success) {
              sendWsError(ws, {
                code: "INVALID_ENVELOPE",
                message: "Invalid message format.",
                details: { reason: validationResult.error ?? "Validation failed" },
              });
              break;
            }

            // Extract validated envelope fields
            const envelope = validationResult.envelope!;
            const validatedMode = validationResult.mode!;
            const validatedProjectId = validationResult.projectId!;
            const validatedContextId = validationResult.contextId;
            const addressedAgentId = validationResult.addressedAgentId;

            // Phase 1.2: Production-safe invariant assertions (never rethrow)
            try {
              assertPhase1Invariants({
                type: 'routing_consistency',
                conversationId: envelope.conversationId,
                mode: validatedMode,
                projectId: validatedProjectId,
                contextId: validatedContextId || null,
              });
            } catch (err: any) {
              console.error('WebSocket invariant error:', err?.message ?? err);
              sendWsError(ws, {
                code: "INVARIANT_VIOLATION",
                message: "Request violates server contracts.",
                details: { reason: err?.message ?? "Invariant violation", type: "routing_consistency" },
              });
              break;
            }

            // Conversation state integrity checks: id uniqueness, idempotency, ordering
            const messageId = ensureMessageId(
              String(
                envelope.message?.metadata?.clientMessageId ||
                envelope.message?.metadata?.messageId ||
                `msg-${Date.now()}`
              )
            );
            const streamingData = envelope.message;
            const idempotencyKey = typeof streamingData?.metadata?.idempotencyKey === "string"
              ? streamingData.metadata.idempotencyKey
              : undefined;
            const idempotencyCheck = checkIdempotencyKey(envelope.conversationId, idempotencyKey);
            if (!idempotencyCheck.shouldProcess) {
              ws.send(JSON.stringify({
                type: 'streaming_completed',
                messageId,
                message: null,
                skipped: true,
                reason: idempotencyCheck.reason,
              }));
              break;
            }
            const orderingCheck = assertConversationOrdering(
              envelope.conversationId,
              typeof streamingData.timestamp === "string" ? streamingData.timestamp : undefined
            );
            if (!orderingCheck.inOrder) {
              sendWsError(ws, {
                code: "ORDERING_VIOLATION",
                message: "Out-of-order message sequence detected.",
                details: { reason: orderingCheck.reason },
              });
              break;
            }

            // Mark this conversation as using streaming
            streamingConversations.add(envelope.conversationId);
            devLog('🎯 Marked conversation as streaming:', envelope.conversationId);
            devLog('🔍 Current streaming conversations:', Array.from(streamingConversations));

            // CRITICAL: Ensure conversation exists before saving any messages
            // This prevents foreign key constraint violations
            await ensureConversationExists({
              conversationId: envelope.conversationId,
              projectId: validatedProjectId,
              teamId: validatedMode === 'team' ? validatedContextId : null,
              agentId: validatedMode === 'agent' ? validatedContextId : null,
              type: validatedMode
            });

            // Save initial user message 
            // Phase 1.2: Resolve actual userId from session if client sends generic placeholder
            const sessionUserId = (req as any).session?.userId;
            const finalUserId = (streamingData.userId === 'user' || streamingData.userId === 'current-user' || !streamingData.userId)
              ? sessionUserId
              : streamingData.userId;

            const userMessageData = insertMessageSchema.parse({
              ...streamingData,
              userId: finalUserId,
              conversationId: envelope.conversationId,
            });
            const uniqueness = assertUniqueMessageId(envelope.conversationId, messageId);
            if (!uniqueness.unique) {
              ws.send(JSON.stringify({
                type: 'streaming_completed',
                messageId,
                message: null,
                skipped: true,
                reason: uniqueness.reason,
              }));
              break;
            }
            const savedUserMessage = await storage.createMessage(userMessageData);
            devLog('💾 User message saved:', savedUserMessage.id);

            // Broadcast user message immediately
            broadcastToConversation(envelope.conversationId, {
              type: 'new_message',
              message: savedUserMessage,
              conversationId: envelope.conversationId
            });

            // Send real-time metrics update - use validated fields
            broadcastToConversation(envelope.conversationId, {
              type: 'chat_message',
              projectId: validatedProjectId,
              teamId: validatedMode === 'team' ? validatedContextId || undefined : undefined,
              agentId: savedUserMessage.agentId,
              conversationId: envelope.conversationId,
              data: {
                content: savedUserMessage.content,
                senderId: savedUserMessage.agentId || savedUserMessage.userId || 'user',
                messageId: savedUserMessage.id
              },
              timestamp: new Date().toISOString()
            });

            // Start streaming AI response
            devLog('🚀 Starting streaming response...');

            // Serialize responses per conversation to avoid duplicate replies and busy races.
            const slotAcquired = await waitForStreamingSlot(
              envelope.conversationId,
              Number(process.env.HARD_RESPONSE_TIMEOUT_MS || 45000)
            );
            if (!slotAcquired) {
              ws.send(JSON.stringify({
                type: 'streaming_error',
                messageId,
                conversationId: envelope.conversationId,
                code: 'CONVERSATION_BUSY',
                error: 'I’m still finishing an earlier reply. Please retry in a few seconds.'
              }));
              break;
            }

            // Mark as actively streaming
            activeStreamingResponses.add(envelope.conversationId);

            try {
              await handleStreamingColleagueResponse(
                savedUserMessage,
                envelope.conversationId,
                ws,
                {
                  mode: validatedMode,
                  projectId: validatedProjectId,
                  contextId: validatedContextId || null,
                  addressedAgentId,
                }
              );
            } catch (error) {
              console.error('❌ Streaming response error:', error);
              const payload = getStreamingErrorPayload(error);
              ws.send(JSON.stringify({
                type: 'streaming_error',
                messageId,
                code: payload.code,
                error: payload.error
              }));
            } finally {
              // Remove from active streaming
              activeStreamingResponses.delete(envelope.conversationId);
            }
            break;

          case 'cancel_streaming':
            // B1.3: Handle streaming cancellation
            // AbortController will be handled in the streaming function
            ws.send(JSON.stringify({
              type: 'streaming_cancelled',
              messageId: data.messageId
            }));
            break;

          case 'send_message':
            // Phase 1.2: Resolve actual userId from session if client sends generic placeholder
            const msgSessionId = (req as any).session?.userId;
            const msgUserId = (data.message.userId === 'user' || data.message.userId === 'current-user' || !data.message.userId)
              ? msgSessionId
              : data.message.userId;

            const messageData = insertMessageSchema.parse({
              ...data.message,
              userId: msgUserId
            });
            const savedMessage = await storage.createMessage(messageData);

            // Broadcast message to all connected clients in this conversation
            const connections = activeConnections.get(data.conversationId);
            if (connections) {
              const broadcastData = JSON.stringify({
                type: 'new_message',
                message: savedMessage,
                conversationId: data.conversationId
              });

              connections.forEach(connection => {
                if (connection.readyState === WebSocket.OPEN) {
                  connection.send(broadcastData);
                }
              });
            }

            // AI responses are handled only by send_message_streaming to avoid double replies
            break;

          case 'start_typing':
            await storage.setTypingIndicator(data.conversationId, data.agentId, true, data.estimatedDuration);
            broadcastToConversation(data.conversationId, {
              type: 'typing_started',
              agentId: data.agentId,
              estimatedDuration: data.estimatedDuration
            });
            break;

          case 'stop_typing':
            await storage.setTypingIndicator(data.conversationId, data.agentId, false);
            broadcastToConversation(data.conversationId, {
              type: 'typing_stopped',
              agentId: data.agentId
            });
            break;
        }
      } catch (error: any) {
        // Phase 1.2: Never crash the process — log and send error to client (dev and prod)
        console.error('WebSocket handled error:', error?.message ?? error);
        sendWsError(ws, {
          code: "INTERNAL_ERROR",
          message: "Something went wrong processing your message.",
          details: {
            errorType: error?.name || "UnknownError",
            ...(process.env.NODE_ENV !== "production" && { message: error?.message }),
          },
        });
      }
    });

    ws.on('close', () => {
      // Remove this connection from all conversation rooms
      activeConnections.forEach((connections, conversationId) => {
        connections.delete(ws);
        if (connections.size === 0) {
          activeConnections.delete(conversationId);
          // Clean up streaming tracking for conversations with no active connections
          streamingConversations.delete(conversationId);
          activeStreamingResponses.delete(conversationId);
          devLog('🧹 Cleaned up streaming conversation:', conversationId);
        }
      });
      devLog('WebSocket connection closed');
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  // Helper function to broadcast to all connections in a conversation
  function broadcastToConversation(
    conversationId: string,
    data: any,
    options?: { exclude?: WebSocket }
  ) {
    const connections = activeConnections.get(conversationId);
    if (connections) {
      const message = JSON.stringify(data);
      connections.forEach(connection => {
        if (options?.exclude && connection === options.exclude) {
          return;
        }
        if (connection.readyState === WebSocket.OPEN) {
          connection.send(message);
        }
      });
    }
  }

  // E2.1: Multi-agent response handler for team dynamics
  async function handleMultiAgentResponse(
    selectedAgents: Agent[],
    userMessage: any,
    chatContext: any,
    sharedMemory: string,
    responseMessageId: string,
    conversationId: string,
    ws: WebSocket,
    abortController: AbortController
  ) {
    devLog('🤝 Handling multi-agent team response with', selectedAgents.length, 'agents');

    // Parse conversationId to get canonical projectId for memory retrieval
    let projectId: string | null = null;
    try {
      const parsed = parseConversationId(conversationId);
      projectId = parsed.projectId;
    } catch (error: any) {
      // Safe degradation: if conversationId cannot be parsed, log and continue without memory
      if (process.env.NODE_ENV === 'development' || process.env.DEV) {
        console.warn(`⚠️ Cannot parse conversationId for memory retrieval: ${conversationId}`, error.message);
      }
      // projectId remains null, will use empty memory string
    }

    try {
      // E2.2: Agent response priority and ordering
      const prioritizedAgents = selectedAgents.sort((a, b) => {
        // Prioritize Product Managers for complex questions
        if (a.role === 'Product Manager' && b.role !== 'Product Manager') return -1;
        if (b.role === 'Product Manager' && a.role !== 'Product Manager') return 1;
        return 0;
      });

      let teamResponse = '';
      const agentResponses: Array<{ agent: Agent, content: string, confidence: number }> = [];

      // E2.3: Team consensus building - get responses from each agent
      for (const agent of prioritizedAgents) {
        if (abortController.signal.aborted) break;

        devLog(`🤖 Getting response from ${agent.name} (${agent.role})`);

        // Notify client which agent is currently thinking
        ws.send(JSON.stringify({
          type: 'streaming_chunk',
          messageId: responseMessageId,
          chunk: `[${agent.name} is thinking...]\n`,
          accumulatedContent: teamResponse + `[${agent.name} is thinking...]\n`
        }));

        try {
          // Get agent-specific shared memory using canonical projectId
          const agentMemory = projectId
            ? await storage.getSharedMemoryForAgent(agent.id, projectId)
            : '';

          if (!projectId && (process.env.NODE_ENV === 'development' || process.env.DEV)) {
            console.warn(`⚠️ Skipping memory retrieval for agent ${agent.id}: invalid/missing projectId from conversationId ${conversationId}`);
          }

          // Generate response from this agent
          const agentContext = {
            ...chatContext,
            agentRole: agent.role,
            teamMode: true,
            otherAgents: prioritizedAgents.filter(a => a.id !== agent.id).map(a => a.role)
          };

          const streamGenerator = generateStreamingResponse(
            userMessage.content,
            agent.role,
            agentContext,
            agentMemory,
            abortController.signal
          );

          let agentContent = '';
          for await (const chunk of streamGenerator) {
            if (abortController.signal.aborted) break;
            agentContent += chunk;
          }

          if (agentContent.trim()) {
            agentResponses.push({
              agent,
              content: agentContent,
              confidence: calculateExpertiseConfidence(agent, userMessage.content, {})
            });
          }

        } catch (error) {
          console.error(`❌ Error getting response from ${agent.name}:`, error);

          // E3.1: Attempt handoff to another agent if current agent fails
          const availableAgents = prioritizedAgents.filter(a => a.id !== agent.id);
          if (availableAgents.length > 0) {
            const handoffTarget = availableAgents[0];
            const handoffRequest = initiateHandoff(
              agent,
              handoffTarget,
              'Agent failure - automatic handoff',
              userMessage.content
            );

            const handoffResult = processHandoffRequest(handoffRequest, availableAgents);
            if (handoffResult.accepted) {
              devLog(`🔄 Handing off from ${agent.name} to ${handoffTarget.name}: ${handoffResult.reason}`);

              // Record handoff attempt
              const handoffStartTime = Date.now();
              try {
                // Get fresh memory and context for handoff using canonical projectId
                const handoffAgentMemory = projectId
                  ? await storage.getSharedMemoryForAgent(handoffTarget.id, projectId)
                  : '';

                if (!projectId && (process.env.NODE_ENV === 'development' || process.env.DEV)) {
                  console.warn(`⚠️ Skipping memory retrieval for handoff agent ${handoffTarget.id}: invalid/missing projectId from conversationId ${conversationId}`);
                }
                const handoffAgentContext = {
                  ...chatContext,
                  agentRole: handoffTarget.role,
                  teamMode: true,
                  otherAgents: prioritizedAgents.filter(a => a.id !== handoffTarget.id).map(a => a.role)
                };

                const handoffContext = transferContext(handoffRequest, chatContext.conversationHistory, handoffAgentMemory);
                const handoffStreamGenerator = generateStreamingResponse(
                  handoffContext,
                  handoffTarget.role,
                  handoffAgentContext,
                  handoffAgentMemory,
                  abortController.signal
                );

                let handoffContent = '';
                for await (const chunk of handoffStreamGenerator) {
                  if (abortController.signal.aborted) break;
                  handoffContent += chunk;
                }

                if (handoffContent.trim()) {
                  agentResponses.push({
                    agent: handoffTarget,
                    content: handoffContent,
                    confidence: calculateExpertiseConfidence(handoffTarget, userMessage.content, {})
                  });

                  // Record successful handoff
                  const handoffDuration = Date.now() - handoffStartTime;
                  handoffTracker.recordHandoff(handoffRequest, handoffDuration, true);
                  devLog(`✅ Handoff to ${handoffTarget.name} completed successfully`);
                }
              } catch (handoffError) {
                console.error(`❌ Handoff to ${handoffTarget.name} failed:`, handoffError);
                const handoffDuration = Date.now() - handoffStartTime;
                handoffTracker.recordHandoff(handoffRequest, handoffDuration, false);
              }
            }
          }
        }
      }

      // E2.4: Agent disagreement handling and consensus building
      if (agentResponses.length > 1) {
        // Build consensus response
        teamResponse = buildTeamConsensus(agentResponses, userMessage.content);
      } else if (agentResponses.length === 1) {
        teamResponse = agentResponses[0].content;
      } else {
        teamResponse = "I'm sorry, I couldn't generate a response from the team at this time.";
      }

      // Stream the team response
      const words = teamResponse.split(' ');
      let accumulatedContent = '';
      for (let i = 0; i < words.length; i++) {
        if (abortController.signal.aborted) break;

        const chunk = words[i] + (i < words.length - 1 ? ' ' : '');
        accumulatedContent += chunk;

        // Send chunk to client
        ws.send(JSON.stringify({
          type: 'streaming_chunk',
          messageId: responseMessageId,
          chunk,
          accumulatedContent
        }));

        // Simulate typing delay for natural feel
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      devLog('✅ Multi-agent team response completed');

    } catch (error) {
      console.error('❌ Error in multi-agent response:', error);
      // Fallback to single agent response
      const fallbackAgent = selectedAgents[0];
      const streamGenerator = generateStreamingResponse(
        userMessage.content,
        fallbackAgent.role,
        chatContext,
        sharedMemory,
        abortController.signal
      );

      let fallbackContent = '';
      for await (const chunk of streamGenerator) {
        if (abortController.signal.aborted) break;
        fallbackContent += chunk;

        ws.send(JSON.stringify({
          type: 'streaming_chunk',
          messageId: responseMessageId,
          chunk,
          accumulatedContent: fallbackContent
        }));
      }
    }
  }

  // E2.3: Team consensus building function
  function buildTeamConsensus(agentResponses: Array<{ agent: Agent, content: string, confidence: number }>, userMessage: string): string {
    devLog('🤝 Building team consensus from', agentResponses.length, 'responses');

    // Sort by confidence
    const sortedResponses = agentResponses.sort((a, b) => b.confidence - a.confidence);

    // For now, use the highest confidence response as the base
    // In a more sophisticated implementation, this would analyze and merge responses
    const primaryResponse = sortedResponses[0];
    const supportingAgents = sortedResponses.slice(1);

    let consensusResponse = primaryResponse.content;

    // Add team context if multiple agents contributed
    if (supportingAgents.length > 0) {
      const teamMembers = sortedResponses.map(r => r.agent.role).join(', ');
      consensusResponse = `As a team (${teamMembers}), here's our collective response:\n\n${consensusResponse}`;
    }

    return consensusResponse;
  }

  // B1.1 & B1.2: Streaming AI colleague response handler
  async function handleStreamingColleagueResponse(
    userMessage: any,
    conversationId: string,
    ws: WebSocket,
    validatedContext?: {
      mode: "project" | "team" | "agent";
      projectId: string;
      contextId: string | null;
      addressedAgentId?: string;
    }
  ) {
    devLog('🎯 Starting streaming handler for:', conversationId);
    let resolvedMode: "project" | "team" | "agent" = "project";
    let resolvedProjectId: string | null = validatedContext?.projectId || null;
    let fallbackResponder: Agent | null = null;
    let responseMessageId = `response-${Date.now()}`;
    let hasStreamingStarted = false;
    const turnStartedAt = Date.now();
    let llmMetadata: any = null;
    let traceId: string | null = null;
    try {
      // Parse conversation ID using shared utility (replaces brittle split logic)
      // Validate conversationId is present and is a string
      if (!conversationId || typeof conversationId !== 'string') {
        devLog('❌ Invalid conversation ID: must be a non-empty string');
        ws.send(JSON.stringify({
          type: 'streaming_error',
          error: 'Invalid conversation ID format'
        }));
        return;
      }

      let parsed;
      try {
        parsed = parseConversationId(conversationId);
      } catch (error: any) {
        // Handle parsing errors safely
        if (error.message.includes('Ambiguous conversation ID')) {
          console.error('❌ Ambiguous conversation ID cannot be safely parsed:', conversationId);
          console.error('   Error:', error.message);
          ws.send(JSON.stringify({
            type: 'streaming_error',
            error: 'Ambiguous conversation context; projectId cannot be safely derived from conversationId. Rename project/team IDs to avoid ambiguous hyphen splits or adopt a safe encoding.',
            conversationId
          }));
          return;
        } else {
          // Other parsing errors (invalid format, etc.)
          console.error('❌ Invalid conversation ID format:', conversationId, error.message);
          ws.send(JSON.stringify({
            type: 'streaming_error',
            error: `Invalid conversation ID format: ${error.message}`,
            conversationId
          }));
          return;
        }
      }

      // Extract parsed values (use validated context if available, otherwise parse)
      const mode = validatedContext?.mode || (parsed.scope as 'project' | 'team' | 'agent');
      const projectId = validatedContext?.projectId || parsed.projectId;
      const contextId = validatedContext?.contextId ?? parsed.contextId;
      const addressedAgentId = validatedContext?.addressedAgentId;
      resolvedMode = mode;
      resolvedProjectId = projectId;

      devLog('🔍 Parsed conversation:', { mode, projectId, contextId, addressedAgentId });

      devLog('🔍 Parsed conversation:', { mode, projectId, contextId, addressedAgentId });

      // Conversation is ensured at the WebSocket handler level

      // Phase 1.2: Production-safe conversation existence assertion
      try {
        assertPhase1Invariants({
          type: 'conversation_exists',
          conversationId,
        });
      } catch (err: any) {
        // In production, the assertion already logs warnings instead of throwing
        if (isProd) {
          console.warn("[INVARIANT] Conversation existence check failed (production-safe):", err.message);
          // Continue processing - the outer catch will handle if needed
        } else {
          throw err; // Dev/test: rethrow
        }
      }

      const project = await storage.getProject(projectId);
      if (!project) {
        devLog('❌ Project not found:', projectId);
        return;
      }

      const trace = await createDeliberationTrace({
        projectId,
        conversationId,
        objective: userMessage.content || "",
      });
      traceId = trace.traceId;
      await writeConfigSnapshot("live_scenario_run");

      // Phase 1.2: Get available agents using centralized helper
      // Get all project agents first, then filter by scope
      const allProjectAgents = await storage.getAgentsByProject(projectId);
      const projectAgentsAsAgentType: Agent[] = allProjectAgents.map(agent => ({
        id: agent.id,
        name: agent.name,
        role: agent.role,
        teamId: agent.teamId
      }));

      // Build scope context for agent availability filtering
      const scopeContext: ScopeContext = {
        projectId,
        mode,
        ...(mode === 'team' && contextId ? { teamId: contextId } : {}),
        ...(mode === 'agent' && contextId ? { agentId: contextId } : {}),
      };

      // Phase 1.2: Use centralized agent availability helper
      const availableAgents = filterAvailableAgents(projectAgentsAsAgentType, scopeContext);

      let teamName: string | undefined;
      if (mode === 'team' && contextId) {
        const team = await storage.getTeam(contextId);
        teamName = team?.name;
      }

      const conductorResult = evaluateConductorDecision({
        userMessage: userMessage.content,
        conversationMode: mode,
        availableAgents,
        addressedAgentId,
        projectName: project.name,
      });

      const isStrategic = isStrategicTurn(userMessage.content);
      const decisionForecasts = isStrategic
        ? buildDecisionForecast({
          userMessage: userMessage.content,
          safetyScore: conductorResult.safetyScore,
          projectName: project.name,
        })
        : [];

      // Phase 1.2.a: Persistence invariant enforcement
      // Message persistence must not depend on agent availability or orchestration success
      // If no agents are available, we use PM Maya fallback (not fake "System" agent)

      // Helper: Get PM fallback agent for the project
      const getProjectPmFallback = async (projectId: string): Promise<Agent | null> => {
        const projectAgents = await storage.getAgentsByProject(projectId);

        // Find PM agent by role match (case-insensitive)
        const pmAgent = projectAgents.find(agent => {
          const roleLower = agent.role.toLowerCase();
          return roleLower.includes('product manager') || roleLower === 'pm';
        });

        if (pmAgent) {
          return {
            id: pmAgent.id,
            name: pmAgent.name,
            role: pmAgent.role,
            teamId: pmAgent.teamId
          };
        }

        // Fallback to first agent in project (if any)
        if (projectAgents.length > 0) {
          const firstAgent = projectAgents[0];
          return {
            id: firstAgent.id,
            name: firstAgent.name,
            role: firstAgent.role,
            teamId: firstAgent.teamId
          };
        }

        // Last resort: no agents at all
        return null;
      };

      let respondingAgent: Agent | null = null;
      let selectedAgents: Agent[] = [];
      let authority: { allowedSpeaker: Agent; reason: string } | null = null;
      let isPmFallback = false;
      let isSystemFallback = false;

      if (availableAgents.length === 0) {
        // Persistence invariant: Even with no agents, we must persist a response
        // Try to use PM Maya fallback instead of fake "System" agent
        const pmFallback = await getProjectPmFallback(projectId);

        if (pmFallback) {
          devLog('⚠️ No agents available in scope - using PM Maya fallback');
          respondingAgent = pmFallback;
          selectedAgents = [pmFallback];
          isPmFallback = true;
          // Phase 1.4: Explicit fallback classification
          // Fallback type will be attached to message metadata
        } else {
          // Last resort: project has zero agents total
          devLog('⚠️ No agents available at all - using system fallback (last resort)');
          isSystemFallback = true;
          // Phase 1.4: Explicit fallback classification
          // Fallback type will be attached to message metadata
        }
      } else {
        // Phase 1.1.b: Resolve speaking authority BEFORE any agent selection
        // Extract addressedAgentId from userMessage metadata if present
        const addressedAgentId = (userMessage as any).addressedAgentId || (userMessage as any).metadata?.addressedAgentId;

        try {
          // Phase 1.2: Use addressedAgentId from validated envelope (not from raw casting)
          const envelopeAddressedAgentId = addressedAgentId ||
            (userMessage as any).addressedAgentId ||
            (userMessage as any).metadata?.addressedAgentId;

          authority = resolveSpeakingAuthority({
            conversationScope: mode,
            conversationId,
            availableAgents,
            addressedAgentId: envelopeAddressedAgentId
          });

          // Phase 1.1.b: Enforce authority result - override all existing selection logic
          respondingAgent = authority.allowedSpeaker;
          selectedAgents = [authority.allowedSpeaker];
        } catch (error: any) {
          // Persistence invariant: If authority resolution fails, use PM fallback
          console.warn('⚠️ Authority resolution failed, using PM fallback:', error.message);
          const pmFallback = await getProjectPmFallback(projectId);

          if (pmFallback) {
            respondingAgent = pmFallback;
            selectedAgents = [pmFallback];
            isPmFallback = true;
            // Phase 1.4: Explicit fallback classification
            // Fallback type will be attached to message metadata
          } else {
            // Last resort: use first available agent or system
            respondingAgent = availableAgents[0] || null;
            selectedAgents = respondingAgent ? [respondingAgent] : [];
            isSystemFallback = !respondingAgent;
            // Phase 1.4: Explicit fallback classification
            // Fallback type will be attached to message metadata
          }
        }
      }

      // Phase 1.4: No fake "System agent" invariant
      // If system fallback is needed, agentId must be null, not 'system'
      // Only create a minimal agent object for internal use (not persisted with agentId='system')
      if (isSystemFallback && !respondingAgent) {
        // Internal use only - will be persisted with agentId=null
        respondingAgent = {
          id: 'system', // Internal ID only, not persisted
          name: 'System',
          role: 'System',
          teamId: undefined
        };
        selectedAgents = [respondingAgent];
      }

      // Type guard: respondingAgent must be set at this point
      if (!respondingAgent) {
        console.error('❌ Critical: respondingAgent is null after fallback logic');
        // This should never happen, but ensure we have a fallback
        // Internal use only - will be persisted with agentId=null
        respondingAgent = {
          id: 'system', // Internal ID only, not persisted
          name: 'System',
          role: 'System',
          teamId: undefined
        };
        selectedAgents = [respondingAgent];
        isSystemFallback = true;
      }
      fallbackResponder = respondingAgent;

      // Dev-only logging
      if (process.env.NODE_ENV === 'development' || process.env.DEV) {
        const reason = authority ? authority.reason : (isPmFallback ? 'pm_fallback' : isSystemFallback ? 'system_fallback' : 'fallback_no_agents');
        devLog(
          `[Authority] scope=${mode} speaker=${respondingAgent.id} reason=${reason}`
        );
      }

      // Conductor-directed routing override: choose intent specialist when appropriate
      const matches = findBestAgentMatch(userMessage.content, availableAgents);
      if (
        !isPmFallback &&
        !isSystemFallback &&
        conductorResult.decision.route === "intent_specialist" &&
        conductorResult.primaryMatch
      ) {
        respondingAgent = conductorResult.primaryMatch;
      }

      devLog('🎯 Expertise matches:', matches.map(m => ({
        name: m.agent.name,
        role: m.agent.role,
        confidence: m.confidence,
        reasoning: m.reasoning
      })));

      // Risk-triggered peer-policing: expand to multi-agent review when needed
      const analysis = analyzeQuestion(userMessage.content);
      const maxAgents = Math.max(
        1,
        conductorResult.decision.reviewerCount + 1,
        analysis.requiresMultipleAgents || analysis.complexity === 'high' ? 2 : 1,
      );
      const potentialMultiAgents = coordinateMultiAgentResponse(userMessage.content, availableAgents, maxAgents);

      if (
        !isPmFallback &&
        !isSystemFallback &&
        respondingAgent &&
        conductorResult.decision.reviewRequired &&
        mode !== "agent"
      ) {
        const mergedAgents = [respondingAgent, ...potentialMultiAgents, ...conductorResult.fallbackMatches];
        const uniqueAgents = mergedAgents.filter(
          (agent, index, arr) => arr.findIndex((candidate) => candidate.id === agent.id) === index
        );
        selectedAgents = uniqueAgents.slice(0, Math.max(2, maxAgents));
      } else if (!isPmFallback && !isSystemFallback && respondingAgent) {
        selectedAgents = [respondingAgent];
      }

      if (potentialMultiAgents.length > 1) {
        devLog('🤝 Multi-agent team potential:', potentialMultiAgents.map(a => `${a.name} (${a.role})`).join(', '));
      }

      await logAutonomyEvent({
        eventType: "hatch_selected",
        projectId,
        teamId: mode === "team" ? (contextId ?? null) : null,
        conversationId,
        hatchId: respondingAgent?.id || null,
        provider: llmMetadata?.provider || getCurrentRuntimeConfig().provider,
        mode: llmMetadata?.mode || getCurrentRuntimeConfig().mode,
        latencyMs: null,
        confidence: conductorResult.decision.confidence,
        riskScore: Math.max(
          conductorResult.safetyScore.hallucinationRisk,
          conductorResult.safetyScore.scopeRisk,
          conductorResult.safetyScore.executionRisk
        ),
        payload: {
          decisionReason: conductorResult.decision.reasons.join(", "),
          candidateHatches: matches.map((m) => m.agent.id),
          selectionScores: Object.fromEntries(matches.map((m) => [m.agent.id, m.confidence])),
          selectionConfidence: conductorResult.decision.confidence,
        },
      });

      ws.send(JSON.stringify({
        type: "conductor_decision",
        conversationId,
        decision: conductorResult.decision,
        safetyScore: conductorResult.safetyScore,
      }));

      devLog('🎯 Authority-enforced speaker:', respondingAgent.name, respondingAgent.role);
      devLog('🔍 Available agents:', availableAgents.map(a => ({ id: a.id, name: a.name, role: a.role })));

      devLog('🤖 Responding agent:', respondingAgent.name, respondingAgent.role);

      // B3: Get shared memory for the agent (skip if system fallback)
      const sharedMemory = (respondingAgent && !isSystemFallback && respondingAgent.id !== 'system')
        ? await storage.getSharedMemoryForAgent(respondingAgent.id, projectId)
        : '';
      devLog('🧠 Loading shared memory for agent:', sharedMemory ? 'Found context' : 'No prior context');

      // Create streaming response message shell
      responseMessageId = `response-${Date.now()}`;
      let accumulatedContent = '';

      // B3: Extract and store conversation memory BEFORE generating response
      await extractAndStoreMemory(userMessage, { content: 'Processing...' }, conversationId, projectId);
      await extractUserName(userMessage.content, conversationId);

      // Load conversation history for context
      const recentMessages = await storage.getMessagesByConversation(conversationId);
      const conversationHistory = recentMessages.slice(-10).map(msg => ({
        role: msg.messageType === 'user' ? 'user' as const : 'assistant' as const,
        content: msg.content,
        timestamp: msg.createdAt?.toISOString() || new Date().toISOString(),
        senderId: msg.userId || msg.agentId || 'unknown',
        messageType: msg.messageType === 'system' ? 'agent' as const : msg.messageType as 'user' | 'agent'
      }));

      // Create chat context for AI
      const chatContext = {
        mode: mode as 'project' | 'team' | 'agent',
        projectName: project.name,
        projectId,
        teamName,
        agentRole: respondingAgent.role,
        agentId: respondingAgent.id,
        conversationHistory,
        userId: userMessage.userId || 'user'
      };

      // Create AbortController for cancellation
      const abortController = new AbortController();

      // Handle cancellation messages
      const cancelHandler = (message: Buffer) => {
        const data = JSON.parse(message.toString());
        if (data.type === 'cancel_streaming' && data.messageId === responseMessageId) {
          devLog('🛑 Streaming cancelled by user');
          abortController.abort();
        }
      };
      ws.on('message', cancelHandler);

      try {
        // Notify streaming started right before actual streaming begins
        devLog('📡 Sending streaming_started event');
        ws.send(JSON.stringify({
          type: 'streaming_started',
          messageId: responseMessageId,
          agentId: respondingAgent ? respondingAgent.id : 'system',
          agentName: respondingAgent ? respondingAgent.name : 'System'
        }));
        hasStreamingStarted = true;

        // Persistence invariant: Handle no agents case with graceful fallback
        // Message persistence must not depend on agent availability or orchestration success
        if (isSystemFallback) {
          // Last resort: project has zero agents total
          devLog('📝 Generating system fallback response (no agents in project)');
          accumulatedContent = "I'm sorry, but there are no agents available to respond at this time. Please add agents to this project to enable responses.";

          // Send the fallback response as a single chunk
          ws.send(JSON.stringify({
            type: 'streaming_chunk',
            messageId: responseMessageId,
            chunk: accumulatedContent,
            accumulatedContent
          }));
        } else if (isPmFallback) {
          // PM Maya fallback - scope-specific messages
          devLog('📝 Generating PM Maya fallback response');

          if (mode === 'team') {
            accumulatedContent = "This team has no Hatches yet. Add one and I'll continue as the team lead once assigned.";
          } else if (mode === 'agent') {
            accumulatedContent = "That Hatch doesn't exist or isn't available in this project. Add it or switch back to Project chat.";
          } else {
            // Project scope (shouldn't happen, but handle gracefully)
            accumulatedContent = "I'm here to help! Let me know what you'd like to work on.";
          }

          // Send the fallback response as a single chunk
          ws.send(JSON.stringify({
            type: 'streaming_chunk',
            messageId: responseMessageId,
            chunk: accumulatedContent,
            accumulatedContent
          }));
        } else if (conductorResult.decision.interventionRequired) {
          // Safety intervention flow: stop speculative output and ask focused clarifications
          devLog('🛑 Safety intervention triggered for turn');
          accumulatedContent = buildClarificationIntervention({
            projectName: project.name,
            reasons: conductorResult.decision.reasons,
          });

          await logAutonomyEvent({
            eventType: "safety_triggered",
            projectId,
            teamId: mode === "team" ? (contextId ?? null) : null,
            conversationId,
            hatchId: respondingAgent?.id || null,
            provider: llmMetadata?.provider || getCurrentRuntimeConfig().provider,
            mode: llmMetadata?.mode || getCurrentRuntimeConfig().mode,
            latencyMs: Date.now() - turnStartedAt,
            confidence: conductorResult.decision.confidence,
            riskScore: Math.max(
              conductorResult.safetyScore.hallucinationRisk,
              conductorResult.safetyScore.scopeRisk,
              conductorResult.safetyScore.executionRisk
            ),
            payload: {
              reasons: conductorResult.decision.reasons,
            },
          });

          ws.send(JSON.stringify({
            type: 'safety_intervention',
            messageId: responseMessageId,
            conversationId,
            safetyScore: conductorResult.safetyScore,
            decision: conductorResult.decision,
            content: accumulatedContent,
          }));

          ws.send(JSON.stringify({
            type: 'streaming_chunk',
            messageId: responseMessageId,
            chunk: accumulatedContent,
            accumulatedContent
          }));
        } else if (selectedAgents.length > 1) {
          // E2.1: Handle multi-agent responses for team dynamics
          devLog('🤝 Generating multi-agent team response...');
          await handleMultiAgentResponse(selectedAgents, userMessage, chatContext, sharedMemory, responseMessageId, conversationId, ws, abortController);
        } else if (respondingAgent && !isPmFallback && !isSystemFallback) {
          // Single agent response (existing logic)
          devLog('🔄 Generating single agent streaming response...');
          const streamGenerator = generateStreamingResponse(
            userMessage.content,
            respondingAgent.role,
            chatContext,
            sharedMemory,
            abortController.signal,
            (metadata) => {
              llmMetadata = metadata;
            }
          );

          for await (const chunk of streamGenerator) {
            if (abortController.signal.aborted) {
              devLog('🛑 Stream aborted');
              break;
            }

            accumulatedContent += chunk;
            devLog('📤 Sending chunk:', chunk.substring(0, 20) + '...');

            // Send chunk to client
            ws.send(JSON.stringify({
              type: 'streaming_chunk',
              messageId: responseMessageId,
              chunk,
              accumulatedContent
            }));
          }
        }

        // Persistence invariant: Always persist agent message, even if empty or fallback
        // This ensures symmetric persistence: user messages are always saved, agent messages must be too
        if (!abortController.signal.aborted) {
          const runtimeNow = getCurrentRuntimeConfig();
          const activeProvider = llmMetadata?.provider || runtimeNow.provider;
          const activeMode = llmMetadata?.mode || runtimeNow.mode;
          const aggregateRisk = Math.max(
            conductorResult.safetyScore.hallucinationRisk,
            conductorResult.safetyScore.scopeRisk,
            conductorResult.safetyScore.executionRisk
          );

          const toolDecision = routeTools({
            role: respondingAgent?.role || "system",
            message: userMessage.content || "",
            complexity: analysis.complexity,
            riskScore: aggregateRisk,
            roundsUsed: 1,
            webCallsUsed: 0,
          });
          if (!toolDecision.allowed && toolDecision.reason.includes('budget')) {
            await logAutonomyEvent({
              eventType: "budget_exceeded",
              projectId,
              teamId: mode === "team" ? (contextId ?? null) : null,
              conversationId,
              hatchId: respondingAgent?.id || null,
              provider: activeProvider,
              mode: activeMode,
              latencyMs: Date.now() - turnStartedAt,
              confidence: conductorResult.decision.confidence,
              riskScore: aggregateRisk,
              payload: toolDecision as unknown as Record<string, unknown>,
            });
          }

          if (llmMetadata?.fallbackChain && llmMetadata.fallbackChain.length > 0) {
            await logAutonomyEvent({
              eventType: "provider_fallback",
              projectId,
              teamId: mode === "team" ? (contextId ?? null) : null,
              conversationId,
              hatchId: respondingAgent?.id || null,
              provider: llmMetadata.provider,
              mode: llmMetadata.mode,
              latencyMs: llmMetadata.latencyMs ?? null,
              confidence: conductorResult.decision.confidence,
              riskScore: Math.max(
                conductorResult.safetyScore.hallucinationRisk,
                conductorResult.safetyScore.scopeRisk,
                conductorResult.safetyScore.executionRisk
              ),
              payload: {
                fallbackChain: llmMetadata.fallbackChain,
              },
            });
          }

          // Phase 19: Peer-policing protocol with stop-the-line behavior.
          const reviewers = availableAgents
            .filter((agent) => agent.id !== respondingAgent?.id)
            .map((agent) => ({ id: agent.id, name: agent.name, role: agent.role }));

          const peerReviewDecision = await runPeerReview({
            traceId,
            roundNoBase: 1,
            projectId,
            teamId: mode === "team" ? (contextId ?? null) : null,
            conversationId,
            primaryHatchId: respondingAgent?.id || "system",
            primaryHatchRole: respondingAgent?.role || "System",
            reviewers,
            provider: activeProvider,
            mode: activeMode,
            confidence: conductorResult.decision.confidence,
            riskScore: aggregateRisk,
            userMessage: userMessage.content || "",
            draftResponse: accumulatedContent || "",
            projectName: project.name,
            isProposalTurn: decisionForecasts.length > 0,
            safetySensitive: aggregateRisk >= 0.35,
            contradictsCanon: false,
            allowOverrideHighRisk: (process.env.ALLOW_PEER_REVIEW_OVERRIDE ?? "false").toLowerCase() === "true",
          });

          if (peerReviewDecision.triggered) {
            const resolution = resolveDecisionConflict({
              candidates: [
                {
                  hatchId: respondingAgent?.id || "system",
                  authority: "worker",
                  confidence: conductorResult.decision.confidence,
                  content: peerReviewDecision.revisedContent,
                  riskScore: aggregateRisk,
                },
              ],
              guardrailOverride: peerReviewDecision.blockedByHallucination
                ? peerReviewDecision.revisedContent
                : undefined,
              roundCount: Math.min(BUDGETS.maxDeliberationRounds, 2),
            });

            await logAutonomyEvent({
              eventType: peerReviewDecision.blockedByHallucination ? "decision_conflict_detected" : "conductor_resolution",
              projectId,
              teamId: mode === "team" ? (contextId ?? null) : null,
              conversationId,
              hatchId: respondingAgent?.id || null,
              provider: activeProvider,
              mode: activeMode,
              latencyMs: Date.now() - turnStartedAt,
              confidence: conductorResult.decision.confidence,
              riskScore: aggregateRisk,
              payload: resolution as unknown as Record<string, unknown>,
            });

            if (resolution.timeoutTriggered) {
              await logAutonomyEvent({
                eventType: "deliberation_timeout",
                projectId,
                teamId: mode === "team" ? (contextId ?? null) : null,
                conversationId,
                hatchId: respondingAgent?.id || null,
                provider: activeProvider,
                mode: activeMode,
                latencyMs: Date.now() - turnStartedAt,
                confidence: conductorResult.decision.confidence,
                riskScore: aggregateRisk,
                payload: {
                  roundsUsed: resolution.roundsUsed,
                },
              });
            }

            if (resolution.overriddenByGuardrail) {
              await logAutonomyEvent({
                eventType: "policy_override",
                projectId,
                teamId: mode === "team" ? (contextId ?? null) : null,
                conversationId,
                hatchId: respondingAgent?.id || null,
                provider: activeProvider,
                mode: activeMode,
                latencyMs: Date.now() - turnStartedAt,
                confidence: conductorResult.decision.confidence,
                riskScore: aggregateRisk,
                payload: { reason: resolution.reason },
              });
            }

            const previousAccumulated = accumulatedContent || "";
            accumulatedContent = resolution.finalContent;
            if (accumulatedContent !== previousAccumulated) {
              ws.send(JSON.stringify({
                type: "peer_review_revision",
                messageId: responseMessageId,
                conversationId,
                content: accumulatedContent,
                blockedByHallucination: peerReviewDecision.blockedByHallucination,
              }));
            }
          }

          // Save complete response to storage
          // Note: accumulatedContent may be empty or a fallback message, but it must be persisted
          // Phase 1.4: No fake "System agent" invariant
          // If system fallback: agentId=null, messageType='system'
          // If PM fallback: agentId=pmAgent.id, messageType='agent'
          const responseMessage: any = {
            id: responseMessageId,
            conversationId,
            // Invariant: Never persist agentId='system'. Use null for system fallback.
            agentId: isSystemFallback ? null : (respondingAgent && respondingAgent.id !== 'system' ? respondingAgent.id : null),
            senderName: respondingAgent ? respondingAgent.name : 'System',
            content: accumulatedContent || '', // Ensure content exists (empty string if needed)
            messageType: isSystemFallback ? 'system' as const : 'agent' as const,
            metadata: {
              conductor: conductorResult.decision,
              safetyScore: conductorResult.safetyScore,
              llm: llmMetadata || {
                provider: runtimeNow.provider,
                mode: runtimeNow.mode,
                model: runtimeNow.model,
              },
              testModeDisclaimer: activeMode === "test" ? "Test Mode (Local Model)" : undefined,
              testModelParams: activeMode === "test"
                ? {
                  model: llmMetadata?.model || runtimeNow.model,
                  temperature: llmMetadata?.temperature,
                  maxTokens: llmMetadata?.maxTokens,
                }
                : undefined,
              ...(decisionForecasts.length > 0 ? { decisionForecasts } : {}),
              ...(selectedAgents.length > 1
                ? {
                  peerReview: {
                    enabled: true,
                    participantIds: selectedAgents.map((agent) => agent.id),
                  },
                }
                : {}),
            },
          };

          if (traceId && respondingAgent) {
            await appendDeliberationRound(traceId, {
              roundNo: 1,
              hatchId: respondingAgent.id,
              prompt: userMessage.content || "",
              output: accumulatedContent || "",
              confidence: conductorResult.decision.confidence,
              riskScore: Math.max(
                conductorResult.safetyScore.hallucinationRisk,
                conductorResult.safetyScore.scopeRisk,
                conductorResult.safetyScore.executionRisk
              ),
              latencyMs: Date.now() - turnStartedAt,
              timestamp: new Date().toISOString(),
            });
          }

          // Phase 1.2: Production-safe no fake system agent assertion
          // Note: This is inside handleStreamingColleagueResponse, so we can't use sendWsError directly
          // But the assertion already handles production gracefully (logs warnings)
          try {
            assertPhase1Invariants({
              type: 'no_fake_system_agent',
              agentId: responseMessage.agentId,
              messageType: responseMessage.messageType,
            });
          } catch (err: any) {
            // In production, the assertion already logs warnings instead of throwing
            if (isProd) {
              console.warn("[INVARIANT] No fake system agent check failed (production-safe):", err.message);
              // Continue processing - message will still be persisted
            } else {
              throw err; // Dev/test: rethrow
            }
          }

          // Phase 1.4: Explicit fallback classification (invariant hardening)
          // Attach machine-readable fallback metadata to all messages
          if (isSystemFallback) {
            // True system fallback: project has zero agents
            responseMessage.metadata = {
              ...responseMessage.metadata,
              fallback: {
                type: 'system',
                reason: 'no_agents_in_project'
              },
              system_fallback_no_agents: true // Legacy flag (preserved for compatibility)
            };
          } else if (isPmFallback) {
            // PM Maya fallback: project has agents but none in scope, or authority failed
            const fallbackReason = availableAgents.length === 0
              ? 'no_agents_in_scope'
              : authority === null
                ? 'authority_failed'
                : 'no_agents_in_scope';

            responseMessage.metadata = {
              ...responseMessage.metadata,
              fallback: {
                type: 'pm',
                reason: fallbackReason
              }
            };
          }

          const savedResponse = await storage.createMessage(responseMessage);
          devLog('💾 Saved streaming response:', savedResponse.id, '(persistence invariant enforced)');

          await logAutonomyEvent({
            eventType: "synthesis_completed",
            projectId,
            teamId: mode === "team" ? (contextId ?? null) : null,
            conversationId,
            hatchId: respondingAgent?.id || null,
            provider: llmMetadata?.provider || getCurrentRuntimeConfig().provider,
            mode: llmMetadata?.mode || getCurrentRuntimeConfig().mode,
            latencyMs: Date.now() - turnStartedAt,
            confidence: conductorResult.decision.confidence,
            riskScore: Math.max(
              conductorResult.safetyScore.hallucinationRisk,
              conductorResult.safetyScore.scopeRisk,
              conductorResult.safetyScore.executionRisk
            ),
            payload: {
              traceId,
              messageId: savedResponse.id,
            },
          });

          if (traceId) {
            await finalizeDeliberationTrace(traceId, accumulatedContent || "");
          }

          // B3: Update stored memory with actual AI response
          await extractAndStoreMemory(userMessage, savedResponse, conversationId, projectId);
          await logAutonomyEvent({
            eventType: "memory_written",
            projectId,
            teamId: mode === "team" ? (contextId ?? null) : null,
            conversationId,
            hatchId: respondingAgent?.id || null,
            provider: llmMetadata?.provider || getCurrentRuntimeConfig().provider,
            mode: llmMetadata?.mode || getCurrentRuntimeConfig().mode,
            latencyMs: Date.now() - turnStartedAt,
            confidence: conductorResult.decision.confidence,
            riskScore: Math.max(
              conductorResult.safetyScore.hallucinationRisk,
              conductorResult.safetyScore.scopeRisk,
              conductorResult.safetyScore.executionRisk
            ),
            payload: {
              messageId: savedResponse.id,
            },
          });

          // Phase 20: Autonomous Knowledge Loop (project-private and governance-gated).
          try {
            const aklResult = await runAutonomousKnowledgeLoop({
              projectId,
              conversationId,
              role: respondingAgent.role,
              userMessage: userMessage.content || "",
              draftResponse: accumulatedContent || "",
              confidence: conductorResult.decision.confidence,
              provider: llmMetadata?.provider || getCurrentRuntimeConfig().provider,
              mode: llmMetadata?.mode || getCurrentRuntimeConfig().mode,
              highStakes: aggregateRisk >= 0.65,
            });

            if (aklResult.gapDetected) {
              ws.send(JSON.stringify({
                type: "knowledge_update_status",
                conversationId,
                status: aklResult.promoted ? "promoted" : "reviewed",
                reason: aklResult.reason,
                updateCard: aklResult.updateCard || null,
              }));
            }
          } catch (aklError) {
            console.error("AKL runtime error:", aklError);
          }

          // B4: Process personality evolution from this interaction
          // This happens automatically in the streaming generation now

          // Auto task extraction from conversation
          try {
            const { extractTasksFromMessage, extractTasksFallback } = await import('./ai/taskExtractor.js');

            // Get available agents for the project
            const projectAgents = await storage.getAgentsByProject(projectId);
            const availableAgents = projectAgents.map(agent => agent.role);

            const projectContext = {
              projectName: chatContext.projectName,
              teamName: chatContext.teamName,
              agentRole: respondingAgent.role,
              availableAgents,
              conversationId
            };

            // Extract tasks from the conversation
            let taskResult = await extractTasksFromMessage(
              userMessage.content,
              accumulatedContent,
              projectContext
            );

            // Fallback to keyword matching if AI extraction fails
            if (!taskResult.hasTasks && taskResult.confidence < 0.5) {
              taskResult = extractTasksFallback(
                userMessage.content,
                accumulatedContent,
                availableAgents
              );
            }

            // If tasks were found, send them to the client for approval
            if (taskResult.hasTasks && taskResult.tasks.length > 0) {
              devLog('🎯 Found', taskResult.tasks.length, 'potential tasks from conversation');
              // Normalize suggestedAssignee to include agent id/name/role
              const agentsForProject = await storage.getAgentsByProject(projectId);
              const normalizedTasks = taskResult.tasks.map((t: any) => {
                let suggested = t.suggestedAssignee;
                if (typeof suggested === 'string') {
                  const match = agentsForProject.find(a => a.role === suggested);
                  if (match) {
                    return {
                      ...t,
                      suggestedAssignee: { id: match.id, name: match.name, role: match.role }
                    };
                  }
                }
                return t;
              });

              ws.send(JSON.stringify({
                type: 'task_suggestions',
                tasks: normalizedTasks,
                confidence: taskResult.confidence,
                conversationId,
                projectId
              }));
            }
          } catch (error) {
            console.error('Error extracting tasks from conversation:', error);
            // Don't fail the entire response if task extraction fails
          }

          if ((analysis.complexity === 'high' || selectedAgents.length > 1) && userMessage.content) {
            const graph = createTaskGraph({
              objective: userMessage.content,
            });

            await logAutonomyEvent({
              eventType: "task_graph_created",
              projectId,
              teamId: mode === "team" ? (contextId ?? null) : null,
              conversationId,
              hatchId: respondingAgent?.id || null,
              provider: llmMetadata?.provider || getCurrentRuntimeConfig().provider,
              mode: llmMetadata?.mode || getCurrentRuntimeConfig().mode,
              latencyMs: Date.now() - turnStartedAt,
              confidence: conductorResult.decision.confidence,
              riskScore: aggregateRisk,
              payload: {
                graphId: graph.graphId,
                taskCount: graph.tasks.length,
              },
            });

            ws.send(JSON.stringify({
              type: "task_graph_created",
              conversationId,
              graph,
            }));
          }

          if (decisionForecasts.length > 0) {
            ws.send(JSON.stringify({
              type: "decision_forecast",
              conversationId,
              forecasts: decisionForecasts,
            }));

            // Autopilot proposal remains approval-gated.
            const topForecast = [...decisionForecasts].sort((a, b) => b.probability - a.probability)[0];
            const riskLevel =
              conductorResult.safetyScore.executionRisk >= 0.65
                ? "high"
                : conductorResult.safetyScore.executionRisk >= 0.35
                  ? "medium"
                  : "low";

            const proposal = createActionProposal({
              projectId,
              source: "autopilot",
              actionType: "phase_step_recommendation",
              payload: {
                objective: userMessage.content,
                recommendedScenario: topForecast?.scenario || "Balanced execution path",
                mitigation: topForecast?.mitigation || [],
              },
              riskLevel,
            });

            await logAutonomyEvent({
              eventType: "proposal_created",
              projectId,
              teamId: mode === "team" ? (contextId ?? null) : null,
              conversationId,
              hatchId: respondingAgent?.id || null,
              provider: llmMetadata?.provider || getCurrentRuntimeConfig().provider,
              mode: llmMetadata?.mode || getCurrentRuntimeConfig().mode,
              latencyMs: Date.now() - turnStartedAt,
              confidence: conductorResult.decision.confidence,
              riskScore: conductorResult.safetyScore.executionRisk,
              payload: {
                proposalId: proposal.id,
                actionType: proposal.actionType,
                riskLevel: proposal.riskLevel,
              },
            });

            ws.send(JSON.stringify({
              type: "action_proposal_created",
              conversationId,
              proposal,
            }));
          }

          const roleIdentity = buildRoleIdentity({
            projectId,
            roleTemplateId: respondingAgent.role,
            agentId: respondingAgent.id === "system" ? undefined : respondingAgent.id,
          });
          recordLearningEvent({
            projectId,
            conversationId,
            roleIdentity,
            eventType: "turn",
            input: userMessage.content,
            output: accumulatedContent,
            reward: conductorResult.safetyScore.confidence,
          });

          // Chat-driven Project Brain auto-sync (manual edits still fully allowed)
          try {
            const chatPatch = deriveProjectBrainPatch({
              userMessage: userMessage.content || "",
              assistantResponse: accumulatedContent || "",
              existingProject: project as Project
            });

            if (chatPatch) {
              const mergedPatch: any = {};
              if (chatPatch.coreDirection) {
                mergedPatch.coreDirection = {
                  ...((project as any).coreDirection || {}),
                  ...chatPatch.coreDirection
                };
              }
              if (typeof chatPatch.executionRules === "string" && chatPatch.executionRules.trim().length > 0) {
                mergedPatch.executionRules = chatPatch.executionRules.trim();
              }
              if (typeof chatPatch.teamCulture === "string" && chatPatch.teamCulture.trim().length > 0) {
                mergedPatch.teamCulture = chatPatch.teamCulture.trim();
              }

              if (Object.keys(mergedPatch).length > 0) {
                const updatedProject = await storage.updateProject(projectId, mergedPatch);
                if (updatedProject) {
                  const updateEvent = {
                    type: "project_brain_updated",
                    conversationId,
                    projectId,
                    source: "chat_auto_sync",
                    patch: mergedPatch
                  };
                  ws.send(JSON.stringify(updateEvent));
                  broadcastToConversation(conversationId, updateEvent, { exclude: ws });
                }
              }
            }
          } catch (autoSyncError) {
            console.error("Failed to auto-sync project brain from chat:", autoSyncError);
          }

          // Notify streaming completed
          ws.send(JSON.stringify({
            type: 'streaming_completed',
            messageId: responseMessageId,
            message: savedResponse
          }));

          // Broadcast final message to other clients
          broadcastToConversation(conversationId, {
            type: 'new_message',
            message: savedResponse,
            conversationId
          }, { exclude: ws });

          // Send real-time metrics update for AI agent response
          broadcastToConversation(conversationId, {
            type: 'chat_message',
            projectId: parsed.projectId,
            teamId: parsed.scope === 'team' ? parsed.contextId : undefined,
            agentId: savedResponse.agentId,
            conversationId,
            data: {
              content: accumulatedContent,
              senderId: savedResponse.agentId || 'agent',
              messageId: savedResponse.id
            },
            timestamp: new Date().toISOString()
          }, { exclude: ws });
        }
      } finally {
        ws.off('message', cancelHandler);
      }

    } catch (error) {
      console.error('❌ Streaming response error:', error);
      const payload = getStreamingErrorPayload(error);
      try {
        const runtimeNow = getCurrentRuntimeConfig();
        const fallbackContent = buildServiceFallbackMessage({
          mode: resolvedMode,
          agentName: fallbackResponder?.name,
          userMessage: userMessage?.content || "",
          errorCode: payload.code,
        });

        let effectiveAgent = fallbackResponder;
        if ((!effectiveAgent || effectiveAgent.id === "system") && resolvedProjectId) {
          const projectAgents = await storage.getAgentsByProject(resolvedProjectId);
          const pmAgent = projectAgents.find((agent) => /product manager|^pm$/i.test(agent.role));
          const selected = pmAgent || projectAgents[0];
          if (selected) {
            effectiveAgent = {
              id: selected.id,
              name: selected.name,
              role: selected.role,
              teamId: selected.teamId
            };
          }
        }

        if (!hasStreamingStarted) {
          ws.send(JSON.stringify({
            type: 'streaming_started',
            messageId: responseMessageId,
            agentId: effectiveAgent?.id || 'system',
            agentName: effectiveAgent?.name || 'Project Manager'
          }));
        }

        ws.send(JSON.stringify({
          type: 'streaming_chunk',
          messageId: responseMessageId,
          chunk: fallbackContent,
          accumulatedContent: fallbackContent
        }));

        const persistedFallback = await storage.createMessage({
          id: responseMessageId,
          conversationId,
          agentId: effectiveAgent?.id || null,
          content: fallbackContent,
          messageType: (effectiveAgent ? 'agent' : 'system') as "agent" | "system",
          metadata: {
            fallback: {
              type: 'service',
              reason: payload.code
            },
            llm: llmMetadata || {
              provider: runtimeNow.provider,
              mode: runtimeNow.mode,
              model: runtimeNow.model,
            },
          }
        } as any);

        await logAutonomyEvent({
          eventType: "provider_fallback",
          projectId: resolvedProjectId,
          teamId: null,
          conversationId,
          hatchId: effectiveAgent?.id || null,
          provider: (llmMetadata?.provider || runtimeNow.provider) as string,
          mode: (llmMetadata?.mode || runtimeNow.mode) as string,
          latencyMs: Date.now() - turnStartedAt,
          confidence: null,
          riskScore: null,
          payload: {
            reason: payload.code,
            error: (error as any)?.message || "unknown",
          },
        });

        if (traceId) {
          await finalizeDeliberationTrace(traceId, fallbackContent);
        }

        // Keep project brain auto-sync active even when LLM falls back (quota/rate-limit/etc).
        if (resolvedProjectId) {
          try {
            const existingProject = await storage.getProject(resolvedProjectId);
            if (existingProject) {
              const chatPatch = deriveProjectBrainPatch({
                userMessage: userMessage?.content || "",
                assistantResponse: fallbackContent,
                existingProject: existingProject as Project
              });

              if (chatPatch) {
                const mergedPatch: any = {};
                if (chatPatch.coreDirection) {
                  mergedPatch.coreDirection = {
                    ...((existingProject as any).coreDirection || {}),
                    ...chatPatch.coreDirection
                  };
                }
                if (typeof chatPatch.executionRules === "string" && chatPatch.executionRules.trim().length > 0) {
                  mergedPatch.executionRules = chatPatch.executionRules.trim();
                }
                if (typeof chatPatch.teamCulture === "string" && chatPatch.teamCulture.trim().length > 0) {
                  mergedPatch.teamCulture = chatPatch.teamCulture.trim();
                }

                if (Object.keys(mergedPatch).length > 0) {
                  const updatedProject = await storage.updateProject(resolvedProjectId, mergedPatch);
                  if (updatedProject) {
                    const updateEvent = {
                      type: "project_brain_updated",
                      conversationId,
                      projectId: resolvedProjectId,
                      source: "chat_auto_sync",
                      patch: mergedPatch
                    };
                    ws.send(JSON.stringify(updateEvent));
                    broadcastToConversation(conversationId, updateEvent, { exclude: ws });
                  }
                }
              }
            }
          } catch (autoSyncError) {
            console.error("Failed to auto-sync project brain from fallback:", autoSyncError);
          }
        }

        ws.send(JSON.stringify({
          type: 'streaming_completed',
          messageId: responseMessageId,
          message: persistedFallback
        }));

        broadcastToConversation(conversationId, {
          type: 'new_message',
          message: persistedFallback,
          conversationId
        }, { exclude: ws });
      } catch (fallbackError) {
        console.error('❌ Fallback response persistence failed:', fallbackError);
        ws.send(JSON.stringify({
          type: 'streaming_error',
          code: payload.code,
          error: payload.error
        }));
      }
    }
  }

  // B3: Extract and store conversation memory from user messages
  async function extractAndStoreMemory(userMessage: any, agentResponse: any, conversationId: string, projectId: string) {
    try {
      const userContent = userMessage.content.toLowerCase();

      // Extract key decisions and important context
      if (userContent.includes('decide') || userContent.includes('decision') || userContent.includes('choose')) {
        await storage.addConversationMemory(
          conversationId,
          'decisions',
          `User decision: ${userMessage.content}`,
          8
        );
      }

      // Extract project requirements or specifications
      if (userContent.includes('requirement') || userContent.includes('spec') || userContent.includes('need')) {
        await storage.addConversationMemory(
          conversationId,
          'key_points',
          `Project requirement: ${userMessage.content}`,
          7
        );
      }

      // Extract goals and objectives
      if (userContent.includes('goal') || userContent.includes('objective') || userContent.includes('target')) {
        await storage.addConversationMemory(
          conversationId,
          'key_points',
          `Project goal: ${userMessage.content}`,
          9
        );
      }

      // Extract important agent insights from responses
      const agentContent = agentResponse.content.toLowerCase();
      if (agentContent.includes('recommend') || agentContent.includes('suggest') || agentContent.includes('propose')) {
        await storage.addConversationMemory(
          conversationId,
          'context',
          `Agent recommendation: ${agentResponse.content.substring(0, 200)}...`,
          6
        );
      }

      devLog('🧠 Memory extraction completed for conversation:', conversationId);
    } catch (error) {
      console.error('❌ Error extracting memory:', error);
    }
  }

  // Extract user name from messages
  async function extractUserName(content: string, conversationId: string) {
    try {
      const lowerContent = content.toLowerCase();

      // Look for "my name is [name]" patterns
      const namePatterns = [
        /my name is ([a-zA-Z]+)/i,
        /i am ([a-zA-Z]+)/i,
        /call me ([a-zA-Z]+)/i,
        /i'm ([a-zA-Z]+)/i
      ];

      for (const pattern of namePatterns) {
        const match = content.match(pattern);
        if (match && match[1]) {
          const userName = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
          await storage.addConversationMemory(
            conversationId,
            'context',
            `User's name is ${userName}`,
            10 // Very high importance
          );
          devLog(`👤 User name extracted and stored: ${userName}`);
          break;
        }
      }
    } catch (error) {
      console.error('❌ Error extracting user name:', error);
    }
  }


  // Task Management Endpoints
  app.get("/api/tasks", async (req, res) => {
    try {
      const { projectId } = req.query;
      if (!projectId) {
        return res.status(400).json({ error: "Project ID is required" });
      }

      const tasks = await storage.getTasksByProject(projectId as string);
      res.json(tasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  app.post("/api/tasks", async (req, res) => {
    try {
      const validatedTask = insertTaskSchema.parse(req.body);
      const newTask = {
        ...validatedTask,
        id: crypto.randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: null
      } as Task;
      const created = await storage.createTask(newTask);
      res.status(201).json(created);
    } catch (error) {
      console.error('Error creating task:', error);
      res.status(400).json({ error: "Failed to create task" });
    }
  });

  // Auto task extraction endpoint
  app.post("/api/tasks/extract", async (req, res) => {
    try {
      const { userMessage, agentResponse, projectContext } = req.body;

      if (!userMessage || !agentResponse) {
        return res.status(400).json({ error: "User message and agent response are required" });
      }

      // Import task extractor
      const { extractTasksFromMessage, extractTasksFallback } = await import('./ai/taskExtractor.js');

      // Try AI extraction first
      let result = await extractTasksFromMessage(userMessage, agentResponse, projectContext);

      // Fallback to keyword matching if AI extraction fails
      if (!result.hasTasks && result.confidence < 0.5) {
        result = extractTasksFallback(userMessage, agentResponse, projectContext.availableAgents);
      }

      res.json(result);
    } catch (error) {
      console.error('Error extracting tasks from conversation:', error);
      res.status(500).json({ error: "Failed to extract tasks" });
    }
  });

  // Task Suggestion Endpoints
  app.post("/api/task-suggestions/analyze", async (req, res) => {
    try {
      const { conversationId, projectId, teamId, agentId, messages: providedMessages } = req.body;

      // Get conversation messages
      const messages = (providedMessages && Array.isArray(providedMessages) && providedMessages.length > 0)
        ? providedMessages
        : await storage.getMessagesByConversation(conversationId);
      if (!messages || messages.length === 0) {
        return res.json({ suggestions: [] });
      }

      // Check if we should analyze this conversation
      const analyzedMessages = messages.map(m => ({
        role: m.messageType === 'user' ? 'user' : 'assistant',
        content: typeof m.content === 'string' ? m.content : '',
        timestamp: new Date(m.createdAt)
      }));
      const shouldAnalyze = await TaskDetectionAI.shouldAnalyzeConversation(analyzedMessages);
      if (!shouldAnalyze) {
        return res.json({ suggestions: [] });
      }

      // Get available agents for the project
      const agents = await storage.getAgents();
      const projectAgents = agents.filter(agent =>
        agent.projectId === projectId ||
        (teamId && agent.teamId === teamId)
      );

      // Create conversation context with proper role mapping
      const context: ConversationContext = {
        messages: messages.map(msg => {
          // Map messageType to role correctly
          let role: 'user' | 'assistant' | 'system' = 'assistant';
          if (msg.messageType === 'user') {
            role = 'user';
          } else if (msg.messageType === 'agent') {
            role = 'assistant';
          }

          const safeContent = typeof msg.content === 'string' ? msg.content : '';

          devLog('🔍 Message mapping:', {
            messageType: msg.messageType,
            role,
            content: safeContent.substring(0, 50) + '...'
          });

          return {
            role,
            content: safeContent,
            timestamp: new Date(msg.createdAt)
          };
        }),
        projectId,
        teamId,
        agentId,
        availableAgents: projectAgents.map(agent => ({
          id: agent.id,
          name: agent.name,
          role: agent.role,
          expertise: typeof agent.personality === 'object' && agent.personality ? (agent.personality as any).expertise || [] : []
        }))
      };

      // Analyze conversation for task suggestions
      const suggestions = await TaskDetectionAI.analyzeConversationForTasks(context);

      res.json({ suggestions });
    } catch (error) {
      console.error('Error analyzing conversation for tasks:', error);
      res.status(500).json({ error: "Failed to analyze conversation for tasks" });
    }
  });

  app.post("/api/task-suggestions/approve", async (req, res) => {
    try {
      const { approvedTasks, projectId } = req.body;
      if (!projectId || typeof projectId !== 'string') {
        return res.status(400).json({ error: "projectId is required" });
      }

      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      if (!Array.isArray(approvedTasks)) {
        return res.status(400).json({ error: "approvedTasks must be an array" });
      }

      // Create tasks in the database
      const createdTasks: Task[] = [];
      for (const task of approvedTasks) {
        let assigneeId = task?.suggestedAssignee?.id;
        // Fallback: if only role string provided, resolve to an agent id in this project
        if (!assigneeId && typeof task?.suggestedAssignee === 'string') {
          const agents = await storage.getAgentsByProject(projectId);
          const match = agents.find(a => a.role === task.suggestedAssignee);
          assigneeId = match?.id;
        }

        const newTaskRaw = {
          id: randomUUID(),
          title: task.title,
          description: task.description || "",
          priority: task.priority || "medium",
          status: 'todo',
          assignee: task.suggestedAssignee && typeof task.suggestedAssignee === 'string'
            ? task.suggestedAssignee
            : task.suggestedAssignee?.name || null,
          projectId: projectId,
          teamId: task.teamId || null,
          parentTaskId: null,
          tags: [],
          metadata: { createdFromChat: true }
        };

        // Validate via Zod
        const validatedTask = insertTaskSchema.parse(newTaskRaw) as any;

        // Store task
        await storage.createTask(validatedTask);
        createdTasks.push(validatedTask);
      }

      // Broadcast task creation to all connected clients
      if (wss) {
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'task_created',
              data: { tasks: createdTasks, projectId }
            }));
          }
        });
      }

      res.json({
        success: true,
        createdTasks,
        message: `Successfully created ${createdTasks.length} tasks`
      });
    } catch (error) {
      console.error('Error creating approved tasks:', error);
      res.status(500).json({ error: "Failed to create approved tasks" });
    }
  });

  // Task Mutators
  app.put("/api/tasks/:id", async (req, res) => {
    try {
      const updatedTask = await storage.updateTask(req.params.id, req.body);
      res.json(updatedTask);
    } catch (error) {
      console.error("Failed to update task:", error);
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  app.delete("/api/tasks/:id", async (req, res) => {
    try {
      await storage.deleteTask(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete task:", error);
      res.status(500).json({ error: "Failed to delete task" });
    }
  });

  return httpServer;
}
