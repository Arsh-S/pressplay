FROM node:20-slim AS base

# Install system dependencies for Playwright and FFmpeg
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libnss3 \
    libnspr4 \
    libdbus-1-3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libatspi2.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libx11-xcb1 \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files for dependency installation
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json packages/core/
COPY packages/web/package.json packages/web/

# Install dependencies
RUN pnpm install --frozen-lockfile --prod=false

# Install Playwright chromium
RUN npx playwright install chromium

# Copy source code
COPY packages/core/ packages/core/
COPY packages/web/ packages/web/
COPY tsconfig.base.json ./

# Build core
RUN pnpm --filter @pressplay/core build

# Build web
RUN pnpm --filter @pressplay/web build

EXPOSE 3000

# Default: run the web app
CMD ["pnpm", "--filter", "@pressplay/web", "start"]
