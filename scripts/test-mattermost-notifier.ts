/**
 * Unit tests for the Mattermost outbound notifier (Release 1 Phase 1).
 * Run: npx tsx scripts/test-mattermost-notifier.ts
 *
 * No network: pure functions plus one injected-fetch test. Real end-to-end against a live Mattermost
 * is the docker verification in .planning/milestones/mattermost-bridge-BRIEF.md.
 */

import assert from 'node:assert/strict';
import { getMattermostConfig } from '../server/integrations/config.js';
import { formatAutonomyEvent } from '../server/integrations/mattermost/formatter.js';
import {
  buildMattermostPostRequest,
  postToMattermost,
  type FetchLike,
} from '../server/integrations/mattermost/mattermostAdapter.js';
import { shouldNotifyMattermost } from '../server/integrations/notifier.js';
import { dispatchAutonomyEvent } from '../server/integrations/notifier.js';
import type { AutonomyEvent, AutonomyEventType } from '../server/autonomy/events/eventTypes.js';

let pass = 0;
let fail = 0;
const tests: Array<[string, () => void | Promise<void>]> = [];
const test = (name: string, fn: () => void | Promise<void>) => tests.push([name, fn]);

const FULL_ENV = {
  MATTERMOST_BASE_URL: 'https://mm.test',
  MATTERMOST_BOT_TOKEN: 't',
  MATTERMOST_CHANNEL_ID: 'chan-1',
  MATTERMOST_PROJECT_ID: 'proj-1',
} as NodeJS.ProcessEnv;

const cfg = getMattermostConfig(FULL_ENV)!;

function evt(partial: Partial<AutonomyEvent> & { eventType: AutonomyEventType }): AutonomyEvent {
  return {
    eventType: partial.eventType,
    timestamp: '', traceId: '', turnId: '', requestId: '',
    userId: null, projectId: 'proj-1', teamId: null, conversationId: null, hatchId: null,
    provider: null, mode: null, latencyMs: null, confidence: null, riskScore: null,
    payload: {},
    ...partial,
  };
}

// ── config ────────────────────────────────────────────────────────────────
test('config: unset env → null (feature off)', () => {
  assert.equal(getMattermostConfig({} as NodeJS.ProcessEnv), null);
});
test('config: partial env → null', () => {
  assert.equal(getMattermostConfig({ MATTERMOST_BASE_URL: 'https://mm.test' } as NodeJS.ProcessEnv), null);
});
test('config: full env parses, trims slashes, default event = approval_required', () => {
  const c = getMattermostConfig({
    MATTERMOST_BASE_URL: 'https://mm.test/', MATTERMOST_BOT_TOKEN: 'tok',
    MATTERMOST_CHANNEL_ID: 'c', MATTERMOST_PROJECT_ID: 'p', APP_BASE_URL: 'https://app.test/',
  } as NodeJS.ProcessEnv)!;
  assert.ok(c);
  assert.equal(c.baseUrl, 'https://mm.test');
  assert.equal(c.appBaseUrl, 'https://app.test');
  assert.deepEqual([...c.enabledEvents], ['approval_required']);
});
test('config: MATTERMOST_NOTIFY_EVENTS overrides + trims', () => {
  const c = getMattermostConfig({
    ...FULL_ENV, MATTERMOST_NOTIFY_EVENTS: 'approval_required, task_completed , handoff_initiated',
  } as NodeJS.ProcessEnv)!;
  assert.deepEqual([...c.enabledEvents].sort(), ['approval_required', 'handoff_initiated', 'task_completed']);
});

// ── gating ────────────────────────────────────────────────────────────────
test('gate: matching project + enabled event → true', () => {
  assert.equal(shouldNotifyMattermost(evt({ eventType: 'approval_required' }), cfg), true);
});
test('gate: wrong project → false', () => {
  assert.equal(shouldNotifyMattermost(evt({ eventType: 'approval_required', projectId: 'other' }), cfg), false);
});
test('gate: disabled event type → false (default is approvals-only)', () => {
  assert.equal(shouldNotifyMattermost(evt({ eventType: 'task_completed' }), cfg), false);
});
test('gate: null config → false', () => {
  assert.equal(shouldNotifyMattermost(evt({ eventType: 'approval_required' }), null), false);
});

