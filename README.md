# Socrates

freeCodeCamp AI Hint API

Socrates is a TypeScript Fastify API that provides pedagogical hints for
freeCodeCamp challenges using Groq AI models. It gives students nudges without
revealing solutions and supports HTML, CSS, JavaScript, and Python challenges.

## Features

- Uses Groq's gpt-oss-20b model for hint generation
- Challenge-type specific prompt templates (HTML, CSS, JavaScript, Python)
- API key authentication
- Redis-backed per-user and global token bucket rate limiting
- Circuit breaker and retry logic around Groq requests
- Health check endpoint with optional extended dependency checks
- Swagger UI docs protected by basic auth at `/api-docs`

## API Endpoints

### `POST /hint`

Generate a pedagogical hint for a coding challenge.

**Authentication:** Requires `X-API-Key` header (outside development/testing)

**Request Body:**

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

**Response:**

```json
{
  "hint": "What value does your function currently return when no explicit return statement is present?",
  "model_used": "gpt-oss-20b"
}
```

### `GET /health`

Health check endpoint. Returns service status and uptime.

### `GET /api-docs`

Swagger UI for API documentation. Protected by HTTP basic auth.

## Documentation

Full API documentation is available at `/api-docs` when the service is running.

## Development

**Prerequisites:**

- Node.js >= 18 (Node 24 recommended for container builds)
- pnpm
- Redis (for rate limiting)

**Setup:**

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env

# Start development server
pnpm run dev
```

Optional local Redis via containers:

```bash
podman compose up -d redis
```

**Available Scripts:**

```bash
pnpm run dev           # Start dev server with hot reload (nodemon)
pnpm run build         # Compile TypeScript and copy lib/ to dist/
pnpm run start         # Run compiled production build
pnpm run test:manual   # Run shell-script smoke tests against a running server
pnpm run lint          # Lint and auto-fix with Biome
pnpm run format        # Format with Biome
pnpm run check         # Check without auto-fix
pnpm run generate-api-key
```

**Environment Variables:**

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - App environment (`development` by default)
- `API_KEY` - API key for authentication
- `GROQ_API_KEY` - Groq API key
- `REDIS_URL` - Redis connection URL
- `PER_USER_LIMIT` - Per-user requests per minute (default: 10)
- `GLOBAL_LIMIT` - Global requests per minute (default: 1000)
- `DOCS_BASIC_AUTH_USER` - Basic auth user for `/api-docs`
- `DOCS_BASIC_AUTH_PASS` - Basic auth password for `/api-docs`

See `.env.example` for the full list, including model and circuit-breaker tuning.

## License

MIT
