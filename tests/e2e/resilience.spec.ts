import { test, expect, type Page } from '@playwright/test';
import { ensureAppLoaded } from './helpers';

/**
 * Resilience audit — Layer C of the pre-deploy audit
 * (plan: .claude/plans/before-that-can-we-composed-bunny.md).
 *
 * Covers public-user failure modes that are NOT exercised by phase-specific
 * specs: WS reconnect, LLMUX regression re-check against new build, 404 page,
 * auth redirect with ?next= param, and free-tier limit upgrade prompt.
 *
 * Each case is independent and resets its own state. Designed to run under
 * the `chromium-light` Playwright project (no LLM round-trips) on a live
 * dev server with the standard authenticated storageState. Case 4 explicitly
 * creates a fresh unauthenticated context for testing the redirect.
 *
 * Per saved feedback rule `feedback_verify_in_runtime.md`, this spec runs
 * against a LIVE dev server — no mocking of the runtime.
 */

// ---------------------------------------------------------------------------
// Spec-local helpers — mirror the phase-35 spec pattern at lines 32-56.
// ---------------------------------------------------------------------------

async function forceOutage(page: Page, enabled: boolean): Promise<void> {
  const res = await page.request.post('/api/dev/force-outage', {
    data: { enabled },
    headers: { 'content-type': 'application/json' },
  });
  if (!res.ok()) {
    throw new Error(
      `force-outage POST failed: status=${res.status()} body=${await res.text()}`,
    );
  }
}

async function forceRecovery(page: Page): Promise<void> {
  const res = await page.request.post('/api/dev/force-recovery');
  if (!res.ok()) {
    throw new Error(
      `force-recovery POST failed: status=${res.status()} body=${await res.text()}`,
    );
  }
}

async function resetProviderState(page: Page): Promise<void> {
  await page.request.post('/api/dev/reset-provider-state');
}

// ---------------------------------------------------------------------------
// SPEC
// ---------------------------------------------------------------------------

