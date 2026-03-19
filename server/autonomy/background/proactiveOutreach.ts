const devLog = (...args: unknown[]) => { if (process.env.NODE_ENV !== "production") console.log(...args); };
// Proactive Outreach — Generates and sends in-character proactive messages
// Called by backgroundRunner when a FrictionAction is selected.
// Uses Gemini Flash for low-cost generation. Rate-limited per agent per 24h.

import { FrictionAction } from "./frictionMap.js";
import { getCharacterProfile } from "../../ai/characterProfiles.js";
import { logAutonomyEvent } from "../events/eventLogger.js";


interface SendProactiveMessageDeps {
  storage: {
    createMessage: (msg: {
      id: string;
      conversationId: string;
      content: string;
      messageType: string;
      agentId: string | null;
      userId: string | null;
      metadata: Record<string, unknown>;
    }) => Promise<{ id: string; content: string; messageType: string }>;
    updateAgent: (id: string, updates: Record<string, unknown>) => Promise<unknown>;
    getAgent: (id: string) => Promise<{ id: string; name: string; role: string; personality?: Record<string, unknown> | null } | undefined>;
  };
  broadcastToConversation: (conversationId: string, payload: unknown) => void;
  generateText: (prompt: string, systemPrompt: string, maxTokens?: number) => Promise<string>;
}

export async function sendProactiveMessage(
  action: FrictionAction,
  deps: SendProactiveMessageDeps
): Promise<void> {
  try {
    const profile = getCharacterProfile(action.agentRole);
    const agentName = profile?.characterName ?? action.agentName;

    const systemPrompt = `You are ${agentName} (${action.agentRole}). You're a team member sending a brief, natural check-in message.

RULES:
- Maximum 2 sentences
- Do NOT start with "I noticed", "Hey", "Hi", "Just checking", or "I wanted to"
- Sound like a real colleague who spotted something, not an AI assistant
- Be specific about what you noticed
- Offer one concrete next step or question
- No bullet points, no headers`;

    const userPrompt = `You noticed this about the project: ${action.context}

Write a short in-character message (as ${agentName}) that addresses this naturally. Make it feel like something a thoughtful team member would send.`;

    const messageContent = await deps.generateText(
      userPrompt,
      systemPrompt,
      80
    );

    if (!messageContent || messageContent.trim().length < 5) {
      devLog("[ProactiveOutreach] Empty message generated, skipping");
      return;
    }

    const messageId = crypto.randomUUID();
    const message = await deps.storage.createMessage({
      id: messageId,
      conversationId: action.targetConversationId,
      content: messageContent.trim(),
      messageType: "agent",
      agentId: action.agentId,
      userId: null,
      metadata: {
        isProactive: true,
        frictionType: action.frictionType,
        generatedAt: new Date().toISOString(),
      },
    });

    // Broadcast to connected clients (increments unread for those not in this conversation)
    deps.broadcastToConversation(action.targetConversationId, {
      type: "new_message",
      conversationId: action.targetConversationId,
      message,
    });

    // Update lastProactiveAt on the agent's personality
    const agent = await deps.storage.getAgent(action.agentId);
    if (agent) {
      const existingPersonality = (agent.personality as Record<string, unknown>) ?? {};
      await deps.storage.updateAgent(action.agentId, {
        personality: {
          ...existingPersonality,
          lastProactiveAt: new Date().toISOString(),
        },
      });
    }

    await logAutonomyEvent({
      eventType: "proactive_outreach_sent" as any,
      traceId: crypto.randomUUID(),
      userId: null,
      projectId: action.targetConversationId.replace("project:", ""),
      teamId: null,
      conversationId: action.targetConversationId,
      hatchId: action.agentId,
      provider: null,
      mode: null,
      latencyMs: null,
      confidence: null,
      riskScore: null,
      payload: {
        frictionType: action.frictionType,
        agentRole: action.agentRole,
        severity: action.severity,
      } as any,
    });

    devLog(
      `[ProactiveOutreach] Sent proactive message from ${agentName} in ${action.targetConversationId}`
    );
  } catch (err) {
    devLog(
      `[ProactiveOutreach] Error sending proactive message: ${(err as Error).message}`
    );
  }
}
