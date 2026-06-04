import type { ApiError } from '../types/api';

// Sanitized snapshot of an upstream error. Kept as a normalizer for pino's
// err serializer so arbitrary non-Error values become loggable Error objects.
// With axios removed, no built-in client surfaces request headers on errors,
// so this no longer needs to strip provider-specific internals.
interface SafeErrorSnapshot {
  code?: string;
  status?: number;
  stack?: string;
}

/**
 * Normalize an unknown value into an Error. Errors pass through unchanged
 * (HttpError, GroqApiError, etc. retain their type for instanceof checks);
 * non-Error values are wrapped so pino's `{ err }` serializer can handle them.
 */
export function toSafeError(err: unknown): Error & SafeErrorSnapshot {
  if (err instanceof Error) {
    return err as Error & SafeErrorSnapshot;
  }
  return new Error(String(err)) as Error & SafeErrorSnapshot;
}

export class GroqApiError extends Error implements ApiError {
  status: number;
  isRetryable: boolean;
  originalError?: SafeErrorSnapshot;

  constructor(
    message: string,
    status: number,
    isRetryable: boolean,
    originalError?: SafeErrorSnapshot,
  ) {
    super(message);
    this.name = 'GroqApiError';
    this.status = status;
    this.isRetryable = isRetryable;
    this.originalError = originalError;
  }
}
