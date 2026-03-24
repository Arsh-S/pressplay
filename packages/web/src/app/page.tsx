import Link from 'next/link';

export default function Home() {
  return (
    <main className="bg-zinc-950 text-white min-h-screen">
      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center px-6 pt-24 pb-20 text-center overflow-hidden">
        {/* Indigo radial glow */}
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(99,102,241,0.15)_0%,_transparent_70%)]"
          aria-hidden="true"
        />

        <span className="text-indigo-500 font-mono text-[11px] font-medium tracking-[0.1em] uppercase mb-4">
          Automated PR Demo Videos
        </span>

        <h1 className="relative text-4xl md:text-5xl font-bold tracking-tight leading-[1.1] max-w-2xl mx-auto mb-5">
          Stop writing PR descriptions nobody reads
        </h1>

        <p className="relative text-zinc-400 text-lg max-w-xl mx-auto mb-8 leading-relaxed">
          PRessPlay auto-generates demo videos for every pull request. Reviewers
          see what changed in seconds, not minutes.
        </p>

        <div className="relative flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="bg-indigo-500 hover:bg-indigo-400 text-white rounded-lg px-6 py-2.5 text-sm font-medium transition-colors"
          >
            Get Started
          </Link>
          <a
            href="#demo"
            className="border border-zinc-800 text-zinc-400 hover:text-zinc-300 rounded-lg px-6 py-2.5 text-sm transition-colors"
          >
            View Demo
          </a>
        </div>
      </section>

      {/* Terminal mockup */}
      <section id="demo" className="px-6 py-16 border-t border-zinc-800 flex justify-center">
        <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
          {/* Window chrome */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
            <span className="w-3 h-3 bg-zinc-700 rounded-full" />
            <span className="w-3 h-3 bg-zinc-700 rounded-full" />
            <span className="w-3 h-3 bg-zinc-700 rounded-full" />
          </div>
          {/* Terminal body */}
          <div className="px-5 py-5 font-mono text-sm leading-7 space-y-1">
            <p>
              <span className="text-indigo-500">$</span>{' '}
              <span className="text-zinc-300">git push origin feat/new-dashboard</span>
            </p>
            <p className="text-zinc-500">{'  '}→ PR #42 opened</p>
            <p className="text-zinc-500">{'  '}→ PRessPlay recording...</p>
            <p>
              <span className="text-green-400">✓</span>{' '}
              <span className="text-zinc-300">Demo video posted to PR #42</span>
              <span className="text-zinc-600">{'  '}12s</span>
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-20 border-t border-zinc-800">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-indigo-500 font-mono text-[11px] font-medium tracking-[0.1em] uppercase block mb-4">
              How it works
            </span>
            <h2 className="text-3xl font-bold tracking-tight">
              Three steps. Zero config.
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                num: '01',
                title: 'Install GitHub App',
                desc: 'Connect PRessPlay to your repositories in one click from the GitHub Marketplace.',
              },
              {
                num: '02',
                title: 'Open a Pull Request',
                desc: 'Push your branch and open a PR as usual. PRessPlay detects it automatically.',
              },
              {
                num: '03',
                title: 'Video Appears on PR',
                desc: 'A recorded demo video is posted as a PR comment within seconds of opening.',
              },
            ].map(({ num, title, desc }) => (
              <div
                key={num}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-6"
              >
                <span className="font-mono text-xl font-bold text-indigo-500 block mb-3">
                  {num}
                </span>
                <h3 className="font-semibold text-white mb-2">{title}</h3>
                <p className="text-zinc-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="px-6 py-20 border-t border-zinc-800">
        <div className="max-w-xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {[
              {
                emoji: '🎯',
                title: 'AI-Powered Scripts',
                desc: 'LLM analyzes your diff and generates a realistic Playwright script that demonstrates the change.',
              },
              {
                emoji: '🎬',
                title: 'Playwright Recording',
                desc: 'Headless Chromium renders your app and captures a pixel-perfect video with real interactions.',
              },
              {
                emoji: '⚡',
                title: 'Progressive Fallback',
                desc: 'If full recording fails, PRessPlay falls back to a simplified script or static screenshots automatically.',
              },
              {
                emoji: '🔧',
                title: 'Per-Repo Config',
                desc: 'Drop a pressplay.config.ts in your repo to customize URLs, viewports, auth, and more.',
              },
            ].map(({ emoji, title, desc }) => (
              <div
                key={title}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex gap-4"
              >
                <span className="text-2xl leading-none mt-0.5">{emoji}</span>
                <div>
                  <h3 className="font-semibold text-white mb-1">{title}</h3>
                  <p className="text-zinc-500 text-sm leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA footer */}
      <section className="px-6 py-20 border-t border-zinc-800 text-center">
        <h2 className="text-3xl font-bold tracking-tight mb-3">
          Ready to ship faster?
        </h2>
        <p className="text-zinc-400 text-sm mb-8">
          Free for open source. Install in under a minute.
        </p>
        <Link
          href="/dashboard"
          className="bg-indigo-500 hover:bg-indigo-400 text-white rounded-lg px-6 py-2.5 text-sm font-medium transition-colors"
        >
          Get Started
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 px-6 py-8">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-zinc-500">
          <span>© 2026 PRessPlay</span>
          <nav className="flex items-center gap-6">
            <a
              href="https://github.com/pressplay"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-300 transition-colors"
            >
              GitHub
            </a>
            <a
              href="/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-300 transition-colors"
            >
              Docs
            </a>
            <a
              href="https://twitter.com/pressplay"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-300 transition-colors"
            >
              Twitter
            </a>
          </nav>
        </div>
      </footer>
    </main>
  );
}
