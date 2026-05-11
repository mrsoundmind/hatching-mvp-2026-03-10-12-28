import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = '/tmp/screenshots-35-04';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

async function shot(path, name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  console.log(`  → ${OUT}/${name}.png`);
}

try {
  // 1. Landing page footer (scroll to bottom)
  console.log('[1/6] Landing page footer');
  await page.goto('http://localhost:5001/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(400);
  await shot('', '1-landing-footer');

  // 2. Modal opened from landing footer Privacy click
  console.log('[2/6] Modal opened from landing footer (Privacy)');
  const privacyLink = page.locator('a[href="/legal/privacy"]').first();
  await privacyLink.scrollIntoViewIfNeeded();
  await privacyLink.click();
  await page.waitForTimeout(600);
  await shot('', '2-modal-privacy-from-landing');

  // Close modal
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // 3. Modal opened from landing footer Terms click
  console.log('[3/6] Modal opened from landing footer (Terms)');
  const termsLink = page.locator('a[href="/legal/terms"]').first();
  await termsLink.click();
  await page.waitForTimeout(600);
  await shot('', '3-modal-terms-from-landing');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // 4. Standalone /legal/privacy deep-link
  console.log('[4/6] Standalone /legal/privacy deep-link');
  await page.goto('http://localhost:5001/legal/privacy', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await shot('', '4-standalone-privacy');

  // 5. Standalone /legal/terms deep-link
  console.log('[5/6] Standalone /legal/terms deep-link');
  await page.goto('http://localhost:5001/legal/terms', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await shot('', '5-standalone-terms');

  // 6. Modal opened from login footer
  console.log('[6/6] Modal opened from login footer (Privacy)');
  await page.goto('http://localhost:5001/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(300);
  const loginPrivacy = page.locator('a[href="/legal/privacy"]').first();
  await loginPrivacy.click();
  await page.waitForTimeout(600);
  await shot('', '6-modal-from-login');

  console.log('\nAll screenshots saved to', OUT);
} catch (e) {
  console.error('FAILED:', e.message);
  await shot('', 'error-state');
  process.exit(1);
} finally {
  await browser.close();
}
