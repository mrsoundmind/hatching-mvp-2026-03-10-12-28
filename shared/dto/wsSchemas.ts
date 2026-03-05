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
]);

export const wsServerMessageSchema = requiredServerSchemas;

export type WSClientMessage = z.infer<typeof wsClientMessageSchema>;
export type WSServerMessage = z.infer<typeof wsServerMessageSchema>;
