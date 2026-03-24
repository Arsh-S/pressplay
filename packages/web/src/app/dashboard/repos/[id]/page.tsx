import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { repos, repoSettings, jobs } from '@/lib/schema';
import { eq, desc } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { SettingsForm } from './settings-form';

export default async function RepoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
      <div className="mb-6">
        <a href="/dashboard" className="text-sm text-gray-500 hover:underline">&larr; Back to dashboard</a>
        <h1 className="text-2xl font-bold mt-2">{repo.fullName}</h1>
      </div>

      <div className="grid gap-6">
        <section className="border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Settings</h2>
          <SettingsForm repoId={id} settings={settings || null} />
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">Job History</h2>
          {repoJobs.length === 0 ? (
            <p className="text-gray-400 text-sm">No jobs yet. PRessPlay will run automatically when a PR is opened.</p>
          ) : (
            <div className="border rounded-lg divide-y">
              {repoJobs.map(job => (
                <div key={job.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">PR #{job.prNumber} {job.prTitle && `— ${job.prTitle}`}</p>
                      <p className="text-xs text-gray-400 font-mono">{job.headSha?.slice(0, 7)}</p>
                    </div>
                    <div className="text-right">
                      <StatusBadge status={job.status} />
                      {job.durationMs && <p className="text-xs text-gray-400 mt-1">{(job.durationMs / 1000).toFixed(1)}s</p>}
                    </div>
                  </div>
                  {job.error && <p className="text-sm text-red-500 mt-2">{job.error}</p>}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    running: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
  };
  return <span className={`text-xs px-2 py-1 rounded ${styles[status] || 'bg-gray-100'}`}>{status}</span>;
}
