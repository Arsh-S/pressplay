import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { db } from '@/lib/db';
import { installations, repos, jobs } from '@/lib/schema';
import { eq } from 'drizzle-orm';

function verifySignature(payload: string, signature: string | null, secret: string): boolean {
  if (!secret || !signature) return !secret; // Skip verification if no secret configured
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export async function POST(req: NextRequest) {
  const payload = await req.text();
  const signature = req.headers.get('x-hub-signature-256');
  const event = req.headers.get('x-github-event');

  // Verify webhook signature
  const secret = process.env.GITHUB_WEBHOOK_SECRET || '';
  if (!verifySignature(payload, signature, secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const data = JSON.parse(payload);

  try {
    switch (event) {
      case 'installation':
        await handleInstallation(data);
        break;
      case 'installation_repositories':
        await handleInstallationRepos(data);
        break;
      case 'pull_request':
        await handlePullRequest(data);
        break;
      default:
        // Ignore other events
        break;
    }
  } catch (err) {
    console.error(`Webhook error (${event}):`, err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

async function handleInstallation(data: Record<string, unknown>) {
  const { action, installation: inst } = data as {
    action: string;
    installation: { id: number; account: { login: string; type: string } };
    repositories?: Array<{ id: number; full_name: string }>;
  };

  if (action === 'created') {
    // New installation -- save it and its repos
    await db.insert(installations).values({
      githubInstallationId: inst.id,
      accountLogin: inst.account.login,
      accountType: inst.account.type,
    }).onConflictDoNothing();

    // Get the installation record
    const [install] = await db.select().from(installations)
      .where(eq(installations.githubInstallationId, inst.id));

    const repositories = (data as { repositories?: Array<{ id: number; full_name: string }> }).repositories;
    if (install && repositories) {
      for (const repo of repositories) {
        await db.insert(repos).values({
          installationId: install.id,
          githubRepoId: repo.id,
          fullName: repo.full_name,
        }).onConflictDoNothing();
      }
    }
  } else if (action === 'deleted') {
    // Installation removed -- cascade delete handles repos/jobs
    const [install] = await db.select().from(installations)
      .where(eq(installations.githubInstallationId, inst.id));
    if (install) {
      await db.delete(installations).where(eq(installations.id, install.id));
    }
  }
}

async function handleInstallationRepos(data: Record<string, unknown>) {
  const {
    installation: inst,
    repositories_added: reposAdded,
    repositories_removed: reposRemoved,
  } = data as {
    installation: { id: number };
    repositories_added?: Array<{ id: number; full_name: string }>;
    repositories_removed?: Array<{ id: number; full_name: string }>;
  };

  const [install] = await db.select().from(installations)
    .where(eq(installations.githubInstallationId, inst.id));
  if (!install) return;

  if (reposAdded) {
    for (const repo of reposAdded) {
      await db.insert(repos).values({
        installationId: install.id,
        githubRepoId: repo.id,
        fullName: repo.full_name,
      }).onConflictDoNothing();
    }
  }

  if (reposRemoved) {
    for (const repo of reposRemoved) {
      await db.delete(repos).where(eq(repos.githubRepoId, repo.id));
    }
  }
}

async function handlePullRequest(data: Record<string, unknown>) {
  const { action, pull_request: pr, repository } = data as {
    action: string;
    pull_request: {
      number: number;
      title: string;
      base: { sha: string };
      head: { sha: string };
    };
    repository: { id: number };
    installation: { id: number };
  };

  // Only process on opened or synchronize (new commits pushed)
  if (action !== 'opened' && action !== 'synchronize') return;

  // Find the repo in our database
  const [repo] = await db.select().from(repos)
    .where(eq(repos.githubRepoId, repository.id));
  if (!repo || !repo.active) return;

  // Create a job for this PR
  await db.insert(jobs).values({
    repoId: repo.id,
    prNumber: pr.number,
    prTitle: pr.title,
    baseSha: pr.base.sha,
    headSha: pr.head.sha,
    status: 'pending',
  });
}
