import { analyzeDiff } from './diff/analyzer.js';
import { generateWithRetry } from './llm/retry.js';
import { recordVideo } from './recorder/video.js';
import { captureScreenshots } from './recorder/fallback.js';
import { convertVideo } from './postprod/ffmpeg.js';
import { uploadArtifacts, publishToPR } from './publisher/github.js';
import type { PRessPlayConfig } from './config/schema.js';
import type { PipelineResult } from './types.js';

export { parseConfig, type PRessPlayConfig } from './config/schema.js';
export { loadConfig } from './config/loader.js';
export * from './types.js';

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

  // Stage 2: LLM script generation
  let steps;
  try {
    const result = await generateWithRetry({
      diff,
      previewUrl,
      appHint: config.app.hint,
      llmConfig: {
        provider: config.llm.provider,
        model: config.llm.model,
        apiKey: llmApiKey,
        temperature: config.llm.temperature,
      },
      maxRetries: config.llm.maxRetries,
    });
    steps = result.steps;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    // Fallback to screenshots
    const recording = await captureScreenshots(
      diff.affectedRoutes.length > 0 ? diff.affectedRoutes : ['/'],
      previewUrl,
      config.recording,
    );
    return {
      success: true,
      diff,
      steps: [],
      recording,
      error: errorMsg,
      fallback: 'screenshots-only',
    };
  }

  // Stage 3: Recording
  let recording;
  try {
    recording = await recordVideo(steps, previewUrl, config.recording);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    // Fallback to screenshots
    const screenshotResult = await captureScreenshots(
      diff.affectedRoutes.length > 0 ? diff.affectedRoutes : ['/'],
      previewUrl,
      config.recording,
    );
    return {
      success: true,
      diff,
      steps,
      recording: screenshotResult,
      error: errorMsg,
      fallback: 'screenshots-only',
    };
  }

  // Stage 4: Post-production
  const postProd = await convertVideo(recording.videoPath, {
    mp4: config.postProduction.mp4.enabled,
    gif: config.postProduction.gif.enabled,
    gifMaxWidth: config.postProduction.gif.maxWidth,
    gifFps: config.postProduction.gif.fps,
  });

  // Stage 5: Upload artifacts and publish
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
        steps,
        artifactUrl: mp4Url,
        gifUrl,
        durationSec: Math.round(recording.durationMs / 1000),
      },
    );
  }

  return {
    success: true,
    diff,
    steps,
    recording,
    postProd,
    commentUrl,
  };
}
