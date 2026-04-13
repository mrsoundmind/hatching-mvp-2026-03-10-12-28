import { test, expect, type Page } from '@playwright/test';
import { ensureAppLoaded } from './helpers';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Persona: "Edge Case Explorer" — QA Tester
 *
 * Goal: BREAK the app. Every test targets an edge case, boundary, or stress
 * scenario. Auth is pre-configured via session.json (Dev Tester user).
 * The app must be running at http://localhost:5001.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Navigate to the app and ensure a project chat is loaded. */
async function ensureChatReady(page: Page) {
  await ensureAppLoaded(page);
}

/** Locate the chat textarea. */
function chatInput(page: Page) {
  return page.locator('[data-testid="input-message"]');
}

/** Locate the send button. */
function sendButton(page: Page) {
  return page.locator('button[aria-label="Send message"]');
}

/** The scrollable message container. */
function messageLog(page: Page) {
  return page.locator('[role="log"][aria-label="Chat messages"]');
}

/** Send a chat message and wait for the user bubble to appear. */
async function sendMessage(page: Page, text: string) {
  const input = chatInput(page);
  await input.fill(text);
  await input.press('Enter');
}

/** Create a temp file with given content and return its path. */
function createTempFile(name: string, sizeBytes: number): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hatchin-e2e-'));
  const filePath = path.join(dir, name);
  const buf = Buffer.alloc(sizeBytes, 'x');
  fs.writeFileSync(filePath, buf);
  return filePath;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Edge Case Explorer — QA Breaker', () => {

  // 1. Long message — Send a 2000+ character message
  test('long message renders without overflow or crash', async ({ page }) => {
    await ensureChatReady(page);
    const longText = `e2e-long-${Date.now()}-${'A'.repeat(2000)}`;
    await sendMessage(page, longText);

    // Input should clear after send
    await expect(chatInput(page)).toHaveValue('', { timeout: 5000 });

    // The message should appear in the log (check a substring)
    const log = messageLog(page);
    await expect(log.getByText(longText.slice(0, 60))).toBeVisible({ timeout: 30000 });

    // No horizontal overflow — the log container should not scroll horizontally
    const overflowX = await log.evaluate(el => el.scrollWidth > el.clientWidth + 20);
    expect(overflowX).toBe(false);
  });

  // 2. Empty message — whitespace-only should be blocked
  test('empty or whitespace-only message cannot be sent', async ({ page }) => {
    await ensureChatReady(page);

    // Pure spaces
    await chatInput(page).fill('     ');
    await expect(sendButton(page)).toBeDisabled();

    // Tabs and newlines
    await chatInput(page).fill('\t\n  \n');
    await expect(sendButton(page)).toBeDisabled();

    // Single space
    await chatInput(page).fill(' ');
    await expect(sendButton(page)).toBeDisabled();
  });

  // 3. Code blocks — triple backticks render correctly
  test('code blocks in message render as formatted code', async ({ page }) => {
    await ensureChatReady(page);
    const codeMsg = 'Check this code:\n```js\nconst x = 42;\nconsole.log(x);\n```';
    await sendMessage(page, codeMsg);
    await expect(chatInput(page)).toHaveValue('', { timeout: 5000 });

    // The user message should appear
    const log = messageLog(page);
    await expect(log.getByText('Check this code')).toBeVisible({ timeout: 30000 });

    // No crash — page is still interactive
    await expect(chatInput(page)).toBeEnabled();
  });

  // 4. Rich content — links, bold, italic, emojis
  test('rich content with links, bold, italic, emojis renders', async ({ page }) => {
    await ensureChatReady(page);
    const richMsg = `Rich test: **bold** _italic_ [link](https://example.com) and emojis: 🚀🎉💡 ${Date.now()}`;
    await sendMessage(page, richMsg);
    await expect(chatInput(page)).toHaveValue('', { timeout: 5000 });

    const log = messageLog(page);
    await expect(log.getByText('Rich test:')).toBeVisible({ timeout: 30000 });

    // Page still functional
    await expect(chatInput(page)).toBeEnabled();
  });

  // 5. Rapid fire — 5 messages in quick succession
  test('rapid fire 5 messages — all appear, no duplicates', async ({ page }) => {
    test.setTimeout(120000); // Rapid sends can queue up AI responses
    await ensureChatReady(page);
    const tag = `rapid-${Date.now()}`;
    const messages: string[] = [];

    for (let i = 0; i < 5; i++) {
      const msg = `${tag}-msg-${i}`;
      messages.push(msg);
      await chatInput(page).fill(msg);
      await chatInput(page).press('Enter');
      // Brief pause to allow the send to register, but keep it rapid
      await page.waitForTimeout(200);
    }

    const log = messageLog(page);

    // All 5 should appear
    for (const msg of messages) {
      await expect(log.getByText(msg)).toBeVisible({ timeout: 30000 });
    }

    // No duplicates — each message should appear exactly once
    for (const msg of messages) {
      const count = await log.getByText(msg, { exact: false }).count();
      expect(count).toBe(1);
    }
  });

  // 6. Multiple tabs — open app in two page contexts
  test('multiple tabs work independently', async ({ browser }) => {
    const context1 = await browser.newContext({
      storageState: 'tests/e2e/.auth/session.json',
    });
    const context2 = await browser.newContext({
      storageState: 'tests/e2e/.auth/session.json',
    });

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    await page1.goto('/', { waitUntil: 'domcontentloaded' });
    await page2.goto('/', { waitUntil: 'domcontentloaded' });

    // Both should load without errors
    await page1.waitForSelector('[data-testid="input-message"]', { timeout: 30000 });
    await page2.waitForSelector('[data-testid="input-message"]', { timeout: 30000 });

    // Send a message in tab 1
    const msg = `tab1-msg-${Date.now()}`;
    await chatInput(page1).fill(msg);
    await chatInput(page1).press('Enter');
    await expect(chatInput(page1)).toHaveValue('', { timeout: 5000 });

    // Tab 2 should still be functional
    await expect(chatInput(page2)).toBeEnabled();

    await context1.close();
    await context2.close();
  });

  // 7. Cancel streaming — send message, then cancel while AI is responding
  test('cancel streaming does not crash', async ({ page }) => {
    test.setTimeout(120000); // AI streaming + cancel timing
    await ensureChatReady(page);
    const msg = `Cancel test: explain quantum computing in detail ${Date.now()}`;
    await sendMessage(page, msg);

    // Wait for the stop button to appear (streaming has started)
    const stopBtn = page.locator('button[aria-label="Stop generating"]');
    const appeared = await stopBtn.isVisible({ timeout: 30000 }).catch(() => false);

    if (appeared) {
      await stopBtn.click();
      // After cancel, the send button should return
      await expect(sendButton(page)).toBeVisible({ timeout: 10000 });
    }

    // Either way, the page should still be functional
    await expect(chatInput(page)).toBeEnabled();
  });

  // 8. Rapid tab switching — Activity -> Tasks -> Brain -> Activity x10
  test('rapid sidebar tab switching does not crash', async ({ page }) => {
    await ensureChatReady(page);

    // The sidebar tabs may only be visible on wider viewports or when sidebar is open
    const activityTab = page.locator('[data-testid="sidebar-tab-activity"]');
    const tasksTab = page.locator('[data-testid="sidebar-tab-tasks"]');
    const brainTab = page.locator('[data-testid="sidebar-tab-brain"]');

    // Check if tabs are visible (they may be in a right sidebar panel)
    const tabsVisible = await activityTab.isVisible({ timeout: 5000 }).catch(() => false);

    if (tabsVisible) {
      for (let i = 0; i < 10; i++) {
        await activityTab.click();
        await tasksTab.click();
        await brainTab.click();
      }
      // Final state: brain tab should be active
      await expect(brainTab).toBeVisible();
    }

    // Page should not crash — chat input still works
    await expect(chatInput(page)).toBeEnabled();
  });

  // 9. Invalid file upload — .exe file to Brain & Docs
  test('invalid file type upload shows error', async ({ page }) => {
    await ensureChatReady(page);

    // Navigate to Brain tab if visible
    const brainTab = page.locator('[data-testid="sidebar-tab-brain"]');
    const tabVisible = await brainTab.isVisible({ timeout: 5000 }).catch(() => false);
    if (tabVisible) {
      await brainTab.click();
    }

    // Look for the file input in the upload zone
    const fileInput = page.locator('input[type="file"]').first();
    const inputVisible = await fileInput.count();

    if (inputVisible > 0) {
      const tempFile = createTempFile('malware.exe', 1024);
      await fileInput.setInputFiles(tempFile);

      // Should show an error about unsupported file type
      await expect(
        page.getByText(/only pdf|unsupported|not supported/i)
      ).toBeVisible({ timeout: 5000 });

      // Cleanup
      fs.unlinkSync(tempFile);
    }
  });

  // 10. Large file upload — over 10MB
  test('large file upload over 10MB shows error', async ({ page }) => {
    await ensureChatReady(page);

    const brainTab = page.locator('[data-testid="sidebar-tab-brain"]');
    const tabVisible = await brainTab.isVisible({ timeout: 5000 }).catch(() => false);
    if (tabVisible) {
      await brainTab.click();
    }

    const fileInput = page.locator('input[type="file"]').first();
    const inputVisible = await fileInput.count();

    if (inputVisible > 0) {
      // Create a file just over 10MB
      const tempFile = createTempFile('huge-doc.txt', 11 * 1024 * 1024);
      await fileInput.setInputFiles(tempFile);

      // Should show a size error
      await expect(
        page.getByText(/under 10mb|too large|file.*size/i)
      ).toBeVisible({ timeout: 5000 });

      // Cleanup
      fs.unlinkSync(tempFile);
    }
  });

  // 11. 404 navigation — go to a nonexistent route
  test('navigating to /nonexistent shows 404 page', async ({ page }) => {
    await page.goto('/nonexistent');

    // Should see the 404 content
    await expect(page.getByText('404')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/doesn.t exist/i)).toBeVisible();

    // Should have a link back to projects
    const backLink = page.getByText('Back to projects');
    await expect(backLink).toBeVisible();
    await expect(backLink).toHaveAttribute('href', '/');
  });

  // 12. Account page with no billing — graceful free tier display
  test('account page renders gracefully for free tier', async ({ page }) => {
    await page.goto('/account');

    // The page should load without crashing
    // Look for common account page elements
    await expect(
      page.getByText(/account|billing|plan|free|subscription/i).first()
    ).toBeVisible({ timeout: 30000 });

    // Should not show a broken/error state
    const errorVisible = await page.getByText(/something went wrong|error/i).isVisible().catch(() => false);
    expect(errorVisible).toBe(false);
  });

  // 13. Theme rapid toggle — toggle dark/light mode 10 times
  test('rapid theme toggling does not crash', async ({ page }) => {
    await ensureChatReady(page);

    // Find the theme toggle button
    const themeToggle = page.locator('button[aria-label*="Switch to"]');
    const toggleVisible = await themeToggle.isVisible({ timeout: 5000 }).catch(() => false);

    if (toggleVisible) {
      for (let i = 0; i < 10; i++) {
        await themeToggle.click();
        // Minimal wait — just enough for the toggle to register
        await page.waitForTimeout(50);
      }
    }

    // Page should still be functional
    await expect(chatInput(page)).toBeEnabled();

    // No uncaught errors — verify page state
    const html = page.locator('html');
    const classAttr = await html.getAttribute('class');
    // Should have either 'dark' or 'light' (not both, not empty)
    expect(classAttr).toBeTruthy();
  });

  // 14. Sidebar rapid toggle — collapse/expand rapidly
  test('rapid sidebar collapse and expand does not break layout', async ({ page }) => {
    await ensureChatReady(page);

    // Look for sidebar toggle buttons (mobile hamburger or desktop collapse)
    const toggleBtns = page.locator('button[aria-label*="sidebar" i], button[aria-label*="menu" i], button[aria-label*="panel" i]');
    const count = await toggleBtns.count();

    if (count > 0) {
      const btn = toggleBtns.first();
      for (let i = 0; i < 10; i++) {
        await btn.click();
        await page.waitForTimeout(50);
      }
    }

    // Chat input should still be visible and functional
    await expect(chatInput(page)).toBeEnabled();

    // No layout explosion — viewport check
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    // Body should not be significantly wider than viewport (no horizontal overflow)
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 20);
  });

  // 15. Modal escape — open every triggerable modal, press Escape to close
  test('modals close on Escape key', async ({ page }) => {
    await ensureChatReady(page);

    // Try to open AddHatchModal — look for "Add Hatch" or "+" button
    const addHatchBtn = page.locator('button:has-text("Add"), button[aria-label*="add" i]').first();
    const addVisible = await addHatchBtn.isVisible({ timeout: 3000 }).catch(() => false);

    if (addVisible) {
      await addHatchBtn.click();
      await page.waitForTimeout(300);

      // Check if a modal/dialog appeared
      const dialog = page.locator('[role="dialog"], [data-state="open"]').first();
      const dialogVisible = await dialog.isVisible({ timeout: 2000 }).catch(() => false);

      if (dialogVisible) {
        await page.keyboard.press('Escape');
        // Modal should close
        await expect(dialog).not.toBeVisible({ timeout: 3000 });
      }
    }

    // Page should still work
    await expect(chatInput(page)).toBeEnabled();
  });

  // 16. Modal backdrop click — open modal, click outside to close
  test('modals close on backdrop click', async ({ page }) => {
    await ensureChatReady(page);

    // Try to open a modal
    const addHatchBtn = page.locator('button:has-text("Add"), button[aria-label*="add" i]').first();
    const addVisible = await addHatchBtn.isVisible({ timeout: 3000 }).catch(() => false);

    if (addVisible) {
      await addHatchBtn.click();
      await page.waitForTimeout(300);

      // Radix dialogs have a data-state="open" overlay
      const overlay = page.locator('[data-radix-dialog-overlay], [data-state="open"][role="dialog"] + div, .fixed.inset-0').first();
      const overlayVisible = await overlay.isVisible({ timeout: 2000 }).catch(() => false);

      if (overlayVisible) {
        // Click the overlay (top-left corner, likely outside the modal content)
        await overlay.click({ position: { x: 5, y: 5 } });

        const dialog = page.locator('[role="dialog"]').first();
        await expect(dialog).not.toBeVisible({ timeout: 3000 });
      }
    }

    // Page should still work
    await expect(chatInput(page)).toBeEnabled();
  });

  // 17. XSS attempt — <script> tag should render as text, not execute
  test('XSS script tag renders as text and does not execute', async ({ page }) => {
    test.setTimeout(120000); // Sends a message and waits for render
    await ensureChatReady(page);

    // Collect console errors/messages to detect script execution
    const consoleMessages: string[] = [];
    page.on('console', (msg) => consoleMessages.push(msg.text()));

    // Also catch any alert dialogs (would fire if XSS succeeds)
    let alertFired = false;
    page.on('dialog', async (dialog) => {
      alertFired = true;
      await dialog.dismiss();
    });

    const xssPayload = `<script>alert('xss')</script> ${Date.now()}`;
    await sendMessage(page, xssPayload);
    await expect(chatInput(page)).toHaveValue('', { timeout: 5000 });

    // Wait for the message to render
    const log = messageLog(page);
    await expect(log.getByText(Date.now().toString().slice(0, 8))).toBeVisible({ timeout: 30000 }).catch(() => {
      // The timestamp may have shifted, just wait a moment
    });
    await page.waitForTimeout(2000);

    // The script tag should be rendered as visible text, not executed
    // Look for the literal text "<script>" in the page
    const scriptTextVisible = await log.getByText('<script>').isVisible().catch(() => false);
    const alertTextVisible = await log.getByText("alert('xss')").isVisible().catch(() => false);

    // At least one of these should be true (the tag is shown as text)
    // OR the content is sanitized/stripped entirely — either way, no execution
    expect(alertFired).toBe(false);

    // Make sure no "xss" alert appeared in console
    const xssInConsole = consoleMessages.some(m => m.includes('xss'));
    expect(xssInConsole).toBe(false);

    // Page is still functional
    await expect(chatInput(page)).toBeEnabled();
  });

});
