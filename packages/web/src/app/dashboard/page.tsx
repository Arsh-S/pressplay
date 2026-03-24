import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { installations, repos, jobs } from '@/lib/schema';
import { eq, desc, count } from 'drizzle-orm';
import Link from 'next/link';

export default async function DashboardPage() {
  const session = await auth();

  const allInstallations = await db.select().from(installations).orderBy(desc(installations.createdAt));

  const repoList = await db.select().from(repos).orderBy(repos.fullName);

  const recentJobs = await db.select().from(jobs).orderBy(desc(jobs.createdAt)).limit(10);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <a
          href={`https://github.com/apps/${process.env.GITHUB_APP_SLUG || 'pressplay'}/installations/new`}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-black text-white text-sm px-4 py-2 rounded hover:bg-gray-800"
        >
          Install on Repository
        </a>
      </div>

      {allInstallations.length === 0 ? (
        <div className="border rounded-lg p-8 text-center text-gray-400">
          <p className="text-lg mb-2">No repositories connected yet.</p>
          <p className="text-sm">Click &quot;Install on Repository&quot; to add the PRessPlay GitHub App to your repos.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-semibold mb-3">Repositories</h2>
            <div className="border rounded-lg divide-y">
              {repoList.map(repo => {
                const repoJobs = recentJobs.filter(j => j.repoId === repo.id);
                const latestJob = repoJobs[0];
                return (
                  <Link key={repo.id} href={`/dashboard/repos/${repo.id}`} className="flex items-center justify-between p-4 hover:bg-gray-50 transition">
                    <div>
                      <p className="font-medium">{repo.fullName}</p>
                      <p className="text-sm text-gray-500">
                        {latestJob ? `Last run: PR #${latestJob.prNumber} — ${latestJob.status}` : 'No runs yet'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {repo.active ? (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Active</span>
                      ) : (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded">Paused</span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          {recentJobs.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-3">Recent Jobs</h2>
              <div className="border rounded-lg divide-y">
                {recentJobs.map(job => (
                  <div key={job.id} className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-medium">PR #{job.prNumber} {job.prTitle && `— ${job.prTitle}`}</p>
                      <p className="text-sm text-gray-500">{job.createdAt ? new Date(job.createdAt as unknown as string).toLocaleString() : ''}</p>
                    </div>
                    <StatusBadge status={job.status} />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
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
