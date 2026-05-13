/**
 * Agent Action Probe — does the chat layer DO things when told to, or just ask?
 *
 * Originally written as a diagnostic on 2026-05-13 after the user reported
 * that "create an agent named X" / "add a task to Y" / "rename the project
 * to Z" were met with clarifying questions instead of action.
 *
 * Phase 36.5 (2026-05-13) closes the gap with a server-side imperative intent
 * parser. This spec is now a real regression gate — Tests 1, 5, 6 use
 * expect() assertions on agent/task/project counts to lock the fix in place.
 * Test 3 stays diagnostic ("plan for X" is intentionally NOT in the imperative
 * grammar; LLM-driven planning still applies — this case verifies the
 * fallback path is unbroken).
 */

import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5001';

async function getProjectState(page: import('@playwright/test').Page, projectId: string) {
  return page.evaluate(async (pid) => {
    const [teams, agents, tasks, project] = await Promise.all([
      fetch(`/api/projects/${pid}/teams`).then((r) => (r.ok ? r.json() : [])),
      fetch(`/api/projects/${pid}/agents`).then((r) => (r.ok ? r.json() : [])),
      fetch(`/api/tasks?projectId=${pid}`).then((r) => (r.ok ? r.json() : [])),
      fetch(`/api/projects/${pid}`).then((r) => (r.ok ? r.json() : null)),
    ]);
    return {
      teamCount: Array.isArray(teams) ? teams.length : 0,
      agentCount: Array.isArray(agents) ? agents.length : 0,
      taskCount: Array.isArray(tasks) ? tasks.length : 0,
      agentNames: Array.isArray(agents) ? agents.map((a: any) => a.name) : [],
      teamNames: Array.isArray(teams) ? teams.map((t: any) => t.name) : [],
      projectName: project?.name ?? '',
    };
  }, projectId);
}

async function sendMessage(page: import('@playwright/test').Page, text: string) {
  const input = page.getByTestId('input-message');
  await input.click();
  await input.fill(text);
  await input.press('Enter');
  // The imperative shortcut path is synchronous (no LLM) — DB write + WS confirm
  // is faster than streaming. Still give 5s for the WS round-trip + confirmation
  // message broadcast.
  await page.waitForTimeout(5000);
}

async function readLastAgentMessage(page: import('@playwright/test').Page): Promise<string> {
  return page.evaluate(() => {
    const bubbles = Array.from(document.querySelectorAll('[data-testid^="message-"]'));
    const lastAgent = bubbles
      .reverse()
      .find((el) => !el.getAttribute('data-testid')?.includes('user'));
    return lastAgent?.textContent?.trim().slice(0, 400) || '';
  });
}

