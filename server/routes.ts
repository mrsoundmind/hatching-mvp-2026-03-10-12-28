import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { randomUUID } from "crypto";

import { personalityEngine } from "./ai/personalityEvolution.js";
import { initializePreTrainedColleagues, devTrainingTools } from "./ai/devTrainingTools.js";
import { handoffTracker } from "./ai/expertiseMatching.js";

import { registerHealthRoute } from "./routes/health.js";
import { registerAutonomyRoutes } from "./routes/autonomy.js";
import { registerTeamRoutes } from "./routes/teams.js";
import { registerAgentRoutes } from "./routes/agents.js";
import { registerMessageRoutes } from "./routes/messages.js";
import { registerProjectRoutes } from "./routes/projects.js";
import { registerTaskRoutes } from "./routes/tasks.js";
import { registerChatRoutes } from "./routes/chat.js";
import { registerBillingRoutes } from "./routes/billing.js";
import { registerDeliverableRoutes } from "./routes/deliverables.js";
import {
  buildGoogleAuthorizationUrl,
  exchangeGoogleAuthorizationCode,
  generateCodeChallenge,
  generateCodeVerifier,
  generateOAuthNonce,
  generateOAuthState,
  isGoogleAuthConfigured,
} from "./auth/googleOAuth.js";
import { registerHealthBroadcaster } from "./llm/providerResolver.js";

type SessionParser = (req: any, res: any, next: (err?: unknown) => void) => void;

// Module-level broadcast reference — set once registerRoutes runs.
// Allows background autonomy runner (and other server modules) to broadcast
// WS messages without needing access to the activeConnections closure.
let _globalBroadcast: ((conversationId: string, data: unknown) => void) | null = null;
export function getGlobalBroadcast(): ((conversationId: string, data: unknown) => void) | null {
  return _globalBroadcast;
}

// Phase 35-02: Module-level reference to the all-sockets broadcaster (set once
// chat.ts fires its onBroadcastReady callback). Used by providerResolver.ts via
// registerHealthBroadcaster() and by providerHealthState.ts via the recovery
// hook registered below — both routed to broadcastToAllSockets so PROVIDER_DEGRADED
// and PROVIDER_RECOVERED reach every connected client.
let providerHealthBroadcast: ((data: unknown) => void) | null = null;

