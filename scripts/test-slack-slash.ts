/**
 * Tests for the /hatchin ask slash command (channel bridge, Slack adapter Level A).
 * Run: PATH=/opt/homebrew/bin:$PATH node_modules/.bin/tsx scripts/test-slack-slash.ts
 *
 * Part A: pure parse + agent resolution.
 * Part B: handleHatchinCommand against MemStorage with an injected (fake) generator + post, so it runs
 *         without an LLM or the network but exercises the real project/agent resolution path.
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
  const { parseSlashCommand, resolveAgent, handleHatchinCommand, stripProposalBlocks } = await import('../server/integrations/slack/slashCommand.js');
  const { getSlackConfig } = await import('../server/integrations/slack/config.js');
  const { storage } = await import('../server/storage.js');
  delete process.env.DATABASE_URL;

  const cmd = (text: string, extra: Record<string, unknown> = {}) => ({ command: '/hatchin', text, channel_id: 'C1', user_name: 'shashank', ...extra });

  // ── Part A: parse ──────────────────────────────────────────────────────────
  await check('parse: "ask <q>" → default agent, clean question', () => {
    const p = parseSlashCommand(cmd('ask what should we prioritise'))!;
    assert.equal(p.addressed, null);
    assert.equal(p.question, 'what should we prioritise');
  });
  await check('parse: "@Dev <q>" → addressed Dev', () => {
    const p = parseSlashCommand(cmd('@Dev how would you structure the DB'))!;
    assert.equal(p.addressed, 'Dev');
    assert.equal(p.question, 'how would you structure the DB');
  });
  await check('parse: "ask @Dev <q>" → addressed Dev', () => {
    const p = parseSlashCommand(cmd('ask @Dev hello there'))!;
    assert.equal(p.addressed, 'Dev');
    assert.equal(p.question, 'hello there');
  });
  await check('parse: bare "<q>" → default agent', () => {
    const p = parseSlashCommand(cmd('just tell me the plan'))!;
    assert.equal(p.addressed, null);
    assert.equal(p.question, 'just tell me the plan');
  });
  await check('parse: non-/hatchin command → null', () => {
    assert.equal(parseSlashCommand({ command: '/other', text: 'x' }), null);
  });

  // ── Part A: proposal-block stripping (the [[TASK: ...]] leak fix) ─────────────
  await check('strip: removes a trailing [[TASK: ...]] block, keeps the prose', () => {
    const cleaned = stripProposalBlocks('Prioritise the feedback loop. [[TASK: Identify key features for Slack Live Demo]]');
    assert.equal(cleaned, 'Prioritise the feedback loop.');
  });
  await check('strip: removes [[PROJECT_NAME: ...]] and [[UPDATE: ...]] too', () => {
    assert.equal(stripProposalBlocks('Nice. [[PROJECT_NAME: Rocket]]'), 'Nice.');
    assert.equal(stripProposalBlocks('Got it. [[UPDATE: goals: ship v1]]'), 'Got it.');
  });
  await check('strip: plain reply with no blocks is unchanged', () => {
    assert.equal(stripProposalBlocks('Just a normal answer.'), 'Just a normal answer.');
  });

  // ── Part A: agent resolution ─────────────────────────────────────────────────
  const agents = [
    { id: 'm', name: 'Maya', role: 'Idea Partner', isSpecialAgent: true },
    { id: 'd', name: 'Dev', role: 'Backend Developer', isSpecialAgent: false },
    { id: 'a', name: 'Alex', role: 'Product Manager', isSpecialAgent: false },
  ];
  await check('resolve: @Dev → Dev', () => assert.equal(resolveAgent('Dev', agents).id, 'd'));
  await check('resolve: by role fragment ("backend") → Dev', () => assert.equal(resolveAgent('backend', agents).id, 'd'));
  await check('resolve: default (no mention) → Maya (special)', () => assert.equal(resolveAgent(null, agents).id, 'm'));
  await check('resolve: unknown name → falls back to default lead', () => assert.equal(resolveAgent('Ghost', agents).id, 'm'));
  await check('resolve: no special agent, default → PM', () => {
    const noMaya = agents.filter((a) => !a.isSpecialAgent);
    assert.equal(resolveAgent(null, noMaya).role, 'Product Manager');
  });

  // ── Part B: handleHatchinCommand against MemStorage ──────────────────────────
  const project = await storage.createProject({ userId: 'user-1', name: 'Slash Test' } as any);
  const cfg = getSlackConfig({
    SLACK_BOT_TOKEN: 'xoxb', SLACK_APP_TOKEN: 'xapp', SLACK_CHANNEL_ID: 'Cmapped', SLACK_PROJECT_ID: project.id,
  } as NodeJS.ProcessEnv)!;
  const team = await storage.createTeam({ projectId: project.id, userId: 'user-1', name: 'Core', emoji: '⚙️' } as any);
  await storage.createAgent({ projectId: project.id, teamId: team.id, userId: 'user-1', name: 'Maya', role: 'Idea Partner', isSpecialAgent: true } as any);
  await storage.createAgent({ projectId: project.id, teamId: team.id, userId: 'user-1', name: 'Dev', role: 'Backend Developer' } as any);

  const posted: Array<{ channel: string; text: string }> = [];
  const fakePost = async (_c: any, msg: any) => { posted.push(msg); return 'ts'; };
  const seen: Array<{ q: string; role: string }> = [];
  const fakeGen = (async (q: string, role: string) => { seen.push({ q, role }); return { content: `answer to "${q}"`, confidence: 0.9 }; }) as any;

  await check('handle: "ask <q>" → Maya answers, posted to invoking channel', async () => {
    posted.length = 0; seen.length = 0;
    const r = await handleHatchinCommand(cmd('ask what is the plan'), cfg, { generate: fakeGen, post: fakePost });
    assert.equal(r.handled, true);
    assert.equal(r.agentName, 'Maya');
    assert.equal(seen[0].role, 'Idea Partner');
    assert.equal(seen[0].q, 'what is the plan');
    assert.equal(posted[0].channel, 'C1'); // the channel the command was invoked in
    assert.match(posted[0].text, /\*Maya:\*/);
    assert.match(posted[0].text, /answer to "what is the plan"/);
    // the question is echoed above the reply so the exchange is visible in-channel
    assert.match(posted[0].text, /shashank asked Maya:/);
    assert.match(posted[0].text, /what is the plan/);
  });

  await check('handle: "@Dev <q>" → Dev answers', async () => {
    posted.length = 0; seen.length = 0;
    const r = await handleHatchinCommand(cmd('@Dev how to shard'), cfg, { generate: fakeGen, post: fakePost });
    assert.equal(r.agentName, 'Dev');
    assert.equal(seen[0].role, 'Backend Developer');
    assert.match(posted[0].text, /\*Dev:\*/);
    assert.match(posted[0].text, /shashank asked Dev:/);
  });

  await check('handle: proposal block in the generated reply is stripped before posting', async () => {
    posted.length = 0;
    const blockGen = (async () => ({ content: 'Start with the feedback loop. [[TASK: Identify key features]]', confidence: 0.9 })) as any;
    await handleHatchinCommand(cmd('ask what first'), cfg, { generate: blockGen, post: fakePost });
    assert.doesNotMatch(posted[0].text, /\[\[/, 'posted text must not contain raw [[...]] syntax');
    assert.match(posted[0].text, /feedback loop/);
  });

  await check('handle: empty question → posts help, does not call the LLM', async () => {
    posted.length = 0; seen.length = 0;
    const r = await handleHatchinCommand(cmd('ask '), cfg, { generate: fakeGen, post: fakePost });
    assert.equal(r.handled, true);
    assert.equal(seen.length, 0, 'should not call the generator');
    assert.match(posted[0].text, /Ask me something/);
  });

  await check('handle: generator throws → posts a graceful fallback, still handled', async () => {
    posted.length = 0;
    const boomGen = (async () => { throw new Error('llm down'); }) as any;
    const r = await handleHatchinCommand(cmd('ask anything'), cfg, { generate: boomGen, post: fakePost });
    assert.equal(r.handled, true);
    assert.match(posted[0].text, /went wrong/i);
  });

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
