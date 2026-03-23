import type { Page } from 'playwright';
import type { Step } from '../types.js';

/**
 * Capture a compact DOM snapshot from a live page.
 * Used during adaptive execution to give the LLM fresh context
 * when a step fails (e.g. a modal opened with unexpected content).
 */
const LIVE_SNAPSHOT_SCRIPT = `
(() => {
  const results = [];
  const seen = new Set();

  function getSelector(el) {
    if (el.getAttribute('data-testid')) return '[data-testid="' + el.getAttribute('data-testid') + '"]';
    if (el.id && !el.id.startsWith('radix-')) return '#' + el.id;
    if (el.getAttribute('placeholder')) return el.tagName.toLowerCase() + '[placeholder="' + el.getAttribute('placeholder') + '"]';
    if (el.getAttribute('aria-label')) return '[aria-label="' + el.getAttribute('aria-label') + '"]';
    const text = el.textContent?.trim();
    if (text && text.length < 50 && text.length > 0) return 'text=' + text;
    return null;
  }

  function getContext(el) {
    const dialog = el.closest('[role="dialog"]');
    if (dialog) return '[role="dialog"]';
    return null;
  }

  const selectors = 'button, a[href], input, textarea, select, [role="button"], [role="tab"], [role="menuitem"], [role="checkbox"], [role="switch"]';
  for (const el of document.querySelectorAll(selectors)) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
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
    results.push(desc);
  }

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
 * Capture a live DOM snapshot from the current page state.
 */
export async function captureLiveSnapshot(page: Page): Promise<string> {
  try {
    return await page.evaluate(LIVE_SNAPSHOT_SCRIPT) as string;
  } catch {
    return '';
  }
}

export interface AdaptiveStep {
  step: Step;
  index: number;
  succeeded: boolean;
  error?: string;
}

/**
 * Build the "continuation prompt" when a step fails.
 * Gives the LLM the current DOM, what worked, what failed, and asks for remaining steps.
 */
export function buildContinuationPrompt(
  completedSteps: AdaptiveStep[],
  failedStep: AdaptiveStep,
  liveDOM: string,
  remainingGoal: string,
): string {
  const parts: string[] = [];

  parts.push('ADAPTIVE RE-PLANNING: A step in the demo script failed. Here is the current state.');
  parts.push('');
  parts.push('STEPS COMPLETED SUCCESSFULLY:');
  for (const s of completedSteps) {
    parts.push(`  ✓ ${s.index + 1}. [${s.step.action}] ${s.step.note || s.step.selector || s.step.url || ''}`);
  }
  parts.push('');
  parts.push(`STEP THAT FAILED:`);
  parts.push(`  ✗ ${failedStep.index + 1}. [${failedStep.step.action}] selector: ${failedStep.step.selector || 'N/A'}`);
  parts.push(`  Error: ${failedStep.error}`);
  parts.push('');
  parts.push('CURRENT PAGE DOM (what is actually visible right now):');
  parts.push(liveDOM);
  parts.push('');
  parts.push(`REMAINING GOAL: ${remainingGoal}`);
  parts.push('');
  parts.push('Generate ONLY the remaining steps to complete the demo from the current state. Use ONLY selectors visible in the DOM above. Output a JSON array of steps.');

  return parts.join('\n');
}
