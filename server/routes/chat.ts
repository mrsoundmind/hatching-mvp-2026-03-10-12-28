import type { Express, Request } from "express";
import { type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "../storage.js";
import { insertMessageSchema, type Project } from "@shared/schema.js";
import { parseConversationId } from "@shared/conversationId.js";
import { wsClientMessageSchema } from "@shared/dto/wsSchemas.js";
import { randomUUID } from "crypto";
import { z } from "zod";
import { OpenAIConfigurationError, generateIntelligentResponse, generateStreamingResponse } from "../ai/openaiService.js";
import { getCharacterProfile } from "../ai/characterProfiles.js";
import { parseAction, stripActionBlocks, detectUserPermission } from "../ai/actionParser.js";
import { resolveMentionedAgent } from "../ai/mentionParser.js";
import { applyTeammateToneGuard } from "../ai/responsePostProcessing.js";
import { personalityEngine } from "../ai/personalityEvolution.js";
import { evaluateConductorDecision, buildRoleIdentity } from "../ai/conductor.js";
import { evaluateSafetyScore, buildClarificationIntervention } from "../ai/safety.js";
import { buildDecisionForecast, isStrategicTurn } from "../ai/forecast.js";
import {
  createActionProposal,
  recordLearningEvent,
} from "../ai/autonomyStore.js";
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
} from "../ai/expertiseMatching.js";
import { resolveSpeakingAuthority } from "../orchestration/resolveSpeakingAuthority.js";
import { generateReturnBriefing } from "../ai/returnBriefing.js";
import { validateMessageIngress } from "../schemas/messageIngress.js";
import { filterAvailableAgents, type ScopeContext } from "../orchestration/agentAvailability.js";
import { assertPhase1Invariants } from "../invariants/assertPhase1.js";
import {
  getCurrentRuntimeConfig,
  generateChatWithRuntimeFallback,
} from "../llm/providerResolver.js";
import { writeConfigSnapshot } from "../utils/configSnapshot.js";
import { checkConversationAccess } from "../utils/conversationAccess.js";
import { logAutonomyEvent } from "../autonomy/events/eventLogger.js";
import {
  appendDeliberationRound,
  createDeliberationTrace,
  finalizeDeliberationTrace,
} from "../autonomy/traces/traceStore.js";
import {
  assertConversationOrdering,
  assertUniqueMessageId,
  checkIdempotencyKey,
  ensureMessageId,
} from "../autonomy/integrity/conversationIntegrity.js";
import { runPeerReview } from "../autonomy/peerReview/peerReviewRunner.js";
import { runAutonomousKnowledgeLoop } from "../knowledge/akl/runner.js";
import { resolveDecisionConflict } from "../autonomy/conductor/decisionAuthority.js";
import { routeTools } from "../tools/toolRouter.js";
import { createTaskGraph } from "../autonomy/taskGraph/taskGraphEngine.js";
import { BUDGETS, FEATURE_FLAGS } from "../autonomy/config/policies.js";
import { resolveAutonomyTrigger } from "../autonomy/triggers/autonomyTriggerResolver.js";
import { queueTaskExecution } from "../autonomy/execution/jobQueue.js";
import { classifyTaskIntent } from "../ai/tasks/intentClassifier.js";
import { extractDueDate, extractPriority, checkRateLimit } from "../ai/tasks/taskCreator.js";
import { checkForDuplicate } from "../ai/tasks/duplicateDetector.js";
import { executeLifecycleCommand, type LifecycleContext } from "../ai/tasks/taskLifecycle.js";
import { detectCompletionSignal } from "../ai/tasks/completionDetector.js";
import { extractOrganicTasks } from "../ai/tasks/organicExtractor.js";
import { detectDeliverableIntent } from "../ai/deliverableDetector.js";
import { compactConversation, getCompactedContext } from "../ai/conversationCompactor.js";
import { recordUsage } from "../billing/usageTracker.js";
import { checkAutonomyAccess, checkMessageSafetyCap } from "../middleware/tierGate.js";

// ═══════════════════════════════════════════════════════════════
// SECTION 1: Autonomy Trigger Detection (~lines 76-136)
// Pre-check for background autonomy execution based on user messages.
// ═══════════════════════════════════════════════════════════════
async function checkForAutonomyTrigger(
  userMessage: string,
  projectId: string,
  conversationId: string,
  stor: any,
  broadcastFn: (convId: string, payload: unknown) => void,
): Promise<void> {
  if (!FEATURE_FLAGS.backgroundExecution) return;
  try {
    // Billing: check if user's tier allows autonomy
    const project = await stor.getProject(projectId);
    if (!project) return;
    if (project.userId) {
      const canAutomate = await checkAutonomyAccess(project.userId);
      if (!canAutomate) return;
    }

    // Phase 22: Removed pre-queue budget check. The atomic ledger inside
    // handleTaskJob (taskExecutionPipeline.ts) is now the only budget authority.
    // The previous check-then-act pattern here was racy and redundant — see
    // .planning/phases/22-atomic-budget-enforcement/22-RESEARCH.md Pattern 5.

    const tasks = await stor.getTasksByProject(projectId);
    const trigger = resolveAutonomyTrigger({
      userMessage,
      lastUserActivityAt: new Date(),
      pendingTasks: tasks.map((t: any) => ({ id: t.id, status: t.status })),
      autonomyEnabled: project.executionRules?.autonomyEnabled ?? false,
    });

    if (!trigger.shouldExecute) return;

    broadcastFn(conversationId, {
      type: 'background_execution_started',
      projectId,
      taskCount: trigger.tasksToExecute.length,
    });

    const agents = await stor.getAgentsByProject(projectId);
    for (const taskId of trigger.tasksToExecute) {
      const task = tasks.find((t: any) => t.id === taskId);
      if (!task) continue;
      const agent = task.assignee
        ? agents.find((a: any) => a.role === task.assignee || a.name === task.assignee)
        : agents[0];
      if (!agent) continue;
      await queueTaskExecution({ taskId, projectId, agentId: agent.id });
    }
  } catch (err) {
    console.error('[chat.ts] checkForAutonomyTrigger error:', (err as Error).message);
  }
}

type AuthedWebSocket = WebSocket & { __userId?: string };

export interface RegisterChatDeps {
  sessionParser?: (req: any, res: any, next: (err?: unknown) => void) => void;
  onBroadcastReady: (fns: {
    broadcastToConversation: (conversationId: string, data: unknown) => void;
    broadcastToProject: (projectId: string, data: unknown) => void;
  }) => void;
}

