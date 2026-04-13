import { test, expect } from '@playwright/test';
import { ensureAppLoaded } from './helpers';

/**
 * Right Sidebar — Tabbed Layout E2E Tests
 *
 * Tests the three-tab right sidebar: Activity, Tasks, Brain & Docs.
 * Requires an authenticated session and at least one project to exist.
 */

// Helper: ensure we are on the main app with a project selected so the sidebar renders.
async function navigateToProjectWithSidebar(page: import('@playwright/test').Page) {
  await ensureAppLoaded(page);

  // The right sidebar renders when a project is active.
  // Wait for the sidebar tab bar to appear (the 3-tab bar: Activity | Tasks | Brain).
  // If no project exists yet, the sidebar shows "Select a project" — we need to create one.
  const sidebarTab = page.getByTestId('sidebar-tab-activity');
  const noProjectMsg = page.getByText('Select a project to view its overview');

  // Wait for either the sidebar tabs or the "no project" message
  await Promise.race([
    sidebarTab.waitFor({ timeout: 10_000 }).catch(() => {}),
    noProjectMsg.waitFor({ timeout: 10_000 }).catch(() => {}),
  ]);

  // If no project is selected, click the first project in the left sidebar (or create one)
  if (await noProjectMsg.isVisible().catch(() => false)) {
    // Try clicking an existing project in the sidebar tree
    const projectItem = page.locator('aside').first().locator('span.truncate').first();
    if (await projectItem.isVisible().catch(() => false)) {
      await projectItem.click();
    }
  }

  // Now wait for the tab bar to be present
  await expect(sidebarTab).toBeVisible({ timeout: 15_000 });
}

// ─── Tab Bar (SidebarTabBar) ────────────────────────────────────────────────

test.describe('Right Sidebar — Tab Bar', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToProjectWithSidebar(page);
  });

  test('all three tabs are visible and clickable', async ({ page }) => {
    const activityTab = page.getByTestId('sidebar-tab-activity');
    const tasksTab = page.getByTestId('sidebar-tab-tasks');
    const brainTab = page.getByTestId('sidebar-tab-brain');

    await expect(activityTab).toBeVisible();
    await expect(tasksTab).toBeVisible();
    await expect(brainTab).toBeVisible();

    // Verify tab labels
    await expect(activityTab).toContainText('Activity');
    await expect(tasksTab).toContainText('Tasks');
    await expect(brainTab).toContainText('Brain');
  });

  test('active tab has distinct highlight style', async ({ page }) => {
    // Activity is the default tab — it should have the active blue color
    const activityTab = page.getByTestId('sidebar-tab-activity');
    await expect(activityTab).toHaveClass(/text-\[var\(--hatchin-blue\)\]/);

    // Tasks tab should NOT have active style
    const tasksTab = page.getByTestId('sidebar-tab-tasks');
    await expect(tasksTab).not.toHaveClass(/text-\[var\(--hatchin-blue\)\]/);
  });

  test('tab switching works — clicking each tab activates it', async ({ page }) => {
    const activityTab = page.getByTestId('sidebar-tab-activity');
    const tasksTab = page.getByTestId('sidebar-tab-tasks');
    const brainTab = page.getByTestId('sidebar-tab-brain');

    // Click Tasks tab
    await tasksTab.click();
    await expect(tasksTab).toHaveClass(/text-\[var\(--hatchin-blue\)\]/);
    await expect(activityTab).not.toHaveClass(/text-\[var\(--hatchin-blue\)\]/);

    // Click Brain tab
    await brainTab.click();
    await expect(brainTab).toHaveClass(/text-\[var\(--hatchin-blue\)\]/);
    await expect(tasksTab).not.toHaveClass(/text-\[var\(--hatchin-blue\)\]/);

    // Click back to Activity
    await activityTab.click();
    await expect(activityTab).toHaveClass(/text-\[var\(--hatchin-blue\)\]/);
    await expect(brainTab).not.toHaveClass(/text-\[var\(--hatchin-blue\)\]/);
  });

  test('CSS-hidden tabs preserve state — panels use display:none, not unmount', async ({ page }) => {
    // Scope to the sidebar's three top-level tab panels — other elements in feed
    // items also use aria-hidden which would inflate the count.
    const allPanels = page.locator('[role="tabpanel"]');
    await expect(allPanels).toHaveCount(3);

    // When Activity is active, the other two panels should be aria-hidden="true"
    await expect(page.locator('[role="tabpanel"][aria-hidden="true"]')).toHaveCount(2);

    // Switch to Tasks — Activity panel should become hidden but remain in DOM
    await page.getByTestId('sidebar-tab-tasks').click();

    // Now Tasks panel is the only aria-hidden="false" panel; the other two are hidden
    await expect(page.locator('[role="tabpanel"][aria-hidden="false"]')).toHaveCount(1);
    await expect(page.locator('[role="tabpanel"][aria-hidden="true"]')).toHaveCount(2);
  });
});

