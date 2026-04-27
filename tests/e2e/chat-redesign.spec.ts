import { test, expect } from '@playwright/test';
import { ensureAppLoaded } from './helpers';

// Regression tests for the 2026-04-18 chat canvas + sidebar polish pass.
// These lock in the specific dimensions and structural choices so future edits
// don't silently revert them.

async function ensureProjectExists(page: import('@playwright/test').Page) {
  const res = await page.request.get('/api/projects');
  const projects = await res.json();
  if (Array.isArray(projects) && projects.length > 0) return projects[0];
  const createRes = await page.request.post('/api/projects', {
    data: { name: 'E2E Redesign Project', emoji: '🧪', description: 'Redesign regression tests', color: 'blue' },
  });
  return createRes.json();
}

test.describe('Chat canvas redesign', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await ensureProjectExists(page);
    await ensureAppLoaded(page);
  });

  test('ChatHeader renders as a slim single-row bar (≤ 60px)', async ({ page }) => {
    const header = page.locator('main').first().locator('> div').first();
    await expect(header).toBeVisible();

    const box = await header.boundingBox();
    expect(box).not.toBeNull();
    // Thin bar target is 44px; allow some padding/border slack up to 60px.
    expect(box!.height).toBeLessThanOrEqual(60);
    expect(box!.height).toBeGreaterThanOrEqual(36);
  });

  test('ChatHeader contains Add Hatch button (button preserved)', async ({ page }) => {
    const addHatch = page.getByRole('button', { name: /add hatch/i });
    await expect(addHatch).toBeVisible();
  });

  test('ChatInput is slim at rest (≤ 130px including wrapper)', async ({ page }) => {
    const input = page.locator('[data-testid="input-message"]');
    await expect(input).toBeVisible();

    // Walk up to the form wrapper (ChatInput's outer div is p-3-ish).
    const form = input.locator('xpath=ancestor::form').first();
    const box = await form.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeLessThanOrEqual(130);
  });

  test('ChatInput form has translucent backdrop-blur class (no flat gradient)', async ({ page }) => {
    const input = page.locator('[data-testid="input-message"]');
    const form = input.locator('xpath=ancestor::form').first();
    const classes = (await form.getAttribute('class')) ?? '';
    expect(classes).toContain('backdrop-blur-md');
    expect(classes).toMatch(/\/60/);
  });

  test('No bottom-fade gradient strip above ChatInput', async ({ page }) => {
    // The old "Bottom fade" div used gradient-to-t from --premium-bg-end.
    // It was removed — verify no such absolute-positioned gradient overlay exists.
    const fades = page.locator('main').first().locator('div.bg-gradient-to-t.absolute');
    await expect(fades).toHaveCount(0);
  });
});

test.describe('LeftSidebar polish', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await ensureProjectExists(page);
    await ensureAppLoaded(page);
  });

  test('LeftSidebar floats with left-edge breathing room (ml > 0)', async ({ page }) => {
    const sidebar = page.locator('aside').first();
    const box = await sidebar.boundingBox();
    expect(box).not.toBeNull();
    // Was ml-[-10px] (glued to edge), now ml-2.5 (10px).
    // Allow a small tolerance — anything > 4px counts as breathing room.
    expect(box!.x).toBeGreaterThanOrEqual(4);
  });

  test('LeftSidebar has symmetric horizontal padding (not pl-6 asymmetric)', async ({ page }) => {
    const sidebar = page.locator('aside').first();
    const classes = (await sidebar.getAttribute('class')) ?? '';
    // Old class list included `pl-6` making it asymmetric. Should be gone.
    expect(classes).not.toMatch(/\bpl-6\b/);
    expect(classes).toMatch(/\bp-3\b/);
  });
});
