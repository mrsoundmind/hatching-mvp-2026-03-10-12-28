/**
 * Wave 0 spec for BUG-04. RED until plan 28-04 adds abortController.signal.aborted
 * guard before the buildServiceFallbackMessage call in chat.ts inner catch.
 *
 * Two scenarios:
 *   1. No "out for lunch" / "resting circuits" text appears for a 4-8s slow Maya response.
 *   2. (Skipped today) Proper inline error appears on a true 30s+ timeout.
 *
 * The first test is the load-bearing failure today — Playwright reproduces the bug
 * by sending a non-trivial Maya prompt, waiting up to 45s, and asserting the spurious
 * fallback never appears. After plan 28-04, the inner catch checks signal.aborted
 * before sending the fallback, so the message never leaks to the client.
 */
import { test, expect, type Page } from '@playwright/test';
import { ensureAppLoaded } from './helpers';

// storageState reference: tests/e2e/.auth/session.json (configured in playwright.config.ts
// chromium-light project; also tests/e2e/auth.setup.ts owns its creation).

async function openProjectChat(page: Page) {
  await ensureAppLoaded(page);
  await page.locator('[data-testid="input-message"]').waitFor({ state: 'visible', timeout: 15_000 });
}

async function sendMessage(page: Page, content: string) {
  const input = page.locator('[data-testid="input-message"]');
  await input.fill(content);
  await input.press('Enter');
}

test.describe('BUG-04 fallback never appears for valid latency', () => {
  test.setTimeout(60_000);

  test.beforeEach(async ({ page }) => {
    await openProjectChat(page);
  });

  test('no out-for-lunch text on a 4-8s slow response', async ({ page }) => {
    // Pose a multi-part question likely to require Gemini Pro (4-8s response time).
    await sendMessage(
      page,
      'Hey Maya — please summarize what you think Hatchin is for, in three short sentences. Then ask me one clarifying question about my goals.',
    );

    // Wait for the response to materialize. Up to 45s — well under the 60s
    // hard timeout that triggers the legitimate fallback path.
    await page.waitForTimeout(45_000);

    // Capture the chat panel text so we can run the BUG-04 assertion.
    // The "out for lunch" / "resting their circuits" strings come from
    // server/utils/serviceFallbackMessages.ts and surface in the DOM whenever
    // chat.ts:3086 buildServiceFallbackMessage runs.
    const offendingPattern = /out for lunch|resting (their|her|his|its) circuits/i;
    await expect(page.locator('body')).not.toContainText(offendingPattern, {
      timeout: 1000,
      ignoreCase: true,
    });
  });

  test('proper inline error appears on >30s timeout (skip if no error injection)', async ({
    page,
  }) => {
    // TODO: enable after plan 28-02 lands and exposes a HARD_RESPONSE_TIMEOUT_MS knob
    // settable via querystring or dev-only header. Today we cannot reliably inject a
    // 30s+ timeout from a Playwright session without restarting the server, which
    // would invalidate the storageState session. The skeleton documents the contract
    // for the 28-04 author.
    test.skip(
      true,
      'BUG-04 timeout scenario: enable after plan 28-02 surfaces HARD_RESPONSE_TIMEOUT_MS as a runtime knob',
    );

    // Skeleton retained for the 28-04 follow-up:
    //
    // await sendMessage(page, 'force a timeout');
    // // Wait long enough for the 30s AbortSignal.timeout to fire.
    // await page.waitForTimeout(35_000);
    // // The proper inline error message should be visible (not the fallback).
    // const errorNotice = page.locator('[role="alert"], [data-testid*="error"]');
    // await expect(errorNotice.first()).toBeVisible({ timeout: 5000 });
    // // The spurious fallback must NOT appear.
    // const offendingPattern = /out for lunch|resting (their|her|his|its) circuits/i;
    // await expect(page.locator('body')).not.toContainText(offendingPattern);
  });
});
