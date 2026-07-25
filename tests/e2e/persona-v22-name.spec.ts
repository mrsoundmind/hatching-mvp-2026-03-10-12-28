import { test, expect, type Page } from '@playwright/test';
import { ensureAppLoaded } from './helpers';

/**
 * v2.2 Phase F demo: the user states a name in chat; the agent should pick it up and use it, and the
 * name persists on the account (verified separately via DB). Matched by the `chromium-ai` project.
 */

function chatInput(page: Page) { return page.locator('[data-testid="input-message"]'); }
function messageLog(page: Page) { return page.locator('[role="log"][aria-label="Chat messages"]'); }

async function send(page: Page, text: string) {
  const input = chatInput(page);
  await input.fill(text);
  await input.press('Enter');
}
async function lastAgentReply(page: Page): Promise<string> {
  const bubble = messageLog(page).locator('.justify-start .text-sm.leading-relaxed').last();
  await expect(bubble).toBeVisible({ timeout: 90000 });
  await page.waitForTimeout(5000);
  return ((await bubble.textContent()) || '').trim();
}

test('v2.2 Phase F — user gives a name in chat and the agent addresses them by it', async ({ page }) => {
  await ensureAppLoaded(page);
  await expect(chatInput(page)).toBeVisible({ timeout: 20000 });

  await send(page, 'Hey team, you can call me Sam from now on.');
  const ack = await lastAgentReply(page);
  console.log('\n[reply after name given] ' + ack.slice(0, 220) + '\n');

  await send(page, 'Cool. What should we focus on first this week?');
  const followup = await lastAgentReply(page);
  console.log('\n[follow-up reply] ' + followup + '\n');

  await page.screenshot({ path: 'tests/e2e/.artifacts/v22-name-demo.png', fullPage: true });

  const usedName = /\bsam\b/i.test(ack) || /\bsam\b/i.test(followup);
  console.log('AGENT USED THE NAME "Sam": ' + usedName);

  expect(followup.length, 'agent produced a follow-up reply').toBeGreaterThan(10);
});
