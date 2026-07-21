/**
 * Phase 37 — Git-Style Run Tree runtime smoke spec (TREE-03 / TREE-04 / TREE-05 verification)
 *
 * Runs on a LIVE FRESHLY-RESTARTED dev server per saved memory rule
 * `feedback_verify_in_runtime.md`. Deterministic; 2x-stable; 6 cases per CONTEXT D-23:
 *
 *   1. tree-render           — 3-step chain (task → handoff → task) renders at correct depth.
 *   2. click-to-deliverable  — clicking a step opens ArtifactPanel pinned to the EXACT version
 *                              the step produced (W-4 closure of TREE-04 gap).
 *   3. score-delta-badges    — Better / Worse / New semantic-word pills render per scoreDelta
 *                              (NOT bare signed numbers — verb-led clarity pass from 37-03).
 *   4. backfill-correctness  — flatHistorical metadata flag surfaces the "imported flat from
 *                              history" hint in the UI (TREE-05 surface — backfill correctness
 *                              proper is covered by scripts/test-run-tree-backfill.ts).
 *   5. empty-state           — fresh project shows "No autonomous runs yet" copy.
 *   6. toggle-persistence    — switch to Tree mode, reload, still in Tree mode (localStorage).
 *
 * Selectors (from 37-03 components — see RunTreeView.tsx + RunTreeNode.tsx + ActivityViewModeToggle.tsx):
 *   [data-testid="sidebar-tab-activity"]        — Activity tab in right sidebar
 *   [data-testid="view-mode-flat"]              — Flat view-mode toggle button
 *   [data-testid="view-mode-tree"]              — Tree view-mode toggle button
 *   [data-testid="run-card-{runId}"]            — per-run collapsible card
 *   [data-testid="run-tree-step-{stepId}"]      — per-step button (semantic-word pill inside)
 *
 * Score-delta semantic-word labels (matches shared/scoreFormat.ts:formatScoreDeltaWord):
 *   step scope:     'Better' (positive) / 'Worse' (negative) / 'New' (null/non-finite)
 *   aggregate scope:'Improved' / 'Made worse' / 'In progress'
 *
 * Helpers:
 *   getProjectId(page)                 — fetches first project (auth.setup created one)
 *   seedRunTree(page, pid, runs)       — POST /api/dev/seed-run-tree
 *   resetRunTree(page, pid)            — POST /api/dev/reset-run-tree (used in beforeEach)
 *   markFlatHistorical(page, pid)      — POST /api/dev/mark-flat-historical (case 4)
 */
import { test, expect, type Page } from '@playwright/test';
import { ensureAppLoaded } from './helpers';

interface SeedStep {
  stepType:
    | 'task'
    | 'handoff'
    | 'peer_review'
    | 'deliberation'
    | 'safety_block'
    | 'approval_request';
  parentStepIndex?: number | null;
  agentName: string;
  agentRole: string;
  title: string;
  status: 'pending' | 'running' | 'complete' | 'failed' | 'skipped';
  scoreDelta?: number | null;
  deliverableId?: string | null;
  deliverableVersionId?: string | null;
  deliverableVersionNumber?: number | null;
}

interface SeedRun {
  rootGoal: string;
  metadata?: Record<string, unknown>;
  steps: SeedStep[];
}

async function getProjectId(page: Page): Promise<string> {
  const res = await page.request.get('/api/projects');
  if (!res.ok()) throw new Error(`/api/projects GET failed: ${res.status()}`);
  const projects = (await res.json()) as Array<{ id: string }>;
  if (!projects || projects.length === 0) {
    throw new Error('no projects available; auth.setup.ts should have created one');
  }
  return projects[0].id;
}

async function seedRunTree(page: Page, projectId: string, runs: SeedRun[]): Promise<void> {
  const res = await page.request.post('/api/dev/seed-run-tree', {
    data: { projectId, runs },
    headers: { 'content-type': 'application/json' },
  });
  if (!res.ok()) {
    throw new Error(`seed-run-tree failed: ${res.status()} ${await res.text()}`);
  }
}

async function resetRunTree(page: Page, projectId: string): Promise<void> {
  const res = await page.request.post('/api/dev/reset-run-tree', {
    data: { projectId },
    headers: { 'content-type': 'application/json' },
  });
  if (!res.ok()) {
    throw new Error(`reset-run-tree failed: ${res.status()} ${await res.text()}`);
  }
}

