/**
 * Tests for the Slack outbound adapter (channel bridge, Slack adapter).
 * Run: PATH=/opt/homebrew/bin:$PATH node_modules/.bin/tsx scripts/test-slack-notifier.ts
 *
 * Pure: config, Block Kit formatter (incl. the raw-code leak guard), approval blocks build + parse,
 * Web API request builders, postToSlack over an injected fetch (200-with-ok:false must still throw),
 * and the notifier project/event gate.
 */

import assert from 'node:assert/strict';

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
  const { getSlackConfig } = await import('../server/integrations/slack/config.js');
  const { formatAutonomyEvent } = await import('../server/integrations/slack/formatter.js');
  const { buildApprovalActionsBlock, parseApprovalAction, ACTION_APPROVE, ACTION_REJECT } = await import(
    '../server/integrations/slack/approvalBlocks.js'
  );
  const { buildSlackPostRequest, buildSlackUpdateRequest, postToSlack, updateSlackMessage } = await import(
    '../server/integrations/slack/slackAdapter.js'
  );
  const { shouldNotifySlack } = await import('../server/integrations/notifier.js');
  type AutonomyEvent = import('../server/autonomy/events/eventTypes.js').AutonomyEvent;

  const cfg = getSlackConfig({
    SLACK_BOT_TOKEN: 'xoxb-abc', SLACK_APP_TOKEN: 'xapp-def',
    SLACK_CHANNEL_ID: 'C123', SLACK_PROJECT_ID: 'proj-1', APP_BASE_URL: 'https://hatchin.app',
  } as NodeJS.ProcessEnv)!;

  const evt = (partial: Partial<AutonomyEvent>): AutonomyEvent => ({
    eventType: 'approval_required', timestamp: '', traceId: '', turnId: '', requestId: '',
    userId: null, projectId: 'proj-1', teamId: null, conversationId: null, hatchId: null,
    provider: null, mode: null, latencyMs: null, confidence: null, riskScore: null, payload: {},
    ...partial,
  });

  // ── config ──────────────────────────────────────────────────────────────────
  await check('config: null unless bot+channel+project set', () => {
    assert.equal(getSlackConfig({ SLACK_BOT_TOKEN: 'x', SLACK_CHANNEL_ID: 'C' } as NodeJS.ProcessEnv), null);
  });
  await check('config: appToken optional; defaults events to approvals-only', () => {
    const c = getSlackConfig({ SLACK_BOT_TOKEN: 'x', SLACK_CHANNEL_ID: 'C', SLACK_PROJECT_ID: 'p' } as NodeJS.ProcessEnv)!;
    assert.equal(c.appToken, undefined);
    assert.deepEqual([...c.enabledEvents], ['approval_required']);
  });
  await check('config: SLACK_NOTIFY_EVENTS overrides the default set', () => {
    const c = getSlackConfig({ SLACK_BOT_TOKEN: 'x', SLACK_CHANNEL_ID: 'C', SLACK_PROJECT_ID: 'p', SLACK_NOTIFY_EVENTS: 'approval_required, task_completed' } as NodeJS.ProcessEnv)!;
    assert.deepEqual([...c.enabledEvents].sort(), ['approval_required', 'task_completed']);
  });

  // ── formatter (Slack mrkdwn + leak guard) ────────────────────────────────────
  await check('formatter: approval uses Slack *bold* and a plain-text fallback', () => {
    const f = formatAutonomyEvent(evt({ payload: { agentName: 'Kai', taskTitle: 'Send launch email' } }), cfg.appBaseUrl)!;
    const md = (f.blocks[0] as any).text.text as string;
    assert.match(md, /\*Kai\*/);              // single-asterisk bold (Slack), not **
    assert.match(md, /\*Send launch email\*/);
    assert.ok(!md.includes('**'), 'must not use Markdown double-asterisk');
    assert.equal(f.text, 'Kai needs approval: Send launch email');
  });
  await check('formatter: raw safety codes are humanized, unknowns dropped', () => {
    const f = formatAutonomyEvent(evt({ payload: { agentName: 'Kai', taskTitle: 'Wipe logs', riskReasons: ['destructive_verb_critical', 'high_impact_action:delete', 'totally_unknown_code'] } }), cfg.appBaseUrl)!;
    const md = (f.blocks[0] as any).text.text as string;
    assert.match(md, /Involves deleting or destroying data/);
    assert.match(md, /A high-impact or hard-to-undo action/);
    assert.ok(!md.includes('destructive_verb_critical'), 'raw code leaked');
    assert.ok(!md.includes('totally_unknown_code'), 'unknown code leaked');
  });
  await check('formatter: task_completed uses <url|label> link syntax', () => {
    const f = formatAutonomyEvent(evt({ eventType: 'task_completed', payload: { agentName: 'Dev', taskTitle: 'Refactor' } }), cfg.appBaseUrl)!;
    const md = (f.blocks[0] as any).text.text as string;
    assert.match(md, /<https:\/\/hatchin\.app\/maya\/proj-1\|Open in Hatchin>/);
  });
  await check('formatter: returns null for un-notified event types', () => {
    assert.equal(formatAutonomyEvent(evt({ eventType: 'message_sent' as any }), cfg.appBaseUrl), null);
  });

  // ── approval blocks ───────────────────────────────────────────────────────────
  await check('blocks: null without appToken (no listener → no dead buttons)', () => {
    const noApp = getSlackConfig({ SLACK_BOT_TOKEN: 'x', SLACK_CHANNEL_ID: 'C', SLACK_PROJECT_ID: 'proj-1' } as NodeJS.ProcessEnv)!;
    assert.equal(buildApprovalActionsBlock(evt({ payload: { taskId: 'abc' } }), noApp), null);
  });
  await check('blocks: null for non-approval events / missing taskId', () => {
    assert.equal(buildApprovalActionsBlock(evt({ eventType: 'task_completed', payload: { taskId: 'abc' } }), cfg), null);
    assert.equal(buildApprovalActionsBlock(evt({ payload: {} }), cfg), null);
  });
  await check('blocks: two buttons carry the taskId in value + distinct action ids', () => {
    const b = buildApprovalActionsBlock(evt({ payload: { taskId: 'abc' } }), cfg) as any;
    assert.equal(b.type, 'actions');
    const ids = b.elements.map((e: any) => e.action_id);
    assert.deepEqual(ids.sort(), [ACTION_APPROVE, ACTION_REJECT].sort());
    assert.ok(b.elements.every((e: any) => e.value === 'abc'));
    assert.ok(b.elements.find((e: any) => e.action_id === ACTION_REJECT).confirm, 'reject should confirm');
  });
  await check('parseApprovalAction: reads action + taskId + channel/ts from a block_actions payload', () => {
    const parsed = parseApprovalAction({
      type: 'block_actions',
      channel: { id: 'C999' },
      message: { ts: '111.222' },
      actions: [{ action_id: ACTION_REJECT, value: 'task-xyz' }],
    })!;
    assert.equal(parsed.action, 'reject');
    assert.equal(parsed.taskId, 'task-xyz');
    assert.equal(parsed.channelId, 'C999');
    assert.equal(parsed.messageTs, '111.222');
  });
  await check('parseApprovalAction: null for non-approval or foreign actions', () => {
    assert.equal(parseApprovalAction({ type: 'view_submission' }), null);
    assert.equal(parseApprovalAction({ type: 'block_actions', actions: [{ action_id: 'some_other_button', value: 'x' }] }), null);
  });

  // ── Web API request builders ───────────────────────────────────────────────────
  await check('buildSlackPostRequest: chat.postMessage with bot bearer + blocks', () => {
    const r = buildSlackPostRequest(cfg, { channel: 'C123', text: 'hi', blocks: [{ type: 'section' }] });
    assert.equal(r.url, 'https://slack.com/api/chat.postMessage');
    assert.equal(r.headers.Authorization, 'Bearer xoxb-abc');
    const body = JSON.parse(r.body);
    assert.equal(body.channel, 'C123');
    assert.deepEqual(body.blocks, [{ type: 'section' }]);
  });
  await check('buildSlackUpdateRequest: chat.update carries channel + ts', () => {
    const r = buildSlackUpdateRequest(cfg, { channel: 'C123', ts: '1.2', text: 'done' });
    assert.equal(r.url, 'https://slack.com/api/chat.update');
    const body = JSON.parse(r.body);
    assert.equal(body.ts, '1.2');
  });

  // ── postToSlack over an injected fetch ─────────────────────────────────────────
  const mockRes = (opts: { httpOk?: boolean; status?: number; json?: unknown; text?: string }) => ({
    ok: opts.httpOk ?? true, status: opts.status ?? 200, statusText: 'OK',
    text: async () => opts.text ?? '', json: async () => opts.json ?? {},
  });
  await check('postToSlack: ok:true returns ts', async () => {
    const ts = await postToSlack(cfg, { channel: 'C123', text: 'hi' }, (async () => mockRes({ json: { ok: true, ts: '9.9' } })) as any);
    assert.equal(ts, '9.9');
  });
  await check('postToSlack: HTTP 200 with ok:false STILL throws', async () => {
    await assert.rejects(
      postToSlack(cfg, { channel: 'C123', text: 'hi' }, (async () => mockRes({ json: { ok: false, error: 'channel_not_found' } })) as any),
      /channel_not_found/,
    );
  });
  await check('postToSlack: non-2xx throws', async () => {
    await assert.rejects(
      postToSlack(cfg, { channel: 'C123', text: 'hi' }, (async () => mockRes({ httpOk: false, status: 429, text: 'rate limited' })) as any),
      /429/,
    );
  });
  await check('updateSlackMessage: resolves on ok:true', async () => {
    await updateSlackMessage(cfg, { channel: 'C123', ts: '1.2', text: 'done' }, (async () => mockRes({ json: { ok: true } })) as any);
  });

  // ── notifier gate ──────────────────────────────────────────────────────────────
  await check('shouldNotifySlack: only mapped project + enabled event', () => {
    assert.equal(shouldNotifySlack(evt({ projectId: 'proj-1', eventType: 'approval_required' }), cfg), true);
    assert.equal(shouldNotifySlack(evt({ projectId: 'other', eventType: 'approval_required' }), cfg), false);
    assert.equal(shouldNotifySlack(evt({ projectId: 'proj-1', eventType: 'task_completed' }), cfg), false);
    assert.equal(shouldNotifySlack(evt({ projectId: 'proj-1' }), null), false);
  });

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
