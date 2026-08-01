// Tier 0.8 — LIVE test of getMessagesByConversation (DatabaseStorage / Supabase) after pushing
// ordering + limit + cursors into SQL. Verifies the contract is preserved AND the unbounded read is
// now capped. Run: npx tsx -r dotenv/config scripts/test-messages-query.ts
import { storage } from '../server/storage.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log(`  PASS  ${n}`); } else { fail++; console.log(`  FAIL  ${n}  ${d}`); } };
const contents = (msgs: any[]) => msgs.map((m) => m.content);

async function main() {
  let user = await storage.getUserByUsername('session:dev_tester');
  if (!user) user = await storage.createUser({ email: 'dev@local.hatchin', name: 'Dev Tester', avatarUrl: null, provider: 'legacy', providerSub: 'legacy:dev_tester', username: 'session:dev_tester', password: 'x' } as any);

  const project = await storage.createProject({ userId: user.id, name: `MsgQuery Test ${Date.now()}`, emoji: '📨', description: 'query test' } as any);
  const conversationId = `project:${project.id}`;
  // messages FK → conversations, so create the conversation row first (idempotent by id).
  await storage.createConversation({ id: conversationId, projectId: project.id, userId: user.id, type: 'project' } as any);

  // 8 user messages m1..m8, spaced so created_at is strictly increasing.
  const inserted: any[] = [];
  for (let i = 1; i <= 8; i++) {
    inserted.push(await storage.createMessage({ conversationId, content: `m${i}`, messageType: 'user', userId: user.id } as any));
    await sleep(20);
  }
  // one agent message (for the messageType filter)
  await storage.createMessage({ conversationId, content: 'agent-msg', messageType: 'agent', userId: null, agentId: null } as any);
  const m5ts = inserted[4].createdAt.toISOString(); // boundary at m5

  // 1. limit=3 → most-recent 3, oldest-first
  check('limit=3 → [m6,m7,m8]', JSON.stringify(contents((await storage.getMessagesByConversation(conversationId, { limit: 3, messageType: 'user' })))) === JSON.stringify(['m6','m7','m8']));

  // 2. page-based ascending offset
  check('page1 limit3 → [m1,m2,m3]', JSON.stringify(contents((await storage.getMessagesByConversation(conversationId, { page: 1, limit: 3, messageType: 'user' })))) === JSON.stringify(['m1','m2','m3']));
  check('page2 limit3 → [m4,m5,m6]', JSON.stringify(contents((await storage.getMessagesByConversation(conversationId, { page: 2, limit: 3, messageType: 'user' })))) === JSON.stringify(['m4','m5','m6']));

  // 3. before cursor (older than m5), most-recent 2 → [m3,m4]
  check('before m5 limit2 → [m3,m4]', JSON.stringify(contents((await storage.getMessagesByConversation(conversationId, { before: m5ts, limit: 2, messageType: 'user' })))) === JSON.stringify(['m3','m4']));

  // 4. after cursor (newer than m5), most-recent 2 → [m7,m8]
  check('after m5 limit2 → [m7,m8]', JSON.stringify(contents((await storage.getMessagesByConversation(conversationId, { after: m5ts, limit: 2, messageType: 'user' })))) === JSON.stringify(['m7','m8']));

  // 5. messageType filter isolates the agent message
  const agentOnly = await storage.getMessagesByConversation(conversationId, { messageType: 'agent' });
  check('messageType=agent → only agent-msg', agentOnly.length === 1 && agentOnly[0].content === 'agent-msg', `got ${JSON.stringify(contents(agentOnly))}`);

  // 6. HARD_MAX cap: with ceiling=5, the default (no limit) returns the most-recent 5 user msgs, oldest-first
  process.env.MESSAGES_HARD_MAX = '5';
  const capped = await storage.getMessagesByConversation(conversationId, { messageType: 'user' });
  delete process.env.MESSAGES_HARD_MAX;
  check('HARD_MAX=5 caps unbounded read → [m4..m8]', JSON.stringify(contents(capped)) === JSON.stringify(['m4','m5','m6','m7','m8']), `got ${JSON.stringify(contents(capped))}`);

  // 7. default returns oldest-first (ascending) overall
  const all = await storage.getMessagesByConversation(conversationId, { messageType: 'user' });
  check('default order is ascending (oldest first)', all[0].content === 'm1' && all[all.length - 1].content === 'm8');

  // cleanup: purge the test project (best-effort)
  try { await storage.purgeProject?.(project.id); } catch { /* leave it */ }

  console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} — ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
