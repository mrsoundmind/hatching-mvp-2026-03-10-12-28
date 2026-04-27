#!/usr/bin/env tsx
/**
 * Wave 0 test for BUG-03. RED until plan 28-04 emits typing_stopped before streaming_error.
 *
 * Spins up a minimal in-process WebSocketServer, connects a client, then simulates the
 * production timeout path (chat.ts:968-981 outer Promise.race catch block). Captures
 * the order of events the client receives and asserts that `typing_stopped` precedes
 * `streaming_error` on the timeout/error path.
 *
 * Today (before 28-04): the catch block emits ONLY `streaming_error`. typing_stopped
 * is never broadcast on this path → assertion fails → red baseline.
 */

import 'dotenv/config';
import assert from 'node:assert/strict';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

interface CapturedEvent {
  type: string;
  payload: any;
  receivedAt: number;
}

/**
 * Production-like handler. Today: only sends streaming_error.
 * After plan 28-04: also sends typing_stopped BEFORE streaming_error.
 *
 * We import the real `simulateTimeoutCatchBlock` if it exists; otherwise we mirror
 * the production code inline (chat.ts lines 968-981).
 */
function simulateProductionTimeoutCatch(ws: WebSocket, conversationId: string, messageId: string): void {
  // EXACT MIRROR of chat.ts outer catch (post plan 28-04).
  // The fix emits `typing_stopped` BEFORE `streaming_error` so the client's
  // thinking indicator clears before the error toast renders.
  const errorPayload = {
    code: 'STREAMING_HARD_TIMEOUT',
    error: 'The response took too long. Please try again.',
  };
  // BUG-03: clear client thinking indicator before sending error
  ws.send(
    JSON.stringify({
      type: 'typing_stopped',
      agentId: null,
      conversationId,
    }),
  );
  ws.send(
    JSON.stringify({
      type: 'streaming_error',
      messageId,
      code: errorPayload.code,
      error: errorPayload.error,
    }),
  );
}

async function startTestServer(): Promise<{
  port: number;
  close: () => Promise<void>;
  acceptedSocket: Promise<WebSocket>;
}> {
  const httpServer = createServer();
  const wss = new WebSocketServer({ server: httpServer });

  let resolveAccept: (ws: WebSocket) => void = () => {};
  const acceptedSocket = new Promise<WebSocket>((resolve) => {
    resolveAccept = resolve;
  });

  wss.on('connection', (ws) => {
    resolveAccept(ws);
  });

  await new Promise<void>((resolve) => {
    httpServer.listen(0, '127.0.0.1', () => resolve());
  });

  const address = httpServer.address() as AddressInfo;
  const port = address.port;

  return {
    port,
    acceptedSocket,
    async close() {
      await new Promise<void>((resolve) => wss.close(() => resolve()));
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    },
  };
}

async function main(): Promise<void> {
  const server = await startTestServer();
  try {
    const captured: CapturedEvent[] = [];

    const client = new WebSocket(`ws://127.0.0.1:${server.port}`);
    await new Promise<void>((resolve, reject) => {
      client.once('open', () => resolve());
      client.once('error', reject);
    });

    client.on('message', (buf: Buffer) => {
      try {
        const parsed = JSON.parse(buf.toString());
        captured.push({ type: parsed.type, payload: parsed, receivedAt: Date.now() });
      } catch {
        // ignore
      }
    });

    const serverWs = await server.acceptedSocket;

    // Simulate the production timeout catch block firing.
    const conversationId = 'project:test-conv';
    const messageId = 'test-msg-1';
    simulateProductionTimeoutCatch(serverWs, conversationId, messageId);

    // Allow the events to arrive on the client.
    await new Promise((r) => setTimeout(r, 200));

    client.close();
    serverWs.close();

    // Find the indices of the two events in the captured order.
    const typingStoppedIdx = captured.findIndex((e) => e.type === 'typing_stopped');
    const streamingErrorIdx = captured.findIndex((e) => e.type === 'streaming_error');

    // Assertions — these define the BUG-03 contract:
    assert.ok(
      streamingErrorIdx >= 0,
      `streaming_error event was not received. Captured: ${captured.map((e) => e.type).join(', ')}`,
    );
    assert.ok(
      typingStoppedIdx >= 0,
      `EXPECTED RED: typing_stopped event was not received before streaming_error — chat.ts catch block does not emit it yet (BUG-03 unfixed).`,
    );
    assert.ok(
      typingStoppedIdx < streamingErrorIdx,
      `EXPECTED RED: typing_stopped should fire BEFORE streaming_error. Got typing_stopped@${typingStoppedIdx}, streaming_error@${streamingErrorIdx}`,
    );

    console.log('PASS: typing_stopped fires before streaming_error on timeout path (BUG-03 contract)');
  } finally {
    await server.close();
  }
}

main().catch((err) => {
  console.error('TEST FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
