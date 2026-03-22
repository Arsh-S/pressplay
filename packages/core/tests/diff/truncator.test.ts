import { describe, it, expect } from 'vitest';
import { truncateDiff } from '../../src/diff/truncator.js';

describe('truncateDiff', () => {
  it('returns diff unchanged when under budget', () => {
    const diff = 'small diff content';
    const result = truncateDiff(diff, 8000);
    expect(result.text).toBe(diff);
    expect(result.truncated).toBe(false);
  });

  it('truncates long diffs to token budget', () => {
    const longDiff = 'x'.repeat(40000);
    const result = truncateDiff(longDiff, 1000);
    expect(result.text.length).toBeLessThan(longDiff.length);
    expect(result.truncated).toBe(true);
  });

  it('includes truncation notice when truncated', () => {
    const longDiff = 'x'.repeat(40000);
    const result = truncateDiff(longDiff, 1000);
    expect(result.text).toContain('[truncated');
  });
});
