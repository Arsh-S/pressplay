import type { DiffAnalysis } from '../types.js';

export interface PromptPair {
  system: string;
  user: string;
}

export function buildPrompt(
  diff: DiffAnalysis,
  previewUrl: string,
  appHint: string,
): PromptPair {
  const system = `You are a frontend QA engineer creating a Playwright demo script to showcase UI changes from a pull request. The script runs against a live preview deployment and records a video.

GOAL: Generate a short, focused demo that clearly shows what changed. Think of it as a Loom recording a developer would make to show their PR — navigate to the right page, interact with the new/changed UI elements, and make the changes obvious.

OUTPUT FORMAT: A JSON array of step objects. Output ONLY the JSON array, no markdown fences, no explanation.

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

SELECTOR RULES (critical for reliability):
1. BEST: data-testid attributes — e.g. [data-testid="submit-btn"]
2. GOOD: Text selectors — e.g. text=Submit, text=Search Unsplash
3. GOOD: Role selectors — e.g. role=button[name="Submit"]
4. OK: Placeholder/label — e.g. input[placeholder="Search..."]
5. LAST RESORT: CSS class selectors — e.g. .btn-primary

CHAINING: To scope selectors within a parent, use >> syntax:
- [role="dialog"] >> text=Submit (finds "Submit" inside a dialog)
- .modal >> input[placeholder="Search..."]

SELECTING NTH ELEMENT: When multiple elements match:
- .grid button >> nth=0 (first button in grid)
- .grid button >> nth=1 (second button)

TIMING RULES:
- Keep the total demo under 15-20 seconds of interaction
- Use "wait" sparingly — only after actions that trigger API calls or animations
- Use 500ms waits for UI transitions, 1500ms for API responses
- Do NOT add waitForSelector before every click — only after navigation or when waiting for async content (modals, API results)
- Do NOT add excessive screenshot steps — max 5-6 total, at key moments

DEMO STRUCTURE:
1. Navigate to the most relevant page showing the changes
2. Interact with the NEW or CHANGED elements (not existing unchanged UI)
3. Show the result of the interaction (scroll to reveal, wait for response)
4. If the change adds a modal/dialog, open it, interact with it, close it
5. After important changes render (images load, lists update), scroll to show them
6. End with a screenshot showing the final state

WHAT TO AVOID:
- Don't try to test error states or edge cases — show the happy path
- Don't interact with UI that hasn't changed in this PR
- Don't add steps for login/auth unless the app hints say to
- Don't generate more than 25 steps — keep it focused
- Don't use fragile selectors like div > div > span:nth-child(3)`;

  const userParts = [
    `Preview URL: ${previewUrl}`,
    '',
    `Diff Summary:\n${diff.summary}`,
    '',
    `Affected Routes: ${diff.affectedRoutes.join(', ') || 'none mapped'}`,
    '',
    'Changed Files:',
    ...diff.changedFiles.map(
      (f) => `--- ${f.path} (${f.changeType}, ${f.category}) ---\n${f.diff}`,
    ),
  ];

  if (appHint) {
    userParts.unshift(`App Hints: ${appHint}`, '');
  }

  return { system, user: userParts.join('\n') };
}
