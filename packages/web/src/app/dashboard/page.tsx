import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { installations, repos, jobs } from '@/lib/schema';
import { eq, desc } from 'drizzle-orm';
import Link from 'next/link';
import { StatusBadge } from '@/components/status-badge';

export default async function DashboardPage() {
  const session = await auth();

  const allInstallations = await db.select().from(installations).orderBy(desc(installations.createdAt));

  const repoList = await db.select().from(repos).orderBy(repos.fullName);

  const recentJobs = await db
    .select({
      id: jobs.id,
      prNumber: jobs.prNumber,
      prTitle: jobs.prTitle,
      status: jobs.status,
      durationMs: jobs.durationMs,
      createdAt: jobs.createdAt,
      error: jobs.error,
      repoId: jobs.repoId,
      repoFullName: repos.fullName,
    })
    .from(jobs)
    .innerJoin(repos, eq(jobs.repoId, repos.id))
    .orderBy(desc(jobs.createdAt))
    .limit(10);

  const installButton = (
    <a
      href={`https://github.com/apps/${process.env.GITHUB_APP_SLUG || 'pressplay'}/installations/new`}
      target="_blank"
      rel="noopener noreferrer"
      className="bg-indigo-500 hover:bg-indigo-400 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
    >
      Install on Repository
    </a>
  );

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Repositories</h1>
          <p className="text-zinc-500 text-sm mt-1">Manage your connected repositories and video generation.</p>
        </div>
        {installButton}
      </div>

      {allInstallations.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
          <p className="text-zinc-400 mb-2 font-medium">No repositories connected yet</p>
          <p className="text-zinc-600 text-sm mb-6">Install the PRessPlay GitHub App to get started.</p>
          {installButton}
        </div>
      ) : (
        <>
          <section>
            <div className="flex flex-col gap-3">
              {repoList.map(repo => {
                const repoJobs = recentJobs.filter(j => j.repoId === repo.id);
                const completedCount = repoJobs.filter(j => j.status === 'completed').length;
                const pendingCount = repoJobs.filter(j => j.status === 'pending' || j.status === 'running').length;
                const latestJob = repoJobs[0];
                const lastRunText = latestJob
                  ? `Last run ${timeAgo(latestJob.createdAt ? new Date(latestJob.createdAt as unknown as string) : null)} · ${completedCount} video${completedCount !== 1 ? 's' : ''} generated`
                  : 'No runs yet';

                return (
                  <Link
                    key={repo.id}
                    href={`/dashboard/repos/${repo.id}`}
                    className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center text-base">
                        📦
                      </div>
                      <div>
                        <p className="font-medium text-zinc-50">{repo.fullName}</p>
                        <p className="text-zinc-600 text-[11px] mt-0.5">{lastRunText}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {pendingCount > 0 && (
                        <span className="bg-indigo-400/15 text-indigo-400 rounded-full px-2.5 py-0.5 text-[11px] font-medium">
                          {pendingCount} pending
                        </span>
                      )}
                      {repo.active ? (
                        <span className="bg-green-400/15 text-green-400 rounded-full px-2.5 py-0.5 text-[11px] font-medium">
                          Active
                        </span>
                      ) : (
                        <span className="bg-zinc-400/15 text-zinc-400 rounded-full px-2.5 py-0.5 text-[11px] font-medium">
                          Paused
                        </span>
                      )}
                      <span className="text-zinc-600">→</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          {recentJobs.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-zinc-50 mb-3">Recent Activity</h2>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
                {recentJobs.map((job, i) => (
                  <div
                    key={job.id}
                    className={`flex items-center justify-between px-4 py-3.5 ${i < recentJobs.length - 1 ? 'border-b border-zinc-800/50' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <StatusBadge status={job.status} />
                      <div>
                        <p className="font-medium text-zinc-50">{job.prTitle || `PR #${job.prNumber}`}</p>
                        <p className="text-zinc-600 text-[11px] mt-0.5 font-mono">
                          #{job.prNumber}
                          <span className="font-sans text-[12px]"> · {job.repoFullName}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-zinc-600">
                      {job.durationMs != null && (
                        <span className="text-zinc-400">{(job.durationMs / 1000).toFixed(1)}s</span>
                      )}
                      <span>{timeAgo(job.createdAt ? new Date(job.createdAt as unknown as string) : null)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function timeAgo(date: Date | null): string {
  if (!date) return '';
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
