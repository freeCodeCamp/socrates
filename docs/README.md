# Socrates — Operator Guide

Internal documentation for running, building, and deploying Socrates. Public intro and API surface live in the [top-level README](../README.md).

## Contents

- [Development](#development)
- [Scripts](#scripts)
- [Environment variables](#environment-variables)
- [Observability](#observability)
- [Releases and source maps (CI)](#releases-and-source-maps-ci)
- [Required GitHub Actions secrets](#required-github-actions-secrets)

## Development

Requires Node.js 24+, pnpm 10, and Redis.

```bash
pnpm install
cp .env.example .env
pnpm run dev
```

Local Redis:

```bash
docker compose up -d redis
```

Full stack (Redis + app):

```bash
docker compose up -d
```

`podman compose` is a drop-in replacement.

## Scripts

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

## Environment variables

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

- **Errors** — Fastify error handler + process-level handlers (SIGINT, SIGTERM, uncaughtException) flush the queue via `Sentry.close(2000)` before exit so no events are dropped on shutdown. Shutdown awaits are wrapped in `try/catch/finally` so `process.exit` always fires even on flush rejection.
- **Traces** — automatic HTTP / Fastify spans, sampled at `SENTRY_TRACES_SAMPLE_RATE`. `/health` and `/health/version` are sampled at 0 to avoid burning quota on HEALTHCHECK + LB probes.
- **Logs** — pino `error` and `fatal` lines are mirrored to Sentry Logs via `Sentry.pinoIntegration`. `warn` and below stay in stdout only.
- **Runtime metrics** — memory, CPU, event-loop delay, and process uptime are pushed at the SDK default 30 s interval via `nodeRuntimeMetricsIntegration`.
- **Local variables** — captured into stack frames (`includeLocalVariables: true`) for faster crash triage.
- **Boot log** — at startup the app logs `Sentry initialized` (with `release` + `environment`) or `Sentry disabled (no DSN)`, so a single `docker logs` line confirms whether the SDK is transmitting.

### Smoke test

`GET /debug/sentry` deliberately logs an error and throws a 500 to exercise the full error + log pipeline end to end. Auth-gated (`X-API-Key` outside dev/test); events are tagged `smoke_test=true` so alerts can exclude them. Use it after a deploy to confirm Issues + Logs land on the dashboard:

```bash
curl -H "X-API-Key: $API_KEY" https://<host>/debug/sentry
```

A `500` is the expected result — that is the test.

## Releases and source maps (CI)

`deploy.yaml` is the single CD workflow — one dispatch builds, pushes, and deploys. The target environment is the **branch you dispatch from**: `prod-current` → prd (registry tld `org`), anything else (`prod-staging`, feature branches) → stg (`dev`). No environment dropdown.

Release and source maps are one step on the runner, before the Docker build, via `getsentry/action-release` (SHA-pinned). It creates the release, injects debug IDs, uploads maps from `./dist`, associates commits (`set_commits: auto`), and finalizes. `pnpm run build` runs on the runner only to emit the maps:

```
getsentry/action-release@<sha>   # release + sourcemaps + set_commits + finalize
```

The runtime image strips `*.map` from `dist/` in the Docker build stage — maps are uploaded only to Sentry, never shipped in the container.

After the Gantry webhook rolls the swarm services, the deploy job adds a deploy marker:

```
sentry-cli deploys new -e $DEPLOY_ENV -r $BUILD_VERSION   # DEPLOY_ENV = dev | org
```

The Sentry environment is the registry tld (`dev`/`org`), matching the running app's `SENTRY_ENVIRONMENT` — not the `stg`/`prd` stack label.

## Required GitHub Actions secrets

Set these as repository (or organization) secrets on `freeCodeCamp/socrates`:

| Secret              | Purpose                                                   | Scope        |
| ------------------- | --------------------------------------------------------- | ------------ |
| `SENTRY_AUTH_TOKEN` | API token with `project:releases` + `project:write` perms | build+deploy |
| `SENTRY_ORG`        | Sentry org slug                                           | build+deploy |
| `SENTRY_PROJECT`    | Sentry project slug for the socrates app                  | build+deploy |

Create the token at `https://sentry.io/settings/account/api/auth-tokens/` (or org-level at `https://sentry.io/settings/<org>/auth-tokens/`). Scope it to the socrates project only.

All Sentry CI steps are gated on `env.SENTRY_AUTH_TOKEN != ''` — fork PRs and manual dispatches without the secret stay green; release plumbing is simply skipped.
