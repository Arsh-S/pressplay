import { describe, it, expect } from 'vitest';
import { mapFilesToRoutes } from '../../src/diff/route-mapper.js';

describe('mapFilesToRoutes', () => {
  const routeMap: Record<string, string> = {
    'src/pages/index.tsx': '/',
    'src/pages/dashboard.tsx': '/dashboard',
    'src/pages/settings/**': '/settings',
    'src/components/Header.tsx': '/',
  };

  it('maps exact file matches', () => {
    const routes = mapFilesToRoutes(['src/pages/index.tsx'], routeMap);
    expect(routes).toEqual(['/']);
  });

  it('maps glob patterns', () => {
    const routes = mapFilesToRoutes(['src/pages/settings/profile.tsx'], routeMap);
    expect(routes).toEqual(['/settings']);
  });

  it('maps component to page route', () => {
    const routes = mapFilesToRoutes(['src/components/Header.tsx'], routeMap);
    expect(routes).toEqual(['/']);
  });

  it('deduplicates routes', () => {
    const routes = mapFilesToRoutes(['src/pages/index.tsx', 'src/components/Header.tsx'], routeMap);
    expect(routes).toEqual(['/']);
  });

  it('returns empty for unmapped files', () => {
    const routes = mapFilesToRoutes(['src/lib/utils.ts'], routeMap);
    expect(routes).toEqual([]);
  });
});
