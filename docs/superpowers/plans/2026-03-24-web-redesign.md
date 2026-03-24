# PRessPlay Web Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the PRessPlay web app into a polished, dark-mode, developer-focused SaaS with indigo/violet accents, variable fonts, and premium component styling.

**Architecture:** Purely presentational changes to existing Next.js 15 app. No new API routes or database schema changes. Fonts via `next/font/google`, theme via Tailwind v4 `@theme` block, dark zinc backgrounds with indigo accents. Auth callback extended to expose GitHub username. Playwright e2e tests for visual verification.

**Tech Stack:** Next.js 15.5, React 19, Tailwind CSS 4.0, `next/font/google` (Inter + JetBrains Mono), Playwright (testing), Drizzle ORM (query changes only)

**Spec:** `docs/superpowers/specs/2026-03-24-web-redesign-design.md`

---

## File Structure

### Files to Create
- `packages/web/src/components/status-badge.tsx` — Shared status badge component with DB-value-to-label mapping
- `packages/web/src/components/logo.tsx` — Shared logo component (gradient icon + wordmark)
- `packages/web/e2e/landing.spec.ts` — Playwright test for landing page
- `packages/web/e2e/dashboard.spec.ts` — Playwright test for dashboard
- `packages/web/e2e/repo-detail.spec.ts` — Playwright test for repo detail page
- `packages/web/playwright.config.ts` — Playwright configuration

### Files to Modify
- `packages/web/src/app/globals.css` — Add `@theme` block with custom colors and fonts
- `packages/web/src/app/layout.tsx` — Add `next/font/google` imports, update body classes, update metadata
- `packages/web/src/app/page.tsx` — Complete landing page rewrite
- `packages/web/src/components/header.tsx` — Dark header with logo, GitHub username, nav
- `packages/web/src/app/dashboard/layout.tsx` — Update container styling for dark theme
- `packages/web/src/app/dashboard/page.tsx` — Redesigned repo cards + recent activity with JOIN queries
- `packages/web/src/app/dashboard/repos/[id]/page.tsx` — Tabbed layout, job table, breadcrumbs
- `packages/web/src/app/dashboard/repos/[id]/settings-form.tsx` — Dark-themed form
- `packages/web/src/lib/auth.ts` — Extend callback to store GitHub username
- `packages/web/package.json` — Add Playwright dev dependency

---

### Task 1: Foundation — Fonts, Theme, Layout

**Files:**
- Modify: `packages/web/src/app/globals.css`
- Modify: `packages/web/src/app/layout.tsx`
- Modify: `packages/web/package.json`

- [ ] **Step 1: Update `globals.css` with Tailwind v4 `@theme` block**

```css
@import 'tailwindcss';

@theme {
  --font-sans: var(--font-inter);
  --font-mono: var(--font-jetbrains);
  --color-surface: #18181b;
  --color-border: #27272a;
  --color-accent: #6366f1;
  --color-accent-hover: #8b5cf6;
  --color-accent-muted: rgba(99,102,241,0.15);
}

@layer base {
  body {
    @apply bg-zinc-950 text-zinc-50 antialiased;
  }
}
```

- [ ] **Step 2: Update `layout.tsx` with `next/font/google` and dark body**

```tsx
import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import { Header } from '@/components/header';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'PRessPlay — Auto-generated demo videos for PRs',
  description: 'Stop writing PR descriptions nobody reads. PRessPlay auto-generates demo videos for every pull request.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen font-sans">
        <Providers>
          <Header />
          {children}
        </Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Run `pnpm --filter @pressplay/web build` to verify fonts compile**

Expected: Build succeeds, no font errors.

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/app/globals.css packages/web/src/app/layout.tsx
git commit -m "feat(web): add dark theme foundation with Inter + JetBrains Mono variable fonts"
```

---

### Task 2: Shared Components — Logo + StatusBadge

**Files:**
- Create: `packages/web/src/components/logo.tsx`
- Create: `packages/web/src/components/status-badge.tsx`

- [ ] **Step 1: Create `logo.tsx`**

```tsx
import Link from 'next/link';

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-violet-500">
        <span className="text-[11px] font-bold text-white">▶</span>
      </div>
      <span className="text-[15px] font-semibold tracking-tight text-zinc-50">PRessPlay</span>
    </Link>
  );
}
```

- [ ] **Step 2: Create `status-badge.tsx`**

