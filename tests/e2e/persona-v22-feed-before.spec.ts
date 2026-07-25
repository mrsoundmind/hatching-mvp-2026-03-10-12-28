import { test } from '@playwright/test';
import { ensureAppLoaded } from './helpers';

/**
 * v2.2 Phase D — capture the CURRENT Activity feed (before the peer-review-verdict visibility change),
 * for the UI-change-approval gate. Matched by the `chromium-ai` project (dev-login auth).
 */
test('v2.2 Phase D — screenshot current Activity feed (before)', async ({ page }) => {
  await ensureAppLoaded(page);
  const activityTab = page.locator('[data-testid="sidebar-tab-activity"]');
  if (await activityTab.isVisible({ timeout: 10000 }).catch(() => false)) {
    await activityTab.click();
    await page.waitForTimeout(2500);
  }
  await page.screenshot({ path: 'tests/e2e/.artifacts/v22-feed-before.png', fullPage: true });
});
