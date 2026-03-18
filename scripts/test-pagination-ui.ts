/**
 * Test the pagination UI logic extracted from CenterPanel:
 * - Response envelope select transform (normalizes bare array vs envelope)
 * - hasMore state tracking
 * - Test 1: select transform normalizes a bare array response into { messages, hasMore: false, nextCursor: null }
 */

function assert(condition: boolean, message: string) {
  if (!condition) { throw new Error(message); }
}

function selectTransform(data: any): { messages: any[]; hasMore: boolean; nextCursor: string | null } {
  if (Array.isArray(data)) {
    return { messages: data, hasMore: false, nextCursor: null };
  }
  return data;
}

async function main() {
  // Test 1: Bare array response (backward compat with old API format)
  const bareArray = [{ id: '1', content: 'hello' }, { id: '2', content: 'world' }];
  const result1 = selectTransform(bareArray);
  assert(result1.hasMore === false, 'bare array hasMore should be false');
  assert(result1.nextCursor === null, 'bare array nextCursor should be null');

  // Test 2: Proper envelope response (new format) passes through unchanged
  const envelope = {
    messages: [{ id: '3', content: 'msg3' }],
    hasMore: true,
    nextCursor: '2026-01-01T00:00:00.000Z',
  };
  const result2 = selectTransform(envelope);
  assert(JSON.stringify(result2.messages) === JSON.stringify(envelope.messages), 'envelope messages should match');
  assert(result2.hasMore === true, 'envelope hasMore should be true');
  assert(result2.nextCursor === '2026-01-01T00:00:00.000Z', 'envelope nextCursor should match');

  // Test 3: When hasMore=true, loadEarlierMessages builds URL with before=cursor&limit=50
  function buildLoadEarlierUrl(conversationId: string, cursor: string): string {
    return `/api/conversations/${conversationId}/messages?before=${encodeURIComponent(cursor)}&limit=50`;
  }
  const cursor = '2026-01-15T12:00:00.000Z';
  const url = buildLoadEarlierUrl('project:abc-123', cursor);
  assert(url.includes('before=2026-01-15T12%3A00%3A00.000Z'), `URL should contain encoded cursor, got: ${url}`);
  assert(url.includes('limit=50'), 'URL should contain limit=50');

  // Test 4: When hasMore=false, loadEarlierMessages is a no-op (does not fetch)
  let fetchCalled = false;
  async function loadEarlierMessages(hasMore: boolean, nextCursor: string | null) {
    if (!hasMore || !nextCursor) return;
    fetchCalled = true;
  }
  await loadEarlierMessages(false, null);
  assert(fetchCalled === false, 'loadEarlierMessages should not fetch when hasMore=false');

  await loadEarlierMessages(true, '2026-01-15T12:00:00.000Z');
  assert(fetchCalled === true, 'loadEarlierMessages should fetch when hasMore=true and cursor present');

  console.log('[test:pagination-ui] PASS');
}

main().catch((error) => {
  console.error('[test:pagination-ui] FAIL', error.message);
  process.exit(1);
});