// ─── Activity Tab ───────────────────────────────────────────────────────────

test.describe('Right Sidebar — Activity Tab', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToProjectWithSidebar(page);
    // Activity tab is the default, but click it to be safe
    await page.getByTestId('sidebar-tab-activity').click();
  });

  test('activity tab header renders with "Live Activity" title', async ({ page }) => {
    await expect(page.getByText('Live Activity')).toBeVisible();
    await expect(page.getByText('Real-time pulse of what your Hatches are working on.')).toBeVisible();
  });

  test('stats card is visible with "tasks done" and "handoffs" labels', async ({ page }) => {
    // AutonomyStatsCard shows two stat boxes
    await expect(page.getByText('tasks done')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('handoffs')).toBeVisible();
  });

  test('feed filter dropdown is visible', async ({ page }) => {
    // FeedFilters renders a Select with filter options (All, Tasks, Handoffs, Reviews, Approvals)
    // The default filter shows "All"
    const filterTrigger = page.locator('button[role="combobox"]').first();
    await expect(filterTrigger).toBeVisible();
  });

  test('empty state shows compelling message when no events', async ({ page }) => {
    // Wait for loading skeleton to clear before checking either state
    await page.locator('.skeleton-shimmer').first().waitFor({ state: 'detached', timeout: 10_000 }).catch(() => {});

    // If there are no autonomy events, the empty state should show
    const emptyState = page.getByText('Your team is ready');
    const feedItem = page.locator('.activity-feed-item').first();

    // Either the empty state or feed items should be visible
    const hasEmptyState = await emptyState.isVisible().catch(() => false);
    const hasFeedItems = await feedItem.isVisible().catch(() => false);

    expect(hasEmptyState || hasFeedItems).toBeTruthy();

    if (hasEmptyState) {
      await expect(
        page.getByText('When your Hatches start working autonomously')
      ).toBeVisible();
    }
  });
});

// ─── Tasks Tab ──────────────────────────────────────────────────────────────

