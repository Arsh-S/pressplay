import { describe, it, expect } from 'vitest';
import { buildPrompt } from '../../src/llm/prompt.js';
import type { DiffAnalysis } from '../../src/types.js';

describe('buildPrompt', () => {
  const diff: DiffAnalysis = {
    changedFiles: [
      { path: 'src/pages/dashboard.tsx', changeType: 'modified', category: 'route', diff: '+<button>Create</button>' },
    ],
    affectedRoutes: ['/dashboard'],
    summary: '1 frontend file changed.',
  };

  it('includes the preview URL', () => {
    const prompt = buildPrompt(diff, 'https://preview.example.com', '');
    expect(prompt.user).toContain('https://preview.example.com');
  });

  it('includes the diff summary', () => {
    const prompt = buildPrompt(diff, 'https://preview.example.com', '');
    expect(prompt.user).toContain('1 frontend file changed');
  });

  it('includes app hints when provided', () => {
    const prompt = buildPrompt(diff, 'https://preview.example.com', 'Use demo@test.com to log in');
    expect(prompt.user).toContain('demo@test.com');
  });

  it('includes affected routes', () => {
    const prompt = buildPrompt(diff, 'https://preview.example.com', '');
    expect(prompt.user).toContain('/dashboard');
  });

  it('returns system and user messages', () => {
    const prompt = buildPrompt(diff, 'https://preview.example.com', '');
    expect(prompt.system).toBeTruthy();
    expect(prompt.user).toBeTruthy();
  });
});
