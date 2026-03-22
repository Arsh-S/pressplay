import * as core from '@actions/core';
import * as github from '@actions/github';
import { execFileSync } from 'node:child_process';
import { run, loadConfig, parseConfig } from '@pressplay/core';

async function installPlaywright(): Promise<void> {
  core.info('Installing Playwright Chromium browser...');
  execFileSync('npx', ['playwright', 'install', 'chromium', '--with-deps'], {
    stdio: 'inherit',
    timeout: 120_000,
  });
}

async function main() {
  try {
    const previewUrl = core.getInput('preview-url', { required: true });
    const llmApiKey = core.getInput('llm-api-key', { required: true });
    const llmProvider = core.getInput('llm-provider') || undefined;
    const configPath = core.getInput('config-path');

    // Load config — fall back to defaults if config file doesn't exist
    let config;
    try {
      config = await loadConfig(configPath);
    } catch {
      core.info(`No config file found at ${configPath}, using defaults`);
      config = parseConfig({});
    }

    if (llmProvider) {
      config.llm.provider = llmProvider as 'anthropic' | 'openai';
    }

    const { context } = github;

    // Support both pull_request and deployment_status events
    let prNumber: number;
    let baseSha: string;
    let headSha: string;

    if (context.payload.pull_request) {
      prNumber = context.payload.pull_request.number;
      baseSha = context.payload.pull_request.base.sha;
      headSha = context.payload.pull_request.head.sha;
    } else {
      core.info('Not a pull request event — skipping');
      return;
    }

    // Install Playwright browser
    await installPlaywright();

    // Get the diff
    core.info(`Computing diff: ${baseSha.slice(0, 7)}...${headSha.slice(0, 7)}`);
    const rawDiff = execFileSync('git', ['diff', `${baseSha}...${headSha}`], {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
    });

    if (!rawDiff.trim()) {
      core.info('No diff found between base and head — skipping');
      return;
    }

    core.info('Running PRessPlay pipeline...');
    const result = await run({
      config,
      previewUrl,
      rawDiff,
      llmApiKey,
      githubToken: process.env.GITHUB_TOKEN ?? '',
      owner: context.repo.owner,
      repo: context.repo.repo,
      prNumber,
    });

    if (result.success) {
      core.info('PRessPlay completed successfully');
      if (result.commentUrl) {
        core.info(`Comment posted: ${result.commentUrl}`);
        core.setOutput('comment-url', result.commentUrl);
      }
      if (result.postProd?.mp4Path) {
        core.setOutput('video-path', result.postProd.mp4Path);
      }
      if (result.postProd?.gifPath) {
        core.setOutput('gif-path', result.postProd.gifPath);
      }
      if (result.fallback) {
        core.warning(`Used fallback mode: ${result.fallback}`);
      }
      core.setOutput('fallback', result.fallback ?? 'none');
    }
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

main();
