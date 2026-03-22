# 🎬 PRessPlay

**Auto-generated demo videos for every pull request.**

PRessPlay reads your PR diff, generates a Playwright interaction script via AI, records a browser walkthrough against your preview deployment, and posts the video directly on your PR.

Your reviewers see the feature. Not just the diff.

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
      - uses: yourorg/pressplay@v1
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
2. **Script Generation** — LLM reads the diff and generates Playwright interaction steps
3. **Recording** — Playwright executes the script against your preview URL, records video
4. **Conversion** — FFmpeg converts to MP4 + GIF
5. **Publishing** — Posts GIF preview + MP4 link as a PR comment

## Configuration

See `pressplay.config.ts` — all options have sensible defaults via Zod schema validation.

## License

MIT
