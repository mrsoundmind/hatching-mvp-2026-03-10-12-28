import { generateChatWithRuntimeFallback, streamChatWithRuntimeFallback } from '../server/llm/providerResolver.js';

async function testFallbackChain() {
  process.env.LLM_MODE = 'test';
  process.env.TEST_LLM_PROVIDER = 'ollama';
  process.env.TEST_OLLAMA_MODEL = process.env.TEST_OLLAMA_MODEL || 'llama3.1:8b';

  const result = await generateChatWithRuntimeFallback({
    messages: [{ role: 'user', content: 'Summarize and propose next actions.' }],
    timeoutMs: 2_000,
    maxTokens: 120,
    seed: 42,
  });

  if (!result.metadata.provider) {
    throw new Error('fallback chain test missing provider metadata');
  }

  console.log(`[test:recovery] fallback provider=${result.metadata.provider} chain=${(result.metadata.fallbackChain || []).join(',') || 'none'}`);
}

async function testTimeoutHandling() {
  process.env.LLM_MODE = 'test';
  process.env.TEST_LLM_PROVIDER = 'mock';

  const streamed = await streamChatWithRuntimeFallback({
    messages: [{ role: 'user', content: 'Generate a long response for timeout behavior validation.' }],
    timeoutMs: 1_000,
    maxTokens: 200,
    seed: 42,
  });

  let chunks = 0;
  for await (const token of streamed.stream) {
    if (token) chunks += 1;
    if (chunks > 10) break;
  }

  if (chunks === 0) {
    throw new Error('stream recovery produced zero chunks');
  }

  console.log(`[test:recovery] stream chunks=${chunks}`);
}

async function main() {
  await testFallbackChain();
  await testTimeoutHandling();
  console.log('[test:recovery] PASS');
}

main().catch((error) => {
  console.error('[test:recovery] FAIL', error.message);
  process.exit(1);
});
