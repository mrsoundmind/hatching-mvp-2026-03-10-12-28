/**
 * Wave 2 verification (#74 empty-save, #97 @mention dilution).
 * Creates a fresh multi-agent project as dev_tester, then drives two WS chat scenarios:
 *   A (#97): @Coda engineering question -> Coda (a specialist) must respond, not Maya/team.
 *   B (#74): cross-domain message -> multi-agent path fires -> saved content must be > 0 (not blank).
 * Run: node --env-file=.env --import tsx .audit-2026-07-17/verify-chat-wave2.ts
 */
import WebSocket from 'ws';
import pg from 'pg';

const BASE = 'http://localhost:5001';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, keepAlive: true });
pool.on('error', () => {});

let cookie = '';
async function api(path: string, opts: any = {}) {
  const res = await fetch(BASE + path, { ...opts, headers: { 'Content-Type': 'application/json', cookie, ...(opts.headers || {}) }, redirect: 'manual' });
  const sc = res.headers.get('set-cookie');
  if (sc) cookie = sc.split(';')[0];
  const text = await res.text();
  try { return { status: res.status, body: JSON.parse(text) }; } catch { return { status: res.status, body: text }; }
}

function wsSend(ws: WebSocket, obj: any) { ws.send(JSON.stringify(obj)); }

async function runScenario(label: string, conversationId: string, content: string, addressedAgentId?: string) {
  return new Promise<{ agentName: string; messageId: string; savedLen: number }>((resolve, reject) => {
    const ws = new WebSocket('ws://localhost:5001/ws', { headers: { cookie } });
    let responseMessageId = ''; let agentName = ''; let done = false;
    const timer = setTimeout(() => { if (!done) { ws.close(); reject(new Error(label + ': timeout')); } }, 60000);
    ws.on('open', () => {
      wsSend(ws, { type: 'join_conversation', conversationId });
      setTimeout(() => wsSend(ws, {
        type: 'send_message_streaming', conversationId,
        message: { content, messageType: 'user' },
        ...(addressedAgentId ? { addressedAgentId } : {}),
      }), 400);
    });
    ws.on('message', async (raw) => {
      let m: any; try { m = JSON.parse(raw.toString()); } catch { return; }
      if (m.type === 'streaming_started') { responseMessageId = m.messageId; agentName = m.agentName || agentName; }
      if (m.type === 'streaming_completed') {
        done = true; clearTimeout(timer);
        agentName = m.message?.agentName || m.message?.metadata?.personality || agentName;
        const mid = m.messageId || responseMessageId;
        // read saved content length from DB
        let savedLen = -1;
        try { const r = await pool.query('SELECT LENGTH(COALESCE(content,\'\')) l, agent_id FROM messages WHERE id=$1', [mid]); savedLen = r.rows[0]?.l ?? -1; } catch {}
        ws.close();
        resolve({ agentName, messageId: mid, savedLen });
      }
    });
    ws.on('error', (e) => { if (!done) { clearTimeout(timer); reject(e); } });
  });
}

async function main() {
  // 1. auth
  await api('/api/auth/dev-login');
  const me = await api('/api/auth/me');
  console.log('user:', me.body?.id || me.body?.user?.id, me.body?.name || me.body?.user?.name);

  // 2. fresh project + team + specialists (design/dev/marketing so cross-domain fires)
  const proj = await api('/api/projects', { method: 'POST', body: JSON.stringify({ name: 'Wave2 Verify', emoji: 'x', description: 'multi-agent verify' }) });
  const projectId = proj.body?.id;
  console.log('project:', projectId);
  const team = await api('/api/teams', { method: 'POST', body: JSON.stringify({ name: 'Build Team', emoji: 'x', projectId }) });
  const teamId = team.body?.id;
  const mk = (name: string, role: string) => api('/api/agents', { method: 'POST', body: JSON.stringify({ name, role, teamId, projectId }) });
  const coda = await mk('Coda', 'Software Engineer');
  await mk('Arlo', 'UI Designer');
  await mk('Nova', 'Marketing Specialist');
  const codaId = coda.body?.id;
  console.log('team:', teamId, 'coda:', codaId);

  const conv = `project:${projectId}`;
  const teamConv = `team:${projectId}:${teamId}`;

  // Scenario A (#97): pure @mention text at project scope -> the addressed specialist replies (not Maya).
  const a = await runScenario('A-#97', conv, '@Coda give me your engineering take: should we use Postgres or MongoDB and why?');
  console.log('A (#97):', JSON.stringify(a));

  // Scenario B (#74): team scope + long/complex message (no role trigger) -> multi-agent path fires
  // (team authority is not "definitive", so the review-expansion runs) -> content must save (not blank).
  const b = await runScenario('B-#74', teamConv, 'We should decide on the database schema, the conversion funnel, and the roadmap priorities all at once for this project so everything stays aligned as we move forward.');
  console.log('B (#74):', JSON.stringify(b));

  console.log('\\n=== VERDICT ===');
  console.log(`#97 addressed-agent-responds: ${a.agentName?.toLowerCase().includes('coda') ? 'PASS (Coda replied)' : 'CHECK (replied: ' + a.agentName + ')'}`);
  console.log(`#74 multi-agent-content-saved: ${b.savedLen > 0 ? 'PASS (len=' + b.savedLen + ')' : 'FAIL (len=' + b.savedLen + ' blank)'}`);
  await pool.end();
  process.exit(0);
}
main().catch((e) => { console.error('ERR', e.message); process.exit(1); });
