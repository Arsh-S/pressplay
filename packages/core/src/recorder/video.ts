import { chromium } from 'playwright';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { rename } from 'node:fs/promises';
import type { Step, RecordingResult } from '../types.js';
import { executeSteps } from './executor.js';

const execFileAsync = promisify(execFile);

export interface VideoConfig {
  viewport: { width: number; height: number };
  headless: boolean;
  waitAfterComplete: number;
  maxDuration: number;
  storageState?: string;
}

export async function recordVideo(
  steps: Step[],
  previewUrl: string,
  config: VideoConfig,
): Promise<RecordingResult> {
  const startTime = Date.now();
  const browser = await chromium.launch({ headless: config.headless });

  const context = await browser.newContext({
    viewport: config.viewport,
    recordVideo: {
      dir: './recordings/',
      size: config.viewport,
    },
    ...(config.storageState ? { storageState: config.storageState } : {}),
  });

  const page = await context.newPage();
  const screenshots: string[] = [];
  let videoPath: string | undefined;

  // Track when the first navigation completes — everything before is dead time
  let firstNavDoneTime = 0;

  try {
    const timeoutMs = config.maxDuration * 1000;
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Recording exceeded maxDuration of ${config.maxDuration}s`)), timeoutMs),
    );

    await Promise.race([
      executeSteps(page, steps, (_step, index) => {
        // Mark when first navigation finishes (step 0 is usually navigate)
        if (index === 0 && firstNavDoneTime === 0) {
          firstNavDoneTime = Date.now();
        }
      }),
      timeoutPromise,
    ]);

    await page.waitForTimeout(config.waitAfterComplete);
    videoPath = await page.video()?.path();
  } finally {
    await context.close();
    await browser.close();
  }

  if (!videoPath) {
    throw new Error('Video recording failed — no video file produced');
  }

  // Trim dead time from the start (blank page before first navigation completes)
  if (firstNavDoneTime > 0) {
    const deadTimeMs = firstNavDoneTime - startTime;
    // Only trim if there's more than 1s of dead time
    if (deadTimeMs > 1000) {
      const trimSeconds = Math.max(0, (deadTimeMs - 500) / 1000); // Keep 500ms buffer
      const trimmedPath = videoPath.replace('.webm', '-trimmed.webm');
      try {
        await execFileAsync('ffmpeg', [
          '-ss', trimSeconds.toFixed(2),
          '-i', videoPath,
          '-c', 'copy',
          '-y',
          trimmedPath,
        ]);
        // Replace original with trimmed version
        await rename(trimmedPath, videoPath);
      } catch {
        // If trim fails, keep the original
      }
    }
  }

  return {
    videoPath,
    screenshots,
    steps,
    durationMs: Date.now() - startTime,
  };
}
