import type { Express, Request } from 'express';
import { storage } from '../storage.js';
import { insertMessageSchema, insertConversationSchema } from '@shared/schema';
import { z } from 'zod';
import { personalityEngine } from '../ai/personalityEvolution.js';
import { trainingSystem } from '../ai/trainingSystem.js';
import { markSkillUsed } from '../knowledge/skillUpdates/skillLearner.js';

export function registerMessageRoutes(app: Express): void {
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

  const conversationOwnedByUser = async (conversationId: string, userId: string): Promise<boolean> => {
    const ownedProjectIds = await getOwnedProjectIds(userId);
    for (const projectId of ownedProjectIds) {
      const conversations = await storage.getConversationsByProject(projectId);
      if (conversations.some((conversation) => conversation.id === conversationId)) {
        return true;
      }
    }
    return false;
  };

  // Chat API Routes
  app.get("/api/conversations/:projectId", async (req, res) => {
    try {
      const ownedProject = await getOwnedProject(req.params.projectId, getSessionUserId(req));
      if (!ownedProject) {
        return res.status(404).json({ error: "Project not found" });
      }
      const conversations = await storage.getConversationsByProject(req.params.projectId);
      res.json(conversations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  app.post("/api/conversations", async (req, res) => {
    try {
      const userId = getSessionUserId(req);
      const ownedProject = await getOwnedProject(req.body.projectId, userId);
      if (!ownedProject) {
        return res.status(404).json({ error: "Project not found" });
      }
      const validatedData = insertConversationSchema.parse({ ...req.body, userId });
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
      const isOwned = await conversationOwnedByUser(req.params.conversationId, getSessionUserId(req));
      if (!isOwned) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      const { limit = "50", before, after, messageType } = req.query;
      const limitNum = Math.min(Math.max(parseInt(limit as string) || 50, 1), 200);

      const messages = await storage.getMessagesByConversation(
        req.params.conversationId,
        {
          limit: limitNum,
          before: before as string,
          after: after as string,
          messageType: messageType as string
        }
      );

      // Backfill agentRole for agent messages missing it in metadata
      // Batch: collect unique agentIds that need lookup, fetch each once
      const messagesNeedingBackfill = messages.filter(
        (msg) => msg.messageType === 'agent' && msg.agentId && !msg.metadata?.agentRole
      );

      let finalMessages = messages;
      if (messagesNeedingBackfill.length > 0) {
        // Deduplicate agentIds to avoid redundant DB fetches
        const agentIds = [...new Set(messagesNeedingBackfill.map((m) => m.agentId as string))];
        const agentMap = new Map<string, string | null>();

        await Promise.all(
          agentIds.map(async (agentId: string) => {
            const agent = await storage.getAgent(agentId);
            agentMap.set(agentId, agent?.role ?? null);
          })
        );

        finalMessages = messages.map((msg) => {
          if (msg.messageType === 'agent' && msg.agentId && !msg.metadata?.agentRole) {
            return {
              ...msg,
              metadata: { ...(msg.metadata || {}), agentRole: agentMap.get(msg.agentId) ?? null }
            };
          }
          return msg;
        });
      }

      // Return pagination envelope: hasMore signals there are older messages to load
      const hasMore = finalMessages.length === limitNum;
      const nextCursor = hasMore && finalMessages.length > 0
        ? (finalMessages[0].createdAt instanceof Date
            ? finalMessages[0].createdAt.toISOString()
            : String(finalMessages[0].createdAt))
        : null;

      res.json({ messages: finalMessages, hasMore, nextCursor });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // Add endpoint for creating messages in specific conversations
  app.post("/api/conversations/:conversationId/messages", async (req, res) => {
    try {
      const { conversationId } = req.params;
      const isOwned = await conversationOwnedByUser(conversationId, getSessionUserId(req));
      if (!isOwned) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      const messageData = {
        ...req.body,
        conversationId: conversationId
      };

      // Always use session userId — never trust client-supplied userId
      const uid = getSessionUserId(req);

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
      const messageConversationId = req.body.conversationId;
      if (!messageConversationId || !(await conversationOwnedByUser(messageConversationId, getSessionUserId(req)))) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      // Always use session userId — never trust client-supplied userId
      const uidGlobal = getSessionUserId(req);

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
      const isOwned = await conversationOwnedByUser(req.params.conversationId, getSessionUserId(req));
      if (!isOwned) {
        return res.status(404).json({ error: "Conversation not found" });
      }
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
      const isOwned = await conversationOwnedByUser(req.params.conversationId, getSessionUserId(req));
      if (!isOwned) {
        return res.status(404).json({ error: "Conversation not found" });
      }
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
      const ownedProject = await getOwnedProject(req.params.projectId, getSessionUserId(req));
      if (!ownedProject) {
        return res.status(404).json({ error: "Project not found" });
      }
      const archivedConversations = await storage.getArchivedConversations(req.params.projectId);
      res.json(archivedConversations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch archived conversations" });
    }
  });

  app.delete("/api/conversations/:conversationId", async (req, res) => {
    try {
      const isOwned = await conversationOwnedByUser(req.params.conversationId, getSessionUserId(req));
      if (!isOwned) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      const success = await storage.deleteConversation(req.params.conversationId);
      if (!success) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      res.json({ message: "Conversation deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete conversation" });
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

      // Verify message belongs to user's conversation
      const msg = await storage.getMessage(messageId);
      if (!msg || !(await conversationOwnedByUser(msg.conversationId, getSessionUserId(req)))) {
        return res.status(404).json({ error: 'Message not found' });
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

        // Bug 1: seed from DB so learning survives server restart
        try {
          const agentForSeed = await storage.getAgent(reactionData.agentId);
          const persisted = (agentForSeed?.personality as any);
          if (persisted?.adaptedTraits?.[userId] && persisted?.adaptationMeta?.[userId]) {
            personalityEngine.seedProfileFromDB(
              reactionData.agentId, userId,
              persisted.adaptedTraits[userId],
              persisted.adaptationMeta[userId]
            );
          }
        } catch { /* non-critical */ }

        personalityEngine.adaptPersonalityFromFeedback(
          reactionData.agentId,
          userId,
          feedback,
          '', // User message context would need to be passed from frontend
          '' // Agent response would need to be retrieved
        );

        // PRES-05: Persist adapted personality traits to database
        try {
          const updatedProfile = personalityEngine.getPersonalityProfile(reactionData.agentId, userId);
          const reactingAgent = await storage.getAgent(reactionData.agentId);
          if (reactingAgent) {
            const existingPersonality = (reactingAgent.personality as any) || {};
            await storage.updateAgent(reactionData.agentId, {
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

        // P4/P6: Hook living skills feedback into skill learner
        try {
          const reactedAgent = await storage.getAgent(reactionData.agentId);
          if (reactedAgent?.role) {
            markSkillUsed(reactedAgent.role, feedback);
          }
        } catch { /* non-critical */ }

        devLog(`B4: Personality feedback integrated: ${feedback} reaction for ${reactionData.agentId}`);
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
      const msg = await storage.getMessage(messageId);
      if (!msg || !(await conversationOwnedByUser(msg.conversationId, getSessionUserId(req)))) {
        return res.status(404).json({ error: 'Message not found' });
      }
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

      // Verify conversation belongs to user
      if (!conversationId || !(await conversationOwnedByUser(conversationId, getSessionUserId(req)))) {
        return res.status(404).json({ error: "Conversation not found" });
      }

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
}
