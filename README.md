# thelibrarian

freeCodeCamp AI Hint API (The Librarian)

This repository hosts a TypeScript Express API which returns pedagogical hints for freeCodeCamp challenges using Groq AI models.

**Models:** 
- `openai/gpt-oss-20b` - Used for HTML and CSS challenges
- `openai/gpt-oss-120b` - Used for JavaScript and Python challenges

**Features:**
- Dynamic model selection based on challenge type
- Automatic prompt caching (50% cost reduction on cached tokens)
- Rate limiting (per-user and global)
- Circuit breaker pattern for API resilience
- API key authentication
- Basic auth for API documentation

**Supported Challenge Types:** HTML, CSS, JavaScript, Python

## Setup (local development)

Install dependencies:

```bash
pnpm install
```

Start the dev server:

```bash
pnpm run dev
```

Build for production and run:

```bash
pnpm run build
pnpm run start
```

### Developer commands

- Run in dev mode (nodemon + ts-node):

```bash
pnpm run dev
```

- Lint code (auto-fix allowed):

```bash
pnpm run lint
```

- Format files with Biome:

```bash
pnpm run format
```

- Check code (lint + format without writing):

```bash
pnpm run check
```

- Run manual curl-based tests (helpful for debugging local Ollama/Redis):

```bash
pnpm run test:manual
```

Create a `.env` file or copy `.env.example` for development environment variables:

```bash
cp .env.example .env
```

Integration tests (Optional):

- Run the Ollama integration test against a local Ollama instance. This will only run if the environment variable `RUN_OLLAMA_INTEGRATION=true` is set.

```bash
# Ensure your Ollama and Redis instances are running. You can use docker-compose included in this repo:
docker-compose up -d

# (optional) or use the convenience pnpm script:
pnpm run compose:up

# With live services running, run integration tests:
pnpm run test:integration

# Tear down the services after testing:
pnpm run compose:down
```

Tip: If you want to run *all* tests including integration, run:

```bash
# Unit tests (fast)
pnpm run test

# Integration test (optional):
pnpm run test:integration
```

Default model name used for Ollama requests is `qwen2.5:7b` (see `scripts/setup-ollama.sh`).

**Comparison Testing:**

To validate the model's performance across languages, run the automated comparison tests:

```bash
./scripts/test-comparison.sh
```

This runs 8 tests (2 HTML, 2 CSS, 2 JavaScript, 2 Python) with 3 runs each, averages responses, and saves results to `comparison-results.md`. See `COMPARISON_TESTS.md` for test case details.

Rate Limiting (Redis + LUA)
----------------------------

The application uses a Redis-backed token bucket for rate limiting. For production safety and correctness under concurrency, an atomic LUA script is used to update per-user and global buckets in Redis. The script is embedded and executed with `EVAL`.
 
Environment variables (defaults):
- `PER_USER_LIMIT` (default 10) — per-user requests per minute.
- `GLOBAL_LIMIT` (default 1000) — global requests per minute.

## Endpoints

- `GET /health` - health check
- `POST /hint` - returns a pedagogical hint as JSON: `{ "hint": "string", "model_used": "string" }`.

### Request Schema

```json
{
  "userId": "user-id-string",
  "description": "Step instructions from freeCodeCamp challenge",
  "userInput": "Student's attempted code",
  "seed": "Starting code for the challenge",
  "hints": ["Test message 1", "Test message 2"]
}
```

### Response

- The model used is provided in the response header `X-Model-Used`.
- If the model returns streaming chunks (JSONL/NDJSON), the server concatenates the text chunks into a single `hint` string and returns it in the `hint` field.
- Additional header: `X-Model-Available` may be set to `false` if a fallback hint was returned.

Manual tests & helpers
-----------------------
There is a `scripts/manual-tests.sh` helper script that runs a few practical `curl` examples (valid request, invalid request, rate-limiter scenario, model-fallback scenario). You can run it with:

```bash
pnpm run test:manual
```

The manual-tests script demonstrates the default JSON returned by `/hint`, headers shown, and how requests behave under rate-limiting.

## Notes

- See `PRD.md` for the project plan, technical requirements, and language expansion roadmap.
- See `COMPARISON_TESTS.md` for multi-language test cases and validation methodology.
- See `comparison-results.md` for recent test results with qwen2.5:7b.