```tsx
const statusConfig: Record<string, { label: string; className: string }> = {
  pending: {
    label: 'PENDING',
    className: 'bg-yellow-400/15 text-yellow-400',
  },
  running: {
    label: 'REC',
    className: 'bg-indigo-400/15 text-indigo-400',
  },
  completed: {
    label: 'DONE',
    className: 'bg-green-400/15 text-green-400',
  },
  failed: {
    label: 'FAIL',
    className: 'bg-red-400/15 text-red-400',
  },
};

export function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || { label: status.toUpperCase(), className: 'bg-zinc-400/15 text-zinc-400' };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${config.className}`}>
      {config.label}
    </span>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/components/logo.tsx packages/web/src/components/status-badge.tsx
git commit -m "feat(web): add shared Logo and StatusBadge components"
```

---

### Task 3: Header Redesign

**Files:**
- Modify: `packages/web/src/components/header.tsx`
- Modify: `packages/web/src/lib/auth.ts`

- [ ] **Step 1: Extend auth callback to expose GitHub username**

Add a `profile` callback to store the GitHub login, and extend the `session` callback to include it. In `packages/web/src/lib/auth.ts`:

```tsx
import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db } from './db';
import { users, accounts, sessions, verificationTokens } from './schema';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      profile(profile) {
        return {
          id: profile.id.toString(),
          name: profile.login,
          email: profile.email,
          image: profile.avatar_url,
        };
      },
    }),
  ],
  pages: {
    signIn: '/',
  },
  callbacks: {
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.name = user.name;
        session.user.image = user.image;
      }
      return session;
    },
  },
});
```

Note: We store `profile.login` (GitHub username like "arshcodes") as `name` so it flows through the existing schema without adding columns.

- [ ] **Step 2: Rewrite `header.tsx` with dark theme and logo**

```tsx
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
            <button className="rounded-lg bg-indigo-500 px-3.5 py-1.5 text-[13px] font-medium text-white hover:bg-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50">
              Sign in with GitHub
            </button>
          </form>
        )}
      </nav>
    </header>
  );
}
```

- [ ] **Step 3: Run `pnpm --filter @pressplay/web build` to verify**

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/components/header.tsx packages/web/src/lib/auth.ts
git commit -m "feat(web): redesign header with dark theme, logo, and GitHub username"
```

---

### Task 4: Landing Page

**Files:**
- Modify: `packages/web/src/app/page.tsx`

- [ ] **Step 1: Rewrite landing page**

Complete rewrite of `packages/web/src/app/page.tsx` with:
- Hero section: monospace label, problem-focused headline, subtitle, dual CTA, indigo radial glow
- Terminal mockup: fake terminal with git push → PR → recording → done
- How it works: 3 numbered cards (01/02/03)
- Feature grid: 2×2 cards
- CTA footer: "Ready to ship faster?"
- Minimal footer with external links

Key implementation details:
- "Get Started" links to `/dashboard` (triggers auth flow if unauthenticated)
- "View Demo" scrolls to `#demo` (the terminal mockup section)
- External links (GitHub, Docs, Twitter) use `<a target="_blank" rel="noopener noreferrer">`
- Indigo radial glow: `bg-[radial-gradient(ellipse_at_center,_rgba(99,102,241,0.15)_0%,_transparent_70%)]`
- Terminal dots: three `bg-zinc-700 rounded-full w-2.5 h-2.5` circles
- Step numbers in `font-mono text-xl font-bold text-indigo-500`
- Feature icons as emoji (same as spec mockup)
- Terminal mockup section must have `id="demo"` for the "View Demo" scroll anchor
- Use `/* eslint-disable @next/next/no-img-element */` where needed for avatar images, or use `next/image`

- [ ] **Step 2: Run `pnpm --filter @pressplay/web build` to verify**

