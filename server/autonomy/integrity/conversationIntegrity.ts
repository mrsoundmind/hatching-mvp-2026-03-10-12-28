import { randomUUID } from 'crypto';

interface ConversationState {
  lastTimestampMs: number;
  seenMessageIds: Set<string>;
  seenIdempotencyKeys: Set<string>;
}

const stateByConversation = new Map<string, ConversationState>();

function getState(conversationId: string): ConversationState {
  const existing = stateByConversation.get(conversationId);
  if (existing) return existing;
  const created: ConversationState = {
    lastTimestampMs: 0,
    seenMessageIds: new Set(),
    seenIdempotencyKeys: new Set(),
  };
  stateByConversation.set(conversationId, created);
  return created;
}

export function ensureMessageId(messageId?: string): string {
  const candidate = (messageId || '').trim();
  return candidate.length > 0 ? candidate : `msg-${randomUUID()}`;
}

export function assertUniqueMessageId(conversationId: string, messageId: string): { unique: boolean; reason?: string } {
  const state = getState(conversationId);
  if (state.seenMessageIds.has(messageId)) {
    return { unique: false, reason: 'duplicate_message_id' };
  }
  state.seenMessageIds.add(messageId);
  return { unique: true };
}

export function checkIdempotencyKey(conversationId: string, idempotencyKey?: string): {
  shouldProcess: boolean;
  reason?: string;
} {
  const key = (idempotencyKey || '').trim();
  if (!key) return { shouldProcess: true };

  const state = getState(conversationId);
  if (state.seenIdempotencyKeys.has(key)) {
    return { shouldProcess: false, reason: 'duplicate_idempotency_key' };
  }

  state.seenIdempotencyKeys.add(key);
  return { shouldProcess: true };
}

export function assertConversationOrdering(conversationId: string, messageTimestamp?: string): {
  inOrder: boolean;
  reason?: string;
} {
  if (!messageTimestamp) {
    return { inOrder: true };
  }

  const current = new Date(messageTimestamp).getTime();
  if (!Number.isFinite(current)) {
    return { inOrder: false, reason: 'invalid_timestamp' };
  }

  const state = getState(conversationId);
  if (current + 1_000 < state.lastTimestampMs) {
    return { inOrder: false, reason: 'out_of_order_timestamp' };
  }

  state.lastTimestampMs = Math.max(state.lastTimestampMs, current);
  return { inOrder: true };
}

export function resetConversationIntegrity(conversationId?: string): void {
  if (conversationId) {
    stateByConversation.delete(conversationId);
    return;
  }
  stateByConversation.clear();
}

export function getConversationIntegritySnapshot(conversationId: string): {
  seenMessageIds: number;
  seenIdempotencyKeys: number;
  lastTimestampMs: number;
} {
  const state = getState(conversationId);
  return {
    seenMessageIds: state.seenMessageIds.size,
    seenIdempotencyKeys: state.seenIdempotencyKeys.size,
    lastTimestampMs: state.lastTimestampMs,
  };
}
