# CLAUDE.md

Project-specific guidance. Non-obvious only. Anything derivable from `package.json` / config / source lives there, not here.

## Working with Claude

- Use the `/find-docs` skill for library/SDK/API docs. Prefer it over WebFetch / WebSearch / training data.
- Prefer CLI over MCP equivalents (e.g. `gh` over a GitHub MCP).

## Project

Socrates is freeCodeCamp's hint API. Takes a camper's code, challenge description, and failing tests; sends a prompt to Groq; returns a Socratic hint. Supports HTML, CSS, JavaScript, Python.

## Fastify patterns

- Routes registered as plugins via `app.register()`.
- Middleware = async hooks (`onRequest`, `preHandler`, `onResponse`). Return to proceed; `return reply.status().send()` to short-circuit.
- Errors `throw`; caught by `app.setErrorHandler()`.
- Shared JSON schemas registered via `app.addSchema()` with `$id`. Routes use `$ref: 'SchemaName#'`. `@fastify/swagger` auto-includes them.
- Rate limiter scoped to `/hint` via an encapsulated plugin context.

### `/hint` request flow

`apiKeyAuthHook` -> `rateLimiterHook` (scoped) -> `sanitizeRequest` -> `buildPrompt` -> `generateFromGroq` -> `sanitizeHintOutput` -> response.

## Observability

- `src/instrument.ts` initializes Sentry and MUST stay the literal first import of `src/index.ts`. Sentry patches `http`/axios at require time; any earlier import escapes instrumentation.
- Logging = Fastify's built-in pino. `src/config/logger.ts` exports `loggerConfig`, `rootLogger`, and a structural `Logger` type for library code that shouldn't import pino directly.
- Inside handlers/hooks use `request.log` (child logger with `reqId` auto-bound). At module scope use `rootLogger`. `generateFromGroq` takes `logger?: Logger` so callers can thread `request.log`.
- **Pino argument order is object-first** (opposite of winston): `logger.info({ foo: 1 }, 'msg')`, NOT `logger.info('msg', { foo: 1 })`.
- **Use `{ err }` as the key.** Pino's default err serializer only fires on the literal key `err`. `{ error: ... }` silently dumps unserialized.
- **Never log raw `AxiosError` objects.** `err.config.headers` and `err.response.config.headers` carry `Authorization: Bearer ...`. Pass through `toSafeError()` from `src/errors/groqApiError.ts` first. See `src/lib/groqClient.ts` catch block + `src/middleware/errorHandler.ts`.
- Sentry Logs ships `error` + `fatal` only (configured via `Sentry.pinoIntegration` in `src/instrument.ts`). Warn-level events (redis reconnects, retryable Groq failures, auth rejections) stay in pino stdout — operational signals belong in the log aggregator.
- Sentry traces skip `/health` + `/health/version` to avoid burning quota on Docker HEALTHCHECK + LB probes.
- `BUILD_VERSION` = `dev-<git-short-sha>` in dev (set by `dev` script wrapper), Docker ARG in prod. Tags Sentry `release`, appears as `build` in every log line.

## Gotchas

- **Node 24+ and pnpm 10 required** (`package.json` engines).
- **`pnpm run build` must copy the Lua script.** Build is `tsc && cp -r src/lib/lua dist/lib/lua`. `src/lib/rateLimiter.ts` reads `token_bucket.lua` from disk at startup; dropping the copy silently breaks rate limiting in production.
- **API key auth skipped outside production/staging.** `apiKeyAuthHook` short-circuits when `NODE_ENV` is anything else — local dev/tests don't need `X-API-Key`.
- **Per-challenge model override.** `groqClient.ts` reads `GROQ_MODEL_<TYPE>` env vars (e.g. `GROQ_MODEL_JAVASCRIPT`) and falls back to `GROQ_MODEL` if unset.
- **Groq has an in-memory circuit breaker + fallback hint.** After `MODEL_CB_FAILURES` failures the breaker opens for `MODEL_CB_COOLDOWN_MS`; `/hint` returns a canned fallback string with `model_used: "fallback"` instead of erroring. Intentional — don't "fix" it by throwing.

## Infrastructure

- Redis for rate limiting. `docker compose up -d redis` for local. Full stack: `docker compose up -d`. `podman compose` is a drop-in.
- Groq API for LLM. Challenge types: `html`, `css`, `javascript`, `python`.
- Required env: `API_KEY`, `GROQ_API_KEY`. See `.env.example`.
