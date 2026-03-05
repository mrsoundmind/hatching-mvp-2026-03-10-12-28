import {
  assertConversationOrdering,
  assertUniqueMessageId,
  checkIdempotencyKey,
  resetConversationIntegrity,
  getConversationIntegritySnapshot,
} from '../server/autonomy/integrity/conversationIntegrity.js';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const conversationId = 'project:test-integrity';
  resetConversationIntegrity(conversationId);

  const firstId = assertUniqueMessageId(conversationId, 'm-1');
  assert(firstId.unique, 'first id should be unique');

  const duplicateId = assertUniqueMessageId(conversationId, 'm-1');
  assert(!duplicateId.unique, 'duplicate id should be rejected');

  const firstKey = checkIdempotencyKey(conversationId, 'idem-1');
  assert(firstKey.shouldProcess, 'first idempotency key should pass');

  const duplicateKey = checkIdempotencyKey(conversationId, 'idem-1');
  assert(!duplicateKey.shouldProcess, 'duplicate idempotency key should be blocked');

  const t1 = assertConversationOrdering(conversationId, '2026-03-04T10:00:00.000Z');
  assert(t1.inOrder, 'first timestamp should pass ordering');

  const t2 = assertConversationOrdering(conversationId, '2026-03-04T09:59:00.000Z');
  assert(!t2.inOrder, 'older timestamp should fail ordering');

  const t3 = assertConversationOrdering(conversationId, '2026-03-04T10:01:00.000Z');
  assert(t3.inOrder, 'newer timestamp should pass ordering');

  const snapshot = getConversationIntegritySnapshot(conversationId);
  assert(snapshot.seenMessageIds === 1, 'snapshot should track one unique message id');
  assert(snapshot.seenIdempotencyKeys === 1, 'snapshot should track one unique idempotency key');

  console.log('[test:integrity] PASS');
}

main().catch((error) => {
  console.error('[test:integrity] FAIL', error.message);
  process.exit(1);
});
