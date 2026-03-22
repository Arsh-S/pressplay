import { describe, it, expect } from 'vitest';
import { filterFiles } from '../../src/diff/filter.js';

describe('filterFiles', () => {
  const defaultInclude = ['src/**/*.{tsx,jsx,vue,svelte,css,scss,html}'];
  const defaultExclude = ['**/*.test.*', '**/*.spec.*', '**/*.stories.*', '__tests__/**'];

  it('includes matching frontend files', () => {
    const files = ['src/pages/index.tsx', 'src/components/Button.tsx', 'README.md'];
    const result = filterFiles(files, defaultInclude, defaultExclude);
    expect(result).toEqual(['src/pages/index.tsx', 'src/components/Button.tsx']);
  });

  it('excludes test files', () => {
    const files = ['src/utils/auth.tsx', 'src/utils/auth.test.tsx'];
    const result = filterFiles(files, defaultInclude, defaultExclude);
    expect(result).toEqual(['src/utils/auth.tsx']);
  });

  it('excludes story files', () => {
    const files = ['src/Button.tsx', 'src/Button.stories.tsx'];
    const result = filterFiles(files, defaultInclude, defaultExclude);
    expect(result).toEqual(['src/Button.tsx']);
  });

  it('returns empty array when no files match', () => {
    const files = ['server/api.go', 'lib/db.py'];
    const result = filterFiles(files, defaultInclude, defaultExclude);
    expect(result).toEqual([]);
  });
});
