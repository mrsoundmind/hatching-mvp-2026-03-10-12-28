/**
 * Phase 1.2: Message Ingress Envelope Schema
 * 
 * Canonical validation for all incoming websocket messages.
 * Ensures every send_message_streaming payload is validated into a single canonical shape
 * before any storage or orchestration logic runs.
 */

import { z } from "zod";
import { parseConversationId } from "@shared/conversationId";

/**
 * Message Ingress Envelope Schema
 *
 * Validates incoming websocket messages and extracts canonical fields.
 * conversationId is required and must be project-/team-/agent- format (see refine).
 * Invalid payloads are rejected without crashing the process (handler catch-all).
 */
export const messageIngressEnvelopeSchema = z.object({
  type: z.literal("send_message_streaming"),
  conversationId: z.string().min(1, "conversationId is required"),
  message: z.object({
    content: z.string().min(1, "message content is required"),
    userId: z.string().optional(),
    messageType: z.enum(["user", "agent", "system"]).optional(),
    timestamp: z.string().optional(),
    senderName: z.string().optional(),
    parentMessageId: z.string().optional(),
    threadRootId: z.string().optional(),
    threadDepth: z.number().optional(),
    metadata: z.record(z.unknown()).optional(),
  }),
  addressedAgentId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
}).refine(
  (data) => {
    // Extract addressedAgentId: prefer top-level, fallback to metadata
    const addressedAgentId = data.addressedAgentId ||
      (data.metadata?.addressedAgentId as string | undefined);

    // Validate conversationId format matches mode
    try {
      const parsed = parseConversationId(data.conversationId);

      // Validate mode/contextId consistency
      if (parsed.scope === "project") {
        // Project mode: contextId must be undefined
        if (parsed.contextId !== undefined) {
          return false;
        }
        // conversationId must start with "project:"
        if (!data.conversationId.startsWith("project:")) {
          return false;
        }
      } else if (parsed.scope === "team") {
        // Team mode: contextId must be non-empty string
        if (!parsed.contextId || parsed.contextId.length === 0) {
          return false;
        }
        // conversationId must start with "team:"
        if (!data.conversationId.startsWith("team:")) {
          return false;
        }
      } else if (parsed.scope === "agent") {
        // Agent mode: contextId must be non-empty string
        if (!parsed.contextId || parsed.contextId.length === 0) {
          return false;
        }
        // conversationId must start with "agent:"
        if (!data.conversationId.startsWith("agent:")) {
          return false;
        }
      }

      return true;
    } catch {
      // If parsing fails, validation fails
      return false;
    }
  },
  {
    message: "conversationId format does not match mode, or mode/contextId are inconsistent",
  }
);

/**
 * Validated Message Ingress Envelope
 */
export type MessageIngressEnvelope = z.infer<typeof messageIngressEnvelopeSchema>;

/**
 * Parse and validate incoming websocket message
 * 
 * @param rawData - Raw websocket message data
 * @returns Validated envelope with canonical fields
 * @throws ZodError in dev/test, returns error response in production
 */
export function validateMessageIngress(rawData: unknown): {
  success: boolean;
  envelope?: MessageIngressEnvelope;
  error?: string;
  mode?: "project" | "team" | "agent";
  projectId?: string;
  contextId?: string | null;
  addressedAgentId?: string;
} {
  const isDev = process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";

  try {
    // Parse and validate envelope
    const envelope = messageIngressEnvelopeSchema.parse(rawData);

    // Extract addressedAgentId: prefer top-level, fallback to metadata
    const addressedAgentId = envelope.addressedAgentId ||
      (envelope.metadata?.addressedAgentId as string | undefined);

    // Parse conversationId to extract mode, projectId, contextId
    const parsed = parseConversationId(envelope.conversationId);

    return {
      success: true,
      envelope,
      mode: parsed.scope,
      projectId: parsed.projectId,
      contextId: parsed.contextId ?? null,
      addressedAgentId,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join(", ");

      if (isDev) {
        // Dev/test: throw with clear error
        throw new Error(`Invalid message ingress envelope: ${errorMessage}`);
      } else {
        // Production: return error response (do not crash)
        return {
          success: false,
          error: `Invalid message format: ${errorMessage}`,
        };
      }
    }

    // Unexpected error
    if (isDev) {
      throw error;
    } else {
      return {
        success: false,
        error: "Failed to validate message envelope",
      };
    }
  }
}

