# src/config

App-wide configuration. Everything here is imported by other modules at startup.

- `env.ts` -- loads and validates environment variables. In production,
  `API_KEY`, `GROQ_API_KEY`, `DOCS_BASIC_AUTH_USER`, and `DOCS_BASIC_AUTH_PASS`
  are required.
- `logger.ts` -- winston logger instance. Reads `LOG_LEVEL` from env, defaults
  to `info`. Console transport with colorized output.
- `prompts.ts` -- system and user prompt templates per challenge type (HTML,
  CSS, JavaScript, Python). Includes examples of good and bad hints.
- `redis.ts` -- ioredis client. Connects to `REDIS_URL` (defaults to
  `localhost:6379`). Has auto-pipelining enabled.
- `swagger.ts` -- OpenAPI 3.0.0 definition object and the shared JSON schemas
  array. The schemas are exported separately so `index.ts` can register them
  with `app.addSchema()` and swagger can reference them.
