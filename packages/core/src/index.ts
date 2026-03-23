import { chromium } from 'playwright';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { rename } from 'node:fs/promises';
import { analyzeDiff } from './diff/analyzer.js';
import { buildPrompt } from './llm/prompt.js';
import { generateSteps, type LLMClientConfig } from './llm/client.js';
import { parseSteps } from './llm/parser.js';
import { inspectPage, type DOMSnapshot } from './recorder/inspector.js';
import { captureLiveSnapshot, buildContinuationPrompt } from './recorder/adaptive.js';
import { executeStep, ensureCursor } from './recorder/executor.js';
import { captureScreenshots } from './recorder/fallback.js';
import { convertVideo } from './postprod/ffmpeg.js';
import { uploadArtifacts, publishToPR } from './publisher/github.js';
import type { PRessPlayConfig } from './config/schema.js';
import type { PipelineResult, Step } from './types.js';

export { parseConfig, type PRessPlayConfig } from './config/schema.js';
export { loadConfig } from './config/loader.js';
export * from './types.js';

const execFileAsync = promisify(execFile);

export interface RunOptions {
  config: PRessPlayConfig;
  previewUrl: string;
  rawDiff: string;
  llmApiKey: string;
  githubToken: string;
  owner: string;
  repo: string;
  prNumber: number;
}

/**
 * Run the full PRessPlay pipeline with adaptive execution.
 *
 * Instead of generating all steps upfront and hoping they work,
 * this executes steps one at a time. When a step fails, it captures
 * the live DOM, sends it to the LLM, and gets corrected remaining steps.
 * This handles modals, dynamic content, and unexpected UI states.
 */
