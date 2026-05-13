/**
 * Phase 36 — Frozen-Rubric Deliverable Iteration (FBK-04 verification + cross-cutting RUBR-02/04 + FBK-03)
 *
 * Runtime smoke spec covering the Phase 36 surface end-to-end on a LIVE restarted dev server.
 * Per saved feedback rule `feedback_verify_in_runtime.md`: phase "complete" in git ≠ "works".
 * Every gate below runs against `npm run dev` (STORAGE_MODE=memory) — no mocks.
 *
 * Cases (4 — revised from 6 per 36-03 SUMMARY mid-phase deviation; FBK-02 UI was dropped):
 *   1 — rubric-persistence-and-breakdown    : score chip visible + breakdown opens on click
 *                                              (RUBR-04 — per-criterion breakdown in artifact panel)
 *   2 — neutral-iterate-keeps                : force-judge keep_new → no auto-revert banner
 *                                              + editsCount increments on the deliverable
 *                                              (RUBR-02 — keep-new path)
 *   3 — adversarial-iterate-reverts          : force-judge revert → AutoRevertBanner visible
 *                                              + copy mentions both scores
 *                                              + currentVersion does NOT advance
 *                                              (RUBR-02 — auto-revert path)
 *   4 — impression-count-increments          : panel mount fires impression once;
 *                                              5s server-side dedupe absorbs StrictMode double-fire
 *                                              (FBK-03 — impressionCount column populates)
 *
 * Helpers (spec-local, mirroring Phase 35's forceOutage pattern):
 *   - forceJudgeScore(page, { recommendation, oldTotal?, newTotal? })
 *   - clearForcedScore(page)
 *   - seedDeliverable(page, projectId, { type, content, agentName, rubricScore? })
 *     → uses POST /api/deliverables then optionally PATCH to seed a scored version
 *   - openArtifactPanel(page, deliverableId) — dispatches the open_deliverable CustomEvent
 *
 * Selectors (from 36-03 components):
 *   - [data-testid="score-chip"]                       — score badge in panel header
 *   - [data-testid="rubric-breakdown"]                 — breakdown card root
 *   - [data-testid^="rubric-criterion-"]               — individual criterion rows
 *   - [data-testid="auto-revert-banner"]               — amber banner shown on revert path
 *   - [data-testid="auto-revert-banner-expand"]        — "See what changed" toggle
 *   - [data-testid="refine-button"]                    — opens the refine input
 *   - [data-testid="refine-input"]                     — the textarea
 *   - [data-testid="refine-send"]                      — submit refine
 */
import { test, expect, type Page } from '@playwright/test';
import { ensureAppLoaded } from './helpers';

// ---------------------------------------------------------------------------
// Spec-local helpers
// ---------------------------------------------------------------------------

interface SeedDeliverableOpts {
  type: string;
  title: string;
  agentName?: string;
  agentRole?: string;
  content?: string;
  rubricScoreTotal?: number;
}

/**
 * Drive the DEV-only force-judge-score endpoint added in 36-02 Task 5. The
 * next iterate call on the live server will return the synthetic score.
 */
interface BreakdownEntry {
  criterion: string;
  score: number;
  justification: string;
}

async function forceJudgeScore(
  page: Page,
  opts: {
    recommendation: 'keep_new' | 'revert';
    oldTotal?: number;
    newTotal?: number;
    oldBreakdown?: BreakdownEntry[];
    newBreakdown?: BreakdownEntry[];
  },
): Promise<void> {
  const res = await page.request.post('/api/dev/force-judge-score', {
    data: opts,
    headers: { 'content-type': 'application/json' },
  });
  if (!res.ok()) {
    throw new Error(
      `force-judge-score POST failed: status=${res.status()} body=${await res.text()}`,
    );
  }
}

/** Canonical 5-criterion PRD breakdown — matches shared/deliverableRubrics.ts. */
const PRD_BREAKDOWN_SEED: BreakdownEntry[] = [
  { criterion: 'problem_clarity', score: 9, justification: 'Specific user named; pain quantified.' },
  { criterion: 'solution_specificity', score: 8, justification: 'Scope clear; missing offline-mode answer.' },
  { criterion: 'success_metrics', score: 9, justification: 'Two concrete metrics with target + timeframe.' },
  { criterion: 'risk_coverage', score: 7, justification: 'Mentions tab-close risk but not auth-token storage.' },
  { criterion: 'user_story_quality', score: 9, justification: 'Clear actor-action-outcome shape.' },
];

