# Socrates

freeCodeCamp's hint API for coding challenges. When a camper is stuck, Socrates
takes their code, the challenge description, and failing tests, then returns a
hint that points them in the right direction without giving the answer away.

Built with Fastify and TypeScript. Uses Groq for inference (gpt-oss-20b by
default). Supports HTML, CSS, JavaScript, and Python challenges, each with its
own system prompt.

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

Returns service status and uptime. Pass `?extended=true` to also check Redis
and Groq connectivity.

### `GET /api-docs`

Swagger UI, protected by HTTP basic auth.

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
pnpm run build         # Compile TypeScript and copy lib/ to dist/
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

| Variable               | Purpose                             | Default     |
| ---------------------- | ----------------------------------- | ----------- |
| `PORT`                 | Server port                         | 3000        |
| `NODE_ENV`             | App environment                     | development |
| `API_KEY`              | Auth key for `/hint`                | --          |
| `GROQ_API_KEY`         | Groq API key                        | --          |
| `REDIS_URL`            | Redis connection URL                | --          |
| `PER_USER_LIMIT`       | Requests per user per minute        | 10          |
| `GLOBAL_LIMIT`         | Global requests per minute          | 1000        |
| `DOCS_BASIC_AUTH_USER` | Basic auth user for `/api-docs`     | --          |
| `DOCS_BASIC_AUTH_PASS` | Basic auth password for `/api-docs` | --          |

See `.env.example` for the full list, including model and circuit-breaker
settings.

## License

MIT
