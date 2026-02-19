# src/errors

Custom error classes thrown throughout the app. The global error handler in
`src/middleware/errorHandler.ts` catches these and maps them to HTTP responses.

- `InputValidationError` (400) -- missing or invalid fields in the request body.
- `PromptSizeError` (400) -- assembled prompt exceeds the 32K character limit.
- `GroqApiError` (variable) -- wraps errors from the Groq API. Status code
  comes from the upstream response.
- `ModelUnavailableError` (503) -- the requested model or all fallback models
  are unavailable (circuit breaker open, etc).
