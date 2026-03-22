import type { DiffAnalysis, Step } from '../types.js';
import { buildPrompt } from './prompt.js';
import { generateSteps, type LLMClientConfig } from './client.js';

export interface RetryContext {
  diff: DiffAnalysis;
  previewUrl: string;
  appHint: string;
  llmConfig: LLMClientConfig;
  maxRetries: number;
}

export interface RetryResult {
  steps: Step[];
  attempts: number;
  errors: string[];
}

export async function generateWithRetry(ctx: RetryContext): Promise<RetryResult> {
  const errors: string[] = [];

  for (let attempt = 1; attempt <= ctx.maxRetries + 1; attempt++) {
    try {
      const prompt = buildPrompt(ctx.diff, ctx.previewUrl, ctx.appHint);

      if (errors.length > 0) {
        prompt.user += `\n\nPREVIOUS ATTEMPT FAILED:\n${errors[errors.length - 1]}\n\nPlease generate a corrected script that avoids this error. Use simpler, more robust selectors.`;
      }

      const steps = await generateSteps(prompt, ctx.llmConfig);
      return { steps, attempts: attempt, errors };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(msg);

      if (attempt > ctx.maxRetries) {
        throw new Error(
          `LLM script generation failed after ${attempt} attempts. Errors:\n${errors.join('\n')}`,
        );
      }
    }
  }

  throw new Error('Unexpected retry loop exit');
}
