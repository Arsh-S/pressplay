import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/diff/analyzer.js', () => ({
  analyzeDiff: vi.fn(),
}));
vi.mock('../src/llm/retry.js', () => ({
  generateWithRetry: vi.fn(),
}));
vi.mock('../src/recorder/inspector.js', () => ({
  inspectPage: vi.fn().mockResolvedValue({ url: 'https://preview.example.com', title: 'Test', elements: 'button "Submit"' }),
}));
vi.mock('../src/recorder/video.js', () => ({
  recordVideo: vi.fn(),
}));
vi.mock('../src/recorder/fallback.js', () => ({
  captureScreenshots: vi.fn(),
}));
vi.mock('../src/postprod/ffmpeg.js', () => ({
  convertVideo: vi.fn(),
}));
vi.mock('../src/publisher/github.js', () => ({
  uploadArtifacts: vi.fn().mockResolvedValue({ mp4Url: null, gifUrl: null }),
  publishToPR: vi.fn().mockResolvedValue('https://github.com/comment'),
}));

import { run, parseConfig } from '../src/index.js';
import { analyzeDiff } from '../src/diff/analyzer.js';
import { generateWithRetry } from '../src/llm/retry.js';
import { recordVideo } from '../src/recorder/video.js';
import { captureScreenshots } from '../src/recorder/fallback.js';
import { convertVideo } from '../src/postprod/ffmpeg.js';

const baseOptions = {
  config: parseConfig({}),
  previewUrl: 'https://preview.example.com',
  rawDiff: 'some diff',
  llmApiKey: 'test-key',
  githubToken: 'gh-token',
  owner: 'org',
  repo: 'repo',
  prNumber: 42,
};

describe('run (orchestrator)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns early when no frontend files changed', async () => {
    vi.mocked(analyzeDiff).mockReturnValue({
      changedFiles: [],
      affectedRoutes: [],
      summary: 'no changes',
    });
    const result = await run(baseOptions);
    expect(result.success).toBe(true);
    expect(result.steps).toHaveLength(0);
    expect(generateWithRetry).not.toHaveBeenCalled();
  });

  it('falls back to screenshots when LLM fails', async () => {
    vi.mocked(analyzeDiff).mockReturnValue({
      changedFiles: [{ path: 'src/page.tsx', changeType: 'modified', category: 'route', diff: '+x' }],
      affectedRoutes: ['/'],
      summary: 'changed',
    });
    vi.mocked(generateWithRetry).mockRejectedValue(new Error('LLM failed'));
    vi.mocked(captureScreenshots).mockResolvedValue({
      videoPath: '', screenshots: ['s.png'], steps: [], durationMs: 1000,
    });

    const result = await run(baseOptions);
    expect(result.success).toBe(true);
    expect(result.fallback).toBe('screenshots-only');
  });

  it('runs full pipeline on success', async () => {
    vi.mocked(analyzeDiff).mockReturnValue({
      changedFiles: [{ path: 'src/page.tsx', changeType: 'modified', category: 'route', diff: '+x' }],
      affectedRoutes: ['/'],
      summary: 'changed',
    });
    vi.mocked(generateWithRetry).mockResolvedValue({
      steps: [{ action: 'navigate', url: '/' }],
      attempts: 1, errors: [],
    });
    vi.mocked(recordVideo).mockResolvedValue({
      videoPath: 'rec.webm', screenshots: [], steps: [{ action: 'navigate', url: '/' }], durationMs: 5000,
    });
    vi.mocked(convertVideo).mockResolvedValue({ mp4Path: 'rec.mp4', gifPath: 'rec.gif' });

    const result = await run(baseOptions);
    expect(result.success).toBe(true);
    expect(result.postProd?.mp4Path).toBe('rec.mp4');
    expect(result.commentUrl).toBe('https://github.com/comment');
  });
});
