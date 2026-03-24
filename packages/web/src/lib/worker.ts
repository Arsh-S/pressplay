import { db } from './db';
import { jobs, repos, repoSettings, installations } from './schema';
import { eq, and, sql } from 'drizzle-orm';
import { run, parseConfig } from '@pressplay/core';
import type { PipelineResult } from '@pressplay/core';
import { getInstallationOctokit } from './github';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const WORK_DIR = process.env.WORK_DIR || '/tmp/pressplay-jobs';

export async function processNextJob(): Promise<boolean> {
  // Atomic claim: find a pending job and mark it running in one step
  // This prevents two worker polls from grabbing the same job
  const pendingJobs = await db
    .select()
    .from(jobs)
    .where(eq(jobs.status, 'pending'))
    .limit(1);

  if (pendingJobs.length === 0) return false;

  const job = pendingJobs[0];

  // Atomic claim — only update if still pending (another worker might have claimed it)
  const claimed = await db
    .update(jobs)
    .set({ status: 'running', startedAt: new Date() })
    .where(and(eq(jobs.id, job.id), eq(jobs.status, 'pending')))
    .returning();

  if (claimed.length === 0) return false; // Another worker got it first

  try {
    await executeJob(job);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await db
      .update(jobs)
      .set({ status: 'failed', error: errorMsg, completedAt: new Date() })
      .where(eq(jobs.id, job.id));
  }

  return true;
}

type Job = typeof jobs.$inferSelect;

async function executeJob(job: Job) {
  // Get repo and settings
  const [repo] = await db.select().from(repos).where(eq(repos.id, job.repoId));
  if (!repo) throw new Error(`Repo not found: ${job.repoId}`);

  const [settings] = await db
    .select()
    .from(repoSettings)
    .where(eq(repoSettings.repoId, repo.id));
  const [install] = await db
    .select()
    .from(installations)
    .where(eq(installations.id, repo.installationId));
  if (!install) throw new Error(`Installation not found: ${repo.installationId}`);

  // Get the preview URL
  let previewUrl = job.previewUrl;
  if (!previewUrl && settings?.previewUrlPattern) {
    previewUrl = settings.previewUrlPattern.replace('{pr}', String(job.prNumber));
  }
  if (!previewUrl) {
    throw new Error(
      'No preview URL available. Configure a preview URL pattern in repo settings.',
    );
  }

  // Get the LLM API key
  const llmApiKey = settings?.llmApiKey || process.env.ANTHROPIC_API_KEY;
  if (!llmApiKey) {
    throw new Error(
      'No LLM API key configured. Add one in repo settings or set ANTHROPIC_API_KEY.',
    );
  }

  // Get an authenticated GitHub client for this installation
  const octokit = await getInstallationOctokit(install.githubInstallationId);

  // Get the diff
  const [owner, repoName] = repo.fullName.split('/');
  const { data: diffData } = await octokit.request(
    'GET /repos/{owner}/{repo}/compare/{basehead}',
    {
      owner,
      repo: repoName,
      basehead: `${job.baseSha}...${job.headSha}`,
      headers: { accept: 'application/vnd.github.v3.diff' },
    },
  );
  const rawDiff = diffData as unknown as string;

  // Set up work directory
  const jobDir = join(WORK_DIR, job.id);
  mkdirSync(join(jobDir, 'recordings'), { recursive: true });
  mkdirSync(join(jobDir, 'screenshots'), { recursive: true });

  // Parse config overrides
  const configOverrides = settings?.configJson
    ? (JSON.parse(settings.configJson) as Record<string, unknown>)
    : {};
  const config = parseConfig({
    diff: {
      // Broad pattern — match frontend files anywhere in the repo
      include: ['**/*.{tsx,jsx,vue,svelte,css,scss,html}'],
    },
    ...configOverrides,
    publish: { comment: false, artifact: false }, // We handle publishing ourselves
  });

  // Run the pipeline
  const originalCwd = process.cwd();
  process.chdir(jobDir);

  try {
    const result = await run({
      config,
      previewUrl,
      rawDiff,
      llmApiKey,
      githubToken: '',
      owner,
      repo: repoName,
      prNumber: job.prNumber,
    });

    // Update job with results
    const updateData: Partial<{
      status: string;
      completedAt: Date;
      stepsJson: string;
      durationMs: number;
      videoUrl: string;
      gifUrl: string;
      error: string;
    }> = {
      status: 'completed',
      completedAt: new Date(),
      stepsJson: JSON.stringify(result.steps),
      durationMs: result.recording?.durationMs,
    };

    if (result.postProd?.mp4Path) {
      updateData.videoUrl = result.postProd.mp4Path;
    }
    if (result.postProd?.gifPath) {
      updateData.gifUrl = result.postProd.gifPath;
    }
    if (result.error) {
      updateData.error = result.error;
    }

    await db.update(jobs).set(updateData).where(eq(jobs.id, job.id));
    console.log('Job updated in DB. Video:', updateData.videoUrl, 'Steps:', result.steps.length);

    // Post PR comment with the video
    try {
      console.log('Posting PR comment to', owner + '/' + repoName, '#' + job.prNumber);
      await postPRComment(octokit, owner, repoName, job, result);
      console.log('PR comment posted successfully');
    } catch (commentErr) {
      console.error('Failed to post PR comment:', commentErr);
    }
  } finally {
    process.chdir(originalCwd);
  }
}

/**
 * Upload video/gif as GitHub release assets so they're publicly accessible.
 * Creates or reuses a "pressplay-assets" release tag on the repo.
 */