Expected: Build succeeds, no type errors.

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/app/page.tsx
git commit -m "feat(web): redesign landing page with hero, terminal mockup, features"
```

---

### Task 5: Dashboard Layout + Page Redesign

**Files:**
- Modify: `packages/web/src/app/dashboard/layout.tsx`
- Modify: `packages/web/src/app/dashboard/page.tsx`

- [ ] **Step 1: Update dashboard layout**

```tsx
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/');
  return <div className="mx-auto max-w-5xl px-6 py-8">{children}</div>;
}
```

- [ ] **Step 2: Rewrite dashboard page with dark theme and improved queries**

Key changes to `packages/web/src/app/dashboard/page.tsx`:
- Replace inline `StatusBadge` with import from `@/components/status-badge`
- Update page header: "Repositories" heading with description + "Install on Repository" indigo button
- Repo cards: dark card styling with `bg-zinc-900 border-zinc-800 rounded-xl`, show active/paused pill, arrow indicator
- Add aggregate job data per repo (count of completed jobs from recentJobs array, count of pending)
- Recent Activity section: table-style rows with status badge, PR title, PR number (mono), repo name, duration, timestamp
- Join jobs with repos for Recent Activity to get `repo.fullName` per job row:
  ```ts
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
  ```
- Empty state: "No repositories connected yet" in zinc-900 card with install button
- Relative timestamps: use a helper like `timeAgo(date)` inline (simple: "Xm ago", "Xh ago", "Xd ago")

- [ ] **Step 3: Run `pnpm --filter @pressplay/web build` to verify**

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/app/dashboard/layout.tsx packages/web/src/app/dashboard/page.tsx
git commit -m "feat(web): redesign dashboard with dark cards, activity table, improved queries"
```

---

### Task 6: Repo Detail Page — Tabs + Job Table

**Files:**
- Modify: `packages/web/src/app/dashboard/repos/[id]/page.tsx`

- [ ] **Step 1: Rewrite repo detail page with tabs and dark theme**

Key changes:
- Replace inline `StatusBadge` with import from `@/components/status-badge`
- Add breadcrumb: `Dashboard / repo-name` with zinc-500 color
- Page header: repo full name (text-2xl font-bold) + active/paused badge (pill)
- Tab bar: Jobs | Settings — use `searchParams.tab` to toggle. Active tab: white text + `border-b-2 border-indigo-500`. Inactive: zinc-500 text.
- Tabs implemented via URL search params: `<Link href="?tab=jobs">` and `<Link href="?tab=settings">`
- Jobs tab (default): Table with header row (PR, Title, Commit, Duration, Status) in grid layout. Each job row in a grid. Failed jobs show error in a muted line below.
- Settings tab: render `<SettingsForm>` with same props
- All styling uses zinc-900/800 dark card patterns

Page receives `searchParams` as a prop:
```tsx
export default async function RepoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
```

- [ ] **Step 2: Run `pnpm --filter @pressplay/web build` to verify**

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/app/dashboard/repos/[id]/page.tsx
git commit -m "feat(web): redesign repo detail with tabbed layout and dark job table"
```

---

### Task 7: Settings Form Dark Theme

**Files:**
- Modify: `packages/web/src/app/dashboard/repos/[id]/settings-form.tsx`

- [ ] **Step 1: Restyle settings form for dark theme**

Key changes to `settings-form.tsx`:
- All inputs: `bg-zinc-900 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-sm text-zinc-50 font-mono focus:ring-2 focus:ring-indigo-500/50 focus:outline-none`
- Select: same styling as inputs
- Labels: `text-[12px] text-zinc-400 mb-1.5 block`
- Section dividers: uppercase zinc-500 labels ("Preview Configuration", "LLM Configuration") with spacing
- Save button: `bg-indigo-500 hover:bg-indigo-400 text-white rounded-lg px-4 py-2.5 text-sm font-medium`
- Helper text: `text-[11px] text-zinc-600 mt-1.5`
- Disabled button state: `disabled:opacity-50`

- [ ] **Step 2: Run `pnpm --filter @pressplay/web build` to verify**

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/app/dashboard/repos/[id]/settings-form.tsx
git commit -m "feat(web): restyle settings form for dark theme"
```

---

### Task 8: Playwright E2E Tests

**Files:**
- Modify: `packages/web/package.json` (add Playwright dependency)
- Create: `packages/web/playwright.config.ts`
- Create: `packages/web/e2e/landing.spec.ts`
- Create: `packages/web/e2e/dashboard.spec.ts`
- Create: `packages/web/e2e/repo-detail.spec.ts`

- [ ] **Step 1: Install Playwright**

```bash
cd packages/web && pnpm add -D @playwright/test && pnpm exec playwright install chromium
```

- [ ] **Step 2: Create `playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/test-results',
  use: {
    baseURL: 'http://localhost:3100',
    screenshot: 'on',
    viewport: { width: 1280, height: 720 },
  },
  webServer: {
    command: 'pnpm dev',
    port: 3100,
    reuseExistingServer: true,
  },
});
```

