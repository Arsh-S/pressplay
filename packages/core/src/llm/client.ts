import type { Step } from '../types.js';
import type { PromptPair } from './prompt.js';
import { parseSteps } from './parser.js';

export interface LLMClientConfig {
  provider: 'anthropic' | 'openai';
  model?: string;
  apiKey: string;
  temperature: number;
}

const DEFAULT_MODELS: Record<string, string> = {
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-4o',
};

export async function generateSteps(
  prompt: PromptPair,
  config: LLMClientConfig,
): Promise<Step[]> {
  const model = config.model ?? DEFAULT_MODELS[config.provider];

  if (config.provider === 'anthropic') {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: config.apiKey });

    const response = await client.messages.create({
      model,
      max_tokens: 2048,
      temperature: config.temperature,
      system: prompt.system,
      messages: [{ role: 'user', content: prompt.user }],
    });

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');

    return parseSteps(text);
  }

  if (config.provider === 'openai') {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey: config.apiKey });

    const response = await client.chat.completions.create({
      model,
      temperature: config.temperature,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
    });

    const text = response.choices[0]?.message?.content ?? '';
    return parseSteps(text);
  }

  throw new Error(`Unsupported LLM provider: ${config.provider}`);
}
