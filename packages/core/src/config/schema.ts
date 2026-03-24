import { z } from 'zod';

const appSchema = z.object({
  hint: z.string().default(''),
}).default({});

const diffSchema = z.object({
  include: z.array(z.string()).default(['src/**/*.{tsx,jsx,vue,svelte,css,scss,html}']),
  exclude: z.array(z.string()).default(['**/*.test.*', '**/*.spec.*', '**/*.stories.*', '__tests__/**']),
  maxTokens: z.number().int().positive().default(8000),
}).default({});

const llmSchema = z.object({
  provider: z.enum(['anthropic', 'openai']).default('anthropic'),
  model: z.string().optional(),
  maxRetries: z.number().int().min(0).max(5).default(2),
  temperature: z.number().min(0).max(1).default(0.3),
}).default({});

const viewportSchema = z.object({
  width: z.number().int().positive().default(1920),
  height: z.number().int().positive().default(1080),
}).default({});

const recordingSchema = z.object({
  viewport: viewportSchema,
  maxDuration: z.number().positive().default(30),
  waitAfterComplete: z.number().int().min(0).default(1000),
  headless: z.boolean().default(true),
  storageState: z.string().optional(),
}).default({});

const gifSchema = z.object({
  enabled: z.boolean().default(true),
  maxWidth: z.number().int().positive().default(800),
  fps: z.number().int().positive().default(10),
  maxSizeMB: z.number().positive().default(10),
}).default({});

const mp4Schema = z.object({
  enabled: z.boolean().default(true),
}).default({});

const postProductionSchema = z.object({
  mode: z.enum(['lightweight', 'polished']).default('lightweight'),
  gif: gifSchema,
  mp4: mp4Schema,
}).default({});

const triggerSchema = z.object({
  mode: z.enum(['auto', 'on-demand', 'smart']).default('auto'),
  onDemandCommand: z.string().default('/pressplay'),
}).default({});

const publishSchema = z.object({
  comment: z.boolean().default(true),
  artifact: z.boolean().default(true),
  artifactRetentionDays: z.number().int().positive().default(30),
}).default({});

const configSchema = z.object({
  app: appSchema,
  diff: diffSchema,
  routeMap: z.record(z.string(), z.string()).default({}),
  llm: llmSchema,
  recording: recordingSchema,
  postProduction: postProductionSchema,
  trigger: triggerSchema,
  publish: publishSchema,
});

export type PRessPlayConfig = z.infer<typeof configSchema>;

export function parseConfig(raw: unknown): PRessPlayConfig {
  return configSchema.parse(raw ?? {});
}
