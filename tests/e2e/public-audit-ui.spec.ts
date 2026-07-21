import { test, expect } from '@playwright/test';

/**
 * Wave 5 UI long-tail verification (audit 2026-07-17):
 *  - #65: landing nav links were href="#" dead links; now resolve to real sections.
 *  - #136: Manage Subscription / Upgrade silently no-op'd on failure; now show a clear toast.
 * Runs under the `public` project (no stored auth); #136 self-authenticates via dev-login.
 */
test.describe('Audit remediation UI', () => {
  test('#65 landing nav links resolve to real on-page sections', async ({ page }) => {
    await page.goto('/landing', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const nav = page.locator('nav').first();

    // Links now point at real anchors, not "#"
    await expect(nav.getByRole('link', { name: 'Product', exact: true })).toHaveAttribute('href', '#how-it-works');
    await expect(nav.getByRole('link', { name: 'Pricing', exact: true })).toHaveAttribute('href', '#pricing');
    await expect(nav.getByRole('link', { name: 'FAQ', exact: true })).toHaveAttribute('href', '#faq');

    // The target sections exist in the DOM
    await expect(page.locator('#how-it-works')).toHaveCount(1);
    await expect(page.locator('#pricing')).toHaveCount(1);
    await expect(page.locator('#faq')).toHaveCount(1);

    // Clicking Pricing navigates to the pricing section (hash updates, section in view)
    await nav.getByRole('link', { name: 'Pricing', exact: true }).click();
    await page.waitForTimeout(1000);
    expect(page.url()).toContain('#pricing');
    await expect(page.locator('#pricing')).toBeInViewport();
    await page.screenshot({ path: '.audit-2026-07-17/screenshots/wave5-landing-nav-pricing.png' });
  });

  test('#136 billing action shows a toast instead of silently failing', async ({ page }) => {
    // Self-authenticate (public project has no stored session)
    await page.goto('/api/auth/dev-login', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    await page.goto('/account', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // Click whichever billing button renders (Pro -> Manage Subscription, Free -> Upgrade to Pro).
    // Stripe is unconfigured in dev -> 503 -> the new catch shows a toast.
    const manage = page.getByRole('button', { name: /Manage Subscription/i });
    const upgrade = page.getByRole('button', { name: /Upgrade to Pro/i });
    if (await manage.count()) {
      await manage.first().click();
    } else {
      await upgrade.first().click();
    }

    await expect(page.getByText(/unavailable/i).first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: '.audit-2026-07-17/screenshots/wave5-account-toast.png' });
  });
});
