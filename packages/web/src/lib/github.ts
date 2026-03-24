import { App } from '@octokit/app';

let _app: App | null = null;

export function getGitHubApp(): App {
  if (_app) return _app;

  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_PRIVATE_KEY;
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;

  if (!appId || !privateKey) {
    throw new Error('GITHUB_APP_ID and GITHUB_PRIVATE_KEY must be set');
  }

  _app = new App({
    appId,
    privateKey: privateKey.replace(/\\n/g, '\n'),
    webhooks: { secret: webhookSecret || '' },
  });

  return _app;
}

/**
 * Get an authenticated Octokit instance for a specific installation.
 */
export async function getInstallationOctokit(installationId: number) {
  const app = getGitHubApp();
  return app.getInstallationOctokit(installationId);
}
