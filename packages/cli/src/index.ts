#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { run, loadConfig, parseConfig } from '@pressplay/core';

async function main() {
  const args = process.argv.slice(2);
  const previewUrl = args[0];

  if (!previewUrl) {
    console.error('Usage: pressplay <preview-url> [--config <path>]');
    console.error('');
    console.error('Example: pressplay http://localhost:3000');
    process.exit(1);
  }

  const configIdx = args.indexOf('--config');
  const configPath = configIdx >= 0 ? args[configIdx + 1] : undefined;

  const config = configPath ? await loadConfig(configPath) : parseConfig({});

  const llmApiKey = process.env.ANTHROPIC_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!llmApiKey) {
    console.error('Error: Set ANTHROPIC_API_KEY or OPENAI_API_KEY environment variable');
    process.exit(1);
  }

  let baseBranch = 'main';
  try {
    execFileSync('git', ['rev-parse', '--verify', 'main'], { stdio: 'ignore' });
  } catch {
    baseBranch = 'master';
  }

  const rawDiff = execFileSync('git', ['diff', `${baseBranch}...HEAD`], {
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024,
  });

  console.log('🎬 PRessPlay — generating demo video...');
  console.log(`  Preview URL: ${previewUrl}`);
  console.log(`  Diff base: ${baseBranch}`);

  // Disable publishing in CLI mode
  config.publish.comment = false;
  config.publish.artifact = false;

  const result = await run({
    config,
    previewUrl,
    rawDiff,
    llmApiKey,
    githubToken: '',
    owner: '',
    repo: '',
    prNumber: 0,
  });

  if (result.success) {
    console.log('✅ Done!');
    if (result.postProd?.mp4Path) console.log(`  MP4: ${result.postProd.mp4Path}`);
    if (result.postProd?.gifPath) console.log(`  GIF: ${result.postProd.gifPath}`);
    if (result.fallback) console.log(`  ⚠️  Fallback used: ${result.fallback}`);
  } else {
    console.error(`❌ Failed: ${result.error}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