export async function run(options: RunOptions): Promise<PipelineResult> {
  const { config, previewUrl, rawDiff, llmApiKey, owner, repo, prNumber, githubToken } = options;

  // Stage 1: Diff analysis
  const diff = analyzeDiff(rawDiff, config.diff, config.routeMap);

  if (diff.changedFiles.length === 0) {
    return {
      success: true,
      diff,
      steps: [],
      error: 'No frontend files changed — skipping demo',
    };
  }

  const llmConfig: LLMClientConfig = {
    provider: config.llm.provider,
    model: config.llm.model,
    apiKey: llmApiKey,
    temperature: config.llm.temperature,
  };

  // Stage 1.5: DOM inspection
  let domSnapshot: DOMSnapshot | undefined;
  try {
    domSnapshot = await inspectPage(previewUrl, config.recording);
  } catch {
    // Non-fatal
  }

  // Stage 2: Generate initial steps
  let steps: Step[];
  try {
    const prompt = buildPrompt(diff, previewUrl, config.app.hint, domSnapshot);
    steps = await generateSteps(prompt, llmConfig);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const recording = await captureScreenshots(
      diff.affectedRoutes.length > 0 ? diff.affectedRoutes : ['/'],
      previewUrl,
      config.recording,
    );
    return { success: true, diff, steps: [], recording, error: errorMsg, fallback: 'screenshots-only' };
  }

  // Stage 3: Adaptive recording — execute steps with live re-planning on failure
  const startTime = Date.now();
  const browser = await chromium.launch({ headless: config.recording.headless });
  const context = await browser.newContext({
    viewport: config.recording.viewport,
    recordVideo: { dir: './recordings/', size: config.recording.viewport },
    ...(config.recording.storageState ? { storageState: config.recording.storageState } : {}),
  });
  const page = await context.newPage();
  let videoPath: string | undefined;
  let firstNavDoneTime = 0;
  const executedSteps: Step[] = [];
  let adaptiveRetries = 0;
  const maxAdaptiveRetries = 3;

  try {
    const timeoutMs = config.recording.maxDuration * 1000;
    const deadline = Date.now() + timeoutMs;

    await ensureCursor(page);
    await page.mouse.move(640, 360, { steps: 1 });

    let currentSteps = [...steps];
    let globalStepIndex = 0;

    while (currentSteps.length > 0 && Date.now() < deadline) {
      const step = currentSteps.shift()!;

      try {
        await executeStep(page, step);
        executedSteps.push(step);

        if (globalStepIndex === 0) firstNavDoneTime = Date.now();
        globalStepIndex++;

        // Brief pause between steps
        await page.waitForTimeout(150);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);

        if (adaptiveRetries >= maxAdaptiveRetries) {
          // Exhausted retries — save what we have and break
          break;
        }

        adaptiveRetries++;

        // Capture live DOM at the point of failure
        const liveDOM = await captureLiveSnapshot(page);

        // Build a summary of remaining goals from the failed + remaining steps
        const remainingNotes = [step, ...currentSteps]
          .filter(s => s.note)
          .map(s => s.note)
          .join('; ');

        const continuationPrompt = buildContinuationPrompt(
          executedSteps.map((s, i) => ({ step: s, index: i, succeeded: true })),
          { step, index: globalStepIndex, succeeded: false, error: errorMsg },
          liveDOM,
          remainingNotes || 'Complete the demo showing the UI changes',
        );

        // Ask LLM for corrected remaining steps
        try {
          const prompt = buildPrompt(diff, previewUrl, config.app.hint, domSnapshot);
          prompt.user = continuationPrompt;

          const newSteps = await generateSteps(prompt, llmConfig);
          currentSteps = newSteps;
          // Don't increment globalStepIndex — we're re-planning from current state
        } catch {
          // LLM failed to re-plan — break and use what we have
          break;
        }
      }
    }

    await page.waitForTimeout(config.recording.waitAfterComplete);
    videoPath = await page.video()?.path();
  } finally {
    await context.close();
    await browser.close();
  }

  if (!videoPath) {
    // No video — fall back to screenshots
    const recording = await captureScreenshots(
      diff.affectedRoutes.length > 0 ? diff.affectedRoutes : ['/'],
      previewUrl,
      config.recording,
    );
    return { success: true, diff, steps: executedSteps, recording, fallback: 'screenshots-only' };
  }

  // Trim dead time from start
  if (firstNavDoneTime > 0) {
    const deadTimeMs = firstNavDoneTime - startTime;
    if (deadTimeMs > 1000) {
      const trimSeconds = Math.max(0, (deadTimeMs - 500) / 1000);
      const trimmedPath = videoPath.replace('.webm', '-trimmed.webm');
      try {
        await execFileAsync('ffmpeg', ['-ss', trimSeconds.toFixed(2), '-i', videoPath, '-c', 'copy', '-y', trimmedPath]);
        await rename(trimmedPath, videoPath);
      } catch { /* keep original */ }
    }
  }

  // Stage 4: Post-production
  const postProd = await convertVideo(videoPath, {
    mp4: config.postProduction.mp4.enabled,
    gif: config.postProduction.gif.enabled,
    gifMaxWidth: config.postProduction.gif.maxWidth,
    gifFps: config.postProduction.gif.fps,
  });

  // Stage 5: Publish
  const { mp4Url, gifUrl } = await uploadArtifacts(
    { mp4Path: postProd.mp4Path, gifPath: postProd.gifPath },
    config.publish.artifactRetentionDays,
  );

  let commentUrl: string | undefined;
  if (config.publish.comment) {
    commentUrl = await publishToPR(
      { token: githubToken, owner, repo, prNumber },
      {
        prNumber,
        steps: executedSteps,
        artifactUrl: mp4Url,
        gifUrl,
        durationSec: Math.round((Date.now() - startTime) / 1000),
      },
    );
  }

  return {
    success: true,
    diff,
    steps: executedSteps,
    recording: { videoPath, screenshots: [], steps: executedSteps, durationMs: Date.now() - startTime },
    postProd,
    commentUrl,
  };
}
