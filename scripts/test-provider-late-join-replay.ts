#!/usr/bin/env tsx
/**
 * Phase 35-02 Task 4: late-join PROVIDER_DEGRADED replay test.
 *
 * Run: npx tsx scripts/test-provider-late-join-replay.ts
 *
 * Validates maybeReplayDegradedToSocket() from server/routes/chat.ts. The
 * helper is called from wss.on('connection') for every new socket and is
 * responsible for sending a one-shot PROVIDER_DEGRADED to clients that
 * connect (or refresh) during an active outage so they still see the toast.
 *
 * 3 cases:
 *   1. isDegraded=true + readyState=OPEN  → send invoked once with correct payload
 *   2. isDegraded=false (fresh state)     → send NOT invoked
 *   3. isDegraded=true but readyState=CLOSED → send NOT invoked (defensive check)
 *
 * Each case prints PASS/FAIL; first failure exits 1.
 *
 * Note: chat.ts transitively imports server/db.ts which throws at module-load
 * time if DATABASE_URL is unset. We set a dummy URL BEFORE importing so the
 * Neon Pool initializes lazily — we never actually connect.
 */

import assert from 'node:assert/strict';

process.env.NODE_ENV = 'development';
process.env.DATABASE_URL ??= 'postgresql://dummy:dummy@localhost:5432/dummy';
process.env.SESSION_SECRET ??= 'test-session-secret-min-32-chars-long-for-startup';

// Dynamic import AFTER env is set — ESM hoists static imports above top-level
// statements, so we need this pattern to keep DATABASE_URL guard happy.
const { recordFailure, __resetForTests, getDegradedState } = await import(
  '../server/llm/providerHealthState.js'
);
const { maybeReplayDegradedToSocket } = await import('../server/routes/chat.js');

// Minimal WS-like fake — matches the helper's structural type. We track every
// .send() invocation in `sentPayloads`.
type FakeWS = {
  readyState: number;
  OPEN: number;
  send: (payload: string) => void;
};

function makeFakeSocket(readyState: number = 1): {
  ws: FakeWS;
  sentPayloads: string[];
} {
  const sentPayloads: string[] = [];
  const ws: FakeWS = {
    readyState,
    OPEN: 1, // ws library constant — 0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED
    send(payload: string): void {
      sentPayloads.push(payload);
    },
  };
  return { ws, sentPayloads };
}

function freshSlate(): void {
  process.env.NODE_ENV = 'development';
  __resetForTests();
}

async function case1_degradedOpenSocketReceivesReplay(): Promise<void> {
  freshSlate();
  // Bring system to degraded via 3 chain failures.
  for (let i = 0; i < 3; i++) recordFailure();
  assert.equal(getDegradedState().isDegraded, true, 'case1 setup: degraded');

  const { ws, sentPayloads } = makeFakeSocket(1 /* OPEN */);
  maybeReplayDegradedToSocket(ws);

  assert.equal(sentPayloads.length, 1, `case1: expected 1 send, got ${sentPayloads.length}`);
  const parsed = JSON.parse(sentPayloads[0]);
  assert.equal(parsed.type, 'provider_degraded', 'case1: payload type');
  assert.equal(typeof parsed.reason, 'string', 'case1: reason is a string');
  assert.ok(parsed.reason.length > 0, 'case1: reason non-empty');
  console.log('PASS case1: degraded + OPEN socket receives one PROVIDER_DEGRADED');
}

async function case2_notDegradedNoReplay(): Promise<void> {
  freshSlate();
  assert.equal(getDegradedState().isDegraded, false, 'case2 setup: not degraded');

  const { ws, sentPayloads } = makeFakeSocket(1 /* OPEN */);
  maybeReplayDegradedToSocket(ws);

  assert.equal(sentPayloads.length, 0, `case2: expected 0 sends, got ${sentPayloads.length}`);
  console.log('PASS case2: not-degraded socket gets NO replay');
}

async function case3_degradedButNotOpenNoSend(): Promise<void> {
  freshSlate();
  // Bring to degraded.
  for (let i = 0; i < 3; i++) recordFailure();
  assert.equal(getDegradedState().isDegraded, true, 'case3 setup: degraded');

  // readyState=3 means CLOSED — must NOT send.
  const { ws, sentPayloads } = makeFakeSocket(3 /* CLOSED */);
  maybeReplayDegradedToSocket(ws);

  assert.equal(sentPayloads.length, 0, `case3: expected 0 sends, got ${sentPayloads.length}`);
  console.log('PASS case3: degraded + non-OPEN socket gets NO replay');
}

async function main(): Promise<void> {
  const cases: Array<[string, () => Promise<void>]> = [
    ['case1', case1_degradedOpenSocketReceivesReplay],
    ['case2', case2_notDegradedNoReplay],
    ['case3', case3_degradedButNotOpenNoSend],
  ];

  for (const [name, fn] of cases) {
    try {
      await fn();
    } catch (err) {
      console.error(`FAIL ${name}:`, err instanceof Error ? err.stack || err.message : err);
      process.exit(1);
    }
  }
  console.log('ALL 3 CASES PASS');
}

main().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
