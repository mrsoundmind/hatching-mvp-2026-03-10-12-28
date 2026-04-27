/**
 * Wave 0 spec for BUG-06. RED until plan 28-03 reduces the truth-enforcer debounce +
 * forces metadata.isStreaming=false in the new_message handler.
 *
 * Three scenarios — each verifies the chat-input button reverts from "Stop" to "Send"
 * within 1000ms of the terminal stream event:
 *   1. After streaming_completed (success path)
 *   2. After user clicks stop button (cancel path)
 *   3. After streaming_error (error path) — skipped today, scaffold ready for 28-04
 *
 * Note on auth: this spec runs in the chromium-light project per playwright.config.ts,
 * which already wires `storageState: tests/e2e/.auth/session.json`. The reference is
 * documented here for clarity even though the per-project config provides it.
 */
import { test, expect, type Page } from '@playwright/test';
import { ensureAppLoaded } from './helpers';

// storageState reference: tests/e2e/.auth/session.json (configured in playwright.config.ts
// chromium-light project; also tests/e2e/auth.setup.ts owns its creation).

const SEND_LABEL = /send message/i;
const STOP_LABEL = /stop generating/i;

async function openProjectChat(page: Page) {
  await ensureAppLoaded(page);
  await page.locator('[data-testid="input-message"]').waitFor({ state: 'visible', timeout: 15_000 });
}

async function sendMessage(page: Page, content: string) {
  const input = page.locator('[data-testid="input-message"]');
  await input.fill(content);
  await input.press('Enter');
}

test.describe('BUG-06 stop button reverts to send within 1s', () => {
  test.beforeEach(async ({ page }) => {
    await openProjectChat(page);
  });

  test('after streaming_completed (success path)', async ({ page }) => {
    // Send a short message that is likely to produce a fast LLM response.
    await sendMessage(page, 'hi, reply with just one short word');

    // Wait until the assistant's message lands. We accept any agent message
    // appearing (Maya/PM/etc.) — the BUG-06 contract is about UI state, not content.
    const assistantMessage = page
      .locator('[data-testid*="message"], [role="article"], .message-bubble')
      .filter({ hasNot: page.locator('[data-testid="user-message"]') });

    // Wait up to 60s for at least one assistant message
    await assistantMessage.first().waitFor({ state: 'visible', timeout: 60_000 });

    // Within 1s of the assistant message landing, the button must be "Send" again.
    // The 1000ms budget is the BUG-06 contract.
    await expect(page.getByRole('button', { name: SEND_LABEL })).toBeVisible({ timeout: 1000 });
    await expect(page.getByRole('button', { name: STOP_LABEL })).toHaveCount(0, { timeout: 1000 });
  });

  test('after user clicks stop button (cancel path)', async ({ page }) => {
    // Long prompt to ensure we have time to click stop while it's still streaming.
    await sendMessage(
      page,
      'Please write me a 2000-word story about a brave hatchling who learns to code by debugging an ancient codebase across galaxies.',
    );

    // Wait until the button shows "Stop generating" (streaming has begun).
    const stopButton = page.getByRole('button', { name: STOP_LABEL });
    await stopButton.waitFor({ state: 'visible', timeout: 30_000 });

    // Click stop.
    await stopButton.click();

    // Within 1s, the button must revert to Send.
    await expect(page.getByRole('button', { name: SEND_LABEL })).toBeVisible({ timeout: 1000 });
    await expect(page.getByRole('button', { name: STOP_LABEL })).toHaveCount(0, { timeout: 1000 });
  });

  test('after streaming_error (error path)', async ({ page }) => {
    // TODO: enable this test after plan 28-04 lands. Reliable streaming_error injection
    // requires either:
    //   (a) a server-side env knob (e.g. HARD_RESPONSE_TIMEOUT_MS=1000) settable via
    //       a dev-only request header, OR
    //   (b) Playwright route mocking of the WebSocket frames to inject an error envelope.
    // Both options become tractable after 28-04 normalizes the error path. For now,
    // mark the test skipped with the contract documented for the 28-04 follow-up.
    test.skip(true, 'BUG-06 error-path scenario: enable after plan 28-04 lands (1000ms budget)');

    // Skeleton retained for plan 28-04 author:
    //
    // await sendMessage(page, 'trigger an error');
    // // Wait for streaming_error to appear in DOM (some inline error notice).
    // const errorNotice = page.locator('[role="alert"], [data-testid*="error"]');
    // await errorNotice.first().waitFor({ state: 'visible', timeout: 30_000 });
    // // Within 1000ms of error appearing, button must be Send.
    // await expect(page.getByRole('button', { name: SEND_LABEL })).toBeVisible({ timeout: 1000 });
  });
});
