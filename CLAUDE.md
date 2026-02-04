# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Socrates is freeCodeCamp's AI Hint API. It generates pedagogical hints for campers working on coding challenges using Groq's LLM API. The API receives challenge context (description, user code, failing tests) and returns Socratic-style hints that guide without giving answers.

## Commands

```bash
pnpm run dev              # Start dev server with hot reload (nodemon + ts-node)
pnpm run build            # Compile TypeScript and copy lib/ to dist/
pnpm run start            # Run compiled production build
pnpm run test:manual      # Run shell-script smoke tests against a running server
pnpm run lint             # Lint and auto-fix with Biome
pnpm run format           # Format with Biome
pnpm run check            # Check without auto-fix
```

## Architecture

**Fastify API** (`src/index.ts`) with three route groups:
- `POST /hint` — Main endpoint. Protected by API key auth + Redis rate limiter. Sanitizes input, builds a challenge-type-specific prompt, calls Groq, sanitizes the hint output.
- `GET /health` — Health check with optional extended mode (Redis + Groq checks).
- `GET /api-docs` — Swagger UI, protected by HTTP Basic Auth.

**Fastify patterns:**
- Routes are registered as Fastify plugins via `app.register()`.
- Middleware is implemented as async Fastify hooks (`onRequest`, `preHandler`, `onResponse`). Hooks return to proceed; `return reply.status().send()` to short-circuit.
- Errors propagate via `throw` and are caught by `app.setErrorHandler()`.
- Shared JSON schemas are registered via `app.addSchema()` with `$id` fields; routes reference them with `$ref: 'SchemaName#'` (Fastify format). `@fastify/swagger` auto-includes them in the OpenAPI spec.
- The rate limiter is scoped to `/hint` only via a Fastify encapsulated plugin context.

**Request flow for `/hint`:**
`apiKeyAuthHook` (preHandler) → `rateLimiterHook` (preHandler, scoped) → `sanitizeRequest` → `buildPrompt` → `generateFromGroq` → `sanitizeHintOutput` → response

**Key modules in `src/lib/`:**
- `groqClient.ts` — Calls Groq's OpenAI-compatible chat completions API via axios. Implements exponential backoff with jitter, circuit breaker pattern (opens after N failures, auto-resets after cooldown), and per-challenge-type model selection.
- `rateLimiter.ts` — Redis-backed token bucket rate limiter using a Lua script (`src/lib/lua/token_bucket.lua`) for atomic operations. Per-user + global buckets. Exported as a Fastify `preHandler` hook factory. Gracefully degrades (allows requests) if Redis is unavailable.
- `sanitizer.ts` — Validates and normalizes incoming request bodies. Requires userId, description, code (userInput or seed), and at least one failing test.
- `promptBuilder.ts` — Assembles system + user prompts from templates in `src/config/prompts.ts`. Different system prompts for HTML, CSS, JavaScript, and Python challenges. Enforces 32K char max prompt size.
- `hintSanitizer.ts` — Strips code patterns (backticks, CSS property values) from hint output and truncates to 300 chars.

**Config (`src/config/`):**
- `env.ts` — Loads and validates environment variables. Required in production: `API_KEY`, `GROQ_API_KEY`, `DOCS_BASIC_AUTH_USER`, `DOCS_BASIC_AUTH_PASS`.
- `prompts.ts` — System prompts per challenge type with examples of good/bad hints.
- `swagger.ts` — OpenAPI 3.0.0 definition and shared JSON schemas (exported separately for `addSchema` registration).

**Hooks (`src/middleware/`):**
- `apiKeyAuth.ts` — X-API-Key header validation as async Fastify hook (skipped in dev/test).
- `docsAuth.ts` — HTTP Basic Auth for Swagger docs with timing-safe comparison, registered as `uiHooks.onRequest` on `@fastify/swagger-ui`.
- `errorHandler.ts` — Global error handler via `app.setErrorHandler()`.
- `logger.ts` — Request logging as `onResponse` hook (replaces morgan).

**Custom errors (`src/errors/`):**
- `InputValidationError` (400), `PromptSizeError` (400), `GroqApiError` (variable), `ModelUnavailableError` (503).

## Code Style

- **Biome** is the primary linter/formatter (replaced ESLint/Prettier for most usage).
- Single quotes, semicolons, 2-space indent, 100-char line width.
- Pre-commit hook runs `biome check --write` on staged files via Husky + lint-staged.

## Infrastructure

- **Redis** required for rate limiting. Run `docker compose up -d` for local Redis 7.
- **Groq API** for LLM inference. Different models per challenge type (configurable via env).
- Challenge types: `html`, `css`, `javascript`, `python`.
