# src/routes

Fastify route plugins, registered in `src/index.ts` via `app.register()`.

- `hint.ts` -- `POST /hint`. The main endpoint. Receives challenge context
  (user code, description, failing tests), runs it through the sanitizer ->
  prompt builder -> Groq client -> hint sanitizer pipeline, and returns the
  hint. Protected by the API key auth hook and the rate limiter (scoped via
  encapsulated plugin context in `index.ts`).
- `health.ts` -- `GET /health`. Returns service status and uptime. Accepts an
  `extended` query param that triggers Redis ping and Groq connectivity checks.
