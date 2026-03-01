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
```

## Architecture

Fastify API (`src/index.ts`) with three route groups:

- `POST /hint` -- main endpoint. API key auth + Redis rate limiter. Sanitizes
  input, builds a prompt, calls Groq, sanitizes the output.
- `GET /health` -- health check with optional extended mode (Redis + Groq).
- `GET /api-docs` -- Swagger UI, development only. Optional Basic Auth.

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
- Swagger UI (`/api-docs`) is only registered in development.
- Required env vars: `API_KEY`, `GROQ_API_KEY`. See `.env.example`.
