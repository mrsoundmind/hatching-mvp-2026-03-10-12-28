/**
 * Tests for the Slack Socket Mode inbound path (channel bridge, Slack adapter).
 * Run: PATH=/opt/homebrew/bin:$PATH node_modules/.bin/tsx scripts/test-slack-socket.ts
 *
 * Part A: pure protocol (frame parse, ack shape, apps.connections.open over a mock fetch).
 * Part B: processInteractive against a real in-memory store — the SAME resolveTaskApproval the web UI
 *         and the Mattermost callback use — asserting approve/reject/stale, and that the card is edited
 *         in place via a mocked chat.update.
 */

import assert from 'node:assert/strict';

// Force in-memory storage. db.ts throws at import unless DATABASE_URL is set (even in memory mode);
// set a placeholder for the import, then delete it so logAutonomyEvent uses its file fallback.
process.env.STORAGE_MODE = 'memory';
process.env.DATABASE_URL = 'postgres://placeholder:placeholder@127.0.0.1:5432/none';

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
  const { parseSocketMessage, buildAck, openSocketUrl, processInteractive } = await import(
    '../server/integrations/slack/socketMode.js'
  );
  const { getSlackConfig } = await import('../server/integrations/slack/config.js');
  const { ACTION_APPROVE, ACTION_REJECT } = await import('../server/integrations/slack/approvalBlocks.js');
  const { storage } = await import('../server/storage.js');
  delete process.env.DATABASE_URL; // MemStorage now loaded; keep logAutonomyEvent on the file fallback

  const cfg = getSlackConfig({
    SLACK_BOT_TOKEN: 'xoxb-abc', SLACK_APP_TOKEN: 'xapp-def',
    SLACK_CHANNEL_ID: 'C123', SLACK_PROJECT_ID: 'proj-1', APP_BASE_URL: 'https://hatchin.app',
  } as NodeJS.ProcessEnv)!;

  // ── Part A: protocol ──────────────────────────────────────────────────────────
  await check('parseSocketMessage: hello / disconnect / envelope / unparseable', () => {
    assert.deepEqual(parseSocketMessage(JSON.stringify({ type: 'hello' })), { kind: 'hello' });
    assert.deepEqual(parseSocketMessage(JSON.stringify({ type: 'disconnect', reason: 'refresh_requested' })), { kind: 'disconnect', reason: 'refresh_requested' });
    const env = parseSocketMessage(JSON.stringify({ envelope_id: 'E1', type: 'interactive', payload: { a: 1 }, accepts_response_payload: false }));
    assert.equal(env.kind, 'envelope');
    if (env.kind === 'envelope') { assert.equal(env.envelopeId, 'E1'); assert.equal(env.type, 'interactive'); }
    assert.equal(parseSocketMessage('not json').kind, 'other');
  });
  await check('buildAck: echoes the envelope id and nothing else', () => {
    assert.deepEqual(JSON.parse(buildAck('E42')), { envelope_id: 'E42' });
  });
  await check('openSocketUrl: returns url on ok, throws on error', async () => {
    const okFetch = (async () => ({ ok: true, status: 200, statusText: 'OK', text: async () => '', json: async () => ({ ok: true, url: 'wss://wss.slack.com/link/?ticket=x' }) })) as any;
    assert.equal(await openSocketUrl(cfg, okFetch), 'wss://wss.slack.com/link/?ticket=x');
    const badFetch = (async () => ({ ok: true, status: 200, statusText: 'OK', text: async () => '', json: async () => ({ ok: false, error: 'invalid_auth' }) })) as any;
    await assert.rejects(openSocketUrl(cfg, badFetch), /invalid_auth/);
  });

  // ── Part B: processInteractive against MemStorage ───────────────────────────────
  const broadcasts = (() => {
    const conv: any[] = [];
    const proj: any[] = [];
    return { conv, proj, broadcastToConversation: (c: string, d: unknown) => conv.push({ c, d }), broadcastToProject: (p: string, d: unknown) => proj.push({ p, d }) };
  })();

  // Records every chat.update the handler makes, so we can assert the card was rewritten.
  const updateCalls: any[] = [];
  const recordingFetch = (async (_url: string, init: any) => {
    updateCalls.push(JSON.parse(init.body));
    return { ok: true, status: 200, statusText: 'OK', text: async () => '', json: async () => ({ ok: true }) };
  }) as any;

  const project = await storage.createProject({ userId: 'user-1', name: 'Slack Test' } as any);
  const PROJECT_ID = project.id;

  async function seedAwaitingTask(title: string): Promise<string> {
    const t = await storage.createTask({ projectId: PROJECT_ID, title, assignee: 'Kai', status: 'blocked' } as any);
    await storage.updateTask(t.id, { status: 'blocked', metadata: { awaitingApproval: true, draftOutput: `DRAFT for ${title}` } as any });
    return t.id;
  }

  const blockActions = (action: string, taskId: string) => ({
    type: 'block_actions', channel: { id: 'C123' }, message: { ts: '100.200' },
    actions: [{ action_id: action, value: taskId }],
  });

  await check('interactive approve: task completes + card rewritten to Approved', async () => {
    const id = await seedAwaitingTask('Send launch email');
    updateCalls.length = 0;
    const r = await processInteractive(blockActions(ACTION_APPROVE, id), cfg, broadcasts, recordingFetch);
    assert.equal(r.handled, true);
    assert.equal(r.ok, true);
    const t = await storage.getTask(id);
    assert.equal(t!.status, 'completed');
    assert.equal(updateCalls.length, 1);
    assert.equal(updateCalls[0].ts, '100.200');
    assert.match(updateCalls[0].text, /Approved/);
  });

  await check('interactive reject: task resets + card rewritten to Rejected', async () => {
    const id = await seedAwaitingTask('Delete staging DB');
    updateCalls.length = 0;
    const r = await processInteractive(blockActions(ACTION_REJECT, id), cfg, broadcasts, recordingFetch);
    assert.equal(r.ok, true);
    const t = await storage.getTask(id);
    assert.equal(t!.status, 'todo');
    assert.match(updateCalls[0].text, /Rejected/);
  });

  await check('interactive stale click: already-resolved task no-ops, card says no longer awaiting', async () => {
    const t = await storage.createTask({ projectId: PROJECT_ID, title: 'Already done', status: 'completed' } as any);
    updateCalls.length = 0;
    const r = await processInteractive(blockActions(ACTION_APPROVE, t.id), cfg, broadcasts, recordingFetch);
    assert.equal(r.handled, true);
    assert.equal(r.ok, false);
    const after = await storage.getTask(t.id);
    assert.equal(after!.status, 'completed', 'a done task must not be mutated by a stale click');
    assert.match(updateCalls[0].text, /no longer awaiting/i);
  });

  await check('interactive: non-approval payload → handled:false, no card update', async () => {
    updateCalls.length = 0;
    const r = await processInteractive({ type: 'view_submission' }, cfg, broadcasts, recordingFetch);
    assert.equal(r.handled, false);
    assert.equal(updateCalls.length, 0);
  });

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
