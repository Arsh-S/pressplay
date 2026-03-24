import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/');
  return <div className="mx-auto max-w-5xl px-6 py-8">{children}</div>;
}
