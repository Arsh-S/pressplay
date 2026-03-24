<p align="center">
  <img src="public/images/PRessPlay_logo_transparent.png" alt="PRessPlay" width="400" />
</p>

<p align="center">
  <strong>Auto-generated demo videos for every pull request.</strong>
</p>

<p align="center">
  PRessPlay reads your PR diff, generates a Playwright interaction script via AI, records a browser walkthrough against your preview deployment, and posts the video directly on your PR.
</p>

<p align="center">
  Your reviewers see the feature. Not just the diff.
</p>

---

## Quick Start

### 1. Add config

Create `pressplay.config.ts`:

```ts
export default {
  app: {
    hint: 'Use demo@example.com / password to log in',
  },
  routeMap: {
    'src/app/page.tsx': '/',
    'src/app/dashboard/page.tsx': '/dashboard',
  },
};
```

### 2. Add the GitHub Action

```yaml
name: PRessPlay
on:
  deployment_status:

jobs:
  demo:
    if: github.event.deployment_status.state == 'success'
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
      contents: read
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: Arsh-S/pressplay@main
        with:
          preview-url: ${{ github.event.deployment_status.target_url }}
          llm-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 3. Open a PR

That's it. PRessPlay analyzes your diff, generates a demo script, records it, and posts it on your PR.

## Local Usage

```bash
ANTHROPIC_API_KEY=sk-... npx @pressplay/cli http://localhost:3000
```

## How It Works

1. **Diff Analysis** — Reads `git diff`, filters to frontend files, maps to routes
2. **DOM Inspection** — Navigates to the preview URL and captures all interactive elements with real selectors
3. **Script Generation** — LLM reads the diff + DOM snapshot and generates Playwright interaction steps
4. **Adaptive Recording** — Executes steps with a visible cursor; re-plans on failure using live DOM context
5. **Conversion** — FFmpeg converts to MP4 + GIF at 1080p
6. **Publishing** — Posts demo video as a PR comment

## Configuration

See `pressplay.config.ts` — all options have sensible defaults via Zod schema validation.

## License

MIT
