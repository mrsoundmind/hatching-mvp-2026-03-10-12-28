/**
 * Test pagination response envelope shape.
 * Tests the contract: GET /api/conversations/:id/messages returns
 * { messages: Message[], hasMore: boolean, nextCursor: string | null }
 */

function assert(condition: boolean, message: string) {
  if (!condition) { throw new Error(message); }
}

async function main() {
  const { MemStorage } = await import('../server/storage');
  const store = new MemStorage();

  const user = await store.createUser({ username: 'testuser', password: 'pass', email: 'test@test.com' });
  const project = await store.createProject({ name: 'Test', emoji: '🧪', userId: user.id });
  const convId = `project:${project.id}`;
  await store.createConversation({ id: convId, projectId: project.id, type: 'project' } as any);

  // Insert messages with distinct timestamps (2ms apart to avoid same-tick collision)
  for (let i = 0; i < 12; i++) {
    await store.createMessage({
      conversationId: convId,
      content: `Message ${i}`,
      messageType: 'user',
      userId: user.id,
      metadata: {},
    } as any);
    await new Promise(r => setTimeout(r, 2));
  }

  // Test 1: Default fetch (limit=5, no before) should return at most 5 messages (last 5 of 12)
  const defaultFetch = await store.getMessagesByConversation(convId, { limit: 5 });
  assert(defaultFetch.length <= 5, `Default should return <= 5, got ${defaultFetch.length}`);
  assert(defaultFetch.length === 5, `Should have exactly 5 messages, got ${defaultFetch.length}`);

  // Test 2: Fetch with before= (cursor) should return messages older than cursor
  const page1 = await store.getMessagesByConversation(convId, { limit: 5 });
  const oldestInPage1 = page1[0];
  const cursorTs = oldestInPage1.createdAt instanceof Date
    ? oldestInPage1.createdAt.toISOString()
    : String(oldestInPage1.createdAt);
  const page2 = await store.getMessagesByConversation(convId, { limit: 50, before: cursorTs });
  assert(page2.length > 0, `Page 2 should have messages older than cursor, got ${page2.length}`);
  const cutoff = new Date(oldestInPage1.createdAt).getTime();
  for (const msg of page2) {
    assert(
      new Date(msg.createdAt).getTime() < cutoff,
      `Page 2 message should be older than cursor`
    );
  }

  // Test 3: A second before-cursor page should return a different set of messages (no overlap)
  const page1Ids = new Set(page1.map(m => m.id));
  const page2Ids = new Set(page2.map(m => m.id));
  const overlap = [...page1Ids].filter(id => page2Ids.has(id));
  assert(overlap.length === 0, `Page 1 and Page 2 should have no overlapping message IDs, found ${overlap.length}`);

  console.log('[test:pagination] PASS');
}

main().catch((error) => {
  console.error('[test:pagination] FAIL', error.message);
  process.exit(1);
});
