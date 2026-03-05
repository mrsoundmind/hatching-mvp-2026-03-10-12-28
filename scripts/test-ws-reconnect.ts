import WebSocket from 'ws';
import fetch from 'node-fetch';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5001';
const WS_URL = process.env.TEST_WS_URL || 'ws://localhost:5001/ws';

async function login(): Promise<{ cookie: string; userId: string }> {
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'WS Reconnect Tester' }),
  });
  if (!response.ok) throw new Error(`login failed ${response.status}`);
  const body = await response.json() as { id: string };
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  if (!cookie) throw new Error('missing session cookie');
  return { cookie, userId: body.id };
}

async function getProjectId(cookie: string): Promise<string> {
  const list = await fetch(`${BASE_URL}/api/projects`, { headers: { Cookie: cookie } });
  if (!list.ok) throw new Error(`projects failed ${list.status}`);
  const projects = await list.json() as Array<{ id: string }>;
  if (projects.length > 0) return projects[0].id;

  const create = await fetch(`${BASE_URL}/api/projects`, {
    method: 'POST',
    headers: {
      Cookie: cookie,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: `Reconnect-${Date.now()}` }),
  });
  if (!create.ok) throw new Error(`project create failed ${create.status}`);
  const project = await create.json() as { id: string };
  return project.id;
}

function sendStreamingMessage(ws: WebSocket, params: {
  conversationId: string;
  userId: string;
  content: string;
  idempotencyKey: string;
}): void {
  ws.send(JSON.stringify({
    type: 'send_message_streaming',
    conversationId: params.conversationId,
    message: {
      content: params.content,
      userId: params.userId,
      messageType: 'user',
      timestamp: new Date().toISOString(),
      metadata: {
        clientMessageId: `${params.idempotencyKey}-${Date.now()}`,
        idempotencyKey: params.idempotencyKey,
      },
    },
  }));
}

async function connectWs(cookie: string, conversationId: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL, { headers: { Cookie: cookie } });
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error('ws connect timeout'));
    }, 12_000);

    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'join_conversation', conversationId }));
    });

    ws.on('message', (raw) => {
      const message = JSON.parse(raw.toString());
      if (message.type === 'connection_confirmed') {
        clearTimeout(timer);
        resolve(ws);
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function main() {
  const { cookie, userId } = await login();
  const projectId = await getProjectId(cookie);
  const conversationId = `project:${projectId}`;

  // Phase 1: Start stream and disconnect mid-stream.
  const ws1 = await connectWs(cookie, conversationId);
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('no streaming_chunk before disconnect')), 20_000);
    ws1.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'streaming_chunk') {
        clearTimeout(timeout);
        ws1.close();
        resolve();
      }
    });
    ws1.on('error', reject);
    sendStreamingMessage(ws1, {
      conversationId,
      userId,
      content: 'Reconnect test, first message.',
      idempotencyKey: `ws-reconnect-1-${Date.now()}`,
    });
  });

  // Phase 2: Reconnect and verify stream completion for next message (state preserved, no stuck stream).
  const ws2 = await connectWs(cookie, conversationId);
  await new Promise<void>((resolve, reject) => {
    let completed = false;
    const timeout = setTimeout(() => {
      ws2.close();
      reject(new Error('reconnect flow timed out before streaming_completed'));
    }, 25_000);

    ws2.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'streaming_completed') {
        completed = true;
        clearTimeout(timeout);
        ws2.close();
        resolve();
      }
      if (msg.type === 'streaming_error') {
        clearTimeout(timeout);
        ws2.close();
        reject(new Error(`streaming_error after reconnect: ${msg.error || 'unknown'}`));
      }
    });

    ws2.on('close', () => {
      if (!completed) {
        clearTimeout(timeout);
        reject(new Error('socket closed before streaming completion'));
      }
    });

    ws2.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    sendStreamingMessage(ws2, {
      conversationId,
      userId,
      content: 'Reconnect test, second message.',
      idempotencyKey: `ws-reconnect-2-${Date.now()}`,
    });
  });

  console.log('[test:ws-reconnect] PASS');
}

main().catch((error) => {
  console.error('[test:ws-reconnect] FAIL', error.message);
  process.exit(1);
});

