import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import type { RecordingResult } from '../types.js';
import type { VideoConfig } from './video.js';

export async function captureScreenshots(
  routes: string[],
  previewUrl: string,
  config: VideoConfig,
): Promise<RecordingResult> {
  const startTime = Date.now();
  await mkdir('screenshots', { recursive: true });

  const browser = await chromium.launch({ headless: config.headless });
  const context = await browser.newContext({
    viewport: config.viewport,
    ...(config.storageState ? { storageState: config.storageState } : {}),
  });
  const page = await context.newPage();
  const screenshots: string[] = [];

  try {
    for (const route of routes) {
      const url = new URL(route, previewUrl).href;
      await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
      const path = `screenshots/${route.replace(/\//g, '_') || 'index'}.png`;
      await page.screenshot({ path, fullPage: true });
      screenshots.push(path);
    }
  } finally {
    await context.close();
    await browser.close();
  }

  return {
    videoPath: '',
    screenshots,
    steps: [],
    durationMs: Date.now() - startTime,
  };
}
