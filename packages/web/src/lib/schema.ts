import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';

// ============ NextAuth tables ============

export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: integer('email_verified', { mode: 'timestamp' }),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const accounts = sqliteTable('accounts', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('provider_account_id').notNull(),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  expires_at: integer('expires_at'),
  token_type: text('token_type'),
  scope: text('scope'),
  id_token: text('id_token'),
  session_state: text('session_state'),
}, (table) => [
  primaryKey({ columns: [table.provider, table.providerAccountId] }),
]);

export const sessions = sqliteTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: integer('expires', { mode: 'timestamp' }).notNull(),
});

export const verificationTokens = sqliteTable('verification_tokens', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull(),
  expires: integer('expires', { mode: 'timestamp' }).notNull(),
}, (table) => [
  primaryKey({ columns: [table.identifier, table.token] }),
]);

// ============ PRessPlay tables ============

export const installations = sqliteTable('installations', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  githubInstallationId: integer('github_installation_id').notNull().unique(),
  accountLogin: text('account_login').notNull(),
  accountType: text('account_type').notNull(),
  installedBy: text('installed_by').references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const repos = sqliteTable('repos', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  installationId: text('installation_id').notNull().references(() => installations.id, { onDelete: 'cascade' }),
  githubRepoId: integer('github_repo_id').notNull().unique(),
  fullName: text('full_name').notNull(),
  defaultBranch: text('default_branch').default('main'),
  active: integer('active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const repoSettings = sqliteTable('repo_settings', {
  repoId: text('repo_id').primaryKey().references(() => repos.id, { onDelete: 'cascade' }),
  llmProvider: text('llm_provider').default('anthropic'),
  llmApiKey: text('llm_api_key'),
  configJson: text('config_json'),
  previewUrlPattern: text('preview_url_pattern'),
});

export const jobs = sqliteTable('jobs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  repoId: text('repo_id').notNull().references(() => repos.id, { onDelete: 'cascade' }),
  prNumber: integer('pr_number').notNull(),
  prTitle: text('pr_title'),
  baseSha: text('base_sha').notNull(),
  headSha: text('head_sha').notNull(),
  previewUrl: text('preview_url'),
  status: text('status').notNull().default('pending'),
  videoUrl: text('video_url'),
  gifUrl: text('gif_url'),
  commentId: integer('comment_id'),
  stepsJson: text('steps_json'),
  error: text('error'),
  durationMs: integer('duration_ms'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
});