- [ ] **Step 3: Create landing page test**

`e2e/landing.spec.ts`:
```ts
import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test('renders hero section with headline and CTAs', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Stop writing PR descriptions');
    await expect(page.getByRole('link', { name: /get started/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /view demo/i })).toBeVisible();
  });

  test('renders how it works section', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('How it works')).toBeVisible();
    await expect(page.getByText('Install the GitHub App')).toBeVisible();
    await expect(page.getByText('Open a Pull Request')).toBeVisible();
    await expect(page.getByText('Video Appears on PR')).toBeVisible();
  });

  test('renders feature grid', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('AI-Powered Scripts')).toBeVisible();
    await expect(page.getByText('Playwright Recording')).toBeVisible();
  });

  test('renders footer', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('© 2026 PRessPlay')).toBeVisible();
  });

  test('screenshot - full page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();
    await page.screenshot({ path: 'e2e/screenshots/landing.png', fullPage: true });
  });
});
```

- [ ] **Step 4: Create dashboard test**

`e2e/dashboard.spec.ts`:
```ts
import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test('unauthenticated user is redirected to landing', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL('/');
    await expect(page.locator('h1')).toContainText('Stop writing PR descriptions');
  });
});
```

Note: Full dashboard testing requires auth mocking which is out of scope for the visual redesign. This test verifies the auth guard works.

- [ ] **Step 5: Create repo detail test**

`e2e/repo-detail.spec.ts`:
```ts
import { test, expect } from '@playwright/test';

test.describe('Repo Detail', () => {
  test('unauthenticated user is redirected to landing', async ({ page }) => {
    await page.goto('/dashboard/repos/test-id');
    await page.waitForURL('/');
  });
});
```

- [ ] **Step 6: Add test script to package.json**

Add to `scripts` in `packages/web/package.json`:
```json
"test:e2e": "playwright test"
```

- [ ] **Step 7: Run landing page tests**

```bash
cd packages/web && pnpm test:e2e e2e/landing.spec.ts
```

Expected: All landing page tests pass. Screenshots saved to `e2e/screenshots/`.

- [ ] **Step 8: Commit**

```bash
git add packages/web/playwright.config.ts packages/web/e2e/ packages/web/package.json pnpm-lock.yaml
git commit -m "test(web): add Playwright e2e tests for landing page and auth guards"
```

---

### Task 9: 21st.dev Component Audit + Final Polish

**Files:**
- Possibly modify any of the files from Tasks 1-7

- [ ] **Step 1: Browse 21st.dev for component inspiration**

Search 21st.dev for:
- Dark mode button components
- Dark mode input/form components
- Dark mode card patterns
- Navigation/header patterns

Adapt any superior patterns found to the existing implementation. This is a refinement pass, not a rewrite.

- [ ] **Step 2: Review all pages visually**

Start the dev server and manually check:
```bash
cd packages/web && pnpm dev
```

Open `http://localhost:3100` and verify:
- Landing page: hero, terminal mockup, how it works, features, CTA, footer
- Check font rendering (Inter for body, JetBrains Mono for code elements)
- Check indigo accent consistency
- Check dark background consistency (no white flashes)

- [ ] **Step 3: Run full Playwright suite with screenshots**

```bash
cd packages/web && pnpm test:e2e
```

Review screenshots in `e2e/screenshots/` for visual quality.

- [ ] **Step 4: Add `.gitignore` for test artifacts**

Create `packages/web/e2e/.gitignore`:
```
screenshots/
test-results/
```

- [ ] **Step 5: Fix any issues found, commit**

```bash
git add packages/web/e2e/.gitignore packages/web/src/
git commit -m "feat(web): final polish pass — component refinements from 21st.dev patterns"
```

---

### Task 10: Build Verification

- [ ] **Step 1: Full build**

```bash
pnpm --filter @pressplay/web build
```

Expected: Build succeeds with no errors.

- [ ] **Step 2: Type check**

```bash
pnpm --filter @pressplay/web typecheck
```

Expected: No type errors.

- [ ] **Step 3: Run all tests**

```bash
pnpm --filter @pressplay/web test:e2e
```

Expected: All tests pass.

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A packages/web/
git commit -m "fix(web): address build and type errors from redesign"
```
