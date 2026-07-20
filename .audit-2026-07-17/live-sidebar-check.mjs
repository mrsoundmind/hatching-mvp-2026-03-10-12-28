/**
 * Live visual verification of the 2026-07-20 sidebar backend fixes.
 * Drives the real authenticated UI in Chromium and captures the Activity tab
 * (stats card + feed), the Tree view, and the Tasks filter.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';

// Pull the session cookie out of the curl jar without ever printing it.
const jar = readFileSync('.audit-2026-07-17/cookies.txt', 'utf8');
const line = jar.split('\n').find((l) => l.includes('connect.sid'));
if (!line) { console.error('no connect.sid in cookie jar'); process.exit(1); }
const sid = line.split('\t').pop().trim();

const OUT = '.audit-2026-07-17/screenshots';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: 'connect.sid', value: sid, domain: 'localhost', path: '/', httpOnly: true }]);
const page = await ctx.newPage();

await page.goto('http://localhost:5001/', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

// Dismiss any onboarding/welcome dialog that blocks pointer events
for (let i = 0; i < 4; i++) {
  const overlay = page.locator('div[data-state="open"][aria-hidden="true"]');
  if ((await overlay.count()) === 0) break;
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
}
console.log('overlays remaining:', await page.locator('div[data-state="open"][aria-hidden="true"]').count());

// Select the AI Recipe App project
const proj = page.getByText('AI Recipe App', { exact: true }).first();
if (await proj.count()) { await proj.click({ timeout: 15000 }).catch(() => {}); await page.waitForTimeout(2500); }

console.log('URL:', page.url());

// --- Activity tab: stats card + feed ---
const activity = page.getByRole('button', { name: /^ACTIVITY$/i }).first();
if (await activity.count()) { await activity.click(); await page.waitForTimeout(2000); }
await page.screenshot({ path: `${OUT}/live-activity-stats.png`, fullPage: false });

// Read the two stat numbers as rendered
const statText = await page.locator('text=/tasks done/i').first().locator('..').innerText().catch(() => 'n/a');
console.log('STATS CARD (tasks done):', JSON.stringify(statText));
const handoffText = await page.locator('text=/handoffs/i').first().locator('..').innerText().catch(() => 'n/a');
console.log('STATS CARD (handoffs):', JSON.stringify(handoffText));

// --- Tree view ---
const tree = page.getByText('Tree', { exact: true }).first();
if (await tree.count()) {
  await tree.click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/live-tree.png`, fullPage: false });
  const runCards = await page.locator('[data-testid^="run-card-"]').count();
  console.log('TREE run cards rendered:', runCards);
  const emptyTree = await page.getByText('No autonomous runs yet').count();
  console.log('TREE empty-state visible:', emptyTree > 0);
}

// --- back to Flat, filter to Tasks ---
const flat = page.getByText('Flat', { exact: true }).first();
if (await flat.count()) { await flat.click(); await page.waitForTimeout(1500); }

await browser.close();
console.log('screenshots written to', OUT);
