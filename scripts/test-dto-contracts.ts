import { wsClientMessageSchema, wsServerMessageSchema } from '../shared/dto/wsSchemas.js';
import { healthResponseSchema } from '../shared/dto/apiSchemas.js';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
  const validClient = wsClientMessageSchema.safeParse({
    type: 'send_message_streaming',
    conversationId: 'project:abc',
    message: {
      content: 'hello',
      messageType: 'user',
      metadata: { idempotencyKey: 'k1' },
    },
  });
  assert(validClient.success, 'valid client message should pass');

  const invalidClient = wsClientMessageSchema.safeParse({
    type: 'send_message_streaming',
    conversationId: '',
    message: { content: '' },
  });
  assert(!invalidClient.success, 'invalid client message should fail');

  const validServer = wsServerMessageSchema.safeParse({
    type: 'streaming_chunk',
    messageId: 'm1',
    chunk: 'Hi',
    accumulatedContent: 'Hi',
  });
  assert(validServer.success, 'valid server message should pass');

  const invalidServer = wsServerMessageSchema.safeParse({
    type: 'unknown_server_event',
    payload: {},
  });
  assert(!invalidServer.success, 'unknown server message type should fail');

  const validHealth = healthResponseSchema.safeParse({
    status: 'ok',
    server: { status: 'ok', time: new Date().toISOString(), uptimeSec: 1 },
    websocket: { status: 'ok', activeConnections: 0 },
    provider: {
      mode: 'test',
      runtimeMode: 'deterministic-test',
      resolvedProvider: 'mock',
      model: 'mock-v1',
      status: 'ok',
      details: 'deterministic',
    },
    memory: { backend: 'db', durable: true, status: 'ok' },
    ollama: { status: 'degraded', reachable: false, modelAvailable: false, model: 'llama3.1:8b' },
    features: {
      peerPolicing: true,
      akl: true,
      taskGraph: true,
      toolRouter: true,
      autonomyDashboard: true,
    },
    budgets: {
      maxSearches: 3,
      maxPages: 6,
      maxReviewers: 2,
      maxRevisionCycles: 1,
      maxDeliberationRounds: 3,
      hardResponseTimeoutMs: 45000,
      singleResponseBudgetMs: 4000,
      deliberationBudgetMs: 12000,
      safetyTriggerBudgetMs: 1000,
    },
  });
  assert(validHealth.success, 'health response schema should pass valid payload');

  console.log('[test:dto] PASS');
}

main().catch((error) => {
  console.error('[test:dto] FAIL', error.message);
  process.exit(1);
});
