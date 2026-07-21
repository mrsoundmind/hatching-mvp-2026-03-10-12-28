/**
 * Phase 36 visual checkpoint screenshot capture.
 *
 * Captures 3 screenshots of ArtifactPanel in the wireframe-approved states:
 *   1. /tmp/36-03-screenshot-1-default.png    — default state (rubric collapsed, no Accept/Dismiss)
 *   2. /tmp/36-03-screenshot-2-accepted.png   — Accept clicked + Rubric expanded
 *   3. /tmp/36-03-screenshot-3-revert.png     — AutoRevertBanner visible
 *
 * Strategy: mock the deliverable + versions + iterate endpoints in the browser
 * (Playwright route interception) so the screenshot is deterministic and does
 * not depend on a real LLM call.
 *
 * Run via: cd /path/to/repo && node --import tsx tests/phase-36-screenshot.mjs
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

const BASE = 'http://localhost:5001';

const mockDeliverable = {
  id: 'phase-36-screenshot-deliverable',
  projectId: 'phase-36-screenshot-project',
  title: 'Launch PRD — Mobile App',
  type: 'prd',
  status: 'complete',
  content:
    '# Overview\n\nHatchin Mobile is a companion app for the web platform, letting users continue conversations with their Hatch team on the go.\n\n## Problem Statement\n\nFounders lose context when switching from desktop to mobile during commute or travel. Users miss real-time agent updates because they can\'t keep the browser tab open.\n\n## Goals & Success Metrics\n\n- Reduce time-to-context-restore from 4 min → under 30 sec\n- 40% of WAUs use mobile at least once per week within 90 days',
  currentVersion: 1,
  agentName: 'Alex',
  agentRole: 'Product Manager',
  agentId: 'agent-alex',
  handoffNotes: null,
  packageId: null,
  userAcceptedAt: null,
  dismissedAt: null,
  editsCount: 0,
  impressionCount: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockRubricBreakdown = [
  {
    criterion: 'problem_clarity',
    score: 9,
    justification: 'Specific user named (founders on mobile); pain point quantified.',
  },
  {
    criterion: 'solution_specificity',
    score: 8,
    justification: 'Companion-app scope clear; missing offline-mode answer.',
  },
  {
    criterion: 'success_metrics',
    score: 9,
    justification: 'Two concrete metrics with target + timeframe.',
  },
  {
    criterion: 'risk_coverage',
    score: 7,
    justification: 'Mentions tab-close risk but not auth-token storage on device.',
  },
  {
    criterion: 'user_story_quality',
    score: 9,
    justification: 'Clear actor-action-outcome shape across the user flows.',
  },
];

const mockVersions = (overrides = {}) => ({
  versions: [
    {
      id: 'v1',
      versionNumber: 1,
      content: mockDeliverable.content,
      changeDescription: 'Initial version',
      createdAt: new Date().toISOString(),
      rubricVersion: '1.0.0',
      rubricScore: { total: 8.4, breakdown: mockRubricBreakdown },
      revertedFromHigherScore: false,
      ...overrides,
    },
  ],
});

async function captureState(label, fn) {
  console.log(`[${label}] starting`);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    storageState: 'tests/e2e/.auth/session.json',
  });
  const page = await ctx.newPage();

  const errs = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errs.push(m.text());
  });

  await fn(page, ctx);

  if (errs.length) {
    console.log(`[${label}] console errors:`, errs.slice(0, 5).join(' | '));
  }
  await browser.close();
  console.log(`[${label}] DONE`);
}

async function mockArtifactRoutes(page, deliverableState = {}, versionsState = {}) {
  const fullDeliverable = { ...mockDeliverable, ...deliverableState };
  await page.route(`**/api/deliverables/${mockDeliverable.id}`, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ deliverable: fullDeliverable }),
    });
  });
  await page.route(`**/api/deliverables/${mockDeliverable.id}/versions`, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockVersions(versionsState)),
    });
  });
  await page.route(`**/api/deliverables/${mockDeliverable.id}/impression`, (route) => {
    route.fulfill({ status: 204, body: '' });
  });
}

async function openPanel(page) {
  // Pre-seed onboarding-complete BEFORE the SPA loads so the WelcomeModal doesn't render.
  // hasCompletedOnboarding key is per-user; we set a wildcard since we don't know the
  // userId until after auth — set it on every user key the app might read.
  await page.addInitScript(() => {
    // Mark onboarding complete for any user id the app reads (catch-all via Proxy keys)
    const orig = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
      if (typeof key === 'string' && key.startsWith('hasCompletedOnboarding:')) return 'true';
      return orig.call(this, key);
    };
  });
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2500);
  // Best-effort: dismiss any leftover WelcomeModal close button before continuing.
  await page
    .locator('button[aria-label*="Close" i], button:has-text("Got it")')
    .first()
    .click({ timeout: 1500 })
    .catch(() => {});
  await page
    .locator('aside, [data-testid="input-message"]')
    .first()
    .waitFor({ state: 'visible', timeout: 20000 })
    .catch(() => {});
  await page.evaluate((id) => {
    window.dispatchEvent(new CustomEvent('open_deliverable', { detail: { deliverableId: id } }));
  }, mockDeliverable.id);
  await page
    .locator('[aria-label="Close artifact panel"]')
    .waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(900);
}

async function screenshotPanel(page, path) {
  const panel = page.locator('[aria-label="Close artifact panel"]').locator(
    'xpath=ancestor::div[contains(@class,"premium-column-bg")]',
  );
  if (await panel.isVisible({ timeout: 2000 }).catch(() => false)) {
    await panel.screenshot({ path });
  } else {
    await page.screenshot({ path, fullPage: false });
  }
}

(async () => {
  // === Screenshot 1: default state (rubric collapsed, no Accept/Dismiss) ===
  await captureState('default', async (page) => {
    await mockArtifactRoutes(page);
    await openPanel(page);
    await screenshotPanel(page, '/tmp/36-03-screenshot-1-default.png');
  });

  // === Screenshot 2: Score chip clicked — breakdown expanded ===
  await captureState('breakdown', async (page) => {
    await mockArtifactRoutes(page);
    await openPanel(page);
    await page
      .locator('[data-testid="score-chip"]')
      .click({ timeout: 5000 })
      .catch(() => {});
    await page.waitForTimeout(400);
    await screenshotPanel(page, '/tmp/36-03-screenshot-2-accepted.png');
  });

  // === Screenshot 3: AutoRevertBanner visible ===
  await captureState('revert', async (page) => {
    await mockArtifactRoutes(page);
    await page.route(`**/api/deliverables/${mockDeliverable.id}/iterate`, (route) => {
      const rejectedBreakdown = mockRubricBreakdown.map((b) => ({
        ...b,
        score: Math.max(1, b.score - 4),
        justification: 'Lost specificity after the refinement; key details dropped.',
      }));
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          deliverable: { ...mockDeliverable, rubricVersion: '1.0.0' },
          reverted: true,
          oldScore: { total: 8.4, breakdown: mockRubricBreakdown },
          newScore: {
            total: 5.2,
            breakdown: rejectedBreakdown,
          },
        }),
      });
    });

    await openPanel(page);

    await page
      .locator('[data-testid="refine-button"]')
      .click({ timeout: 5000 })
      .catch(() => {});
    await page.waitForTimeout(300);
    await page
      .locator('[data-testid="refine-input"]')
      .fill('remove the success metrics and reduce risk coverage', { timeout: 5000 })
      .catch(() => {});
    await page
      .locator('[data-testid="refine-send"]')
      .click({ timeout: 5000 })
      .catch(() => {});
    await page
      .locator('[data-testid="auto-revert-banner"]')
      .waitFor({ state: 'visible', timeout: 10000 })
      .catch(() => {
        console.log('[revert] banner did not appear within 10s');
      });
    await page.waitForTimeout(700);
    await screenshotPanel(page, '/tmp/36-03-screenshot-3-revert.png');
  });

  for (const f of [
    '/tmp/36-03-screenshot-1-default.png',
    '/tmp/36-03-screenshot-2-accepted.png',
    '/tmp/36-03-screenshot-3-revert.png',
  ]) {
    const stat = await fs.stat(f).catch(() => null);
    if (!stat) {
      console.error(`MISSING: ${f}`);
      process.exit(1);
    }
    console.log(`OK ${f} (${stat.size} bytes)`);
  }
})();
