import WebSocket from 'ws';
import fetch from 'node-fetch';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5001';
const WS_URL = process.env.TEST_WS_URL || 'ws://localhost:5001/ws';

async function login(): Promise<{ cookie: string; userId: string }> {
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'WS Race Tester' }),
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
    body: JSON.stringify({ name: `Race-${Date.now()}` }),
  });
  if (!create.ok) throw new Error(`project create failed ${create.status}`);
  const project = await create.json() as { id: string };
  return project.id;
}

async function main() {
  const { cookie, userId } = await login();
  const projectId = await getProjectId(cookie);
  const conversationId = `project:${projectId}`;

  await new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(WS_URL, { headers: { Cookie: cookie } });
    let joined = false;
    let skipped = false;
    let completed = 0;

    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('ws race test timeout'));
    }, 20000);

    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'join_conversation', conversationId }));
    });

    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (!joined && msg.type === 'connection_confirmed') {
        joined = true;
        const payload = {
          type: 'send_message_streaming',
          conversationId,
          message: {
            content: 'Race simulation message',
            userId,
            messageType: 'user',
            timestamp: new Date().toISOString(),
            metadata: {
              clientMessageId: `race-${Date.now()}`,
              idempotencyKey: 'race-key-1',
            },
          },
        };

        ws.send(JSON.stringify(payload));
        ws.send(JSON.stringify(payload));
      }

      if (msg.type === 'streaming_completed') {
        completed += 1;
        if (msg.skipped) skipped = true;
        if (completed >= 2) {
          clearTimeout(timeout);
          ws.close();
          if (!skipped) {
            reject(new Error('expected one duplicate request to be skipped by idempotency guard'));
          } else {
            resolve();
          }
        }
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  console.log('[test:ws-race] PASS');
}

main().catch((error) => {
  console.error('[test:ws-race] FAIL', error.message);
  process.exit(1);
});
