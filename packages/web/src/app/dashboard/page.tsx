import { auth } from '@/lib/auth';

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <p className="text-gray-600 mb-6">Welcome, {session?.user?.name}.</p>
      <div className="border rounded-lg p-6 text-center text-gray-400">
        <p>No repositories connected yet.</p>
        <p className="text-sm mt-2">Install the PRessPlay GitHub App to get started.</p>
      </div>
    </div>
  );
}
