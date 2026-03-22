import { resolve } from 'node:path';
import { parseConfig, type PRessPlayConfig } from './schema.js';

export async function loadConfig(configPath?: string): Promise<PRessPlayConfig> {
  if (!configPath) {
    return parseConfig({});
  }

  const fullPath = resolve(configPath);
  const raw = await import(fullPath);
  const exported = raw.default ?? raw;
  return parseConfig(exported);
}
