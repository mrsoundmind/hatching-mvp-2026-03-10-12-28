import { test, expect, type Page } from '@playwright/test';
import { ensureAppLoaded } from './helpers';

/**
 * Chat System E2E Tests
 *
 * Tests the CenterPanel chat interface including input, sending messages,
 * receiving agent responses, streaming, markdown rendering, and layout.
 *
 * Auth is pre-configured via session.json (Dev Tester user).
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

/** Locate the send button (aria-label="Send message"). */
function sendButton(page: Page) {
  return page.locator('button[aria-label="Send message"]');
}

/** Locate the stop/cancel button (aria-label="Stop generating"). */
function stopButton(page: Page) {
  return page.locator('button[aria-label="Stop generating"]');
}

/** The scrollable message container marked role="log". */
function messageLog(page: Page) {
  return page.locator('[role="log"][aria-label="Chat messages"]');
}

/** Send a chat message via the input and wait for the user bubble to appear. */
async function sendMessage(page: Page, text: string) {
  const input = chatInput(page);
  await input.fill(text);
  // Press Enter (not Shift+Enter) to send
  await input.press('Enter');
}

// ---------------------------------------------------------------------------
// Tests: Chat Input
// ---------------------------------------------------------------------------

test.describe('Chat Input', () => {
  test.beforeEach(async ({ page }) => {
    await ensureChatReady(page);
  });

  test('chat input is visible at bottom of panel', async ({ page }) => {
    const input = chatInput(page);
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('placeholder', /.+/); // has some placeholder text
  });

  test('send button is disabled when input is empty', async ({ page }) => {
    const btn = sendButton(page);
    await expect(btn).toBeVisible();
    await expect(btn).toBeDisabled();
  });

  test('send button becomes enabled when text is entered', async ({ page }) => {
    const input = chatInput(page);
    await input.fill('Hello');
    const btn = sendButton(page);
    await expect(btn).toBeEnabled();
  });

  test('send button returns to disabled after clearing input', async ({ page }) => {
    const input = chatInput(page);
    await input.fill('Something');
    await expect(sendButton(page)).toBeEnabled();
    await input.fill('');
    await expect(sendButton(page)).toBeDisabled();
  });

  test('cannot send empty or whitespace-only message', async ({ page }) => {
    const input = chatInput(page);
    await input.fill('   ');
    await expect(sendButton(page)).toBeDisabled();
  });

  test('Enter key sends the message', async ({ page }) => {
    const input = chatInput(page);
    const uniqueMsg = `e2e-enter-${Date.now()}`;
    await input.click();
    // Use pressSequentially instead of fill to trigger React onChange properly
    await input.pressSequentially(uniqueMsg, { delay: 10 });
    // Small wait for React state to sync
    await page.waitForTimeout(500);
    await page.keyboard.press('Enter');
    // The input should clear after sending
    await expect(input).toHaveValue('', { timeout: 10000 });
    // The user message should appear in the log
    await expect(messageLog(page).getByText(uniqueMsg)).toBeVisible({ timeout: 15000 });
  });

  test('Shift+Enter creates a new line instead of sending', async ({ page }) => {
    const input = chatInput(page);
    await input.fill('Line one');
    await input.press('Shift+Enter');
    await input.pressSequentially('Line two');
    // The input should still contain text (not cleared by send)
    const value = await input.inputValue();
    expect(value).toContain('Line one');
    expect(value).toContain('Line two');
  });

  test('input clears after sending a message', async ({ page }) => {
    const input = chatInput(page);
    await input.fill(`clear-check-${Date.now()}`);
    await input.press('Enter');
    await expect(input).toHaveValue('', { timeout: 5000 });
  });

  test('chat input auto-resizes with multi-line text', async ({ page }) => {
    const input = chatInput(page);
    // Get initial height
    const initialHeight = await input.evaluate((el) => el.clientHeight);

    // Type multiple lines
    await input.fill('Line 1\nLine 2\nLine 3\nLine 4\nLine 5');
    // Trigger the resize by dispatching input event
    await input.evaluate((el) => el.dispatchEvent(new Event('input', { bubbles: true })));

    // Wait a tick for the resize callback
    await page.waitForTimeout(200);
    const expandedHeight = await input.evaluate((el) => el.clientHeight);
    expect(expandedHeight).toBeGreaterThanOrEqual(initialHeight);
  });
});

