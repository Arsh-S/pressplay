import { describe, it, expect } from 'vitest';
import { parseSteps } from '../../src/llm/parser.js';

describe('parseSteps', () => {
  it('parses valid JSON step array', () => {
    const raw = JSON.stringify([
      { action: 'navigate', url: 'https://example.com', note: 'Go to home' },
      { action: 'click', selector: 'button', note: 'Click button' },
    ]);
    const steps = parseSteps(raw);
    expect(steps).toHaveLength(2);
    expect(steps[0].action).toBe('navigate');
    expect(steps[1].selector).toBe('button');
  });

  it('strips markdown code fences', () => {
    const raw = '```json\n[{"action":"navigate","url":"https://example.com"}]\n```';
    const steps = parseSteps(raw);
    expect(steps).toHaveLength(1);
  });

  it('rejects non-array output', () => {
    expect(() => parseSteps('{"action":"navigate"}')).toThrow();
  });

  it('rejects steps with invalid action', () => {
    const raw = JSON.stringify([{ action: 'destroy', selector: 'body' }]);
    expect(() => parseSteps(raw)).toThrow();
  });

  it('requires url for navigate action', () => {
    const raw = JSON.stringify([{ action: 'navigate' }]);
    expect(() => parseSteps(raw)).toThrow();
  });

  it('requires selector for click action', () => {
    const raw = JSON.stringify([{ action: 'click' }]);
    expect(() => parseSteps(raw)).toThrow();
  });
});
