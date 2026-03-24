import { test, expect } from '@playwright/test';

test.describe('Repo Detail', () => {
  test('unauthenticated user is redirected to landing', async ({ page }) => {
    await page.goto('/dashboard/repos/test-id');
    await page.waitForURL('/');
  });
});
