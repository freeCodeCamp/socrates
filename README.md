# Socrates

freeCodeCamp AI Hint API

Socrates is a TypeScript Express API that provides hints for freeCodeCamp challenges using Groq AI models. It gives students nudges in the right direction without revealing solutions, and supports HTML, CSS, JavaScript, and Python challenges.

## Features

- Uses Groq's gpt-oss-20b model for hint generation
- Separate prompts tuned for HTML, CSS, JavaScript, and Python
- API key authentication
- Per-user and global rate limits
- Circuit breaker with fallback hints when the AI service is unavailable
- Health check endpoint for monitoring

## API Endpoints

### `POST /hint`

Generate a pedagogical hint for a coding challenge.

**Authentication:** Requires `X-API-Key` header

**Request Body:**

```json
{
  "userId": "user-12345",
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
  "hint": "Your function is missing a return statement. Add 'return' before 'a + b'.",
  "model_used": "gpt-oss-20b"
}
```

### `GET /health`

Health check endpoint. Returns service status and uptime.

## Documentation

Full API documentation is available at `/api-docs` when the service is running.

## Development

**Prerequisites:**

- Node.js >= 18
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

**Available Scripts:**

```bash
pnpm run dev          # Start dev server with hot reload
pnpm run build        # Build for production
pnpm run start        # Run production build
pnpm run test         # Run unit tests
pnpm run lint         # Lint and auto-fix code
pnpm run format       # Format code
```

**Environment Variables:**

- `PORT` - Server port (default: 3000)
- `API_KEY` - API key for authentication
- `GROQ_API_KEY` - Groq API key
- `REDIS_URL` - Redis connection URL
- `PER_USER_LIMIT` - Per-user requests per minute (default: 10)
- `GLOBAL_LIMIT` - Global requests per minute (default: 1000)

## License

MIT
