# CLAUDE.md

Project-specific guidance. Non-obvious only. Anything derivable from `package.json` / config / source lives there, not here.

## Working with Claude

- Use the `/find-docs` skill for library/SDK/API docs. Prefer it over WebFetch / WebSearch / training data.
- Prefer CLI over MCP equivalents (e.g. `gh` over a GitHub MCP).

## Project

Socrates is freeCodeCamp's hint API. Takes a camper's code, challenge description, and failing tests; sends a prompt to Groq; returns a Socratic hint. Supports HTML, CSS, JavaScript, Python.

### `/hint` request flow

`apiKeyAuthHook` (plugin `onRequest`) -> JSON Schema validation -> `rateLimiterHook` (plugin `preHandler`) -> `normalizeHintRequest` -> `buildPrompt` -> `generateFromGroq` -> `formatHintOutput` -> response.

**Non-obvious: rejected requests consume no rate-limit token.** Fastify's phase order is `onRequest` -> `preValidation` -> `validation` -> `preHandler`, and phase beats encapsulation depth — so a child-scope `onRequest` hook runs before a parent-scope `preHandler` one. `apiKeyAuthHook` is `fastify.addHook('onRequest', …)` in `src/routes/hint.ts`; `rateLimiterHook` is `instance.addHook('preHandler', …)` in `src/index.ts`. Measured: 401, 403 and schema-400 responses all return with the limiter never invoked; only a fully valid request reaches it.

The trade is deliberate in both directions. Before this ordering the limiter keyed on `body.userId` _before_ auth ran, so an unauthenticated caller could drain a victim's bucket by sending the victim's `userId`. That is now impossible — but API-key guessing and malformed-body floods are no longer metered at the app layer.

## Observability

- `src/instrument.ts` initializes Sentry and MUST stay the literal first import of `src/index.ts`. Sentry patches `http`/axios at require time; any earlier import escapes instrumentation. Do NOT replace with `node --import ./instrument.mjs` unless you also delete the import. (Invariant V1.)
- Handlers/hooks: `request.log` (child logger, `reqId` auto-bound). Module scope: `rootLogger`. Library code takes the structural `Logger` type from `src/config/logger.ts` instead of importing pino.
- **Pino argument order is object-first** (opposite of winston): `logger.info({ foo: 1 }, 'msg')`.
- **Use `{ err }` as the key.** Pino's err serializer only fires on the literal key `err`; `{ error: ... }` silently dumps unserialized.
- **Never log raw `AxiosError` objects.** `err.config.headers` carries `Authorization: Bearer ...`. Pass through `toSafeError()` from `src/errors/groqApiError.ts` first.
- Sentry Logs ships `error` + `fatal` only; warn-level ops signals stay in pino stdout. Sentry traces skip `/health` + `/health/version` (probe quota).
- **Graceful shutdown flushes Sentry.** Every exit path must `await Sentry.close(2000)` before `process.exit`. Safe no-op when no `SENTRY_DSN`. (Invariant V4.)
- **`/hint` body NOT in Sentry** — `sendDefaultPii: false` gates request-body capture (verified 2026-06-30, SOCRATES-API-3: method+URL only, no `request.data`). `beforeSend` body-scrub is dead. Only learner-content path = `includeLocalVariables: true` (stack locals). Capturing the body needs `sendDefaultPii: true` + `maxRequestBodySize`.
- **`X-API-Key` reaches Sentry but arrives `[Filtered]`** (verified 2026-06-05, SOCRATES-API-2). Protection = Sentry's default server-side Data Scrubbing (SaaS org setting — don't disable "Use Default Scrubbers"); local layer = pino `redact` paths in `src/config/logger.ts`. SDK v11 flips header capture to opt-in.
- `BUILD_VERSION` = `dev-<git-short-sha>` in dev (`dev` script wrapper), Docker ARG in prod (`deploy.yaml` `tagname=<sha>-<yyyymmdd>-<hhmm>`). Tags Sentry `release`, appears as `build` in every log line.
- Boot logs the Sentry init decision (`Sentry initialized` / `Sentry disabled (no DSN)`) — one `docker logs` line confirms whether the SDK transmits. Don't make init silent again.
- `GET /debug/sentry` is a keep-around Sentry pipeline smoke test: logs an error + throws a deliberate 500 (tagged `smoke_test=true`). The throw is intentional — don't "fix" it. GET (not POST) so an empty-body request can't be rejected by the JSON body parser before the handler runs.
- **All `/debug/*` routes are gated behind `DEBUG_SOCRATES=true`** (off by default). When off, the plugin registers nothing — routes 404, indistinguishable from nonexistent. Flag state appears as `debugEndpoints` in the `boot config` log line.
- `GET /debug/config` response schema is `additionalProperties: false` on purpose — the allowlist that keeps secrets out even if the handler regresses. Don't loosen it.

