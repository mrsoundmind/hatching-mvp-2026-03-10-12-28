/**
 * v3.0 "Hatchin That Works" — Local gap audit (authenticated).
 *
 * Targets the 10 gaps identified in the v3.0 codebase audit.
 * Runs against localhost dev server with dev-login session.
 *
 * Each gap is named in the test title so failures map cleanly to REQ-IDs.
 * Tests are designed to FAIL where features are missing — failures here
 * are not test bugs, they are the empirical confirmation of gaps.
 */
import { test, expect, type Page } from '@playwright/test';
import { ensureAppLoaded } from './helpers';

async function openProjectChat(page: Page) {
  await ensureAppLoaded(page);
  // Wait for chat input to be visible — confirms project is selected
  await page.locator('[data-testid="input-message"]').waitFor({ state: 'visible', timeout: 15000 });
}

test.describe('v3.0 gap audit — authenticated local', () => {
  test.beforeEach(async ({ page }) => {
    await openProjectChat(page);
  });

  // ─── GAP-03: Phase indicator ────────────────────────────────────────────
  test('GAP-03: chat header has phase indicator (Discovery → Draft → Building)', async ({
    page,
  }) => {
    // Look for any element matching phase-machine UI
    const phaseIndicator = page
      .locator(
        '[data-testid*="phase"], [aria-label*="phase" i], text=/discovery.{0,5}(draft|blueprint|building)/i',
      )
      .first();
    const exists = await phaseIndicator.isVisible({ timeout: 3000 }).catch(() => false);
    expect(
      exists,
      'GAP-03 CONFIRMED: No phase indicator visible (PHASE-04 unimplemented)',
    ).toBe(true);
  });

  // ─── GAP-05: Skip-Maya escape hatch ─────────────────────────────────────
  test('GAP-05: Skip-Maya path exists in onboarding/project creation', async ({ page }) => {
    // Try to reach a fresh project-creation flow
    const newProjectButton = page
      .getByRole('button', { name: /new project|create project|add project|\+/i })
      .first();

    if (await newProjectButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await newProjectButton.click();
      await page.waitForTimeout(1500);

      const skipPath = page
        .getByRole('link', { name: /skip to my team|jump to|skip discovery/i })
        .or(page.getByRole('button', { name: /skip to my team|jump to|skip discovery/i }))
        .or(page.getByText(/skip to my team|skip discovery/i));
      const visible = await skipPath.first().isVisible({ timeout: 3000 }).catch(() => false);
      expect(visible, 'GAP-05 CONFIRMED: No "Skip to my team" path (SKIP-01 unimplemented)').toBe(
        true,
      );
    } else {
      test.skip(true, 'No new-project entry point found — flow may differ');
    }
  });

  // ─── GAP-06: Deliverable feedback buttons ───────────────────────────────
  test('GAP-06: deliverable Accept/Dismiss buttons present in artifact panel', async ({
    page,
  }) => {
    // Try to find an existing deliverable in the right sidebar or trigger one
    const artifactToggle = page
      .getByRole('button', { name: /artifact|deliverable|view/i })
      .first();

    if (await artifactToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
      await artifactToggle.click();
      await page.waitForTimeout(2000);
    }

    const acceptButton = page.getByRole('button', { name: /^accept$|use this|approve/i });
    const dismissButton = page.getByRole('button', { name: /dismiss|reject|discard/i });

    const acceptExists = (await acceptButton.count()) > 0;
    const dismissExists = (await dismissButton.count()) > 0;

    expect(
      acceptExists && dismissExists,
      'GAP-06 CONFIRMED: No Accept+Dismiss buttons on deliverables (FBK-02 unimplemented)',
    ).toBe(true);
  });

  // ─── GAP-08: Cost visibility / quota framing ────────────────────────────
  test('GAP-08: UsageBar shows autonomy run quota (not just message budget)', async ({ page }) => {
    // Look for autonomy-specific quota text
    const autonomyQuota = page.getByText(/autonomy.{0,10}run|runs remaining|\d+ of \d+ runs/i);
    const visible = await autonomyQuota.first().isVisible({ timeout: 3000 }).catch(() => false);
    expect(
      visible,
      'GAP-08 CONFIRMED: No autonomy run quota in UsageBar (COST-02 unimplemented)',
    ).toBe(true);
  });

  // ─── GAP-09: Dynamic team formation recommendation ──────────────────────
  test('GAP-09: freeform project creation surfaces team recommendation', async ({ page }) => {
    const newProjectButton = page
      .getByRole('button', { name: /new project|create project|add project|\+/i })
      .first();

    if (await newProjectButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await newProjectButton.click();
      await page.waitForTimeout(1500);

      // Look for "Skip starter pack" or "Create from scratch" path
      const freeformPath = page
        .getByRole('button', { name: /scratch|freeform|custom|describe your own/i })
        .first();

      if (await freeformPath.isVisible({ timeout: 3000 }).catch(() => false)) {
        await freeformPath.click();
        await page.waitForTimeout(2000);

        // After describing project, should see a recommendation card
        const recommendation = page.getByText(
          /recommended team|suggested agents|3.{0,3}(hatches|agents)/i,
        );
        const visible = await recommendation.first().isVisible({ timeout: 5000 }).catch(() => false);
        expect(
          visible,
          'GAP-09 CONFIRMED: No team recommendation on freeform creation (FORM-01 unimplemented)',
        ).toBe(true);
      } else {
        test.skip(true, 'No freeform project creation path found');
      }
    } else {
      test.skip(true, 'No new-project entry point found');
    }
  });

  // ─── GAP-10: Console errors during normal interaction ───────────────────
  test('GAP-10: no console errors during basic chat interaction', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore expected errors (auth checks, OAuth refresh, etc.)
        if (!/Failed to load resource: the server responded with a status of 401/.test(text)) {
          consoleErrors.push(text);
        }
      }
    });

    // Reload to capture all errors fresh
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    if (consoleErrors.length > 0) {
      console.log('Console errors detected:', consoleErrors);
    }
    expect(consoleErrors, `GAP-10: ${consoleErrors.length} console error(s) on app load`).toEqual(
      [],
    );
  });
});

