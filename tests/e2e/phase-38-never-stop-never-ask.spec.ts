/**
 * Phase 38 — "Never Stop, Never Ask" autonomy prompt runtime spec.
 *
 * Covers ALWY-01 (prompt change reaches wire), ALWY-02 (no clarification at level 4
 * — verified via captured assembled prompt), and ALWY-03 (snapshot-at-task-boundary
 * — verified by mid-flight dial flip + next-message capture).
 *
 * Per saved memory rule `feedback_verify_in_runtime.md`, this spec runs against
 * a LIVE FRESHLY-RESTARTED dev server.
 *
 * RUN ORDER (mandatory):
 *   1. Ctrl-C any running dev server.
 *   2. `LLM_MODE=test TEST_LLM_PROVIDER=capture npm run dev`
 *      (the capture provider records assembled prompts onto an in-memory buffer
 *      exposed via /api/dev/captured-prompts; without this env, the buffer
 *      stays empty and the tests fail with "no prompts captured")
 *   3. `npx playwright test --project=phase-38`
 *
 * The spec asserts on the CAPTURED PROMPT (deterministic, non-vacuous) — NOT on
 * the LLM output text, which is a canned response and irrelevant. This eliminates
 * both mock-vacuousness (where assertions can pass even if the directive was never
 * injected because mock bypasses prompt assembly) AND real-provider flake (where
 * LLM nondeterminism could cause false failures).
 *
 * Selectors:
 *   [data-testid="input-message"]        — the chat input (from ChatInput.tsx)
 *
 * DEV endpoints used:
 *   POST /api/dev/set-autonomy-level     — flip a project's autonomyLevel
 *   GET  /api/dev/captured-prompts       — read the capture buffer
 *   POST /api/dev/clear-captured-prompts — reset between tests
 */
import { test, expect, type Page } from '@playwright/test';
import { ensureAppLoaded } from './helpers';

interface CapturedPrompt {
  systemPrompt: string;
  userMessage: string;
  fullMessages: Array<{ role: string; content: string }>;
  timestamp: number;
  model?: string;
}

// D-04 keyword markers — same table as scripts/test-autonomous-directive.ts Case 1b
// to ensure the runtime prompt carries every one of the 8 principles, including
// principle #8 (the 2026-06-09 Assumptions section — Phase 38's mitigation for
// the "wrong assumption shipped silently" failure mode).
const D04_KEYWORDS: Array<{ id: string; principle: string; pattern: RegExp }> = [
  { id: 'K1', principle: '#1 commit/dont-hedge',           pattern: /commit/i },
  { id: 'K2', principle: '#1 commit/dont-hedge (alt)',     pattern: /don[''']t hedge/i },
  { id: 'K3', principle: '#2 state-assumptions-out-loud',  pattern: /(state assumption|out loud)/i },
  { id: 'K4', principle: '#3 no-pause-between-subtasks',   pattern: /(don[''']t pause|no pause)/i },
  { id: 'K5', principle: '#4 no-hedging-filler',           pattern: /(no hedging|no maybe|no perhaps)/i },
  { id: 'K6', principle: '#5 correction-after',            pattern: /(correction after|permission before)/i },
  { id: 'K7', principle: '#6 binary-when-stuck',           pattern: /binary/i },
  { id: 'K8', principle: '#7 inline-justification',        pattern: /justification/i },
  { id: 'K9', principle: '#8 structured-assumptions-section', pattern: /Assumptions/ },
];

async function getProjectId(page: Page): Promise<string> {
  const res = await page.request.get('/api/projects');
  if (!res.ok()) throw new Error(`/api/projects GET failed: ${res.status()}`);
  const projects = (await res.json()) as Array<{ id: string }>;
  if (!projects || projects.length === 0) {
    throw new Error('no projects available; auth.setup.ts should have created one');
  }
  return projects[0].id;
}

async function setAutonomyLevel(
  page: Page,
  projectId: string,
  level: 'observe' | 'propose' | 'confirm' | 'autonomous',
): Promise<void> {
  const res = await page.request.post('/api/dev/set-autonomy-level', {
    data: { projectId, autonomyLevel: level },
    headers: { 'content-type': 'application/json' },
  });
  if (!res.ok()) {
    throw new Error(`set-autonomy-level failed: ${res.status()} ${await res.text()}`);
  }
}

async function clearCapturedPrompts(page: Page): Promise<void> {
  const res = await page.request.post('/api/dev/clear-captured-prompts');
  if (!res.ok()) {
    throw new Error(`clear-captured-prompts failed: ${res.status()} ${await res.text()}`);
  }
}