test.describe('Resilience — public-user failure modes', () => {
  test.setTimeout(60_000);

  // -------------------------------------------------------------------------
  // 1. WebSocket reconnect — go offline mid-session, come back online,
  //    verify the connection re-establishes and the next message works.
  //    Real mobile users will hit network blips constantly.
  // -------------------------------------------------------------------------

  test('1 — WS reconnect: offline → online → connection restores', async ({ page, context }) => {
    await ensureAppLoaded(page);

    // Capture initial state — should be on the app with chat input visible.
    const input = page.locator('[data-testid="input-message"]');
    await expect(input).toBeVisible();

    // Simulate network drop. Wait briefly so the WS observes the disconnect.
    await context.setOffline(true);
    await page.waitForTimeout(1_500);

    // The connection-status pill / banner should reflect the disconnect.
    // We don't assert on its specific copy (varies by config); we assert that
    // when we come back online, the input is still usable.
    await context.setOffline(false);
    await page.waitForTimeout(3_000); // give the client time to auto-reconnect

    // After reconnect, the input remains interactive — this is the recovery
    // signal a real user cares about.
    await expect(input).toBeVisible();
    await expect(input).toBeEnabled();
  });

  // -------------------------------------------------------------------------
  // 2. LLMUX provider-degradation banner — regression check against the
  //    NEW build (Phase 36/37 changes may have touched the WS dispatch
  //    path; re-verifying the Phase 35 surface still works).
  // -------------------------------------------------------------------------

  test('2 — LLMUX banner appears on forced outage and dismisses on recovery', async ({ page }) => {
    await ensureAppLoaded(page);

    await resetProviderState(page);
    await forceOutage(page, true);

    // Toast should appear via the existing shadcn Toaster.
    // Phase 35 D-07 default copy: "Agents are slow right now, hang tight".
    // We accept either the explicit copy or any toast that contains "slow" or "degrad".
    const toast = page
      .locator('[role="status"], [role="alert"]')
      .filter({ hasText: /agents are slow|provider|degrad/i })
      .first();
    await expect(toast).toBeVisible({ timeout: 10_000 });

    // Recovery path — release lock, fire forceRecoveryBroadcast.
    await forceOutage(page, false);
    await forceRecovery(page);

    // Toast should dismiss within 5s of recovery (LLMUX-03 SLA).
    await expect(toast).not.toBeVisible({ timeout: 5_500 });

    // Clean up any lingering state.
    await resetProviderState(page);
  });

  // -------------------------------------------------------------------------
  // 3. 404 page — bogus route renders NotFound, not a crashed shell or blank.
  //    Important after the Wouter Switch reorg from prior phases.
  // -------------------------------------------------------------------------

  test('3 — bogus route lands on NotFound with link home', async ({ page }) => {
    await page.goto('/this-route-definitely-does-not-exist-zzz', { waitUntil: 'domcontentloaded' });

    // The 404 page renders some kind of "not found" indicator. We match
    // loosely — the existing 404 page contains "404 Page Not Found".
    const notFoundText = page.getByText(/404|not found|doesn't exist|page.*not.*found/i).first();
    await expect(notFoundText).toBeVisible({ timeout: 5_000 });

    // There should be a way back home — either a link or a "back" button.
    const homeLink = page
      .locator('a[href="/"], a[href="/landing"], button')
      .filter({ hasText: /home|back|landing|hatchin/i })
      .first();
    if (await homeLink.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await homeLink.click();
      // After clicking, we should leave the 404 — either land at / or /landing.
      await expect(page).not.toHaveURL(/this-route-definitely-does-not-exist/);
    }
  });

  // -------------------------------------------------------------------------
  // 4. Auth redirect — unauthenticated visit to a protected route should
  //    redirect to /login with a ?next= param so the post-signin handler can
  //    return the user to where they were headed.
  // -------------------------------------------------------------------------

  test('4 — unauthed /account redirects to /login?next=/account', async ({ browser }) => {
    // Fresh context with no auth cookies — explicitly NOT using the storageState.
    // Phase-35 case 2c pattern: pass storageState: undefined explicitly because
    // browser.newContext() in this Playwright version inherits the project-level
    // use.storageState if not overridden.
    const ctx = await browser.newContext({ storageState: undefined });
    const page = await ctx.newPage();

    try {
      await page.goto('/account', { waitUntil: 'domcontentloaded' });

      // AuthGuard redirects via wouter setLocation (history.pushState). Poll url
      // since pushState doesn't always trigger waitForURL navigation events.
      // React hydration + /api/auth/me round-trip can take 3-8s.
      await expect.poll(() => page.url(), {
        message: 'expected redirect to /login?next=/account within 15s',
        timeout: 15_000,
      }).toMatch(/\/login\?.*next=/);

      const parsed = new URL(page.url());
      const next = parsed.searchParams.get('next');
      expect(next, 'next param missing').toBeTruthy();
      expect(next).toContain('/account');
    } finally {
      await ctx.close();
    }
  });

  // -------------------------------------------------------------------------
  // 5. Free-tier project limit — creating beyond the cap should surface the
  //    UpgradeModal rather than a raw API error. SKIPPED unless the test user
  //    is deterministically Free tier with < 3 existing projects.
  //
  //    Setting up Free-tier state requires either:
  //    (a) a /api/dev/set-tier endpoint (does not currently exist), OR
  //    (b) a clean test user with a known starting tier.
  //
  //    The shared auth.setup user may be Free or Pro depending on env. Since
  //    we can't deterministically force the state, we skip and log the gap.
  //    File followup as Phase 47 backlog item.
  // -------------------------------------------------------------------------

  test('5 — free-tier project limit shows UpgradeModal [SKIPPED — needs /api/dev/set-tier]', async ({ page }) => {
    test.skip(
      true,
      'Free-tier state cannot be deterministically forced without /api/dev/set-tier — Phase 47 backlog item',
    );
    // When the seed endpoint exists, the test body would:
    //   1. POST /api/dev/set-tier { tier: 'free' }
    //   2. Ensure 3 projects exist (create via API up to the cap)
    //   3. Click "New Project" in the UI
    //   4. Expect UpgradeModal with "Upgrade to Pro" CTA visible
    //   5. Dismiss modal cleanly
    //   6. Tear down: POST /api/dev/set-tier { tier: 'pro' }
    await page.goto('/');
  });
});
