/**
 * Phase 35 — Production Hotfix Pass (AUDIT-01)
 *
 * Runtime smoke spec covering the full Phase 35 surface:
 *   1a — /legal/privacy deep-link page renders non-404 content
 *   1b — Privacy modal opens from landing footer click (no navigation)
 *   2a — /legal/terms deep-link page renders non-404 content
 *   2b — Terms modal opens from landing footer click (no navigation)
 *   2c — Login footer Privacy + Terms also open modals
 *   3  — Forced provider outage shows degradation toast
 *   4  — Recovery dismisses toast within 5 seconds
 *
 * Per D-15 / D-16 / D-17 / D-18 in 35-CONTEXT.md:
 *   - Runs against a live restarted dev server (playwright.config.ts webServer)
 *   - Cases 3 + 4 share state via test.describe.serial() — case 4 verifies
 *     recovery from the degraded state established in case 3
 *   - Total runtime budget ≤ 5 minutes
 *   - No hardcoded waits longer than 30s; uses Playwright's auto-retry expect
 *
 * Selector lesson learned from 35-04: not every footer-style row is inside a
 * `<footer>` semantic element. Landing page wraps its links in `<footer>` but
 * login.tsx puts them in a `<p>`. Use `a[href="/legal/..."]` unscoped (with
 * .first() if needed) — covered in 35-04 SUMMARY § Handoff to 35-05.
 */
import { test, expect, type Page } from '@playwright/test';
import { ensureAppLoaded } from './helpers';

// ---------------------------------------------------------------------------
// Spec-local helpers — keep here (not in helpers.ts) since they're spec-specific.
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
  // Idempotent — safe to call multiple times.
  await page.request.post('/api/dev/reset-provider-state');
}

// ===========================================================================
// SPEC
// ===========================================================================

