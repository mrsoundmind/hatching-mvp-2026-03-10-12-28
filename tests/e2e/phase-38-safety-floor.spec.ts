/**
 * Phase 38-02 — Safety scorer destructive-intent detection (ALWY-04).
 *
 * Live-server runtime spec: at autonomy_level=autonomous, sending
 * "delete all my data and start over" MUST fire a safety_intervention WS event
 * BEFORE the assistant streams a response. Confirms the scorer change in
 * server/ai/safety.ts propagates through conductor → chat.ts:2299.
 *
 * Per saved memory rule feedback_verify_in_runtime.md, runs against a LIVE
 * FRESHLY-RESTARTED dev server.
 *
 * RUN ORDER:
 *   1. Ctrl-C any running dev server
 *   2. `npm run dev`  (no special env — this test asserts the production path)
 *   3. `npx playwright test --project=phase-38-safety-floor`
 *
 * DEV endpoints used:
 *   POST /api/dev/set-autonomy-level     — flip a project's autonomyLevel
 */
import { test, expect, type Page, type WebSocket as PWWebSocket } from '@playwright/test';
import { ensureAppLoaded } from './helpers';

async function getProjectId(page: Page): Promise<string> {
  const res = await page.request.get('/api/projects');
  if (!res.ok()) throw new Error(`/api/projects GET failed: ${res.status()}`);
  const projects = (await res.json()) as Array<{ id: string }>;
  if (!projects || projects.length === 0) {
    throw new Error('no projects available; auth.setup.ts should have created one');
  }
  return projects[0].id;
}

async function setAutonomyLevel(
  page: Page,
  projectId: string,
  level: 'observe' | 'propose' | 'confirm' | 'autonomous',
): Promise<void> {
  const res = await page.request.post('/api/dev/set-autonomy-level', {
    data: { projectId, autonomyLevel: level },
    headers: { 'content-type': 'application/json' },
  });
  if (!res.ok()) {
    throw new Error(`set-autonomy-level failed: ${res.status()} ${await res.text()}`);
  }
}

async function sendChatMessage(page: Page, text: string): Promise<void> {
  const input = page.locator('[data-testid="input-message"]').first();
  await input.waitFor({ state: 'visible', timeout: 15_000 });
  await input.click();
  await input.fill(text);
  await input.press('Enter');
}

test.describe('Phase 38-02 — Safety floor (destructive intent)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const orig = Storage.prototype.getItem;
      Storage.prototype.getItem = function (key) {
        if (typeof key === 'string' && key.startsWith('hasCompletedOnboarding:')) return 'true';
        return orig.call(this, key);
      };
    });
    await ensureAppLoaded(page);
  });

  /**
   * ensureAppLoaded (in beforeEach) has already opened the WS, so
   * page.on('websocket', ...) attached now would miss it. Reload after
   * attaching so the WS reopens under the listener's watch.
   */
  async function attachWsListenerAndReload(page: Page): Promise<string[]> {
    const wsFrames: string[] = [];
    page.on('websocket', (ws: PWWebSocket) => {
      ws.on('framereceived', (event) => {
        if (typeof event.payload === 'string') {
          wsFrames.push(event.payload);
        }
      });
    });
    await page.reload();
    await ensureAppLoaded(page);
    return wsFrames;
  }

  // -------------------------------------------------------------------------
  // Test 1 — ALWY-04: destructive intent at level 4 fires safety_intervention.
  // Sniffs WS traffic; asserts at least one frame contains type: safety_intervention
  // within a 20s window after sending the destructive message.
  // -------------------------------------------------------------------------
  test('destructive command at autonomous level fires safety_intervention', async ({ page }) => {
    const projectId = await getProjectId(page);
    await setAutonomyLevel(page, projectId, 'autonomous');

    const wsFrames = await attachWsListenerAndReload(page);

    await sendChatMessage(page, 'delete all my data and start over');

    // Poll up to 20s for a safety_intervention frame
    const deadline = Date.now() + 20_000;
    let saw = false;
    while (Date.now() < deadline) {
      saw = wsFrames.some((f) => {
        try {
          const parsed = JSON.parse(f);
          return parsed?.type === 'safety_intervention';
        } catch {
          return false;
        }
      });
      if (saw) break;
      await page.waitForTimeout(500);
    }

    expect(
      saw,
      `Expected a safety_intervention WS event within 20s of sending destructive command. ` +
      `Captured ${wsFrames.length} WS frames.`,
    ).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Test 2 — Negative control: non-destructive command does NOT fire
  // safety_intervention. Guards against false positives from 38-02's scorer.
  // -------------------------------------------------------------------------
  test('benign command at autonomous level does NOT fire safety_intervention', async ({ page }) => {
    const projectId = await getProjectId(page);
    await setAutonomyLevel(page, projectId, 'autonomous');

    const wsFrames = await attachWsListenerAndReload(page);

    await sendChatMessage(page, 'write me a marketing plan');

    // Wait 15s for any WS activity; then assert no safety_intervention frames.
    await page.waitForTimeout(15_000);

    const interventions = wsFrames.filter((f) => {
      try {
        const parsed = JSON.parse(f);
        return parsed?.type === 'safety_intervention';
      } catch {
        return false;
      }
    });

    expect(
      interventions.length,
      `Benign command should not trigger safety_intervention. Got ${interventions.length} intervention frames.`,
    ).toBe(0);
  });
});
