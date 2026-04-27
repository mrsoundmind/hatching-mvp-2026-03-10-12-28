#!/usr/bin/env tsx
/**
 * Wave 0 test for BUG-05. RED until plan 28-05 adds `delete (ws as any).__currentAbortController`
 * to the finally block at chat.ts:3022.
 *
 * Today the production finally block (chat.ts ~line 3022) does ONLY:
 *     ws.off('message', cancelHandler);
 * It does NOT delete the AbortController reference, so it accumulates on the WS object
 * across multiple message turns. After plan 28-05, the finally block also runs:
 *     delete (ws as any).__currentAbortController;
 * This script asserts that contract by mirroring the production cleanup helper. Today,
 * the helper omits the delete → assertion fails → red baseline.
 */

import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

/**
 * Mirror of the production finally-block cleanup. We re-implement here because the
 * real handleStreamingColleagueResponse is too tightly coupled to the rest of chat.ts
 * to import in isolation. Plan 28-05 will update the production code; we update this
 * stub at the same time and the test turns green.
 *
 * TODAY (red): only ws.off — does not delete __currentAbortController.
 * AFTER 28-05 (green): also calls `delete (ws as any).__currentAbortController`.
 */
function runProductionFinallyCleanup(ws: any, cancelHandler: (msg: Buffer) => void): void {
  // Lifted exactly from chat.ts:3022:
  ws.off('message', cancelHandler);
  // ↑ Plan 28-05 must add this line to make the test go green:
  // delete (ws as any).__currentAbortController;
}

async function main(): Promise<void> {
  // Build a fake ws compatible with EventEmitter API (.on / .off) plus a no-op send.
  const fakeWs: any = new EventEmitter();
  fakeWs.send = () => {};
  // Production code uses ws.off / ws.on. EventEmitter has them.

  // Set up the controller exactly like chat.ts:1903 does.
  const abortController = new AbortController();
  fakeWs.__currentAbortController = abortController;

  // Cancel handler stand-in.
  const cancelHandler = (_msg: Buffer) => {};
  fakeWs.on('message', cancelHandler);

  // Sanity: controller is on the ws before cleanup
  assert.ok(
    fakeWs.__currentAbortController instanceof AbortController,
    'precondition: __currentAbortController should be set before cleanup',
  );

  // Simulate the finally block running.
  runProductionFinallyCleanup(fakeWs, cancelHandler);

  // BUG-05 contract: after the finally block, the ws no longer holds the controller.
  // Today this fails because runProductionFinallyCleanup mirrors chat.ts which omits the delete.
  assert.strictEqual(
    fakeWs.__currentAbortController,
    undefined,
    'EXPECTED RED: ws.__currentAbortController is still set after finally block — BUG-05 leak. Plan 28-05 must add `delete (ws as any).__currentAbortController` to chat.ts:3022 finally block.',
  );

  console.log('PASS: AbortController reference cleared after stream finally block (BUG-05 contract)');
}

main().catch((err) => {
  console.error('TEST FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
