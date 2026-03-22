import type { Page, Locator } from 'playwright';
import type { Step } from '../types.js';

const DEFAULT_TIMEOUT = 5000;
const STEP_DELAY = 150;

/**
 * Injects a macOS-style cursor into the page. Uses CSS transition for smooth
 * movement and tracks mouse position. Starts at center of viewport.
 */
const CURSOR_SCRIPT = `
(() => {
  if (document.getElementById('pressplay-cursor')) return;

  const cursor = document.createElement('div');
  cursor.id = 'pressplay-cursor';
  cursor.innerHTML = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 2L4 17.5L8.5 13L14 13L4 2Z" fill="black" stroke="white" stroke-width="1.2" stroke-linejoin="round"/></svg>';
  Object.assign(cursor.style, {
    position: 'fixed',
    zIndex: '999999',
    pointerEvents: 'none',
    left: (window.innerWidth / 2) + 'px',
    top: (window.innerHeight / 2) + 'px',
    transition: 'none',
    filter: 'drop-shadow(0px 1px 1px rgba(0,0,0,0.4))',
  });
  document.body.appendChild(cursor);

  document.addEventListener('mousemove', (e) => {
    cursor.style.left = e.clientX + 'px';
    cursor.style.top = e.clientY + 'px';
  });
})();
`;

/**
 * Fix selectors that mix CSS and Playwright text= syntax.
 * e.g. '[role="dialog"] text=Submit' -> '[role="dialog"] >> text=Submit'
 */
function fixSelector(selector: string): string {
  if (selector.includes('>>')) return selector;
  const textMatch = selector.match(/^(.+?)\s+(text=.+)$/);
  if (textMatch) return `${textMatch[1]} >> ${textMatch[2]}`;
  return selector;
}

/**
 * Smoothly move mouse to element center.
 * Uses fewer steps for speed but CSS transition on the cursor makes it look smooth.
 */
/**
 * Ease-in-out cubic: slow start, fast middle, slow end.
 */
function easeInOutCubic(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Move mouse to element with eased motion — starts slow, speeds up, slows down.
 * Uses manual interpolation since Playwright's steps param is linear only.
 */
async function moveToElement(page: Page, selector: string): Promise<void> {
  try {
    const locator = page.locator(selector).first();
    const box = await locator.boundingBox({ timeout: 2000 });
    if (!box) return;

    const targetX = box.x + box.width / 2;
    const targetY = box.y + box.height / 2;

    // Get current cursor position from the injected cursor element
    const current = await page.evaluate(`
      (() => {
        const el = document.getElementById('pressplay-cursor');
        if (el) return { x: parseFloat(el.style.left) || 640, y: parseFloat(el.style.top) || 360 };
        return { x: 640, y: 360 };
      })()
    `) as { x: number; y: number };

    const numSteps = 60;
    const delayMs = 8; // ~16ms per visible frame at 60fps, 8ms gives extra smoothness
    for (let i = 1; i <= numSteps; i++) {
      const t = easeInOutCubic(i / numSteps);
      const x = current.x + (targetX - current.x) * t;
      const y = current.y + (targetY - current.y) * t;
      await page.mouse.move(x, y);
      await page.waitForTimeout(delayMs);
    }
  } catch {
    // Best effort
  }
}

async function ensureCursor(page: Page): Promise<void> {
  try {
    await page.evaluate(CURSOR_SCRIPT);
  } catch {
    // Page might not be ready
  }
}

export async function executeStep(page: Page, step: Step): Promise<void> {
  const selector = step.selector ? fixSelector(step.selector) : undefined;

  switch (step.action) {
    case 'navigate':
      await page.goto(step.url!, { waitUntil: 'domcontentloaded', timeout: 15000 });
      // Brief wait for hydration then inject cursor
      await page.waitForTimeout(800);
      await ensureCursor(page);
      await page.mouse.move(640, 360, { steps: 1 });
      break;

    case 'click':
      await moveToElement(page, selector!);
      await page.locator(selector!).first().click({ timeout: DEFAULT_TIMEOUT });
      break;

    case 'fill':
      await moveToElement(page, selector!);
      // Click to focus the input first
      await page.locator(selector!).first().click({ timeout: DEFAULT_TIMEOUT });
      // Type character by character for a realistic typing animation
      await page.locator(selector!).first().pressSequentially(step.value!, { delay: 60 });
      break;

    case 'hover':
      await page.locator(selector!).first().hover({ timeout: DEFAULT_TIMEOUT });
      break;

    case 'scroll':
      await page.evaluate(
        (y: number) => {
          (globalThis as unknown as { scrollBy: (opts: { top: number; behavior: string }) => void })
            .scrollBy({ top: y, behavior: 'smooth' });
        },
        step.y ?? 0,
      );
      await page.waitForTimeout(400);
      break;

    case 'wait':
      // Cap LLM-requested waits — don't let them bloat the video
      await page.waitForTimeout(Math.min(step.ms ?? 500, 1500));
      break;

    case 'waitForSelector':
      await page.locator(selector!).first().waitFor({ state: 'visible', timeout: 10000 });
      break;

    case 'screenshot': {
      const safeName = (step.name ?? 'screenshot').replace(/[\/\\]/g, '_');
      await page.screenshot({ path: `screenshots/${safeName}.png` });
      break;
    }

    case 'press':
      await page.keyboard.press(step.key!);
      break;
  }
}

export async function executeSteps(
  page: Page,
  steps: Step[],
  onStepComplete?: (step: Step, index: number) => void,
): Promise<void> {
  await ensureCursor(page);
  // Position cursor at center immediately
  await page.mouse.move(640, 360, { steps: 1 });

  for (let i = 0; i < steps.length; i++) {
    await executeStep(page, steps[i]);
    onStepComplete?.(steps[i], i);
    await page.waitForTimeout(STEP_DELAY);
  }
}
