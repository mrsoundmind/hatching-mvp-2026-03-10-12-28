import type { Page } from '@playwright/test';

/**
 * Shared E2E test helper: ensures the app is loaded and ready.
 *
 * - If already on the app with sidebar visible: returns immediately (no navigation).
 * - If on a non-app page (e.g., /account, /nonexistent): navigates to /.
 * - After navigation, waits for sidebar, then selects first project if needed.
 * - Retries navigation once if the server is temporarily unavailable.
 *
 * Uses 'domcontentloaded' instead of default 'load' for faster navigation.
 */
export async function ensureAppLoaded(page: Page) {
  const url = page.url();
  const isOnApp =
    url.includes('localhost:5001') &&
    !url.includes('/login') &&
    !url.includes('/account') &&
    !url.includes('/nonexistent') &&
    !url.includes('/api/') &&
    !url.endsWith('about:blank');

  if (isOnApp) {
    // Fast path: check if sidebar is already visible
    const sidebar = page.locator('aside');
    if (await sidebar.isVisible({ timeout: 2000 }).catch(() => false)) {
      await selectFirstProjectIfNeeded(page);
      return;
    }
    // SPA may still be hydrating — give it more time before re-navigating
    if (await sidebar.isVisible({ timeout: 10000 }).catch(() => false)) {
      await selectFirstProjectIfNeeded(page);
      return;
    }
  }

  // Navigate fresh — use domcontentloaded for faster response
  // Retry once if the server is temporarily unavailable
  try {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
  } catch (err) {
    // Server may have restarted — wait and retry once
    await page.waitForTimeout(5000);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
  }

  // Wait for the app to hydrate — the left sidebar should appear on desktop
  await page.waitForSelector('aside', { timeout: 30000 });
  await selectFirstProjectIfNeeded(page);
  await dismissBlockingModals(page);
}

/**
 * Close common transient modals that block test interactions.
 * Currently handles: QuickStartModal ("How do you want to start?").
 * Idempotent — does nothing if no modals are present.
 */
export async function dismissBlockingModals(page: Page) {
  // QuickStartModal can pop up async after project selection — poll for up to 3s.
  const quickStart = page.getByRole('dialog', { name: 'How do you want to start?' });
  for (let i = 0; i < 6; i++) {
    if (await quickStart.isVisible({ timeout: 0 }).catch(() => false)) break;
    await page.waitForTimeout(500);
  }
  if (await quickStart.isVisible({ timeout: 0 }).catch(() => false)) {
    // QuickStartModal has no Escape handler — click the close (X) button.
    // The X is the first button inside the dialog (in the header row).
    await quickStart.locator('button').first().click({ timeout: 2_000 }).catch(() => {});
    await quickStart.waitFor({ state: 'hidden', timeout: 3_000 }).catch(() => {});
  }
}

/** Click first project if chat input is not visible. */
async function selectFirstProjectIfNeeded(page: Page) {
  const input = page.locator('[data-testid="input-message"]');
  if (!(await input.isVisible({ timeout: 3000 }).catch(() => false))) {
    const firstProject = page.locator('aside').first().locator('span.truncate').first();
    if (await firstProject.isVisible().catch(() => false)) {
      await firstProject.click();
    }
    await input.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  }
}

/**
 * Check if an AI/LLM backend is likely available.
 * Tests that depend on AI responses should call this and skip if unavailable.
 */
export async function isAIAvailable(page: Page): Promise<boolean> {
  try {
    const res = await page.request.get('/api/health');
    if (!res.ok()) return false;
    const body = await res.json();
    // If health endpoint reports provider status, check it
    if (body.llmProvider === 'mock') return false;
    return true;
  } catch {
    return true; // Assume available if health check fails (non-standard)
  }
}
