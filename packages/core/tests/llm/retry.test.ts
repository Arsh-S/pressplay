import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DiffAnalysis } from '../../src/types.js';

vi.mock('../../src/llm/client.js', () => ({
  generateSteps: vi.fn(),
}));

import { generateWithRetry } from '../../src/llm/retry.js';
import { generateSteps } from '../../src/llm/client.js';

const mockGenerateSteps = vi.mocked(generateSteps);

const fakeDiff: DiffAnalysis = {
  changedFiles: [{ path: 'src/page.tsx', changeType: 'modified', category: 'route', diff: '+<div>' }],
  affectedRoutes: ['/'],
  summary: 'test',
};

const baseCtx = {
  diff: fakeDiff,
  previewUrl: 'https://preview.example.com',
  appHint: '',
  llmConfig: { provider: 'anthropic' as const, apiKey: 'test', temperature: 0.3 },
  maxRetries: 2,
};

describe('generateWithRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns steps on first success', async () => {
    mockGenerateSteps.mockResolvedValueOnce([{ action: 'navigate', url: '/' }]);
    const result = await generateWithRetry(baseCtx);
    expect(result.steps).toHaveLength(1);
    expect(result.attempts).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it('retries on failure and succeeds', async () => {
    mockGenerateSteps
      .mockRejectedValueOnce(new Error('bad selector'))
      .mockResolvedValueOnce([{ action: 'navigate', url: '/' }]);
    const result = await generateWithRetry(baseCtx);
    expect(result.steps).toHaveLength(1);
    expect(result.attempts).toBe(2);
    expect(result.errors).toHaveLength(1);
  });

  it('throws after exhausting retries', async () => {
    mockGenerateSteps
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockRejectedValueOnce(new Error('fail 3'));
    await expect(generateWithRetry(baseCtx)).rejects.toThrow('failed after 3 attempts');
  });
});