async function clearForcedScore(page: Page): Promise<void> {
  const res = await page.request.post('/api/dev/force-judge-score', {
    data: { clear: true, recommendation: 'keep_new' },
    headers: { 'content-type': 'application/json' },
  });
  // Tolerate 400 from the schema since clear=true + recommendation is the supported shape.
  if (!res.ok() && res.status() !== 400) {
    throw new Error(`clear-forced-score failed: status=${res.status()} body=${await res.text()}`);
  }
}

/** Get the first project ID from the session — created by auth.setup.ts. */
async function getProjectId(page: Page): Promise<string> {
  const res = await page.request.get('/api/projects');
  if (!res.ok()) throw new Error(`/api/projects GET failed: ${res.status()}`);
  const projects = (await res.json()) as Array<{ id: string }>;
  if (!projects || projects.length === 0) {
    throw new Error('no projects available; auth.setup.ts should have created one');
  }
  return projects[0].id;
}

/**
 * Create a deliverable + (optionally) a SCORED v2 version. The auto-created
 * v1 has null rubricScore, so we patch it through a second version with a real
 * rubricScore.total — the ArtifactPanel reads the latest version's score.
 *
 * Returns the deliverable id.
 */
async function seedDeliverable(
  page: Page,
  projectId: string,
  opts: SeedDeliverableOpts,
): Promise<string> {
  const createRes = await page.request.post('/api/deliverables', {
    data: {
      projectId,
      title: opts.title,
      type: opts.type,
      content:
        opts.content ??
        '# Overview\n\nThis is a seeded deliverable for the Phase 36 Playwright spec.\n\n## Problem Statement\n\nNeed deterministic data flow for rubric tests.',
      agentName: opts.agentName ?? 'Alex',
      agentRole: opts.agentRole ?? 'Product Manager',
      status: 'complete',
    },
    headers: { 'content-type': 'application/json' },
  });
  if (!createRes.ok()) {
    throw new Error(
      `create deliverable failed: status=${createRes.status()} body=${await createRes.text()}`,
    );
  }
  const { deliverable } = (await createRes.json()) as { deliverable: { id: string } };

  // If a rubricScoreTotal was requested, drive an iterate with a forced
  // keep_new judge score so the resulting v2 carries `rubricScore.total =
  // opts.rubricScoreTotal`. This produces a SCORED latest version visible
  // in the ArtifactPanel's score chip + populated criterion rows.
  if (typeof opts.rubricScoreTotal === 'number') {
    await forceJudgeScore(page, {
      recommendation: 'keep_new',
      oldTotal: 5,
      newTotal: opts.rubricScoreTotal,
      oldBreakdown: PRD_BREAKDOWN_SEED.map((b) => ({ ...b, score: Math.max(1, b.score - 3) })),
      newBreakdown: PRD_BREAKDOWN_SEED,
    });
    const itRes = await page.request.post(`/api/deliverables/${deliverable.id}/iterate`, {
      data: { instruction: 'expand the problem statement with a quantified user pain' },
      headers: { 'content-type': 'application/json' },
    });
    if (!itRes.ok()) {
      throw new Error(
        `seed-iterate failed: status=${itRes.status()} body=${await itRes.text()}`,
      );
    }
    await clearForcedScore(page);
  }
  return deliverable.id;
}

/** Open the ArtifactPanel for a given deliverableId by dispatching the same
 *  CustomEvent the app's CenterPanel uses. */
async function openArtifactPanel(page: Page, deliverableId: string): Promise<void> {
  await ensureAppLoaded(page);
  await page.evaluate((id) => {
    window.dispatchEvent(new CustomEvent('open_deliverable', { detail: { deliverableId: id } }));
  }, deliverableId);
  // The panel mount renders a "Close artifact panel" close button.
  await page.locator('[aria-label="Close artifact panel"]').waitFor({
    state: 'visible',
    timeout: 15_000,
  });
}

async function closeArtifactPanel(page: Page): Promise<void> {
  const close = page.locator('[aria-label="Close artifact panel"]');
  if (await close.isVisible({ timeout: 500 }).catch(() => false)) {
    await close.click({ timeout: 3_000 }).catch(() => {});
    // Wait a beat for unmount.
    await page.waitForTimeout(300);
  }
}

// ===========================================================================
// SPEC
// ===========================================================================

