import { test, expect, type Page } from '@playwright/test';
import { ensureAppLoaded } from './helpers';

/**
 * v2.2 live demo: send a real message and capture the agent's reply, to show a non-technical
 * founder that the personality fixes work in the running app — a distinct, first-person voice
 * with no canned shared opener and no third-person self-reference.
 * Matched by the `chromium-ai` project (authenticated session + 2-min timeout).
 */

function chatInput(page: Page) { return page.locator('[data-testid="input-message"]'); }
function messageLog(page: Page) { return page.locator('[role="log"][aria-label="Chat messages"]'); }
function agentNames(page: Page) { return messageLog(page).locator('.justify-start .text-sm.font-medium.text-muted-foreground'); }

test('v2.2 — agent replies in a distinct first-person voice (no canned opener)', async ({ page }) => {
  await ensureAppLoaded(page);

  const input = chatInput(page);
  await expect(input).toBeVisible({ timeout: 20000 });

  const msg = "We're thinking about adding a dark mode to the app. What's your quick take?";
  await input.fill(msg);
  await input.press('Enter');

  // Wait for an agent reply bubble to appear + finish streaming.
  const agentBubble = messageLog(page).locator('.justify-start .text-sm.leading-relaxed').last();
  await expect(agentBubble).toBeVisible({ timeout: 90000 });
  await page.waitForTimeout(5000); // let streaming settle

  const reply = ((await agentBubble.textContent()) || '').trim();
  const replierName = ((await agentNames(page).last().textContent()) || '').trim();

  console.log('\n=========== AGENT (' + replierName + ') REPLIED ===========');
  console.log(reply);
  console.log('=====================================================\n');

  await page.screenshot({ path: 'tests/e2e/.artifacts/v22-persona-demo.png', fullPage: true });

  // Loose demo assertions (not a strict gate).
  expect(reply.length, 'agent produced a substantive reply').toBeGreaterThan(20);
  expect(reply.toLowerCase(), 'no canned shared opener (Phase B)').not.toContain('good call from the pm side');
  // Phase B/E: the replier should not refer to itself by its own name in the third person.
  if (replierName) {
    const firstName = replierName.split(/[\s(]/)[0];
    if (firstName && firstName.length > 2) {
      const thirdPersonSelf = new RegExp(`\\b${firstName}\\s+(thinks|says|would|is|has|will|here)`, 'i');
      expect(reply, `no third-person self-reference by name (${firstName})`).not.toMatch(thirdPersonSelf);
    }
  }
});
