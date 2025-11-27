# thelibrarian — Example Request Payloads for /hint

This file provides a set of example JSON request payloads that the front-end team can use to test the `/hint` endpoint. Each example includes a short description, a runnable curl example, and an explanation of each field.

> Note: The backend sanitizes requests through `sanitizeRequest` and returns a sanitized payload to the model (including `description`, `userInput`, and an optional `firstTest` / `failedTestText` field).

---

## 1) Simple / Minimal Valid Example

Description: Basic minimal payload that should return a hint from the model.

Request:
```json
{
  "description": "Fix the HTML heading assignment",
  "userInput": "<h1>My heading"
}
```

Curl:
```bash
curl -X POST http://localhost:3000/hint \
  -H "Content-Type: application/json" \
  -d '{"description":"Fix the HTML heading assignment","userInput":"<h1>My heading"}'
```

Fields explanation:
- `description` (string, required): Free-form natural-language description of the exercise or task.
- `userInput` (string, required): The student's code (HTML, CSS, JS, etc.). This will be trimmed and validated for non-empty string.
- `userId` (string, optional): If provided, it will be used to apply per-user rate limits. Not included in the minimal example.
- `tests` (array, optional): A list of test objects (shape varies per exercise) — the sanitization step picks the first `failed` test if present.

---

## 2) Example with Failed Test Object (commonly sent by a test harness)

Description: Payload contains a failing test object that includes `err` and `message`, representing a failing unit test. The server will sanitize it and extract a `failedTestText` to provide better LLM hints.

Request:
```json
{
  "description": "The function calculateArea should return the area for positive sides",
  "userInput": "function calculateArea(w, h) { return w + h; }",
  "tests": [
    { "name": "calculateArea returns product", "text": "Expected 6 but received 5", "err": { "message": "assert.fail" } }
  ]
}
```

Curl:
```bash
curl -X POST http://localhost:3000/hint \
  -H "Content-Type: application/json" \
  -d '{"description":"The function calculateArea should return the area for positive sides","userInput":"function calculateArea(w, h) { return w + h; }","tests":[{"name":"calculateArea returns product","text":"Expected 6 but received 5","err":{"message":"assert.fail"}}]}'
```

Fields explanation (additional):
- `tests` is an array of test objects. Each object can include:
  - `text` (string): A human-friendly test description or failing message.
  - `name` (string): Name of the test.
  - `err`/`message` (object|string): Details of the test error — these fields are used to detect a failed test so the server can pick it as a hint candidate but are stripped from the sanitized test object for privacy.

The `sanitizeRequest` function prefers `text` as the `failedTestText`, or `name` if `text` is absent. This helps the model produce targeted hints.

---

## 3) Example with `userId` (Rate-limiting scenario)

Description: A request that includes `userId` so the backend can apply per-user rate limiting. Useful for testing rate-limiter behavior.

Request:
```json
{
  "userId": "user_12345",
  "description": "Missing variable declaration in JS function",
  "userInput": "function sum(a, b) { total = a + b; return total; }",
  "tests": [
    { "name": "sum returns correct value", "text": "Should return 3 for sum(1,2)", "failed": true }
  ]
}
```

Curl:
```bash
curl -X POST http://localhost:3000/hint \
  -H "Content-Type: application/json" \
  -d '{"userId":"user_12345","description":"Missing variable declaration in JS function","userInput":"function sum(a, b) { total = a + b; return total; }","tests":[{"name":"sum returns correct value","text":"Should return 3 for sum(1,2)","failed":true}]}'
```

Fields explanation (additional):
- `userId` (string, optional): Optional user identifier; the rate-limiter uses this input to apply per-user limits as part of resource protection.

---

## 4) Large Input (Edge Case – prompt length)

Description: This tests the server’s prompt size validation. The `promptBuilder` will throw an error if the prompt is longer than `MAX_PROMPT_CHARS`.

Request: (Shortened for example; add lines of repeated text to simulate a long prompt.)
```json
{
  "description": "Large file exercise",
  "userInput": "// student code repeated many times to exceed the prompt size\n" + "something;\n".repeat(20000)
}
```

Explanation:
- This helps the front-end team ensure large uploads are handled gracefully (server will return a `4xx` InputValidationError if prompt is too long). If the client expects to accept large inputs, consider chunking or cooperating with back-end to support larger prompt size.

---

## 5) Invalid Inputs (Validation tests)

Description: Examples of invalid payloads to exercise server-side validation errors.

Request (missing `description`):
```json
{
  "userInput": "<h1>hello</h1>"
}
```

Request (missing `userInput`):
```json
{
  "description": "This sample is missing code"
}
```

Curl examples:
```bash
curl -X POST http://localhost:3000/hint -H "Content-Type: application/json" -d '{"userInput":"<h1>hello</h1>"}'
curl -X POST http://localhost:3000/hint -H "Content-Type: application/json" -d '{"description":"This sample is missing code"}'
```

Expected: The server will return a 400 with a helpful error message explaining which required field is missing.

---

## 6) Example showing sanitized test object (the server drops stack/err fields for privacy)

Request:
```json
{
  "description": "Broken example that fails with a stack trace",
  "userInput": "console.log('hi')",
  "tests": [
    {
      "name": "should not throw",
      "text": "TypeError: Cannot read property of undefined",
      "err": { "message": "TypeError: Cannot read...", "stack": "Error at ..." }
    }
  ]
}
```

Note:
- The server `sanitizeRequest` strips `err` and `stack` from the sanitized output to avoid sensitive info being sent to the model or logged; the sanitized `firstTest` will only include safe properties like `text`.

---

## How the front-end should use these examples

1. Use the above payloads to create integration tests for your UI components.
2. Send the JSON payload to `POST /hint` with `Content-Type: application/json`.
3. Expect JSON response like:
```json
{ "hint": "The model suggestion ...", "model_used": "llama3.2:3b" }
```
4. Check headers:
- `X-Model-Used` — the model name used to generate the hint.
- `X-Model-Available` (optional) — if `false`, the server used a fallback hint.

---

If you want, I can also provide: 
- A set of test-case JSON files under `test-examples/` for direct use, and
- A set of jest/vitest-based front-end mocks that simulate the `/hint` response for UI testing.

Let me know which option you'd prefer and I’ll add those files to the repo.