// ═══════════════════════════════════════════════════════════════
// SECTION 2: Chat Route Registration & Utility Helpers (~lines 142-375)
// Error payloads, fallback messages, brain patch derivation,
// ownership helpers, REST endpoints.
// ═══════════════════════════════════════════════════════════════
export function registerChatRoutes(
  app: Express,
  httpServer: Server,
  deps: RegisterChatDeps
): { getWsHealth: () => { status: "ok" | "degraded" | "down"; connections: number } } {
  const { sessionParser, onBroadcastReady } = deps;

  const devLog = (...args: any[]) => {
    if (process.env.NODE_ENV !== "production") {
      console.log(...args);
    }
  };

  const isProd = process.env.NODE_ENV === "production";

  const getOwnedProjectIds = async (userId: string): Promise<Set<string>> => {
    const projects = await storage.getProjectsByUserId(userId);
    return new Set(projects.map((project) => project.id));
  };

  const conversationOwnedByUser = async (conversationId: string, userId: string): Promise<boolean> => {
    const ownedProjectIds = await getOwnedProjectIds(userId);
    return checkConversationAccess(conversationId, ownedProjectIds, (pid) =>
      storage.getConversationsByProject(pid)
    );
  };

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
      console.error("[sendWsError] Failed to send error response:", sendError);
    }
  }

  function getStreamingErrorPayload(error: any): { code: string; error: string } {
    if (error instanceof OpenAIConfigurationError || error?.code === "OPENAI_API_KEY_MISSING") {
      return {
        code: "OPENAI_NOT_CONFIGURED",
        error: "Hmm, I couldn't connect to my brain for a second there. Give it another try?"
      };
    }

    const status = Number(error?.status || error?.statusCode || error?.response?.status || 0);
    const apiCode = typeof error?.code === "string" ? error.code.toLowerCase() : "";
    const message = typeof error?.message === "string" ? error.message.toLowerCase() : "";

    if (status === 401 || apiCode.includes("invalid_api_key") || message.includes("invalid api key")) {
      return {
        code: "OPENAI_AUTH_FAILED",
        error: "Something's off on my end. Try again in a moment - I'll be right here."
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
        error: "We're getting a lot of traffic right now - give me a minute and try again."
      };
    }

    if (
      status === 404 ||
      apiCode.includes("model_not_found") ||
      (message.includes("model") && message.includes("not found"))
    ) {
      return {
        code: "OPENAI_MODEL_UNAVAILABLE",
        error: "My thinking engine is temporarily offline. Try again in a sec."
      };
    }

    return {
      code: "STREAMING_GENERATION_FAILED",
      error: "I started a reply but it didn't come through. Mind sending that again?"
    };
  }

  function buildServiceFallbackMessage(params: {
    mode: "project" | "team" | "agent";
    agentName?: string;
    agentRole?: string;
    userMessage: string;
    errorCode: string;
  }): string {
    const defaultRole = "Product Manager";
    const roleFallback = params.agentRole && params.agentRole.trim() !== "" ? params.agentRole : defaultRole;
    const displayRole = roleFallback;

    const fallbacks = [
      `Hey there! Your ${displayRole} is currently out for lunch. 🥪 I'll be back in just a few to respond to your message!`,
      `Looks like your ${displayRole} took a quick break to stretch their digital legs and go for a walk. 🚶‍♂️ Give me a minute and I'll be right back with you!`,
      `Quick heads up — your ${displayRole} is resting their circuits for a minute. 🔋 I'll review "${params.userMessage.slice(0, 20)}..." as soon as I'm back online!`,
      `Your ${displayRole} is currently having a little 'think session' over coffee. ☕ I'll be back awake and ready to dive in in just a few seconds.`
    ];

    const randomFallback = fallbacks[Math.floor(Math.random() * fallbacks.length)];

    if (params.mode === "team") {
      return `Team update: Your lead is taking a quick breather. 🌿 We're almost ready to keep going, just give us a minute to sync back up!`;
    }

    return randomFallback;
  }

  function deriveProjectBrainPatch(params: {
    userMessage: string;
    assistantResponse: string;
    existingProject: Project;
  }): {
    coreDirection?: { whatBuilding?: string; whyMatters?: string; whoFor?: string };
    executionRules?: { autonomyEnabled?: boolean; rules?: string; taskGraph?: unknown };
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
      executionRules?: { autonomyEnabled?: boolean; rules?: string; taskGraph?: unknown };
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
      patch.executionRules = { rules: explicitRules };
    }

    if (explicitCulture) {
      patch.teamCulture = explicitCulture;
    }

    return Object.keys(patch).length > 0 ? patch : null;
  }

  // Hatch chat endpoint (non-streaming fallback)
  app.post("/api/hatch/chat", async (req, res) => {
    try {
      const { user = "", history = [] } = req.body || {};
      const context = {
        mode: 'project' as const,
        projectName: 'Chat',
        agentRole: 'Product Manager',
        conversationHistory: (history || []).map((m: any) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content || '',
          timestamp: new Date().toISOString(),
        })),
        userId: (req.session as any).userId || 'anonymous',
      };

      const ai = await generateIntelligentResponse(user || 'Hello', 'Product Manager', context);

      return res.json({
        messages: [...(history || []), { role: 'assistant', content: ai.content }],
        reply: ai.content,
        metadata: ai.metadata,
      });
    } catch (error) {
      console.error("Hatch chat error:", error);
      res.status(500).json({ error: "Failed to process chat" });
    }
  });

  // WebSocket Server Setup
  // ═══════════════════════════════════════════════════════════════
  // SECTION 3: WebSocket Server Setup & Connection Lifecycle (~lines 384-1086)
  // WS server creation, session binding, connection/disconnection,
  // message dispatch (join, send_message_streaming, cancel, typing).
  // ═══════════════════════════════════════════════════════════════
  // Use manual upgrade routing so non-/ws upgrades (for example Vite HMR)
  // can pass through to other listeners instead of being rejected with 400.
  const wss = new WebSocketServer({ noServer: true });
  httpServer.on("upgrade", (req, socket, head) => {
    if (!req.url?.startsWith("/ws")) {
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  const applySessionToWsRequest = async (req: any): Promise<void> => {
    if (!sessionParser) return;
    await new Promise<void>((resolve, reject) => {
      const responseMock = {
        getHeader: () => undefined,
        setHeader: () => undefined,
        writeHead: () => undefined,
        end: () => undefined,
      };
      sessionParser(req, responseMock as any, (err?: unknown) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  };

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

  const getWsHealth = () => {
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
    const existingConversations = await storage.getConversationsByProject(params.projectId);
    const existing = existingConversations.find(conv => conv.id === params.conversationId);

    if (existing) {
      if (process.env.NODE_ENV === 'development' || process.env.DEV) {
        devLog(`[ConversationBootstrap] Conversation already exists: ${params.conversationId}`);
      }
      return existing;
    }

    const newConversation = await storage.createConversation({
      id: params.conversationId,
      projectId: params.projectId,
      teamId: params.teamId ?? null,
      agentId: params.agentId ?? null,
      type: params.type === 'agent' ? 'hatch' : params.type,
      title: null
    } as any);

    devLog(`[ConversationBootstrap] Created new canonical conversation: ${params.conversationId}`);
    return newConversation;
  };

  wss.on('connection', async (rawWs: WebSocket, req) => {
    const ws = rawWs as AuthedWebSocket;
    const pendingMessages: Buffer[] = [];
    const queueMessage = (rawMessage: Buffer) => {
      pendingMessages.push(rawMessage);
    };
    ws.on('message', queueMessage);

    try {
      await applySessionToWsRequest(req as any);
    } catch (error) {
      console.error('❌ WebSocket session parse failed:', error);
      sendWsError(ws, {
        code: "UNAUTHORIZED",
        message: "Authentication required.",
      });
      ws.close(4401, 'Unauthorized');
      return;
    }

    const socketUserId = (req as any)?.session?.userId as string | undefined;
    if (!socketUserId) {
      sendWsError(ws, {
        code: "UNAUTHORIZED",
        message: "Authentication required.",
      });
      ws.close(4401, 'Unauthorized');
      return;
    }
    ws.__userId = socketUserId;
    devLog('New WebSocket connection established');

    const handleWsMessage = async (rawMessage: Buffer) => {
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

            const canAccessConversation = await conversationOwnedByUser(conversationId.trim(), ws.__userId!);
            if (!canAccessConversation) {
              sendWsError(ws, {
                code: "FORBIDDEN",
                message: "Conversation not accessible.",
              });
              break;
            }

            // Bootstrap conversation if it doesn't exist in DB yet (e.g. pre-migration projects)
            try {
              const parsed = parseConversationId(conversationId.trim());
              await ensureConversationExists({
                conversationId: conversationId.trim(),
                projectId: parsed.projectId,
                teamId: (parsed as any).teamId ?? null,
                agentId: (parsed as any).agentId ?? null,
                type: (parsed as any).type ?? 'project',
              });
            } catch { /* non-critical */ }

            if (!activeConnections.has(conversationId)) {
              activeConnections.set(conversationId, new Set());
            }
            activeConnections.get(conversationId)!.add(ws);
            ws.send(JSON.stringify({
              type: 'connection_confirmed',
              conversationId
            }));

            // UX-03: Maya return briefing — DB-backed 15-min threshold with idempotency
            if (conversationId.startsWith('project:')) {
              try {
                const parsed = parseConversationId(conversationId.trim());
                const projId = (parsed as any).projectId;
                if (projId && ws.__userId) {
                  const ABSENCE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
                  const { lastSeenAt, lastBriefedAt } = await storage.getProjectTimestamps(projId);
                  const now = new Date();

                  // Update lastSeenAt on every join (tracks presence)
                  await storage.setProjectLastSeenAt(projId, now);

                  // Only brief if user was absent for 15+ minutes
                  if (lastSeenAt && (now.getTime() - lastSeenAt.getTime()) >= ABSENCE_THRESHOLD_MS) {
                    const briefing = await generateReturnBriefing({
                      projectId: projId,
                      userId: ws.__userId,
                      lastBriefedAt,    // null-safe: returnBriefing handles null by using epoch
                      storage,
                      broadcastToConversation,
                      generateText: async (prompt: string, system: string) => {
                        const result = await generateChatWithRuntimeFallback({
                          messages: [
                            { role: 'system', content: system },
                            { role: 'user', content: prompt },
                          ],
                          temperature: 0.7,
                        });
                        return result.content;
                      },
                    });

                    if (briefing.hasBriefing) {
                      // Update lastBriefedAt to prevent re-triggering in this absence session
                      await storage.setProjectLastBriefedAt(projId, now);
                    }
                  }
                }
              } catch {
                // Non-critical — briefing is best-effort
              }
            }

            // P2: Auto-send welcome message for agent conversations with no messages yet
            if (conversationId.trim().startsWith('agent:')) {
              try {
                const parsed = parseConversationId(conversationId.trim());
                const agentId = (parsed as any).agentId;
                if (agentId) {
                  const existingMsgs = await storage.getMessagesByConversation(conversationId.trim(), { limit: 1 });
                  if (existingMsgs.length === 0) {
                    const agent = await storage.getAgent(agentId);
                    if (agent) {
                      const personality = agent.personality as Record<string, unknown> | null;
                      const welcomeText = (personality?.welcomeMessage as string | undefined) ||
                        `Hey — I'm ${agent.name}, your ${agent.role}. What are we working on?`;
                      const welcomeMsg = await storage.createMessage({
                        id: randomUUID(),
                        conversationId: conversationId.trim(),
                        content: welcomeText,
                        messageType: 'agent',
                        agentId: agent.id,
                        userId: null,
                        metadata: { isWelcome: true },
                      } as any);
                      broadcastToConversation(conversationId.trim(), {
                        type: 'new_message',
                        conversationId: conversationId.trim(),
                        message: welcomeMsg,
                      });
                    }
                  }
                }
              } catch { /* non-critical — join still works if welcome fails */ }
            }

            // Seed personality profile from DB so learning survives server restart.
            if (conversationId.trim().startsWith('agent:') && ws.__userId) {
              try {
                const parsed = parseConversationId(conversationId.trim());
                const seedAgentId = (parsed as any).agentId;
                if (seedAgentId) {
                  const seedAgent = await storage.getAgent(seedAgentId);
                  const persisted = (seedAgent?.personality as any);
                  const uid = ws.__userId;
                  if (persisted?.adaptedTraits?.[uid] && persisted?.adaptationMeta?.[uid]) {
                    personalityEngine.seedProfileFromDB(
                      seedAgentId, uid,
                      persisted.adaptedTraits[uid],
                      persisted.adaptationMeta[uid],
                      seedAgent?.role
                    );
                  }
                }
              } catch { /* non-critical */ }
            }
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

            // P1-8: Re-verify conversation ownership on every message (not just join).
            // Prevents sending messages after project deletion/transfer.
            {
              const canSendToConversation = await conversationOwnedByUser(envelope.conversationId, ws.__userId!);
              if (!canSendToConversation) {
                sendWsError(ws, {
                  code: "FORBIDDEN",
                  message: "Conversation not accessible.",
                });
                break;
              }
            }

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
            await ensureConversationExists({
              conversationId: envelope.conversationId,
              projectId: validatedProjectId,
              teamId: validatedMode === 'team' ? validatedContextId : null,
              agentId: validatedMode === 'agent' ? validatedContextId : null,
              type: validatedMode
            });

            // Save initial user message
            // Phase 1.2: Resolve actual userId from session if client sends generic placeholder
            const sessionUserId = ws.__userId;
            const canAccessStreamingConversation = await conversationOwnedByUser(envelope.conversationId, sessionUserId!);
            if (!canAccessStreamingConversation) {
              sendWsError(ws, {
                code: "FORBIDDEN",
                message: "Conversation not accessible.",
              });
              break;
            }
            // Invisible safety cap — no counter shown, only blocks at abuse-level volumes.
            if (sessionUserId) {
              const safetyCap = await checkMessageSafetyCap(sessionUserId);
              if (!safetyCap.allowed) {
                const msg = safetyCap.reason === 'rate_limit'
                  ? 'You\'re sending messages too fast — take a breath and try again in a moment.'
                  : 'You\'ve had an incredibly productive day! Come back tomorrow, or upgrade to Pro for higher limits.';
                ws.send(JSON.stringify({
                  type: 'upgrade_required',
                  reason: safetyCap.reason === 'rate_limit' ? 'rate_limit' : 'daily_cap',
                  message: msg,
                  upgradeUrl: safetyCap.tier === 'free' ? '/api/billing/checkout' : undefined,
                }));
                break;
              }
            }

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

            // Early explicit task detection (runs BEFORE streaming — zero LLM cost)
            // This catches TODO:/task:/action item: patterns immediately, regardless of streaming outcome.
            try {
              const earlyAgents = await storage.getAgentsByProject(validatedProjectId);
              const earlyAgentList = earlyAgents.map(a => ({ id: a.id, name: a.name, role: a.role }));
              const earlyIntent = classifyTaskIntent(savedUserMessage.content, {
                availableAgents: earlyAgentList,
                conversationDepth: 999, // Skip depth guard for explicit patterns
              });
              devLog('[TaskDetection:Early] Intent:', earlyIntent.type, 'msg:', savedUserMessage.content.substring(0, 80));

              if (earlyIntent.type === 'EXPLICIT_TASK_REQUEST') {
                const earlyUserId = (ws as any).__userId || 'anonymous';
                const earlyRateCheck = checkRateLimit(earlyUserId);
                if (earlyRateCheck.allowed) {
                  const existingTasks = await storage.getTasksByProject(validatedProjectId);
                  const dupCheck = checkForDuplicate(earlyIntent.taskDescription, existingTasks as any);
                  if (!dupCheck.isDuplicate) {
                    const dueDate = extractDueDate(savedUserMessage.content);
                    const priority = extractPriority(savedUserMessage.content) || 'medium';
                    const allTaskDescs = [earlyIntent.taskDescription, ...(earlyIntent.additionalTasks || [])];
                    const tasks = allTaskDescs.map(desc => ({
                      title: desc,
                      priority,
                      dueDate: dueDate ? dueDate.toISOString() : null,
                    }));
                    devLog('[TaskDetection:Early] Emitting task_suggestions:', tasks.length, 'tasks');
                    ws.send(JSON.stringify({
                      type: 'task_suggestions',
                      tasks,
                      confidence: 0.9,
                      conversationId: envelope.conversationId,
                      projectId: validatedProjectId,
                    }));
                  }
                }
              }
            } catch (earlyTaskErr) {
              devLog('[TaskDetection:Early] Error (non-critical):', earlyTaskErr);
            }

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
                error: "I'm still finishing an earlier reply. Please retry in a few seconds."
              }));
              break;
            }

            // Mark as actively streaming
            activeStreamingResponses.add(envelope.conversationId);

            // P2: Emit server-calculated typing indicator (scaled to message complexity)
            {
              const wordCount = (envelope.message?.content || '').split(/\s+/).filter(Boolean).length;
              const typingMs = Math.min(Math.max(wordCount * 80, 1200), 4000);
              broadcastToConversation(envelope.conversationId, {
                type: 'typing_started',
                agentId: addressedAgentId || null,
                estimatedDuration: typingMs,
              });
            }

            try {
              const hardTimeoutMs = Number(process.env.HARD_RESPONSE_TIMEOUT_MS || 45000) + 15000; // 60s total safety net
              await Promise.race([
                handleStreamingColleagueResponse(
                  savedUserMessage,
                  envelope.conversationId,
                  ws,
                  {
                    mode: validatedMode,
                    projectId: validatedProjectId,
                    contextId: validatedContextId || null,
                    addressedAgentId,
                  }
                ),
                new Promise<never>((_, reject) =>
                  setTimeout(() => reject(new Error('STREAMING_HARD_TIMEOUT')), hardTimeoutMs)
                ),
              ]);
            } catch (error) {
              console.error('❌ Streaming response error:', error);
              // Abort LLM stream if still running after timeout
              const abortCtrl = (ws as any).__currentAbortController as AbortController | undefined;
              if (abortCtrl && !abortCtrl.signal.aborted) {
                abortCtrl.abort();
              }
              // BUG-03: clear client thinking indicator before sending error
              broadcastToConversation(envelope.conversationId, {
                type: 'typing_stopped',
                agentId: addressedAgentId || null,
              });
              const payload = getStreamingErrorPayload(error);
              ws.send(JSON.stringify({
                type: 'streaming_error',
                messageId,
                code: payload.code,
                error: payload.error
              }));
            } finally {
              // Remove from active streaming — must always clear both locks
              activeStreamingResponses.delete(envelope.conversationId);
              streamingConversations.delete(envelope.conversationId);
            }
            break;

          case 'cancel_streaming':
            // B1.3: Handle streaming cancellation
            {
              const cancelConvId = data.conversationId;
              // Abort the active LLM stream if running
              const abortCtrl = (ws as any).__currentAbortController as AbortController | undefined;
              if (abortCtrl && !abortCtrl.signal.aborted) {
                devLog('🛑 Aborting LLM stream via cancel_streaming');
                abortCtrl.abort();
              }
              // Release streaming locks so subsequent messages aren't blocked
              if (cancelConvId) {
                activeStreamingResponses.delete(cancelConvId);
                streamingConversations.delete(cancelConvId);
              }
              ws.send(JSON.stringify({
                type: 'streaming_cancelled',
                messageId: data.messageId
              }));
            }
            break;

          case 'send_message':
            // Phase 1.2: Resolve actual userId from session if client sends generic placeholder
            const msgSessionId = ws.__userId;
            const canAccessSendConversation = await conversationOwnedByUser(data.conversationId, msgSessionId!);
            if (!canAccessSendConversation) {
              sendWsError(ws, {
                code: "FORBIDDEN",
                message: "Conversation not accessible.",
              });
              break;
            }
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
    };

    ws.off('message', queueMessage);
    ws.on('message', (rawMessage: Buffer) => {
      void handleWsMessage(rawMessage);
    });

    if (pendingMessages.length > 0) {
      for (const queuedMessage of pendingMessages.splice(0)) {
        await handleWsMessage(queuedMessage);
      }
    }

    ws.on('close', () => {
      // Abort any in-progress LLM stream to stop wasting tokens
      const activeAbort = (ws as any).__currentAbortController as AbortController | undefined;
      if (activeAbort && !activeAbort.signal.aborted) {
        devLog('🛑 Aborting LLM stream due to WS disconnect');
        activeAbort.abort();
      }
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

  // ═══════════════════════════════════════════════════════════════
  // SECTION 4: Broadcasting & Multi-Agent Response (~lines 1088-1370)
  // Broadcast helpers, multi-agent orchestration, team consensus.
  // ═══════════════════════════════════════════════════════════════

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

  // Expose broadcast to other server modules (e.g. background autonomy runner)
  // Broadcast to all conversations belonging to a given project
  function broadcastToProject(projectId: string, data: unknown) {
    const payload = JSON.stringify(data);
    for (const [conversationId, connections] of activeConnections.entries()) {
      let parsed: { projectId: string } | null = null;
      try { parsed = parseConversationId(conversationId); } catch { parsed = null; }
      if (!parsed || parsed.projectId !== projectId) continue;
      connections.forEach((connection) => {
        if (connection.readyState === WebSocket.OPEN) {
          connection.send(payload);
        }
      });
    }
  }

  // Expose broadcast functions to routes.ts via callback so it can set _globalBroadcast
  // and pass them to project/task route modules
  onBroadcastReady({ broadcastToConversation, broadcastToProject });

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

        // Notify client which agent is currently thinking (separate event, not a chunk)
        ws.send(JSON.stringify({
          type: 'agent_thinking',
          messageId: responseMessageId,
          agentId: agent.id,
          agentName: agent.name,
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

  // ═══════════════════════════════════════════════════════════════
  // SECTION 5: Streaming AI Response Pipeline (~lines 1377-3170)
  // Core streaming handler: agent routing, LLM call, safety scoring,
  // peer review, action parsing, brain updates, task detection,
  // deliverable detection, autonomy triggers, usage tracking.
  // ═══════════════════════════════════════════════════════════════

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
    // Hoisted for persistence rescue: if streaming completes but post-processing throws
    // (e.g. WS disconnect during peer review), we still need to persist the response.
    let _lastAccumulatedContent = '';
    let _responsePersisted = false;
    let _respondingAgentForRescue: any = null;
    // BUG-04: hoisted so the catch handler can check abortController.signal.aborted
    // before sending a late "out for lunch" fallback message.
    let abortController: AbortController | null = null;
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
        userId: ((userMessage as any).userId || (validatedContext as any)?.userId || "unknown-user"),
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

      // Helper: Get project lead fallback agent (Maya first, then PM Alex, then any agent)
      const getProjectPmFallback = async (projectId: string): Promise<Agent | null> => {
        const projectAgents = await storage.getAgentsByProject(projectId);

        // Priority 1: Maya (special agent / Idea Partner)
        const maya = projectAgents.find(agent =>
          agent.isSpecialAgent || agent.role.toLowerCase() === 'idea partner'
        );
        if (maya) {
          return { id: maya.id, name: maya.name, role: maya.role, teamId: maya.teamId };
        }

        // Priority 2: Product Manager (Alex)
        const pmAgent = projectAgents.find(agent => {
          const roleLower = agent.role.toLowerCase();
          return roleLower.includes('product manager') || roleLower === 'pm';
        });
        if (pmAgent) {
          return { id: pmAgent.id, name: pmAgent.name, role: pmAgent.role, teamId: pmAgent.teamId };
        }

        // Priority 3: Any agent in the project
        if (projectAgents.length > 0) {
          const firstAgent = projectAgents[0];
          return { id: firstAgent.id, name: firstAgent.name, role: firstAgent.role, teamId: firstAgent.teamId };
        }

        // Last resort: no agents at all
        return null;
      };

      let respondingAgent: Agent | null = null;
      let selectedAgents: Agent[] = [];
      let authority: { allowedSpeaker: Agent; reason: string } | null = null;
      let isPmFallback = false;
      let isSystemFallback = false;
      let mentionResolvedAgentId: string | null = null;

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

        // 🆕 Feature 4: @Mention & Role Reference Resolution
        // Check if the user's message contains an @mention or role reference to a specific Hatch.
        // This overrides all other routing if a valid match is found.
        try {
          const mentionResult = resolveMentionedAgent(
            userMessage.content || '',
            availableAgents.map((a: any) => ({ id: a.id, name: a.name, role: a.role }))
          );
          if (mentionResult.matchType !== 'none' && mentionResult.mentionedAgentId) {
            mentionResolvedAgentId = mentionResult.mentionedAgentId;
            devLog(`🎯 [MentionParser] Resolved @mention to agent: ${mentionResult.mentionedName} (${mentionResult.matchType})`);
          }
        } catch (mentionError: any) {
          console.warn('[MentionParser] Error resolving mention:', mentionError.message);
        }

        try {
          // Phase 1.2: Use addressedAgentId from validated envelope (not from raw casting)
          // Mention-resolved ID takes precedence over envelope addressedAgentId
          const envelopeAddressedAgentId = mentionResolvedAgentId || addressedAgentId ||
            (userMessage as any).addressedAgentId ||
            (userMessage as any).metadata?.addressedAgentId;

          authority = resolveSpeakingAuthority({
            conversationScope: mode,
            conversationId,
            availableAgents,
            addressedAgentId: envelopeAddressedAgentId
          });

          // Phase 1.1.b: Enforce authority result - override all existing selection logic
          respondingAgent = authority!.allowedSpeaker;
          selectedAgents = [authority!.allowedSpeaker];
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
      // BUT never override if:
      //   1. User explicitly @mentioned an agent (envelope or mention-parsed)
      //   2. Speaking authority chose Maya for project scope (she's the project-level voice)
      //   3. Speaking authority resolved a direct agent conversation
      const matches = findBestAgentMatch(userMessage.content, availableAgents);
      const hasExplicitMention = !!(mentionResolvedAgentId || addressedAgentId);
      const authorityIsDefinitive = authority && (
        authority.reason === 'project_scope_maya_authority' ||
        authority.reason === 'direct_agent_conversation' ||
        authority.reason === 'explicit_addressing'
      );
      if (
        !isPmFallback &&
        !isSystemFallback &&
        !hasExplicitMention &&
        !authorityIsDefinitive &&
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
      devLog('🔍 Available agents:', availableAgents.map((a: any) => ({ id: a.id, name: a.name, role: a.role })));

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

      // Load conversation history for context (with compaction support)
      const recentMessages = await storage.getMessagesByConversation(conversationId);
      const allMapped = recentMessages.map(msg => ({
        role: msg.messageType === 'user' ? 'user' as const : 'assistant' as const,
        content: msg.content,
        timestamp: msg.createdAt?.toISOString() || new Date().toISOString(),
        senderId: msg.userId || msg.agentId || 'unknown',
        messageType: msg.messageType === 'system' ? 'agent' as const : msg.messageType as 'user' | 'agent'
      }));
      const { history: conversationHistory } = await getCompactedContext(conversationId, allMapped, storage);

      // Create chat context for AI
      const chatContext = {
        mode: mode as 'project' | 'team' | 'agent',
        projectName: project.name,
        projectId,
        conversationId,
        teamName,
        agentRole: respondingAgent.role,
        agentId: respondingAgent.id,
        conversationHistory,
        userId: userMessage.userId || 'user',
        // P3: Project direction + team + memories injected for richer context
        projectDirection: (project.coreDirection as any) ?? null,
        teamMembers: respondingAgent ? await storage.getAgentsByProject(projectId!).then(
          (agents: any[]) => agents.filter((a: any) => !a.isSpecialAgent).map((a: any) => ({ name: a.name, role: a.role }))
        ).catch(() => []) : [],
        projectMemories: projectId ? await storage.getRelevantProjectMemories(projectId, {
          query: userMessage.content,
          limit: 12,
          minImportance: 0.4,
          excludeConversationId: conversationId,
        }).then((mems: any[]) => mems.map((m: any) => `- ${m.content}`).join('\n')).catch(() => null) : null,
        // GAP-7: Derive userDesignation from self-identification patterns in early messages
        userDesignation: (() => {
          const stored = (project.coreDirection as any)?.userRole ?? null;
          if (stored) return stored;
          const earlyMessages = recentMessages.slice(0, 8).filter((m: any) => m.messageType === 'user');
          const rolePatterns = [
            { pattern: /\bi(?:'m| am) (?:a |an )?([a-z][\w\s]{2,25}(?:designer|developer|engineer|founder|marketer|pm|product manager|analyst|writer|consultant|cto|ceo|manager))\b/i, group: 1 },
            { pattern: /\bwork(?:ing)? as (?:a |an )?([a-z][\w\s]{2,25})\b/i, group: 1 },
            { pattern: /\bmy (?:job|role|title) is ([a-z][\w\s]{2,25})\b/i, group: 1 },
          ];
          for (const msg of earlyMessages) {
            for (const { pattern, group } of rolePatterns) {
              const match = msg.content?.match(pattern);
              if (match?.[group]) return match[group].trim();
            }
          }
          return null;
        })(),
        // GAP-8: Detect handoff — when conductor routed to a different agent than last speaker
        handoffFrom: (() => {
          const lastAgentMsg = recentMessages.slice().reverse().find((m: any) => m.messageType === 'agent' && m.agentId);
          if (!lastAgentMsg || !lastAgentMsg.agentId || lastAgentMsg.agentId === respondingAgent?.id) return null;
          const previousAgent = availableAgents.find((a: any) => a.id === lastAgentMsg.agentId);
          return previousAgent?.role ?? null;
        })(),
        // P3: Inject real storage for memory extraction (fire-and-forget)
        createConversationMemory: storage.createConversationMemory.bind(storage),
      };

      // Create AbortController for cancellation + WS disconnect
      abortController = new AbortController();
      (ws as any).__currentAbortController = abortController;

      // Handle cancellation messages
      const cancelHandler = (message: Buffer) => {
        try {
          const data = JSON.parse(message.toString());
          if (data.type === 'cancel_streaming' && (data.messageId === responseMessageId || !data.messageId)) {
            devLog('🛑 Streaming cancelled by user');
            abortController?.abort();
          }
        } catch {
          // Ignore malformed WS frames — don't crash the streaming handler
        }
      };
      ws.on('message', cancelHandler);

      try {
        // Notify streaming started right before actual streaming begins
        devLog('📡 Sending streaming_started event');
        ws.send(JSON.stringify({
          type: 'streaming_started',
          messageId: responseMessageId,
          agentId: respondingAgent ? respondingAgent.id : 'maya-fallback',
          agentName: respondingAgent ? respondingAgent.name : 'Maya'
        }));
        hasStreamingStarted = true;

        // Persistence invariant: Handle no agents case with graceful fallback
        // Message persistence must not depend on agent availability or orchestration success
        if (isSystemFallback) {
          // Last resort: project has zero agents — Maya speaks on behalf of the empty project
          devLog('📝 Generating Maya fallback response (no agents in project)');
          accumulatedContent = "Hey, I'm Maya — your project lead. Looks like I just got here and the rest of the team hasn't arrived yet. Add some Hatches to this project and I'll get everyone coordinated.";

          // Send the fallback response as a single chunk
          ws.send(JSON.stringify({
            type: 'streaming_chunk',
            messageId: responseMessageId,
            chunk: accumulatedContent,
            accumulatedContent
          }));

          // Persist as agent message from Maya (never expose "System" to users)
          const fallbackSaved = await storage.createMessage({
            id: responseMessageId,
            conversationId,
            agentId: null,
            senderName: 'Maya',
            content: accumulatedContent,
            messageType: 'agent' as const,
            metadata: { fallback: { type: 'pm_voice', reason: 'no_agents_in_project' }, agentRole: 'pm' },
          } as any);

          ws.send(JSON.stringify({
            type: 'streaming_completed',
            messageId: responseMessageId,
            message: fallbackSaved
          }));

          return; // No further processing needed for pure system fallback

        } else if (isPmFallback) {
          // PM Maya fallback - scope-specific messages, always in Maya's voice
          devLog('📝 Generating PM Maya fallback response');

          if (mode === 'team') {
            accumulatedContent = "This team doesn't have any members yet — I'm stepping in from the project level. Add some Hatches here and they'll jump right into the conversation.";
          } else if (mode === 'agent') {
            accumulatedContent = "Hmm, that teammate isn't available right now. You can add them to the project, or come chat with me in the main project channel — I'm always around.";
          } else {
            // Project scope (shouldn't happen, but handle gracefully)
            accumulatedContent = "I'm here! What are we working on?";
          }

          // Send the fallback response as a single chunk
          ws.send(JSON.stringify({
            type: 'streaming_chunk',
            messageId: responseMessageId,
            chunk: accumulatedContent,
            accumulatedContent
          }));

          // Must persist and signal completion so the client input is unblocked
          const pmFallbackSaved = await storage.createMessage({
            id: responseMessageId,
            conversationId,
            agentId: respondingAgent && respondingAgent.id !== 'system' ? respondingAgent.id : null,
            senderName: respondingAgent ? respondingAgent.name : 'System',
            content: accumulatedContent,
            messageType: 'agent' as const,
            metadata: { fallback: { type: 'pm', reason: 'no_agents_in_scope' } },
          } as any);

          ws.send(JSON.stringify({
            type: 'streaming_completed',
            messageId: responseMessageId,
            message: pmFallbackSaved
          }));

          return; // No further processing needed for pure PM fallback

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

        // Sync accumulated content to outer scope for persistence rescue
        _lastAccumulatedContent = accumulatedContent;
        _respondingAgentForRescue = respondingAgent;

        // ─── 🆕 CHAT ACTION PROCESSING ──────────────────────────────────────────
        // After the full response is accumulated, check if the agent embedded
        // an action block (HATCH_SUGGESTION, TASK_SUGGESTION, BRAIN_UPDATE).
        // Strip the block from the displayed text and handle the action if user
        // has granted permission in this turn.
        if (!abortController.signal.aborted && accumulatedContent) {
          const parsedAction = parseAction(accumulatedContent);
          if (parsedAction) {
            // Always strip action blocks from what the user sees
            accumulatedContent = stripActionBlocks(accumulatedContent);
            devLog(`[ActionParser] Detected action: ${parsedAction.type}`);

            // Check if this turn is the user granting permission for a pending action
            const userPermission = detectUserPermission(userMessage.content || '');
            devLog(`[ActionParser] User permission: ${userPermission}`);

            if (userPermission === 'granted') {
              try {
                // ── HATCH_SUGGESTION: Auto-create teams + agents ──────────────
                if (parsedAction.type === 'HATCH_SUGGESTION') {
                  const suggestionPayload = parsedAction.payload as any;
                  const createdTeams: any[] = [];
                  const createdAgents: any[] = [];

                  for (const teamDef of (suggestionPayload.teams || [])) {
                    try {
                      const newTeam = await storage.createTeam({
                        name: teamDef.name,
                        emoji: teamDef.emoji || '⭐',
                        projectId,
                        userId: (ws as any).__userId!,
                      } as any);
                      createdTeams.push(newTeam);

                      for (const agentDef of (teamDef.agents || [])) {
                        const newAgent = await storage.createAgent({
                          name: agentDef.name,
                          role: agentDef.role,
                          color: agentDef.color || 'blue',
                          teamId: newTeam.id,
                          projectId,
                          userId: (ws as any).__userId!,
                          personality: {
                            traits: [],
                            communicationStyle: `${agentDef.role} with deep expertise in their domain`,
                            expertise: [agentDef.role],
                            welcomeMessage: `Hi! I'm ${agentDef.name}, your ${agentDef.role}. Ready to help make this project a success!`,
                          },
                          isSpecialAgent: false,
                        } as any);
                        createdAgents.push(newAgent);
                      }
                    } catch (teamErr: any) {
                      console.error('[ActionParser] Error creating team:', teamErr.message);
                    }
                  }

                  // Notify frontend to refresh sidebar
                  if (createdTeams.length > 0) {
                    ws.send(JSON.stringify({
                      type: 'teams_auto_hatched',
                      projectId,
                      teams: createdTeams,
                      agents: createdAgents,
                    }));
                    devLog(`✨ [AutoHatch] Created ${createdTeams.length} team(s) and ${createdAgents.length} agent(s)`);

                    // P2: Maya announces the new team in the project conversation
                    try {
                      const allAgents = await storage.getAgentsByProject(projectId);
                      const mayaAgent = allAgents.find((a: any) => a.isSpecialAgent || a.role === 'Idea Partner');
                      if (mayaAgent) {
                        const agentList = createdAgents.slice(0, 3).map((a: any) => `${a.name} (${a.role})`).join(', ');
                        const extra = createdAgents.length > 3 ? `, and ${createdAgents.length - 3} more` : '';
                        const announcement = `I've pulled together a team for you — ${agentList}${extra}. They're ready to jump in. What would you like to kick off with?`;
                        const projectConvId = `project:${projectId}`;
                        const announcementMsg = await storage.createMessage({
                          id: randomUUID(),
                          conversationId: projectConvId,
                          content: announcement,
                          messageType: 'agent',
                          agentId: mayaAgent.id,
                          userId: null,
                          metadata: { isTeamAnnouncement: true },
                        } as any);
                        broadcastToConversation(projectConvId, {
                          type: 'new_message',
                          conversationId: projectConvId,
                          message: announcementMsg,
                        });
                      }
                    } catch { /* non-critical */ }
                  }
                }

                // ── TASK_SUGGESTION: Create task in project task list ─────────
                if (parsedAction.type === 'TASK_SUGGESTION') {
                  const taskPayload = parsedAction.payload as any;
                  try {
                    const newTask = await storage.createTask({
                      title: taskPayload.title,
                      description: `Created from chat by ${respondingAgent?.name || 'Hatch'}`,
                      status: 'todo',
                      priority: taskPayload.priority || 'medium',
                      projectId,
                      userId: (ws as any).__userId!,
                      agentId: respondingAgent?.id || null,
                      dueDate: null,
                      completedAt: null,
                      metadata: {
                        sourceConversationId: conversationId,
                        createdFromChat: true,
                      },
                    } as any);

                    ws.send(JSON.stringify({
                      type: 'task_created_from_chat',
                      projectId,
                      task: newTask,
                    }));
                    devLog(`✅ [ActionParser] Task created from chat: ${taskPayload.title}`);
                  } catch (taskErr: any) {
                    console.error('[ActionParser] Error creating task:', taskErr.message);
                  }
                }

                // ── BRAIN_UPDATE: Update project brain field ──────────────────
                if (parsedAction.type === 'BRAIN_UPDATE') {
                  const brainPayload = parsedAction.payload as any;
                  try {
                    const currentProject = await storage.getProject(projectId);
                    if (currentProject) {
                      const currentBrain = (currentProject.brain as any) || {};
                      const updatedBrain = {
                        ...currentBrain,
                        [brainPayload.field]: brainPayload.value,
                        lastUpdatedAt: new Date().toISOString(),
                        lastUpdatedBy: respondingAgent?.name || 'Hatch',
                      };
                      await storage.updateProject(projectId, { brain: updatedBrain });

                      ws.send(JSON.stringify({
                        type: 'brain_updated_from_chat',
                        projectId,
                        field: brainPayload.field,
                        value: brainPayload.value,
                        updatedBy: respondingAgent?.name || 'Hatch',
                      }));
                      devLog(`🧠 [ActionParser] Project Brain updated: ${brainPayload.field}`);
                    }
                  } catch (brainErr: any) {
                    console.error('[ActionParser] Error updating brain:', brainErr.message);
                  }
                }
              } catch (actionErr: any) {
                console.error('[ActionParser] Error executing action:', actionErr.message);
              }
            }
          }
        }
        // ─── END CHAT ACTION PROCESSING ─────────────────────────────────────────


        // This ensures symmetric persistence: user messages are always saved, agent messages must be too
        // IMPORTANT: Persist even if abort signal fired AFTER streaming completed.
        // A WS disconnect after LLM streaming finished should NOT prevent saving the response.
        // Only skip if we have no content to save (streaming was truly interrupted mid-generation).
        if (accumulatedContent || !abortController.signal.aborted) {
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

          // Phase 19: Peer-policing protocol — run async (fire-and-forget) so it never blocks persistence.
          // Peer review is a quality gate for autonomy tasks, not a blocker for real-time chat.
          {
            const reviewers = availableAgents
              .filter((agent: any) => agent.id !== respondingAgent?.id)
              .map((agent: any) => ({ id: agent.id, name: agent.name, role: agent.role }));

            // Fire-and-forget: run peer review in background, never block persistence
            runPeerReview({
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
            }).then((peerReviewDecision) => {
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

                logAutonomyEvent({
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
                }).catch(() => {});

                if (peerReviewDecision.blockedByHallucination && resolution.overriddenByGuardrail) {
                  try {
                    ws.send(JSON.stringify({
                      type: "peer_review_revision",
                      messageId: responseMessageId,
                      conversationId,
                      content: resolution.finalContent,
                      blockedByHallucination: true,
                    }));
                  } catch (_) {}
                }
              }
            }).catch((err) => {
              console.warn('[PEER-REVIEW] Background peer review failed:', err.message);
            });
          }

          const toneGuard = applyTeammateToneGuard(accumulatedContent || "", userMessage?.content || "");
          if (toneGuard.changed) {
            accumulatedContent = toneGuard.content;
            ws.send(JSON.stringify({
              type: "streaming_chunk",
              messageId: responseMessageId,
              chunk: "",
              accumulatedContent,
            }));

            await logAutonomyEvent({
              eventType: "revision_completed",
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
                source: "tone_guard",
                reasons: toneGuard.reasons,
              },
            });
          }

          // ─── START PROJECT NAME AUTO-UPDATE DETECTION ──────────────────────────
          // Look for [[PROJECT_NAME: Your Confirmed Name]] in Maya's response
          const projectNameRegex = /\[\[PROJECT_NAME:\s*(.+?)\]\]/i;
          const match = accumulatedContent.match(projectNameRegex);
          if (match && match[1]) {
            const newProjectName = match[1].trim();
            try {
              await storage.updateProject(projectId, { name: newProjectName });
              // Strip the tag from the content shown to the user for a cleaner feel
              accumulatedContent = accumulatedContent.replace(projectNameRegex, '').trim();

              // Notify all clients of the project update
              ws.send(JSON.stringify({
                type: 'project_updated',
                projectId,
                name: newProjectName,
                updatedBy: respondingAgent?.name || 'Maya'
              }));
              devLog(`🏷️ [PM] Project auto-renamed to: ${newProjectName}`);
            } catch (err: any) {
              console.error('Error auto-renaming project:', err.message);
            }
          }
          // ─── END PROJECT NAME AUTO-UPDATE DETECTION ────────────────────────────

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
            senderName: respondingAgent ? respondingAgent.name : 'Maya',
            content: accumulatedContent || '', // Ensure content exists (empty string if needed)
            messageType: 'agent' as const,
            metadata: {
              conductor: conductorResult.decision,
              safetyScore: conductorResult.safetyScore,
              // P6: agentRole stored in metadata so MessageBubble can apply role-specific colors
              agentRole: respondingAgent?.role ?? null,
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

          // Fire-and-forget: deliberation trace is audit data, must never block persistence
          if (traceId && respondingAgent) {
            appendDeliberationRound(traceId, {
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
            }).catch((err) => console.warn('[TRACE] appendDeliberationRound failed:', err?.message));
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
          _responsePersisted = true;
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

          // B4: Persist behavior-based personality adaptation after each response
          try {
            const behaviorUserId = userMessage.userId || userMessage.senderId;
            if (behaviorUserId && respondingAgent?.id) {
              // Seed from DB first so restart doesn't wipe learning
              const agentForPersist = await storage.getAgent(respondingAgent.id);
              const persistedPersonality = (agentForPersist?.personality as any);
              if (persistedPersonality?.adaptedTraits?.[behaviorUserId] && persistedPersonality?.adaptationMeta?.[behaviorUserId]) {
                personalityEngine.seedProfileFromDB(
                  respondingAgent.id, behaviorUserId,
                  persistedPersonality.adaptedTraits[behaviorUserId],
                  persistedPersonality.adaptationMeta[behaviorUserId],
                  respondingAgent.role
                );
              }
              // Persist any behavior-based adaptation that happened during streaming
              const behaviorProfile = personalityEngine.getPersonalityProfile(respondingAgent.id, behaviorUserId, respondingAgent.role);
              if (behaviorProfile.interactionCount > 0) {
                const existingPersonality = persistedPersonality || {};
                await storage.updateAgent(respondingAgent.id, {
                  personality: {
                    ...existingPersonality,
                    adaptedTraits: { ...(existingPersonality.adaptedTraits || {}), [behaviorUserId]: behaviorProfile.adaptedTraits },
                    adaptationMeta: {
                      ...(existingPersonality.adaptationMeta || {}),
                      [behaviorUserId]: {
                        interactionCount: behaviorProfile.interactionCount,
                        adaptationConfidence: behaviorProfile.adaptationConfidence,
                        lastUpdated: new Date().toISOString()
                      }
                    }
                  } as any
                });
              }
            }
          } catch (behaviorPersistErr) {
            devLog('Behavior personality persist failed (non-critical):', behaviorPersistErr);
          }

          // Smart task detection - intent classifier pipeline (zero LLM cost)
          try {
            const projectAgents = await storage.getAgentsByProject(projectId);
            const agentList = projectAgents.map(a => ({ id: a.id, name: a.name, role: a.role }));
            const intent = classifyTaskIntent(userMessage.content, {
              availableAgents: agentList,
              conversationDepth: recentMessages.length,
            });
            devLog('[TaskDetection] Intent:', intent.type, 'msg:', userMessage.content.substring(0, 80), 'depth:', recentMessages.length);

            if (intent.type === 'EXPLICIT_TASK_REQUEST') {
              const userId = (ws as any).__userId || 'anonymous';
              const rateCheck = checkRateLimit(userId);
              if (!rateCheck.allowed) {
                devLog('Rate limit hit for task creation:', rateCheck.message);
              } else {
                const existingTasks = await storage.getTasksByProject(projectId);
                const dupCheck = checkForDuplicate(intent.taskDescription, existingTasks as any);
                if (dupCheck.isDuplicate) {
                  devLog('Duplicate task detected:', intent.taskDescription);
                  ws.send(JSON.stringify({
                    type: 'task_suggestions',
                    tasks: [{ title: intent.taskDescription, isDuplicate: true, existingTask: dupCheck.similarTask }],
                    confidence: 0.9,
                    conversationId,
                    projectId,
                  }));
                } else {
                  // Send as suggestion for user approval instead of creating directly
                  const dueDate = extractDueDate(userMessage.content);
                  const priority = extractPriority(userMessage.content) || 'medium';
                  // Collect all tasks (primary + additional from multi-TODO messages)
                  const allTaskDescs = [intent.taskDescription, ...(intent.additionalTasks || [])];
                  const tasks = allTaskDescs.map(desc => ({
                    title: desc,
                    priority,
                    dueDate: dueDate ? dueDate.toISOString() : null,
                  }));
                  devLog('Task suggestions (pending approval):', allTaskDescs.length, 'tasks');
                  ws.send(JSON.stringify({
                    type: 'task_suggestions',
                    tasks,
                    confidence: 0.9,
                    conversationId,
                    projectId,
                  }));
                }
              }
            } else if (intent.type === 'USER_DELEGATION') {
              const userId = (ws as any).__userId || 'anonymous';
              const rateCheck = checkRateLimit(userId);
              if (rateCheck.allowed) {
                const dueDate = extractDueDate(userMessage.content);
                const priority = extractPriority(userMessage.content) || 'medium';
                devLog('Delegated task suggestion (pending approval):', intent.taskDescription, 'to', intent.targetAgentName);
                ws.send(JSON.stringify({
                  type: 'task_suggestions',
                  tasks: [{
                    title: intent.taskDescription,
                    priority,
                    dueDate: dueDate ? dueDate.toISOString() : null,
                    assignee: intent.targetAgentName,
                  }],
                  confidence: 0.9,
                  conversationId,
                  projectId,
                }));
              }
            } else if (intent.type === 'ORGANIC_CANDIDATE' && accumulatedContent) {
              // LLM-powered organic task extraction for natural conversational task mentions
              const project = await storage.getProject(projectId);
              const existingTasks = await storage.getTasksByProject(projectId);
              extractOrganicTasks(userMessage.content, accumulatedContent, {
                projectName: project?.name || 'Unknown',
                agentRole: respondingAgent?.role || 'Idea Partner',
                availableAgents: agentList.map(a => a.role),
                conversationId,
                existingTasks: existingTasks.map((t: any) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority })),
              }).then(result => {
                if (result.hasTasks && result.tasks.length > 0) {
                  ws.send(JSON.stringify({
                    type: 'task_suggestions',
                    tasks: result.tasks.map(t => ({
                      title: t.title,
                      priority: t.priority || 'medium',
                      assignee: t.suggestedAssignee,
                    })),
                    confidence: result.confidence,
                    conversationId,
                    projectId,
                    source: 'organic',
                  }));
                }
              }).catch(err => {
                devLog('Organic task extraction failed (non-critical):', err);
              });
            } else if (intent.type === 'TASK_LIFECYCLE_COMMAND') {
              const projectTasks = await storage.getTasksByProject(projectId);
              const lifecycleCtx: LifecycleContext = {
                projectTasks: projectTasks.map((t: any) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, assignee: t.assignee, dueDate: t.dueDate })),
                agents: agentList,
                updateTask: (id: string, updates: Record<string, any>) => storage.updateTask(id, updates),
                deleteTask: async (id: string) => { await storage.updateTask(id, { status: 'completed' }); },
              };
              const result = await executeLifecycleCommand(intent, lifecycleCtx);
              ws.send(JSON.stringify({ type: 'task_lifecycle_result', result, conversationId, projectId }));
            }

            // Completion detection on agent response
            const completionSignal = detectCompletionSignal(accumulatedContent);
            if (completionSignal.detected && completionSignal.taskHint) {
              const projectTasks = await storage.getTasksByProject(projectId);
              const { fuzzyMatchTask } = await import('../ai/tasks/taskLifecycle.js');
              const matches = fuzzyMatchTask(completionSignal.taskHint, projectTasks as any);
              if (matches.length === 1) {
                ws.send(JSON.stringify({
                  type: 'task_completion_suggested',
                  task: matches[0],
                  phrase: completionSignal.phrase,
                  conversationId,
                  projectId,
                }));
              }
            }
          } catch (taskError) {
            devLog('Smart task detection error (non-critical):', taskError);
          }

          // ─── Deliverable Detection ─────────────────────────────────────────
          try {
            const deliverableDetection = detectDeliverableIntent(
              userMessage.content,
              respondingAgent?.role
            );
            if (deliverableDetection.detected) {
              ws.send(JSON.stringify({
                type: 'deliverable_proposal',
                proposalType: deliverableDetection.type,
                title: deliverableDetection.title,
                agentName: respondingAgent?.name || 'Agent',
                agentRole: deliverableDetection.agentRole,
                confidence: deliverableDetection.confidence,
                conversationId,
                projectId,
              }));
            }
          } catch (deliverableErr) {
            devLog('Deliverable detection error (non-critical):', deliverableErr);
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
              if (chatPatch.executionRules && typeof chatPatch.executionRules === "object") {
                mergedPatch.executionRules = { ...((project as any).executionRules || {}), ...chatPatch.executionRules };
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

          // Record LLM usage for billing
          const billingUserId = (ws as any).__userId as string | undefined;
          if (billingUserId && llmMetadata) {
            recordUsage(
              storage,
              billingUserId,
              llmMetadata.provider,
              llmMetadata.model,
              llmMetadata.modelTier,
              llmMetadata.tokenUsage,
              'chat',
            ).catch(err => console.error('[UsageTracker] chat recording failed:', err));
          }

          // Notify streaming completed (may fail if WS disconnected — that's OK, persistence already done)
          try {
            ws.send(JSON.stringify({
              type: 'streaming_completed',
              messageId: responseMessageId,
              message: savedResponse
            }));
          } catch (_wsSendErr) {
            // WS already closed — response is persisted, client will see it on next load
          }

          // Broadcast final message to other clients
          broadcastToConversation(conversationId, {
            type: 'new_message',
            message: savedResponse,
            conversationId
          }, { exclude: ws });

          // 6.1: Fire-and-forget conversation compaction after streaming completes
          compactConversation(
            conversationId,
            allMapped.map(m => ({ role: m.role, content: m.content })),
            storage,
          ).catch(() => {});

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

          // Check for autonomous execution trigger after streaming completes
          if (resolvedProjectId) {
            await checkForAutonomyTrigger(
              userMessage?.content ?? '',
              resolvedProjectId,
              conversationId,
              storage,
              broadcastToConversation,
            );
          }
        }
      } finally {
        ws.off('message', cancelHandler);
        // BUG-05: clear the AbortController reference so it does not accumulate on the WS object.
        delete (ws as any).__currentAbortController;
      }

    } catch (error) {
      console.error('❌ Streaming response error:', error);

      // PERSISTENCE RESCUE: If LLM streaming completed but post-processing threw
      // (e.g. WS disconnect during peer review/tone guard), persist the response.
      if (_lastAccumulatedContent && !_responsePersisted && conversationId) {
        try {
          const rescueAgent = _respondingAgentForRescue;
          await storage.createMessage({
            id: responseMessageId,
            conversationId,
            agentId: rescueAgent && rescueAgent.id !== 'system' ? rescueAgent.id : null,
            senderName: rescueAgent ? rescueAgent.name : 'Maya',
            content: _lastAccumulatedContent,
            messageType: 'agent' as const,
            metadata: {
              rescuePersistence: true,
              agentRole: rescueAgent?.role ?? null,
            },
          } as any);
          devLog('🛟 Rescue-persisted streaming response after error:', responseMessageId);
        } catch (rescueErr) {
          console.error('❌ Failed to rescue-persist streaming response:', rescueErr);
        }
      }

      const payload = getStreamingErrorPayload(error);

      // If the real agent already sent content chunks, do NOT send a fallback ghost message.
      // The user already saw the agent's response — sending a second message from Maya/PM is confusing.
      const hasPartialResponse = !!_lastAccumulatedContent;

      try {
        if (hasPartialResponse) {
          // Skip fallback message — real agent already responded (even if post-processing failed).
          // Just send the error event so the frontend can show "Failed to generate" inline.
          devLog('⚠️ Skipping fallback ghost message — real agent already sent content');
          ws.send(JSON.stringify({
            type: 'streaming_error',
            messageId: responseMessageId,
            code: payload.code,
            error: payload.error
          }));
        } else if (abortController?.signal.aborted) {
          // BUG-04: outer 60s timeout already fired and sent streaming_error to the client.
          // Do NOT send a late "out for lunch" fallback — the user already saw the error,
          // and a delayed second message would arrive AFTER the error and pollute the chat.
          devLog('⚠️ Skipping fallback message — abortController already aborted (outer timeout fired)');
          ws.send(JSON.stringify({
            type: 'streaming_error',
            messageId: responseMessageId,
            code: payload.code,
            error: payload.error,
          }));
        } else {
          // No content was streamed — send a fallback message from PM/Maya
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

          const runtimeNow = getCurrentRuntimeConfig();
          const fallbackContent = buildServiceFallbackMessage({
            mode: resolvedMode,
            agentName: effectiveAgent?.name,
            agentRole: effectiveAgent?.role,
            userMessage: userMessage?.content || "",
            errorCode: payload.code,
          });

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
            messageType: 'agent' as const,
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
                  if (chatPatch.executionRules && typeof chatPatch.executionRules === "object") {
                    mergedPatch.executionRules = { ...((existingProject as any).executionRules || {}), ...chatPatch.executionRules };
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
        }

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
  // ═══════════════════════════════════════════════════════════════
  // SECTION 6: Memory Extraction & User Name Detection (~lines 3185-3260)
  // Post-response memory extraction and user name parsing.
  // ═══════════════════════════════════════════════════════════════

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

  return { getWsHealth };
}
