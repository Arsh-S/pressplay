import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { repos, repoSettings, jobs } from '@/lib/schema';
import { eq, desc } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { StatusBadge } from '@/components/status-badge';
import { SettingsForm } from './settings-form';

export default async function RepoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const activeTab = tab || 'jobs';

  const session = await auth();

  const [repo] = await db.select().from(repos).where(eq(repos.id, id));
  if (!repo) notFound();

  const [settings] = await db.select().from(repoSettings).where(eq(repoSettings.repoId, id));

  const repoJobs = await db.select().from(jobs)
    .where(eq(jobs.repoId, id))
    .orderBy(desc(jobs.createdAt))
    .limit(20);

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center mb-5 text-sm">
        <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-300">Dashboard</Link>
        <span className="text-zinc-700 mx-1.5">/</span>
        <span className="text-sm text-zinc-400">{repo.fullName}</span>
      </div>

      {/* Page header */}
      <div className="flex items-center gap-3 mb-7">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-50">{repo.fullName}</h1>
        {repo.active ? (
          <span className="bg-green-400/15 text-green-400 rounded-full px-2.5 py-0.5 text-[11px] font-medium">
            Active
          </span>
        ) : (
          <span className="bg-zinc-400/15 text-zinc-400 rounded-full px-2.5 py-0.5 text-[11px] font-medium">
            Paused
          </span>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-0 border-b border-zinc-800 mb-7">
        <Link
          href="?tab=jobs"
          className={
            activeTab === 'jobs'
              ? 'px-4 py-2.5 text-sm font-medium text-zinc-50 border-b-2 border-indigo-500'
              : 'px-4 py-2.5 text-sm text-zinc-500 hover:text-zinc-300'
          }
        >
          Jobs
        </Link>
        <Link
          href="?tab=settings"
          className={
            activeTab === 'settings'
              ? 'px-4 py-2.5 text-sm font-medium text-zinc-50 border-b-2 border-indigo-500'
              : 'px-4 py-2.5 text-sm text-zinc-500 hover:text-zinc-300'
          }
        >
          Settings
        </Link>
      </div>

      {/* Tab content */}
      {activeTab === 'settings' ? (
        <SettingsForm repoId={id} settings={settings || null} />
      ) : (
        <>
          {repoJobs.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl py-12 text-center">
              <p className="text-zinc-500 text-sm">No videos generated yet. Open a pull request to get started.</p>
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              {/* Header row */}
              <div className="grid grid-cols-[50px_1fr_90px_70px_70px] text-[11px] uppercase tracking-wider text-zinc-600 px-4 py-2.5 border-b border-zinc-800">
                <span>PR</span>
                <span>Title</span>
                <span>Commit</span>
                <span>Duration</span>
                <span>Status</span>
              </div>
              {/* Data rows */}
              {repoJobs.map((job, i) => (
                <div key={job.id}>
                  <div
                    className={`grid grid-cols-[50px_1fr_90px_70px_70px] items-center px-4 py-3.5 ${i < repoJobs.length - 1 ? 'border-b border-zinc-800/50' : ''}`}
                  >
                    <span className="text-indigo-400 font-mono font-semibold">#{job.prNumber}</span>
                    <span className="text-zinc-50 text-sm pr-4">{job.prTitle || `PR #${job.prNumber}`}</span>
                    <span className="text-zinc-600 font-mono text-[11px]">{job.headSha?.slice(0, 7) ?? '—'}</span>
                    <span className="text-zinc-400 text-sm">
                      {job.durationMs != null ? `${(job.durationMs / 1000).toFixed(1)}s` : '—'}
                    </span>
                    <span>
                      <StatusBadge status={job.status} />
                    </span>
                  </div>
                  {job.error && (
                    <div className={`px-4 pb-3 -mt-1 ${i < repoJobs.length - 1 ? 'border-b border-zinc-800/50' : ''}`}>
                      <p className="text-[12px] text-red-400/70">{job.error}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