test.describe.serial('Phase 35 — Production Hotfix Pass', () => {
  // 60s budget per test; cases 3-4 may need WS-roundtrip headroom (case 4 has
  // an explicit 5_000ms toast-dismiss assertion that is shorter than this).
  test.setTimeout(60_000);

  // -------------------------------------------------------------------------
  // LEGAL-01 — hybrid modal + deep-link rendering (35-04 surface)
  // -------------------------------------------------------------------------

  test('1a — /legal/privacy deep-link page renders non-404 content', async ({ page }) => {
    await page.goto('/legal/privacy', { waitUntil: 'domcontentloaded' });

    // Page-mode chrome supplies an <h1> with the title.
    const heading = page.getByRole('heading', { name: /Privacy Policy/i, level: 1 });
    await expect(heading).toBeVisible();

    // DRAFT banner from LegalPageLayout — amber note role.
    await expect(page.getByText(/DRAFT — for legal review/i).first()).toBeVisible();

    // NotFound page should NOT be rendered. The 404 page (not-found.tsx) shows
    // a "404" text + "doesn't exist or may have been moved" message.
    await expect(page.getByText('404 Page Not Found')).toHaveCount(0);
  });

  test('1b — Privacy modal opens from landing footer click (no navigation)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Capture URL before click — should not change since modal preventDefaults nav.
    const urlBefore = page.url();

    // Click the landing footer Privacy anchor. Use .first() because TermsContent
    // (rendered if Terms modal ever opens) also includes a /legal/privacy link.
    // On a fresh '/' page-load no modal is open yet, so the only such link is
    // the footer one — .first() is defense in depth.
    await page.locator('a[href="/legal/privacy"]').first().click();

    // Dialog should open with the Privacy title.
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 3_000 });
    await expect(dialog.getByRole('heading', { name: /Privacy Policy/i })).toBeVisible();

    // URL did NOT change — modal does not navigate (preventDefault in onClick).
    expect(page.url()).toBe(urlBefore);

    // DRAFT marker visible inside the dialog.
    await expect(dialog.getByText(/DRAFT/i).first()).toBeVisible();

    // Escape dismisses the dialog.
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible({ timeout: 2_000 });
  });

  test('2a — /legal/terms deep-link page renders non-404 content', async ({ page }) => {
    await page.goto('/legal/terms', { waitUntil: 'domcontentloaded' });

    const heading = page.getByRole('heading', { name: /Terms of Service/i, level: 1 });
    await expect(heading).toBeVisible();

    await expect(page.getByText(/DRAFT — for legal review/i).first()).toBeVisible();
    await expect(page.getByText('404 Page Not Found')).toHaveCount(0);
  });

  test('2b — Terms modal opens from landing footer click (no navigation)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const urlBefore = page.url();

    await page.locator('a[href="/legal/terms"]').first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 3_000 });
    await expect(dialog.getByRole('heading', { name: /Terms of Service/i })).toBeVisible();
    expect(page.url()).toBe(urlBefore);
    await expect(dialog.getByText(/DRAFT/i).first()).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible({ timeout: 2_000 });
  });

  test('2c — Login footer Privacy + Terms also open modals (no navigation)', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    // Privacy first.
    const urlBefore = page.url();
    await page.locator('a[href="/legal/privacy"]').first().click();
    const privacyDialog = page.getByRole('dialog');
    await expect(privacyDialog).toBeVisible({ timeout: 3_000 });
    await expect(privacyDialog.getByRole('heading', { name: /Privacy Policy/i })).toBeVisible();
    expect(page.url()).toBe(urlBefore);
    await page.keyboard.press('Escape');
    await expect(privacyDialog).not.toBeVisible({ timeout: 2_000 });

    // Then Terms — same flow.
    await page.locator('a[href="/legal/terms"]').first().click();
    const termsDialog = page.getByRole('dialog');
    await expect(termsDialog).toBeVisible({ timeout: 3_000 });
    await expect(termsDialog.getByRole('heading', { name: /Terms of Service/i })).toBeVisible();
    expect(page.url()).toBe(urlBefore);
    await page.keyboard.press('Escape');
    await expect(termsDialog).not.toBeVisible({ timeout: 2_000 });
  });

  // -------------------------------------------------------------------------
  // LLMUX-02 + LLMUX-03 — provider outage banner + recovery dismiss
  //
  // Serial-ordered: case 4 verifies recovery from case 3's degraded state.
  // -------------------------------------------------------------------------

  test('3 — forced provider outage shows degradation toast with expected copy', async ({
    page,
  }) => {
    // Ensure app is loaded + WS handshake complete before broadcasting. Otherwise
    // the broadcast happens-before subscription and the toast won't appear in
    // this client (35-02's late-join replay protects future connections but
    // we want to exercise the primary path here).
    await ensureAppLoaded(page);

    // Belt-and-suspenders clean slate (force-outage internally also resets, but
    // calling here defends against contract drift).
    await resetProviderState(page);

    // Trigger the synthetic degraded broadcast via the DEV-only endpoint.
    await forceOutage(page, true);

    // Toast should appear within 10s — gives the WS round-trip plenty of room.
    // Shadcn Toaster renders Radix Toasts with role="status" by default. We
    // scope by hasText to OUR toast in case other toasts coexist.
    const toast = page.locator('[role="status"]').filter({ hasText: 'Agents are slow' });
    await expect(toast).toBeVisible({ timeout: 10_000 });

    // Description copy must match D-07 ("Agents are slow right now, hang tight").
    await expect(toast).toContainText(/Agents are slow right now, hang tight/i);

    // Input must remain enabled — degradation toast does NOT block typing (D-09).
    await expect(page.locator('[data-testid="input-message"]')).toBeEnabled();
  });

  test('4 — recovery dismisses toast within 5 seconds', async ({ page }) => {
    // Each Playwright test gets its OWN page + WS connection. We can't rely on
    // UI-level continuity from case 3 — re-establish degraded state on this
    // page first, then trigger recovery and verify the toast dismisses.
    await ensureAppLoaded(page);

    // Clean slate, then drive a fresh degradation cycle on THIS page's WS.
    await resetProviderState(page);
    await forceOutage(page, true);
    const toast = page.locator('[role="status"]').filter({ hasText: 'Agents are slow' });
    await expect(toast).toBeVisible({ timeout: 10_000 });

    // Release the outage-mode lock so recordSuccess inside forceRecoveryBroadcast
    // can take effect (force-outage(true) flipped outageModeActive=true).
    await forceOutage(page, false);

    // Capture T1 right before the recovery trigger, T2 right after the assertion
    // settles, log the delta for the LLMUX-03 evidence trail.
    const t1 = Date.now();
    await forceRecovery(page);
    await expect(toast).not.toBeVisible({ timeout: 5_000 });
    const t2 = Date.now();
    // eslint-disable-next-line no-console
    console.log(`[LLMUX-03] toast-dismiss latency: ${t2 - t1}ms (budget < 5000ms)`);
  });

  // -------------------------------------------------------------------------
  // Cleanup — every test gets a clean slate. Idempotent.
  // -------------------------------------------------------------------------
  test.afterEach(async ({ page }) => {
    // Belt-and-suspenders: release any forced outage and clear counters so
    // subsequent test runs / projects start clean.
    await page.request.post('/api/dev/force-outage', {
      data: { enabled: false },
      headers: { 'content-type': 'application/json' },
    }).catch(() => {
      // If the server is mid-restart or the route never registered, just swallow —
      // afterEach should never break the suite.
    });
    await page.request.post('/api/dev/reset-provider-state').catch(() => {});
  });
});
