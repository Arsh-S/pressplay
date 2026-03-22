import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockOctokit = {
  issues: {
    listComments: vi.fn().mockResolvedValue({ data: [] }),
    createComment: vi.fn().mockResolvedValue({ data: { html_url: 'https://github.com/test/1#comment' } }),
    updateComment: vi.fn().mockResolvedValue({ data: { html_url: 'https://github.com/test/1#updated' } }),
  },
};

vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn().mockImplementation(() => mockOctokit),
}));

import { publishToPR } from '../../src/publisher/github.js';

const config = { token: 'test', owner: 'org', repo: 'repo', prNumber: 1 };
const commentData = {
  prNumber: 1,
  steps: [{ action: 'navigate' as const, url: '/', note: 'Go home' }],
  artifactUrl: null,
  gifUrl: null,
  durationSec: 10,
};

describe('publishToPR', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOctokit.issues.listComments.mockResolvedValue({ data: [] });
    mockOctokit.issues.createComment.mockResolvedValue({ data: { html_url: 'https://github.com/test/1#comment' } });
    mockOctokit.issues.updateComment.mockResolvedValue({ data: { html_url: 'https://github.com/test/1#updated' } });
  });

  it('creates a new comment when none exists', async () => {
    const url = await publishToPR(config, commentData);
    expect(url).toContain('github.com');
    expect(mockOctokit.issues.createComment).toHaveBeenCalled();
  });

  it('updates existing comment when marker found', async () => {
    mockOctokit.issues.listComments.mockResolvedValueOnce({
      data: [{ id: 99, body: '<!-- pressplay-demo -->\nold content' }],
    });
    const url = await publishToPR(config, commentData);
    expect(url).toContain('updated');
    expect(mockOctokit.issues.updateComment).toHaveBeenCalledWith(
      expect.objectContaining({ comment_id: 99 }),
    );
  });
});