// ── formatter ─────────────────────────────────────────────────────────────
test('format approval_required: agent, title, humanized reasons, deep link; NO raw codes', () => {
  const f = formatAutonomyEvent(
    evt({ eventType: 'approval_required', payload: { taskTitle: 'Email the launch list', agentName: 'Kai', riskReasons: ['destructive_verb_critical', 'bulk_scope_modifier'] } }),
    'https://app.test',
  );
  assert.ok(f);
  assert.match(f.text, /Kai/);
  assert.match(f.text, /Email the launch list/);
  assert.match(f.text, /deleting or destroying data/);
  assert.match(f.text, /Affects many items at once/);
  assert.match(f.text, /https:\/\/app\.test\/maya\/proj-1/);
  assert.doesNotMatch(f.text, /destructive_verb_critical/); // raw safety code must never leak
});
test('format handoff_initiated: from and to names', () => {
  const f = formatAutonomyEvent(evt({ eventType: 'handoff_initiated', payload: { fromAgent: { name: 'Alex' }, toAgent: { name: 'Coda' } } }), 'https://app.test');
  assert.ok(f);
  assert.match(f.text, /Alex/);
  assert.match(f.text, /Coda/);
});
test('format task_completed: agent and title (with fallbacks)', () => {
  const f = formatAutonomyEvent(evt({ eventType: 'task_completed', payload: { completedByAgentName: 'Dev', title: 'Rate limiting' } }), 'https://app.test');
  assert.ok(f);
  assert.match(f.text, /Dev/);
  assert.match(f.text, /Rate limiting/);
});
test('format missing payload: falls back, does not throw', () => {
  const f = formatAutonomyEvent(evt({ eventType: 'approval_required' }), 'https://app.test');
  assert.ok(f);
  assert.match(f.text, /A Hatch/);
});
test('format unknown/unsupported event → null', () => {
  assert.equal(formatAutonomyEvent(evt({ eventType: 'memory_written' }), 'https://app.test'), null);
});

// ── adapter request building (pure) ─────────────────────────────────────────
test('buildMattermostPostRequest: url, method, auth, content-type, body', () => {
  const req = buildMattermostPostRequest(cfg, { channelId: 'chan-1', message: 'hi' });
  assert.equal(req.url, 'https://mm.test/api/v4/posts');
  assert.equal(req.method, 'POST');
  assert.equal(req.headers.Authorization, 'Bearer t');
  assert.equal(req.headers['Content-Type'], 'application/json');
  const body = JSON.parse(req.body);
  assert.equal(body.channel_id, 'chan-1');
  assert.equal(body.message, 'hi');
  assert.equal('root_id' in body, false);
});

// ── adapter execution (injected fetch) ──────────────────────────────────────
test('postToMattermost: success returns post id + sends correct request', async () => {
  let captured: { url: string; init?: unknown } | null = null;
  const fakeFetch: FetchLike = async (url, init) => {
    captured = { url, init };
    return { ok: true, status: 201, statusText: 'Created', text: async () => '', json: async () => ({ id: 'post-123' }) };
  };
  const id = await postToMattermost(cfg, { channelId: 'chan-1', message: 'hello there' }, fakeFetch);
  assert.equal(id, 'post-123');
  assert.ok(captured);
  assert.equal(captured!.url, 'https://mm.test/api/v4/posts');
  const init = captured!.init as { headers: Record<string, string>; body: string };
  assert.equal(init.headers.Authorization, 'Bearer t');
  assert.match(init.body, /hello there/);
});
test('postToMattermost: non-2xx throws with status', async () => {
  const fakeFetch: FetchLike = async () => ({ ok: false, status: 403, statusText: 'Forbidden', text: async () => 'nope', json: async () => ({}) });
  await assert.rejects(() => postToMattermost(cfg, { channelId: 'c', message: 'x' }, fakeFetch), /403/);
});

// ── dispatch resilience ─────────────────────────────────────────────────────
test('dispatchAutonomyEvent: no env config → no-op, never throws', async () => {
  const saved = { ...process.env };
  delete process.env.MATTERMOST_BASE_URL;
  delete process.env.MATTERMOST_BOT_TOKEN;
  delete process.env.MATTERMOST_CHANNEL_ID;
  delete process.env.MATTERMOST_PROJECT_ID;
  try {
    await dispatchAutonomyEvent(evt({ eventType: 'approval_required' }));
  } finally {
    Object.assign(process.env, saved);
  }
});

// ── runner ──────────────────────────────────────────────────────────────────
(async () => {
  for (const [name, fn] of tests) {
    try {
      await fn();
      pass++;
      console.log('  ✓', name);
    } catch (e) {
      fail++;
      console.error('  ✗', name, '\n     ', (e as Error).message);
    }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
