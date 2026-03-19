import {
  checkIdempotencyKey,
  resetConversationIntegrity,
} from '../server/autonomy/integrity/conversationIntegrity';

function assert(condition: boolean, message: string) {
  if (!condition) { throw new Error(message); }
}

async function main() {
  const conversationId = 'project:test-idem-e2e';
  resetConversationIntegrity(conversationId);

  // Test 1: First message with idempotencyKey passes
  const key1 = `idem-${Date.now()}-abc`;
  const result1 = checkIdempotencyKey(conversationId, key1);
  assert(result1.shouldProcess === true, 'First send should be processed');

  // Test 2: Same idempotencyKey is blocked (simulates network retry)
  const result2 = checkIdempotencyKey(conversationId, key1);
  assert(result2.shouldProcess === false, 'Duplicate key should be blocked');
  assert(result2.reason === 'duplicate_idempotency_key', `Reason should be duplicate_idempotency_key, got: ${result2.reason}`);

  // Test 3: Different idempotencyKey passes
  const key2 = `idem-${Date.now()}-def`;
  const result3 = checkIdempotencyKey(conversationId, key2);
  assert(result3.shouldProcess === true, 'Different key should pass');

  // Test 4: Missing idempotencyKey always passes (backward compat)
  const result4 = checkIdempotencyKey(conversationId, undefined);
  assert(result4.shouldProcess === true, 'Missing key should pass');

  // Test 5: Empty string idempotencyKey always passes (backward compat)
  const result5 = checkIdempotencyKey(conversationId, '');
  assert(result5.shouldProcess === true, 'Empty key should pass');

  console.log('[test:idempotency-e2e] PASS');
}

main().catch((error) => {
  console.error('[test:idempotency-e2e] FAIL', error.message);
  process.exit(1);
});
