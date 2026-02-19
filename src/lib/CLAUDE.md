# src/lib

Core logic. These modules are called in sequence by the `/hint` route handler.

- `sanitizer.ts` -- validates and normalizes the incoming request body. Requires
  `userId`, `description`, code (`userInput` or `seed`), and at least one
  failing test. Throws `InputValidationError` on bad input.
- `promptBuilder.ts` -- assembles system + user prompts from templates in
  `src/config/prompts.ts`. Picks the system prompt based on challenge type.
  Enforces a 32K character max on the combined prompt (throws `PromptSizeError`
  if exceeded).
- `groqClient.ts` -- calls Groq's OpenAI-compatible chat completions endpoint
  via axios. Retries with exponential backoff and jitter. Has a circuit breaker
  that opens after N consecutive failures and auto-resets after a cooldown.
  Supports per-challenge-type model selection through env config.
- `hintSanitizer.ts` -- post-processes the LLM response. Strips code patterns
  (fenced code blocks, inline backticks, CSS property-value pairs) and truncates
  to 300 characters.
- `rateLimiter.ts` -- Redis-backed token bucket rate limiter. Uses
  `lua/token_bucket.lua` for atomic bucket operations. Maintains per-user and
  global buckets. Exported as a Fastify `preHandler` hook factory. If Redis is
  down, it allows requests through (graceful degradation).

### lua/

- `token_bucket.lua` -- Lua script that runs atomically inside Redis. Handles
  token refill and consumption in a single round-trip. Called by `rateLimiter.ts`
  via `redis.eval()`.
