# CLAUDE.md

Project-specific guidance. Non-obvious only. Anything derivable from `package.json` / config / source lives there, not here.

## Working with Claude

- Use the `/find-docs` skill for library/SDK/API docs. Prefer it over WebFetch / WebSearch / training data.
- Prefer CLI over MCP equivalents (e.g. `gh` over a GitHub MCP).

## Project

Socrates is freeCodeCamp's hint API. Takes a camper's code, challenge description, and failing tests; sends a prompt to Groq; returns a Socratic hint. Supports HTML, CSS, JavaScript, Python.

### `/hint` request flow

`apiKeyAuthHook` -> `rateLimiterHook` (scoped to `/hint` via an encapsulated plugin context) -> `sanitizeRequest` -> `buildPrompt` -> `generateFromGroq` -> `sanitizeHintOutput` -> response.

## Observability

- `src/instrument.ts` initializes Sentry and MUST stay the literal first import of `src/index.ts`. Sentry patches `http`/axios at require time; any earlier import escapes instrumentation. Do NOT replace with `node --import ./instrument.mjs` unless you also delete the import. (Invariant V1.)
- Handlers/hooks: `request.log` (child logger, `reqId` auto-bound). Module scope: `rootLogger`. Library code takes the structural `Logger` type from `src/config/logger.ts` instead of importing pino.
- **Pino argument order is object-first** (opposite of winston): `logger.info({ foo: 1 }, 'msg')`.
- **Use `{ err }` as the key.** Pino's err serializer only fires on the literal key `err`; `{ error: ... }` silently dumps unserialized.
- **Never log raw `AxiosError` objects.** `err.config.headers` carries `Authorization: Bearer ...`. Pass through `toSafeError()` from `src/errors/groqApiError.ts` first.
- Sentry Logs ships `error` + `fatal` only; warn-level ops signals stay in pino stdout. Sentry traces skip `/health` + `/health/version` (probe quota).
- **Graceful shutdown flushes Sentry.** Every exit path must `await Sentry.close(2000)` before `process.exit`. Safe no-op when no `SENTRY_DSN`. (Invariant V4.)
- `includeLocalVariables: true` is privacy parity with the existing `/hint` body forwarding — does not expand the data surface.
- **`X-API-Key` reaches Sentry but arrives `[Filtered]`** (verified 2026-06-05, SOCRATES-API-2). Protection = Sentry's default server-side Data Scrubbing (SaaS org setting — don't disable "Use Default Scrubbers"); local layer = pino `redact` paths in `src/config/logger.ts`. SDK v11 flips header capture to opt-in.
- `BUILD_VERSION` = `dev-<git-short-sha>` in dev (`dev` script wrapper), Docker ARG in prod (`deploy.yaml` `tagname=<sha>-<yyyymmdd>-<hhmm>`). Tags Sentry `release`, appears as `build` in every log line.
- Boot logs the Sentry init decision (`Sentry initialized` / `Sentry disabled (no DSN)`) — one `docker logs` line confirms whether the SDK transmits. Don't make init silent again.
- `GET /debug/sentry` is a keep-around Sentry pipeline smoke test: logs an error + throws a deliberate 500 (tagged `smoke_test=true`). The throw is intentional — don't "fix" it. GET (not POST) so an empty-body request can't be rejected by the JSON body parser before the handler runs.
- **All `/debug/*` routes are gated behind `DEBUG_SOCRATES=true`** (off by default). When off, the plugin registers nothing — routes 404, indistinguishable from nonexistent. Flag state appears as `debugEndpoints` in the `boot config` log line.
- `GET /debug/config` response schema is `additionalProperties: false` on purpose — the allowlist that keeps secrets out even if the handler regresses. Don't loosen it.

### Build + deploy (CI)

- One workflow, `deploy.yaml` (`CD - Deploy - Socrates`), mirrors the main repo's `deploy-api.yml`: `workflow_dispatch` with NO environment input. **The branch you dispatch from is the environment** — `setup-jobs` reads `github.ref_name`:
  - `prod-current` → `site_tld=org`, `tgt_env_short=prd`
  - anything else (`prod-staging`, feature branches) → `site_tld=dev`, `tgt_env_short=stg`
- DX: ship staging = run `deploy.yaml` from `prod-staging`; ship prod = fast-forward `prod-staging` → `prod-current`, run from `prod-current`.
- Two deliberate vocabularies — DO NOT conflate:
  - **`tgt_env_short` = `stg` / `prd`** → swarm stack name (`<short>-socrates`), Gantry service filter, GitHub deployment environment, Tailscale CI hostname.
  - **`site_tld` = `dev` / `org`** → DOCR image namespace AND the **Sentry environment** (= app's `SENTRY_ENVIRONMENT` = `DEPLOYMENT_ENV` in the swarm stack). **Sentry environments are `dev`/`org`, never `stg`/`prd`.**
- `NODE_ENV` is `production` on BOTH stg and prd. Never the stg/prd discriminator — `site_tld` / `tgt_env_short` are.
- Deploy mechanism: Tailscale → Gantry webhook (`/hooks/run-gantry`, filter `name=<stack>_svc-socrates`); the swarm pulls the freshly built `:<tagname>` + `:latest` image.

### Sentry release + source maps (CI)

- `getsentry/action-release` (SHA-pinned) runs in the build job before docker buildx: creates the release, injects debug IDs, uploads maps from `./dist`, associates commits, finalizes. `pnpm run build` runs on the runner only to emit maps; the Docker image rebuilds independently.
- The production image strips `*.map` from `dist/` in the Dockerfile build stage (V5). Source maps live only in Sentry, never in the running container.
- The deploy job runs `sentry-cli deploys new -e <dev|org> -r <tagname>` after the Gantry webhook (the only remaining `sentry-cli` use, installed ad-hoc).
- Release steps are gated on `SENTRY_AUTH_TOKEN` — fork PRs and tokenless dispatches stay green.
- Required secrets: `SENTRY_AUTH_TOKEN` (`project:releases` + `project:write` scopes), `SENTRY_ORG`, `SENTRY_PROJECT`.

## Gotchas

- **`pnpm run build` must copy the Lua script** (`cp -r src/lib/lua dist/lib/lua`). `src/lib/rateLimiter.ts` reads `token_bucket.lua` from disk at startup; dropping the copy silently breaks rate limiting in production.
- **API key auth skipped outside production/staging.** `apiKeyAuthHook` short-circuits for any other `NODE_ENV`.
- **Per-challenge model override.** `groqClient.ts` reads `GROQ_MODEL_<TYPE>` env vars via dynamic `process.env` lookup (not in `env.ts`), falling back to `GROQ_MODEL`.
- **Groq has an in-memory circuit breaker + fallback hint.** After `MODEL_CB_FAILURES` failures the breaker opens for `MODEL_CB_COOLDOWN_MS`; `/hint` returns a canned fallback with `model_used: "fallback"`. Intentional — don't "fix" it by throwing.