async function markFlatHistorical(page: Page, projectId: string): Promise<void> {
  const res = await page.request.post('/api/dev/mark-flat-historical', {
    data: { projectId },
    headers: { 'content-type': 'application/json' },
  });
  if (!res.ok()) {
    throw new Error(`mark-flat-historical failed: ${res.status()} ${await res.text()}`);
  }
}

/** Switch the right-sidebar Activity tab into Tree view-mode. */
async function switchToTreeMode(page: Page): Promise<void> {
  // Click the Activity tab (default but explicit for resilience).
  const activityTab = page.locator('[data-testid="sidebar-tab-activity"]').first();
  if (await activityTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await activityTab.click({ timeout: 3_000 }).catch(() => {});
  }
  const treeBtn = page.locator('[data-testid="view-mode-tree"]').first();
  await treeBtn.waitFor({ state: 'visible', timeout: 10_000 });
  await treeBtn.click();
  // Confirm aria-checked flipped — the next render cycle re-paints the toggle.
  await expect(treeBtn).toHaveAttribute('aria-checked', 'true', { timeout: 5_000 });
}

test.describe.serial('Phase 37 — Git-Style Run Tree', () => {
  // Ensure the WelcomeModal can't block clicks (mirrors phase-36 / agent-action-probe patterns).
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const orig = Storage.prototype.getItem;
      Storage.prototype.getItem = function (key) {
        if (typeof key === 'string' && key.startsWith('hasCompletedOnboarding:')) return 'true';
        return orig.call(this, key);
      };
    });
    await ensureAppLoaded(page);
    const projectId = await getProjectId(page);
    await resetRunTree(page, projectId);
  });

  // -------------------------------------------------------------------------
  // Case 1 — TREE-03: tree rendering with 3-step chain at correct depth.
  // -------------------------------------------------------------------------
  test('1 — tree-render: 3-step chain (task→handoff→task) renders all step titles', async ({
    page,
  }) => {
    const projectId = await getProjectId(page);
    await seedRunTree(page, projectId, [
      {
        rootGoal: 'Build login page',
        steps: [
          {
            stepType: 'task',
            agentName: 'Coda',
            agentRole: 'engineer',
            title: 'Set up route',
            status: 'complete',
          },
          {
            stepType: 'handoff',
            parentStepIndex: 0,
            agentName: 'Coda',
            agentRole: 'engineer',
            title: 'Coda → Lumi: design review',
            status: 'complete',
          },
          {
            stepType: 'task',
            parentStepIndex: 1,
            agentName: 'Lumi',
            agentRole: 'designer',
            title: 'Review design',
            status: 'complete',
          },
        ],
      },
    ]);
    await page.reload();
    await ensureAppLoaded(page);
    await switchToTreeMode(page);

    // RunTreeView auto-opens the 3 most-recent runs on mount, so step rows
    // appear without any click. Wait for the run card to render, then assert
    // the step rows are visible. If a future change removes auto-open, switch
    // this to an explicit click on the run card button.
    const runCard = page.locator('[data-testid^="run-card-"]').first();
    await expect(runCard).toBeVisible({ timeout: 10_000 });
    // Defensive: if not auto-opened (state not set yet), explicitly toggle.
    const expandToggle = runCard.locator('button[aria-expanded]').first();
    if (await expandToggle.getAttribute('aria-expanded') === 'false') {
      await expandToggle.click();
    }

    // All 3 step titles render after expand.
    await expect(page.getByText('Set up route')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Coda → Lumi: design review')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Review design')).toBeVisible({ timeout: 5_000 });
  });

  // -------------------------------------------------------------------------
  // Case 2 — TREE-04 (W-4 closure): click step → ArtifactPanel pinned to EXACT
  // version (v1) even when v2 is the most-recent.
  // -------------------------------------------------------------------------
  test('2 — click-to-deliverable: clicking step opens ArtifactPanel pinned to step.versionNumber', async ({
    page,
  }) => {
    const projectId = await getProjectId(page);

    // Create a deliverable — yields v1.
    const dRes = await page.request.post('/api/deliverables', {
      data: {
        projectId,
        title: 'Phase 37 spec — TREE-04 deliverable',
        type: 'prd',
        content: '# v1 initial content\n\nFirst version for Phase 37 W-4 test.',
        agentName: 'Coda',
        agentRole: 'Engineer',
      },
      headers: { 'content-type': 'application/json' },
    });
    if (!dRes.ok()) {
      throw new Error(`deliverable create failed: ${dRes.status()} ${await dRes.text()}`);
    }
    const { deliverable } = (await dRes.json()) as { deliverable: { id: string } };
    const deliverableId = deliverable.id;

    // Capture the v1 versionId before iterating.
    const v1Res = await page.request.get(`/api/deliverables/${deliverableId}/versions`);
    if (!v1Res.ok()) throw new Error(`versions GET failed: ${v1Res.status()}`);
    const { versions: v1List } = (await v1Res.json()) as {
      versions: Array<{ id: string; versionNumber: number }>;
    };
    const v1 = v1List.find((v) => v.versionNumber === 1);
    if (!v1) throw new Error('v1 must exist after deliverable create');

    // Iterate to produce v2. We don't care about the judge verdict here — we
    // just need the version list to grow so the version navigator becomes visible.
    const iterRes = await page.request.post(
      `/api/deliverables/${deliverableId}/iterate`,
      {
        data: { instruction: 'Add a Risks section' },
        headers: { 'content-type': 'application/json' },
      },
    );
    if (!iterRes.ok()) {
      throw new Error(`iterate failed: ${iterRes.status()} ${await iterRes.text()}`);
    }

    // Seed a step that produced v1 (NOT the most-recent v2). Clicking it must
    // open the panel to v1 via the W-4 pendingVersionNumber wiring.
    await seedRunTree(page, projectId, [
      {
        rootGoal: 'W-4 click-to-version smoke',
        steps: [
          {
            stepType: 'task',
            agentName: 'Coda',
            agentRole: 'engineer',
            title: 'Produced deliverable v1',
            status: 'complete',
            deliverableId,
            deliverableVersionId: v1.id,
            deliverableVersionNumber: v1.versionNumber,
          },
        ],
      },
    ]);

    await page.reload();
    await ensureAppLoaded(page);
    await switchToTreeMode(page);

    // RunTreeView auto-opens the 3 most-recent runs on mount.
    const runCard = page.locator('[data-testid^="run-card-"]').first();
    await expect(runCard).toBeVisible({ timeout: 10_000 });
    const expandToggle = runCard.locator('button[aria-expanded]').first();
    if (await expandToggle.getAttribute('aria-expanded') === 'false') {
      await expandToggle.click();
    }

    // Click the step row (use the testid for the step button — most stable).
    const stepBtn = page.locator('[data-testid^="run-tree-step-"]').first();
    await expect(stepBtn).toBeVisible({ timeout: 10_000 });
    await stepBtn.click();

    // (a) The ArtifactPanel opens — the deliverable title is visible. The title
    // may appear in multiple places (panel header + deliverables list); we only
    // need to verify at least one is rendered, which proves the panel mounted.
    await expect(page.getByText('Phase 37 spec — TREE-04 deliverable').first()).toBeVisible({
      timeout: 10_000,
    });
    // Confirm the artifact panel itself is open via its close button (the canonical
    // signal — present only when the panel is mounted per phase-36 spec convention).
    await expect(page.locator('[aria-label="Close artifact panel"]')).toBeVisible({
      timeout: 5_000,
    });

    // (b) W-4 assertion — version navigator shows "v1 of 2" (v1 is active, v2
    // exists in the list but is NOT the current version). This proves the
    // pendingVersionNumber wiring opened to the EXACT version the step recorded,
    // not the most-recent.
    await expect(page.getByText(/v1\s*of\s*2/i)).toBeVisible({ timeout: 10_000 });
  });

  // -------------------------------------------------------------------------
  // Case 3 — TREE-03: semantic-word delta pills (Better / Worse / New).
  // Per verb-led clarity pass in 37-03, step pills are WORDS not signed numbers.
  // -------------------------------------------------------------------------
  test('3 — score-delta-badges: Better / Worse / New semantic-word pills render correctly', async ({
    page,
  }) => {
    const projectId = await getProjectId(page);
    await seedRunTree(page, projectId, [
      {
        rootGoal: 'Three-step delta showcase',
        steps: [
          {
            stepType: 'task',
            agentName: 'A',
            agentRole: 'r',
            title: 'positive delta step',
            status: 'complete',
            scoreDelta: 1.5,
            deliverableId: 'd-fake-1',
          },
          {
            stepType: 'task',
            agentName: 'B',
            agentRole: 'r',
            title: 'negative delta step',
            status: 'complete',
            scoreDelta: -0.8,
            deliverableId: 'd-fake-2',
          },
          {
            stepType: 'task',
            agentName: 'C',
            agentRole: 'r',
            title: 'null delta step',
            status: 'complete',
            scoreDelta: null,
            deliverableId: 'd-fake-3',
          },
        ],
      },
    ]);
    await page.reload();
    await ensureAppLoaded(page);
    await switchToTreeMode(page);

    const runCard = page.locator('[data-testid^="run-card-"]').first();
    await expect(runCard).toBeVisible({ timeout: 10_000 });
    const expandToggle = runCard.locator('button[aria-expanded]').first();
    if (await expandToggle.getAttribute('aria-expanded') === 'false') {
      await expandToggle.click();
    }

    // The pill text is rendered inside the step button — assert each step row
    // contains its expected semantic-word pill (Better / Worse / New).
    await expect(page.getByText('positive delta step')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('negative delta step')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('null delta step')).toBeVisible({ timeout: 5_000 });

    // Semantic-word badge assertions — these are the user-facing strings post
    // verb-led clarity pass. The pill text is a sibling inside the same button.
    // Use locator() with strict text match to avoid collisions with prose copy.
    const betterPill = page.locator('span', { hasText: /^✓ Better$/ });
    const worsePill = page.locator('span', { hasText: /^⚠ Worse$/ });
    const newPill = page.locator('span', { hasText: /^New$/ });
    await expect(betterPill).toHaveCount(1, { timeout: 5_000 });
    await expect(worsePill).toHaveCount(1, { timeout: 5_000 });
    await expect(newPill.first()).toBeVisible({ timeout: 5_000 });
  });

  // -------------------------------------------------------------------------
  // Case 4 — TREE-05: flatHistorical metadata surfaces "imported flat from
  // history" hint in the UI. (Backfill correctness proper is covered by
  // scripts/test-run-tree-backfill.ts; this case proves the UI surface only.)
  // -------------------------------------------------------------------------
  test('4 — backfill-correctness: flatHistorical run shows "imported flat from history" hint', async ({
    page,
  }) => {
    const projectId = await getProjectId(page);
    await seedRunTree(page, projectId, [
      {
        rootGoal: 'Historical run (backfill simulation)',
        steps: [
          {
            stepType: 'task',
            agentName: 'Old A',
            agentRole: 'r',
            title: 'old step 1',
            status: 'complete',
          },
          {
            stepType: 'task',
            agentName: 'Old A',
            agentRole: 'r',
            title: 'old step 2',
            status: 'complete',
          },
          {
            stepType: 'task',
            agentName: 'Old A',
            agentRole: 'r',
            title: 'old step 3',
            status: 'complete',
          },
          {
            stepType: 'task',
            agentName: 'Old A',
            agentRole: 'r',
            title: 'old step 4',
            status: 'complete',
          },
          {
            stepType: 'task',
            agentName: 'Old A',
            agentRole: 'r',
            title: 'old step 5',
            status: 'complete',
          },
        ],
      },
    ]);
    await markFlatHistorical(page, projectId);
    await page.reload();
    await ensureAppLoaded(page);
    await switchToTreeMode(page);

    const runCard = page.locator('[data-testid^="run-card-"]').first();
    await expect(runCard).toBeVisible({ timeout: 10_000 });
    const expandToggle = runCard.locator('button[aria-expanded]').first();
    if (await expandToggle.getAttribute('aria-expanded') === 'false') {
      await expandToggle.click();
    }
    await expect(page.getByText(/imported flat from history/i)).toBeVisible({ timeout: 10_000 });
  });

  // -------------------------------------------------------------------------
  // Case 5 — empty-state: fresh project shows "No autonomous runs yet" copy.
  // -------------------------------------------------------------------------
  test('5 — empty-state: fresh project shows "No autonomous runs yet" copy', async ({ page }) => {
    // beforeEach already reset; no additional seed.
    await page.reload();
    await ensureAppLoaded(page);
    await switchToTreeMode(page);
    await expect(page.getByText(/No autonomous runs yet/i)).toBeVisible({ timeout: 10_000 });
  });

  // -------------------------------------------------------------------------
  // Case 6 — toggle-persistence: localStorage round-trip for the view-mode toggle.
  // -------------------------------------------------------------------------
  test('6 — toggle-persistence: Tree mode survives reload (localStorage)', async ({ page }) => {
    await switchToTreeMode(page);
    await page.reload();
    await ensureAppLoaded(page);
    // After reload, the Tree button should be aria-checked again.
    const treeBtn = page.locator('[data-testid="view-mode-tree"]').first();
    await expect(treeBtn).toHaveAttribute('aria-checked', 'true', { timeout: 10_000 });
  });
});
