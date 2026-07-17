/**
 * Wave 3 verification (#79 knowledge grounding, #158 goal -> coreDirection).
 * Run on DeepSeek: LLM_MODE=prod node --env-file=.env --import tsx .audit-2026-07-17/verify-brain-wave3.ts
 *   #79: upload a doc with unique facts, ask about it, assert the reply quotes the facts (not fabricated).
 *   #158: "set the project goal to X" -> assert project.coreDirection.whatBuilding contains X.
 */
import WebSocket from 'ws';
import pg from 'pg';

const BASE = 'http://localhost:5001';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, keepAlive: true });
pool.on('error', () => {});
let cookie = '';

async function api(path: string, opts: any = {}) {
  const res = await fetch(BASE + path, { ...opts, headers: { 'Content-Type': 'application/json', cookie, ...(opts.headers || {}) }, redirect: 'manual' });
  const sc = res.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  const t = await res.text(); try { return { status: res.status, body: JSON.parse(t) }; } catch { return { status: res.status, body: t }; }
}

async function chat(conversationId: string, content: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://localhost:5001/ws', { headers: { cookie } });
    let mid = ''; let done = false;
    const timer = setTimeout(() => { if (!done) { ws.close(); reject(new Error('chat timeout')); } }, 90000);
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'join_conversation', conversationId }));
      setTimeout(() => ws.send(JSON.stringify({ type: 'send_message_streaming', conversationId, message: { content, messageType: 'user' } })), 400);
    });
    ws.on('message', async (raw) => {
      let m: any; try { m = JSON.parse(raw.toString()); } catch { return; }
      if (m.type === 'streaming_started') mid = m.messageId;
      if (m.type === 'streaming_completed') {
        done = true; clearTimeout(timer);
        let text = m.message?.content || '';
        try { const r = await pool.query('SELECT content FROM messages WHERE id=$1', [m.messageId || mid]); if (r.rows[0]?.content) text = r.rows[0].content; } catch {}
        ws.close(); resolve(text);
      }
    });
    ws.on('error', (e) => { if (!done) { clearTimeout(timer); reject(e); } });
  });
}

async function main() {
  await api('/api/auth/dev-login');
  const proj = await api('/api/projects', { method: 'POST', body: JSON.stringify({ name: 'Wave3 Brain Verify', emoji: 'x', description: 'brain verify' }) });
  const projectId = proj.body?.id;
  const conv = `project:${projectId}`;
  console.log('project:', projectId);

  // #79 — upload a knowledge doc with unique, unguessable facts
  const docContent = 'CONFIDENTIAL INTERNAL BRIEF. Product codename: Project Saffron. Launch date: 14 Aug 2027. Backed by: Nusantara Ventures. Target price: 249000 IDR per unit. Market: Southeast Asia smart-kitchen segment.';
  const up = await api(`/api/projects/${projectId}/brain/documents`, { method: 'POST', body: JSON.stringify({ title: 'Internal Brief', content: docContent, type: 'research' }) });
  console.log('doc upload status:', up.status);

  const reply = await chat(conv, 'According to the uploaded Internal Brief document, what is the product codename, the launch date, and who is backing it? Quote them exactly from the brief.');
  console.log('\\n#79 reply:', reply.slice(0, 400));
  const grounded = /saffron/i.test(reply) && (/nusantara/i.test(reply) || /14 aug 2027|aug.*2027/i.test(reply));
  const fabricated = /fridgegenie|greenfield|q2/i.test(reply);
  console.log(`#79 grounding: ${grounded ? 'PASS (quotes real facts)' : 'CHECK'}${fabricated ? ' + FABRICATION DETECTED' : ''}`);

  // #158 — imperative set goal -> visible coreDirection
  await chat(conv, 'set the project goal to ship the MVP fridge scanner by Q4 2027');
  await new Promise((r) => setTimeout(r, 1500));
  const after = await api(`/api/projects/${projectId}`);
  const cd = (after.body?.coreDirection) || {};
  console.log('\\n#158 coreDirection:', JSON.stringify(cd));
  const persisted = JSON.stringify(cd).toLowerCase().includes('ship the mvp');
  console.log(`#158 goal->coreDirection: ${persisted ? 'PASS (visible in coreDirection)' : 'FAIL (coreDirection empty)'}`);

  await pool.end();
  process.exit(0);
}
main().catch((e) => { console.error('ERR', e.message); process.exit(1); });
