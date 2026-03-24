#!/usr/bin/env npx tsx
/**
 * Standalone worker process that polls for pending jobs.
 * Run with: pnpm --filter @pressplay/web worker
 */

import { runWorkerOnce } from '../src/lib/worker';

const POLL_INTERVAL = 5000; // 5 seconds

async function main() {
  console.log('PRessPlay worker started. Polling for jobs...');

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const processed = await runWorkerOnce();
      if (processed) {
        console.log('Job processed successfully');
      }
    } catch (err) {
      console.error('Worker error:', err);
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
  }
}

main();
