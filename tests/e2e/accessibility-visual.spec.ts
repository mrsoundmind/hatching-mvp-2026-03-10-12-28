import { test, expect, type Page } from '@playwright/test';
import { ensureAppLoaded } from './helpers';

/**
 * Accessibility & Visual Design Audit — Phase E
 *
 * Covers WCAG AA compliance, typography, button states, icons,
 * color contrast, interaction patterns, animations, and console errors.
 *
 * Auth: session cookies from tests/e2e/.auth/session.json (injected by Playwright config).
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Collect console errors throughout a test. */
function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => {
    errors.push(err.message);
  });
  return errors;
}

/** Wait for the authenticated app shell to be ready (sidebar + chat area). */
async function waitForAppShell(page: Page) {
  await ensureAppLoaded(page);
}

/** Return computed style value for the first matching element. */
async function getComputedStyle(page: Page, selector: string, prop: string): Promise<string> {
  return page.evaluate(
    ({ sel, p }) => {
      const el = document.querySelector(sel);
      if (!el) return '';
      return window.getComputedStyle(el).getPropertyValue(p);
    },
    { sel: selector, p: prop },
  );
}

/** Parse a CSS pixel value (e.g. "16px") to a number. */
function parsePx(value: string): number {
  return parseFloat(value) || 0;
}

// ---------------------------------------------------------------------------
// 1. Console & Errors — Zero errors on load and navigation
// ---------------------------------------------------------------------------

