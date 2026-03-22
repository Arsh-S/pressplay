# PRessPlay — AI Agent Instructions

## What is this?

PRessPlay auto-generates demo videos for PRs. It's a pnpm monorepo with three packages:
- `packages/core` — pipeline library (diff analysis, LLM script gen, recording, publishing)
- `packages/action` — GitHub Action wrapper
- `packages/cli` — CLI for local usage

## Commands

- `pnpm install` — install deps
- `pnpm -r build` — build all packages
- `pnpm -r test` — run all tests
- `pnpm --filter @pressplay/core test` — run core tests only

## Architecture

The pipeline flows: diff analysis → LLM script generation → Playwright recording → FFmpeg conversion → GitHub publishing. Each stage is in its own directory under `packages/core/src/`.

## Key design decisions

- LLM generates Playwright steps as JSON, not raw code (safer, validatable)
- Progressive fallback: full script → simplified script → static screenshots
- Config via `pressplay.config.ts` with Zod validation
- Lightweight mode (FFmpeg) is default; polished mode (Remotion) is Phase 2