### Build + deploy (CI)

Operator walkthrough — scripts, release steps, source maps, required secrets — lives in [docs/README.md](./docs/README.md). Non-obvious invariants only here:

- One workflow, `deploy.yaml` (`CD - Deploy - Socrates`): `workflow_dispatch`, NO environment input. **The branch you dispatch from is the environment** (`setup-jobs` reads `github.ref_name`): `prod-current` → `site_tld=org` + `tgt_env_short=prd`; anything else (`prod-staging`, feature branches) → `site_tld=dev` + `tgt_env_short=stg`. DX: ship staging = dispatch from `prod-staging`; ship prod = fast-forward `prod-staging` → `prod-current`, dispatch from `prod-current`.
- Two deliberate vocabularies — DO NOT conflate:
  - **`tgt_env_short` = `stg` / `prd`** → swarm stack name (`<short>-socrates`), Gantry service filter (`name=<stack>_svc-socrates`), GitHub deployment environment, Tailscale CI hostname.
  - **`site_tld` = `dev` / `org`** → DOCR image namespace AND the **Sentry environment** (= app's `SENTRY_ENVIRONMENT` = `DEPLOYMENT_ENV` in the swarm stack). **Sentry environments are `dev`/`org`, never `stg`/`prd`.**
- `NODE_ENV` is `production` on BOTH stg and prd. Never the stg/prd discriminator — `site_tld` / `tgt_env_short` are.
- Prod image strips `*.map` from `dist/` in the Docker build stage (V5) — source maps live only in Sentry, never in the running container. Release plumbing is gated on `SENTRY_AUTH_TOKEN`, so fork PRs and tokenless dispatches stay green.

## Gotchas

- **`pnpm run build` must copy the Lua script** (`cp -r src/lib/lua dist/lib/lua`). `src/lib/rateLimiter.ts` reads `token_bucket.lua` from disk at startup; dropping the copy silently breaks rate limiting in production.
- **API key auth skipped outside production/staging.** `apiKeyAuthHook` short-circuits for any other `NODE_ENV`. Consequence: the 401/403 cases in `scripts/test-hints.ts` cannot pass locally, so the runner probes the server once and skips them unless auth is actually enforced. Run it against staging to exercise them.
- **`formatHintOutput` escapes; it must never parse.** It escapes `<`, `>` and bare `&`, then re-activates only `<code>`. An HTML parser (it used `sanitize-html`) drops whatever it does not model — attributes, comments, doctypes — _before_ escaping can preserve them as text, and its raw-text content model lets `<code><textarea></code>` swallow the closing tag. Three defects, one cause. The `&` escape skips well-formed entities, so `HTML_PATTERNS` hints that legitimately emit `&lt;!--` are not double-encoded. `MAX_HINT_RESPONSE_CHARS` is derived (5 chars max per escaped code point), not invented — it is the true ceiling, and Fastify does **not** enforce response `maxLength`, so the schema value is documentation.
- **Per-challenge model override.** `groqClient.ts` reads `GROQ_MODEL_<TYPE>` env vars via dynamic `process.env` lookup (not in `env.ts`), falling back to `GROQ_MODEL`.
- **Groq has an in-memory circuit breaker + fallback hint.** After `MODEL_CB_FAILURES` failures the breaker opens for `MODEL_CB_COOLDOWN_MS`; `/hint` returns a canned fallback with `model_used: "fallback"`. Intentional — don't "fix" it by throwing.
- **Transient Groq failures MUST NOT escape as unhandled errors** (root cause of SOCRATES-API-3/-4). `makeGroqApiCall` throws `ModelUnavailableError` after exhausting retries on a _retryable_ error (timeout / 5xx / 429 / network); `/hint`'s catch maps `ModelUnavailableError` **and** retryable `GroqApiError` → the graceful fallback. Only _non-retryable_ Groq errors (auth, 4xx) surface to the error handler → Sentry `handled:no` (a real bug you want to see). Do NOT revert the exhausted-retry path to `throw finalError` — that reintroduces the unhandled-500 class. The exhausted-retry summary logs at `warn` (stdout only), never `error` (which ships to Sentry Logs).
