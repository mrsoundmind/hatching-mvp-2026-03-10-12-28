/**
 * Phase 1.2: Invariant Assertions
 * 
 * Phase 1 invariants must be impossible to silently regress.
 * These assertions fail loud in dev/test, but gracefully handle in production.
 */

import { buildConversationId } from "@shared/conversationId";
import { storage } from "../storage";
import { getStorageModeInfo } from "../storage";

// Phase 1.2: Fail loud in dev/test, graceful in production
const isDev = process.env.NODE_ENV === "development" ||
  process.env.NODE_ENV === "test" ||
  process.env.DEV === "true";

/**
 * Assert Phase 1 invariants
 * 
 * @param params - Invariant assertion parameters
 * @throws Error in dev/test if invariant is violated
 * @returns void (logs warning in production, does not throw)
 */
export function assertPhase1Invariants(params: {
  type: "no_fake_system_agent" | "conversation_exists" | "routing_consistency";
  agentId?: string | null;
  messageType?: "user" | "agent" | "system";
  conversationId?: string;
  mode?: "project" | "team" | "agent";
  projectId?: string;
  contextId?: string | null;
}): void {
  const { type } = params;

  if (type === "no_fake_system_agent") {
    // Invariant: No fake "System agent"
    // If a response message is persisted with agentId === "system" → throw in dev/test
    // For system fallback, agentId must be null AND messageType must be "system"

    if (params.agentId === "system") {
      const error = new Error(
        "Phase 1 Invariant Violation: No fake 'System agent'. " +
        "System fallback must have agentId=null, not 'system'. " +
        `Got agentId='${params.agentId}', messageType='${params.messageType}'`
      );

      if (isDev) {
        throw error;
      } else {
        console.warn("[INVARIANT] " + error.message);
      }
    }

    // If messageType is 'system', agentId must be null
    if (params.messageType === "system" && params.agentId !== null) {
      const error = new Error(
        "Phase 1 Invariant Violation: System messages must have agentId=null. " +
        `Got agentId='${params.agentId}', messageType='${params.messageType}'`
      );

      if (isDev) {
        throw error;
      } else {
        console.warn("[INVARIANT] " + error.message);
      }
    }

  } else if (type === "conversation_exists") {
    // Invariant: Conversation existence
    // Before persisting any message, ensureConversationExists has been called
    // If missing in dev/test → throw

    if (!params.conversationId) {
      const error = new Error(
        "Phase 1 Invariant Violation: conversationId is required for conversation existence check"
      );

      if (isDev) {
        throw error;
      } else {
        console.warn("[INVARIANT] " + error.message);
        return;
      }
    }

    // Check if conversation exists in storage.
    // In memory mode we can inspect the internal Map directly.
    // In db mode there is no in-memory map to inspect synchronously.
    const conversations = (storage as any).conversations as Map<string, any> | undefined;
    const storageMode = getStorageModeInfo();

    if (!conversations && storageMode.mode === "db") {
      return;
    }

    const conversation = conversations?.get(params.conversationId);

    if (!conversation) {
      const error = new Error(
        `Phase 1 Invariant Violation: Conversation must exist before persisting messages. ` +
        `Missing conversation: ${params.conversationId}`
      );

      if (isDev) {
        throw error;
      } else {
        console.warn("[INVARIANT] " + error.message);
      }
    }

  } else if (type === "routing_consistency") {
    // Invariant: Routing consistency
    // For mode "project": conversationId must equal project:${projectId}
    // For mode "team": conversationId must equal team:${projectId}:${teamId}
    // For mode "agent": conversationId must equal agent:${projectId}:${agentId}
    // If mismatch in dev/test → throw

    if (!params.conversationId || !params.mode || !params.projectId) {
      const error = new Error(
        "Phase 1 Invariant Violation: conversationId, mode, and projectId are required for routing consistency check"
      );

      if (isDev) {
        throw error;
      } else {
        console.warn("[INVARIANT] " + error.message);
        return;
      }
    }

    let expectedConversationId: string;

    if (params.mode === "project") {
      expectedConversationId = buildConversationId("project", params.projectId);
      if (params.contextId !== null && params.contextId !== undefined) {
        const error = new Error(
          `Phase 1 Invariant Violation: Project mode must have contextId=null. ` +
          `Got contextId='${params.contextId}'`
        );

        if (isDev) {
          throw error;
        } else {
          console.warn("[INVARIANT] " + error.message);
        }
      }
    } else if (params.mode === "team") {
      if (!params.contextId) {
        const error = new Error(
          `Phase 1 Invariant Violation: Team mode must have non-empty contextId. ` +
          `Got contextId='${params.contextId}'`
        );

        if (isDev) {
          throw error;
        } else {
          console.warn("[INVARIANT] " + error.message);
          return;
        }
      }
      expectedConversationId = buildConversationId("team", params.projectId, params.contextId);
    } else if (params.mode === "agent") {
      if (!params.contextId) {
        const error = new Error(
          `Phase 1 Invariant Violation: Agent mode must have non-empty contextId. ` +
          `Got contextId='${params.contextId}'`
        );

        if (isDev) {
          throw error;
        } else {
          console.warn("[INVARIANT] " + error.message);
          return;
        }
      }
      expectedConversationId = buildConversationId("agent", params.projectId, params.contextId);
    } else {
      const error = new Error(
        `Phase 1 Invariant Violation: Invalid mode: ${params.mode}`
      );

      if (isDev) {
        throw error;
      } else {
        console.warn("[INVARIANT] " + error.message);
        return;
      }
    }

    if (params.conversationId !== expectedConversationId) {
      const error = new Error(
        `Phase 1 Invariant Violation: Routing consistency mismatch. ` +
        `Mode: ${params.mode}, ProjectId: ${params.projectId}, ContextId: ${params.contextId}. ` +
        `Expected conversationId: ${expectedConversationId}, Got: ${params.conversationId}`
      );

      if (isDev) {
        throw error;
      } else {
        console.warn("[INVARIANT] " + error.message);
      }
    }
  }
}
