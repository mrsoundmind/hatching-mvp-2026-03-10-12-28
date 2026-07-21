/**
 * Live visual verification of the 2026-07-20 sidebar remediation.
 * Drives the real authenticated UI in Chromium and captures the Activity tab
 * (stats + time range), the Tree view, the Tasks board, and a narrow viewport.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const jar = readFileSync('.audit-2026-07-17/cookies.txt', 'utf8');
const line = jar.split('\n').find((l) => l.includes('connect.sid'));
if (!line) { console.error('no connect.sid in cookie jar'); process.exit(1); }
const sid = line.split('\t').pop().trim();

const OUT = '.audit-2026-07-17/screenshots';
const browser = await chromium.launch();

async function openApp(width, height) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  await ctx.addCookies([{ name: 'connect.sid', value: sid, domain: 'localhost', path: '/', httpOnly: true }]);
  const page = await ctx.newPage();
  await page.goto('http://localhost:5001/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  for (let i = 0; i < 4; i++) {
    if ((await page.locator('div[data-state="open"][aria-hidden="true"]').count()) === 0) break;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(700);
  }
  const proj = page.getByText('AI Recipe App', { exact: true }).first();
  if (await proj.count()) { await proj.click({ timeout: 15000 }).catch(() => {}); await page.waitForTimeout(2500); }
  return page;
}

// ---------- Desktop ----------
const page = await openApp(1440, 900);

const activity = page.getByTestId('sidebar-tab-activity');
if (await activity.count()) { await activity.click(); await page.waitForTimeout(2000); }
await page.screenshot({ path: `${OUT}/after-activity.png` });

// Controls + feed shape
const tr = page.getByTestId('activity-time-range');
if (await tr.count()) console.log('time control value:', await tr.inputValue());
const vm = await page.getByTestId('view-mode-flat').innerText().catch(()=>'?');
const vt = await page.getByTestId('view-mode-tree').innerText().catch(()=>'?');
console.log('view toggle labels:', vm, '/', vt);
console.log('SYSTEM badges on screen:', await page.getByText('SYSTEM', { exact: true }).count());
const firstRows = await page.locator('.premium-card').filter({ hasText: /Finished|Started|Handed|approval/ }).count();
console.log('signal cards:', firstRows);

// ---------- Tree ----------
const tree = page.getByText('Tree', { exact: true }).first();
if (await tree.count()) {
  await tree.click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/after-tree.png` });
  console.log('run cards:', await page.locator('[data-testid^="run-card-"]').count());
  const first = page.locator('[data-testid^="run-card-"]').first();
  if (await first.count()) console.log('FIRST CARD:', JSON.stringify((await first.innerText()).replace(/\n/g, ' | ').slice(0, 260)));
}

// ---------- Tasks tab ----------
const tasksTab = page.getByTestId('sidebar-tab-tasks');
if (await tasksTab.count()) {
  await tasksTab.click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/after-tasks.png` });
  const completedVisible = await page.getByText('Completed', { exact: true }).count();
  console.log('Tasks: Completed section present =', completedVisible > 0);
}
await page.context().close();

// ---------- Narrow desktop (responsiveness) ----------
const narrow = await openApp(1280, 800);
const act2 = narrow.getByTestId('sidebar-tab-activity');
if (await act2.count()) { await act2.click(); await narrow.waitForTimeout(1500); }
await narrow.screenshot({ path: `${OUT}/after-narrow-1280.png` });
const aside = narrow.locator('aside').last();
if (await aside.count()) {
  const box = await aside.boundingBox();
  console.log('sidebar width @1280:', box && Math.round(box.width));
}
// horizontal overflow check
const overflow = await narrow.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
console.log('page overflows horizontally @1280:', overflow);
await narrow.context().close();

await browser.close();
console.log('screenshots ->', OUT);
