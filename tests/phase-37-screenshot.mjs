/**
 * Phase 37 visual checkpoint screenshot capture (TREE-03 + TREE-04).
 *
 * Captures 3 screenshots focused on the right-sidebar Activity tab so the
 * new [Flat]/[Tree] toggle, RunTreeView, and step rows are clearly visible:
 *   1. /tmp/37-03-screenshot-1-flat.png   — Activity tab in default Flat mode
 *   2. /tmp/37-03-screenshot-2-tree.png   — Activity tab in Tree mode with 1 seeded run (3 steps)
 *   3. /tmp/37-03-screenshot-3-empty.png  — Activity tab in Tree mode showing empty state
 *
 * Strategy: mock the GET /api/projects/:projectId/runs endpoint via Playwright
 * route interception so screenshots are deterministic and don't require a real
 * autonomy chain to execute. Mirrors tests/phase-36-screenshot.mjs auth setup.
 *
 * Run via: cd /path/to/repo && node --import tsx tests/phase-37-screenshot.mjs
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

const BASE = 'http://localhost:5001';

// Mock run-tree response for the "populated tree" screenshot.
const mockRun = {
  id: 'phase-37-screenshot-run',
  traceId: 'phase-37-screenshot-trace',
  projectId: '',
  userId: null,
  rootAgentId: 'agent-alex',
  rootGoal: 'Draft the launch announcement and route through brand review',
  status: 'complete',
  stepCount: 3,
  aggregateScoreDelta: 1.4,
  metadata: {},
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockSteps = [
  {
    id: 'step-root',
    runId: mockRun.id,
    parentStepId: null,
    traceId: mockRun.traceId,
    agentId: 'agent-alex',
    agentName: 'Alex',
    agentRole: 'PM',
    stepType: 'task',
    title: 'Draft the launch announcement copy',
    status: 'complete',
    deliverableId: 'deliverable-launch-copy',
    deliverableVersionId: 'version-1',
    deliverableVersionNumber: 1,
    scoreDelta: 0.6,
    metadata: {},
    startedAt: new Date(Date.now() - 60000).toISOString(),
    completedAt: new Date(Date.now() - 45000).toISOString(),
    latencyMs: 15000,
    timeoutAt: null,
  },
  {
    id: 'step-handoff',
    runId: mockRun.id,
    parentStepId: 'step-root',
    traceId: mockRun.traceId,
    agentId: 'agent-alex',
    agentName: 'Alex',
    agentRole: 'PM',
    stepType: 'handoff',
    title: 'Alex → Cass: brand voice review',
    status: 'complete',
    deliverableId: null,
    deliverableVersionId: null,
    deliverableVersionNumber: null,
    scoreDelta: null,
    metadata: {},
    startedAt: new Date(Date.now() - 44000).toISOString(),
    completedAt: new Date(Date.now() - 44000).toISOString(),
    latencyMs: 200,
    timeoutAt: null,
  },
  {
    id: 'step-child',
    runId: mockRun.id,
    parentStepId: 'step-handoff',
    traceId: mockRun.traceId,
    agentId: 'agent-cass',
    agentName: 'Cass',
    agentRole: 'Brand',
    stepType: 'task',
    title: 'Refine launch copy with brand voice alignment',
    status: 'complete',
    deliverableId: 'deliverable-launch-copy',
    deliverableVersionId: 'version-2',
    deliverableVersionNumber: 2,
    scoreDelta: 0.8,
    metadata: {},
    startedAt: new Date(Date.now() - 43000).toISOString(),
    completedAt: new Date(Date.now() - 20000).toISOString(),
    latencyMs: 23000,
    timeoutAt: null,
  },
];

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
  page.on('pageerror', (err) => errs.push(`pageerror: ${err.message}`));

  await fn(page, ctx);

  if (errs.length) {
    console.log(`[${label}] console errors:`, errs.slice(0, 3).join(' | ').slice(0, 400));
  }
  await browser.close();
  console.log(`[${label}] DONE`);
}

async function openAppAndSeedMode(page, mode) {
  // Pre-seed onboarding-complete BEFORE the SPA loads so the WelcomeModal doesn't render.
  // ALSO pre-seed the view-mode preference for the test project so the Activity tab
  // reads the desired mode in its lazy useState initializer.
  await page.addInitScript((targetMode) => {
    const orig = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
      if (typeof key === 'string' && key.startsWith('hasCompletedOnboarding:')) return 'true';
      if (typeof key === 'string' && key.startsWith('activityViewMode:')) return targetMode;
      return orig.call(this, key);
    };
  }, mode);

  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2500);
  // Best-effort: dismiss any leftover WelcomeModal close button
  await page
    .locator('button[aria-label*="Close" i], button:has-text("Got it")')
    .first()
    .click({ timeout: 1500 })
    .catch(() => {});

  // Wait for the SPA chrome
  await page
    .locator('aside, [data-testid="input-message"]')
    .first()
    .waitFor({ state: 'visible', timeout: 20000 })
    .catch(() => {});
}

async function ensureActivityTabActive(page) {
  // The right sidebar tab bar buttons — try multiple locator patterns
  const activityBtn = page
    .locator('button:has-text("Activity"), [role="tab"]:has-text("Activity")')
    .first();
  if (await activityBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await activityBtn.click({ timeout: 5000 }).catch(() => {});
  }
  await page.waitForTimeout(700);
}

async function screenshotSidebar(page, path) {
  // Capture the right sidebar region only — full width zoom on the tab content.
  // The right sidebar is the right ~300px of the viewport.
  const sidebar = page.locator('aside').last();
  if (await sidebar.isVisible({ timeout: 2000 }).catch(() => false)) {
    await sidebar.screenshot({ path });
  } else {
    // Fallback: full screenshot
    await page.screenshot({ path, fullPage: false });
  }
}

(async () => {
  // === Screenshot 1: Activity tab in Flat mode (default) ===
  await captureState('flat', async (page) => {
    await page.route('**/api/projects/*/runs', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ runs: [], steps: [] }),
      });
    });
    await openAppAndSeedMode(page, 'flat');
    await ensureActivityTabActive(page);
    await page.waitForTimeout(800);
    await screenshotSidebar(page, '/tmp/37-03-screenshot-1-flat.png');
  });

  // === Screenshot 2: Activity tab in Tree mode with 1 seeded run (3 steps) ===
  await captureState('tree-populated', async (page) => {
    await page.route('**/api/projects/*/runs', (route) => {
      const url = new URL(route.request().url());
      const match = url.pathname.match(/\/api\/projects\/([^/]+)\/runs/);
      const pid = match ? match[1] : 'unknown';
      const runWithProject = { ...mockRun, projectId: pid };
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ runs: [runWithProject], steps: mockSteps }),
      });
    });
    await openAppAndSeedMode(page, 'tree');
    await ensureActivityTabActive(page);
    await page.waitForTimeout(1800);
    await screenshotSidebar(page, '/tmp/37-03-screenshot-2-tree.png');
  });

  // === Screenshot 3: Activity tab in Tree mode showing empty state ===
  await captureState('tree-empty', async (page) => {
    await page.route('**/api/projects/*/runs', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ runs: [], steps: [] }),
      });
    });
    await openAppAndSeedMode(page, 'tree');
    await ensureActivityTabActive(page);
    await page.waitForTimeout(1500);
    await screenshotSidebar(page, '/tmp/37-03-screenshot-3-empty.png');
  });

  for (const f of [
    '/tmp/37-03-screenshot-1-flat.png',
    '/tmp/37-03-screenshot-2-tree.png',
    '/tmp/37-03-screenshot-3-empty.png',
  ]) {
    const stat = await fs.stat(f).catch(() => null);
    if (!stat) {
      console.error(`MISSING: ${f}`);
      process.exit(1);
    }
    console.log(`OK ${f} (${stat.size} bytes)`);
  }
})();
