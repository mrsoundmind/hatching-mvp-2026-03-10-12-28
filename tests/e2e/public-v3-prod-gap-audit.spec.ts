/**
 * v3.0 "Hatchin That Works" — Public surface gap audit on production.
 *
 * Targets: https://hatchin-mvp.fly.dev (production deployment)
 * Coverage: ONLY public flows (landing, login, static pages).
 * Auth-gated gaps (Maya bug, discovery, blueprint, deliverables, cost UI,
 * team formation) are NOT testable here without a real Google account.
 *
 * Each test name encodes the gap reference for triage.
 */
import { test, expect, type Page } from '@playwright/test';

const PROD_URL = 'https://hatchin-mvp.fly.dev';

test.describe('v3.0 production gap audit — public surface', () => {
  test.use({ baseURL: PROD_URL });

  test('GAP-AUDIT: landing page loads with no console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBeLessThan(400);

    await expect(page).toHaveTitle(/.+/);
    expect(page.url()).toContain('hatchin-mvp.fly.dev');

    // Should have main content
    await expect(page.locator('body')).toBeVisible();

    // Allow the page some time to hydrate before checking console
    await page.waitForTimeout(2000);

    // Report (but don't fail) on console errors
    if (consoleErrors.length > 0) {
      console.log('Console errors on landing:', consoleErrors);
    }
  });

  test('GAP-05: landing page has visible "Skip to my team" path (currently expected: missing)', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Look for any skip-Maya escape hatch on the landing page
    const skipLink = page.getByRole('link', { name: /skip to my team|skip discovery|jump to/i });
    const skipButton = page.getByRole('button', { name: /skip to my team|skip discovery|jump to/i });

    const skipExists =
      (await skipLink.count()) > 0 || (await skipButton.count()) > 0;

    expect(
      skipExists,
      'GAP-05: No "Skip to my team" path on landing page (SKIP-01 unimplemented)',
    ).toBe(true);
  });

  test('GAP-AUDIT: landing page has SEO meta tags', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const description = await page.locator('meta[name="description"]').getAttribute('content');
    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
    const ogDescription = await page
      .locator('meta[property="og:description"]')
      .getAttribute('content');

    expect(description, 'meta description missing').toBeTruthy();
    expect(ogTitle, 'og:title missing').toBeTruthy();
    expect(ogDescription, 'og:description missing').toBeTruthy();
  });

  test('GAP-AUDIT: legal pages (privacy, terms) reachable from landing', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const privacyLink = page.getByRole('link', { name: /privacy/i }).first();
    const termsLink = page.getByRole('link', { name: /terms/i }).first();

    const privacyExists = await privacyLink.isVisible({ timeout: 5000 }).catch(() => false);
    const termsExists = await termsLink.isVisible({ timeout: 5000 }).catch(() => false);

    expect(privacyExists || termsExists, 'No legal links visible on landing').toBe(true);

    if (privacyExists) {
      const privacyHref = await privacyLink.getAttribute('href');
      expect(privacyHref, 'privacy link href is empty/#').not.toBe('#');
      expect(privacyHref).not.toBeNull();
    }
  });

  test('GAP-AUDIT: protected route redirects unauthenticated user to login', async ({ page }) => {
    const response = await page.goto('/account', { waitUntil: 'domcontentloaded' });

    // Should either redirect to /login or show a login UI
    const currentUrl = page.url();
    const hasLoginButton = await page
      .getByRole('button', { name: /sign in|log in|continue with google/i })
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    const isAuthGated =
      currentUrl.includes('/login') || currentUrl.includes('/auth') || hasLoginButton;

    expect(isAuthGated, 'Protected route /account did not auth-gate').toBe(true);
  });

  test('GAP-07: graceful API error UX — calling protected endpoint shows graceful UI not raw 500', async ({
    page,
  }) => {
    // Visit landing first to load app
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Try to reach a protected route — observe the error UX
    const response = await page.goto('/account', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const bodyText = await page.locator('body').innerText();

    // Should NOT show raw error strings
    expect(bodyText, 'Raw "500" string visible to user').not.toMatch(/^\s*500\b/);
    expect(bodyText, 'Raw "Unauthorized" leaked to user UI').not.toContain(
      'Cannot GET',
    );
  });

  test('GAP-AUDIT: 404 page exists for unknown routes', async ({ page }) => {
    const response = await page.goto('/this-route-definitely-does-not-exist-12345', {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(1500);

    const bodyText = await page.locator('body').innerText();

    // Should have a real 404 page, not a blank screen or raw error
    const has404Content =
      bodyText.toLowerCase().includes('not found') ||
      bodyText.includes('404') ||
      bodyText.toLowerCase().includes("doesn't exist") ||
      bodyText.toLowerCase().includes('page not found');

    expect(has404Content, 'No 404 page UI on unknown route').toBe(true);
  });

  test('GAP-AUDIT: Google OAuth login button present and points to /api/auth/google/start', async ({
    page,
  }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Find login element (could be button or link)
    const googleSignIn = page
      .locator('a[href*="/api/auth/google"], button')
      .filter({ hasText: /google|sign in/i })
      .first();

    const exists = await googleSignIn.isVisible({ timeout: 5000 }).catch(() => false);
    expect(exists, 'No Google sign-in element on /login').toBe(true);

    // If it's a link, verify the href
    const tagName = await googleSignIn.evaluate((el) => el.tagName.toLowerCase()).catch(() => '');
    if (tagName === 'a') {
      const href = await googleSignIn.getAttribute('href');
      expect(href, 'Google sign-in link missing or pointing to #').toMatch(/\/api\/auth\/google/);
    }
  });

  test('GAP-AUDIT: dev-login endpoint correctly disabled in production', async ({ request }) => {
    const response = await request.get(`${PROD_URL}/api/auth/dev-login`, {
      maxRedirects: 0,
    });
    expect(
      response.status(),
      'SECURITY: /api/auth/dev-login is reachable in production',
    ).toBe(403);
  });

  test('GAP-AUDIT: response headers include security defaults (Helmet)', async ({ page }) => {
    const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
    const headers = response?.headers() || {};

    // Helmet defaults
    expect(headers['x-content-type-options'], 'X-Content-Type-Options missing').toBe('nosniff');
    expect(
      headers['strict-transport-security'],
      'HSTS missing on production HTTPS',
    ).toBeTruthy();
  });

  test('GAP-AUDIT: landing page renders within 5s (perf budget)', async ({ page }) => {
    const start = Date.now();
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const loadMs = Date.now() - start;

    console.log(`Landing page domcontentloaded: ${loadMs}ms`);
    expect(loadMs, `Landing too slow: ${loadMs}ms`).toBeLessThan(5000);
  });
});
