import { test, expect, type Page } from '@playwright/test';
import { ensureAppLoaded } from './helpers';

/**
 * Goal-Driven Autonomous User E2E Test
 *
 * Simulates a real user session end-to-end:
 *   "Create a project, build an AI team, have a productive conversation
 *    that generates tasks and a deliverable, then verify everything persists."
 *
 * This is ONE long test with chained steps. If any step fails, the test
 * stops — pinpointing exactly where a real user would get stuck.
 *
 * Auth: pre-configured via session.json (Dev Tester user).
 * App must be running at http://localhost:5001.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PROJECT_NAME = `GoalRunner Test ${Date.now()}`;
const AI_TIMEOUT = 45_000; // generous timeout for LLM responses
const NAV_TIMEOUT = 10_000;
const UI_TIMEOUT = 5_000;

function chatInput(page: Page) {
  return page.locator('[data-testid="input-message"]');
}

function sendButton(page: Page) {
  return page.locator('button[aria-label="Send message"]');
}

function messageLog(page: Page) {
  return page.locator('[role="log"][aria-label="Chat messages"]');
}

/** Send a message via the chat input and press Enter. */
async function sendMessage(page: Page, text: string) {
  const input = chatInput(page);
  await input.fill(text);
  await input.press('Enter');
}

/** Count agent message bubbles currently visible in the log. */
async function countAgentMessages(page: Page): Promise<number> {
  // Agent messages are rendered to the left; they lack the user-side styling.
  // The safest selector: any message container that is NOT from the user.
  // MessageBubble renders agent messages without justify-end.
  const agentBubbles = messageLog(page).locator('div.flex:not(.justify-end) >> .prose, div.flex:not(.justify-end) >> .markdown-body');
  return agentBubbles.count().catch(() => 0);
}

/** Wait for a NEW agent message to appear (count goes up from `prevCount`). */
async function waitForNewAgentMessage(page: Page, prevCount: number, timeout = AI_TIMEOUT) {
  await expect(async () => {
    const current = await countAgentMessages(page);
    expect(current).toBeGreaterThan(prevCount);
  }).toPass({ timeout });
}

// ---------------------------------------------------------------------------
// The Journey
// ---------------------------------------------------------------------------