export async function registerRoutes(app: Express, sessionParser?: SessionParser): Promise<Server> {
  // Initialize pre-trained AI colleagues on server start
  initializePreTrainedColleagues();

  const isProd = process.env.NODE_ENV === "production";

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
    if (req.path.startsWith('/auth') || req.path === '/system/storage-status' || req.path === '/billing/webhook') {
      return next();
    }
    requireAuth(req, res, next);
  });

  const getSessionUserId = (req: Request): string => (req.session as any).userId as string;

  // Fix 3c: Block /api/dev/* in production — no override allowed
  if (process.env.NODE_ENV === 'production') {
    app.all("/api/dev/*", (_req, res) => {
      res.status(403).json({ error: 'Dev endpoints are disabled in production.' });
    });
  }

  const sanitizeReturnTo = (value: unknown): string | undefined => {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return undefined;
    if (trimmed.startsWith("/api/auth")) return undefined;
    return trimmed;
  };

  const regenerateSession = (req: Request) =>
    new Promise<void>((resolve, reject) => {
      req.session.regenerate((err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });

  // Google OAuth entrypoint
  app.get('/api/auth/google/start', async (req, res) => {
    if (!isGoogleAuthConfigured()) {
      const preferred = req.accepts(['html', 'json']);
      if (preferred === 'html') {
        return res.redirect('/login?error=google_not_configured');
      }
      return res.status(503).json({
        error: "Google auth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
      });
    }

    try {
      const state = generateOAuthState();
      const nonce = generateOAuthNonce();
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);
      const returnTo = sanitizeReturnTo(req.query.returnTo);

      req.session.oauthState = state;
      req.session.oauthNonce = nonce;
      req.session.pkceVerifier = codeVerifier;
      req.session.returnTo = returnTo || "/";

      const authorizationUrl = await buildGoogleAuthorizationUrl({
        req,
        state,
        nonce,
        codeChallenge,
      });

      return res.redirect(authorizationUrl.toString());
    } catch (error) {
      console.error("Google auth start failed:", error);
      return res.status(500).json({ error: "Failed to start Google login" });
    }
  });

  // Google OAuth callback
  app.get('/api/auth/google/callback', async (req, res) => {
    if (!isGoogleAuthConfigured()) {
      return res.redirect('/login?error=google_not_configured');
    }

    const expectedState = req.session.oauthState;
    const expectedNonce = req.session.oauthNonce;
    const codeVerifier = req.session.pkceVerifier;
    const returnTo = sanitizeReturnTo(req.session.returnTo) || "/";

    delete req.session.oauthState;
    delete req.session.oauthNonce;
    delete req.session.pkceVerifier;
    delete req.session.returnTo;

    if (!expectedState || !expectedNonce || !codeVerifier) {
      return res.redirect('/login?error=oauth_session_missing');
    }

    try {
      const identity = await exchangeGoogleAuthorizationCode({
        req,
        expectedState,
        expectedNonce,
        codeVerifier,
      });

      const user = await storage.upsertOAuthUser(identity);
      await regenerateSession(req);
      req.session.userId = user.id;
      req.session.userTier = user.tier || 'free';

      req.session.save((saveError) => {
        if (saveError) {
          console.error("Failed to persist OAuth session:", saveError);
          return res.redirect('/login?error=session_save_failed');
        }
        return res.redirect(returnTo);
      });
    } catch (error) {
      console.error("Google auth callback failed:", error);
      return res.redirect('/login?error=google_login_failed');
    }
  });

  // Legacy name-based login (dev-only fallback).
  app.post('/api/auth/login', async (req, res) => {
    const allowLegacyLogin = process.env.NODE_ENV === "development" && process.env.ALLOW_LEGACY_NAME_LOGIN !== "false";
    if (!allowLegacyLogin) {
      return res.status(403).json({
        error: "Legacy name login is disabled. Use Google login.",
      });
    }

    try {
      const { name } = req.body;
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'name is required' });
      }

      const trimmedName = name.trim();
      const slug = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "user";
      const username = `session:${slug}`;
      const email = `${slug}+legacy@local.hatchin`;

      let user = await storage.getUserByUsername(username);
      if (!user) {
        user = await storage.createUser({
          email,
          name: trimmedName,
          avatarUrl: null,
          provider: "legacy",
          providerSub: `legacy:${username}`,
          username,
          password: randomUUID(),
        } as any);
      }

      req.session.userId = user.id;
      return res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      });
    } catch (error) {
      console.error('Legacy login failed:', error);
      return res.status(500).json({ error: 'Login failed' });
    }
  });

  app.get('/api/auth/me', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user) {
      req.session.destroy(() => undefined);
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Resolve daily usage for billing info
    const { getDailyMessageCount } = await import('./billing/usageTracker.js');
    const dailyMessagesUsed = await getDailyMessageCount(storage, user.id);
    const tier = user.tier || 'free';
    const dailyMessageLimit = tier === 'pro' ? 2000 : 500;

    return res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      provider: user.provider,
      tier,
      subscriptionStatus: user.subscriptionStatus || 'none',
      dailyMessagesUsed,
      dailyMessageLimit,
      csrfToken: req.session.csrfToken || null,
    });
  });

  // Dev-only: one-click login for testing (no Google OAuth needed)
  app.get('/api/auth/dev-login', async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Dev login disabled in production' });
    }

    try {
      const username = 'session:dev_tester';
      const email = 'dev@local.hatchin';

      let user = await storage.getUserByUsername(username);
      if (!user) {
        user = await storage.createUser({
          email,
          name: 'Dev Tester',
          avatarUrl: null,
          provider: 'legacy',
          providerSub: 'legacy:dev_tester',
          username,
          password: randomUUID(),
        } as any);
      }

      // Regenerate session to prevent fixation attacks
      req.session.regenerate((err) => {
        if (err) {
          console.error('Session regeneration failed:', err);
        }
        req.session.userId = user!.id;
        req.session.userName = user!.name;
        req.session.userTier = user!.tier || 'free';
        console.log('[Auth] Dev login:', user!.id, user!.name);
        // Explicitly save before redirect to avoid race condition
        req.session.save((saveErr) => {
          if (saveErr) console.error('Session save failed:', saveErr);
          return res.redirect('/');
        });
      });
    } catch (error) {
      console.error('Dev login failed:', error);
      return res.status(500).json({ error: 'Dev login failed' });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) return res.status(500).json({ error: 'Logout failed' });
      res.clearCookie('connect.sid');
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
  app.get("/api/personality/:agentId", async (req, res) => {
    try {
      const { agentId } = req.params;
      const userId = getSessionUserId(req);
      // Ownership check: verify agent belongs to user's project
      const agent = await storage.getAgent(agentId);
      if (!agent) return res.status(404).json({ error: "Agent not found" });
      const project = await storage.getProject(agent.projectId);
      if (!project || project.userId !== userId) return res.status(404).json({ error: "Agent not found" });
      const stats = personalityEngine.getPersonalityStats(agentId, userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching personality stats:", error);
      res.status(500).json({ error: "Failed to fetch personality data" });
    }
  });

  app.post("/api/personality/feedback", async (req, res) => {
    try {
      const { agentId, feedback, messageContent, agentResponse } = req.body;
      // Always use session userId — never trust client-supplied userId
      const userId = (req.session as any).userId as string;

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

      // PRES-05: Persist adapted personality traits to database
      try {
        const agent = await storage.getAgent(agentId);
        if (agent) {
          const existingPersonality = (agent.personality as any) || {};
          await storage.updateAgent(agentId, {
            personality: {
              ...existingPersonality,
              adaptedTraits: {
                ...(existingPersonality.adaptedTraits || {}),
                [userId]: updatedProfile.adaptedTraits
              },
              adaptationMeta: {
                ...(existingPersonality.adaptationMeta || {}),
                [userId]: {
                  interactionCount: updatedProfile.interactionCount,
                  adaptationConfidence: updatedProfile.adaptationConfidence,
                  lastUpdated: new Date().toISOString()
                }
              }
            } as any
          });
        }
      } catch (persistErr) {
        console.error('Failed to persist personality adaptation:', persistErr);
      }

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
      const userId = getSessionUserId(req);
      const agent = await storage.getAgent(agentId);
      if (!agent) return res.status(404).json({ error: "Agent not found" });
      const project = await storage.getProject(agent.projectId);
      if (!project || project.userId !== userId) return res.status(404).json({ error: "Agent not found" });
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
      const userId = getSessionUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const stats = handoffTracker.getHandoffStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch handoff stats" });
    }
  });

  app.get("/api/handoffs/history", async (req, res) => {
    try {
      const userId = getSessionUserId(req);
      const { agentId } = req.query;
      if (!agentId || typeof agentId !== 'string') return res.status(400).json({ error: "agentId required" });
      // Ownership check: verify agent belongs to user's project
      const agent = await storage.getAgent(agentId);
      if (!agent) return res.status(404).json({ error: "Agent not found" });
      const project = await storage.getProject(agent.projectId);
      if (!project || project.userId !== userId) return res.status(404).json({ error: "Agent not found" });
      const history = handoffTracker.getHandoffHistory(agentId);
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch handoff history" });
    }
  });

  registerAutonomyRoutes(app);

  const httpServer = createServer(app);

  // Broadcast function references — set by registerChatRoutes via onBroadcastReady callback
  let broadcastToConversation: (cid: string, data: unknown) => void = () => {};
  let broadcastToProject: (pid: string, data: unknown) => void = () => {};

  // Register chat routes (WS server + streaming handler + /api/hatch/chat)
  // Must register BEFORE projects/tasks since broadcast must be ready when those modules call it
  const { getWsHealth } = registerChatRoutes(app, httpServer, {
    sessionParser,
    onBroadcastReady: (fns) => {
      broadcastToConversation = fns.broadcastToConversation;
      broadcastToProject = fns.broadcastToProject;
      _globalBroadcast = (conversationId, data) => fns.broadcastToConversation(conversationId, data);

      // Phase 35-02: Wire the all-sockets broadcaster + provider health hooks.
      // - registerHealthBroadcaster routes PROVIDER_DEGRADED / PROVIDER_RECOVERED
      //   emits from providerResolver.ts (Task 2) to every connected WS client.
      // - registerRecoveryHook (added in Task 3) wires the same broadcaster so
      //   35-05's DEV-only /api/dev/force-recovery → forceRecoveryBroadcast()
      //   deterministically fires PROVIDER_RECOVERED without a real LLM call.
      providerHealthBroadcast = fns.broadcastToAllSockets;
      registerHealthBroadcaster((data) => providerHealthBroadcast?.(data));
    },
  });

  // Health route registered after chat module so getWsHealth is available
  registerHealthRoute(app, {
    getWsHealth: () => getWsHealth(),
    storage,
  });

  // Extracted route modules
  registerTeamRoutes(app);
  registerAgentRoutes(app);
  registerMessageRoutes(app);
  registerProjectRoutes(app, { broadcastToConversation });
  registerTaskRoutes(app, { broadcastToConversation, broadcastToProject });
  registerBillingRoutes(app);
  registerDeliverableRoutes(app, { broadcastToConversation });

  return httpServer;
}
