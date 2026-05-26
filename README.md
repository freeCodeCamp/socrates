# Socrates

freeCodeCamp's hint API for coding challenges. When a camper is stuck, Socrates takes their code, the challenge description, and failing tests, then returns a hint that points them in the right direction without giving the answer away.

Built with Fastify and TypeScript. Uses Groq for inference (gpt-oss-20b by default). Supports HTML, CSS, JavaScript, and Python challenges, each with its own system prompt.

## How it works

- Camper's code, challenge description, and failing tests go in
- A challenge-type-specific prompt is built and sent to Groq
- The response is stripped of any code patterns and returned as a plain-text hint
- Per-user and global rate limiting (Redis token buckets) prevent abuse
- Circuit breaker on the Groq client opens after repeated failures

## API endpoints

### `POST /hint`

Returns a hint for the given challenge context.

Requires an `X-API-Key` header outside of development/testing.

Request body:

```json
{
  "userId": "660f8a2d4a0f2e1234567890",
  "challengeType": "javascript",
  "description": "Write a function that returns the sum of two numbers",
  "userInput": "function sum(a, b) { a + b }",
  "seed": "function sum(a, b) { }",
  "hints": [{ "text": "Expected 5 but received undefined", "failed": true }]
}
```

Response:

```json
{
  "hint": "What value does your function currently return when no explicit return statement is present?",
  "model_used": "gpt-oss-20b"
}
```

### `GET /health`

Returns service status and uptime. Pass `?extended=true` to also check Redis and Groq connectivity.

### `GET /api-docs`

Swagger UI. Only available in development (`NODE_ENV != production`).

## Development

You need Node.js 24+, pnpm 10, and Redis.

```bash
pnpm install
cp .env.example .env
pnpm run dev
```

If you need a local Redis instance:

```bash
docker compose up -d redis
```

### Scripts

```bash
pnpm run dev           # Dev server with hot reload (nodemon)
pnpm run build         # Compile TypeScript and copy Lua scripts to dist/
pnpm run start         # Run production build
pnpm run test          # Run tests (Vitest)
pnpm run test:watch    # Run tests in watch mode
pnpm run typecheck     # Type-check without emitting
pnpm run lint          # Lint with oxlint
pnpm run format        # Format with Prettier
pnpm run check         # oxlint + prettier --check
pnpm run test:manual   # Smoke tests against a running server
pnpm run generate-api-key
```

### Environment variables

| Variable         | Purpose                      | Default     |
| ---------------- | ---------------------------- | ----------- |
| `PORT`           | Server port                  | 3001        |
| `NODE_ENV`       | App environment              | development |
| `API_KEY`        | Auth key for `/hint`         | --          |
| `GROQ_API_KEY`   | Groq API key                 | --          |
| `REDIS_URL`      | Redis connection URL         | --          |
| `PER_USER_LIMIT` | Requests per user per minute | 10          |
| `GLOBAL_LIMIT`   | Global requests per minute   | 1000        |

See `.env.example` for the full list, including model and circuit-breaker settings.

## Observability

Errors and traces ship to [Sentry](https://sentry.io). Initialization lives in `src/instrument.ts` and must stay the literal first import of `src/index.ts`.

Runtime opt-out: leave `SENTRY_DSN` unset. The SDK skips `init()` entirely; local dev and tests get no Sentry chatter.

What ships:

- **Errors** — Fastify error handler + process-level handlers (SIGINT, SIGTERM, uncaughtException) flush the queue via `Sentry.close(2000)` before exit so no events are dropped on shutdown.
- **Traces** — automatic HTTP / Fastify spans, sampled at `SENTRY_TRACES_SAMPLE_RATE`. `/health` and `/health/version` are sampled at 0 to avoid burning quota on HEALTHCHECK + LB probes.
- **Logs** — pino `error` and `fatal` lines are mirrored to Sentry Logs via `pinoIntegration`. `warn` and below stay in stdout only.
- **Runtime metrics** — memory, CPU, event-loop delay, and process uptime are pushed at the SDK default 30 s interval via `nodeRuntimeMetricsIntegration`.
- **Local variables** — captured into stack frames (`includeLocalVariables: true`) for faster crash triage.

### Releases and source maps (CI)

`build.yml` runs the full release lifecycle on every dispatch:

```
pnpm install --frozen-lockfile
pnpm run build                  # emits ./dist/**/*.js.map on the runner
pnpm run release:new            # sentry-cli releases new $BUILD_VERSION
pnpm run sourcemaps:inject      # injects debug IDs into ./dist
pnpm run sourcemaps:upload      # uploads to the release
pnpm run release:set-commits    # --auto, walks git history
pnpm run release:finalize       # marks release shipped
```

The runtime image strips `*.map` from `dist/` in the Docker build stage — maps are uploaded only to Sentry, never shipped in the container.

`deploy.yml` adds a deploy marker after the Gantry trigger succeeds:

```
sentry-cli deploys new -e $DEPLOY_ENV -r $BUILD_VERSION
```

Build and deploy workflows are dispatched independently. Building an image without deploying still finalizes a Sentry release; the deploy marker is emitted only when `deploy.yml` actually runs.

### Required GitHub Actions secrets

Set these as repository (or organization) secrets on `freeCodeCamp/socrates`:

| Secret              | Purpose                                                   | Scope        |
| ------------------- | --------------------------------------------------------- | ------------ |
| `SENTRY_AUTH_TOKEN` | API token with `project:releases` + `project:write` perms | build+deploy |
| `SENTRY_ORG`        | Sentry org slug                                           | build+deploy |
| `SENTRY_PROJECT`    | Sentry project slug for the socrates app                  | build+deploy |

Create the token at `https://sentry.io/settings/account/api/auth-tokens/` (or org-level at `https://sentry.io/settings/<org>/auth-tokens/`). Scope it to the socrates project only.

All Sentry CI steps are gated on `env.SENTRY_AUTH_TOKEN != ''` — fork PRs and manual dispatches without the secret stay green; release plumbing is simply skipped.

## License

MIT
