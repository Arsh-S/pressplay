import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../src/lib/schema';

describe('database schema', () => {
  let sqlite: Database.Database;
  let db: ReturnType<typeof drizzle>;

  beforeAll(() => {
    sqlite = new Database(':memory:');
    db = drizzle(sqlite, { schema });

    sqlite.exec(`
      CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT, email TEXT UNIQUE, email_verified INTEGER, image TEXT, created_at INTEGER);
      CREATE TABLE accounts (user_id TEXT NOT NULL, type TEXT NOT NULL, provider TEXT NOT NULL, provider_account_id TEXT NOT NULL, refresh_token TEXT, access_token TEXT, expires_at INTEGER, token_type TEXT, scope TEXT, id_token TEXT, session_state TEXT, PRIMARY KEY (provider, provider_account_id));
      CREATE TABLE sessions (session_token TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires INTEGER NOT NULL);
      CREATE TABLE installations (id TEXT PRIMARY KEY, github_installation_id INTEGER NOT NULL UNIQUE, account_login TEXT NOT NULL, account_type TEXT NOT NULL, installed_by TEXT, created_at INTEGER);
      CREATE TABLE repos (id TEXT PRIMARY KEY, installation_id TEXT NOT NULL, github_repo_id INTEGER NOT NULL UNIQUE, full_name TEXT NOT NULL, default_branch TEXT DEFAULT 'main', active INTEGER DEFAULT 1, created_at INTEGER);
      CREATE TABLE repo_settings (repo_id TEXT PRIMARY KEY, llm_provider TEXT DEFAULT 'anthropic', llm_api_key TEXT, config_json TEXT, preview_url_pattern TEXT);
      CREATE TABLE jobs (id TEXT PRIMARY KEY, repo_id TEXT NOT NULL, pr_number INTEGER NOT NULL, pr_title TEXT, base_sha TEXT NOT NULL, head_sha TEXT NOT NULL, preview_url TEXT, status TEXT NOT NULL DEFAULT 'pending', video_url TEXT, gif_url TEXT, comment_id INTEGER, steps_json TEXT, error TEXT, duration_ms INTEGER, created_at INTEGER, started_at INTEGER, completed_at INTEGER);
    `);
  });

  afterAll(() => sqlite.close());

  it('inserts and queries a user', async () => {
    await db.insert(schema.users).values({ id: 'u1', name: 'Test', email: 'test@example.com' });
    const rows = await db.select().from(schema.users);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Test');
  });

  it('inserts an installation', async () => {
    await db.insert(schema.installations).values({
      id: 'i1', githubInstallationId: 12345, accountLogin: 'myorg', accountType: 'Organization',
    });
    const rows = await db.select().from(schema.installations);
    expect(rows).toHaveLength(1);
    expect(rows[0].accountLogin).toBe('myorg');
  });

  it('inserts a repo with settings', async () => {
    await db.insert(schema.repos).values({
      id: 'r1', installationId: 'i1', githubRepoId: 99999, fullName: 'myorg/myrepo',
    });
    await db.insert(schema.repoSettings).values({
      repoId: 'r1', llmProvider: 'anthropic', previewUrlPattern: 'https://preview-{pr}.example.com',
    });
    const rows = await db.select().from(schema.repoSettings);
    expect(rows).toHaveLength(1);
    expect(rows[0].previewUrlPattern).toContain('{pr}');
  });

  it('inserts a job', async () => {
    await db.insert(schema.jobs).values({
      id: 'j1', repoId: 'r1', prNumber: 42, baseSha: 'abc', headSha: 'def', status: 'pending',
    });
    const rows = await db.select().from(schema.jobs);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('pending');
  });

  it('enforces unique github_repo_id', () => {
    expect(() =>
      sqlite.exec("INSERT INTO repos (id, installation_id, github_repo_id, full_name) VALUES ('r2', 'i1', 99999, 'dup/repo')")
    ).toThrow();
  });
});
