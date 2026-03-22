import type { PRessPlayConfig } from '@pressplay/core';

export default {
  app: {
    hint: `
      Use demo@example.com and password "test123" to log in.
      The app has seed data with 3 sample projects.
    `,
  },
  routeMap: {
    'src/app/page.tsx': '/',
    'src/app/dashboard/page.tsx': '/dashboard',
    'src/app/settings/page.tsx': '/settings',
  },
  llm: {
    provider: 'anthropic',
  },
} satisfies PRessPlayConfig;
