/**
 * Tests for normal-chat mode (channel bridge, Slack adapter Level A+).
 * Run: PATH=/opt/homebrew/bin:$PATH node_modules/.bin/tsx scripts/test-slack-chat.ts
 *
 * Part A: pure parse + the loop-prevention gate (the part that must never reply to the bot itself).
 * Part B: handleChannelMessage against MemStorage with injected generate/post/history — real project +
 *         agent resolution, no LLM or network.
 */

import assert from 'node:assert/strict';

process.env.STORAGE_MODE = 'memory';
process.env.DATABASE_URL = 'postgres://placeholder:placeholder@127.0.0.1:5432/none';

let pass = 0, fail = 0;
async function check(name: string, fn: () => void | Promise<void>) {
  try { await fn(); pass++; console.log('  ✓', name); }
  catch (e) { fail++; console.error('  ✗', name, '\n     ', (e as Error).message); }
}

(async () => {
  const { parseChannelMessage, shouldReply, stripMentions, handleChannelMessage } =
    await import('../server/integrations/slack/channelChat.js');
  const { getSlackConfig } = await import('../server/integrations/slack/config.js');
  const { storage } = await import('../server/storage.js');
  delete process.env.DATABASE_URL;

  const evt = (event: Record<string, unknown>) => ({ event: { type: 'message', ...event } });

  // ── Part A: parse ──────────────────────────────────────────────────────────
  await check('parse: message event → fields', () => {
    const m = parseChannelMessage(evt({ channel: 'C1', user: 'U1', text: 'hey', ts: '1.1' }))!;
    assert.equal(m.channel, 'C1'); assert.equal(m.text, 'hey'); assert.equal(m.isBot, false);
  });
  await check('parse: app_mention event → parsed', () => {
    const m = parseChannelMessage({ event: { type: 'app_mention', channel: 'C1', text: '<@B1> hi', ts: '2' } })!;
    assert.equal(m.text, '<@B1> hi');
  });
  await check('parse: bot_id present → isBot true', () => {
    assert.equal(parseChannelMessage(evt({ channel: 'C1', bot_id: 'B9', text: 'x', ts: '3' }))!.isBot, true);
  });
  await check('parse: non-message event → null', () => {
    assert.equal(parseChannelMessage({ event: { type: 'reaction_added' } }), null);
  });

  await check('stripMentions: removes <@ID> and collapses space', () => {
    assert.equal(stripMentions('<@U123>   what should we build'), 'what should we build');
  });

  // ── Part A: the gate ─────────────────────────────────────────────────────────
  const cfg = getSlackConfig({
    SLACK_BOT_TOKEN: 'xoxb', SLACK_APP_TOKEN: 'xapp', SLACK_CHANNEL_ID: 'Cmapped', SLACK_PROJECT_ID: 'p1',
  } as NodeJS.ProcessEnv)!;
  const mk = (over: Record<string, unknown>) =>
    parseChannelMessage(evt({ channel: 'Cmapped', user: 'U1', text: 'hi', ts: '1', ...over }));

  await check('gate: normal human message in mapped channel → reply', () =>
    assert.equal(shouldReply(mk({}), cfg).reply, true));
  await check('gate: the bot\'s own / any bot message → NO reply (loop prevention)', () =>
    assert.equal(shouldReply(mk({ bot_id: 'B1' }), cfg).reply, false));
  await check('gate: edit/join subtype → NO reply', () =>
    assert.equal(shouldReply(mk({ subtype: 'message_changed' }), cfg).reply, false));
  await check('gate: message in a different channel → NO reply', () =>
    assert.equal(shouldReply(mk({ channel: 'Cother' }), cfg).reply, false));
  await check('gate: empty text (or only a mention) → NO reply', () =>
    assert.equal(shouldReply(mk({ text: '<@B1>' }), cfg).reply, false));

  // ── Part B: handleChannelMessage against MemStorage ──────────────────────────
  const project = await storage.createProject({ userId: 'user-1', name: 'Chat Test' } as any);
  const cfg2 = getSlackConfig({
    SLACK_BOT_TOKEN: 'xoxb', SLACK_APP_TOKEN: 'xapp', SLACK_CHANNEL_ID: 'Cmapped', SLACK_PROJECT_ID: project.id,
  } as NodeJS.ProcessEnv)!;
  const team = await storage.createTeam({ projectId: project.id, userId: 'user-1', name: 'Core', emoji: '⚙️' } as any);
  await storage.createAgent({ projectId: project.id, teamId: team.id, userId: 'user-1', name: 'Maya', role: 'Idea Partner', isSpecialAgent: true } as any);
  await storage.createAgent({ projectId: project.id, teamId: team.id, userId: 'user-1', name: 'Dev', role: 'Backend Developer' } as any);

  const posted: Array<{ channel: string; text: string }> = [];
  const fakePost = async (_c: any, msg: any) => { posted.push(msg); return 'ts'; };
  const seen: Array<{ q: string; role: string; historyLen: number }> = [];
  const fakeGen = (async (q: string, role: string, ctx: any) => {
    seen.push({ q, role, historyLen: ctx.conversationHistory.length }); return { content: `re: ${q}`, confidence: 0.9 };
  }) as any;
  const fakeHistory = (async () => ([
    { role: 'user' as const, content: 'earlier question', timestamp: '0.1' },
    { role: 'assistant' as const, content: 'earlier answer', timestamp: '0.2' },
  ])) as any;

  await check('handle: human message → Maya replies to the mapped channel, with history as context', async () => {
    posted.length = 0; seen.length = 0;
    const r = await handleChannelMessage(
      evt({ channel: 'Cmapped', user: 'U1', text: 'what should we build first', ts: '9.9' }),
      cfg2, { generate: fakeGen, post: fakePost, fetchHistory: fakeHistory },
    );
    assert.equal(r.handled, true);
    assert.equal(r.agentName, 'Maya');
    assert.equal(seen[0].role, 'Idea Partner');
    assert.equal(seen[0].q, 'what should we build first');
    assert.equal(seen[0].historyLen, 2, 'recent channel history should be passed for continuity');
    assert.equal(posted[0].channel, 'Cmapped');
    assert.match(posted[0].text, /^\*Maya:\*/);
  });

  await check('handle: the bot\'s own message → NOT handled (no reply, no loop)', async () => {
    posted.length = 0; seen.length = 0;
    const r = await handleChannelMessage(
      evt({ channel: 'Cmapped', bot_id: 'B1', text: '*Maya:* something', ts: '9.8' }),
      cfg2, { generate: fakeGen, post: fakePost, fetchHistory: fakeHistory },
    );
    assert.equal(r.handled, false);
    assert.equal(seen.length, 0, 'must not call the generator on a bot message');
    assert.equal(posted.length, 0, 'must not post on a bot message');
  });

  await check('handle: @mention text has the mention stripped before generation', async () => {
    posted.length = 0; seen.length = 0;
    await handleChannelMessage(
      { event: { type: 'app_mention', channel: 'Cmapped', user: 'U1', text: '<@B1> how would you shard the DB', ts: '9.7' } },
      cfg2, { generate: fakeGen, post: fakePost, fetchHistory: fakeHistory },
    );
    assert.equal(seen[0].q, 'how would you shard the DB');
  });

  await check('handle: generator throws → graceful fallback still posts', async () => {
    posted.length = 0;
    const boom = (async () => { throw new Error('llm down'); }) as any;
    const r = await handleChannelMessage(
      evt({ channel: 'Cmapped', user: 'U1', text: 'anything', ts: '9.6' }),
      cfg2, { generate: boom, post: fakePost, fetchHistory: fakeHistory },
    );
    assert.equal(r.handled, true);
    assert.match(posted[0].text, /went wrong/i);
  });

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
