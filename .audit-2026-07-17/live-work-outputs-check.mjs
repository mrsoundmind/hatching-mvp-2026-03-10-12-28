/**
 * Live check for Work Outputs attribution.
 * Opens the Tasks tab in the real authenticated UI and reports what each completed-work row
 * says: the agent name it shows, and whether the body is the real output or the task description.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const jar = readFileSync('.audit-2026-07-17/cookies.txt', 'utf8');
const line = jar.split('\n').find((l) => l.includes('connect.sid'));
if (!line) { console.error('no connect.sid in cookie jar'); process.exit(1); }
const sid = line.split('\t').pop().trim();

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
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

const tasksTab = page.getByTestId('sidebar-tab-tasks');
if (await tasksTab.count()) { await tasksTab.click(); await page.waitForTimeout(2500); }

// Scroll the Work Outputs heading into view
console.log('tasks tab selected:', await page.getByTestId('sidebar-tab-tasks').getAttribute('aria-selected'));
const allHeadings = page.getByText('Work Outputs', { exact: true });
console.log('Work Outputs matches in DOM:', await allHeadings.count());
const heading = allHeadings.filter({ visible: true }).first();
if (!(await heading.count())) {
  console.log('Work Outputs section NOT visible (no completed tasks rendered in the open tab)');
} else {
  await heading.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  const rows = page.locator('button').filter({ has: page.locator('svg') });
  const section = heading.locator('xpath=../..');
  const cards = section.locator('.premium-card');
  const n = await cards.count();
  console.log(`Work Outputs rows: ${n}`);
  for (let i = 0; i < Math.min(n, 8); i++) {
    const txt = (await cards.nth(i).innerText()).replace(/\n/g, ' | ').slice(0, 150);
    console.log(`  [${i}] ${txt}`);
  }
  console.log(`\n"Hatch" placeholders on screen: ${await page.getByText('Hatch —', { exact: false }).count()}`);

  // Open the seeded row and confirm the body is the real output, not the description
  const seeded = section.locator('.premium-card').filter({ hasText: 'Draft the launch announcement' }).first();
  if (await seeded.count()) {
    await seeded.locator('button').first().click();
    await page.waitForTimeout(1200);
    const body = (await seeded.innerText()).replace(/\n/g, ' ');
    console.log('\nExpanded seeded row body starts:', JSON.stringify(body.slice(0, 240)));
    console.log('contains real output? ', /opening Hatchin to everyone/.test(body));
    console.log('shows only the description? ', /Write a short launch post/.test(body) && !/opening Hatchin/.test(body));
  }
  await page.screenshot({ path: '.audit-2026-07-17/screenshots/after-work-outputs.png', fullPage: false });
}

await browser.close();
