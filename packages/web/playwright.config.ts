import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/test-results',
  use: {
    baseURL: 'http://localhost:3100',
    screenshot: 'on',
    viewport: { width: 1280, height: 720 },
  },
  webServer: {
    command: 'pnpm dev',
    port: 3100,
    reuseExistingServer: true,
  },
});
