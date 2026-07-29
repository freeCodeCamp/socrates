# Socrates

freeCodeCamp's hint API for coding challenges. When a camper is stuck, Socrates takes their code, the challenge description, and failing tests, then returns a hint that points them in the right direction without giving the answer away.

Built with Fastify and TypeScript. Uses Groq for inference (`openai/gpt-oss-20b` by default). Supports HTML, CSS, JavaScript, and Python challenges, each with its own system prompt.

## How it works

- Camper's code, challenge description, and failing tests go in
- A challenge-type-specific prompt is built and sent to Groq
- The response is sanitized to allow only attribute-free `<code>` markup
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
  "hints": [
    { "text": "The first test passed" },
    { "text": "Expected 5 but received undefined", "failed": true }
  ]
}
```

Passing test entries may omit `failed`. At least one entry must explicitly include
`"failed": true`.

Response:

```json
{
  "hint": "What value does your <code>sum</code> function return without an explicit <code>return</code> statement?",
  "model_used": "openai/gpt-oss-20b"
}
```

The `hint` value may contain limited HTML. Only attribute-free `<code>` elements are returned;
all other model-generated tags are safely encoded as text.

### `GET /health`

Returns service status and uptime. Set `ENABLE_EXTENDED_HEALTH=true` to also check Redis and Groq connectivity.

### `GET /api-docs`

Swagger UI. Only available in development (`NODE_ENV != production`).

### `GET /debug/sentry`

Sentry pipeline smoke test — deliberately logs an error and throws a `500` (the `500` is the expected result). Events are tagged `smoke_test=true` so alerts can exclude them. Gated behind `DEBUG_SOCRATES=true`; when off, all `/debug/*` routes 404. Also needs an `X-API-Key` header outside of development/testing. Full walkthrough in the [operator guide](./docs/README.md#smoke-test).

## Running locally

Requires Node.js 24+, pnpm 10, and Redis.

```bash
pnpm install
cp .env.example .env
pnpm run dev
```

Full operator guide — scripts, environment variables, observability, release flow, and CI secrets — lives in [docs/README.md](./docs/README.md).

## License

MIT
