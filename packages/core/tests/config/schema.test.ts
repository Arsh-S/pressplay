import { describe, it, expect } from 'vitest';
import { parseConfig, type PRessPlayConfig } from '../../src/config/schema.js';

describe('parseConfig', () => {
  it('accepts minimal valid config', () => {
    const config = parseConfig({});
    expect(config.diff.maxTokens).toBe(8000);
    expect(config.recording.viewport.width).toBe(1920);
    expect(config.llm.provider).toBe('anthropic');
  });

  it('merges user overrides with defaults', () => {
    const config = parseConfig({
      diff: { maxTokens: 4000 },
      llm: { provider: 'openai' },
    });
    expect(config.diff.maxTokens).toBe(4000);
    expect(config.llm.provider).toBe('openai');
    expect(config.recording.viewport.width).toBe(1920);
  });

  it('rejects invalid provider', () => {
    expect(() =>
      parseConfig({ llm: { provider: 'invalid' } })
    ).toThrow();
  });

  it('rejects negative maxTokens', () => {
    expect(() =>
      parseConfig({ diff: { maxTokens: -1 } })
    ).toThrow();
  });
});
