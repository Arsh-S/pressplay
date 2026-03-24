# PRessPlay Setup Guide

## Prerequisites

- Node.js 20+
- pnpm
- Docker (optional, for production)

## 1. Create a GitHub App

Go to https://github.com/settings/apps/new and fill in:

- **App name:** PRessPlay (or your preferred name)
- **Homepage URL:** http://localhost:3100
- **Callback URL:** http://localhost:3100/api/auth/callback/github
- **Webhook URL:** https://your-domain.com/api/webhook (use smee.io for local dev)
- **Webhook secret:** Generate one with `openssl rand -hex 20`

**Permissions needed:**
- Repository: Contents (Read), Pull requests (Read & Write), Metadata (Read)
- Organization: Members (Read)

**Subscribe to events:**
- Pull request
- Installation

After creating:
1. Note the **App ID**
2. Generate and download a **private key**
3. Note the **Client ID** and generate a **Client Secret**

## 2. Configure Environment

```bash
cp packages/web/.env.example packages/web/.env
```

Fill in your `.env`:

```
GITHUB_APP_ID=123456
GITHUB_CLIENT_ID=Iv1.abc123
GITHUB_CLIENT_SECRET=your_client_secret
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
GITHUB_WEBHOOK_SECRET=your_webhook_secret
AUTH_SECRET=generate_with_openssl_rand_base64_32
AUTH_URL=http://localhost:3100
DATABASE_URL=file:./pressplay.db
ANTHROPIC_API_KEY=sk-ant-...  # Optional: fallback for users without their own key
```

## 3. Run Locally

```bash
# Install dependencies
pnpm install

# Generate database migrations
cd packages/web && pnpm db:generate && pnpm db:migrate
cd ../..

# Start the web app
pnpm --filter @pressplay/web dev

# In another terminal, start the worker
pnpm --filter @pressplay/web worker
```

Open http://localhost:3100, sign in with GitHub, and install the app on a repo.

## 4. Run with Docker

```bash
# Build and start
docker compose up -d

# View logs
docker compose logs -f
```

## 5. Webhook Setup for Local Dev

Use [smee.io](https://smee.io) to forward webhooks to localhost:

```bash
npx smee -u https://smee.io/your-channel -t http://localhost:3100/api/webhook
```

## How It Works

1. You install the GitHub App on a repo
2. When a PR is opened/updated, GitHub sends a webhook
3. The webhook handler creates a job in the database
4. The worker picks up the job, generates a demo video, and posts it as a PR comment

## Repo Settings

In the dashboard, configure per-repo settings:
- **Preview URL Pattern:** e.g., `https://deploy-preview-{pr}--myapp.netlify.app`
- **LLM Provider:** Anthropic (Claude) or OpenAI
- **API Key:** Your LLM API key for script generation