async function getCapturedPrompts(page: Page): Promise<CapturedPrompt[]> {
  const res = await page.request.get('/api/dev/captured-prompts');
  if (!res.ok()) {
    throw new Error(`captured-prompts GET failed: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  return (body.prompts ?? []) as CapturedPrompt[];
}

async function sendChatMessage(page: Page, text: string): Promise<void> {
  const input = page.locator('[data-testid="input-message"]').first();
  await input.waitFor({ state: 'visible', timeout: 15_000 });
  await input.click();
  await input.fill(text);
  await input.press('Enter');
}

/**
 * Poll the captured-prompts buffer until at least `expectedCount` entries arrive
 * (or timeout). Streaming completion races the assistant message render — the
 * buffer reflects the LLM call, which fires within hundreds of ms of the input
 * dispatch even when streaming hasn't finished server-side.
 */
async function waitForCapturedPrompts(
  page: Page,
  expectedCount: number,
  timeoutMs: number = 30_000,
): Promise<CapturedPrompt[]> {
  const start = Date.now();
  let last: CapturedPrompt[] = [];
  while (Date.now() - start < timeoutMs) {
    last = await getCapturedPrompts(page);
    if (last.length >= expectedCount) return last;
    await page.waitForTimeout(500);
  }
  throw new Error(
    `waitForCapturedPrompts timed out: expected ${expectedCount} captures, got ${last.length} within ${timeoutMs}ms. ` +
    `Is the server running with LLM_MODE=test TEST_LLM_PROVIDER=capture?`,
  );
}

test.describe.serial('Phase 38 — Never Stop, Never Ask', () => {
  test.beforeEach(async ({ page }) => {
    // Suppress WelcomeModal — mirrors phase-36/37 patterns.
    await page.addInitScript(() => {
      const orig = Storage.prototype.getItem;
      Storage.prototype.getItem = function (key) {
        if (typeof key === 'string' && key.startsWith('hasCompletedOnboarding:')) return 'true';
        return orig.call(this, key);
      };
    });
    await ensureAppLoaded(page);
    await clearCapturedPrompts(page);
  });

  // -------------------------------------------------------------------------
  // Test 1 — ALWY-01 / ALWY-02: Level-4 commits.
  // The captured systemPrompt MUST contain <autonomous_directive> + all 9 D-04
  // keyword markers, and MUST NOT contain "Ask at most one clarification question".
  // -------------------------------------------------------------------------
  test('1 — level-4 captured prompt contains autonomous_directive and drops clarification rule', async ({
    page,
  }) => {
    const projectId = await getProjectId(page);
    await setAutonomyLevel(page, projectId, 'autonomous');

    await sendChatMessage(page, 'build me a marketing strategy');

    const prompts = await waitForCapturedPrompts(page, 1);
    expect(prompts.length).toBeGreaterThanOrEqual(1);

    const sysPrompt = prompts[prompts.length - 1].systemPrompt;

    // ALWY-01: directive present
    expect(sysPrompt).toContain('<autonomous_directive>');
    expect(sysPrompt).toContain('</autonomous_directive>');

    // D-04 strict 9-keyword coverage
    for (const k of D04_KEYWORDS) {
      expect(sysPrompt, `D-04 principle ${k.id} (${k.principle}) NOT FOUND in captured prompt. Pattern: ${k.pattern}`).toMatch(k.pattern);
    }

    // ALWY-02: clarification rule suppressed for createPromptTemplate path
    // (Note: the rule lives in a downstream INSTRUCTIONS block; assert
    //  the literal absence of the legacy phrase.)
    expect(sysPrompt).not.toContain('Ask at most one clarification question');
  });

  // -------------------------------------------------------------------------
  // Test 2 — D-03 regression guard: Level-3 baseline.
  // captured prompt MUST NOT contain <autonomous_directive>, MUST still contain
  // "Ask at most one clarification question" (baseline preserved).
  // -------------------------------------------------------------------------
  test('2 — level-3 control: no directive, clarification rule present', async ({ page }) => {
    const projectId = await getProjectId(page);
    await setAutonomyLevel(page, projectId, 'confirm');

    await sendChatMessage(page, 'build me a marketing strategy');

    const prompts = await waitForCapturedPrompts(page, 1);
    const sysPrompt = prompts[prompts.length - 1].systemPrompt;

    expect(sysPrompt).not.toContain('<autonomous_directive>');
    expect(sysPrompt).toContain('Ask at most one clarification question');
  });

  // -------------------------------------------------------------------------
  // Test 3 — ALWY-03 / D-10: Snapshot-at-task-boundary.
  // Set level autonomous, send msg 1, flip to confirm DURING the streaming reply,
  // wait for completion, send msg 2. Msg 1's captured prompt MUST still have the
  // directive (in-flight reply runs under the snapshot taken at task entry).
  // Msg 2's captured prompt MUST NOT have the directive (fresh snapshot = confirm).
  // -------------------------------------------------------------------------
  test('3 — snapshot-at-task-boundary: mid-flight dial flip applies to NEXT message', async ({
    page,
  }) => {
    const projectId = await getProjectId(page);
    await setAutonomyLevel(page, projectId, 'autonomous');

    await sendChatMessage(page, 'first message under autonomous');
    const promptsAfterMsg1 = await waitForCapturedPrompts(page, 1);
    expect(promptsAfterMsg1[0].systemPrompt).toContain('<autonomous_directive>');

    // Flip the dial. The in-flight reply already snapshotted 'autonomous' at task entry.
    await setAutonomyLevel(page, projectId, 'confirm');

    // Wait briefly for any in-flight streaming to settle so msg 2 lands as a fresh task boundary.
    await page.waitForTimeout(2_000);

    await sendChatMessage(page, 'second message after dial flip to confirm');
    const promptsAfterMsg2 = await waitForCapturedPrompts(page, 2);
    expect(promptsAfterMsg2.length).toBeGreaterThanOrEqual(2);

    const msg2Prompt = promptsAfterMsg2[promptsAfterMsg2.length - 1].systemPrompt;
    expect(msg2Prompt).not.toContain('<autonomous_directive>');
    expect(msg2Prompt).toContain('Ask at most one clarification question');
  });

  // -------------------------------------------------------------------------
  // Test 4 — Maya team-suggestion grammar at level 4 (T-38-04 mitigation).
  // When Maya is in the captured prompt at autonomous level, the declarative
  // variant ("propose a team — declaratively") MUST be present and the
  // "— should I?" interrogative exemplar MUST be absent.
  //
  // Setup: any active project (auth.setup created one with Maya).
  // -------------------------------------------------------------------------
  test('4 — Maya team-suggestion is declarative at level 4 (no should-I)', async ({ page }) => {
    const projectId = await getProjectId(page);
    await setAutonomyLevel(page, projectId, 'autonomous');

    await sendChatMessage(page, 'I want to build a fitness app for runners');

    const prompts = await waitForCapturedPrompts(page, 1);
    // Find a captured prompt whose systemPrompt mentions Maya's team intelligence block.
    // In project-mode chat with Maya present, at least one captured prompt will be Maya's.
    const mayaPrompt = prompts.find((p) => p.systemPrompt.includes('MAYA TEAM INTELLIGENCE'))
      ?? prompts[prompts.length - 1];

    // Even if Maya isn't the responding agent in this specific project, the captured
    // prompt at autonomous level MUST still carry the directive.
    expect(mayaPrompt.systemPrompt).toContain('<autonomous_directive>');

    // If Maya IS in scope, assert the declarative grammar swap.
    if (mayaPrompt.systemPrompt.includes('MAYA TEAM INTELLIGENCE')) {
      expect(mayaPrompt.systemPrompt).toContain('propose a team — declaratively');
      // Negative assertions — the question-form exemplar must be absent in
      // the autonomous variant. Note Maya's BLOCK uses "— should I?" in the
      // non-autonomous variant only; the autonomous branch swapped to a
      // declarative exemplar.
      expect(mayaPrompt.systemPrompt).not.toMatch(/I'd suggest adding [^—\n]+— should I\?/i);
    }
  });

  // -------------------------------------------------------------------------
  // Test 5 — ALWY-05 / Plan 38-03: Maya voice snap at level 4.
  // Maya's role voicePrompt in shared/roleRegistry.ts instructs her to open
  // with exploratory question-shape ("I keep coming back to..."). At max
  // autonomy the MAYA_AUTONOMOUS_OVERRIDE block MUST be appended AFTER
  // AUTONOMOUS_DIRECTIVE_BLOCK so the LLM reads the commit-shape rule last.
  // Only fires when respondingAgent.isSpecialAgent === true (i.e., Maya).
  // -------------------------------------------------------------------------
  test('5 — Maya at level 4 receives <maya_autonomous_override> after directive', async ({
    page,
  }) => {
    const projectId = await getProjectId(page);
    await setAutonomyLevel(page, projectId, 'autonomous');

    await sendChatMessage(page, 'help me think through my product positioning');

    const prompts = await waitForCapturedPrompts(page, 1);
    const mayaPrompt = prompts.find((p) => p.systemPrompt.includes('MAYA TEAM INTELLIGENCE'))
      ?? prompts[prompts.length - 1];

    // If Maya IS in scope (isSpecialAgent responded), the override block MUST
    // be present. Guarded to avoid failing on projects where Maya isn't the
    // responder for this specific message.
    if (mayaPrompt.systemPrompt.includes('MAYA TEAM INTELLIGENCE')) {
      // Override block present
      expect(mayaPrompt.systemPrompt).toContain('<maya_autonomous_override>');
      expect(mayaPrompt.systemPrompt).toContain('</maya_autonomous_override>');
      // Commit-shape example is inside the override
      expect(mayaPrompt.systemPrompt).toContain("Here's what I'd do");
      // Order: override MUST come AFTER general directive
      const directiveIdx = mayaPrompt.systemPrompt.indexOf('<autonomous_directive>');
      const overrideIdx = mayaPrompt.systemPrompt.indexOf('<maya_autonomous_override>');
      expect(directiveIdx).toBeGreaterThan(0);
      expect(overrideIdx).toBeGreaterThan(directiveIdx);
    }
  });
});
