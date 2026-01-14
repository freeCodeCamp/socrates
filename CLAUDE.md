# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

The Librarian is a TypeScript Express API that generates pedagogical hints for freeCodeCamp challenges using the Groq LLM API (llama-3.3-70b-versatile). It provides intelligent, non-solution hints to guide students through HTML, CSS, JavaScript, and Python challenges.

## Common Commands

```bash
pnpm run dev          # Start dev server (nodemon + ts-node)
pnpm run build        # Compile TypeScript to dist/
pnpm run start        # Run compiled production build
pnpm run lint         # Lint and auto-fix with Biome
pnpm run format       # Format files with Biome
pnpm run check        # Lint + format check (no writes)
pnpm run test         # Run unit tests (Vitest)
pnpm run test:watch   # Run tests in watch mode
pnpm run test:integration  # Run integration tests (requires RUN_GROQ_INTEGRATION=true)
pnpm run test:manual  # Run curl-based manual tests
```

## Architecture

### Request Flow

```
POST /hint → Rate Limiter → API Key Auth → Input Sanitization →
Prompt Building → Groq LLM Call → Output Sanitization → Response
```

### Key Components

**Entry Point (`src/index.ts`)**: Express app with middleware chain: Helmet → CORS → Body parsing → Morgan logging → Rate limiting → Routes → Error handler.

**LLM Client (`src/lib/groqClient.ts`)**: Groq API client with exponential backoff retry logic and circuit breaker pattern. Opens after `MODEL_CB_FAILURES` (default 3) failures, cooldown via `MODEL_CB_COOLDOWN_MS` (default 30s). Returns fallback hint when model unavailable.

**Rate Limiter (`src/lib/rateLimiter.ts`)**: Token bucket algorithm with Redis backend. Dual buckets: per-user (`PER_USER_LIMIT`, default 10/min) and global (`GLOBAL_LIMIT`, default 1000/min). Uses Lua script (`src/lib/lua/token_bucket.lua`) for atomic operations.

**Prompt Builder (`src/lib/promptBuilder.ts`)**: Builds LLM prompts from challenge description, student code, and test failures. Enforces `MAX_PROMPT_CHARS` (32K) limit.

**Sanitizers**: `sanitizer.ts` validates request input; `hintSanitizer.ts` cleans LLM output (removes backticks, normalizes whitespace, truncates to 300 chars).

### Configuration

**`src/config/env.ts`**: Centralized environment parsing. Requires `API_KEY` and `GROQ_API_KEY` in production.

**`src/config/prompts.ts`**: System prompt (~160 lines) defining freeCodeCamp teaching guidelines and hint patterns. User prompt template with placeholders.

### Error Types (`src/errors/`)

- `InputValidationError` (400): Missing/invalid request fields
- `PromptSizeError` (400): Prompt exceeds size limits
- `GroqApiError` (400-503): LLM API failures
- `ModelUnavailableError` (503): Circuit breaker open

### Test Organization (`src/__tests__/`)

- `groqClient.test.ts` / `groqClient.cb.test.ts`: LLM client unit tests, circuit breaker tests
- `groqClient.integration.test.ts`: Real Groq API tests (gated by env var)
- `hintRoute.test.ts` / `hintRoute.integration.test.ts`: Route unit and integration tests
- `rateLimiter.test.ts`: Token bucket logic with FakeRedis
- `sanitizer.test.ts`, `promptBuilder.test.ts`: Input/output validation tests

## API Endpoints

- `GET /health`: Health check
- `POST /hint`: Generate pedagogical hint

### Hint Request Schema

```typescript
{
  userId: string,
  description: string,      // Challenge instructions
  userInput: string,        // Student's code
  seed?: string,            // Starting code
  hints?: { text: string, failed: boolean }[]  // Test results
}
```

## Development Setup

1. Copy `.env.example` to `.env`
2. For integration tests: `docker-compose up -d` (starts Redis)
3. Run `pnpm run dev`