test.describe('Goal Runner: Full User Journey', () => {
  // Collect console errors throughout the entire journey
  const consoleErrors: string[] = [];

  test('complete user journey — create project, converse, verify persistence', async ({ page }) => {
    test.setTimeout(180000); // 3 min — full journey with multiple AI calls
    // Track console errors across the entire test
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore benign noise
        if (
          text.includes('favicon') ||
          text.includes('ResizeObserver') ||
          text.includes('net::ERR') ||
          text.includes('404 (Not Found)') ||
          text.includes('[vite]')
        ) return;
        consoleErrors.push(text);
      }
    });

    // -----------------------------------------------------------------------
    // Step 1: Land on app — verify authenticated dashboard loads
    // -----------------------------------------------------------------------
    await test.step('Step 1: Verify authenticated dashboard loads', async () => {
      await page.goto('/', { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });

      // The app should NOT redirect to /login — we should see the dashboard
      await expect(page).not.toHaveURL(/\/login/, { timeout: UI_TIMEOUT });

      // Left sidebar should be visible (desktop) — "Projects" heading
      const projectsHeading = page.locator('h2', { hasText: 'Projects' });
      await expect(projectsHeading).toBeVisible({ timeout: UI_TIMEOUT });
    });

    // -----------------------------------------------------------------------
    // Step 2: Create new project "GoalRunner Test"
    // -----------------------------------------------------------------------
    await test.step('Step 2: Create new project via sidebar', async () => {
      // Click "+ New" button in the left sidebar
      const newButton = page.locator('button', { hasText: '+ New' });
      await expect(newButton).toBeVisible({ timeout: UI_TIMEOUT });
      await newButton.click();

      // QuickStartModal should appear — "How do you want to start?"
      const quickStartModal = page.locator('[role="dialog"]', { hasText: 'How do you want to start?' });
      await expect(quickStartModal).toBeVisible({ timeout: UI_TIMEOUT });

      // Choose "Start with an idea"
      const ideaButton = quickStartModal.locator('button', { hasText: 'Start with an idea' });
      await ideaButton.click();

      // ProjectNameModal should appear — "Name Your Project"
      const nameModal = page.locator('[role="dialog"]', { hasText: 'Name Your Project' });
      await expect(nameModal).toBeVisible({ timeout: UI_TIMEOUT });

      // Fill in the project name
      const nameInput = nameModal.locator('input[type="text"]');
      await nameInput.fill(PROJECT_NAME);

      // Click "Create Project"
      const createButton = nameModal.locator('button[type="submit"]', { hasText: 'Create Project' });
      await expect(createButton).toBeEnabled();
      await createButton.click();

      // Wait for modal to close and project to appear in sidebar
      await expect(nameModal).not.toBeVisible({ timeout: NAV_TIMEOUT });

      // Project name should appear in the sidebar tree
      const projectInSidebar = page.locator('span', { hasText: PROJECT_NAME }).first();
      await expect(projectInSidebar).toBeVisible({ timeout: NAV_TIMEOUT });
    });

    // -----------------------------------------------------------------------
    // Step 3: Verify initial state — Maya welcome, chat input ready
    // -----------------------------------------------------------------------
    await test.step('Step 3: Verify initial project state', async () => {
      // Chat input should be ready
      const input = chatInput(page);
      await expect(input).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(input).toBeEnabled();

      // Wait for Maya's welcome message to appear in the chat
      // Maya's welcome typically shows up as the first agent message
      const welcomeMessage = messageLog(page).locator('text=/[Hh]ey|[Ww]elcome|[Hh]ello|[Ii]dea|Maya/').first();
      await expect(welcomeMessage).toBeVisible({ timeout: NAV_TIMEOUT });

      // Right sidebar should be accessible — check for the tab bar
      const activityTab = page.locator('[data-testid="sidebar-tab-activity"]');
      // On desktop it should be visible; on narrow viewports it may be in a drawer
      // Just check it exists in DOM
      await expect(activityTab).toBeAttached({ timeout: UI_TIMEOUT });
    });

    // -----------------------------------------------------------------------
    // Step 4: First conversation — ask about building a task management app
    // -----------------------------------------------------------------------
    let agentCountBeforeFirst: number;
    await test.step('Step 4: Send first message and receive AI response', async () => {
      agentCountBeforeFirst = await countAgentMessages(page);

      await sendMessage(
        page,
        "I'm building a task management app for remote teams. What should we focus on first?"
      );

      // The user message should appear in the chat
      const userMsg = messageLog(page).locator('text=/task management app/').first();
      await expect(userMsg).toBeVisible({ timeout: UI_TIMEOUT });

      // Wait for the AI to respond — a new agent message should appear
      // We use a generous timeout since LLM calls can take a while
      await waitForNewAgentMessage(page, agentCountBeforeFirst);

      // The streaming should complete — no "Thinking..." indicator should remain
      // after the response finishes
      await expect(page.locator('text=/Thinking|Reviewing context|Forming a response/')).not.toBeVisible({
        timeout: AI_TIMEOUT,
      });
    });

    // -----------------------------------------------------------------------
    // Step 5: Follow-up — ask for task breakdown
    // -----------------------------------------------------------------------
    await test.step('Step 5: Follow-up conversation asking for tasks', async () => {
      const agentCountBefore = await countAgentMessages(page);

      await sendMessage(
        page,
        'Can you break that down into specific tasks we should tackle this week?'
      );

      // User message visible
      const followUpMsg = messageLog(page).locator('text=/specific tasks/').first();
      await expect(followUpMsg).toBeVisible({ timeout: UI_TIMEOUT });

      // Wait for agent response
      await waitForNewAgentMessage(page, agentCountBefore);

      // Give a moment for any task_suggestions WS events to fire
      await page.waitForTimeout(2000);
    });

    // -----------------------------------------------------------------------
    // Step 6: Check right sidebar tabs
    // -----------------------------------------------------------------------
    await test.step('Step 6: Explore right sidebar tabs', async () => {
      // Click Activity tab
      const activityTab = page.locator('[data-testid="sidebar-tab-activity"]');
      if (await activityTab.isVisible()) {
        await activityTab.click();
        // Activity tab content should be displayed (not aria-hidden)
        await page.waitForTimeout(500);
      }

      // Click Tasks tab
      const tasksTab = page.locator('[data-testid="sidebar-tab-tasks"]');
      if (await tasksTab.isVisible()) {
        await tasksTab.click();
        await page.waitForTimeout(500);
        // Tasks panel should be visible — it might show tasks or an empty state
        // Either is fine at this point; we just confirm the tab is interactive
      }

      // Click Brain tab
      const brainTab = page.locator('[data-testid="sidebar-tab-brain"]');
      if (await brainTab.isVisible()) {
        await brainTab.click();
        await page.waitForTimeout(500);
      }
    });

    // -----------------------------------------------------------------------
    // Step 7: Try team-level interaction (if teams exist)
    // -----------------------------------------------------------------------
    await test.step('Step 7: Attempt team-level interaction', async () => {
      // Look for expandable team entries in the sidebar.
      // Teams are rendered inside the ProjectTree under the active project.
      // They show as items with a Users icon or a team name.
      const teamItems = page.locator('aside').first().locator('svg.lucide-users').locator('..');
      const teamCount = await teamItems.count();

      if (teamCount > 0) {
        // Click the first team
        await teamItems.first().click();
        await page.waitForTimeout(1000);

        // If the chat context changed, the input should still be visible
        const input = chatInput(page);
        if (await input.isVisible()) {
          const agentCountBefore = await countAgentMessages(page);
          await sendMessage(page, 'What is the team working on right now?');

          // Wait for a response (may be a different agent than Maya)
          await waitForNewAgentMessage(page, agentCountBefore);
        }
      }
      // If no teams exist, this step is a no-op — that is acceptable for an idea project
    });

    // -----------------------------------------------------------------------
    // Step 8: Try agent 1-on-1 (if available)
    // -----------------------------------------------------------------------
    await test.step('Step 8: Attempt agent 1-on-1 conversation', async () => {
      // Individual agents appear in the sidebar tree under teams.
      // They are rendered with AgentAvatar or a colored circle + name.
      // Look for clickable agent items by finding role-labeled items.
      const agentItems = page.locator('aside').first().locator('[class*="UserCircle"], [class*="agent-avatar"]');
      const agentCount = await agentItems.count();

      if (agentCount > 0) {
        // Click the first individual agent
        await agentItems.first().click();
        await page.waitForTimeout(1000);

        const input = chatInput(page);
        if (await input.isVisible()) {
          const agentCountBefore = await countAgentMessages(page);
          await sendMessage(page, 'Hey, what do you think about our approach so far?');

          await waitForNewAgentMessage(page, agentCountBefore);
        }
      }
      // If no agents are exposed in sidebar, this is acceptable
    });

    // -----------------------------------------------------------------------
    // Step 9: Persistence check — navigate away and back
    // -----------------------------------------------------------------------
    await test.step('Step 9: Verify persistence after navigation', async () => {
      // Navigate to /account
      await page.goto('/account', { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
      await expect(page).toHaveURL(/\/account/);

      // Navigate back to home
      await page.goto('/', { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });

      // Project should still be in the sidebar
      const projectInSidebar = page.locator('span', { hasText: PROJECT_NAME }).first();
      await expect(projectInSidebar).toBeVisible({ timeout: NAV_TIMEOUT });

      // Click the project to re-select it
      await projectInSidebar.click();
      await page.waitForTimeout(1000);

      // Messages should still be in the chat (our first message about "task management")
      const persistedMsg = messageLog(page).locator('text=/task management app/').first();
      await expect(persistedMsg).toBeVisible({ timeout: NAV_TIMEOUT });
    });

    // -----------------------------------------------------------------------
    // Step 10: Final state verification
    // -----------------------------------------------------------------------
    await test.step('Step 10: Final state verification', async () => {
      // 1. Project visible in sidebar
      const projectInSidebar = page.locator('span', { hasText: PROJECT_NAME }).first();
      await expect(projectInSidebar).toBeVisible();

      // 2. Chat messages persist — at least one agent message exists
      const finalAgentCount = await countAgentMessages(page);
      expect(finalAgentCount).toBeGreaterThan(0);

      // 3. Chat input still functional
      const input = chatInput(page);
      await expect(input).toBeVisible();
      await expect(input).toBeEnabled();

      // 4. Right sidebar tabs are still accessible
      const activityTab = page.locator('[data-testid="sidebar-tab-activity"]');
      await expect(activityTab).toBeAttached();

      // 5. No accumulated console errors
      if (consoleErrors.length > 0) {
        console.log('Console errors collected during journey:');
        consoleErrors.forEach((err, i) => console.log(`  [${i + 1}] ${err}`));
      }
      expect(
        consoleErrors,
        `Expected zero console errors but found ${consoleErrors.length}:\n${consoleErrors.join('\n')}`
      ).toHaveLength(0);
    });
  });
});
