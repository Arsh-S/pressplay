import Link from 'next/link';
import { auth, signIn, signOut } from '@/lib/auth';

export async function Header() {
  const session = await auth();

  return (
    <header className="border-b px-6 py-3 flex items-center justify-between">
      <Link href="/" className="text-xl font-bold">PRessPlay</Link>
      <nav className="flex items-center gap-4">
        {session?.user ? (
          <>
            <Link href="/dashboard" className="text-sm hover:underline">Dashboard</Link>
            <span className="text-sm text-gray-500">{session.user.email}</span>
            <form action={async () => { 'use server'; await signOut(); }}>
              <button className="text-sm text-gray-500 hover:underline">Sign out</button>
            </form>
          </>
        ) : (
          <form action={async () => { 'use server'; await signIn('github'); }}>
            <button className="bg-black text-white text-sm px-4 py-2 rounded hover:bg-gray-800">
              Sign in with GitHub
            </button>
          </form>
        )}
      </nav>
    </header>
  );
}
