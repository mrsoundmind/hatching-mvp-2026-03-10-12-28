import { test } from "@playwright/test";
import { writeFileSync } from "fs";
const BASE = "http://localhost:5001";
test("perf", async ({ page }) => {
  test.setTimeout(150000);
  const reqs: { ms: number; status: number }[] = [];
  page.on("response", (r) => {
    if (r.url().includes("dicebear")) {
      const t = r.request().timing();
      reqs.push({ ms: Math.round(t.responseEnd - t.startTime), status: r.status() });
    }
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/v3`, { waitUntil: "domcontentloaded" });
  for (const id of ["overview","jobs","how-it-works","knowledge","inside","start","close"]) {
    await page.locator(`#${id}`).scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200);
  }
  await page.waitForTimeout(2500);
  const imgs = await page.locator('img[src*="dicebear"]').count();
  const unique = new Set(await page.locator('img[src*="dicebear"]').evaluateAll((els) => els.map((e) => (e as HTMLImageElement).src)));
  const summary = {
    imgTags: imgs,
    uniqueUrls: unique.size,
    networkRequests: reqs.length,
    slowerThan400ms: reqs.filter((r) => r.ms > 400).length,
    nonOk: reqs.filter((r) => r.status >= 400).length,
    maxMs: reqs.length ? Math.max(...reqs.map((r) => r.ms)) : 0,
  };
  console.log("PERF " + JSON.stringify(summary));
  writeFileSync("/private/tmp/claude-501/-Users-shashankrai-Documents-hatching-mvp-5th-march/545eebef-0b15-4604-8461-d16034626742/scratchpad/perf.json", JSON.stringify(summary));
});