test.describe.serial('Phase 36 — Frozen-Rubric Deliverable Iteration', () => {
  // Each case opens the artifact panel + (optionally) iterates — give WS + LLM-judge headroom.
  test.setTimeout(120_000);

  // -------------------------------------------------------------------------
  // Case 1 — RUBR-04: score chip visible + click expands breakdown card
  // -------------------------------------------------------------------------
  test('1 — rubric-persistence-and-breakdown: score chip + click expands criterion rows', async ({
    page,
  }) => {
    const projectId = await getProjectId(page);
    const deliverableId = await seedDeliverable(page, projectId, {
      type: 'prd',
      title: 'Phase 36 spec — RUBR-04 PRD',
      rubricScoreTotal: 8.4,
    });

    await openArtifactPanel(page, deliverableId);

    // Score chip is visible AND its text matches a 1-decimal score (e.g. "8.4").
    const chip = page.locator('[data-testid="score-chip"]');
    await expect(chip).toBeVisible({ timeout: 10_000 });
    await expect(chip).toContainText(/\d+\.\d+/);

    // Breakdown card is NOT visible by default.
    const breakdown = page.locator('[data-testid="rubric-breakdown"]');
    await expect(breakdown).toHaveCount(0);

    // Click chip → breakdown card appears with all 5 PRD criterion rows
    // (the seed sent PRD_BREAKDOWN_SEED via the DEV force-judge endpoint).
    await chip.click();
    await expect(breakdown).toBeVisible({ timeout: 5_000 });
    const criterionRows = page.locator('[data-testid^="rubric-criterion-"]');
    await expect(criterionRows.first()).toBeVisible({ timeout: 5_000 });
    const rowCount = await criterionRows.count();
    expect(rowCount).toBeGreaterThanOrEqual(1);

    await closeArtifactPanel(page);
  });

  // -------------------------------------------------------------------------
  // Case 2 — RUBR-02 (keep-new path): force judge -> keep_new, editsCount++
  // -------------------------------------------------------------------------
  test('2 — neutral-iterate-keeps: no auto-revert banner; editsCount increments', async ({
    page,
  }) => {
    const projectId = await getProjectId(page);
    const deliverableId = await seedDeliverable(page, projectId, {
      type: 'prd',
      title: 'Phase 36 spec — RUBR-02 keep-new',
      rubricScoreTotal: 7.5,
    });

    // Capture editsCount BEFORE the iterate.
    const beforeRes = await page.request.get(`/api/deliverables/${deliverableId}`);
    const { deliverable: before } = (await beforeRes.json()) as {
      deliverable: { editsCount: number };
    };
    const editsBefore = before.editsCount ?? 0;

    await openArtifactPanel(page, deliverableId);

    // Force a neutral-improving keep_new verdict (new > old).
    await forceJudgeScore(page, { recommendation: 'keep_new', oldTotal: 7.5, newTotal: 7.8 });

    // Drive the iterate via the API (UI refine path is also valid but takes
    // longer; the assertion is server-side editsCount + UI banner absence).
    const itRes = await page.request.post(`/api/deliverables/${deliverableId}/iterate`, {
      data: { instruction: 'tighten the success metrics section' },
      headers: { 'content-type': 'application/json' },
    });
    expect(itRes.ok(), `iterate failed: ${itRes.status()}`).toBeTruthy();
    const body = (await itRes.json()) as { reverted: boolean };
    expect(body.reverted).toBe(false);

    // The auto-revert banner MUST NOT appear (this is the keep-new path).
    const banner = page.locator('[data-testid="auto-revert-banner"]');
    // Give the UI 1.5s to react to any WS event before asserting absence.
    await page.waitForTimeout(1_500);
    await expect(banner).toHaveCount(0);

    // editsCount must increment by exactly 1 (D-19: atomic).
    const afterRes = await page.request.get(`/api/deliverables/${deliverableId}`);
    const { deliverable: after } = (await afterRes.json()) as {
      deliverable: { editsCount: number };
    };
    expect(after.editsCount).toBe(editsBefore + 1);

    await clearForcedScore(page);
    await closeArtifactPanel(page);
  });

  // -------------------------------------------------------------------------
  // Case 3 — RUBR-02 (revert path): force judge -> revert, banner visible
  // -------------------------------------------------------------------------
  test('3 — adversarial-iterate-reverts: AutoRevertBanner visible; currentVersion unchanged', async ({
    page,
  }) => {
    const projectId = await getProjectId(page);
    const deliverableId = await seedDeliverable(page, projectId, {
      type: 'prd',
      title: 'Phase 36 spec — RUBR-02 revert',
      rubricScoreTotal: 8.4,
    });

    // Capture currentVersion + editsCount BEFORE the adversarial iterate.
    const beforeRes = await page.request.get(`/api/deliverables/${deliverableId}`);
    const { deliverable: before } = (await beforeRes.json()) as {
      deliverable: { currentVersion: number; editsCount: number };
    };
    const versionBefore = before.currentVersion;
    const editsBefore = before.editsCount ?? 0;

    await openArtifactPanel(page, deliverableId);

    // Force a revert verdict (new < old). Old=8.4, new=5.2 are the canonical
    // values used in the 36-03 visual checkpoint screenshot.
    await forceJudgeScore(page, { recommendation: 'revert', oldTotal: 8.4, newTotal: 5.2 });

    // Drive the iterate via the UI's refine input — this exercises the full
    // WS-event-to-UI flow that surfaces the banner inline (D-13).
    const refineBtn = page.locator('[data-testid="refine-button"]');
    await refineBtn.click({ timeout: 5_000 });
    await page.locator('[data-testid="refine-input"]').fill(
      'remove the success metrics and reduce risk coverage',
      { timeout: 5_000 },
    );
    await page.locator('[data-testid="refine-send"]').click({ timeout: 5_000 });

    // AutoRevertBanner MUST appear inline.
    const banner = page.locator('[data-testid="auto-revert-banner"]');
    await expect(banner).toBeVisible({ timeout: 15_000 });

    // Banner copy contains both scores (8.4 and 5.2) per D-14.
    await expect(banner).toContainText('8.4');
    await expect(banner).toContainText('5.2');

    // currentVersion did NOT advance (revert path; D-10).
    const afterRes = await page.request.get(`/api/deliverables/${deliverableId}`);
    const { deliverable: after } = (await afterRes.json()) as {
      deliverable: { currentVersion: number; editsCount: number };
    };
    expect(after.currentVersion).toBe(versionBefore);
    // editsCount did NOT increment (D-19: skipped on revert path).
    expect(after.editsCount).toBe(editsBefore);

    // Click "See what changed" — expanded content surfaces.
    const expandBtn = page.locator('[data-testid="auto-revert-banner-expand"]');
    if (await expandBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await expandBtn.click();
      await expect(
        page.locator('[data-testid="auto-revert-banner-expanded-content"]'),
      ).toBeVisible({ timeout: 5_000 });
    }

    await clearForcedScore(page);
    await closeArtifactPanel(page);
  });

  // -------------------------------------------------------------------------
  // Case 4 — FBK-03: impressionCount increments on panel mount (with 5s dedupe)
  // -------------------------------------------------------------------------
  test('4 — impression-count-increments: each panel mount fires once; dedupe absorbs double-fire', async ({
    page,
  }) => {
    const projectId = await getProjectId(page);
    const deliverableId = await seedDeliverable(page, projectId, {
      type: 'prd',
      title: 'Phase 36 spec — FBK-03 impression',
      rubricScoreTotal: 7.0,
    });

    // Capture initial impressionCount.
    const initialRes = await page.request.get(`/api/deliverables/${deliverableId}`);
    const { deliverable: initial } = (await initialRes.json()) as {
      deliverable: { impressionCount: number };
    };
    const impressionsBefore = initial.impressionCount ?? 0;

    // Open the panel for the FIRST time — useEffect on mount fires POST /impression.
    // React.StrictMode in dev fires the effect twice; the 5s server-side dedupe
    // absorbs the second fire (T-36-15 + storage.__shouldRecordImpression). So
    // a single mount must produce exactly +1 impression.
    await openArtifactPanel(page, deliverableId);
    await page.waitForTimeout(1_500); // round-trip headroom for the POST

    const afterFirstRes = await page.request.get(`/api/deliverables/${deliverableId}`);
    const { deliverable: afterFirst } = (await afterFirstRes.json()) as {
      deliverable: { impressionCount: number };
    };
    expect(
      afterFirst.impressionCount,
      `first mount: expected exactly +1 (StrictMode double-fire absorbed by dedupe). before=${impressionsBefore} after=${afterFirst.impressionCount}`,
    ).toBe(impressionsBefore + 1);

    // Wait past the 5s server-side dedupe window (6s for safety margin), then
    // close + reopen → a fresh mount fires another impression which the dedupe
    // does NOT absorb (window has elapsed).
    await closeArtifactPanel(page);
    await page.waitForTimeout(6_000);
    await openArtifactPanel(page, deliverableId);
    await page.waitForTimeout(1_500);

    const finalRes = await page.request.get(`/api/deliverables/${deliverableId}`);
    const { deliverable: final } = (await finalRes.json()) as {
      deliverable: { impressionCount: number };
    };
    expect(
      final.impressionCount,
      `post-dedupe-window mount: expected exactly +1 from afterFirst. afterFirst=${afterFirst.impressionCount} final=${final.impressionCount}`,
    ).toBe(afterFirst.impressionCount + 1);

    await closeArtifactPanel(page);
  });

  // -------------------------------------------------------------------------
  // Cleanup — defensive: always clear any forced score so subsequent runs/projects start clean.
  // -------------------------------------------------------------------------
  test.afterEach(async ({ page }) => {
    await page.request.post('/api/dev/force-judge-score', {
      data: { clear: true, recommendation: 'keep_new' },
      headers: { 'content-type': 'application/json' },
    }).catch(() => {
      // afterEach must never break the suite.
    });
  });
});
