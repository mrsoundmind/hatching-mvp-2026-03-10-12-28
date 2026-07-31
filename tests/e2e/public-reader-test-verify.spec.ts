/**
 * Phase 39-02 — LIVE verification of the REAL Fresh Reader Review UI (not the mockup).
 * Creates a reader-facing PRD, runs the reader test via the real endpoint, opens the Artifact panel,
 * and asserts the real banner + annotation cards render, then screenshots amber and (after handling)
 * the resolved state. Runs against the already-running dev server.
 *
 * Run: npx playwright test tests/e2e/public-reader-test-verify.spec.ts --project=public
 */
import { test, expect } from '@playwright/test';

// Verify against a controlled server (RT_BASE), defaulting to the standard dev port.
test.use({ baseURL: process.env.RT_BASE || 'http://localhost:5001' });

test('real reader-test banner renders + is actionable in the Artifact panel', async ({ page }) => {
  test.setTimeout(120_000);

  await page.addInitScript(() => {
    try {
      ['hatchin_welcome_seen', 'welcomeSeen', 'hatchin_onboarded', 'onboarding_complete', 'hasSeenWelcome']
        .forEach((k) => window.localStorage.setItem(k, 'true'));
    } catch { /* ignore */ }
  });
  await page.goto('/api/auth/dev-login');
  await page.waitForLoadState('networkidle').catch(() => {});

  let projectId: string | undefined;
  for (let i = 0; i < 5 && !projectId; i++) {
    const res = await page.request.get('/api/projects');
    if (res.ok()) { const p = (await res.json()) as any[]; if (p?.length) projectId = p[0].id; }
    if (!projectId) await page.waitForTimeout(1000);
  }
  // Fresh memory-mode session may have no project — create one.
  if (!projectId) {
    const mk = await page.request.post('/api/projects', {
      data: { name: 'Reader-Test Verify', emoji: '📄', description: 'Reader-test UI verification' },
      headers: { 'content-type': 'application/json' },
    });
    expect(mk.ok(), `create project failed: ${mk.status()} ${await mk.text()}`).toBeTruthy();
    const proj = (await mk.json()) as any;
    projectId = proj?.id || proj?.project?.id;
  }
  expect(projectId).toBeTruthy();

  // Reader-facing PRD with deliberate context-gaps a fresh reader should catch.
  const createRes = await page.request.post('/api/deliverables', {
    data: {
      projectId, title: 'Reader-Test Verify — Jargon PRD', type: 'prd',
      content:
        '# Overview\n\nThis PRD covers the settings redesign. As agreed in the kickoff, we are prioritizing the WAT lever and moving the NSM dashboard to the exec review.\n\n## Problem Statement\n\nUsers cannot find their preferences quickly.\n\n## Goals & Success Metrics\n\nReduce time-to-setting by 40%.',
      agentName: 'Alex', agentRole: 'Product Manager', status: 'complete',
    },
    headers: { 'content-type': 'application/json' },
  });
  expect(createRes.ok(), `create failed: ${createRes.status()}`).toBeTruthy();
  const { deliverable } = (await createRes.json()) as { deliverable: { id: string } };

  // Hit the REAL reader-test endpoint (also proves the running server has the new route).
  const rtRes = await page.request.post(`/api/deliverables/${deliverable.id}/reader-test`, {
    headers: { 'content-type': 'application/json' },
  });
  expect(rtRes.ok(), `reader-test endpoint failed: ${rtRes.status()} ${await rtRes.text()}`).toBeTruthy();
  const rtBody = (await rtRes.json()) as { reviewed: boolean; readerTest: any };
  expect(rtBody.reviewed, 'reviewer should have produced a result').toBe(true);
  expect(rtBody.readerTest?.annotations?.length ?? 0, 'jargon PRD should flag at least one spot').toBeGreaterThan(0);

  // Open the panel.
  await page.goto('/');
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1200);
  const dialogClose = page.getByRole('dialog').getByRole('button', { name: /close/i });
  if (await dialogClose.first().isVisible({ timeout: 1500 }).catch(() => false)) {
    await dialogClose.first().click().catch(() => {});
  }
  await page.waitForTimeout(400);
  await page.evaluate((id) => {
    window.dispatchEvent(new CustomEvent('open_deliverable', { detail: { deliverableId: id } }));
  }, deliverable.id);
  await page.locator('[aria-label="Close artifact panel"]').waitFor({ state: 'visible', timeout: 20_000 });

  // The REAL banner renders, in the amber (needs-look) state, with cards.
  const banner = page.locator('[data-testid="reader-test-banner"]');
  await expect(banner).toBeVisible({ timeout: 10_000 });
  await expect(banner).toHaveAttribute('data-state', 'needs-look');
  await expect(page.locator('[data-testid="reader-test-verdict"]')).toContainText(/stuck|assume/i);
  const cards = page.locator('[data-testid="reader-test-card"]');
  await expect(cards.first()).toBeVisible({ timeout: 5_000 });
  const cardCount = await cards.count();
  expect(cardCount).toBeGreaterThan(0);
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'test-results/reader-test-REAL-amber.png', fullPage: false });

  // Mark the first spot addressed — it should fade / show the done state without error.
  const firstMark = page.locator('[data-testid="reader-test-mark-addressed"]').first();
  if (await firstMark.isVisible({ timeout: 2000 }).catch(() => false)) {
    await firstMark.click();
    await page.waitForTimeout(500);
  }
  await page.screenshot({ path: 'test-results/reader-test-REAL-addressed.png', fullPage: false });

  console.log(`[verify] real banner OK, cards=${cardCount}, deliverable=${deliverable.id}`);
});
