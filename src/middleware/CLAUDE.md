# src/middleware

Fastify hooks registered in `src/index.ts`. Each file exports a hook function.

- `apiKeyAuth.ts` -- `preHandler` hook that checks the `X-API-Key` header
  against the configured `API_KEY`. Skipped when `NODE_ENV` is `development` or
  `test`.
- `docsAuth.ts` -- `onRequest` hook for HTTP Basic Auth on the swagger-ui
  routes. Uses `crypto.timingSafeEqual` for password comparison. Registered via
  `uiHooks.onRequest` on `@fastify/swagger-ui`.
- `errorHandler.ts` -- global error handler set via `app.setErrorHandler()`.
  Maps custom error classes from `src/errors/` to HTTP status codes and
  structured JSON responses.
- `logger.ts` -- `onResponse` hook that logs method, URL, status code, and
  response time for each request. Replaces the old morgan-based logging.
