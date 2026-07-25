import { test, expect } from '@playwright/test';

/**
 * v2.2 Phase D — verify the Activity feed now surfaces real peer-review verdicts (after the change).
 * Opens the exact project seeded by scripts/seed-peer-review-event.ts, opens the Activity tab, and
 * confirms the reject verdict renders as a Review card with the reviewer's reason + fixes on expand.
 * Matched by the `chromium-ai` project (dev-login auth).
 */
const SEEDED_PROJECT_ID = '6414cd0f-d477-4f31-b5fd-5f25526626f9';

test('v2.2 Phase D — peer-review verdict shows in the Activity feed', async ({ page }) => {
  await page.addInitScript((id) => {
    window.localStorage.setItem('hatchin_active_project', id);
  }, SEEDED_PROJECT_ID);

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('aside', { timeout: 30000 });

  const activityTab = page.locator('[data-testid="sidebar-tab-activity"]');
  await expect(activityTab).toBeVisible({ timeout: 15000 });
  await activityTab.click();
  await page.waitForTimeout(3000);

  // The reject verdict label, in verbs (self-documenting), not the raw enum.
  const rejectLabel = page.getByText("Reviewed a teammate's work and sent it back", { exact: false });
  await expect(rejectLabel.first()).toBeVisible({ timeout: 15000 });

  await page.screenshot({ path: 'tests/e2e/.artifacts/v22-feed-after.png', fullPage: true });

  const approveVisible = await page.getByText("Reviewed a teammate's work and approved it", { exact: false })
    .first().isVisible({ timeout: 5000 }).catch(() => false);
  console.log('approve card visible: ' + approveVisible);

  // Expand the reject card to reveal the reason + the concrete fixes.
  await rejectLabel.first().click();
  await page.waitForTimeout(1200);
  const reason = page.getByText('plain text', { exact: false });
  await expect(reason.first()).toBeVisible({ timeout: 8000 });

  await page.screenshot({ path: 'tests/e2e/.artifacts/v22-feed-after-expanded.png', fullPage: true });

  console.log('AFTER: reject verdict card visible; expanded reject shows reason + fixes.');
});
