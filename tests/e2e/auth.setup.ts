import { test as setup, expect } from '@playwright/test';

/**
 * Playwright auth setup:
 * 1. Hits /api/auth/dev-login to create a session
 * 2. Creates a test project so all tests have data to work with (if none exist)
 * 3. Saves session cookies for reuse by all test files
 */
setup('authenticate and create test project', async ({ page }) => {
  // Step 1: Authenticate via dev-login
  // Use page.goto which follows the redirect to / and loads the SPA
  await page.goto('/api/auth/dev-login', { timeout: 60000, waitUntil: 'domcontentloaded' });

  // Verify we're authenticated — should NOT see login page
  // Wait for the SPA to load (may show sidebar or redirect)
  await page.waitForTimeout(2000);
  await expect(page.locator('body')).not.toContainText('Sign in with Google', { timeout: 10000 });

  // Step 1b: Skip onboarding for all future tests
  const userId = await page.evaluate(async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (!res.ok) return null;
      const data = await res.json();
      return data.id || data.user?.id;
    } catch {
      return null;
    }
  });
  if (userId) {
    await page.evaluate((uid) => {
      localStorage.setItem(`hasCompletedOnboarding:${uid}`, 'true');
    }, userId);
  }

  // Step 2: Check if a project already exists
  const projects = await page.evaluate(async () => {
    try {
      const res = await fetch('/api/projects');
      if (!res.ok) return [];
      return res.json();
    } catch {
      return [];
    }
  });

  if (!projects || projects.length === 0) {
    // Create a test project via fetch inside the page (preserves session cookies)
    const created = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Playwright Test Project',
            emoji: '\ud83e\uddea',
            description: 'Auto-created for E2E testing',
            starterPackId: 'saas-startup',
          }),
        });
        return res.ok;
      } catch {
        return false;
      }
    });

    if (created) {
      // Wait for project initialization (Maya welcome, teams, agents)
      await page.waitForTimeout(3000);
    } else {
      // Project creation failed (rate-limit or other) — check if projects appeared via retry
      const retryProjects = await page.evaluate(async () => {
        try {
          const res = await fetch('/api/projects');
          if (!res.ok) return [];
          return res.json();
        } catch {
          return [];
        }
      });
      // If still no projects, this is a real failure
      expect(
        retryProjects.length,
        'No projects exist and creation failed (possible rate-limit). Restart dev server or wait.',
      ).toBeGreaterThan(0);
    }
  }

  // Step 3: Reload to pick up the new project state and auto-select it
  await page.goto('/', { timeout: 45000, waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Verify app loaded with project (should see chat input or project tree)
  const hasApp = await page
    .locator('[data-testid="input-message"], [placeholder*="Search projects"]')
    .first()
    .isVisible({ timeout: 15000 })
    .catch(() => false);
  expect(hasApp).toBeTruthy();

  // Step 4: Save authenticated session state
  await page.context().storageState({ path: 'tests/e2e/.auth/session.json' });
});
