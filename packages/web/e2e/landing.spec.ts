import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test('renders hero section with headline and CTAs', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Stop writing PR descriptions');
    await expect(page.getByRole('link', { name: /get started/i }).first()).toBeVisible();
    await expect(page.locator('a[href="#demo"]')).toContainText('View Demo');
  });

  test('renders how it works section', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('How it works')).toBeVisible();
    await expect(page.getByText('Install GitHub App')).toBeVisible();
    await expect(page.getByText('Open a Pull Request')).toBeVisible();
    await expect(page.getByText('Video Appears on PR')).toBeVisible();
  });

  test('renders feature grid', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('AI-Powered Scripts')).toBeVisible();
    await expect(page.getByText('Playwright Recording')).toBeVisible();
  });

  test('renders footer', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('© 2026 PRessPlay')).toBeVisible();
  });

  test('screenshot - full page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();
    await page.screenshot({ path: 'e2e/screenshots/landing.png', fullPage: true });
  });
});
