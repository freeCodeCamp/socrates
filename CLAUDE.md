# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project overview

Socrates is freeCodeCamp's hint API. It takes a camper's code, the challenge
description, and failing tests, sends a prompt to Groq, and returns a
Socratic-style hint that guides without giving the answer. Supports HTML, CSS,
JavaScript, and Python challenges.

## Commands

```bash
pnpm run dev              # Dev server with hot reload (nodemon + ts-node)
pnpm run build            # Compile TypeScript and copy Lua scripts to dist/
pnpm run start            # Run compiled production build
pnpm run test             # Run tests (Vitest)
pnpm run test:watch       # Run tests in watch mode
pnpm run typecheck        # Type-check without emitting
pnpm run lint             # Lint with oxlint
pnpm run format           # Format with Prettier
pnpm run check            # oxlint + prettier --check
pnpm run test:manual      # Shell-script smoke tests against a running server
pnpm run generate-api-key # Generate a random API key for local dev
```

## Architecture

Fastify API (`src/index.ts`) with these routes:

- `POST /hint` -- main endpoint. API key auth + Redis rate limiter. Sanitizes
  input, builds a prompt, calls Groq, sanitizes the output.
- `GET /health` -- health check. With `ENABLE_EXTENDED_HEALTH=true`, also
  pings Redis and Groq.
- `GET /health/version` -- returns `BUILD_VERSION` (injected at build time,
  defaults to `'unknown'`).
- `GET /api-docs` -- Swagger UI, development only.

### Fastify patterns

- Routes are registered as plugins via `app.register()`.
- Middleware is async Fastify hooks (`onRequest`, `preHandler`, `onResponse`).
  Hooks return to proceed; `return reply.status().send()` to short-circuit.
- Errors propagate via `throw` and are caught by `app.setErrorHandler()`.
- Shared JSON schemas are registered with `app.addSchema()` using `$id` fields.
  Routes reference them with `$ref: 'SchemaName#'`. `@fastify/swagger`
  auto-includes them in the OpenAPI spec.
- The rate limiter is scoped to `/hint` only via a Fastify encapsulated plugin
  context.

### Request flow for `/hint`

`apiKeyAuthHook` (preHandler) -> `rateLimiterHook` (preHandler, scoped) ->
`sanitizeRequest` -> `buildPrompt` -> `generateFromGroq` ->
`sanitizeHintOutput` -> response

## Code style

- oxlint for linting, Prettier for formatting.
- Single quotes, semicolons, 2-space indent, 100-char line width.
- `no-explicit-any` is enforced as error. Use `unknown` with type guards.
- Tests use Vitest. Test files live in `__tests__/` directories alongside source.

## Infrastructure

- Redis for rate limiting. `docker compose up -d redis` starts a local Redis 7.
- `docker compose up -d` builds and runs the full stack (app + Redis).
- Groq API for LLM inference. Different models per challenge type (configurable
  via env).
- Challenge types: `html`, `css`, `javascript`, `python`.
- Required env vars: `API_KEY`, `GROQ_API_KEY`. See `.env.example`.

## Gotchas

- **Node 24+ and pnpm 10 required** (`package.json` engines). Older Node will
  fail at install or runtime.
- **`pnpm run build` must copy the Lua script.** The build is
  `tsc && cp -r src/lib/lua dist/lib/lua`. `src/lib/rateLimiter.ts` reads
  `token_bucket.lua` from disk at startup; dropping the copy step silently
  breaks rate limiting in production.
- **API key auth is skipped outside production/staging.** `apiKeyAuthHook`
  short-circuits when `NODE_ENV` is anything other than `production` or
  `staging`, so local dev and tests don't need `X-API-Key`.
- **Per-challenge model override.** `groqClient.ts` reads `GROQ_MODEL_<TYPE>`
  env vars dynamically (e.g., `GROQ_MODEL_JAVASCRIPT`) and falls back to
  `GROQ_MODEL` if unset.
- **Groq has an in-memory circuit breaker and fallback hint.** After
  `MODEL_CB_FAILURES` failed attempts the breaker opens for
  `MODEL_CB_COOLDOWN_MS`; `/hint` then returns a canned fallback string with
  `model_used: "fallback"` instead of erroring. This is intentional -- don't
  "fix" it by throwing.
