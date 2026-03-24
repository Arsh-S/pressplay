# PRessPlay Web Redesign — Design Spec

## Overview

Redesign the PRessPlay web app from a minimal prototype into a polished, developer-focused SaaS application. Dark mode with indigo/violet accents, variable fonts, top-nav layout, and premium component styling inspired by Linear and Raycast.

## Design Decisions

- **Personality:** Developer-focused & technical — dark, precise, premium
- **Color palette:** Indigo (#6366f1) / Violet (#8b5cf6) accents on deep zinc backgrounds (#09090b, #18181b, #27272a)
- **Typography:** Inter Variable (primary), JetBrains Mono (code/monospace accents) — loaded via Google Fonts
- **Layout:** Top nav only (Vercel/Resend style), no sidebar. Full-width content.
- **Landing page copy:** Problem-focused — "Stop writing PR descriptions nobody reads"
- **Component source:** 21st.dev for finding high-quality Tailwind component patterns
- **Header auth:** GitHub username (`arshcodes`) shown top-right in monospace when authenticated

## Pages

### 1. Landing Page (`/`)

**Structure:**
1. **Header** — Logo (▶ gradient icon + "PRessPlay"), nav links (Docs, GitHub), "Sign in with GitHub" CTA
2. **Hero** — Monospace label "Automated PR Demo Videos", headline "Stop writing PR descriptions nobody reads", subtitle with value prop, dual CTA (Get Started + View Demo), subtle indigo radial glow behind headline
3. **Terminal mockup** — Fake terminal showing: `git push` → `PR opened` → `PRessPlay recording...` → `✓ Demo video posted` — establishes the developer experience in 3 lines
4. **How it works** — 3 numbered cards (monospace 01/02/03): Install GitHub App → Open a PR → Video appears on PR
5. **Feature grid** — 2×2 cards: AI-Powered Scripts, Playwright Recording, Progressive Fallback, Per-Repo Config
6. **CTA footer** — "Ready to ship faster?" + Get Started button
7. **Footer** — Minimal: © 2026 PRessPlay, links to GitHub/Docs/Twitter

### 2. Dashboard (`/dashboard`)

**Structure:**
1. **Page header** — "Repositories" heading + description + "Install on Repository" primary button
2. **Repo cards** — List of connected repos, each card shows: repo icon, full name, last run time, video count, pending job count (indigo pill), active/paused status (green/gray pill), arrow indicator for navigation
3. **Recent Activity** — Table-style list of recent jobs across all repos: status badge (DONE/REC/FAIL/PENDING), branch name, PR number (monospace), repo name, duration, relative timestamp

**Status badge system:**
- PENDING: Yellow bg (15% opacity), yellow text
- REC (recording): Indigo bg (15% opacity), indigo text
- DONE: Green bg (15% opacity), green text
- FAIL: Red bg (15% opacity), red text

### 3. Repo Detail (`/dashboard/repos/[id]`)

**Structure:**
1. **Breadcrumb** — Dashboard / repo-name
2. **Page header** — Repo full name + active/paused badge
3. **Tabs** — Jobs (default) | Settings — active tab has indigo bottom border
4. **Jobs tab** — Table with columns: PR #, Title, Commit (monospace, truncated), Duration, Status badge. Same badge system as dashboard.
5. **Settings tab** — Form with sections:
   - Preview Configuration: URL pattern input (monospace)
   - LLM Configuration: Provider dropdown (Anthropic/OpenAI), API key input (password, monospace)
   - Save Settings button (indigo)

### 4. Header (shared)

**Unauthenticated:** Logo + nav links (Docs, GitHub) + "Sign in with GitHub" button (indigo)
**Authenticated:** Logo + nav links (Dashboard active=white, Docs=muted) + avatar circle + GitHub username in monospace (`arshcodes`) + "Sign out" (muted)

## Styling System

### Colors
```
Background:     #09090b (zinc-950)
Surface:        #18181b (zinc-900)
Border:         #27272a (zinc-800)
Muted text:     #71717a (zinc-500)
Secondary text: #a1a1aa (zinc-400)
Primary text:   #fafafa (zinc-50)
Accent:         #6366f1 (indigo-500)
Accent hover:   #8b5cf6 (violet-500)
Accent muted:   rgba(99,102,241,0.15)
Success:        #4ade80 / rgba(34,197,94,0.15)
Warning:        #facc15 / rgba(250,204,21,0.15)
Error:          #f87171 / rgba(239,68,68,0.15)
```

### Typography
- **Headings:** Inter Variable, 600-700 weight, tight letter-spacing (-0.02em to -0.03em)
- **Body:** Inter Variable, 400 weight, 13-14px
- **Labels:** 11px, uppercase, 0.05-0.1em letter-spacing, zinc-500
- **Monospace:** JetBrains Mono — PR numbers, commit SHAs, terminal content, usernames, code snippets

### Component Patterns
- **Cards:** `bg-zinc-900 border border-zinc-800 rounded-xl p-4-5`
- **Inputs:** `bg-zinc-900 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-sm`
- **Buttons (primary):** `bg-indigo-500 hover:bg-indigo-400 text-white rounded-lg px-4 py-2.5 text-sm font-medium`
- **Buttons (secondary):** `bg-transparent border border-zinc-800 text-zinc-400 rounded-lg`
- **Pills/badges:** `rounded-full px-2.5 py-0.5 text-xs font-semibold` with status-specific bg/text colors
- **Tables:** Card container with `divide-y divide-zinc-800/50` rows

### Spacing & Layout
- Page container: `max-w-5xl mx-auto px-6 py-8`
- Section gaps: 40px between major sections
- Card gaps: 12px in lists
- Landing page sections: 48-80px vertical padding

## Technical Implementation

### Fonts
- Load Inter Variable and JetBrains Mono via `<link>` from Google Fonts in `layout.tsx`
- Set as CSS variables / Tailwind font-family config

### 21st.dev
- Use as reference for high-quality component patterns (buttons, inputs, cards, badges)
- Adapt patterns to our dark theme, don't install 21st.dev as a dependency

### Tailwind v4
- Already using Tailwind CSS 4.0 with `@tailwindcss/postcss`
- Extend with custom colors via CSS variables in `globals.css` using `@theme`
- Dark mode is the only mode (no light mode toggle needed)

### Files to Change
1. `globals.css` — Theme variables, font imports, base dark styles
2. `layout.tsx` — Google Fonts links, updated body classes, metadata
3. `page.tsx` — Complete landing page rewrite
4. `header.tsx` — Dark header with logo, nav, GitHub username
5. `dashboard/page.tsx` — Repo cards + recent activity redesign
6. `dashboard/layout.tsx` — Updated container styling
7. `dashboard/repos/[id]/page.tsx` — Tabbed layout, job table, breadcrumbs
8. `dashboard/repos/[id]/settings-form.tsx` — Dark-themed form with sections

### New Files
- None required — all changes are to existing files. Shared component patterns (StatusBadge) can stay inline since they're small.

## Testing

### Playwright Tests
- Install Playwright as a dev dependency
- Write tests that visit every page and screenshot:
  1. Landing page — verify hero, features, footer render
  2. Dashboard — verify repo list, activity table (needs auth mock or seed data)
  3. Repo detail — verify tabs, job table, settings form
- Visual regression: capture screenshots for each page at desktop viewport
- Accessibility: basic checks (color contrast on dark theme, heading hierarchy)

## Out of Scope
- Light mode / theme toggle
- Mobile responsive (keep existing behavior, don't optimize)
- Animation / transitions beyond subtle hover states
- New features or API changes — this is purely presentational
- Logo/icon design — using ▶ gradient placeholder
