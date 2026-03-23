import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/diff/analyzer.js', () => ({
  analyzeDiff: vi.fn(),
}));
vi.mock('../src/llm/client.js', () => ({
  generateSteps: vi.fn(),
}));
vi.mock('../src/recorder/inspector.js', () => ({
  inspectPage: vi.fn().mockResolvedValue({ url: 'https://example.com', title: 'Test', elements: 'button "Submit"' }),
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
// Mock playwright's chromium
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue({
      newContext: vi.fn().mockResolvedValue({
        newPage: vi.fn().mockResolvedValue({
          goto: vi.fn(),
          waitForTimeout: vi.fn(),
          evaluate: vi.fn(),
          mouse: { move: vi.fn() },
          locator: vi.fn().mockReturnValue({ first: vi.fn().mockReturnValue({ click: vi.fn(), fill: vi.fn(), waitFor: vi.fn(), boundingBox: vi.fn().mockResolvedValue(null), pressSequentially: vi.fn() }) }),
          screenshot: vi.fn(),
          keyboard: { press: vi.fn() },
          video: vi.fn().mockReturnValue({ path: vi.fn().mockResolvedValue('recordings/test.webm') }),
        }),
        close: vi.fn(),
      }),
      close: vi.fn(),
    }),
  },
}));

import { run, parseConfig } from '../src/index.js';
import { analyzeDiff } from '../src/diff/analyzer.js';
import { generateSteps } from '../src/llm/client.js';
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
    expect(generateSteps).not.toHaveBeenCalled();
  });

  it('falls back to screenshots when LLM fails', async () => {
    vi.mocked(analyzeDiff).mockReturnValue({
      changedFiles: [{ path: 'src/page.tsx', changeType: 'modified', category: 'route', diff: '+x' }],
      affectedRoutes: ['/'],
      summary: 'changed',
    });
    vi.mocked(generateSteps).mockRejectedValue(new Error('LLM failed'));
    vi.mocked(captureScreenshots).mockResolvedValue({
      videoPath: '', screenshots: ['s.png'], steps: [], durationMs: 1000,
    });

    const result = await run(baseOptions);
    expect(result.success).toBe(true);
    expect(result.fallback).toBe('screenshots-only');
  });

  it('executes steps and produces a recording', async () => {
    vi.mocked(analyzeDiff).mockReturnValue({
      changedFiles: [{ path: 'src/page.tsx', changeType: 'modified', category: 'route', diff: '+x' }],
      affectedRoutes: ['/'],
      summary: 'changed',
    });
    vi.mocked(generateSteps).mockResolvedValue([
      { action: 'navigate', url: 'https://preview.example.com', note: 'Open page' },
    ]);
    vi.mocked(convertVideo).mockResolvedValue({ mp4Path: 'rec.mp4', gifPath: 'rec.gif' });

    const result = await run(baseOptions);
    expect(result.success).toBe(true);
    expect(result.steps).toHaveLength(1);
  });
});