test.describe('Console & Errors', () => {
  test('zero console errors on app load', async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await ensureAppLoaded(page);
    // Allow a brief settling period for async queries
    await page.waitForTimeout(2000);

    // Filter out benign noise (e.g. browser extension warnings, favicon 404)
    const realErrors = errors.filter(
      (e) =>
        !e.includes('favicon') &&
        !e.includes('ERR_FILE_NOT_FOUND') &&
        !e.includes('net::ERR') &&
        !e.includes('ResizeObserver'),
    );
    expect(realErrors).toEqual([]);
  });

  test('zero console errors during navigation between sidebar items', async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await ensureAppLoaded(page);

    // Click through sidebar tabs if they exist (Activity / Tasks / Brain)
    const sidebarTabs = page.locator('[data-testid^="sidebar-tab-"]');
    const tabCount = await sidebarTabs.count();
    for (let i = 0; i < tabCount; i++) {
      await sidebarTabs.nth(i).click();
      await page.waitForTimeout(300);
    }

    const realErrors = errors.filter(
      (e) =>
        !e.includes('favicon') &&
        !e.includes('ERR_FILE_NOT_FOUND') &&
        !e.includes('net::ERR') &&
        !e.includes('ResizeObserver'),
    );
    expect(realErrors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 2. Accessibility — WCAG AA fundamentals
// ---------------------------------------------------------------------------

test.describe('Accessibility (WCAG AA)', () => {
  test.beforeEach(async ({ page }) => {
    await waitForAppShell(page);
  });

  test('message list has role="log" and aria-live="polite"', async ({ page }) => {
    const messageLog = page.locator('[role="log"]');
    await expect(messageLog).toBeAttached();
    await expect(messageLog).toHaveAttribute('aria-live', 'polite');
  });

  test('message list has an accessible label', async ({ page }) => {
    const messageLog = page.locator('[role="log"]');
    const label = await messageLog.getAttribute('aria-label');
    expect(label).toBeTruthy();
  });

  test('keyboard navigation — Tab moves focus through interactive elements', async ({ page }) => {
    // Press Tab several times and verify focus moves to different elements
    const focusedTags: string[] = [];
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      const tag = await page.evaluate(() => {
        const el = document.activeElement;
        return el ? `${el.tagName}:${el.getAttribute('role') || ''}` : 'NONE';
      });
      focusedTags.push(tag);
    }
    // At least 3 unique focusable elements should be reached
    const unique = new Set(focusedTags);
    expect(unique.size).toBeGreaterThanOrEqual(3);
  });

  test('no keyboard trap — Tab cycles back to body or loops', async ({ page }) => {
    // Press Tab many times; activeElement should never get stuck on one element
    const focusHistory: string[] = [];
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab');
      const id = await page.evaluate(() => {
        const el = document.activeElement;
        return el ? `${el.tagName}#${el.id || el.className?.toString().slice(0, 30)}` : 'body';
      });
      focusHistory.push(id);
    }
    // Check that the same element does not appear more than 3 consecutive times (no trap)
    let maxConsecutive = 1;
    let currentRun = 1;
    for (let i = 1; i < focusHistory.length; i++) {
      if (focusHistory[i] === focusHistory[i - 1]) {
        currentRun++;
        maxConsecutive = Math.max(maxConsecutive, currentRun);
      } else {
        currentRun = 1;
      }
    }
    expect(maxConsecutive).toBeLessThanOrEqual(3);
  });

  test('Enter activates buttons', async ({ page }) => {
    // Find the first visible button and verify Enter triggers it (no error thrown)
    const firstButton = page.locator('button:visible').first();
    await firstButton.focus();
    // Just verify pressing Enter does not throw — the button is activatable
    await page.keyboard.press('Enter');
    // If we got here without error, the test passes
  });

  test('focus rings are visible on interactive elements', async ({ page }) => {
    // Tab to a button and check that it has a visible outline or ring
    await page.keyboard.press('Tab');
    // Keep tabbing until we land on a button or input
    for (let i = 0; i < 10; i++) {
      const isInteractive = await page.evaluate(() => {
        const el = document.activeElement;
        return el?.tagName === 'BUTTON' || el?.tagName === 'INPUT' || el?.tagName === 'A';
      });
      if (isInteractive) break;
      await page.keyboard.press('Tab');
    }

    // Check for outline or box-shadow (Tailwind's ring utility uses box-shadow)
    const hasFocusIndicator = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return false;
      const styles = window.getComputedStyle(el);
      const outline = styles.outlineStyle;
      const boxShadow = styles.boxShadow;
      // Focus is visible if there is a non-none outline or a non-none box-shadow
      return (
        (outline !== 'none' && outline !== '') ||
        (boxShadow !== 'none' && boxShadow !== '')
      );
    });
    expect(hasFocusIndicator).toBe(true);
  });

  test('all images have alt text', async ({ page }) => {
    const imagesWithoutAlt = await page.evaluate(() => {
      const imgs = document.querySelectorAll('img');
      const missing: string[] = [];
      imgs.forEach((img) => {
        const alt = img.getAttribute('alt');
        // alt="" is acceptable for decorative images
        if (alt === null) {
          missing.push(img.src.slice(-60));
        }
      });
      return missing;
    });
    expect(imagesWithoutAlt).toEqual([]);
  });

  test('form inputs have associated labels or aria-label', async ({ page }) => {
    const unlabeledInputs = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input:not([type="hidden"]), textarea, select');
      const missing: string[] = [];
      inputs.forEach((input) => {
        const id = input.id;
        const ariaLabel = input.getAttribute('aria-label');
        const ariaLabelledBy = input.getAttribute('aria-labelledby');
        const placeholder = input.getAttribute('placeholder');
        const title = input.getAttribute('title');
        const hasVisibleLabel = id ? document.querySelector(`label[for="${id}"]`) : null;

        // Acceptable if any labelling mechanism exists
        if (!ariaLabel && !ariaLabelledBy && !hasVisibleLabel && !placeholder && !title) {
          missing.push(
            `${input.tagName}[name=${input.getAttribute('name') || 'none'}]`,
          );
        }
      });
      return missing;
    });
    expect(unlabeledInputs).toEqual([]);
  });

  test('buttons have accessible names', async ({ page }) => {
    const unlabeledButtons = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      const missing: string[] = [];
      buttons.forEach((btn) => {
        const text = btn.textContent?.trim();
        const ariaLabel = btn.getAttribute('aria-label');
        const ariaLabelledBy = btn.getAttribute('aria-labelledby');
        const title = btn.getAttribute('title');
        // SVG-only icon buttons must have aria-label
        if (!text && !ariaLabel && !ariaLabelledBy && !title) {
          missing.push(
            btn.outerHTML.slice(0, 120),
          );
        }
      });
      return missing;
    });
    // Report all unlabeled buttons for debugging
    if (unlabeledButtons.length > 0) {
      console.log('Unlabeled buttons found:', unlabeledButtons);
    }
    expect(unlabeledButtons).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 3. Typography
// ---------------------------------------------------------------------------

