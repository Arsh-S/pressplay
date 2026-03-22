import { Octokit } from '@octokit/rest';
import { formatComment, type CommentData } from './comment.js';

export interface PublishConfig {
  token: string;
  owner: string;
  repo: string;
  prNumber: number;
}

export interface ArtifactPaths {
  mp4Path?: string;
  gifPath?: string;
}

const COMMENT_MARKER = '<!-- pressplay-demo -->';

export async function uploadArtifacts(
  paths: ArtifactPaths,
  retentionDays: number,
): Promise<{ mp4Url: string | null; gifUrl: string | null }> {
  const result = { mp4Url: null as string | null, gifUrl: null as string | null };

  if (!process.env.GITHUB_ACTIONS) {
    result.mp4Url = paths.mp4Path ?? null;
    result.gifUrl = paths.gifPath ?? null;
    return result;
  }

  try {
    const { DefaultArtifactClient } = await import('@actions/artifact');
    const artifact = new DefaultArtifactClient();

    const filesToUpload: string[] = [];
    if (paths.mp4Path) filesToUpload.push(paths.mp4Path);
    if (paths.gifPath) filesToUpload.push(paths.gifPath);

    if (filesToUpload.length > 0) {
      const { id } = await artifact.uploadArtifact(
        'pressplay-demo',
        filesToUpload,
        '.',
        { retentionDays },
      );

      const serverUrl = process.env.GITHUB_SERVER_URL ?? 'https://github.com';
      const repo = process.env.GITHUB_REPOSITORY ?? '';
      const runId = process.env.GITHUB_RUN_ID ?? '';
      const artifactUrl = `${serverUrl}/${repo}/actions/runs/${runId}/artifacts/${id}`;

      if (paths.mp4Path) result.mp4Url = artifactUrl;
      if (paths.gifPath) result.gifUrl = artifactUrl;
    }
  } catch {
    result.mp4Url = paths.mp4Path ?? null;
    result.gifUrl = paths.gifPath ?? null;
  }

  return result;
}

export async function publishToPR(
  config: PublishConfig,
  commentData: CommentData,
): Promise<string> {
  const octokit = new Octokit({ auth: config.token });
  const body = COMMENT_MARKER + '\n' + formatComment(commentData);

  const { data: comments } = await octokit.issues.listComments({
    owner: config.owner,
    repo: config.repo,
    issue_number: config.prNumber,
    per_page: 100,
  });

  const existing = comments.find((c) => c.body?.includes(COMMENT_MARKER));

  if (existing) {
    const { data } = await octokit.issues.updateComment({
      owner: config.owner,
      repo: config.repo,
      comment_id: existing.id,
      body,
    });
    return data.html_url;
  }

  const { data } = await octokit.issues.createComment({
    owner: config.owner,
    repo: config.repo,
    issue_number: config.prNumber,
    body,
  });

  return data.html_url;
}
