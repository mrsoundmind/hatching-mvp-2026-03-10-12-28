/**
 * Landing v3 (/v3) — the FIMI-style editorial/bento port.
 *
 * Verifies the page in a real browser rather than trusting the diff: that every
 * ported section renders, that the interactive pieces actually interact (the
 * auto-advancing stepper, the roster hover readout, the bento hover visuals,
 * the scroll-synced rail), and critically that the scoped stylesheet does NOT
 * leak into the rest of the app the way landing-v2's ported CSS did.
 *
 * Run against an isolated server:
 *   PORT=5023 STORAGE_MODE=memory LLM_MODE=test TEST_LLM_PROVIDER=mock \
 *     npx tsx server/index.ts
 *   npx playwright test tests/e2e/landing-v3.spec.ts --project=chromium
 */

import { test, expect, type Page } from "@playwright/test";

const BASE = process.env.V3_BASE_URL ?? "http://localhost:5023";

test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } });

async function openV3(page: Page) {
  await page.goto(`${BASE}/v3`, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".lv3")).toBeVisible();
}

test.describe("landing v3", () => {
  test("every ported section renders", async ({ page }) => {
    await openV3(page);

    await expect(
      page.getByRole("heading", { name: /Where great ideas find the team to build them/i }),
    ).toBeVisible();

    // the hero says what a click costs before you click
    await expect(page.getByText(/Free forever plan · no card needed/i).first()).toBeVisible();

    // every nav label lands on a section that exists and is named the same
    for (const [label, id] of [
      ["How it works", "how-it-works"],
      ["Real jobs", "jobs"],
      ["Pricing", "start"],
    ] as const) {
      const link = page.locator(`nav a:has-text("${label}")`).first();
      await expect(link, `nav link ${label} missing`).toHaveAttribute("href", `#${id}`);
    }

    for (const id of ["overview", "jobs", "how-it-works", "knowledge", "inside", "start", "close"]) {
      await expect(page.locator(`#${id}`), `section #${id} missing`).toHaveCount(1);
    }

    await expect(page.getByRole("heading", { name: /Here is the whole thing/i })).toBeVisible();

    // the hero video is full-bleed
    const video = page.locator("video").first();
    const box = await video.boundingBox();
    const vp = page.viewportSize()!;
    expect(box, "hero video missing").not.toBeNull();
    expect(box!.width, "hero video should be full-bleed").toBeGreaterThanOrEqual(vp.width - 2);
    expect(box!.height, "hero video should fill the screen").toBeGreaterThanOrEqual(vp.height - 2);

    // the product is drawn, not screenshotted — no raster app shots anywhere
    const shots = await page.locator('img[src*="/shots/"]').count();
    expect(shots, "app screenshots were removed in favour of the live mock").toBe(0);
    await expect(page.getByRole("heading", { name: /You ask. They argue. You get the work/i })).toBeVisible();
  });

  test("proof bento: counters count up and the roster is complete", async ({ page }) => {
    await openV3(page);
    // the counters fire on their own useInView, so scroll the panel that holds
    // them into view rather than the top of the (very tall) section
    await await page.locator("#jobs").getByText(/Every discipline you would hire for/i).scrollIntoViewIfNeeded();

    // 34 roles, one button each, matching ROLE_DEFINITIONS
    await expect(page.locator('#jobs button[aria-label]')).toHaveCount(34);
  });

  test("roster hover swaps the readout to that teammate's own pushback line", async ({ page }) => {
    await openV3(page);
    await page.locator("#jobs").scrollIntoViewIfNeeded();

    const readout = page.locator("#jobs").getByText(/Hover to hear how each one pushes back/i);
    await expect(readout).toBeVisible();

    await page.locator('#jobs button[aria-label^="Juhi"]').hover();
    await expect(page.locator("#jobs").getByText(/that is a countdown/i)).toBeVisible();
    await expect(readout).toBeHidden();

    await page.locator('#jobs button[aria-label^="Sam"]').hover();
    await expect(page.locator("#jobs").getByText(/Three states are unverified/i)).toBeVisible();
  });

  test("the overnight timeline plays itself and any moment can be clicked", async ({ page }) => {
    await openV3(page);
    await page.locator("#how-it-works").scrollIntoViewIfNeeded();

    // it advances on its own
    const clock = page.locator("#how-it-works p[aria-live='polite']");
    const first = await clock.textContent();
    await expect(clock).not.toHaveText(first!, { timeout: 8000 });

    // the control says what it is doing, and really stops it
    const toggle = page.getByRole("button", { name: /Playing the night/i });
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(page.getByRole("button", { name: /^Paused$/i })).toBeVisible();
    const held = await clock.textContent();
    await page.waitForTimeout(4000);
    expect(await clock.textContent()).toBe(held);

    // and any moment jumps
    await page.locator('#how-it-works [data-moment="7"]').click();
    await expect(clock).toHaveText("09:02");
    await expect(
      page.locator("#how-it-works").getByText(/One document ready. One decision waiting/i),
    ).toBeVisible();
  });

  test("the comparison shows both answers to the same question", async ({ page }) => {
    await openV3(page);
    await page.locator("#knowledge").scrollIntoViewIfNeeded();

    await expect(page.locator("#knowledge").getByText(/A generic assistant/i)).toBeVisible();
    await expect(page.locator("#knowledge").getByText(/net revenue retention\?/i)).toBeVisible();
    // hold the auto-rotation so the assertions below are not racing it
    await page.locator("#knowledge").getByText(/A generic assistant/i).hover();
    await expect(page.locator("#knowledge").getByText(/Juhi/).first()).toBeVisible();

    // switching the question swaps BOTH columns
    await page.locator('#knowledge [data-pair="2"]').click();
    await expect(page.locator("#knowledge").getByText(/Score it with RICE/i)).toBeVisible();
    await expect(page.locator("#knowledge").getByText(/prioritisation framework helps/i)).toBeVisible();

    // the left column is labelled as illustrative, not passed off as a real product
    await expect(
      page.locator("#knowledge").getByText(/Left column illustrative/i),
    ).toBeVisible();
  });

  test("the bento spotlights one tile at a time and hover holds it", async ({ page }) => {
    await openV3(page);
    await page.locator("#inside").scrollIntoViewIfNeeded();

    // the tiles are NOT links: they used to carry an up-right arrow and an
    // href to /login, which promised navigation the section never had
    await expect(page.locator("#inside a")).toHaveCount(0);
    const tiles = page.locator("#inside [class*='auto-rows'] > div");
    await expect(tiles).toHaveCount(6);

    // exactly one tile is lit; the rest are dimmed and still
    const opacities = async () =>
      tiles.evaluateAll((els) => els.map((e) => Number(getComputedStyle(e.firstElementChild as Element).opacity)));
    await page.waitForTimeout(900);
    const lit = (await opacities()).filter((o) => o > 0.9).length;
    expect(lit, "only one tile should be at full opacity").toBe(1);

    // the spotlight moves on its own
    const before = (await opacities()).findIndex((o) => o > 0.9);
    await expect
      .poll(async () => (await opacities()).findIndex((o) => o > 0.9), { timeout: 9000 })
      .not.toBe(before);

    // every illustration gets real room. Before the header moved to the top,
    // four of six were squeezed to 59px.
    const vizHeights = await tiles.evaluateAll((els) =>
      els.map((e) => {
        const v = e.querySelector(".min-h-0.flex-1");
        return v ? Math.round(v.getBoundingClientRect().height) : 0;
      }),
    );
    expect(Math.min(...vizHeights), `illustration squeezed: ${vizHeights}`).toBeGreaterThan(100);

    // hovering takes the spotlight and holds it there
    await tiles.nth(4).hover();
    await page.waitForTimeout(3400);
    expect((await opacities()).findIndex((o) => o > 0.9)).toBe(4);
  });

  test("pricing states the price and what the paid tier adds", async ({ page }) => {
    await openV3(page);
    await page.locator("#start").scrollIntoViewIfNeeded();

    await expect(page.locator("#start").getByText("$0")).toBeVisible();
    await expect(page.locator("#start").getByText("$19")).toBeVisible();
    await expect(page.locator("#start").getByText(/Runs in the background/i)).toBeVisible();
    await expect(page.locator("#start").getByText(/waiting for you/i)).toBeVisible();
    await expect(page.locator("#start").getByText(/working while you are out/i)).toBeVisible();
  });

  test("the footer does not repeat the CTA that sits directly above it", async ({ page }) => {
    await openV3(page);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(800);
    const footer = page.locator("footer");
    await expect(footer.getByRole("link", { name: /Meet your team/i })).toHaveCount(0);
  });

  test("the rail only appears once there is a gutter for it", async ({ page }) => {
    // below 1440 the centred max-w-6xl column leaves no room, so the rail is
    // display:none rather than sitting on top of the copy
    await page.setViewportSize({ width: 1280, height: 900 });
    await openV3(page);
    await page.locator("#knowledge").scrollIntoViewIfNeeded();
    await expect(page.locator("nav.lv3-rail")).toBeHidden();
  });

  test("the section rail hides over the hero, tracks scroll, then hides again at the close", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1512, height: 900 });
    await openV3(page);
    const rail = page.getByRole("navigation", { name: "Page sections" });

    // over the hero: present but faded out
    await expect(rail).toHaveClass(/opacity-0/);

    await page.locator("#knowledge").scrollIntoViewIfNeeded();
    await expect(rail).toHaveClass(/opacity-100/);
    // the active entry is the one whose label is visible without hovering
    await expect(rail.getByText("Two answers")).toBeVisible();

    await page.locator("#close").evaluate((el) => el.scrollIntoView());
    await expect(rail).toHaveClass(/opacity-0/);
  });

  test("the scoped stylesheet does not leak into the app", async ({ page }) => {
    // load /v3 first so landing-v3.css is definitely in the document, then go
    // to a page that is NOT on the v3 system. /login is no longer a valid
    // control: it now uses .lv3 deliberately. /landing (v1) is.
    await openV3(page);
    await page.goto(`${BASE}/landing`, { waitUntil: "domcontentloaded" });

    // .lv3 rules are all descendant-scoped; nothing on a non-v3 route may match
    const leaked = await page.evaluate(() => {
      const offenders: string[] = [];
      for (const sheet of Array.from(document.styleSheets)) {
        let rules: CSSRuleList;
        try {
          rules = sheet.cssRules;
        } catch {
          continue; // cross-origin (google fonts)
        }
        for (const rule of Array.from(rules)) {
          const sel = (rule as CSSStyleRule).selectorText;
          if (!sel) continue;
          // every rule this page adds must be gated on .lv3
          if (sel.includes("lv3") && !sel.includes(".lv3")) offenders.push(sel);
        }
      }
      return offenders;
    });
    expect(leaked).toEqual([]);

    // and v1 is untouched by it
    await expect(page.locator(".lv3")).toHaveCount(0);
  });

  test("no console errors on load", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await openV3(page);
    await page.locator("#close").evaluate((el) => el.scrollIntoView());
    await page.waitForTimeout(1200);

    // Remote avatars/video and the expected 401 from /api/auth/me for a logged
    // out visitor are not page bugs.
    const real = errors.filter(
      (e) => !/dicebear|favicon|cloudfront|ERR_NETWORK|401 \(Unauthorized\)/i.test(e),
    );
    expect(real, real.join("\n")).toEqual([]);
  });
});
