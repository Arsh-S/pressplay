import { chromium } from 'playwright';
import type { VideoConfig } from './video.js';

export interface DOMSnapshot {
  url: string;
  title: string;
  elements: string;
}

/**
 * Extract a compact, LLM-friendly snapshot of interactive elements on the page.
 * Returns text, role, selector hints for buttons, inputs, links, and other
 * interactive elements — giving the LLM real selectors to work with.
 */
const SNAPSHOT_SCRIPT = `
(() => {
  const results = [];
  const seen = new Set();

  function getSelector(el) {
    if (el.getAttribute('data-testid')) return '[data-testid="' + el.getAttribute('data-testid') + '"]';
    if (el.id) return '#' + el.id;
    if (el.getAttribute('placeholder')) return el.tagName.toLowerCase() + '[placeholder="' + el.getAttribute('placeholder') + '"]';
    if (el.getAttribute('aria-label')) return '[aria-label="' + el.getAttribute('aria-label') + '"]';
    const text = el.textContent?.trim();
    if (text && text.length < 50 && text.length > 0) return 'text=' + text;
    return null;
  }

  function getContext(el) {
    // Check if inside a dialog/modal
    const dialog = el.closest('[role="dialog"]');
    if (dialog) return '[role="dialog"]';
    const modal = el.closest('[class*="modal"]');
    if (modal) return '[class*="modal"]';
    return null;
  }

  // Interactive elements
  const selectors = 'button, a[href], input, textarea, select, [role="button"], [role="tab"], [role="menuitem"], [role="checkbox"], [role="switch"], [onclick]';

  for (const el of document.querySelectorAll(selectors)) {
    const rect = el.getBoundingClientRect();
    // Skip invisible/off-screen elements
    if (rect.width === 0 || rect.height === 0) continue;
    if (rect.top > window.innerHeight * 2) continue;
    // Check computed visibility
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;

    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute('role') || '';
    const type = el.getAttribute('type') || '';
    const text = el.textContent?.trim().slice(0, 60) || '';
    const placeholder = el.getAttribute('placeholder') || '';
    const ariaLabel = el.getAttribute('aria-label') || '';
    const disabled = el.hasAttribute('disabled') ? ' [disabled]' : '';
    const selector = getSelector(el);
    const context = getContext(el);

    const key = (selector || '') + text;
    if (seen.has(key)) continue;
    seen.add(key);

    let desc = tag;
    if (role) desc += '[role=' + role + ']';
    if (type) desc += '[type=' + type + ']';
    if (text) desc += ' "' + text + '"';
    if (placeholder) desc += ' placeholder="' + placeholder + '"';
    if (ariaLabel && ariaLabel !== text) desc += ' aria-label="' + ariaLabel + '"';
    desc += disabled;
    if (selector) desc += ' → ' + selector;
    if (context) desc += ' (inside ' + context + ')';
    // Mark if element is in viewport or below
    if (rect.top > window.innerHeight) desc += ' [below viewport — Playwright auto-scrolls to it]';

    results.push(desc);
  }

  // Visible headings for page structure context
  for (const h of document.querySelectorAll('h1, h2, h3')) {
    const rect = h.getBoundingClientRect();
    const style = window.getComputedStyle(h);
    if (rect.width === 0 || rect.height === 0) continue;
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    const text = h.textContent?.trim();
    if (text) results.push(h.tagName.toLowerCase() + ' "' + text.slice(0, 80) + '"');
  }

  return results.join('\\n');
})()
`;

/**
 * Navigate to a URL and capture a DOM snapshot of interactive elements.
 * Used to give the LLM real selectors instead of guessing from diffs.
 */
export async function inspectPage(
  url: string,
  config: VideoConfig,
): Promise<DOMSnapshot> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: config.viewport,
    ...(config.storageState ? { storageState: config.storageState } : {}),
  });
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1500); // Wait for hydration + async content

    const title = await page.title();
    const elements = await page.evaluate(SNAPSHOT_SCRIPT) as string;

    return { url, title, elements };
  } finally {
    await context.close();
    await browser.close();
  }
}