test.describe('Right Sidebar — Tasks Tab', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToProjectWithSidebar(page);
    await page.getByTestId('sidebar-tab-tasks').click();
  });

  test('tasks tab header renders with "Mission Board" title', async ({ page }) => {
    await expect(page.getByText('Mission Board')).toBeVisible();
    await expect(
      page.getByText('Tasks created by Hatches from chat, or added by you.')
    ).toBeVisible();
  });

  test('shows task list or empty state', async ({ page }) => {
    // Either "No missions yet." empty state or task sections should appear
    const emptyState = page.getByText('No missions yet.');
    const taskSections = page.getByText('Tasks', { exact: false }).locator('..').locator('..');

    await page.waitForTimeout(2_000); // allow data to load

    const hasEmptyState = await emptyState.isVisible().catch(() => false);
    const hasTasks = await page.locator('text=Urgent').or(page.locator('text=Active')).first().isVisible().catch(() => false);

    expect(hasEmptyState || hasTasks).toBeTruthy();
  });

  test('new task button is available', async ({ page }) => {
    // The "+ New task" button should be visible (either in empty state or task board)
    // Scope to the Tasks tabpanel — '+ New' also exists in the left sidebar Projects section.
    const tasksPanel = page.locator('#sidebar-tabpanel-tasks');
    const newTaskBtn = tasksPanel.getByRole('button', { name: '+ New task', exact: true })
      .or(tasksPanel.getByRole('button', { name: '+ New', exact: true }));
    await expect(newTaskBtn.first()).toBeVisible({ timeout: 5_000 });
  });

  test('clicking new task button shows task creation form', async ({ page }) => {
    // Scope to the Tasks tabpanel — '+ New' also exists in the left sidebar Projects section.
    const tasksPanel = page.locator('#sidebar-tabpanel-tasks');
    const newTaskBtn = tasksPanel.getByRole('button', { name: '+ New task', exact: true })
      .or(tasksPanel.getByRole('button', { name: '+ New', exact: true }));
    await newTaskBtn.first().click();

    // Task creation form should appear with an input and Add/Cancel buttons (scoped to panel)
    const input = tasksPanel.getByPlaceholder('What needs to be done?');
    await expect(input).toBeVisible();
    await expect(tasksPanel.getByRole('button', { name: 'Add', exact: true })).toBeVisible();
    await expect(tasksPanel.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible();
  });

  test('can create a task from sidebar', async ({ page }) => {
    // Scope to the Tasks tabpanel — '+ New' also exists in the left sidebar Projects section.
    const tasksPanel = page.locator('#sidebar-tabpanel-tasks');
    const newTaskBtn = tasksPanel.getByRole('button', { name: '+ New task', exact: true })
      .or(tasksPanel.getByRole('button', { name: '+ New', exact: true }));
    await newTaskBtn.first().click();

    const input = tasksPanel.getByPlaceholder('What needs to be done?');
    await input.fill('E2E test task from sidebar');
    await tasksPanel.getByRole('button', { name: 'Add', exact: true }).click();

    // After creation, the task should appear in the list
    await expect(page.getByText('E2E test task from sidebar')).toBeVisible({ timeout: 5_000 });
  });

  test('cancel button hides task creation form', async ({ page }) => {
    // Scope to the Tasks tabpanel — '+ New' also exists in the left sidebar Projects section.
    const tasksPanel = page.locator('#sidebar-tabpanel-tasks');
    const newTaskBtn = tasksPanel.getByRole('button', { name: '+ New task', exact: true })
      .or(tasksPanel.getByRole('button', { name: '+ New', exact: true }));
    await newTaskBtn.first().click();

    const input = tasksPanel.getByPlaceholder('What needs to be done?');
    await expect(input).toBeVisible();

    await tasksPanel.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(input).not.toBeVisible();
  });
});

// ─── Brain & Docs Tab ───────────────────────────────────────────────────────