test.describe('Agent Action Probe — chat-to-action chain (Phase 36.5 regression gate)', () => {
  test('imperative chat commands fire actions on turn 1, no LLM dance', async ({ page }) => {
    test.setTimeout(180000);

    // Bypass the WelcomeModal — addInitScript runs before SPA boot.
    // Mirrors the trick from tests/phase-36-screenshot.mjs.
    await page.addInitScript(() => {
      const orig = Storage.prototype.getItem;
      Storage.prototype.getItem = function (key) {
        if (typeof key === 'string' && key.startsWith('hasCompletedOnboarding:')) return 'true';
        return orig.call(this, key);
      };
    });

    // 1) Get to a project (the auth.setup creates one)
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    // Belt-and-suspenders: dismiss any leftover welcome modal
    await page.locator('button[aria-label*="Close" i]').first().click({ timeout: 1500 }).catch(() => {});
    await page.waitForTimeout(500);

    // Get the active project id via API
    const projects = await page.evaluate(async () => {
      const r = await fetch('/api/projects');
      return r.ok ? r.json() : [];
    });
    expect(projects.length).toBeGreaterThan(0);
    const projectId = projects[0].id;

    // Wait for chat input to appear
    await page.getByTestId('input-message').waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(1500);

    const before = await getProjectState(page, projectId);
    console.log('[probe] Initial state:', JSON.stringify(before));

    // ── Test 1: "create an agent named Pixel as Social Media Manager" ───────
    //   Phase 36.5 ASSERTS: imperative shortcut fires on turn 1, agent created.
    console.log('\n[probe] >>> Test 1: "create an agent named Pixel as Social Media Manager"');
    await sendMessage(page, 'create an agent named Pixel as Social Media Manager');
    await page.waitForTimeout(3000);
    const after1 = await getProjectState(page, projectId);
    const reply1 = await readLastAgentMessage(page);
    console.log('[probe] Agent reply (first 400 chars):', reply1);
    console.log('[probe] State after Test 1:', JSON.stringify(after1));

    expect(
      after1.agentCount,
      'create-agent intent should fire on turn 1, but agentCount did not increase',
    ).toBeGreaterThan(before.agentCount);
    expect(
      after1.agentNames,
      'new agent named Pixel should appear in agentNames',
    ).toContain('Pixel');

    // ── Test 2: "yes go ahead, do it" — diagnostic only ─────────────────────
    //   Pre-fix this was needed for the LLM-driven create — now redundant since
    //   Test 1 already created. We log the result but don't assert.
    console.log('\n[probe] >>> Test 2 (diagnostic): "yes, go ahead, do it"');
    await sendMessage(page, 'yes, go ahead, do it');
    await page.waitForTimeout(3000);
    const after2 = await getProjectState(page, projectId);
    const reply2 = await readLastAgentMessage(page);
    console.log('[probe] Agent reply (first 400 chars):', reply2);
    console.log('[probe] State after Test 2:', JSON.stringify(after2));
    console.log(
      '[probe] (diagnostic) additional agents after "yes":',
      after2.agentCount - after1.agentCount,
    );

    // ── Test 3: "plan for shipping the mobile app this quarter" ─────────────
    //   INTENTIONALLY ambiguous. "plan for X" is NOT in the imperative grammar
    //   by design (planning is a multi-step deliberation, not a single-shot
    //   create). This case verifies the FALLBACK path is unbroken — LLM still
    //   runs. We do NOT assert a count change either way.
    console.log('\n[probe] >>> Test 3 (fallback path): "plan for shipping the mobile app this quarter"');
    await sendMessage(page, 'plan for shipping the mobile app this quarter');
    await page.waitForTimeout(4000);
    const after3 = await getProjectState(page, projectId);
    const reply3 = await readLastAgentMessage(page);
    console.log('[probe] Agent reply (first 400 chars):', reply3);
    console.log('[probe] State after Test 3:', JSON.stringify(after3));
    console.log(
      '[probe] (diagnostic) "plan for X" task delta:',
      after3.taskCount - after2.taskCount,
      '(no assertion — LLM-driven fallback path)',
    );

    // ── Test 5: "add a task to update the landing page" ─────────────────────
    //   Phase 36.5 ASSERTS: create-task intent fires on turn 1, task created.
    const before5 = after3;
    console.log('\n[probe] >>> Test 5: "add a task to update the landing page"');
    await sendMessage(page, 'add a task to update the landing page');
    await page.waitForTimeout(3000);
    const after5 = await getProjectState(page, projectId);
    const reply5 = await readLastAgentMessage(page);
    console.log('[probe] Agent reply (first 400 chars):', reply5);
    console.log('[probe] State after Test 5:', JSON.stringify(after5));

    expect(
      after5.taskCount,
      'create-task intent should fire on turn 1, but taskCount did not increase',
    ).toBeGreaterThan(before5.taskCount);

    // ── Test 6: "rename the project to Falcon Probe <timestamp>" ────────────
    //   Phase 36.5 ASSERTS: rename-project intent updates project name on turn 1.
    //   Use a unique target name so the test is resilient to state pollution
    //   when the dev server persists MemStorage across test runs in a session.
    const renameTarget = `Falcon Probe ${Date.now()}`;
    const before6 = after5;
    console.log(`\n[probe] >>> Test 6: "rename the project to ${renameTarget}"`);
    await sendMessage(page, `rename the project to ${renameTarget}`);
    await page.waitForTimeout(3000);
    const after6 = await getProjectState(page, projectId);
    const reply6 = await readLastAgentMessage(page);
    console.log('[probe] Agent reply (first 400 chars):', reply6);
    console.log('[probe] State after Test 6:', JSON.stringify(after6));

    expect(
      after6.projectName,
      `rename-project intent should update projects.name to "${renameTarget}" on turn 1`,
    ).toBe(renameTarget);
    expect(
      after6.projectName,
      'rename-project must not leave projectName unchanged from before6',
    ).not.toBe(before6.projectName);

    // ── Final summary log ───────────────────────────────────────────────────
    console.log('\n[probe] ═══════════════════ SUMMARY ═══════════════════');
    console.log(`[probe] Test 1 (create-agent):     agents ${before.agentCount} → ${after1.agentCount}`);
    console.log(`[probe] Test 2 (yes diagnostic):   agents ${after1.agentCount} → ${after2.agentCount}`);
    console.log(`[probe] Test 3 (plan for X):       tasks ${after2.taskCount} → ${after3.taskCount} (LLM fallback)`);
    console.log(`[probe] Test 5 (create-task):      tasks ${before5.taskCount} → ${after5.taskCount}`);
    console.log(`[probe] Test 6 (rename-project):   name "${before6.projectName}" → "${after6.projectName}"`);
    console.log('[probe] ════════════════════════════════════════════════');
  });
});
