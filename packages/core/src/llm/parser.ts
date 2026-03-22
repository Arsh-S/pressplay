import type { Step, StepAction } from '../types.js';

const VALID_ACTIONS: StepAction[] = [
  'navigate', 'click', 'fill', 'hover', 'scroll',
  'wait', 'waitForSelector', 'screenshot', 'press',
];

function stripCodeFences(text: string): string {
  return text.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim();
}

function validateStep(step: Record<string, unknown>, index: number): Step {
  const action = step.action as string;

  if (!action || !VALID_ACTIONS.includes(action as StepAction)) {
    throw new Error(`Step ${index}: invalid action "${action}". Valid: ${VALID_ACTIONS.join(', ')}`);
  }

  if (action === 'navigate' && !step.url) {
    throw new Error(`Step ${index}: "navigate" requires "url"`);
  }
  if (['click', 'fill', 'hover', 'waitForSelector'].includes(action) && !step.selector) {
    throw new Error(`Step ${index}: "${action}" requires "selector"`);
  }
  if (action === 'fill' && !step.value) {
    throw new Error(`Step ${index}: "fill" requires "value"`);
  }
  if (action === 'press' && !step.key) {
    throw new Error(`Step ${index}: "press" requires "key"`);
  }

  return step as unknown as Step;
}

export function parseSteps(raw: string): Step[] {
  const cleaned = stripCodeFences(raw);
  let parsed: unknown;

  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Failed to parse LLM output as JSON: ${cleaned.slice(0, 200)}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error('LLM output must be a JSON array of steps');
  }

  if (parsed.length === 0) {
    throw new Error('LLM returned empty step array');
  }

  return parsed.map((step, i) => validateStep(step as Record<string, unknown>, i));
}