test.describe('Right Sidebar — Brain & Docs Tab', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToProjectWithSidebar(page);
    await page.getByTestId('sidebar-tab-brain').click();
    // Autonomy dial is disabled (pointer-events-none) when autonomous execution
    // is OFF. Enable it so dial-click tests can interact with the radio buttons.
    const toggle = page.getByRole('switch', { name: 'Autonomous execution toggle' });
    if (await toggle.isVisible().catch(() => false)) {
      const isOn = await toggle.getAttribute('aria-checked');
      if (isOn !== 'true') {
        await toggle.click();
      }
    }
  });

  test('brain tab header renders with "The Brain" title', async ({ page }) => {
    await expect(page.getByText('The Brain')).toBeVisible();
    await expect(
      page.getByText('Project context, autonomy rules, and shared knowledge.')
    ).toBeVisible();
  });

  test('autonomy settings section is visible', async ({ page }) => {
    await expect(page.getByText('Autonomy Settings')).toBeVisible();
    await expect(page.getByText('Autonomous execution')).toBeVisible();
  });

  test('autonomy toggle switch is present', async ({ page }) => {
    const toggle = page.getByRole('switch', { name: 'Autonomous execution toggle' });
    await expect(toggle).toBeVisible();
  });

  test('autonomy dial shows 4 levels: observe, propose, confirm, autonomous', async ({ page }) => {
    const radioGroup = page.getByRole('radiogroup', { name: 'Autonomy level' });
    await expect(radioGroup).toBeVisible();

    // All 4 level buttons should be present
    await expect(radioGroup.getByRole('radio', { name: 'observe' })).toBeVisible();
    await expect(radioGroup.getByRole('radio', { name: 'propose' })).toBeVisible();
    await expect(radioGroup.getByRole('radio', { name: 'confirm' })).toBeVisible();
    await expect(radioGroup.getByRole('radio', { name: 'autonomous' })).toBeVisible();
  });

  test('clicking autonomy dial level changes the active selection', async ({ page }) => {
    const radioGroup = page.getByRole('radiogroup', { name: 'Autonomy level' });

    // Click "observe" level
    await radioGroup.getByRole('radio', { name: 'observe' }).click();
    await expect(
      radioGroup.getByRole('radio', { name: 'observe' })
    ).toHaveAttribute('aria-checked', 'true');

    // Click "autonomous" level
    await radioGroup.getByRole('radio', { name: 'autonomous' }).click();
    await expect(
      radioGroup.getByRole('radio', { name: 'autonomous' })
    ).toHaveAttribute('aria-checked', 'true');
    await expect(
      radioGroup.getByRole('radio', { name: 'observe' })
    ).toHaveAttribute('aria-checked', 'false');
  });

  test('autonomy level description updates when dial changes', async ({ page }) => {
    const radioGroup = page.getByRole('radiogroup', { name: 'Autonomy level' });

    await radioGroup.getByRole('radio', { name: 'observe' }).click();
    await expect(
      page.getByText('Hatches suggest actions but never act without you.')
    ).toBeVisible();

    await radioGroup.getByRole('radio', { name: 'autonomous' }).click();
    await expect(
      page.getByText('Hatches execute fully — you review completed work.')
    ).toBeVisible();
  });

  test('document upload zone is visible with drop area', async ({ page }) => {
    // Scroll down to find the Knowledge Base section with upload zone
    const knowledgeBase = page.getByText('Knowledge Base').last();
    await knowledgeBase.scrollIntoViewIfNeeded();

    // DocumentUploadZone renders an upload area with "Drop files here" or upload prompt
    const uploadArea = page.getByText('PDF, DOCX, TXT, and MD').or(
      page.getByText('Drop').first()
    ).or(page.locator('input[type="file"]'));
    await expect(uploadArea.first()).toBeAttached();
  });

  test('section dividers are present for major sections', async ({ page }) => {
    // BrainDocsTab has labeled section dividers
    await expect(page.getByText('Autonomy').first()).toBeVisible();
    await expect(page.getByText('Project Knowledge Base')).toBeVisible();
    await expect(page.getByText('Deliverables')).toBeVisible();
  });

  test('deliverables section is visible', async ({ page }) => {
    const deliverables = page.getByText('Deliverables');
    await deliverables.scrollIntoViewIfNeeded();
    await expect(
      page.getByText('Final output documents generated by Hatches for review.')
    ).toBeVisible();
  });
});

// ─── Cross-cutting ──────────────────────────────────────────────────────────

test.describe('Right Sidebar — Cross-cutting', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToProjectWithSidebar(page);
  });

  test('sidebar container has overflow-y-auto for scrolling', async ({ page }) => {
    const sidebar = page.locator('aside.right-sidebar-scroll');
    await expect(sidebar).toBeVisible();
    // The aside has overflow-y-auto class applied
    await expect(sidebar).toHaveClass(/overflow-y-auto/);
  });

  test('rapid tab switching does not crash the UI', async ({ page }) => {
    const tabs = ['activity', 'tasks', 'brain'] as const;

    for (let i = 0; i < 10; i++) {
      const tab = tabs[i % tabs.length];
      await page.getByTestId(`sidebar-tab-${tab}`).click();
    }

    // After rapid switching, the UI should still be functional
    await expect(page.getByTestId('sidebar-tab-activity')).toBeVisible();
    await expect(page.getByTestId('sidebar-tab-tasks')).toBeVisible();
    await expect(page.getByTestId('sidebar-tab-brain')).toBeVisible();
  });

  test('switching to a tab and back preserves the panel content', async ({ page }) => {
    // Start on Activity tab — verify content
    await page.getByTestId('sidebar-tab-activity').click();
    await expect(page.getByText('Live Activity')).toBeVisible();

    // Switch to Brain
    await page.getByTestId('sidebar-tab-brain').click();
    await expect(page.getByText('The Brain')).toBeVisible();

    // Switch back to Activity — content should still be there (CSS-hidden, not unmounted)
    await page.getByTestId('sidebar-tab-activity').click();
    await expect(page.getByText('Live Activity')).toBeVisible();
  });
});
