# src/types

Shared TypeScript interfaces.

- `api.ts` -- `ApiError` (extends Error with optional `status`), `HintRequest`
  (the incoming POST body shape), `HintResponse` (the outgoing response shape).
- `sanitizer.ts` -- `ChallengeType` (union of the four challenge strings),
  `RawRequestBody` (loose shape before validation), `SanitizedRequest` (strict
  shape after the sanitizer runs).
