import Link from 'next/link';
import { auth, signIn, signOut } from '@/lib/auth';
import { Logo } from './logo';

export async function Header() {
  const session = await auth();

  return (
    <header className="flex items-center justify-between border-b border-zinc-800 px-6 py-3">
      <div className="flex items-center gap-6">
        <Logo />
        <nav className="flex items-center gap-4 text-[13px]">
          {session?.user && (
            <Link href="/dashboard" className="font-medium text-zinc-50 hover:text-white">
              Dashboard
            </Link>
          )}
          <a
            href="https://github.com/pressplay-ai/pressplay"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-500 hover:text-zinc-300"
          >
            GitHub
          </a>
          <a
            href="https://github.com/pressplay-ai/pressplay#readme"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-500 hover:text-zinc-300"
          >
            Docs
          </a>
        </nav>
      </div>
      <nav className="flex items-center gap-3">
        {session?.user ? (
          <>
            <div className="flex items-center gap-2">
              {session.user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={session.user.image} alt="" className="h-6 w-6 rounded-full" />
              ) : (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 text-[10px] text-zinc-400">
                  {(session.user.name || '?')[0].toUpperCase()}
                </div>
              )}
              <span className="font-mono text-[13px] text-zinc-400">{session.user.name}</span>
            </div>
            <form action={async () => { 'use server'; await signOut({ redirectTo: '/' }); }}>
              <button className="text-[13px] text-zinc-600 hover:text-zinc-400">Sign out</button>
            </form>
          </>
        ) : (
          <form action={async () => { 'use server'; await signIn('github', { redirectTo: '/dashboard' }); }}>
            <button className="rounded-lg bg-indigo-500 px-3.5 py-1.5 text-[13px] font-medium text-white hover:bg-indigo-400 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50">
              Sign in with GitHub
            </button>
          </form>
        )}
      </nav>
    </header>
  );
}