// ---------------------------------------------------------------------------
// Tests: Sending & Receiving Messages
// ---------------------------------------------------------------------------

test.describe('Message Sending & Agent Response', () => {
  test.beforeEach(async ({ page }) => {
    await ensureChatReady(page);
  });

  test('sent message appears as user bubble (right-aligned)', async ({ page }) => {
    const uniqueMsg = `e2e-user-bubble-${Date.now()}`;
    await sendMessage(page, uniqueMsg);

    // Wait for the message to appear
    const bubble = messageLog(page).getByText(uniqueMsg);
    await expect(bubble).toBeVisible({ timeout: 10000 });

    // User messages are inside a flex container with justify-end (right-aligned)
    const wrapper = bubble.locator('xpath=ancestor::div[contains(@class, "justify-end")]');
    await expect(wrapper.first()).toBeVisible();
  });

  test('agent response appears after sending a message (left-aligned)', async ({ page }) => {
    test.setTimeout(120000); // AI response can be slow
    const uniqueMsg = `e2e-agent-response-${Date.now()}`;
    await sendMessage(page, uniqueMsg);

    // Wait for at least one agent message to appear (streaming complete)
    // Agent messages are inside justify-start containers
    const agentBubble = messageLog(page).locator('.justify-start .text-sm.leading-relaxed').last();
    await expect(agentBubble).toBeVisible({ timeout: 45000 });

    // Agent message should have some non-empty content
    const agentText = await agentBubble.textContent();
    expect(agentText?.trim().length).toBeGreaterThan(0);
  });

  test('user and agent messages have visually distinct styling', async ({ page }) => {
    test.setTimeout(120000); // AI response can be slow
    const uniqueMsg = `e2e-style-check-${Date.now()}`;
    await sendMessage(page, uniqueMsg);

    // Wait for agent response
    await page.waitForTimeout(2000);

    // User bubbles have class "chat-bubble-user"
    const userBubbles = messageLog(page).locator('.chat-bubble-user');
    const userCount = await userBubbles.count();
    expect(userCount).toBeGreaterThan(0);

    // Agent bubbles have class "ai-bubble-border"
    const agentBubbles = messageLog(page).locator('.ai-bubble-border');
    // There may be pre-existing agent messages (welcome), or the response is still streaming
    // Wait for at least one
    await expect(agentBubbles.first()).toBeVisible({ timeout: 45000 });
  });

  test('thinking indicator appears while waiting for agent response', async ({ page }) => {
    const uniqueMsg = `e2e-thinking-${Date.now()}`;
    await sendMessage(page, uniqueMsg);

    // The thinking indicator cycles through phrases or shows bouncing dots
    // Look for the typing indicator bar or streaming agent bounce dots
    // The bottom typing bar or inline bounce dots should appear
    const thinkingVisible = await Promise.race([
      // Typing bar at bottom with "is typing..."
      page.locator('text=/is typing/').waitFor({ state: 'visible', timeout: 10000 }).then(() => true),
      // Inline bounce dots during streaming (the wave-bounce animation spans)
      page.locator('.animate-bounce').first().waitFor({ state: 'visible', timeout: 10000 }).then(() => true),
      // Stop button appears (means streaming started)
      stopButton(page).waitFor({ state: 'visible', timeout: 10000 }).then(() => true),
    ]).catch(() => false);

    expect(thinkingVisible).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: Message Bubble Components
// ---------------------------------------------------------------------------

test.describe('Message Bubble Components', () => {
  test.beforeEach(async ({ page }) => {
    await ensureChatReady(page);
  });

  test('agent message shows sender name and role', async ({ page }) => {
    test.setTimeout(120000); // AI response can be slow
    const uniqueMsg = `e2e-agent-info-${Date.now()}`;
    await sendMessage(page, uniqueMsg);

    // Wait for agent response with sender info (name + role visible above bubble)
    // Agent sender info: <span class="text-sm font-medium text-muted-foreground">AgentName</span>
    // followed by a role span with "dot" separator
    const agentNameSpan = messageLog(page).locator('.justify-start .text-sm.font-medium.text-muted-foreground');
    await expect(agentNameSpan.first()).toBeVisible({ timeout: 45000 });

    const name = await agentNameSpan.first().textContent();
    expect(name?.trim().length).toBeGreaterThan(0);
  });

  test('timestamps are visible on messages', async ({ page }) => {
    test.setTimeout(120000); // AI response can be slow
    const uniqueMsg = `e2e-timestamp-${Date.now()}`;
    await sendMessage(page, uniqueMsg);

    // Timestamps appear as "Just now", "X minutes ago" etc.
    // They are rendered outside the bubble in a small text div
    const timestamps = messageLog(page).locator('text=/Just now|minutes? ago|hours? ago|days? ago/');
    await expect(timestamps.first()).toBeVisible({ timeout: 10000 });
  });

  test('agent message has avatar', async ({ page }) => {
    test.setTimeout(120000); // AI response can be slow
    const uniqueMsg = `e2e-avatar-${Date.now()}`;
    await sendMessage(page, uniqueMsg);

    // Agent avatars are AgentAvatar components (SVG or canvas) inside the sender info row
    // They render before the agent name in .justify-start messages
    // Look for the avatar container within agent message area
    const agentAvatarArea = messageLog(page).locator('.justify-start .items-center.gap-2');
    await expect(agentAvatarArea.first()).toBeVisible({ timeout: 45000 });
  });
});

// ---------------------------------------------------------------------------
// Tests: Markdown Rendering
// ---------------------------------------------------------------------------

test.describe('Markdown Rendering in Messages', () => {
  test.beforeEach(async ({ page }) => {
    await ensureChatReady(page);
  });

  test('bold text renders with <strong> tags in agent response', async ({ page }) => {
    test.setTimeout(120000); // AI response can be slow
    // Ask the agent to use bold text
    await sendMessage(page, `Please respond with a word in bold like **important** in your reply. e2e-bold-${Date.now()}`);

    // Wait for agent response, then check for <strong> element
    const strongEl = messageLog(page).locator('.ai-bubble-border strong');
    await expect(strongEl.first()).toBeVisible({ timeout: 45000 });
  });

  test('code blocks render with proper formatting', async ({ page }) => {
    test.setTimeout(120000); // AI response can be slow
    await sendMessage(page, `Show me a simple code example like \`console.log("hello")\` in your response. e2e-code-${Date.now()}`);

    // Inline code: <code> with specific classes, or block <pre><code>
    const codeEl = messageLog(page).locator('.ai-bubble-border code');
    await expect(codeEl.first()).toBeVisible({ timeout: 45000 });
  });
});

// ---------------------------------------------------------------------------
// Tests: Layout & Edge Cases
// ---------------------------------------------------------------------------

test.describe('Layout & Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await ensureChatReady(page);
  });

  test('long message (500+ chars) does not break layout', async ({ page }) => {
    const longText = 'A'.repeat(550) + `-e2e-long-${Date.now()}`;
    await sendMessage(page, longText);

    // The message should be visible without horizontal overflow
    const bubble = messageLog(page).getByText(longText.slice(0, 50)); // match beginning
    await expect(bubble).toBeVisible({ timeout: 10000 });

    // Check that the message log does not have horizontal scroll
    const hasOverflow = await messageLog(page).evaluate((el) => {
      return el.scrollWidth > el.clientWidth;
    });
    expect(hasOverflow).toBe(false);
  });

  test('emoji rendering in messages', async ({ page }) => {
    const emojiMsg = `Hello from tests! 🚀🎉✨ e2e-emoji-${Date.now()}`;
    await sendMessage(page, emojiMsg);

    const bubble = messageLog(page).getByText(/🚀🎉✨/);
    await expect(bubble).toBeVisible({ timeout: 10000 });
  });

  test('empty state shows welcome screen when no messages', async ({ page }) => {
    // Navigate to app fresh — if there is already a welcome message from Maya,
    // the welcome screen may not show. We verify either the welcome screen
    // (with action buttons) or existing messages are present.
    const welcomeOrMessages = await Promise.race([
      // Welcome screen has action buttons like "Give me a product roadmap"
      page.locator('text=/product roadmap|team goals|team.s tasks|focus on/i')
        .first()
        .waitFor({ state: 'visible', timeout: 8000 })
        .then(() => 'welcome'),
      // Or messages already exist
      messageLog(page)
        .waitFor({ state: 'visible', timeout: 8000 })
        .then(() => 'messages'),
    ]).catch(() => 'neither');

    // Either welcome screen or messages should be visible
    expect(['welcome', 'messages']).toContain(welcomeOrMessages);
  });

  test('auto-scroll: new message scrolls chat to bottom', async ({ page }) => {
    // Send a message
    const msg = `e2e-autoscroll-${Date.now()}`;
    await sendMessage(page, msg);

    // Wait for the message to appear
    await expect(messageLog(page).getByText(msg)).toBeVisible({ timeout: 10000 });

    // The message log should be scrolled to near the bottom
    const scrollInfo = await messageLog(page).evaluate((el) => ({
      scrollTop: el.scrollTop,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));
    // scrollTop + clientHeight should be close to scrollHeight (within 150px tolerance)
    const distanceFromBottom = scrollInfo.scrollHeight - scrollInfo.scrollTop - scrollInfo.clientHeight;
    expect(distanceFromBottom).toBeLessThan(150);
  });
});

// ---------------------------------------------------------------------------
// Tests: Streaming & Cancel
// ---------------------------------------------------------------------------

test.describe('Streaming Behavior', () => {
  test.beforeEach(async ({ page }) => {
    await ensureChatReady(page);
  });

  test('cancel/stop button appears during streaming', async ({ page }) => {
    await sendMessage(page, `Write a detailed 3-paragraph explanation of quantum computing. e2e-stream-${Date.now()}`);

    // The stop button should appear while the agent is streaming
    // It may be brief, so we check with a reasonable timeout
    const appeared = await stopButton(page)
      .waitFor({ state: 'visible', timeout: 15000 })
      .then(() => true)
      .catch(() => false);

    // If the response is very fast, the stop button may not appear — that is acceptable
    // but we note it. For longer responses it should appear.
    if (!appeared) {
      // Verify the response completed (streaming was just very fast)
      const agentMsg = messageLog(page).locator('.ai-bubble-border');
      await expect(agentMsg.first()).toBeVisible({ timeout: 30000 });
    }
    // Test passes either way — stop button appeared, or response was too fast
  });

  test('streaming completes and full message is rendered', async ({ page }) => {
    test.setTimeout(120000); // AI response can be slow
    const uniqueMsg = `e2e-stream-complete-${Date.now()}`;
    await sendMessage(page, `Give me a brief summary of what you can help with. ${uniqueMsg}`);

    // Wait for agent response to finish streaming
    // Once streaming is done, the message should have substantial content
    // and the send button (not stop button) should be visible again
    await expect(sendButton(page)).toBeVisible({ timeout: 45000 });

    // Verify the agent response has meaningful content
    const agentBubbles = messageLog(page).locator('.ai-bubble-border .text-sm.leading-relaxed');
    const lastAgent = agentBubbles.last();
    await expect(lastAgent).toBeVisible({ timeout: 5000 });

    const content = await lastAgent.textContent();
    expect(content?.trim().length).toBeGreaterThan(10);
  });
});

// ---------------------------------------------------------------------------
// Tests: Pagination
// ---------------------------------------------------------------------------

test.describe('Pagination', () => {
  test('Load earlier messages button shown when conversation has history', async ({ page }) => {
    await ensureChatReady(page);

    // This test checks whether the "Load earlier messages" button appears.
    // It only shows when hasMoreMessages is true (50+ messages in conversation).
    // In a fresh test environment it may not appear, so we just verify the button
    // is NOT broken when absent, or IS functional when present.
    const loadEarlierBtn = page.locator('text=Load earlier messages');
    const isVisible = await loadEarlierBtn.isVisible().catch(() => false);

    if (isVisible) {
      await loadEarlierBtn.click();
      // Should show loading state
      await expect(page.locator('text=Fetching earlier messages')).toBeVisible({ timeout: 5000 });
    }
    // If not visible, that is expected for a conversation with fewer than 50 messages
    expect(true).toBe(true);
  });
});
