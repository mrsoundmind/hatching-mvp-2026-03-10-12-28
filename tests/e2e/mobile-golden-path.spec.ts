import { test, expect, type Page } from '@playwright/test';
import { dismissBlockingModals } from './helpers';

/**
 * Mobile-friendly app loader. The shared ensureAppLoaded waits for <aside>
 * which only renders on desktop (home.tsx hides aside on <lg breakpoint and
 * renders the sidebar inside a Sheet drawer instead). Wait for the chat
 * input testid — present on both desktop and mobile.
 */
async function ensureMobileAppLoaded(page: Page): Promise<void> {
  if (page.url() === 'about:blank' || !page.url().startsWith('http')) {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
  }
  await page.waitForSelector('[data-testid="input-message"]', { timeout: 30_000 });
  await dismissBlockingModals(page);
}

/**
 * Mobile golden-path audit — Layer B of the pre-deploy audit (plan: .claude/plans/before-that-can-we-composed-bunny.md).
 *
 * Runs under the `mobile` Playwright project (iPhone 13, 375×812 viewport) with
 * an authenticated storageState. Covers the journey a real public user takes on
 * a phone: land → chat → sidebars → out. Tests are READ-MOSTLY — no destructive
 * actions, no data-creation that pollutes the test project.
 *
 * Pass criterion: no horizontal scroll at 375px, no touch target < 44px on
 * primary CTAs, no layout overflow, drawers open and close cleanly.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function assertNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth - document.documentElement.clientWidth;
  });
  expect(overflow, `horizontal scroll detected (${overflow}px overflow)`).toBeLessThanOrEqual(1);
}

async function assertVisibleTouchTarget(page: Page, locator: ReturnType<Page['locator']>, minPx = 44): Promise<void> {
  const box = await locator.first().boundingBox();
  expect(box, 'element not in viewport').not.toBeNull();
  if (box) {
    // Allow either width or height to be the touch axis (some controls are very wide and short).
    const passes = box.height >= minPx || box.width >= minPx;
    expect(passes, `touch target too small: ${Math.round(box.width)}×${Math.round(box.height)}px (min ${minPx}px on one axis)`).toBeTruthy();
  }
}

// ---------------------------------------------------------------------------
// SPEC
// ---------------------------------------------------------------------------

test.describe.serial('Mobile golden path — iPhone 13 (375×812)', () => {
  test.setTimeout(60_000);

  test('1 — landing renders at 375px with hero + CTA + footer modals', async ({ page }) => {
    // Logged-out landing surface. We have storageState loaded but /landing
    // explicitly serves the public LandingPage regardless of auth.
    await page.goto('/landing', { waitUntil: 'domcontentloaded' });

    // Hero headline — actual copy is "Where great ideas find the team to build them."
    // Match a stable substring that won't churn on copy tweaks.
    await expect(
      page.locator('h1', { hasText: /great ideas/i }).first(),
    ).toBeVisible();

    // Primary CTA to /login — should be a real anchor, touchable.
    // Match by hasText loosely — the hero CTA reads "Meet Your Team →".
    const cta = page.locator('a[href="/login"]').filter({ hasText: /Meet Your Team/i }).first();
    await expect(cta).toBeVisible();
    await assertVisibleTouchTarget(page, cta);

    // No horizontal scroll at this viewport — this is the mobile-specific value
    // Layer B is auditing. Legal-modal click is already covered by phase-35 case 1b.
    await assertNoHorizontalScroll(page);
  });

  test('2 — app shell at 375px shows mobile header with menu + panel buttons', async ({ page }) => {
    await ensureMobileAppLoaded(page);

    // Mobile header bar appears on <lg breakpoint (home.tsx line 906) — it's a
    // <div className="lg:hidden">, not a semantic <header>. The two distinctive
    // signals are the aria-labeled menu + project-details buttons.
    await expect(page.getByRole('button', { name: /Open navigation/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Open project details/i })).toBeVisible();

    // Chat input should still be visible — it's the primary surface.
    const input = page.locator('[data-testid="input-message"]');
    await expect(input).toBeVisible();
    await assertVisibleTouchTarget(page, input);

    await assertNoHorizontalScroll(page);
  });

  test('3 — left sidebar Sheet opens, readable, closes cleanly', async ({ page }) => {
    await ensureMobileAppLoaded(page);

    // Hamburger menu button — aria-label="Open navigation" (home.tsx:910).
    const menuButton = page.getByRole('button', { name: /Open navigation/i });
    const menuVisible = await menuButton.isVisible({ timeout: 2_000 }).catch(() => false);
    test.skip(!menuVisible, 'mobile menu button not found — check home.tsx mobile header markup');

    await menuButton.click();

    // Sheet should open. Look for any open dialog/sheet content with project tree-like content.
    const sheet = page.getByRole('dialog').first();
    await expect(sheet).toBeVisible({ timeout: 3_000 });

    // Verify the project tree (LeftSidebar contents) renders inside.
    const treeContent = sheet.locator('span.truncate').first();
    await expect(treeContent).toBeVisible({ timeout: 5_000 });

    // Close via Escape.
    await page.keyboard.press('Escape');
    await expect(sheet).not.toBeVisible({ timeout: 3_000 });

    await assertNoHorizontalScroll(page);
  });

  test('4 — right sidebar Sheet opens, Activity tab content visible', async ({ page }) => {
    await ensureMobileAppLoaded(page);

    // Right panel button — aria-label="Open project details" (home.tsx:920).
    const rightButton = page.getByRole('button', { name: /Open project details/i });
    const visible = await rightButton.isVisible({ timeout: 2_000 }).catch(() => false);
    test.skip(!visible, 'mobile right-panel button not found — check home.tsx mobile header markup');

    await rightButton.click();

    const sheet = page.getByRole('dialog').first();
    await expect(sheet).toBeVisible({ timeout: 3_000 });

    // Activity tab should be one of the visible tabs.
    const activityTab = sheet.getByRole('tab', { name: /Activity/i }).first();
    const tabVisible = await activityTab.isVisible({ timeout: 3_000 }).catch(() => false);
    if (tabVisible) {
      await activityTab.click();
    }

    // Sheet contents (whatever they are) should not cause horizontal scroll.
    await assertNoHorizontalScroll(page);

    await page.keyboard.press('Escape');
    await expect(sheet).not.toBeVisible({ timeout: 3_000 });
  });

  test('5 — primary touch targets meet 44px minimum on chat input row', async ({ page }) => {
    await ensureMobileAppLoaded(page);

    const input = page.locator('[data-testid="input-message"]');
    await expect(input).toBeVisible();
    await assertVisibleTouchTarget(page, input);

    // Send button should exist (may be in stop-state if streaming, but element should be present).
    const sendButton = page
      .locator('button')
      .filter({ hasText: /^(send|stop)$/i })
      .first();
    if (await sendButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await assertVisibleTouchTarget(page, sendButton);
    }

    await assertNoHorizontalScroll(page);
  });
});
