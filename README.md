# thelibrarian

freeCodeCamp AI Hint API (The Librarian)

This repository hosts a TypeScript Express API which returns pedagogical hints for freeCodeCamp steps using a local LLM (Ollama + Llama 3.2 3B-Instruct).

## Setup (local development)

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Build for production and run:

```bash
npm run build
npm run start
```

### Developer commands

- Run in dev mode (nodemon + ts-node):

```bash
npm run dev
```

- Lint code (auto-fix allowed):

```bash
npm run lint
```

 - Format files with Prettier:

```bash
npm run format
```

- Run manual curl-based tests (helpful for debugging local Ollama/Redis):

```bash
npm run test:manual
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

# (optional) or use the convenience npm script:
npm run compose:up

# With live services running, run integration tests:
npm run test:integration

# Tear down the services after testing:
npm run compose:down
```

Tip: If you want to run *all* tests including integration, run:

```bash
# Unit tests (fast)
npm run test

# Integration test (optional):
npm run test:integration
```

Default model name used for Ollama requests is `llama3.2:3b` (see `scripts/setup-ollama.sh`).

Rate Limiting (Redis + LUA)
----------------------------

The application uses a Redis-backed token bucket for rate limiting. For production safety and correctness under concurrency, an atomic LUA script is used to update per-user and global buckets in Redis. The script is embedded and executed with `EVAL`.
 
Environment variables (defaults):
- `PER_USER_LIMIT` (default 10) — per-user requests per minute.
- `GLOBAL_LIMIT` (default 1000) — global requests per minute.

## Endpoints

- `GET /health` - health check
 - `POST /hint` - returns a pedagogical hint as JSON: `{ "hint": "string", "model_used": "string" }`. The model used is provided in the response header `X-Model-Used`.
	 - Note: If the model returns streaming chunks (JSONL/NDJSON), the server concatenates the text chunks into a single `hint` string and returns it in the `hint` field.
	 - Additional header: `X-Model-Available` may be set to `false` if a fallback hint was returned.

Manual tests & helpers
-----------------------
There is a `scripts/manual-tests.sh` helper script that runs a few practical `curl` examples (valid request, invalid request, rate-limiter scenario, model-fallback scenario). You can run it with:

```bash
npm run test:manual
```

The manual-tests script demonstrates the default JSON returned by `/hint`, headers shown, and how requests behave under rate-limiting.

## Notes

- See `PRD.md` for the project plan and technical requirements.
