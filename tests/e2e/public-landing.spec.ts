import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helper: collect console errors during a test
// ---------------------------------------------------------------------------
function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Filter expected noise in test environment
      if (
        text.includes('favicon') ||
        text.includes('extension') ||
        text.includes('net::ERR') ||
        text.includes('WebSocket') ||
        text.includes('429') ||
        text.includes('Failed to load resource') ||
        text.includes('Failed to validate session') ||
        text.includes('ResizeObserver') ||
        text.includes('vite') ||
        text.includes('HMR')
      ) return;
      errors.push(text);
    }
  });
  return errors;
}

// ===========================================================================
// LANDING PAGE  (LandingPage.tsx — served at `/` for logged-out users)
// ===========================================================================
test.describe('Landing Page', () => {
  test('loads at / for logged-out users', async ({ page }) => {
    await page.goto('/');
    // The header brand text "Hatchin." should be visible
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('header').getByText('Hatchin.')).toBeVisible();
  });

  test('hero section visible with headline and CTA', async ({ page }) => {
    await page.goto('/');
    // Headline is split across spans: "Every dream needs a team." + "We built yours."
    await expect(page.locator('h1 >> text=Every dream needs a team.')).toBeVisible();
    await expect(page.locator('h1 >> text=We built yours.')).toBeVisible();

    // CTA link — "Meet Your Team →"
    const ctaLink = page.locator('a', { hasText: /Meet Your Team/i }).first();
    await expect(ctaLink).toBeVisible();
  });

  test('header CTA "Meet Your Team" links to /login', async ({ page }) => {
    await page.goto('/');
    const ctaLink = page.locator('a[href="/login"]', { hasText: /Meet Your Team/i }).first();
    await expect(ctaLink).toHaveAttribute('href', '/login');
  });

  test('Maya chat panel loads with greeting message', async ({ page }) => {
    await page.goto('/');
    // The chat header shows "Maya" with a live indicator
    await expect(page.locator('text=Maya').first()).toBeVisible();
    // Wait for the typewriter greeting to begin (first message from Maya)
    await expect(page.getByText(/been building alone/i)).toBeVisible({ timeout: 10000 });
  });

  test('name input field visible after greeting', async ({ page }) => {
    await page.goto('/');
    // Wait for the greeting to finish typing (the input appears in "awaiting_name" state)
    const nameInput = page.getByPlaceholder('What should we call you?');
    await expect(nameInput).toBeVisible({ timeout: 15000 });
  });

  test('skip button available on name input', async ({ page }) => {
    await page.goto('/');
    const skipButton = page.getByRole('button', { name: /Skip/i });
    await expect(skipButton).toBeVisible({ timeout: 15000 });
  });

  test('footer links exist for privacy and terms', async ({ page }) => {
    await page.goto('/');
    const privacyLink = page.locator('footer a[href="/legal/privacy"]');
    const termsLink = page.locator('footer a[href="/legal/terms"]');
    await expect(privacyLink).toBeVisible();
    await expect(termsLink).toBeVisible();
    await expect(privacyLink).toHaveText('Privacy');
    await expect(termsLink).toHaveText('Terms');
  });

  test('subtitle / subtext visible', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByText(/AI teammates with real personalities/i),
    ).toBeVisible();
    await expect(page.getByText(/Free. No credit card required./i)).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // Responsive tests
  // ---------------------------------------------------------------------------
  test('responsive: renders at 1440px desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('text=Every dream needs a team.').first()).toBeVisible();
  });

  test('responsive: renders at 768px tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('text=Every dream needs a team.').first()).toBeVisible();
  });

  test('responsive: renders at 375px mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('text=Every dream needs a team.').first()).toBeVisible();
  });

  test('no horizontal overflow at mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    // Wait for content to settle
    await page.waitForTimeout(2000);
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(375);
  });

  test('scroll through page — no layout breaks', async ({ page }) => {
    await page.goto('/');
    const errors = collectConsoleErrors(page);

    // Scroll to the bottom of the page incrementally
    await page.evaluate(async () => {
      const distance = 300;
      const delay = 100;
      const scrollHeight = document.documentElement.scrollHeight;
      let currentPosition = 0;
      while (currentPosition < scrollHeight) {
        window.scrollBy(0, distance);
        currentPosition += distance;
        await new Promise((r) => setTimeout(r, delay));
      }
    });

    // Footer should be reachable
    await expect(page.locator('footer')).toBeVisible();

    // Console errors already filtered by collectConsoleErrors helper
    expect(errors).toHaveLength(0);
  });

  test('headings are visible and readable', async ({ page }) => {
    await page.goto('/');
    // Main page heading
    const h1 = page.locator('header h1');
    await expect(h1).toBeVisible();
    const fontSize = await h1.evaluate((el) =>
      parseFloat(window.getComputedStyle(el).fontSize),
    );
    // Heading should be at least 24px
    expect(fontSize).toBeGreaterThanOrEqual(24);
  });

  test('no console errors on page load', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto('/');
    await page.waitForTimeout(3000);
    // Console errors already filtered by collectConsoleErrors helper
    const appErrors = errors;
    expect(appErrors).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // USP cards (bento grid)
  // ---------------------------------------------------------------------------
  test('USP panel labels are visible', async ({ page }) => {
    await page.goto('/');
    // At least the first USP card label should be visible on desktop
    await expect(page.getByText('[ your team ]')).toBeVisible();
  });
});