// ─── AI-heavy gaps (Maya bug, discovery count, blueprint card) ───────────
test.describe('v3.0 gap audit — AI behavior (slow, network-dependent)', () => {
  test.setTimeout(120000); // AI tests are slow

  test.beforeEach(async ({ page }) => {
    await openProjectChat(page);
  });

  // ─── GAP-01: Maya infinite thinking + fallback messages ─────────────────
  test('GAP-01: no spurious fallback messages on valid Maya response', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const input = page.locator('[data-testid="input-message"]');
    await input.fill('hello, can you give me a one-line response?');

    // Find the send button — could be button or Enter
    const sendButton = page.getByRole('button', { name: /send|submit/i }).first();
    if (await sendButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await sendButton.click();
    } else {
      await input.press('Enter');
    }

    // Wait up to 60s for response or known failure phrases
    await page.waitForTimeout(60000);

    const bodyText = await page.locator('body').innerText();

    // Check for the "out for lunch" / "resting circuits" bug strings
    const hasOutForLunch = /out for lunch|resting (their|its) circuits|didn't come through/i.test(
      bodyText,
    );
    const hasFailedToGenerate = /failed to generate response/i.test(bodyText);

    expect(
      hasOutForLunch,
      'GAP-01 CONFIRMED: "out for lunch" / "resting circuits" fallback message fired (BUG-04 unimplemented)',
    ).toBe(false);
    expect(
      hasFailedToGenerate,
      'GAP-01 CONFIRMED: "Failed to generate response" leaked to user (BUG-03 unimplemented)',
    ).toBe(false);

    // Verify thinking state cleared — no persistent typing indicator after response window
    const thinkingIndicator = page.locator(
      '[data-testid*="typing"], [aria-label*="typing" i], [aria-label*="thinking" i]',
    );
    const stillThinking = await thinkingIndicator
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false);
    expect(
      stillThinking,
      'GAP-01 CONFIRMED: thinking state never cleared after 60s (BUG-02/BUG-03 unimplemented)',
    ).toBe(false);
  });

  // ─── GAP-02: Discovery question count ───────────────────────────────────
  test('GAP-02: Maya asks ≤3 questions per message on project description', async ({ page }) => {
    const input = page.locator('[data-testid="input-message"]');
    await input.fill(
      'I want to build a stylish Mickey Mouse calculator for kids. Make it fun and educational.',
    );

    const sendButton = page.getByRole('button', { name: /send|submit/i }).first();
    if (await sendButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await sendButton.click();
    } else {
      await input.press('Enter');
    }

    // Wait for Maya's response — give up to 90s
    await page.waitForTimeout(90000);

    // Get the latest assistant/Maya message
    const messages = page.locator('[data-testid*="message"], [role="article"]');
    const lastMessage = messages.last();
    const messageText = await lastMessage.innerText().catch(() => '');

    if (!messageText) {
      test.skip(true, 'No Maya response received within 90s — could not measure');
    }

    const questionMarks = (messageText.match(/\?/g) || []).length;

    console.log(`Maya asked ${questionMarks} questions in last message:\n${messageText}`);

    expect(
      questionMarks,
      `GAP-02 CONFIRMED: Maya asked ${questionMarks} questions (DISC-01 cap is 3)`,
    ).toBeLessThanOrEqual(3);
  });

  // ─── GAP-04: Blueprint card after multiple discovery exchanges ──────────
  test('GAP-04: BlueprintCard appears after sufficient discovery context', async ({ page }) => {
    const input = page.locator('[data-testid="input-message"]');

    // Provide rich context across 3 turns (covers MVB schema: what, who, why)
    const turns = [
      'I want to build a stylish Mickey Mouse calculator for kids — fun, animated, sound effects.',
      'Target audience is kids aged 6-10. Their parents will buy it. Educational fun is the value.',
      'Why it matters: kids fear math; making it Mickey-Mouse-themed makes it approachable.',
    ];

    for (const turn of turns) {
      await input.fill(turn);
      const sendButton = page.getByRole('button', { name: /send|submit/i }).first();
      if (await sendButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await sendButton.click();
      } else {
        await input.press('Enter');
      }
      // Wait for Maya to respond between turns
      await page.waitForTimeout(30000);
    }

    // Look for any structured BlueprintCard component
    const blueprintCard = page
      .locator('[data-testid*="blueprint"], [class*="BlueprintCard" i]')
      .or(page.getByRole('button', { name: /looks good.{0,5}start building|approve blueprint/i }))
      .or(page.getByText(/project blueprint|here's what i heard|let me draft/i));

    const visible = await blueprintCard.first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(
      visible,
      'GAP-04 CONFIRMED: No BlueprintCard after 3 discovery turns (BLPR-01..03 unimplemented)',
    ).toBe(true);
  });
});
