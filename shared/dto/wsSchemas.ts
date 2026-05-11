import { z } from 'zod';

const joinConversationSchema = z.object({
  type: z.literal('join_conversation'),
  conversationId: z.string().min(1),
});

const cancelStreamingSchema = z.object({
  type: z.literal('cancel_streaming'),
  messageId: z.string().optional(),
  conversationId: z.string().optional(),
});

const sendMessageSchema = z.object({
  type: z.literal('send_message'),
  conversationId: z.string().min(1),
  message: z.object({
    conversationId: z.string().optional(),
    userId: z.string().optional(),
    agentId: z.string().optional(),
    content: z.string().min(1),
    messageType: z.enum(['user', 'agent', 'system']).optional(),
    metadata: z.record(z.unknown()).optional(),
  }),
});

const sendMessageStreamingSchema = z.object({
  type: z.literal('send_message_streaming'),
  conversationId: z.string().min(1),
  message: z.object({
    content: z.string().min(1),
    userId: z.string().optional(),
    messageType: z.enum(['user', 'agent', 'system']).optional(),
    timestamp: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
  }),
  addressedAgentId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const typingStartSchema = z.object({
  type: z.literal('start_typing'),
  conversationId: z.string().min(1),
  agentId: z.string().min(1),
  estimatedDuration: z.number().optional(),
});

const typingStopSchema = z.object({
  type: z.literal('stop_typing'),
  conversationId: z.string().min(1),
  agentId: z.string().min(1),
});

export const wsClientMessageSchema = z.union([
  joinConversationSchema,
  sendMessageStreamingSchema,
  cancelStreamingSchema,
  sendMessageSchema,
  typingStartSchema,
  typingStopSchema,
]);

const requiredServerSchemas = z.union([
  z.object({
    type: z.literal('connection_confirmed'),
    conversationId: z.string(),
  }),
  z.object({
    type: z.literal('new_message'),
    conversationId: z.string().optional(),
    message: z.record(z.unknown()),
  }),
  z.object({
    type: z.literal('streaming_started'),
    messageId: z.string(),
    agentId: z.string().optional(),
    agentName: z.string().optional(),
  }),
  z.object({
    type: z.literal('streaming_chunk'),
    messageId: z.string(),
    chunk: z.string(),
    accumulatedContent: z.string().optional(),
  }),
  z.object({
    type: z.literal('streaming_completed'),
    messageId: z.string(),
    message: z.record(z.unknown()).optional().nullable(),
  }),
  z.object({
    type: z.literal('streaming_error'),
    messageId: z.string().optional(),
    code: z.string().optional(),
    error: z.string().optional(),
  }),
  z.object({
    type: z.literal('error'),
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  }),
  z.object({
    type: z.literal('chat_message'),
    conversationId: z.string().optional(),
    message: z.record(z.unknown()),
  }),
  z.object({
    type: z.literal('streaming_cancelled'),
  }).passthrough(),
  z.object({
    type: z.literal('typing_started'),
  }).passthrough(),
  z.object({
    type: z.literal('typing_stopped'),
  }).passthrough(),
  z.object({
    type: z.literal('conversation_exists'),
  }).passthrough(),
  z.object({
    type: z.literal('conductor_decision'),
  }).passthrough(),
  z.object({
    type: z.literal('synthesis_completed'),
  }).passthrough(),
  z.object({
    type: z.literal('safety_intervention'),
  }).passthrough(),
  z.object({
    type: z.literal('peer_review_revision'),
  }).passthrough(),
  z.object({
    type: z.literal('knowledge_update_status'),
  }).passthrough(),
  z.object({
    type: z.literal('task_suggestions'),
  }).passthrough(),
  z.object({
    type: z.literal('task_graph_created'),
  }).passthrough(),
  z.object({
    type: z.literal('decision_forecast'),
  }).passthrough(),
  z.object({
    type: z.literal('action_proposal_created'),
  }).passthrough(),
  z.object({
    type: z.literal('project_brain_updated'),
  }).passthrough(),
  z.object({
    type: z.literal('task_created'),
  }).passthrough(),
  // 🆕 Project realtime events
  z.object({
    type: z.literal('project_created'),
    project: z.record(z.unknown()),
    userId: z.string(),
  }),
  // 🆕 Chat Intelligence Events
  z.object({
    type: z.literal('teams_auto_hatched'),
    projectId: z.string(),
    teams: z.array(z.record(z.unknown())),
    agents: z.array(z.record(z.unknown())),
  }),
  z.object({
    type: z.literal('task_created_from_chat'),
    projectId: z.string(),
    task: z.record(z.unknown()),
  }),
  z.object({
    type: z.literal('brain_updated_from_chat'),
    projectId: z.string(),
    field: z.string(),
    value: z.string(),
    updatedBy: z.string().optional(),
  }),
  // Autonomy execution events
  z.object({
    type: z.literal('task_requires_approval'),
    taskId: z.string(),
    agentName: z.string(),
    riskReasons: z.array(z.string()).optional(),
  }),
  z.object({
    type: z.literal('task_execution_completed'),
    taskId: z.string(),
    agentId: z.string(),
    agentName: z.string(),
  }),
  z.object({
    type: z.literal('background_execution_started'),
  }).passthrough(),
  z.object({
    type: z.literal('background_execution_completed'),
  }).passthrough(),
  z.object({
    type: z.literal('task_execution_failed'),
  }).passthrough(),
  z.object({
    type: z.literal('handoff_cycle_detected'),
    projectId: z.string(),
    chain: z.array(z.string()),
  }),
  z.object({
    type: z.literal('handoff_chain_completed'),
    projectId: z.string(),
    reason: z.string(),
    hops: z.number(),
  }),
  // Smart task detection events
  z.object({
    type: z.literal('task_created_direct'),
  }).passthrough(),
  z.object({
    type: z.literal('task_lifecycle_result'),
  }).passthrough(),
  z.object({
    type: z.literal('task_completion_suggested'),
  }).passthrough(),
  z.object({
    type: z.literal('return_briefing'),
    projectId: z.string(),
    summary: z.string(),
    completedTasks: z.number(),
    newMessages: z.number(),
  }),
  z.object({
    type: z.literal('task_approval_rejected'),
    taskId: z.string(),
  }),
  // Billing events
  z.object({
    type: z.literal('upgrade_required'),
    reason: z.string(),
    currentUsage: z.number(),
    limit: z.number(),
    upgradeUrl: z.string().optional(),
  }),
  z.object({
    type: z.literal('usage_warning'),
    reason: z.literal('approaching_limit'),
    currentUsage: z.number(),
    limit: z.number(),
    percentUsed: z.number(),
  }),
  // Project events
  z.object({
    type: z.literal('project_updated'),
    projectId: z.string(),
    name: z.string().optional(),
    updatedBy: z.string().optional(),
  }),
  z.object({
    type: z.literal('project_brain_updated'),
    projectId: z.string(),
    field: z.string().optional(),
    value: z.unknown().optional(),
    source: z.string().optional(),
    patch: z.record(z.unknown()).optional(),
  }),
  // Safety events
  z.object({
    type: z.literal('safety_intervention'),
    conversationId: z.string().optional(),
    messageId: z.string().optional(),
    safetyScore: z.record(z.unknown()).optional(),
    decision: z.record(z.unknown()).optional(),
    content: z.string().optional(),
  }),
  // v2.0: Deliverable events
  z.object({
    type: z.literal('deliverable_created'),
    deliverable: z.record(z.unknown()),
    generationTimeMs: z.number().optional(),
  }),
  z.object({
    type: z.literal('deliverable_updated'),
    deliverableId: z.string(),
    status: z.string().optional(),
  }),
  z.object({
    type: z.literal('package_complete'),
    packageId: z.string(),
    packageName: z.string(),
    deliverableCount: z.number(),
    skippedSteps: z.array(z.record(z.unknown())).optional(),
    totalTimeMs: z.number().optional(),
  }),
  z.object({
    type: z.literal('deliverable_proposal'),
    proposalType: z.string(),
    title: z.string(),
    agentName: z.string(),
    agentRole: z.string(),
    confidence: z.number(),
  }),
  // Phase 35: Provider health / graceful degradation banner events.
  // SECURITY: Both schemas use .strict() to reject unknown keys at the validation
  // boundary. Default Zod 'strip' mode would silently drop extra fields, which would
  // let a future server bug leak provider identity (e.g. {provider:'openai'}) without
  // detection. T-35-01 mitigation depends on .strict() being present here.
  z.object({
    type: z.literal('provider_degraded'),
    reason: z.string().min(1).max(200),
  }).strict(),
  z.object({
    type: z.literal('provider_recovered'),
  }).strict(),
]);

export const wsServerMessageSchema = requiredServerSchemas;

export type WSClientMessage = z.infer<typeof wsClientMessageSchema>;
export type WSServerMessage = z.infer<typeof wsServerMessageSchema>;