async function uploadVideoAssets(
  octokit: Awaited<ReturnType<typeof getInstallationOctokit>>,
  owner: string,
  repoName: string,
  jobId: string,
  result: PipelineResult,
): Promise<{ mp4Url: string | null; gifUrl: string | null }> {
  const urls = { mp4Url: null as string | null, gifUrl: null as string | null };
  const tag = 'pressplay-assets';

  try {
    // Get or create the release
    let releaseId: number;
    try {
      const { data } = await octokit.request('GET /repos/{owner}/{repo}/releases/tags/{tag}', {
        owner, repo: repoName, tag,
      });
      releaseId = data.id;
    } catch {
      const { data } = await octokit.request('POST /repos/{owner}/{repo}/releases', {
        owner, repo: repoName, tag_name: tag,
        name: 'PRessPlay Demo Assets',
        body: 'Auto-generated demo videos by PRessPlay. Do not delete this release.',
        draft: false,
        prerelease: true,
      });
      releaseId = data.id;
    }

    // Upload MP4
    if (result.postProd?.mp4Path) {
      const fileData = readFileSync(result.postProd.mp4Path);
      const { data } = await octokit.request('POST {url}', {
        url: `https://uploads.github.com/repos/${owner}/${repoName}/releases/${releaseId}/assets?name=demo-${jobId.slice(0, 8)}.mp4`,
        headers: { 'content-type': 'video/mp4', 'content-length': String(fileData.length) },
        data: fileData,
      });
      urls.mp4Url = data.browser_download_url;
    }

    // Upload GIF
    if (result.postProd?.gifPath) {
      const fileData = readFileSync(result.postProd.gifPath);
      const { data } = await octokit.request('POST {url}', {
        url: `https://uploads.github.com/repos/${owner}/${repoName}/releases/${releaseId}/assets?name=demo-${jobId.slice(0, 8)}.gif`,
        headers: { 'content-type': 'image/gif', 'content-length': String(fileData.length) },
        data: fileData,
      });
      urls.gifUrl = data.browser_download_url;
    }
  } catch (err) {
    console.error('Failed to upload video assets:', err);
  }

  return urls;
}

async function postPRComment(
  octokit: Awaited<ReturnType<typeof getInstallationOctokit>>,
  owner: string,
  repoName: string,
  job: Job,
  result: PipelineResult,
) {
  const marker = '<!-- pressplay-demo -->';

  const logoUrl = 'https://raw.githubusercontent.com/Arsh-S/pressplay/main/public/images/PRessPlay_logo_transparent.png';

  const lines = [
    marker,
    `<a href="https://github.com/Arsh-S/pressplay"><img src="${logoUrl}" alt="PRessPlay" width="200" /></a>`,
    '',
    `### Demo — PR #${job.prNumber}`,
    '',
  ];

  // Try to upload video as a GitHub release asset and embed in comment
  if (result.postProd?.mp4Path || result.postProd?.gifPath) {
    try {
      const urls = await uploadVideoAssets(octokit, owner, repoName, job.id, result);
      if (urls.gifUrl) {
        lines.push(`![Demo](${urls.gifUrl})`, '');
      }
      if (urls.mp4Url) {
        lines.push(`📹 [Watch full video (MP4)](${urls.mp4Url})`, '');
      }
    } catch (uploadErr) {
      console.error('Video upload failed (need Contents:Write permission on GitHub App):', uploadErr);
      lines.push('> *Video was generated but could not be uploaded. Grant Contents:Write permission to the GitHub App to enable video embedding.*', '');
    }
  }

  lines.push('> Automated demo of frontend changes', '');

  if (result.steps.length > 0) {
    lines.push('### What was demonstrated:', '');
    const stepsWithNotes = result.steps.filter((s) => s.note);
    stepsWithNotes.forEach((s, i) => {
      lines.push(`${i + 1}. ${s.note}`);
    });
    lines.push('');
  }

  if (result.recording?.durationMs) {
    lines.push('<details><summary>Recording details</summary>', '');
    lines.push(
      `- Duration: ${Math.round(result.recording.durationMs / 1000)}s`,
    );
    lines.push(`- Steps: ${result.steps.length}`);
    if (result.fallback) lines.push(`- Fallback: ${result.fallback}`);
    lines.push('', '</details>', '');
  }

  lines.push(
    '---',
    '*Generated by [PRessPlay](https://github.com/Arsh-S/pressplay)*',
  );

  const body = lines.join('\n');

  // Check for existing comment to update
  const { data: comments } = await octokit.request(
    'GET /repos/{owner}/{repo}/issues/{issue_number}/comments',
    {
      owner,
      repo: repoName,
      issue_number: job.prNumber,
      per_page: 100,
    },
  );

  const existing = comments.find(
    (c: { body?: string | null }) => c.body?.includes(marker),
  );

  if (existing) {
    await octokit.request(
      'PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}',
      {
        owner,
        repo: repoName,
        comment_id: existing.id,
        body,
      },
    );
  } else {
    const { data } = await octokit.request(
      'POST /repos/{owner}/{repo}/issues/{issue_number}/comments',
      {
        owner,
        repo: repoName,
        issue_number: job.prNumber,
        body,
      },
    );
    // Save comment ID for future updates
    await db
      .update(jobs)
      .set({ commentId: data.id })
      .where(eq(jobs.id, job.id));
  }
}

/**
 * Simple polling worker — call this to process the next pending job.
 * Returns true if a job was processed, false if queue is empty.
 */
export async function runWorkerOnce(): Promise<boolean> {
  return processNextJob();
}
