import { describe, it, expect } from 'vitest';
import { formatComment } from '../../src/publisher/comment.js';
import type { Step } from '../../src/types.js';

describe('formatComment', () => {
  const steps: Step[] = [
    { action: 'navigate', url: '/dashboard', note: 'Opening the dashboard' },
    { action: 'click', selector: '#create-btn', note: 'Clicking create button' },
  ];

  it('includes PR number in heading', () => {
    const md = formatComment({ prNumber: 42, steps, artifactUrl: null, gifUrl: null, durationSec: 12 });
    expect(md).toContain('PR #42');
  });

  it('lists step notes', () => {
    const md = formatComment({ prNumber: 42, steps, artifactUrl: null, gifUrl: null, durationSec: 12 });
    expect(md).toContain('Opening the dashboard');
    expect(md).toContain('Clicking create button');
  });

  it('includes GIF when provided', () => {
    const md = formatComment({ prNumber: 42, steps, artifactUrl: null, gifUrl: 'https://example.com/demo.gif', durationSec: 12 });
    expect(md).toContain('demo.gif');
  });

  it('includes artifact link when provided', () => {
    const md = formatComment({ prNumber: 42, steps, artifactUrl: 'https://example.com/artifacts/1', gifUrl: null, durationSec: 12 });
    expect(md).toContain('artifacts/1');
  });

  it('includes duration in details', () => {
    const md = formatComment({ prNumber: 42, steps, artifactUrl: null, gifUrl: null, durationSec: 12 });
    expect(md).toContain('12');
  });
});