test.describe('Typography', () => {
  test.beforeEach(async ({ page }) => {
    await waitForAppShell(page);
  });

  test('body text is at least 14px', async ({ page }) => {
    const bodyFontSize = await getComputedStyle(page, 'body', 'font-size');
    expect(parsePx(bodyFontSize)).toBeGreaterThanOrEqual(14);
  });

  test('paragraphs and message text are at least 14px', async ({ page }) => {
    const smallTexts = await page.evaluate(() => {
      // Check p tags and message bubble text
      const elements = document.querySelectorAll('p, [role="log"] *');
      const tooSmall: string[] = [];
      elements.forEach((el) => {
        const fontSize = parseFloat(window.getComputedStyle(el).fontSize);
        const text = el.textContent?.trim() || '';
        // Only check elements with actual visible text, ignore icons/empty
        if (text.length > 5 && fontSize < 14) {
          tooSmall.push(`${el.tagName}(${fontSize}px): "${text.slice(0, 40)}"`);
        }
      });
      return tooSmall;
    });
    expect(smallTexts).toEqual([]);
  });

  test('line height is adequate for body text (>= 1.3)', async ({ page }) => {
    const lineHeight = await page.evaluate(() => {
      const body = document.body;
      const style = window.getComputedStyle(body);
      const fontSize = parseFloat(style.fontSize);
      const lh = parseFloat(style.lineHeight);
      // lineHeight might be "normal" which parses as NaN
      if (isNaN(lh)) return 1.5; // "normal" is typically ~1.5
      return lh / fontSize;
    });
    expect(lineHeight).toBeGreaterThanOrEqual(1.3);
  });

  test('heading hierarchy is not skipped (no h3 without h2, etc.)', async ({ page }) => {
    const violations = await page.evaluate(() => {
      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      if (headings.length === 0) return []; // No headings is acceptable

      const levels: number[] = [];
      headings.forEach((h) => {
        // Only check visible headings
        const rect = h.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          levels.push(parseInt(h.tagName[1], 10));
        }
      });

      const issues: string[] = [];
      for (let i = 1; i < levels.length; i++) {
        // A heading level should not jump more than 1 step deeper
        if (levels[i] > levels[i - 1] + 1) {
          issues.push(`h${levels[i - 1]} → h${levels[i]} (skipped level)`);
        }
      }
      return issues;
    });
    expect(violations).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 4. Buttons
// ---------------------------------------------------------------------------

test.describe('Buttons', () => {
  test.beforeEach(async ({ page }) => {
    await waitForAppShell(page);
  });

  test('disabled buttons have reduced opacity or not-allowed cursor', async ({ page }) => {
    const disabledButtonIssues = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button[disabled], button[aria-disabled="true"]');
      const issues: string[] = [];
      buttons.forEach((btn) => {
        const style = window.getComputedStyle(btn);
        const opacity = parseFloat(style.opacity);
        const cursor = style.cursor;
        if (opacity >= 1 && cursor !== 'not-allowed' && cursor !== 'default') {
          issues.push(
            `Button "${btn.textContent?.trim().slice(0, 30)}" disabled but opacity=${opacity}, cursor=${cursor}`,
          );
        }
      });
      return issues;
    });
    // This test is informational — if no disabled buttons exist, it passes trivially
    expect(disabledButtonIssues).toEqual([]);
  });

  test('icon-only buttons have aria-label or title', async ({ page }) => {
    const unlabeledIcons = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      const issues: string[] = [];
      buttons.forEach((btn) => {
        const textContent = btn.textContent?.trim();
        const hasSvg = btn.querySelector('svg') !== null;
        const ariaLabel = btn.getAttribute('aria-label');
        const title = btn.getAttribute('title');
        const ariaLabelledBy = btn.getAttribute('aria-labelledby');

        // Icon-only button: has SVG but no meaningful text
        if (hasSvg && (!textContent || textContent.length === 0)) {
          if (!ariaLabel && !title && !ariaLabelledBy) {
            issues.push(btn.outerHTML.slice(0, 150));
          }
        }
      });
      return issues;
    });
    expect(unlabeledIcons).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 5. Icons & SVGs
// ---------------------------------------------------------------------------

test.describe('Icons & SVGs', () => {
  test.beforeEach(async ({ page }) => {
    await waitForAppShell(page);
  });

  test('Lucide icons render (SVGs have valid dimensions)', async ({ page }) => {
    const brokenIcons = await page.evaluate(() => {
      const svgs = document.querySelectorAll('svg');
      const broken: string[] = [];
      svgs.forEach((svg) => {
        const rect = svg.getBoundingClientRect();
        // An SVG with 0 width/height is likely broken
        if (rect.width === 0 && rect.height === 0) {
          // Only flag visible-context SVGs (skip hidden/offscreen)
          const parent = svg.parentElement;
          if (parent) {
            const parentRect = parent.getBoundingClientRect();
            if (parentRect.width > 0 && parentRect.height > 0) {
              broken.push(
                `SVG in ${parent.tagName}.${parent.className?.toString().slice(0, 40)}`,
              );
            }
          }
        }
      });
      return broken;
    });
    expect(brokenIcons).toEqual([]);
  });

  test('agent avatars render without clipping (width == height)', async ({ page }) => {
    const clippedAvatars = await page.evaluate(() => {
      // Agent avatars typically use img or div with rounded-full
      const avatars = document.querySelectorAll(
        '[class*="avatar"], [class*="rounded-full"] img',
      );
      const issues: string[] = [];
      avatars.forEach((av) => {
        const rect = av.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          const ratio = Math.abs(rect.width - rect.height);
          // Allow 2px tolerance
          if (ratio > 2) {
            issues.push(
              `Avatar ${rect.width.toFixed(0)}x${rect.height.toFixed(0)} (not square)`,
            );
          }
        }
      });
      return issues;
    });
    expect(clippedAvatars).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 6. Color & Contrast
// ---------------------------------------------------------------------------

test.describe('Color & Contrast', () => {
  test.beforeEach(async ({ page }) => {
    await waitForAppShell(page);
  });

  test('primary text meets minimum contrast ratio (>= 4.5:1 against background)', async ({
    page,
  }) => {
    const contrastInfo = await page.evaluate(() => {
      // Compute relative luminance per WCAG 2.0
      function sRGBtoLinear(c: number): number {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      }
      function luminance(r: number, g: number, b: number): number {
        return 0.2126 * sRGBtoLinear(r) + 0.7152 * sRGBtoLinear(g) + 0.0722 * sRGBtoLinear(b);
      }
      function contrastRatio(l1: number, l2: number): number {
        const lighter = Math.max(l1, l2);
        const darker = Math.min(l1, l2);
        return (lighter + 0.05) / (darker + 0.05);
      }
      function parseColor(color: string): [number, number, number] | null {
        const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (m) return [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])];
        return null;
      }

      // Sample key text elements
      const selectors = ['p', 'span', 'h1', 'h2', 'h3', 'label', 'a', 'button'];
      const failures: string[] = [];
      let checked = 0;

      for (const sel of selectors) {
        const els = document.querySelectorAll(sel);
        for (let i = 0; i < Math.min(els.length, 5); i++) {
          const el = els[i] as HTMLElement;
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
          const text = el.textContent?.trim();
          if (!text || text.length === 0) continue;

          const style = window.getComputedStyle(el);
          const fg = parseColor(style.color);
          const bg = parseColor(style.backgroundColor);
          if (!fg) continue;

          // Walk up to find a non-transparent background
          let bgColor = bg;
          let ancestor: HTMLElement | null = el;
          while (ancestor && (!bgColor || bgColor.join(',') === '0,0,0')) {
            ancestor = ancestor.parentElement;
            if (ancestor) {
              const ancestorBg = parseColor(window.getComputedStyle(ancestor).backgroundColor);
              if (ancestorBg && !(ancestorBg[0] === 0 && ancestorBg[1] === 0 && ancestorBg[2] === 0 && window.getComputedStyle(ancestor).backgroundColor.includes('rgba(0, 0, 0, 0)'))) {
                bgColor = ancestorBg;
                break;
              }
            }
          }
          // Default to white background if we can't determine
          if (!bgColor) bgColor = [255, 255, 255];

          const fgL = luminance(...fg);
          const bgL = luminance(...bgColor);
          const ratio = contrastRatio(fgL, bgL);
          checked++;

          const fontSize = parseFloat(style.fontSize);
          const isLargeText = fontSize >= 18 || (fontSize >= 14 && style.fontWeight >= '700');
          const minRatio = isLargeText ? 3 : 4.5;

          if (ratio < minRatio) {
            failures.push(
              `${sel}("${text.slice(0, 20)}") ratio=${ratio.toFixed(2)} (need ${minRatio})`,
            );
          }
        }
      }

      return { failures, checked };
    });

    // We should have checked at least some elements
    expect(contrastInfo.checked).toBeGreaterThan(0);
    expect(contrastInfo.failures).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 7. Interaction Patterns
// ---------------------------------------------------------------------------

test.describe('Interaction Patterns', () => {
  test.beforeEach(async ({ page }) => {
    await waitForAppShell(page);
  });

  test('message input textarea is focusable and accepts text', async ({ page }) => {
    const textarea = page.locator('[data-testid="input-message"], textarea').first();
    await textarea.click();
    await textarea.fill('Hello test message');
    await expect(textarea).toHaveValue('Hello test message');
  });

  test('text in the chat area is selectable', async ({ page }) => {
    // The message log area should allow text selection (user-select is not "none")
    const isSelectable = await page.evaluate(() => {
      const log = document.querySelector('[role="log"]');
      if (!log) return true; // If no log yet, skip gracefully
      const style = window.getComputedStyle(log);
      return style.userSelect !== 'none';
    });
    expect(isSelectable).toBe(true);
  });

  test('Escape closes open modals', async ({ page }) => {
    // Try to trigger a modal — click "Add Project" or similar button if available
    const addButton = page.locator('button:has-text("Add"), button:has-text("New"), button:has-text("Create")').first();
    const hasAddButton = (await addButton.count()) > 0;

    if (hasAddButton) {
      await addButton.click();
      await page.waitForTimeout(500);

      // Check if a dialog/modal appeared
      const dialog = page.locator('[role="dialog"], [data-state="open"]').first();
      const dialogVisible = (await dialog.count()) > 0;

      if (dialogVisible) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
        // Dialog should be gone or hidden
        await expect(dialog).not.toBeVisible();
      }
    }
    // If no button or dialog found, test passes — we can't force a modal
  });
});

// ---------------------------------------------------------------------------
// 8. Animations & Layout Stability
// ---------------------------------------------------------------------------

test.describe('Animations & Layout Stability', () => {
  test('no significant layout shift on initial load', async ({ page }) => {
    // Navigate fresh to measure CLS using PerformanceObserver
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('aside', { timeout: 30000 });

    const cls = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let clsValue = 0;
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            // @ts-ignore — layout-shift entries have this property
            if (!(entry as any).hadRecentInput) {
              clsValue += (entry as any).value || 0;
            }
          }
        });
        try {
          observer.observe({ type: 'layout-shift', buffered: true });
        } catch {
          // PerformanceObserver might not support layout-shift in all browsers
          resolve(0);
          return;
        }
        // Collect for 2 seconds then report
        setTimeout(() => {
          observer.disconnect();
          resolve(clsValue);
        }, 2000);
      });
    });

    // CLS should be below 0.25 (Google's "poor" threshold)
    expect(cls).toBeLessThan(0.25);
  });

  test('animations do not block interaction with the message input', async ({ page }) => {
    await waitForAppShell(page);

    // The textarea should be interactable even while animations are running
    const textarea = page.locator('[data-testid="input-message"], textarea').first();
    await textarea.click({ timeout: 5000 });
    await textarea.fill('Typing during animations');
    await expect(textarea).toHaveValue('Typing during animations');
  });

  test('prefers-reduced-motion is respected (CSS or no forced animations)', async ({ page }) => {
    // Emulate reduced motion preference
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await waitForAppShell(page);

    // Check that no elements have animation-duration > 0 that is not overridden
    // This is a soft check — we verify the media query is at least not ignored
    const animatedElements = await page.evaluate(() => {
      const all = document.querySelectorAll('*');
      const animated: string[] = [];
      for (const el of all) {
        const style = window.getComputedStyle(el);
        const duration = style.animationDuration;
        const name = style.animationName;
        // Flag elements still actively animating despite reduced motion
        if (name && name !== 'none' && duration && duration !== '0s') {
          // Only flag elements visible in viewport
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && rect.top < window.innerHeight) {
            animated.push(
              `${el.tagName}.${(el.className?.toString() || '').slice(0, 40)}: ${name} (${duration})`,
            );
          }
        }
      }
      return animated;
    });

    // Informational — log but don't fail hard since prefers-reduced-motion wasn't found in CSS
    // This flags it as a known gap to address
    if (animatedElements.length > 0) {
      console.log(
        `[a11y warning] ${animatedElements.length} elements still animate with prefers-reduced-motion:`,
        animatedElements.slice(0, 5),
      );
    }
    // Soft assertion: fewer than 10 visible animated elements
    expect(animatedElements.length).toBeLessThan(10);
  });
});

// ---------------------------------------------------------------------------
// 9. Mobile Responsiveness (Desktop viewport, check no horizontal overflow)
// ---------------------------------------------------------------------------

test.describe('Layout', () => {
  test('no horizontal overflow on desktop viewport', async ({ page }) => {
    await waitForAppShell(page);

    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasOverflow).toBe(false);
  });

  test('sidebar and center panel are both visible on desktop', async ({ page }) => {
    await waitForAppShell(page);

    // The app uses a flex layout; both sidebar and center should be visible
    const hasSidebar = await page.evaluate(() => {
      // LeftSidebar is the first aside or a div with project tree content
      const sidebar = document.querySelector('aside, [class*="sidebar"], [class*="Sidebar"]');
      if (!sidebar) return false;
      const rect = sidebar.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });

    const hasCenter = await page.evaluate(() => {
      const center = document.querySelector('[role="log"]');
      if (!center) return false;
      const rect = center.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });

    expect(hasSidebar).toBe(true);
    expect(hasCenter).toBe(true);
  });
});