// ===========================================================================
// LOGIN PAGE  (login.tsx — served at `/login`)
// ===========================================================================
test.describe('Login Page', () => {
  test('loads at /login', async ({ page }) => {
    await page.goto('/login');
    // The Hatchin brand mark
    await expect(page.locator('text=Hatchin.').first()).toBeVisible();
  });

  test('headline visible', async ({ page }) => {
    await page.goto('/login');
    await expect(
      page.getByRole('heading', { name: /Your AI team is ready/i }),
    ).toBeVisible();
  });

  test('Google OAuth button visible and clickable', async ({ page }) => {
    await page.goto('/login');
    const googleBtn = page.getByText(/Get Started with Google/i);
    await expect(googleBtn).toBeVisible();
    // Verify it links to the OAuth start endpoint
    const link = page.locator('a', { hasText: /Get Started with Google/i });
    const href = await link.getAttribute('href');
    expect(href).toContain('/api/auth/google/start');
  });

  test('legal links present (Terms, Privacy)', async ({ page }) => {
    await page.goto('/login');
    await expect(
      page.locator('a[href="/legal/terms"]'),
    ).toBeVisible();
    await expect(
      page.locator('a[href="/legal/privacy"]'),
    ).toBeVisible();
  });

  test('animated background renders (no white flash)', async ({ page }) => {
    await page.goto('/login');
    // The right panel has animated gradient orbs; verify the section exists
    // and has background styling (not a blank white page)
    const rightPanel = page.locator('section').nth(1);
    await expect(rightPanel).toBeVisible();
    // Check that at least one animated gradient layer exists
    const orbCount = await page.locator('.mix-blend-screen').count();
    expect(orbCount).toBeGreaterThan(0);
  });

  test('responsive: login page at desktop 1440px', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/login');
    await expect(
      page.getByRole('heading', { name: /Your AI team is ready/i }),
    ).toBeVisible();
    // Both columns should be visible on large screens
    const sections = page.locator('main > section');
    await expect(sections.nth(0)).toBeVisible();
    await expect(sections.nth(1)).toBeVisible();
  });

  test('responsive: login page at mobile 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/login');
    await expect(
      page.getByRole('heading', { name: /Your AI team is ready/i }),
    ).toBeVisible();
    await expect(page.getByText(/Get Started with Google/i)).toBeVisible();
  });

  test('carousel indicators visible', async ({ page }) => {
    await page.goto('/login');
    // Three carousel dot buttons with aria-labels
    for (const slide of [1, 2, 3]) {
      await expect(
        page.getByLabel(`Go to slide ${slide}`),
      ).toBeVisible();
    }
  });

  test('no console errors on login page', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto('/login');
    await page.waitForTimeout(3000);
    expect(errors).toHaveLength(0);
  });
});

// ===========================================================================
// 404 PAGE  (not-found.tsx — any unmatched route)
// ===========================================================================
test.describe('404 Page', () => {
  test('shows 404 content for unknown route', async ({ page }) => {
    await page.goto('/nonexistent-page-xyz');
    await expect(page.getByText('404')).toBeVisible();
  });

  test('shows descriptive message', async ({ page }) => {
    await page.goto('/nonexistent-page-xyz');
    await expect(
      page.getByText(/doesn.t exist or may have been moved/i),
    ).toBeVisible();
  });

  test('has link back to home', async ({ page }) => {
    await page.goto('/nonexistent-page-xyz');
    const homeLink = page.getByRole('link', { name: /Back to projects/i });
    await expect(homeLink).toBeVisible();
    await expect(homeLink).toHaveAttribute('href', '/');
  });

  test('styled correctly (card layout, not raw error)', async ({ page }) => {
    await page.goto('/nonexistent-page-xyz');
    // The 404 page uses a Card component — verify it has a styled container
    // The page has a min-h-screen centered layout with a card
    const card = page.locator('.min-h-screen');
    await expect(card).toBeVisible();
    // Alert icon should be present
    const icon = page.locator('svg');
    await expect(icon.first()).toBeVisible();
  });

  test('no console errors on 404 page', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto('/nonexistent-page-xyz');
    await page.waitForTimeout(2000);
    expect(errors).toHaveLength(0);
  });
});

// ===========================================================================
// DARK MODE  (if toggle accessible pre-auth — LandingPage forces dark theme)
// ===========================================================================
test.describe('Dark Mode (Landing)', () => {
  test('landing page renders in dark mode by default', async ({ page }) => {
    await page.goto('/');
    // LandingPage sets isThemeDark=true on init. The page uses bg-background
    // which resolves to a dark value. Verify the page isn't bright white.
    await page.waitForTimeout(2000);
    const bgColor = await page.evaluate(() => {
      const root = document.documentElement;
      return window.getComputedStyle(root).backgroundColor;
    });
    // If a dark theme is applied, background won't be pure white (rgb(255, 255, 255))
    expect(bgColor).not.toBe('rgb(255, 255, 255)');
  });

  test('text is readable against dark background', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    // Check the main heading has sufficient contrast (text is not invisible)
    const h1 = page.locator('header h1');
    await expect(h1).toBeVisible();
    const color = await h1.evaluate((el) =>
      window.getComputedStyle(el).color,
    );
    // Text color should not be the same as background (i.e. not invisible)
    expect(color).not.toBe('rgba(0, 0, 0, 0)');
    expect(color).not.toBe('transparent');
  });
});
