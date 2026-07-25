/**
 * Tests for the Mattermost inbound approval path (Release 1 Phase 2).
 * Run: PATH=/opt/homebrew/bin:$PATH node_modules/.bin/tsx scripts/test-mattermost-inbound.ts
 *
 * Part A: pure crypto + button building (no storage).
 * Part B: the shared resolveTaskApproval service against a real in-memory store, which is exactly
 *         what BOTH the HTTP routes and the signed button callback now call.
 */

import assert from 'node:assert/strict';

// Force in-memory storage. db.ts throws at import unless DATABASE_URL is set (even in memory mode,
// because storage.ts imports it statically), so set a placeholder just long enough for the import,
// then delete it (below) so logAutonomyEvent uses its file fallback and never dials a real DB.
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
  const { signAction, verifyActionSignature, buildApprovalAttachments, actionCallbackUrl } = await import(
    '../server/integrations/mattermost/approvalButtons.js'
  );
  const { getMattermostConfig } = await import('../server/integrations/config.js');
  const { resolveTaskApproval } = await import('../server/services/taskApprovalService.js');
  const { storage } = await import('../server/storage.js');
  delete process.env.DATABASE_URL; // storage now loaded as MemStorage; keep logAutonomyEvent on the file fallback
  type AutonomyEvent = import('../server/autonomy/events/eventTypes.js').AutonomyEvent;

  const cfg = getMattermostConfig({
    MATTERMOST_BASE_URL: 'https://mm.test', MATTERMOST_BOT_TOKEN: 't',
    MATTERMOST_CHANNEL_ID: 'c', MATTERMOST_PROJECT_ID: 'proj-1',
    APP_BASE_URL: 'https://hatchin.app', MATTERMOST_SIGNING_SECRET: 'super-secret',
  } as NodeJS.ProcessEnv)!;

  // ── Part A: signature ──────────────────────────────────────────────────────
  await check('sign → verify round-trips', () => {
    const sig = signAction('task-1', 'approve', 'super-secret');
    assert.equal(verifyActionSignature('task-1', 'approve', sig, 'super-secret'), true);
  });
  await check('tampered signature fails', () => {
    const sig = signAction('task-1', 'approve', 'super-secret');
    assert.equal(verifyActionSignature('task-1', 'approve', sig + '0', 'super-secret'), false);
  });
  await check('signature is bound to the action (approve sig cannot reject)', () => {
    const sig = signAction('task-1', 'approve', 'super-secret');
    assert.equal(verifyActionSignature('task-1', 'reject', sig, 'super-secret'), false);
  });
  await check('signature is bound to the task id', () => {
    const sig = signAction('task-1', 'approve', 'super-secret');
    assert.equal(verifyActionSignature('task-2', 'approve', sig, 'super-secret'), false);
  });
  await check('wrong secret fails', () => {
    const sig = signAction('task-1', 'approve', 'super-secret');
    assert.equal(verifyActionSignature('task-1', 'approve', sig, 'other-secret'), false);
  });
  await check('empty signature fails (no timing crash)', () => {
    assert.equal(verifyActionSignature('task-1', 'approve', '', 'super-secret'), false);
  });

  // ── Part A: button building ─────────────────────────────────────────────────
  const evt = (partial: Partial<AutonomyEvent>): AutonomyEvent => ({
    eventType: 'approval_required', timestamp: '', traceId: '', turnId: '', requestId: '',
    userId: null, projectId: 'proj-1', teamId: null, conversationId: null, hatchId: null,
    provider: null, mode: null, latencyMs: null, confidence: null, riskScore: null, payload: {},
    ...partial,
  });
  await check('buildApprovalAttachments: null without a signing secret', () => {
    const noSecret = getMattermostConfig({ MATTERMOST_BASE_URL: 'https://mm.test', MATTERMOST_BOT_TOKEN: 't', MATTERMOST_CHANNEL_ID: 'c', MATTERMOST_PROJECT_ID: 'proj-1' } as NodeJS.ProcessEnv)!;
    assert.equal(buildApprovalAttachments(evt({ payload: { taskId: 'abc' } }), noSecret), null);
  });
  await check('buildApprovalAttachments: null for non-approval events', () => {
    assert.equal(buildApprovalAttachments(evt({ eventType: 'task_completed', payload: { taskId: 'abc' } }), cfg), null);
  });
  await check('buildApprovalAttachments: two signed buttons with the right callback url', () => {
    const props = buildApprovalAttachments(evt({ payload: { taskId: 'abc' } }), cfg) as any;
    assert.ok(props);
    const actions = props.attachments[0].actions;
    assert.equal(actions.length, 2);
    const approve = actions.find((a: any) => a.id === 'approve');
    const reject = actions.find((a: any) => a.id === 'reject');
    assert.equal(approve.integration.url, 'https://hatchin.app/api/integrations/mattermost/action');
    assert.equal(actionCallbackUrl(cfg), 'https://hatchin.app/api/integrations/mattermost/action');
    assert.equal(approve.integration.context.taskId, 'abc');
    assert.equal(approve.integration.context.action, 'approve');
    // approve and reject carry different, individually-valid signatures
    assert.notEqual(approve.integration.context.sig, reject.integration.context.sig);
    assert.equal(verifyActionSignature('abc', 'approve', approve.integration.context.sig, 'super-secret'), true);
    assert.equal(verifyActionSignature('abc', 'reject', reject.integration.context.sig, 'super-secret'), true);
  });

  // ── Part B: shared service against MemStorage (same path routes + callback use) ──
  const broadcasts = (() => {
    const conv: Array<{ c: string; d: any }> = [];
    const proj: Array<{ p: string; d: any }> = [];
    return {
      conv, proj,
      broadcastToConversation: (c: string, d: unknown) => conv.push({ c, d: d as any }),
      broadcastToProject: (p: string, d: unknown) => proj.push({ p, d: d as any }),
    };
  })();

  const project = await storage.createProject({ userId: 'user-1', name: 'MM Test' } as any);
  const PROJECT_ID = project.id;

  async function seedAwaitingTask(title: string): Promise<string> {
    const t = await storage.createTask({ projectId: PROJECT_ID, title, assignee: 'Kai', status: 'blocked' } as any);
    await storage.updateTask(t.id, { status: 'blocked', metadata: { awaitingApproval: true, draftOutput: `DRAFT for ${title}` } as any });
    return t.id;
  }

  await check('service approve: task → completed, draft published, event captured', async () => {
    const id = await seedAwaitingTask('Send the launch email');
    const before = broadcasts.conv.length;
    const result = await resolveTaskApproval(id, 'approve', broadcasts);
    assert.equal(result.ok, true);
    assert.equal(result.taskTitle, 'Send the launch email');
    const t = await storage.getTask(id);
    assert.equal(t!.status, 'completed');
    assert.equal((t!.metadata as any).awaitingApproval, false);
    assert.ok((t!.metadata as any).approvedAt);
    const kinds = broadcasts.conv.slice(before).map((b) => b.d.type);
    assert.ok(kinds.includes('new_message'), 'should publish the draft as a message');
    assert.ok(kinds.includes('task_execution_completed'), 'should broadcast completion');
  });

  await check('service reject: task → todo, draft cleared, rejection broadcast', async () => {
    const id = await seedAwaitingTask('Delete the staging DB');
    const before = broadcasts.proj.length;
    const result = await resolveTaskApproval(id, 'reject', broadcasts, { reason: 'too risky' });
    assert.equal(result.ok, true);
    const t = await storage.getTask(id);
    assert.equal(t!.status, 'todo');
    assert.equal((t!.metadata as any).draftOutput, null);
    assert.equal((t!.metadata as any).rejectionReason, 'too risky');
    const kinds = broadcasts.proj.slice(before).map((b) => b.d.type);
    assert.ok(kinds.includes('task_approval_rejected'));
  });

  await check('service approve on a non-awaiting task → ok:false 400 (graceful no-op)', async () => {
    const t = await storage.createTask({ projectId: PROJECT_ID, title: 'Nothing pending', status: 'todo' } as any);
    const result = await resolveTaskApproval(t.id, 'approve', broadcasts);
    assert.equal(result.ok, false);
    assert.equal(result.status, 400);
  });

  await check('service reject with requireAwaiting on a non-awaiting task → ok:false 409 (race guard)', async () => {
    const t = await storage.createTask({ projectId: PROJECT_ID, title: 'Already done', status: 'completed' } as any);
    const result = await resolveTaskApproval(t.id, 'reject', broadcasts, { requireAwaiting: true });
    assert.equal(result.ok, false);
    assert.equal(result.status, 409);
    const after = await storage.getTask(t.id);
    assert.equal(after!.status, 'completed', 'a done task must NOT be reset by a stale button click');
  });

  await check('service: unknown task → ok:false 404', async () => {
    const result = await resolveTaskApproval('does-not-exist', 'approve', broadcasts);
    assert.equal(result.ok, false);
    assert.equal(result.status, 404);
  });

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
