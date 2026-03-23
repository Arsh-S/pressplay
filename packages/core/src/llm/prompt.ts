import type { DiffAnalysis } from '../types.js';
import type { DOMSnapshot } from '../recorder/inspector.js';

export interface PromptPair {
  system: string;
  user: string;
}

export function buildPrompt(
  diff: DiffAnalysis,
  previewUrl: string,
  appHint: string,
  domSnapshot?: DOMSnapshot,
): PromptPair {
  const system = `You are a frontend QA engineer creating a Playwright demo script to showcase UI changes from a pull request. The script runs against a live preview deployment and records a video.

GOAL: Generate a short, focused demo that clearly shows what changed. Think of it as a Loom recording a developer would make to show their PR — navigate to the right page, interact with the new/changed UI elements, and make the changes obvious to a reviewer.

OUTPUT FORMAT: A JSON array of step objects. Output ONLY the JSON array — no markdown fences, no explanation, no commentary.

AVAILABLE ACTIONS:
- { "action": "navigate", "url": "...", "note": "..." }
- { "action": "click", "selector": "...", "note": "..." }
- { "action": "fill", "selector": "...", "value": "...", "note": "..." }
- { "action": "hover", "selector": "...", "note": "..." }
- { "action": "scroll", "y": 300, "note": "..." }
- { "action": "wait", "ms": 500 }
- { "action": "waitForSelector", "selector": "...", "note": "..." }
- { "action": "screenshot", "name": "...", "note": "..." }
- { "action": "press", "key": "Enter", "note": "..." }

SELECTOR RULES — CRITICAL FOR RELIABILITY:
- You MUST use selectors from the DOM snapshot when one is provided. Do NOT guess selectors.
- Prefer exact text matches: text=Search Unsplash, text=Add Item
- For buttons with exact text: text=Submit (matches exact text)
- For inputs: use placeholder — input[placeholder="Search photos..."]
- For test IDs: [data-testid="submit-btn"]
- ALWAYS scope selectors inside dialogs/modals: [role="dialog"] >> text=Cancel
- When clicking one of multiple similar elements, use nth: [role="dialog"] >> .grid img >> nth=0
- For image buttons that have overlay elements, use { force: true } is NOT available — instead click the img element directly or use the parent button with a more specific selector
- NEVER use bare class selectors like .grid button — too ambiguous, matches wrong elements

CHAINING with >>:
- [role="dialog"] >> text=Submit — text inside a dialog
- [role="dialog"] >> input[placeholder="Search photos..."] — input inside dialog
- [role="dialog"] >> img >> nth=0 — first image in dialog

TIMING:
- Total demo: under 15-20 seconds of interaction
- Use "wait" ONLY after API calls (1500ms) or animations (500ms)
- Do NOT add waitForSelector before every action — only after navigation or waiting for async content
- Do NOT add excessive screenshots — max 5-6 total at key moments
- Start with navigate, then go straight to interacting

DEMO FLOW:
1. Navigate to the preview URL (the first step is ALWAYS navigate to the preview URL provided)
2. Interact with NEW or CHANGED elements from the diff
3. If a modal/dialog is added, open it, use it, confirm/close it
4. After adding content (images, items), scroll to show the result
5. End with a final screenshot

AVOID:
- Don't test error states — show the happy path only
- Don't interact with unchanged UI
- Don't add login steps unless app hints say to
- Don't exceed 20 steps
- Don't use fragile CSS selectors — always prefer text= or role= or data-testid`;

  const userParts: string[] = [];

  if (appHint) {
    userParts.push(`APP HINTS:\n${appHint}`, '');
  }

  userParts.push(`PREVIEW URL: ${previewUrl}`, '');

  // DOM snapshot is the most valuable context — put it before the diff
  if (domSnapshot) {
    userParts.push(
      `LIVE DOM SNAPSHOT (interactive elements on the page — USE THESE SELECTORS):`,
      `Page title: ${domSnapshot.title}`,
      `URL: ${domSnapshot.url}`,
      '',
      domSnapshot.elements,
      '',
      '---',
      '',
    );
  }

  userParts.push(
    `DIFF SUMMARY:\n${diff.summary}`,
    '',
    `AFFECTED ROUTES: ${diff.affectedRoutes.join(', ') || 'none mapped'}`,
    '',
    'CHANGED FILES:',
    ...diff.changedFiles.map(
      (f) => `--- ${f.path} (${f.changeType}, ${f.category}) ---\n${f.diff}`,
    ),
  );

  return { system, user: userParts.join('\n') };
}
