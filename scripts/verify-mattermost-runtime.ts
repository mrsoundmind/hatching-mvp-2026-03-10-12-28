/**
 * Runtime end-to-end verification for the Mattermost outbound notifier (Release 1 Phase 1).
 * Stands up a LOCAL mock Mattermost server, configures the connection via env, and fires real
 * events through the actual code path (including logAutonomyEvent's lazy fire-and-forget hook),
 * asserting a real HTTP POST arrives with the correctly formatted message.
 *
 * Run: PATH=/opt/homebrew/bin:$PATH node_modules/.bin/tsx scripts/verify-mattermost-runtime.ts
 */

import http from 'node:http';
import assert from 'node:assert/strict';
import type { AutonomyEvent, AutonomyEventType } from '../server/autonomy/events/eventTypes.js';

interface Captured {
  method: string | undefined;
  url: string | undefined;
  auth: string | undefined;
  contentType: string | undefined;
  body: string;
}
const captured: Captured[] = [];

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    captured.push({
      method: req.method,
      url: req.url,
      auth: req.headers['authorization'] as string | undefined,
      contentType: req.headers['content-type'] as string | undefined,
      body,
    });
    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ id: 'mock-post-1' }));
  });
});

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function waitForCaptureCount(n: number, timeoutMs = 3000): Promise<void> {
  const start = Date.now();
  while (captured.length < n && Date.now() - start < timeoutMs) await wait(25);
}

function evt(partial: Partial<AutonomyEvent> & { eventType: AutonomyEventType }): AutonomyEvent {
  return {
    eventType: partial.eventType,
    timestamp: '', traceId: '', turnId: '', requestId: '',
    userId: null, projectId: 'proj-runtime', teamId: null, conversationId: null, hatchId: null,
    provider: null, mode: null, latencyMs: null, confidence: null, riskScore: null,
    payload: {},
    ...partial,
  };
}

let pass = 0;
let fail = 0;
async function check(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    pass++;
    console.log('  ✓', name);
  } catch (e) {
    fail++;
    console.error('  ✗', name, '\n     ', (e as Error).message);
  }
}

(async () => {
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  // Configure the connection. No DATABASE_URL so logAutonomyEvent uses the file fallback and never
  // touches the real Supabase DB during this test.
  process.env.MATTERMOST_BASE_URL = baseUrl;
  process.env.MATTERMOST_BOT_TOKEN = 'runtime-tok';
  process.env.MATTERMOST_CHANNEL_ID = 'runtime-chan';
  process.env.MATTERMOST_PROJECT_ID = 'proj-runtime';
  process.env.APP_BASE_URL = 'https://hatchin.app';
  delete process.env.DATABASE_URL;

  // Import AFTER env is set (modules read env at call time, but be safe).
  const { dispatchAutonomyEvent } = await import('../server/integrations/notifier.js');
  const { logAutonomyEvent } = await import('../server/autonomy/events/eventLogger.js');

  console.log(`Mock Mattermost listening at ${baseUrl}\n`);

  // 1. Direct dispatch of a real approval event → one real HTTP POST, correctly shaped.
  await check('dispatch approval_required → real POST to /api/v4/posts with formatted message', async () => {
    await dispatchAutonomyEvent(
      evt({ eventType: 'approval_required', payload: { taskTitle: 'Send the launch email', agentName: 'Kai', riskReasons: ['destructive_verb_critical', 'bulk_scope_modifier'] } }),
    );
    await waitForCaptureCount(1);
    assert.equal(captured.length, 1, 'expected exactly one POST');
    const c = captured[0];
    assert.equal(c.method, 'POST');
    assert.equal(c.url, '/api/v4/posts');
    assert.equal(c.auth, 'Bearer runtime-tok');
    assert.match(c.contentType || '', /application\/json/);
    const body = JSON.parse(c.body);
    assert.equal(body.channel_id, 'runtime-chan');
    assert.match(body.message, /Kai/);
    assert.match(body.message, /Send the launch email/);
    assert.match(body.message, /deleting or destroying data/);      // humanized
    assert.match(body.message, /Affects many items at once/);
    assert.match(body.message, /https:\/\/hatchin\.app\/maya\/proj-runtime/); // deep link
    assert.doesNotMatch(body.message, /destructive_verb_critical/); // raw code never leaks
  });

  // 2. Non-enabled event type (task_completed) → NO new POST (approvals-only default).
  await check('dispatch task_completed → no POST (not enabled by default)', async () => {
    const before = captured.length;
    await dispatchAutonomyEvent(evt({ eventType: 'task_completed', payload: { agentName: 'Dev', taskTitle: 'x' } }));
    await wait(150);
    assert.equal(captured.length, before, 'task_completed should not post by default');
  });

  // 3. Wrong project → NO new POST.
  await check('dispatch approval_required for another project → no POST', async () => {
    const before = captured.length;
    await dispatchAutonomyEvent(evt({ eventType: 'approval_required', projectId: 'some-other-project', payload: { taskTitle: 't', agentName: 'A' } }));
    await wait(150);
    assert.equal(captured.length, before);
  });

  // 4. THE REAL HOOK: logAutonomyEvent fires the notifier (fire-and-forget) → a POST lands.
  await check('logAutonomyEvent(approval_required) → hook fires notifier → real POST lands', async () => {
    const before = captured.length;
    const returned = await logAutonomyEvent(
      evt({ eventType: 'approval_required', payload: { taskTitle: 'Delete the staging database', agentName: 'Remy', riskReasons: ['destructive_verb_critical'] } }),
    );
    assert.equal(returned.eventType, 'approval_required', 'logAutonomyEvent must still return the event');
    await waitForCaptureCount(before + 1);
    assert.equal(captured.length, before + 1, 'the hook should have produced exactly one POST');
    const body = JSON.parse(captured[captured.length - 1].body);
    assert.match(body.message, /Remy/);
    assert.match(body.message, /Delete the staging database/);
  });

  // 5. Feature off (no config) → dispatch is a silent no-op, no POST, no throw.
  await check('no config → dispatch is a no-op (no POST, no throw)', async () => {
    const saved = { ...process.env };
    delete process.env.MATTERMOST_BASE_URL;
    delete process.env.MATTERMOST_BOT_TOKEN;
    delete process.env.MATTERMOST_CHANNEL_ID;
    delete process.env.MATTERMOST_PROJECT_ID;
    const before = captured.length;
    try {
      await dispatchAutonomyEvent(evt({ eventType: 'approval_required', payload: { taskTitle: 't', agentName: 'A' } }));
      await wait(100);
      assert.equal(captured.length, before);
    } finally {
      Object.assign(process.env, saved);
    }
  });

  console.log(`\n${pass} passed, ${fail} failed`);
  await new Promise<void>((r) => server.close(() => r()));
  process.exit(fail ? 1 : 0);
})();
