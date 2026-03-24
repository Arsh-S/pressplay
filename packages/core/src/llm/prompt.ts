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
- Total demo: 10-20 seconds of interaction
- Use "wait" ONLY after API calls (1500ms) or animations (500ms)
- Do NOT add waitForSelector before every action — only after navigation or when waiting for async content (modal open, API response)
- Do NOT add excessive screenshots — max 5-6 total at key moments
- Start with navigate, then go straight to interacting
- Do NOT add unnecessary filler steps (filling unrelated form fields etc.)

DEMO FLOW:
1. Navigate to the preview URL (the first step is ALWAYS navigate to the preview URL)
2. Go straight to the NEW or CHANGED elements — don't interact with unchanged UI
3. If the change adds a modal/dialog/picker: open it, fully interact with it (search, select, confirm), then close it
4. If the modal supports multi-select: select 2-3 items to show the feature, then confirm
5. After confirming a modal that adds content (images, selections), scroll 300-400px to reveal the result
6. End with a screenshot showing the final outcome

COMMON UI PATTERNS (handle these correctly):
- Image/photo pickers: search → wait for results → click multiple images → click confirm button → scroll to show previews
- Confirm buttons in pickers often show a count: "Add 1 Photo", "Add 3 Photos", "Save 2 Items". The button text changes dynamically based on selection count.
- Modal confirm/cancel: look for buttons at the bottom of [role="dialog"]. Confirm is usually the primary/filled button.
- Form wizards: if a page has numbered steps (Step 1, 2, 3...), use "Next" or step number buttons to navigate between them
- Dropdowns/selects: click to open, then click an option
- TABS: If the PR adds tabs that switch content, click through ALL tabs to show each one renders different content. Take a screenshot of each tab. This is critical — reviewers need to see every tab works.
- Sidebar/navigation: If a new page is added via sidebar nav, click the nav link to navigate there, then demonstrate the page features

SCROLLING RULES:
- NEVER scroll before clicking an element — Playwright auto-scrolls to elements when clicking
- ONLY scroll AFTER an action to reveal new content that appeared below the viewport
- After confirming a modal that adds content, scroll down 300-400px to show the result
- Use { "action": "scroll", "y": 300 } for gentle reveal

AVOID:
- Don't test error states — show the happy path only
- Don't interact with unchanged UI
- Don't add login steps unless app hints say to
- Don't exceed 30 steps total
- Don't use fragile CSS selectors — always prefer text= or role= or data-testid
- Don't fill in unrelated form fields unless needed to reach the changed UI`;

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
