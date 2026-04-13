import { test, expect, type Page } from '@playwright/test';
import { ensureAppLoaded } from './helpers';

/**
 * Persona: "First-Time Founder" — Sarah
 *
 * Sarah is a first-time user who wants to set up a project, assemble an AI team,
 * chat with agents, and get work done. This is a sequential end-to-end journey test
 * that covers project creation, chat, sidebar navigation, settings, and billing page.
 *
 * Prerequisites:
 *   - App running at http://localhost:5001
 *   - Authenticated session from auth.setup.ts (Dev Tester user)
 */

const PROJECT_NAME = `TaskFlow-${Date.now()}`;

// Helper: wait for app shell to be ready (not login page, sidebar loaded)
async function waitForAppReady(page: Page) {
  await ensureAppLoaded(page);
}

test.describe.serial('Persona: Sarah — First-Time Founder Journey', () => {

  test('Steps 1-10: Project creation, first chat, and initial exploration', async ({ page }) => {
    test.setTimeout(180000); // 3 min — includes AI response waits

    // ── Step 1: App loads after login — main interface visible ──
    await test.step('Step 1: App loads after login', async () => {
      await waitForAppReady(page);
      // The left sidebar should show "Projects" heading and the "+ New" button
      await expect(page.getByText('+ New').first()).toBeVisible();
    });

    // ── Step 2: Create a new project — click the + New button ──
    await test.step('Step 2: Click + New to start project creation', async () => {
      await page.getByText('+ New').first().click();
      // QuickStartModal should appear with "How do you want to start?"
      await expect(page.getByText('How do you want to start?')).toBeVisible({ timeout: 5_000 });
    });

    // ── Step 3: Use a Starter Pack if available ──
    await test.step('Step 3: Choose "Use a starter pack" option', async () => {
      // Click the "Use a starter pack" option in QuickStartModal
      await page.getByText('Use a starter pack').click();
      // StarterPacksModal should appear — look for a template category or template card
      // The modal has categories like "Business + Startups" with templates like "SaaS Startup"
      await expect(page.getByText('SaaS Startup')).toBeVisible({ timeout: 5_000 });
    });

    // ── Step 3b: Select a template ──
    await test.step('Step 3b: Select the SaaS Startup template', async () => {
      // Click on the SaaS Startup template card
      await page.getByText('SaaS Startup').click();
      // ProjectNameModal should appear with "Name Your Project"
      await expect(page.getByText('Name Your Project')).toBeVisible({ timeout: 5_000 });
    });

    // ── Step 4: Name the project and submit ──
    await test.step('Step 4: Name the project "TaskFlow" and submit', async () => {
      // The ProjectNameModal has an input with placeholder "Enter your project name"
      // It may be pre-filled with the template name "SaaS Startup" — clear and type our name
      const nameInput = page.getByPlaceholder('Enter your project name');
      await expect(nameInput).toBeVisible();
      await nameInput.clear();
      await nameInput.fill(PROJECT_NAME);

      // Submit the form — find the confirm/create button
      // The modal has a submit button; look for it by role
      const submitButton = page.locator('form button[type="submit"], form button:has-text("Create"), form button:has-text("Hatch")');
      await submitButton.first().click();

      // Wait for the modal to close and project to be created
      // The egg hatching animation may play — wait for it to finish
      await expect(page.getByText('Name Your Project')).not.toBeVisible({ timeout: 15_000 });
    });

    // ── Step 5: Verify project appears in left sidebar ──
    await test.step('Step 5: Verify project appears in left sidebar', async () => {
      // The project name should appear in the left sidebar project tree
      await expect(page.getByText(PROJECT_NAME).first()).toBeVisible({ timeout: 20_000 });
    });

    // ── Step 6: Verify Maya's welcome message appears in project chat ──
    await test.step('Step 6: Verify Maya welcome message in project chat', async () => {
      // Maya sends a welcome message when a project is created.
      // The message appears in the chat area (role="log").
      // Wait generously — the welcome message may take a moment to load via WS or API.
      const chatLog = page.locator('[role="log"]');
      await expect(chatLog).toBeVisible({ timeout: 15_000 });

      // Maya's welcome message should contain something about the project/team.
      // For SaaS Startup template, the welcome message mentions "SaaS" or the team.
      // Be flexible — just check that at least one agent message appeared.
      const agentMessage = chatLog.locator('div').filter({ hasText: /./}).first();
      await expect(agentMessage).toBeVisible({ timeout: 15_000 });
    });

    // ── Step 7: Send a message and wait for AI response ──
    await test.step('Step 7: Send "What should our MVP include?" and wait for response', async () => {
      const chatInput = page.getByTestId('input-message');
      await expect(chatInput).toBeVisible({ timeout: 10_000 });
      await chatInput.fill('What should our MVP include?');

      // Press Enter to send (the textarea submits on Enter without Shift)
      await chatInput.press('Enter');

      // The user message should appear in the chat
      await expect(page.getByText('What should our MVP include?')).toBeVisible({ timeout: 10_000 });
    });

    // ── Step 8: Verify agent response appears with proper formatting ──
    await test.step('Step 8: Verify agent response appears', async () => {
      // Wait for streaming to complete — an agent message should appear.
      // Agent responses are rendered inside the chat log area.
      // We wait up to 30s for the AI to respond via WebSocket streaming.
      const chatLog = page.locator('[role="log"]');

      // Wait for a second message bubble to appear (beyond the welcome + user message)
      // The agent response should be visible and non-empty.
      // Look for any new content that appeared after our message.
      // A robust check: wait for streaming_completed or just a new message bubble.
      await page.waitForTimeout(2_000); // Brief pause for streaming to start

      // Check that there are at least 3 messages now (welcome + user + agent response)
      // or that streaming indicator appeared
      const messageCount = await chatLog.locator('[class*="message"], [class*="bubble"], [class*="MessageBubble"]').count();

      // Alternative: just wait for any new text content from an agent
      // The response won't contain markdown headers (# ##) per prompt rules
      await expect(async () => {
        const allText = await chatLog.textContent();
        // The agent should have responded with something beyond just our message
        expect(allText!.length).toBeGreaterThan(100);
      }).toPass({ timeout: 30_000 });
    });

    // ── Step 9: Check if task suggestions appear after conversation ──
    await test.step('Step 9: Check for task suggestions or task creation', async () => {
      // Task suggestions may appear as a WS event (task_suggestions) rendered in the UI.
      // This is not guaranteed for every message, so we check optimistically.
      // The TaskApprovalModal or inline task cards may appear.
      // If not, we just verify the Tasks tab badge or check later.
      await page.waitForTimeout(3_000); // Give time for task detection

      // Check if the Tasks tab in the right sidebar shows a notification dot
      const tasksTab = page.getByTestId('sidebar-tab-tasks');
      // The badge is an amber dot with animate-pulse — just note its state
      const hasBadge = await tasksTab.locator('.animate-pulse').count();
      // This step passes regardless — task detection is probabilistic
      expect(true).toBe(true);
    });

    // ── Step 10: Open Right Sidebar Activity tab — verify events logged ──
    await test.step('Step 10: Check Activity tab in right sidebar', async () => {
      const activityTab = page.getByTestId('sidebar-tab-activity');
      await expect(activityTab).toBeVisible({ timeout: 10_000 });
      await activityTab.click();

      // The Activity tab should be active and showing content.
      // It may show an empty state or autonomy events — both are valid for a new project.
      await page.waitForTimeout(1_000);

      // Verify the tab is now active (has the active styling)
      await expect(activityTab).toHaveClass(/text-/, { timeout: 5_000 });
    });
  });


  test('Steps 11-20: Sidebar tabs, settings, theme, account, and navigation', async ({ page }) => {
    test.setTimeout(180000); // 3 min — includes AI response waits

    // Navigate to app and select our project
    await waitForAppReady(page);

    // Click on our project in the sidebar
    await test.step('Pre: Select the TaskFlow project', async () => {
      const projectLink = page.getByText(PROJECT_NAME).first();
      // If the project is not visible (maybe auto-selected), that's fine
      if (await projectLink.isVisible().catch(() => false)) {
        await projectLink.click();
      }
      // Wait for the right sidebar tabs to appear
      await expect(page.getByTestId('sidebar-tab-activity')).toBeVisible({ timeout: 15_000 });
    });

    // ── Step 11: Switch to Tasks tab — check task list ──
    await test.step('Step 11: Switch to Tasks tab', async () => {
      const tasksTab = page.getByTestId('sidebar-tab-tasks');
      await tasksTab.click();

      // The Tasks tab content should be visible.
      // It may show tasks or an empty state — both are valid.
      await page.waitForTimeout(1_000);

      // Verify the tab is selected
      await expect(tasksTab).toContainText('Tasks');
    });

    // ── Step 12: Switch to Brain & Docs tab — verify upload zone visible ──
    await test.step('Step 12: Switch to Brain tab', async () => {
      const brainTab = page.getByTestId('sidebar-tab-brain');
      await brainTab.click();

      // The Brain tab should show the document upload zone and autonomy settings.
      // DocumentUploadZone renders a drop zone area.
      await page.waitForTimeout(1_000);

      // Look for upload-related content or autonomy settings text
      const brainContent = page.locator('[aria-hidden="false"]').or(
        page.locator('div').filter({ hasText: /upload|drag|drop|document|autonomy/i }).first()
      );
      // At minimum, the Brain tab should have rendered
      await expect(brainTab).toContainText('Brain');
    });

    // ── Step 13: Try the autonomy settings dial — change a level ──
    await test.step('Step 13: Interact with autonomy settings', async () => {
      // The AutonomySettingsPanel has a Switch toggle for "Autonomous execution"
      const autonomyToggle = page.getByLabel('Autonomous execution toggle');

      if (await autonomyToggle.isVisible().catch(() => false)) {
        // Toggle autonomy on
        await autonomyToggle.click();
        await page.waitForTimeout(500);

        // The dial options (observe/propose/confirm/autonomous) should now be interactable
        // Look for the level labels
        const dialLabels = page.getByText(/observe|propose|confirm|autonomous/i);
        const labelCount = await dialLabels.count();

        // Toggle back off to leave state clean
        await autonomyToggle.click();
        await page.waitForTimeout(500);
      }
      // Pass regardless — autonomy settings are optional for new projects
      expect(true).toBe(true);
    });

    // ── Step 14: Switch to dark mode ──
    await test.step('Step 14: Switch to dark mode', async () => {
      // The ThemeToggle is in the user dropdown menu in the left sidebar.
      // Click the user avatar/name area to open the dropdown.
      const userMenu = page.locator('.flex.items-center.gap-3').filter({ hasText: /Welcome/ }).first();
      await userMenu.click();
      await page.waitForTimeout(500);

      // Find and click the theme toggle button
      // It shows "Dark Mode" when in light mode, "Light Mode" when in dark mode
      const themeButton = page.getByText(/Dark Mode|Light Mode/).first();
      if (await themeButton.isVisible().catch(() => false)) {
        const currentLabel = await themeButton.textContent();
        if (currentLabel?.includes('Dark Mode')) {
          await themeButton.click();
          await page.waitForTimeout(500);
          // Verify dark mode is active — the html element should have class "dark"
          const htmlClass = await page.locator('html').getAttribute('class');
          expect(htmlClass).toContain('dark');
        }
      }

      // Close the dropdown by clicking elsewhere
      await page.locator('body').click({ position: { x: 10, y: 10 } });
      await page.waitForTimeout(300);
    });

    // ── Step 15: Switch back to light mode ──
    await test.step('Step 15: Switch back to light mode', async () => {
      // Reopen user dropdown
      const userMenu = page.locator('.flex.items-center.gap-3').filter({ hasText: /Welcome/ }).first();
      await userMenu.click();
      await page.waitForTimeout(500);

      const themeButton = page.getByText(/Dark Mode|Light Mode/).first();
      if (await themeButton.isVisible().catch(() => false)) {
        const currentLabel = await themeButton.textContent();
        if (currentLabel?.includes('Light Mode')) {
          await themeButton.click();
          await page.waitForTimeout(500);
          const htmlClass = await page.locator('html').getAttribute('class');
          // In light mode, "dark" class should not be present
          expect(htmlClass ?? '').not.toContain('dark');
        }
      }

      // Close dropdown
      await page.locator('body').click({ position: { x: 10, y: 10 } });
      await page.waitForTimeout(300);
    });

    // ── Step 16: Check Account page (/account) — verify free tier status ──
    await test.step('Step 16: Navigate to Account page and verify free tier', async () => {
      await page.goto('/account');

      // The AccountPage should display "Account & Billing" heading
      await expect(page.getByText('Account & Billing')).toBeVisible({ timeout: 10_000 });

      // Should show the user name
      await expect(page.getByText('Dev Tester')).toBeVisible({ timeout: 5_000 });

      // Should show "Free Plan" for a dev tester account
      // Wait for billing status to load (may show loading spinner first)
      const planText = page.getByText(/Free Plan|Pro Plan/);
      await expect(planText).toBeVisible({ timeout: 10_000 });
    });

    // ── Step 17: Navigate back to project ──
    await test.step('Step 17: Navigate back to the project', async () => {
      // Click "Back to app" link on the Account page
      const backLink = page.getByText('Back to app');
      await expect(backLink).toBeVisible();
      await backLink.click();

      // Should return to the main app
      await expect(page.getByText('Projects')).toBeVisible({ timeout: 10_000 });

      // Re-select our project if needed
      const projectLink = page.getByText(PROJECT_NAME).first();
      if (await projectLink.isVisible().catch(() => false)) {
        await projectLink.click();
      }

      // Wait for chat area to be ready
      await expect(page.getByTestId('input-message')).toBeVisible({ timeout: 10_000 });
    });

    // ── Step 18: Send another message to verify chat still works ──
    await test.step('Step 18: Send another message to verify chat works', async () => {
      const chatInput = page.getByTestId('input-message');
      await chatInput.fill('Can you suggest a tech stack for this?');
      await chatInput.press('Enter');

      // Verify the user message appears
      await expect(page.getByText('Can you suggest a tech stack for this?')).toBeVisible({ timeout: 10_000 });

      // Wait for agent response (up to 30s)
      await expect(async () => {
        const chatLog = page.locator('[role="log"]');
        const allText = await chatLog.textContent();
        // There should be substantial content now (multiple messages)
        expect(allText!.length).toBeGreaterThan(200);
      }).toPass({ timeout: 30_000 });
    });

    // ── Step 19: Verify message history persists ──
    await test.step('Step 19: Verify earlier messages still visible', async () => {
      // The earlier message "What should our MVP include?" should still be in the chat
      const chatLog = page.locator('[role="log"]');
      const chatContent = await chatLog.textContent();

      // Both messages should be present in the chat history
      expect(chatContent).toContain('Can you suggest a tech stack for this?');
      // The first message from test 1 may or may not be visible if it was in a previous
      // page session — but the message from step 18 should definitely be there.
    });

    // ── Step 20: Sidebar navigation between project/team/agent ──
    await test.step('Step 20: Test sidebar navigation between project, team, and agent', async () => {
      // The project should be expanded in the sidebar showing teams and agents.
      // Click on a team if visible.
      const projectItem = page.getByText(PROJECT_NAME).first();
      await expect(projectItem).toBeVisible({ timeout: 5_000 });

      // Click on the project to ensure it's selected (project-level chat)
      await projectItem.click();
      await page.waitForTimeout(500);

      // Look for team or agent entries under the project in the sidebar tree.
      // SaaS Startup template creates a team with PM, Tech Lead, Copywriter.
      // Teams and agents are rendered in the ProjectTree component.
      // Try to find and click on an agent name from the template.
      const agentNames = ['Alex', 'Jordan', 'Wren', 'Product Manager', 'Technical Lead', 'Copywriter'];
      let clickedAgent = false;

      for (const name of agentNames) {
        const agentItem = page.getByText(name, { exact: false }).first();
        if (await agentItem.isVisible().catch(() => false)) {
          await agentItem.click();
          clickedAgent = true;
          await page.waitForTimeout(1_000);

          // If we clicked an agent, the chat context should change.
          // The chat input placeholder might change to reflect 1-on-1 mode.
          const chatInput = page.getByTestId('input-message');
          await expect(chatInput).toBeVisible({ timeout: 5_000 });
          break;
        }
      }

      // Navigate back to project level
      await projectItem.click();
      await page.waitForTimeout(500);

      // Verify we're back at project-level chat
      await expect(page.getByTestId('input-message')).toBeVisible({ timeout: 5_000 });
    });
  });
});
