import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test('unauthenticated user is redirected to landing', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL('/');
    await expect(page.locator('h1')).toContainText('Stop writing PR descriptions');
  });
});
